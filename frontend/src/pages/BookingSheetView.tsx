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

  const handleCellClick = async (roomName: string, currDate: string, existingMatch: any) => {
    if (!editMode) return
    
    const { api } = await import('../api/client')
    if (activeAgencyName === 'ERASER') {
      if (existingMatch) {
        setLoading(true)
        try {
          await api.delete(`/lodge/reservations/${existingMatch.id}`)
          await fetchMonthReservations()
        } catch (e) {
          console.error(e)
          setLoading(false)
        }
      }
    } else if (activeAgencyName) {
      setLoading(true)
      try {
        if (existingMatch) {
          // Update existing reservation source
          const payload = { ...existingMatch }
          payload.source = activeAgencyName
          payload.guest_id = payload.guest_id || null
          // Omit guest if it's nested dict to avoid schema errors on backend
          delete payload.guest
          await api.put(`/lodge/reservations/${existingMatch.id}`, payload)
        } else {
          // Create new 1-day reservation
          const nextDay = new Date(currDate)
          nextDay.setDate(nextDay.getDate() + 1)
          const checkoutDate = nextDay.toISOString().split('T')[0]
          
          await api.post('/lodge/reservations', {
            room_or_unit: roomName,
            check_in: currDate,
            check_out: checkoutDate,
            source: activeAgencyName,
            status: 'confirmed',
            num_adults: 1,
            num_children: 0,
            rate_per_night_usd: 0,
            total_usd: 0,
            deposit_paid: false
          })
        }
        await fetchMonthReservations()
      } catch (e) {
        console.error(e)
        setLoading(false)
      }
    }
  }

  return (
    <div style={{ background: '#FFF', padding: 24, borderRadius: 12, color: '#1E293B', overflowX: 'auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>📅 Booking Sheet (Excel Layout)</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button 
            onClick={() => {
              setEditMode(!editMode)
              setActiveAgencyName(null)
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

      {/* Settings Section */}
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
          <h3 style={{ margin: '0 0 10px' }}>Agencies (Legend)</h3>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input 
              value={agencyName} onChange={e => setAgencyName(e.target.value)} 
              placeholder="e.g. AirBnB" style={{ flex: 1, padding: 6, border: '1px solid #CBD5E1', borderRadius: 4 }} 
            />
            <input type="color" value={agencyColor} onChange={e => setAgencyColor(e.target.value)} style={{ padding: 0, height: 30, width: 30, border: 'none' }} />
            <button onClick={handleAddAgency} style={{ padding: '6px 12px', background: '#2563EB', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add</button>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {editMode && (
              <div 
                onClick={() => setActiveAgencyName('ERASER')}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, 
                  background: activeAgencyName === 'ERASER' ? '#FEF2F2' : '#F8FAFC', 
                  padding: '4px 8px', borderRadius: 4, 
                  border: `2px solid ${activeAgencyName === 'ERASER' ? '#EF4444' : '#E2E8F0'}`, 
                  fontSize: 13, cursor: 'pointer' 
                }}
              >
                🧹 Eraser
              </div>
            )}
            {agencies.map(a => (
              <div 
                key={a.id} 
                onClick={() => editMode && setActiveAgencyName(a.name)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, 
                  background: activeAgencyName === a.name ? '#EFF6FF' : '#F8FAFC', 
                  padding: '4px 8px', borderRadius: 4, 
                  border: `2px solid ${activeAgencyName === a.name ? '#3B82F6' : '#E2E8F0'}`, 
                  fontSize: 13,
                  cursor: editMode ? 'pointer' : 'default'
                }}
              >
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: a.color }}></div>
                {a.name}
                <button onClick={(e) => { e.stopPropagation(); handleDeleteAgency(a.id); }} style={{ color: 'red', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 10 }}>✖</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <p>Loading sheet...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
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
                    const match = reservations.find(r => 
                      r.room_or_unit === room.name && 
                      r.check_in <= currDate && 
                      r.check_out > currDate &&
                      r.status !== 'cancelled'
                    )
                    let bgColor = 'transparent'
                    if (match) {
                      const agency = agencies.find(a => a.name.toLowerCase() === (match.source || '').toLowerCase())
                      if (agency && agency.color) bgColor = agency.color
                      else bgColor = '#CBD5E1' // default matched
                    }
                    return (
                      <td 
                        key={day} 
                        onClick={() => handleCellClick(room.name, currDate, match)}
                        style={{ 
                          border: '1px solid #CBD5E1', 
                          background: bgColor, 
                          height: 30, 
                          padding: 2,
                          cursor: editMode && activeAgencyName ? 'pointer' : 'default'
                        }}
                      >
                        {match && (
                          <div style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 60, margin: '0 auto', color: '#000', fontWeight: 'bold' }} title={match.guest?.full_name}>
                            {match.guest?.full_name || 'Booked'}
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
      )}
    </div>
  )
}
