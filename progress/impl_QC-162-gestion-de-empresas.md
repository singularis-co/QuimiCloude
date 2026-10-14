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

## Tanda B (T3, T4, T5, T6) — backend_dev, 2026-10-14 — BLOQUEADA por un archivo fuera de lista

### Archivos
- Dominio puro: `lib/modules/identity/domain/company-input.ts` (esquemas, topes, `normalizeTaxId`,
  `toCompanyWrite` con el rechazo de R7), `company-queryable.ts`, `company-event.ts`
  (`COMPANY_EVENT_KINDS`, `EVENT_KIND_FORMAT`, `COMPANY_FIELDS`, `changedCompanyFields`),
  `company-view.ts`, `seed-scope.ts` (`SEED_SCOPES`, `SeedScope`).
- Puertos: `lib/modules/identity/ports/company-repository.ts`, `company-open-orders-counter.ts`.
- Casos de uso: `domain/create-company.ts`, `update-company.ts`, `delete-company.ts`,
  `reactivate-company.ts`, `list-companies.ts`, `get-company.ts`,
  `get-company-deletion-impact.ts`, `list-company-events.ts`.
- `lib/modules/identity/index.ts`: bloque nuevo al final (cuatro errores, vistas, tipos del
  historial, ocho fabricas con sus `Deps`, y `CreateCompanyResult`).
- Tests (`tests/unit/identity/companies/`): `company-input`, `company-event`, `create-company`,
  `update-company`, `delete-company`, `reactivate-company`, `list-companies`, `get-company`,
  `get-company-deletion-impact`, `list-company-events`.
- `tests/unit/identity/roles/maestro-rol.test.ts`: R17 abre las ocho rutas de `design.md > 8.1`
  (adelantado de T10: sin esto la tanda queda en rojo; anti-cegado intacto).
- `specs/QC-162-gestion-de-empresas/tasks.md`: T3-T6 marcadas.

### Desviaciones respecto al design
- `toCompanyWrite(data)` en `company-input.ts`: arma el `CompanyWrite` (formas normalizadas) y
  lanza `ValidationError` si la identificacion normaliza a vacio; la comparten alta y edicion.
- `CompanyEditable` = `{ [K in CompanyField]?: string | null }` (el design no lo definia).
- `get-company`, `get-company-deletion-impact` y `reactivate-company` reciben `{ companyId }`
  (`companyIdSchema`); la accion de T10 envuelve el id.
- El barrel exporta tambien `CreateCompanyResult`.
- `SEED_SCOPES` (constante) ademas del tipo `SeedScope`.
- El cruce CHECK ↔ `EVENT_KIND_FORMAT` (pendiente de T1) va en `company-event.test.ts`, que lee
  `migration.sql`; el test de migracion de la Tanda A no se toca.
- Observacion, sin cambio: un nombre de empresa que normaliza a vacio (p. ej. «!!!») pasa la
  validacion; ningun R lo prohibe.

### R -> test (lo cubierto en esta tanda)
- R1, R2 -> los ocho `*.test.ts` de casos de uso (null, undefined, sin permisos, vacio, permiso
  equivocado → `unauthorized` con dobles que fallan si los llaman y conteo de llamadas = 0; actor
  sin empresa → pasa).
- R4, R5, R6 -> `company-input.test.ts` (+ R5 en `create-company`/`update-company`).
- R7 -> `company-input.test.ts`, `create-company.test.ts`, `update-company.test.ts`.
- R8, R9 -> `create-company`, `update-company`, `reactivate-company` (R27); `company-input` (normalizacion).
- R11, R12, R13, R15 -> `create-company.test.ts` (R12 tambien en `company-input`).
- R16, R17, R18, R19 -> `update-company.test.ts`.
- R20 -> `get-company-deletion-impact.test.ts`.
- R21, R22, R23 -> `delete-company.test.ts` (R22 tambien en `company-input`).
- R26, R27, R28 -> `reactivate-company.test.ts`.
- R29, R30, R31, R32 -> `list-companies.test.ts` y `company-event.test.ts` (queryable).
- R33 -> `get-company.test.ts`. R37 -> `list-company-events.test.ts`.
- R34 (tipos), R35, R36 (comparacion de `country`), R39, R43 (cruce CHECK) -> `company-event.test.ts`.
- R40, R41 (solo el tipo) -> `company-event.test.ts > seed-scope`; el comportamiento es de T11.

### Verificacion (salida real)
- `pnpm run typecheck`: verde (tsc --noEmit sin salida).
- `pnpm run lint`: 0 errores, 7 warnings ajenos (confirm-catalog-import, order-service).
- `pnpm exec vitest run tests/unit/identity/companies`: 10 archivos, 166/166 pass.
- `pnpm exec vitest run tests/unit/identity/roles/maestro-rol.test.ts`: 11/11 pass.
- `pnpm exec vitest run guard`: 75 archivos, 1050 pass, 20 skip, 0 fail.
- `pnpm exec vitest run --project node tests/unit/identity`: 118 archivos, 2215 pass, 31 skip,
  **1 fail**: `tests/unit/identity/credencial/scope.test.ts > R39 > los UNICOS que llaman a
  issueForPendingUser son el alta y el reenvio`. No esta en `tests/baseline-rojos.json`.

### Bloqueo
`create-company.ts` llama a `links.issueForPendingUser` (design 3.5, R15) y el censo cerrado
`EMISORES_LEGITIMOS` de `tests/unit/identity/credencial/scope.test.ts:~730` solo admite
`create-user.ts` e `issue-credential-setup-link.ts`. El archivo no esta en «Archivos esperados».
Enmienda propuesta (solo anadir): `'lib/modules/identity/domain/create-company.ts'` en
`EMISORES_LEGITIMOS`, con un comentario: el alta de empresa emite el enlace para el Administrador
que acaba de crear y exige `empresas.modificar` en su primera linea.

Veredicto: T3-T6 escritos y verdes; la tanda queda en rojo por un censo de otra ficha hasta decidir
la enmienda de `scope.test.ts`.

## Tanda B, cierre: enmienda de scope.test.ts y R45 — backend_dev, 2026-10-13

### Archivos

- `tests/unit/identity/credencial/scope.test.ts`: enmienda mecanica autorizada por el leader. Solo
  se anade `lib/modules/identity/domain/create-company.ts` a `EMISORES_LEGITIMOS`, con comentario
  (el alta de empresa exige `empresas.modificar` y emite el enlace al Administrador que acaba de
  crear). Ninguna asercion cambia. Ya figuraba en `tasks.md > Archivos esperados`.
- `specs/QC-162-gestion-de-empresas/requirements.md`: R45 nuevo (seccion «Nombre sin forma
  comparable»), en EARS.
- `lib/modules/identity/domain/company-input.ts`: `toCompanyWrite` rechaza con `ValidationError`
  (`invalid_input`) un nombre cuya forma normalizada (`normalizeCompanyName`) queda vacia, igual
  que la identificacion.
- `tests/unit/identity/companies/company-input.test.ts`, `create-company.test.ts`,
  `update-company.test.ts`: un caso R45 en cada uno.

### R -> test

- R45 -> `company-input.test.ts > normalizeTaxId y toCompanyWrite > R45: un nombre cuya forma
  normalizada queda vacia → invalid_input`; `create-company.test.ts > R45: «!!!» como nombre →
  invalid_input sin tocar ningun puerto`; `update-company.test.ts > R45: «!!!» como nombre →
  invalid_input sin tocar el puerto`.

### Verificacion (salida real)

- `pnpm run typecheck`: `tsc --noEmit` sin errores.
- `pnpm run lint`: exit 0, `7 problems (0 errors, 7 warnings)`; los 7 warnings son preexistentes
  (`confirm-catalog-import.test.ts`, `order-service.test.ts`), ajenos a esta ficha.
- `pnpm exec vitest run tests/unit/identity/companies tests/unit/identity/credencial/scope.test.ts`:
  Test Files 11 passed (11), Tests 275 passed (275).
- `pnpm exec vitest run --project node tests/unit/identity`: Test Files 118 passed (118), Tests
  2219 passed | 31 skipped (2250).
- `pnpm exec vitest run guard`: Test Files 75 passed (75), Tests 1050 passed | 20 skipped (1070).

Veredicto: Tanda B en verde; el rojo de R39 queda resuelto con la enmienda y R45 esta implementado
y cubierto.
