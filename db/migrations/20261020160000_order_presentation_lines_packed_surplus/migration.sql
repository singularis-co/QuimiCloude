-- AlterTable
ALTER TABLE "order_presentation_lines" ADD COLUMN     "packed_surplus_packages" INTEGER NOT NULL DEFAULT 0;

-- Solo una linea contada y por encima de su plan puede dejar envases libres, y nunca mas que lo
-- que paso del plan.
ALTER TABLE "order_presentation_lines"
  ADD CONSTRAINT "order_presentation_lines_packed_surplus_within_excess"
  CHECK (
       "packed_surplus_packages" = 0
    OR ("packed_packages" IS NOT NULL
        AND "packed_surplus_packages" > 0
        AND "packed_surplus_packages" <= "packed_packages" - "packages")
  );
