import React, { useState, useEffect } from 'react';
import { Shield, Search, Ban } from 'lucide-react';

const AdminPanel = ({ API_BASE_URL }) => {
  const [reservasHoy, setReservasHoy] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [turnoFiltro, setTurnoFiltro] = useState('NOCHE');
  const [reservasFiltradas, setReservasFiltradas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosFiltrados, setUsuariosFiltrados] = useState([]);
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


  const handleFilterUsers = () => {
    if (!searchTerm) {
      setUsuariosFiltrados(usuarios);
    } else {
      const filtered = usuarios.filter(u =>
        u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.dni && u.dni.includes(searchTerm))
      );
      setUsuariosFiltrados(filtered);
    }
  };

  React.useEffect(() => {
    if (showUsuarios) {
      handleFilterUsers();
    }
  }, [searchTerm, usuarios, showUsuarios]);

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
        setUsuariosFiltrados(data);
      } else {
        console.error('Error fetching usuarios:', res.status);
        setUsuarios([]);
      }
    } catch (error) {
      console.error('Error fetching usuarios:', error);
      setUsuarios([]);
    }
  };

  const toggleSuspension = async (userId, currentlySuspended) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/usuarios/${userId}/suspension`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ suspended: !currentlySuspended })
      });
      if (res.ok) {
        // Refrescar la lista de usuarios si está visible
        if (showUsuarios) {
          fetchUsuarios();
        }
        
        // Si el usuario suspendido es el mismo que está logueado, actualizar la sesión
        const loggedUser = JSON.parse(localStorage.getItem('usuario') || '{}');
        if (loggedUser.id === userId) {
          loggedUser.suspendido = !currentlySuspended;
          localStorage.setItem('usuario', JSON.stringify(loggedUser));
        }
        alert(currentlySuspended ? 'Suspensión levantada.' : 'Usuario suspendido.');
      } else {
        const data = await res.json();
        alert(data.error || 'Error al cambiar el estado de suspensión.');
      }
    } catch (error) {
      console.error('Error toggling suspension:', error);
      alert('Error al conectar con el servidor.');
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
              placeholder="Filtrar usuarios..."
              className="bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 shadow-sm"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); handleFilterUsers(); }}
            />
            <button onClick={handleFilterUsers} className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-500 transition-colors">
              <Search size={20} />
            </button>
            <button onClick={() => { setShowUsuarios(!showUsuarios); if (!showUsuarios) fetchUsuarios(); }} className="bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition-all text-xs font-bold uppercase">
              Listar Usuarios
            </button>
          </div>
        </div>
      </header>

      {/* Lista de Usuarios */}
      {showUsuarios && (
        <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-100 border border-stone-100">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Lista de Usuarios</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <div className="grid grid-cols-6 gap-4 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-stone-200">
              <div>Nombre</div>
              <div>Email</div>
              <div>DNI</div>
              <div>Teléfono</div>
              <div>Rol</div>
              <div className="text-right">Acción</div>
            </div>
            {usuariosFiltrados.length > 0 ? usuariosFiltrados.map(u => (
              <div key={u.id} className="grid grid-cols-6 gap-4 items-center p-4 bg-stone-50 rounded-xl border border-stone-100 text-sm">
                <div className="truncate font-black uppercase text-slate-800">{u.nombre} {u.apellido}</div>
                <div className="truncate text-slate-600">{u.email || '—'}</div>
                <div className="truncate text-slate-600">{u.dni || '—'}</div>
                <div className="truncate text-slate-600">{u.telefono || '—'}</div>
                <div className="flex items-center gap-2 text-slate-600">
                  {u.role === 'ADMIN' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-amber-600">ADMIN</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600">USER</span>
                  )}
                </div>
                <div className="flex justify-end">
                  <button 
                    onClick={() => toggleSuspension(u.id, u.suspendido)}
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all ${u.suspendido ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}
                  >
                    {u.suspendido ? 'Levantar' : 'Suspender'}
                  </button>
                </div>
              </div>
            )) : <p className="text-slate-400 font-bold text-center py-10">No se encontraron usuarios.</p>}
          </div>
        </div>
      )}

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
                      <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">asistencia confirmada</span> : 
                      <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">pendiente</span>
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

      <div className="grid grid-cols-1 gap-8">
        
        {/* Reservas del Día */}
        <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-100 border border-stone-100">
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
                    <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">asistencia confirmada</span> : 
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">pendiente</span>
                  }
                </div>
              </div>
            )) : <p className="text-slate-400 font-bold text-center py-10">No hay reservas para hoy aún.</p>}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminPanel;