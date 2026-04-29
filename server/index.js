const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const prisma = new PrismaClient();

const JWT_SECRET = "tu_clave_secreta_super_segura_del_pueblo"; // Esto debería ir en el .env


// Middleware para verificar si es Admin
const isAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "No autorizado" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'ADMIN') {
      return res.status(403).json({ error: "Acceso denegado. Se requiere ser administrador." });
    }
    next();
  } catch (err) {
    res.status(401).json({ error: "Token inválido" });
  }
};

app.use(cors());
app.use(express.json());

// --- RUTA DE REGISTRO ---
app.post('/api/auth/register', async (req, res) => {
  const { nombre, apellido, dni, telefono, email, password } = req.body;

  try {
    // Encriptar la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombre,
        apellido,
        dni,
        telefono,
        email,
        password: hashedPassword,
      },
    });

    res.json({ message: "Usuario creado con éxito", userId: nuevoUsuario.id });
  } catch (error) {
    res.status(400).json({ error: "El email o DNI ya están registrados" });
  }
});

// --- RUTA DE LOGIN ACTUALIZADA ---
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) return res.status(401).json({ error: "Contraseña incorrecta" });

    // Incluimos el ROLE en el token para que el backend pueda validarlo después
    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, role: usuario.role }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    // Enviamos el role al frontend para que React sepa qué mostrar
    res.json({ 
      token, 
      usuario: { 
        id: usuario.id, 
        nombre: usuario.nombre, 
        apellido: usuario.apellido,
        role: usuario.role // <--- IMPORTANTE
      } 
    });
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Ruta para ver el estado de todas las parrillas en una fecha específica
app.get('/api/estado-quinchos', async (req, res) => {
  const { fecha, turno } = req.query;

  try {
    // 1. Creamos el rango del día completo (de 00:00 a 23:59:59)
    // Esto asegura que encuentre la reserva sin importar el desfasaje de horas
    const inicioDia = new Date(fecha);
    inicioDia.setUTCHours(0, 0, 0, 0);

    const finDia = new Date(fecha);
    finDia.setUTCHours(23, 59, 59, 999);

    const quinchos = await prisma.quincho.findMany({
      include: {
        parrillas: {
          include: {
            reservas: {
              where: {
                fecha: {
                  gte: inicioDia,
                  lte: finDia
                },
                turno: turno 
              }
            }
          }
        }
      },
      orderBy: { numero: 'asc' }
    });
    
    res.json(quinchos);
  } catch (error) {
    console.error("ERROR:", error);
    res.status(500).json({ error: "Error al obtener estado" });
  }
});

app.post('/api/reservas', async (req, res) => {
  const { fecha, usuarioId, quinchoId, turno } = req.body;
  const fechaReserva = new Date(fecha + "T00:00:00Z");

  try {
    // Verificar si el usuario está suspendido
    const userIdNum = typeof usuarioId === 'string' ? parseInt(usuarioId, 10) : usuarioId;
    
    const usuario = await prisma.usuario.findUnique({
      where: { id: userIdNum }
    });
    
    if (!usuario) {
      return res.status(400).json({ error: "Usuario no encontrado." });
    }
    
    if (usuario.suspendido) {
      console.log(`Usuario ${usuario.nombre} ${usuario.apellido} está suspendido, bloqueando reserva`);
      return res.status(400).json({ error: "Tienes una suspensión por no asistir en más de dos oportunidades. Contacta con administración." });
    }

    // el usuario no puede reservar dos quinchos a la vez
    const reservaExistenteTurno = await prisma.reserva.findFirst({
      where: { usuarioId, fecha: fechaReserva, turno }
    });
    if (reservaExistenteTurno) return res.status(400).json({ error: "Ya tienes una reserva para este turno." });

    // Verificar si el quincho ya está ocupado en ese turno específico
    const quincho = await prisma.quincho.findUnique({
      where: { id: parseInt(quinchoId) },
      include: {
        parrillas: {
          include: {
            reservas: {
              where: { fecha: fechaReserva, turno }
            }
          }
        }
      }
    });

    if (!quincho) {
      return res.status(400).json({ error: "El quincho no existe." });
    }

    const quinchoOcupado = quincho.parrillas.some(p => p.reservas.length > 0);
    if (quinchoOcupado) {
      return res.status(400).json({ error: "Este quincho ya está ocupado en ese turno." });
    }

    // Verificar que existe la parrilla
    const parrilla = await prisma.parrilla.findFirst({ where: { quinchoId: parseInt(quinchoId) } });
    if (!parrilla) {
      return res.status(400).json({ error: "No hay parrillas disponibles en este quincho." });
    }

    // REGLA 3: No más de dos noches (o días) seguidas
    // Buscamos reservas del usuario en los días cercanos
    const ayer = new Date(fechaReserva); ayer.setDate(ayer.getDate() - 1);
    const antesDeAyer = new Date(fechaReserva); antesDeAyer.setDate(antesDeAyer.getDate() - 2);
    const mañana = new Date(fechaReserva); mañana.setDate(mañana.getDate() + 1);
    const pasadoMañana = new Date(fechaReserva); pasadoMañana.setDate(pasadoMañana.getDate() + 2);

    const previas = await prisma.reserva.count({
      where: { usuarioId, fecha: { in: [ayer, antesDeAyer] }, turno }
    });
    const futuras = await prisma.reserva.count({
      where: { usuarioId, fecha: { in: [mañana, pasadoMañana] }, turno }
    });

    if (previas >= 2 || futuras >= 2) {
      return res.status(400).json({ error: "No puedes reservar más de 2 días seguidos. Debe haber una noche de por medio." });
    }
    
    await prisma.reserva.create({
      data: {
        fecha: fechaReserva,
        turno,
        usuarioId: parseInt(usuarioId),
        parrillaId: parrilla.id
      }
    });

    res.json({ message: "Reserva confirmada" });
  } catch (error) {
    console.error("Error al crear reserva:", error);
    res.status(400).json({ error: "Error al procesar la reserva." });
  }
});

// --- RUTA PARA CANCELAR RESERVAS ---
app.delete('/api/reservas/:id', async (req, res) => {
  try {
    const reserva = await prisma.reserva.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!reserva) return res.status(404).json({ error: "Reserva no encontrada" });

    // Lógica de tiempo: Mínimo 2 horas antes del evento
    const ahora = new Date();
    const horaInicio = reserva.turno === 'DIA' ? 10 : 20;
    
    // Crear la fecha límite: día de la reserva a las (horaInicio - 2) horas
    const fechaReserva = new Date(reserva.fecha);
    const limiteCancelacion = new Date(fechaReserva.getUTCFullYear(), fechaReserva.getUTCMonth(), fechaReserva.getUTCDate(), horaInicio - 2, 0, 0, 0);

    if (ahora > limiteCancelacion) {
      return res.status(400).json({ 
        error: "Ya es tarde para cancelar. Debe hacerse con 2 horas de anticipación." 
      });
    }

    await prisma.reserva.delete({ where: { id: reserva.id } });
    res.json({ message: "Reserva cancelada con éxito" });
  } catch (error) {
    console.error("Error al cancelar:", error);
    res.status(500).json({ error: "Error al cancelar" });
  }
});


// FUNCION PARA CALCULAR DISTANCIA ENTRE DOS PUNTOS GEOGRÁFICOS PARA CONFIRMAR LA ASISTENCIA EN EL LUGAR
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radio de la tierra en metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

app.post('/api/reservas/checkin', async (req, res) => {
  const { reservaId, usuarioId, quinchoId, fecha, turno, lat, lon } = req.body;

  console.log('Checkin request:', { reservaId, usuarioId, quinchoId, fecha, turno, lat, lon });

  // Leer coordenadas desde las variables de entorno
  const PREDIO_LAT = parseFloat(process.env.PREDIO_LAT);
  const PREDIO_LON = parseFloat(process.env.PREDIO_LON);

  // Validación de seguridad por si te olvidas de ponerlas en el .env
  if (isNaN(PREDIO_LAT) || isNaN(PREDIO_LON)) {
    console.error("❌ ERROR: No se encontraron las coordenadas en el archivo .env");
  }

  if (!lat || !lon) {
    return res.status(400).json({ error: "Faltan coordenadas para confirmar asistencia." });
  }

  const distancia = getDistanceInMeters(lat, lon, PREDIO_LAT, PREDIO_LON);
  console.log('Distancia calculada:', distancia);

  if (distancia > 200) {
    return res.status(403).json({ error: "Estás demasiado lejos del predio para marcar asistencia." });
  }

  try {
    let reserva;

    if (reservaId) {
      console.log('Buscando reserva por ID:', reservaId);
      reserva = await prisma.reserva.findUnique({ where: { id: parseInt(reservaId) } });
    } else if (usuarioId && quinchoId && fecha && turno) {
      const fechaReserva = new Date(fecha + "T00:00:00Z");
      console.log('Buscando reserva por datos:', { usuarioId: parseInt(usuarioId), fecha: fechaReserva, turno, quinchoId: parseInt(quinchoId) });
      reserva = await prisma.reserva.findFirst({
        where: {
          usuarioId: parseInt(usuarioId),
          fecha: fechaReserva,
          turno,
          parrilla: {
            quinchoId: parseInt(quinchoId)
          }
        }
      });
    }

    console.log('Reserva encontrada:', reserva);

    if (!reserva) {
      return res.status(404).json({ error: "Reserva no encontrada para confirmar asistencia." });
    }

    if (reserva.estado === "PRESENTADO") {
      return res.status(400).json({ error: "La asistencia ya fue confirmada." });
    }

    await prisma.reserva.update({
      where: { id: reserva.id },
      data: { estado: "PRESENTADO" }
    });

    res.json({ message: "¡Asistencia confirmada! Que disfrutes el quincho." });
  } catch (error) {
    console.error("Error al confirmar asistencia:", error);
    res.status(500).json({ error: "Error al confirmar asistencia." });
  }
});


// --- RUTA PARA CONFIRMACIÓN MANUAL (ADMIN) ---
app.patch('/api/reservas/confirmar-manual', isAdmin, async (req, res) => {
  const { fecha, turno, quinchoId } = req.body;

  try {
    // 1. Normalizar la fecha para la búsqueda
    const fechaFiltro = new Date(fecha + "T00:00:00Z");

    // 2. Buscar la reserva
    // Buscamos una reserva en esa fecha, turno y que pertenezca a una parrilla de ese quincho
    const reserva = await prisma.reserva.findFirst({
      where: {
        fecha: fechaFiltro,
        turno: turno,
        parrilla: {
          quinchoId: parseInt(quinchoId)
        }
      }
    });

    if (!reserva) {
      return res.status(404).json({ error: "No se encontró ninguna reserva para confirmar." });
    }

    // 3. Actualizar el estado a PRESENTADO
    await prisma.reserva.update({
      where: { id: reserva.id },
      data: { estado: "PRESENTADO" }
    });

    res.json({ message: "Asistencia confirmada manualmente con éxito." });
  } catch (error) {
    console.error("Error en confirmación manual:", error);
    res.status(500).json({ error: "Error interno al confirmar asistencia." });
  }
});

// --- RUTA PARA EL BUSCADOR DEL PANEL ADMIN ---

app.get('/api/admin/reservas', isAdmin, async (req, res) => {
  const { fecha, turno } = req.query;

  try {
    const inicioDia = new Date(fecha + "T00:00:00Z");
    const finDia = new Date(fecha + "T23:59:59Z");

    const whereClause = {
      fecha: {
        gte: inicioDia,
        lte: finDia
      }
    };

    if (turno) {
      whereClause.turno = turno;
    }

    const reservas = await prisma.reserva.findMany({
      where: whereClause,
      include: {
        usuario: {
          select: {
            nombre: true,
            apellido: true,
            dni: true
          }
        },
        parrilla: {
          include: {
            quincho: true
          }
        }
      }
    });

    res.json(reservas);
  } catch (error) {
    console.error("Error al buscar reservas para admin:", error);
    res.status(500).json({ error: "Error al obtener las reservas." });
  }
});

// --- RUTA PARA BUSCAR USUARIO EN PANEL ADMIN ---
app.get('/api/admin/usuarios/search', isAdmin, async (req, res) => {
  const { query } = req.query;

  try {
    const usuario = await prisma.usuario.findFirst({
      where: {
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { apellido: { contains: query, mode: 'insensitive' } }
        ]
      }
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    const history = await prisma.reserva.findMany({
      where: { usuarioId: usuario.id },
      select: {
        fecha: true,
        estado: true
      },
      orderBy: { fecha: 'desc' }
    });

    res.json({
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        suspendido: usuario.suspendido
      },
      history: history.map(h => ({
        fecha: h.fecha.toISOString().split('T')[0],
        asistio: h.estado === 'PRESENTADO'
      }))
    });
  } catch (error) {
    console.error("Error al buscar usuario:", error);
    res.status(500).json({ error: "Error al buscar usuario." });
  }
});

// --- RUTA PARA SUSPENDER/LEVANTAR SUSPENSIÓN ---
app.post('/api/admin/usuarios/:id/suspension', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { suspended } = req.body;

  try {
    await prisma.usuario.update({
      where: { id: parseInt(id) },
      data: { suspendido: suspended }
    });

    res.json({ message: "Estado de suspensión actualizado." });
  } catch (error) {
    console.error("Error al actualizar suspensión:", error);
    res.status(500).json({ error: "Error al actualizar suspensión." });
  }
});


// Ejemplo de una ruta protegida
app.get('/api/admin/estadisticas', isAdmin, async (req, res) => {
  // Solo llega acá si es ADMIN
  const totalReservas = await prisma.reserva.count();
  res.json({ totalReservas });
});

app.get('/api/admin/usuarios', isAdmin, async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true,
        nombre: true,
        apellido: true,
        dni: true,
        telefono: true,
        email: true,
        role: true,
        suspendido: true
      },
      orderBy: { apellido: 'asc' }
    });
    res.json(usuarios);
  } catch (error) {
    console.error('Error fetching usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


app.listen(3001, () => console.log("Server listo en http://localhost:3001"));