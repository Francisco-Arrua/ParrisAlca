const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  try{
    const quinchos = await prisma.quincho.count();
    const parrillas = await prisma.parrilla.count();
    const usuarios = await prisma.usuario.count();
    const reservas = await prisma.reserva.count();

    console.log('Quinchos:', quinchos);
    console.log('Parrillas:', parrillas);
    console.log('Usuarios:', usuarios);
    console.log('Reservas:', reservas);
  }catch(e){
    console.error('ERROR CHECK DB', e);
  }finally{
    await prisma.$disconnect();
  }
}

main();