-- Pais de la empresa (ISO 3166-1 alfa-2). Anulable y sin DEFAULT: ninguna fila existente se
-- reescribe y todas quedan sin pais.
--
-- El CHECK va a mano y es drift: Prisma no lo regenera. Vigila solo el formato; la lista de paises
-- cambia con la version de la libreria y la valida el dominio.

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "country" VARCHAR(2);

ALTER TABLE "companies" ADD CONSTRAINT "companies_country_format"
  CHECK ("country" IS NULL OR "country" ~ '^[A-Z]{2}$');
