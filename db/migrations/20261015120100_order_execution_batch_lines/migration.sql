-- Foto de las lineas de lote escritas en cada guardado de datos de lote. Va aparte de la migracion
-- que anade las acciones porque sus CHECK comparan contra esos valores (55P04).
--
-- La forma de cada elemento no se comprueba aqui: la valida el adaptador al escribir y al leer.

-- AlterTable
ALTER TABLE "order_execution_entries" ADD COLUMN "batch_lines" JSONB;

-- La foto existe si y solo si la accion es el guardado de datos de lote.
ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_batch_lines_matches_action"
  CHECK (("action"::text = 'CONDITIONING_BATCH_SAVE') = ("batch_lines" IS NOT NULL));

ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_batch_lines_non_empty_array"
  CHECK ("batch_lines" IS NULL OR (jsonb_typeof("batch_lines") = 'array' AND jsonb_array_length("batch_lines") >= 1));

-- El acondicionamiento no recorre pasos de la receta.
ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_conditioning_has_no_step"
  CHECK ("action"::text NOT IN ('CONDITIONING_START','CONDITIONING_BATCH_SAVE','CONDITIONING_FINISH') OR "step_position" IS NULL);
