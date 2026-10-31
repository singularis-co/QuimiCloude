-- Migracion de DATOS: solo escribe filas en `permissions` y `role_permissions`; no toca el
-- esquema ni la tabla `roles`. Las dos sentencias son idempotentes por `ON CONFLICT ... DO NOTHING`.
-- Los literales se duplican porque una migracion no puede importar TypeScript, y un test estatico
-- los compara contra las constantes de la app.

INSERT INTO "permissions" ("code", "module", "action", "description", "updated_at") VALUES
  ('modelos_ia.consultar', 'modelos_ia', 'consultar', 'Consultar los modelos de IA de la plataforma.', CURRENT_TIMESTAMP),
  ('modelos_ia.modificar', 'modelos_ia', 'modificar', 'Elegir los modelos de IA de la plataforma.', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT "r"."id", "p"."code" FROM "roles" AS "r"
CROSS JOIN (VALUES ('modelos_ia.consultar'), ('modelos_ia.modificar')) AS "p"("code")
WHERE "r"."name" = 'Maestro'
ON CONFLICT ("role_id", "permission_code") DO NOTHING;
