-- El lote pasa a ser unico por producto + presentacion + codigo dentro de la empresa. Prisma no
-- modela indices parciales: estos dos son drift.
--
-- Se crean los nuevos antes de quitar el viejo: son mas debiles que (empresa, codigo), asi que no
-- pueden fallar por datos, y si la migracion se corta a medias la tabla nunca queda sin unicidad.
-- Solo DDL: no cambia ninguna fila.

-- `presentation_id` es anulable y Postgres trata cada NULL como distinto: un unico indice de cuatro
-- columnas dejaria pasar dos lotes iguales sin presentacion. Por eso van dos indices parciales.
CREATE UNIQUE INDEX "product_batches_product_presentation_lot_unique"
  ON "product_batches" ("company_id", "product_id", "presentation_id", "lot")
  WHERE "presentation_id" IS NOT NULL;

CREATE UNIQUE INDEX "product_batches_product_lot_unique"
  ON "product_batches" ("company_id", "product_id", "lot")
  WHERE "presentation_id" IS NULL;

DROP INDEX "product_batches_company_lot_unique";
