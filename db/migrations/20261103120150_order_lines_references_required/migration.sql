-- La linea del pedido pasa a ser obligatoria en las tablas que cuelgan de el. Segundo paso de dos:
-- repite el relleno del primero para lo escrito despues de el, aborta si queda alguna fila sin linea
-- que no se pueda asignar, y pone NOT NULL, el CHECK definitivo, las FK compuestas y los unicos y
-- la PK por linea. Escrita a mano: el CHECK, las FK compuestas y los unicos son drift para Prisma.
--
-- Va antes de borrar las columnas de linea de `orders`: el relleno las lee.

-- ---------------------------------------------------------------------------------------
-- 1. Relleno, idempotente. Parentesis de RLS: con RLS forzada y sin policies, el dueno no ve
--    ninguna fila.
-- ---------------------------------------------------------------------------------------
ALTER TABLE "orders"                          NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "recipes"                         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_lines"                     NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_presentation_lines"        NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "reservation_movements"           NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "inventory_movements"             NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_execution_entries"         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_step_evidence"             NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_conditioning_team_members" NO FORCE ROW LEVEL SECURITY;

-- 1.1 Los pedidos que siguen sin linea reciben la suya, con la misma copia que hizo la migracion
--     que creo la tabla.
INSERT INTO "order_lines" (
  "order_id", "company_id", "position", "recipe_id", "original_recipe_id", "quantity", "unit_id",
  "status", "cancellation_reason", "ingredients_cost", "packaging_cost", "actual_cost",
  "sale_price", "reserved_at", "finished_at", "packed_by", "conditioned_by",
  "created_by", "updated_by", "created_at", "updated_at", "deleted_at"
)
SELECT
  o."id", o."company_id", 0, o."recipe_id", COALESCE(r."parent_recipe_id", r."id"), o."quantity",
  o."unit_id", o."status", o."cancellation_reason", o."ingredients_cost", o."packaging_cost",
  o."actual_cost", o."sale_price", o."reserved_at", o."finished_at", o."packed_by",
  o."conditioned_by", o."created_by", o."updated_by", o."created_at", o."updated_at",
  o."deleted_at"
FROM "orders" o
JOIN "recipes" r ON r."id" = o."recipe_id"
WHERE NOT EXISTS (SELECT 1 FROM "order_lines" l WHERE l."order_id" = o."id");

-- 1.2 Cada fila sin linea de un pedido con exactamente una linea, quitadas incluidas, recibe esa
--     linea. Un `delivery_void` recibe asi la misma que su `delivery`: son del mismo pedido.
UPDATE "order_presentation_lines" t SET "order_line_id" = u."order_line_id"
  FROM (SELECT "order_id", (array_agg("id"))[1] AS "order_line_id"
          FROM "order_lines" GROUP BY "order_id" HAVING count(*) = 1) u
 WHERE t."order_line_id" IS NULL AND t."order_id" = u."order_id";
UPDATE "reservation_movements" t SET "order_line_id" = u."order_line_id"
  FROM (SELECT "order_id", (array_agg("id"))[1] AS "order_line_id"
          FROM "order_lines" GROUP BY "order_id" HAVING count(*) = 1) u
 WHERE t."order_line_id" IS NULL AND t."order_id" = u."order_id";
UPDATE "inventory_movements" t SET "order_line_id" = u."order_line_id"
  FROM (SELECT "order_id", (array_agg("id"))[1] AS "order_line_id"
          FROM "order_lines" GROUP BY "order_id" HAVING count(*) = 1) u
 WHERE t."order_line_id" IS NULL AND t."order_id" = u."order_id";
UPDATE "order_execution_entries" t SET "order_line_id" = u."order_line_id"
  FROM (SELECT "order_id", (array_agg("id"))[1] AS "order_line_id"
          FROM "order_lines" GROUP BY "order_id" HAVING count(*) = 1) u
 WHERE t."order_line_id" IS NULL AND t."order_id" = u."order_id";
UPDATE "order_step_evidence" t SET "order_line_id" = u."order_line_id"
  FROM (SELECT "order_id", (array_agg("id"))[1] AS "order_line_id"
          FROM "order_lines" GROUP BY "order_id" HAVING count(*) = 1) u
 WHERE t."order_line_id" IS NULL AND t."order_id" = u."order_id";
UPDATE "order_conditioning_team_members" t SET "order_line_id" = u."order_line_id"
  FROM (SELECT "order_id", (array_agg("id"))[1] AS "order_line_id"
          FROM "order_lines" GROUP BY "order_id" HAVING count(*) = 1) u
 WHERE t."order_line_id" IS NULL AND t."order_id" = u."order_id";

-- ---------------------------------------------------------------------------------------
-- 2. Lo que el relleno no pudo asignar es de un pedido con varias lineas: no se sabe a que
--    receta va. Se aborta nombrando cada tabla y cuantas filas.
-- ---------------------------------------------------------------------------------------
DO $$
DECLARE
  tabla text;
  filas bigint;
  detalle text := '';
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'order_presentation_lines', 'reservation_movements', 'order_execution_entries',
    'order_step_evidence', 'order_conditioning_team_members'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE "order_line_id" IS NULL', tabla) INTO filas;
    IF filas > 0 THEN
      detalle := detalle || format(' %s (%s)', tabla, filas);
    END IF;
  END LOOP;
  SELECT count(*) INTO filas FROM "inventory_movements"
   WHERE "order_line_id" IS NULL
     AND "kind"::text IN ('consumption', 'production', 'delivery', 'delivery_void');
  IF filas > 0 THEN
    detalle := detalle || format(' inventory_movements (%s)', filas);
  END IF;
  IF detalle <> '' THEN
    RAISE EXCEPTION 'order_lines_references_required: filas sin linea de un pedido con varias lineas:%', detalle;
  END IF;
END $$;

ALTER TABLE "orders"                          FORCE ROW LEVEL SECURITY;
ALTER TABLE "recipes"                         FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_lines"                     FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_presentation_lines"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "reservation_movements"           FORCE ROW LEVEL SECURITY;
ALTER TABLE "inventory_movements"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_execution_entries"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_step_evidence"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_conditioning_team_members" FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------------------
-- 3. NOT NULL. En `inventory_movements` la columna sigue admitiendo NULL: los asientos sin pedido
--    no tienen linea.
-- ---------------------------------------------------------------------------------------
ALTER TABLE "order_presentation_lines"        ALTER COLUMN "order_line_id" SET NOT NULL;
ALTER TABLE "reservation_movements"           ALTER COLUMN "order_line_id" SET NOT NULL;
ALTER TABLE "order_execution_entries"         ALTER COLUMN "order_line_id" SET NOT NULL;
ALTER TABLE "order_step_evidence"             ALTER COLUMN "order_line_id" SET NOT NULL;
ALTER TABLE "order_conditioning_team_members" ALTER COLUMN "order_line_id" SET NOT NULL;

-- ---------------------------------------------------------------------------------------
-- 4. Los cuatro tipos con pedido llevan linea y los demas no. Compara "kind"::text: un down que
--    recrea el enum no puede comparar el tipo viejo con el nuevo.
-- ---------------------------------------------------------------------------------------
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_order_line_id_matches_kind";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_line_id_matches_kind"
  CHECK (("kind"::text IN ('consumption', 'production', 'delivery', 'delivery_void')) = ("order_line_id" IS NOT NULL));

-- ---------------------------------------------------------------------------------------
-- 5. La linea es del mismo pedido que la fila. RESTRICT: las lineas se borran de forma logica.
-- ---------------------------------------------------------------------------------------
ALTER TABLE "order_presentation_lines" ADD CONSTRAINT "order_presentation_lines_order_line_id_order_id_fkey"
  FOREIGN KEY ("order_line_id", "order_id") REFERENCES "order_lines"("id", "order_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_movements" ADD CONSTRAINT "reservation_movements_order_line_id_order_id_fkey"
  FOREIGN KEY ("order_line_id", "order_id") REFERENCES "order_lines"("id", "order_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_line_id_order_id_fkey"
  FOREIGN KEY ("order_line_id", "order_id") REFERENCES "order_lines"("id", "order_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_order_line_id_order_id_fkey"
  FOREIGN KEY ("order_line_id", "order_id") REFERENCES "order_lines"("id", "order_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_step_evidence" ADD CONSTRAINT "order_step_evidence_order_line_id_order_id_fkey"
  FOREIGN KEY ("order_line_id", "order_id") REFERENCES "order_lines"("id", "order_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_conditioning_team_members" ADD CONSTRAINT "order_conditioning_team_members_order_line_id_order_id_fkey"
  FOREIGN KEY ("order_line_id", "order_id") REFERENCES "order_lines"("id", "order_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------
-- 6. Unicos y PK por linea: dos recetas del mismo pedido pueden repartirse en la misma
--    presentacion, tener su propia evidencia en cada paso y su propio equipo.
-- ---------------------------------------------------------------------------------------
DROP INDEX "order_presentation_lines_order_id_presentation_id_key";
CREATE UNIQUE INDEX "order_presentation_lines_order_line_id_presentation_id_key"
  ON "order_presentation_lines" ("order_line_id", "presentation_id");

DROP INDEX "order_step_evidence_slot_key";
CREATE UNIQUE INDEX "order_step_evidence_slot_key"
  ON "order_step_evidence" ("order_line_id", "phase", "step_position", "slot");

ALTER TABLE "order_conditioning_team_members" DROP CONSTRAINT "order_conditioning_team_members_pkey";
ALTER TABLE "order_conditioning_team_members" ADD CONSTRAINT "order_conditioning_team_members_pkey"
  PRIMARY KEY ("order_line_id", "user_id");
DROP INDEX "order_conditioning_team_members_order_id_position_key";
CREATE UNIQUE INDEX "order_conditioning_team_members_order_line_id_position_key"
  ON "order_conditioning_team_members" ("order_line_id", "position");
