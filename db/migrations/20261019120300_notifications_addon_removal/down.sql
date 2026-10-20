-- Vuelve a escribir lo que escribe la migración del añadido, con el mismo SQL idempotente. Es
-- aproximado: prende el añadido en todas las empresas que existan al revertir, no solo en las que
-- lo tenían antes de aplicar el UP.
INSERT INTO "permissions" ("code", "module", "action", "description", "updated_at") VALUES
  ('notificaciones.consultar', 'notificaciones', 'consultar',
   'Consultar los avisos propios y marcarlos como leídos.', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT "r"."id", 'notificaciones.consultar' FROM "roles" AS "r"
WHERE "r"."name" IN ('Administrador', 'Operador', 'Empacador', 'Administrador de acondicionamiento')
ON CONFLICT ("role_id", "permission_code") DO NOTHING;

INSERT INTO "addons" ("key") VALUES ('notificaciones') ON CONFLICT ("key") DO NOTHING;

INSERT INTO "company_addon_overrides" ("company_id", "addon_key", "enabled", "source")
SELECT "c"."id", 'notificaciones', true, 'manual' FROM "companies" AS "c"
ON CONFLICT ("company_id", "addon_key") DO NOTHING;
