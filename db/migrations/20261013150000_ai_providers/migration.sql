-- Tablas `ai_providers` y `ai_provider_connections`. Base generada con `prisma migrate diff` y
-- completada a mano: el CHECK, el sembrado y las FK no se pueden declarar en el esquema (las FK son
-- escalares sin `@relation`, drift a proposito). Se aplica con `pnpm run db:migrate`.

-- 1. Los dos enums.
CREATE TYPE "ai_provider_code" AS ENUM ('ANTHROPIC', 'GOOGLE', 'OPENAI', 'OPENROUTER');
CREATE TYPE "ai_provider_connection_status" AS ENUM ('ACTIVE', 'ERROR');

-- 2. El catalogo global.
CREATE TABLE "ai_providers" (
    "code" "ai_provider_code" NOT NULL,
    "name" TEXT NOT NULL,
    "recipe_model" TEXT NOT NULL,
    "catalog_model" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("code"),
    CONSTRAINT "ai_providers_models_not_empty" CHECK ("recipe_model" <> '' AND "catalog_model" <> '')
);

-- 3. Sembrado. Cambiar un modelo despues es otra migracion con su `down.sql`.
INSERT INTO "ai_providers" ("code", "name", "recipe_model", "catalog_model", "sort_order") VALUES
    ('ANTHROPIC', 'Claude', 'claude-haiku-5-5', 'claude-haiku-5-5', 1),
    ('GOOGLE', 'Gemini', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 2),
    ('OPENAI', 'OpenAI', 'gpt-6-luna', 'gpt-6-luna', 3),
    ('OPENROUTER', 'OpenRouter', 'anthropic/claude-haiku-5.5', 'anthropic/claude-haiku-5.5', 4);

-- 4. La conexion. `id` sin default: el cifrado de la key necesita el id antes del INSERT.
-- `updated_at` sin default: lo escribe Prisma (`@updatedAt`) en cada UPDATE.
CREATE TABLE "ai_provider_connections" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "provider" "ai_provider_code" NOT NULL,
    "api_key_enc" TEXT NOT NULL,
    "status" "ai_provider_connection_status" NOT NULL DEFAULT 'ACTIVE',
    "last_error" TEXT,
    "last_error_at" TIMESTAMPTZ(6),
    "last_checked_at" TIMESTAMPTZ(6),
    "key_updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_provider_connections_pkey" PRIMARY KEY ("id")
);

-- 5. Una conexion por empresa, tambien con dos guardados concurrentes. Total, no parcial:
-- desconectar borra la fila.
CREATE UNIQUE INDEX "ai_provider_connections_company_id_key" ON "ai_provider_connections"("company_id");

-- 6. FK a mano (drift). Un proveedor con conexiones no se puede borrar del catalogo.
ALTER TABLE "ai_provider_connections" ADD CONSTRAINT "ai_provider_connections_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_provider_connections" ADD CONSTRAINT "ai_provider_connections_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_provider_connections" ADD CONSTRAINT "ai_provider_connections_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_provider_connections" ADD CONSTRAINT "ai_provider_connections_provider_fkey"
  FOREIGN KEY ("provider") REFERENCES "ai_providers"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. Lado hijo de la FK al catalogo.
CREATE INDEX "ai_provider_connections_provider_idx" ON "ai_provider_connections"("provider");

-- 8. RLS activada y forzada en las dos tablas, sin policies, al final.
ALTER TABLE "ai_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_providers" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ai_provider_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_provider_connections" FORCE ROW LEVEL SECURITY;
