-- DOWN de orders_drop_line_columns. Convencion del repo: Prisma Migrate no genera downs. Lo aplica
-- `pnpm run db:rollback`, que ejecuta este archivo entero en una sola transaccion.
--
-- Se niega, sin cambiar nada, si algun pedido tiene mas de una linea viva: `orders` solo puede
-- guardar una receta. Si no, devuelve a cada pedido los valores de su linea: la viva o, en un pedido
-- dado de baja, la ultima que se quito. Las columnas de etapa siguen al estado del pedido, igual
-- que cuando `orders` las copiaba de sus lineas.

ALTER TABLE "orders"      NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_lines" NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  varias bigint;
  sin_linea bigint;
BEGIN
  SELECT count(*) INTO varias
    FROM (SELECT 1 FROM "order_lines" WHERE "deleted_at" IS NULL
           GROUP BY "order_id" HAVING count(*) > 1) v;
  IF varias > 0 THEN
    RAISE EXCEPTION 'orders_drop_line_columns: % pedido(s) con mas de una linea viva; bajar perderia sus recetas', varias;
  END IF;
  SELECT count(*) INTO sin_linea
    FROM "orders" o
   WHERE NOT EXISTS (SELECT 1 FROM "order_lines" l WHERE l."order_id" = o."id");
  IF sin_linea > 0 THEN
    RAISE EXCEPTION 'orders_drop_line_columns: % pedido(s) sin ninguna linea; no hay receta que devolverles', sin_linea;
  END IF;
END $$;

ALTER TABLE "orders"
  ADD COLUMN "recipe_id" UUID,
  ADD COLUMN "quantity" DECIMAL(14,4),
  ADD COLUMN "unit_id" UUID,
  ADD COLUMN "ingredients_cost" DECIMAL(14,4),
  ADD COLUMN "packaging_cost" DECIMAL(14,4),
  ADD COLUMN "actual_cost" DECIMAL(14,4),
  ADD COLUMN "sale_price" DECIMAL(14,4),
  ADD COLUMN "reserved_at" TIMESTAMPTZ(6),
  ADD COLUMN "finished_at" TIMESTAMPTZ(6),
  ADD COLUMN "packed_by" UUID,
  ADD COLUMN "conditioned_by" UUID;

UPDATE "orders" o
   SET "recipe_id" = l."recipe_id",
       "quantity" = l."quantity",
       "unit_id" = l."unit_id",
       "ingredients_cost" = l."ingredients_cost",
       "packaging_cost" = l."packaging_cost",
       "sale_price" = l."sale_price",
       "reserved_at" = l."reserved_at",
       "packed_by" = CASE WHEN o."status"::text IN ('EN_EMPAQUE', 'POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO')
                          THEN l."packed_by" END,
       "conditioned_by" = CASE WHEN o."status"::text IN ('EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO')
                               THEN l."conditioned_by" END,
       "finished_at" = CASE WHEN o."status"::text IN ('TERMINADO', 'ENTREGADO') THEN l."finished_at" END,
       "actual_cost" = CASE WHEN o."status"::text IN ('POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO')
                            THEN l."actual_cost" END
  FROM (
    SELECT DISTINCT ON ("order_id") *
      FROM "order_lines"
     ORDER BY "order_id", "deleted_at" DESC NULLS FIRST, "position"
  ) l
 WHERE l."order_id" = o."id";

ALTER TABLE "orders" ALTER COLUMN "recipe_id" SET NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "quantity" SET NOT NULL;

ALTER TABLE "orders" ADD CONSTRAINT "orders_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_packaging_cost_matches_ingredients_cost"
  CHECK (("packaging_cost" IS NULL) = ("ingredients_cost" IS NULL));
ALTER TABLE "orders" ADD CONSTRAINT "orders_actual_cost_non_negative"
  CHECK ("actual_cost" IS NULL OR "actual_cost" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_actual_cost_requires_packed"
  CHECK ("actual_cost" IS NULL OR "status"::text IN
    ('POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO'));
ALTER TABLE "orders" ADD CONSTRAINT "orders_sale_price_non_negative"
  CHECK ("sale_price" IS NULL OR "sale_price" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_finished_at_requires_delivered"
  CHECK ("finished_at" IS NULL OR "status"::text IN ('TERMINADO', 'ENTREGADO'));
ALTER TABLE "orders" ADD CONSTRAINT "orders_finished_requires_finished_at"
  CHECK ("status"::text <> 'TERMINADO' OR "finished_at" IS NOT NULL);
ALTER TABLE "orders" ADD CONSTRAINT "orders_packed_by_matches_status" CHECK (
  ("status"::text NOT IN ('EN_EMPAQUE', 'POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO') OR "packed_by" IS NOT NULL)
  AND
  ("status"::text NOT IN ('PENDIENTE', 'EN_CURSO', 'POR_EMPACAR', 'CANCELADO') OR "packed_by" IS NULL)
);
ALTER TABLE "orders" ADD CONSTRAINT "orders_conditioned_by_matches_status" CHECK (
  ("status"::text NOT IN ('EN_ACONDICIONAMIENTO', 'TERMINADO') OR "conditioned_by" IS NOT NULL)
  AND
  ("status"::text NOT IN ('PENDIENTE', 'EN_CURSO', 'POR_EMPACAR', 'EN_EMPAQUE', 'POR_ACONDICIONAR', 'CANCELADO', 'BLOQUEADO') OR "conditioned_by" IS NULL)
);

ALTER TABLE "orders" ADD CONSTRAINT "orders_recipe_id_fkey"
  FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_packed_by_company_id_fkey"
  FOREIGN KEY ("packed_by", "company_id") REFERENCES "users"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_conditioned_by_company_id_fkey"
  FOREIGN KEY ("conditioned_by", "company_id") REFERENCES "users"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "orders_recipe_id_idx" ON "orders" ("recipe_id");
CREATE INDEX "orders_unit_id_idx" ON "orders" ("unit_id");
CREATE INDEX "orders_packed_by_idx" ON "orders" ("packed_by");
CREATE INDEX "orders_conditioned_by_idx" ON "orders" ("conditioned_by");
CREATE INDEX "orders_quantity_idx" ON "orders" ("quantity") WHERE "deleted_at" IS NULL;
CREATE INDEX "orders_expirable_idx" ON "orders" ("reserved_at")
  WHERE "status" = 'PENDIENTE' AND "deleted_at" IS NULL AND "reserved_at" IS NOT NULL;
CREATE INDEX "orders_company_finished_idx" ON "orders"
  ("company_id", "finished_at" DESC NULLS LAST, "order_year" DESC, "order_sequence" DESC)
  WHERE "deleted_at" IS NULL AND "status" = 'ENTREGADO';
CREATE INDEX "orders_company_terminated_idx" ON "orders"
  ("company_id", "finished_at" DESC NULLS LAST, "order_year" DESC, "order_sequence" DESC)
  WHERE "deleted_at" IS NULL AND "status" = 'TERMINADO';

DROP INDEX "order_lines_quantity_idx";

ALTER TABLE "orders"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_lines" FORCE ROW LEVEL SECURITY;
