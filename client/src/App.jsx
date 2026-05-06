import React, { useState, useEffect, useRef } from 'react';
import { ScanQrCode, User, Loader2, MapPin, LogOut, Settings, CalendarDays, Clock, CheckCircle2, XCircle, Circle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import QrCode from 'react-qr-code';
import AuthModal from './components/AuthModal';
import AdminPanel from './components/AdminPanel';

/* ── Estilos globales ─────────────────────────────────────────────────────── */
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    *, *::before, *::after { box-sizing: border-box; }

    :root {
      --white:     #ffffff;
      --bg:        #f4f6f8;
      --surface:   #ffffff;
      --border:    #e2e6ea;
      --border-md: #cdd3da;
      --text:      #1a202c;
      --text-md:   #4a5568;
      --text-sm:   #718096;
      --teal:      #0d9488;
      --teal-lt:   #ccfbf1;
      --teal-dk:   #0a7c72;
      --amber:     #d97706;
      --amber-lt:  #fef3c7;
      --red:       #dc2626;
      --red-lt:    #fee2e2;
      --slate:     #64748b;
      --shadow-sm: 0 1px 3px rgba(0,0,0,.07), 0 1px 2px rgba(0,0,0,.05);
      --shadow-md: 0 4px 12px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.05);
      --shadow-lg: 0 10px 30px rgba(0,0,0,.1), 0 4px 8px rgba(0,0,0,.06);
      --radius:    10px;
      --radius-lg: 16px;
    }

    body { background: var(--bg); color: var(--text); font-family: 'Plus Jakarta Sans', sans-serif; }

    @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    @keyframes spin   { to { transform: rotate(360deg); } }

    .fade-up { animation: fadeUp .45s cubic-bezier(.22,1,.36,1) both; }
    .s1 { animation-delay:.05s; } .s2 { animation-delay:.1s; }
    .s3 { animation-delay:.15s; }

    input[type="date"] { color-scheme: light; }
    input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: .6; }

    .quincho-card {
      transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s ease;
      cursor: pointer;
    }
    .quincho-card:hover:not(.occupied) {
      transform: translateY(-3px);
      box-shadow: var(--shadow-lg);
    }
    .quincho-card.occupied { cursor: default; }

    .btn-primary {
      background: var(--teal); color: #fff;
      border: none; border-radius: var(--radius);
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-weight: 700; font-size: 14px;
      cursor: pointer;
      transition: background .18s, transform .15s, box-shadow .18s;
    }
    .btn-primary:hover:not(:disabled) {
      background: var(--teal-dk);
      box-shadow: 0 4px 16px rgba(13,148,136,.28);
    }
    .btn-primary:active:not(:disabled) { transform: scale(.98); }
    .btn-primary:disabled {
      background: var(--border-md); color: var(--text-sm); cursor: not-allowed;
    }

    .nav-pill {
      border-radius: 50px;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-weight: 600; font-size: 13px; cursor: pointer;
      display: flex; align-items: center; gap: 6px;
      transition: filter .18s, transform .13s;
    }
    .nav-pill:active { transform: scale(.96); }
    .nav-pill:hover  { filter: brightness(.93); }

    /* Responsive */
    @media (min-width: 1024px) {
      .main-layout   { flex-direction: row !important; }
      .desktop-show  { display: flex !important; }
      .mobile-only   { display: none !important; }
    }
    @media (max-width: 1023px) {
      .desktop-show  { display: none !important; }
    }
    @media (min-width: 768px) {
      .grid-quinchos { grid-template-columns: repeat(3, 1fr) !important; }
    }
  `}</style>
);

/* ── Badge de estado ──────────────────────────────────────────────────────── */
const StatusBadge = ({ isMyReservation, isOccupied, estado }) => {
  let label, bg, color, Icon;
  if (isMyReservation) {
    if (estado === 'PRESENTADO')   { label = 'Disfrutando'; bg = 'var(--teal-lt)';  color = 'var(--teal-dk)'; Icon = CheckCircle2; }
    else if (estado === 'AUSENTE') { label = 'Ausente';     bg = 'var(--red-lt)';   color = 'var(--red)';     Icon = XCircle; }
    else                           { label = 'Tu reserva';  bg = 'var(--amber-lt)'; color = 'var(--amber)';   Icon = CheckCircle2; }
  } else if (isOccupied) {
    label = 'Ocupado'; bg = '#f1f5f9'; color = 'var(--slate)'; Icon = XCircle;
  } else {
    label = 'Disponible'; bg = 'var(--teal-lt)'; color = 'var(--teal-dk)'; Icon = Circle;
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: bg, color, borderRadius: '6px',
      fontSize: '11px', fontWeight: 700, padding: '3px 9px',
      letterSpacing: '.02em', textTransform: 'uppercase',
    }}>
      <Icon size={11} strokeWidth={2.5} />
      {label}
    </span>
  );
};

/* ── App ──────────────────────────────────────────────────────────────────── */
const App = () => {
  const API_BASE_URL = 'http://localhost:3001';
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [quinchos, setQuinchos]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedParrilla, setSelectedParrilla] = useState(null);
  const [error, setError]               = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen]   = useState(false);
  const [isScannerOpen, setIsScannerOpen]       = useState(false);
  const [scanError, setScanError]       = useState(null);
  const [showQrFor, setShowQrFor]       = useState(null);
  const [user, setUser]                 = useState(null);
  const [turno, setTurno]               = useState('NOCHE');
  const [view, setView]                 = useState('MAPA');
  const scannerRef = useRef(null);

  useEffect(() => {
    const fetchEstado = async () => {
      setLoading(true); setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/estado-quinchos?fecha=${selectedDate}&turno=${turno}`);
        if (!response.ok) throw new Error("Error en la respuesta del servidor");
        setQuinchos(await response.json());
      } catch { setError("No se pudo conectar con el servidor."); }
      finally { setLoading(false); }
    };
    fetchEstado();
  }, [selectedDate, turno]);

  const handleLoginSuccess = (userData) => { setUser(userData); setIsAuthModalOpen(false); };

  const handleCancelar = async (reservaId) => {
    if (!window.confirm("¿Seguro que quieres cancelar tu reserva?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/reservas/${reservaId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        alert("Reserva cancelada.");
        const r = await fetch(`${API_BASE_URL}/api/estado-quinchos?fecha=${selectedDate}&turno=${turno}`);
        setQuinchos(await r.json());
      } else { alert(data.error); }
    } catch { alert("Error al conectar con el servidor."); }
  };

  const handleReserva = async () => {
    if (!selectedParrilla) return;
    if (!user) { setIsAuthModalOpen(true); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: selectedDate, usuarioId: user.id, quinchoId: selectedParrilla.qId, turno }),
      });
      if (res.ok) {
        alert(`¡Reserva confirmada! ${selectedParrilla.qNom}`);
        setSelectedParrilla(null);
        const r = await fetch(`${API_BASE_URL}/api/estado-quinchos?fecha=${selectedDate}&turno=${turno}`);
        setQuinchos(await r.json());
      } else { const d = await res.json(); alert(d.error); }
    } catch { alert("Error al procesar la reserva"); }
  };

  const cleanupScanner = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => null);
        await scannerRef.current.clear().catch(() => null);
        scannerRef.current = null;
      }
      const el = document.getElementById('qr-reader');
      if (el) el.innerHTML = '';
    } catch (e) { console.warn('Error limpiando scanner:', e); }
  };

  const processCheckin = async (quinchoId) => {
    if (!user) { alert("Debés iniciar sesión para confirmar asistencia."); setIsScannerOpen(false); return; }
    if (!navigator.geolocation) { alert("Tu dispositivo no admite geolocalización."); return; }
    setScanError(null);
    const ahora = new Date();
    const horaArg = new Date(ahora.getTime() - 3 * 60 * 60 * 1000).getUTCHours();
    const turnoAuto = (horaArg >= 11 && horaArg < 14) ? 'DIA' : 'NOCHE';
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 })
      );
      const { latitude: lat, longitude: lon } = pos.coords;

      const fechaCheckin = new Date(ahora.getTime() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await fetch(`${API_BASE_URL}/api/reservas/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId: user.id, quinchoId, fecha: fechaCheckin, turno: turnoAuto, lat, lon }),
      });
      const data = await response.json();
      if (response.ok) alert(data.message);
      else alert(data.error || 'No se pudo confirmar asistencia.');
    } catch (err) { setScanError(err.message || 'No se pudo obtener la ubicación.'); }
    finally {
      setIsScannerOpen(false);
      await cleanupScanner();
      setTimeout(async () => {
        try {
          const r = await fetch(`${API_BASE_URL}/api/estado-quinchos?fecha=${selectedDate}&turno=${turno}`);
          if (r.ok) setQuinchos(await r.json());
        } catch {}
      }, 1000);
    }
  };

  useEffect(() => {
    if (!isScannerOpen) return;
    let active = true;
    const html5Qrcode = new Html5Qrcode('qr-reader');
    scannerRef.current = html5Qrcode;
    const onScanSuccess = async (decodedText) => {
      if (!active) return; active = false;
      try {
        const payload = JSON.parse(decodedText);
        if (payload?.type === 'quincho-checkin' && payload?.quinchoId) {
          try { await html5Qrcode.stop(); await html5Qrcode.clear(); } catch {}
          setIsScannerOpen(false);
          await processCheckin(payload.quinchoId);
        } else { setScanError('QR no reconocido. Usá el QR oficial del quincho.'); active = true; }
      } catch { setScanError('QR inválido. Intenta de nuevo.'); active = true; }
    };
    Html5Qrcode.getCameras()
      .then((cameras) => {
        const cam = cameras?.find(c => c.label.toLowerCase().includes('back'))?.id || cameras?.[0]?.id;
        if (!cam) throw new Error('No se encontró cámara');
        return html5Qrcode.start(cam, { fps: 10, qrbox: 250 }, onScanSuccess, () => {});
      })
      .catch(err => setScanError(`No se pudo iniciar la cámara: ${err.message}`));
    return () => { active = false; cleanupScanner().catch(() => null); };
  }, [isScannerOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    const userGuardado = localStorage.getItem('usuario');
    if (token && userGuardado) setUser(JSON.parse(userGuardado));
  }, []);

  const handleLogout = () => {
    setUser(null); setView('MAPA');
    if (typeof window !== 'undefined') { localStorage.removeItem('token'); localStorage.removeItem('usuario'); }
  };

  const disponibles = quinchos.filter(q => !q.parrillas[0]?.reservas[0]).length;
  const ocupados    = quinchos.filter(q =>  q.parrillas[0]?.reservas[0]).length;

  return (
    <>
      <GlobalStyles />
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* ── NAVBAR ─────────────────────────────────────────────────────── */}
        <nav style={{
          background: 'var(--white)', borderBottom: '1px solid var(--border)',
          padding: '0 1.5rem', height: '62px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50,
          boxShadow: '0 1px 4px rgba(0,0,0,.06)',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(13,148,136,.3)',
            }}>
              <MapPin size={18} color="#fff" />
            </div>
            <div>
              <span style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.01em' }}>
                Parris Alca
              </span>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-sm)', marginLeft: '6px' }}>
                Quinchos
              </span>
            </div>
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {user?.role === 'ADMIN' && (
              <button
                onClick={() => setView(view === 'MAPA' ? 'ADMIN' : 'MAPA')}
                className="nav-pill"
                title={view === 'MAPA' ? 'Panel Admin' : 'Ver Mapa'}
                style={{ background: 'var(--amber-lt)', color: 'var(--amber)', border: 'none', padding: '8px 16px' }}
              >
                <Settings size={15} />
                <span className="desktop-show" style={{ display: 'none' }}>
                  {view === 'MAPA' ? 'Panel Admin' : 'Ver Mapa'}
                </span>
              </button>
            )}

            <button
              onClick={() => setIsScannerOpen(true)}
              className="nav-pill"
              style={{ background: 'var(--teal)', color: '#fff', border: 'none', padding: '8px 18px' }}
            >
              <ScanQrCode size={15} />
              <span className="desktop-show" style={{ display: 'none' }}>Escanear QR</span>
            </button>

            <button
              onClick={() => !user && setIsAuthModalOpen(true)}
              className="nav-pill"
              style={{
                background: user ? 'var(--bg)' : 'var(--text)',
                color: user ? 'var(--text-md)' : '#fff',
                border: user ? '1.5px solid var(--border-md)' : 'none',
                padding: '8px 16px',
                cursor: user ? 'default' : 'pointer',
              }}
            >
              <User size={15} />
              <span className="desktop-show" style={{ display: 'none' }}>
                {user ? user.nombre : 'Ingresar'}
              </span>
            </button>

            {user && (
              <button
                onClick={handleLogout}
                title="Cerrar sesión"
                className="nav-pill"
                style={{ background: 'var(--red-lt)', color: 'var(--red)', border: 'none', padding: '8px 10px' }}
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </nav>

        {/* ── MAIN ───────────────────────────────────────────────────────── */}
        <main style={{ maxWidth: '1600px', margin: '0 auto', padding: '2rem 1.5rem' }}>
          {view === 'ADMIN' ? (
            <AdminPanel API_BASE_URL={API_BASE_URL} />
          ) : (
            <div className="main-layout" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* ── SIDEBAR ────────────────────────────────────────────── */}
              <div style={{ flex: '0 0 288px' }} className="fade-up s1">
                <div style={{
                  background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
                  padding: '1.75rem', position: 'sticky', top: '78px',
                }}>
                  <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', marginBottom: '1.5rem' }}>
                    Nueva Reserva
                  </h2>

                  {/* Fecha */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      fontSize: '11px', fontWeight: 700, color: 'var(--text-sm)',
                      textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '7px',
                    }}>
                      <CalendarDays size={12} /> Fecha
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => { setSelectedDate(e.target.value); setSelectedParrilla(null); }}
                      style={{
                        width: '100%', padding: '10px 12px',
                        border: '1.5px solid var(--border)', borderRadius: 'var(--radius)',
                        fontSize: '14px', fontWeight: 600, color: 'var(--text)',
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        outline: 'none', background: 'var(--bg)',
                        transition: 'border-color .18s',
                      }}
                      onFocus={e => e.target.style.borderColor = 'var(--teal)'}
                      onBlur={e  => e.target.style.borderColor = 'var(--border)'}
                    />
                  </div>

                  {/* Turno */}
                  <div style={{ marginBottom: '1.75rem' }}>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      fontSize: '11px', fontWeight: 700, color: 'var(--text-sm)',
                      textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '7px',
                    }}>
                      <Clock size={12} /> Turno
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {['DIA', 'NOCHE'].map(t => (
                        <button
                          key={t}
                          onClick={() => setTurno(t)}
                          style={{
                            flex: 1, padding: '10px 6px', borderRadius: 'var(--radius)',
                            border: turno === t ? '1.5px solid var(--teal)' : '1.5px solid var(--border)',
                            background: turno === t ? 'var(--teal-lt)' : 'var(--bg)',
                            color: turno === t ? 'var(--teal-dk)' : 'var(--text-sm)',
                            fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                            transition: 'all .18s',
                          }}
                        >
                          {t === 'DIA' ? 'Almuerzo' : 'Cena'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selección */}
                  <div style={{
                    background: selectedParrilla ? 'var(--teal-lt)' : 'var(--bg)',
                    borderRadius: 'var(--radius)', padding: '14px 16px',
                    border: `1.5px solid ${selectedParrilla ? 'rgba(13,148,136,.3)' : 'var(--border)'}`,
                    marginBottom: '1.25rem', transition: 'all .25s', minHeight: '72px',
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '5px', color: selectedParrilla ? 'var(--teal-dk)' : 'var(--text-sm)' }}>
                      Selección
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: selectedParrilla ? 'var(--teal-dk)' : 'var(--text-sm)' }}>
                      {selectedParrilla ? selectedParrilla.qNom : 'Elegí un quincho del mapa'}
                    </div>
                  </div>

                  <button
                    onClick={handleReserva}
                    disabled={!selectedParrilla || loading}
                    className="btn-primary"
                    style={{ width: '100%', padding: '13px' }}
                  >
                    Confirmar Reserva
                  </button>

                  {/* Leyenda */}
                  <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px' }}>
                      Referencias
                    </p>
                    {[
                      { dot: 'var(--teal)',  bg: 'var(--teal-lt)',  label: 'Disponible' },
                      { dot: 'var(--amber)', bg: 'var(--amber-lt)', label: 'Tu reserva' },
                      { dot: 'var(--slate)', bg: '#f1f5f9',         label: 'Ocupado'    },
                    ].map(({ dot, bg, label }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: bg, border: `1.5px solid ${dot}`, flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-md)' }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── MAPA ──────────────────────────────────────────────── */}
              <div style={{ flex: 1, minWidth: 0 }}>

                {/* Cabecera */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '1.25rem' }} className="fade-up s2">
                  <div>
                    <h1 style={{ fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.02em', lineHeight: 1.2 }}>
                      Plano de Quinchos
                    </h1>
                    <p style={{ fontSize: '13px', color: 'var(--text-sm)', fontWeight: 500, marginTop: '2px' }}>
                      {turno === 'DIA' ? 'Almuerzo' : 'Cena'} · {selectedDate}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ background: 'var(--teal-lt)', color: 'var(--teal-dk)', borderRadius: '50px', padding: '5px 14px', fontSize: '12px', fontWeight: 700 }}>
                      {disponibles} disponibles
                    </span>
                    <span style={{ background: '#f1f5f9', color: 'var(--slate)', borderRadius: '50px', padding: '5px 14px', fontSize: '12px', fontWeight: 700 }}>
                      {ocupados} ocupados
                    </span>
                  </div>
                </div>

                {/* Mapa */}
                <div
                  className="fade-up s3"
                  style={{
                    background: '#e8efe9',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid #d4dfd5',
                    boxShadow: 'inset 0 2px 8px rgba(0,0,0,.04)',
                    padding: 'clamp(1.25rem, 3vw, 2.5rem)',
                    minHeight: '460px', position: 'relative', overflow: 'hidden',
                  }}
                >
                  {/* Vía del tren — desktop (arriba) */}
                  <div style={{
                    position: 'absolute', top: '1.5rem', left: 0, right: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    opacity: .2, pointerEvents: 'none', zIndex: 0,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '90%', height: '2px', background: '#4a5568' }}>
                      {[...Array(26)].map((_, i) => (
                        <div key={i} style={{ width: '1px', height: '10px', background: '#4a5568', transform: 'translateY(-4px)' }} />
                      ))}
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.3em', color: '#4a5568', marginTop: '5px', textTransform: 'uppercase' }}>
                      Vías del Ferrocarril
                    </span>
                  </div>

                  {/* Vía — mobile (lateral derecha) */}
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, right: '0.75rem',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', opacity: .18, pointerEvents: 'none', zIndex: 0,
                  }}
                    className="mobile-only"
                  >
                    <div style={{ width: '1px', height: '85%', background: '#4a5568', position: 'relative' }}>
                      {[...Array(16)].map((_, i) => (
                        <div key={i} style={{ position: 'absolute', top: `${(i / 15) * 100}%`, left: '-5px', width: '11px', height: '1px', background: '#4a5568' }} />
                      ))}
                    </div>
                  </div>

                  {/* Contenido */}
                  <div style={{ position: 'relative', zIndex: 1, paddingTop: '2.5rem' }}>
                    {loading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '14px' }}>
                        <div style={{ width: '38px', height: '38px', border: '3px solid var(--teal-lt)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-sm)' }}>Cargando quinchos...</p>
                      </div>
                    ) : error ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '14px' }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--red)' }}>{error}</p>
                        <button onClick={() => window.location.reload()} className="btn-primary" style={{ padding: '9px 20px' }}>
                          Reintentar
                        </button>
                      </div>
                    ) : (
                      <div
                        className="grid-quinchos"
                        style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}
                      >
                        {quinchos.map((q, idx) => {
                          const reservaEnQuincho = q.parrillas[0]?.reservas[0];
                          const isOccupied       = !!reservaEnQuincho;
                          const isMyReservation  = user && reservaEnQuincho?.usuarioId === user.id;
                          const isSelected       = selectedParrilla?.qId === q.id;

                          let borderColor = 'var(--border)';
                          let bgCard      = 'var(--white)';
                          let topBar      = 'var(--teal)';
                          let shadow      = 'var(--shadow-sm)';

                          if (isMyReservation) {
                            bgCard = 'var(--teal-lt)'; borderColor = 'rgba(13,148,136,.4)'; topBar = 'var(--teal-dk)'; shadow = 'var(--shadow-md)';
                          } else if (isSelected) {
                            borderColor = 'var(--teal)'; shadow = '0 0 0 3px rgba(13,148,136,.15), var(--shadow-md)';
                          } else if (isOccupied) {
                            bgCard = '#f8fafc'; topBar = '#cbd5e1';
                          }

                          return (
                            <div
                              key={q.id}
                              className={`quincho-card fade-up${isOccupied && !isMyReservation ? ' occupied' : ''}`}
                              style={{ animationDelay: `${idx * .07 + .2}s`, opacity: 0, animationFillMode: 'forwards' }}
                              onClick={() => !isOccupied && setSelectedParrilla({ qId: q.id, qNom: q.nombre })}
                            >
                              <div style={{
                                background: bgCard,
                                border: `1.5px solid ${borderColor}`,
                                borderRadius: 'var(--radius-lg)',
                                boxShadow: shadow,
                                overflow: 'hidden',
                                transition: 'border-color .2s, box-shadow .2s',
                                opacity: isOccupied && !isMyReservation ? .6 : 1,
                              }}>
                                <div style={{ height: '4px', background: topBar }} />
                                <div style={{ padding: '1rem 1.25rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <StatusBadge isMyReservation={isMyReservation} isOccupied={isOccupied} estado={reservaEnQuincho?.estado} />
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-sm)', background: 'rgba(0,0,0,.05)', borderRadius: '6px', padding: '2px 8px' }}>
                                      #{String(q.numero).padStart(2, '0')}
                                    </span>
                                  </div>
                                  <h3 style={{ fontSize: 'clamp(15px, 2vw, 18px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.01em' }}>
                                    {q.nombre}
                                  </h3>
                                  {isMyReservation && reservaEnQuincho?.estado !== 'PRESENTADO' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleCancelar(reservaEnQuincho.id); }}
                                      style={{
                                        marginTop: '10px', background: 'none', border: 'none',
                                        color: 'var(--red)', fontFamily: "'Plus Jakarta Sans', sans-serif",
                                        fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0,
                                        textDecoration: 'underline',
                                      }}
                                    >
                                      Cancelar reserva
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ── MODAL SCANNER ─────────────────────────────────────────────── */}
        {isScannerOpen && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}>
            <div style={{
              background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
              width: '100%', maxWidth: '480px', padding: '1.75rem',
              animation: 'fadeUp .35s cubic-bezier(.22,1,.36,1)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>Check-in con QR</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-sm)', marginTop: '3px' }}>Apuntá la cámara al QR del quincho</p>
                </div>
                <button
                  onClick={async () => { await cleanupScanner(); setIsScannerOpen(false); }}
                  style={{
                    background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: '8px',
                    padding: '6px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                    color: 'var(--text-md)', fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  Cerrar
                </button>
              </div>

              <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1.5px solid var(--border)' }}>
                <div id="qr-reader" style={{ width: '100%', height: '300px', background: '#000' }} />
              </div>

              {scanError && (
                <div style={{ marginTop: '12px', background: 'var(--red-lt)', borderRadius: '8px', padding: '10px 14px', border: '1px solid rgba(220,38,38,.2)' }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--red)' }}>{scanError}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── AUTH MODAL ────────────────────────────────────────────────── */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    </>
  );
};

export default App;