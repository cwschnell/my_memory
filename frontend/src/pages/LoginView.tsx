import { useState } from 'react'
import { verifyPin, registerUser, api } from '../api/client'

interface LoginViewProps {
  onLoginSuccess: () => void
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [step, setStep] = useState<'auth' | 'lodges'>('auth')
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Verified auth states
  const [verifiedEmail, setVerifiedEmail] = useState('')
  const [verifiedToken, setVerifiedToken] = useState('')
  const [verifiedRole, setVerifiedRole] = useState('')
  const [lodgesList, setLodgesList] = useState<Array<{ id: string; name: string }>>([])
  const [lodgeInputs, setLodgeInputs] = useState<string[]>(['', '', '', '', ''])
  const [selectedLodgeId, setSelectedLodgeId] = useState('')

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
      setVerifiedEmail(res.email)
      setVerifiedToken(res.token)
      setVerifiedRole(res.role || 'user')

      // Fetch managed lodges
      const lodgesResp = await api.get('/auth/lodges', { params: { email: res.email } })
      const list = lodgesResp.data || []
      setLodgesList(list)

      const inputs = ['', '', '', '', '']
      for (let i = 0; i < list.length && i < 5; i++) {
        inputs[i] = list[i].name
      }
      setLodgeInputs(inputs)

      if (list.length > 0) {
        setSelectedLodgeId(list[0].id)
      }

      setStep('lodges')
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
      setVerifiedEmail(res.email)
      setVerifiedToken(res.token)
      setVerifiedRole(res.role || 'user')

      setSuccessMsg(`Account successfully registered for ${res.email}! Setting up lodges...`)
      
      // Fetch lodges
      const lodgesResp = await api.get('/auth/lodges', { params: { email: res.email } })
      const list = lodgesResp.data || []
      setLodgesList(list)

      const inputs = ['', '', '', '', '']
      for (let i = 0; i < list.length && i < 5; i++) {
        inputs[i] = list[i].name
      }
      setLodgeInputs(inputs)

      if (list.length > 0) {
        setSelectedLodgeId(list[0].id)
      }

      setTimeout(() => {
        setStep('lodges')
      }, 1000)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleSyncLodges = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const names = lodgeInputs.filter((n) => n.trim() !== '')
      if (names.length === 0) {
        setError('Please configure at least one lodge name.')
        setLoading(false)
        return
      }

      const syncResp = await api.post('/auth/lodges/sync', {
        email: verifiedEmail,
        names: names
      })

      const list = syncResp.data || []
      setLodgesList(list)

      const inputs = ['', '', '', '', '']
      for (let i = 0; i < list.length && i < 5; i++) {
        inputs[i] = list[i].name
      }
      setLodgeInputs(inputs)

      if (list.length > 0) {
        setSelectedLodgeId(list[0].id)
      }
      setSuccessMsg('Lodge configuration updated successfully!')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      setError('Failed to update lodge list: ' + (err?.response?.data?.detail || err))
    } finally {
      setLoading(false)
    }
  }

  const handleEnterApp = () => {
    if (!selectedLodgeId) {
      setError('Please select or configure a lodge to enter.')
      return
    }
    const selectedLodgeName = lodgesList.find((l) => l.id === selectedLodgeId)?.name || 'Default Lodge'
    
    // Store in localStorage
    localStorage.setItem('auth_token', verifiedToken)
    localStorage.setItem('auth_email', verifiedEmail)
    localStorage.setItem('auth_role', verifiedRole)
    localStorage.setItem('activeLodgeId', selectedLodgeId)
    localStorage.setItem('activeLodgeName', selectedLodgeName)

    onLoginSuccess()
  }

  if (step === 'lodges') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#090d16' }}>
        <div style={{ background: '#1e293b', padding: 40, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', maxWidth: 500, width: '100%', color: '#fff' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>
              🏨
            </div>
            <h2 style={{ margin: '0 0 6px', color: '#38bdf8', fontSize: 24 }}>Manage & Select Lodges</h2>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>
              Configure up to 5 lodges and select which one to manage.
            </p>
          </div>

          {error && (
            <div style={{ padding: 12, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', fontSize: 13, marginBottom: 20 }}>
              {error}
            </div>
          )}

          {successMsg && (
            <div style={{ padding: 12, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, color: '#10b981', fontSize: 13, marginBottom: 20 }}>
              {successMsg}
            </div>
          )}

          {/* Sync form */}
          <form onSubmit={handleSyncLodges} style={{ marginBottom: 24 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#cbd5e1' }}>Configure Managed Lodges (Max 5)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lodgeInputs.map((val, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#64748b', width: 60 }}>Lodge {idx + 1}:</span>
                  <input
                    type="text"
                    value={val}
                    placeholder={`e.g. Lodge Name ${idx + 1}`}
                    onChange={(e) => {
                      const updated = [...lodgeInputs]
                      updated[idx] = e.target.value
                      setLodgeInputs(updated)
                    }}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: 14 }}
                  />
                </div>
              ))}
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#FFF', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 16 }}
            >
              {loading ? 'Updating...' : 'Save & Sync Lodges'}
            </button>
          </form>

          <hr style={{ border: '0', borderTop: '1px solid #334155', margin: '20px 0' }} />

          {/* Selection */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>Select Active Lodge</label>
            <select
              value={selectedLodgeId}
              onChange={(e) => setSelectedLodgeId(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: 15 }}
            >
              {lodgesList.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleEnterApp}
            style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #10b981, #059669)', color: '#FFF', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
          >
            Enter Landco Lodge Assistant 🚀
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#090d16' }}>
      <div style={{ background: '#1e293b', padding: 40, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', maxWidth: 440, width: '100%', color: '#fff' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>
            🔒
          </div>
          <h2 style={{ margin: '0 0 6px', color: '#38bdf8', fontSize: 24 }}>My Memory App</h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>
            {tab === 'login' ? 'Sign in with your email and PIN' : 'Register your permanent email & 6-digit PIN'}
          </p>
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', borderRadius: 10, background: '#0f172a', padding: 4, marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => { setTab('login'); setError(null); setSuccessMsg(null); }}
            style={{
              flex: 1, padding: '10px 0', border: 'none', borderRadius: 8,
              background: tab === 'login' ? '#1e293b' : 'transparent',
              color: tab === 'login' ? '#38bdf8' : '#64748B',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
              boxShadow: tab === 'login' ? '0 2px 6px rgba(0,0,0,0.2)' : 'none'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(null); setSuccessMsg(null); }}
            style={{
              flex: 1, padding: '10px 0', border: 'none', borderRadius: 8,
              background: tab === 'register' ? '#1e293b' : 'transparent',
              color: tab === 'register' ? '#38bdf8' : '#64748B',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
              boxShadow: tab === 'register' ? '0 2px 6px rgba(0,0,0,0.2)' : 'none'
            }}
          >
            Register New Account
          </button>
        </div>

        {error && (
          <div style={{ padding: 12, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{ padding: 12, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, color: '#10b981', fontSize: 13, marginBottom: 20 }}>
            {successMsg}
          </div>
        )}

        {tab === 'login' ? (
          <form onSubmit={handleSignIn}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Your 6-Digit PIN</label>
              <input
                type="password"
                required
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="••••••"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: 18, letterSpacing: 4, boxSizing: 'border-box' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#FFF', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Your Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="newuser@example.com"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Choose a 6-Digit PIN</label>
              <input
                type="text"
                required
                maxLength={12}
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="123456"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: 18, letterSpacing: 4, boxSizing: 'border-box' }}
              />
              <span style={{ display: 'block', fontSize: 11, color: '#64748B', marginTop: 4 }}>
                This PIN will be permanently saved to your account.
              </span>
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #059669, #10b981)', color: '#FFF', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              {loading ? 'Registering...' : 'Register Permanent Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
