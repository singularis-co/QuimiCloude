-- DOWN de conditioning_steps. Convencion del repo: Prisma Migrate no genera downs. Lo aplica
-- `pnpm run db:rollback`, que ejecuta este archivo entero en una sola transaccion. Va antes del
-- down de conditioning_step_actions.

DROP INDEX "order_execution_entries_conditioning_step_once";
ALTER TABLE "order_execution_entries" DROP CONSTRAINT "order_execution_entries_responsibles_non_empty_array";
ALTER TABLE "order_execution_entries" DROP CONSTRAINT "order_execution_entries_responsibles_matches_action";
ALTER TABLE "order_execution_entries" DROP CONSTRAINT "order_execution_entries_conditioning_step_has_position";
ALTER TABLE "order_execution_entries" DROP COLUMN "responsible_user_ids";
ALTER TABLE "recipes" DROP COLUMN "conditioning_steps";
