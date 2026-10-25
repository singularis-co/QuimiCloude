-- Reversion exacta de `migration.sql`.

ALTER TABLE "whatsapp_contacts" DROP COLUMN "last_read_at";
