-- Reversion exacta de `migration.sql`. `DROP TABLE` se lleva la tabla, sus indices, sus FK, su
-- CHECK y su RLS. Sin CASCADE: si una migracion posterior cuelga una FK de estas tablas, revertir
-- esta sin revertir aquella debe fallar ruidosamente. Los mensajes caen antes que los contactos
-- porque los referencian, y los tipos al final porque las tablas los usan.

DROP TABLE "whatsapp_messages";
DROP TABLE "whatsapp_contacts";
DROP TYPE "whatsapp_message_origin";
DROP TYPE "whatsapp_message_status";
DROP TYPE "whatsapp_message_type";
DROP TYPE "whatsapp_message_direction";
