-- Reversion exacta de `migration.sql`, en orden inverso.

ALTER TABLE "order_presentation_lines" DROP CONSTRAINT "order_presentation_lines_packed_reason_other_matches";
ALTER TABLE "order_presentation_lines" DROP CONSTRAINT "order_presentation_lines_packed_reason_matches_count";
ALTER TABLE "order_presentation_lines" DROP CONSTRAINT "order_presentation_lines_packed_reason_in_catalog";
ALTER TABLE "order_presentation_lines" DROP CONSTRAINT "order_presentation_lines_packed_packages_non_negative";

ALTER TABLE "order_presentation_lines" DROP COLUMN "packed_reason_other",
DROP COLUMN "packed_reason",
DROP COLUMN "packed_packages";
