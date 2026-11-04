-- Escrita a mano: las FK compuestas, el CHECK y el sembrado no se pueden declarar en el esquema (FK
-- escalares sin `@relation`, drift a proposito). Se aplica con `pnpm run db:migrate`.

-- 1. Las dos marcas del catalogo, obligatorias.
ALTER TABLE "ai_models"
    ADD COLUMN "supports_tools" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "is_economic" BOOLEAN NOT NULL DEFAULT false;

-- 2. Valores de los modelos sembrados. "Economico" es una decision de producto, no sale del precio.
UPDATE "ai_models" AS "m"
SET "supports_tools" = "v"."supports_tools", "is_economic" = "v"."is_economic"
FROM (VALUES
    ('ANTHROPIC', 'claude-opus-5-5', true, false),
    ('ANTHROPIC', 'claude-sonnet-5-5', true, false),
    ('ANTHROPIC', 'claude-opus-5', true, false),
    ('ANTHROPIC', 'claude-sonnet-5', true, false),
    ('ANTHROPIC', 'claude-haiku-5-5', true, true),
    ('GOOGLE', 'gemini-4-argon', true, false),
    ('GOOGLE', 'gemini-3.8-flash', true, true),
    ('GOOGLE', 'gemini-3.7-flash', true, true),
    ('GOOGLE', 'gemini-3.5-flash-lite', true, true),
    ('GOOGLE', 'gemini-3.1-flash-lite', true, false),
    ('OPENAI', 'gpt-6.1-sol', true, false),
    ('OPENAI', 'gpt-6-sol', true, false),
    ('OPENAI', 'gpt-6-luna-pro', true, false),
    ('OPENAI', 'gpt-6-luna', true, true),
    ('OPENAI', 'gpt-5.6-luna', true, true),
    ('OPENROUTER', 'anthropic/claude-sonnet-5.5', true, false),
    ('OPENROUTER', 'openai/gpt-6.1-sol', true, false),
    ('OPENROUTER', 'google/gemini-3.8-flash', true, true),
    ('OPENROUTER', 'anthropic/claude-haiku-5.5', true, true),
    ('OPENROUTER', 'openai/gpt-6-luna', true, true)
) AS "v"("provider", "model_id", "supports_tools", "is_economic")
WHERE "m"."provider" = "v"."provider"::"ai_provider_code" AND "m"."model_id" = "v"."model_id";

-- 3. Los dos roles de un par.
CREATE TYPE "ai_model_role" AS ENUM ('AGENT', 'ROUTER');

-- 4. Como mucho un par por proveedor y rol. Que ambos modelos admitan herramientas y que el
-- principal del enrutador sea economico no lo puede imponer una FK: lo valida el caso de uso.
CREATE TABLE "ai_agent_model_pairs" (
    "provider" "ai_provider_code" NOT NULL,
    "role" "ai_model_role" NOT NULL,
    "primary_model_id" TEXT NOT NULL,
    "fallback_model_id" TEXT NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_agent_model_pairs_pkey" PRIMARY KEY ("provider", "role"),
    CONSTRAINT "ai_agent_model_pairs_distinct_models" CHECK ("primary_model_id" <> "fallback_model_id")
);

-- Las FK compuestas rechazan un modelo de otro proveedor o fuera del catalogo, e impiden borrar del
-- catalogo un modelo en uso.
ALTER TABLE "ai_agent_model_pairs" ADD CONSTRAINT "ai_agent_model_pairs_provider_fkey"
    FOREIGN KEY ("provider") REFERENCES "ai_providers"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_agent_model_pairs" ADD CONSTRAINT "ai_agent_model_pairs_primary_model_fkey"
    FOREIGN KEY ("provider", "primary_model_id") REFERENCES "ai_models"("provider", "model_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_agent_model_pairs" ADD CONSTRAINT "ai_agent_model_pairs_fallback_model_fkey"
    FOREIGN KEY ("provider", "fallback_model_id") REFERENCES "ai_models"("provider", "model_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_agent_model_pairs" ADD CONSTRAINT "ai_agent_model_pairs_updated_by_fkey"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ai_agent_model_pairs_updated_by_idx" ON "ai_agent_model_pairs"("updated_by");

-- 5. Pares iniciales, sin autor. El respaldo del enrutador de ANTHROPIC no es economico a proposito:
-- la regla de economicos solo aplica al principal.
INSERT INTO "ai_agent_model_pairs" ("provider", "role", "primary_model_id", "fallback_model_id") VALUES
    ('ANTHROPIC', 'AGENT', 'claude-sonnet-5-5', 'claude-sonnet-5'),
    ('ANTHROPIC', 'ROUTER', 'claude-haiku-5-5', 'claude-sonnet-5-5'),
    ('OPENAI', 'AGENT', 'gpt-6.1-sol', 'gpt-6-sol'),
    ('OPENAI', 'ROUTER', 'gpt-6-luna', 'gpt-5.6-luna'),
    ('GOOGLE', 'AGENT', 'gemini-4-argon', 'gemini-3.8-flash'),
    ('GOOGLE', 'ROUTER', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'),
    ('OPENROUTER', 'AGENT', 'anthropic/claude-sonnet-5.5', 'openai/gpt-6.1-sol'),
    ('OPENROUTER', 'ROUTER', 'anthropic/claude-haiku-5.5', 'google/gemini-3.8-flash');

-- 6. RLS activada y forzada, sin policies, al final.
ALTER TABLE "ai_agent_model_pairs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_agent_model_pairs" FORCE ROW LEVEL SECURITY;
