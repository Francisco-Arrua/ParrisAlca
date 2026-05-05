const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: 'vika@example.com' } });
    console.log('Usuario:', usuario);
    if (!usuario) return;
    const reservas = await prisma.reserva.findMany({
      where: { usuarioId: usuario.id },
      include: { parrilla: { include: { quincho: true } } },
      orderBy: { fecha: 'desc' }
    });
    console.log('Reservas:', reservas.map(r => ({ id: r.id, fecha: r.fecha.toISOString(), turno: r.turno, estado: r.estado, quinchoId: r.parrilla.quinchoId, parrillaId: r.parrillaId })));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
