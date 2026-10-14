ALTER TABLE "companies" ADD COLUMN "addons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "companies"
   SET "addons" = ARRAY['dashboard','proveedores','lectura_pdf','importacion_excel','integraciones']::TEXT[];
