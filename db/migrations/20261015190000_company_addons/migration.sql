-- 1. Catálogo de añadidos: espejo de ADDONS (identity/domain/company-addons.ts).
CREATE TABLE "addons" (
  "key" TEXT NOT NULL,
  CONSTRAINT "addons_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "addons_key_format" CHECK ("key" ~ '^[a-z][a-z_]*$')
);

INSERT INTO "addons" ("key") VALUES
  ('dashboard'), ('proveedores'), ('lectura_pdf'), ('importacion_excel'), ('integraciones');

-- 2. Excepciones por empresa.
CREATE TABLE "company_addon_overrides" (
  "company_id" UUID NOT NULL,
  "addon_key"  TEXT NOT NULL,
  "enabled"    BOOLEAN NOT NULL,
  "source"     TEXT NOT NULL DEFAULT 'manual',
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_addon_overrides_pkey" PRIMARY KEY ("company_id", "addon_key"),
  CONSTRAINT "company_addon_overrides_source_format" CHECK ("source" ~ '^[a-z][a-z_]*$')
);

CREATE INDEX "company_addon_overrides_addon_key_idx" ON "company_addon_overrides" ("addon_key");
CREATE INDEX "company_addon_overrides_created_by_idx" ON "company_addon_overrides" ("created_by");

ALTER TABLE "company_addon_overrides" ADD CONSTRAINT "company_addon_overrides_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_addon_overrides" ADD CONSTRAINT "company_addon_overrides_addon_key_fkey"
  FOREIGN KEY ("addon_key") REFERENCES "addons"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_addon_overrides" ADD CONSTRAINT "company_addon_overrides_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Las empresas que ya existen conservan los cinco, también las de baja. Autor vacío = sembrado.
INSERT INTO "company_addon_overrides" ("company_id", "addon_key", "enabled", "source")
SELECT c."id", a."key", true, 'manual' FROM "companies" c CROSS JOIN "addons" a;

-- 4. RLS activada y forzada, sin policies, al final.
ALTER TABLE "addons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "addons" FORCE ROW LEVEL SECURITY;
ALTER TABLE "company_addon_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_addon_overrides" FORCE ROW LEVEL SECURITY;
