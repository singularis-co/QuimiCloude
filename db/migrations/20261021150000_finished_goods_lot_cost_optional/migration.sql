-- Un lote de producto terminado nace sin coste unitario cuando su pedido no tiene
-- coste real (nunca 0 ni el estimado). Este CHECK lo impedia: todo lote con "package_content"
-- tenia que llevar "unit_cost". Se retira; "product_batches_unit_cost_positive" no se toca.
ALTER TABLE "product_batches" DROP CONSTRAINT "product_batches_package_content_requires_unit_cost";
