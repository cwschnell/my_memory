import { useState, useEffect } from 'react'
import { getActiveShopping, getShoppingHistory, updateStatus, deleteRecording, Recording } from '../api/client'

export default function ShoppingView() {
  const [activeItems, setActiveItems] = useState<Recording[]>([])
  const [historyItems, setHistoryItems] = useState<Recording[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [act, hist] = await Promise.all([getActiveShopping(), getShoppingHistory()])
      setActiveItems(act)
      setHistoryItems(hist)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleDone = async (id: string) => {
    try {
      await updateStatus(id, 'done')
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this shopping item?")) return
    try {
      await deleteRecording(id)
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // Group active items by client / store name
  const groupedActive = activeItems.reduce((acc, item) => {
    const clientName = (item.client?.name && item.client.name.trim()) ? item.client.name.trim() : 'General Shopping'
    if (!acc[clientName]) acc[clientName] = []
    acc[clientName].push(item)
    return acc
  }, {} as Record<string, Recording[]>)

  const sortedActiveKeys = Object.keys(groupedActive).sort((a, b) => {
    if (a === 'General Shopping') return 1
    if (b === 'General Shopping') return -1
    return a.localeCompare(b, undefined, { sensitivity: 'base' })
  })

  return (
    <div style={{ padding: 24 }}>
      <header className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid #E2E8F0' }}>
        <h2 style={{ margin: 0, color: '#1E293B' }}>🛒 My Shopping Lists</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFF', cursor: 'pointer', fontWeight: 600 }}
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
          <button
            onClick={handlePrint}
            style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#2563EB', color: '#FFF', cursor: 'pointer', fontWeight: 600 }}
          >
            🖨️ Print Shopping List
          </button>
        </div>
      </header>

      {/* Printable Area Header */}
      <div className="print-only" style={{ display: 'none', marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>🛒 My Shopping List</h1>
        <hr />
      </div>

      {loading ? (
        <div>Loading shopping items...</div>
      ) : (
        <div>
          {sortedActiveKeys.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>No active shopping items.</div>
          ) : (
            sortedActiveKeys.map(clientName => (
              <div key={clientName} style={{ marginBottom: 28, background: '#FFF', borderRadius: 8, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ background: '#1E3A8A', color: '#FFF', padding: '12px 16px', fontWeight: 700, fontSize: 16 }}>
                  🏷️ Category / Store: {clientName}
                </div>
                <div style={{ padding: 16 }}>
                  {groupedActive[clientName].map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: '#1E293B' }}>{item.summary}</div>
                        <div style={{ fontSize: 14, color: '#475569', marginTop: 4 }}>{item.transcript}</div>
                      </div>
                      <div className="no-print" style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleDone(item.id)}
                          style={{ background: '#16A34A', color: '#FFF', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Mark Done
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          style={{ background: '#EF4444', color: '#FFF', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          {showHistory && (
            <div style={{ marginTop: 40 }} className="no-print">
              <h3 style={{ color: '#64748B' }}>📜 Shopping History (Completed)</h3>
              <div style={{ background: '#FFF', borderRadius: 8, border: '1px solid #E2E8F0', padding: 16 }}>
                {historyItems.length === 0 ? (
                  <div style={{ color: '#94A3B8' }}>No completed shopping items in history.</div>
                ) : (
                  historyItems.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <div>
                        <span style={{ fontWeight: 600, textDecoration: 'line-through', color: '#64748B' }}>{item.summary}</span>
                        <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 10 }}>({item.client?.name || 'General'})</span>
                      </div>
                      <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 12 }}>
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: #FFF !important; }
        }
      `}</style>
    </div>
  )
}
