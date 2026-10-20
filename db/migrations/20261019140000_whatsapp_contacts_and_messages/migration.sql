-- Tablas `whatsapp_contacts` y `whatsapp_messages`. Escrita a mano: las FK compuestas con
-- `company_id` no tienen `@relation` en el esquema (drift a proposito) y `migrate dev` propondria
-- un reset. Se aplica con `pnpm run db:migrate` (`prisma migrate deploy`).

-- 1. Los cuatro enums. Todos los valores de salida van ya aqui: `ALTER TYPE ... ADD VALUE` no se
-- revierte con un `down.sql` limpio.
CREATE TYPE "whatsapp_message_direction" AS ENUM ('IN', 'OUT');
CREATE TYPE "whatsapp_message_type" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'STICKER', 'LOCATION', 'CONTACTS', 'REACTION', 'BUTTON', 'INTERACTIVE', 'TEMPLATE', 'UNSUPPORTED');
CREATE TYPE "whatsapp_message_status" AS ENUM ('RECEIVED', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');
CREATE TYPE "whatsapp_message_origin" AS ENUM ('USER', 'SYSTEM');

-- 2. Las tablas. `updated_at` sin default: lo escribe Prisma (`@updatedAt`) en cada UPDATE.
CREATE TABLE "whatsapp_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "wa_id" TEXT NOT NULL,
    "profile_name" TEXT,
    "customer_id" UUID,
    "last_inbound_at" TIMESTAMPTZ(6),
    "last_message_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "whatsapp_contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "whatsapp_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "direction" "whatsapp_message_direction" NOT NULL,
    "wamid" TEXT,
    "type" "whatsapp_message_type" NOT NULL,
    "body" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "whatsapp_message_status" NOT NULL,
    "error_code" TEXT,
    "error_reason" TEXT,
    "meta_timestamp" TIMESTAMPTZ(6),
    "origin" "whatsapp_message_origin",
    "sent_by" UUID,
    "template_name" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "queue_message_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- 3. Indices. Las dos claves candidatas de contactos son el destino de las FK compuestas del paso 4.
-- `wamid` unico admite varios NULL: un saliente en cola aun no lo tiene.
CREATE UNIQUE INDEX "whatsapp_contacts_connection_id_wa_id_key" ON "whatsapp_contacts"("connection_id", "wa_id");
CREATE UNIQUE INDEX "whatsapp_contacts_company_id_id_key" ON "whatsapp_contacts"("company_id", "id");
CREATE UNIQUE INDEX "whatsapp_contacts_company_connection_id_key" ON "whatsapp_contacts"("company_id", "connection_id", "id");
CREATE INDEX "whatsapp_contacts_customer_id_idx" ON "whatsapp_contacts"("customer_id");

CREATE UNIQUE INDEX "whatsapp_messages_wamid_key" ON "whatsapp_messages"("wamid");
CREATE INDEX "whatsapp_messages_connection_contact_ts_idx" ON "whatsapp_messages"("connection_id", "contact_id", "meta_timestamp");
CREATE INDEX "whatsapp_messages_sent_by_idx" ON "whatsapp_messages"("sent_by");

ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_wa_id_not_empty" CHECK (length("wa_id") > 0);

-- 4. FK compuestas: la base rechaza un contacto o un mensaje de otra empresa que su conexion, y un
-- mensaje de otra empresa o conexion que su contacto.
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_company_connection_fkey"
  FOREIGN KEY ("company_id", "connection_id") REFERENCES "whatsapp_connections"("company_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_company_connection_fkey"
  FOREIGN KEY ("company_id", "connection_id") REFERENCES "whatsapp_connections"("company_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_company_connection_contact_fkey"
  FOREIGN KEY ("company_id", "connection_id", "contact_id")
  REFERENCES "whatsapp_contacts"("company_id", "connection_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. RLS activada y forzada, sin policies, al final.
ALTER TABLE "whatsapp_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_contacts" FORCE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_messages" FORCE ROW LEVEL SECURITY;
