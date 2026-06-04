import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Section {
  id: string
  section_number: string
  hours_required: number
  course_id: string
  courses: { code: string; name: string } | null
  terms: { name: string } | null
  isQualified: boolean
}

interface SortableItemProps {
  section: Section
  rank: number
  note: string
  onNoteChange: (id: string, note: string) => void
  onRemove: (id: string) => void
}

function SortableItem({ section, rank, note, onNoteChange, onRemove }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.07)',
        borderRadius: '12px',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '8px',
      }}>
        {/* Drag handle */}
        <div {...attributes} {...listeners} style={{ cursor: 'grab', display: 'flex', flexDirection: 'column', gap: '3px', padding: '4px', opacity: 0.4 }}>
          <div style={{ width: '16px', height: '1.5px', background: '#1A1A2E', borderRadius: '1px' }} />
          <div style={{ width: '16px', height: '1.5px', background: '#1A1A2E', borderRadius: '1px' }} />
          <div style={{ width: '16px', height: '1.5px', background: '#1A1A2E', borderRadius: '1px' }} />
        </div>

        {/* Rank badge */}
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: '#EEEDFE', color: '#534AB7',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 500, flexShrink: 0,
        }}>
          {rank}
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ background: '#EEEDFE', color: '#534AB7', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}>
              {section.courses?.code}-{section.section_number}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#1A1A2E' }}>{section.courses?.name}</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B6B80' }}>
            {section.terms?.name} · {section.hours_required}h/week
          </div>
          {/* Note input */}
          <input
            value={note}
            onChange={e => onNoteChange(section.id, e.target.value)}
            placeholder="Add a note (optional)..."
            style={{
              marginTop: '8px', width: '100%', padding: '6px 10px',
              background: '#F8F7F5', border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: '6px', fontSize: '12px', color: '#1A1A2E',
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Remove */}
        <button
          onClick={() => onRemove(section.id)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#6B6B80', fontSize: '18px', padding: '4px',
            lineHeight: 1, flexShrink: 0,
          }}
        >×</button>
      </div>
    </div>
  )
}

export default function InstructorPreferences() {
  const { user } = useAuthStore()
  const [availableSections, setAvailableSections] = useState<Section[]>([])
  const [rankedSections, setRankedSections] = useState<Section[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => { if (user) fetchData() }, [user])

  async function fetchData() {
    setLoading(true)

    // Get qualified course IDs
    const { data: quals } = await supabase
      .from('qualifications')
      .select('course_id')
      .eq('instructor_id', user!.id)
      .eq('verified', true)

    const qualifiedCourseIds = quals?.map(q => q.course_id) ?? []

    // Get all sections
    const { data: sections } = await supabase
      .from('sections')
      .select('id, section_number, hours_required, course_id, courses(code, name), terms(name)')

    // Get existing preferences
    const { data: prefs } = await supabase
      .from('preferences')
      .select('section_id, rank, note')
      .eq('instructor_id', user!.id)
      .order('rank')

    if (sections) {
      const sectionsWithQual = sections.map((s: any) => ({
        ...s,
        isQualified: qualifiedCourseIds.includes(s.course_id),
      }))

      // Build ranked list from existing prefs
      if (prefs && prefs.length > 0) {
        const ranked = prefs
          .map(p => sectionsWithQual.find(s => s.id === p.section_id))
          .filter(Boolean) as Section[]
        setRankedSections(ranked)

        const notesMap: Record<string, string> = {}
        prefs.forEach(p => { if (p.note) notesMap[p.section_id] = p.note })
        setNotes(notesMap)

        const rankedIds = new Set(ranked.map(s => s.id))
        setAvailableSections(sectionsWithQual.filter(s => !rankedIds.has(s.id)))
      } else {
        setAvailableSections(sectionsWithQual)
      }
    }

    setLoading(false)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setRankedSections(items => {
        const oldIndex = items.findIndex(i => i.id === active.id)
        const newIndex = items.findIndex(i => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  function addToRanked(section: Section) {
    setRankedSections(prev => [...prev, section])
    setAvailableSections(prev => prev.filter(s => s.id !== section.id))
  }

  function removeFromRanked(sectionId: string) {
    const section = rankedSections.find(s => s.id === sectionId)
    if (section) {
      setAvailableSections(prev => [...prev, section])
      setRankedSections(prev => prev.filter(s => s.id !== sectionId))
    }
  }

  function handleNoteChange(sectionId: string, note: string) {
    setNotes(prev => ({ ...prev, [sectionId]: note }))
  }

  async function savePreferences() {
    setSaving(true)

    // Delete existing preferences
    await supabase.from('preferences').delete().eq('instructor_id', user!.id)

    // Insert new preferences
    if (rankedSections.length > 0) {
      const { error } = await supabase.from('preferences').insert(
        rankedSections.map((s, i) => ({
          instructor_id: user!.id,
          section_id: s.id,
          rank: i + 1,
          note: notes[s.id] || null,
        }))
      )
      if (error) { toast.error(error.message); setSaving(false); return }
    }

    toast.success('Preferences saved')
    setSaving(false)
  }

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#6B6B80' }}>Loading...</div>

  return (
    <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1A1A2E', margin: '0 0 4px' }}>Course Preferences</h1>
          <p style={{ fontSize: '14px', color: '#6B6B80', margin: 0 }}>Drag to rank sections you'd like to teach this term</p>
        </div>
        <button
          onClick={savePreferences}
          disabled={saving}
          style={{
            padding: '9px 18px', borderRadius: '8px', border: 'none',
            background: '#534AB7', color: '#fff', fontSize: '13px',
            fontWeight: 500, fontFamily: 'inherit', cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save preferences'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Ranked list */}
        <div>
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A2E', marginBottom: '12px' }}>
            Your ranking ({rankedSections.length} sections)
          </div>

          {rankedSections.length === 0 ? (
            <div style={{
              background: '#fff', border: '2px dashed rgba(0,0,0,0.08)',
              borderRadius: '12px', padding: '32px', textAlign: 'center',
              color: '#6B6B80', fontSize: '13px',
            }}>
              Add sections from the right to rank them
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={rankedSections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {rankedSections.map((section, index) => (
                  <SortableItem
                    key={section.id}
                    section={section}
                    rank={index + 1}
                    note={notes[section.id] ?? ''}
                    onNoteChange={handleNoteChange}
                    onRemove={removeFromRanked}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Available sections */}
        <div>
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A2E', marginBottom: '12px' }}>
            Available sections
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {availableSections.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#6B6B80', padding: '16px', textAlign: 'center' }}>
                All sections ranked
              </div>
            ) : availableSections.map(section => (
              <div key={section.id} style={{
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.07)',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                opacity: section.isQualified ? 1 : 0.5,
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ background: '#EEEDFE', color: '#534AB7', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}>
                      {section.courses?.code}-{section.section_number}
                    </span>
                    {!section.isQualified && (
                      <span style={{ fontSize: '11px', color: '#6B6B80' }}>Not qualified</span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: '#1A1A2E' }}>{section.courses?.name}</div>
                  <div style={{ fontSize: '12px', color: '#6B6B80' }}>{section.terms?.name} · {section.hours_required}h</div>
                </div>
                <button
                  onClick={() => section.isQualified && addToRanked(section)}
                  disabled={!section.isQualified}
                  style={{
                    padding: '6px 12px', borderRadius: '8px',
                    border: '1px solid rgba(0,0,0,0.08)',
                    background: section.isQualified ? '#534AB7' : '#F4F3F0',
                    color: section.isQualified ? '#fff' : '#6B6B80',
                    fontSize: '12px', fontFamily: 'inherit',
                    cursor: section.isQualified ? 'pointer' : 'not-allowed',
                  }}
                >
                  + Rank
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}