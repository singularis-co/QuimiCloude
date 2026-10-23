-- Rollback: pierde los subtipos y tipos guardados.

ALTER TABLE "products" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "supplier_catalog_lines" DROP CONSTRAINT "supplier_catalog_lines_packaging_subtype_matches_type";

ALTER TABLE "supplier_catalog_lines" DROP COLUMN "packaging_subtype";

ALTER TABLE "supplier_catalog_lines" DROP COLUMN "type";

ALTER TABLE "products" DROP CONSTRAINT "products_presentation_only_in_container";

ALTER TABLE "products" DROP CONSTRAINT "products_packaging_subtype_matches_type";

ALTER TABLE "products" DROP COLUMN "packaging_subtype";

DROP TYPE "CatalogLineType";

DROP TYPE "PackagingSubtype";

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE  ROW LEVEL SECURITY;
