const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando carga de predio...');

  const quinchosData = [
    { numero: 1, nombre: 'Quincho Este (1)' },
    { numero: 2, nombre: 'Quincho Centro (2)' },
    { numero: 3, nombre: 'Quincho Oeste (3)' },
  ];

  for (const q of quinchosData) {
    // Upsert crea el registro si no existe o lo ignora si ya está
    const quincho = await prisma.quincho.upsert({
      where: { numero: q.numero },
      update: {},
      create: {
        numero: q.numero,
        nombre: q.nombre,
      },
    });

    console.log(`✅ ${quincho.nombre} listo.`);

    // Crear 4 parrillas para cada quincho
    for (let i = 1; i <= 4; i++) {
      await prisma.parrilla.upsert({
        where: {
          quinchoId_numero: {
            quinchoId: quincho.id,
            numero: i,
          },
        },
        update: {},
        create: {
          numero: i,
          quinchoId: quincho.id,
        },
      });
    }
  }

  console.log('🚀 ¡Carga completada! 3 quinchos y 12 parrillas creadas.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });