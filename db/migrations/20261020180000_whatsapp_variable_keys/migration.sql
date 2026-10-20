-- Diccionario de variables de WhatsApp: variables propias por empresa, la relacion de cada hueco de
-- una plantilla con su entrada, y el estado del mapeo y la habilitacion de la plantilla. Escrita a
-- mano: las FK compuestas con `company_id` no tienen `@relation` en el esquema y los CHECK no los
-- expresa Prisma. Se aplica con `pnpm run db:migrate` (`prisma migrate deploy`).

-- 1. El enum, con todos sus valores: `ALTER TYPE ... ADD VALUE` no se revierte limpio.
CREATE TYPE "whatsapp_template_mapping_status" AS ENUM ('UNMAPPED', 'MAPPED');

-- 2. Variables propias. `length` cuenta caracteres, como el dominio. El valor va dentro de un
--    parametro de Meta: sin marcas de variable. `updated_at` sin default: lo escribe Prisma.
CREATE TABLE "whatsapp_variable_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "whatsapp_variable_keys_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "whatsapp_variable_keys_key_format" CHECK ("key" ~ '^[a-z][a-z0-9_]{0,39}$'),
    CONSTRAINT "whatsapp_variable_keys_label_length" CHECK (length("label") BETWEEN 1 AND 60),
    CONSTRAINT "whatsapp_variable_keys_value_length" CHECK (length("value") BETWEEN 1 AND 50),
    CONSTRAINT "whatsapp_variable_keys_value_no_markers" CHECK (position('{{' in "value") = 0 AND position('}}' in "value") = 0)
);

CREATE UNIQUE INDEX "whatsapp_variable_keys_company_key_key" ON "whatsapp_variable_keys"("company_id", "key");
CREATE UNIQUE INDEX "whatsapp_variable_keys_company_id_id_key" ON "whatsapp_variable_keys"("company_id", "id");

ALTER TABLE "whatsapp_variable_keys" ADD CONSTRAINT "whatsapp_variable_keys_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Destino de la FK compuesta de las relaciones.
CREATE UNIQUE INDEX "whatsapp_templates_company_id_id_key" ON "whatsapp_templates"("company_id", "id");

-- 4. Estado del mapeo y habilitacion. Una plantilla habilitada sin relacionar no se puede escribir.
ALTER TABLE "whatsapp_templates"
  ADD COLUMN "mapping_status" "whatsapp_template_mapping_status" NOT NULL DEFAULT 'UNMAPPED',
  ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_enabled_requires_mapped"
  CHECK (NOT "enabled" OR "mapping_status" = 'MAPPED');

-- 5. Relaciones. Cada hueco apunta a una variable propia o a una constante, nunca a las dos. Las FK
--    compuestas impiden cruzar empresas; con `variable_key_id` nulo (constante) la segunda no se
--    comprueba. `ON DELETE RESTRICT` impide borrar una variable propia en uso.
CREATE TABLE "whatsapp_template_variables" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "slot" TEXT NOT NULL,
    "variable_key_id" UUID,
    "system_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_template_variables_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "whatsapp_template_variables_one_target" CHECK (("variable_key_id" IS NULL) <> ("system_key" IS NULL)),
    CONSTRAINT "whatsapp_template_variables_system_key_format" CHECK ("system_key" IS NULL OR "system_key" ~ '^[a-z][a-z0-9_]{0,39}\.[a-z][a-z0-9_]{0,39}$'),
    CONSTRAINT "whatsapp_template_variables_slot_format" CHECK ("slot" ~ '^(header|body\.[1-9][0-9]*|button\.[0-9])$')
);

CREATE UNIQUE INDEX "whatsapp_template_variables_template_slot_key" ON "whatsapp_template_variables"("template_id", "slot");
CREATE INDEX "whatsapp_template_variables_variable_key_idx" ON "whatsapp_template_variables"("variable_key_id");

ALTER TABLE "whatsapp_template_variables" ADD CONSTRAINT "whatsapp_template_variables_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_template_variables" ADD CONSTRAINT "whatsapp_template_variables_company_template_fkey"
  FOREIGN KEY ("company_id", "template_id") REFERENCES "whatsapp_templates"("company_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_template_variables" ADD CONSTRAINT "whatsapp_template_variables_company_variable_key_fkey"
  FOREIGN KEY ("company_id", "variable_key_id") REFERENCES "whatsapp_variable_keys"("company_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Relleno: las existentes quedan sin relaciones. Las vivas sin variables y con contenido que la
--    app sabe editar nacen relacionadas y habilitadas. Aproxima `contentOf`: no detecta componentes
--    repetidos.
UPDATE "whatsapp_templates" SET "mapping_status" = 'MAPPED', "enabled" = true
WHERE "deleted_at" IS NULL
  AND position('{{' in "components"::text) = 0
  AND jsonb_path_exists("components", '$[*] ? (@.type == "BODY")')
  AND NOT jsonb_path_exists("components", '$[*] ? (@.type == "HEADER" && @.format != "TEXT")')
  AND NOT jsonb_path_exists("components", '$[*].buttons[*] ? (@.type != "QUICK_REPLY" && @.type != "URL" && @.type != "PHONE_NUMBER")');

-- 7. RLS activada y forzada, sin policies, al final.
ALTER TABLE "whatsapp_variable_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_variable_keys" FORCE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_template_variables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_template_variables" FORCE ROW LEVEL SECURITY;
