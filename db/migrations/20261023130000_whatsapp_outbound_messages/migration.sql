-- Escrita a mano: `sent_by` es escalar sin `@relation` en el esquema, asi que Prisma no genera su
-- FK. Los entrantes llevan `sent_by` nulo y la FK no los afecta. El indice de `sent_by` ya existe.

ALTER TABLE "whatsapp_messages" ADD COLUMN "template_language" TEXT;

ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_sent_by_fkey"
  FOREIGN KEY ("sent_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
