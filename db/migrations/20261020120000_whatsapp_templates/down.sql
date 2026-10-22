-- Reversion exacta de `migration.sql`. `DROP TABLE` se lleva la tabla, sus indices, sus FK, sus
-- CHECK y su RLS. Sin CASCADE: si una migracion posterior cuelga una FK de esta tabla, revertir
-- esta sin revertir aquella debe fallar ruidosamente. Los tipos caen al final porque la tabla los usa.

ALTER TABLE "whatsapp_connections" DROP COLUMN "templates_synced_at";
DROP TABLE "whatsapp_templates";
DROP TYPE "whatsapp_template_status";
DROP TYPE "whatsapp_template_category";
