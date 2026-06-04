import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { courseSchema } from '../../lib/validations'
import { logAction } from '../../lib/audit'
import toast from 'react-hot-toast'

interface Course {
  id: string
  code: string
  name: string
  description?: string
  created_at: string
}

export default function AdminCourses() {
  const { user } = useAuthStore()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', description: '' })
  const [errors, setErrors] = useState<{ code?: string; name?: string; description?: string }>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchCourses() }, [])

  async function fetchCourses() {
    setLoading(true)
    const { data, error } = await supabase.from('courses').select('*').order('code')
    if (error) toast.error('Failed to load courses')
    else setCourses(data as Course[])
    setLoading(false)
  }

  async function handleAdd() {
    const result = courseSchema.safeParse({
      code: form.code,
      name: form.name,
      description: form.description || undefined,
    })

    if (!result.success) {
      const fieldErrors: { code?: string; name?: string; description?: string } = {}
      result.error.issues.forEach(err => {
        const field = err.path[0] as 'code' | 'name' | 'description'
        if (!fieldErrors[field]) fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setSaving(true)
    const { error } = await supabase.from('courses').insert({
      code: form.code.toUpperCase(),
      name: form.name,
      description: form.description || null,
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Course added')
      await logAction(user!.id, 'course_created', 'courses', undefined, {
        code: form.code.toUpperCase(),
        name: form.name,
      })
      setForm({ code: '', name: '', description: '' })
      setErrors({})
      setShowForm(false)
      fetchCourses()
    }
    setSaving(false)
  }

  async function handleDelete(id: string, code: string) {
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Course deleted')
      await logAction(user!.id, 'course_deleted', 'courses', id, { code })
      fetchCourses()
    }
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
        .cs-btn-danger:hover { color: #E24B4A; border-color: #E24B4A; }
        .cs-error { font-size: 11px; color: #E24B4A; margin-top: 4px; display: flex; align-items: center; gap: 4px; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1A1A2E', margin: '0 0 4px' }}>Courses</h1>
          <p style={{ fontSize: '14px', color: '#6B6B80', margin: 0 }}>{courses.length} courses in the system</p>
        </div>
        <button className="cs-btn cs-btn-primary" onClick={() => { setShowForm(!showForm); setErrors({}) }}>
          {showForm ? 'Cancel' : '+ Add course'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A2E', marginBottom: '16px' }}>New course</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Course code *</label>
              <input className={`cs-input ${errors.code ? 'error' : ''}`} placeholder="e.g. COMP1234" value={form.code}
                onChange={e => { setForm(f => ({ ...f, code: e.target.value })); setErrors(p => ({ ...p, code: undefined })) }} />
              {errors.code && <div className="cs-error">{errors.code}</div>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Course name *</label>
              <input className={`cs-input ${errors.name ? 'error' : ''}`} placeholder="e.g. Introduction to Programming" value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(p => ({ ...p, name: undefined })) }} />
              {errors.name && <div className="cs-error">{errors.name}</div>}
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Description (optional)</label>
            <input className={`cs-input ${errors.description ? 'error' : ''}`} placeholder="Brief description of the course" value={form.description}
              onChange={e => { setForm(f => ({ ...f, description: e.target.value })); setErrors(p => ({ ...p, description: undefined })) }} />
            {errors.description && <div className="cs-error">{errors.description}</div>}
          </div>
          <button className="cs-btn cs-btn-primary" onClick={handleAdd} disabled={saving}>
            {saving ? 'Saving...' : 'Add course'}
          </button>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#F8F7F5', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Code</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Name</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Description</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#6B6B80' }}>Loading...</td></tr>
            ) : courses.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#6B6B80' }}>No courses yet — add one above</td></tr>
            ) : courses.map((course, i) => (
              <tr key={course.id} style={{ borderBottom: i < courses.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: '#EEEDFE', color: '#534AB7', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}>
                    {course.code}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#1A1A2E', fontWeight: 500 }}>{course.name}</td>
                <td style={{ padding: '12px 16px', color: '#6B6B80' }}>{course.description ?? '—'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <button className="cs-btn cs-btn-danger" onClick={() => handleDelete(course.id, course.code)}
                    style={{ fontSize: '12px', padding: '5px 10px' }}>
                    Delete
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