-- Tabla `whatsapp_templates` y columna `templates_synced_at` en `whatsapp_connections`. Escrita a
-- mano: las FK compuestas con `company_id` no tienen `@relation` en el esquema y el unico parcial
-- no lo expresa Prisma, asi que `migrate dev` propondria un reset. Se aplica con
-- `pnpm run db:migrate` (`prisma migrate deploy`).

-- 1. Los dos enums, con todos sus valores: `ALTER TYPE ... ADD VALUE` no se revierte limpio.
CREATE TYPE "whatsapp_template_category" AS ENUM ('MARKETING', 'UTILITY', 'AUTHENTICATION');
CREATE TYPE "whatsapp_template_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED', 'OTHER');

-- 2. La tabla. `updated_at` sin default: lo escribe Prisma (`@updatedAt`) en cada UPDATE.
CREATE TABLE "whatsapp_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "meta_template_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "category" "whatsapp_template_category" NOT NULL,
    "components" JSONB NOT NULL DEFAULT '[]',
    "status" "whatsapp_template_status" NOT NULL,
    "status_raw" TEXT,
    "rejected_reason" TEXT,
    "last_synced_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "whatsapp_templates_meta_template_id_not_empty" CHECK (length("meta_template_id") > 0),
    CONSTRAINT "whatsapp_templates_name_not_empty" CHECK (length("name") > 0),
    CONSTRAINT "whatsapp_templates_language_not_empty" CHECK (length("language") > 0),
    -- El estado en bruto de Meta se guarda solo cuando no se reconoce, y entonces siempre.
    CONSTRAINT "whatsapp_templates_status_raw_only_other" CHECK (("status" = 'OTHER') = ("status_raw" IS NOT NULL))
);

-- 3. Indices. El de nombre e idioma solo entre las vivas: una eliminada no bloquea el nombre.
CREATE UNIQUE INDEX "whatsapp_templates_connection_meta_id_key" ON "whatsapp_templates"("connection_id", "meta_template_id");
CREATE UNIQUE INDEX "whatsapp_templates_name_language_live_key" ON "whatsapp_templates"("connection_id", "name", "language") WHERE "deleted_at" IS NULL;
CREATE INDEX "whatsapp_templates_created_by_idx" ON "whatsapp_templates"("created_by");

-- 4. FK. La compuesta hace que la base rechace una plantilla de otra empresa que su conexion.
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_company_connection_fkey"
  FOREIGN KEY ("company_id", "connection_id") REFERENCES "whatsapp_connections"("company_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Hora de la ultima sincronizacion completa, nula hasta la primera.
ALTER TABLE "whatsapp_connections" ADD COLUMN "templates_synced_at" TIMESTAMPTZ(6);

-- 6. RLS activada y forzada, sin policies, al final.
ALTER TABLE "whatsapp_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_templates" FORCE ROW LEVEL SECURITY;
