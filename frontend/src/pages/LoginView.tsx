import { useState } from 'react'
import { sendPin, verifyPin } from '../api/client'

interface LoginViewProps {
  onLoginSuccess: () => void
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [pinSent, setPinSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [devPin, setDevPin] = useState<string | null>(null)

  const handleSendPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    setLoading(true)
    setError(null)
    setDevPin(null)
    try {
      const res = await sendPin(email)
      setPinSent(true)
      if (res?.dev_pin) {
        setDevPin(res.dev_pin)
        setPin(res.dev_pin)
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to send PIN.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length != 4) {
      setError('Please enter the 4-digit PIN.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await verifyPin(email, pin)
      localStorage.setItem('auth_token', res.token)
      localStorage.setItem('auth_email', res.email)
      onLoginSuccess()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Invalid 4-digit PIN.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#F8FAFC' }}>
      <div style={{ background: '#FFF', padding: 40, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', maxWidth: 420, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#EFF6FF', color: '#1E3A8A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>
            🔒
          </div>
          <h2 style={{ margin: '0 0 8px', color: '#1E3A8A', fontSize: 24 }}>My Memory Web</h2>
          <p style={{ margin: 0, color: '#64748B', fontSize: 14 }}>Sign in with your email and 4-digit PIN</p>
        </div>

        {error && (
          <div style={{ padding: 12, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#DC2626', fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {devPin && (
          <div style={{ padding: 14, background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, color: '#92400E', fontSize: 13, marginBottom: 20 }}>
            <strong>💡 DEV MODE:</strong> SMTP email credentials are not configured on Railway. Your 4-digit PIN is: <strong style={{ fontSize: 16, letterSpacing: 2 }}>{devPin}</strong>
          </div>
        )}

        {!pinSent ? (
          <form onSubmit={handleSendPin}>
            <div style={{ marginBottom: 20 }}>
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
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: 14, background: '#1E3A8A', color: '#FFF', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              {loading ? 'Sending...' : 'Send 4-Digit PIN'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyPin}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Enter 4-Digit PIN sent to {email}</label>
              <input
                type="text"
                required
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="1234"
                style={{ width: '100%', padding: '14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 24, textAlign: 'center', letterSpacing: 8, fontWeight: 'bold', boxSizing: 'border-box' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: 14, background: '#2563EB', color: '#FFF', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}
            >
              {loading ? 'Verifying...' : 'Verify PIN & Login'}
            </button>
            <button
              type="button"
              onClick={() => setPinSent(false)}
              style={{ width: '100%', padding: 10, background: 'transparent', color: '#64748B', border: 'none', fontSize: 13, cursor: 'pointer' }}
            >
              Change Email Address
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
