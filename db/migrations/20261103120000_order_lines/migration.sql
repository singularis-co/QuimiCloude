-- Las recetas de un pedido: cada linea lleva su receta, su cantidad, su estado, sus costes, su
-- precio y su plazo de reserva. Escrita a mano: las FK compuestas, los CHECK y los indices
-- parciales no los genera Prisma y son drift. Se aplica con `pnpm run db:migrate`, en una sola
-- transaccion.
--
-- Las columnas de `orders` que pasan a la linea siguen ahi: las quita una migracion posterior,
-- cuando ya nadie las lee.

-- ---------------------------------------------------------------------------------------
-- 1. La tabla.
-- ---------------------------------------------------------------------------------------
CREATE TABLE "order_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "recipe_id" UUID NOT NULL,
    "original_recipe_id" UUID NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit_id" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDIENTE',
    "cancellation_reason" TEXT,
    "ingredients_cost" DECIMAL(14,4),
    "packaging_cost" DECIMAL(14,4),
    "actual_cost" DECIMAL(14,4),
    "sale_price" DECIMAL(14,4),
    "reserved_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "packed_by" UUID,
    "conditioned_by" UUID,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------------------
-- 2. CHECK. Los de estado comparan "status"::text: un down que recrea el enum no puede comparar
--    el tipo viejo con el nuevo.
-- ---------------------------------------------------------------------------------------
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_status_not_partial"
  CHECK ("status"::text <> 'PARCIAL');
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_position_non_negative"
  CHECK ("position" >= 0);
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_quantity_positive"
  CHECK ("quantity" > 0);
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_cancellation_reason_matches_status"
  CHECK (("status"::text = 'CANCELADO') = ("cancellation_reason" IS NOT NULL));
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_packaging_cost_matches_ingredients_cost"
  CHECK (("packaging_cost" IS NULL) = ("ingredients_cost" IS NULL));
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_actual_cost_non_negative"
  CHECK ("actual_cost" IS NULL OR "actual_cost" >= 0);
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_actual_cost_requires_packed"
  CHECK ("actual_cost" IS NULL OR "status"::text IN
    ('POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO'));
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_sale_price_non_negative"
  CHECK ("sale_price" IS NULL OR "sale_price" >= 0);
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_finished_at_requires_delivered"
  CHECK ("finished_at" IS NULL OR "status"::text IN ('TERMINADO', 'ENTREGADO'));
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_finished_requires_finished_at"
  CHECK ("status"::text <> 'TERMINADO' OR "finished_at" IS NOT NULL);
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_delivered_not_deleted"
  CHECK ("deleted_at" IS NULL OR "status"::text NOT IN ('ENTREGADO', 'CANCELADO', 'POR_EMPACAR', 'EN_EMPAQUE', 'POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO'));
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_packed_by_matches_status" CHECK (
  ("status"::text NOT IN ('EN_EMPAQUE', 'POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO') OR "packed_by" IS NOT NULL)
  AND
  ("status"::text NOT IN ('PENDIENTE', 'EN_CURSO', 'POR_EMPACAR', 'CANCELADO') OR "packed_by" IS NULL)
);
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_conditioned_by_matches_status" CHECK (
  ("status"::text NOT IN ('EN_ACONDICIONAMIENTO', 'TERMINADO') OR "conditioned_by" IS NOT NULL)
  AND
  ("status"::text NOT IN ('PENDIENTE', 'EN_CURSO', 'POR_EMPACAR', 'EN_EMPAQUE', 'POR_ACONDICIONAR', 'CANCELADO', 'BLOQUEADO') OR "conditioned_by" IS NULL)
);

-- ---------------------------------------------------------------------------------------
-- 3. Unicos e indices.
-- ---------------------------------------------------------------------------------------
CREATE UNIQUE INDEX "order_lines_order_id_position_key" ON "order_lines" ("order_id", "position");
CREATE UNIQUE INDEX "order_lines_id_company_id_key" ON "order_lines" ("id", "company_id");
CREATE UNIQUE INDEX "order_lines_id_order_id_key" ON "order_lines" ("id", "order_id");

-- La original y sus versiones son la misma receta; una linea cancelada o quitada la libera.
CREATE UNIQUE INDEX "order_lines_order_original_recipe_active_key"
  ON "order_lines" ("order_id", "original_recipe_id")
  WHERE "deleted_at" IS NULL AND "status" <> 'CANCELADO';

CREATE INDEX "order_lines_company_id_idx" ON "order_lines" ("company_id");
CREATE INDEX "order_lines_recipe_id_idx" ON "order_lines" ("recipe_id");
CREATE INDEX "order_lines_original_recipe_id_idx" ON "order_lines" ("original_recipe_id");
CREATE INDEX "order_lines_unit_id_idx" ON "order_lines" ("unit_id");
CREATE INDEX "order_lines_packed_by_idx" ON "order_lines" ("packed_by");
CREATE INDEX "order_lines_conditioned_by_idx" ON "order_lines" ("conditioned_by");
CREATE INDEX "order_lines_created_by_idx" ON "order_lines" ("created_by");
CREATE INDEX "order_lines_updated_by_idx" ON "order_lines" ("updated_by");
CREATE INDEX "order_lines_company_status_idx" ON "order_lines" ("company_id", "status")
  WHERE "deleted_at" IS NULL;
CREATE INDEX "order_lines_order_status_idx" ON "order_lines" ("order_id", "status")
  WHERE "deleted_at" IS NULL;
-- El proceso diario de caducidad recorre, por empresa, las lineas pendientes con plazo.
CREATE INDEX "order_lines_expirable_idx" ON "order_lines" ("company_id", "reserved_at")
  WHERE "status" = 'PENDIENTE' AND "deleted_at" IS NULL;

-- ---------------------------------------------------------------------------------------
-- 4. FK. La del pedido es compuesta con la empresa: una linea no puede ser de otra empresa que
--    su pedido.
-- ---------------------------------------------------------------------------------------
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_company_id_fkey"
  FOREIGN KEY ("order_id", "company_id") REFERENCES "orders"("id", "company_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- `recipes` no tiene clave `(id, company_id)`: FK simple, como `orders_recipe_id_fkey`.
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_recipe_id_fkey"
  FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_original_recipe_id_fkey"
  FOREIGN KEY ("original_recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_packed_by_company_id_fkey"
  FOREIGN KEY ("packed_by", "company_id") REFERENCES "users"("id", "company_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_conditioned_by_company_id_fkey"
  FOREIGN KEY ("conditioned_by", "company_id") REFERENCES "users"("id", "company_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------
-- 5. Relleno: una linea por pedido, borrados incluidos, con los valores tal cual. Parentesis de
--    RLS: con RLS forzada y sin policies, el dueno no ve ninguna fila.
-- ---------------------------------------------------------------------------------------
ALTER TABLE "orders"  NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "recipes" NO FORCE ROW LEVEL SECURITY;

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
JOIN "recipes" r ON r."id" = o."recipe_id";

DO $$
DECLARE pedidos bigint; lineas bigint;
BEGIN
  SELECT count(*) INTO pedidos FROM "orders";
  SELECT count(*) INTO lineas FROM "order_lines";
  IF pedidos <> lineas THEN
    RAISE EXCEPTION 'order_lines: % pedido(s) y % linea(s) tras el relleno', pedidos, lineas;
  END IF;
END $$;

ALTER TABLE "orders"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "recipes" FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------------------
-- 6. RLS activada y forzada, sin policies, como `orders`: la autorizacion vive en el caso de uso.
-- ---------------------------------------------------------------------------------------
ALTER TABLE "order_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_lines" FORCE ROW LEVEL SECURITY;
