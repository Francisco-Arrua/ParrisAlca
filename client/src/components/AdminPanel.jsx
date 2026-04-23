import React, { useState, useEffect } from 'react';
import { Shield, Search, CheckCircle, XCircle, Ban, History, Users, Calendar, Clock } from 'lucide-react';

const AdminPanel = ({ API_BASE_URL }) => {
  const [reservasHoy, setReservasHoy] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userHistory, setUserHistory] = useState([]);
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [turnoFiltro, setTurnoFiltro] = useState('NOCHE');
  const [reservasFiltradas, setReservasFiltradas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [showUsuarios, setShowUsuarios] = useState(false);

  const fetchReservasHoy = async () => {
    const hoy = new Date().toISOString().split('T')[0];
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/reservas?fecha=${hoy}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setReservasHoy(data);
      } else {
        console.error('Error fetching reservas:', res.status);
        setReservasHoy([]);
      }
    } catch (error) {
      console.error('Error fetching reservas:', error);
      setReservasHoy([]);
    }
  };

  // Cargar reservas del día al entrar
  useEffect(() => {
    fetchReservasHoy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleSearchUser = async () => {
    if (!searchTerm) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/usuarios/search?query=${searchTerm}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedUser(data.user);
        setUserHistory(data.history);
      } else {
        console.error('Error searching user:', res.status);
        alert('Usuario no encontrado o error en la búsqueda.');
      }
    } catch (error) {
      console.error('Error searching user:', error);
      alert('Error al buscar usuario.');
    }
  };

  const fetchReservasFiltradas = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/reservas?fecha=${fechaFiltro}&turno=${turnoFiltro}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setReservasFiltradas(data);
      } else {
        console.error('Error fetching reservas filtradas:', res.status);
        setReservasFiltradas([]);
      }
    } catch (error) {
      console.error('Error fetching reservas filtradas:', error);
      setReservasFiltradas([]);
    }
  };

  const fetchUsuarios = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/usuarios`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data);
      } else {
        console.error('Error fetching usuarios:', res.status);
        setUsuarios([]);
      }
    } catch (error) {
      console.error('Error fetching usuarios:', error);
      setUsuarios([]);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 p-3 rounded-2xl shadow-xl shadow-slate-200">
            <Shield className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Panel de Control</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Administración Alcaraz</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Buscar usuario..."
              className="bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button onClick={handleSearchUser} className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-500 transition-colors">
              <Search size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Filtros para buscar reservas */}
      <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-100 border border-stone-100">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Buscar Reservas por Fecha y Horario</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block">Fecha</label>
            <input 
              type="date" 
              className="w-full p-3 bg-stone-50 border-2 border-stone-100 rounded-xl focus:border-emerald-500 outline-none font-bold text-slate-700"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block">Turno</label>
            <div className="flex gap-2 p-1 bg-stone-100 rounded-xl">
              <button 
                onClick={() => setTurnoFiltro('DIA')}
                className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${turnoFiltro === 'DIA' ? 'bg-white shadow-md text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                ALMUERZO
              </button>
              <button 
                onClick={() => setTurnoFiltro('NOCHE')}
                className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${turnoFiltro === 'NOCHE' ? 'bg-white shadow-md text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                CENA
              </button>
            </div>
          </div>
          <button onClick={fetchReservasFiltradas} className="bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-500 transition-all font-bold">
            Buscar
          </button>
        </div>
        {reservasFiltradas.length > 0 ? (
          <div className="mt-6">
            <h4 className="text-sm font-black text-slate-600 uppercase tracking-[0.2em] mb-4">Reservas Encontradas</h4>
            <div className="space-y-3">
              {reservasFiltradas.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <div>
                    <p className="font-black text-slate-800 uppercase">{r.usuario.nombre} {r.usuario.apellido}</p>
                    <p className="text-[10px] font-bold text-emerald-600">{r.parrilla.quincho.nombre} - Turno {r.turno}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.asistio ? 
                      <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">Presente</span> : 
                      <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">Pendiente</span>
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <p className="text-slate-400 font-bold text-center py-10">No hay reservas registradas para esa fecha y horario.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMNA IZQUIERDA: Reservas del Día */}
        <div className="lg:col-span-7 bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-100 border border-stone-100">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Reservas de Hoy</h3>
          <div className="space-y-4">
            {reservasHoy.length > 0 ? reservasHoy.map(r => (
              <div key={r.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100">
                <div>
                  <p className="font-black text-slate-800 uppercase">{r.usuario.nombre} {r.usuario.apellido}</p>
                  <p className="text-[10px] font-bold text-emerald-600">{r.parrilla.quincho.nombre} - Turno {r.turno}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.asistio ? 
                    <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">Presente</span> : 
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">Pendiente</span>
                  }
                </div>
              </div>
            )) : <p className="text-slate-400 font-bold text-center py-10">No hay reservas para hoy aún.</p>}
          </div>
        </div>

        {/* COLUMNA DERECHA: Gestionar Vecino y Lista de Usuarios */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 p-8 rounded-[2rem] shadow-2xl text-white">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Gestionar Vecino</h3>

            {selectedUser && (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-black text-xl uppercase tracking-tighter">{selectedUser.nombre} {selectedUser.apellido}</h4>
                    <p className="text-xs font-bold text-slate-400">{selectedUser.email}</p>
                  </div>
                  <button 
                    onClick={() => toggleSuspension(selectedUser.id, selectedUser.suspendido)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${selectedUser.suspendido ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}
                  >
                    {selectedUser.suspendido ? 'Levantar Sanción' : 'Suspender'}
                  </button>
                </div>
                
                <div className="bg-white/5 p-4 rounded-2xl">
                  <p className="text-[9px] font-black text-slate-500 uppercase mb-3">Historial de Asistencia</p>
                  <div className="space-y-2">
                    {userHistory.map(h => (
                      <div key={h.id} className="flex justify-between items-center text-[11px] font-bold">
                        <span className="text-slate-300">{h.fecha}</span>
                        {h.asistio ? <CheckCircle size={14} className="text-emerald-400"/> : <XCircle size={14} className="text-red-400"/>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Lista de Todos los Usuarios */}
          <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-100 border border-stone-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Lista de Usuarios</h3>
              <button onClick={() => { setShowUsuarios(!showUsuarios); if (!showUsuarios) fetchUsuarios(); }} className="bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition-all text-xs font-bold uppercase">
                {showUsuarios ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {showUsuarios && (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {usuarios.length > 0 ? usuarios.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100">
                    <div>
                      <p className="font-black text-slate-800 uppercase">{u.nombre} {u.apellido}</p>
                      <p className="text-[10px] font-bold text-slate-500">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.suspendido && <Ban size={16} className="text-red-500" />}
                      {u.role === 'ADMIN' && <Shield size={16} className="text-amber-500" />}
                    </div>
                  </div>
                )) : <p className="text-slate-400 font-bold text-center py-10">Cargando usuarios...</p>}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminPanel;