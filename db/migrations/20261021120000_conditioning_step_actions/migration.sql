-- Tres acciones nuevas al final de `OrderExecutionAction`, para los pasos de acondicionamiento, y la
-- fase `CONDITIONING` de las fotos de evidencia.
--
-- Solo `ADD VALUE`: Postgres no deja usar un valor recien anadido dentro de la transaccion que lo
-- anade (55P04) y Prisma Migrate corre cada migracion en una. Las columnas, los CHECK y el indice
-- que nombran estos valores van en la migracion siguiente.

ALTER TYPE "OrderExecutionAction" ADD VALUE IF NOT EXISTS 'CONDITIONING_STEP_ADVANCE';
ALTER TYPE "OrderExecutionAction" ADD VALUE IF NOT EXISTS 'CONDITIONING_STEPS_COMPLETE';
ALTER TYPE "OrderExecutionAction" ADD VALUE IF NOT EXISTS 'CONDITIONING_RESPONSIBLES_CHANGE';
ALTER TYPE "evidence_phase" ADD VALUE IF NOT EXISTS 'CONDITIONING';
