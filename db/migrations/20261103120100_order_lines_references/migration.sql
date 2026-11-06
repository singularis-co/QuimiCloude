-- La linea del pedido en las tablas que cuelgan de el. Primer paso de dos: la columna entra
-- nullable, sin FK ni cambio de unicos o PK, porque el codigo que todavia escribe estas tablas sin
-- linea tiene que seguir funcionando. Una migracion posterior repite el relleno y la hace
-- obligatoria. Escrita a mano: el CHECK es drift para Prisma.
--
-- No aborta por filas que se queden sin linea: las de un pedido de varias lineas no se pueden
-- asignar sin saber a que receta van.

-- ---------------------------------------------------------------------------------------
-- 1. Columnas e indices.
-- ---------------------------------------------------------------------------------------
ALTER TABLE "order_presentation_lines"        ADD COLUMN "order_line_id" UUID;
ALTER TABLE "reservation_movements"           ADD COLUMN "order_line_id" UUID;
ALTER TABLE "inventory_movements"             ADD COLUMN "order_line_id" UUID;
ALTER TABLE "order_execution_entries"         ADD COLUMN "order_line_id" UUID;
ALTER TABLE "order_step_evidence"             ADD COLUMN "order_line_id" UUID;
ALTER TABLE "order_conditioning_team_members" ADD COLUMN "order_line_id" UUID;

CREATE INDEX "order_presentation_lines_order_line_id_idx"
  ON "order_presentation_lines" ("order_line_id");
CREATE INDEX "reservation_movements_order_line_id_idx"
  ON "reservation_movements" ("order_line_id");
CREATE INDEX "inventory_movements_order_line_id_idx"
  ON "inventory_movements" ("order_line_id");
CREATE INDEX "order_execution_entries_order_line_id_idx"
  ON "order_execution_entries" ("order_line_id");
CREATE INDEX "order_step_evidence_order_line_id_idx"
  ON "order_step_evidence" ("order_line_id");
CREATE INDEX "order_conditioning_team_members_order_line_id_idx"
  ON "order_conditioning_team_members" ("order_line_id");

-- ---------------------------------------------------------------------------------------
-- 2. Solo los asientos que llevan pedido pueden llevar linea. Compara "kind"::text: un down que
--    recrea el enum no puede comparar el tipo viejo con el nuevo.
-- ---------------------------------------------------------------------------------------
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_line_id_matches_kind"
  CHECK ("order_line_id" IS NULL
      OR "kind"::text IN ('consumption', 'production', 'delivery', 'delivery_void'));

-- ---------------------------------------------------------------------------------------
-- 3. Relleno, idempotente. Parentesis de RLS: con RLS forzada y sin policies, el dueno no ve
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

-- 3.1 Los pedidos creados sin linea despues de la migracion que creo la tabla reciben la suya,
--     con la misma copia que hizo aquella.
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

-- 3.2 Cada fila sin linea de un pedido con exactamente una linea, quitadas incluidas, recibe esa
--     linea. Un `delivery_void` recibe asi la misma que su `delivery`: son del mismo pedido. Las
--     de un pedido con varias lineas se quedan sin linea.
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

ALTER TABLE "orders"                          FORCE ROW LEVEL SECURITY;
ALTER TABLE "recipes"                         FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_lines"                     FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_presentation_lines"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "reservation_movements"           FORCE ROW LEVEL SECURITY;
ALTER TABLE "inventory_movements"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_execution_entries"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_step_evidence"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_conditioning_team_members" FORCE ROW LEVEL SECURITY;
