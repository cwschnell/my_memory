import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useTranslation } from '../i18n/translations';

interface Incident {
  id: string;
  title: string;
  description?: string;
  area?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reported_by?: string;
  is_resolved: boolean;
  created_at: string;
  resolved_at?: string;
}

export const IncidentLogView: React.FC = () => {
  const { t } = useTranslation();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'active' | 'resolved' | 'all'>('active');
  const [showModal, setShowModal] = useState<boolean>(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    area: '',
    severity: 'medium',
    reported_by: 'Andrisa'
  });

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      let url = '/lodge/incidents';
      if (filter === 'active') url += '?resolved=false';
      if (filter === 'resolved') url += '?resolved=true';
      const resp = await api.get(url);
      setIncidents(resp.data);
    } catch (err) {
      console.error('Error loading incidents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [filter]);

  const handleResolve = async (id: string) => {
    try {
      await api.put(`/lodge/incidents/${id}/resolve`);
      fetchIncidents();
    } catch (err) {
      alert('Error resolving incident');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return;
    try {
      await api.post('/lodge/incidents', form);
      setShowModal(false);
      setForm({ title: '', description: '', area: '', severity: 'medium', reported_by: 'Andrisa' });
      fetchIncidents();
    } catch (err) {
      alert('Error reporting incident');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t.delete + '?')) return;
    await api.delete(`/lodge/incidents/${id}`);
    fetchIncidents();
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem', animation: 'fadeIn 0.3s ease-in' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#f8fafc' }}>🚨 {t.incidentsTitle}</h2>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '0.6rem 1.4rem',
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(239,68,68,0.3)'
          }}
        >
          {t.reportIncident}
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setFilter('active')}
          style={{
            padding: '0.5rem 1.2rem',
            borderRadius: '20px',
            border: 'none',
            background: filter === 'active' ? '#ef4444' : '#1e293b',
            color: filter === 'active' ? '#fff' : '#cbd5e1',
            fontWeight: filter === 'active' ? 700 : 500,
            cursor: 'pointer'
          }}
        >
          🔥 Active Issues
        </button>
        <button
          onClick={() => setFilter('resolved')}
          style={{
            padding: '0.5rem 1.2rem',
            borderRadius: '20px',
            border: 'none',
            background: filter === 'resolved' ? '#10b981' : '#1e293b',
            color: filter === 'resolved' ? '#fff' : '#cbd5e1',
            fontWeight: filter === 'resolved' ? 700 : 500,
            cursor: 'pointer'
          }}
        >
          ✅ Resolved History
        </button>
        <button
          onClick={() => setFilter('all')}
          style={{
            padding: '0.5rem 1.2rem',
            borderRadius: '20px',
            border: 'none',
            background: filter === 'all' ? '#38bdf8' : '#1e293b',
            color: filter === 'all' ? '#fff' : '#cbd5e1',
            fontWeight: filter === 'all' ? 700 : 500,
            cursor: 'pointer'
          }}
        >
          🌟 All Incidents
        </button>
      </div>

      {/* List */}
      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center' }}>Loading incident log...</p>
      ) : incidents.length === 0 ? (
        <div style={{ background: '#1e293b', padding: '3rem', borderRadius: '14px', textAlign: 'center', color: '#64748b' }}>
          No incidents reported. Everything is running smoothly!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {incidents.map((inc) => {
            const isCrit = inc.severity === 'critical';
            const isHigh = inc.severity === 'high';

            return (
              <div key={inc.id} style={{
                background: inc.is_resolved ? '#0f172a' : isCrit ? 'rgba(239,68,68,0.15)' : '#1e293b',
                opacity: inc.is_resolved ? 0.6 : 1,
                borderRadius: '14px',
                padding: '1.4rem',
                borderLeft: `6px solid ${isCrit ? '#ef4444' : isHigh ? '#f97316' : '#eab308'}`,
                boxShadow: isCrit ? '0 0 20px rgba(239,68,68,0.2)' : '0 4px 12px rgba(0,0,0,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#f8fafc'
              }}>
                <div>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '6px',
                      background: isCrit ? '#ef4444' : isHigh ? '#f97316' : '#eab308',
                      color: isCrit || isHigh ? '#fff' : '#000'
                    }}>
                      {inc.severity}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                      Area: <strong style={{ color: '#e2e8f0' }}>{inc.area || 'General'}</strong> | Reported by: {inc.reported_by || 'Staff'}
                    </span>
                  </div>

                  <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.2rem', color: isCrit && !inc.is_resolved ? '#ff8080' : '#fff' }}>
                    {inc.title} {isCrit && !inc.is_resolved && '🔥'}
                  </h3>

                  {inc.description && (
                    <p style={{ margin: '0 0 0.6rem', color: '#cbd5e1', fontSize: '0.95rem' }}>
                      {inc.description}
                    </p>
                  )}

                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Logged: {new Date(inc.created_at).toLocaleString()}
                    {inc.resolved_at && ` | ✅ Resolved: ${new Date(inc.resolved_at).toLocaleString()}`}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {!inc.is_resolved && (
                    <button
                      onClick={() => handleResolve(inc.id)}
                      style={{
                        padding: '0.6rem 1.2rem',
                        background: '#10b981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      ✔ {t.resolve}
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(inc.id)}
                    style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.1rem' }}
                    title="Delete Record"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Report Issue Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '16px', width: '480px', maxWidth: '90%', color: '#fff' }}>
            <h3 style={{ marginTop: 0, color: '#ef4444' }}>+ Report Maintenance Issue</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.issueTitle} *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Generator coolant leak or Boat engine stalling"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.area}</label>
                  <input
                    type="text"
                    placeholder="e.g. Generator Room"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.severity}</label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">CRITICAL</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.description}</label>
                <textarea
                  rows={3}
                  placeholder="Details on what broke or what parts are needed..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '0.6rem 1rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>{t.cancel}</button>
                <button type="submit" style={{ padding: '0.6rem 1.2rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
