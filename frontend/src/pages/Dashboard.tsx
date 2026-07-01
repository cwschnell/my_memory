import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { getByDate, updateStatus, updateDate, deleteRecording, Recording } from '../api/client'

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(false)

  const fetchRecordings = async (dateStr: string) => {
    setLoading(true)
    try {
      const data = await getByDate(dateStr)
      setRecordings(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRecordings(selectedDate) }, [selectedDate])

  const handleStatus = async (id: string, status: string) => {
    try {
      await updateStatus(id, status)
      fetchRecordings(selectedDate)
    } catch (err) {
      console.error(err)
    }
  }

  const handleDateChange = async (id: string, newDate: string) => {
    try {
      await updateDate(id, newDate)
      fetchRecordings(selectedDate)
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this memory?")) return
    try {
      await deleteRecording(id)
      fetchRecordings(selectedDate)
    } catch (err) {
      console.error(err)
    }
  }

  const [postponeModalRec, setPostponeModalRec] = useState<Recording | null>(null)
  const [postponeDate, setPostponeDate] = useState('')

  const handlePostponeConfirm = async () => {
    if (!postponeModalRec || !postponeDate) return
    try {
      await updateStatus(postponeModalRec.id, 'postpone')
      await updateDate(postponeModalRec.id, postponeDate)
      setPostponeModalRec(null)
      fetchRecordings(selectedDate)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div style={{ padding: 24, position: 'relative' }}>
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

      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid #E2E8F0' }}>
        <h2 style={{ margin: 0, color: '#1E293B' }}>📋 Daily Memory Memos</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontWeight: 600, color: '#475569' }}>Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ padding: '8px 12px', fontSize: 15, borderRadius: 6, border: '1px solid #CBD5E1', outline: 'none' }}
          />
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>Loading voice memos...</div>
      ) : (
        <div style={{ background: '#FFF', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
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
                    No memory memos for this date.
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
                      value={r.date_recorded || selectedDate}
                      onChange={e => handleDateChange(r.id, e.target.value)}
                      style={{ padding: '4px 8px', fontSize: 13, borderRadius: 4, border: '1px solid #CBD5E1' }}
                    />
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <input type="radio" name={r.id} checked={r.status === 'urgent'} onChange={() => handleStatus(r.id, 'urgent')} />
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <input type="radio" name={r.id} checked={r.status === 'done'} onChange={() => handleStatus(r.id, 'done')} />
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <input
                      type="radio"
                      name={r.id}
                      checked={r.status === 'postpone'}
                      onChange={() => {
                        setPostponeModalRec(r)
                        setPostponeDate(r.date_recorded || selectedDate)
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
        </div>
      )}
    </div>
  )
}
