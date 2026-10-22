-- Reversion exacta de `migration.sql`, en orden inverso.

ALTER TABLE "orders" DROP CONSTRAINT "orders_actual_cost_requires_packed";
ALTER TABLE "orders" DROP CONSTRAINT "orders_actual_cost_non_negative";
ALTER TABLE "orders" DROP COLUMN "actual_cost";
