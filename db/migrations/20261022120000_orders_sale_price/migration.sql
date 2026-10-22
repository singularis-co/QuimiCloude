-- AlterTable
ALTER TABLE "orders" ADD COLUMN "sale_price" DECIMAL(14,4);

ALTER TABLE "orders" ADD CONSTRAINT "orders_sale_price_non_negative"
  CHECK ("sale_price" IS NULL OR "sale_price" >= 0);
