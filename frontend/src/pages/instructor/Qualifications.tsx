import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'

interface Course {
  id: string
  code: string
  name: string
  description?: string
}

interface Qualification {
  id: string
  course_id: string
  verified: boolean
}

export default function InstructorQualifications() {
  const { user } = useAuthStore()
  const [courses, setCourses] = useState<Course[]>([])
  const [qualifications, setQualifications] = useState<Qualification[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => { if (user) fetchData() }, [user])

  async function fetchData() {
    setLoading(true)
    const [coursesRes, qualsRes] = await Promise.all([
      supabase.from('courses').select('*').order('code'),
      supabase.from('qualifications').select('id, course_id, verified').eq('instructor_id', user!.id),
    ])
    if (coursesRes.data) setCourses(coursesRes.data as Course[])
    if (qualsRes.data) setQualifications(qualsRes.data as Qualification[])
    setLoading(false)
  }

  function isQualified(courseId: string) {
    return qualifications.some(q => q.course_id === courseId)
  }

  function isVerified(courseId: string) {
    return qualifications.find(q => q.course_id === courseId)?.verified ?? false
  }

  async function toggleQualification(courseId: string) {
    setSaving(courseId)
    const existing = qualifications.find(q => q.course_id === courseId)

    if (existing) {
      // Remove qualification
      const { error } = await supabase
        .from('qualifications')
        .delete()
        .eq('id', existing.id)
      if (error) toast.error(error.message)
      else {
        toast.success('Qualification removed')
        setQualifications(q => q.filter(q => q.course_id !== courseId))
      }
    } else {
      // Add qualification
      const { data, error } = await supabase
        .from('qualifications')
        .insert({ instructor_id: user!.id, course_id: courseId, verified: false })
        .select()
        .single()
      if (error) toast.error(error.message)
      else {
        toast.success('Qualification added — pending admin verification')
        setQualifications(q => [...q, data as Qualification])
      }
    }
    setSaving(null)
  }

  return (
    <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');`}</style>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1A1A2E', margin: '0 0 4px' }}>
          My Qualifications
        </h1>
        <p style={{ fontSize: '14px', color: '#6B6B80', margin: 0 }}>
          Select the courses you are qualified to teach. Admin will verify your selections.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', color: '#6B6B80', marginBottom: '6px' }}>Total courses</div>
          <div style={{ fontSize: '28px', fontWeight: 500, color: '#1A1A2E' }}>{courses.length}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', color: '#6B6B80', marginBottom: '6px' }}>Qualified for</div>
          <div style={{ fontSize: '28px', fontWeight: 500, color: '#534AB7' }}>{qualifications.length}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', color: '#6B6B80', marginBottom: '6px' }}>Verified</div>
          <div style={{ fontSize: '28px', fontWeight: 500, color: '#0F6E56' }}>
            {qualifications.filter(q => q.verified).length}
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div style={{ background: '#EEEDFE', border: '1px solid #AFA9EC', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#3C3489' }}>
        ℹ️ Selecting a course marks you as qualified. An admin must verify before you can be assigned to it.
      </div>

      {/* Courses grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#6B6B80' }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {courses.map(course => {
            const qualified = isQualified(course.id)
            const verified = isVerified(course.id)
            const isSaving = saving === course.id
            return (
              <div key={course.id} style={{
                background: '#fff',
                border: `1px solid ${qualified ? '#AFA9EC' : 'rgba(0,0,0,0.07)'}`,
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '16px',
                transition: 'border-color 0.15s',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ background: '#EEEDFE', color: '#534AB7', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}>
                      {course.code}
                    </span>
                    {verified && (
                      <span style={{ background: '#EAF3DE', color: '#0F6E56', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 500 }}>
                        ✓ Verified
                      </span>
                    )}
                    {qualified && !verified && (
                      <span style={{ background: '#FAEEDA', color: '#854F0B', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 500 }}>
                        Pending
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A2E', marginBottom: '4px' }}>
                    {course.name}
                  </div>
                  {course.description && (
                    <div style={{ fontSize: '12px', color: '#6B6B80' }}>{course.description}</div>
                  )}
                </div>

                {/* Toggle button */}
                <button
                  onClick={() => toggleQualification(course.id)}
                  disabled={isSaving}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${qualified ? '#534AB7' : 'rgba(0,0,0,0.08)'}`,
                    background: qualified ? '#534AB7' : '#fff',
                    color: qualified ? '#fff' : '#6B6B80',
                    fontSize: '12px',
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving ? 0.6 : 1,
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {isSaving ? '...' : qualified ? 'Remove' : '+ Add'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}