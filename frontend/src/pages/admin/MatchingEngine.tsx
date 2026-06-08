import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { logAction } from '../../lib/audit'
import toast from 'react-hot-toast'

interface Section {
  id: string
  section_number: string
  hours_required: number
  status: string
  course_id: string
  courses: { code: string; name: string } | null
}

interface Instructor {
  id: string
  full_name: string
  instructor_profiles: { max_hours_per_term: number }[] | null
}

interface Suggestion {
  section_id: string
  instructor_id: string
  score: number
  reasons: string[]
  section?: Section
  instructor?: Instructor
}

interface ConflictLog {
  section_id: string
  instructor_id?: string
  reason: string
  conflict_type: string
  section?: Section
  instructor?: Instructor
}

interface Term {
  id: string
  name: string
}

interface Draft {
  id: string
  name: string
  status: string
  terms: { name: string } | null
}

export default function AdminMatchingEngine() {
  const { user } = useAuthStore()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [selectedDraft, setSelectedDraft] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [running, setRunning] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [conflicts, setConflicts] = useState<ConflictLog[]>([])
  const [unresolvedSections, setUnresolvedSections] = useState<string[]>([])
  const [accepted, setAccepted] = useState<Set<string>>(new Set())
  const [publishing, setPublishing] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [draftsRes, termsRes] = await Promise.all([
      supabase.from('drafts').select('id, name, status, terms(name)').eq('status', 'sandbox').order('created_at', { ascending: false }),
      supabase.from('terms').select('id, name').order('name'),
    ])
    if (draftsRes.data) setDrafts(draftsRes.data as any)
    if (termsRes.data) setTerms(termsRes.data as Term[])
  }

  async function runMatching() {
    if (!selectedDraft || !selectedTerm) {
      toast.error('Please select a draft and term')
      return
    }

    setRunning(true)
    setSuggestions([])
    setConflicts([])
    setUnresolvedSections([])
    setAccepted(new Set())

    try {
      const [sectionsRes, instructorsRes, qualsRes, prefsRes, assignmentsRes] = await Promise.all([
        supabase.from('sections').select('id, section_number, hours_required, status, course_id, courses(code, name)').eq('term_id', selectedTerm),
        supabase.from('profiles').select('id, full_name, instructor_profiles(max_hours_per_term)').eq('role', 'instructor'),
        supabase.from('qualifications').select('instructor_id, course_id, verified').eq('verified', true),
        supabase.from('preferences').select('instructor_id, section_id, rank'),
        supabase.from('assignments').select('instructor_id, hours_assigned, status').is('draft_id', null).neq('status', 'rejected'),
      ])

      const sections = (sectionsRes.data ?? []) as any[]
      const instructors = (instructorsRes.data ?? []) as any[]
      const qualifications = (qualsRes.data ?? []) as any[]
      const preferences = (prefsRes.data ?? []) as any[]
      const existingAssignments = (assignmentsRes.data ?? []) as any[]

      const hoursMap: Record<string, number> = {}
      existingAssignments.forEach((a: any) => {
        hoursMap[a.instructor_id] = (hoursMap[a.instructor_id] ?? 0) + a.hours_assigned
      })

      const weights = { preference_rank: 0.5, qualification: 0.3, workload_balance: 0.2 }

      const qualMap = new Map<string, Set<string>>()
      qualifications.forEach((q: any) => {
        if (!qualMap.has(q.instructor_id)) qualMap.set(q.instructor_id, new Set())
        qualMap.get(q.instructor_id)!.add(q.course_id)
      })

      const prefMap = new Map<string, number>()
      preferences.forEach((p: any) => prefMap.set(`${p.instructor_id}:${p.section_id}`, p.rank))

      const runningHours = new Map<string, number>()
      instructors.forEach((i: any) => runningHours.set(i.id, hoursMap[i.id] ?? 0))

      const maxHoursMap = new Map<string, number>()
      instructors.forEach((i: any) => maxHoursMap.set(i.id, i.instructor_profiles?.[0]?.max_hours_per_term ?? 40))

      const newSuggestions: Suggestion[] = []
      const newConflicts: ConflictLog[] = []
      const newUnresolved: string[] = []

      for (const section of sections) {
        if (section.status === 'filled') continue

        let bestScore = -Infinity
        let bestInstructor: string | null = null
        const bestReasons: string[] = []

        for (const instructor of instructors) {
          const qualified = qualMap.get(instructor.id)?.has(section.course_id) ?? false
          const currentHours = runningHours.get(instructor.id) ?? 0
          const max = maxHoursMap.get(instructor.id) ?? 40
          const wouldExceed = currentHours + section.hours_required > max

          if (!qualified) {
            newConflicts.push({
              section_id: section.id,
              instructor_id: instructor.id,
              reason: `${instructor.full_name} is not qualified for ${section.courses?.code}`,
              conflict_type: 'not_qualified',
              section,
              instructor,
            })
            continue
          }

          if (wouldExceed) {
            newConflicts.push({
              section_id: section.id,
              instructor_id: instructor.id,
              reason: `Assigning ${section.hours_required}h would put ${instructor.full_name} at ${currentHours + section.hours_required}h — exceeds ${max}h limit`,
              conflict_type: 'over_hours',
              section,
              instructor,
            })
            continue
          }

          const prefRank = prefMap.get(`${instructor.id}:${section.id}`)
          const prefScore = prefRank != null ? (10 - prefRank) / 9 : 0.5
          const capacityRatio = (max - currentHours) / max
          const score = weights.preference_rank * prefScore + weights.qualification * 1.0 + weights.workload_balance * capacityRatio

          if (score > bestScore) {
            bestScore = score
            bestInstructor = instructor.id
            bestReasons.length = 0
            bestReasons.push(
              `Qualified for ${section.courses?.code}`,
              prefRank != null ? `Instructor ranked this section #${prefRank}` : 'No preference submitted',
              `${max - currentHours}h remaining capacity`,
            )
          }
        }

        if (bestInstructor) {
          const instructorObj = instructors.find((i: any) => i.id === bestInstructor)
          newSuggestions.push({
            section_id: section.id,
            instructor_id: bestInstructor,
            score: Math.round(bestScore * 100) / 100,
            reasons: [...bestReasons],
            section,
            instructor: instructorObj,
          })
          runningHours.set(bestInstructor, (runningHours.get(bestInstructor) ?? 0) + section.hours_required)
        } else {
          newUnresolved.push(section.id)
          newConflicts.push({
            section_id: section.id,
            reason: `No qualified instructor with sufficient hours found for ${section.courses?.code}-${section.section_number}`,
            conflict_type: 'unresolved',
            section,
          })
        }
      }

      setSuggestions(newSuggestions)
      setConflicts(newConflicts.filter(c => newUnresolved.includes(c.section_id)))
      setUnresolvedSections(newUnresolved)

      await supabase.from('drafts').update({ is_ai_generated: true }).eq('id', selectedDraft)

      toast.success(`Matching complete — ${newSuggestions.length} suggestions, ${newUnresolved.length} unresolved`)
    } catch (err: any) {
      toast.error(err.message)
    }

    setRunning(false)
  }

  function toggleAccept(sectionId: string) {
    setAccepted(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  function acceptAll() {
    setAccepted(new Set(suggestions.map(s => s.section_id)))
  }

  async function publishAccepted() {
    if (accepted.size === 0) {
      toast.error('No suggestions accepted yet')
      return
    }

    setPublishing(true)
    try {
      const toPublish = suggestions.filter(s => accepted.has(s.section_id))

      for (const suggestion of toPublish) {
        const section = suggestion.section
        if (!section) continue
        await supabase.from('assignments').insert({
          instructor_id: suggestion.instructor_id,
          section_id: suggestion.section_id,
          hours_assigned: section.hours_required,
          status: 'confirmed',
          assigned_by: user?.id,
          draft_id: null,
        })
      }

      await supabase.from('drafts').update({
        status: 'published',
        published_at: new Date().toISOString(),
      }).eq('id', selectedDraft)

      await logAction(user!.id, 'draft_published', 'drafts', selectedDraft, {
        assignments_created: toPublish.length,
      })

      toast.success(`${toPublish.length} assignments published successfully`)
      setSuggestions([])
      setConflicts([])
      setAccepted(new Set())
      setSelectedDraft('')
      fetchData()
    } catch (err: any) {
      toast.error(err.message)
    }
    setPublishing(false)
  }

  const scoreColor = (score: number) => {
    if (score >= 0.8) return { bg: '#EAF3DE', color: '#0F6E56' }
    if (score >= 0.5) return { bg: '#EEEDFE', color: '#534AB7' }
    return { bg: '#FAEEDA', color: '#854F0B' }
  }

  return (
    <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        .cs-select { width: 100%; padding: 9px 12px; background: #F8F7F5; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; font-size: 13px; color: #1A1A2E; font-family: inherit; outline: none; box-sizing: border-box; }
        .cs-select:focus { border-color: #534AB7; box-shadow: 0 0 0 3px rgba(83,74,183,0.1); }
        .cs-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.08); background: #fff; color: #1A1A2E; font-size: 13px; font-family: inherit; cursor: pointer; transition: all 0.15s; }
        .cs-btn:hover { background: #F4F3F0; }
        .cs-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .cs-btn-primary { background: #534AB7; border-color: #534AB7; color: #fff; }
        .cs-btn-primary:hover:not(:disabled) { background: #3C3489; }
        .cs-btn-green { background: #1D9E75; border-color: #1D9E75; color: #fff; }
        .cs-btn-green:hover:not(:disabled) { background: #0F6E56; }
      `}</style>

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1A1A2E', margin: '0 0 4px' }}>Matching Engine</h1>
        <p style={{ fontSize: '14px', color: '#6B6B80', margin: 0 }}>Run the weighted scoring algorithm to generate assignment suggestions</p>
      </div>

      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A2E', marginBottom: '16px' }}>Configure matching run</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Select draft</label>
            <select className="cs-select" value={selectedDraft} onChange={e => setSelectedDraft(e.target.value)}>
              <option value="">Select sandbox draft</option>
              {drafts.map(d => <option key={d.id} value={d.id}>{d.name} — {d.terms?.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Select term</label>
            <select className="cs-select" value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}>
              <option value="">Select term</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <button className="cs-btn cs-btn-primary" onClick={runMatching} disabled={running || !selectedDraft || !selectedTerm}>
            {running ? 'Running...' : '▶ Run matching'}
          </button>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
          {[
            { label: 'Preference rank', weight: '50%', color: '#534AB7' },
            { label: 'Qualification', weight: '30%', color: '#1D9E75' },
            { label: 'Workload balance', weight: '20%', color: '#EF9F27' },
          ].map(w => (
            <div key={w.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B6B80' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: w.color }} />
              {w.label}: <strong style={{ color: '#1A1A2E' }}>{w.weight}</strong>
            </div>
          ))}
        </div>
      </div>

      {suggestions.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Suggestions', value: suggestions.length, color: '#0F6E56' },
              { label: 'Accepted', value: accepted.size, color: '#534AB7' },
              { label: 'Unresolved', value: unresolvedSections.length, color: '#A32D2D' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '16px 20px' }}>
                <div style={{ fontSize: '12px', color: '#6B6B80', marginBottom: '6px' }}>{s.label}</div>
                <div style={{ fontSize: '28px', fontWeight: 500, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button className="cs-btn" onClick={acceptAll}>Accept all</button>
            <button className="cs-btn cs-btn-green" onClick={publishAccepted} disabled={publishing || accepted.size === 0}>
              {publishing ? 'Publishing...' : `Publish ${accepted.size} accepted`}
            </button>
          </div>

          <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', fontSize: '14px', fontWeight: 500, color: '#1A1A2E' }}>
              Suggested assignments
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8F7F5', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Section</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Suggested instructor</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Score</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Reasons</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s, i) => {
                  const sc = scoreColor(s.score)
                  const isAccepted = accepted.has(s.section_id)
                  return (
                    <tr key={s.section_id} style={{
                      borderBottom: i < suggestions.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                      background: isAccepted ? '#F8FFF8' : 'white',
                    }}>
                      <td style={{ padding: '12px 16px', fontWeight: 500, color: '#1A1A2E' }}>
                        {s.section?.courses?.code}-{s.section?.section_number}
                        <div style={{ fontSize: '11px', color: '#6B6B80', fontWeight: 400 }}>{s.section?.courses?.name}</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#1A1A2E' }}>{s.instructor?.full_name}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, background: sc.bg, color: sc.color }}>
                          {s.score}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6B6B80', fontSize: '12px' }}>
                        {s.reasons.join(' · ')}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={() => toggleAccept(s.section_id)}
                          style={{
                            padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit',
                            cursor: 'pointer', border: '1px solid',
                            background: isAccepted ? '#EAF3DE' : '#fff',
                            color: isAccepted ? '#0F6E56' : '#6B6B80',
                            borderColor: isAccepted ? '#1D9E75' : 'rgba(0,0,0,0.08)',
                          }}
                        >
                          {isAccepted ? '✓ Accepted' : 'Accept'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {conflicts.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', fontSize: '14px', fontWeight: 500, color: '#1A1A2E' }}>
                Conflicts & unresolved sections
              </div>
              <div style={{ padding: '16px' }}>
                {conflicts.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', background: '#FCEBEB', borderRadius: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '16px' }}>⚠️</span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#A32D2D' }}>
                        {c.section?.courses?.code}-{c.section?.section_number}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B6B80', marginTop: '2px' }}>{c.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {suggestions.length === 0 && !running && (
        <div style={{ textAlign: 'center', padding: '64px', color: '#6B6B80', background: '#fff', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚡</div>
          <div style={{ fontSize: '15px', fontWeight: 500, color: '#1A1A2E', marginBottom: '6px' }}>Ready to run matching</div>
          <div style={{ fontSize: '13px' }}>Select a draft and term above, then click Run matching</div>
        </div>
      )}
    </div>
  )
}