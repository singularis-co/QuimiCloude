-- Cuando se cargo el ultimo lote de cada producto, para ordenar el inventario por defecto. La
-- escribe la aplicacion al dar de alta un lote, importarlo o recibir el de una produccion; ajustes,
-- consumos, entregas y ediciones no la tocan.
--
-- Escrita a mano: el indice ordena con `NULLS LAST` y es parcial, y Prisma no modela ninguna de
-- las dos cosas. Se aplica con `pnpm run db:migrate`.

-- Parentesis de RLS: con RLS forzada y sin policies, el dueno no ve ninguna fila y el relleno no
-- tocaria nada.
ALTER TABLE "products"        NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "product_batches" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "products" ADD COLUMN "last_batch_at" TIMESTAMPTZ(6);

-- Relleno con el lote mas reciente de cada producto, sea cual sea su origen. Sin lotes queda NULL.
UPDATE "products" AS p
   SET "last_batch_at" = b."last_created_at"
  FROM (
    SELECT "product_id", max("created_at") AS "last_created_at"
      FROM "product_batches"
     GROUP BY "product_id"
  ) AS b
 WHERE b."product_id" = p."id";

CREATE INDEX "products_company_id_last_batch_at_idx"
  ON "products" ("company_id", "last_batch_at" DESC NULLS LAST)
  WHERE "deleted_at" IS NULL;

ALTER TABLE "products"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products"        FORCE  ROW LEVEL SECURITY;
ALTER TABLE "product_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_batches" FORCE  ROW LEVEL SECURITY;
