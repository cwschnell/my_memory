import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns'
import { getCalendarDoneCounts, getDoneByDate, Recording } from '../api/client'

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [doneCounts, setDoneCounts] = useState<Record<string, number>>({})
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null)
  const [selectedDoneMemos, setSelectedDoneMemos] = useState<Recording[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getCalendarDoneCounts().then(setDoneCounts).catch(console.error)
  }, [])

  const handleDateClick = async (dateObj: Date) => {
    const dateStr = format(dateObj, 'yyyy-MM-dd')
    setSelectedDateStr(dateStr)
    setLoading(true)
    try {
      const memos = await getDoneByDate(dateStr)
      setSelectedDoneMemos(memos)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })

  return (
    <div style={{ padding: 24 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid #E2E8F0' }}>
        <h2 style={{ margin: 0, color: '#1E293B' }}>📅 Calendar History (Completed Memos)</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #CBD5E1', background: '#FFF', cursor: 'pointer', fontWeight: 600 }}
          >
            &lt; Prev
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1E293B' }}>
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button 
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
            style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #CBD5E1', background: '#FFF', cursor: 'pointer', fontWeight: 600 }}
          >
            Next &gt;
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 32 }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontWeight: 700, color: '#64748B', padding: 8, fontSize: 13 }}>
            {d}
          </div>
        ))}
        {daysInMonth.map(day => {
          const dayStr = format(day, 'yyyy-MM-dd')
          const count = doneCounts[dayStr] || 0
          const isSelected = selectedDateStr === dayStr

          return (
            <div
              key={dayStr}
              onClick={() => handleDateClick(day)}
              style={{
                background: isSelected ? '#DBEAFE' : count > 0 ? '#F0FDF4' : '#FFF',
                border: isSelected ? '2px solid #2563EB' : '1px solid #E2E8F0',
                borderRadius: 8,
                padding: 12,
                minHeight: 70,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: isSameMonth(day, currentMonth) ? '#1E293B' : '#94A3B8' }}>
                {format(day, 'd')}
              </span>
              {count > 0 && (
                <span style={{ 
                  background: '#16A34A', 
                  color: '#FFF', 
                  fontSize: 11, 
                  fontWeight: 700, 
                  padding: '2px 6px', 
                  borderRadius: 10, 
                  alignSelf: 'flex-start',
                  marginTop: 6 
                }}>
                  {count} Done
                </span>
              )}
            </div>
          )
        })}
      </div>

      {selectedDateStr && (
        <div style={{ background: '#FFF', padding: 20, borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#1E293B' }}>
            Completed Memos for {format(new Date(selectedDateStr), 'EEEE, d MMMM yyyy')}
          </h3>
          {loading ? (
            <div>Loading details...</div>
          ) : selectedDoneMemos.length === 0 ? (
            <div style={{ color: '#94A3B8' }}>No completed memos recorded for this date.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {selectedDoneMemos.map(memo => (
                <div key={memo.id} style={{ padding: 12, border: '1px solid #E2E8F0', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <a 
                    href={`/message/${memo.id}`}
                    style={{ fontSize: 16, fontWeight: 600, color: '#2563EB', textDecoration: 'none' }}
                  >
                    🔗 {memo.summary}
                  </a>
                  <span style={{ fontSize: 13, color: '#64748B' }}>
                    {format(new Date(memo.created_at), 'HH:mm')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
