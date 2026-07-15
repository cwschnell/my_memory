import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { 
  getByDate, updateStatus, updateDate, deleteRecording, Recording,
  getCalendarMonthSummary, getReservationsByDate, getShoppingHistory, getActiveShopping
} from '../api/client'

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [activeTab, setActiveTab] = useState<'memos' | 'bookings' | 'shopping'>('memos')
  
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [shopping, setShopping] = useState<Recording[]>([])
  const [monthSummary, setMonthSummary] = useState<Record<string, any>>({})
  
  const [loading, setLoading] = useState(false)
  const [postponeModalRec, setPostponeModalRec] = useState<Recording | null>(null)
  const [postponeDate, setPostponeDate] = useState('')
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyMemos, setHistoryMemos] = useState<Recording[]>([])
  const [historyShopping, setHistoryShopping] = useState<Recording[]>([])

  const fetchHistoryData = async () => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const [{ getDoneByDate, getShoppingHistory }] = await Promise.all([
        import('../api/client')
      ])
      const mData = await getDoneByDate(dateStr)
      const sData = await getShoppingHistory()
      setHistoryMemos(mData)
      setHistoryShopping(sData.filter((r: any) => r.date_recorded === dateStr))
      setShowHistoryModal(true)
    } catch(err) { console.error(err) }
  }

  const fetchMonthSummary = async (date: Date) => {
    try {
      const monthStr = format(date, 'yyyy-MM')
      const summary = await getCalendarMonthSummary(monthStr)
      setMonthSummary(prev => ({...prev, ...summary}))
    } catch (err) {
      console.error(err)
    }
  }

  const fetchTabData = async (date: Date) => {
    setLoading(true)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      if (activeTab === 'memos') {
        const data = await getByDate(dateStr)
        setRecordings(data)
      } else if (activeTab === 'bookings') {
        const data = await getReservationsByDate(dateStr)
        setBookings(data)
      } else if (activeTab === 'shopping') {
        const data = await getActiveShopping()
        setShopping(data.filter((r: any) => {
          if (!r.date_recorded) return true;
          return r.date_recorded <= dateStr;
        }))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMonthSummary(selectedDate)
  }, [selectedDate.getFullYear(), selectedDate.getMonth()])

  useEffect(() => {
    fetchTabData(selectedDate)
  }, [selectedDate, activeTab])

  const handleStatus = async (id: string, status: string) => {
    try {
      await updateStatus(id, status)
      fetchTabData(selectedDate)
      fetchMonthSummary(selectedDate) // Update counts
    } catch (err) {
      console.error(err)
    }
  }

  const handleDateChange = async (id: string, newDate: string) => {
    try {
      await updateDate(id, newDate)
      fetchTabData(selectedDate)
      fetchMonthSummary(selectedDate)
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this?")) return
    try {
      await deleteRecording(id)
      fetchTabData(selectedDate)
      fetchMonthSummary(selectedDate)
    } catch (err) {
      console.error(err)
    }
  }

  const handlePostponeConfirm = async () => {
    if (!postponeModalRec || !postponeDate) return
    try {
      await updateStatus(postponeModalRec.id, 'postpone')
      await updateDate(postponeModalRec.id, postponeDate)
      setPostponeModalRec(null)
      fetchTabData(selectedDate)
      fetchMonthSummary(selectedDate)
    } catch (err) {
      console.error(err)
    }
  }

  const tileClassName = ({ date, view }: any) => {
    if (view === 'month') {
      const dateStr = format(date, 'yyyy-MM-dd')
      const summary = monthSummary[dateStr]
      let classes = []
      if (summary && summary.bookings > 0) classes.push('has-booking')
      if (summary && summary.future_reminders > 0) classes.push('has-reminders')
      return classes.length > 0 ? classes.join(' ') : null
    }
    return null
  }

  return (
    <div style={{ padding: 24, display: 'flex', gap: 24, minHeight: '100vh', background: '#F8FAFC' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .has-booking {
          background-color: #FCA5A5 !important;
          color: #7F1D1D !important;
          font-weight: bold;
          border-radius: 8px;
        }
        .has-reminders {
          background-color: #BFDBFE !important;
          color: #1E3A8A !important;
          font-weight: bold;
          border-radius: 8px;
        }
        .has-booking.has-reminders {
          background: linear-gradient(135deg, #FCA5A5 50%, #BFDBFE 50%) !important;
          color: #000 !important;
        }
        .react-calendar {
          border: none;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          padding: 16px;
          font-family: inherit;
        }
        .tab-btn {
          padding: 10px 20px;
          border: none;
          background: transparent;
          font-size: 16px;
          font-weight: 600;
          color: #64748B;
          cursor: pointer;
          border-bottom: 2px solid transparent;
        }
        .tab-btn.active {
          color: #1E3A8A;
          border-bottom: 2px solid #1E3A8A;
        }
      `}} />

      {/* Postpone Modal */}
      {postponeModalRec && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFF', padding: 24, borderRadius: 12, width: 340, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 12px', color: '#1E3A8A' }}>📅 Postpone Memo</h3>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: '#475569' }}>
              Select future date for: <strong>{postponeModalRec.summary}</strong>
            </p>
            <input
              type="date"
              value={postponeDate}
              min={format(new Date(), 'yyyy-MM-dd')}
              onChange={e => setPostponeDate(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #CBD5E1', marginBottom: 20, fontSize: 15, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setPostponeModalRec(null)} style={{ padding: '8px 14px', background: '#E2E8F0', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handlePostponeConfirm} style={{ padding: '8px 14px', background: '#2563EB', color: '#FFF', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Confirm Postpone</button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFF', padding: 24, borderRadius: 12, width: 500, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 12px', color: '#1E3A8A' }}>📜 Historical Data - {format(selectedDate, 'MMM d, yyyy')}</h3>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={() => setShowHistoryModal(false)} style={{ padding: '6px 12px', background: '#E2E8F0', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Close</button>
            </div>
            
            <h4 style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: 4 }}>Completed Memos</h4>
            {historyMemos.length === 0 ? <p style={{color: '#94A3B8'}}>No completed memos.</p> : historyMemos.map(m => (
              <div key={m.id} style={{ padding: 10, border: '1px solid #E2E8F0', borderRadius: 6, marginBottom: 8, background: '#F8FAFC' }}>
                <strong style={{color: '#334155'}}>{m.summary}</strong>
                <p style={{margin: '4px 0 0', fontSize: 13, color: '#64748B'}}>{m.transcript}</p>
              </div>
            ))}

            <h4 style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: 4, marginTop: 24 }}>Completed Shopping</h4>
            {historyShopping.length === 0 ? <p style={{color: '#94A3B8'}}>No completed shopping lists.</p> : historyShopping.map(s => (
              <div key={s.id} style={{ padding: 10, border: '1px solid #E2E8F0', borderRadius: 6, marginBottom: 8, background: '#F8FAFC' }}>
                <strong style={{color: '#334155'}}>{s.summary}</strong>
                <p style={{margin: '4px 0 0', fontSize: 13, color: '#64748B'}}>{s.transcript}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Left Sidebar: Calendar */}
      <div style={{ width: 350, flexShrink: 0 }}>
        <Calendar 
          onChange={(val) => setSelectedDate(val as Date)} 
          value={selectedDate} 
          tileClassName={tileClassName}
          onActiveStartDateChange={({ activeStartDate }) => activeStartDate && fetchMonthSummary(activeStartDate)}
        />
        <div style={{ marginTop: 24, padding: 16, background: '#FFF', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h4 style={{ margin: '0 0 12px', color: '#1E293B' }}>{format(selectedDate, 'MMMM d, yyyy')} Summary</h4>
          <p style={{ margin: '4px 0', color: '#475569' }}>Bookings: {monthSummary[format(selectedDate, 'yyyy-MM-dd')]?.bookings || 0}</p>
          <p style={{ margin: '4px 0', color: '#475569' }}>Memos Completed: {monthSummary[format(selectedDate, 'yyyy-MM-dd')]?.memos || 0}</p>
          <p style={{ margin: '4px 0', color: '#475569' }}>Shopping Completed: {monthSummary[format(selectedDate, 'yyyy-MM-dd')]?.shopping || 0}</p>
          <p style={{ margin: '4px 0', color: '#475569' }}>Future Reminders: {monthSummary[format(selectedDate, 'yyyy-MM-dd')]?.future_reminders || 0}</p>
          <button onClick={fetchHistoryData} style={{ marginTop: 16, width: '100%', padding: '8px 0', background: '#334155', color: '#FFF', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
            View Historical Data
          </button>
        </div>
      </div>

      {/* Right Content Area */}
      <div style={{ flexGrow: 1, background: '#FFF', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
          <button className={`tab-btn ${activeTab === 'memos' ? 'active' : ''}`} onClick={() => setActiveTab('memos')}>📋 Memos</button>
          <button className={`tab-btn ${activeTab === 'bookings' ? 'active' : ''}`} onClick={() => setActiveTab('bookings')}>🏨 Bookings</button>
          <button className={`tab-btn ${activeTab === 'shopping' ? 'active' : ''}`} onClick={() => setActiveTab('shopping')}>🛒 Shopping</button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: 24, overflowY: 'auto', flexGrow: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>Loading...</div>
          ) : activeTab === 'memos' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#1E3A8A', color: '#FFF', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', width: 70 }}>Time</th>
                  <th style={{ padding: '12px 16px' }}>Summary</th>
                  <th style={{ padding: '12px 16px', width: 140 }}>Move Date</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', width: 70 }}>Urgent</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', width: 70 }}>Done</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', width: 80 }}>Postpone</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', width: 70 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recordings.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>
                      No memos for this date.
                    </td>
                  </tr>
                )}
                {recordings.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#F8FAFC' : '#FFF' }}>
                    <td style={{ padding: '14px 16px', color: '#64748B', fontSize: 14 }}>
                      {format(new Date(r.created_at), 'HH:mm')}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <a 
                        href={`/message/${r.id}`} 
                        style={{ 
                          color: r.status === 'urgent' ? '#DC2626' : r.status === 'done' ? '#16A34A' : r.status === 'postpone' ? '#64748B' : '#2563EB', 
                          fontWeight: 600, 
                          fontSize: 16,
                          textDecoration: 'none' 
                        }}
                      >
                        {r.summary}
                      </a>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <input
                        type="date"
                        value={r.date_recorded || format(selectedDate, 'yyyy-MM-dd')}
                        onChange={e => handleDateChange(r.id, e.target.value)}
                        style={{ padding: '4px 8px', fontSize: 13, borderRadius: 4, border: '1px solid #CBD5E1' }}
                      />
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <input type="radio" name={'u_'+r.id} checked={r.status === 'urgent'} onChange={() => handleStatus(r.id, 'urgent')} />
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <input type="radio" name={'d_'+r.id} checked={r.status === 'done'} onChange={() => handleStatus(r.id, 'done')} />
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <input
                        type="radio"
                        name={'p_'+r.id}
                        checked={r.status === 'postpone'}
                        onChange={() => {
                          setPostponeModalRec(r)
                          setPostponeDate(r.date_recorded || format(selectedDate, 'yyyy-MM-dd'))
                        }}
                      />
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleDelete(r.id)}
                        style={{ background: '#EF4444', color: '#FFF', border: 'none', borderRadius: 4, padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeTab === 'bookings' ? (
            <div>
              {bookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>No bookings for this date.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {bookings.map(b => (
                    <div key={b.id} style={{ padding: 16, border: '1px solid #E2E8F0', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <h4 style={{ margin: '0 0 8px', color: '#1E293B', fontSize: 18 }}>{b.guest?.full_name || 'Unknown Guest'}</h4>
                        <p style={{ margin: '0 0 4px', color: '#475569' }}><strong>Room/Unit:</strong> {b.room_or_unit || 'N/A'}</p>
                        <p style={{ margin: '0 0 4px', color: '#475569' }}><strong>Status:</strong> {b.status}</p>
                        <p style={{ margin: 0, color: '#475569' }}><strong>Check In:</strong> {b.check_in} | <strong>Check Out:</strong> {b.check_out}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 20, fontWeight: 'bold', color: '#16A34A' }}>${b.total_usd}</span>
                        <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>{b.num_adults} Adults, {b.num_children} Children</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              {shopping.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>No completed shopping items for this date.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {shopping.map(s => (
                    <div key={s.id} style={{ padding: 16, border: '1px solid #E2E8F0', borderRadius: 8 }}>
                      <h4 style={{ margin: '0 0 4px', color: '#1E293B' }}>{s.summary}</h4>
                      <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>{s.transcript}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
