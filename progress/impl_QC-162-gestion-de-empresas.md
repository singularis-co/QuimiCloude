# QC-162 · bitacora de implementacion

## Tanda A (T1, T2) — backend_dev, 2026-10-13 — BLOQUEADA

### Archivos
- `db/schema.prisma` (solo anadidos): cuatro columnas en `Company`, `Company.events`, modelo
  `CompanyEvent` (`/// @module identity`) justo tras `Company`, `User.companyEvents`.
- `db/migrations/20261014120000_companies_management/migration.sql` y `down.sql` (design 2.2;
  escritos a mano, sin DROP CONSTRAINT de drift).
- `tests/unit/identity/schema/companies-management-migration.test.ts` (nuevo, 20 casos).
- `lib/modules/errores/domain/error-codes.ts`, `error-catalog.ts` (cuatro codigos y textos al final).
- `lib/modules/identity/domain/errors.ts` (cuatro clases al final).

### R -> test
- R4, R10, R39, R43, R44 -> `tests/unit/identity/schema/companies-management-migration.test.ts`.
  Pendiente para T3: cruzar el CHECK con `EVENT_KIND_FORMAT` (aun no existe).
- R8, R9, R22, R28 (codigos) -> se cubren en los unitarios de T5.

### Base local (:5433, base QuimiCloude)
`db:migrate` aplica (y las 5 pendientes de dev); `db:rollback` revierte (columnas, CHECK, indice y
tabla desaparecen, comprobado en el catalogo); reaplicada: `prisma migrate status` = up to date.

### Verificacion
- typecheck: verde. lint: 0 errores, 7 warnings ajenos.
- migracion: 20/20. guardias: 1049 pass, 1 fail (`guard-identificador-de-request`).
- `vitest related`: 13226 tests, 13186 pass, 6 fail, 34 skip.

### Bloqueos (archivos fuera de «Archivos esperados»)
1. `tests/unit/errores/catalogo.test.ts:73` exige 88 codigos; con los cuatro nuevos son 92.
2. `tests/guards/guard-identificador-de-request.test.ts` `MIGRACIONES_ESPERADAS` no lista la
   migracion nueva.
3. `User.companyEvents` y `CompanyEvent.actor` rompen censos exactos de relaciones de `User`:
   `tests/unit/proveedores/module-contract.test.ts` (2), `tests/unit/identity/schema/account-status-schema.test.ts`,
   `tests/unit/identity/credential-policy-contract.test.ts` y el R12 de
   `tests/unit/identity/schema/identity-schema.test.ts` (modelo que apunta a User y Company).

Veredicto: T1 y T2 escritos y migracion aplicada; gate rojo hasta decidir las enmiendas de 1-3.

## Tanda A, cierre: enmiendas decididas por el leader

### Archivos enmendados (solo anadiendo)
- `tests/unit/errores/catalogo.test.ts`: conteo 88 -> 92 con su linea de comentario.
- `tests/guards/guard-identificador-de-request.test.ts`: `20261014120000_companies_management` al
  final de `MIGRACIONES_ESPERADAS`.
- `tests/unit/proveedores/module-contract.test.ts` (2 casos) y
  `tests/unit/identity/schema/account-status-schema.test.ts`: `CompanyEvent` en el censo de
  relaciones de `User` (la lista sale ordenada, entra tras `Company`).
- `tests/unit/identity/credential-policy-contract.test.ts`: `companyEvents` en el censo de campos.
- `tests/unit/identity/schema/identity-schema.test.ts` (R12): `CompanyEvent` excluido del chequeo
  de tabla intermedia (es un historial).
- `specs/QC-162-gestion-de-empresas/tasks.md`: T1 y T2 marcadas.

### Verificacion
- `pnpm run typecheck`: verde.
- `pnpm run lint`: exit 0; 0 errores, 7 warnings ajenos (confirm-catalog-import, order-service).
- `vitest run` de los 4 enmendados + companies-management-migration + catalogo: 6 archivos,
  130/130 pass.
- `vitest run guard`: 75 archivos, 1050 pass, 20 skip, 0 fail.
- `vitest run --project node tests/unit/identity tests/unit/proveedores tests/unit/errores`:
  144 archivos, 2530 pass, 37 skip, 0 fail.

Veredicto: Tanda A (T1, T2) cerrada en verde.
