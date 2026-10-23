-- Los pasos de acondicionamiento de la receta y los responsables de cada anotacion de paso. Va
-- aparte de la migracion que anade las acciones porque sus CHECK y su indice comparan contra esos
-- valores (55P04).
--
-- Sin relleno: el DEFAULT deja toda receta existente sin pasos de acondicionamiento. La forma de
-- cada elemento de "responsible_user_ids" no se comprueba aqui: la valida el adaptador al escribir
-- y al leer.

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN "conditioning_steps" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "order_execution_entries" ADD COLUMN "responsible_user_ids" JSONB;

-- Las anotaciones de paso de acondicionamiento llevan siempre posicion.
ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_conditioning_step_has_position"
  CHECK ("action"::text NOT IN ('CONDITIONING_STEP_ADVANCE','CONDITIONING_STEPS_COMPLETE','CONDITIONING_RESPONSIBLES_CHANGE')
         OR "step_position" IS NOT NULL);

-- Responsables solo en esas tres; obligatorios en el cambio; nunca lista vacia.
ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_responsibles_matches_action"
  CHECK (("responsible_user_ids" IS NULL
          OR "action"::text IN ('CONDITIONING_STEP_ADVANCE','CONDITIONING_STEPS_COMPLETE','CONDITIONING_RESPONSIBLES_CHANGE'))
     AND ("action"::text <> 'CONDITIONING_RESPONSIBLES_CHANGE' OR "responsible_user_ids" IS NOT NULL));
ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_responsibles_non_empty_array"
  CHECK ("responsible_user_ids" IS NULL
         OR (jsonb_typeof("responsible_user_ids") = 'array' AND jsonb_array_length("responsible_user_ids") >= 1));

-- Un paso se completa una sola vez por pedido: dos pestanas no pueden completar el mismo. El
-- predicado compara el enum sin `::text`: el cast a texto no es IMMUTABLE y Postgres lo rechaza en
-- un indice (42P17).
CREATE UNIQUE INDEX "order_execution_entries_conditioning_step_once"
  ON "order_execution_entries" ("order_id", "step_position")
  WHERE "action" IN ('CONDITIONING_STEP_ADVANCE','CONDITIONING_STEPS_COMPLETE');
