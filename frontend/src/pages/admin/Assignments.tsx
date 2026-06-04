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
  courses: { code: string; name: string } | null
  terms: { name: string } | null
}

interface Instructor {
  id: string
  full_name: string
  hours_assigned: number
  max_hours: number
}

interface Assignment {
  id: string
  hours_assigned: number
  status: string
  instructor_id: string
  section_id: string
  sections: {
    section_number: string
    courses: { code: string; name: string } | null
  } | null
}

export default function AdminAssignments() {
  const { user } = useAuthStore()
  const [sections, setSections] = useState<Section[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSection, setSelectedSection] = useState('')
  const [selectedInstructor, setSelectedInstructor] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)

    const [sectionsRes, instructorsRes] = await Promise.all([
      supabase.from('sections')
        .select('id, section_number, hours_required, status, courses(code, name), terms(name)')
        .order('created_at'),
      supabase.from('profiles')
        .select('id, full_name, instructor_profiles(max_hours_per_term)')
        .eq('role', 'instructor'),
    ])

    const { data: assignmentsData } = await supabase
      .from('assignments')
      .select('id, hours_assigned, status, instructor_id, section_id, sections(section_number, courses(code, name))')
      .is('draft_id', null)
      .order('created_at', { ascending: false })

    if (sectionsRes.data) setSections(sectionsRes.data as any)
    if (assignmentsData) setAssignments(assignmentsData as any)

    if (instructorsRes.data) {
      const hoursMap: Record<string, number> = {}
      if (assignmentsData) {
        assignmentsData.forEach((a: any) => {
          if (a.status !== 'rejected') {
            hoursMap[a.instructor_id] = (hoursMap[a.instructor_id] ?? 0) + a.hours_assigned
          }
        })
      }
      setInstructors(instructorsRes.data.map((i: any) => ({
        id: i.id,
        full_name: i.full_name,
        hours_assigned: hoursMap[i.id] ?? 0,
        max_hours: i.instructor_profiles?.[0]?.max_hours_per_term ?? 40,
      })))
    }

    setLoading(false)
  }

  async function handleAssign() {
    if (!selectedSection || !selectedInstructor) {
      toast.error('Please select both a section and an instructor')
      return
    }

    const section = sections.find(s => s.id === selectedSection)
    const instructor = instructors.find(i => i.id === selectedInstructor)
    if (!section || !instructor) return

    const sectionAlreadyAssigned = assignments.find(a => a.section_id === selectedSection)
    if (sectionAlreadyAssigned) {
      const assignedInstructor = instructors.find(i => i.id === sectionAlreadyAssigned.instructor_id)
      toast.error(`This section is already assigned to ${assignedInstructor?.full_name ?? 'another instructor'}. Remove the existing assignment first.`)
      return
    }

    if (instructor.hours_assigned + section.hours_required > instructor.max_hours) {
      toast.error(
        `Cannot assign — ${instructor.full_name} would exceed their ${instructor.max_hours}h limit. ` +
        `They currently have ${instructor.hours_assigned}h assigned.`
      )
      return
    }

    setSaving(true)
    const { error } = await supabase.from('assignments').insert({
      instructor_id: selectedInstructor,
      section_id: selectedSection,
      hours_assigned: section.hours_required,
      status: 'confirmed',
      assigned_by: user?.id,
    })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Assignment created')
      await logAction(user!.id, 'assignment_created', 'assignments', undefined, {
        instructor: instructor.full_name,
        section: `${section.courses?.code}-${section.section_number}`,
        hours: section.hours_required,
      })
      setSelectedSection('')
      setSelectedInstructor('')
      fetchAll()
    }
    setSaving(false)
  }

  async function handleRemove(id: string) {
    const { error } = await supabase.from('assignments').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Assignment removed')
      await logAction(user!.id, 'assignment_removed', 'assignments', id)
      fetchAll()
    }
  }

  const statusColors: Record<string, { bg: string; color: string }> = {
    filled:     { bg: '#EAF3DE', color: '#0F6E56' },
    partial:    { bg: '#FAEEDA', color: '#854F0B' },
    unassigned: { bg: '#FCEBEB', color: '#A32D2D' },
  }

  const assignmentColors: Record<string, { bg: string; color: string }> = {
    confirmed: { bg: '#EAF3DE', color: '#0F6E56' },
    pending:   { bg: '#FAEEDA', color: '#854F0B' },
    rejected:  { bg: '#FCEBEB', color: '#A32D2D' },
  }

  return (
    <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        .cs-select { width: 100%; padding: 9px 12px; background: #F8F7F5; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; font-size: 13px; color: #1A1A2E; font-family: inherit; outline: none; box-sizing: border-box; }
        .cs-select:focus { border-color: #534AB7; box-shadow: 0 0 0 3px rgba(83,74,183,0.1); }
        .cs-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.08); background: #fff; color: #1A1A2E; font-size: 13px; font-family: inherit; cursor: pointer; transition: all 0.15s; }
        .cs-btn:hover { background: #F4F3F0; }
        .cs-btn-primary { background: #534AB7; border-color: #534AB7; color: #fff; }
        .cs-btn-primary:hover { background: #3C3489; }
        .cs-btn-danger:hover { color: #E24B4A; border-color: #E24B4A; }
      `}</style>

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1A1A2E', margin: '0 0 4px' }}>Assignments</h1>
        <p style={{ fontSize: '14px', color: '#6B6B80', margin: 0 }}>Assign instructors to course sections</p>
      </div>

      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A2E', marginBottom: '16px' }}>New assignment</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: '12px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Section</label>
            <select className="cs-select" value={selectedSection} onChange={e => setSelectedSection(e.target.value)}>
              <option value="">Select section</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>
                  {s.courses?.code}-{s.section_number} — {s.courses?.name} ({s.hours_required}h)
                  {assignments.some(a => a.section_id === s.id) ? ' ✓ Assigned' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Instructor</label>
            <select className="cs-select" value={selectedInstructor} onChange={e => setSelectedInstructor(e.target.value)}>
              <option value="">Select instructor</option>
              {instructors.map(i => (
                <option key={i.id} value={i.id}>
                  {i.full_name} ({i.hours_assigned}/{i.max_hours}h)
                </option>
              ))}
            </select>
          </div>
          <button className="cs-btn cs-btn-primary" onClick={handleAssign} disabled={saving}>
            {saving ? 'Saving...' : 'Assign'}
          </button>
        </div>

        {selectedSection && selectedInstructor && (() => {
          const section = sections.find(s => s.id === selectedSection)
          const instructor = instructors.find(i => i.id === selectedInstructor)
          if (!section || !instructor) return null
          const sectionAlreadyAssigned = assignments.find(a => a.section_id === selectedSection)
          const wouldExceed = instructor.hours_assigned + section.hours_required > instructor.max_hours
          if (sectionAlreadyAssigned) {
            const assignedInstructor = instructors.find(i => i.id === sectionAlreadyAssigned.instructor_id)
            return (
              <div style={{ marginTop: '12px', background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#A32D2D' }}>
                ⚠️ <strong>Section already assigned:</strong> This section is already assigned to {assignedInstructor?.full_name ?? 'another instructor'}. Remove the existing assignment first.
              </div>
            )
          }
          if (wouldExceed) return (
            <div style={{ marginTop: '12px', background: '#FAEEDA', border: '1px solid #EF9F27', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#854F0B' }}>
              ⚠️ <strong>Hour limit conflict:</strong> Assigning {section.hours_required}h would put {instructor.full_name} at {instructor.hours_assigned + section.hours_required}h — exceeds their {instructor.max_hours}h limit.
            </div>
          )
          return (
            <div style={{ marginTop: '12px', background: '#EAF3DE', border: '1px solid #1D9E75', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#0F6E56' }}>
              ✓ <strong>Valid assignment:</strong> {instructor.full_name} has {instructor.max_hours - instructor.hours_assigned}h remaining — assigning {section.hours_required}h is within their limit.
            </div>
          )
        })()}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A2E', marginBottom: '16px' }}>Section status</div>
          {loading ? (
            <div style={{ color: '#6B6B80', fontSize: '13px', textAlign: 'center', padding: '24px' }}>Loading...</div>
          ) : sections.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < sections.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#1A1A2E' }}>{s.courses?.code}-{s.section_number}</div>
                <div style={{ fontSize: '12px', color: '#6B6B80' }}>{s.courses?.name} · {s.hours_required}h</div>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, background: statusColors[s.status]?.bg ?? '#F1EFE8', color: statusColors[s.status]?.color ?? '#444' }}>
                {s.status}
              </span>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A2E', marginBottom: '16px' }}>Instructor workload</div>
          {loading ? (
            <div style={{ color: '#6B6B80', fontSize: '13px', textAlign: 'center', padding: '24px' }}>Loading...</div>
          ) : instructors.length === 0 ? (
            <div style={{ color: '#6B6B80', fontSize: '13px', textAlign: 'center', padding: '24px' }}>No instructors yet</div>
          ) : instructors.map(i => {
            const pct = Math.min((i.hours_assigned / i.max_hours) * 100, 100)
            const barColor = pct >= 100 ? '#E24B4A' : pct >= 85 ? '#EF9F27' : '#1D9E75'
            return (
              <div key={i.id} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span style={{ color: '#1A1A2E', fontWeight: 500 }}>{i.full_name}</span>
                  <span style={{ color: '#6B6B80' }}>{i.hours_assigned}/{i.max_hours}h</span>
                </div>
                <div style={{ height: '5px', background: '#F1EFE8', borderRadius: '3px' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '3px', transition: 'width 0.3s' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', overflow: 'hidden', marginTop: '16px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', fontSize: '14px', fontWeight: 500, color: '#1A1A2E' }}>
          All assignments
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#F8F7F5', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Section</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Instructor</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Hours</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Status</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#6B6B80' }}>Loading...</td></tr>
            ) : assignments.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#6B6B80' }}>No assignments yet — create one above</td></tr>
            ) : assignments.map((a, i) => (
              <tr key={a.id} style={{ borderBottom: i < assignments.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500, color: '#1A1A2E' }}>
                  {a.sections?.courses?.code}-{a.sections?.section_number}
                </td>
                <td style={{ padding: '12px 16px', color: '#1A1A2E' }}>
                  {instructors.find(i => i.id === a.instructor_id)?.full_name ?? '—'}
                </td>
                <td style={{ padding: '12px 16px', color: '#6B6B80' }}>{a.hours_assigned}h</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, background: assignmentColors[a.status]?.bg ?? '#F1EFE8', color: assignmentColors[a.status]?.color ?? '#444' }}>
                    {a.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button className="cs-btn cs-btn-danger" onClick={() => handleRemove(a.id)}
                    style={{ fontSize: '12px', padding: '5px 10px' }}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}