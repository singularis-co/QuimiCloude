-- Prisma Migrate no genera downs: lo aplica `pnpm run db:rollback` en una sola transaccion junto
-- con el borrado de su fila de `_prisma_migrations`.
--
-- Reversion de `migration.sql`, en orden inverso: toda entrega vuelve a tener pedido. Solo es
-- posible si no hay ninguna entrega sin pedido ni ningun asiento de los tipos nuevos; si no, se
-- detiene entero antes de cambiar nada, porque volver atras perderia esas salidas.

-- Parentesis de RLS: con RLS forzada y sin policies, el dueno no ve ninguna fila.
ALTER TABLE "order_deliveries"    NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "inventory_movements" NO FORCE ROW LEVEL SECURITY;

-- Se detiene antes de tocar nada si hay algo que el esquema previo no puede guardar.
DO $$
DECLARE
  direct_deliveries BIGINT;
  direct_movements  BIGINT;
BEGIN
  SELECT count(*) INTO direct_deliveries
    FROM "order_deliveries"
   WHERE "order_id" IS NULL OR "product_id" IS NOT NULL OR "note" IS NOT NULL;

  SELECT count(*) INTO direct_movements
    FROM "inventory_movements"
   WHERE "kind"::text IN ('direct_delivery', 'direct_delivery_void');

  IF direct_deliveries > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK ABORTADO: hay % entrega(s) sin pedido en `order_deliveries`. Antes de esta migracion toda entrega tenia pedido, y volver a ese modelo las perderia: el rollback se detiene ENTERO sin cambiar nada. Localizalas con: SELECT id FROM order_deliveries WHERE order_id IS NULL OR product_id IS NOT NULL OR note IS NOT NULL;',
      direct_deliveries;
  END IF;

  IF direct_movements > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK ABORTADO: hay % asiento(s) de entrega sin pedido o de su anulacion en `inventory_movements`: el rollback se detiene ENTERO sin cambiar nada. Localizalos con: SELECT id FROM inventory_movements WHERE kind::text IN (''direct_delivery'', ''direct_delivery_void'');',
      direct_movements;
  END IF;
END $$;

-- 3. inventory_movements: sin los disparadores, y los cinco CHECK con su texto previo.
DROP TRIGGER "inventory_movements_check_delivery_origin" ON "inventory_movements";
DROP FUNCTION "inventory_movements_check_delivery_origin"();

ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_reason_matches_kind";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_reason_matches_kind"
  CHECK (("kind"::text = 'adjustment' AND "reason" IS NOT NULL)
      OR ("kind"::text IN ('opening', 'consumption', 'production', 'delivery', 'delivery_void') AND "reason" IS NULL));
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_delivery_void_quantity_positive";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_delivery_void_quantity_positive"
  CHECK ("kind"::text <> 'delivery_void' OR "quantity" > 0);
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_order_delivery_void_id_matches_kind";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_delivery_void_id_matches_kind"
  CHECK (("kind"::text = 'delivery_void') = ("order_delivery_void_id" IS NOT NULL));
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_delivery_quantity_negative";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_delivery_quantity_negative"
  CHECK ("kind"::text <> 'delivery' OR "quantity" < 0);
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_order_delivery_id_matches_kind";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_delivery_id_matches_kind"
  CHECK (("kind"::text = 'delivery') = ("order_delivery_id" IS NOT NULL));

-- 2. La linea vuelve a exigir su linea del reparto.
DROP TRIGGER "order_delivery_lines_check_origin" ON "order_delivery_lines";
DROP FUNCTION "order_delivery_lines_check_origin"();
ALTER TABLE "order_delivery_lines" ALTER COLUMN "order_presentation_line_id" SET NOT NULL;

-- 1. La entrega vuelve a exigir su pedido, sin producto ni nota.
DROP INDEX "order_deliveries_product_id_idx";
ALTER TABLE "order_deliveries" DROP CONSTRAINT "order_deliveries_product_id_fkey";
ALTER TABLE "order_deliveries" DROP CONSTRAINT "order_deliveries_note_only_direct";
ALTER TABLE "order_deliveries" DROP CONSTRAINT "order_deliveries_order_xor_product";
ALTER TABLE "order_deliveries" DROP COLUMN "note";
ALTER TABLE "order_deliveries" DROP COLUMN "product_id";
ALTER TABLE "order_deliveries" ALTER COLUMN "order_id" SET NOT NULL;

ALTER TABLE "order_deliveries"    FORCE ROW LEVEL SECURITY;
ALTER TABLE "inventory_movements" FORCE ROW LEVEL SECURITY;
