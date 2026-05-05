const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('\n=== USUARIOS ===');
    const usuarios = await prisma.usuario.findMany({
      select: { id: true, nombre: true, apellido: true, email: true }
    });
    console.log(usuarios);

    console.log('\n=== QUINCHOS ===');
    const quinchos = await prisma.quincho.findMany();
    console.log(quinchos);

    console.log('\n=== PARRILLAS ===');
    const parrillas = await prisma.parrilla.findMany({ include: { quincho: true } });
    console.log(parrillas.map(p => ({ id: p.id, numero: p.numero, quinchoId: p.quinchoId, quincho: p.quincho.nombre })));

    console.log('\n=== TODAS LAS RESERVAS ===');
    const reservas = await prisma.reserva.findMany({
      include: { 
        usuario: { select: { nombre: true, apellido: true } },
        parrilla: { include: { quincho: true } }
      },
      orderBy: { fecha: 'desc' }
    });
    console.log(reservas.map(r => ({
      id: r.id,
      usuario: `${r.usuario.nombre} ${r.usuario.apellido}`,
      usuarioId: r.usuarioId,
      fecha: r.fecha.toISOString().split('T')[0],
      turno: r.turno,
      estado: r.estado,
      quinchoId: r.parrilla.quinchoId,
      quinchoNum: r.parrilla.quincho.numero,
      parrillaId: r.parrillaId
    })));

    console.log('\n=== RESERVAS DE VIKA (usuario 2) ===');
    const vikasReservas = await prisma.reserva.findMany({
      where: { usuarioId: 2 },
      include: { 
        usuario: { select: { nombre: true, apellido: true } },
        parrilla: { include: { quincho: true } }
      }
    });
    console.log(vikasReservas.map(r => ({
      id: r.id,
      fecha: r.fecha.toISOString().split('T')[0],
      turno: r.turno,
      estado: r.estado,
      quinchoId: r.parrilla.quinchoId,
      quinchoNum: r.parrilla.quincho.numero,
      parrillaId: r.parrillaId
    })));

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
