import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { getByDate, updateStatus } from '../api/client'

interface Recording {
  id: string
  summary: string
  transcript: string
  status: string
  created_at: string
}

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

  return (
    <div style={{ maxWidth: 850, margin: '40px auto', padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, borderBottom: '2px solid #E2E8F0', paddingBottom: 16 }}>
        <h1 style={{ margin: 0, color: '#1E293B', fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          🧠 <span>My Memory</span>
        </h1>
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
                <th style={{ padding: '12px 16px', width: 80 }}>Time</th>
                <th style={{ padding: '12px 16px' }}>Summary (3 words)</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', width: 80 }}>Urgent</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', width: 80 }}>Done</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', width: 90 }}>Postpone</th>
              </tr>
            </thead>
            <tbody>
              {recordings.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>
                    No memory memos recorded for this date.
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
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <input type="radio" name={r.id} checked={r.status === 'urgent'} onChange={() => handleStatus(r.id, 'urgent')} />
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <input type="radio" name={r.id} checked={r.status === 'done'} onChange={() => handleStatus(r.id, 'done')} />
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <input type="radio" name={r.id} checked={r.status === 'postpone'} onChange={() => handleStatus(r.id, 'postpone')} />
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
