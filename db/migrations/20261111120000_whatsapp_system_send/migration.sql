-- Los parametros de Meta que se armaron al encolar: el envio diferido manda exactamente eso.
ALTER TABLE "whatsapp_messages" ADD COLUMN "template_components" JSONB;

-- Parcial y escrito a mano porque Prisma no representa un indice con WHERE. Sirve al barrido
-- horario, que recorre todas las empresas buscando mensajes del sistema pendientes.
CREATE INDEX "whatsapp_messages_system_pending_idx"
  ON "whatsapp_messages" ("company_id", "status", "updated_at")
  WHERE "origin" = 'SYSTEM' AND "status" IN ('QUEUED', 'SENDING');
