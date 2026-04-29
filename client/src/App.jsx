import React, { useState, useEffect, useRef } from 'react';
import { ScanQrCode, User, Loader2, MapPin, LogOut, Settings } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import QrCode from 'react-qr-code';
import AuthModal from './components/AuthModal';
import AdminPanel from './components/AdminPanel';

const App = () => {
  const API_BASE_URL = 'http://localhost:3001';
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [quinchos, setQuinchos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedParrilla, setSelectedParrilla] = useState(null);
  const [error, setError] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [showQrFor, setShowQrFor] = useState(null);
  const [user, setUser] = useState(null);
  const [turno, setTurno] = useState('NOCHE');
  const [view, setView] = useState('MAPA');

  useEffect(() => {
    const fetchEstado = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/estado-quinchos?fecha=${selectedDate}&turno=${turno}`);
        if (!response.ok) throw new Error("Error en la respuesta del servidor");
        const data = await response.json();
        setQuinchos(data);
      } catch (error) {
        setError("No se pudo conectar con el servidor.");
      } finally {
        setLoading(false);
      }
    };
    fetchEstado();
  }, [selectedDate, turno]);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsAuthModalOpen(false);
  };

  const handleCancelar = async (reservaId) => {
    if (!window.confirm("¿Seguro que quieres cancelar tu reserva?")) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/reservas/${reservaId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (response.ok) {
        alert("Reserva cancelada.");
        // Refrescar datos
        const resRefresh = await fetch(`${API_BASE_URL}/api/estado-quinchos?fecha=${selectedDate}&turno=${turno}`);
        setQuinchos(await resRefresh.json());
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Error al conectar con el servidor.");
    }
  };

  const handleReserva = async () => {
    if (!selectedParrilla) return;
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: selectedDate,
          usuarioId: user.id,
          quinchoId: selectedParrilla.qId,
          turno
        }),
      });

      if (response.ok) {
        alert(`¡Reserva confirmada! ${selectedParrilla.qNom}`);
        setSelectedParrilla(null);
        const resRefresh = await fetch(`${API_BASE_URL}/api/estado-quinchos?fecha=${selectedDate}&turno=${turno}`);
        const dataRefresh = await resRefresh.json();
        setQuinchos(dataRefresh);
      } else {
        const data = await response.json();
        alert(data.error);
      }
    } catch (err) {
      alert("Error al procesar la reserva");
    }
  };

  const processCheckin = async (quinchoId) => {
    console.log('Iniciando processCheckin para quinchoId:', quinchoId);
    if (!user) {
      alert("Debés iniciar sesión para confirmar asistencia.");
      setIsScannerOpen(false);
      return;
    }

    if (!navigator.geolocation) {
      alert("Tu dispositivo no admite geolocalización.");
      return;
    }

    setScanError(null);

    try {
      console.log('Obteniendo geolocalización...');
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      });

      const { latitude: lat, longitude: lon } = position.coords;
      console.log('Geolocalización obtenida:', { lat, lon });
      
      console.log('Enviando petición de checkin...');
      const response = await fetch(`${API_BASE_URL}/api/reservas/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: user.id,
          quinchoId,
          fecha: selectedDate,
          turno,
          lat,
          lon,
        }),
      });

      const data = await response.json();
      console.log('Respuesta del checkin:', { ok: response.ok, data });
      
      if (response.ok) {
        alert(data.message);
      } else {
        alert(data.error || 'No se pudo confirmar asistencia.');
      }
    } catch (err) {
      console.error('Error en processCheckin:', err);
      setScanError(err.message || 'No se pudo obtener la ubicación.');
    } finally {
      console.log('Cerrando scanner...');
      setIsScannerOpen(false);
      try {
        if (scannerRef.current) {
          await scannerRef.current.stop();
          scannerRef.current = null;
        }
      } catch (scannerError) {
        console.error('Error stopping scanner:', scannerError);
      }
      
      // Delay the refresh to avoid conflicts
      setTimeout(async () => {
        try {
          console.log('Refrescando datos...');
          const resRefresh = await fetch(`${API_BASE_URL}/api/estado-quinchos?fecha=${selectedDate}&turno=${turno}`);
          if (resRefresh.ok) {
            const dataRefresh = await resRefresh.json();
            console.log('Datos refrescados exitosamente');
            setQuinchos(dataRefresh);
          } else {
            console.error('Error en respuesta de refresh:', resRefresh.status);
          }
        } catch (refreshError) {
          console.error('Error refreshing quinchos data:', refreshError);
        }
      }, 1000);
    }
  };

  useEffect(() => {
    if (!isScannerOpen) return;

    let active = true;
    const elementId = 'qr-reader';
    const html5Qrcode = new Html5Qrcode(elementId);
    scannerRef.current = html5Qrcode;

    const onScanSuccess = async (decodedText) => {
      if (!active) return;
      active = false;
      try {
        await html5Qrcode.stop();
      } catch (error) {
        console.warn('No se pudo detener el scanner:', error);
      }

      try {
        const payload = JSON.parse(decodedText);
        if (payload?.type === 'quincho-checkin' && payload?.quinchoId) {
          await processCheckin(payload.quinchoId);
        } else {
          setScanError('QR no reconocido. Usá el QR oficial del quincho.');
        }
      } catch (err) {
        setScanError('QR inválido. Intenta de nuevo.');
      }
    };

    const onScanError = () => {
      // Ignoramos errores de lectura momentánea
    };

    Html5Qrcode.getCameras()
      .then((cameras) => {
        const backCamera = cameras?.find((camera) => camera.label.toLowerCase().includes('back'))?.id || cameras?.[0]?.id;
        if (!backCamera) throw new Error('No se encontró cámara disponible');
        return html5Qrcode.start(backCamera, { fps: 10, qrbox: 250 }, onScanSuccess, onScanError);
      })
      .catch((err) => {
        setScanError(`No se pudo iniciar la cámara: ${err.message}`);
      });

    return () => {
      active = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => null);
        scannerRef.current.clear().catch(() => null);
        scannerRef.current = null;
      }
      const element = document.getElementById('qr-reader');
      if (element) element.innerHTML = '';
    };
  }, [isScannerOpen]);


  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tokenGuardado = localStorage.getItem('token');
    const userGuardado = localStorage.getItem('usuario');

    if (tokenGuardado && userGuardado) {
      setUser(JSON.parse(userGuardado));
    }
  }, []);


  const handleLogout = () => {
    setUser(null);
    setView('MAPA');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
    }
  }


  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans text-slate-900 transition-colors">
      {/* Navbar Minimalista */}
      <nav className="bg-white/80 backdrop-blur-md border-stone-200 px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-2 rounded-xl shadow-lg shadow-emerald-100">
            <MapPin className="text-white" size={20} />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-slate-800">
            PARRIS ALCA <span className="text-emerald-500">.</span>
          </h1>
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          {/* Botón de Panel Admin */}
          {user?.role === 'ADMIN' && (
            <button 
              onClick={() => setView(view === 'MAPA' ? 'ADMIN' : 'MAPA')}
              className="flex items-center justify-center gap-0 lg:gap-2 bg-amber-500 text-white p-2.5 lg:px-4 lg:py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-100 hover:bg-amber-400 transition-all"
              title={view === 'MAPA' ? 'Panel Admin' : 'Ver Mapa'}
            >
              <Settings size={18} />
              <span className="hidden lg:inline">
                {view === 'MAPA' ? 'Panel Admin' : 'Ver Mapa'}
              </span>
            </button>
          )}

          {/* Botón de QR */}
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center justify-center gap-0 lg:gap-2 bg-emerald-600 text-white p-2.5 lg:px-5 lg:py-2.5 rounded-full hover:bg-emerald-500 transition-all font-bold shadow-xl shadow-emerald-200"
            title="Escanear QR"
          >
            <ScanQrCode size={18} />
            <span className="hidden lg:inline text-sm">ESCANEAR QR</span>
          </button>
          
          {/* BOTÓN DE USUARIO / LOGOUT */}
          <div className="flex items-center gap-1 lg:gap-2">
            <button 
              onClick={() => !user && setIsAuthModalOpen(true)}
              className="flex items-center justify-center gap-0 lg:gap-2 bg-slate-900 text-white p-2.5 lg:px-6 lg:py-2.5 rounded-full hover:bg-slate-800 transition-all font-bold shadow-xl shadow-slate-200"
              title={user ? `Hola, ${user.nombre}` : 'Ingresar'}
            >
              <User size={18} />
              <span className="hidden lg:inline text-sm">{user ? `Hola, ${user.nombre}` : 'INGRESAR'}</span>
            </button>

            {/* Botón de Cerrar Sesión: Solo aparece si hay usuario */}
            {user && (
              <button 
                onClick={handleLogout}
                title="Cerrar Sesión"
                className="p-2.5 bg-rose-100 text-rose-600 rounded-full hover:bg-rose-200 transition-all shadow-md"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto p-6">
        {view === 'ADMIN' ? (
          /* VISTA DE ADMINISTRADOR */
          <AdminPanel API_BASE_URL={API_BASE_URL} />
        ) : (
          /* VISTA DEL MAPA (Lo que ya tenías) */
          <div className="flex flex-col lg:flex-row gap-8">
            
            {/* Panel de Control Lateral */}
            <div className="lg:w-3/12 space-y-6">
              <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-100 border border-stone-100">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 block">
                  1. Seleccionar Fecha
                </label>
                <input 
                  type="date" 
                  className="w-full p-4 bg-stone-50 border-2 border-stone-100 rounded-2xl focus:border-emerald-500 outline-none transition-all font-bold text-slate-700"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedParrilla(null);
                  }}
                />

                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-8 mb-4 block">
                  2. Elegir Turno
                </label>
                <div className="flex gap-2 p-1.5 bg-stone-100 rounded-2xl">
                  <button 
                    onClick={() => setTurno('DIA')}
                    className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${turno === 'DIA' ? 'bg-white shadow-md text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    ALMUERZO
                  </button>
                  <button 
                    onClick={() => setTurno('NOCHE')}
                    className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${turno === 'NOCHE' ? 'bg-white shadow-md text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    CENA
                  </button>
                </div>

                <div className="mt-10 p-6 rounded-2xl bg-emerald-50/50 border border-emerald-100/50">
                   <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block mb-2">Selección</span>
                   <p className="text-emerald-900 font-bold text-lg">
                    {selectedParrilla ? selectedParrilla.qNom : "Elegí un quincho"}
                   </p>
                </div>

                <button 
                  onClick={handleReserva}
                  disabled={!selectedParrilla || loading}
                  className={`w-full mt-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
                    selectedParrilla 
                    ? 'bg-emerald-600 text-white shadow-2xl shadow-emerald-200 hover:translate-y-[-2px] active:translate-y-[0px]' 
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  Confirmar Reserva
                </button>
              </div>
            </div>

            {/* El Mapa Interactivo */}
            <div className="lg:w-9/12">
              <div className="relative bg-[#e9f0e6] rounded-[2rem] lg:rounded-[3rem] p-4 md:p-12 h-full shadow-inner overflow-hidden border-4 lg:border-8 border-white">
                
                {/* Vía del Tren */}
                <div className="absolute top-6 left-0 w-full h-auto flex flex-col items-center lg:top-12 lg:flex-col max-lg:right-0 max-lg:left-auto max-lg:w-8 max-lg:h-full max-lg:top-0 max-lg:justify-center opacity-20 pointer-events-none z-0">
                    <div className="flex justify-between w-[90%] h-[2px] bg-slate-600 lg:w-full lg:flex-row max-lg:h-[90%] max-lg:w-[1px] max-lg:flex-col max-lg:px-0 max-lg:py-4">
                        {[...Array(25)].map((_, i) => (
                          <div key={i} className="bg-slate-600 w-[1px] h-3 -translate-y-1 max-lg:w-3 max-lg:h-[1px] max-lg:-translate-x-1"></div>
                        ))}
                    </div>
                    <span className="text-[9px] font-black tracking-[0.3em] text-slate-700 uppercase lg:mt-4 max-lg:rotate-90 max-lg:whitespace-nowrap max-lg:absolute max-lg:right-2">
                        Vías del Ferrocarril
                    </span>
                </div>

                {/* Contenido del Mapa */}
                <div className="relative z-10 max-lg:pr-10 max-lg:pl-2 h-full flex flex-col justify-center">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center flex-1 gap-4">
                      <Loader2 className="animate-spin text-emerald-600" size={48} />
                      <p className="text-slate-600 font-medium">Cargando quinchos...</p>
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center flex-1 gap-4">
                      <p className="text-red-600 font-medium">{error}</p>
                      <button 
                        onClick={() => window.location.reload()} 
                        className="bg-emerald-600 text-white px-4 py-2 rounded-full font-medium"
                      >
                        Reintentar
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-16">
                      {quinchos.map((q) => {
                        const reservaEnQuincho = q.parrillas[0]?.reservas[0]; 
                        const isOccupied = !!reservaEnQuincho;
                        const isMyReservation = user && reservaEnQuincho?.usuarioId === user.id;
                        const isSelected = selectedParrilla?.qId === q.id;

                        return (
                          <div key={q.id} className="relative group mb-4 lg:mb-0 mx-1 md:mx-2">
                            <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-[70%] h-4 bg-black/10 blur-lg rounded-full transition-all duration-500 ${isSelected ? 'scale-110 opacity-30' : 'scale-100 opacity-10'}`}></div>
                            <div 
                              onClick={() => !isOccupied && setSelectedParrilla({ qId: q.id, qNom: q.nombre })}
                              className={`relative aspect-[21/9] md:aspect-[4/3] rounded-2xl lg:rounded-[2rem] transition-all duration-500 cursor-pointer flex flex-col items-center justify-center border-t-2 lg:border-t-4 p-2 md:p-4
                                ${isMyReservation ? 'bg-emerald-50 border-emerald-500 shadow-lg ring-2 ring-emerald-200' : 
                                  isOccupied ? 'bg-slate-200 border-slate-300 grayscale opacity-60' : 
                                  isSelected ? 'bg-white border-emerald-500 scale-[1.02]' : 'bg-white/90 border-transparent'}
                              `}
                            >
                              <div className={`text-[7px] md:text-[8px] font-black mb-1 uppercase tracking-widest text-center leading-tight ${isMyReservation ? 'text-emerald-600' : isOccupied ? 'text-slate-400' : 'text-emerald-500'}`}>
                                {isMyReservation ? (reservaEnQuincho?.asistio ? 'Disfrutando de tu quincho' : 'TU RESERVA') : isOccupied ? 'OCUPADO' : 'DISPONIBLE'}
                              </div>
                              <h3 className="text-sm md:text-base lg:text-xl font-black text-slate-800 uppercase text-center leading-tight px-1">{q.nombre}</h3>
                              {isMyReservation && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleCancelar(reservaEnQuincho.id); }}
                                  className="mt-1 md:mt-2 text-[9px] md:text-[10px] font-bold text-red-500 hover:text-red-700 underline uppercase tracking-tighter"
                                >
                                  Cancelar Reserva
                                </button>
                              )}
                            </div>
                            <div className="mt-2 lg:mt-4 text-center px-1">
                                <span className="bg-emerald-800/10 px-2 md:px-3 py-0.5 rounded-full text-[7px] md:text-[8px] lg:text-[9px] font-black text-emerald-900/40 uppercase">
                                    Quincho {q.numero}
                                </span>
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

      {/* Modales (Scanner, QR y Auth) - Se mantienen fuera del main */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <button onClick={async () => {
              try {
                if (scannerRef.current) {
                  await scannerRef.current.stop();
                  await scannerRef.current.clear();
                  scannerRef.current = null;
                }
                const element = document.getElementById('qr-reader');
                if (element) element.innerHTML = '';
              } catch (error) {
                console.error('Error stopping scanner:', error);
              }
              setIsScannerOpen(false);
            }} className="absolute right-4 top-4 text-slate-500 hover:text-slate-900">Cerrar</button>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Escaneá el QR del quincho</h2>
            <div className="rounded-3xl overflow-hidden border border-slate-200 bg-slate-900">
              <div id="qr-reader" className="w-full h-[360px] bg-black" />
            </div>
            {scanError && <p className="mt-4 text-sm text-red-600">{scanError}</p>}
          </div>
        </div>
      )}



      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
};

export default App;