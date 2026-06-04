import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

interface Assignment {
  id: string
  hours_assigned: number
  status: string
  sections: {
    section_number: string
    hours_required: number
    courses: { code: string; name: string } | null
    terms: { name: string } | null
  } | null
}

export default function InstructorDashboard() {
  const { user } = useAuthStore()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [totalHours, setTotalHours] = useState(0)
  const [maxHours, setMaxHours] = useState(40)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) fetchData() }, [user])

  async function fetchData() {
    setLoading(true)

    // Fetch assignments
    const { data: assignmentData } = await supabase
      .from('assignments')
      .select('id, hours_assigned, status, sections(section_number, hours_required, courses(code, name), terms(name))')
      .eq('instructor_id', user!.id)
      .is('draft_id', null)

    if (assignmentData) {
      setAssignments(assignmentData as any)
      const confirmed = assignmentData.filter(a => a.status === 'confirmed')
      setTotalHours(confirmed.reduce((sum, a) => sum + a.hours_assigned, 0))
    }

    // Fetch max hours
    const { data: profileData } = await supabase
      .from('instructor_profiles')
      .select('max_hours_per_term')
      .eq('user_id', user!.id)
      .maybeSingle()

    if (profileData) setMaxHours(profileData.max_hours_per_term)

    setLoading(false)
  }

  const pct = Math.min((totalHours / maxHours) * 100, 100)
  const barColor = pct >= 100 ? '#E24B4A' : pct >= 85 ? '#EF9F27' : '#1D9E75'

  const statusColors: Record<string, { bg: string; color: string }> = {
    confirmed: { bg: '#EAF3DE', color: '#0F6E56' },
    pending:   { bg: '#FAEEDA', color: '#854F0B' },
    rejected:  { bg: '#FCEBEB', color: '#A32D2D' },
  }

  return (
    <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');`}</style>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1A1A2E', margin: '0 0 4px' }}>
          My Assignments
        </h1>
        <p style={{ fontSize: '14px', color: '#6B6B80', margin: 0 }}>
          Welcome back, {user?.full_name}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', color: '#6B6B80', marginBottom: '6px' }}>Assigned sections</div>
          <div style={{ fontSize: '28px', fontWeight: 500, color: '#1A1A2E' }}>
            {loading ? '—' : assignments.filter(a => a.status === 'confirmed').length}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', color: '#6B6B80', marginBottom: '6px' }}>Hours assigned</div>
          <div style={{ fontSize: '28px', fontWeight: 500, color: '#0F6E56' }}>
            {loading ? '—' : `${totalHours}h`}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', color: '#6B6B80', marginBottom: '6px' }}>Hours remaining</div>
          <div style={{ fontSize: '28px', fontWeight: 500, color: '#534AB7' }}>
            {loading ? '—' : `${maxHours - totalHours}h`}
          </div>
        </div>
      </div>

      {/* Workload bar */}
      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A2E' }}>Workload this term</div>
          <div style={{ fontSize: '13px', color: '#6B6B80' }}>{totalHours}/{maxHours}h</div>
        </div>
        <div style={{ height: '8px', background: '#F1EFE8', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '4px', transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: '12px', color: '#6B6B80', marginTop: '8px' }}>
          {pct >= 100 ? '⚠️ You are at your maximum hours for this term'
            : pct >= 85 ? '⚠️ You are approaching your hour limit'
            : `You have ${maxHours - totalHours}h available for new assignments`}
        </div>
      </div>

      {/* Assignments table */}
      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', fontSize: '14px', fontWeight: 500, color: '#1A1A2E' }}>
          My sections
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#F8F7F5', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Section</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Course</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Term</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Hours</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#6B6B80' }}>Loading...</td></tr>
            ) : assignments.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#6B6B80' }}>No assignments yet</td></tr>
            ) : assignments.map((a, i) => (
              <tr key={a.id} style={{ borderBottom: i < assignments.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500, color: '#1A1A2E' }}>
                  {a.sections?.courses?.code}-{a.sections?.section_number}
                </td>
                <td style={{ padding: '12px 16px', color: '#6B6B80' }}>{a.sections?.courses?.name}</td>
                <td style={{ padding: '12px 16px', color: '#6B6B80' }}>{a.sections?.terms?.name}</td>
                <td style={{ padding: '12px 16px', color: '#1A1A2E' }}>{a.hours_assigned}h</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 500,
                    background: statusColors[a.status]?.bg ?? '#F1EFE8',
                    color: statusColors[a.status]?.color ?? '#444',
                  }}>
                    {a.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}