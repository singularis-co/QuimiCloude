# QC-277 — Módulos por empresa · tasks.md

> Diseño: `design.md`. Requisitos: `requirements.md` (R1–R38). Cada task cierra con
> `pnpm run typecheck`, `pnpm run lint`, `pnpm exec vitest related --run <archivos tocados>` y, si
> toca guardias, `pnpm exec vitest run guard`. Un commit por task:
> `feat(QC-277): …` / `test(QC-277): …` / `docs(QC-277): …`. `[P]` = puede ir en paralelo con las
> demás `[P]` de su mismo bloque, una vez cumplidas sus dependencias.

## Bloque A — Datos y catálogo

- [x] **T1 — Catálogo de añadidos** (R1–R4, R11). Depende de: —
  - `identity/domain/company-addons.ts` según `design.md > 2.1`, reexportado en `identity/index.ts`.
  - Tests: `tests/unit/identity/addons/company-addons.test.ts`.
  - **Hecho:**
    - partición del catálogo, dependencia de un nivel y `effectivePermissions` solo resta;
    - `assertAddon`/`hasAddon` fallan cerrado.
- [x] **T2 — Columna y migración** (R5, R6, R38). Depende de: —
  - `Company.addons` en `db/schema.prisma`.
  - `db/migrations/20261014190000_company_addons/` con `migration.sql` y `down.sql`
    (`design.md > 2.3`). Re-fechada a `20261014190000`: `20261014180000` ya lo usa `admin_without_assigned_orders_view`.
  - Tests: `tests/unit/identity/schema/company-addons-migration.test.ts`.
  - **Hecho:**
    - el `UPDATE` lista exactamente `ADDONS`;
    - `down.sql` quita solo la columna;
    - `prisma migrate` aplica y revierte sobre la base de test.
- [x] **T3 — Seed con los cinco añadidos** (R7). Depende de: T1, T2
  - `initial-access-repository-prisma.ts` crea la empresa inicial con `addons: [...ADDONS]`.
  - Tests: `seed-initial-access.test.ts` e `identity-seed.int.test.ts` ampliados.
  - **Hecho:** con alcance `full`, la empresa nace con los cinco; con `platform-only`, nada cambia.

## Bloque B — Sesión (el cruce rol ∩ añadidos)

- [x] **T4 — Lectura en la sesión** (R8). Depende de: T2
  - `SessionUserRecord.companyAddons`.
  - `session-user-prisma.ts` lo saca del mismo `JOIN` (`design.md > 3.1`).
  - Tests: `session-user.int.test.ts` ampliado.
  - **Hecho:** el contador de invocaciones no sube y llegan los interruptores crudos.
- [x] **T5 — Recorte en `resolveSession`** (R8, R10, R11). Depende de: T1, T4
  - Paso 9 de `resolve-session.ts`.
  - `SessionUser.addons` opcional (`design.md > 3.2`).
  - Tests: `resolve-session.test.ts` ampliado.
  - **Hecho:**
    - con empresa: recortado y `addons` expuesto;
    - sin empresa: igual que hoy;
    - un añadido activo nunca concede un permiso ajeno al rol.

## Bloque C — Cortes de pantalla, caso de uso y menú

- [x] **T6 [P] — `requirePageAddon`** (R13). Depende de: T5
  - `identity/adapters/driving/require-page-addon.ts`.
  - Llamada en las tres pantallas de `design.md > 5.2`, después de `requirePagePermission`.
  - Tests:
    - `tests/unit/identity/require-page-addon.test.ts`;
    - `formula-import-page.test.tsx`, `catalog-import-page.test.tsx` e `importar-page.test.tsx`
      ampliados.
  - **Hecho:** 404 sin el añadido y redirección con marca sin sesión.
- [x] **T7 [P] — Importación desde Excel** (R14, R16). Depende de: T1, T5
  - `inventario/domain/actor.ts`: `addons?` y `requireAddon`.
  - `requireAddon(actor, 'importacion_excel')` en los cuatro casos de uso.
  - `currentActor()` de `inventory-import-actions.ts` copia `addons`.
  - `inventario/page.tsx`: `canImport` con `hasAddon`.
  - Tests: `inventory-import-addon.test.ts` (nuevo) y `product-page.test.tsx` ampliado.
  - **Hecho:**
    - con `inventario.modificar` y sin el añadido → `unauthorized`, sin tocar puertos;
    - sin botón «Importar».
- [x] **T8 [P] — Importaciones desde PDF** (R14, R15, R23). Depende de: T1, T5
  - `documentos/domain/actor.ts`: `addons?` y `requireAddon`.
  - `requireAddon(actor, 'lectura_pdf')` en los cuatro casos de uso de importación.
  - `currentActor()` de `formula-import-actions.ts` y `catalog-import-actions.ts` copia `addons`.
  - Tests:
    - `tests/unit/documentos/import-addon.test.ts`;
    - `formulas-upload.test.tsx` y `supplier-detail-upload.test.tsx` ampliados (sin botón con
      permisos recortados).
  - **Hecho:** con `recetas.modificar` o `proveedores.modificar` y sin el añadido →
    `unauthorized`.
- [x] **T9 [P] — Menú y recorrido recortados** (R12, R17). Depende de: T5
  - Sin código nuevo de producción: se prueba lo que ya filtra.
  - Tests:
    - `tests/unit/identity/addons/menu-recortado.test.ts`;
    - `assigned-orders-route-contract.test.ts` ampliado.
  - **Hecho:**
    - sin dashboard, proveedores ni grupo «Integraciones»;
    - sin «Ver recorrido» al quitar `dashboard`.
- [x] **T10 [P] — Guardia de pantallas de añadido** (R13, R23). Depende de: T6
  - `tests/guards/guard-pantallas-de-anadido.test.ts` (`design.md > 9.2`), con autocomprobación.
  - **Hecho:** verde con las tres pantallas; rojo con una pantalla `importar` sintética sin
    `requirePageAddon`.

## Bloque D — Logo y aterrizaje

- [x] **T11 — `homeHrefFor` y `/inicio`** (R18–R21). Depende de: T5
  - `homeHrefFor` en `private-nav.ts`; `login-action.ts` la usa.
  - `HOME_ROUTE` en `routes.ts`.
  - `identity/adapters/driving/home-route.ts` y `app/inicio/route.ts`.
  - El middleware usa `landing: HOME_ROUTE`.
  - El logo de `app-sidebar.tsx` apunta a `HOME_ROUTE`.
  - Tests:
    - `home-route.test.ts` (nuevo);
    - `login-action.test.ts` ampliado;
    - enmiendas de `design.md > 10.3` puntos 2 y 3: middleware, `app-sidebar.test.tsx` y
      `sidebar-carril.test.ts`.
  - **Hecho:**
    - el logo y `/login` con sesión llevan al primer enlace efectivo;
    - sin sesión, al login con la marca;
    - `guard-middleware-edge` sigue verde.

## Bloque E — Fuera de sesión

- [x] **T12 — Interruptor del webhook de documentos** (R4, R22). Depende de: T1, T13
  - Puerto `documentos/ports/pdf-reading-switch.ts`.
  - `run-document-job.ts`: dependencia `pdfReading` y bloque tras `claim` (`design.md > 8.1`).
  - En la composición, `pdfReading` se ata a `identity.isCompanyAddonActive(…, 'lectura_pdf')`.
  - Tests:
    - `tests/unit/documentos/run-document-job-addon.test.ts`;
    - `run-document-job.test.ts`, `run-document-job-ai-provider.test.ts` y sus dobles
      (`run-document-job-doubles.ts`), con `pdfReading` prendido por defecto;
    - `documentos-facade.test.ts` ampliado.
  - **Hecho:**
    - apagado → `unauthorized` definitivo;
    - sin `readBatch`, sin `readerFor`, sin descarga ni pipeline;
    - nunca `requeue`.
- [x] **T14 [P] — Cron núcleo y guardia de rutas sin sesión** (R25, R26). Depende de: T2
  - Tests:
    - `tests/integration/identity/company-directory-addons.int.test.ts`;
    - `tests/guards/guard-rutas-fuera-de-sesion.test.ts` (`design.md > 9.3`);
    - el archivo de integración se declara en `tests/integration/aislamiento.json`.
  - **Hecho:**
    - una empresa viva sin añadidos sale en `listActiveCompanyIds`;
    - la guardia se pone roja con una ruta sintética sin clasificar.

## Bloque F — Operación del Maestro

- [x] **T13 — Puerto, adaptador y lectura de sistema** (R31, R33, R24). Depende de: T1, T2
  - `ports/company-addon-repository.ts` y `adapters/driven/persistence/company-addons-prisma.ts`
    (`design.md > 6.2`, `6.3`).
  - `domain/is-company-addon-active.ts`.
  - Tipos de evento y `addon` en la vista de `company-event.ts`, `company-view.ts` y
    `company-prisma.ts` (`listEvents`).
  - Tests:
    - `tests/integration/identity/company-addons.int.test.ts`, declarado en `aislamiento.json`;
    - `company-event.test.ts` y `list-company-events.test.ts` ampliados.
  - **Hecho:**
    - atómico, con un evento por cambio;
    - sin cambios → sin escritura;
    - empresa de baja → `not_found`;
    - nada más de la empresa cambia;
    - alta nueva → `addons = {}` (R5).
- [x] **T15 — Casos de uso y Server Actions** (R27–R32, R34). Depende de: T13
  - `get-company-addons.ts`, `set-company-addon.ts`, `set-all-company-addons.ts`,
    `company-addon-input.ts` y `company-addons-view.ts`.
  - Las tres acciones en `company-actions.ts` y su cableado en la composición.
  - Barril de `identity`.
  - Enmienda de `maestro-rol.test.ts` R17 (`design.md > 10.3` punto 1).
  - Tests: los tres unitarios nuevos y `company-actions.test.ts` ampliado.
  - **Hecho:**
    - el permiso va primero, con dobles que fallan si los llaman;
    - claves del núcleo o inventadas → `invalid_input`;
    - `enabled` solo admite `'true'` y `'false'`.

## Bloque G — Docs, E2E y cierre

- [x] **T16 [P] — `docs/architecture.md`** (R37). Depende de: T5
  - Las cuatro enmiendas de `design.md > 11`.
  - Tests: `tests/unit/identity/addons/architecture-doc.test.ts`.
  - **Hecho:**
    - ya no dice «foto del instante del login»;
    - dice «rol ∩ añadidos activos»;
    - la viñeta de la l. 41-44 está enmendada.
- [x] **T17 [P] — Ninguna decisión en el cliente** (R35). Depende de: T1
  - Tests: `tests/unit/identity/addons/sin-decision-en-cliente.test.ts`.
  - **Hecho:** rojo con un `'use client'` sintético que importe `hasAddon`.
- [x] **T18 — Helpers E2E** (R20). Depende de: T1, T2
  - `e2e/helpers/landing.ts` usa el permiso efectivo y `homeHrefFor`.
  - Nace `e2e/helpers/addons.ts` (`enableAllAddons`).
  - Tests: `tests/unit/e2e-helpers/landing.test.ts` ampliado; `guard-e2e-landing.test.ts` ajustado
    si hace falta.
  - **Hecho:** el aterrizaje esperado de un Administrador sin añadidos es `/inventario`.
- [x] **T19 — E2E de la ficha** (R36, R9, R12, R13, R18–R20). Depende de: T6–T12, T18
  - `e2e/modulos-por-empresa.spec.ts`, con los cinco casos de `design.md > 10.2`.
  - **Hecho:** `pnpm exec playwright test e2e/modulos-por-empresa.spec.ts` verde en Chromium y
    WebKit.
- [x] **T20 — Censo de la suite E2E** (riesgo 1 de `design.md > 14`). Depende de: T19 (hecho sobre `companies.addons`, antes del Bloque H; se repite tras T31)
  - Correr la suite E2E completa sobre base limpia.
  - En cada spec que falle **solo** porque su empresa propia nace sin añadidos, llamar a
    `enableAllAddons` tras crearla.
  - Los specs tocados se anotan en `progress/impl_QC-277.md`. Si alguno no está
    en `## Archivos esperados`, se añade aquí antes del commit.
  - **Hecho:** la suite queda con los mismos rojos que `dev` (nada nuevo), escrito en el PR.
- [x] **T21 — Gate local y trazabilidad.** Depende de: todas (hecho antes del Bloque H; se repite tras T31)
  - `./init.sh` verde.
  - El mapa `R<n> → test` en `progress/impl_QC-277.md`.
  - **Hecho:** los 38 requisitos tienen test, y P2–P5 constan con el defecto aplicado.

> Orden: T13 va antes que T12 porque T12 usa `isCompanyAddonActive`. La numeración sigue al diseño,
> no al orden de ejecución: A → B → (C, D, T13) → (T12, T14, T15) → G.

## Bloque H — Enmienda: añadidos en tablas (D13–D16, 2026-10-15)

> Cambia solo la capa de datos (`design.md > 15`). Dominio, puerto, casos de uso de T15, cortes,
> `/inicio`, webhook y cron no se tocan. T22 va primero; después T23, T24 y T29 en paralelo, y
> T25–T28 en cuanto T22 esté. T31 cierra el bloque y desbloquea T20 y T21.

- [x] **T22 — Esquema y migración reescrita** (R5, R6, R38; D13–D16). Depende de: —
  - `db/schema.prisma`: fuera `Company.addons`; `Addon`, `CompanyAddonOverride` y las relaciones
    inversas en `Company` y `User` (`design.md > 2.2`).
  - `db/migrations/20261014190000_company_addons/migration.sql` y `down.sql` **reescritos en su
    carpeta**, sin migración nueva (`design.md > 2.3`). Antes, revertir la versión vieja en la base
    local y en la plantilla de tests (riesgo 5, `design.md > 14`).
  - `tests/unit/identity/schema/company-addons-migration.test.ts` reescrito (fila R6, R38 de
    `design.md > 10.1`).
  - **Hecho:**
    - `pnpm run db:migrate` aplica sobre base limpia y `prisma migrate diff` no muestra diferencias
      salvo el drift declarado;
    - `pnpm run db:rollback` deja la base sin las dos tablas y vuelve a aplicar;
    - `guard-rls-force` verde con las dos tablas.
- [x] **T23 [P] — Guardia catálogo = tabla** (R2; D13). Depende de: T22
  - `tests/guards/guard-catalogo-de-anadidos.test.ts` (`design.md > 9.4`).
  - **Hecho:** verde con el SQL real; rojo con un añadido sintético en el código sin `INSERT`, con
    un `INSERT` de una clave que el código no conoce y con un `UPDATE "addons" SET "key"`.
- [x] **T24 [P] — `addons` exenta de columna de empresa** (D13, D15). Depende de: T22
  - `tests/guards/guard-empresa-en-esquema.test.ts`: `EXENTAS` gana `addons` y R7 pasa a once.
  - Bullet de exentas de `docs/architecture.md > Dominio`: nombra `addons` y dice «once tablas».
  - **Hecho:** `pnpm exec vitest run guard-empresa-en-esquema` verde, con
    `company_addon_overrides` juzgada como tabla de empresa (sin exención).
- [x] **T25 — Repositorio de añadidos sobre excepciones** (R24, R28, R29, R31, R33; D14, D15). Depende
  de: T22
  - `lib/modules/identity/adapters/driven/persistence/company-addons-prisma.ts`
    (`design.md > 6.3`): `findByCompany` lee excepciones prendidas; `apply` bloquea la empresa,
    hace `upsert` por cambio con `createdBy` y `createdAt`, toca `updated_at` y escribe los eventos
    en la misma transacción.
  - Puerto, casos de uso y `is-company-addon-active.ts`: **sin cambios**.
  - Tests: `tests/integration/identity/company-addons.int.test.ts` y
    `tests/integration/identity/company-directory-addons.int.test.ts` siembran excepciones en vez
    de la columna. El caso de la clave desconocida (`'futuro'`) pasa a ser «la FK la rechaza con
    `23503`». Nuevo caso: la tabla `addons` de la base es igual a `ADDONS`.
  - **Hecho:**
    - apagar deja la fila con `enabled = false`, sin borrarla, y con `created_by` = el actor;
    - «apagar todos» con los cinco prendidos escribe cinco filas `false` y cinco eventos, y un
      fallo del evento deshace las cinco;
    - apagar un añadido sin fila no escribe nada;
    - alta nueva → cero excepciones (R5).
- [x] **T26 — Lectura de la sesión** (R8, R9; P6). Depende de: T22
  - `lib/modules/identity/adapters/driven/persistence/session-user-prisma.ts`: la relación
    `company.addonOverrides` con `enabled: true`, en el mismo `findFirst` (`design.md > 3.1`).
    Actualizar el comentario de cabecera con el coste declarado (una sentencia SQL más, cero
    invocaciones nuevas).
  - `ports/session-user-reader.ts` y `resolve-session.ts`: sin cambios.
  - Tests: `tests/integration/identity/session-user.int.test.ts`: escribe excepciones en vez de
    `company.update({ addons })` (l. 93, 374, 603, 615).
  - **Hecho:** `companyAddons` sale de las excepciones prendidas; el contador de invocaciones del
    lector no sube; con una excepción `enabled = false` el añadido no sale.
- [x] **T27 [P] — Seed con excepciones** (R7; P7). Depende de: T22
  - `lib/modules/identity/adapters/driven/persistence/initial-access-repository-prisma.ts`:
    `create` anidado con las cinco excepciones prendidas, sin autor (`design.md > 2.5`).
  - Tests: `tests/unit/identity/seed/seed-initial-access.test.ts` (l. 1591) y
    `tests/integration/identity/identity-seed.int.test.ts`.
  - **Hecho:** la empresa inicial queda con cinco filas `enabled = true` y `created_by` vacío; con
    `platform-only` no se crea ninguna.
- [x] **T28 — Helpers y spec E2E sobre excepciones** (R20, R36). Depende de: T22
  - `e2e/helpers/addons.ts`: `enableAllAddons` hace `upsert` de las cinco a `enabled = true`.
  - `e2e/helpers/landing.ts`: lee `company.addonOverrides` (`enabled: true`).
  - `e2e/modulos-por-empresa.spec.ts`: la función que fija los interruptores (l. 61) y la
    comprobación de «nace sin añadidos» (l. 115-117).
  - Tests: `tests/unit/e2e-helpers/landing.test.ts` (los dobles de `findFirst` y la forma del
    `select`).
  - **Hecho:** `vitest run tests/unit/e2e-helpers/landing.test.ts tests/guards/guard-e2e-landing.test.ts`
    verde; misma firma pública de los dos helpers.
- [x] **T29 [P] — Docs y comentarios** (R37). Depende de: —
  - `docs/architecture.md`, viñeta de `## Dominio` punto 1: `company_addon_overrides` en vez de
    `companies.addons` (`design.md > 11`).
  - `tests/unit/identity/addons/architecture-doc.test.ts`: espera `company_addon_overrides`.
  - Comentarios que citan la columna en `tests/unit/recetas-ui/recipe-route-contract.test.ts`
    (l. 567) y `tests/guards/guard-identificador-de-request.test.ts` (l. 643) (`design.md > 10.3`,
    punto 8).
  - **Hecho:** ningún archivo fuera de `specs/` y `progress/` cita `companies.addons`
    (`git grep -n "companies.addons" -- ':!specs' ':!progress'` vacío).
- [x] **T30 — Censo de aislamiento** (D15). Depende de: T25, T26, T27
  - `tests/integration/aislamiento.json`: el `motivo` de `identity/session-user.int.test.ts` dice
    que también escribe `company_addon_overrides` y que caen por `ON DELETE CASCADE` al borrar la
    empresa. Si T25–T27 crean un `.int.test.ts` nuevo, se declara aquí.
  - **Hecho:** `pnpm exec vitest run guard-aislamiento-integracion` verde.
- [x] **T31 — E2E de la ficha y gate del bloque.** Depende de: T22–T30
  - `pnpm exec playwright test e2e/modulos-por-empresa.spec.ts` en Chromium y WebKit.
  - `pnpm run typecheck`, `pnpm run lint`, `pnpm exec vitest run guard` y
    `pnpm exec vitest related --run` sobre los archivos del bloque.
  - Mapa `R<n> → test` de `progress/impl_QC-277.md` al día con las filas R2, R5, R6/R38, R7 y
    R33/R34 de `design.md > 10.1`.
  - **Hecho:** todo verde. T20 (censo de la suite E2E) y T21 (gate local) corren después de este
    bloque, no antes.

## Archivos esperados

Producción:

- `db/schema.prisma`
- `db/migrations/20261014190000_company_addons/migration.sql`
- `db/migrations/20261014190000_company_addons/down.sql`
- `lib/modules/identity/index.ts`
- `lib/modules/identity/domain/company-addons.ts`
- `lib/modules/identity/domain/company-addon-input.ts`
- `lib/modules/identity/domain/company-addons-view.ts`
- `lib/modules/identity/domain/get-company-addons.ts`
- `lib/modules/identity/domain/set-company-addon.ts`
- `lib/modules/identity/domain/set-all-company-addons.ts`
- `lib/modules/identity/domain/is-company-addon-active.ts`
- `lib/modules/identity/domain/company-event.ts`
- `lib/modules/identity/domain/company-view.ts`
- `lib/modules/identity/domain/resolve-session.ts`
- `lib/modules/identity/domain/session-user.ts`
- `lib/modules/identity/ports/session-user-reader.ts`
- `lib/modules/identity/ports/company-addon-repository.ts`
- `lib/modules/identity/adapters/driven/persistence/session-user-prisma.ts`
- `lib/modules/identity/adapters/driven/persistence/company-addons-prisma.ts`
- `lib/modules/identity/adapters/driven/persistence/company-prisma.ts`
- `lib/modules/identity/adapters/driven/persistence/initial-access-repository-prisma.ts`
- `lib/modules/identity/adapters/driving/require-page-addon.ts`
- `lib/modules/identity/adapters/driving/home-route.ts`
- `lib/modules/identity/adapters/driving/login-action.ts`
- `lib/modules/identity/adapters/driving/route-guard-middleware.ts`
- `lib/modules/identity/adapters/driving/company-actions.ts`
- `lib/modules/inventario/domain/actor.ts`
- `lib/modules/inventario/domain/get-inventory-import-template.ts`
- `lib/modules/inventario/domain/preview-inventory-import.ts`
- `lib/modules/inventario/domain/confirm-inventory-import.ts`
- `lib/modules/inventario/adapters/driving/inventory-import-actions.ts`
- `lib/modules/documentos/domain/actor.ts`
- `lib/modules/documentos/domain/preview-formula-import.ts`
- `lib/modules/documentos/domain/confirm-formula-import.ts`
- `lib/modules/documentos/domain/preview-catalog-import.ts`
- `lib/modules/documentos/domain/confirm-catalog-import.ts`
- `lib/modules/documentos/domain/run-document-job.ts`
- `lib/modules/documentos/ports/pdf-reading-switch.ts`
- `lib/modules/documentos/adapters/driving/formula-import-actions.ts`
- `lib/modules/documentos/adapters/driving/catalog-import-actions.ts`
- `lib/composition/index.ts`
- `lib/shared/navigation/private-nav.ts`
- `lib/shared/routes.ts`
- `app/inicio/route.ts`
- `app/(private)/inventario/page.tsx`
- `app/(private)/inventario/importar/page.tsx`
- `app/(private)/produccion/formulas/importar/[documentoId]/page.tsx`
- `app/(private)/proveedores/[id]/importar/[documentoId]/page.tsx`
- `components/private/app-sidebar.tsx`
- `docs/architecture.md`

Tests nuevos:

- `tests/unit/identity/addons/company-addons.test.ts`
- `tests/unit/identity/addons/menu-recortado.test.ts`
- `tests/unit/identity/addons/architecture-doc.test.ts`
- `tests/unit/identity/addons/sin-decision-en-cliente.test.ts`
- `tests/unit/identity/schema/company-addons-migration.test.ts`
- `tests/unit/identity/require-page-addon.test.ts`
- `tests/unit/identity/home-route.test.ts`
- `tests/unit/identity/companies/get-company-addons.test.ts`
- `tests/unit/identity/companies/set-company-addon.test.ts`
- `tests/unit/identity/companies/set-all-company-addons.test.ts`
- `tests/unit/inventario/importar/inventory-import-addon.test.ts`
- `tests/unit/documentos/import-addon.test.ts`
- `tests/unit/documentos/run-document-job-addon.test.ts`
- `tests/integration/identity/company-addons.int.test.ts`
- `tests/integration/identity/company-directory-addons.int.test.ts`
- `tests/guards/guard-pantallas-de-anadido.test.ts`
- `tests/guards/guard-rutas-fuera-de-sesion.test.ts`

Tests ampliados o enmendados:

- `tests/integration/aislamiento.json`
- `tests/unit/identity/resolve-session.test.ts`
- `tests/integration/identity/session-user.int.test.ts`
- `tests/unit/identity/seed/seed-initial-access.test.ts`
- `tests/integration/identity/identity-seed.int.test.ts`
- `tests/unit/identity/login-action.test.ts`
- `tests/unit/identity/route-guard-middleware.test.ts`
- `tests/unit/identity/company-actions.test.ts`
- `tests/unit/identity/companies/company-event.test.ts`
- `tests/unit/identity/companies/list-company-events.test.ts`
- `tests/unit/identity/roles/maestro-rol.test.ts`
- `tests/unit/inventario/importar/importar-page.test.tsx`
- `tests/unit/inventario/product-page.test.tsx`
- `tests/unit/recetas-ui/formula-import-page.test.tsx`
- `tests/unit/proveedores-ui/catalog-import-page.test.tsx`
- `tests/unit/documentos-ui/formulas-upload.test.tsx`
- `tests/unit/documentos-ui/supplier-detail-upload.test.tsx`
- `tests/unit/asignaciones-ui/assigned-orders-route-contract.test.ts`
- `tests/unit/documentos/run-document-job.test.ts`
- `tests/unit/documentos/run-document-job-ai-provider.test.ts`
- `tests/unit/documentos/run-document-job-doubles.ts`
- `tests/unit/composition/documentos-facade.test.ts`
- `tests/unit/app-sidebar.test.tsx`
- `tests/unit/marca/sidebar-carril.test.ts`
- `tests/unit/e2e-helpers/landing.test.ts`
- `tests/guards/guard-e2e-landing.test.ts`

Añadidos durante la implementación (fixtures sin `companyAddons`/`addons`, migración en la lista de
`guard-identificador-de-request` y listas cerradas de permisos con la opción A aprobada):

- `tests/guards/guard-identificador-de-request.test.ts`
- `tests/integration/documentos/catalog-import-isolation.int.test.ts`
- `tests/integration/documentos/formula-import-versions.int.test.ts`
- `tests/integration/documentos/formula-import.int.test.ts`
- `tests/integration/inventario/inventory-import-wiring.ts`
- `tests/unit/asignaciones/module-contract.test.ts`
- `tests/unit/clientes/scope.test.ts`
- `tests/unit/composition/identity-facade.test.ts`
- `tests/unit/documentos/catalog-import-authorization.test.ts`
- `tests/unit/documentos/confirm-catalog-import.test.ts`
- `tests/unit/documentos/confirm-formula-import.test.ts`
- `tests/unit/documentos/formula-import-authorization.test.ts`
- `tests/unit/documentos/preview-catalog-import.test.ts`
- `tests/unit/documentos/preview-formula-import.test.ts`
- `tests/unit/identity/end-other-sessions.test.ts`
- `tests/unit/identity/end-session.test.ts`
- `tests/unit/identity/resolve-session-user.test.ts`
- `tests/unit/identity/roles/acondicionamiento-rol.test.ts`
- `tests/unit/identity/roles/empacador-rol.test.ts`
- `tests/unit/identity/session-once-per-request-actions.test.ts`
- `tests/unit/identity/session-once-per-request-render.test.tsx`
- `tests/unit/integraciones/module-shape.test.ts`
- `tests/unit/inventario/confirm-inventory-import.test.ts`
- `tests/unit/inventario/get-inventory-import-template.test.ts`
- `tests/unit/inventario/preview-inventory-import.test.ts`
- `tests/unit/paridad/inventario-paridad.test.tsx`
- `tests/unit/recetas-ui/recipe-route-contract.test.ts`
- `tests/integration/identity/company.int.test.ts`
- `tests/unit/composition/ai-provider-wiring.test.ts`
- `tests/unit/sidebar-desktop.test.tsx`

E2E (el spec de la ficha, los helpers y los candidatos del censo de T20):

- `e2e/modulos-por-empresa.spec.ts`
- `e2e/helpers/landing.ts`
- `e2e/helpers/addons.ts`
- `e2e/marca-componentes.spec.ts`
- `e2e/dashboard-rediseno.spec.ts`
- `e2e/recorrido-ejecucion.spec.ts`
- `e2e/proveedores.spec.ts`
- `e2e/aislamiento-proveedores.spec.ts`
- `e2e/catalogo-desde-pdf.spec.ts`
- `e2e/formula-desde-pdf.spec.ts`
- `e2e/documentos.spec.ts`
- `e2e/inventario-importar.spec.ts`
- `e2e/integraciones.spec.ts`
- `e2e/integraciones-proveedor-ia.spec.ts`
- `e2e/integraciones-whatsapp.spec.ts`
- `e2e/shell-rediseno.spec.ts`
- `e2e/piezas-compartidas.spec.ts`
- `e2e/permisos.spec.ts`
- `e2e/login.spec.ts`
- `e2e/movimiento.spec.ts`

Bloque H, enmienda D13–D16. Solo las rutas nuevas; el resto de archivos del bloque (esquema,
migración, los tres adaptadores de persistencia, docs de arquitectura, los tests de integración de
identity, el censo de aislamiento, los tests de migración, seed, doc y aterrizaje, y los tres
archivos E2E) ya está listado arriba:

- `tests/guards/guard-catalogo-de-anadidos.test.ts`
- `tests/guards/guard-empresa-en-esquema.test.ts`

Bloque H, listas cerradas de Prisma.dmmf de otras fichas (opción A, decidida por el humano el
2026-10-15; `design.md > 10.3`, punto 9):

- `tests/unit/identity/credential-policy-contract.test.ts`
- `tests/unit/proveedores/module-contract.test.ts`
- `tests/unit/identity/schema/account-status-schema.test.ts`
- `tests/unit/identity/schema/identity-schema.test.ts`
