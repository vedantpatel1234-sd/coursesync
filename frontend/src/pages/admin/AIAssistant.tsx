import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface CourseContext {
  instructors: any[]
  sections: any[]
  assignments: any[]
  qualifications: any[]
}

export default function AdminAIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your CourseSync AI assistant. I can help you with assignment decisions, workload analysis, and staffing recommendations. Try asking me something like:\n\n• \"Who is the best fit for COMP3420?\"\n• \"Which instructor has the most capacity?\"\n• \"Which sections are still unassigned?\"\n• \"Summarize the current workload distribution\"",
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState<CourseContext | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchContext()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchContext() {
    const [instructorsRes, sectionsRes, assignmentsRes, qualsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, instructor_profiles(max_hours_per_term, department, title)').eq('role', 'instructor'),
      supabase.from('sections').select('id, section_number, hours_required, status, courses(code, name), terms(name)'),
      supabase.from('assignments').select('instructor_id, section_id, hours_assigned, status').is('draft_id', null).neq('status', 'rejected'),
      supabase.from('qualifications').select('instructor_id, course_id, verified, courses(code, name), profiles(full_name)'),
    ])

    setContext({
      instructors: instructorsRes.data ?? [],
      sections: sectionsRes.data ?? [],
      assignments: assignmentsRes.data ?? [],
      qualifications: qualsRes.data ?? [],
    })
  }

  function buildSystemPrompt(ctx: CourseContext): string {
    const hoursMap: Record<string, number> = {}
    ctx.assignments.forEach((a: any) => {
      hoursMap[a.instructor_id] = (hoursMap[a.instructor_id] ?? 0) + a.hours_assigned
    })

    const instructorSummary = ctx.instructors.map((i: any) => {
      const max = i.instructor_profiles?.[0]?.max_hours_per_term ?? 40
      const assigned = hoursMap[i.id] ?? 0
      const quals = ctx.qualifications
        .filter((q: any) => q.instructor_id === i.id && q.verified)
        .map((q: any) => q.courses?.code)
        .join(', ')
      return `- ${i.full_name} (${assigned}/${max}h assigned, qualified for: ${quals || 'none verified'})`
    }).join('\n')

    const sectionSummary = ctx.sections.map((s: any) => {
      const assignment = ctx.assignments.find((a: any) => a.section_id === s.id)
      const instructor = assignment
        ? ctx.instructors.find((i: any) => i.id === assignment.instructor_id)?.full_name
        : 'Unassigned'
      return `- ${s.courses?.code}-${s.section_number} (${s.hours_required}h, status: ${s.status}, instructor: ${instructor})`
    }).join('\n')

    return `You are an intelligent assistant for CourseSync, an academic course assignment management system. You help administrators make smart decisions about assigning instructors to course sections.

Current term data:

INSTRUCTORS:
${instructorSummary || 'No instructors yet'}

SECTIONS:
${sectionSummary || 'No sections yet'}

Guidelines:
- Be concise and actionable
- When recommending an instructor, explain why (qualifications, workload capacity)
- Flag any conflicts (over hours, not qualified)
- If data is missing, say so clearly
- Keep responses short and to the point`
  }

  async function sendMessage() {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const systemPrompt = context ? buildSystemPrompt(context) : 'You are a helpful assistant for an academic course assignment system.'

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            ...messages.slice(1).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage.content }
          ],
        }),
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error.message)
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.content[0].text,
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I ran into an error: ${err.message}`,
      }])
    }

    setLoading(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif', height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');`}</style>

      {/* Header */}
      <div style={{ marginBottom: '16px', flexShrink: 0 }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1A1A2E', margin: '0 0 4px' }}>AI Assistant</h1>
        <p style={{ fontSize: '14px', color: '#6B6B80', margin: 0 }}>Ask anything about assignments, workload or staffing</p>
      </div>

      {/* Chat window */}
      <div style={{
        flex: 1,
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.07)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
      }}>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              {msg.role === 'assistant' && (
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: '#534AB7', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0, marginRight: '10px', marginTop: '2px',
                }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5 6.5 5 8 2z" fill="white"/>
                  </svg>
                </div>
              )}
              <div style={{
                maxWidth: '75%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: msg.role === 'user' ? '#534AB7' : '#F4F3F0',
                color: msg.role === 'user' ? '#fff' : '#1A1A2E',
                fontSize: '13px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: '#534AB7', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5 6.5 5 8 2z" fill="white"/>
                </svg>
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: '6px', height: '6px', borderRadius: '50%', background: '#AFA9EC',
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid rgba(0,0,0,0.07)',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-end',
          flexShrink: 0,
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about assignments, workload, or staffing... (Enter to send)"
            rows={1}
            style={{
              flex: 1,
              padding: '10px 14px',
              background: '#F8F7F5',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: '10px',
              fontSize: '13px',
              color: '#1A1A2E',
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'none',
              lineHeight: '1.5',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              width: '38px', height: '38px',
              borderRadius: '10px',
              background: input.trim() ? '#534AB7' : '#F4F3F0',
              border: 'none',
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 0.15s',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8h12M8 2l6 6-6 6" stroke={input.trim() ? 'white' : '#6B6B80'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  )
}