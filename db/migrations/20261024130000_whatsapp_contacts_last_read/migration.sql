-- Nula a proposito: los contactos que ya existen quedan sin marca de lectura y todos sus
-- mensajes entrantes cuentan como no leidos.

ALTER TABLE "whatsapp_contacts" ADD COLUMN "last_read_at" TIMESTAMPTZ(6);
