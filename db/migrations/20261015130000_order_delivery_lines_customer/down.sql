-- Prisma Migrate no genera downs: lo aplica `pnpm run db:rollback` en una sola transaccion junto
-- con el borrado de su fila de `_prisma_migrations`.
--
-- Reversion de `migration.sql`, en orden inverso: el cliente vuelve de las lineas a la entrega.
-- Solo es posible si cada entrega tiene lineas y todas de un mismo cliente; si no, se detiene
-- entero antes de cambiar nada. `customer_id` vuelve a `order_deliveries` al final de la tabla, no
-- en su posicion original: el orden de columnas no lo lee nadie.

-- Parentesis de RLS: con RLS forzada y sin policies, el dueno no ve ninguna fila.
ALTER TABLE "order_deliveries"     NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_delivery_lines" NO FORCE ROW LEVEL SECURITY;

-- 1. Se detiene antes de tocar nada si alguna entrega no puede volver a tener un solo cliente.
DO $$
DECLARE
  deliveries_with_several_customers BIGINT;
  deliveries_without_lines          BIGINT;
BEGIN
  SELECT count(*) INTO deliveries_with_several_customers
    FROM (
      SELECT "delivery_id"
        FROM "order_delivery_lines"
       GROUP BY "delivery_id"
      HAVING count(DISTINCT "customer_id") > 1
    ) AS shared;

  SELECT count(*) INTO deliveries_without_lines
    FROM "order_deliveries" AS d
   WHERE NOT EXISTS (SELECT 1 FROM "order_delivery_lines" AS l WHERE l."delivery_id" = d."id");

  IF deliveries_with_several_customers > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK ABORTADO: hay % entrega(s) con lineas de mas de un cliente. Antes de esta migracion una entrega tenia un solo cliente, y volver a ese modelo perderia a los demas: el rollback se detiene ENTERO sin cambiar nada. Localizalas con: SELECT delivery_id FROM order_delivery_lines GROUP BY delivery_id HAVING count(DISTINCT customer_id) > 1;',
      deliveries_with_several_customers;
  END IF;

  IF deliveries_without_lines > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK ABORTADO: hay % entrega(s) sin lineas, y su cliente no se puede reconstruir: el rollback se detiene ENTERO sin cambiar nada. Localizalas con: SELECT d.id FROM order_deliveries d WHERE NOT EXISTS (SELECT 1 FROM order_delivery_lines l WHERE l.delivery_id = d.id);',
      deliveries_without_lines;
  END IF;
END $$;

-- 2. La entrega recupera su cliente: el unico de sus lineas.
ALTER TABLE "order_deliveries" ADD COLUMN "customer_id" UUID;
UPDATE "order_deliveries" AS d
   SET "customer_id" = l."customer_id"
  FROM (SELECT DISTINCT "delivery_id", "company_id", "customer_id" FROM "order_delivery_lines") AS l
 WHERE l."delivery_id" = d."id" AND l."company_id" = d."company_id";
ALTER TABLE "order_deliveries" ALTER COLUMN "customer_id" SET NOT NULL;
ALTER TABLE "order_deliveries" ADD CONSTRAINT "order_deliveries_customer_id_fkey"
  FOREIGN KEY ("company_id", "customer_id") REFERENCES "customers"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "order_deliveries_customer_id_idx" ON "order_deliveries"("company_id", "customer_id");

-- 3. Con un cliente por entrega, un lote sale una sola vez por entrega: la unicidad vieja no choca.
ALTER TABLE "order_delivery_lines" DROP CONSTRAINT "order_delivery_lines_delivery_customer_batch_unique";
ALTER TABLE "order_delivery_lines" ADD CONSTRAINT "order_delivery_lines_delivery_batch_unique"
  UNIQUE ("delivery_id", "batch_id");

-- 4. La linea pierde el cliente.
DROP INDEX "order_delivery_lines_customer_id_idx";
ALTER TABLE "order_delivery_lines" DROP CONSTRAINT "order_delivery_lines_customer_id_fkey";
ALTER TABLE "order_delivery_lines" DROP COLUMN "customer_id";

ALTER TABLE "order_deliveries"     FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_delivery_lines" FORCE ROW LEVEL SECURITY;
