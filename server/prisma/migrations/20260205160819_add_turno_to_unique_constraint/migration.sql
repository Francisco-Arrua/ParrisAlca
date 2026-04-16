/*
  Warnings:

  - A unique constraint covering the columns `[parrillaId,fecha,turno]` on the table `Reserva` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Reserva_parrillaId_fecha_key";

-- AlterTable
ALTER TABLE "Reserva" ALTER COLUMN "turno" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_parrillaId_fecha_turno_key" ON "Reserva"("parrillaId", "fecha", "turno");
