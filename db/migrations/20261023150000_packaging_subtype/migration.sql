-- Escrita a mano: subtipo de empaque en products y tipo/subtipo en supplier_catalog_lines.

-- El relleno escribe products: se suelta FORCE mientras dura.
ALTER TABLE "products" NO FORCE ROW LEVEL SECURITY;

CREATE TYPE "PackagingSubtype" AS ENUM ('CONTAINER', 'CAP', 'MEASURER', 'OTHER');

CREATE TYPE "CatalogLineType" AS ENUM ('RAW_MATERIAL', 'TOOL', 'PACKAGING_MATERIAL');

ALTER TABLE "products" ADD COLUMN "packaging_subtype" "PackagingSubtype";

-- Vivos y dados de baja. Sin tocar updated_at: es un relleno, no una edicion.
UPDATE "products" SET "packaging_subtype" = 'CONTAINER' WHERE "type" = 'PACKAGING';

ALTER TABLE "products" ADD CONSTRAINT "products_packaging_subtype_matches_type" CHECK (
  ("type" = 'PACKAGING') = ("packaging_subtype" IS NOT NULL)
);

-- El envase no exige presentacion aqui: hay envases antiguos sin ella.
ALTER TABLE "products" ADD CONSTRAINT "products_presentation_only_in_container" CHECK (
  "packaging_subtype" IS NULL OR "packaging_subtype" = 'CONTAINER' OR "presentation_id" IS NULL
);

ALTER TABLE "supplier_catalog_lines" ADD COLUMN "type" "CatalogLineType";

ALTER TABLE "supplier_catalog_lines" ADD COLUMN "packaging_subtype" "PackagingSubtype";

-- Con "=" una linea sin tipo daria NULL y el CHECK la dejaria pasar.
ALTER TABLE "supplier_catalog_lines" ADD CONSTRAINT "supplier_catalog_lines_packaging_subtype_matches_type" CHECK (
  "packaging_subtype" IS NULL OR "type" IS NOT DISTINCT FROM 'PACKAGING_MATERIAL'
);

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE  ROW LEVEL SECURITY;
