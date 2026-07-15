import { useState, useEffect } from 'react'
import { format, getDaysInMonth } from 'date-fns'
import {
  getRooms, createRoom, updateRoom, deleteRoom,
  getAgencies, createAgency, updateAgency, deleteAgency,
  getReservationsByDate, exportBookingSheet
} from '../api/client'

export default function BookingSheetView() {
  const [rooms, setRooms] = useState<any[]>([])
  const [agencies, setAgencies] = useState<any[]>([])
  const [reservations, setReservations] = useState<any[]>([])
  
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [activeAgencyName, setActiveAgencyName] = useState<string | null>(null)
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({})
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [showConfig, setShowConfig] = useState(false)

  // Modals for add/edit
  const [roomName, setRoomName] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [agencyColor, setAgencyColor] = useState('#000000')

  const fetchMonthReservations = async () => {
    setLoading(true)
    try {
      const start = `${selectedMonth}-01`
      const days = getDaysInMonth(new Date(start))
      const end = `${selectedMonth}-${String(days).padStart(2, '0')}`
      
      const { api } = await import('../api/client')
      const { data } = await api.get('/lodge/reservations', { params: { start_date: start, end_date: end }})
      setReservations(data)
      const rms = await getRooms()
      setRooms(rms)
      const ags = await getAgencies()
      setAgencies(ags)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMonthReservations()
  }, [selectedMonth])

  const handleAddRoom = async () => {
    if (!roomName) return
    await createRoom(roomName)
    setRoomName('')
    fetchMonthReservations()
  }

  const handleDeleteRoom = async (id: string) => {
    if (!window.confirm("Delete this house?")) return
    await deleteRoom(id)
    fetchMonthReservations()
  }

  const handleAddAgency = async () => {
    if (!agencyName) return
    await createAgency(agencyName, agencyColor)
    setAgencyName('')
    setAgencyColor('#000000')
    fetchMonthReservations()
  }

  const handleDeleteAgency = async (id: string) => {
    if (!window.confirm("Delete this agency?")) return
    await deleteAgency(id)
    fetchMonthReservations()
  }

  const handleDownload = async () => {
    try {
      const blob = await exportBookingSheet(selectedMonth)
      const url = window.URL.createObjectURL(new Blob([blob]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Booking_List_${selectedMonth}.xlsx`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error("Export failed", err)
      alert("Failed to export Excel sheet.")
    }
  }

  const daysInMonth = getDaysInMonth(new Date(`${selectedMonth}-01`))
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const handleCellClick = (roomName: string, currDate: string) => {
    if (!editMode || !activeAgencyName) return
    
    const cellKey = `${roomName}|${currDate}`
    setPendingChanges(prev => ({
      ...prev,
      [cellKey]: activeAgencyName
    }))
  }

  const handleSaveChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) return
    
    setLoading(true)
    const { api } = await import('../api/client')
    
    try {
      // Process all pending changes
      for (const [cellKey, agencyName] of Object.entries(pendingChanges)) {
        const [roomName, currDate] = cellKey.split('|')
        
        const existingMatch = reservations.find(r => 
          r.room_or_unit === roomName && 
          r.check_in <= currDate && 
          r.check_out > currDate &&
          r.status !== 'cancelled'
        )

        if (agencyName === 'ERASER') {
          if (existingMatch) {
            await api.delete(`/lodge/reservations/${existingMatch.id}`)
          }
        } else {
          if (existingMatch) {
            const payload = { ...existingMatch }
            payload.source = agencyName
            payload.guest_id = payload.guest_id || null
            delete payload.guest
            await api.put(`/lodge/reservations/${existingMatch.id}`, payload)
          } else {
            const nextDay = new Date(currDate)
            nextDay.setDate(nextDay.getDate() + 1)
            const checkoutDate = nextDay.toISOString().split('T')[0]
            
            await api.post('/lodge/reservations', {
              room_or_unit: roomName,
              check_in: currDate,
              check_out: checkoutDate,
              source: agencyName,
              status: 'confirmed',
              num_adults: 1,
              num_children: 0,
              rate_per_night_usd: 0,
              total_usd: 0,
              deposit_paid: false
            })
          }
        }
      }
      
      setPendingChanges({})
      await fetchMonthReservations()
    } catch (e) {
      console.error(e)
      alert("Error saving some changes. Please refresh and try again.")
      setLoading(false)
    }
  }

  return (
    <div style={isFullScreen ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: '#FFF', padding: 24, overflow: 'auto', color: '#1E293B' } : { background: '#FFF', padding: 24, borderRadius: 12, color: '#1E293B', overflowX: 'auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>📅 Booking Sheet (Excel Layout)</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          {editMode && Object.keys(pendingChanges).length > 0 && (
            <button 
              onClick={handleSaveChanges}
              style={{ 
                padding: '8px 16px', 
                background: '#10B981', 
                color: '#FFF', 
                border: 'none', 
                borderRadius: 6, 
                cursor: 'pointer', 
                fontWeight: 'bold',
                boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)'
              }}
            >
              💾 Save Changes ({Object.keys(pendingChanges).length})
            </button>
          )}
          <button 
            onClick={() => setIsFullScreen(!isFullScreen)}
            style={{ padding: '8px 16px', background: '#64748B', color: '#FFF', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}
          >
            {isFullScreen ? '🗗 Restore' : '🗖 Maximize'}
          </button>
          <button 
            onClick={() => setShowConfig(!showConfig)}
            style={{ padding: '8px 16px', background: '#94A3B8', color: '#FFF', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}
          >
            {showConfig ? 'Hide Config' : '⚙️ Setup'}
          </button>
          <button 
            onClick={() => {
              if (Object.keys(pendingChanges).length > 0) {
                if (!window.confirm("You have unsaved changes. Discard them?")) return
              }
              setEditMode(!editMode)
              setActiveAgencyName(null)
              setPendingChanges({})
              if (!editMode) setShowConfig(false) // auto hide config when entering edit mode
            }}
            style={{ 
              padding: '8px 16px', 
              background: editMode ? '#EF4444' : '#3B82F6', 
              color: '#FFF', 
              border: 'none', 
              borderRadius: 6, 
              cursor: 'pointer', 
              fontWeight: 'bold' 
            }}
          >
            {editMode ? 'Exit Edit Mode' : '✏️ Edit Mode'}
          </button>
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: '8px', borderRadius: 6, border: '1px solid #CBD5E1' }}
          />
          <button 
            onClick={handleDownload}
            style={{ padding: '8px 16px', background: '#16A34A', color: '#FFF', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}
          >
            📥 Download Excel
          </button>
        </div>
      </header>

      {/* Settings Section (Collapsible) */}
      {showConfig && (
        <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
          <div style={{ flex: 1, border: '1px solid #E2E8F0', padding: 16, borderRadius: 8 }}>
            <h3 style={{ margin: '0 0 10px' }}>Houses (Rooms)</h3>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <input 
                value={roomName} onChange={e => setRoomName(e.target.value)} 
                placeholder="e.g. Casa Praie" style={{ flex: 1, padding: 6, border: '1px solid #CBD5E1', borderRadius: 4 }} 
              />
              <button onClick={handleAddRoom} style={{ padding: '6px 12px', background: '#2563EB', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add</button>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 14 }}>
              {rooms.map(r => (
                <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F1F5F9' }}>
                  {r.name} 
                  <button onClick={() => handleDeleteRoom(r.id)} style={{ color: 'red', border: 'none', background: 'transparent', cursor: 'pointer' }}>✖</button>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ flex: 1, border: '1px solid #E2E8F0', padding: 16, borderRadius: 8 }}>
            <h3 style={{ margin: '0 0 10px' }}>Agencies (Legend Setup)</h3>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <input 
                value={agencyName} onChange={e => setAgencyName(e.target.value)} 
                placeholder="e.g. AirBnB" style={{ flex: 1, padding: 6, border: '1px solid #CBD5E1', borderRadius: 4 }} 
              />
              <input type="color" value={agencyColor} onChange={e => setAgencyColor(e.target.value)} style={{ padding: 0, height: 30, width: 30, border: 'none' }} />
              <button onClick={handleAddAgency} style={{ padding: '6px 12px', background: '#2563EB', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add</button>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {agencies.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F8FAFC', padding: '4px 8px', borderRadius: 4, border: '1px solid #E2E8F0', fontSize: 13 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: a.color }}></div>
                  {a.name}
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteAgency(a.id); }} style={{ color: 'red', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 10 }}>✖</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Editing Palette (Always visible when in Edit Mode) */}
      {editMode && (
        <div style={{ marginBottom: 15, padding: '10px 15px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 15 }}>
          <strong style={{ fontSize: 14 }}>Active Brush:</strong>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div 
              onClick={() => setActiveAgencyName('ERASER')}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 6, 
                background: activeAgencyName === 'ERASER' ? '#FEF2F2' : '#FFF', 
                padding: '6px 12px', borderRadius: 6, 
                border: `2px solid ${activeAgencyName === 'ERASER' ? '#EF4444' : '#E2E8F0'}`, 
                fontSize: 13, cursor: 'pointer', fontWeight: activeAgencyName === 'ERASER' ? 'bold' : 'normal'
              }}
            >
              🧹 Eraser
            </div>
            {agencies.map(a => (
              <div 
                key={a.id} 
                onClick={() => setActiveAgencyName(a.name)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, 
                  background: activeAgencyName === a.name ? '#EFF6FF' : '#FFF', 
                  padding: '6px 12px', borderRadius: 6, 
                  border: `2px solid ${activeAgencyName === a.name ? '#3B82F6' : '#E2E8F0'}`, 
                  fontSize: 13, cursor: 'pointer', fontWeight: activeAgencyName === a.name ? 'bold' : 'normal'
                }}
              >
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: a.color, border: '1px solid #000' }}></div>
                {a.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <p style={{ color: '#3B82F6', fontWeight: 'bold' }}>Loading / Saving...</p>}
      
      <div style={{ overflowX: 'auto', opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#F1F5F9' }}>
              <th style={{ padding: '8px', border: '1px solid #CBD5E1', textAlign: 'left', minWidth: 120 }}>Houses / Days</th>
              {daysArray.map(d => (
                <th key={d} style={{ padding: '8px', border: '1px solid #CBD5E1', minWidth: 30 }}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.map(room => (
              <tr key={room.id}>
                <td style={{ padding: '8px', border: '1px solid #CBD5E1', textAlign: 'left', fontWeight: 'bold', background: '#F8FAFC' }}>
                  {room.name}
                </td>
                {daysArray.map(day => {
                  const currDate = `${selectedMonth}-${String(day).padStart(2, '0')}`
                  const cellKey = `${room.name}|${currDate}`
                  
                  const match = reservations.find(r => 
                    r.room_or_unit === room.name && 
                    r.check_in <= currDate && 
                    r.check_out > currDate &&
                    r.status !== 'cancelled'
                  )
                  
                  // Check pending changes first
                  let activeSource = null
                  let isPending = false
                  
                  if (pendingChanges[cellKey]) {
                    isPending = true
                    activeSource = pendingChanges[cellKey] === 'ERASER' ? null : pendingChanges[cellKey]
                  } else if (match) {
                    activeSource = match.source
                  }
                  
                  let bgColor = 'transparent'
                  if (activeSource) {
                    const agency = agencies.find(a => a.name.toLowerCase() === (activeSource || '').toLowerCase())
                    if (agency && agency.color) bgColor = agency.color
                    else bgColor = '#CBD5E1'
                  }
                  
                  return (
                    <td 
                      key={day} 
                      onClick={() => handleCellClick(room.name, currDate)}
                      style={{ 
                        border: '1px solid #CBD5E1', 
                        background: bgColor, 
                        height: 30, 
                        padding: 2,
                        cursor: editMode && activeAgencyName ? 'pointer' : 'default',
                        opacity: isPending ? 0.7 : 1
                      }}
                    >
                      {activeSource && (
                        <div style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 60, margin: '0 auto', color: '#000', fontWeight: 'bold' }} title={activeSource}>
                          {activeSource}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            {rooms.length === 0 && (
              <tr>
                <td colSpan={daysInMonth + 1} style={{ padding: 20, color: '#94A3B8' }}>No houses configured. Add houses above to see the grid.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
