-- Prisma Migrate no genera downs: lo aplica `pnpm run db:rollback` en una sola transaccion junto
-- con el borrado de su fila de `_prisma_migrations`.
--
-- No cambia ninguna fila. Vuelve a la unicidad (empresa, codigo), que es mas estricta que la de
-- esta migracion: si los datos ya no la cumplen, se detiene entero antes de tocar ningun indice.

-- El bloque de aborto lee filas: con la RLS forzada y sin policies no veria ninguna.
ALTER TABLE "product_batches" NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  duplicated_lots  BIGINT;
  duplicated_rows  BIGINT;
BEGIN
  SELECT count(*), COALESCE(sum(repeated.copies), 0)
    INTO duplicated_lots, duplicated_rows
    FROM (
      SELECT "company_id", "lot", count(*) AS copies
        FROM "product_batches"
       GROUP BY "company_id", "lot"
      HAVING count(*) > 1
    ) AS repeated;

  IF duplicated_lots > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK ABORTADO: hay % codigo(s) de lote repetido(s) dentro de una misma empresa, repartidos en % fila(s) de `product_batches`. Tras esta migracion una empresa puede tener el mismo codigo en varios productos o presentaciones, y el indice unico `product_batches_company_lot_unique` (empresa, lote) no se puede recrear sobre ese dato: el rollback se detiene ENTERO y no deja ningun indice a medias. Localizalos con: SELECT company_id, lot, count(*) FROM product_batches GROUP BY 1, 2 HAVING count(*) > 1; y renombra esos lotes antes de revertir.',
      duplicated_lots, duplicated_rows;
  END IF;
END $$;

-- El estricto se crea primero: es el unico paso que puede fallar, y si falla no se ha quitado nada.
CREATE UNIQUE INDEX "product_batches_company_lot_unique" ON "product_batches" ("company_id", "lot");

DROP INDEX "product_batches_product_lot_unique";
DROP INDEX "product_batches_product_presentation_lot_unique";

ALTER TABLE "product_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_batches" FORCE ROW LEVEL SECURITY;
