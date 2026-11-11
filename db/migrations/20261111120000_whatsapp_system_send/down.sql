-- Reversion exacta de `migration.sql`, en orden inverso.

DROP INDEX "whatsapp_messages_system_pending_idx";

ALTER TABLE "whatsapp_messages" DROP COLUMN "template_components";
