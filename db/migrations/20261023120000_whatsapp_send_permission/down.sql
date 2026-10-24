-- Reversion exacta de `migration.sql`. Las asignaciones caen antes que el permiso:
-- `role_permissions_permission_code_fkey` es RESTRICT. Sin `UPDATE`, `ALTER`, `DROP` ni `CASCADE`.

DELETE FROM "role_permissions" WHERE "permission_code" = 'whatsapp.enviar';
DELETE FROM "permissions" WHERE "code" = 'whatsapp.enviar';
