import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ShoppingView from './pages/ShoppingView'
import CalendarView from './pages/CalendarView'
import MessageDetail from './pages/MessageDetail'
import LoginView from './pages/LoginView'
import AdminUsersView from './pages/AdminUsersView'
import { LodgeDashboard } from './pages/LodgeDashboard'
import { ReservationsView } from './pages/ReservationsView'
import { TaskBoardView } from './pages/TaskBoardView'
import { IncidentLogView } from './pages/IncidentLogView'
import { DailyLogView } from './pages/DailyLogView'
import { useTranslation } from './i18n/translations'
import { api } from './api/client'

function Navigation({
  onLogout,
  lang,
  toggleLanguage,
  t,
  lodges,
  activeLodgeId,
  onLodgeChange,
  onOpenManage
}: {
  onLogout: () => void
  lang: 'EN' | 'PT'
  toggleLanguage: () => void
  t: any
  lodges: Array<{ id: string; name: string }>
  activeLodgeId: string
  onLodgeChange: (id: string) => void
  onOpenManage: () => void
}) {
  const location = useLocation()
  const navStyle = (path: string) => ({
    padding: '8px 14px',
    borderRadius: 8,
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: 14,
    background: location.pathname === path ? '#38bdf8' : 'transparent',
    color: location.pathname === path ? '#0f172a' : '#cbd5e1',
    transition: 'all 0.15s ease'
  })

  const authRole = localStorage.getItem('auth_role') || ''
  const authEmail = localStorage.getItem('auth_email') || ''
  const isAdmin = authRole === 'admin' || authEmail === 'andrisa.schnell@gmail.com'

  return (
    <nav className="no-print" style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, fontWeight: 800, color: '#38bdf8' }}>
        🏨 Landco Lodge Assistant
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Link to="/lodge" style={navStyle('/lodge')}>🏠 {t.home}</Link>
        <Link to="/reservations" style={navStyle('/reservations')}>🗓️ {t.reservations}</Link>
        <Link to="/tasks" style={navStyle('/tasks')}>📋 {t.tasks}</Link>
        <Link to="/incidents" style={navStyle('/incidents')}>🚨 {t.incidents}</Link>
        <Link to="/daily-log" style={navStyle('/daily-log')}>📔 {t.dailyLog}</Link>
        <Link to="/" style={navStyle('/')}>🎙️ {t.memos}</Link>
        <Link to="/shopping" style={navStyle('/shopping')}>🛒 {t.shopping}</Link>
        {isAdmin && (
          <Link to="/admin/users" style={navStyle('/admin/users')}>👥 {t.superAdmin}</Link>
        )}

        <button
          onClick={toggleLanguage}
          style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', border: 'none', borderRadius: 20, fontWeight: 800, cursor: 'pointer', marginLeft: 6 }}
          title="Change language / Mudar idioma"
        >
          🌐 {lang === 'EN' ? 'PT-MZ' : 'EN'}
        </button>

        {authEmail && lodges.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', padding: '4px 10px', borderRadius: 20, border: '1px solid #334155', marginLeft: 6 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>🏨 Lodge:</span>
            <select
              value={activeLodgeId}
              onChange={(e) => onLodgeChange(e.target.value)}
              style={{
                background: 'transparent',
                color: '#38bdf8',
                border: 'none',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {lodges.map((l) => (
                <option key={l.id} value={l.id} style={{ background: '#0f172a', color: '#fff' }}>
                  {l.name}
                </option>
              ))}
            </select>
            <button
              onClick={onOpenManage}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 11, padding: 0 }}
              title="Configure Lodges"
            >
              ⚙️
            </button>
          </div>
        )}

        {authEmail && (
          <span style={{ padding: '6px 12px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 20, fontSize: 12, fontWeight: 700, marginLeft: 6 }}>
            👤 {authEmail}
          </span>
        )}

        <button
          onClick={onLogout}
          style={{ padding: '6px 12px', background: '#ef4444', color: '#FFF', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', marginLeft: 6 }}
        >
          Logout
        </button>
      </div>
    </nav>
  )
}

function MainRoutes({
  lodges,
  activeLodgeId,
  onLodgeChange,
  onOpenManage
}: {
  lodges: Array<{ id: string; name: string }>
  activeLodgeId: string
  onLodgeChange: (id: string) => void
  onOpenManage: () => void
}) {
  const navigate = useNavigate()
  const { lang, toggleLanguage, t } = useTranslation()

  return (
    <>
      <Navigation
        onLogout={() => {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('auth_email')
          localStorage.removeItem('auth_role')
          localStorage.removeItem('activeLodgeId')
          localStorage.removeItem('activeLodgeName')
          window.location.reload()
        }}
        lang={lang}
        toggleLanguage={toggleLanguage}
        t={t}
        lodges={lodges}
        activeLodgeId={activeLodgeId}
        onLodgeChange={onLodgeChange}
        onOpenManage={onOpenManage}
      />
      <div style={{ maxWidth: 1250, margin: '0 auto', padding: '16px' }}>
        <Routes>
          <Route path="/lodge" element={<LodgeDashboard onNavigate={(tab) => navigate(`/${tab}`)} lang={lang} />} />
          <Route path="/reservations" element={<ReservationsView />} />
          <Route path="/tasks" element={<TaskBoardView />} />
          <Route path="/incidents" element={<IncidentLogView />} />
          <Route path="/daily-log" element={<DailyLogView />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/shopping" element={<ShoppingView />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/message/:id" element={<MessageDetail />} />
          <Route path="/admin/users" element={<AdminUsersView />} />
        </Routes>
      </div>
    </>
  )
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [lodges, setLodges] = useState<Array<{ id: string; name: string }>>([])
  const [activeLodgeId, setActiveLodgeId] = useState(localStorage.getItem('activeLodgeId') || '')
  const [showLodgeModal, setShowLodgeModal] = useState(false)
  const [lodgeInputs, setLodgeInputs] = useState<string[]>(['', '', '', '', ''])
  const [loading, setLoading] = useState(false)

  const loadLodges = async () => {
    const email = localStorage.getItem('auth_email')
    if (email) {
      try {
        const resp = await api.get('/auth/lodges', { params: { email } })
        const list = resp.data || []
        setLodges(list)
        const inputs = ['', '', '', '', '']
        for (let i = 0; i < list.length && i < 5; i++) {
          inputs[i] = list[i].name
        }
        setLodgeInputs(inputs)

        if (list.length > 0 && !localStorage.getItem('activeLodgeId')) {
          localStorage.setItem('activeLodgeId', list[0].id)
          localStorage.setItem('activeLodgeName', list[0].name)
          setActiveLodgeId(list[0].id)
        }
      } catch (err) {
        console.error('Error fetching lodges:', err)
      }
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      setLoggedIn(true)
      loadLodges()
    }
  }, [loggedIn])

  const handleLodgeChange = (id: string) => {
    const name = lodges.find((l) => l.id === id)?.name || 'Default Lodge'
    localStorage.setItem('activeLodgeId', id)
    localStorage.setItem('activeLodgeName', name)
    setActiveLodgeId(id)
    window.location.reload()
  }

  const handleSyncLodges = async (e: React.FormEvent) => {
    e.preventDefault()
    const email = localStorage.getItem('auth_email')
    if (!email) return
    const names = lodgeInputs.filter((n) => n.trim() !== '')
    if (names.length === 0) {
      alert('Please configure at least one lodge.')
      return
    }
    setLoading(true)
    try {
      const syncResp = await api.post('/auth/lodges/sync', { email, names })
      const list = syncResp.data || []
      setLodges(list)
      
      const exists = list.find((l) => l.id === activeLodgeId)
      if (exists) {
        localStorage.setItem('activeLodgeName', exists.name)
      } else if (list.length > 0) {
        localStorage.setItem('activeLodgeId', list[0].id)
        localStorage.setItem('activeLodgeName', list[0].name)
        setActiveLodgeId(list[0].id)
      }
      
      alert('Lodges updated successfully!')
      setShowLodgeModal(false)
      window.location.reload()
    } catch (err) {
      alert('Failed to sync lodges: ' + err)
    } finally {
      setLoading(false)
    }
  }

  if (!loggedIn) {
    return <LoginView onLoginSuccess={() => setLoggedIn(true)} />
  }

  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: '#090d16', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff' }}>
        <MainRoutes
          lodges={lodges}
          activeLodgeId={activeLodgeId}
          onLodgeChange={handleLodgeChange}
          onOpenManage={() => setShowLodgeModal(true)}
        />
        
        {/* Manage Lodges Modal from Header */}
        {showLodgeModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}>
            <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '16px', width: '450px', maxWidth: '90%', color: '#fff' }}>
              <h3 style={{ marginTop: 0, color: '#38bdf8' }}>⚙️ Manage Lodges</h3>
              <form onSubmit={handleSyncLodges}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.5rem' }}>
                  {lodgeInputs.map((val, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8', width: '60px' }}>Lodge {idx + 1}:</span>
                      <input
                        type="text"
                        value={val}
                        placeholder={`Lodge Name ${idx + 1}`}
                        onChange={(e) => {
                          const updated = [...lodgeInputs]
                          updated[idx] = e.target.value
                          setLodgeInputs(updated)
                        }}
                        style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button type="button" onClick={() => setShowLodgeModal(false)} style={{ padding: '0.5rem 1rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={loading} style={{ padding: '0.5rem 1.2rem', background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </BrowserRouter>
  )
}
