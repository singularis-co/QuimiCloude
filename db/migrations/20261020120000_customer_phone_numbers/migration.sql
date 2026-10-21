-- Telefonos de cliente: un catalogo de numeros por empresa y una tabla puente cliente-numero con la
-- marca `main`. Un mismo numero puede ser de varios clientes, asi que el indice unico de
-- `customers.phone_e164` se retira: esa columna queda como espejo del telefono principal.
--
-- Escrita a mano: las FK compuestas con `company_id` no tienen `@relation` en el esquema y los dos
-- indices unicos de la tabla puente son parciales; Prisma no expresa ninguna de las dos cosas. Se
-- aplica con `pnpm run db:migrate`.

-- 1. Las tablas. `updated_at` sin default: lo escribe Prisma (`@updatedAt`) en cada UPDATE.
CREATE TABLE "phone_numbers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "e164" VARCHAR(15) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "phone_numbers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_phone_numbers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "phone_number_id" UUID NOT NULL,
    "main" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "customer_phone_numbers_pkey" PRIMARY KEY ("id")
);

-- Solo digitos, sin '+': el mismo formato que `customers.phone_e164` y que el `wa_id` de WhatsApp.
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_e164_format_check"
  CHECK ("e164" ~ '^[1-9][0-9]{6,14}$');

-- 2. Indices. `phone_numbers_company_id_id_key` es la clave candidata de la FK compuesta del vinculo.
CREATE UNIQUE INDEX "phone_numbers_company_id_e164_key" ON "phone_numbers"("company_id", "e164");
CREATE UNIQUE INDEX "phone_numbers_company_id_id_key" ON "phone_numbers"("company_id", "id");
CREATE INDEX "customer_phone_numbers_company_phone_idx" ON "customer_phone_numbers"("company_id", "phone_number_id");

-- Entre los vinculos vivos: un mismo numero no se vincula dos veces al mismo cliente, y un cliente
-- tiene como mucho un principal. Un vinculo quitado no cuenta.
CREATE UNIQUE INDEX "customer_phone_numbers_customer_phone_key"
  ON "customer_phone_numbers" ("customer_id", "phone_number_id") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "customer_phone_numbers_customer_main_key"
  ON "customer_phone_numbers" ("customer_id") WHERE "main" AND "deleted_at" IS NULL;

-- 3. FK compuestas: la base rechaza un vinculo entre un cliente y un numero de empresas distintas.
-- RESTRICT: ni los clientes ni los numeros se borran fisicamente.
ALTER TABLE "customer_phone_numbers" ADD CONSTRAINT "customer_phone_numbers_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_phone_numbers" ADD CONSTRAINT "customer_phone_numbers_company_customer_fkey"
  FOREIGN KEY ("company_id", "customer_id") REFERENCES "customers"("company_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_phone_numbers" ADD CONSTRAINT "customer_phone_numbers_company_phone_number_fkey"
  FOREIGN KEY ("company_id", "phone_number_id") REFERENCES "phone_numbers"("company_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Copia: cada cliente vivo con `phone_e164` pasa a tener ese numero como principal. Los que no
-- lo tienen (sin telefono, con aviso o pendientes de relleno) quedan sin vinculos.
-- Parentesis de RLS: con RLS forzada y sin policies, el dueno no ve ninguna fila de `customers` y
-- la copia no traeria nada.
ALTER TABLE "customers" NO FORCE ROW LEVEL SECURITY;

INSERT INTO "phone_numbers" ("company_id", "e164", "updated_at")
  SELECT DISTINCT "company_id", "phone_e164", now()
    FROM "customers"
   WHERE "deleted_at" IS NULL AND "phone_e164" IS NOT NULL;

INSERT INTO "customer_phone_numbers" ("company_id", "customer_id", "phone_number_id", "main", "updated_at")
  SELECT c."company_id", c."id", p."id", true, now()
    FROM "customers" c
    JOIN "phone_numbers" p ON p."company_id" = c."company_id" AND p."e164" = c."phone_e164"
   WHERE c."deleted_at" IS NULL AND c."phone_e164" IS NOT NULL;

ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;

-- 5. Un numero ya puede ser de varios clientes vivos de la misma empresa.
DROP INDEX "customers_company_phone_e164_key";

-- 6. Contactos de WhatsApp: el vinculo con el cliente, quien lo eligio y el bloqueo.
-- `customer_linked_by` no nulo marca el vinculo elegido por un usuario. Sin FK a `users`: el usuario
-- sale de la sesion, nunca de la entrada.
ALTER TABLE "whatsapp_contacts" ADD COLUMN "customer_linked_by" UUID;

ALTER TABLE "whatsapp_contacts" ADD COLUMN "blocked_at" TIMESTAMPTZ(6);

ALTER TABLE "whatsapp_contacts" ADD COLUMN "blocked_by" UUID;

ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_customer_link_check"
  CHECK ("customer_linked_by" IS NULL OR "customer_id" IS NOT NULL);

ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_blocked_check"
  CHECK (("blocked_at" IS NULL) = ("blocked_by" IS NULL));

-- El cliente de un contacto es de la misma empresa que el contacto. RESTRICT: un cliente se da de
-- baja logica, nunca se borra fisicamente.
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_company_customer_fkey"
  FOREIGN KEY ("company_id", "customer_id") REFERENCES "customers"("company_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. RLS activada y forzada, sin policies, al final.
ALTER TABLE "phone_numbers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "phone_numbers" FORCE ROW LEVEL SECURITY;
ALTER TABLE "customer_phone_numbers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_phone_numbers" FORCE ROW LEVEL SECURITY;
