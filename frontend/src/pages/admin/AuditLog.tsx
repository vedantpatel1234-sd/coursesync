import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface AuditLog {
  id: string
  action: string
  entity: string
  entity_id?: string
  details?: Record<string, any>
  created_at: string
  profiles: { full_name: string; email: string } | null
}

const actionLabels: Record<string, { label: string; bg: string; color: string }> = {
  assignment_created: { label: 'Assignment created', bg: '#EAF3DE', color: '#0F6E56' },
  assignment_removed: { label: 'Assignment removed', bg: '#FCEBEB', color: '#A32D2D' },
  course_created:     { label: 'Course created',     bg: '#EAF3DE', color: '#0F6E56' },
  course_deleted:     { label: 'Course deleted',     bg: '#FCEBEB', color: '#A32D2D' },
  section_created:    { label: 'Section created',    bg: '#EAF3DE', color: '#0F6E56' },
  section_deleted:    { label: 'Section deleted',    bg: '#FCEBEB', color: '#A32D2D' },
  instructor_created: { label: 'Instructor added',   bg: '#EAF3DE', color: '#0F6E56' },
  instructor_deleted: { label: 'Instructor removed', bg: '#FCEBEB', color: '#A32D2D' },
  draft_created:      { label: 'Draft created',      bg: '#EEEDFE', color: '#534AB7' },
  draft_published:    { label: 'Draft published',    bg: '#EAF3DE', color: '#0F6E56' },
  draft_deleted:      { label: 'Draft deleted',      bg: '#FCEBEB', color: '#A32D2D' },
  qualifications_updated: { label: 'Qualifications updated', bg: '#FAEEDA', color: '#854F0B' },
  preferences_saved:  { label: 'Preferences saved',  bg: '#FAEEDA', color: '#854F0B' },
}

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => { fetchLogs() }, [])

  async function fetchLogs() {
    setLoading(true)
    const { data } = await supabase
      .from('audit_logs')
      .select('id, action, entity, entity_id, details, created_at, profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (data) setLogs(data as any)
    setLoading(false)
  }

  const filtered = filter === 'all' ? logs : logs.filter(l => l.action.includes(filter))

  const filterOptions = [
    { value: 'all', label: 'All activity' },
    { value: 'assignment', label: 'Assignments' },
    { value: 'course', label: 'Courses' },
    { value: 'section', label: 'Sections' },
    { value: 'instructor', label: 'Instructors' },
    { value: 'draft', label: 'Drafts' },
  ]

  return (
    <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1A1A2E', margin: '0 0 4px' }}>Audit Log</h1>
          <p style={{ fontSize: '14px', color: '#6B6B80', margin: 0 }}>Track all changes made in the system</p>
        </div>
        <button onClick={fetchLogs} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', background: '#fff', color: '#1A1A2E', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {filterOptions.map(opt => (
          <button key={opt.value} onClick={() => setFilter(opt.value)} style={{
            padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontFamily: 'inherit',
            cursor: 'pointer', transition: 'all 0.15s',
            background: filter === opt.value ? '#534AB7' : '#fff',
            color: filter === opt.value ? '#fff' : '#6B6B80',
            border: `1px solid ${filter === opt.value ? '#534AB7' : 'rgba(0,0,0,0.08)'}`,
          }}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Log table */}
      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#F8F7F5', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Action</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>User</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Details</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6B6B80', fontWeight: 400 }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#6B6B80' }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#6B6B80' }}>No activity yet</td></tr>
            ) : filtered.map((log, i) => {
              const actionInfo = actionLabels[log.action] ?? { label: log.action, bg: '#F1EFE8', color: '#444' }
              return (
                <tr key={log.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, background: actionInfo.bg, color: actionInfo.color }}>
                      {actionInfo.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: '13px', color: '#1A1A2E', fontWeight: 500 }}>{log.profiles?.full_name ?? '—'}</div>
                    <div style={{ fontSize: '11px', color: '#6B6B80' }}>{log.profiles?.email}</div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6B6B80', fontSize: '12px' }}>
                    {log.details ? Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6B6B80', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}