-- Reversion de `migration.sql`, en orden inverso. Los telefonos secundarios se pierden con las
-- tablas; `customers.phone_e164` conserva el principal.

ALTER TABLE "whatsapp_contacts" DROP CONSTRAINT "whatsapp_contacts_company_customer_fkey";

ALTER TABLE "whatsapp_contacts" DROP CONSTRAINT "whatsapp_contacts_blocked_check";

ALTER TABLE "whatsapp_contacts" DROP CONSTRAINT "whatsapp_contacts_customer_link_check";

ALTER TABLE "whatsapp_contacts" DROP COLUMN "blocked_by";

ALTER TABLE "whatsapp_contacts" DROP COLUMN "blocked_at";

ALTER TABLE "whatsapp_contacts" DROP COLUMN "customer_linked_by";

-- Antes de recrear el indice unico hay que deshacer los numeros repetidos que la migracion
-- permitio: se queda el numero el cliente mas reciente y los demas quedan marcados `duplicate`,
-- con su texto antiguo en `phone`. Mismo desempate que el relleno de telefonos.
ALTER TABLE "customers" NO FORCE ROW LEVEL SECURITY;

UPDATE "customers" c
   SET "phone_e164" = NULL, "phone_issue" = 'duplicate'
  FROM (
    SELECT "id", row_number() OVER (PARTITION BY "company_id", "phone_e164"
                                    ORDER BY "created_at" DESC, "id" DESC) AS "rn"
      FROM "customers"
     WHERE "deleted_at" IS NULL AND "phone_e164" IS NOT NULL
  ) d
 WHERE c."id" = d."id" AND d."rn" > 1;

ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX "customers_company_phone_e164_key"
  ON "customers" ("company_id", "phone_e164")
  WHERE "deleted_at" IS NULL AND "phone_e164" IS NOT NULL;

DROP TABLE "customer_phone_numbers";

DROP TABLE "phone_numbers";
