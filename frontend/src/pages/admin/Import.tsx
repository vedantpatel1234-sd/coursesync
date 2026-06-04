import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'
import Papa from 'papaparse'

type ImportType = 'courses' | 'instructors' | 'qualifications'

export default function AdminImport() {
  const { user } = useAuthStore()
  const [importType, setImportType] = useState<ImportType>('courses')
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [importing, setSaving] = useState(false)
  const [fileName, setFileName] = useState('')

  function handleFile(file: File) {
    setFileName(file.name)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setPreview(results.data.slice(0, 5) as any[])
        setHeaders(results.meta.fields ?? [])
      }
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  async function handleImport() {
    if (preview.length === 0) { toast.error('No data to import'); return }
    setSaving(true)

    try {
      if (importType === 'courses') {
        const rows = preview.map((r: any) => ({
          code: r.code?.toUpperCase(),
          name: r.name,
          description: r.description || null,
        }))
        const { error } = await supabase.from('courses').upsert(rows, { onConflict: 'code' })
        if (error) throw error

      } else if (importType === 'instructors') {
        for (const r of preview) {
          const { data, error } = await supabase.auth.admin.createUser({
            email: r.email,
            password: r.password ?? 'changeme123',
            email_confirm: true,
            user_metadata: { full_name: r.full_name, role: 'instructor' }
          })
          if (error && !error.message.includes('already')) throw error
          if (data.user) {
            await supabase.from('instructor_profiles').upsert({
              user_id: data.user.id,
              max_hours_per_term: parseInt(r.max_hours ?? '40'),
              department: r.department || null,
              title: r.title || null,
            }, { onConflict: 'user_id' })
          }
        }

      } else if (importType === 'qualifications') {
        for (const r of preview) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', r.email)
            .maybeSingle()

          const { data: course } = await supabase
            .from('courses')
            .select('id')
            .eq('code', r.course_code?.toUpperCase())
            .maybeSingle()

          if (profile && course) {
            await supabase.from('qualifications').upsert({
              instructor_id: profile.id,
              course_id: course.id,
              verified: r.verified === 'true',
              added_by: user?.id,
            }, { onConflict: 'instructor_id,course_id' })
          }
        }
      }

      await supabase.from('import_logs').insert({
        imported_by: user!.id,
        import_type: importType,
        row_count: preview.length,
      })

      toast.success(`${preview.length} rows imported successfully`)
      setPreview([])
      setHeaders([])
      setFileName('')
    } catch (err: any) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  const templates: Record<ImportType, { columns: string; example: string }> = {
    courses: {
      columns: 'code, name, description',
      example: 'COMP1234,Introduction to Programming,Basics of Python',
    },
    instructors: {
      columns: 'full_name, email, password, max_hours, department, title',
      example: 'Dr. Jane Smith,jane@uni.ca,pass123,40,Computer Science,Lecturer',
    },
    qualifications: {
      columns: 'email, course_code, verified',
      example: 'jane@uni.ca,COMP1234,true',
    },
  }

  return (
    <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');`}</style>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1A1A2E', margin: '0 0 4px' }}>CSV Import</h1>
        <p style={{ fontSize: '14px', color: '#6B6B80', margin: 0 }}>Bulk upload courses, instructors or qualifications</p>
      </div>

      {/* Import type selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {(['courses', 'instructors', 'qualifications'] as ImportType[]).map(type => (
          <button key={type} onClick={() => setImportType(type)} style={{
            padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit',
            cursor: 'pointer', transition: 'all 0.15s', textTransform: 'capitalize',
            background: importType === type ? '#534AB7' : '#fff',
            color: importType === type ? '#fff' : '#6B6B80',
            border: `1px solid ${importType === type ? '#534AB7' : 'rgba(0,0,0,0.08)'}`,
          }}>
            {type}
          </button>
        ))}
      </div>

      {/* Template info */}
      <div style={{ background: '#EEEDFE', border: '1px solid #AFA9EC', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#3C3489', marginBottom: '6px' }}>
          Expected columns for {importType}
        </div>
        <div style={{ fontSize: '12px', color: '#534AB7', fontFamily: 'monospace', marginBottom: '4px' }}>
          {templates[importType].columns}
        </div>
        <div style={{ fontSize: '12px', color: '#6B6B80' }}>
          Example: {templates[importType].example}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
        style={{
          border: `2px dashed ${dragging ? '#534AB7' : 'rgba(0,0,0,0.12)'}`,
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? '#EEEDFE' : '#fff',
          transition: 'all 0.15s',
          marginBottom: '20px',
        }}
      >
        <input id="file-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileInput} />
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A2E', marginBottom: '4px' }}>
          {fileName || 'Drop your CSV here'}
        </div>
        <div style={{ fontSize: '13px', color: '#6B6B80' }}>
          {fileName ? `${preview.length} rows loaded (showing first 5)` : 'or click to browse — .csv files only'}
        </div>
      </div>

      {/* Preview table */}
      {preview.length > 0 && (
        <>
          <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.07)', fontSize: '13px', fontWeight: 500, color: '#1A1A2E' }}>
              Preview (first 5 rows)
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#F8F7F5' }}>
                    {headers.map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6B6B80', fontWeight: 400, borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} style={{ borderBottom: i < preview.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                      {headers.map(h => (
                        <td key={h} style={{ padding: '8px 12px', color: '#1A1A2E' }}>{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={handleImport}
            disabled={importing}
            style={{
              padding: '10px 24px', borderRadius: '8px', border: 'none',
              background: '#534AB7', color: '#fff', fontSize: '14px',
              fontWeight: 500, fontFamily: 'inherit',
              cursor: importing ? 'not-allowed' : 'pointer',
              opacity: importing ? 0.6 : 1,
            }}
          >
            {importing ? 'Importing...' : `Import ${importType}`}
          </button>
        </>
      )}
    </div>
  )
}