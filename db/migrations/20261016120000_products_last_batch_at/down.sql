DROP INDEX IF EXISTS "products_company_id_last_batch_at_idx";
ALTER TABLE "products" DROP COLUMN "last_batch_at";
