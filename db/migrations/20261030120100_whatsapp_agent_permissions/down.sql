-- Las hijas antes que sus catálogos: las FK hacia `addons` y `permissions` son RESTRICT. Borra
-- todas las excepciones y asignaciones del añadido, no solo las que puso el UP.
DELETE FROM "company_addon_overrides" WHERE "addon_key" = 'agente_ia_whatsapp';
DELETE FROM "role_permissions" WHERE "permission_code" IN ('agente_ia.consultar', 'agente_ia.modificar');
DELETE FROM "permissions" WHERE "code" IN ('agente_ia.consultar', 'agente_ia.modificar');
DELETE FROM "addons" WHERE "key" = 'agente_ia_whatsapp';
