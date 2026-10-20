-- Reversion exacta de `migration.sql`, en orden inverso. Lo que el relleno escribio se pierde con
-- las columnas; `phone` no se toca en ningun sentido.

DROP INDEX "customers_company_phone_e164_key";

ALTER TABLE "customers" DROP CONSTRAINT "customers_phone_coherence_check";

ALTER TABLE "customers" DROP CONSTRAINT "customers_phone_issue_check";

ALTER TABLE "customers" DROP CONSTRAINT "customers_phone_e164_format_check";

ALTER TABLE "customers" DROP CONSTRAINT "customers_phone_country_format_check";

ALTER TABLE "customers" DROP COLUMN "phone_issue";

ALTER TABLE "customers" DROP COLUMN "phone_e164";

ALTER TABLE "customers" DROP COLUMN "phone_country";
