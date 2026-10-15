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
