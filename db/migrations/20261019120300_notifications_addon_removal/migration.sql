-- Migración de datos: retira el permiso `notificaciones.consultar` y el añadido `notificaciones`,
-- que escribió una migración anterior ya publicada. Consultar los avisos propios no pide permiso.
-- Las hijas antes que sus catálogos: las FK hacia `addons` y `permissions` son RESTRICT. Son
-- `DELETE ... WHERE`: no falla si las filas no existen y aplicarla otra vez no cambia nada.
DELETE FROM "company_addon_overrides" WHERE "addon_key" = 'notificaciones';
DELETE FROM "addons" WHERE "key" = 'notificaciones';
DELETE FROM "role_permissions" WHERE "permission_code" = 'notificaciones.consultar';
DELETE FROM "permissions" WHERE "code" = 'notificaciones.consultar';
