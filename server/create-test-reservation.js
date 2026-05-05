const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // Crear una reserva para Vika (usuario 2) en Quincho 3 para hoy
    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);

    // Parrilla 9 es del Quincho 3 (quinchoId: 3)
    const reserva = await prisma.reserva.upsert({
      where: {
        parrillaId_fecha_turno: {
          parrillaId: 9,
          fecha: hoy,
          turno: 'NOCHE',
        },
      },
      update: {},
      create: {
        fecha: hoy,
        turno: 'NOCHE',
        estado: 'PENDIENTE',
        usuarioId: 2,
        parrillaId: 9,
      },
    });

    console.log('✅ Reserva creada para Vika en Quincho 3 (Oeste):', {
      id: reserva.id,
      fecha: reserva.fecha.toISOString().split('T')[0],
      turno: reserva.turno,
      estado: reserva.estado,
      usuarioId: reserva.usuarioId,
      parrillaId: reserva.parrillaId
    });
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
