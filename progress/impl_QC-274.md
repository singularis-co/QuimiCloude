# impl QC-274 — responsables solo Operador y Empacador

Ficha sin SDD (backend, low), aprobada por el humano el 2026-10-13. Enmienda QC-145 R32/D13:
la elegibilidad de responsable pasa de «sin `pedidos.consultar`» a «rol Operador o Empacador».

## Decisiones

- Una sola definicion: `ORDER_RESPONSIBLE_FILTERS` (`accountStatus: ['active']`,
  `roles: [ROLE_OPERADOR, ROLE_EMPACADOR]`) e `isOrderResponsible`, en
  `lib/modules/identity/domain/order-responsible.ts`. Va en `identity` y no en `asignaciones`
  porque `guard-autorizacion-por-permiso` prohibe nombres de rol (y `roleName`) en los modulos de
  negocio. `asignaciones/domain/responsible-eligibility.ts` delega y reexporta.
- `PeopleRefFilters.roles` (nombres de rol; vacio = todos) y `PersonRef.roleName`.
- Adaptador `listAliveInCompany`: `roles` va en el `WHERE`; con `accountStatus` la consulta va sin
  `take` y el tope se corta DESPUES del filtro en memoria (el estado efectivo no se puede llevar
  a SQL sin una segunda definicion, R21). Sin `accountStatus`, el `take` sigue en la consulta.
  Afecta tambien a `list-conditioning-team-candidates` solo a mejor: nunca devuelve menos.
- El equipo de acondicionamiento conserva el criterio por permiso (`isNotOrdersSupervisor` local en
  `conditioning-team.ts`): con el criterio nuevo quedarian fuera los de Acondicionamiento.
- Fixture de integracion de asignaciones: la persona por defecto usa el rol SEMBRADO Operador
  (`findSeedRoleId`), no un rol efimero, que ya no seria asignable.

## Archivos

lib: `identity/domain/{people-directory,order-responsible}.ts`, `identity/index.ts`,
`identity/adapters/driven/persistence/assignment-directory-prisma.ts`,
`asignaciones/domain/{responsible-eligibility,list-responsible-candidates,assign-responsibles,conditioning-team}.ts`,
`asignaciones/index.ts`.
tests: `unit/asignaciones/{responsible-eligibility,list-responsible-candidates,assign-responsibles,order-assignment-actions}.test.ts`,
`integration/asignaciones/{responsible-eligibility.int.test,use-case-fixture,finish-auto-assign-packers.int.test}.ts`,
`integration/identity/assignment-directory.int.test.ts`, y `roleName` en dobles de `PersonRef`
(13 archivos unit).

## Mapa caso -> test

- Acondicionamiento excluido: `responsible-eligibility.test.ts`; int `responsible-eligibility.int.test.ts` (selector y grupo).
- Administrador excluido: idem + `assign-responsibles.test.ts` («un Administrador suelto»).
- Operador y Empacador incluidos: `responsible-eligibility.test.ts`, `assign-responsibles.test.ts`, int «un Operador y un Empacador sueltos».
- Asignar a Acondicionamiento se rechaza en servidor: `assign-responsibles.test.ts`, int «asignar a un Administrador de acondicionamiento», `order-assignment-actions.test.ts` (code).
- Mas de 25 personas sin perder candidatos: int «el selector solo ofrece... el tope no se come ninguno».
- Filtro `roles` antes del limite (adaptador): `assignment-directory.int.test.ts` «`roles` filtra ... ANTES del tope»; tope tras `accountStatus`: «el tope va DESPUES del filtro de estado».

## Verificacion

- `pnpm typecheck`: limpio (tras `prisma generate` y `next typegen` en el worktree recien instalado).
- `pnpm lint`: 0 errores, 7 warnings preexistentes (documentos, pedidos).
- `pnpm exec vitest run guard tests/unit/asignaciones tests/unit/integraciones/module-shape.test.ts tests/integration/asignaciones tests/integration/identity/assignment-directory.int.test.ts tests/unit/pedidos/list-order-deliveries.test.ts`: 196 archivos, 3286 tests verdes, 21 skipped. Base local respondio.
- `pnpm exec vitest related --run <diff>`: 744 archivos, 11928 verdes, 14 skipped, 1 rojo (el preexistente de abajo).
- Preexistente, no de este cambio: `tests/integration/proveedores/catalog-line.int.test.ts` R32 falla igual sin el diff (comprobado con `git stash`).

Veredicto: hecho; la regla vale en selector y servidor con una sola definicion en `identity`.
