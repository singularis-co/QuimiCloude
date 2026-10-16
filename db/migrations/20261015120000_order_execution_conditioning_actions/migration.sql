-- Tres acciones nuevas al final de `OrderExecutionAction`, para anotar el acondicionamiento.
--
-- Solo `ADD VALUE`: Postgres no deja usar un valor recien anadido dentro de la transaccion que lo
-- anade (55P04) y Prisma Migrate corre cada migracion en una. La columna y los CHECK que nombran
-- estos valores van en la migracion siguiente.

ALTER TYPE "OrderExecutionAction" ADD VALUE IF NOT EXISTS 'CONDITIONING_START';
ALTER TYPE "OrderExecutionAction" ADD VALUE IF NOT EXISTS 'CONDITIONING_BATCH_SAVE';
ALTER TYPE "OrderExecutionAction" ADD VALUE IF NOT EXISTS 'CONDITIONING_FINISH';
