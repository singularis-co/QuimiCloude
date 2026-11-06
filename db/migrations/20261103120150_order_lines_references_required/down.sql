-- DOWN de order_lines_references_required. Convencion del repo: Prisma Migrate no genera downs. Lo
-- aplica `pnpm run db:rollback`, que ejecuta este archivo entero en una sola transaccion.
--
-- Se niega si volver a los unicos y la PK por pedido chocaria: dos lineas del mismo pedido que
-- repiten presentacion, slot de evidencia o persona o posicion del equipo. Si no, deja la columna
-- nullable con el CHECK del paso anterior.

ALTER TABLE "order_presentation_lines"        NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_step_evidence"             NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_conditioning_team_members" NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE choques bigint;
BEGIN
  SELECT
    (SELECT count(*) FROM (SELECT 1 FROM "order_presentation_lines"
                            GROUP BY "order_id", "presentation_id" HAVING count(*) > 1) r)
  + (SELECT count(*) FROM (SELECT 1 FROM "order_step_evidence"
                            GROUP BY "order_id", "phase", "step_position", "slot" HAVING count(*) > 1) e)
  + (SELECT count(*) FROM (SELECT 1 FROM "order_conditioning_team_members"
                            GROUP BY "order_id", "user_id" HAVING count(*) > 1) p)
  + (SELECT count(*) FROM (SELECT 1 FROM "order_conditioning_team_members"
                            GROUP BY "order_id", "position" HAVING count(*) > 1) q)
  INTO choques;
  IF choques > 0 THEN
    RAISE EXCEPTION 'order_lines_references_required: % choque(s) con los unicos por pedido; bajar perderia filas de un pedido con varias lineas', choques;
  END IF;
END $$;

ALTER TABLE "order_presentation_lines"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_step_evidence"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_conditioning_team_members" FORCE ROW LEVEL SECURITY;

DROP INDEX "order_conditioning_team_members_order_line_id_position_key";
CREATE UNIQUE INDEX "order_conditioning_team_members_order_id_position_key"
  ON "order_conditioning_team_members" ("order_id", "position");
ALTER TABLE "order_conditioning_team_members" DROP CONSTRAINT "order_conditioning_team_members_pkey";
ALTER TABLE "order_conditioning_team_members" ADD CONSTRAINT "order_conditioning_team_members_pkey"
  PRIMARY KEY ("order_id", "user_id");

DROP INDEX "order_step_evidence_slot_key";
CREATE UNIQUE INDEX "order_step_evidence_slot_key"
  ON "order_step_evidence" ("order_id", "phase", "step_position", "slot");

DROP INDEX "order_presentation_lines_order_line_id_presentation_id_key";
CREATE UNIQUE INDEX "order_presentation_lines_order_id_presentation_id_key"
  ON "order_presentation_lines" ("order_id", "presentation_id");

ALTER TABLE "order_presentation_lines"        DROP CONSTRAINT "order_presentation_lines_order_line_id_order_id_fkey";
ALTER TABLE "reservation_movements"           DROP CONSTRAINT "reservation_movements_order_line_id_order_id_fkey";
ALTER TABLE "inventory_movements"             DROP CONSTRAINT "inventory_movements_order_line_id_order_id_fkey";
ALTER TABLE "order_execution_entries"         DROP CONSTRAINT "order_execution_entries_order_line_id_order_id_fkey";
ALTER TABLE "order_step_evidence"             DROP CONSTRAINT "order_step_evidence_order_line_id_order_id_fkey";
ALTER TABLE "order_conditioning_team_members" DROP CONSTRAINT "order_conditioning_team_members_order_line_id_order_id_fkey";

ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_order_line_id_matches_kind";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_line_id_matches_kind"
  CHECK ("order_line_id" IS NULL
      OR "kind"::text IN ('consumption', 'production', 'delivery', 'delivery_void'));

ALTER TABLE "order_presentation_lines"        ALTER COLUMN "order_line_id" DROP NOT NULL;
ALTER TABLE "reservation_movements"           ALTER COLUMN "order_line_id" DROP NOT NULL;
ALTER TABLE "order_execution_entries"         ALTER COLUMN "order_line_id" DROP NOT NULL;
ALTER TABLE "order_step_evidence"             ALTER COLUMN "order_line_id" DROP NOT NULL;
ALTER TABLE "order_conditioning_team_members" ALTER COLUMN "order_line_id" DROP NOT NULL;
