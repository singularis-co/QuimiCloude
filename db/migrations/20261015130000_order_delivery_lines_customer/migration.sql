-- El cliente pasa de la entrega a cada una de sus lineas: una entrega puede llevar producto a
-- varios clientes. Cada linea existente hereda el cliente de su entrega, y la entrega deja de
-- guardarlo. Envases, cantidades, anulaciones, asientos y existencias no se tocan.
--
-- Escrita a mano: la FK compuesta con `company_id` hacia `customers` es drift (cruza los modulos
-- `pedidos` y `clientes`). Se aplica con `pnpm run db:migrate`.

-- Parentesis de RLS: con RLS forzada y sin policies, el dueno no ve ninguna fila.
ALTER TABLE "order_deliveries"     NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_delivery_lines" NO FORCE ROW LEVEL SECURITY;

-- Una entrega sin lineas no tiene a quien pasar su cliente: se aborta antes de cambiar nada en vez
-- de perder el dato.
DO $$
DECLARE
  deliveries_without_lines BIGINT;
BEGIN
  SELECT count(*) INTO deliveries_without_lines
    FROM "order_deliveries" AS d
   WHERE NOT EXISTS (SELECT 1 FROM "order_delivery_lines" AS l WHERE l."delivery_id" = d."id");

  IF deliveries_without_lines > 0 THEN
    RAISE EXCEPTION
      'MIGRACION ABORTADA: hay % entrega(s) sin lineas en `order_deliveries`. El cliente pasa de la entrega a sus lineas, y una entrega sin lineas lo perderia: la migracion se detiene ENTERA sin cambiar nada. Localizalas con: SELECT d.id FROM order_deliveries d WHERE NOT EXISTS (SELECT 1 FROM order_delivery_lines l WHERE l.delivery_id = d.id);',
      deliveries_without_lines;
  END IF;
END $$;

ALTER TABLE "order_delivery_lines" ADD COLUMN "customer_id" UUID;
UPDATE "order_delivery_lines" AS l
   SET "customer_id" = d."customer_id"
  FROM "order_deliveries" AS d
 WHERE d."id" = l."delivery_id" AND d."company_id" = l."company_id";
ALTER TABLE "order_delivery_lines" ALTER COLUMN "customer_id" SET NOT NULL;
-- Compuesta con la empresa: una linea no puede apuntar al cliente de otra empresa.
ALTER TABLE "order_delivery_lines" ADD CONSTRAINT "order_delivery_lines_customer_id_fkey"
  FOREIGN KEY ("company_id", "customer_id") REFERENCES "customers"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "order_delivery_lines_customer_id_idx" ON "order_delivery_lines"("company_id", "customer_id");

-- Un mismo lote puede salir en la misma entrega para clientes distintos, una vez por cliente.
ALTER TABLE "order_delivery_lines" DROP CONSTRAINT "order_delivery_lines_delivery_batch_unique";
ALTER TABLE "order_delivery_lines" ADD CONSTRAINT "order_delivery_lines_delivery_customer_batch_unique"
  UNIQUE ("delivery_id", "customer_id", "batch_id");

DROP INDEX "order_deliveries_customer_id_idx";
ALTER TABLE "order_deliveries" DROP CONSTRAINT "order_deliveries_customer_id_fkey";
ALTER TABLE "order_deliveries" DROP COLUMN "customer_id";

ALTER TABLE "order_deliveries"     FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_delivery_lines" FORCE ROW LEVEL SECURITY;
