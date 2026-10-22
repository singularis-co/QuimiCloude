-- Las hijas antes que sus catálogos: las dos FK hacia `addons` y `permissions` son RESTRICT. Borra
-- todas las excepciones y asignaciones del añadido, no solo las que puso el UP.
DELETE FROM "company_addon_overrides" WHERE "addon_key" = 'notificaciones';
DELETE FROM "addons" WHERE "key" = 'notificaciones';
DELETE FROM "role_permissions" WHERE "permission_code" = 'notificaciones.consultar';
DELETE FROM "permissions" WHERE "code" = 'notificaciones.consultar';
