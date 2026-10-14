-- Fotos de evidencia de un paso de un pedido, en fabricacion o en envasado.
--
-- El tipo, la tabla y sus indices los genera Prisma. A mano: los CHECK, las tres FK compuestas con
-- `company_id` (no llevan `@relation`) y la RLS. Prisma no las regenera: si una migracion generada
-- las quita como drift, nada falla. No toca ninguna tabla preexistente.

-- CreateEnum
CREATE TYPE "evidence_phase" AS ENUM ('MANUFACTURING', 'PACKING');

-- CreateTable
CREATE TABLE "order_step_evidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "phase" "evidence_phase" NOT NULL,
    "step_position" INTEGER NOT NULL,
    "slot" SMALLINT NOT NULL,
    "path" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_step_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_step_evidence_company_id_order_id_idx" ON "order_step_evidence"("company_id", "order_id");

-- CreateIndex
CREATE INDEX "order_step_evidence_uploaded_by_idx" ON "order_step_evidence"("uploaded_by");

-- CreateIndex
CREATE UNIQUE INDEX "order_step_evidence_slot_key" ON "order_step_evidence"("order_id", "phase", "step_position", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "order_step_evidence_company_path_key" ON "order_step_evidence"("company_id", "path");

-- Tres casillas por paso: con el unico de `slot`, dos registros a la vez no dejan una cuarta foto.
ALTER TABLE "order_step_evidence" ADD CONSTRAINT "order_step_evidence_slot_range"
  CHECK ("slot" BETWEEN 1 AND 3);

-- Los pasos se numeran desde 1.
ALTER TABLE "order_step_evidence" ADD CONSTRAINT "order_step_evidence_step_position_positive"
  CHECK ("step_position" >= 1);

-- La base tampoco admite una ruta fuera de `<empresa>/<pedido>/`.
ALTER TABLE "order_step_evidence" ADD CONSTRAINT "order_step_evidence_path_prefix"
  CHECK ("path" LIKE "company_id"::text || '/' || "order_id"::text || '/%');

-- El tipo detectado por el contenido del archivo, nunca el que declara el cliente.
ALTER TABLE "order_step_evidence" ADD CONSTRAINT "order_step_evidence_content_type_allowed"
  CHECK ("content_type" IN ('image/jpeg', 'image/png', 'image/webp'));

-- Hasta 5 MB.
ALTER TABLE "order_step_evidence" ADD CONSTRAINT "order_step_evidence_size_bytes_range"
  CHECK ("size_bytes" > 0 AND "size_bytes" <= 5242880);

-- Compuestas con `company_id`: pedido y persona son de la misma empresa que la fila. RESTRICT
-- porque pedido y persona se borran de forma logica; un borrado fisico tiene que fallar.
ALTER TABLE "order_step_evidence" ADD CONSTRAINT "order_step_evidence_order_id_company_id_fkey"
  FOREIGN KEY ("order_id", "company_id") REFERENCES "orders"("id", "company_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_step_evidence" ADD CONSTRAINT "order_step_evidence_uploaded_by_company_id_fkey"
  FOREIGN KEY ("uploaded_by", "company_id") REFERENCES "users"("id", "company_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_step_evidence" ADD CONSTRAINT "order_step_evidence_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS activada y forzada, sin policies, al final.
ALTER TABLE "order_step_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_step_evidence" FORCE ROW LEVEL SECURITY;
