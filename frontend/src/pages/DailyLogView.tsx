import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useTranslation } from '../i18n/translations';

interface DailyLog {
  id: string;
  log_date: string;
  occupancy_count: number;
  revenue_usd: number;
  weather?: string;
  notes?: string;
}

export const DailyLogView: React.FC = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    log_date: todayStr,
    occupancy_count: 8,
    revenue_usd: 960,
    weather: 'Sunny, calm sea, 28°C',
    notes: 'Busy breakfast service. Boat transfer to Magaru Island went well.'
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const resp = await api.get('/lodge/daily-log?limit=30');
      setLogs(resp.data);
    } catch (err) {
      console.error('Error loading daily logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/lodge/daily-log', form);
      setShowModal(false);
      fetchLogs();
    } catch (err) {
      alert('Error recording daily log');
    }
  };

  const totalRev = logs.reduce((acc, curr) => acc + Number(curr.revenue_usd || 0), 0);
  const avgOcc = logs.length > 0 ? (logs.reduce((acc, curr) => acc + (curr.occupancy_count || 0), 0) / logs.length).toFixed(1) : '0';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem', animation: 'fadeIn 0.3s ease-in' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#f8fafc' }}>📔 {t.dailyLogTitle}</h2>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '0.6rem 1.4rem',
            background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(14,165,233,0.3)'
          }}
        >
          {t.newLogEntry}
        </button>
      </div>

      {/* Summary Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '14px', borderLeft: '5px solid #10b981' }}>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>💰 {t.totalRevenue} (Last 30 Days)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981', marginTop: '0.5rem' }}>${totalRev.toLocaleString()}</div>
        </div>
        <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '14px', borderLeft: '5px solid #38bdf8' }}>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>👥 {t.avgOccupancy}</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.5rem' }}>{avgOcc} guests / day</div>
        </div>
      </div>

      {/* Daily Logs Table */}
      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center' }}>Loading daily records...</p>
      ) : logs.length === 0 ? (
        <div style={{ background: '#1e293b', padding: '3rem', borderRadius: '14px', textAlign: 'center', color: '#64748b' }}>
          No daily log entries recorded yet. Click "+ Record Today's Log" to log today's stats!
        </div>
      ) : (
        <div style={{ background: '#1e293b', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: '#f8fafc' }}>
            <thead>
              <tr style={{ background: '#0f172a', textAlign: 'left', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '1rem' }}>{t.logDate}</th>
                <th style={{ padding: '1rem' }}>{t.occupancyCount}</th>
                <th style={{ padding: '1rem' }}>{t.revenueUsd}</th>
                <th style={{ padding: '1rem' }}>{t.weather}</th>
                <th style={{ padding: '1rem' }}>{t.notes}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((lg) => (
                <tr key={lg.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1rem', fontWeight: 700, color: '#38bdf8' }}>{lg.log_date}</td>
                  <td style={{ padding: '1rem', fontWeight: 600 }}>{lg.occupancy_count} guests</td>
                  <td style={{ padding: '1rem', color: '#10b981', fontWeight: 700 }}>${Number(lg.revenue_usd).toLocaleString()}</td>
                  <td style={{ padding: '1rem', fontSize: '0.9rem' }}>🌤️ {lg.weather || '—'}</td>
                  <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#cbd5e1' }}>{lg.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '16px', width: '480px', maxWidth: '90%', color: '#fff' }}>
            <h3 style={{ marginTop: 0, color: '#38bdf8' }}>+ Record Daily Log</h3>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.logDate}</label>
                <input
                  type="date"
                  required
                  value={form.log_date}
                  onChange={(e) => setForm({ ...form, log_date: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.occupancyCount}</label>
                  <input
                    type="number"
                    value={form.occupancy_count}
                    onChange={(e) => setForm({ ...form, occupancy_count: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.revenueUsd}</label>
                  <input
                    type="number"
                    value={form.revenue_usd}
                    onChange={(e) => setForm({ ...form, revenue_usd: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.weather}</label>
                <input
                  type="text"
                  placeholder="e.g. Sunny, calm sea, 28°C"
                  value={form.weather}
                  onChange={(e) => setForm({ ...form, weather: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.notes}</label>
                <textarea
                  rows={3}
                  placeholder="Notes on lodge operations today..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '0.6rem 1rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>{t.cancel}</button>
                <button type="submit" style={{ padding: '0.6rem 1.2rem', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
