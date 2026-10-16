-- Reversion exacta de `migration.sql`, en orden inverso. El pais que tuviera alguna empresa se
-- pierde.

ALTER TABLE "companies" DROP CONSTRAINT "companies_country_format";

ALTER TABLE "companies" DROP COLUMN "country";
