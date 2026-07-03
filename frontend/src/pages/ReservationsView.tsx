import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useTranslation } from '../i18n/translations';

interface Guest {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  nationality?: string;
  id_number?: string;
  notes?: string;
}

interface Reservation {
  id: string;
  guest_id?: string;
  guest?: Guest;
  room_or_unit?: string;
  check_in: string;
  check_out: string;
  num_adults: number;
  num_children: number;
  rate_per_night_usd: number;
  total_usd: number;
  deposit_paid: boolean;
  status: string;
  source: string;
  notes?: string;
}

export const ReservationsView: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'reservations' | 'guests'>('reservations');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal forms
  const [showResForm, setShowResForm] = useState<boolean>(false);
  const [showGuestForm, setShowGuestForm] = useState<boolean>(false);

  // Form State - Reservation
  const [resForm, setResForm] = useState({
    guest_id: '',
    room_or_unit: '',
    check_in: new Date().toISOString().split('T')[0],
    check_out: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    num_adults: 2,
    num_children: 0,
    rate_per_night_usd: 120,
    total_usd: 120,
    deposit_paid: false,
    status: 'confirmed',
    source: 'direct',
    notes: ''
  });

  // Form State - Guest
  const [guestForm, setGuestForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    nationality: 'Mozambique',
    id_number: '',
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [resResp, gResp] = await Promise.all([
        api.get('/lodge/reservations'),
        api.get('/lodge/guests')
      ]);
      setReservations(resResp.data);
      setGuests(gResp.data);
    } catch (err) {
      console.error('Error fetching lodge reservations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/lodge/reservations', {
        ...resForm,
        guest_id: resForm.guest_id || null
      });
      setShowResForm(false);
      loadData();
    } catch (err) {
      alert('Error saving reservation');
    }
  };

  const handleCreateGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestForm.full_name) return;
    try {
      await api.post('/lodge/guests', guestForm);
      setShowGuestForm(false);
      setGuestForm({ full_name: '', email: '', phone: '', nationality: 'Mozambique', id_number: '', notes: '' });
      loadData();
    } catch (err) {
      alert('Error saving guest');
    }
  };

  const handleDeleteRes = async (id: string) => {
    if (!window.confirm(t.delete + '?')) return;
    await api.delete(`/lodge/reservations/${id}`);
    loadData();
  };

  const handleDeleteGuest = async (id: string) => {
    if (!window.confirm(t.delete + '?')) return;
    await api.delete(`/lodge/guests/${id}`);
    loadData();
  };

  const calculateTotal = (rate: number, checkIn: string, checkOut: string) => {
    const d1 = new Date(checkIn);
    const d2 = new Date(checkOut);
    const diff = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24)));
    return rate * diff;
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem', animation: 'fadeIn 0.3s ease-in' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem'
      }}>
        <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#f8fafc' }}>🗓️ {t.guestsTitle}</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => setShowResForm(true)}
            style={{
              padding: '0.6rem 1.2rem',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {t.newReservation}
          </button>
          <button
            onClick={() => setShowGuestForm(true)}
            style={{
              padding: '0.6rem 1.2rem',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {t.newGuest}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '2px solid #334155' }}>
        <button
          onClick={() => setActiveTab('reservations')}
          style={{
            padding: '0.7rem 1.5rem',
            background: 'transparent',
            color: activeTab === 'reservations' ? '#38bdf8' : '#94a3b8',
            border: 'none',
            borderBottom: activeTab === 'reservations' ? '3px solid #38bdf8' : 'none',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: 'pointer'
          }}
        >
          📅 Reservations ({reservations.length})
        </button>
        <button
          onClick={() => setActiveTab('guests')}
          style={{
            padding: '0.7rem 1.5rem',
            background: 'transparent',
            color: activeTab === 'guests' ? '#38bdf8' : '#94a3b8',
            border: 'none',
            borderBottom: activeTab === 'guests' ? '3px solid #38bdf8' : 'none',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: 'pointer'
          }}
        >
          👤 Guest Directory ({guests.length})
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center' }}>Loading records...</p>
      ) : activeTab === 'reservations' ? (
        /* Reservations Table */
        <div style={{ background: '#1e293b', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: '#f8fafc' }}>
            <thead>
              <tr style={{ background: '#0f172a', textAlign: 'left', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '1rem' }}>Guest</th>
                <th style={{ padding: '1rem' }}>{t.room}</th>
                <th style={{ padding: '1rem' }}>Dates</th>
                <th style={{ padding: '1rem' }}>Guests</th>
                <th style={{ padding: '1rem' }}>{t.totalUsd}</th>
                <th style={{ padding: '1rem' }}>{t.status}</th>
                <th style={{ padding: '1rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                    No reservations found. Create one to begin tracking occupancy.
                  </td>
                </tr>
              ) : (
                reservations.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>
                      {r.guest?.full_name || 'Walk-in / Direct'}
                    </td>
                    <td style={{ padding: '1rem', color: '#38bdf8', fontWeight: 'bold' }}>{r.room_or_unit}</td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                      {r.check_in} → {r.check_out}
                    </td>
                    <td style={{ padding: '1rem' }}>{r.num_adults}A / {r.num_children}C</td>
                    <td style={{ padding: '1rem', fontWeight: 700, color: '#10b981' }}>${r.total_usd}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        padding: '0.3rem 0.7rem',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        background: r.status === 'checked_in' ? 'rgba(16,185,129,0.2)' : r.status === 'confirmed' ? 'rgba(59,130,246,0.2)' : 'rgba(100,116,139,0.2)',
                        color: r.status === 'checked_in' ? '#10b981' : r.status === 'confirmed' ? '#60a5fa' : '#cbd5e1',
                        textTransform: 'capitalize'
                      }}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <button
                        onClick={() => handleDeleteRes(r.id)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem' }}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Guest Directory Table */
        <div style={{ background: '#1e293b', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: '#f8fafc' }}>
            <thead>
              <tr style={{ background: '#0f172a', textAlign: 'left', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '1rem' }}>{t.guestName}</th>
                <th style={{ padding: '1rem' }}>Contact</th>
                <th style={{ padding: '1rem' }}>{t.nationality}</th>
                <th style={{ padding: '1rem' }}>{t.idNumber}</th>
                <th style={{ padding: '1rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {guests.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                    No guest profiles found.
                  </td>
                </tr>
              ) : (
                guests.map((g) => (
                  <tr key={g.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{g.full_name}</td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                      <div>{g.phone || 'No phone'}</div>
                      <div style={{ color: '#94a3b8' }}>{g.email}</div>
                    </td>
                    <td style={{ padding: '1rem' }}>{g.nationality || '—'}</td>
                    <td style={{ padding: '1rem' }}>{g.id_number || '—'}</td>
                    <td style={{ padding: '1rem' }}>
                      <button
                        onClick={() => handleDeleteGuest(g.id)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem' }}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Reservation Form Modal */}
      {showResForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '16px', width: '500px', maxWidth: '90%', color: '#fff' }}>
            <h3 style={{ marginTop: 0, color: '#10b981' }}>+ Create Reservation</h3>
            <form onSubmit={handleCreateReservation} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Select Guest</label>
                <select
                  value={resForm.guest_id}
                  onChange={(e) => setResForm({ ...resForm, guest_id: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                >
                  <option value="">-- Direct Walk-in / Unlinked --</option>
                  {guests.map(g => (
                    <option key={g.id} value={g.id}>{g.full_name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.room}</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chalet 3"
                    value={resForm.room_or_unit}
                    onChange={(e) => setResForm({ ...resForm, room_or_unit: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.status}</label>
                  <select
                    value={resForm.status}
                    onChange={(e) => setResForm({ ...resForm, status: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                  >
                    <option value="enquiry">Enquiry</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="checked_in">Checked In</option>
                    <option value="checked_out">Checked Out</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.checkIn}</label>
                  <input
                    type="date"
                    required
                    value={resForm.check_in}
                    onChange={(e) => {
                      const ci = e.target.value;
                      const tot = calculateTotal(resForm.rate_per_night_usd, ci, resForm.check_out);
                      setResForm({ ...resForm, check_in: ci, total_usd: tot });
                    }}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.checkOut}</label>
                  <input
                    type="date"
                    required
                    value={resForm.check_out}
                    onChange={(e) => {
                      const co = e.target.value;
                      const tot = calculateTotal(resForm.rate_per_night_usd, resForm.check_in, co);
                      setResForm({ ...resForm, check_out: co, total_usd: tot });
                    }}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.rateUsd}</label>
                  <input
                    type="number"
                    value={resForm.rate_per_night_usd}
                    onChange={(e) => {
                      const rate = Number(e.target.value);
                      const tot = calculateTotal(rate, resForm.check_in, resForm.check_out);
                      setResForm({ ...resForm, rate_per_night_usd: rate, total_usd: tot });
                    }}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.totalUsd}</label>
                  <input
                    type="number"
                    value={resForm.total_usd}
                    onChange={(e) => setResForm({ ...resForm, total_usd: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowResForm(false)} style={{ padding: '0.6rem 1rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>{t.cancel}</button>
                <button type="submit" style={{ padding: '0.6rem 1.2rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Guest Form Modal */}
      {showGuestForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '16px', width: '450px', maxWidth: '90%', color: '#fff' }}>
            <h3 style={{ marginTop: 0, color: '#3b82f6' }}>+ Add New Guest Profile</h3>
            <form onSubmit={handleCreateGuest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.guestName} *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={guestForm.full_name}
                  onChange={(e) => setGuestForm({ ...guestForm, full_name: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.phone}</label>
                  <input
                    type="text"
                    placeholder="+258 ..."
                    value={guestForm.phone}
                    onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.nationality}</label>
                  <input
                    type="text"
                    value={guestForm.nationality}
                    onChange={(e) => setGuestForm({ ...guestForm, nationality: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.idNumber}</label>
                <input
                  type="text"
                  placeholder="Passport / ID number"
                  value={guestForm.id_number}
                  onChange={(e) => setGuestForm({ ...guestForm, id_number: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '0.3rem' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowGuestForm(false)} style={{ padding: '0.6rem 1rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>{t.cancel}</button>
                <button type="submit" style={{ padding: '0.6rem 1.2rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
