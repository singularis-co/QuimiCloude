-- DOWN de order_execution_conditioning_actions. Convencion del repo: Prisma Migrate no genera
-- downs. Lo aplica `pnpm run db:rollback`, que ejecuta este archivo entero en una sola transaccion.
-- Va despues del down de order_execution_batch_lines, que quita los CHECK que nombran los valores.
--
-- `ALTER TYPE ... DROP VALUE` no existe en Postgres: hay que recrear el tipo. Los CHECK que nombran
-- "action" caen antes del cambio de tipo y se recrean despues con su texto literal.

-- 0. Una anotacion de acondicionamiento no tiene equivalente entre las ocho acciones de antes.
DO $$
DECLARE anotaciones bigint;
BEGIN
  SELECT count(*) INTO anotaciones
    FROM "order_execution_entries"
    WHERE "action"::text IN ('CONDITIONING_START', 'CONDITIONING_BATCH_SAVE', 'CONDITIONING_FINISH');
  IF anotaciones > 0 THEN
    RAISE EXCEPTION 'ROLLBACK ABORTADO: hay % anotacion(es) de acondicionamiento en '
      'order_execution_entries. Revertir esta migracion las dejaria sin una accion valida.',
      anotaciones;
  END IF;
END $$;

-- 1. Los CHECK que nombran "action".
ALTER TABLE "order_execution_entries" DROP CONSTRAINT "order_execution_entries_reason_matches_action";
ALTER TABLE "order_execution_entries" DROP CONSTRAINT "order_execution_entries_packing_has_no_step";

-- 2. El tipo, con los ocho valores de antes de esta migracion.
ALTER TYPE "OrderExecutionAction" RENAME TO "OrderExecutionAction_old";
CREATE TYPE "OrderExecutionAction" AS ENUM ('START', 'RESUME', 'ADVANCE', 'GO_BACK', 'CANCEL', 'FINISH', 'PACK_START', 'PACK_FINISH');
ALTER TABLE "order_execution_entries" ALTER COLUMN "action" TYPE "OrderExecutionAction"
  USING ("action"::text::"OrderExecutionAction");
DROP TYPE "OrderExecutionAction_old";

-- 3. Los CHECK, con su texto literal de antes de esta migracion.
ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_reason_matches_action"
  CHECK (("action"::text = 'CANCEL') = ("reason" IS NOT NULL));
ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_packing_has_no_step"
  CHECK ("action"::text NOT IN ('PACK_START','PACK_FINISH') OR "step_position" IS NULL);
