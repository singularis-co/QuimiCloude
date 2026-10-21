-- Reversion exacta de `migration.sql`, en orden inverso.

ALTER TABLE "order_presentation_lines" DROP CONSTRAINT "order_presentation_lines_packed_surplus_within_excess";
ALTER TABLE "order_presentation_lines" DROP COLUMN "packed_surplus_packages";
