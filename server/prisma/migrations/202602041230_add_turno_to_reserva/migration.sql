-- Add column turno to Reserva
ALTER TABLE "Reserva" ADD COLUMN "turno" TEXT NOT NULL DEFAULT 'NOCHE';

-- Ensure existing rows (if any) have a value
UPDATE "Reserva" SET "turno" = 'NOCHE' WHERE "turno" IS NULL;
