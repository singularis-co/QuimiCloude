-- Reversion exacta de `migration.sql`: recrea el CHECK tal como lo creo
-- `20260924190100_finished_products_and_content_copies`.
--
-- AVISO: falla (23514) si ya hay lotes con "package_content" y "unit_cost" NULL, es decir, lotes
-- de producto terminado de un pedido sin coste real (QC-305 R17). Antes de revertir hay que
-- decidir que hacer con ellos; este archivo no los rellena.
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_package_content_requires_unit_cost"
  CHECK ("package_content" IS NULL OR "unit_cost" IS NOT NULL);
