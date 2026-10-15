-- Envases contados al terminar el empaque, con el motivo de la diferencia contra el plan.
--
-- Las columnas las genera Prisma; los CHECK van a mano. Sin backfill: NULL se lee como igual al
-- plan y distingue una linea terminada antes de que se contara de una sin diferencias.

-- AlterTable
ALTER TABLE "order_presentation_lines" ADD COLUMN     "packed_packages" INTEGER,
ADD COLUMN     "packed_reason" TEXT,
ADD COLUMN     "packed_reason_other" TEXT;

ALTER TABLE "order_presentation_lines"
  ADD CONSTRAINT "order_presentation_lines_packed_packages_non_negative"
  CHECK ("packed_packages" IS NULL OR "packed_packages" >= 0);

ALTER TABLE "order_presentation_lines"
  ADD CONSTRAINT "order_presentation_lines_packed_reason_in_catalog"
  CHECK ("packed_reason" IS NULL
         OR "packed_reason" IN ('merma', 'rotura', 'conteo_fisico', 'error_de_carga', 'otro'));

-- Motivo si y solo si hay diferencia; con envases de mas, merma y rotura no valen.
ALTER TABLE "order_presentation_lines"
  ADD CONSTRAINT "order_presentation_lines_packed_reason_matches_count"
  CHECK (
       ("packed_packages" IS NULL AND "packed_reason" IS NULL)
    OR ("packed_packages" = "packages" AND "packed_reason" IS NULL)
    OR ("packed_packages" < "packages" AND "packed_reason" IS NOT NULL)
    OR ("packed_packages" > "packages" AND "packed_reason" IN ('conteo_fisico', 'error_de_carga', 'otro'))
  );

ALTER TABLE "order_presentation_lines"
  ADD CONSTRAINT "order_presentation_lines_packed_reason_other_matches"
  CHECK (
       ("packed_reason" = 'otro' AND "packed_reason_other" IS NOT NULL
        AND btrim("packed_reason_other") <> '' AND char_length("packed_reason_other") <= 200)
    OR ("packed_reason" IS DISTINCT FROM 'otro' AND "packed_reason_other" IS NULL)
  );
