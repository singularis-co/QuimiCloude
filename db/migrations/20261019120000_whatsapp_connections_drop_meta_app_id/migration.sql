-- Correctiva: quita `whatsapp_connections.meta_app_id` donde siga existiendo.
--
-- La primera version de `20261009130000_whatsapp_connections` creaba la columna `TEXT NOT NULL`.
-- QC-237 (commit 729fe8ef) la retiro editando esa migracion en su sitio, asi que las bases que ya
-- la habian aplicado conservan la columna y el esquema ya no la escribe: todo INSERT falla con
-- "Null constraint violation on the fields: (`meta_app_id`)".
--
-- `IF EXISTS`: en las bases creadas despues de QC-237 la columna nunca existio y esto no hace
-- nada. Se aplica con `pnpm run db:migrate` (`prisma migrate deploy`).

ALTER TABLE "whatsapp_connections" DROP COLUMN IF EXISTS "meta_app_id";
