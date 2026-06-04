import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

interface WorkloadData {
  name: string
  assigned: number
  remaining: number
  max: number
}

interface SectionStatusData {
  name: string
  value: number
  color: string
}

interface PreferenceData {
  name: string
  fulfilled: number
  unfulfilled: number
}

export default function AdminAnalytics() {
  const [workloadData, setWorkloadData] = useState<WorkloadData[]>([])
  const [sectionStatusData, setSectionStatusData] = useState<SectionStatusData[]>([])
  const [preferenceData, setPreferenceData] = useState<PreferenceData[]>([])
  const [loading, setLoading] = useState(true)
  const [totalSections, setTotalSections] = useState(0)
  const [filledSections, setFilledSections] = useState(0)
  const [totalInstructors, setTotalInstructors] = useState(0)
  const [prefFulfillmentRate, setPrefFulfillmentRate] = useState(0)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)

    // Fetch instructors + profiles
    const { data: instructors } = await supabase
      .from('profiles')
      .select('id, full_name, instructor_profiles(max_hours_per_term)')
      .eq('role', 'instructor')

    // Fetch assignments
    const { data: assignments } = await supabase
      .from('assignments')
      .select('instructor_id, hours_assigned, section_id, status')
      .is('draft_id', null)
      .neq('status', 'rejected')

    // Fetch sections
    const { data: sections } = await supabase
      .from('sections')
      .select('id, status')

    // Fetch preferences
    const { data: preferences } = await supabase
      .from('preferences')
      .select('instructor_id, section_id, rank')

    // Build workload data
    if (instructors) {
      const hoursMap: Record<string, number> = {}
      assignments?.forEach((a: any) => {
        hoursMap[a.instructor_id] = (hoursMap[a.instructor_id] ?? 0) + a.hours_assigned
      })

      const wData = instructors.map((i: any) => {
        const max = i.instructor_profiles?.[0]?.max_hours_per_term ?? 40
        const assigned = hoursMap[i.id] ?? 0
        return {
          name: i.full_name.split(' ').slice(-1)[0], // last name only for chart
          assigned,
          remaining: max - assigned,
          max,
        }
      })
      setWorkloadData(wData)
      setTotalInstructors(instructors.length)
    }

    // Build section status pie data
    if (sections) {
      const filled = sections.filter((s: any) => s.status === 'filled').length
      const partial = sections.filter((s: any) => s.status === 'partial').length
      const unassigned = sections.filter((s: any) => s.status === 'unassigned').length
      setSectionStatusData([
        { name: 'Filled', value: filled, color: '#1D9E75' },
        { name: 'Partial', value: partial, color: '#EF9F27' },
        { name: 'Unassigned', value: unassigned, color: '#E24B4A' },
      ])
      setTotalSections(sections.length)
      setFilledSections(filled)
    }

    // Build preference fulfillment data
    if (preferences && assignments) {
      const assignedSectionIds = new Set(assignments.map((a: any) => a.section_id))
      const fulfilledPrefs = preferences.filter((p: any) => assignedSectionIds.has(p.section_id))
      const rate = preferences.length > 0
        ? Math.round((fulfilledPrefs.length / preferences.length) * 100)
        : 0
      setPrefFulfillmentRate(rate)

      // Group by rank
      const rankGroups: Record<number, { fulfilled: number; unfulfilled: number }> = {}
      preferences.forEach((p: any) => {
        if (!rankGroups[p.rank]) rankGroups[p.rank] = { fulfilled: 0, unfulfilled: 0 }
        if (assignedSectionIds.has(p.section_id)) {
          rankGroups[p.rank].fulfilled++
        } else {
          rankGroups[p.rank].unfulfilled++
        }
      })

      const pData = Object.entries(rankGroups)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .slice(0, 5)
        .map(([rank, data]) => ({
          name: `Rank ${rank}`,
          fulfilled: data.fulfilled,
          unfulfilled: data.unfulfilled,
        }))
      setPreferenceData(pData)
    }

    setLoading(false)
  }

  const fillRate = totalSections > 0 ? Math.round((filledSections / totalSections) * 100) : 0

  return (
    <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');`}</style>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1A1A2E', margin: '0 0 4px' }}>Analytics</h1>
        <p style={{ fontSize: '14px', color: '#6B6B80', margin: 0 }}>Workload trends, staffing gaps and preference fulfillment</p>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total sections', value: totalSections, color: '#1A1A2E' },
          { label: 'Fill rate', value: `${fillRate}%`, color: '#0F6E56' },
          { label: 'Instructors', value: totalInstructors, color: '#534AB7' },
          { label: 'Pref. fulfillment', value: `${prefFulfillmentRate}%`, color: '#854F0B' },
        ].map(card => (
          <div key={card.label} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '12px', color: '#6B6B80', marginBottom: '6px' }}>{card.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 500, color: card.color }}>
              {loading ? '—' : card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>

        {/* Workload bar chart */}
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A2E', marginBottom: '4px' }}>Instructor workload</div>
          <div style={{ fontSize: '12px', color: '#6B6B80', marginBottom: '16px' }}>Hours assigned vs remaining this term</div>
          {loading ? (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B6B80', fontSize: '13px' }}>Loading...</div>
          ) : workloadData.length === 0 ? (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B6B80', fontSize: '13px' }}>No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={workloadData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B6B80' }} />
                <YAxis tick={{ fontSize: 12, fill: '#6B6B80' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', fontSize: '12px' }}
                  formatter={(value, name) => [
                    `${value}h`,
                    name === 'assigned' ? 'Assigned' : 'Remaining'
                  ]}
                />
                <Bar dataKey="assigned" stackId="a" fill="#534AB7" radius={[0, 0, 0, 0]} />
                <Bar dataKey="remaining" stackId="a" fill="#EEEDFE" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Section status pie */}
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A2E', marginBottom: '4px' }}>Section status</div>
          <div style={{ fontSize: '12px', color: '#6B6B80', marginBottom: '16px' }}>Fill rate breakdown</div>
          {loading ? (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B6B80', fontSize: '13px' }}>Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={sectionStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {sectionStatusData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span style={{ fontSize: '12px', color: '#6B6B80' }}>{value}</span>}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A2E', marginBottom: '4px' }}>Preference fulfillment by rank</div>
        <div style={{ fontSize: '12px', color: '#6B6B80', marginBottom: '16px' }}>How many instructor preferences were honored per rank</div>
        {loading ? (
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B6B80', fontSize: '13px' }}>Loading...</div>
        ) : preferenceData.length === 0 ? (
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B6B80', fontSize: '13px' }}>
            No preference data yet — instructors need to submit preferences first
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={preferenceData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B6B80' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6B6B80' }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', fontSize: '12px' }}
                formatter={(value, name) => [value, name === 'fulfilled' ? 'Fulfilled' : 'Not fulfilled']}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span style={{ fontSize: '12px', color: '#6B6B80' }}>{value === 'fulfilled' ? 'Fulfilled' : 'Not fulfilled'}</span>}
              />
              <Bar dataKey="fulfilled" fill="#1D9E75" radius={[4, 4, 0, 0]} />
              <Bar dataKey="unfulfilled" fill="#FCEBEB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}