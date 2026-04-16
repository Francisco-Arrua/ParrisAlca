import React, { useState } from 'react';
import { X, User, Lock, Mail, CreditCard, Phone } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const AuthModal = ({ isOpen, onClose, onLoginSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '', apellido: '', dni: '', telefono: '', email: '', password: ''
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isRegister ? 'register' : 'login';
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      if (response.ok) {
        if (!isRegister) {
          localStorage.setItem('token', data.token);
          onLoginSuccess(data.usuario);
        } else {
          alert("Registro exitoso, ahora inicia sesión");
          setIsRegister(false);
        }
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Error de conexión");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X size={24} />
        </button>

        <div className="p-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            {isRegister ? "Crear cuenta de Vecino" : "¡Hola de nuevo!"}
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            {isRegister ? "Registrate para reservar tu quincho." : "Ingresá para gestionar tus asados."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="grid grid-cols-2 gap-4">
                <input 
                  placeholder="Nombre" 
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  required
                />
                <input 
                  placeholder="Apellido" 
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
                  onChange={(e) => setFormData({...formData, apellido: e.target.value})}
                  required
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-3.5 text-slate-400" size={18} />
              <input 
                type="email" placeholder="Correo electrónico" 
                className="w-full pl-10 p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>

            {isRegister && (
              <>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  <input 
                    placeholder="DNI (sin puntos)" 
                    className="w-full pl-10 p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
                    onChange={(e) => setFormData({...formData, dni: e.target.value})}
                    required
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  <input 
                    placeholder="Teléfono / WhatsApp" 
                    className="w-full pl-10 p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
                    onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                    required
                  />
                </div>
              </>
            )}

            <div className="relative">
              <Lock className="absolute left-3 top-3.5 text-slate-400" size={18} />
              <input 
                type="password" placeholder="Contraseña" 
                className="w-full pl-10 p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
              />
            </div>

            <button className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-200">
              {isRegister ? "Registrarme" : "Entrar"}
            </button>
          </form>

          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="w-full mt-6 text-sm text-slate-500 hover:text-orange-600 font-medium"
          >
            {isRegister ? "¿Ya tenés cuenta? Iniciá sesión" : "¿Sos nuevo? Crea una cuenta acá"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;