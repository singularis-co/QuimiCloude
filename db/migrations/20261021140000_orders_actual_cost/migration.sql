-- AlterTable
ALTER TABLE "orders" ADD COLUMN "actual_cost" DECIMAL(14,4);

ALTER TABLE "orders" ADD CONSTRAINT "orders_actual_cost_non_negative"
  CHECK ("actual_cost" IS NULL OR "actual_cost" >= 0);

-- Solo un pedido que ya paso por Terminar el empaque puede tenerlo. `::text`, como el resto de
-- CHECK sobre "status": un down que recrea el enum no puede comparar el tipo viejo con el nuevo.
ALTER TABLE "orders" ADD CONSTRAINT "orders_actual_cost_requires_packed"
  CHECK ("actual_cost" IS NULL OR "status"::text IN
    ('POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO'));
