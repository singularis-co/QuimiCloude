-- Reversion exacta de `migration.sql`. `DROP TABLE` se lleva la tabla, sus indices, sus FK, sus
-- CHECK y su RLS. Sin CASCADE: si una migracion posterior cuelga algo de estas tablas, revertir esta
-- sin revertir aquella debe fallar ruidosamente. Las relaciones caen antes que lo que referencian y
-- el tipo al final porque la columna lo usa.

DROP TABLE "whatsapp_template_variables";
ALTER TABLE "whatsapp_templates"
  DROP CONSTRAINT "whatsapp_templates_enabled_requires_mapped",
  DROP COLUMN "enabled",
  DROP COLUMN "mapping_status";
DROP INDEX "whatsapp_templates_company_id_id_key";
DROP TABLE "whatsapp_variable_keys";
DROP TYPE "whatsapp_template_mapping_status";
