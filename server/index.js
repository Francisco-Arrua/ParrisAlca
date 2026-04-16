const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const prisma = new PrismaClient();

const JWT_SECRET = "tu_clave_secreta_super_segura_del_pueblo"; // Esto debería ir en el .env

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

// --- RUTA DE LOGIN ---
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) return res.status(401).json({ error: "Contraseña incorrecta" });

    // Crear el Token de acceso
    const token = jwt.sign({ id: usuario.id, nombre: usuario.nombre }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, apellido: usuario.apellido } });
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Ruta para ver el estado de todas las parrillas en una fecha específica
app.get('/api/estado-quinchos', async (req, res) => {
  const { fecha, turno } = req.query; // Recibimos el turno del frontend

  try {
    const fechaFiltro = new Date(fecha + "T00:00:00Z");

    const quinchos = await prisma.quincho.findMany({
      include: {
        parrillas: {
          include: {
            reservas: {
            
              // Filtramos las reservas que coincidan con la fecha Y el turno solicitado
              where: {
                fecha: fechaFiltro,
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


app.listen(3001, () => console.log("🚀 Server listo en http://localhost:3001"));
