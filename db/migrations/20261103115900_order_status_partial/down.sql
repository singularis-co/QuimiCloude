-- DOWN de order_status_partial. Convencion del repo: Prisma Migrate no genera downs. Lo aplica
-- `pnpm run db:rollback`, que ejecuta este archivo entero en una sola transaccion.
--
-- `ALTER TYPE ... DROP VALUE` no existe en Postgres: quitar PARCIAL obliga a recrear el tipo. Los
-- CHECK e indices que nombran "status" caen antes del cambio de tipo y se recrean despues con su
-- texto de antes de esta migracion. `order_lines` ya no existe: la quita antes su propio DOWN.

-- 0. Un pedido PARCIAL no tiene a que estado volver. Si hay alguno, la reversion aborta entera.
DO $$
DECLARE parciales bigint;
BEGIN
  SELECT count(*) INTO parciales
    FROM "orders" WHERE "status"::text = 'PARCIAL';
  IF parciales > 0 THEN
    RAISE EXCEPTION 'ROLLBACK ABORTADO: hay % pedido(s) en PARCIAL. '
      'Revertir esta migracion los dejaria sin un estado valido. Resuelve sus lineas '
      'y vuelve a intentarlo.', parciales;
  END IF;
END $$;

-- 1. Los CHECK que nombran "status".
ALTER TABLE "orders" DROP CONSTRAINT "orders_actual_cost_requires_packed";
ALTER TABLE "orders" DROP CONSTRAINT "orders_finished_requires_finished_at";
ALTER TABLE "orders" DROP CONSTRAINT "orders_conditioned_by_matches_status";
ALTER TABLE "orders" DROP CONSTRAINT "orders_packed_by_matches_status";
ALTER TABLE "orders" DROP CONSTRAINT "orders_delivered_not_deleted";
ALTER TABLE "orders" DROP CONSTRAINT "orders_finished_at_requires_delivered";
ALTER TABLE "orders" DROP CONSTRAINT "orders_cancellation_reason_matches_status";

-- 2. Los indices que nombran "status".
DROP INDEX "orders_status_idx";
DROP INDEX "orders_expirable_idx";
DROP INDEX "orders_company_finished_idx";
DROP INDEX "orders_blocked_company_created_idx";
DROP INDEX "orders_company_terminated_idx";

-- 3. El tipo, con los diez valores de antes y en su orden. El DEFAULT cae y vuelve porque
--    Postgres no sabe recastear un default de un tipo que esta cambiando.
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
CREATE TYPE "OrderStatus" AS ENUM ('PENDIENTE', 'EN_CURSO', 'ENTREGADO', 'CANCELADO', 'POR_EMPACAR', 'EN_EMPAQUE', 'BLOQUEADO', 'POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO');
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "status" TYPE "OrderStatus"
  USING ("status"::text::"OrderStatus");
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDIENTE';
DROP TYPE "OrderStatus_old";

-- 4. Los CHECK.
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancellation_reason_matches_status"
  CHECK (("status"::text = 'CANCELADO') = ("cancellation_reason" IS NOT NULL));
ALTER TABLE "orders" ADD CONSTRAINT "orders_finished_at_requires_delivered"
  CHECK ("finished_at" IS NULL OR "status"::text IN ('TERMINADO', 'ENTREGADO'));
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivered_not_deleted"
  CHECK ("deleted_at" IS NULL OR "status"::text NOT IN ('ENTREGADO', 'CANCELADO', 'POR_EMPACAR', 'EN_EMPAQUE', 'POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO'));
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
ALTER TABLE "orders" ADD CONSTRAINT "orders_finished_requires_finished_at"
  CHECK ("status"::text <> 'TERMINADO' OR "finished_at" IS NOT NULL);
ALTER TABLE "orders" ADD CONSTRAINT "orders_actual_cost_requires_packed"
  CHECK ("actual_cost" IS NULL OR "status"::text IN
    ('POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO'));

-- 5. Los indices.
CREATE INDEX "orders_status_idx" ON "orders" ("status") WHERE "deleted_at" IS NULL;
CREATE INDEX "orders_expirable_idx" ON "orders" ("reserved_at")
  WHERE "status" = 'PENDIENTE' AND "deleted_at" IS NULL AND "reserved_at" IS NOT NULL;
CREATE INDEX "orders_company_finished_idx"
  ON "orders" ("company_id", "finished_at" DESC NULLS LAST, "order_year" DESC, "order_sequence" DESC)
  WHERE "deleted_at" IS NULL AND "status" = 'ENTREGADO';
CREATE INDEX "orders_blocked_company_created_idx"
  ON "orders" ("company_id", "created_at", "id")
  WHERE "status" = 'BLOQUEADO' AND "deleted_at" IS NULL;
CREATE INDEX "orders_company_terminated_idx"
  ON "orders" ("company_id", "finished_at" DESC NULLS LAST, "order_year" DESC, "order_sequence" DESC)
  WHERE "deleted_at" IS NULL AND "status" = 'TERMINADO';
