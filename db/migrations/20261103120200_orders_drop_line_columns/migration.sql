-- `orders` deja de guardar lo que es de cada receta: receta, cantidad, unidad, costes, precio, plazo
-- de reserva, fecha de terminado y quien empaca y acondiciona viven ya en `order_lines`. Escrita a
-- mano: los CHECK, las FK y los indices parciales son drift para Prisma.
--
-- Va la ultima de la serie: el relleno de `order_lines_references_required` lee estas columnas.

-- ---------------------------------------------------------------------------------------
-- 1. CHECK, FK e indices de las columnas que se van.
-- ---------------------------------------------------------------------------------------
ALTER TABLE "orders" DROP CONSTRAINT "orders_quantity_positive";
ALTER TABLE "orders" DROP CONSTRAINT "orders_packaging_cost_matches_ingredients_cost";
ALTER TABLE "orders" DROP CONSTRAINT "orders_actual_cost_non_negative";
ALTER TABLE "orders" DROP CONSTRAINT "orders_actual_cost_requires_packed";
ALTER TABLE "orders" DROP CONSTRAINT "orders_sale_price_non_negative";
ALTER TABLE "orders" DROP CONSTRAINT "orders_finished_at_requires_delivered";
ALTER TABLE "orders" DROP CONSTRAINT "orders_finished_requires_finished_at";
ALTER TABLE "orders" DROP CONSTRAINT "orders_packed_by_matches_status";
ALTER TABLE "orders" DROP CONSTRAINT "orders_conditioned_by_matches_status";

ALTER TABLE "orders" DROP CONSTRAINT "orders_recipe_id_fkey";
ALTER TABLE "orders" DROP CONSTRAINT "orders_unit_id_fkey";
ALTER TABLE "orders" DROP CONSTRAINT "orders_packed_by_company_id_fkey";
ALTER TABLE "orders" DROP CONSTRAINT "orders_conditioned_by_company_id_fkey";

DROP INDEX "orders_recipe_id_idx";
DROP INDEX "orders_unit_id_idx";
DROP INDEX "orders_packed_by_idx";
DROP INDEX "orders_conditioned_by_idx";
DROP INDEX "orders_quantity_idx";
DROP INDEX "orders_expirable_idx";
DROP INDEX "orders_company_finished_idx";
DROP INDEX "orders_company_terminated_idx";

-- ---------------------------------------------------------------------------------------
-- 2. Las columnas.
-- ---------------------------------------------------------------------------------------
ALTER TABLE "orders"
  DROP COLUMN "recipe_id",
  DROP COLUMN "quantity",
  DROP COLUMN "unit_id",
  DROP COLUMN "ingredients_cost",
  DROP COLUMN "packaging_cost",
  DROP COLUMN "actual_cost",
  DROP COLUMN "sale_price",
  DROP COLUMN "reserved_at",
  DROP COLUMN "finished_at",
  DROP COLUMN "packed_by",
  DROP COLUMN "conditioned_by";

-- ---------------------------------------------------------------------------------------
-- 3. El indice de listado por cantidad pasa a la linea.
-- ---------------------------------------------------------------------------------------
CREATE INDEX "order_lines_quantity_idx" ON "order_lines" ("quantity") WHERE "deleted_at" IS NULL;
