-- Reversion exacta de `migration.sql`, en orden inverso. El historial y la identificacion y el
-- contacto que tuviera alguna empresa se pierden.

DROP TABLE "company_events";

DROP INDEX "companies_tax_id_unique";

ALTER TABLE "companies" DROP CONSTRAINT "companies_tax_id_normalized_format";

ALTER TABLE "companies" DROP CONSTRAINT "companies_tax_id_pair";

ALTER TABLE "companies"
  DROP COLUMN "contact_phone",
  DROP COLUMN "contact_email",
  DROP COLUMN "tax_id_normalized",
  DROP COLUMN "tax_id";
