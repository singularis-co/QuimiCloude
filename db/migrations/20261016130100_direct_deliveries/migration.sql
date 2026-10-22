-- La entrega de producto terminado sin pedido: una fila de `order_deliveries` sin pedido y con su
-- producto, cuyas lineas no tienen linea del reparto y cuyos asientos son de los tipos
-- direct_delivery y direct_delivery_void. Las entregas, lineas, anulaciones, asientos y existencias
-- que ya existen no se tocan. Las tablas siguen siendo solo de insercion.
--
-- Escrita a mano: la FK compuesta hacia `products`, los CHECK y los disparadores son drift (cruzan
-- los modulos `pedidos` e `inventario`). Depende de la migracion anterior, que crea los dos valores
-- del tipo. Los CHECK y los disparadores comparan "kind"::text: los down.sql que recrean el enum no
-- tienen que soltarlos y reponerlos.

-- ---------------------------------------------------------------------------------------
-- 1. La entrega es de un pedido o de un producto terminado, nunca de los dos. Solo la que no
-- tiene pedido lleva nota.
-- ---------------------------------------------------------------------------------------
ALTER TABLE "order_deliveries" ALTER COLUMN "order_id" DROP NOT NULL;
ALTER TABLE "order_deliveries" ADD COLUMN "product_id" UUID;
ALTER TABLE "order_deliveries" ADD COLUMN "note" TEXT;
ALTER TABLE "order_deliveries" ADD CONSTRAINT "order_deliveries_order_xor_product"
  CHECK (("order_id" IS NULL) <> ("product_id" IS NULL));
ALTER TABLE "order_deliveries" ADD CONSTRAINT "order_deliveries_note_only_direct"
  CHECK ("note" IS NULL OR ("order_id" IS NULL AND length(btrim("note")) BETWEEN 1 AND 500));
-- Compuesta con la empresa: una entrega no puede apuntar al producto de otra empresa.
ALTER TABLE "order_deliveries" ADD CONSTRAINT "order_deliveries_product_id_fkey"
  FOREIGN KEY ("company_id", "product_id") REFERENCES "products"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "order_deliveries_product_id_idx" ON "order_deliveries"("company_id", "product_id");

-- ---------------------------------------------------------------------------------------
-- 2. La linea de una entrega sin pedido no tiene linea del reparto, y su lote es del producto de
-- la entrega. La de una entrega de pedido sigue exigiendola.
-- ---------------------------------------------------------------------------------------
ALTER TABLE "order_delivery_lines" ALTER COLUMN "order_presentation_line_id" DROP NOT NULL;

CREATE FUNCTION "order_delivery_lines_check_origin"() RETURNS trigger AS $$
DECLARE d RECORD;
BEGIN
  SELECT "order_id", "product_id" INTO d FROM "order_deliveries"
   WHERE "id" = NEW."delivery_id" AND "company_id" = NEW."company_id";
  -- Sin entrega de la misma empresa, la rechaza la FK con su propio codigo.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  IF d."order_id" IS NULL THEN
    IF NEW."order_presentation_line_id" IS NOT NULL
       OR NOT EXISTS (SELECT 1 FROM "product_batches" b
                       WHERE b."id" = NEW."batch_id" AND b."company_id" = NEW."company_id"
                         AND b."product_id" = d."product_id") THEN
      RAISE EXCEPTION 'order_delivery_lines: linea de entrega sin pedido incoherente' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."order_presentation_line_id" IS NULL THEN
    RAISE EXCEPTION 'order_delivery_lines: linea de entrega de pedido sin linea del reparto' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "order_delivery_lines_check_origin" BEFORE INSERT OR UPDATE ON "order_delivery_lines"
  FOR EACH ROW EXECUTE FUNCTION "order_delivery_lines_check_origin"();

-- ---------------------------------------------------------------------------------------
-- 3. inventory_movements: los asientos de la entrega sin pedido y de su anulacion van como los de
-- pedido (con su entrega o su anulacion, sin motivo, con su signo) pero sin pedido.
-- "inventory_movements_order_id_matches_kind" no cambia: los dos tipos nuevos, al no estar en su
-- lista, quedan obligados a "order_id" NULL.
-- ---------------------------------------------------------------------------------------
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_order_delivery_id_matches_kind";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_delivery_id_matches_kind"
  CHECK (("kind"::text IN ('delivery', 'direct_delivery')) = ("order_delivery_id" IS NOT NULL));
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_delivery_quantity_negative";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_delivery_quantity_negative"
  CHECK ("kind"::text NOT IN ('delivery', 'direct_delivery') OR "quantity" < 0);
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_order_delivery_void_id_matches_kind";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_delivery_void_id_matches_kind"
  CHECK (("kind"::text IN ('delivery_void', 'direct_delivery_void')) = ("order_delivery_void_id" IS NOT NULL));
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_delivery_void_quantity_positive";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_delivery_void_quantity_positive"
  CHECK ("kind"::text NOT IN ('delivery_void', 'direct_delivery_void') OR "quantity" > 0);
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_reason_matches_kind";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_reason_matches_kind"
  CHECK (("kind"::text = 'adjustment' AND "reason" IS NOT NULL)
      OR ("kind"::text IN ('opening', 'consumption', 'production', 'delivery', 'delivery_void',
                           'direct_delivery', 'direct_delivery_void') AND "reason" IS NULL));

-- El tipo del asiento tiene que coincidir con el de la entrega a la que apunta: un CHECK no puede
-- mirar otra tabla.
CREATE FUNCTION "inventory_movements_check_delivery_origin"() RETURNS trigger AS $$
DECLARE without_order BOOLEAN;
BEGIN
  IF NEW."order_delivery_id" IS NOT NULL THEN
    SELECT "order_id" IS NULL INTO without_order FROM "order_deliveries"
     WHERE "id" = NEW."order_delivery_id" AND "company_id" = NEW."company_id";
    IF FOUND AND without_order <> (NEW."kind"::text = 'direct_delivery') THEN
      RAISE EXCEPTION 'inventory_movements: tipo de asiento y entrega no coinciden' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."order_delivery_void_id" IS NOT NULL THEN
    SELECT d."order_id" IS NULL INTO without_order
      FROM "order_delivery_voids" v JOIN "order_deliveries" d ON d."id" = v."delivery_id"
     WHERE v."id" = NEW."order_delivery_void_id" AND v."company_id" = NEW."company_id";
    IF FOUND AND without_order <> (NEW."kind"::text = 'direct_delivery_void') THEN
      RAISE EXCEPTION 'inventory_movements: tipo de asiento y anulacion no coinciden' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "inventory_movements_check_delivery_origin" BEFORE INSERT OR UPDATE ON "inventory_movements"
  FOR EACH ROW EXECUTE FUNCTION "inventory_movements_check_delivery_origin"();
