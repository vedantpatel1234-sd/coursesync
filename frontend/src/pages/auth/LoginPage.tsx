import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { loginSchema } from '../../lib/validations'
import toast from 'react-hot-toast'

type Role = 'instructor' | 'admin'

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[!@#$%^&*]/.test(password)) score++

  if (score <= 1) return { score, label: 'Very weak', color: '#E24B4A' }
  if (score === 2) return { score, label: 'Weak', color: '#E24B4A' }
  if (score === 3) return { score, label: 'Fair', color: '#EF9F27' }
  if (score === 4) return { score, label: 'Strong', color: '#1D9E75' }
  return { score, label: 'Very strong', color: '#0F6E56' }
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('instructor')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [showPassword, setShowPassword] = useState(false)
  const { signIn, user } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin' : '/instructor')
    }
  }, [user])

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value)
    if (errors.email) setErrors(prev => ({ ...prev, email: undefined }))
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value)
    if (errors.password) setErrors(prev => ({ ...prev, password: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = loginSchema.safeParse({ email, password })
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {}
      result.error.issues.forEach(err => {
        const field = err.path[0] as 'email' | 'password'
        if (!fieldErrors[field]) fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return
    }
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err: any) {
      toast.error(err.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  const strength = password ? getPasswordStrength(password) : null

  const requirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
    { label: 'One special character (!@#$%^&*)', met: /[!@#$%^&*]/.test(password) },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F4F3F0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: '"DM Sans", system-ui, sans-serif',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        .cs-input { width: 100%; padding: 11px 14px; background: #F8F7F5; border: 1px solid rgba(0,0,0,0.08); border-radius: 10px; font-size: 14px; color: #1A1A2E; font-family: inherit; outline: none; box-sizing: border-box; transition: border-color 0.15s, box-shadow 0.15s; }
        .cs-input:focus { border-color: #534AB7; box-shadow: 0 0 0 3px rgba(83,74,183,0.12); }
        .cs-input.error { border-color: #E24B4A; box-shadow: 0 0 0 3px rgba(226,75,74,0.1); }
        .cs-input::placeholder { color: #6B6B80; }
        .cs-role-btn { flex: 1; padding: 9px 12px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.08); background: transparent; color: #6B6B80; font-size: 13px; font-family: inherit; font-weight: 500; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 7px; }
        .cs-role-btn:hover { border-color: #AFA9EC; color: #1A1A2E; }
        .cs-role-btn.active { background: #EEEDFE; border-color: #534AB7; color: #3C3489; }
        .cs-submit { width: 100%; padding: 12px; background: #534AB7; color: #fff; border: none; border-radius: 10px; font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer; transition: background 0.15s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .cs-submit:hover:not(:disabled) { background: #3C3489; }
        .cs-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .cs-spinner { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .cs-demo-pill { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; background: #EEEDFE; border-radius: 20px; font-size: 12px; font-weight: 500; color: #3C3489; cursor: pointer; border: none; font-family: inherit; transition: opacity 0.15s; }
        .cs-demo-pill:hover { opacity: 0.7; }
        .cs-error { font-size: 11px; color: #E24B4A; margin-top: 5px; display: flex; align-items: center; gap: 4px; }
        .pw-input-wrap { position: relative; }
        .pw-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #6B6B80; padding: 0; display: flex; align-items: center; }
        .pw-toggle:hover { color: #534AB7; }
      `}</style>

      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '420px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '180px', height: '180px', background: '#EEEDFE', borderRadius: '50%', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <div style={{ width: '42px', height: '42px', background: '#534AB7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.9"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.9"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.9"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.4"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 500, color: '#1A1A2E' }}>CourseSync</div>
            <div style={{ fontSize: '12px', color: '#6B6B80', marginTop: '1px' }}>Assignment management</div>
          </div>
        </div>

        {/* Heading */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1A1A2E', margin: '0 0 4px' }}>Welcome back</h1>
          <p style={{ fontSize: '14px', color: '#6B6B80', margin: 0 }}>Sign in to manage your course assignments</p>
        </div>

        {/* Role selector */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', color: '#6B6B80', marginBottom: '8px', fontWeight: 500, letterSpacing: '0.06em' }}>SIGN IN AS</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className={`cs-role-btn ${role === 'instructor' ? 'active' : ''}`} onClick={() => setRole('instructor')}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M2.5 13.5c0-2.5 2.4-4.5 5.5-4.5s5.5 2 5.5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              Instructor
            </button>
            <button type="button" className={`cs-role-btn ${role === 'admin' ? 'active' : ''}`} onClick={() => setRole('admin')}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5 6.5 5 8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
              Administrator
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#1A1A2E', marginBottom: '6px' }}>Email</label>
            <input
              className={`cs-input ${errors.email ? 'error' : ''}`}
              type="email"
              placeholder="you@university.ca"
              value={email}
              onChange={handleEmailChange}
              autoComplete="email"
            />
            {errors.email && (
              <div className="cs-error">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#E24B4A" strokeWidth="1.5"/><path d="M8 5v4M8 11v.5" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round"/></svg>
                {errors.email}
              </div>
            )}
            {/* Forgot email */}
            <div style={{ marginTop: '5px', textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: '#534AB7', cursor: 'pointer' }}
                onClick={() => toast('Contact your administrator to recover your email.')}>
                Forgot email?
              </span>
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#1A1A2E', marginBottom: '6px' }}>Password</label>
            <div className="pw-input-wrap">
              <input
                className={`cs-input ${errors.password ? 'error' : ''}`}
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 8 chars, uppercase, number, special char"
                value={password}
                onChange={handlePasswordChange}
                autoComplete="current-password"
                style={{ paddingRight: '40px' }}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.3"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/></svg>
                )}
              </button>
            </div>

            {/* Password strength bar */}
            {password && strength && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} style={{
                      flex: 1, height: '3px', borderRadius: '2px',
                      background: i <= strength.score ? strength.color : '#F1EFE8',
                      transition: 'background 0.2s',
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: strength.color, fontWeight: 500 }}>{strength.label}</div>
              </div>
            )}

            {/* Requirements */}
            {password && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {requirements.map(req => (
                  <div key={req.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: req.met ? '#0F6E56' : '#6B6B80' }}>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                      {req.met
                        ? <><circle cx="8" cy="8" r="7" fill="#EAF3DE"/><path d="M5 8l2 2 4-4" stroke="#0F6E56" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>
                        : <circle cx="8" cy="8" r="7" stroke="#D1CFC8" strokeWidth="1.3"/>
                      }
                    </svg>
                    {req.label}
                  </div>
                ))}
              </div>
            )}

            {errors.password && (
              <div className="cs-error">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#E24B4A" strokeWidth="1.5"/><path d="M8 5v4M8 11v.5" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round"/></svg>
                {errors.password}
              </div>
            )}

            {/* Forgot password - moved below */}
            <div style={{ marginTop: '6px', textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: '#534AB7', cursor: 'pointer' }}
                onClick={() => toast('Password reset link will be sent to your email.')}>
                Forgot password?
              </span>
            </div>
          </div>

          <button className="cs-submit" type="submit" disabled={loading}>
            {loading ? <><div className="cs-spinner" /> Signing in…</> : 'Sign in'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }} />
          <span style={{ fontSize: '12px', color: '#6B6B80' }}>demo</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }} />
        </div>

        {/* Demo pills */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button className="cs-demo-pill" type="button"
            onClick={() => { setEmail('instructor@demo.ca'); setPassword('Demo@1234'); setRole('instructor'); setErrors({}) }}>
            Instructor demo
          </button>
          <button className="cs-demo-pill" type="button"
            onClick={() => { setEmail('admin@demo.ca'); setPassword('Demo@1234'); setRole('admin'); setErrors({}) }}>
            Admin demo
          </button>
        </div>
      </div>
    </div>
  )
}