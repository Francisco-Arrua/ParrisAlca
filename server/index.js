const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const prisma = new PrismaClient();

const JWT_SECRET = "CLAVE_INEXISTENTE_AUN"; // Mover al .env

app.use(cors());
app.use(express.json());

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const getArgentinaHour = () => (new Date().getUTCHours() - 3 + 24) % 24;

// "Hoy" en hora Argentina expresado como fecha UTC 00:00:00
function getHoyArgentinaUTC() {
  const ahora = new Date();
  const arg   = new Date(ahora.getTime() - 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(arg.getUTCFullYear(), arg.getUTCMonth(), arg.getUTCDate()));
}

// Deadline de asistencia según turno
function getAttendanceDeadline(reservaFecha, turno) {
  const d = new Date(reservaFecha.getTime());
  if (turno === 'DIA') {
    d.setTime(d.getTime() + 17 * 60 * 60 * 1000);           // 14:00 ARG = 17:00 UTC
  } else {
    d.setTime(d.getTime() + 26 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000); // 23:59:59 ARG
  }
  return d;
}

// Valida si se puede escanear QR ahora
function canScanQR(reservaFecha, turno) {
  const hoyUTC       = getHoyArgentinaUTC();
  const reservaDay   = new Date(reservaFecha);
  reservaDay.setUTCHours(0, 0, 0, 0);

  if (reservaDay.getTime() !== hoyUTC.getTime()) {
    return { canScan: false, reason: "Solo podés escanear el QR el día de la reserva." };
  }

  const hora = getArgentinaHour();
  if (turno === 'DIA') {
    if (hora >= 11 && hora < 14) return { canScan: true };
    return { canScan: false, reason: "El QR del turno almuerzo se puede escanear entre las 11:00 y las 14:00." };
  }
  if (turno === 'NOCHE') {
    if (hora >= 20 && hora < 24) return { canScan: true };
    return { canScan: false, reason: "El QR del turno cena se puede escanear entre las 20:00 y las 23:59." };
  }
  return { canScan: false, reason: "Turno no válido." };
}

// Distancia entre dos coordenadas en metros (Haversine)
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R    = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2 +
               Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Marca como AUSENTE las reservas cuyo deadline ya pasó y suspende usuarios con 2+ faltas
async function markOverdueReservations() {
  const ahora      = new Date();
  const pendientes = await prisma.reserva.findMany({ where: { estado: 'PENDIENTE' } });

  const vencidas = pendientes.filter(r => {
    const limite = getAttendanceDeadline(r.fecha, r.turno);
    return limite && ahora > limite;
  });

  if (vencidas.length === 0) return;

  await prisma.reserva.updateMany({
    where: { id: { in: vencidas.map(r => r.id) } },
    data:  { estado: 'AUSENTE' },
  });

  // Acumular faltas por usuario
  const faltasPorUsuario = vencidas.reduce((acc, r) => {
    acc[r.usuarioId] = (acc[r.usuarioId] || 0) + 1;
    return acc;
  }, {});

  for (const [usuarioId, incremento] of Object.entries(faltasPorUsuario)) {
    const usuario = await prisma.usuario.findUnique({ where: { id: parseInt(usuarioId, 10) } });
    if (!usuario) continue;
    const nuevasFaltas = usuario.faltas + incremento;
    await prisma.usuario.update({
      where: { id: usuario.id },
      data:  { faltas: { increment: incremento }, suspendido: nuevasFaltas >= 2 ? true : usuario.suspendido },
    });
  }
}

// ─── MIDDLEWARE ADMIN ──────────────────────────────────────────────────────────

const isAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "No autorizado" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'ADMIN') return res.status(403).json({ error: "Acceso denegado." });
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
};

// ─── AUTH ──────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  const { nombre, apellido, dni, telefono, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevo = await prisma.usuario.create({
      data: { nombre, apellido, dni, telefono, email, password: hashedPassword },
    });
    res.json({ message: "Usuario creado con éxito", userId: nuevo.id });
  } catch {
    res.status(400).json({ error: "El email o DNI ya están registrados." });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado." });

    const ok = await bcrypt.compare(password, usuario.password);
    if (!ok) return res.status(401).json({ error: "Contraseña incorrecta." });

    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, role: usuario.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, apellido: usuario.apellido, role: usuario.role },
    });
  } catch {
    res.status(500).json({ error: "Error en el servidor." });
  }
});

// ─── QUINCHOS ─────────────────────────────────────────────────────────────────

app.get('/api/estado-quinchos', async (req, res) => {
  const { fecha, turno } = req.query;
  try {
    await markOverdueReservations();

    const inicioDia = new Date(fecha); inicioDia.setUTCHours(0, 0, 0, 0);
    const finDia    = new Date(fecha); finDia.setUTCHours(23, 59, 59, 999);

    const quinchos = await prisma.quincho.findMany({
      include: {
        parrillas: {
          include: {
            reservas: { where: { fecha: { gte: inicioDia, lte: finDia }, turno } },
          },
        },
      },
      orderBy: { numero: 'asc' },
    });

    // Filtrar reservas cuyo deadline ya pasó (se mostrarán como libres)
    const ahora = new Date();
    quinchos.forEach(q =>
      q.parrillas.forEach(p => {
        p.reservas = p.reservas.filter(r => getAttendanceDeadline(r.fecha, r.turno) > ahora);
      })
    );

    res.json(quinchos);
  } catch (err) {
    console.error("Error /api/estado-quinchos:", err);
    res.status(500).json({ error: "Error al obtener estado." });
  }
});

// ─── RESERVAS ─────────────────────────────────────────────────────────────────

// ⚠️  IMPORTANTE: /checkin debe ir ANTES que POST /api/reservas
//     Express evalúa rutas en orden; si POST /api/reservas va primero,
//     "checkin" es interpretado como :id y nunca llega a esta ruta.

app.post('/api/reservas/checkin', async (req, res) => {
  const { usuarioId, quinchoId, fecha, lat, lon } = req.body;

  console.log('Checkin request:', { usuarioId, quinchoId, fecha, lat, lon });

  // Validar coordenadas del predio
  const PREDIO_LAT = parseFloat(process.env.PREDIO_LAT);
  const PREDIO_LON = parseFloat(process.env.PREDIO_LON);

  if (isNaN(PREDIO_LAT) || isNaN(PREDIO_LON)) {
    console.error("ERROR: Faltan PREDIO_LAT / PREDIO_LON en el .env");
    return res.status(500).json({ error: "Error de configuración del servidor." });
  }

  if (!lat || !lon) return res.status(400).json({ error: "Faltan coordenadas." });

  const distancia = getDistanceInMeters(lat, lon, PREDIO_LAT, PREDIO_LON);
  console.log('Distancia al predio:', distancia, 'm');

  if (distancia > 200) {
    return res.status(403).json({ error: "Estás demasiado lejos del predio para marcar asistencia." });
  }

  try {
    await markOverdueReservations();

    // Calcular rango del día en Argentina
    let fechaBase;
    if (fecha && typeof fecha === 'string' && fecha.includes('/')) {
      const [dia, mes, anio] = fecha.split('/');
      fechaBase = new Date(`${anio}-${mes.padStart(2,'0')}-${dia.padStart(2,'0')}T00:00:00Z`);
    } else if (fecha && typeof fecha === 'string') {
      fechaBase = new Date(fecha + "T00:00:00Z");
    } else {
      fechaBase = getHoyArgentinaUTC();
    }

    const inicioDia = new Date(fechaBase); inicioDia.setUTCHours(0, 0, 0, 0);
    const finDia    = new Date(fechaBase); finDia.setUTCHours(23, 59, 59, 999);

    const usuarioIdNum = parseInt(usuarioId, 10);
    const quinchoIdNum = parseInt(quinchoId, 10);

    // Buscar la reserva: usuario + quincho + fecha (sin filtrar turno —
    // canScanQR valida si la hora actual corresponde al turno de la reserva)
    const reserva = await prisma.reserva.findFirst({
      where: {
        usuarioId: usuarioIdNum,
        fecha:     { gte: inicioDia, lte: finDia },
        parrilla:  { quinchoId: quinchoIdNum },
      },
      include: { parrilla: { include: { quincho: true } } },
    });

    console.log('Reserva encontrada:', reserva
      ? { id: reserva.id, turno: reserva.turno, estado: reserva.estado, fecha: reserva.fecha }
      : 'No encontrada'
    );

    if (!reserva) {
      return res.status(404).json({ error: "No encontramos una reserva tuya para este quincho hoy." });
    }

    // Validar que la reserva sea de hoy (en hora Argentina)
    const hoyUTC     = getHoyArgentinaUTC();
    const reservaDay = new Date(reserva.fecha); reservaDay.setUTCHours(0, 0, 0, 0);
    if (reservaDay.getTime() !== hoyUTC.getTime()) {
      return res.status(403).json({ error: "Esta reserva es para otro día." });
    }

    if (reserva.estado === 'PRESENTADO') {
      return res.status(400).json({ error: "La asistencia ya fue confirmada." });
    }
    if (reserva.estado === 'AUSENTE') {
      return res.status(400).json({ error: "Ya venció el tiempo de checkin. La reserva quedó como inasistencia." });
    }

    // Validar ventana horaria según el turno de la reserva
    const qrCheck = canScanQR(reserva.fecha, reserva.turno);
    if (!qrCheck.canScan) {
      return res.status(403).json({ error: qrCheck.reason });
    }

    await prisma.reserva.update({ where: { id: reserva.id }, data: { estado: 'PRESENTADO' } });
    res.json({ message: "¡Asistencia confirmada! Que disfrutes el quincho." });

  } catch (err) {
    console.error("Error en checkin:", err);
    res.status(500).json({ error: "Error al confirmar asistencia." });
  }
});

app.post('/api/reservas', async (req, res) => {
  const { fecha, usuarioId, quinchoId, turno } = req.body;
  const fechaReserva = new Date(fecha + "T00:00:00Z");

  try {
    await markOverdueReservations();

    const hoy = getHoyArgentinaUTC();
    if (fechaReserva < hoy) {
      return res.status(400).json({ error: "No podés reservar fechas pasadas." });
    }

    // Si es hoy, verificar que no haya pasado la hora de inicio del turno
    if (fechaReserva.getTime() === hoy.getTime()) {
      const horaInicio = turno === 'DIA' ? 16 : 20;
      if (getArgentinaHour() >= horaInicio) {
        return res.status(400).json({
          error: `Ya pasó la hora de inicio del turno. Reservá antes de las ${horaInicio}:00.`,
        });
      }
    }

    const userIdNum = typeof usuarioId === 'string' ? parseInt(usuarioId, 10) : usuarioId;
    const usuario   = await prisma.usuario.findUnique({ where: { id: userIdNum } });
    if (!usuario)          return res.status(400).json({ error: "Usuario no encontrado." });
    if (usuario.suspendido) return res.status(400).json({ error: "Tenés una suspensión activa. Contactá con administración." });

    // Un usuario no puede tener dos reservas en el mismo turno/día
    const yaReservado = await prisma.reserva.findFirst({ where: { usuarioId: userIdNum, fecha: fechaReserva, turno } });
    if (yaReservado) return res.status(400).json({ error: "Ya tenés una reserva para este turno." });

    // Verificar disponibilidad del quincho
    const ahora  = new Date();
    const quincho = await prisma.quincho.findUnique({
      where: { id: parseInt(quinchoId) },
      include: { parrillas: { include: { reservas: { where: { fecha: fechaReserva, turno } } } } },
    });
    if (!quincho) return res.status(400).json({ error: "El quincho no existe." });

    quincho.parrillas.forEach(p => {
      p.reservas = p.reservas.filter(r => getAttendanceDeadline(r.fecha, r.turno) > ahora);
    });
    if (quincho.parrillas.some(p => p.reservas.length > 0)) {
      return res.status(400).json({ error: "Este quincho ya está ocupado en ese turno." });
    }

    const parrilla = await prisma.parrilla.findFirst({ where: { quinchoId: parseInt(quinchoId) } });
    if (!parrilla) return res.status(400).json({ error: "No hay parrillas disponibles en este quincho." });

    // Regla: no más de 2 días consecutivos en el mismo turno
    const ayer         = new Date(fechaReserva); ayer.setDate(ayer.getDate() - 1);
    const antesDeAyer  = new Date(fechaReserva); antesDeAyer.setDate(antesDeAyer.getDate() - 2);
    const manana       = new Date(fechaReserva); manana.setDate(manana.getDate() + 1);
    const pasadoManana = new Date(fechaReserva); pasadoManana.setDate(pasadoManana.getDate() + 2);

    const [previas, futuras] = await Promise.all([
      prisma.reserva.count({ where: { usuarioId: userIdNum, fecha: { in: [ayer, antesDeAyer] }, turno } }),
      prisma.reserva.count({ where: { usuarioId: userIdNum, fecha: { in: [manana, pasadoManana] }, turno } }),
    ]);
    if (previas >= 2 || futuras >= 2) {
      return res.status(400).json({ error: "No podés reservar más de 2 días seguidos. Debe haber un día de por medio." });
    }

    await prisma.reserva.create({
      data: { fecha: fechaReserva, turno, usuarioId: userIdNum, parrillaId: parrilla.id },
    });
    res.json({ message: "Reserva confirmada" });

  } catch (err) {
    console.error("Error al crear reserva:", err);
    res.status(400).json({ error: "Error al procesar la reserva." });
  }
});

app.delete('/api/reservas/:id', async (req, res) => {
  try {
    await markOverdueReservations();

    const reserva = await prisma.reserva.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!reserva) return res.status(404).json({ error: "Reserva no encontrada." });

    const horaInicio       = reserva.turno === 'DIA' ? 10 : 20;
    const fechaR           = new Date(reserva.fecha);
    const limiteCancelacion = new Date(
      fechaR.getUTCFullYear(), fechaR.getUTCMonth(), fechaR.getUTCDate(),
      horaInicio - 2, 0, 0, 0
    );
    if (new Date() > limiteCancelacion) {
      return res.status(400).json({ error: "Ya es tarde para cancelar. Debe hacerse con 2 horas de anticipación." });
    }

    await prisma.reserva.delete({ where: { id: reserva.id } });
    res.json({ message: "Reserva cancelada con éxito." });

  } catch (err) {
    console.error("Error al cancelar:", err);
    res.status(500).json({ error: "Error al cancelar." });
  }
});

// ─── ADMIN ────────────────────────────────────────────────────────────────────

app.patch('/api/reservas/confirmar-manual', isAdmin, async (req, res) => {
  const { fecha, turno, quinchoId } = req.body;
  try {
    const fechaFiltro = new Date(fecha + "T00:00:00Z");
    const reserva     = await prisma.reserva.findFirst({
      where: { fecha: fechaFiltro, turno, parrilla: { quinchoId: parseInt(quinchoId) } },
    });
    if (!reserva) return res.status(404).json({ error: "No se encontró ninguna reserva para confirmar." });

    await prisma.reserva.update({ where: { id: reserva.id }, data: { estado: 'PRESENTADO' } });
    res.json({ message: "Asistencia confirmada manualmente." });
  } catch (err) {
    console.error("Error confirmación manual:", err);
    res.status(500).json({ error: "Error interno." });
  }
});

app.get('/api/admin/reservas', isAdmin, async (req, res) => {
  const { fecha, turno } = req.query;
  try {
    await markOverdueReservations();

    const inicioDia = new Date(fecha + "T00:00:00Z");
    const finDia    = new Date(fecha + "T23:59:59Z");
    const where     = { fecha: { gte: inicioDia, lte: finDia } };
    if (turno) where.turno = turno;

    const reservas = await prisma.reserva.findMany({
      where,
      include: {
        usuario: { select: { nombre: true, apellido: true, dni: true } },
        parrilla: { include: { quincho: true } },
      },
    });
    res.json(reservas);
  } catch (err) {
    console.error("Error admin/reservas:", err);
    res.status(500).json({ error: "Error al obtener las reservas." });
  }
});

app.get('/api/admin/usuarios/search', isAdmin, async (req, res) => {
  const { query } = req.query;
  try {
    await markOverdueReservations();
    const usuario = await prisma.usuario.findFirst({
      where: {
        OR: [
          { email:    { contains: query, mode: 'insensitive' } },
          { apellido: { contains: query, mode: 'insensitive' } },
        ],
      },
    });
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado." });

    const history = await prisma.reserva.findMany({
      where:   { usuarioId: usuario.id },
      select:  { fecha: true, estado: true },
      orderBy: { fecha: 'desc' },
    });
    res.json({
      user: { id: usuario.id, nombre: usuario.nombre, apellido: usuario.apellido, email: usuario.email, suspendido: usuario.suspendido },
      history: history.map(h => ({ fecha: h.fecha.toISOString().split('T')[0], asistio: h.estado === 'PRESENTADO' })),
    });
  } catch (err) {
    console.error("Error search usuarios:", err);
    res.status(500).json({ error: "Error al buscar usuario." });
  }
});

// ⚠️  IMPORTANTE: /api/admin/usuarios/search debe ir ANTES que /api/admin/usuarios/:id
//     por el mismo motivo que checkin: Express leería "search" como el :id.

app.post('/api/admin/usuarios/:id/suspension', isAdmin, async (req, res) => {
  const { suspended } = req.body;
  try {
    await prisma.usuario.update({
      where: { id: parseInt(req.params.id) },
      data:  { suspendido: suspended },
    });
    res.json({ message: "Estado de suspensión actualizado." });
  } catch (err) {
    console.error("Error suspensión:", err);
    res.status(500).json({ error: "Error al actualizar suspensión." });
  }
});

app.get('/api/admin/usuarios', isAdmin, async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select:  { id: true, nombre: true, apellido: true, dni: true, telefono: true, email: true, role: true, suspendido: true },
      orderBy: { apellido: 'asc' },
    });
    res.json(usuarios);
  } catch (err) {
    console.error("Error usuarios:", err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

app.get('/api/admin/estadisticas', isAdmin, async (req, res) => {
  const totalReservas = await prisma.reserva.count();
  res.json({ totalReservas });
});

// ─── START ────────────────────────────────────────────────────────────────────

app.listen(3001, () => console.log("Server listo en http://localhost:3001"));
