# QC-225 — detalle-de-producto-terminado · bitácora del implementer

## Tanda 1 (2026-10-13): T0, B1, B2, B3

Las cuatro tareas están marcadas `[x]` en `tasks.md`. Todas las hizo `backend_dev`.

Commits:
- `2d751f59` T0: contrato publicado. También cierra P1 en `requirements.md`: sale de «Preguntas
  abiertas» y entra una fila fechada en «Decisiones cerradas».
- `8822bc4c` B3: cuerpos de los casos de uso.
- `d8e05b02` B1: adaptador Prisma de lectura de `inventario`.
- `033a86a2` B2: directorio de entregas de `pedidos`.

### Archivos

Creados:
- `lib/modules/inventario/domain/finished-product-detail.ts`
- `lib/modules/inventario/domain/get-finished-product.ts`
- `lib/modules/inventario/domain/list-finished-product-batches.ts`
- `lib/modules/inventario/domain/list-finished-product-movements.ts`
- `lib/modules/inventario/domain/list-finished-product-deliveries.ts`
- `lib/modules/inventario/domain/list-finished-product-costs.ts`
- `lib/modules/inventario/domain/list-produced-products.ts`
- `lib/modules/inventario/ports/finished-product-detail-repository.ts`
- `lib/modules/inventario/adapters/driven/persistence/finished-product-detail-prisma.ts`
- `lib/modules/inventario/adapters/driving/finished-product-actions.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-delivery-directory-prisma.ts`
- `tests/fixtures/finished-product-detail.ts`
- Tests unitarios en `tests/unit/inventario/`:
  - `finished-product-detail.test.ts`
  - `get-finished-product.test.ts`
  - `list-finished-product-batches.test.ts`
  - `list-finished-product-movements.test.ts`
  - `list-finished-product-deliveries.test.ts`
  - `list-finished-product-costs.test.ts`
  - `list-produced-products.test.ts`
  - `finished-product-actions.test.ts`
- `tests/integration/inventario/finished-product-detail.int.test.ts` (13 casos)
- `tests/integration/pedidos/order-delivery-directory.int.test.ts` (10 casos)

Modificados:
- `lib/modules/inventario/index.ts`
- `lib/composition/index.ts`: seis claves nuevas en la fachada `inventario`, el adaptador real y
  `finishedDeliveryDirectory` real.
- `lib/shared/routes.ts`: añade `finishedProductDetailRoute`.
- `tests/unit/inventario/schema/inventario-schema.test.ts`: el censo de factorías pasa de 18 a 24.
- `tests/unit/identity/session-once-per-request-actions.test.ts`: fila nueva. Entró en T0 y no en
  B3, porque el censo compara contra el disco.
- `tests/unit/pedidos/module-contract.test.ts`: `DUENOS_DEL_CLIENTE` gana el adaptador de B2. **No
  estaba en «Archivos esperados»**; se añadió allí con fecha.
- `tests/integration/aislamiento.json`: las dos suites nuevas, en modo `commit`, porque los
  adaptadores leen con el cliente global.

### Mapa R<n> → test (lo cubierto en esta tanda; el mapa completo se cierra en TZ)

| R | Test |
|---|---|
| R2, R3 | `tests/unit/inventario/{get-finished-product,list-finished-product-*,list-produced-products}.test.ts`; `finished-product-actions.test.ts` |
| R4 | `list-finished-product-deliveries.test.ts`, `list-finished-product-costs.test.ts` |
| R5 | los unitarios de los casos de uso; `finished-product-detail.int.test.ts` (`findAliveFinished`) |
| R10 | `get-finished-product.test.ts` |
| R11, R12 | `finished-product-detail.test.ts` (`summarizeFinishedStock`), `get-finished-product.test.ts` |
| R13, R14 | `list-finished-product-batches.test.ts`, `finished-product-detail.int.test.ts` |
| R15–R18 | `list-finished-product-movements.test.ts`, `finished-product-detail.int.test.ts` |
| R19 | `list-finished-product-deliveries.test.ts`, `finished-product-detail.int.test.ts`, `order-delivery-directory.int.test.ts` |
| R20 | `list-finished-product-deliveries.test.ts` |
| R21, R22 | `finished-product-detail.test.ts` (`productionCostTotal`), `list-finished-product-costs.test.ts`, `finished-product-detail.int.test.ts` |
| R23 | los unitarios de los listados, `finished-product-detail.int.test.ts` |
| R25 | `finished-product-detail.int.test.ts`, `order-delivery-directory.int.test.ts`, `finished-product-actions.test.ts` |
| R27, R28 | `list-produced-products.test.ts`, `finished-product-detail.int.test.ts` |
| R33 | `list-finished-product-deliveries.test.ts`, `order-delivery-directory.int.test.ts` |
| R34 | `list-finished-product-deliveries.test.ts`, `order-delivery-directory.int.test.ts` |
| R35 | `list-finished-product-movements.test.ts`, `finished-product-detail.int.test.ts` |
| R36 | `list-finished-product-deliveries.test.ts` (backend; la UI va en F) |

Pendientes de F/TI: R1, R6–R9, R24, R26, R29–R31. La parte de UI de R33–R36 también queda para F.

### Salida de la verificación

Typecheck y lint:
- `pnpm run typecheck`: exit 0. Antes, T0 tuvo que correr `pnpm exec prisma generate`, porque el
  cliente del worktree no estaba al día con las tablas de QC-224.
- `pnpm exec eslint <archivos tocados>`: sin avisos.

Unitarios (los doce archivos de la tanda, en una sola corrida), con sus censos:
```
 Test Files  12 passed (12)
      Tests  229 passed (229)
```

Guardias, `pnpm exec vitest run guard`:
```
 Test Files  75 passed (75)
      Tests  1050 passed | 20 skipped (1070)
```

Integración, cada suite contra su copia efímera `qct_qc225_…`, sacada de la plantilla
`qct_tpl_7c42b3e164a6`. Al servidor se llegó vía `qc225_detalle_producto` en `localhost`; nunca se
usó `QuimiCloude`. Ningún `.env` escrito.
- `finished-product-detail.int.test.ts`: 13 passed.
- `order-delivery-directory.int.test.ts`: 10 passed.

Otros censos corridos y en verde, sin cambios:
- `inventario/{module-contract,qc81-alcance,qc91-alcance,qc121-alcance,qc171-alcance,authorization,company-scope,movement-reason,qc195-contrato-tipos}`
- `clientes/scope`
- `pedidos/{company-scope,order-delivery-append-only}`
- `tests/unit/composition`

### Decisiones a validar

- **Entregas (B3).** Design 2.3 pide un solo `Promise.all` con la página y `summarizeDelivered`, y
  también no llamar con `total === 0`. Las dos cosas no se pueden cumplir a la vez. Se lee primero
  la página y después, en paralelo, `summarizeDelivered`, `findDeliveryDetails` y los números de
  pedido. Los clientes van al final.
- **Orden de validación de los listados.** Permiso → uuid → `findAliveFinished` → esquema de
  página. Una página inválida sobre un producto inexistente responde `product_not_found`.
- **`listProducedProducts`.** Omite el par (pedido, presentación) que tiene más de un producto y
  junta los duplicados. Con más de 25 ids responde `invalid_input`.
- **Adaptador B1.**
  - Sus funciones se nombran distinto que los métodos del puerto; se mapean en `composition`.
  - `listProductionCosts` ordena por el `createdAt` del asiento `production`.
  - El origen de cada lote se lee con `take 1` sin `orderBy`; se apoya en que hay un asiento
    `production` por lote.
- **Formato (T0).**
  - `total` y `withoutPackage` salen con 4 decimales; los restos, sin ceros a la derecha.
  - Un lote con contenido 0 cuenta como «sin envase».
- **Nombres de tests sin R en `tasks.md`.**
  - «más de 25 ids» va como R27;
  - «lee la sesión una vez» va como R25.
- **Sin hacer.** No se corrió el `EXPLAIN` de `inventory_movements` (design §3).

## Tanda 2 (2026-10-13): pendientes del spec, EXPLAIN, F1–F4

F1–F4 marcadas `[x]` en `tasks.md`. Las hizo `frontend_dev`; el `EXPLAIN` lo corrió `backend_dev`.

Commits:
- `1ebb2170` design §2.3: describe el orden que implementó B3 (página primero; luego
  `summarizeDelivered`, `findDeliveryDetails` y números de pedido en paralelo; luego clientes; sin
  `summarizeDelivered` con `total === 0`), con nota fechada. Decisión del leader.
- `23944774` F1: ruta, página, tabs y estados.
- `337c5aa0` F2: tablas de los cinco listados.
- `f34f8bb7` F3: enlace desde /inventario.
- `012f6b8d` F4: enlace desde /pedidos.
- `3d7627ed` F3: anillo de foco opaco en el enlace (`guard-anillo-de-foco` lo pedía; F4 llevaba el mismo arreglo antes de su commit).
- el siguiente: esta bitácora y `tasks.md` (F1–F4 `[x]`, cuatro archivos añadidos a «Archivos esperados»).

### EXPLAIN de `inventory_movements` (design §3)

- Base: `qct_qc225_e2ae854a_mv70ttv4_ecw`, copia de la plantilla `qct_tpl_7c42b3e164a6` con
  `createRunDatabase` de `tests/helpers/test-database.ts`; borrada con `destroyRunDatabase`
  (`db:test list`: 0 bases `qct_qc225%`). Nunca `QuimiCloude`, preview ni producción. Sin `.env`.
- Rol: `postgres` (el del arnés). **Corrección a la tanda 1:** el rol `qc225_detalle_producto` no
  existe en localhost. Al ser superusuario se salta RLS: los planes no llevan los filtros de política.
- Volumen sintético (la plantilla no tiene movimientos): 2 empresas, 2.000 productos, 10.000 lotes,
  200.000 movimientos, `ANALYZE`.
- SQL: el que genera Prisma de verdad (log `query` del adaptador), con `EXPLAIN (ANALYZE, BUFFERS)`,
  con `enable_seqscan` on y off.

| Consulta (`finished-product-detail-prisma.ts`) | Plan | ms (on/off) |
|---|---|---|
| movimientos `in`, página y count | Nested Loop: `product_batches_product_id_idx` → Bitmap `inventory_movements_batch_id_idx` | 0.63/0.46, 0.45/0.41 |
| movimientos `out`, página y count | igual, top-N heapsort | 0.53/0.45, 0.38/0.46 |
| entregas, página y count | igual | 0.47/0.41, 0.42/0.39 |
| costos, página y count | igual; `kind='production'` filtra en heap | 0.39/0.36, 0.37/0.38 |
| `findProducedFinishedProducts` (25 pedidos) | Bitmap `inventory_movements_order_id_idx` → `product_batches_id_company_id_key` → `products_pkey` | 3.1/0.63 |
| origen del lote (lotes) | Prisma no empuja `take 1`: una consulta `batch_id IN (…)`; Bitmap `inventory_movements_batch_id_idx` | 1.9/0.29 |
| página y count de lotes | Bitmap `product_batches_product_id_idx` | 0.94, 0.10 |

Ningún barrido secuencial, ni con `enable_seqscan` encendido. Sin hallazgo; sin migración (R32).

### Archivos (tanda 2)

Creados: la ruta `app/(private)/inventario/producto-terminado/[id]/` (`page.tsx` y `components/`:
`index.ts`, `finished-product-{not-found,header,tabs,general,stock,list-section,batches-table,movements-table,deliveries-table,costs-table}.tsx`,
`finished-product-params.ts`); `app/(private)/pedidos/components/order-produced-presentations.tsx`;
tests `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts`,
`tests/unit/inventario-ui/finished-product-{page,tabs,tables}.test.tsx`,
`tests/unit/inventario-ui/finished-product-params.test.ts`,
`tests/unit/pedidos-ui/order-produced-presentations.test.tsx`,
`tests/unit/pedidos-ui/order-list-section-produced.test.tsx`.

Modificados: `app/(private)/inventario/components/finished-stock-columns.tsx`;
`app/(private)/pedidos/components/{order-columns,order-table,order-list-section}.tsx` e `index.ts`;
`tests/unit/inventario/{product-route-contract,finished-stock-table}.test.*`;
`tests/guards/guard-pantallas-exigen-permiso.test.ts` (25 → 26);
`tests/unit/pedidos-ui/order-columns.test.tsx`.

**Fuera de la lista original, añadidos a «Archivos esperados» con fecha:**
`tests/unit/pedidos-ui/{order-list-section,pedidos-viewport,order-sheet}.test.tsx` y
`tests/unit/paridad/pedidos-paridad.test.tsx`. Sustituyen `@/lib/composition` sin `observabilidad`
y fallaban al importar la sección de /pedidos, que ahora importa `listProducedProductsAction`.
Reciben el doble de esa action, como ya tenían el de `work-group-actions`. Ninguna aserción cambia.

### Mapa R<n> → test (tanda 2)

| R | Test |
|---|---|
| R1 | `finished-product-route-contract.test.ts` (primera línea); `finished-product-page.test.tsx` |
| R6 | `finished-product-page.test.tsx` |
| R7, R36 | `finished-product-route-contract.test.ts`; R36 también en `finished-product-tables.test.tsx` |
| R8 | `finished-product-tabs.test.tsx`, `finished-product-page.test.tsx` |
| R9 | `finished-product-tabs.test.tsx`, `finished-product-params.test.ts` |
| R10–R12 | `finished-product-page.test.tsx` |
| R13, R15–R17, R19–R21, R23, R24, R33–R35 | `finished-product-tables.test.tsx` |
| R26 | `finished-stock-table.test.tsx` |
| R27, R28 | `order-produced-presentations.test.tsx`, `order-columns.test.tsx`, `order-list-section-produced.test.tsx` |
| R29 | `order-list-section-produced.test.tsx` |
| R30 | `finished-product-route-contract.test.ts` |

Pendientes de TI: R31 (E2E) y el recorrido de R26/R27.

### Salida de la verificación (la reportada por los subagentes)

- `pnpm run typecheck`: sin errores tras F1, F2 y F4.
- `pnpm exec eslint <archivos tocados>`: sin salida.
- F1 (4 tests + `product-route-contract` + `guard-pantallas-exigen-permiso`): `Test Files 6 passed (6) / Tests 58 passed (58)`.
- F2 `finished-product-tables.test.tsx`: `Test Files 1 passed (1) / Tests 17 passed (17)`.
- F1 + listas cerradas (`importar-route-contract`, `inventario/scope`, `clientes/scope`,
  `data-table-alcance`, `migracion-listas-alcance`, `marca/tablas-marca`,
  `navegacion/pantallas-exigen-permiso`): `Test Files 12 passed (12) / Tests 178 passed | 2 skipped (180)`.
- F3 + `product-route-contract`: `Test Files 2 passed (2) / Tests 41 passed (41)`; listas cerradas de
  inventario (`product-page`, `qc81/qc91/qc121-alcance`, `decimal-quantity-convenciones`,
  `guard-piezas-base`, `guard-qc102-limites-de-la-ficha`…): `Test Files 8 passed (8) / Tests 223 passed | 9 skipped (232)`.
- F4: los 3 tests, los 4 arreglados y `tests/unit/paridad/`: `Test Files 28 passed (28) / Tests 552 passed (552)`.
- F4, regresión (`pedidos-convenciones`, `order-route-contract`, `order-table`, `order-list-skeleton`,
  `read-only`, `a11y-tactil`, `pedidos/module-contract`, `qc146-alcance`, `clientes/scope`,
  `shared/data-table-alcance`, `finished-orders-list-section`, `session-once-per-request-render`,
  `tablas-marca`): `Test Files 13 passed (13) / Tests 220 passed | 5 skipped (225)`.
- `pnpm exec vitest run guard`, tras `3d7627ed`: `Test Files 75 passed (75) / Tests 1050 passed | 20 skipped (1070)`.
  Antes de ese arreglo: 1 rojo, `guard-anillo-de-foco` sobre `finished-stock-columns.tsx:170` (F3).

### Decisiones a validar (tanda 2)

- Tabs con `UrlTabs` del catálogo (enlaces `?tab=` sin `page`) en vez de un `Tabs` cliente que navega.
- Etiquetas de motivo de ajuste: se resuelven en la sección (servidor) y bajan como mapa a la tabla
  cliente, para no meter el barrel de /inventario en el bundle cliente.
- Helpers compartidos de la ruta viven en `finished-product-params.ts` y `finished-product-stock.tsx`
  para no añadir archivos.
- `DataTable` no pone test id en la fila: `finished-product-*-row` y `data-voided` van en la primera celda.
- La imagen sale en la cabecera (miniatura) y en General.
- F4: «+N» es un `Popover` con `Button ghost sm touch`; el filtro `TERMINADO`/`ENTREGADO` se aplica
  en la sección (a quién se pregunta) y en las columnas (R28 aunque llegue el mapa).
- `OrderProducedPresentations` no cita tablero `/design`: solo compone piezas catalogadas
  (`Popover`, `Button`, `Link`, `OrderDistributionLabel`), pero añade enlaces visibles. Que lo
  confirme el reviewer.
- Comentario «Los TRES lotes» de `order-list-section.tsx` ya estaba desactualizado; no se tocó.

## Tanda 3 (2026-10-13): TC, TI y TZ

TC, TI y TZ marcadas `[x]` en `tasks.md`. Las ediciones las hizo `frontend_dev` (tres pasadas); la
verificación y los commits, el implementer. Por memoria baja, ni `./init.sh` ni la suite entera: el
gate completo lo corre CI.

Commits:
- `7d9dac70` TC: censos cerrados `inventario/scope` (excluye por nombre `order-produced-presentations.tsx`,
  que casa con el barrido por «presentation» sin ser pantalla de catálogo; defensa: existe y no lleva
  `ProductListSection`/`product-table`) y `recetas-ui/recipe-route-contract` (+ `finishedProductDetailRoute`
  en la lista exacta de exportaciones de `routes.ts`).
- `64ce1a3a` fix: el E2E destapó que la página caía para todos (también para el usuario sin permiso):
  `finished-product-list-section.tsx` (servidor) llamaba al cargar a `movementReasonLabel`, definida en
  `batch-history.tsx` (`'use client'`). Error de Next: «Attempted to call movementReasonLabel() from the
  server but movementReasonLabel is on the client». La función pura pasa a
  `app/(private)/inventario/components/movement-reason-label.ts` (sin directiva), mismo nombre y salida;
  el barrel la exporta de ahí. Regresión en `finished-product-route-contract.test.ts` (dos casos R16).
  Ningún test unitario lo cazaba: los de la página mockean el barrel. Entró en `337c5aa0` (F2).
- `de9a371a` TI: `e2e/detalle-de-producto-terminado.spec.ts` y listas cerradas de E2E
  (`guard-identificador-de-request > E2E_ESPERADOS`, `inventario/scope > e2eMatches`,
  `clientes/scope > E2E_PERMITIDOS`, `shared/data-table-alcance`, 41 → 42).
- el siguiente: esta bitácora y `tasks.md` (TZ).

**Fuera de «Archivos esperados», añadidos con fecha y motivo:** `tests/unit/inventario/scope.test.ts`,
`tests/unit/recetas-ui/recipe-route-contract.test.ts`, `tests/unit/clientes/scope.test.ts`,
`tests/unit/shared/data-table-alcance.test.ts` y, de producción,
`app/(private)/inventario/components/{movement-reason-label.ts,batch-history.tsx,adjust-batch-dialog.tsx,index.ts}`.

### TC: tabla de `design.md > 7`, fila a fila

| Fila | Estado |
|---|---|
| `inventario-schema` (24 factorías), `product-route-contract`, `finished-product-route-contract`, `guard-pantallas-exigen-permiso` (26), `session-once-per-request-actions`, `aislamiento.json`, `company-scope` | hechas en T0/B/F; verdes en `vitest related` y en `vitest run guard` |
| `guard-identificador-de-request > E2E_ESPERADOS` | hecha en TI |
| `guard-arquitectura-modulos` (sin ciclo `inventario → clientes`) | sin cambio, verde |
| `guard-pantalla-pedidos-se-amplia` | sin cambio, verde |
| `guard-dependencias-aprobadas` | sin cambio, verde; `package.json` y `pnpm-lock.yaml` sin diff vs `origin/dev` |
| `MIGRACIONES_ESPERADAS` (R32) | sin cambio: `guard-identificador-de-request.test.ts` solo cambia en `E2E_ESPERADOS`; `db/` y `prisma/` sin diff vs `origin/dev` |

Censos que `vitest related` no relaciona, corridos aparte: `clientes/scope`, `shared/data-table-alcance`,
`guard-piezas-base`, `pedidos-ui/pedidos-convenciones`, `pedidos/module-contract`, `inventario/scope`
(no hay otros `scope*` en inventario), `guard-identificador-de-request`, `guard-e2e-fixture-user`.

### Salida de la verificación (tanda 3)

- `pnpm run typecheck`: limpio al final de TC y en TZ (en TZ con `NODE_OPTIONS=--max-old-space-size=4096`;
  sin él `tsc` se quedó una vez sin memoria en la pasada de `frontend_dev`).
- `pnpm exec eslint` sobre los archivos del diff vs `origin/dev` y los tocados en esta tanda: sin hallazgos.
- Tests del diff, directo: `Test Files 26 passed (26) / Tests 459 passed (459)`.
- `vitest related --run` (proyectos `ui` y `node`) sobre `lib/` del diff:
  `Test Files 2 failed | 502 passed (504) / Tests 2 failed | 8654 passed | 52 skipped (8708)`, 1478 s.
  Los dos rojos: `inventario/scope.test.ts:247` y `recetas-ui/recipe-route-contract.test.ts:1339`
  (ninguno en `baseline-rojos.json`); arreglados en `7d9dac70`.
- `vitest related --run` sobre `app/` del diff: `Test Files 82 passed (82) / Tests 1500 passed (1500)`.
- Tras `7d9dac70`, los dos rojos y los censos de arriba: `Test Files 9 passed (9) / Tests 159 passed | 6 skipped (165)`.
- Tras el fix (frontend_dev): batch-history, finished-product-route-contract, product-route-contract,
  finished-product-tables, finished-product-page, inventario/scope, adjust-batch-dialog,
  product-batches-sheet, stock-adjustment, decimal-quantity-convenciones: `Test Files 10 passed (10) / Tests 153 passed (153)`.
- Tras TI, listas cerradas de E2E y contrato de la ruta: `Test Files 7 passed (7) / Tests 102 passed | 2 skipped (104)`.
  `frontend_dev` corrió además las otras listas que miran `e2e/` (scope de pedidos, proveedores y recetas,
  grupos/alcance, catalogo-sin-total-fijo, unidades-convenciones, guard-editor-aislado,
  guard-e2e-presupuesto, guard-e2e-landing, guard-e2e-sin-saltos, guard-dobles-e2e): todas verdes.
- `pnpm exec vitest run guard` (TC, tras el fix y en TZ): `Test Files 75 passed (75) / Tests 1050 passed | 20 skipped (1070)`.

### E2E (`pnpm exec playwright test e2e/detalle-de-producto-terminado.spec.ts --project <p> --workers=1`)

Base: `qct_qc225_e2ae854a_mv754018_bvg`, copia de la plantilla `qct_tpl_7c42b3e164a6` con
`createRunDatabase`; borrada con `destroyRunDatabase` al terminar. `DATABASE_URL`/`DIRECT_URL` a esa base
y `SESSION_SECRET` aleatorio en el entorno del comando. Nunca `QuimiCloude`, preview ni producción.

Antes del fix, chromium: `2 failed` (la página no pintaba `finished-product-name`). Después:

```
✓  1 [chromium] › e2e\detalle-de-producto-terminado.spec.ts:476:7 › ficha de producto terminado › R31, R27, R26: tras una entrega parcial, la ficha abierta desde /pedidos y desde /inventario muestra lote, produccion, salida y entrega (18.4s)
✓  2 [chromium] › e2e\detalle-de-producto-terminado.spec.ts:555:7 › ficha de producto terminado › R31, R1: un usuario sin inventario.consultar que abre la ficha recibe el 404 (2.9s)
2 passed (34.3s)
✓  1 [webkit] › e2e\detalle-de-producto-terminado.spec.ts:476:7 › ficha de producto terminado › R31, R27, R26: tras una entrega parcial, la ficha abierta desde /pedidos y desde /inventario muestra lote, produccion, salida y entrega (36.9s)
✓  2 [webkit] › e2e\detalle-de-producto-terminado.spec.ts:555:7 › ficha de producto terminado › R31, R1: un usuario sin inventario.consultar que abre la ficha recibe el 404 (4.7s)
2 passed (49.3s)
```

El spec siembra por Prisma el pedido `TERMINADO`, sus lotes y el asiento `production` (como la
preparación de `entregar-producto-terminado.spec.ts`); la entrega parcial va por la UI de /pedidos. El
usuario sin permiso tiene un rol efímero sin permisos (como `ejecucion-receta.spec.ts`), creado con
`createFixtureUser`.

### Mapa R<n> → test completo (TZ)

Rutas: **u** `tests/unit/inventario/`, **ui** `tests/unit/inventario-ui/`, **pui** `tests/unit/pedidos-ui/`,
**int** `tests/integration/`, **e2e** `e2e/detalle-de-producto-terminado.spec.ts`. Caso por su prefijo.

| R | Test (archivo › caso) |
|---|---|
| R1 | u `producto-terminado/finished-product-route-contract.test.ts` › «R1 — requirePagePermission('inventario.consultar') es la primera linea de la pagina»; ui `finished-product-page.test.tsx` › «R1 — exige inventario.consultar antes de leer el producto»; e2e › «R31, R1: un usuario sin inventario.consultar que abre la ficha recibe el 404» |
| R2 | u `get-finished-product.test.ts`, `list-finished-product-{batches,movements,deliveries,costs}.test.ts`, `list-produced-products.test.ts` › «R2: sin inventario.consultar responde unauthorized … y no llama …»; u `finished-product-actions.test.ts` › «R2: traduce unauthorized a su ErrorState» |
| R3 | los seis tests de caso de uso › «R3: un actor de otro rol con el permiso es aceptado» y «R3: un Administrador sin inventario.consultar en su conjunto es rechazado» |
| R4 | u `list-finished-product-deliveries.test.ts` › «R4: con solo inventario.consultar, sin pedidos ni clientes, ve el cliente y el pedido …»; u `list-finished-product-costs.test.ts` › «R4: con solo inventario.consultar, sin recetas ni pedidos, ve el costo y el pedido» |
| R5 | u `get-finished-product.test.ts` › «R5: un id sin forma de uuid responde product_not_found sin consultar», «R5: si el repositorio no lo encuentra vivo …»; u `list-finished-product-*.test.ts` › «R5: …»; u `finished-product-actions.test.ts` › «R5: traduce product_not_found a su ErrorState»; int `inventario/finished-product-detail.int.test.ts` › «R5: devuelve null para un producto borrado, un insumo, uno de otra empresa y uno inexistente» |
| R6 | ui `finished-product-page.test.tsx` › «R6 — product_not_found pinta «no encontrado» …», «R6 — cualquier otro error pinta ErrorState …» |
| R7 | u `producto-terminado/finished-product-route-contract.test.ts` › «R7, R36 — ningun archivo de la ruta importa una Server Action de escritura …», «R7, R36 — la guardia de escritura muerde con una fuente fabricada» |
| R8 | ui `finished-product-tabs.test.tsx` › «R8 — siete tabs en este orden: General, Stock, Lotes, Entradas, Salidas, Entregas y Costo …»; ui `finished-product-page.test.tsx` › «R8 — el exito pinta el nombre del producto y las siete pestañas» |
| R9 | ui `finished-product-params.test.ts` › «R9 — un tab desconocido o ausente abre General», «R9 — page y pageSize que no son enteros validos caen al defecto», «R9 — el enlace de tab lleva el tab y no lleva pagina»; ui `finished-product-tabs.test.tsx` › casos R9 |
| R10 | u `get-finished-product.test.ts` › «R10: resuelve la unidad base y la de la presentacion en una sola llamada al catalogo»; ui `finished-product-page.test.tsx` › «R10 — General muestra nombre, imagen, presentacion …» |
| R11 | u `finished-product-detail.test.ts` › «R11, R12: suma el total exacto, agrupa por contenido ascendente …»; u `get-finished-product.test.ts` › «R11, R12: el stock sale de los lotes del registro …»; ui `finished-product-page.test.tsx` › «R11, R12 — Stock muestra el total en unidad base …»; int › «R5, R11: trae el producto vivo …» |
| R12 | u `finished-product-detail.test.ts` › «R12: restos exactos, sin coma flotante (0.1 + 0.2 da 0.3)», «R12: un resto que suma cero sale como null»; ui `finished-product-page.test.tsx` › «R12 — sin lotes sin envase no hay entrada «sin envase» …» |
| R13 | u `list-finished-product-batches.test.ts` › «R13: lista todos los lotes, el agotado y el sin pedido incluidos …»; ui `finished-product-tables.test.tsx` › «R13 — columnas de Lotes …», «R13 — un lote agotado sigue en la lista …»; int › «R13, R14: todos los lotes, agotado incluido …»; e2e › «R31, R27, R26: …» (Lotes) |
| R14 | u `list-finished-product-batches.test.ts` › «R14: un pedido sin numero en el directorio sale como null y la fila sigue»; int › «R13, R14: …» |
| R15 | u `list-finished-product-movements.test.ts` › casos R15; ui `finished-product-tables.test.tsx` › «R15, R16 — Entradas con su origen …»; int › «R15, R16, R35: in trae solo los asientos positivos …»; e2e › «R31, R27, R26: …» (Entradas) |
| R16 | ui `finished-product-tables.test.tsx` › «R16 — los motivos llegan con la etiqueta de /inventario»; u `producto-terminado/finished-product-route-contract.test.ts` › «R16 — la ruta solo llama desde el servidor a valores del barrel de /inventario que no vienen de un modulo de cliente», «R16 — la guardia de modulo de cliente muerde con fuentes fabricadas»; int › «R15, R16, R35: …» |
| R17 | ui `finished-product-tables.test.tsx` › «R17 — Salidas con la entrega y el ajuste que resta, cantidad sin signo»; int › «R17, R18, R35: out trae solo los negativos …»; e2e › «R31, R27, R26: …» (Salidas) |
| R18 | u `list-finished-product-movements.test.ts` › «R18: la direccion pedida llega tal cual al puerto, que clasifica por el signo»; int › «R18: ningun asiento sale en los dos lados» |
| R19 | int `inventario/…` › «R19: los asientos delivery traen su orderDeliveryId …»; int `pedidos/order-delivery-directory.int.test.ts` › «R19: trae el cliente de la entrega y los envases de cada uno de sus dos lotes»; ui › «R19, R20 — Entregas con cliente, pedido, lote, envases y cantidad …»; e2e › «R31, R27, R26: …» (Entregas) |
| R20 | u `list-finished-product-deliveries.test.ts` › «R20: un cliente dado de baja sale con su marca …», «R20: un cliente que no vuelve sale como null y la fila sigue»; ui › «R19, R20 — …» |
| R21 | u `finished-product-detail.test.ts` › «R21: redondea mitad arriba cuando el quinto decimal es 5»; ui › «R21 — Costo con lote, pedido, cantidad, envases, unitario y total»; int › «R21, R22: solo los lotes con asiento production …» |
| R22 | u `list-finished-product-costs.test.ts` › «R22: el total sale de unitCost x cantidad del registro, sin ningun puerto de recetas ni de costos»; int › «R21, R22: …» |
| R23 | u de cada listado › casos R23 (`invalid_input`); ui › «R23 — la paginacion navega cambiando page …»; int › «R23: orden createdAt desc e id desc, 10 por defecto, tope de 25 y total correcto» |
| R24 | ui `finished-product-tables.test.tsx` › «R24 — cada tab sin filas muestra su estado vacio propio, distinto del error», «R24 — cada tab en error muestra su estado de error, no el vacio» |
| R25 | int `inventario/…` › «R25: con el ambito de A, nada de B aparece en ningun metodo aunque se pase un id de B»; int `pedidos/…` › «R25: una entrega de B no vuelve con la empresa A aunque se pida su id» |
| R26 | u `finished-stock-table.test.tsx` › «R26: el nombre de cada sub-fila enlaza a la ficha de su producto y la fila de grupo no lleva enlace»; e2e › «R31, R27, R26: …» (vuelta desde /inventario) |
| R27 | u `list-produced-products.test.ts` › «R27: devuelve el enlace de cada presentacion producida por cada pedido …»; pui `order-produced-presentations.test.tsx` y `order-columns.test.tsx` › casos R27; int › «R27, R28: (pedido, presentacion, producto) por los asientos production …»; e2e › «R31, R27, R26: …» (enlace de /pedidos) |
| R28 | u `list-produced-products.test.ts` › «R28: un par pedido-presentacion con dos productos se omite …»; pui `order-produced-presentations.test.tsx`, `order-columns.test.tsx` › casos R28; int › «R27, R28: …» |
| R29 | pui `order-list-section-produced.test.tsx` › «R29: si la consulta de productos falla, la lista se pinta igual y sin enlaces», «R29: sin pedidos TERMINADO ni ENTREGADO en la página no se consultan …» |
| R30 | u `producto-terminado/finished-product-route-contract.test.ts` › «R30 — ningun archivo de la ruta incrusta la direccion de la ficha»; `tests/unit/recetas-ui/recipe-route-contract.test.ts` › «lib/shared/routes.ts no gana ninguna constante para el asistente y publica exactamente las de hoy» (el builder vive solo en `routes.ts`) |
| R31 | e2e › «R31, R27, R26: tras una entrega parcial, la ficha abierta desde /pedidos y desde /inventario muestra lote, produccion, salida y entrega»; «R31, R1: un usuario sin inventario.consultar que abre la ficha recibe el 404» |
| R32 | `tests/guards/guard-dependencias-aprobadas.test.ts` (sin cambio, verde); `tests/guards/guard-identificador-de-request.test.ts` (`MIGRACIONES_ESPERADAS` sin cambio, verde). Sin caso con «R32» en el nombre: son guardias existentes, como prevé `design.md > 10` |
| R33 | u `list-finished-product-deliveries.test.ts` › casos R33; int `pedidos/…` › «R33: en una entrega con dos presentaciones y una anulada, solo la linea anulada trae su motivo»; ui › «R33 — una fila anulada lleva «Anulada», su motivo y data-voided …» |
| R34 | u `list-finished-product-deliveries.test.ts` › casos R34; int `pedidos/…` › «R34: suma cantidad y envases solo de las lineas sin anulacion …», «R34: con todas las lineas de esos lotes anuladas el total es cero», «R34: con lotes vacios devuelve cero sin consultar»; ui › caso R34 (`finished-product-deliveries-total`) |
| R35 | u `list-finished-product-movements.test.ts` › caso R35; int › «R15, R16, R35: …», «R17, R18, R35: …»; ui › «R35 — Entradas etiqueta el delivery_void como «Anulación de entrega» con su pedido» |
| R36 | u `list-finished-product-deliveries.test.ts` › «R36: un actor con solo inventario.consultar recibe la anulacion y el total entregado»; ui › «R36 — ninguna fila de Entregas lleva un boton o enlace, tampoco para anular»; u `producto-terminado/finished-product-route-contract.test.ts` › «R7, R36 — …» |

Ningún `R<n>` queda sin test. R32 se cubre con guardias existentes, sin caso propio.

### Decisiones a validar (tanda 3)

- El fix de `movementReasonLabel` toca tres archivos de /inventario fuera de la ficha (mover una función
  pura; sin cambio de comportamiento). Alternativa descartada: duplicar las etiquetas en la ruta.
- `inventario/scope.test.ts` excluye `order-produced-presentations.tsx` por nombre en vez de afinar el
  barrido, como las exclusiones previas.
- Las notas fechadas de esta tanda en los censos describen la ficha en palabras, sin la clave. Las de
  tandas anteriores (`guard-pantallas-exigen-permiso:262`, `product-route-contract:111`,
  `aislamiento.json`) citan la clave del ticket, como el resto de notas de esos archivos; no se tocaron.
- `./init.sh` no se corrió (memoria baja, por indicación del leader): lo sustituyen los comandos de
  arriba; el gate completo queda para CI.
- `origin/dev` va 28 commits por delante de la rama; no se sincronizó (F2.3 la pide el leader).

## Tanda 4 (2026-10-13): correcciones de revisión

Revisión: `progress/review_QC-225-detalle-de-producto-terminado.md` (CHANGES_REQUIRED). M3 (pase
`/design`) no se toca: lo decide el humano, por el leader.

| Hallazgo | Arreglo | Archivos | Commit |
|---|---|---|---|
| M1 | El censo admite `count` (solo lee; pagina la ficha), con nota fechada; sigue cerrado | `tests/unit/inventario/schema/inventory-movements-migration.test.ts`; añadido a `tasks.md > Archivos esperados` y a `design.md §7` | `a2a3eb6a` |
| M2 | `VOIDED_DELIVERY_LABEL` → `DELIVERY_VOIDED_LABEL`; el censo no se toca. El patrón `NOMBRE_MUTANTE` sobre `app/` y `lib/` ya solo casa con `createVoidDelivery` y `voidDeliveryAction`, que el test permite | `app/(private)/inventario/producto-terminado/[id]/components/finished-product-deliveries-table.tsx`, `app/(private)/inventario/producto-terminado/[id]/components/index.ts` | `a4e9f060` |
| m1 | Notas sin clave de ficha; la fecha y la descripción en palabras se quedan | `tests/guards/guard-pantallas-exigen-permiso.test.ts`, `tests/unit/inventario/product-route-contract.test.ts` | `0b73a77b` |
| m2 | Rutas completas de `batch-history.tsx`, `adjust-batch-dialog.tsx` e `index.ts` | `specs/QC-225-detalle-de-producto-terminado/tasks.md` | `0bfddd97` |
| m3 | Enmiendas fechadas: P1 cerrada en la cabecera; nueva ubicación de `movementReasonLabel` (tabla de lo que existe y §6.2); `UrlTabs` en §6.2 y en lo que existe; §7 suma `inventory-movements-migration`, `order-delivery-append-only`, `inventario/scope`, `recipe-route-contract`, `clientes/scope`, `data-table-alcance`, `pedidos/module-contract` y las cuatro suites de /pedidos con doble | `specs/QC-225-detalle-de-producto-terminado/design.md` | `0bfddd97` |
| m4 | §6.4 nombra el paso 3 (componer). Por qué no el paso 2, solo con lo que dice el código: `order-distribution-label.tsx` no lleva `'use client'` y el `Popover` sí lo necesita, y la usan tres archivos de /asignacion; además su fila del catálogo dice «No cubre: la lista desplegada». Queda **abierto** si eso basta para descartar el paso 2: lo decide el humano junto con M3 | `specs/QC-225-detalle-de-producto-terminado/design.md` | `0bfddd97` |
| m5 | `orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]` en el `take: 1` del origen del lote; §4.1 enmendado | `lib/modules/inventario/adapters/driven/persistence/finished-product-detail-prisma.ts` | `078fee47` |

### Verificación (salida real, árbol final `0bfddd97`)

No se corrió `./init.sh`, ni la suite completa ni el E2E (memoria baja, por indicación del leader).

| Comando | Resultado |
|---|---|
| `NODE_OPTIONS=--max-old-space-size=4096 pnpm run typecheck` | exit 0 |
| `pnpm exec eslint` sobre los 6 archivos de código y test tocados | exit 0 |
| `vitest run tests/unit/inventario` | Test Files 114 passed (114); Tests 1756 passed, 5 skipped (1761) |
| `vitest run tests/unit/inventario-ui` | Test Files 7 passed (7); Tests 56 passed (56) |
| `vitest run tests/unit/pedidos` | Test Files 130 passed (130); Tests 2545 passed, 3 skipped (2548) |
| `vitest run tests/unit/pedidos-ui` | Test Files 49 passed (49); Tests 834 passed, 3 skipped (837) |
| `vitest run tests/unit/paridad tests/unit/clientes/scope.test.ts tests/unit/shared/data-table-alcance.test.ts tests/unit/recetas-ui/recipe-route-contract.test.ts` | Test Files 25 passed (25); Tests 486 passed, 2 skipped (488) |
| `vitest run guard` | Test Files 75 passed (75); Tests 1050 passed, 20 skipped (1070) |
| `vitest run --project integration tests/integration/inventario/finished-product-detail.int.test.ts` (lo corrió backend_dev después de m5) | Test Files 1 passed (1); Tests 13 passed (13). Base efímera `qct_qc225_e2ae854a_mv78a0kv_bjk`, copia de la plantilla `qct_tpl_7c42b3e164a6`, y borrada al terminar |

El mapa `R<n> → test` de la tanda 3 no cambia. Ningún caso se ha quitado ni renombrado.

## Tanda 5 (2026-10-13): cita de los tableros /design aprobados (M3, m4)

Solo docs. El humano aprobó el 2026-10-13 los tableros tal como están dibujados (canvas
https://claude.ai/artifact/Voiri77bod5p5EuzCUkPaq), incluidos sus «Por confirmar» tal como están
implementados: no hay cambios de UI. Los tableros entraron en `08118a98`.

| Archivo | Cambio |
|---|---|
| `specs/QC-225-detalle-de-producto-terminado/design.md` | §6 abre con la nota «2026-10-13: pase /design aprobado por el humano» y cita los seis tableros `docs/diseno/canvas/ProductoTerminado{,Tablet,Movil}.dc.html` y `PedidosPresentaciones{,Tablet,Movil}.dc.html`. §6.4 cierra m4: se acepta el paso 3 (componer `OrderProducedPresentations`) porque la etiqueta es de servidor, la usan tres archivos de /asignacion y su fila del catálogo dice «No cubre: la lista desplegada» |
| `specs/QC-225-detalle-de-producto-terminado/tasks.md` | `Archivos esperados` suma un bloque «Diseño» con los seis tableros, `canvas.json` y `docs/diseno/README.md` |
| `components/shared/CATALOGO.md` | Sin cambios: el catálogo solo cubre `components/ui`, `components/shared`, `lib/shared/ui` y `hooks`. `OrderProducedPresentations` y las piezas de la ficha viven en `app/`, así que el paso 6 de `docs/diseno/README.md` no les aplica (lo dice la nota de §6) |

### Verificación (salida real)

| Comando | Resultado |
|---|---|
| `pnpm exec vitest run guard` | Test Files 75 passed (75); Tests 1050 passed, 20 skipped (1070) |
| `pnpm exec vitest run tests/unit/login-skin.test.tsx tests/unit/shared-ui/catalogo-qc256.test.ts tests/unit/shared-ui/password-field.test.tsx` (los tests que leen `CATALOGO.md` o `docs/diseno/canvas`) | Test Files 3 passed (3); Tests 53 passed (53) |

No se corrió `./init.sh`, ni typecheck ni lint (no hay código), ni la suite completa (memoria baja).
