-- Migración de datos: solo escribe filas en `addons`, `permissions`, `role_permissions` y
-- `company_addon_overrides`. Cada sentencia es idempotente por `ON CONFLICT ... DO NOTHING`.
-- Los literales se duplican porque una migración no puede importar TypeScript; los tests los
-- comparan con las constantes de la app.

INSERT INTO "addons" ("key") VALUES ('agente_ia_whatsapp') ON CONFLICT ("key") DO NOTHING;

INSERT INTO "permissions" ("code", "module", "action", "description", "updated_at") VALUES
  ('agente_ia.consultar', 'agente_ia', 'consultar', 'Ver la configuración del agente de IA de WhatsApp de la empresa.', CURRENT_TIMESTAMP),
  ('agente_ia.modificar', 'agente_ia', 'modificar', 'Cambiar la configuración del agente de IA de WhatsApp de la empresa.', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT "r"."id", "p"."code" FROM "roles" AS "r"
CROSS JOIN (VALUES ('agente_ia.consultar'), ('agente_ia.modificar')) AS "p"("code")
WHERE "r"."name" = 'Administrador'
ON CONFLICT ("role_id", "permission_code") DO NOTHING;

-- Hoy «integraciones prendido» es tener su excepción en `true`: el plan aún no se lee. Las empresas
-- de baja también cuentan. Autor vacío = sembrado.
INSERT INTO "company_addon_overrides" ("company_id", "addon_key", "enabled", "source")
SELECT "o"."company_id", 'agente_ia_whatsapp', true, 'manual' FROM "company_addon_overrides" AS "o"
WHERE "o"."addon_key" = 'integraciones' AND "o"."enabled"
ON CONFLICT ("company_id", "addon_key") DO NOTHING;
