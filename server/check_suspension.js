const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.usuario.findMany({
      select: { id: true, nombre: true, apellido: true, suspendido: true }
    });
    console.log('Estado actual de usuarios:');
    users.forEach(u => {
      console.log(`ID ${u.id}: ${u.nombre} ${u.apellido} - Suspendido: ${u.suspendido}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();