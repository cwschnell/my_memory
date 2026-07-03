import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useTranslation } from '../i18n/translations';

interface DashboardSummary {
  today: string;
  checkins: { room: string; guest_id: string }[];
  checkouts: { room: string; guest_id: string }[];
  inhouse_count: number;
  inhouse_list: { guest_name: string; room: string; adults: number; children: number }[];
  tasks_due_count: number;
  tasks_due: { id: string; title: string; area: string; assigned_to: string; due_date: string }[];
  incidents_count: number;
  open_incidents: { id: string; title: string; area: string; severity: string }[];
  recent_memos: { id: string; summary: string; transcript: string; created_at: string }[];
}

interface Props {
  onNavigate: (tab: string) => void;
  lang: 'EN' | 'PT';
}

export const LodgeDashboard: React.FC<Props> = ({ onNavigate, lang }) => {
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchSummary = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await api.get('/lodge/dashboard');
      setData(resp.data);
    } catch (err: any) {
      setError('Could not connect to Lodge Dashboard API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>⏳</div>
        Carregando painel / Loading dashboard...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#ff6b6b' }}>
        <p>{error}</p>
        <button
          onClick={fetchSummary}
          style={{
            padding: '0.6rem 1.2rem',
            background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          {t.refresh}
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem', animation: 'fadeIn 0.3s ease-in' }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
        padding: '1.5rem 2rem',
        borderRadius: '16px',
        color: '#fff',
        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
        border: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700, color: '#38bdf8' }}>
            🏨 {t.todayPanel}
          </h1>
          <p style={{ margin: '0.3rem 0 0', color: '#94a3b8', fontSize: '0.95rem' }}>
            Vilankulo, Mozambique — {data.today}
          </p>
        </div>
        <button
          onClick={fetchSummary}
          style={{
            background: 'rgba(255,255,255,0.1)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '0.6rem 1.2rem',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s'
          }}
        >
          🔄 {t.refresh}
        </button>
      </div>

      {/* Top Row: Today Panel (Check-ins, Check-outs, In-house) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Check-ins Card */}
        <div style={{
          background: '#1e293b',
          borderRadius: '14px',
          padding: '1.5rem',
          borderLeft: '5px solid #10b981',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          color: '#f8fafc'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#10b981' }}>🟢 {t.checkinsToday}</h3>
            <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 'bold' }}>
              {data.checkins.length}
            </span>
          </div>
          {data.checkins.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>{t.noCheckins}</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#cbd5e1', fontSize: '0.95rem' }}>
              {data.checkins.map((c, idx) => (
                <li key={idx} style={{ marginBottom: '0.4rem' }}>
                  <strong>Room {c.room || 'TBA'}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Check-outs Card */}
        <div style={{
          background: '#1e293b',
          borderRadius: '14px',
          padding: '1.5rem',
          borderLeft: '5px solid #f59e0b',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          color: '#f8fafc'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f59e0b' }}>🟡 {t.checkoutsToday}</h3>
            <span style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 'bold' }}>
              {data.checkouts.length}
            </span>
          </div>
          {data.checkouts.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>{t.noCheckouts}</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#cbd5e1', fontSize: '0.95rem' }}>
              {data.checkouts.map((c, idx) => (
                <li key={idx} style={{ marginBottom: '0.4rem' }}>
                  <strong>Room {c.room || 'TBA'}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* In-house Tonight Card */}
        <div style={{
          background: '#1e293b',
          borderRadius: '14px',
          padding: '1.5rem',
          borderLeft: '5px solid #38bdf8',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          color: '#f8fafc'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#38bdf8' }}>🛏️ {t.inhouseTonight}</h3>
            <span style={{ background: 'rgba(56,189,248,0.2)', color: '#38bdf8', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 'bold' }}>
              {data.inhouse_count} {t.guestsTotal}
            </span>
          </div>
          {data.inhouse_list.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>{t.noInhouse}</p>
          ) : (
            <div style={{ maxHeight: '110px', overflowY: 'auto' }}>
              {data.inhouse_list.map((ih, idx) => (
                <div key={idx} style={{ fontSize: '0.9rem', padding: '0.3rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <strong style={{ color: '#fff' }}>{ih.guest_name}</strong> — {ih.room || 'Room TBA'} ({ih.adults}A / {ih.children}C)
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Second & Third Row: Tasks and Incidents */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Tasks Due Today */}
        <div style={{
          background: '#1e293b',
          borderRadius: '14px',
          padding: '1.5rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#a855f7' }}>📋 {t.tasksDueToday}</h3>
              <span style={{
                background: data.tasks_due_count > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                color: data.tasks_due_count > 0 ? '#ef4444' : '#10b981',
                padding: '0.2rem 0.6rem',
                borderRadius: '12px',
                fontWeight: 'bold'
              }}>
                {data.tasks_due_count}
              </span>
            </div>
            {data.tasks_due.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.95rem' }}>{t.noTasks}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
                {data.tasks_due.map((tk) => (
                  <div key={tk.id} style={{
                    background: 'rgba(255,255,255,0.03)',
                    padding: '0.7rem 1rem',
                    borderRadius: '8px',
                    borderLeft: '3px solid #a855f7',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{tk.title}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        Area: <span style={{ color: '#e2e8f0', textTransform: 'capitalize' }}>{tk.area}</span> | Assigned: {tk.assigned_to || 'Unassigned'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => onNavigate('tasks')}
            style={{
              alignSelf: 'flex-start',
              background: 'transparent',
              border: 'none',
              color: '#38bdf8',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '0.5rem 0'
            }}
          >
            {t.viewAllTasks}
          </button>
        </div>

        {/* Open Incidents */}
        <div style={{
          background: '#1e293b',
          borderRadius: '14px',
          padding: '1.5rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#ef4444' }}>🚨 {t.openIncidents}</h3>
              <span style={{
                background: data.incidents_count > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(100,116,139,0.2)',
                color: data.incidents_count > 0 ? '#ef4444' : '#94a3b8',
                padding: '0.2rem 0.6rem',
                borderRadius: '12px',
                fontWeight: 'bold'
              }}>
                {data.incidents_count}
              </span>
            </div>
            {data.open_incidents.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.95rem' }}>{t.noIncidents}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
                {data.open_incidents.map((inc) => (
                  <div key={inc.id} style={{
                    background: inc.severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.03)',
                    padding: '0.7rem 1rem',
                    borderRadius: '8px',
                    borderLeft: `4px solid ${inc.severity === 'critical' ? '#ef4444' : inc.severity === 'high' ? '#f97316' : '#eab308'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: inc.severity === 'critical' ? '#ff8080' : '#fff' }}>
                        {inc.title} {inc.severity === 'critical' && '🔥 CRITICAL'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        Area: {inc.area || 'General'} | Severity: <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{inc.severity}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => onNavigate('incidents')}
            style={{
              alignSelf: 'flex-start',
              background: 'transparent',
              border: 'none',
              color: '#38bdf8',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '0.5rem 0'
            }}
          >
            {t.viewAllIncidents}
          </button>
        </div>
      </div>
    </div>
  );
};
