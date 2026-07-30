import { useState, useEffect } from 'react'
import { getActiveShopping, getShoppingHistory, deleteShoppingItem, submitTextRecording, ShoppingItem } from '../api/client'

export default function ShoppingView() {
  const [activeItems, setActiveItems] = useState<ShoppingItem[]>([])
  const [historyItems, setHistoryItems] = useState<ShoppingItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [isSubmittingText, setIsSubmittingText] = useState(false)

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return
    setIsSubmittingText(true)
    try {
      await submitTextRecording(textInput.trim(), 'shopping')
      setTextInput('')
      fetchData()
    } catch (err) {
      console.error(err)
      alert('Failed to submit text.')
    } finally {
      setIsSubmittingText(false)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [act, hist] = await Promise.all([getActiveShopping(), getShoppingHistory()])
      // Support both new ShoppingItem schema and legacy format
      const normalizedAct: ShoppingItem[] = act.map((item: any) => {
        let name = item.item_name || item.summary || 'Shopping Item'
        if (name.startsWith('[') && name.includes(']')) {
          const endIdx = name.indexOf(']')
          name = name.substring(endIdx + 1).trim()
        }
        return {
          id: item.id,
          created_at: item.created_at,
          updated_at: item.updated_at || item.created_at,
          item_name: name,
          status: item.status
        }
      })
      const normalizedHist: ShoppingItem[] = hist.map((item: any) => {
        let name = item.item_name || item.summary || 'Shopping Item'
        if (name.startsWith('[') && name.includes(']')) {
          const endIdx = name.indexOf(']')
          name = name.substring(endIdx + 1).trim()
        }
        return {
          id: item.id,
          created_at: item.created_at,
          updated_at: item.updated_at || item.created_at,
          item_name: name,
          status: item.status
        }
      })
      setActiveItems(normalizedAct)
      setHistoryItems(normalizedHist)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleDelete = async (id: string) => {
    try {
      await deleteShoppingItem(id)
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <header className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid #E2E8F0' }}>
        <h2 style={{ margin: 0, color: '#1E293B' }}>🛒 My Shopping List</h2>
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
            🖨️ Print List
          </button>
        </div>
      </header>

      {/* Input Box */}
      <div style={{ marginBottom: 24, padding: '16px', background: '#F1F5F9', borderRadius: 8, border: '1px solid #E2E8F0', display: 'flex', gap: 12 }}>
        <input 
          type="text" 
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Type a new shopping list item(s) here..."
          style={{ flexGrow: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 15 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleTextSubmit()
          }}
        />
        <button 
          onClick={handleTextSubmit}
          disabled={isSubmittingText || !textInput.trim()}
          style={{ padding: '0 20px', borderRadius: 8, border: 'none', background: '#1E3A8A', color: '#FFF', fontWeight: 'bold', cursor: isSubmittingText || !textInput.trim() ? 'not-allowed' : 'pointer', opacity: isSubmittingText || !textInput.trim() ? 0.7 : 1 }}
        >
          {isSubmittingText ? 'Saving...' : 'Add'}
        </button>
      </div>

      {/* Printable Area Header */}
      <div className="print-only" style={{ display: 'none', marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>🛒 My Shopping List</h1>
        <hr />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>Loading shopping list...</div>
      ) : (
        <div>
          {activeItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, background: '#FFF', borderRadius: 8, border: '1px solid #E2E8F0', color: '#94A3B8' }}>
              No active shopping items.
            </div>
          ) : (
            <div style={{ background: '#FFF', borderRadius: 8, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              {activeItems.map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 20px',
                    borderBottom: index === activeItems.length - 1 ? 'none' : '1px solid #F1F5F9',
                    background: index % 2 === 0 ? '#FFFFFF' : '#FAFAFA'
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#1E293B' }}>
                    {item.item_name}
                  </span>
                  <button
                    className="no-print"
                    onClick={() => handleDelete(item.id)}
                    style={{
                      background: '#EF4444',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 14px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          {showHistory && (
            <div style={{ marginTop: 40 }} className="no-print">
              <h3 style={{ color: '#64748B', marginBottom: 12 }}>📜 Completed / Deleted History</h3>
              <div style={{ background: '#FFF', borderRadius: 8, border: '1px solid #E2E8F0', padding: 16 }}>
                {historyItems.length === 0 ? (
                  <div style={{ color: '#94A3B8' }}>No items in history.</div>
                ) : (
                  historyItems.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ fontWeight: 600, textDecoration: 'line-through', color: '#94A3B8' }}>
                        {item.item_name}
                      </span>
                      <span style={{ fontSize: 12, color: '#CBD5E1' }}>Removed</span>
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
