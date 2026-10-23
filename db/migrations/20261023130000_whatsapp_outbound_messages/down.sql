-- Reversion exacta de `migration.sql`, en orden inverso.

ALTER TABLE "whatsapp_messages" DROP CONSTRAINT "whatsapp_messages_sent_by_fkey";

ALTER TABLE "whatsapp_messages" DROP COLUMN "template_language";
