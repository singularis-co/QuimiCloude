-- DOWN de order_execution_batch_lines. Convencion del repo: Prisma Migrate no genera downs. Lo
-- aplica `pnpm run db:rollback`, que ejecuta este archivo entero en una sola transaccion. Va antes
-- del down de order_execution_conditioning_actions.

ALTER TABLE "order_execution_entries" DROP CONSTRAINT "order_execution_entries_conditioning_has_no_step";
ALTER TABLE "order_execution_entries" DROP CONSTRAINT "order_execution_entries_batch_lines_non_empty_array";
ALTER TABLE "order_execution_entries" DROP CONSTRAINT "order_execution_entries_batch_lines_matches_action";
ALTER TABLE "order_execution_entries" DROP COLUMN "batch_lines";
