import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ShoppingView from './pages/ShoppingView'
import CalendarView from './pages/CalendarView'
import MessageDetail from './pages/MessageDetail'
import LoginView from './pages/LoginView'
import AdminUsersView from './pages/AdminUsersView'

function Navigation({ onLogout }: { onLogout: () => void }) {
  const location = useLocation()
  const navStyle = (path: string) => ({
    padding: '10px 18px',
    borderRadius: 6,
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: 15,
    background: location.pathname === path ? '#2563EB' : 'transparent',
    color: location.pathname === path ? '#FFF' : '#64748B',
    transition: 'all 0.15s ease'
  })

  const authRole = localStorage.getItem('auth_role') || ''
  const authEmail = localStorage.getItem('auth_email') || ''
  const isAdmin = authRole === 'admin' || authEmail === 'andrisa.schnell@gmail.com'

  return (
    <nav className="no-print" style={{ background: '#FFF', borderBottom: '1px solid #E2E8F0', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 20, fontWeight: 800, color: '#1E3A8A' }}>
        🧠 My Memory
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link to="/" style={navStyle('/')}>📋 My Memos</Link>
        <Link to="/shopping" style={navStyle('/shopping')}>🛒 My Shopping</Link>
        <Link to="/calendar" style={navStyle('/calendar')}>📅 Calendar</Link>
        {isAdmin && (
          <Link to="/admin/users" style={navStyle('/admin/users')}>👥 Admin Users</Link>
        )}
        <button
          onClick={onLogout}
          style={{ padding: '8px 14px', background: '#EF4444', color: '#FFF', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', marginLeft: 12 }}
        >
          Logout
        </button>
      </div>
    </nav>
  )
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (token) setLoggedIn(true)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_email')
    localStorage.removeItem('auth_role')
    setLoggedIn(false)
  }

  if (!loggedIn) {
    return <LoginView onLoginSuccess={() => setLoggedIn(true)} />
  }

  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <Navigation onLogout={handleLogout} />
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/shopping" element={<ShoppingView />} />
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/message/:id" element={<MessageDetail />} />
            <Route path="/admin/users" element={<AdminUsersView />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
