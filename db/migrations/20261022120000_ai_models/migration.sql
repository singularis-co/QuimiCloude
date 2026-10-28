-- Catalogo global de modelos de IA y eleccion de modelo en la conexion. Escrita a mano: el CHECK,
-- el indice parcial, el sembrado y las FK no se pueden declarar en el esquema (FK escalares sin
-- `@relation`, drift a proposito). Se aplica con `pnpm run db:migrate`.

-- 1. El catalogo. El id del modelo solo es unico dentro de su proveedor.
CREATE TABLE "ai_models" (
    "provider" "ai_provider_code" NOT NULL,
    "model_id" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("provider", "model_id"),
    CONSTRAINT "ai_models_model_id_not_empty" CHECK ("model_id" <> '')
);

-- 2. Un proveedor con modelos no se puede borrar del catalogo de proveedores.
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_fkey"
  FOREIGN KEY ("provider") REFERENCES "ai_providers"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Como mucho un predeterminado por proveedor. Que haya al menos uno no lo puede imponer un indice.
CREATE UNIQUE INDEX "ai_models_one_default_per_provider" ON "ai_models"("provider") WHERE "is_default";

-- 4. Sembrado: solo modelos que aceptan PDF e imagenes como entrada. `sort_order` va de mas a menos
-- calidad dentro de cada proveedor; el predeterminado no es el primero.
INSERT INTO "ai_models" ("provider", "model_id", "is_default", "sort_order") VALUES
    ('ANTHROPIC', 'claude-opus-5-5', false, 1),
    ('ANTHROPIC', 'claude-sonnet-5-5', false, 2),
    ('ANTHROPIC', 'claude-opus-5', false, 3),
    ('ANTHROPIC', 'claude-sonnet-5', false, 4),
    ('ANTHROPIC', 'claude-haiku-5-5', true, 5),
    ('GOOGLE', 'gemini-4-argon', false, 1),
    ('GOOGLE', 'gemini-3.8-flash', true, 2),
    ('GOOGLE', 'gemini-3.7-flash', false, 3),
    ('GOOGLE', 'gemini-3.5-flash-lite', false, 4),
    ('GOOGLE', 'gemini-3.1-flash-lite', false, 5),
    ('OPENAI', 'gpt-6.1-sol', false, 1),
    ('OPENAI', 'gpt-6-sol', false, 2),
    ('OPENAI', 'gpt-6-luna-pro', false, 3),
    ('OPENAI', 'gpt-6-luna', true, 4),
    ('OPENAI', 'gpt-5.6-luna', false, 5),
    ('OPENROUTER', 'anthropic/claude-sonnet-5.5', false, 1),
    ('OPENROUTER', 'openai/gpt-6.1-sol', false, 2),
    ('OPENROUTER', 'google/gemini-3.8-flash', false, 3),
    ('OPENROUTER', 'anthropic/claude-haiku-5.5', true, 4),
    ('OPENROUTER', 'openai/gpt-6-luna', false, 5);

-- 5. La eleccion de la conexion y el modelo que el proveedor dijo no ofrecer. Las conexiones
-- existentes quedan sin eleccion. La FK compuesta es MATCH SIMPLE: con `model_id` nulo no se
-- comprueba; con valor, rechaza un modelo de otro proveedor. `unavailable_model` no lleva FK.
ALTER TABLE "ai_provider_connections" ADD COLUMN "model_id" TEXT, ADD COLUMN "unavailable_model" TEXT;
ALTER TABLE "ai_provider_connections" ADD CONSTRAINT "ai_provider_connections_model_fkey"
  FOREIGN KEY ("provider", "model_id") REFERENCES "ai_models"("provider", "model_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. El modelo de un proveedor sale solo del catalogo de modelos.
ALTER TABLE "ai_providers" DROP CONSTRAINT "ai_providers_models_not_empty",
  DROP COLUMN "recipe_model",
  DROP COLUMN "catalog_model";

-- 7. RLS activada y forzada, sin policies, al final.
ALTER TABLE "ai_models" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_models" FORCE ROW LEVEL SECURITY;
