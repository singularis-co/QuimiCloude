-- Telefono internacional del cliente. Las tres columnas nacen nulas y sin DEFAULT: ninguna fila
-- existente se reescribe aqui. Las rellena despues un script en TypeScript, porque interpretar el
-- texto libre antiguo necesita libphonenumber-js.
--
-- Los CHECK y el indice parcial van a mano y son drift: Prisma no sabe expresarlos. Los CHECK
-- vigilan solo el formato; la lista de paises cambia con la version de la libreria y la valida el
-- dominio.

-- AlterTable
ALTER TABLE "customers" ADD COLUMN "phone_country" VARCHAR(2);

ALTER TABLE "customers" ADD COLUMN "phone_e164" VARCHAR(15);

ALTER TABLE "customers" ADD COLUMN "phone_issue" VARCHAR(20);

ALTER TABLE "customers" ADD CONSTRAINT "customers_phone_country_format_check"
  CHECK ("phone_country" IS NULL OR "phone_country" ~ '^[A-Z]{2}$');

-- Solo digitos, sin '+': el mismo formato que el identificador que manda WhatsApp.
ALTER TABLE "customers" ADD CONSTRAINT "customers_phone_e164_format_check"
  CHECK ("phone_e164" IS NULL OR "phone_e164" ~ '^[1-9][0-9]{6,14}$');

ALTER TABLE "customers" ADD CONSTRAINT "customers_phone_issue_check"
  CHECK ("phone_issue" IS NULL OR "phone_issue" IN ('invalid_format', 'duplicate'));

ALTER TABLE "customers" ADD CONSTRAINT "customers_phone_coherence_check"
  CHECK (
    ("phone_e164" IS NULL OR ("phone_country" IS NOT NULL AND "phone_issue" IS NULL))
    AND ("phone_issue" IS NULL OR ("phone" IS NOT NULL AND "phone_e164" IS NULL))
  );

-- CreateIndex
CREATE UNIQUE INDEX "customers_company_phone_e164_key"
  ON "customers" ("company_id", "phone_e164")
  WHERE "deleted_at" IS NULL AND "phone_e164" IS NOT NULL;
