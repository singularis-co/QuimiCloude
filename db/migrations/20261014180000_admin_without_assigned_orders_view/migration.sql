-- Migracion de DATOS: no crea, altera ni borra ninguna tabla, columna, indice, restriccion, tipo,
-- funcion, disparador ni politica de RLS; solo borra una fila de `role_permissions`.
--
-- El Administrador deja de tener `asignaciones.consultar`: esa pantalla duplica lo que ya ve y
-- asigna desde «Pedidos» (`pedidos.consultar` + `asignaciones.modificar`, que conserva). Los roles
-- operativos no cambian. El rol se resuelve por nombre: `roles.id` es distinto en cada instalacion.
-- Idempotente: si la fila no existe, no borra nada.
DELETE FROM "role_permissions"
WHERE "permission_code" = 'asignaciones.consultar'
  AND "role_id" IN (SELECT "id" FROM "roles" WHERE "name" = 'Administrador');
