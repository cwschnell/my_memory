import { useState, useEffect } from 'react'
import { adminListUsers, adminCreateUser, adminUpdateUser, adminDeleteUser, AdminUser } from '../api/client'

export default function AdminUsersView() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form states
  const [showAdd, setShowAdd] = useState(false)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [pinInput, setPinInput] = useState('')
  const [roleInput, setRoleInput] = useState('user')

  const adminEmail = localStorage.getItem('auth_email') || ''

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminListUsers(adminEmail)
      setUsers(data)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load user credentials.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    try {
      await adminCreateUser(adminEmail, emailInput, pinInput, roleInput)
      setSuccess(`User ${emailInput} added successfully!`)
      setShowAdd(false)
      setEmailInput('')
      setPinInput('')
      setRoleInput('user')
      fetchUsers()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create user.')
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editUser) return
    setError(null)
    setSuccess(null)
    try {
      await adminUpdateUser(editUser.id, adminEmail, emailInput, pinInput, roleInput)
      setSuccess(`User ${emailInput} updated successfully!`)
      setEditUser(null)
      setEmailInput('')
      setPinInput('')
      fetchUsers()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update user.')
    }
  }

  const handleDelete = async (user: AdminUser) => {
    if (!window.confirm(`Are you sure you want to permanently delete access for ${user.email}?`)) return
    setError(null)
    setSuccess(null)
    try {
      await adminDeleteUser(user.id, adminEmail)
      setSuccess(`User ${user.email} deleted.`)
      fetchUsers()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to delete user.')
    }
  }

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 24, color: '#1E3A8A' }}>👥 Super Admin User Management</h1>
          <p style={{ margin: 0, color: '#64748B', fontSize: 14 }}>
            Manage permanent login emails and 6-digit PIN credentials for all application users.
          </p>
        </div>
        <button
          onClick={() => {
            setShowAdd(true)
            setEditUser(null)
            setEmailInput('')
            setPinInput('')
            setRoleInput('user')
          }}
          style={{ padding: '10px 18px', background: '#059669', color: '#FFF', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          + Add New User
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#DC2626', fontSize: 14, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ padding: 12, background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, color: '#047857', fontSize: 14, marginBottom: 16 }}>
          {success}
        </div>
      )}

      {/* Add / Edit Modal Box */}
      {(showAdd || editUser) && (
        <div style={{ background: '#FFF', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', color: '#1E3A8A' }}>
            {showAdd ? 'Add New Application User' : `Edit User Credentials: ${editUser?.email}`}
          </h3>
          <form onSubmit={showAdd ? handleAddSubmit : handleEditSubmit} style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 220px' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Email Address</label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="user@example.com"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Assigned 6-Digit PIN</label>
              <input
                type="text"
                required={showAdd}
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                placeholder={editUser ? "Keep unchanged" : "123456"}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', boxSizing: 'border-box', fontWeight: 'bold' }}
              />
            </div>
            <div style={{ flex: '0 1 120px' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Role</label>
              <select
                value={roleInput}
                onChange={e => setRoleInput(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFF' }}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="submit"
                style={{ padding: '10px 18px', background: '#2563EB', color: '#FFF', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
              >
                {showAdd ? 'Save User' : 'Update Credentials'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAdd(false); setEditUser(null); }}
                style={{ padding: '10px 14px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: 13, fontWeight: 700 }}>
              <th style={{ padding: '14px 18px' }}>User Email Address</th>
              <th style={{ padding: '14px 18px' }}>Registered PIN</th>
              <th style={{ padding: '14px 18px' }}>Access Role</th>
              <th style={{ padding: '14px 18px' }}>Registered On</th>
              <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>Loading user credentials...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>No registered users found.</td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '14px 18px', fontWeight: 600, color: '#1E293B' }}>{u.email}</td>
                  <td style={{ padding: '14px 18px' }}>
                    <code style={{ background: '#F1F5F9', padding: '4px 8px', borderRadius: 4, fontSize: 14, fontWeight: 'bold', color: '#0F172A', letterSpacing: 2 }}>
                      {u.pin || '••••••'}
                    </code>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                      background: u.role === 'admin' ? '#EEF2FF' : '#F1F5F9',
                      color: u.role === 'admin' ? '#4F46E5' : '#475569'
                    }}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', color: '#64748B', fontSize: 13 }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <button
                      onClick={() => {
                        setEditUser(u)
                        setShowAdd(false)
                        setEmailInput(u.email)
                        setPinInput(u.pin || '')
                        setRoleInput(u.role)
                      }}
                      style={{ padding: '6px 12px', background: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer', marginRight: 8 }}
                    >
                      Edit
                    </button>
                    {u.email !== 'andrisa.schnell@gmail.com' && (
                      <button
                        onClick={() => handleDelete(u)}
                        style={{ padding: '6px 12px', background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
