-- PARCIAL va delante de PENDIENTE porque Postgres ordena un enum por declaracion y el listado
-- ordena por estado con ese orden. Escrita a mano: Prisma no genera el `BEFORE`.
--
-- Va sola: Postgres no deja usar un valor recien anadido dentro de la transaccion que lo anade
-- (55P04), y Prisma Migrate ejecuta cada migracion en una.

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PARCIAL' BEFORE 'PENDIENTE';
