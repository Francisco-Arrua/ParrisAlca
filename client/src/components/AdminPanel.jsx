import React, { useState, useEffect } from 'react';
import { Shield, Search, CalendarDays, Clock, CheckCircle2, XCircle, AlertCircle, Users, ClipboardList } from 'lucide-react';

/* ── Estilos (mismo sistema de variables que App.jsx) ─────────────────────── */
const PanelStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    .admin-panel * { box-sizing: border-box; font-family: 'Plus Jakarta Sans', sans-serif; }

    @keyframes adminFadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    .admin-fade { animation: adminFadeUp .4s cubic-bezier(.22,1,.36,1) both; }
    .a1 { animation-delay:.04s; } .a2 { animation-delay:.09s; }
    .a3 { animation-delay:.14s; } .a4 { animation-delay:.19s; }

    .admin-input {
      width: 100%;
      padding: 10px 12px;
      border: 1.5px solid var(--border);
      border-radius: var(--radius);
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      background: var(--bg);
      outline: none;
      transition: border-color .18s;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .admin-input:focus { border-color: var(--teal); }

    .admin-btn {
      border: none; border-radius: var(--radius);
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-weight: 700; cursor: pointer;
      transition: filter .18s, transform .13s;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .admin-btn:active { transform: scale(.97); }
    .admin-btn:hover  { filter: brightness(.92); }

    .admin-card {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      padding: 1.5rem;
    }

    .admin-table-row {
      display: grid;
      gap: 1rem;
      align-items: center;
      padding: 12px 14px;
      transition: background .15s;
    }
    .admin-table-row:hover { background: var(--bg); }

    .admin-scroll::-webkit-scrollbar { width: 4px; }
    .admin-scroll::-webkit-scrollbar-track { background: var(--bg); }
    .admin-scroll::-webkit-scrollbar-thumb { background: var(--border-md); border-radius: 2px; }

    @media (max-width: 767px) {
      .admin-header-actions { flex-direction: column; align-items: stretch !important; }
      .admin-filters-row    { flex-direction: column !important; }
    }
  `}</style>
);

/* ── Badge de estado ──────────────────────────────────────────────────────── */
const ReservaBadge = ({ estado }) => {
  const map = {
    PRESENTADO: { label: 'Confirmado',   bg: 'var(--teal-lt)',  color: 'var(--teal-dk)', Icon: CheckCircle2 },
    AUSENTE:    { label: 'Inasistencia', bg: 'var(--red-lt)',   color: 'var(--red)',     Icon: XCircle },
    PENDIENTE:  { label: 'Pendiente',    bg: 'var(--amber-lt)', color: 'var(--amber)',   Icon: AlertCircle },
  };
  const { label, bg, color, Icon } = map[estado] ?? map.PENDIENTE;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: bg, color, borderRadius: '6px',
      fontSize: '11px', fontWeight: 700, padding: '3px 10px',
      letterSpacing: '.02em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      <Icon size={11} strokeWidth={2.5} />
      {label}
    </span>
  );
};

/* ── Fila de reserva reutilizable ─────────────────────────────────────────── */
const ReservaRow = ({ r }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--radius)',
    border: '1px solid var(--border)', gap: '12px', flexWrap: 'wrap',
  }}>
    <div>
      <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
        {r.usuario.nombre} {r.usuario.apellido}
      </p>
      <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--teal-dk)', marginTop: '2px', marginBottom: 0 }}>
        {r.parrilla.quincho.nombre} · {r.turno === 'DIA' ? 'Almuerzo' : 'Cena'}
      </p>
    </div>
    <ReservaBadge estado={r.estado} />
  </div>
);

/* ── AdminPanel ───────────────────────────────────────────────────────────── */
const AdminPanel = ({ API_BASE_URL }) => {
  const [reservasHoy, setReservasHoy]               = useState([]);
  const [searchTerm, setSearchTerm]                 = useState('');
  const [fechaFiltro, setFechaFiltro]               = useState(new Date().toISOString().split('T')[0]);
  const [turnoFiltro, setTurnoFiltro]               = useState('NOCHE');
  const [reservasFiltradas, setReservasFiltradas]   = useState([]);
  const [usuarios, setUsuarios]                     = useState([]);
  const [usuariosFiltrados, setUsuariosFiltrados]   = useState([]);
  const [showUsuarios, setShowUsuarios]             = useState(false);
  const [buscado, setBuscado]                       = useState(false);

  const fetchReservasHoy = async () => {
    const hoy = new Date().toISOString().split('T')[0];
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/reservas?fecha=${hoy}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setReservasHoy(await res.json());
      else { console.error('Error fetching reservas:', res.status); setReservasHoy([]); }
    } catch (e) { console.error(e); setReservasHoy([]); }
  };

  useEffect(() => { fetchReservasHoy(); }, []);

  const handleFilterUsers = () => {
    if (!searchTerm) { setUsuariosFiltrados(usuarios); return; }
    setUsuariosFiltrados(usuarios.filter(u =>
      u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.dni && u.dni.includes(searchTerm))
    ));
  };

  useEffect(() => { if (showUsuarios) handleFilterUsers(); }, [searchTerm, usuarios, showUsuarios]);

  const fetchReservasFiltradas = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/reservas?fecha=${fechaFiltro}&turno=${turnoFiltro}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setReservasFiltradas(await res.json());
      else { console.error('Error:', res.status); setReservasFiltradas([]); }
    } catch (e) { console.error(e); setReservasFiltradas([]); }
    setBuscado(true);
  };

  const fetchUsuarios = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/usuarios`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) { const d = await res.json(); setUsuarios(d); setUsuariosFiltrados(d); }
      else { console.error('Error:', res.status); setUsuarios([]); }
    } catch (e) { console.error(e); setUsuarios([]); }
  };

  const toggleSuspension = async (userId, currentlySuspended) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/usuarios/${userId}/suspension`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended: !currentlySuspended }),
      });
      if (res.ok) {
        if (showUsuarios) fetchUsuarios();
        const loggedUser = JSON.parse(localStorage.getItem('usuario') || '{}');
        if (loggedUser.id === userId) {
          loggedUser.suspendido = !currentlySuspended;
          localStorage.setItem('usuario', JSON.stringify(loggedUser));
        }
        alert(currentlySuspended ? 'Suspensión levantada.' : 'Usuario suspendido.');
      } else {
        const data = await res.json();
        alert(data.error || 'Error al cambiar el estado.');
      }
    } catch (e) { console.error(e); alert('Error al conectar.'); }
  };

  const SectionLabel = ({ icon: Icon, text }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '1rem' }}>
      <Icon size={15} style={{ color: 'var(--teal)', flexShrink: 0 }} />
      <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '.05em', margin: 0 }}>
        {text}
      </p>
    </div>
  );

  return (
    <>
      <PanelStyles />
      <div className="admin-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ── HEADER ────────────────────────────────────────────────── */}
        <div className="admin-fade a1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,.15)',
            }}>
              <Shield size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>
                Panel de Control
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-sm)', fontWeight: 500, marginTop: '1px', marginBottom: 0 }}>
                Administración · Alcaraz
              </p>
            </div>
          </div>

          <div className="admin-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="text"
              placeholder="Buscar usuario..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); handleFilterUsers(); }}
              className="admin-input"
              style={{ width: '200px' }}
            />
            <button
              onClick={handleFilterUsers}
              className="admin-btn"
              style={{ background: 'var(--bg)', border: '1.5px solid var(--border-md)', color: 'var(--text-md)', padding: '9px 12px' }}
            >
              <Search size={15} />
            </button>
            <button
              onClick={() => { setShowUsuarios(!showUsuarios); if (!showUsuarios) fetchUsuarios(); }}
              className="admin-btn"
              style={{
                background: showUsuarios ? 'var(--text)' : 'var(--bg)',
                color: showUsuarios ? '#fff' : 'var(--text-md)',
                border: showUsuarios ? 'none' : '1.5px solid var(--border-md)',
                padding: '9px 18px', fontSize: '13px',
              }}
            >
              <Users size={15} />
              {showUsuarios ? 'Ocultar' : 'Listar usuarios'}
            </button>
          </div>
        </div>

        {/* ── LISTA DE USUARIOS ─────────────────────────────────────── */}
        {showUsuarios && (
          <div className="admin-card admin-fade a2">
            <SectionLabel icon={Users} text="Lista de Usuarios" />

            {/* Cabecera tabla */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.6fr 1.8fr .9fr .9fr .6fr .7fr',
              gap: '1rem', padding: '6px 14px 10px',
              borderBottom: '1px solid var(--border)', marginBottom: '4px',
            }}>
              {['Nombre', 'Email', 'DNI', 'Teléfono', 'Rol', ''].map((h, i) => (
                <div key={i} style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '.05em', textAlign: i === 5 ? 'right' : 'left' }}>
                  {h}
                </div>
              ))}
            </div>

            <div className="admin-scroll" style={{ maxHeight: '340px', overflowY: 'auto' }}>
              {usuariosFiltrados.length > 0 ? usuariosFiltrados.map((u, idx) => (
                <div
                  key={u.id}
                  className="admin-table-row"
                  style={{
                    gridTemplateColumns: '1.6fr 1.8fr .9fr .9fr .6fr .7fr',
                    borderBottom: idx < usuariosFiltrados.length - 1 ? '1px solid var(--border)' : 'none',
                    borderRadius: 0,
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.nombre} {u.apellido}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-md)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.email || '—'}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-md)' }}>{u.dni || '—'}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-md)' }}>{u.telefono || '—'}</div>
                  <div>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '6px',
                      background: u.role === 'ADMIN' ? 'var(--amber-lt)' : 'var(--bg)',
                      color: u.role === 'ADMIN' ? 'var(--amber)' : 'var(--slate)',
                      textTransform: 'uppercase', letterSpacing: '.03em',
                    }}>
                      {u.role === 'ADMIN' ? 'Admin' : 'User'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => toggleSuspension(u.id, u.suspendido)}
                      className="admin-btn"
                      style={{
                        fontSize: '11px', padding: '4px 12px', borderRadius: '6px',
                        background: u.suspendido ? 'var(--teal-lt)' : 'var(--red-lt)',
                        color: u.suspendido ? 'var(--teal-dk)' : 'var(--red)',
                      }}
                    >
                      {u.suspendido ? 'Levantar' : 'Suspender'}
                    </button>
                  </div>
                </div>
              )) : (
                <p style={{ textAlign: 'center', padding: '2.5rem', fontSize: '13px', fontWeight: 600, color: 'var(--text-sm)', margin: 0 }}>
                  No se encontraron usuarios.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── BUSCAR RESERVAS ───────────────────────────────────────── */}
        <div className="admin-card admin-fade a3">
          <SectionLabel icon={Search} text="Buscar Reservas por Fecha y Turno" />

          <div className="admin-filters-row" style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '7px' }}>
                <CalendarDays size={12} /> Fecha
              </label>
              <input
                type="date"
                value={fechaFiltro}
                onChange={(e) => setFechaFiltro(e.target.value)}
                className="admin-input"
              />
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '7px' }}>
                <Clock size={12} /> Turno
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['DIA', 'NOCHE'].map(t => (
                  <button
                    key={t}
                    onClick={() => setTurnoFiltro(t)}
                    style={{
                      flex: 1, padding: '10px 6px', borderRadius: 'var(--radius)',
                      border: turnoFiltro === t ? '1.5px solid var(--teal)' : '1.5px solid var(--border)',
                      background: turnoFiltro === t ? 'var(--teal-lt)' : 'var(--bg)',
                      color: turnoFiltro === t ? 'var(--teal-dk)' : 'var(--text-sm)',
                      fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all .18s',
                    }}
                  >
                    {t === 'DIA' ? 'Almuerzo' : 'Cena'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={fetchReservasFiltradas}
              className="admin-btn"
              style={{ background: 'var(--teal)', color: '#fff', padding: '11px 24px', fontSize: '14px', flexShrink: 0 }}
            >
              Buscar
            </button>
          </div>

          {buscado && (
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
              {reservasFiltradas.length > 0 ? (
                <>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '12px', margin: '0 0 12px' }}>
                    {reservasFiltradas.length} reserva{reservasFiltradas.length !== 1 ? 's' : ''} encontrada{reservasFiltradas.length !== 1 ? 's' : ''}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {reservasFiltradas.map(r => <ReservaRow key={r.id} r={r} />)}
                  </div>
                </>
              ) : (
                <p style={{ textAlign: 'center', padding: '2rem', fontSize: '13px', fontWeight: 600, color: 'var(--text-sm)', margin: 0 }}>
                  No hay reservas para esa fecha y turno.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── RESERVAS DE HOY ───────────────────────────────────────── */}
        <div className="admin-card admin-fade a4">
          <SectionLabel icon={ClipboardList} text="Reservas de Hoy" />

          {reservasHoy.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {reservasHoy.map(r => <ReservaRow key={r.id} r={r} />)}
            </div>
          ) : (
            <p style={{ textAlign: 'center', padding: '2.5rem', fontSize: '13px', fontWeight: 600, color: 'var(--text-sm)', margin: 0 }}>
              No hay reservas registradas para hoy.
            </p>
          )}
        </div>

      </div>
    </>
  );
};

export default AdminPanel;