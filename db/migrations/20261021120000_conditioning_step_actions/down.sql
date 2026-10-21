-- DOWN de conditioning_step_actions. Convencion del repo: Prisma Migrate no genera downs. Lo aplica
-- `pnpm run db:rollback`, que ejecuta este archivo entero en una sola transaccion. Va despues del
-- down de conditioning_steps, que quita los CHECK y el indice que nombran los valores nuevos.
--
-- `ALTER TYPE ... DROP VALUE` no existe en Postgres: hay que recrear los dos tipos. Los CHECK que
-- nombran "action" caen antes del cambio de tipo y se recrean despues con su texto literal.

-- 0. Una anotacion de paso de acondicionamiento o una foto de esa fase no tienen equivalente entre
--    los valores de antes.
DO $$
DECLARE
  anotaciones bigint;
  fotos bigint;
BEGIN
  SELECT count(*) INTO anotaciones
    FROM "order_execution_entries"
    WHERE "action"::text IN ('CONDITIONING_STEP_ADVANCE', 'CONDITIONING_STEPS_COMPLETE', 'CONDITIONING_RESPONSIBLES_CHANGE');
  IF anotaciones > 0 THEN
    RAISE EXCEPTION 'ROLLBACK ABORTADO: hay % anotacion(es) de pasos de acondicionamiento en '
      'order_execution_entries. Revertir esta migracion las dejaria sin una accion valida.',
      anotaciones;
  END IF;

  SELECT count(*) INTO fotos
    FROM "order_step_evidence"
    WHERE "phase"::text = 'CONDITIONING';
  IF fotos > 0 THEN
    RAISE EXCEPTION 'ROLLBACK ABORTADO: hay % foto(s) de acondicionamiento en '
      'order_step_evidence. Revertir esta migracion las dejaria sin una fase valida.',
      fotos;
  END IF;
END $$;

-- 1. Los CHECK que nombran "action".
ALTER TABLE "order_execution_entries" DROP CONSTRAINT "order_execution_entries_reason_matches_action";
ALTER TABLE "order_execution_entries" DROP CONSTRAINT "order_execution_entries_packing_has_no_step";
ALTER TABLE "order_execution_entries" DROP CONSTRAINT "order_execution_entries_batch_lines_matches_action";
ALTER TABLE "order_execution_entries" DROP CONSTRAINT "order_execution_entries_conditioning_has_no_step";

-- 2. Los dos tipos, con los valores de antes de esta migracion.
ALTER TYPE "OrderExecutionAction" RENAME TO "OrderExecutionAction_old";
CREATE TYPE "OrderExecutionAction" AS ENUM ('START', 'RESUME', 'ADVANCE', 'GO_BACK', 'CANCEL', 'FINISH', 'PACK_START', 'PACK_FINISH', 'CONDITIONING_START', 'CONDITIONING_BATCH_SAVE', 'CONDITIONING_FINISH');
ALTER TABLE "order_execution_entries" ALTER COLUMN "action" TYPE "OrderExecutionAction"
  USING ("action"::text::"OrderExecutionAction");
DROP TYPE "OrderExecutionAction_old";

ALTER TYPE "evidence_phase" RENAME TO "evidence_phase_old";
CREATE TYPE "evidence_phase" AS ENUM ('MANUFACTURING', 'PACKING');
ALTER TABLE "order_step_evidence" ALTER COLUMN "phase" TYPE "evidence_phase"
  USING ("phase"::text::"evidence_phase");
DROP TYPE "evidence_phase_old";

-- 3. Los CHECK, con su texto literal de antes de esta migracion.
ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_reason_matches_action"
  CHECK (("action"::text = 'CANCEL') = ("reason" IS NOT NULL));
ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_packing_has_no_step"
  CHECK ("action"::text NOT IN ('PACK_START','PACK_FINISH') OR "step_position" IS NULL);
ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_batch_lines_matches_action"
  CHECK (("action"::text = 'CONDITIONING_BATCH_SAVE') = ("batch_lines" IS NOT NULL));
ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_conditioning_has_no_step"
  CHECK ("action"::text NOT IN ('CONDITIONING_START','CONDITIONING_BATCH_SAVE','CONDITIONING_FINISH') OR "step_position" IS NULL);
