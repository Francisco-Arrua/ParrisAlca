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
  const { fecha, turno } = req.query;

  try {
    const fechaFiltro = new Date(fecha + "T00:00:00Z");

    const quinchos = await prisma.quincho.findMany({
      // 1. Asegúrate de que el include sea así:
      include: {
        parrillas: {
          include: {
            reservas: {
              where: {
                fecha: fechaFiltro,
                turno: turno || 'NOCHE'
              }
            }
          }
        }
      },
      // 2. REVISA ESTO: Que diga 'numero', NO 'existe'
      orderBy: { numero: 'asc' } 
    });
    
    res.json(quinchos);
  } catch (error) {
    console.error("❌ ERROR CRÍTICO EN EL SERVIDOR:", error);
    res.status(500).json({ error: "Error en la consulta" });
  }
});

app.post('/api/reservas', async (req, res) => {
  const { fecha, usuarioId, quinchoId, turno } = req.body;
  const fechaReserva = new Date(fecha + "T00:00:00Z");

  try {
    // REGLA 1: Solo un quincho por turno (el usuario no puede reservar dos quinchos a la vez)
    const reservaExistenteTurno = await prisma.reserva.findFirst({
      where: { usuarioId, fecha: fechaReserva, turno }
    });
    if (reservaExistenteTurno) return res.status(400).json({ error: "Ya tienes una reserva para este turno." });

    // REGLA 2: No más de dos noches (o días) seguidas
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

    // Si pasa las reglas, buscamos la parrilla y creamos
    const parrilla = await prisma.parrilla.findFirst({ where: { quinchoId: parseInt(quinchoId) } });
    
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
    res.status(400).json({ error: "Este quincho ya está ocupado en ese turno." });
  }
});

app.listen(3001, () => console.log("🚀 Server listo en http://localhost:3001"));