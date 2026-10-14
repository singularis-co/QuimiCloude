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

## Tanda C (T7, T8, T9) — backend_dev, 2026-10-13

### Archivos
- `lib/modules/identity/adapters/driven/persistence/company-prisma.ts` (nuevo): `createCompanyRepository(db)`
  con las ocho operaciones del puerto; exporta `atomically` y `recordCompanyEvent` (los usa el pais).
- `lib/modules/identity/adapters/driven/persistence/user-admin-prisma.ts`: `export` en `duplicateKeyOf`, cuerpo intacto.
- `lib/modules/identity/ports/company-country-repository.ts`, `domain/set-company-country.ts` (`now?` inyectable,
  pasa `actor.id` y `now()`), `adapters/driven/persistence/company-country-prisma.ts` (transaccion, fila viva
  bloqueada, mismo pais sin escribir, evento `company.updated` con `{ fields: ['country'] }`).
- `lib/modules/pedidos/domain/order-classification.ts`: `ORDER_STATUSES_NOT_IN_PROGRESS`.
- `lib/modules/pedidos/adapters/driven/persistence/order-company-stats-prisma.ts` (nuevo): `countOpenOrdersInCompany`.
- Tests nuevos: `tests/integration/identity/company.int.test.ts` (36 casos),
  `tests/integration/pedidos/order-company-stats.int.test.ts` (4),
  `tests/unit/identity/companies/company-events-append-only.test.ts` (3).
- Tests enmendados por el cambio de firma del puerto del pais (design 8.2, P4 = si):
  - `tests/integration/identity/company-country.int.test.ts`: autor y `now` en cada llamada, +3 casos R36; los 5
    casos de QC-235 siguen, y el de R8 gana «sin evento» en la empresa de baja.
  - `tests/unit/identity/set-company-country.test.ts`: `now` fijo; los tres `toHaveBeenCalledWith` ganan `actorId` y
    `now` (el codigo sigue llegando tal cual); +1 caso R36.
  - `tests/unit/identity/company-actions.test.ts`: los tres `toHaveBeenCalledWith` del puerto ganan
    `MAESTRO.id, expect.any(Date)` (el autor sale de la sesion, no de la entrada).
- Censos (enmienda mecanica autorizada, solo anaden; anotados en `tasks.md > Archivos esperados`):
  - `tests/integration/aislamiento.json`: `identity/company.int.test.ts` y `pedidos/order-company-stats.int.test.ts`
    en `transaccion`, en su sitio alfabetico.
  - `tests/unit/identity/account-status-scope.test.ts`: `company-prisma.ts` al final de `SITIOS_PERMITIDOS`
    (el Administrador nace `pending`).
  - `tests/unit/pedidos/module-contract.test.ts`: `order-company-stats-prisma.ts` en `DUENOS_DE_ORDERS` y
    `DUENOS_DEL_CLIENTE`.
- `specs/QC-162-gestion-de-empresas/tasks.md`: T7-T9 marcadas; los dos censos nuevos en «Archivos esperados».

### `meta.target` medido (`@prisma/client@6.19.3`)
Medido con un script suelto contra la base local (:5433) dentro de una transaccion revertida, y fijado como
caso del `.int` (`R8, R9: Prisma anuncia en meta.target ...`), que pasa contra la base efimera:
- `companies_tax_id_unique` → `P2002`, `meta = {"modelName":"Company","target":["tax_id_normalized"]}`.
- `companies_name_unique` → `P2002`, `meta = {"modelName":"Company","target":["lower(name_normalized)"]}`.
- `companies_tax_id_pair` (CHECK) → no es `P2002`: error crudo con SQLSTATE `23514`.
- `'$transaction' in tx` es `false` en el cliente de una transaccion interactiva y `true` en el raiz: asi
  distingue `atomically` los dos casos.

Las marcas `tax_id_normalized` y `name_normalized` no aparecen en ningun `target` de `users`, y ninguna marca de
`users` (`email`, `username`, `document_number`) aparece en los de `companies`.

### Desviaciones respecto al design
1. `atomically` sobre una transaccion ajena no hace `fn(db)` a secas: abre `SAVEPOINT company_write` y, si falla,
   hace `ROLLBACK TO SAVEPOINT` antes de relanzar. En Postgres una sentencia fallida aborta la transaccion entera;
   sin el savepoint, tras traducir el `P2002` el llamante se quedaria con una transaccion inservible (`25P02`). Con
   el cliente raiz sigue siendo `db.$transaction(fn, { maxWait: 10_000, timeout: 30_000 })`. Gracias a esto el
   `.int` prueba la atomicidad de verdad (R14, R34): tras un choque, cuenta empresa, usuario y evento en la misma
   transaccion. Comprobado por mutacion: quitando el `ROLLBACK TO SAVEPOINT` caen 8 de los 36 casos.
2. `countOpenOrdersInCompany(companyId, tx = prisma)`: el parametro se llama `tx` y no `db`, con tipo
   `Pick<typeof prisma, 'order'>`. Con `db.` la guardia `guard-ambito-empresa-pedidos` no veria la consulta (su
   patron solo mira `prisma.` y `tx.`) y pasaria sin mirar; con `tx.` la analiza y exige el ambito, que entra por
   `orderCompanyScope({ companyId })`. El `Pick` evita importar `@prisma/client`, asi que `DUENOS_DE_PRISMA` de
   `module-contract.test.ts` no cambia.
3. `createWithAdministrator`: un `P2002` que no es de `companies` pasa por `duplicateKeyOf`; un `target` sin marca
   se relanza.
4. La busqueda de la lista normaliza con `normalizeCompanyName` (su cuerpo es `normalizeKey`, design 3.2); el
   desempate del orden es `c.id ASC` en cualquier direccion.

### R -> test (lo de esta tanda; archivo `company.int.test.ts` salvo que se diga otro)
- R8, R9 -> `createWithAdministrator > R8, R9, R14`; `update > R8, R9`; `restricciones > R8, R9 (meta.target)`;
  `createWithAdministrator > R9: dos empresas sin identificacion fiscal conviven`.
- R10 -> `restricciones > R10` (dos casos: `23505`; `23514` en las cuatro combinaciones) y `> R10, R25`.
- R11, R12 -> `createWithAdministrator > R11, R12, R34`.
- R13 -> `createWithAdministrator > R13, R14` (usuario del Maestro → `username`; documento inexistente →
  `invalid_document_type`).
- R14 -> los tres casos de choque del alta: empresa, usuario y evento a cero tras cada uno.
- R16 -> `update > R16, R34, R35`; R17 -> `update > R17`; R18 -> `update > R18`; R19 -> `update > R19`.
- R20 -> `countLiveUsersOfAlive > R20` (dos casos) + `order-company-stats.int.test.ts` (cuatro casos R20).
- R21, R24 -> `softDelete > R21, R24, R34`; R22 -> `softDelete > R22`; R23 -> `softDelete > R23`.
- R25 -> `createWithAdministrator > R25` y `restricciones > R10, R25`.
- R26 -> `reactivate > R26, R34`; R27 -> `reactivate > R27`; R28 -> `reactivate > R28`.
- R29, R30 -> `list > R29, R30` y `list > R30`; R31 -> `list > R31`; R32 -> `list > R32` (dos casos).
- R33 -> `findById > R33`.
- R34 -> un evento por operacion en `R11, R12, R34`, `R16, R34, R35`, `R21, R24, R34`, `R26, R34` y
  `listEvents > R34, R37`; un evento imposible deshace el cambio: `update > R34`, `softDelete > R34`,
  `reactivate > R34`.
- R35 -> `update > R16, R34, R35` (`{ fields: ['name', 'contactEmail'] }`, sin valores).
- R36 -> `set-company-country.test.ts > R36 (QC-162)` + `company-country.int.test.ts > R36 (QC-162)` (tres casos:
  evento con `country`; mismo pais sin evento ni `updated_at`; evento imposible deja el pais como estaba).
- R37 -> `listEvents > R34, R37`, `> R37: mismo instante ...`, `> R37: 10 por defecto, tope de 25 ...`.
- R38 -> `tests/unit/identity/companies/company-events-append-only.test.ts` (barrido de `lib/` y autocomprobacion
  con fuentes sinteticos).
- R39 -> `restricciones > R39`.

### Verificacion (salida real)
- `pnpm run typecheck`: `tsc --noEmit` sin errores.
- `pnpm run lint`: `ESLint: 0 errors, 7 warnings in 2 files` (los 7 preexistentes, en
  `confirm-catalog-import.test.ts` y `order-service.test.ts`).
- `pnpm exec vitest run --project integration tests/integration/identity/company.int.test.ts`:
  Test Files 1 passed (1), Tests 36 passed (36).
- `pnpm exec vitest run --project integration tests/integration/identity/company-country.int.test.ts`:
  Test Files 1 passed (1), Tests 8 passed (8).
- `pnpm exec vitest run --project integration tests/integration/pedidos/order-company-stats.int.test.ts`:
  Test Files 1 passed (1), Tests 4 passed (4).
  Los tres uno detras de otro; cada corrida creo y borro su base efimera.
- `pnpm exec vitest run` de `company-events-append-only`, `set-company-country`, `company-actions`,
  `account-status-scope` y `tests/unit/pedidos/module-contract.test.ts`: Test Files 5 passed (5), Tests 47 passed |
  3 skipped (50).
- `pnpm exec vitest run guard`: Test Files 75 passed (75), Tests 1052 passed | 20 skipped (1072).
- `pnpm exec vitest run --project node tests/unit/identity tests/unit/pedidos`: Test Files 211 passed (211),
  Tests 4071 passed | 34 skipped (4105).
- `pnpm exec vitest related --run --project node --project ui` sobre los 7 archivos de `lib/` tocados:
  Test Files 597 passed (597), Tests 10426 passed | 13 skipped (10439).

Veredicto: Tanda C (T7, T8, T9) en verde; `meta.target` medido y fijado en un caso del `.int`.
