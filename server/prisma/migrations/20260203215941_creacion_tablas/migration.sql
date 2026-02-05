-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quincho" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Quincho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parrilla" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "quinchoId" INTEGER NOT NULL,

    CONSTRAINT "Parrilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "parrillaId" INTEGER NOT NULL,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_dni_key" ON "Usuario"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Quincho_numero_key" ON "Quincho"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Parrilla_quinchoId_numero_key" ON "Parrilla"("quinchoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_parrillaId_fecha_key" ON "Reserva"("parrillaId", "fecha");

-- AddForeignKey
ALTER TABLE "Parrilla" ADD CONSTRAINT "Parrilla_quinchoId_fkey" FOREIGN KEY ("quinchoId") REFERENCES "Quincho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_parrillaId_fkey" FOREIGN KEY ("parrillaId") REFERENCES "Parrilla"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
