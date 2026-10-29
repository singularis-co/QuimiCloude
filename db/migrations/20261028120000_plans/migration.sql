-- 1. Planes de la plataforma: sin empresa.
CREATE TABLE "plans" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  "currency"      VARCHAR(3) NOT NULL,
  "monthly_price" DECIMAL(14,4),
  "annual_price"  DECIMAL(14,4),
  "active"        BOOLEAN NOT NULL,
  "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMPTZ(6) NOT NULL,
  "deleted_at"    TIMESTAMPTZ(6),
  CONSTRAINT "plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "plans_name_not_blank" CHECK (btrim("name") <> ''),
  CONSTRAINT "plans_currency_allowed" CHECK ("currency" IN ('CRC', 'USD')),
  CONSTRAINT "plans_monthly_price_non_negative" CHECK ("monthly_price" IS NULL OR "monthly_price" >= 0),
  CONSTRAINT "plans_annual_price_non_negative" CHECK ("annual_price" IS NULL OR "annual_price" >= 0),
  CONSTRAINT "plans_has_price" CHECK ("monthly_price" IS NOT NULL OR "annual_price" IS NOT NULL)
);

-- 2. Nombre único sin distinguir mayúsculas entre los planes no borrados.
CREATE UNIQUE INDEX "plans_name_unique" ON "plans" (lower("name")) WHERE "deleted_at" IS NULL;

-- 3. Módulos del plan: solo claves del catálogo de añadidos.
CREATE TABLE "plan_addons" (
  "plan_id"   UUID NOT NULL,
  "addon_key" TEXT NOT NULL,
  CONSTRAINT "plan_addons_pkey" PRIMARY KEY ("plan_id", "addon_key")
);

CREATE INDEX "plan_addons_addon_key_idx" ON "plan_addons" ("addon_key");

ALTER TABLE "plan_addons" ADD CONSTRAINT "plan_addons_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_addons" ADD CONSTRAINT "plan_addons_addon_key_fkey"
  FOREIGN KEY ("addon_key") REFERENCES "addons"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. RLS activada y forzada, sin policies, al final.
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plans" FORCE ROW LEVEL SECURITY;
ALTER TABLE "plan_addons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plan_addons" FORCE ROW LEVEL SECURITY;
