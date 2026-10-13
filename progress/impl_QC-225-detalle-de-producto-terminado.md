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
