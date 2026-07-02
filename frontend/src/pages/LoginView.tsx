import { useState } from 'react'
import { verifyPin, registerUser } from '../api/client'

interface LoginViewProps {
  onLoginSuccess: () => void
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    if (!pin || pin.length < 4) {
      setError('Please enter your 4 to 6 digit PIN.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await verifyPin(email, pin)
      localStorage.setItem('auth_token', res.token)
      localStorage.setItem('auth_email', res.email)
      localStorage.setItem('auth_role', res.role || 'user')
      onLoginSuccess()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Invalid Email or PIN.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    if (!pin || pin.length < 4 || pin.length > 20) {
      setError('Please choose a PIN between 4 and 6 digits.')
      return
    }
    setLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await registerUser(email, pin)
      localStorage.setItem('auth_token', res.token)
      localStorage.setItem('auth_email', res.email)
      localStorage.setItem('auth_role', res.role || 'user')
      setSuccessMsg(`Account successfully registered for ${res.email}! Logging in...`)
      setTimeout(() => {
        onLoginSuccess()
      }, 1000)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#F8FAFC' }}>
      <div style={{ background: '#FFF', padding: 40, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', maxWidth: 440, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#EFF6FF', color: '#1E3A8A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>
            🔒
          </div>
          <h2 style={{ margin: '0 0 6px', color: '#1E3A8A', fontSize: 24 }}>My Memory App</h2>
          <p style={{ margin: 0, color: '#64748B', fontSize: 14 }}>
            {tab === 'login' ? 'Sign in with your email and PIN' : 'Register your permanent email & 6-digit PIN'}
          </p>
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', borderRadius: 10, background: '#F1F5F9', padding: 4, marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => { setTab('login'); setError(null); setSuccessMsg(null); }}
            style={{
              flex: 1, padding: '10px 0', border: 'none', borderRadius: 8,
              background: tab === 'login' ? '#FFF' : 'transparent',
              color: tab === 'login' ? '#1E3A8A' : '#64748B',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
              boxShadow: tab === 'login' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(null); setSuccessMsg(null); }}
            style={{
              flex: 1, padding: '10px 0', border: 'none', borderRadius: 8,
              background: tab === 'register' ? '#FFF' : 'transparent',
              color: tab === 'register' ? '#1E3A8A' : '#64748B',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
              boxShadow: tab === 'register' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            Register New Account
          </button>
        </div>

        {error && (
          <div style={{ padding: 12, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#DC2626', fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{ padding: 12, background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, color: '#047857', fontSize: 13, marginBottom: 20 }}>
            {successMsg}
          </div>
        )}

        {tab === 'login' ? (
          <form onSubmit={handleSignIn}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 15, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Your 6-Digit PIN</label>
              <input
                type="password"
                required
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="••••••"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 18, letterSpacing: 4, boxSizing: 'border-box' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: 14, background: '#1E3A8A', color: '#FFF', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Your Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="newuser@example.com"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 15, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Choose a 6-Digit PIN</label>
              <input
                type="text"
                required
                maxLength={12}
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="123456"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 18, letterSpacing: 4, boxSizing: 'border-box' }}
              />
              <span style={{ display: 'block', fontSize: 11, color: '#64748B', marginTop: 4 }}>
                This PIN will be permanently saved to your account.
              </span>
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: 14, background: '#059669', color: '#FFF', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              {loading ? 'Registering...' : 'Register Permanent Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
