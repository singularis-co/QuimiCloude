-- Migracion de DATOS: solo escribe filas en `permissions` y `role_permissions`; no toca el
-- esquema ni la tabla `roles`. Las dos sentencias son idempotentes por `ON CONFLICT ... DO NOTHING`.
-- Los literales se duplican porque una migracion no puede importar TypeScript, y un test estatico
-- los compara contra las constantes de la app.

INSERT INTO "permissions" ("code", "module", "action", "description", "updated_at") VALUES
  ('planes.consultar', 'planes', 'consultar', 'Consultar los planes de la plataforma.', CURRENT_TIMESTAMP),
  ('planes.modificar', 'planes', 'modificar', 'Dar de alta, editar y desactivar los planes de la plataforma.', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT "r"."id", "p"."code" FROM "roles" AS "r"
CROSS JOIN (VALUES ('planes.consultar'), ('planes.modificar')) AS "p"("code")
WHERE "r"."name" = 'Maestro'
ON CONFLICT ("role_id", "permission_code") DO NOTHING;
