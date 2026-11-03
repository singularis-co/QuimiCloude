-- DOWN de order_lines. Convencion del repo: Prisma Migrate no genera downs. Lo aplica
-- `pnpm run db:rollback`, que ejecuta este archivo entero en una sola transaccion.
--
-- Los datos de cada linea siguen en las columnas de `orders` mientras exista esta migracion: la
-- tabla se puede quitar sin perder nada. Sus FK, indices y CHECK caen con ella.

DROP TABLE "order_lines";
