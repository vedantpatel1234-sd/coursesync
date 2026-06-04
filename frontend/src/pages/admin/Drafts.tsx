import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { draftSchema } from '../../lib/validations'
import toast from 'react-hot-toast'

interface Draft {
  id: string
  name: string
  status: string
  is_ai_generated: boolean
  created_at: string
  published_at?: string
  terms: { name: string } | null
}

interface Term {
  id: string
  name: string
}

export default function AdminDrafts() {
  const { user } = useAuthStore()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [form, setForm] = useState({ name: '', term_id: '' })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [draftsRes, termsRes] = await Promise.all([
      supabase.from('drafts').select('id, name, status, is_ai_generated, created_at, published_at, terms(name)').order('created_at', { ascending: false }),
      supabase.from('terms').select('id, name').order('name'),
    ])
    if (draftsRes.data) setDrafts(draftsRes.data as any)
    if (termsRes.data) setTerms(termsRes.data as Term[])
    setLoading(false)
  }

  async function handleCreate() {
    const result = draftSchema.safeParse({ name: form.name, term_id: form.term_id })

    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach(err => {
        const field = err.path[0] as string
        if (!fieldErrors[field]) fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setSaving(true)
    const { error } = await supabase.from('drafts').insert({
      name: form.name,
      term_id: form.term_id,
      created_by: user!.id,
      status: 'sandbox',
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Draft created')
      setForm({ name: '', term_id: '' })
      setErrors({})
      setShowForm(false)
      fetchAll()
    }
    setSaving(false)
  }

  async function handlePublish(id: string) {
    const { error } = await supabase.from('drafts').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Draft published'); fetchAll() }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('drafts').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Draft deleted'); fetchAll() }
  }

  const statusColors: Record<string, { bg: string; color: string }> = {
    sandbox:   { bg: '#FAEEDA', color: '#854F0B' },
    published: { bg: '#EAF3DE', color: '#0F6E56' },
  }

  return (
    <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        .cs-input, .cs-select { width: 100%; padding: 9px 12px; background: #F8F7F5; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; font-size: 13px; color: #1A1A2E; font-family: inherit; outline: none; box-sizing: border-box; }
        .cs-input:focus, .cs-select:focus { border-color: #534AB7; box-shadow: 0 0 0 3px rgba(83,74,183,0.1); }
        .cs-input.error, .cs-select.error { border-color: #E24B4A; }
        .cs-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.08); background: #fff; color: #1A1A2E; font-size: 13px; font-family: inherit; cursor: pointer; transition: all 0.15s; }
        .cs-btn:hover { background: #F4F3F0; }
        .cs-btn-primary { background: #534AB7; border-color: #534AB7; color: #fff; }
        .cs-btn-primary:hover { background: #3C3489; }
        .cs-btn-green { background: #1D9E75; border-color: #1D9E75; color: #fff; }
        .cs-btn-green:hover { background: #0F6E56; }
        .cs-btn-danger:hover { color: #E24B4A; border-color: #E24B4A; }
        .cs-error { font-size: 11px; color: #E24B4A; margin-top: 4px; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1A1A2E', margin: '0 0 4px' }}>Sandbox Drafts</h1>
          <p style={{ fontSize: '14px', color: '#6B6B80', margin: 0 }}>Create and test assignment drafts before publishing</p>
        </div>
        <button className="cs-btn cs-btn-primary" onClick={() => { setShowForm(!showForm); setErrors({}) }}>
          {showForm ? 'Cancel' : '+ New draft'}
        </button>
      </div>

      <div style={{ background: '#EEEDFE', border: '1px solid #AFA9EC', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#3C3489' }}>
        ℹ️ Drafts are private sandboxes. Instructors only see assignments after you <strong>publish</strong> a draft.
      </div>

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A2E', marginBottom: '16px' }}>New draft</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Draft name *</label>
              <input className={`cs-input ${errors.name ? 'error' : ''}`} placeholder="e.g. Fall 2025 — Draft 1" value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(p => ({ ...p, name: undefined })) }} />
              {errors.name && <div className="cs-error">{errors.name}</div>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6B6B80', marginBottom: '5px' }}>Term *</label>
              <select className={`cs-select ${errors.term_id ? 'error' : ''}`} value={form.term_id}
                onChange={e => { setForm(f => ({ ...f, term_id: e.target.value })); setErrors(p => ({ ...p, term_id: undefined })) }}>
                <option value="">Select term</option>
                {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {errors.term_id && <div className="cs-error">{errors.term_id}</div>}
            </div>
          </div>
          <button className="cs-btn cs-btn-primary" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating...' : 'Create draft'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#6B6B80' }}>Loading...</div>
      ) : drafts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#6B6B80', background: '#fff', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.07)' }}>
          No drafts yet — create one above
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {drafts.map(draft => (
            <div key={draft.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 500, color: '#1A1A2E' }}>{draft.name}</div>
                  <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, background: statusColors[draft.status]?.bg ?? '#F1EFE8', color: statusColors[draft.status]?.color ?? '#444' }}>
                    {draft.status}
                  </span>
                  {draft.is_ai_generated && (
                    <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, background: '#EEEDFE', color: '#534AB7' }}>AI generated</span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#6B6B80' }}>
                  {draft.terms?.name} · Created {new Date(draft.created_at).toLocaleDateString()}
                  {draft.published_at && ` · Published ${new Date(draft.published_at).toLocaleDateString()}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {draft.status === 'sandbox' && (
                  <button className="cs-btn cs-btn-green" onClick={() => handlePublish(draft.id)} style={{ fontSize: '12px', padding: '6px 12px' }}>Publish</button>
                )}
                <button className="cs-btn cs-btn-danger" onClick={() => handleDelete(draft.id)} style={{ fontSize: '12px', padding: '6px 12px' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}