import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

interface Stats {
  total: number
  filled: number
  partial: number
  unassigned: number
}

interface SectionRow {
  id: string
  section_number: string
  status: string
  hours_required: number
  courses: { code: string; name: string } | null
}

interface WorkloadRow {
  id: string
  full_name: string
  hours_assigned: number
  max_hours: number
}

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<Stats>({ total: 0, filled: 0, partial: 0, unassigned: 0 })
  const [sections, setSections] = useState<SectionRow[]>([])
  const [workload, setWorkload] = useState<WorkloadRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)

    // Fetch sections
    const { data: sectionData } = await supabase
      .from('sections')
      .select('id, section_number, status, hours_required, courses(code, name)')
      .limit(6)

    if (sectionData) {
      setSections(sectionData as any)
      setStats({
        total: sectionData.length,
        filled: sectionData.filter((s: any) => s.status === 'filled').length,
        partial: sectionData.filter((s: any) => s.status === 'partial').length,
        unassigned: sectionData.filter((s: any) => s.status === 'unassigned').length,
      })
    }

    // Fetch instructors
    const { data: instructorData } = await supabase
      .from('profiles')
      .select('id, full_name, instructor_profiles(max_hours_per_term)')
      .eq('role', 'instructor')

    // Fetch assignments separately
    const { data: assignmentData } = await supabase
      .from('assignments')
      .select('instructor_id, hours_assigned, status')
      .is('draft_id', null)
      .neq('status', 'rejected')

    if (instructorData) {
      const hoursMap: Record<string, number> = {}
      if (assignmentData) {
        assignmentData.forEach((a: any) => {
          hoursMap[a.instructor_id] = (hoursMap[a.instructor_id] ?? 0) + a.hours_assigned
        })
      }
      setWorkload(instructorData.map((i: any) => ({
        id: i.id,
        full_name: i.full_name,
        hours_assigned: hoursMap[i.id] ?? 0,
        max_hours: i.instructor_profiles?.[0]?.max_hours_per_term ?? 40,
      })))
    }

    setLoading(false)
  }

  const statCards = [
    { label: 'Total Sections', value: stats.total, color: '#1A1A2E' },
    { label: 'Filled', value: stats.filled, color: '#0F6E56' },
    { label: 'Partial', value: stats.partial, color: '#854F0B' },
    { label: 'Unassigned', value: stats.unassigned, color: '#A32D2D' },
  ]

  const statusColors: Record<string, string> = {
    filled: '#0F6E56', partial: '#854F0B', unassigned: '#A32D2D',
  }
  const statusBg: Record<string, string> = {
    filled: '#EAF3DE', partial: '#FAEEDA', unassigned: '#FCEBEB',
  }

  return (
    <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');`}</style>

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1A1A2E', margin: '0 0 4px' }}>Dashboard</h1>
        <p style={{ fontSize: '14px', color: '#6B6B80', margin: 0 }}>Welcome back, {user?.full_name} — Fall 2025</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {statCards.map(stat => (
          <div key={stat.label} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '12px', color: '#6B6B80', marginBottom: '6px' }}>{stat.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 500, color: stat.color }}>
              {loading ? '—' : stat.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Workload */}
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A2E', marginBottom: '16px' }}>Instructor Workload</div>
          {loading ? (
            <div style={{ fontSize: '13px', color: '#6B6B80', textAlign: 'center', padding: '24px' }}>Loading...</div>
          ) : workload.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#6B6B80', textAlign: 'center', padding: '24px' }}>No instructors yet</div>
          ) : workload.map(w => {
            const pct = Math.min((w.hours_assigned / w.max_hours) * 100, 100)
            const barColor = pct >= 100 ? '#E24B4A' : pct >= 85 ? '#EF9F27' : '#1D9E75'
            return (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '120px', fontSize: '13px', color: '#1A1A2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {w.full_name}
                </div>
                <div style={{ flex: 1, height: '5px', background: '#F1EFE8', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '3px' }} />
                </div>
                <div style={{ fontSize: '12px', color: '#6B6B80', minWidth: '50px', textAlign: 'right' }}>
                  {w.hours_assigned}/{w.max_hours}h
                </div>
              </div>
            )
          })}
        </div>

        {/* Sections */}
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A2E', marginBottom: '16px' }}>Section Status</div>
          {loading ? (
            <div style={{ fontSize: '13px', color: '#6B6B80', textAlign: 'center', padding: '24px' }}>Loading...</div>
          ) : sections.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#6B6B80', textAlign: 'center', padding: '24px' }}>No sections yet</div>
          ) : sections.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < sections.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
              <div>
                <div style={{ fontSize: '13px', color: '#1A1A2E', fontWeight: 500 }}>{s.courses?.code}-{s.section_number}</div>
                <div style={{ fontSize: '12px', color: '#6B6B80' }}>{s.courses?.name}</div>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, background: statusBg[s.status] ?? '#F1EFE8', color: statusColors[s.status] ?? '#444' }}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}