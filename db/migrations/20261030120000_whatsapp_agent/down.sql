-- Reversion exacta de `migration.sql`, en orden inverso.

-- Postgres no deja quitar un valor de un enum: se recrea el tipo sin AGENT. Si algun mensaje
-- tiene origen AGENT, el cast falla y la reversion se para sin perder ese dato.
ALTER TYPE "whatsapp_message_origin" RENAME TO "whatsapp_message_origin_old";
CREATE TYPE "whatsapp_message_origin" AS ENUM ('USER', 'SYSTEM');
ALTER TABLE "whatsapp_messages"
    ALTER COLUMN "origin" TYPE "whatsapp_message_origin" USING "origin"::text::"whatsapp_message_origin";
DROP TYPE "whatsapp_message_origin_old";

DROP TABLE "whatsapp_agent_settings";

DROP INDEX "whatsapp_contacts_conversation_mode_changed_by_idx";
ALTER TABLE "whatsapp_contacts"
    DROP CONSTRAINT "whatsapp_contacts_conversation_mode_changed_by_fkey",
    DROP CONSTRAINT "whatsapp_contacts_human_mode_has_reason",
    DROP CONSTRAINT "whatsapp_contacts_mode_change_consistent",
    DROP COLUMN "conversation_mode_changed_by",
    DROP COLUMN "conversation_mode_changed_at",
    DROP COLUMN "conversation_mode_reason",
    DROP COLUMN "conversation_mode";

DROP TYPE "whatsapp_conversation_mode_reason";
DROP TYPE "whatsapp_conversation_mode";
