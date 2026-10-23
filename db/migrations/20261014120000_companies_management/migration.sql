-- Identificacion fiscal y contacto de la empresa, e historial de eventos por empresa.
--
-- Columnas anulables y sin DEFAULT: ninguna fila existente se reescribe. Los dos CHECK y el indice
-- parcial van a mano y son drift: Prisma no los regenera.

-- AlterTable
ALTER TABLE "companies"
  ADD COLUMN "tax_id" TEXT,
  ADD COLUMN "tax_id_normalized" TEXT,
  ADD COLUMN "contact_email" TEXT,
  ADD COLUMN "contact_phone" TEXT;

ALTER TABLE "companies" ADD CONSTRAINT "companies_tax_id_pair"
  CHECK (("tax_id" IS NULL) = ("tax_id_normalized" IS NULL));
ALTER TABLE "companies" ADD CONSTRAINT "companies_tax_id_normalized_format"
  CHECK ("tax_id_normalized" IS NULL OR "tax_id_normalized" ~ '^[a-z0-9]+$');

-- Parcial sobre vivas, como `companies_name_unique`. Sin `lower(...)`: el CHECK de formato ya
-- obliga a minusculas.
CREATE UNIQUE INDEX "companies_tax_id_unique" ON "companies" ("tax_id_normalized")
  WHERE "deleted_at" IS NULL AND "tax_id_normalized" IS NOT NULL;

-- CreateTable
-- El CHECK vigila la forma del tipo y no la lista: un tipo nuevo no pide migrar.
CREATE TABLE "company_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "actor_id" UUID NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "details" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_events_kind_format" CHECK ("kind" ~ '^[a-z][a-z_]*\.[a-z][a-z_]*$')
);

-- CreateIndex
CREATE INDEX "company_events_company_id_occurred_at_idx"
  ON "company_events" ("company_id", "occurred_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "company_events_actor_id_idx" ON "company_events" ("actor_id");

-- AddForeignKey
ALTER TABLE "company_events" ADD CONSTRAINT "company_events_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_events" ADD CONSTRAINT "company_events_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sin policies: Prisma entra como dueno de la tabla y la autorizacion vive en el caso de uso.
ALTER TABLE "company_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_events" FORCE ROW LEVEL SECURITY;
