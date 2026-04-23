const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Creando usuarios de prueba...');

  const usuariosData = [
    { nombre: 'Juan', apellido: 'Perez', email: 'test@example.com', dni: '12345678', telefono: '1234567890', role: 'ADMIN' },
    { nombre: 'Edi', apellido: 'Rodriguez', email: 'edi@example.com', dni: '87654321', telefono: '0987654321', role: 'USER' },
    { nombre: 'Vika', apellido: 'Gomez', email: 'vika@example.com', dni: '11223344', telefono: '1122334455', role: 'USER' },
    { nombre: 'Carlos', apellido: 'Lopez', email: 'carlos@example.com', dni: '55667788', telefono: '5566778899', role: 'USER' },
    { nombre: 'Ana', apellido: 'Martinez', email: 'ana@example.com', dni: '99887766', telefono: '9988776655', role: 'USER' },
  ];

  for (const u of usuariosData) {
    const hashedPassword = await bcrypt.hash('Test123!', 10);

    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: {
        nombre: u.nombre,
        apellido: u.apellido,
        email: u.email,
        dni: u.dni,
        telefono: u.telefono,
        password: hashedPassword,
        role: u.role,
      },
    });
  }

  console.log('✅ Usuarios creados');

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
      usuarioId: 1, // Asumiendo que el primer usuario es Juan
      parrillaId: parrilla.id,
    },
  });

  console.log('✅ Reserva de prueba creada');
}
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
