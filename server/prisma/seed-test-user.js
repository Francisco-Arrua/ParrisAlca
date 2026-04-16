const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Creando usuario de prueba...');

  // Encriptar contraseña
  const hashedPassword = await bcrypt.hash('Test123!', 10);

  // Crear usuario
  const usuario = await prisma.usuario.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      nombre: 'Juan',
      apellido: 'Perez',
      email: 'test@example.com',
      dni: '12345678',
      telefono: '1234567890',
      password: hashedPassword,
    },
  });

  console.log('✅ Usuario creado:', usuario);

  // Obtener el primer quincho y parrilla
  const quincho = await prisma.quincho.findFirst();
  const parrilla = await prisma.parrilla.findFirst({
    where: { quinchoId: quincho.id },
  });

  // Crear una reserva de prueba para hoy
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const reserva = await prisma.reserva.upsert({
    where: {
      parrillaId_fecha_turno: {
        parrillaId: parrilla.id,
        fecha: hoy,
        turno: 'NOCHE',
      },
    },
    update: {},
    create: {
      fecha: hoy,
      turno: 'NOCHE',
      estado: 'PENDIENTE',
      usuarioId: usuario.id,
      parrillaId: parrilla.id,
    },
  });

  console.log('✅ Reserva de prueba creada:', reserva);
  console.log('\n📋 Credenciales de prueba:');
  console.log('   Email: test@example.com');
  console.log('   Contraseña: Test123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
