-- Reversion exacta de `migration.sql`. Las asignaciones caen antes que los permisos:
-- `role_permissions_permission_code_fkey` es RESTRICT. Sin `UPDATE`, `ALTER`, `DROP` ni `CASCADE`.

DELETE FROM "role_permissions" WHERE "permission_code" IN ('modelos_ia.consultar', 'modelos_ia.modificar');
DELETE FROM "permissions" WHERE "code" IN ('modelos_ia.consultar', 'modelos_ia.modificar');
