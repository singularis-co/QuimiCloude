-- Devuelve `asignaciones.consultar` al Administrador. Idempotente por `ON CONFLICT DO NOTHING`; no
-- toca ninguna otra fila.
INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT "r"."id", 'asignaciones.consultar'
FROM "roles" AS "r"
WHERE "r"."name" = 'Administrador'
ON CONFLICT ("role_id", "permission_code") DO NOTHING;
