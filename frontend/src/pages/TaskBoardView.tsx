import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useTranslation } from '../i18n/translations';

interface LodgeTask {
  id: string;
  title: string;
  assigned_to?: string;
  area: string;
  due_date?: string;
  recurrence: string;
  is_complete: boolean;
  notes?: string;
}

export const TaskBoardView: React.FC = () => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<LodgeTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [showModal, setShowModal] = useState<boolean>(false);

  const [form, setForm] = useState({
    title: '',
    assigned_to: '',
    area: 'housekeeping',
    due_date: new Date().toISOString().split('T')[0],
    recurrence: 'none',
    notes: ''
  });

  const areas = [
    { key: 'all', label: '🌟 All Areas' },
    { key: 'housekeeping', label: '🧹 ' + t.housekeeping },
    { key: 'maintenance', label: '🔧 ' + t.maintenance },
    { key: 'kitchen', label: '🍳 ' + t.kitchen },
    { key: 'bar', label: '🍹 ' + t.bar },
    { key: 'garden', label: '🌴 ' + t.garden },
    { key: 'boat', label: '🚤 ' + t.boat }
  ];

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const url = selectedArea === 'all' ? '/lodge/tasks' : `/lodge/tasks?area=${selectedArea}`;
      const resp = await api.get(url);
      setTasks(resp.data);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [selectedArea]);

  const handleToggleComplete = async (task: LodgeTask) => {
    try {
      await api.put(`/lodge/tasks/${task.id}`, {
        title: task.title,
        assigned_to: task.assigned_to,
        area: task.area,
        due_date: task.due_date,
        recurrence: task.recurrence,
        is_complete: !task.is_complete,
        notes: task.notes
      });
      fetchTasks();
    } catch (err) {
      alert('Failed to update task status');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return;
    try {
      await api.post('/lodge/tasks', form);
      setShowModal(false);
      setForm({ title: '', assigned_to: '', area: 'housekeeping', due_date: new Date().toISOString().split('T')[0], recurrence: 'none', notes: '' });
      fetchTasks();
    } catch (err) {
      alert('Failed to create task');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t.delete + '?')) return;
    await api.delete(`/lodge/tasks/${id}`);
    fetchTasks();
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem', animation: 'fadeIn 0.3s ease-in' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#f8fafc' }}>📋 {t.tasksTitle}</h2>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '0.6rem 1.4rem',
            background: 'linear-gradient(135deg, #a855f7, #9333ea)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(168,85,247,0.3)'
          }}
        >
          {t.newTask}
        </button>
      </div>

      {/* Area Filter Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1.5rem' }}>
        {areas.map((a) => (
          <button
            key={a.key}
            onClick={() => setSelectedArea(a.key)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              border: 'none',
              background: selectedArea === a.key ? '#a855f7' : '#1e293b',
              color: selectedArea === a.key ? '#fff' : '#cbd5e1',
              fontWeight: selectedArea === a.key ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Tasks Grid */}
      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center' }}>Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <div style={{ background: '#1e293b', padding: '3rem', borderRadius: '14px', textAlign: 'center', color: '#64748b' }}>
          No tasks found for this area.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.2rem' }}>
          {tasks.map((tk) => {
            const isOverdue = !tk.is_complete && tk.due_date && tk.due_date < todayStr;
            const isToday = !tk.is_complete && tk.due_date === todayStr;

            return (
              <div key={tk.id} style={{
                background: tk.is_complete ? '#0f172a' : '#1e293b',
                opacity: tk.is_complete ? 0.6 : 1,
                borderRadius: '14px',
                padding: '1.2rem',
                borderTop: `4px solid ${tk.is_complete ? '#10b981' : isOverdue ? '#ef4444' : isToday ? '#f59e0b' : '#a855f7'}`,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                color: '#f8fafc'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', background: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.6rem', borderRadius: '6px', color: '#38bdf8' }}>
                      {tk.area}
                    </span>
                    {tk.recurrence !== 'none' && (
                      <span style={{ fontSize: '0.75rem', background: 'rgba(168,85,247,0.2)', color: '#c084fc', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                        🔄 {tk.recurrence}
                      </span>
                    )}
                  </div>

                  <h3 style={{
                    margin: '0 0 0.5rem',
                    fontSize: '1.1rem',
                    textDecoration: tk.is_complete ? 'line-through' : 'none',
                    color: tk.is_complete ? '#64748b' : '#fff'
                  }}>
                    {tk.title}
                  </h3>

                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.8rem' }}>
                    👤 Assigned: <strong style={{ color: '#e2e8f0' }}>{tk.assigned_to || 'Unassigned'}</strong>
                  </div>

                  {tk.due_date && (
                    <div style={{ fontSize: '0.8rem', color: isOverdue ? '#ef4444' : isToday ? '#fbbf24' : '#94a3b8', fontWeight: isOverdue || isToday ? 'bold' : 'normal', marginBottom: '1rem' }}>
                      📅 Due: {tk.due_date} {isOverdue && '(OVERDUE)'}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.8rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, color: tk.is_complete ? '#10b981' : '#cbd5e1' }}>
                    <input
                      type="checkbox"
                      checked={tk.is_complete}
                      onChange={() => handleToggleComplete(tk)}
                      style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                    />
                    {tk.is_complete ? t.completed : t.complete}
                  </label>

                  <button
                    onClick={() => handleDelete(tk.id)}
                    style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem' }}
                    title="Delete Task"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Task Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '16px', width: '450px', maxWidth: '90%', color: '#fff' }}>
            <h3 style={{ marginTop: 0, color: '#a855f7' }}>+ Assign Staff Task</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.taskTitle} *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Clean pool filters and test pH"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.area}</label>
                  <select
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                  >
                    <option value="housekeeping">Housekeeping</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="kitchen">Kitchen</option>
                    <option value="bar">Bar</option>
                    <option value="reception">Reception</option>
                    <option value="garden">Garden</option>
                    <option value="boat">Boat</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.assignedTo}</label>
                  <input
                    type="text"
                    placeholder="Staff name"
                    value={form.assigned_to}
                    onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.dueDate}</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.recurrence}</label>
                  <select
                    value={form.recurrence}
                    onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                  >
                    <option value="none">None</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '0.6rem 1rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>{t.cancel}</button>
                <button type="submit" style={{ padding: '0.6rem 1.2rem', background: '#a855f7', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
