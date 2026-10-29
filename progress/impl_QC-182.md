# QC-182 — modelo-de-planes · bitácora del implementer

Spec: `specs/QC-182-modelo-de-planes/` (aprobado 2026-10-28; P1 y P2 con su valor por defecto).
Rama: `feature/QC-182-modelo-de-planes`. Sin E2E (decisión cerrada en el spec).

## Commits

- Tanda 1 — `6ed1b95ac` feat(QC-182): modelo Plan y PlanAddon, migración de esquema y tests.
- Tanda 2 — `ec271bfc2` feat(QC-182): permisos de planes del Maestro, migración de datos y tests.
- Tanda 3 — esta bitácora y la ficha.

## Archivos

Creados:
- `lib/modules/identity/domain/plan-currency.ts`
- `db/migrations/20261028120000_plans/migration.sql`, `down.sql`
- `db/migrations/20261028120100_plans_permissions/migration.sql`, `down.sql`
- `tests/unit/identity/schema/plans-migration.test.ts`
- `tests/unit/identity/schema/plans-permissions-migration.test.ts`
- `tests/integration/identity/plans-constraints.int.test.ts`
- `tests/integration/identity/plans-migration.int.test.ts`
- `tests/integration/identity/plans-permissions-migration.int.test.ts`

Modificados:
- `db/schema.prisma`, `lib/modules/identity/index.ts`, `lib/modules/identity/domain/permissions.ts`,
  `lib/modules/identity/domain/company-addons.ts`, `docs/architecture.md`
- `tests/guards/guard-empresa-en-esquema.test.ts`, `tests/guards/guard-identificador-de-request.test.ts`
- `tests/integration/aislamiento.json`, `tests/integration/identity/identity-seed.int.test.ts`
- `tests/unit/identity/permissions.test.ts`, `tests/unit/identity/seed/seed-initial-access.test.ts`,
  `tests/unit/navegacion/qc75-convenciones.test.ts`,
  `tests/unit/asignaciones/schema/order-assignments-migration.test.ts`,
  `tests/unit/identity/addons/company-addons.test.ts`
- Por arrastre (design § 6, «otro test que fije el Maestro»):
  `tests/unit/identity/schema/maestro-migration.test.ts` y
  `tests/integration/identity/maestro-migration.int.test.ts`. `CODIGOS_DEL_MAESTRO` se filtra a
  `empresas.*`, porque la migración de QC-161 solo reparte esos; los `planes.*` los reparte
  `20261028120100_plans_permissions`.

## Trazabilidad R<n> → test

| R | Test |
|---|---|
| R1 | `tests/unit/identity/schema/plans-migration.test.ts` |
| R2 | `tests/integration/identity/plans-constraints.int.test.ts` |
| R3 | `plans-migration.test.ts` |
| R4 | `plans-constraints.int.test.ts` |
| R5 | `plans-constraints.int.test.ts` |
| R6 | `plans-constraints.int.test.ts` |
| R7 | `plans-migration.test.ts` |
| R8 | `plans-constraints.int.test.ts` |
| R9 | `plans-constraints.int.test.ts` |
| R10 | `plans-constraints.int.test.ts` |
| R11 | `plans-constraints.int.test.ts` |
| R12 | `plans-constraints.int.test.ts` |
| R13 | `plans-migration.test.ts`, `plans-constraints.int.test.ts` |
| R14 | `plans-constraints.int.test.ts` |
| R15 | `plans-constraints.int.test.ts` |
| R16 | `plans-constraints.int.test.ts` |
| R17 | `plans-constraints.int.test.ts` |
| R18 | `plans-constraints.int.test.ts` (con un caso testigo: sin el módulo en el plan, el borrado pasa) |
| R19 | `plans-constraints.int.test.ts` |
| R20 | `plans-constraints.int.test.ts` |
| R21 | `plans-constraints.int.test.ts` |
| R22 | `plans-constraints.int.test.ts` |
| R23 | `plans-constraints.int.test.ts` |
| R24 [P1] | `plans-constraints.int.test.ts` |
| R25 [P1] | `plans-constraints.int.test.ts` |
| R26 | `plans-migration.test.ts`, `tests/integration/identity/plans-migration.int.test.ts` |
| R27 | `tests/unit/identity/permissions.test.ts`, `tests/unit/identity/schema/plans-permissions-migration.test.ts` |
| R28 | `permissions.test.ts`, `tests/unit/identity/seed/seed-initial-access.test.ts`, `plans-permissions-migration.test.ts` |
| R29 | `permissions.test.ts` |
| R30 | `tests/unit/identity/addons/company-addons.test.ts` |
| R31 | `plans-permissions-migration.test.ts`, `tests/integration/identity/plans-permissions-migration.int.test.ts` |
| R32 | `tests/integration/identity/identity-seed.int.test.ts` (base ya sembrada y base vacía, con doble corrida) |
| R33 | `plans-migration.test.ts`, `plans-migration.int.test.ts`, `plans-permissions-migration.test.ts`, `plans-permissions-migration.int.test.ts` |

## Verificación local (acotada por regla del humano: el gate completo corre en GitHub CI)

- `npx prisma validate`: «The schema at db\schema.prisma is valid». `npx prisma generate`: OK (v6.19.3).
- `npx tsc --noEmit`: un único error, `app/layout.tsx(45,56): Cannot find name 'LayoutProps'`.
  Es del entorno: el worktree no tiene `.next`, donde vive ese tipo generado. Ese archivo no se tocó.
- `npx vitest run` sobre los 9 archivos unitarios tocados (`permissions`, `seed-initial-access`,
  `qc75-convenciones`, `order-assignments-migration`, `company-addons`, `plans-migration`,
  `plans-permissions-migration`, `maestro-migration`, `whatsapp-read-permission-migration`):
  `Test Files 9 passed (9) · Tests 283 passed | 3 skipped (286)`. Los 3 skip de `qc75-convenciones`
  dependen de `git origin/dev`.
- **No se corrieron en local**: los `.int` (5 tocados), las guardias (`guard-empresa-en-esquema`,
  `guard-identificador-de-request`, `guard-aislamiento-integracion`, permisos), `vitest related`
  ni `./init.sh`. Se validan en CI (`gate-completo`). Por eso **T3.2 queda sin marcar**.

## Desvíos del spec

- `MIGRACIONES_ESPERADAS`: la Tanda 1 añadió `_plans` y la Tanda 2 añadió `_plans_permissions`, cada
  una cuando existía su carpeta. El design § 2.4 decía «las dos» en T1.4.
- R18 (int): antes de borrar el añadido, el test borra en la misma transacción sus excepciones por
  empresa, porque también tienen una FK RESTRICT hacia `addons`.
- `plans-migration.int`: la consulta de restricciones filtra `contype <> 'n'` (NOT NULL de PG 18).
- `permissions.test.ts`: `planes` entra en `MODULOS` y `MODULOS_CON_ESCRITURA`. Los filtros
  `sinPlanes` se aplican en más sitios de los que listaba el design: el Maestro en cinco y
  `ADMIN_EXCLUDED_PERMISSIONS` en dos.
- `identity-seed.int`: R32 lleva dos casos, uno por cada mitad del requisito.
- `maestro-migration` (unit e int) ampliados por arrastre; ver arriba.
- Entorno: el `node_modules` del worktree está vacío, así que se usó `npx`. `prisma generate` escribió
  el cliente en el `node_modules` compartido (solo añade `Plan` y `PlanAddon`).
