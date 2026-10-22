-- Migración de datos: solo escribe filas en `permissions`, `role_permissions`, `addons` y
-- `company_addon_overrides`. Cada sentencia es idempotente por `ON CONFLICT ... DO NOTHING`.
-- Los literales se duplican porque una migración no puede importar TypeScript; los tests los
-- comparan con las constantes de la app.

INSERT INTO "permissions" ("code", "module", "action", "description", "updated_at") VALUES
  ('notificaciones.consultar', 'notificaciones', 'consultar',
   'Consultar los avisos propios y marcarlos como leídos.', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT "r"."id", 'notificaciones.consultar' FROM "roles" AS "r"
WHERE "r"."name" IN ('Administrador', 'Operador', 'Empacador', 'Administrador de acondicionamiento')
ON CONFLICT ("role_id", "permission_code") DO NOTHING;

INSERT INTO "addons" ("key") VALUES ('notificaciones') ON CONFLICT ("key") DO NOTHING;

-- Las empresas que ya existen, también las de baja, lo conservan prendido; las que se den de alta
-- después nacen sin excepción, o sea apagadas. Autor vacío = sembrado.
INSERT INTO "company_addon_overrides" ("company_id", "addon_key", "enabled", "source")
SELECT "c"."id", 'notificaciones', true, 'manual' FROM "companies" AS "c"
ON CONFLICT ("company_id", "addon_key") DO NOTHING;
