-- Reversion exacta de `migration.sql`, en orden inverso. Los pares guardados se pierden.
-- `DROP TABLE` se lleva sus filas, indices, FK, CHECK y RLS.

DROP TABLE "ai_agent_model_pairs";
DROP TYPE "ai_model_role";
ALTER TABLE "ai_models" DROP COLUMN "is_economic", DROP COLUMN "supports_tools";
