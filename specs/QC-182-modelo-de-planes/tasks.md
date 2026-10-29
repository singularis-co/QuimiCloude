# QC-182 — modelo-de-planes · tasks.md

> Diseño: `design.md`. Requisitos: `requirements.md` (R1–R33). Sin E2E (decisión cerrada).
> Verificación de cada tanda: `pnpm run typecheck`, `pnpm run lint`,
> `pnpm exec vitest related --run <archivos tocados>` y `pnpm exec vitest run guard`
> (`docs/perfil-agentes.md > Todos los agentes`). Los `.int.test.ts` corren contra la base de test
> (`docs/verification.md`). Un commit por tarea lógica.
>
> Antes de T2.1: fijar los timestamps de las dos migraciones a algo posterior a la última de `dev`
> (hoy `20261024130000`). Abajo van como `20261028120000` y `20261028120100`.

## Tanda 1 — Modelo y migración del esquema

- [x] **T1.1** Constante de moneda.
  - Archivos: `lib/modules/identity/domain/plan-currency.ts` (nuevo), `lib/modules/identity/index.ts`
    (reexporta `PLAN_CURRENCIES` y `PlanCurrency`).
  - Hecho: typecheck verde; el barril la exporta.
- [x] **T1.2** Modelos Prisma `Plan` y `PlanAddon`, relación inversa en `Addon` (design § 2.2).
  - Archivos: `db/schema.prisma`.
  - Depende de: —.
  - Hecho: `pnpm exec prisma validate` y `prisma generate` sin errores; los dos modelos con
    `/// @module identity`.
- [x] **T1.3** Migración `20261028120000_plans` con `migration.sql` y `down.sql` (design § 2.3).
  - Depende de: T1.2.
  - Hecho: `migrate deploy` sobre la base de test aplica; `pnpm run db:rollback` la revierte;
    `prisma migrate diff` solo muestra el drift conocido (`CHECK`, índice parcial).
- [x] **T1.4** Guardias y docs (design § 2.4).
  - Archivos: `tests/guards/guard-empresa-en-esquema.test.ts` (`EXENTAS` + recuento a catorce),
    `docs/architecture.md` (bullet de exentas; frase en «Moneda por empresa»),
    `tests/guards/guard-identificador-de-request.test.ts` (`MIGRACIONES_ESPERADAS`).
  - Depende de: T1.3.
  - Hecho: `pnpm exec vitest run guard` verde (incluida `guard-rls-force`).
- [x] **T1.5** Test estático del esquema.
  - Archivo: `tests/unit/identity/schema/plans-migration.test.ts`.
  - Cubre: **R1, R3, R7, R13, R26, R33** (design § 7). Cada predicado con su copia mutada en
    memoria que lo pone rojo.
  - Depende de: T1.1, T1.3.
- [x] **T1.6** Tests de integración del esquema.
  - Archivos: `tests/integration/identity/plans-constraints.int.test.ts`,
    `tests/integration/identity/plans-migration.int.test.ts`, `tests/integration/aislamiento.json`
    (los dos en `transaccion`).
  - Cubre: **R2, R4, R5, R6, R8, R9, R10, R11, R12, R13, R14, R15, R16, R17, R18, R19, R20, R21,
    R22, R23, R24 [P1], R25 [P1]** en `plans-constraints`; **R26, R33** en `plans-migration`.
  - Depende de: T1.3.
  - Hecho: verdes contra la base de test; `guard-aislamiento-integracion` verde.

## Tanda 2 — Permisos de planes

- [x] **T2.1** Catálogo, seed por rol, exclusiones y núcleo (design § 4.1, § 4.2).
  - Archivos: `lib/modules/identity/domain/permissions.ts`,
    `lib/modules/identity/domain/company-addons.ts`.
  - Hecho: typecheck verde; `guard-permisos-sembrados` y `guard-permisos-no-administrables` verdes.
- [x] **T2.2** Migración de datos `20261028120100_plans_permissions` con `migration.sql` y
  `down.sql` (design § 4.3).
  - Archivos: las dos de la carpeta; `tests/guards/guard-identificador-de-request.test.ts`
    (`MIGRACIONES_ESPERADAS`).
  - Depende de: T2.1, T1.4 (mismo archivo de guardia).
  - Hecho: aplica y revierte sobre la base de test.
- [x] **T2.3** Tests que fijan el catálogo y el Maestro, por arrastre (design § 6).
  - Archivos: `tests/unit/identity/permissions.test.ts`,
    `tests/unit/identity/seed/seed-initial-access.test.ts`,
    `tests/unit/navegacion/qc75-convenciones.test.ts`,
    `tests/unit/asignaciones/schema/order-assignments-migration.test.ts`,
    `tests/unit/identity/addons/company-addons.test.ts`.
  - Cubre: **R27, R28, R29** (`describe` nuevo en `permissions.test.ts`), **R30**
    (`company-addons.test.ts`).
  - Depende de: T2.1.
  - Hecho: los casos previos siguen verdes comparando sin `planes.*`; los nuevos fallan si se
    quita cualquiera de los dos códigos del Maestro o se le da a otro rol.
- [x] **T2.4** Tests de la migración de permisos y del seed.
  - Archivos: `tests/unit/identity/schema/plans-permissions-migration.test.ts`,
    `tests/integration/identity/plans-permissions-migration.int.test.ts`,
    `tests/integration/identity/identity-seed.int.test.ts`, `tests/integration/aislamiento.json`.
  - Cubre: **R27, R28, R31, R33** (estático), **R31, R33** (integración), **R32** (seed).
  - Depende de: T2.2.
  - Hecho: verdes contra la base de test.

## Tanda 3 — Cierre

- [ ] **T3.1** Trazabilidad `R<n> → test` en `progress/impl_QC-182.md`, con los 33 requisitos y
  la marca [P1] en R24 y R25.
- [ ] **T3.2** `./init.sh` verde y todas las tareas de arriba marcadas. Sin E2E.

Paralelizable: **T1.1 [P]** con **T1.2**; **T2.1 [P]** con toda la Tanda 1 salvo T1.4 y T2.2,
que comparten `guard-identificador-de-request.test.ts`, y T1.6/T2.4, que comparten
`aislamiento.json`. Por simplicidad se recomienda ir en orden: Tanda 1 → Tanda 2 → Tanda 3.

## Trazabilidad R<n> → test

| R | Test |
|---|---|
| R1 | `plans-migration.test.ts` |
| R2 | `plans-constraints.int.test.ts` |
| R3 | `plans-migration.test.ts` |
| R4–R6 | `plans-constraints.int.test.ts` |
| R7 | `plans-migration.test.ts` |
| R8–R12 | `plans-constraints.int.test.ts` |
| R13 | `plans-migration.test.ts`, `plans-constraints.int.test.ts` |
| R14–R25 | `plans-constraints.int.test.ts` (R24 y R25 dependen de P1) |
| R26 | `plans-migration.test.ts`, `plans-migration.int.test.ts` |
| R27 | `permissions.test.ts`, `plans-permissions-migration.test.ts` |
| R28 | `permissions.test.ts`, `seed-initial-access.test.ts`, `plans-permissions-migration.test.ts` |
| R29 | `permissions.test.ts` |
| R30 | `company-addons.test.ts` |
| R31 | `plans-permissions-migration.test.ts`, `plans-permissions-migration.int.test.ts` |
| R32 | `identity-seed.int.test.ts` |
| R33 | `plans-migration.test.ts`, `plans-migration.int.test.ts`, `plans-permissions-migration.test.ts`, `plans-permissions-migration.int.test.ts` |

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/20261028120000_plans/migration.sql`
- `db/migrations/20261028120000_plans/down.sql`
- `db/migrations/20261028120100_plans_permissions/migration.sql`
- `db/migrations/20261028120100_plans_permissions/down.sql`
- `lib/modules/identity/domain/plan-currency.ts`
- `lib/modules/identity/domain/permissions.ts`
- `lib/modules/identity/domain/company-addons.ts`
- `lib/modules/identity/index.ts`
- `docs/architecture.md`
- `tests/guards/guard-empresa-en-esquema.test.ts`
- `tests/guards/guard-identificador-de-request.test.ts`
- `tests/unit/identity/schema/plans-migration.test.ts`
- `tests/unit/identity/schema/plans-permissions-migration.test.ts`
- `tests/unit/identity/permissions.test.ts`
- `tests/unit/identity/seed/seed-initial-access.test.ts`
- `tests/unit/identity/addons/company-addons.test.ts`
- `tests/unit/navegacion/qc75-convenciones.test.ts`
- `tests/unit/asignaciones/schema/order-assignments-migration.test.ts`
- `tests/integration/identity/plans-constraints.int.test.ts`
- `tests/integration/identity/plans-migration.int.test.ts`
- `tests/integration/identity/plans-permissions-migration.int.test.ts`
- `tests/integration/identity/identity-seed.int.test.ts`
- `tests/integration/aislamiento.json`
- `progress/impl_QC-182.md`
