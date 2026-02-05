import React, { useState, useEffect } from 'react';
import { Calendar, User, Info, Map as MapIcon, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import AuthModal from './components/AuthModal';

const App = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [quinchos, setQuinchos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedParrilla, setSelectedParrilla] = useState(null);
  const [error, setError] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [turno, setTurno] = useState('NOCHE');

  // FETCH REAL A LA API
  useEffect(() => {
    const fetchEstado = async () => {
      setLoading(true);
      setError(null);
      try {
        // IMPORTANTE: Agregamos &turno=${turno} al final
        const response = await fetch(`http://localhost:3001/api/estado-quinchos?fecha=${selectedDate}&turno=${turno}`);
        if (!response.ok) throw new Error("Error en la respuesta del servidor");
        const data = await response.json();
        setQuinchos(data);
      } catch (error) {
        console.error("Error al cargar quinchos:", error);
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

  const handleReserva = async () => {
    if (!selectedParrilla) return;
    if (!user) {
      alert("Debes iniciar sesión para reservar.");
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: selectedDate,
          usuarioId: user.id,
          quinchoId: selectedParrilla.qId,
          turno
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(`¡Reserva confirmada! ${selectedParrilla.qNom} para el ${selectedDate}`);
        setSelectedParrilla(null);
        
        // Refrescar el mapa automáticamente (incluyendo turno)
        const resRefresh = await fetch(`http://localhost:3001/api/estado-quinchos?fecha=${selectedDate}&turno=${turno}`);
        const dataRefresh = await resRefresh.json();
        setQuinchos(dataRefresh);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Error al procesar la reserva");
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 font-sans text-slate-900">
      {/* Navbar */}
      <nav className="bg-white border-b border-stone-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-orange-500 p-2 rounded-lg">
            <MapIcon className="text-white" size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">ParrisAlca <span className="text-orange-500">.</span></h1>
        </div>
        <button 
          onClick={() => setIsAuthModalOpen(true)}
          className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2 rounded-full hover:bg-slate-800 transition-all text-sm font-medium"
        >
          {user ? `Hola, ${user.nombre}` : <><User size={16} /> Ingresar</>}
        </button>
      </nav>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Columna Izquierda: Controles */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Calendar size={16} /> Programar Asado
            </h2>
            <input 
              type="date" 
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedParrilla(null); // Limpiar selección al cambiar fecha
              }}
            />

            <div className="flex gap-2 p-1 bg-stone-100 rounded-xl mb-4">
              <button 
                onClick={() => setTurno('DIA')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${turno === 'DIA' ? 'bg-white shadow text-orange-600' : 'text-slate-400'}`}
              >
                SOL (Mediodía)
              </button>
              <button 
                onClick={() => setTurno('NOCHE')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${turno === 'NOCHE' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}
              >
                LUNA (Noche)
              </button>
            </div>

            <div className="mt-8 p-4 bg-orange-50 rounded-xl border border-orange-100">
              <h3 className="text-orange-800 font-bold text-sm mb-1">Estado de la Selección</h3>
              <p className="text-orange-700 text-xs">
                {selectedParrilla 
                  ? (selectedParrilla.pNum 
                      ? `Parrilla ${selectedParrilla.pNum} - ${selectedParrilla.qNom}` 
                      : `Quincho ${selectedParrilla.qNom}`) 
                  : "Selecciona una parrilla o un quincho en el mapa para continuar."}
              </p>
            </div>

            <button 
              onClick={handleReserva}
              disabled={!selectedParrilla || loading}
              className={`w-full mt-4 py-3 rounded-xl font-bold transition-all ${
                selectedParrilla 
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 hover:bg-orange-600' 
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              Reservar Ahora
            </button>
          </div>
        </div>

        {/* Columna Derecha: El Mapa Aéreo */}
        <div className="lg:col-span-3">
          <div className="bg-emerald-50 border-4 border-emerald-100 rounded-[2.5rem] p-8 min-h-[600px] relative shadow-inner overflow-hidden">
            
            {/* Etiquetas */}
            <div className="absolute top-4 right-8 flex gap-4 text-xs font-bold text-emerald-700/50 uppercase">
              <span>Predio Municipal</span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center w-full py-40 gap-4">
                <Loader2 className="animate-spin text-emerald-600" size={48} />
                <p className="text-emerald-800 font-medium">Cargando mapa...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center w-full py-40 gap-4 text-red-500">
                <AlertCircle size={48} />
                <p className="font-bold">{error}</p>
                <button onClick={() => window.location.reload()} className="text-sm underline">Reintentar</button>
              </div>
            ) : quinchos.length === 0 ? (
              <div className="flex flex-col items-center justify-center w-full py-40 gap-4 text-emerald-800">
                <Info size={48} />
                <p className="font-bold text-center">No hay quinchos cargados en la base de datos.<br/>Usa Prisma Studio o el Seed para cargarlos.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
                {quinchos.map((q) => {
                  // Verificamos si el quincho tiene AL MENOS una reserva (significa que está todo ocupado)
                  const isQuinchoOccupied = (q.parrillas || []).some(p => p.reservas && p.reservas.length > 0);
                  const isQuinchoSelected = selectedParrilla?.qId === q.id;

                  return (
                    <div key={q.id} className="flex flex-col items-center">
                      <div 
                        onClick={() => !isQuinchoOccupied && setSelectedParrilla({ qId: q.id, qNom: q.nombre })}
                        className={`w-full cursor-pointer transition-all bg-white/80 backdrop-blur-sm rounded-3xl p-6 border-b-8 shadow-xl
                          ${isQuinchoOccupied ? 'opacity-60 grayscale' : 'hover:scale-105'}
                          ${isQuinchoSelected ? 'border-orange-500 ring-4 ring-orange-200' : 'border-stone-300'}
                        `}
                      >
                        <h3 className="text-center font-black text-slate-700 mb-6 uppercase tracking-widest flex items-center justify-center gap-2">
                          {q.nombre}
                          {isQuinchoOccupied && <Info size={16} className="text-red-500" />}
                        </h3>

                        {/* Las parrillas ahora son solo decorativas */}
                        <div className="grid grid-cols-2 gap-3 opacity-40">
                          {[1, 2, 3, 4].map((n) => (
                            <div key={n} className="aspect-square rounded-xl bg-slate-200 flex items-center justify-center border border-slate-300">
                              <span className="text-[10px] font-bold">P{n}</span>
                            </div>
                          ))}
                        </div>
                        
                        {isQuinchoOccupied && (
                          <div className="mt-4 text-center text-red-600 text-xs font-bold uppercase">
                            OCUPADO
                          </div>
                        )}
                      </div>
                      <div className="w-4/5 h-4 bg-emerald-900/10 blur-md rounded-full mt-2"></div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Caminos decorativos */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-0 w-full h-8 bg-stone-200/40 -rotate-1"></div>
            </div>
          </div>
        </div>
      </main>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
};

export default App;