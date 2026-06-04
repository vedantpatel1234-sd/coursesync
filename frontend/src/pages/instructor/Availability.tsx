import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const TIMES = [
  '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM',
  '4:00 PM', '5:00 PM',
]

export default function InstructorAvailability() {
  const { user } = useAuthStore()
  const [blocked, setBlocked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) fetchAvailability() }, [user])

  async function fetchAvailability() {
    setLoading(true)
    const { data } = await supabase
      .from('instructor_availability')
      .select('day, time')
      .eq('instructor_id', user!.id)

    if (data) {
      setBlocked(new Set(data.map((r: any) => `${r.day}|${r.time}`)))
    }
    setLoading(false)
  }

  function toggleSlot(day: string, time: string) {
    const key = `${day}|${time}`
    setBlocked(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function saveAvailability() {
    setSaving(true)

    // Delete existing
    await supabase
      .from('instructor_availability')
      .delete()
      .eq('instructor_id', user!.id)

    // Insert blocked slots
    if (blocked.size > 0) {
      const rows = Array.from(blocked).map(key => {
        const [day, time] = key.split('|')
        return { instructor_id: user!.id, day, time }
      })
      const { error } = await supabase.from('instructor_availability').insert(rows)
      if (error) { toast.error(error.message); setSaving(false); return }
    }

    toast.success('Availability saved')
    setSaving(false)
  }

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#6B6B80' }}>Loading...</div>

  return (
    <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        .slot { width: 100%; padding: 8px 4px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.07); background: #fff; font-size: 11px; font-family: inherit; cursor: pointer; transition: all 0.15s; color: #6B6B80; }
        .slot:hover { border-color: #AFA9EC; color: #534AB7; }
        .slot.blocked { background: #FCEBEB; border-color: #E24B4A; color: #A32D2D; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1A1A2E', margin: '0 0 4px' }}>My Availability</h1>
          <p style={{ fontSize: '14px', color: '#6B6B80', margin: 0 }}>
            Click slots to mark times you are <strong>unavailable</strong>. Admins see this when assigning.
          </p>
        </div>
        <button
          onClick={saveAvailability}
          disabled={saving}
          style={{
            padding: '9px 18px', borderRadius: '8px', border: 'none',
            background: '#534AB7', color: '#fff', fontSize: '13px',
            fontWeight: 500, fontFamily: 'inherit', cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save availability'}
        </button>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B6B80' }}>
          <div style={{ width: '14px', height: '14px', background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '3px' }} />
          Available
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#A32D2D' }}>
          <div style={{ width: '14px', height: '14px', background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '3px' }} />
          Unavailable
        </div>
      </div>

      {/* Grid */}
      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(5, 1fr)', gap: '1px', background: 'rgba(0,0,0,0.05)' }}>

          {/* Header row */}
          <div style={{ background: '#F8F7F5', padding: '10px', fontSize: '12px', color: '#6B6B80' }} />
          {DAYS.map(day => (
            <div key={day} style={{ background: '#F8F7F5', padding: '10px', fontSize: '12px', fontWeight: 500, color: '#1A1A2E', textAlign: 'center' }}>
              {day}
            </div>
          ))}

          {/* Time rows */}
          {TIMES.map(time => (
            <>
              <div key={`label-${time}`} style={{ background: '#F8F7F5', padding: '8px 10px', fontSize: '11px', color: '#6B6B80', display: 'flex', alignItems: 'center' }}>
                {time}
              </div>
              {DAYS.map(day => {
                const key = `${day}|${time}`
                const isBlocked = blocked.has(key)
                return (
                  <div key={key} style={{ background: '#fff', padding: '4px' }}>
                    <button
                      className={`slot ${isBlocked ? 'blocked' : ''}`}
                      onClick={() => toggleSlot(day, time)}
                    >
                      {isBlocked ? 'Unavailable' : ''}
                    </button>
                  </div>
                )
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  )
}