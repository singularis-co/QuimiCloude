-- Base generada con `prisma migrate diff` y completada a mano: los CHECK y las FK no se pueden
-- declarar en el esquema (las FK son escalares sin `@relation`).

CREATE TYPE "whatsapp_conversation_mode" AS ENUM ('AGENT', 'HUMAN');
CREATE TYPE "whatsapp_conversation_mode_reason" AS ENUM (
    'MANUAL', 'CUSTOMER_REQUEST', 'MISSING_DATA', 'LOW_CONFIDENCE',
    'AI_ERROR', 'USAGE_LIMIT', 'USER_REPLY', 'COMPLAINT', 'NEGATIVE_SENTIMENT',
    'UNSUPPORTED_MEDIA', 'INACTIVITY');

-- Los contactos que ya existen quedan en AGENT, sin motivo ni fecha de cambio.
ALTER TABLE "whatsapp_contacts"
    ADD COLUMN "conversation_mode" "whatsapp_conversation_mode" NOT NULL DEFAULT 'AGENT',
    ADD COLUMN "conversation_mode_reason" "whatsapp_conversation_mode_reason",
    ADD COLUMN "conversation_mode_changed_at" TIMESTAMPTZ(6),
    ADD COLUMN "conversation_mode_changed_by" UUID,
    ADD CONSTRAINT "whatsapp_contacts_mode_change_consistent"
        CHECK (("conversation_mode_reason" IS NULL) = ("conversation_mode_changed_at" IS NULL)),
    ADD CONSTRAINT "whatsapp_contacts_human_mode_has_reason"
        CHECK ("conversation_mode" = 'AGENT' OR "conversation_mode_reason" IS NOT NULL);

-- `conversation_mode_changed_by` nulo con motivo = el cambio lo hizo el sistema.
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_conversation_mode_changed_by_fkey"
    FOREIGN KEY ("conversation_mode_changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "whatsapp_contacts_conversation_mode_changed_by_idx"
    ON "whatsapp_contacts"("conversation_mode_changed_by");

-- Sin DEFAULT en los campos de negocio: sin fila, los valores por defecto los da el dominio.
CREATE TABLE "whatsapp_agent_settings" (
    "company_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "confidence_threshold" DECIMAL(3,2) NOT NULL,
    "daily_reply_limit" INTEGER NOT NULL,
    "contact_hourly_reply_limit" INTEGER NOT NULL,
    "inactivity_hours" INTEGER NOT NULL,
    "handoff_message" TEXT NOT NULL,
    "greeting_message" TEXT NOT NULL,
    "assistant_name" TEXT,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "whatsapp_agent_settings_pkey" PRIMARY KEY ("company_id"),
    CONSTRAINT "whatsapp_agent_settings_threshold_range"
        CHECK ("confidence_threshold" BETWEEN 0 AND 1),
    CONSTRAINT "whatsapp_agent_settings_limits_positive"
        CHECK ("daily_reply_limit" >= 1 AND "contact_hourly_reply_limit" >= 1 AND "inactivity_hours" >= 1),
    CONSTRAINT "whatsapp_agent_settings_messages_not_blank"
        CHECK (btrim("handoff_message") <> '' AND btrim("greeting_message") <> ''
           AND char_length("handoff_message") <= 4096 AND char_length("greeting_message") <= 4096),
    CONSTRAINT "whatsapp_agent_settings_assistant_name_valid"
        CHECK ("assistant_name" IS NULL
           OR (btrim("assistant_name") = "assistant_name" AND "assistant_name" <> ''
               AND char_length("assistant_name") <= 60))
);

ALTER TABLE "whatsapp_agent_settings" ADD CONSTRAINT "whatsapp_agent_settings_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_agent_settings" ADD CONSTRAINT "whatsapp_agent_settings_updated_by_fkey"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "whatsapp_agent_settings_updated_by_idx" ON "whatsapp_agent_settings"("updated_by");

ALTER TABLE "whatsapp_agent_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_agent_settings" FORCE ROW LEVEL SECURITY;

-- Va al final y nada la usa aqui: un valor nuevo de enum no se puede usar en la misma transaccion.
ALTER TYPE "whatsapp_message_origin" ADD VALUE 'AGENT';
