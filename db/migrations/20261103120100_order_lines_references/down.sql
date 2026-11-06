-- DOWN de order_lines_references. Convencion del repo: Prisma Migrate no genera downs. Lo aplica
-- `pnpm run db:rollback`, que ejecuta este archivo entero en una sola transaccion.
--
-- Se niega si alguna fila con linea es de un pedido con varias lineas: sin la columna se perderia
-- a que receta va. Si no, la linea de cada fila es la unica de su pedido y se puede quitar.

ALTER TABLE "order_lines"                     NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_presentation_lines"        NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "reservation_movements"           NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "inventory_movements"             NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_execution_entries"         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_step_evidence"             NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_conditioning_team_members" NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE filas bigint;
BEGIN
  WITH varias AS (
    SELECT "order_id" FROM "order_lines" GROUP BY "order_id" HAVING count(*) > 1
  ),
  con_linea AS (
    SELECT "order_id" FROM "order_presentation_lines" WHERE "order_line_id" IS NOT NULL
    UNION ALL
    SELECT "order_id" FROM "reservation_movements" WHERE "order_line_id" IS NOT NULL
    UNION ALL
    SELECT "order_id" FROM "inventory_movements" WHERE "order_line_id" IS NOT NULL
    UNION ALL
    SELECT "order_id" FROM "order_execution_entries" WHERE "order_line_id" IS NOT NULL
    UNION ALL
    SELECT "order_id" FROM "order_step_evidence" WHERE "order_line_id" IS NOT NULL
    UNION ALL
    SELECT "order_id" FROM "order_conditioning_team_members" WHERE "order_line_id" IS NOT NULL
  )
  SELECT count(*) INTO filas FROM con_linea c JOIN varias v ON v."order_id" = c."order_id";
  IF filas > 0 THEN
    RAISE EXCEPTION 'order_lines_references: % fila(s) con linea son de un pedido con varias lineas; bajar perderia a que receta van', filas;
  END IF;
END $$;

ALTER TABLE "order_lines"                     FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_presentation_lines"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "reservation_movements"           FORCE ROW LEVEL SECURITY;
ALTER TABLE "inventory_movements"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_execution_entries"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_step_evidence"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_conditioning_team_members" FORCE ROW LEVEL SECURITY;

ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_order_line_id_matches_kind";

DROP INDEX "order_presentation_lines_order_line_id_idx";
DROP INDEX "reservation_movements_order_line_id_idx";
DROP INDEX "inventory_movements_order_line_id_idx";
DROP INDEX "order_execution_entries_order_line_id_idx";
DROP INDEX "order_step_evidence_order_line_id_idx";
DROP INDEX "order_conditioning_team_members_order_line_id_idx";

ALTER TABLE "order_presentation_lines"        DROP COLUMN "order_line_id";
ALTER TABLE "reservation_movements"           DROP COLUMN "order_line_id";
ALTER TABLE "inventory_movements"             DROP COLUMN "order_line_id";
ALTER TABLE "order_execution_entries"         DROP COLUMN "order_line_id";
ALTER TABLE "order_step_evidence"             DROP COLUMN "order_line_id";
ALTER TABLE "order_conditioning_team_members" DROP COLUMN "order_line_id";
