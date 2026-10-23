-- Reversion exacta de `migration.sql`. Las elecciones de modelo de las conexiones se pierden.
-- Sin CASCADE: si una migracion posterior cuelga algo de `ai_models`, revertir esta sin revertir
-- aquella debe fallar ruidosamente.

-- 1. Vuelven los dos modelos por proveedor con los valores sembrados al crear `ai_providers`.
ALTER TABLE "ai_providers" ADD COLUMN "recipe_model" TEXT, ADD COLUMN "catalog_model" TEXT;
UPDATE "ai_providers" SET "recipe_model" = 'claude-haiku-5-5', "catalog_model" = 'claude-haiku-5-5'
  WHERE "code" = 'ANTHROPIC';
UPDATE "ai_providers" SET "recipe_model" = 'gemini-3.8-flash', "catalog_model" = 'gemini-3.5-flash-lite'
  WHERE "code" = 'GOOGLE';
UPDATE "ai_providers" SET "recipe_model" = 'gpt-6-luna', "catalog_model" = 'gpt-6-luna'
  WHERE "code" = 'OPENAI';
UPDATE "ai_providers" SET "recipe_model" = 'anthropic/claude-haiku-5.5', "catalog_model" = 'anthropic/claude-haiku-5.5'
  WHERE "code" = 'OPENROUTER';
ALTER TABLE "ai_providers" ALTER COLUMN "recipe_model" SET NOT NULL, ALTER COLUMN "catalog_model" SET NOT NULL;
ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_models_not_empty"
  CHECK ("recipe_model" <> '' AND "catalog_model" <> '');

-- 2. Fuera la eleccion de la conexion.
ALTER TABLE "ai_provider_connections" DROP CONSTRAINT "ai_provider_connections_model_fkey";
ALTER TABLE "ai_provider_connections" DROP COLUMN "unavailable_model", DROP COLUMN "model_id";

-- 3. `DROP TABLE` se lleva sus filas, indices, FK y RLS.
DROP TABLE "ai_models";
