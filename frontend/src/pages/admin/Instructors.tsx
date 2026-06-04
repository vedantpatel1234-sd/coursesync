import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { instructorSchema } from '../../lib/validations'
import toast from 'react-hot-toast'

interface Instructor {
  id: string
  full_name: string
  email: string
  created_at: string
  hours_assigned: number
  instructor_profiles: {
    max_hours_per_term: number
    department?: string
    title?: string
  }[] | null
}

export default function AdminInstructors() {
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    department: '',
    title: '',
    max_hours: '40',
  })

  useEffect(() => { fetchInstructors() }, [])

  async function fetchInstructors() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, created_at, instructor_profiles(max_hours_per_term, department, title)')
      .eq('role', 'instructor')
      .order('full_name')
    if (error) toast.error('Failed to load instructors')

    const { data: assignmentData } = await supabase
      .from('assignments')
      .select('instructor_id, hours_assigned, status')
      .is('draft_id', null)
      .neq('status', 'rejected')

    const hoursMap: Record<string, number> = {}
    if (assignmentData) {
      assignmentData.forEach((a: any) => {
        hoursMap[a.instructor_id] = (hoursMap[a.instructor_id] ?? 0) + a.hours_assigned
      })
    }

    if (data) {
      setInstructors(data.map((i: any) => ({
        ...i,
        hours_assigned: hoursMap[i.id] ?? 0,
      })) as any)
    }
    setLoading(false)
  }

  async function handleAdd() {
    const result = instructorSchema.safeParse({
      full_name: form.full_name,
      email: form.email,
      password: form.password,
      department: form.department || undefined,
      title: form.title || undefined,
      max_hours: parseInt(form.max_hours),
    })

    if (!result.success) {
      const fieldErrors: Record<string, string | undefined> = {}
      result.error.issues.forEach(err => {
        const field = err.path[0] as string
        if (!fieldErrors[field]) fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setSaving(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.full_name, role: 'instructor' }
        }
      })
      if (authError) throw new Error(authError.message)

      if (authData.user) {
        await supabase.from('instructor_profiles').insert({
          user_id: authData.user.id,
          max_hours_per_term: parseInt(form.max_hours),
          department: form.department || null,
          title: form.title || null,
        })
      }

      toast.success('Instructor added — they can now log in')
      setForm({ full_name: '', email: '', password: '', department: '', title: '', max_hours: '40' })
      setErrors({})
      setShowForm(false)
      fetchInstructors()
    } catch (err: any) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Are you sure you want to delete ${email}? This will remove all their assignments and qualifications.`)) return
    setDeleting(id)
    try {
      // Delete assignments first
      await supabase.from('assignments').delete().eq('instructor_id', id)
      await supabase.from('preferences').delete().eq('instructor_id', id)
      await supabase.from('qualifications').delete().eq('instructor_id', id)
      await supabase.from('instructor_profiles').delete().eq('user_id', id)
      await supabase.from('profiles').delete().eq('id', id)
      toast.success('Instructor removed')
      fetchInstructors()
    } catch (err: any) {
      toast.error(err.message)
    }
    setDeleting(null)
  }

  return (
    <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        .cs-input { width: 100%; padding: 9px 12px; background: #F8F7F5; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; font-size: 13px; color: #1A1A2E; font-family: inherit; outline: none; box-sizing: border-box; }
        .cs-input:focus { border-color: #534AB7; box-shadow: 0 0 0 3px rgba(83,74,183,0.1); }
        .cs-input.error { border-color: #E24B4A; box-shadow: 0 0 0 3px rgba(226,75,74,0.1); }
        .cs-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.08); background: #fff; color: #1A1A2E; font-size: 13px; font-family: inherit; cursor: pointer; transition: all 0.15s; }
        .cs-btn:hover { background: #F4F3F0; }
        .cs-btn-primary { background: #534AB7; border-color: #534AB7; color: #fff; }
        .cs-btn-primary:hover { background: #3C3489; }
        .cs-btn-danger { font-size: 11px; padding: 5px 10px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.08); background: #fff; color: #6B6B80; font-family: inherit; cursor: pointer; transition: all 0.15s; }
        .cs-btn-danger:hover { color: #E24B4A; border-color: #E24B4A; background: #FCEBEB; }
        .cs-error { font-size: 11px; color: #E24B4A; margin-top: 4px; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1A1A2E', margin: '0 0 4px' }}>Instructors</h1>
          <p style={{ fontSize: '14px', color: '#6B6B80', margin: 0 }}>{instructors.length} instructors in the system</p>
        </div>
        <button className="cs-btn cs-btn-primary" onClick={() => { setShowForm(!showForm); setErrors({}) }}>
          {showForm ? 'Cancel' : '+ Add instructor'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A2E', marginBottom: '16px' }}>New instructor</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Full name *</label>
              <input className={`cs-input ${errors.full_name ? 'error' : ''}`} placeholder="Dr. Jane Smith" value={form.full_name}
                onChange={e => { setForm(f => ({ ...f, full_name: e.target.value })); setErrors(p => ({ ...p, full_name: undefined })) }} />
              {errors.full_name && <div className="cs-error">{errors.full_name}</div>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Email *</label>
              <input className={`cs-input ${errors.email ? 'error' : ''}`} type="email" placeholder="jane@university.ca" value={form.email}
                onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(p => ({ ...p, email: undefined })) }} />
              {errors.email && <div className="cs-error">{errors.email}</div>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Password *</label>
              <input className={`cs-input ${errors.password ? 'error' : ''}`} type="password" placeholder="Min 8 chars, uppercase, number" value={form.password}
                onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setErrors(p => ({ ...p, password: undefined })) }} />
              {errors.password && <div className="cs-error">{errors.password}</div>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Title</label>
              <input className="cs-input" placeholder="e.g. Lecturer" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Department</label>
              <input className="cs-input" placeholder="e.g. Computer Science" value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Max hours/term</label>
              <input className={`cs-input ${errors.max_hours ? 'error' : ''}`} type="number" min="1" max="100" value={form.max_hours}
                onChange={e => { setForm(f => ({ ...f, max_hours: e.target.value })); setErrors(p => ({ ...p, max_hours: undefined })) }} />
              {errors.max_hours && <div className="cs-error">{errors.max_hours}</div>}
            </div>
          </div>
          <button className="cs-btn cs-btn-primary" onClick={handleAdd} disabled={saving}>
            {saving ? 'Saving...' : 'Add instructor'}
          </button>
        </div>
      )}

      {/* Instructors grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#6B6B80' }}>Loading...</div>
      ) : instructors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#6B6B80', background: '#fff', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.07)' }}>
          No instructors yet — add one above
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {instructors.map(instructor => {
            const profile = instructor.instructor_profiles?.[0]
            const maxHours = profile?.max_hours_per_term ?? 40
            const pct = Math.min((instructor.hours_assigned / maxHours) * 100, 100)
            const barColor = pct >= 100 ? '#E24B4A' : pct >= 85 ? '#EF9F27' : '#1D9E75'
            return (
              <div key={instructor.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '20px' }}>
                {/* Avatar + delete */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 500, color: '#534AB7', flexShrink: 0 }}>
                      {instructor.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A2E' }}>{instructor.full_name}</div>
                      <div style={{ fontSize: '12px', color: '#6B6B80' }}>{instructor.email}</div>
                    </div>
                  </div>
                  <button
                    className="cs-btn-danger"
                    onClick={() => handleDelete(instructor.id, instructor.email)}
                    disabled={deleting === instructor.id}
                  >
                    {deleting === instructor.id ? '...' : 'Remove'}
                  </button>
                </div>

                {/* Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {profile?.title && <div style={{ fontSize: '12px', color: '#6B6B80' }}><span style={{ color: '#1A1A2E', fontWeight: 500 }}>Title: </span>{profile.title}</div>}
                  {profile?.department && <div style={{ fontSize: '12px', color: '#6B6B80' }}><span style={{ color: '#1A1A2E', fontWeight: 500 }}>Dept: </span>{profile.department}</div>}
                  <div style={{ fontSize: '12px', color: '#6B6B80' }}><span style={{ color: '#1A1A2E', fontWeight: 500 }}>Max hours: </span>{maxHours}h/term</div>
                </div>

                {/* Workload bar */}
                <div style={{ marginTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6B6B80', marginBottom: '4px' }}>
                    <span>Workload</span>
                    <span>{instructor.hours_assigned}/{maxHours}h</span>
                  </div>
                  <div style={{ height: '4px', background: '#F1EFE8', borderRadius: '2px' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '2px' }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}