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

## Tanda D (T10, T11) — backend_dev, 2026-10-13

### Archivos
- `lib/composition/index.ts` (solo anadidos): imports nuevos tras los de QC-235; `companyRepository` y
  `companyOpenOrdersCounter` (ata `countOpenOrdersInCompany` de `pedidos` al puerto de `identity`) justo antes de la
  fachada `identity`; ocho claves nuevas al final del objeto (`createCompany` ... `listCompanyEvents`);
  `scope: readSeedScopeFromEnv()` dentro de la flecha de `seedInitialAccess` (se lee en la invocacion).
- `lib/modules/identity/adapters/driving/company-actions.ts`: las ocho acciones de design 6.2, sus tipos de estado
  (`CreateCompanyFormState`, `CompanyMutationFormState`, `CompanyListResult`, `CompanyDetailResult`,
  `CompanyDeletionImpactResult`, `CompanyEventListResult`) y dos ayudas que leen el `FormData` crudo. Mismo
  `currentPlatformActor()` y `toErrorState`; sin `revalidatePath`; no se reexporta desde `index.ts`.
- `lib/modules/identity/domain/seed-initial-access.ts`: `scope` en `SeedInitialAccessDeps` y en `SeedOutcome`.
- `lib/modules/identity/adapters/driven/config/seed-scope-env.ts` (nuevo): `readSeedScopeFromEnv(env = process.env)`.
- `scripts/seed.ts`: con `platform-only`, la linea de resumen dice `empresa inicial: no se siembra en produccion`
  (y `usuario inicial: no se siembra en produccion`, ver desviacion 3).
- `docs/architecture.md`: la fila `SEED_*` se parte en dos (`SEED_ADMIN_*`: «no se leen: en produccion el seed solo
  crea al Maestro»; `SEED_MAESTRO_*`: igual que antes) y nota del 2026-10-13 en `## Despliegue a produccion`.
- Tests: `tests/unit/identity/company-actions.test.ts` (ampliado, 6 → 55 casos),
  `tests/unit/identity/seed/seed-initial-access.test.ts` (+3), `tests/unit/identity/seed/seed-scope-env.test.ts`
  (nuevo, 9), `tests/integration/identity/identity-seed.int.test.ts` (+3).
- `tests/unit/identity/roles/maestro-rol.test.ts`: comprobado; ya abria las ocho rutas de design 8.1 desde la Tanda B,
  con el anti-cegado. Sin cambios.
- `specs/QC-162-gestion-de-empresas/tasks.md`: T10 y T11 marcadas.

### Desviaciones respecto al design
1. `SeedInitialAccessDeps.scope` es **opcional** (`scope?: SeedScope`; sin valor, `'full'`). Obligatorio habria roto
   el typecheck de unas 76 llamadas existentes en `seed-initial-access.test.ts` e `identity-seed.int.test.ts`. Con el
   opcional, esas llamadas siguen probando el comportamiento `full` tal cual. El unico llamador de produccion (la
   composicion) siempre lo pasa, leido de `VERCEL_ENV`. `SeedOutcome.scope` si es obligatorio.
2. Con `platform-only` tampoco se cuenta a los Administradores vivos (`countLiveUsersWithRole(ROLE_ADMINISTRADOR)`):
   es el «`needsAdmin` es `false` sin consultar» de design 7.
3. `scripts/seed.ts`: ademas de la linea de la empresa, la del usuario inicial dice `no se siembra en produccion` con
   `platform-only`; si no, diria `ya existia` sin haber mirado.
4. La fila de `docs/architecture.md` se parte en dos, porque `SEED_MAESTRO_*` si se siguen leyendo en produccion.
5. `readSeedScopeFromEnv` recibe `Readonly<Record<string, string | undefined>>` y no `NodeJS.ProcessEnv`, para que el
   test pueda pasar objetos sueltos.
6. Enmienda mecanica en `identity-seed.int.test.ts` (caso QC-161 R10, R18, R4): el `toEqual` exacto de la segunda
   corrida gana `scope: 'full'`, consecuencia directa de que `SeedOutcome` gane `scope` (design 7). Solo anade una
   clave al literal cerrado; lo que el caso afirma (la segunda corrida no crea nada) no cambia. El archivo ya estaba en
   «Archivos esperados».
7. `tests/unit/identity/catalogo-sin-total-fijo.test.ts` vio un falso total fijo: su ventana tras
   `TOTAL_DE_ASIGNACIONES_DEL_SEED` alcanzaba un `toHaveLength(1)` del Maestro en el caso nuevo. Se reordenaron las
   aserciones de ese caso; la guardia no se toca.

### R -> test, R1 a R45 (consolidado de las cuatro tandas)
Abreviaturas: `companies/` = `tests/unit/identity/companies/`; `int` = `tests/integration/identity/company.int.test.ts`;
`acciones` = `tests/unit/identity/company-actions.test.ts`; `migracion` =
`tests/unit/identity/schema/companies-management-migration.test.ts`.
- R1 -> los ocho unitarios de casos de uso en `companies/` (null, sin permisos, permiso equivocado → `unauthorized`,
  dobles que fallan si los llaman) + `acciones` (`R3: $clave sin sesion ...` y `R3: $clave con un usuario de sesion
  sin permisos ...`, x8).
- R2 -> los mismos ocho unitarios (actor sin empresa con el permiso → pasa) + `acciones` (el actor de sesion no lleva
  empresa y `getSessionContext` no se llama, x8) + `acciones > R5` (de QC-235).
- R3 -> `acciones`: `R3: $clave pasa al caso de uso el actor de getSessionUser, sin getSessionContext ni revalidatePath`
  (x8, con `id`/`actorId`/`permissions` colados en la entrada), `R3: $clave sin sesion ...` (x8), `R3: $clave con un
  usuario de sesion sin permisos ...` (x8), `R3: el censo cubre las ocho acciones`, y por accion exito con datos y
  error con `code`. FormData del alta en `{ company, administrator }`: `R3, R11: arma el FormData ...`. Campo ausente →
  `invalid_input`: `R3, R5` (alta y edicion), `R3, R12` (Administrador), `R3, R22` (baja), `R3: sin companyId ...`
  (reactivacion) y `R3: una entrada sin companyId ...` (historial).
- R4 -> `companies/company-input.test.ts` (topes) + `migracion` (columnas).
- R5 -> `company-input.test.ts`, `create-company.test.ts`, `update-company.test.ts` + `acciones > R3, R5` (dos).
- R6 -> `company-input.test.ts`.
- R7 -> `company-input.test.ts`, `create-company.test.ts`, `update-company.test.ts`.
- R8, R9 -> `create-company`, `update-company`, `reactivate-company` (unitarios) + `int` (`createWithAdministrator >
  R8, R9, R14`, `update > R8, R9`, `restricciones > R8, R9 (meta.target)`, `R9: dos empresas sin identificacion fiscal
  conviven`) + `acciones > R3, R8`.
- R10 -> `int > restricciones > R10` (dos) y `> R10, R25` + `migracion`.
- R11 -> `create-company.test.ts` + `int > createWithAdministrator > R11, R12, R34` + `acciones > R3, R11`.
- R12 -> `create-company.test.ts`, `company-input.test.ts` + `int > R11, R12, R34` + `acciones > R3, R12` (dos).
- R13 -> `create-company.test.ts` + `int > createWithAdministrator > R13, R14`.
- R14 -> `int`: los tres choques del alta (empresa, usuario y evento a cero).
- R15 -> `create-company.test.ts` + `acciones > R3, R15`.
- R16 -> `update-company.test.ts` + `int > update > R16, R34, R35` + `acciones > R3, R16`.
- R17 -> `update-company.test.ts` + `int > update > R17`.
- R18 -> `update-company.test.ts` + `int > update > R18`.
- R19 -> `update-company.test.ts` + `int > update > R19` + `acciones > R3, R19`.
- R20 -> `get-company-deletion-impact.test.ts` + `int > countLiveUsersOfAlive > R20` (dos) +
  `tests/integration/pedidos/order-company-stats.int.test.ts` (cuatro) + `acciones > R3, R20` (dos).
- R21 -> `delete-company.test.ts` + `int > softDelete > R21, R24, R34` + `acciones > R3, R21`.
- R22 -> `delete-company.test.ts`, `company-input.test.ts` + `int > softDelete > R22` + `acciones > R3, R22` (dos).
- R23 -> `delete-company.test.ts` + `int > softDelete > R23`.
- R24 -> `int > softDelete > R21, R24, R34` + los existentes, sin cambios, `tests/unit/identity/resolve-session.test.ts`
  (QC-48 R15) y `tests/unit/identity/verify-credentials.test.ts` (QC-48 R3).
- R25 -> `int > createWithAdministrator > R25` y `restricciones > R10, R25`.
- R26 -> `reactivate-company.test.ts` + `int > reactivate > R26, R34` + `acciones > R3, R26`.
- R27 -> `reactivate-company.test.ts` + `int > reactivate > R27`.
- R28 -> `reactivate-company.test.ts` + `int > reactivate > R28` + `acciones > R3, R28`.
- R29 -> `list-companies.test.ts` + `int > list > R29, R30` + `acciones > R3, R29`.
- R30 -> `list-companies.test.ts`, `company-event.test.ts` (queryable) + `int > list > R29, R30` y `> R30`.
- R31 -> `list-companies.test.ts` + `int > list > R31`.
- R32 -> `list-companies.test.ts` + `int > list > R32` (dos).
- R33 -> `get-company.test.ts` + `int > findById > R33` + `acciones > R3, R33` (dos).
- R34 -> `company-event.test.ts` (tipos) + `int` (un evento por operacion; un evento imposible deshace el cambio en
  `update`, `softDelete` y `reactivate`).
- R35 -> `company-event.test.ts` + `int > update > R16, R34, R35`.
- R36 -> `tests/unit/identity/set-company-country.test.ts > R36` +
  `tests/integration/identity/company-country.int.test.ts > R36` (tres).
- R37 -> `list-company-events.test.ts` + `int > listEvents` (tres) + `acciones > R3, R37` (dos).
- R38 -> `companies/company-events-append-only.test.ts`.
- R39 -> `company-event.test.ts` (cruce CHECK ↔ `EVENT_KIND_FORMAT`) + `int > restricciones > R39` + `migracion`.
- R40 -> `tests/unit/identity/seed/seed-initial-access.test.ts > QC-162 R40: platform-only sobre una base vacia crea
  roles, permisos y Maestro, y nada de la empresa inicial` y `> QC-162 R40, R42: platform-only sobre una base sembrada
  no escribe nada ni toca companies`; `tests/unit/identity/seed/seed-scope-env.test.ts` (`production`,
  ` production `, sin `VERCEL`, `process.env` leido en la invocacion);
  `tests/integration/identity/identity-seed.int.test.ts > QC-162 R40: platform-only sobre una base vacia ...` y los
  dos `QC-162 R40, R42`.
- R41 -> `seed-initial-access.test.ts > QC-162 R41: full hace las mismas llamadas y devuelve lo mismo que sin alcance`
  (y todos los casos anteriores, que corren sin alcance, o sea `full`); `seed-scope-env.test.ts` (`preview`,
  `development`, vacio, ausente, `Production`).
- R42 -> `identity-seed.int.test.ts > QC-162 R40, R42: dos corridas platform-only sobre una base con QuimiCloud y su
  Administrador no borran ni cambian nada` y `> QC-162 R40, R42: con QuimiCloud y su Administrador pero sin Maestro,
  platform-only solo crea el Maestro`; `seed-initial-access.test.ts > QC-162 R40, R42`.
- R43 -> `migracion` + `company-event.test.ts` (cruce del CHECK).
- R44 -> `migracion` + `tests/guards/guard-rls-force.test.ts` (existente).
- R45 -> `company-input.test.ts`, `create-company.test.ts`, `update-company.test.ts` (un caso R45 en cada uno).

**Ningun R sin test.**

### Verificacion (salida real)
- `pnpm run typecheck`: `tsc --noEmit` sin errores.
- `pnpm run lint`: `✖ 7 problems (0 errors, 7 warnings)`; los 7 preexistentes (`confirm-catalog-import.test.ts`,
  `order-service.test.ts`).
- `pnpm exec vitest run` de `company-actions`, `roles/maestro-rol`, `maestro-sin-empresa-actions`,
  `session-once-per-request-actions`, `seed/seed-initial-access`, `seed/seed-scope-env`, `seed/deploy-hook` y
  `tests/unit/scripts/build.test.ts`: Test Files 8 passed (8), Tests 238 passed (238).
- `pnpm exec vitest run --project integration tests/integration/identity/identity-seed.int.test.ts`: Test Files 1
  passed (1), Tests 35 passed (35); la base efimera se creo y se borro.
- `pnpm exec vitest run guard`: Test Files 75 passed (75), Tests 1052 passed | 20 skipped (1072).
- `pnpm exec vitest run --project node tests/unit/identity tests/unit/scripts`: Test Files 124 passed (124), Tests
  2385 passed | 31 skipped (2416). Una primera corrida dio 1 fail en `catalogo-sin-total-fijo.test.ts`; ver desviacion 7.
- Extra: los 16 tests fuera de `identity` que nombran `lib/composition/index.ts` o archivos tocados (module-contract de
  `pedidos`, `proveedores`, `unidades` y `asignaciones`; convenciones de UI; `composition/identity-facade`;
  `test-database/nombres-y-huella`; alcances de `inventario` y `documentos`): Test Files 16 passed (16), Tests 347
  passed | 26 skipped (373).

Veredicto: Tanda D (T10, T11) en verde; las ocho acciones estan cableadas, el seed de produccion solo siembra la
plataforma y todos los R1-R45 tienen test.

## Cierre (T12)

- `node scripts/archivos-en-vuelo.mjs --candidata QC-162`: choca con QC-214 y QC-275 (schema, catalogo de
  errores, composicion, aislamiento.json, architecture.md), choques ya aceptados por el humano; con QC-262..267
  solo comparte el apendice `guard-identificador-de-request.test.ts`, que no choca.
- `./init.sh` (rapido), exit 0, `== init OK ==`:
  - lint: 0 errores, 7 warnings ajenos.
  - `vitest related` sobre el diff: Test Files 858 passed (858), Tests 13650 passed | 37 skipped (13687).
  - `gate.siempre` (guard, module-contract, route-contract, scope.test): Test Files 114 passed (114), Tests 1608
    passed | 37 skipped (1645).
  - todas las migraciones tienen down.sql.

Veredicto: T1-T12 hechas; ningun R1-R45 sin test.
