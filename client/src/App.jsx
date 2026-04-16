import React, { useState, useEffect, useRef } from 'react';
import { ScanQrCode, QrCodeIcon, User, Loader2, MapPin } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import QrCode from 'react-qr-code';
import AuthModal from './components/AuthModal';

const App = () => {
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
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
  const scannerRef = useRef(null);

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
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      });

      const { latitude: lat, longitude: lon } = position.coords;
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
      if (response.ok) {
        alert(data.message);
      } else {
        alert(data.error || 'No se pudo confirmar asistencia.');
      }
    } catch (err) {
      setScanError(err.message || 'No se pudo obtener la ubicación.');
    } finally {
      setIsScannerOpen(false);
      scannerRef.current?.stop().catch(() => null);
      scannerRef.current = null;
      const resRefresh = await fetch(`${API_BASE_URL}/api/estado-quinchos?fecha=${selectedDate}&turno=${turno}`);
      setQuinchos(await resRefresh.json());
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
    };
  }, [isScannerOpen]);

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans text-slate-900">
      {/* Navbar Minimalista */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-stone-200 px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-2 rounded-xl shadow-lg shadow-emerald-100">
            <MapPin className="text-white" size={20} />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-slate-800">
            PARRIS ALCA <span className="text-emerald-500">.</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-full hover:bg-emerald-500 transition-all text-sm font-bold shadow-xl shadow-emerald-200"
          >
            <ScanQrCode size={16} /> ESCANEAR QR
          </button>
          <button 
            onClick={() => setIsAuthModalOpen(true)}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-full hover:bg-slate-800 transition-all text-sm font-bold shadow-xl shadow-slate-200"
          >
            {user ? `Hola, ${user.nombre}` : <><User size={16} /> INGRESAR</>}
          </button>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Panel de Control Lateral */}
        <div className="lg:col-span-3 space-y-6">
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
        <div className="lg:col-span-9">
          {/* Ajustamos el padding en móvil (p-4) para ganar espacio */}
          <div className="relative bg-[#e9f0e6] rounded-[2rem] lg:rounded-[3rem] p-4 md:p-12 min-h-[600px] lg:min-h-[700px] shadow-inner overflow-hidden border-4 lg:border-8 border-white">
            
            {/* Vía del Tren: Adaptativa y Pegada al borde */}
            <div className="absolute 
              top-6 left-0 w-full h-auto flex flex-col items-center 
              lg:top-12 lg:flex-col
              max-lg:right-0 max-lg:left-auto max-lg:w-8 max-lg:h-full max-lg:top-0 max-lg:justify-center
              opacity-20 pointer-events-none z-0"
            >
                <div className="
                  flex justify-between 
                  w-[90%] h-[2px] bg-slate-600 
                  lg:w-full lg:flex-row
                  max-lg:h-[90%] max-lg:w-[1px] max-lg:flex-col max-lg:px-0 max-lg:py-4"
                >
                    {[...Array(25)].map((_, i) => (
                      <div key={i} className="
                        bg-slate-600 
                        w-[1px] h-3 -translate-y-1
                        max-lg:w-3 max-lg:h-[1px] max-lg:-translate-x-1"
                      ></div>
                    ))}
                </div>
                <span className="
                  text-[9px] font-black tracking-[0.3em] text-slate-700 uppercase
                  lg:mt-4
                  max-lg:rotate-90 max-lg:whitespace-nowrap max-lg:absolute max-lg:right-2"
                >
                    Vías del Ferrocarril
                </span>
            </div>

            {/* Contenido del Mapa */}
            {/* Reducimos el margen lateral en móvil (pr-10) para no chocar con la vía */}
            <div className="relative z-10 mt-16 lg:mt-32 max-lg:pr-10 max-lg:pl-2">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4">
                  <Loader2 className="animate-spin text-emerald-600" size={48} />
                </div>
              ) : (
                /* Reducimos el gap en móvil para que los quinchos sean más compactos */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-16">
                  {quinchos.map((q) => {
                    // Buscamos si alguna parrilla de este quincho tiene una reserva
                    const reservaEnQuincho = q.parrillas[0]?.reservas[0]; 
                    const isOccupied = !!reservaEnQuincho;
                    const isMyReservation = user && reservaEnQuincho?.usuarioId === user.id;
                    const isSelected = selectedParrilla?.qId === q.id;

                    return (
                      <div key={q.id} className="relative group mb-4 lg:mb-0">
                        {/* Sombra proyectada más pequeña en móvil */}
                        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-[70%] h-4 bg-black/10 blur-lg rounded-full transition-all duration-500 ${isSelected ? 'scale-110 opacity-30' : 'scale-100 opacity-10'}`}></div>
                        
                        {/* Edificio del Quincho: Más pequeño en móvil */}
                        <div 
                          onClick={() => !isOccupied && setSelectedParrilla({ qId: q.id, qNom: q.nombre })}
                          className={`relative aspect-[21/9] md:aspect-[4/3] rounded-2xl lg:rounded-[2rem] transition-all duration-500 cursor-pointer flex flex-col items-center justify-center border-t-2 lg:border-t-4
                            ${isMyReservation ? 'bg-emerald-50 border-emerald-500 shadow-lg ring-2 ring-emerald-200' : 
                              isOccupied ? 'bg-slate-200 border-slate-300 grayscale opacity-60' : 
                              isSelected ? 'bg-white border-emerald-500 scale-[1.02]' : 'bg-white/90 border-transparent'}
                          `}
                        >
                          {/* Etiqueta de estado */}
                          <div className={`text-[8px] font-black mb-1 uppercase tracking-widest ${isMyReservation ? 'text-emerald-600' : isOccupied ? 'text-slate-400' : 'text-emerald-500'}`}>
                            {isMyReservation ? 'TU RESERVA' : isOccupied ? 'OCUPADO' : 'DISPONIBLE'}
                          </div>

                          <h3 className="text-base lg:text-xl font-black text-slate-800 uppercase">{q.nombre}</h3>
                          
                          {/* Botón de Cancelar (Solo si es mi reserva) */}
                          {isMyReservation && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelar(reservaEnQuincho.id);
                              }}
                              className="mt-2 text-[10px] font-bold text-red-500 hover:text-red-700 underline uppercase tracking-tighter"
                            >
                              Cancelar Reserva
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowQrFor(q);
                            }}
                            className="mt-3 inline-flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-tighter rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          >
                            <QrCodeIcon size={14} /> Ver QR
                          </button>
                        </div>

                        <div className="mt-2 lg:mt-4 text-center">
                            <span className="bg-emerald-800/10 px-3 py-0.5 rounded-full text-[8px] lg:text-[9px] font-black text-emerald-900/40 uppercase">
                                Quincho {q.numero}
                            </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Decoración sutil oculta en móvil para limpieza */}
            <div className="absolute bottom-6 left-6 w-8 h-8 bg-emerald-200/20 rounded-full blur-md hidden lg:block"></div>
          </div>
        </div>
      </main>

      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <button
              onClick={() => setIsScannerOpen(false)}
              className="absolute right-4 top-4 text-slate-500 hover:text-slate-900"
            >
              Cerrar
            </button>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Escaneá el QR del quincho</h2>
            <p className="text-sm text-slate-600 mb-4">Acercá la cámara al código QR que se encuentra en el quincho y autorizá la ubicación para confirmar asistencia.</p>
            <div className="rounded-3xl overflow-hidden border border-slate-200 bg-slate-900">
              <div id="qr-reader" className="w-full h-[360px] bg-black" />
            </div>
            {scanError && <p className="mt-4 text-sm text-red-600">{scanError}</p>}
          </div>
        </div>
      )}

      {showQrFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowQrFor(null)}
              className="absolute right-4 top-4 text-slate-500 hover:text-slate-900"
            >
              Cerrar
            </button>
            <h2 className="text-xl font-bold text-slate-900 mb-4">QR de asistencia - {showQrFor.nombre}</h2>
            <p className="text-sm text-slate-600 mb-4">Mostrá este código en el quincho para que el vecino pueda escanearlo y confirmar su llegada.</p>
            <div className="flex justify-center p-6 bg-slate-100 rounded-[2rem]">
              <QrCode value={JSON.stringify({ type: 'quincho-checkin', quinchoId: showQrFor.id })} size={220} />
            </div>
            <div className="mt-4 text-sm text-slate-500">
              <strong>Usa este QR sólo en el quincho {showQrFor.numero}.</strong>
            </div>
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