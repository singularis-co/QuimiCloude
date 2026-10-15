# QC-277 — Módulos por empresa · bitácora de implementación

## Tanda 1 (T1–T5) — backend_dev, 2026-10-14

### Archivos creados
- `lib/modules/identity/domain/company-addons.ts` (T1)
- `db/migrations/20261014190000_company_addons/migration.sql` y `down.sql` (T2; re-fechada: `20261014180000` ya lo usa `admin_without_assigned_orders_view`)
- `tests/unit/identity/addons/company-addons.test.ts` (T1)
- `tests/unit/identity/schema/company-addons-migration.test.ts` (T2)

### Archivos modificados
- `lib/modules/identity/index.ts` (barril del catálogo)
- `db/schema.prisma` (`Company.addons String[] @default([])`)
- `lib/modules/identity/adapters/driven/persistence/initial-access-repository-prisma.ts` (T3)
- `lib/modules/identity/ports/session-user-reader.ts`, `adapters/driven/persistence/session-user-prisma.ts` (T4)
- `lib/modules/identity/domain/resolve-session.ts`, `domain/session-user.ts` (T5)
- Tests ampliados: `tests/unit/identity/seed/seed-initial-access.test.ts`,
  `tests/integration/identity/identity-seed.int.test.ts`, `tests/integration/identity/session-user.int.test.ts`,
  `tests/unit/identity/resolve-session.test.ts`
- Fixtures de `SessionUserRecord` (typecheck; `companyAddons: [...ADDONS]` para no cambiar su comportamiento):
  `tests/unit/composition/identity-facade.test.ts`, `tests/unit/identity/end-other-sessions.test.ts`,
  `tests/unit/identity/end-session.test.ts`, `tests/unit/identity/resolve-session-user.test.ts`,
  `tests/unit/identity/session-once-per-request-actions.test.ts`, `tests/unit/identity/session-once-per-request-render.test.tsx`
- Proyección con `addons` en las aserciones `toEqual` de `resolve-session.test.ts` y `resolve-session-user.test.ts`
- `tests/guards/guard-identificador-de-request.test.ts`: `MIGRACIONES_ESPERADAS` gana la migración nueva (lo pide la propia guardia)

### Mapa R → test (tanda 1)
| R | Test |
|---|---|
| R1, R2, R3 | `tests/unit/identity/addons/company-addons.test.ts` |
| R4 | `company-addons.test.ts` (`effectiveAddons`) |
| R5, R6, R38 | `tests/unit/identity/schema/company-addons-migration.test.ts` (+ aplicar/revertir manual, abajo) |
| R7 | `seed-initial-access.test.ts` (dos casos R7) + `identity-seed.int.test.ts` (QC-277 R7) |
| R8 | `resolve-session.test.ts` (bloque «recorte por añadidos») + `session-user.int.test.ts` (QC-277 R8, dos casos) |
| R10, R11 | `resolve-session.test.ts` |
| R14 (fallo cerrado de `assertAddon`/`hasAddon`) | `company-addons.test.ts` |

### Migración: aplicar / revertir
Base desechable `qc277_scratch` (copia de una plantilla de test, ya borrada): `prisma migrate deploy`
aplica las dos pendientes; `companies.addons` = `text[] NOT NULL DEFAULT ARRAY[]::text[]` y QuimiCloud
queda con los cinco; `prisma migrate diff` no muestra diferencia en `addons`; `down.sql` quita la
columna; `pnpm run db:rollback` revierte; `migrate deploy` la reaplica. La base de desarrollo
`QuimiCloude` no se tocó (compartida; ya va atrasada en `20261014180000`, que trae `dev`).

### Verificación
- `pnpm run typecheck`: verde.
- `pnpm run lint`: 0 errores, 7 avisos en archivos ajenos.
- Tests tocados (12 archivos, unit + integración): 305 pasados, 0 fallidos.
- `pnpm exec vitest run guard`: 76 archivos, 1066 pasados, 20 omitidos, 0 fallidos.
- `pnpm exec vitest related --run <7 archivos de producción>`: 827 archivos, 13345 pasados, **4 fallidos**:
  `tests/unit/identity/roles/{maestro,empacador,acondicionamiento}-rol.test.ts` y
  `tests/unit/integraciones/module-shape.test.ts`. Son barridos que solo permiten nombrar
  `empresas.*`, `terminados.consultar`, `acondicionamiento.modificar` e `integraciones.modificar` en
  rutas exactas; `CORE_PERMISSIONS`/`ADDON_PERMISSIONS` (escritos a mano según design § 2.1) los
  nombran en `company-addons.ts`. `design.md > 10.3` no prevé esta enmienda. Ninguno está en
  `tests/baseline-rojos.json`. **Bloqueado a la espera de decisión.**

### Veredicto
T1–T5 implementados y verdes en lo suyo; 4 barridos de otras fichas en rojo por un hueco del spec, pendiente de decisión humana.

### Rojos de listas cerradas de permisos: resuelto (opción A, aprobada por el humano 2026-10-14)
- Primera pasada de `vitest related`: 4 rojos ajenos al spec en `maestro-rol.test.ts`, `empacador-rol.test.ts`,
  `acondicionamiento-rol.test.ts` y `integraciones/module-shape.test.ts`. Esos tests solo dejan nombrar
  ciertos permisos en una lista cerrada de archivos, y `company-addons.ts` los nombra (catálogo escrito a mano, design §2.1).
- Arreglo: `lib/modules/identity/domain/company-addons.ts` entra como archivo permitido, igual que `permissions.ts`.
  Las comprobaciones anti-ceguera siguen: igualdad exacta en maestro; recuento 11 -> 12 en acondicionamiento;
  `arrayContaining` + catálogo en empacador; `toContain(ADDONS_CATALOG)` y un vecino `company-addons-extra.ts` -> false en module-shape.
- Salida tras el arreglo:
  - los 4 archivos: 140 pasados, 0 fallidos, 1 saltado (`ctx.skip` condicional que ya existía);
  - `pnpm run typecheck`: exit 0;
  - `pnpm run lint`: 0 errores, 7 avisos ya existentes en archivos que no se tocaron;
  - `pnpm exec vitest related --run` sobre los 8 archivos de producción de la tanda (schema incluido):
    827/827 archivos, 13349 pasados, 0 fallidos, 14 saltados.
- La migración se re-fechó a `20261014190000_company_addons` porque `20261014180000` lo usa `admin_without_assigned_orders_view`.

### Segunda pasada de la opción A: barrido completo (2026-10-14)
- Barrido: 68 tests que nombran códigos de `company-addons.ts` y recorren el árbol (o usan listas cerradas). Fallaban 2: `tests/unit/clientes/scope.test.ts` (R26, 1 test) y `tests/unit/asignaciones/module-contract.test.ts` (R29 y sus mutaciones, 20 tests).
- Arreglo: `company-addons.ts` entra por ruta exacta, igual que `permissions.ts`. En asignaciones, además: el catálogo de añadidos tiene que leerse y nombrar los 3 códigos, y un vecino `company-addons-extra.ts` sigue vigilado.
- Salida: typecheck exit 0; lint 0 errores y 7 avisos que ya estaban; barrido 68/68 archivos, 1252 pasados y 41 saltados; `vitest run guard` 76/76 archivos, 1066 pasados y 20 saltados.

### Gate local tras la segunda pasada (implementer, 2026-10-14)
- Tests ampliados por la opción A, en total: `tests/unit/identity/roles/maestro-rol.test.ts`,
  `empacador-rol.test.ts`, `acondicionamiento-rol.test.ts`, `tests/unit/integraciones/module-shape.test.ts`,
  `tests/unit/clientes/scope.test.ts` y `tests/unit/asignaciones/module-contract.test.ts`.
- `./init.sh` (rápido): `test:rapido` 115/115 archivos, 1623 pasados, 37 saltados; `== init OK ==`, exit 0.

## Tanda 2 — parte backend (T6, T7, T8, T10; backend_dev, 2026-10-14)

### Archivos
- Nuevos: `lib/modules/identity/adapters/driving/require-page-addon.ts`; tests
  `tests/unit/identity/require-page-addon.test.ts`, `tests/unit/inventario/importar/inventory-import-addon.test.ts`,
  `tests/unit/documentos/import-addon.test.ts`, `tests/guards/guard-pantallas-de-anadido.test.ts`.
- Producción modificada: `inventario/domain/actor.ts` y `documentos/domain/actor.ts` (`addons?` + `requireAddon`);
  `requireAddon` tras el permiso en `get-inventory-import-template.ts` (x2), `preview-inventory-import.ts`,
  `confirm-inventory-import.ts`, `preview-formula-import.ts`, `confirm-formula-import.ts`, `preview-catalog-import.ts`,
  `confirm-catalog-import.ts`; `currentActor()` copia `addons` en `inventory-import-actions.ts`,
  `formula-import-actions.ts` y `catalog-import-actions.ts`. Ambos módulos ya importaban el barril de identity.
- Fixtures (enmienda 10.3.5, solo `addons: [...]` en los actores): 9 unit + 3 int de documentos/inventario
  y `tests/integration/inventario/inventory-import-wiring.ts`.

### R -> test
- R13: `require-page-addon.test.ts` + guardia `guard-pantallas-de-anadido.test.ts`.
- R14, R16: `inventory-import-addon.test.ts` (4 puntos, dobles Proxy que fallan si se llaman).
- R14, R15, R23: `import-addon.test.ts` (4 importaciones PDF) + guardia (R23).

### Salida
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores, 7 avisos ya existentes (confirm-catalog-import.test.ts los tenía antes del cambio).
- Primera pasada `vitest related`: 16 archivos rojos (134 tests) por actores sin `addons`; arreglados las fixtures.
- `vitest related --run` sobre los 13 archivos de producción: 583/583 archivos, 9680 pasados, 8 saltados.
- `vitest run guard`: 76/77, 1 rojo ESPERADO: `guard-pantallas-de-anadido` (las 3 páginas aún no llaman a
  `requirePageAddon`; las cablea frontend_dev). Autocomprobación 7/7 verde.

### Veredicto
Backend de T6/T7/T8/T10 hecho y verde; la guardia nueva queda roja hasta que frontend_dev cablee las 3 páginas.

## Tanda 2 — parte frontend (T6 UI, T7 UI, T8 tests, T9; frontend_dev, 2026-10-15)

### Archivos
Producción (modificados):
- `app/(private)/inventario/importar/page.tsx` — `requirePageAddon('importacion_excel')` tras `requirePagePermission`.
- `app/(private)/produccion/formulas/importar/[documentoId]/page.tsx` — `requirePageAddon('lectura_pdf')`.
- `app/(private)/proveedores/[id]/importar/[documentoId]/page.tsx` — `requirePageAddon('lectura_pdf')`.
- `app/(private)/inventario/page.tsx` — `canImport = canAdjustBatchStock(sessionUser) && hasAddon(sessionUser, 'importacion_excel')`.

Tests:
- nuevo `tests/unit/identity/addons/menu-recortado.test.ts`.
- ampliados: `tests/unit/inventario/importar/importar-page.test.tsx`, `tests/unit/recetas-ui/formula-import-page.test.tsx`,
  `tests/unit/proveedores-ui/catalog-import-page.test.tsx`, `tests/unit/inventario/product-page.test.tsx`,
  `tests/unit/documentos-ui/formulas-upload.test.tsx`, `tests/unit/documentos-ui/supplier-detail-upload.test.tsx`,
  `tests/unit/asignaciones-ui/assigned-orders-route-contract.test.ts`.
- fixture (enmienda 10.3.5): `tests/unit/paridad/inventario-paridad.test.tsx` gana `addons: ['importacion_excel']`
  (su snapshot espera el botón «Importar»).

### R -> test (lo de esta parte)
- R12 -> `menu-recortado.test.ts` (sin añadidos: sin `nav-dashboard`, `nav-proveedores`, `nav-integraciones`; con los cinco, aparecen).
- R13 -> los tres tests de página (sin el añadido -> 404, sin lecturas) + `guard-pantallas-de-anadido`.
- R14, R16 -> `importar-page.test.tsx` (404 sin `importacion_excel`; enlace ausente) + `product-page.test.tsx` (sin el añadido no hay `inventory-import-link`).
- R15, R23 -> `formula-import-page.test.tsx`, `catalog-import-page.test.tsx` (404 sin `lectura_pdf`) + `formulas-upload.test.tsx`,
  `supplier-detail-upload.test.tsx` (permisos del Administrador recortados -> sin «Subir PDF»).
- R17 -> `menu-recortado.test.ts` (sin `dashboard`, `dashboard.consultar` no está y `assertPermission` niega) +
  `assigned-orders-route-contract.test.ts` (la página pasa `canViewTrace: false` a la sección sin `dashboard`; `true` con él).

Notas:
- `canViewExecutionTrace` es privada de `asignacion/page.tsx` (no exportada; T9 prohíbe código de producción): en
  `menu-recortado` se prueba la misma decisión (`assertPermission` con `dashboard.consultar`) y la página se ejercita en el contract test.
- Detalle de proveedor: con `effectivePermissions(admin, [])` la pantalla entera da 404 (cae `proveedores.consultar`); el caso usa
  `['proveedores']` activo (sin `lectura_pdf`), que deja la pantalla y quita `documentos.*`.

### Salida
- `pnpm run typecheck`: verde (sin salida de tsc).
- `pnpm run lint`: 0 errores, 7 warnings ajenos (`confirm-catalog-import.test.ts` x5 del backend, `order-service.test.ts` x2).
- `vitest related --run` (4 páginas): 7 files, 187/187 verde.
- Tests tocados (10 files, incl. `asignacion-page.test.tsx`): 226/226 verde. Además `pantallas-exigen-permiso.test.tsx` y
  `paridad/acciones-por-fila.test.tsx`: verdes.
- `vitest run tests/guards/guard-pantallas-de-anadido.test.ts`: 8/8 verde.
- `vitest run guard`: 77/77 files, 1074 passed | 20 skipped.

### Veredicto
Frontend de T6–T9 hecho y verde; la guardia de pantallas de añadido pasa a verde.

### Sincronización F2.3 y gate de la tanda 2 (implementer, 2026-10-15)
- `git merge origin/dev` (QC-285, secciones del sidebar): merge `955e57be`, sin conflictos. El spec sigue cuadrando:
  Dashboard sigue siendo el primer enlace, «Integraciones» sigue siendo un grupo y `login-action` sigue componiendo
  `firstVisibleNavHref(filterNavItemsByPermissions(...))`. Las líneas citadas en design.md (p. ej. `private-nav.ts:503-546`)
  se han desplazado, pero son solo referencias. Gate del merge: primera pasada con 3 timeouts de 20 s en tests de barrido
  (`guard-editor-aislado`, `guard-teclear-y-plazo`, `finished-product-route-contract`) por carga de la máquina; corridos
  solos pasan 23/23 en 1,5 s; segunda pasada `== init OK ==`.
- Tanda 2 (T6–T10) cerrada. Archivos fuera de `## Archivos esperados` añadidos a `tasks.md`.
- `./init.sh` (rápido) tras la tanda 2: related 837/837 archivos (13522 pasados, 14 saltados); test:rapido 116/116
  (1633 pasados, 37 saltados); `== init OK ==`, exit 0.

### Desvío tras la tanda 2: contrato de rutas de recetas (implementer, 2026-10-15)
- Rojo que encontró el `./init.sh` independiente del leader:
  `tests/unit/recetas-ui/recipe-route-contract.test.ts` > «la feature no toca lib/modules/recetas ni db/».
  Ese test compara `origin/dev...HEAD`, y se activa porque la tanda 2 tocó
  `app/(private)/produccion/formulas/importar/[documentoId]/page.tsx` (`requirePageAddon`), que está en la carpeta de rutas
  de recetas. Mi gate de la tanda 2 no lo vio porque corrió antes de commitear (el diff contra `HEAD` aún no traía la página).
- Arreglo (misma clase que la opción A): lista `MIGRACION_QC277` (`db/schema.prisma` y los dos `.sql` de
  `20261014190000_company_addons`) añadida a `DB_PERMITIDAS`, como `MIGRACION_QC275`. No se tocó ningún assert.
- Barrido de los tests que comparan contra dev (`origin/dev|merge-base|PERMITIDAS|diff --name-only`): 57 archivos,
  57/57 en verde (1002 pasados, 140 saltados a propósito porque son guardias de alcance de otras fichas). No hizo falta
  arreglar ningún otro.
- `recipe-route-contract.test.ts` solo: 28/28. typecheck verde; lint con 0 errores y los mismos 7 avisos.

## Tanda 3 — T11 backend (backend_dev, 2026-10-15)

### Archivos
- Nuevos: `lib/modules/identity/adapters/driving/home-route.ts` (GET → 307 a `homeHrefFor(user.permissions)`; sin sesión → `LOGIN_ROUTE_SESSION_ENDED`), `app/inicio/route.ts` (reexporta `GET`, `runtime = 'nodejs'`), `tests/unit/identity/home-route.test.ts`.
- Modificados: `lib/shared/navigation/private-nav.ts` (`homeHrefFor`), `lib/shared/routes.ts` (`HOME_ROUTE = '/inicio'`), `lib/modules/identity/adapters/driving/login-action.ts` (usa `homeHrefFor`; mismo comportamiento, `user === null` → `DASHBOARD_ROUTE`), `lib/modules/identity/adapters/driving/route-guard-middleware.ts` (`landing: HOME_ROUTE`; cabecera sin la frase falsa de `ASSIGNED_ORDERS_ROUTE`).
- Tests enmendados: `tests/unit/identity/route-guard-middleware.test.ts` (tres destinos → `HOME_ROUTE`, design §10.3.2; caso nuevo: el borde deja pasar `/inicio` con y sin cookie), `tests/unit/identity/login-action.test.ts` (bloque nuevo con espía sobre `homeHrefFor` real), `tests/unit/recetas-ui/recipe-route-contract.test.ts` (lista cerrada de exportaciones de `routes.ts` gana `HOME_ROUTE`; sin tocar asserts).
- No toqué `components/**` (logo → frontend_dev) ni `app-sidebar.test.tsx` / `sidebar-carril.test.ts` (§10.3.3).

### R -> test
- R18, R19 → `home-route.test.ts` (destino = `homeHrefFor(permisos efectivos)`, 307; menú vacío → dashboard) + `route-guard-middleware.test.ts` («redirige a la ruta de inicio … (R10, R19)», «deja pasar la ruta de inicio con y sin sesion (R19, R21)»). El logo (R18) lo completa frontend_dev.
- R20 → `login-action.test.ts > aterrizaje con el permiso efectivo (QC-277)` (tres casos R20).
- R21 → `home-route.test.ts` («R21: sin sesion valida va al login con la marca…») + middleware deja pasar `/inicio` sin cookie (sin bucle).

### Salida
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores, 7 warnings preexistentes (`confirm-catalog-import.test.ts`, `order-service.test.ts`).
- Tests nuevos/ampliados: 3 archivos, 61 passed; `recipe-route-contract.test.ts` 28 passed tras el alta.
- `pnpm exec vitest related --run` (6 archivos de producción): 432 archivos, 6 failed | 6778 passed. Antes del alta, 1 rojo mío (`recipe-route-contract`, lista cerrada) → arreglado. Los otros 5 son de la zona de T12/T13 en curso en paralelo: `tests/unit/composition/ai-provider-wiring.test.ts` (4) y `tests/unit/documentos/document-job-route.test.ts` (1, R10).
- `pnpm exec vitest run guard`: 78 archivos passed, 1082 passed | 20 skipped (incluye `guard-middleware-edge`).

### Pendiente fuera de T11 backend
- `e2e/helpers/landing.ts` y `tests/unit/e2e-helpers/landing.test.ts` siguen componiendo `firstVisibleNavHref(...) ?? DASHBOARD_ROUTE` a mano (design §10.1 R20 y §10.3.4); no estaban en este encargo.

### Veredicto
T11 parte backend hecha; verde salvo rojos ajenos de la zona T12/T13.

## Tanda 3 — T13/T12/T14/T17/T16 (backend_dev, 2026-10-15)

### Archivos
- **T13** nuevos: `lib/modules/identity/ports/company-addon-repository.ts`, `lib/modules/identity/adapters/driven/persistence/company-addons-prisma.ts` (transacción con `FOR UPDATE` vía `atomically`; sin cambios → sin escritura; un `company_events` por cambio con `details.addon`; claves desconocidas conservadas al final), `lib/modules/identity/domain/is-company-addon-active.ts` (`false` si no existe o está de baja; usa `effectiveAddons`, así cubre la dependencia de un nivel), `tests/integration/identity/company-addons.int.test.ts`.
  Modificados: `company-event.ts` (`addon.enabled`, `addon.disabled`), `company-view.ts` (`addon: string | null`), `company-prisma.ts` (`addonOf` en `listEvents`), `identity/index.ts` (barril: `createIsCompanyAddonActive`), `lib/composition/index.ts` (`companyAddonRepository`; `identity.isCompanyAddonActive` al final), `tests/integration/aislamiento.json` (los dos `.int` nuevos en `transaccion`), `tests/unit/identity/companies/company-event.test.ts`, `list-company-events.test.ts`, `tests/unit/identity/company-actions.test.ts` (solo `addon: null` en el fixture: lo exige el tipo).
- **T12** nuevos: `lib/modules/documentos/ports/pdf-reading-switch.ts`, `tests/unit/documentos/run-document-job-addon.test.ts`. Modificados: `run-document-job.ts` (dep `pdfReading` y bloque tras `claim`, §8.1), `lib/composition/index.ts` (`pdfReading` → `identity.isCompanyAddonActive(…, 'lectura_pdf')`), `run-document-job-doubles.ts` (`LECTURA_PDF_PRENDIDA` por defecto en `trabajoConProveedor`), `run-document-job-ai-provider.test.ts` (pasa `LECTURA_PDF_PRENDIDA`), `tests/unit/composition/documentos-facade.test.ts` (caso del interruptor), `tests/unit/composition/ai-provider-wiring.test.ts` (**fuera de «Archivos esperados»**: dobla `company-addons-prisma` con la lectura prendida; sin eso, sus 4 casos caían con `prisma.company` indefinido). `run-document-job.test.ts` no necesitó cambio: usa `trabajoConProveedor`, que ya trae el interruptor prendido.
- **T14** nuevos: `tests/integration/identity/company-directory-addons.int.test.ts`, `tests/guards/guard-rutas-fuera-de-sesion.test.ts`.
- **T17** nuevo: `tests/unit/identity/addons/sin-decision-en-cliente.test.ts`.
- **T16**: `docs/architecture.md` (las cuatro enmiendas de §11: viñeta «Nada de infraestructura», viñeta de permisos por petición + viñeta nueva de añadidos, párrafo «Permisos en cada petición» del `### Por qué`, crons núcleo), nuevo `tests/unit/identity/addons/architecture-doc.test.ts`.
- Los dos `.int` releen con el código de producción que usa el cliente global (`findActiveSessionUserById`, `listActiveCompanyIds`): el test sustituye `@/lib/shared/db/prisma` por un proxy que delega en la `tx` del caso mientras corre. Así siguen en `transaccion` y la lectura es la real.

### R -> test
- R4 → `run-document-job-addon.test.ts` («R4 — interruptor de PDF prendido con integraciones apagado…», con el interruptor tal como lo ata la composición) + `company-addons.int.test.ts` («R4, R22: isCompanyAddonActive sobre el adaptador real…»).
- R5 → `company-addons.int.test.ts` («R5: … createWithAdministrator nace sin ningun añadido»).
- R9 → `company-addons.int.test.ts` («R9: apagar con apply y releer con la lectura de sesion → permisos recortados…»).
- R22 → `run-document-job-addon.test.ts` (apagada → `unauthorized` definitivo; sin `readBatch`, `readerFor`, descarga, `remove` ni `pipelineFor`; nunca `requeue`; no consulta si no reclama) + `documentos-facade.test.ts` («R22 — se ata a identity.isCompanyAddonActive con la clave lectura_pdf…»).
- R24 → `company-addons.int.test.ts` («R24: apagar los cinco no toca recetas, proveedores, lineas de catalogo, lotes ni la conexion de IA»).
- R25 → `company-directory-addons.int.test.ts`.
- R26 → `guard-rutas-fuera-de-sesion.test.ts` (ruta sin entrada, entrada sin ruta, prueba inexistente, añadido fuera del catálogo; autocomprobación con `app/api/whatsapp/webhook/route.ts` sintética).
- R31 → `company-addons.int.test.ts` («R31: empresa de baja o inexistente → not_found…; la lectura ve la de baja»).
- R33 → `company-addons.int.test.ts` (atómico con un evento por cambio y `details.addon`; un fallo del evento deshace la fila; sin cambios → ni `updated_at` ni evento) + `company-event.test.ts` («R33: los tipos de añadido…»).
- R34 → `company-addons.int.test.ts` («R34: listEvents devuelve la clave del añadido…») + `list-company-events.test.ts` («R34: los eventos de añadido llegan con su tipo y la clave…»).
- R35 → `sin-decision-en-cliente.test.ts` (autocomprobación con un `'use client'` sintético que importa `hasAddon`).
- R37 → `architecture-doc.test.ts`.

### Salida
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores, 7 warnings preexistentes (`confirm-catalog-import.test.ts`, `order-service.test.ts`).
- Integración (base efímera sobre `quimicloude-pg17`:5433): `company-addons.int.test.ts` 10/10; `company-directory-addons.int.test.ts` 1/1.
- Unitarios nuevos/ampliados: `run-document-job-addon`, `run-document-job`, `run-document-job-ai-provider`, `documentos-facade` 39/39; `company-event` + `list-company-events` 26/26; `architecture-doc` 4/4; `sin-decision-en-cliente` + guardia de rutas 12/12; `ai-provider-wiring` + `document-job-route` 18/18.
- `pnpm exec vitest run guard`: 78 archivos, 1082 passed | 20 skipped.
- `documentos/module-contract.test.ts` cayó una vez por plazo en una corrida conjunta; solo: 23/23.
- `pnpm exec vitest related --run` (10 archivos de producción tocados): 839 archivos, 1 failed | 13437 passed | 14 skipped. El rojo era mío: `tests/integration/identity/company.int.test.ts > listEvents > R34, R37` compara la vista entera con `toEqual` y no tenía `addon`. Arreglado (solo `addon: null` en los tres objetos esperados; **fuera de «Archivos esperados»**) → 38/38.
- Sin rojos fuera de mi zona en estas corridas. El de `recipe-route-contract` que anotó T11 ya estaba resuelto.

### Fuera de «Archivos esperados» (para añadir a `tasks.md`)
- `tests/unit/composition/ai-provider-wiring.test.ts` (doble de `company-addons-prisma` con la lectura prendida).
- `tests/integration/identity/company.int.test.ts` (`addon: null` en lo esperado de `listEvents`).

### Veredicto
T13, T12, T14, T17 y T16 hechas; typecheck, lint, guardias y `related` en verde.

## Tanda 3 — T11 frontend (frontend_dev, 2026-10-15)

### Archivos
- `components/private/app-sidebar.tsx`: el logo usa `href={HOME_ROUTE}` (antes `ASSIGNED_ORDERS_ROUTE`; import sustituido). Sin props nuevas ni cambio visual.
- Tests enmendados (§10.3.3): `tests/unit/app-sidebar.test.tsx` (R4/R13: el `href` de la marca y el conjunto de destinos esperados pasan a `HOME_ROUTE`), `tests/unit/marca/sidebar-carril.test.ts` (no tenía assert de `href`; caso nuevo «QC-277 R18 el enlace de marca del carril colapsado apunta a HOME_ROUTE»), `tests/unit/sidebar-desktop.test.tsx` (fuera de §10.3.3 pero fijaba el logo a `/asignacion` en 3 asserts → `HOME_ROUTE`, con nota de enmienda QC-277). Ningún otro assert relajado.
- `e2e/marca-componentes.spec.ts` sin tocar (otra tanda).

### R -> test
- R18 (logo) → `app-sidebar.test.tsx > la marca es un enlace a HOME_ROUTE con nombre accesible`, `sidebar-carril.test.ts > QC-277 R18 …`, `sidebar-desktop.test.tsx > activar el control alterna a modo icono …`.

### Salida
- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: 0 errores, 7 warnings preexistentes; eslint de los 4 archivos tocados: sin incidencias.
- Los dos tests enmendados: 2 archivos, 28 passed.
- `pnpm exec vitest related --run components/private/app-sidebar.tsx`: 21 archivos, 2 failed | 19 passed. `sidebar-desktop.test.tsx` (logo a `/asignacion`) → enmendado, 20/20 al reejecutar. `session-once-per-request-render.test.tsx` falló en el barrido y pasa solo (falla por carga, no por el cambio).
- `pnpm exec vitest run guard`: 78 archivos passed, 1082 passed | 20 skipped.

### Veredicto
T11 parte frontend hecha; verde.

## Tanda 3 — cierre (implementer, 2026-10-15)
- Tasks cerradas: T11, T12, T13, T14, T16 y T17. T15 y G (T18–T21) quedan para la siguiente tanda.
- Desvíos consolidados:
  - `tests/unit/recetas-ui/recipe-route-contract.test.ts`: `HOME_ROUTE` añadida a la lista cerrada de exportaciones de
    `routes.ts` (misma clase que la opción A, sin tocar asserts).
  - `tests/unit/sidebar-desktop.test.tsx`: tres asserts del `href` del logo pasan a `HOME_ROUTE`. Es la enmienda §10.3.3
    aplicada a un archivo que el design no nombraba.
  - `tests/unit/composition/ai-provider-wiring.test.ts`: doble de `company-addons-prisma` con la lectura de PDF prendida.
    El trabajo compuesto lee ahora el interruptor.
  - `tests/integration/identity/company.int.test.ts`: `addon: null` en la vista de eventos.
  - Los dos `.int` nuevos cambian `@/lib/shared/db/prisma` por un proxy sobre la `tx` del caso, para seguir siendo
    `transaccion` y ejercitar la lectura de producción.
  - Los cuatro archivos se han añadido a `tasks.md > Archivos esperados`.
- Pendiente fuera de esta tanda (T18): `e2e/helpers/landing.ts` y `tests/unit/e2e-helpers/landing.test.ts` aún componen
  `firstVisibleNavHref(...) ?? DASHBOARD_ROUTE` a mano.
- Gate (commit `c004e2e4`, ./init.sh rápido):
  - 1.ª pasada: 1 rojo, `tests/unit/inventario/adjust-batch-dialog.test.tsx` R9 (`toastExito` llamado 0 veces). Ese archivo
    no está en el diff y solo pasa 30/30: inestabilidad por carga.
  - 2.ª pasada: related 883/883 archivos (14098 pasados, 59 saltados); test:rapido 117/117 (1641 pasados, 37 saltados);
    `== init OK ==`.

## Tanda 4 — T18 helpers E2E (backend_dev, 2026-10-15)
- Archivos: `e2e/helpers/landing.ts` (modificado: `permissionsForUsername` lee `company.addons` y devuelve
  `effectivePermissions(rol, effectiveAddons(addons))`, sin empresa pasa el rol entero; `landingRouteForPermissions`
  delega en `homeHrefFor`; misma firma pública), `e2e/helpers/addons.ts` (nuevo, `enableAllAddons(companyId)`),
  `tests/unit/e2e-helpers/landing.test.ts` (ampliado). `guard-e2e-landing.test.ts` no fija el cuerpo del helper: sin cambios.
- R20 → `tests/unit/e2e-helpers/landing.test.ts` (describe «QC-277 — el aterrizaje E2E usa el permiso efectivo»:
  Administrador sin añadidos → `/inventario`; con todos → `/dashboard`; dependencia apagada; Maestro sin empresa;
  consulta pide `company.addons`; `landingRouteForPermissions` = `homeHrefFor` por rol; `enableAllAddons`).
- Verificación: `pnpm run typecheck` exit 0; `pnpm run lint` exit 0 (avisos previos en otros archivos);
  `vitest run tests/unit/e2e-helpers/landing.test.ts tests/guards/guard-e2e-landing.test.ts` 2 archivos, 30/30.
- Veredicto: T18 hecha; sin desvíos de `## Archivos esperados`.

## Tanda 4 — T15 casos de uso y Server Actions del Maestro (backend_dev, 2026-10-15)

### Archivos
- Nuevos (dominio): `identity/domain/company-addon-input.ts` (`companyAddonsQuerySchema`, `setCompanyAddonSchema` con
  `addon: z.enum(ADDONS)` y `enabled: z.boolean()`, `setAllCompanyAddonsSchema`; todos `strictObject`),
  `company-addons-view.ts` (`CompanyAddonsView`, `toCompanyAddonsView`: orden de `ADDONS`, `enabled` = interruptor,
  `active` de `effectiveAddons`, `requires` de `ADDON_REQUIRES`), `get-company-addons.ts` (`empresas.consultar`; viva o
  de baja), `set-company-addon.ts` y `set-all-company-addons.ts` (`empresas.modificar`; una sola llamada a `apply`;
  `not_found` → `company_not_found`; devuelven la vista con lo guardado). Orden: permiso → `safeParse` → puerto → vista.
- Modificados: `identity/adapters/driving/company-actions.ts` (`getCompanyAddonsAction`, `setCompanyAddonAction`,
  `setAllCompanyAddonsAction` al final; `enabled` solo traduce `'true'`/`'false'`, cualquier otro valor llega crudo y
  lo rechaza el esquema), `identity/index.ts` (barril: esquemas, vista y las tres factories), `lib/composition/index.ts`
  (tres claves al final de `identity` sobre `companyAddonRepository`).
- Tests nuevos: `tests/unit/identity/companies/get-company-addons.test.ts`, `set-company-addon.test.ts`,
  `set-all-company-addons.test.ts`. Ampliado: `tests/unit/identity/company-actions.test.ts` (bloques nuevos; el censo de
  las ocho acciones de QC-162 no se toca). Enmienda §10.3.1: `maestro-rol.test.ts` R17 gana las tres rutas; el
  anti-cegado sigue igual.

### R -> test
- R27 → `get-company-addons.test.ts` (vista por añadido con interruptor/activo/dependencia; de baja se lee; basta
  `consultar`) + `company-actions.test.ts > getCompanyAddonsAction`.
- R28 → `set-company-addon.test.ts` (enable/disable con actor e instante; vista actualizada) + `setCompanyAddonAction`
  (`'true'`/`'false'`; `'1'`, `'0'`, `'TRUE'`, `'on'`, `'si'`, `' true'`, `''` y ausente → `invalid_input` sin puerto).
- R29 → `set-all-company-addons.test.ts` (una sola llamada con los cinco) + `setAllCompanyAddonsAction`. La atomicidad en
  base la cubre ya `company-addons.int.test.ts` (T13).
- R30 → los tres unitarios (null, undefined, sin permisos, vacío, el permiso contrario, rol de empresa; con entrada
  válida e inválida, dobles que lanzan si se llaman) + `company-actions.test.ts` (sin sesión y rol de empresa).
- R31 → los tres unitarios (`company_not_found`) + las tres acciones.
- R32 → `set-company-addon.test.ts` (`pedidos`, `inventario`, `usuarios`, `x`, `''`, mayúsculas, espacio y los 22
  `CORE_PERMISSIONS` → `invalid_input` sin puerto) + `setCompanyAddonAction` (`pedidos`, `inventario`, `x`).
- R34 → `company-actions.test.ts > listCompanyEventsAction: eventos de añadido` (llega `addon`), además de lo de T13.

### Salida
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores, 7 avisos ya existentes (`confirm-catalog-import.test.ts`, `order-service.test.ts`);
  eslint de lo tocado: sin incidencias.
- Los 5 archivos de test tocados: 5 archivos, 192 pasados, 0 fallidos.
- `pnpm exec vitest related --run --project node --project ui` sobre los 8 archivos de producción: 660 archivos,
  11644 pasados, 13 saltados, 0 fallidos.
- Proyecto `integration` no corrido: Docker Desktop apagado (`ECONNREFUSED :5433`). T15 no toca adaptadores ni `.int`.
- `pnpm exec vitest run guard`: 78 archivos, 1082 pasados, 20 saltados.

### Veredicto
T15 hecha; sin desvíos de `## Archivos esperados` ni tests ajenos rotos.

## Tanda 4 — cierre (implementer, 2026-10-15)
- Tasks cerradas: T15 y T18 (commit `c5f828df`). Quedan T19–T21.
- Sin desvíos: ningún archivo fuera de `## Archivos esperados`, ningún assert ajeno tocado, ninguna dependencia nueva.
- La parte de integración que T15 no pudo correr (Docker apagado) se cubrió aquí: se levantó Docker (pg17 :5433) y `./init.sh` incluye los `.int` relacionados.
- Gate (./init.sh rápido):
  - 1.ª pasada: 1 rojo, `tests/unit/documentos/module-contract.test.ts` R27/R33, timeout de 20 s en `await import('@/lib/modules/documentos')`
    con la máquina cargada (Docker recién arrancado). Ese archivo no está en el diff; solo pasa 23/23. Es otro archivo que el
    inestable conocido (`adjust-batch-dialog`), pero de la misma clase: inestabilidad por carga.
  - 2.ª pasada: related 886/886 archivos (14230 pasados, 59 saltados); test:rapido 117/117 (1641 pasados, 37 saltados);
    `== init OK ==`.

## Tanda 5 — T19 E2E de la ficha (frontend_dev, 2026-10-15)

**Archivos:** creado `e2e/modulos-por-empresa.spec.ts`. Sin cambios en código de producción ni dependencias nuevas.

Fixture: empresa propia `qc277_e2e_<runId>_c` (nace sin añadidos; se comprueba) y un Administrador; limpieza de huérfanos por prefijo con más de 1 h y borrado por token en `afterAll`. Token generado en `beforeAll`. Los casos comparten empresa (`describe.configure({ mode: 'default' })`) y cada uno fija sus añadidos por Prisma al empezar.

| R | Test (`e2e/modulos-por-empresa.spec.ts`) |
|---|---|
| R36, R12, R18, R20 | caso 1 «sin añadidos: aterriza en Inventario…»: `loginAndLand` → `/inventario`; `nav-inventario` visible y `nav-dashboard`/`nav-proveedores`/`nav-integraciones` con 0; sin `inventory-import-link`; desde Fórmulas, `private-brand-link` tiene `href=/inicio` y el clic acaba en `/inventario` |
| R36, R13 | caso 2 «cada pantalla de un añadido pedida por URL da el 404 privado…»: `/dashboard`, `/proveedores`, `/inventario/importar`, `/integraciones/proveedor-ia` → status 404, `private-not-found`, `private-nav` y `private-logout` visibles |
| R36, R19 | caso 3 «entrar al login con sesión pasa por /inicio…»: cadena de redirecciones exacta `/login → /inicio → /inventario` |
| R36, R9, R18 | caso 4 «al prender los cinco añadidos con la sesión abierta…»: `enableAllAddons` + `reload` sin re-login → los tres enlaces y `inventory-import-link` visibles; `/dashboard` 200 sin 404; logo → `/dashboard` |
| R4, R9 | caso 5 «con la lectura de PDF prendida e integraciones apagado…»: `['lectura_pdf']` → sin `document-upload-open` en Fórmulas; positivo con `['lectura_pdf','integraciones']` + `reload` → 1 |

**Salida real** (base `quimicloude_e2e_qc277`, `pnpm exec playwright test e2e/modulos-por-empresa.spec.ts`, títulos recortados):

```
  ok  2 [chromium] › e2e\modulos-por-empresa.spec.ts:165:7 › sin añadidos: aterriza en Inventario… (R36, R12, R18, R20) (33.8s)
  ok  1 [webkit] › e2e\modulos-por-empresa.spec.ts:165:7 › sin añadidos: aterriza en Inventario… (R36, R12, R18, R20) (34.6s)
  ok  3 [chromium] › e2e\modulos-por-empresa.spec.ts:185:7 › sin añadidos: cada pantalla de un añadido… (R36, R13) (17.5s)
  ok  4 [webkit] › e2e\modulos-por-empresa.spec.ts:185:7 › sin añadidos: cada pantalla de un añadido… (R36, R13) (17.2s)
  ok  5 [chromium] › e2e\modulos-por-empresa.spec.ts:200:7 › sin añadidos: entrar al login con sesión… (R36, R19) (3.6s)
  ok  6 [webkit] › e2e\modulos-por-empresa.spec.ts:200:7 › sin añadidos: entrar al login con sesión… (R36, R19) (7.6s)
  ok  7 [chromium] › e2e\modulos-por-empresa.spec.ts:211:7 › al prender los cinco añadidos… (R36, R9, R18) (6.3s)
  ok  9 [chromium] › e2e\modulos-por-empresa.spec.ts:239:7 › con la lectura de PDF prendida… (R4, R9) (4.7s)
  ok  8 [webkit] › e2e\modulos-por-empresa.spec.ts:211:7 › al prender los cinco añadidos… (R36, R9, R18) (10.6s)
  ok 10 [webkit] › e2e\modulos-por-empresa.spec.ts:239:7 › con la lectura de PDF prendida… (R4, R9) (5.3s)
  10 passed (1.4m)
```

Chromium 5/5, WebKit 5/5 (dos corridas seguidas, ambas verdes). `pnpm run typecheck`: sin salida de errores. `pnpm run lint`: `✖ 7 problems (0 errors, 7 warnings)`, todos previos (`confirm-catalog-import.test.ts`, `order-service.test.ts`); el spec nuevo, `ESLint: No issues found`.

**Veredicto:** T19 hecha: los cinco casos de design §10.2 están verdes en Chromium y WebKit sin tocar código de producción.

## Tanda 5 — T20 censo E2E (frontend_dev, 2026-10-15)

Punto de partida: suite completa en la rama contra `quimicloude_e2e_qc277`, 63 failed / 429 passed.
Todos los specs tocados reciben `await enableAllAddons(<id>)` (de `e2e/helpers/addons.ts`) justo tras
crear su empresa propia. No se cambió ningún assert. Cada spec crea su empresa inline: no hay fixture
compartido en `e2e/` que tocar.

| Spec | Causa en el log (empresa propia sin añadidos) | ¿En «Archivos esperados»? |
|---|---|---|
| `e2e/aislamiento-proveedores.spec.ts` | `proveedores-title` no aparece (proveedores apagado). Se llama dentro de `seedCompanySuppliers`, así que cubre las empresas A y B | sí |
| `e2e/catalogo-desde-pdf.spec.ts` | `supplier-detail-name` no aparece (proveedores) | sí |
| `e2e/dashboard-rediseno.spec.ts` | `dashboard-title` no aparece (dashboard) | sí |
| `e2e/documentos.spec.ts` | `supplier-detail-name` y `document-upload-open` ausentes (proveedores, lectura_pdf) | sí |
| `e2e/formula-desde-pdf.spec.ts` | `document-upload-open` ausente (lectura_pdf) | sí |
| `e2e/integraciones-proveedor-ia.spec.ts` | `document-upload-open` ausente en Fórmulas (lectura_pdf) | sí |
| `e2e/integraciones-whatsapp.spec.ts` | 404 en la pantalla y `whatsapp-connection-form` ausente (integraciones) | sí |
| `e2e/integraciones.spec.ts` | `nav-integraciones` ausente en el menú (integraciones) | sí |
| `e2e/inventario-importar.spec.ts` | `inventory-import-review` ausente (importacion_excel) | sí |
| `e2e/marca-componentes.spec.ts` | espera `nav-integraciones` (FIRST_GROUP) y no está; otros dos casos acabaron en `/login?sesion=fin`, que tras el cambio también pasan | sí |
| `e2e/movimiento.spec.ts` | «no hay indicador en la lista de nav-proveedores» y `document-upload-open` ausente (proveedores, lectura_pdf) | **NO: falta en `tasks.md > Archivos esperados`** |
| `e2e/proveedores.spec.ts` | `proveedores-title` no aparece (proveedores) | sí |
| `e2e/recorrido-ejecucion.spec.ts` | `dashboard-title` no aparece (dashboard). Solo la empresa principal: el usuario de la otra empresa no inicia sesión | sí |

No tocados:

- `e2e/acceso-rediseno.spec.ts`: en la rama solo falla R20 (chromium y webkit), que es HEREDADO de dev.
  Su empresa no entra en ningún añadido.
- `e2e/pedidos-rediseno.spec.ts`: 1 caso en webkit (`data-pinned` de la cabecera, l. 547), sin relación
  con añadidos. Se reintentó una vez y pasó: inestable.
- `shell-rediseno`, `piezas-compartidas`, `permisos`, `login` (listados en Archivos esperados): no
  fallaron en la suite de la rama, así que no se tocan.

Salida final (solo los 13 specs tocados + `pedidos-rediseno`, chromium + webkit):

```
bash e2e-qc277.sh quimicloude_e2e_qc277 pnpm exec playwright test --reporter=line <13 specs> e2e/pedidos-rediseno.spec.ts
  1 failed
    [webkit] › e2e\integraciones-proveedor-ia.spec.ts:211:7 › el proveedor IA de la empresa › R37, R30, ... desconectar
  151 passed (10.7m)
```

El único rojo es el HEREDADO de dev (antes l. 209, ahora l. 211 por las dos líneas añadidas; solo webkit). Ya
pasa la aserción del añadido (`document-upload-open` deshabilitado, l. 229) y cae más adelante, en
`ai-provider-required-tooltip` tras el hover (l. 231), el síntoma de webkit que trae dev.

`pnpm run typecheck`: sin errores. `pnpm run lint`: `✖ 7 problems (0 errors, 7 warnings)`, los mismos de antes
(`confirm-catalog-import.test.ts`, `order-service.test.ts`). `eslint e2e/*.spec.ts`: `No issues found`.

**Veredicto:** T20 hecha. Los 13 specs tocados quedan verdes en chromium y webkit, salvo el heredado. Hay
que añadir `e2e/movimiento.spec.ts` a `tasks.md > Archivos esperados`.

## Tanda 5 — T20 cierre: suite completa y comparación con dev (implementer, 2026-10-15)
- Base limpia propia: `quimicloude_e2e_qc277` (pg17 :5433, `db:migrate` + `db:seed` desde cero). La compartida
  `QuimiCloude` no tiene la migración de la ficha. Línea base de dev: `quimicloude_e2e_qc277_dev`, migrada y sembrada
  desde el worktree principal (`dev` @ `ccde16f7`).
- Suite completa en la rama (commit `89819c2c`, antes del censo): **63 failed | 429 passed (35.2 min)**. Han fallado 15 specs.
- Esos 15 specs en dev: **4 failed | 190 passed (11.3 min)**:
  - `acceso-rediseno.spec.ts:319` R20 (chromium y webkit);
  - `acceso-rediseno.spec.ts:413` R8 (chromium);
  - `integraciones-proveedor-ia.spec.ts:209` (webkit). Cae en el mismo assert que en la rama:
    `getByTestId('ai-provider-required-tooltip')` no aparece, l. 229 en dev y l. 231 en la rama.
  Son **heredados**: no se tocan.
- Tras el censo (13 specs + `pedidos-rediseno`, chromium y webkit): **1 failed | 151 passed**. El rojo es el
  heredado de webkit en `integraciones-proveedor-ia`. `pedidos-rediseno` (webkit, `data-pinned`) pasó al reintentarlo: inestable, sin
  relación con añadidos.
- Resultado: la suite queda con los mismos rojos que dev. No hay nada nuevo y no apareció ninguna clase nueva de desvío.
- `e2e/movimiento.spec.ts` añadido a `tasks.md > Archivos esperados`.
- **Aviso:** el Bloque H (T22–T31) cambia `companies.addons` por tablas y su T31 dice que T20 y T21 corren después. Este
  censo es sobre el modelo anterior. Las llamadas a `enableAllAddons` siguen valiendo, pero el cuerpo del helper cambiará, así
  que hay que repetir el censo tras T31.

## Tanda 5 — T21

- 2026-10-15 (backend_dev): alta de `'modulos-por-empresa.spec.ts'` en `E2E_ESPERADOS` de `tests/guards/guard-identificador-de-request.test.ts` con su comentario (5 casos de añadidos; no lee el identificador de petición ni `reference`, QC-71 R21 intacto). `pnpm exec vitest run tests/guards/guard-identificador-de-request.test.ts` → 23/23 passed; `pnpm run lint` → exit 0 (solo warnings previos de otros archivos).
- 2026-10-15 (frontend_dev): guardia QC-93 — borrada la función local `login` de `e2e/modulos-por-empresa.spec.ts`; sus 5 usos llaman directamente a `loginAndLand(page, { username: adminUsername, password: adminPassword })` (el valor devuelto se conserva en el primer caso); sin cambios en asserts ni en la guardia. `pnpm exec vitest run tests/guards/guard-e2e-landing.test.ts` → 16/16 passed; `pnpm run lint` → exit 0 (solo warnings previos de otros archivos); `pnpm run typecheck` → exit 0; `playwright test e2e/modulos-por-empresa.spec.ts` (base quimicloude_e2e_qc277) → 10 passed (chromium + webkit).

### Mapa R1–R38 → test (consolidado, implementer, 2026-10-15)
Antes del Bloque H. El T31 de ese bloque actualiza las filas R2, R5, R6/R38, R7 y R33/R34. Todos los archivos existen
y corren en el gate; los títulos citan su R.

| R | Test |
|---|---|
| R1, R2, R3 | `tests/unit/identity/addons/company-addons.test.ts` |
| R4 | `company-addons.test.ts` + `tests/unit/documentos/run-document-job-addon.test.ts` + `tests/integration/identity/company-addons.int.test.ts` + E2E caso 5 |
| R5 | `tests/integration/identity/company-addons.int.test.ts` |
| R6, R38 | `tests/unit/identity/schema/company-addons-migration.test.ts` |
| R7 | `tests/unit/identity/seed/seed-initial-access.test.ts` + `tests/integration/identity/identity-seed.int.test.ts` |
| R8, R10, R11 | `tests/unit/identity/resolve-session.test.ts` + `tests/integration/identity/session-user.int.test.ts` |
| R9 | `company-addons.int.test.ts` + E2E casos 4 y 5 |
| R12 | `tests/unit/identity/addons/menu-recortado.test.ts` + E2E caso 1 |
| R13 | `tests/unit/identity/require-page-addon.test.ts` + `tests/guards/guard-pantallas-de-anadido.test.ts` + E2E caso 2 |
| R14, R16 | `tests/unit/inventario/importar/inventory-import-addon.test.ts` + `importar-page.test.tsx` + `tests/unit/inventario/product-page.test.tsx` |
| R14, R15, R23 | `tests/unit/documentos/import-addon.test.ts` + `tests/unit/recetas-ui/formula-import-page.test.tsx` + `tests/unit/proveedores-ui/catalog-import-page.test.tsx` + `tests/unit/documentos-ui/formulas-upload.test.tsx` + `supplier-detail-upload.test.tsx` + `guard-pantallas-de-anadido.test.ts` |
| R17 | `menu-recortado.test.ts` + `tests/unit/asignaciones-ui/assigned-orders-route-contract.test.ts` |
| R18 | `tests/unit/identity/home-route.test.ts` + `tests/unit/app-sidebar.test.tsx` + `tests/unit/marca/sidebar-carril.test.ts` + `tests/unit/sidebar-desktop.test.tsx` + E2E casos 1 y 4 |
| R19, R21 | `home-route.test.ts` + `tests/unit/identity/route-guard-middleware.test.ts` + E2E caso 3 |
| R20 | `tests/unit/identity/login-action.test.ts` + `tests/unit/e2e-helpers/landing.test.ts` + E2E caso 1 |
| R22 | `run-document-job-addon.test.ts` + `tests/unit/composition/documentos-facade.test.ts` + `company-addons.int.test.ts` |
| R24 | `company-addons.int.test.ts` |
| R25 | `tests/integration/identity/company-directory-addons.int.test.ts` |
| R26 | `tests/guards/guard-rutas-fuera-de-sesion.test.ts` |
| R27 | `tests/unit/identity/companies/get-company-addons.test.ts` + `tests/unit/identity/company-actions.test.ts` |
| R28 | `tests/unit/identity/companies/set-company-addon.test.ts` + `company-actions.test.ts` |
| R29 | `tests/unit/identity/companies/set-all-company-addons.test.ts` + `company-actions.test.ts` + `company-addons.int.test.ts` (atomicidad) |
| R30, R31, R32 | los tres unitarios de `companies/` + `company-actions.test.ts` + `company-addons.int.test.ts` (R31, empresa de baja) |
| R33, R34 | `company-addons.int.test.ts` + `tests/unit/identity/companies/company-event.test.ts` + `list-company-events.test.ts` + `company-actions.test.ts` |
| R35 | suma de R8, R12–R16 y R22 + `tests/unit/identity/addons/sin-decision-en-cliente.test.ts` |
| R36 | `e2e/modulos-por-empresa.spec.ts` (5/5 en chromium y en webkit) |
| R37 | `tests/unit/identity/addons/architecture-doc.test.ts` |

### Preguntas abiertas con el defecto aplicado
- **P2:** la migración prende los cinco añadidos en las empresas existentes (R6, `company-addons-migration.test.ts`) y el seed
  crea QuimiCloud con los cinco (R7, `seed-initial-access.test.ts` + `identity-seed.int.test.ts`).
- **P3:** el interruptor de `lectura_pdf` se guarda pero no surte efecto sin `integraciones` (R4: `company-addons.test.ts`,
  `run-document-job-addon.test.ts`, E2E caso 5).
- **P4:** apagar no borra ni marca nada en `documentos`. Los trabajos que llegan con la lectura apagada terminan en `unauthorized`
  definitivo y no vuelven a la cola (R22, `run-document-job-addon.test.ts`); R24 confirma que no se toca ningún dato.
- **P5:** la evidencia por paso queda fuera: el catálogo tiene exactamente cinco claves (R2, `company-addons.test.ts`) y sus
  permisos siguen en el núcleo.

### Gate local T21 (implementer, 2026-10-15; `./init.sh` rápido sobre `9e65f3fd`)
- 1.ª pasada: `guard-identificador-de-request` R21, porque la lista cerrada `E2E_ESPERADOS` no tenía el spec nuevo → alta.
- 2.ª pasada: `guard-e2e-landing` (QC-93), porque el spec tenía una función local `login` → se entra directamente por `loginAndLand`. Esta guardia no la dispara `playwright` y
  solo salió en el gate.
- 3.ª pasada: related 886/886 archivos (14230 pasados, 59 saltados); test:rapido 117/117 (1641 pasados, 37 saltados);
  `== init OK ==`. Los inestables conocidos (`adjust-batch-dialog`, `documentos/module-contract`) no salieron.
- Veredicto: T19–T21 hechos sobre el modelo `companies.addons`. El Bloque H (T22–T31) pide repetir T20 y T21 tras T31.

## Bloque H — T22 (backend_dev, 2026-10-15)

### Archivos
- `db/schema.prisma`: fuera `Company.addons`; nacen `Addon` (`addons`) y `CompanyAddonOverride`
  (`company_addon_overrides`) como `design.md > 2.2`; inversas `Company.addonOverrides` y
  `User.addonOverridesCreated`.
- `db/migrations/20261014190000_company_addons/migration.sql` y `down.sql`: reescritos en su carpeta
  (`design.md > 2.3`). El SQL es el del diseño, letra a letra; en los comentarios se quitaron las
  citas «P2»/«P7» (regla de comentarios de producción).
- `tests/unit/identity/schema/company-addons-migration.test.ts`: reescrito (fila R6, R38 de § 10.1).
- Cliente Prisma regenerado (`pnpm exec prisma generate`).

### Mapa R → test
| R | Test |
|---|---|
| R6 | `company-addons-migration.test.ts`: catálogo con PK + CHECK y `INSERT` = `ADDONS`; excepciones con PK compuesta, índices y FK (empresa CASCADE, añadido y autor RESTRICT); siembra `true` por empresa × añadido sin `WHERE` ni autor; RLS ENABLE + FORCE al final; mutaciones |
| R38 | ídem: `down.sql` = `DROP TABLE "company_addon_overrides"; DROP TABLE "addons"`, hija antes que padre; mutaciones (orden invertido, sentencia de más) |

### Migración sobre base desechable `qc277_t22_scratch` (pg17 :5433, ya borrada)
- `pnpm run db:migrate` sobre base vacía: `All migrations have been successfully applied.`
  `addons|t|t`, `company_addon_overrides|t|t` (RLS/FORCE); catálogo = los cinco; FK
  `company_id`→`c`, `addon_key`→`r`, `created_by`→`r`; `companies.addons` no existe.
- `prisma migrate diff --from-url <scratch> --to-schema-datamodel db/schema.prisma --script`: 314
  líneas de drift preexistente (FK compuestas escritas a mano en otras tablas y
  `users_account_status_changed_by_fkey`, declarado en el esquema); **ninguna** línea con `addon`,
  `companies` ni `company_addon_overrides`.
- `pnpm run db:rollback`: `20261014190000_company_addons revertida.`; 0 tablas, 0 filas en
  `_prisma_migrations` para la migración.
- Con dos empresas (una de baja) insertadas, `db:migrate` reaplica: 10 excepciones, todas
  `enabled`, todas sin autor, 2 empresas. Segundo rollback con datos: 0 tablas. `DROP DATABASE`.
- La base compartida `QuimiCloude` no se tocó.

### Verificación
- `pnpm exec vitest run tests/unit/identity/schema/company-addons-migration.test.ts guard-rls-force`:
  2 archivos, 12 pasados.
- `pnpm exec eslint <test>`: sin problemas. `prisma validate`: válido.
- `pnpm exec vitest run guard`: 77/78 archivos; 1 fallo esperado,
  `guard-empresa-en-esquema` («el modelo 'Addon' (tabla 'addons') no declara la columna company_id
  y su tabla no esta en EXENTAS»): lo cierra T24.
- `pnpm run typecheck`: 34 errores, todos de la clase esperada (uso de `Company.addons`), en
  `e2e/helpers/addons.ts`, `e2e/helpers/landing.ts`, `e2e/modulos-por-empresa.spec.ts`,
  `company-addons-prisma.ts`, `initial-access-repository-prisma.ts`, `session-user-prisma.ts`,
  `tests/integration/identity/{company-addons,company-directory-addons,identity-seed,session-user}.int.test.ts`
  → T25–T28. No se arreglaron.
- Veredicto: T22 hecho; quedan rojos esperados de tipos (T25–T28) y la guardia de empresa (T24).

## Bloque H — T28 (frontend_dev, 2026-10-15)

- Archivos modificados:
  - `e2e/helpers/addons.ts`: `enableAllAddons(companyId)` hace `upsert` de las cinco excepciones
    (`ADDONS`) a `enabled = true`, sin autor (P7), en un `$transaction`. Misma firma.
  - `e2e/helpers/landing.ts`: `permissionsForUsername` selecciona
    `company.addonOverrides { where: { enabled: true }, select: { addonKey } }` y pasa las claves a
    `effectiveAddons`. Misma firma.
  - `e2e/modulos-por-empresa.spec.ts`: `setAddons` hace `upsert` de las cinco con
    `enabled = addons.includes(key)` (apagar escribe `false`, no borra); «nace sin añadidos» cuenta
    `_count.addonOverrides` (debe ser 0). Asserts de comportamiento sin tocar.
  - `tests/unit/e2e-helpers/landing.test.ts`: dobles de `findFirst` con `companyWith(...)`, forma
    del `select` nueva, mock de `companyAddonOverride.upsert` + `$transaction`.
- Mapa:
  - R20 → `tests/unit/e2e-helpers/landing.test.ts` (describe «el aterrizaje E2E usa el permiso
    efectivo» y «enableAllAddons prende los cinco añadidos ... (R20, P7)»).
  - R36 → `e2e/modulos-por-empresa.spec.ts` (no corrido: playwright lo corre el implementer tras
    recrear la base E2E).
- Salida real:
  - `pnpm exec vitest run tests/unit/e2e-helpers/landing.test.ts tests/guards/guard-e2e-landing.test.ts`
    → `Test Files 2 passed (2) · Tests 30 passed (30)`.
  - `pnpm exec tsc --noEmit -p .` → 0 errores en los cuatro archivos de T28; 18 restantes, todos en
    `lib/modules/identity/adapters/driven/persistence/{initial-access-repository,session-user}-prisma.ts`
    y `tests/integration/identity/*` (T25–T27, otros agentes).
  - `pnpm exec eslint <los cuatro archivos>` → `No issues found`.
- Veredicto: T28 hecho; helpers y spec E2E escriben y leen excepciones, firmas intactas.

## Bloque H — T23, T24, T29 (backend_dev, 2026-10-15)

- Archivos:
  - creado `tests/guards/guard-catalogo-de-anadidos.test.ts` (T23, design § 9.4): lee
    `db/migrations/*/migration.sql` en orden de carpeta, suma `INSERT INTO "addons"`, resta
    `DELETE`, vacía con `TRUNCATE`/`DROP TABLE`; `UPDATE "addons" SET "key"` e `INSERT` no legible
    son hallazgo. Compara con `ADDONS` importado de `@/lib/modules/identity`.
  - `tests/guards/guard-empresa-en-esquema.test.ts` (T24): `EXENTAS` gana `addons` con su motivo;
    R7 «las once», `toHaveLength(11)`; R10 comprueba que `company_addon_overrides` tiene
    `company_id` y no está exenta; las dos fixtures sintéticas de R14 nombran `addons` (si no, el
    hallazgo esperado sumaba «addons» por la tabla nueva; el assert no se relaja).
  - `docs/architecture.md > Dominio`: bullet de exentas «once tablas» + `addons`; viñeta «Nada de
    infraestructura» nombra `company_addon_overrides` (design § 11, punto 1).
  - `tests/unit/identity/addons/architecture-doc.test.ts`: espera `company_addon_overrides`.
  - Comentarios: `tests/unit/recetas-ui/recipe-route-contract.test.ts` (l. 567) y
    `tests/guards/guard-identificador-de-request.test.ts` (l. 655) → «las tablas de añadidos».
- Mapa R → test:
  - R2 (D13) → `tests/guards/guard-catalogo-de-anadidos.test.ts` (real verde; rojo con añadido
    sintético sin INSERT, con INSERT de `'futuro'`, con `UPDATE "addons" SET "key"`, con INSERT…SELECT;
    simétrico verde; anclas).
  - D13/D15 (`addons` exenta, overrides como tabla de empresa) → `guard-empresa-en-esquema` R7, R10, R14.
  - R37 → `tests/unit/identity/addons/architecture-doc.test.ts`.
- Salida real:
  - `vitest run guard-catalogo-de-anadidos guard-empresa-en-esquema architecture-doc recipe-route-contract`
    → `Test Files 4 passed (4)  Tests 55 passed (55)`.
  - `pnpm exec vitest run guard` → `Test Files 79 passed (79)  Tests 1090 passed | 20 skipped (1110)`.
  - `pnpm run lint` → `✖ 7 problems (0 errors, 7 warnings)` (preexistentes: confirm-catalog-import,
    order-service).
  - `pnpm run typecheck` → 0 `error TS` en el momento de correrlo.
  - `git grep -n "companies.addons" -- ':!specs' ':!progress'` → vacío.
- Veredicto: T23, T24 y T29 hechos; guardias verdes y ninguna cita a `companies.addons` fuera de specs/progress.

## Bloque H — T25, T26, T27, T30 (backend_dev, 2026-10-15)

- Archivos de producción:
  - `lib/modules/identity/adapters/driven/persistence/company-addons-prisma.ts` (T25, § 6.3): `findByCompany`
    lee `addonOverrides` con `enabled: true` y devuelve `stored` en el orden de `ADDONS`; `apply` bloquea
    `companies ... FOR UPDATE`, lee las excepciones prendidas, sin cambios no escribe, y con cambios hace un
    `upsert` por cambio (`createdBy` = actor, `createdAt` = now; apagar escribe `false`, sin borrar),
    toca `updated_at` y escribe un evento por cambio, todo en el mismo `atomically`. Puerto, casos de
    uso e `is-company-addon-active.ts` sin cambios.
  - `session-user-prisma.ts` (T26, § 3.1): `company.addonOverrides` (`enabled: true`) en el mismo
    `findFirst`; párrafo de cabecera con el coste (una sentencia SQL más, cero invocaciones nuevas).
  - `initial-access-repository-prisma.ts` (T27, § 2.5): `create` anidado con las cinco excepciones
    prendidas y sin autor.
- Tests:
  - `tests/integration/identity/company-addons.int.test.ts`: siembra excepciones (prendidas/apagadas);
    casos nuevos: apagar deja `false` con autor el actor; volver a prender; sin cambios y apagar sin
    fila no escriben; apagar todos → cinco filas `false` + cinco eventos; fallo del 5.º evento
    (proxy sobre `companyEvent.create`) deshace las cinco y `updated_at`; `findByCompany` solo
    prendidas en orden de catálogo; tabla `addons` = `ADDONS`; clave `'futuro'` → FK `23503`.
  - `company-directory-addons.int.test.ts`: siembra excepciones; empresa con todas apagadas sale en la lista.
  - `session-user.int.test.ts`: fixture con excepciones (`fijarAnadidos`); `companyAddons` con
    `arrayContaining` + `toHaveLength(5)` (mismo patrón que `permissions`: el adaptador no ordena);
    R8 espía también `companyAddonOverride.find*`; caso nuevo con todas apagadas → `[]`.
  - `tests/unit/identity/seed/seed-initial-access.test.ts` y `identity-seed.int.test.ts`: cinco filas
    `enabled = true`, `source = 'manual'`, `created_by` null; la segunda corrida no las toca;
    `platform-only` → `company_addon_overrides` vacía.
  - `tests/integration/aislamiento.json` (T30): motivo de `session-user.int.test.ts` nombra
    `company_addon_overrides` y el `ON DELETE CASCADE`. Ningún `.int.test.ts` nuevo.
- Mapa R → test:
  - R2 (D13) → `company-addons.int.test.ts` «la tabla addons… = ADDONS» y «…FK con 23503».
  - R5 → `company-addons.int.test.ts` «R5: … nace sin ningun añadido» (cero excepciones).
  - R7 → `seed-initial-access.test.ts` (R7 ×2) + `identity-seed.int.test.ts` «QC-277 R7» y caso platform-only.
  - R8 → `session-user.int.test.ts` «QC-277 R8, R9: … misma llamada al lector» y «QC-277 R8: … núcleo».
  - R9 → `session-user.int.test.ts` «QC-277 R9: … todas apagadas» + `company-addons.int.test.ts` «R9: apagar con apply y releer».
  - R24 → `company-addons.int.test.ts` «R24: apagar los cinco no toca…».
  - R25 → `company-directory-addons.int.test.ts`.
  - R29, R33 → `company-addons.int.test.ts` «apagar todos…», «si falla un evento a mitad…», «si el autor no existe…», casos R33.
  - R31 → `company-addons.int.test.ts` «R31: empresa de baja o inexistente».
  - R34 → `company-addons.int.test.ts` «R34: listEvents…».
- Salida real:
  - `pnpm run typecheck` → 0 `error TS`.
  - `pnpm exec eslint <8 archivos tocados>` → `ESLint: No issues found`.
  - `vitest run` de los 4 `.int` → plantilla reconstruida `qct_tpl_c291773e75d6` (seed con el adaptador nuevo);
    `Test Files 4 passed (4)  Tests 71 passed (71)`.
  - `vitest run guard-aislamiento-integracion seed-initial-access.test.ts` → `Test Files 2 passed (2)  Tests 46 passed (46)`.
  - `vitest related --run <3 adaptadores + test unit del seed>` → `Test Files 371 passed (371)  Tests 6066 passed | 2 skipped`.
- Veredicto: T25, T26, T27 y T30 hechos; todo verde, sin dependencias nuevas ni cambios en puerto/dominio.

## Bloque H — T31, re-T20 y re-T21 (implementer, 2026-10-15)

### Bases recreadas (riesgo 5)
- `qct_tpl_48246af3423e` (plantilla de integración con la migración vieja): borrada. La plantilla nueva
  (`qct_tpl_c291773e75d6`) se construyó sola por huella de migraciones.
- `quimicloude_e2e_qc277`: DROP + `db:migrate` + `db:seed` dos veces (antes de T31 y antes de la suite). El seed deja
  5 excepciones `enabled = true` y `created_by` NULL.
- `QuimiCloude`, `quimicloude_e2e_qc277_dev`, `quimicloude_e2e_qc285` y el resto de `qct_tpl_*` no tenían la
  migración: no se tocaron.

### T31
- `playwright test e2e/modulos-por-empresa.spec.ts` (chromium + webkit): `10 passed (33.9s)`.
- `pnpm run typecheck`: 0 errores. `pnpm run lint`: 0 errores y 7 avisos (los previos).
- `vitest run guard`: `Test Files 79 passed (79)`, `Tests 1090 passed | 20 skipped`.
- `vitest related --run <archivos del bloque>`: `Test Files 379 passed (379)`, `Tests 6167 passed | 2 skipped`.
- T25–T27 y T30, revisados contra su «Hecho»: los 4 `.int`, el seed unitario y `guard-aislamiento` dan 117/117.
  Nota: en `session-user.int.test.ts` la forma de `companyAddons` pasó a `arrayContaining` + `toHaveLength(5)`. Es un
  assert propio de QC-277: el adaptador no ordena, y es el mismo patrón que ya se usa para `permissions`.

### Re-T20 (suite E2E completa, base limpia, HEAD 66b493fa)
- `4 failed | 488 passed (28.3m)`:
  - `acceso-rediseno.spec.ts:319` R20 (chromium y webkit): heredado de dev;
  - `integraciones-proveedor-ia.spec.ts:211` (webkit): heredado de dev;
  - `marca-componentes.spec.ts:868` R39 (webkit, `locator.click` timeout): reintentado una vez → `2 passed`. Inestable.
- `acceso-rediseno.spec.ts:413` R8 (chromium), rojo en dev, esta vez pasó.
- Resultado: no hay rojos nuevos frente a dev. Las 13 llamadas a `enableAllAddons` valen con el cuerpo nuevo del helper.

### Re-T21 (`./init.sh` rápido): ROJO, desvío de clase nueva, parado
- related 888 archivos: `4 failed | 884 passed`; `Tests 5 failed | 14258 passed`. Rojos nuevos, fuera del baseline. Los
  cinco son listas cerradas de Prisma.dmmf en tests de OTRAS fichas, rotas por la relación inversa
  `User.addonOverridesCreated` (y el modelo `CompanyAddonOverride`) de design §2.2:
  - `tests/unit/identity/credential-policy-contract.test.ts` (QC-19 R21): los campos de `User` ganan `addonOverridesCreated`;
  - `tests/unit/proveedores/module-contract.test.ts` R22 (2 casos): `CompanyAddonOverride` entre los modelos relacionados
    con `User`;
  - `tests/unit/identity/schema/account-status-schema.test.ts`: «User NO gana ninguna relación nueva»;
  - `tests/unit/identity/schema/identity-schema.test.ts` R12: lista de modelos.
- No están en design §10.3. Precedente: QC-162 (c3e02f15) amplió esas mismas listas con `companyEvents`/`CompanyEvent`.
- No se ha tocado nada. Falta decidir entre:
  - A) ampliar las 5 listas con `addonOverridesCreated` / `CompanyAddonOverride`, como QC-162, y añadirlo a §10.3 y a
    Archivos esperados;
  - B) quitar la relación `author` de Prisma y dejar `createdBy` como escalar con la FK solo en SQL, como
    `accountStatusChangedBy` (drift declarado). Se aparta de design §2.2.
- El mapa R1–R38 queda pendiente de cerrar T21. Filas que cambian con el Bloque H:
  - R2: + `tests/guards/guard-catalogo-de-anadidos.test.ts` + `company-addons.int.test.ts` (tabla = ADDONS, FK 23503);
  - R5, R24, R29, R31, R33, R34: `company-addons.int.test.ts` sobre excepciones;
  - R6, R38: `company-addons-migration.test.ts` reescrito;
  - R7: seed unitario + `identity-seed.int.test.ts` (5 filas, sin autor; `platform-only` sin filas);
  - R8, R9: `session-user.int.test.ts` (prendidas, misma llamada al lector, apagadas no salen);
  - R20: `landing.test.ts`;
  - R37: `architecture-doc.test.ts` + `guard-empresa-en-esquema.test.ts` (D13, D15).

### Re-T21 cerrado: opción A (decisión del humano, 2026-10-15)
- Las 5 listas cerradas de Prisma.dmmf ganan solo `addonOverridesCreated` / `CompanyAddonOverride`, con su comentario
  RETENSADO y la igualdad exacta intacta. Enmienda en `design.md > 10.3`, punto 9; los 4 archivos están en
  `tasks.md > Archivos esperados`.
- Los 4 archivos: `Test Files 4 passed (4)`, `Tests 55 passed (55)`.
- `./init.sh` rápido: related `Test Files 888 passed (888)`, `Tests 14263 passed | 59 skipped`; test:rapido
  `118 passed (118)`, `Tests 1649 passed | 37 skipped`; `== init OK ==`. No salió ningún inestable conocido.

### Mapa R1–R38 → test (consolidado tras el Bloque H, implementer, 2026-10-15)
Reemplaza al mapa de antes del Bloque H.

| R | Test |
|---|---|
| R1, R3 | `tests/unit/identity/addons/company-addons.test.ts` |
| R2 | `company-addons.test.ts` + `tests/guards/guard-catalogo-de-anadidos.test.ts` (código = tabla) + `tests/integration/identity/company-addons.int.test.ts` (tabla `addons` = `ADDONS`; clave desconocida → FK 23503) |
| R4 | `company-addons.test.ts` + `tests/unit/documentos/run-document-job-addon.test.ts` + `company-addons.int.test.ts` + E2E caso 5 |
| R5 | `company-addons.int.test.ts` (alta con `createWithAdministrator` → cero excepciones) |
| R6, R38 | `tests/unit/identity/schema/company-addons-migration.test.ts` (reescrito: dos tablas, siembra, RLS, `down.sql`) |
| R7 | `tests/unit/identity/seed/seed-initial-access.test.ts` + `tests/integration/identity/identity-seed.int.test.ts` (5 filas `enabled = true`, sin autor; `platform-only` sin filas) |
| R8 | `tests/unit/identity/resolve-session.test.ts` + `tests/integration/identity/session-user.int.test.ts` (prendidas en la misma llamada al lector; el contador no sube) |
| R9 | `session-user.int.test.ts` (las apagadas no salen) + `company-addons.int.test.ts` + E2E casos 4 y 5 |
| R10, R11 | `resolve-session.test.ts` + `session-user.int.test.ts` |
| R12 | `tests/unit/identity/addons/menu-recortado.test.ts` + E2E caso 1 |
| R13 | `tests/unit/identity/require-page-addon.test.ts` + `tests/guards/guard-pantallas-de-anadido.test.ts` + E2E caso 2 |
| R14, R16 | `tests/unit/inventario/importar/inventory-import-addon.test.ts` + `importar-page.test.tsx` + `tests/unit/inventario/product-page.test.tsx` |
| R14, R15, R23 | `tests/unit/documentos/import-addon.test.ts` + `formula-import-page.test.tsx` + `catalog-import-page.test.tsx` + `formulas-upload.test.tsx` + `supplier-detail-upload.test.tsx` + `guard-pantallas-de-anadido.test.ts` |
| R17 | `menu-recortado.test.ts` + `tests/unit/asignaciones-ui/assigned-orders-route-contract.test.ts` |
| R18 | `tests/unit/identity/home-route.test.ts` + `app-sidebar.test.tsx` + `sidebar-carril.test.ts` + `sidebar-desktop.test.tsx` + E2E casos 1 y 4 |
| R19, R21 | `home-route.test.ts` + `route-guard-middleware.test.ts` + E2E caso 3 |
| R20 | `tests/unit/identity/login-action.test.ts` + `tests/unit/e2e-helpers/landing.test.ts` (lee `company.addonOverrides`) + E2E caso 1 |
| R22 | `run-document-job-addon.test.ts` + `documentos-facade.test.ts` + `company-addons.int.test.ts` |
| R24 | `company-addons.int.test.ts` (apagar los cinco no toca datos) |
| R25 | `tests/integration/identity/company-directory-addons.int.test.ts` |
| R26 | `tests/guards/guard-rutas-fuera-de-sesion.test.ts` |
| R27 | `get-company-addons.test.ts` + `company-actions.test.ts` |
| R28 | `set-company-addon.test.ts` + `company-actions.test.ts` + `company-addons.int.test.ts` (apagar → `enabled = false`, autor = actor) |
| R29 | `set-all-company-addons.test.ts` + `company-actions.test.ts` + `company-addons.int.test.ts` (cinco filas y cinco eventos; un fallo deshace todo) |
| R30, R31, R32 | los tres unitarios de `companies/` + `company-actions.test.ts` + `company-addons.int.test.ts` (R31: empresa de baja) |
| R33, R34 | `company-addons.int.test.ts` (upsert por cambio, autor e instante, sin cambios no escribe) + `company-event.test.ts` + `list-company-events.test.ts` + `company-actions.test.ts` |
| R35 | suma de R8, R12–R16 y R22 + `sin-decision-en-cliente.test.ts` |
| R36 | `e2e/modulos-por-empresa.spec.ts` (10/10 en chromium y webkit, sobre excepciones) |
| R37 | `tests/unit/identity/addons/architecture-doc.test.ts` + `tests/guards/guard-empresa-en-esquema.test.ts` (`addons` exenta; `company_addon_overrides` tabla de empresa) |

P2–P5 siguen con el defecto aplicado (ver «Preguntas abiertas con el defecto aplicado»). Para P2, el R6 ahora es el
INSERT de excepciones de la migración. Para P6 y P7 también se aplica el defecto: P6 es la relación en el mismo
`findFirst` (R8); P7 es `created_by` NULL en lo sembrado (R6, R7).

**Veredicto:** Bloque H y re-T20/T21 cerrados.

## F2.3 — sincronización con dev tras review APROBADO (implementer, 2026-10-15)

- **Qué trajo dev** (`git merge origin/dev`, 132 commits): QC-281, QC-282, QC-283, QC-284, QC-209, QC-262/195 y
  `perf(identity): sesion en una sola sentencia SQL`. Migraciones nuevas hasta `20261015130000_order_delivery_lines_customer`.
  QC-203, QC-271 y QC-275 (choques aceptados) **no** están aún en dev.
- **Conflictos (2, triviales):**
  - `session-user-prisma.ts`: dev pasó la lectura a un único `$queryRaw`. `companyAddons` entra como
    `ARRAY(SELECT o.addon_key FROM company_addon_overrides o WHERE o.company_id = u.company_id AND o.enabled)` en esa misma
    sentencia (sin empresa da `[]`). El párrafo de QC-277 del docblock queda en 3 líneas (m2).
  - `guard-identificador-de-request.test.ts`: altas de ambos lados conservadas; la migración de QC-277 al final de
    `MIGRACIONES_ESPERADAS` con el nombre nuevo.
- **Cortes de añadido:** dev no añade pantallas, rutas ni Server Actions nuevas en zonas de añadido. Solo cambia
  componentes dentro de pantallas ya cortadas (`dashboard/recorrido`, guía de `inventario/importar` de QC-209, cuyos
  enlaces van a catálogos del núcleo). No hay nada nuevo que cortar.
- **m5:** `db/migrations/20261014190000_company_addons` → `20261015190000_company_addons` (`git mv`). Actualizados:
  `guard-identificador-de-request`, `recipe-route-contract` (`MIGRACION_QC277`), `design.md`, `tasks.md`. El test de la
  migración la busca por patrón (`^\d{14}_company_addons$`), así que no cambia.
  Bases recreadas: `qct_tpl_c291773e75d6` borrada (se reconstruye por huella); `quimicloude_e2e_qc277` DROP +
  `db:migrate` + `db:seed` (última migración `20261015190000_company_addons`, 5 excepciones). `QuimiCloude` no la tenía.
- **m2** hecho en la resolución. **m3:** caso nuevo en `session-user.int.test.ts`, «QC-277 R8: con dos empresas, cada usuario
  trae solo los añadidos prendidos de la suya». El caso «QC-277 R8, R9: … en la misma llamada al lector» espiaba
  `prisma.user.findFirst`, que ya no se llama tras el `$queryRaw`. Ahora mide **1 sentencia SQL** con `medir()` y comprueba que
  esa sentencia lee `company_addon_overrides`. Es más estricto que antes, no se relaja nada. Resultado: `Test Files 1 passed (1) Tests 20 passed (20)`;
  añadidos/seed `.int`: `3 passed, 53 passed`; `guard-aislamiento-integracion`: `6 passed`.
- **m1, m4:** como deuda D59 y D60 en `progress/deudas.md`.
- **Gate** `./init.sh` (rápido) → `== init OK ==`. related: `Test Files 902 passed (902)  Tests 14827 passed | 59 skipped`.
  Guardias: `Test Files 118 passed (118)  Tests 1660 passed | 37 skipped`. Lint: 0 errores, 7 avisos previos. Sin inestables.
- **E2E** `pnpm exec playwright test e2e/modulos-por-empresa.spec.ts` (base `quimicloude_e2e_qc277`, chromium + webkit):
  `10 passed (34.1s)`.
