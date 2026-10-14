-- Reversion exacta de `migration.sql`. `DROP TABLE` se lleva la tabla, sus filas, indices, FK y RLS.
-- Sin CASCADE: si una migracion posterior cuelga una FK de estas tablas, revertir esta sin revertir
-- aquella debe fallar ruidosamente. La conexion cae antes que el catalogo al que apunta, y los tipos
-- despues porque las tablas los usan.

DROP TABLE "ai_provider_connections";
DROP TABLE "ai_providers";
DROP TYPE "ai_provider_connection_status";
DROP TYPE "ai_provider_code";
