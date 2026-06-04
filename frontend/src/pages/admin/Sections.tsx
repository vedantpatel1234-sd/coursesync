import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { sectionSchema } from '../../lib/validations'
import toast from 'react-hot-toast'

interface Section {
  id: string
  section_number: string
  hours_required: number
  status: string
  notes?: string
  courses: { code: string; name: string } | null
  terms: { name: string } | null
}

interface Course {
  id: string
  code: string
  name: string
}

interface Term {
  id: string
  name: string
}

export default function AdminSections() {
  const [sections, setSections] = useState<Section[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [form, setForm] = useState({
    course_id: '',
    term_id: '',
    section_number: '',
    hours_required: '3',
    notes: '',
  })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [sectionsRes, coursesRes, termsRes] = await Promise.all([
      supabase.from('sections').select('id, section_number, hours_required, status, notes, courses(code, name), terms(name)').order('created_at', { ascending: false }),
      supabase.from('courses').select('id, code, name').order('code'),
      supabase.from('terms').select('id, name').order('name'),
    ])
    if (sectionsRes.data) setSections(sectionsRes.data as any)
    if (coursesRes.data) setCourses(coursesRes.data as Course[])
    if (termsRes.data) setTerms(termsRes.data as Term[])
    setLoading(false)
  }

  async function handleAdd() {
    const result = sectionSchema.safeParse({
      course_id: form.course_id,
      term_id: form.term_id,
      section_number: form.section_number,
      hours_required: parseInt(form.hours_required),
      notes: form.notes || undefined,
    })

    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach(err => {
        const field = err.path[0] as string
        if (!fieldErrors[field]) fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setSaving(true)
    const { error } = await supabase.from('sections').insert({
      course_id: form.course_id,
      term_id: form.term_id,
      section_number: form.section_number,
      hours_required: parseInt(form.hours_required),
      notes: form.notes || null,
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Section added')
      setForm({ course_id: '', term_id: '', section_number: '', hours_required: '3', notes: '' })
      setErrors({})
      setShowForm(false)
      fetchAll()
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('sections').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Section deleted'); fetchAll() }
  }

  const statusColors: Record<string, { bg: string; color: string }> = {
    filled:     { bg: '#EAF3DE', color: '#0F6E56' },
    partial:    { bg: '#FAEEDA', color: '#854F0B' },
    unassigned: { bg: '#FCEBEB', color: '#A32D2D' },
  }

  return (
    <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        .cs-input, .cs-select { width: 100%; padding: 9px 12px; background: #F8F7F5; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; font-size: 13px; color: #1A1A2E; font-family: inherit; outline: none; box-sizing: border-box; }
        .cs-input:focus, .cs-select:focus { border-color: #534AB7; box-shadow: 0 0 0 3px rgba(83,74,183,0.1); }
        .cs-input.error, .cs-select.error { border-color: #E24B4A; box-shadow: 0 0 0 3px rgba(226,75,74,0.1); }
        .cs-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.08); background: #fff; color: #1A1A2E; font-size: 13px; font-family: inherit; cursor: pointer; transition: all 0.15s; }
        .cs-btn:hover { background: #F4F3F0; }
        .cs-btn-primary { background: #534AB7; border-color: #534AB7; color: #fff; }
        .cs-btn-primary:hover { background: #3C3489; }
        .cs-btn-danger:hover { color: #E24B4A; border-color: #E24B4A; }
        .cs-error { font-size: 11px; color: #E24B4A; margin-top: 4px; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1A1A2E', margin: '0 0 4px' }}>Sections</h1>
          <p style={{ fontSize: '14px', color: '#6B6B80', margin: 0 }}>{sections.length} sections total</p>
        </div>
        <button className="cs-btn cs-btn-primary" onClick={() => { setShowForm(!showForm); setErrors({}) }}>
          {showForm ? 'Cancel' : '+ Add section'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A2E', marginBottom: '16px' }}>New section</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Course *</label>
              <select className={`cs-select ${errors.course_id ? 'error' : ''}`} value={form.course_id}
                onChange={e => { setForm(f => ({ ...f, course_id: e.target.value })); setErrors(p => ({ ...p, course_id: undefined })) }}>
                <option value="">Select course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
              {errors.course_id && <div className="cs-error">{errors.course_id}</div>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Term *</label>
              <select className={`cs-select ${errors.term_id ? 'error' : ''}`} value={form.term_id}
                onChange={e => { setForm(f => ({ ...f, term_id: e.target.value })); setErrors(p => ({ ...p, term_id: undefined })) }}>
                <option value="">Select term</option>
                {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {errors.term_id && <div className="cs-error">{errors.term_id}</div>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Section # *</label>
              <input className={`cs-input ${errors.section_number ? 'error' : ''}`} placeholder="e.g. 01" value={form.section_number}
                onChange={e => { setForm(f => ({ ...f, section_number: e.target.value })); setErrors(p => ({ ...p, section_number: undefined })) }} />
              {errors.section_number && <div className="cs-error">{errors.section_number}</div>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Hours *</label>
              <input className={`cs-input ${errors.hours_required ? 'error' : ''}`} type="number" min="1" max="20" value={form.hours_required}
                onChange={e => { setForm(f => ({ ...f, hours_required: e.target.value })); setErrors(p => ({ ...p, hours_required: undefined })) }} />
              {errors.hours_required && <div className="cs-error">{errors.hours_required}</div>}
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Notes (optional)</label>
            <input className="cs-input" placeholder="Any notes about this section" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <button className="cs-btn cs-btn-primary" onClick={handleAdd} disabled={saving}>
            {saving ? 'Saving...' : 'Add section'}
          </button>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#F8F7F5', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Section</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Course</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Term</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Hours</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Status</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#6B6B80' }}>Loading...</td></tr>
            ) : sections.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#6B6B80' }}>No sections yet</td></tr>
            ) : sections.map((s, i) => (
              <tr key={s.id} style={{ borderBottom: i < sections.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500, color: '#1A1A2E' }}>{s.courses?.code}-{s.section_number}</td>
                <td style={{ padding: '12px 16px', color: '#6B6B80' }}>{s.courses?.name}</td>
                <td style={{ padding: '12px 16px', color: '#6B6B80' }}>{s.terms?.name}</td>
                <td style={{ padding: '12px 16px', color: '#1A1A2E' }}>{s.hours_required}h</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, background: statusColors[s.status]?.bg ?? '#F1EFE8', color: statusColors[s.status]?.color ?? '#444' }}>
                    {s.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button className="cs-btn cs-btn-danger" onClick={() => handleDelete(s.id)} style={{ fontSize: '12px', padding: '5px 10px' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}