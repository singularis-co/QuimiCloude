-- Reversion exacta de `migration.sql`, en orden inverso. DESTRUCTIVA: el precio lo escribio una
-- persona y no se puede recalcular; exporta la columna antes de revertir con datos reales.

ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_sale_price_non_negative";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "sale_price";
