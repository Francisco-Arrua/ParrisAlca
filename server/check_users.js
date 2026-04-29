const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.usuario.findMany({
      select: { id: true, nombre: true, apellido: true, suspendido: true, role: true }
    });
    console.log('Usuarios:', JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();