# QC-288 — entrega-sin-pedido · bitácora de implementación

## T0 — Verificaciones previas y contrato (2026-10-16)

Verificaciones: `progress/features/QC-288.md > Decisiones` (2026-10-16 · T0). Paso 0 de
`design.md > 3` ENTRA; se reutiliza `ProductNotFoundError` (no hay `DirectDeliveryProductNotFoundError`).
El grafo no tiene proyecto para este worktree: Grep/Read.

### Archivos
Nuevos:
- `lib/modules/pedidos/domain/direct-delivery.ts` (puro, implementado)
- `lib/modules/pedidos/domain/{get-direct-delivery,list-direct-delivery-surplus,deliver-direct,get-direct-delivery-for-void,void-direct-delivery}.ts` (firma + permiso + `ActionNotAllowedError`)
- `lib/modules/pedidos/ports/direct-delivery-repository.ts`, `direct-delivery-unit-of-work.ts`
- `tests/fixtures/direct-delivery.ts`, `tests/unit/pedidos/direct-delivery.test.ts`

Modificados (producción): `errores/domain/error-codes.ts`, `error-catalog.ts`;
`pedidos/domain/errors.ts`, `deliver-order.ts`, `void-delivery.ts`, `index.ts`,
`ports/order-delivery-repository.ts`, `ports/order-delivery-void-repository.ts`,
`adapters/driving/order-actions.ts`, `adapters/driven/persistence/order-delivery-void-prisma.ts`,
`order-delivery-directory-prisma.ts`; `inventario/domain/finished-goods-dispatch.ts`,
`finished-goods-return.ts`, `inventory-movement.ts`, `reservation.ts`, `list-batch-movements.ts`,
`finished-product-detail.ts`, `list-finished-product-deliveries.ts`, `index.ts`,
`adapters/driven/persistence/batch-movement-prisma.ts`, `finished-goods-return-prisma.ts`;
`lib/composition/index.ts` (solo añadidos); y, por `typecheck`, dos `Record` de etiquetas de UI
(`batch-history.tsx`, `finished-product-movements-table.tsx`) con los textos de `design.md > 7.6`.

Modificados (tests, nota fechada 2026-10-16): `tests/unit/errores/catalogo.test.ts` (101 → 102),
`tests/unit/pedidos/order-actions.test.ts` (17 → 22 catch, + cinco firmas),
`tests/unit/pedidos/void-delivery.test.ts`, `tests/unit/inventario/adjust-batch-stock.test.ts`,
`authorization.test.ts`, `batch-history.test.tsx`, `batch-movement-prisma.test.ts`,
`list-finished-product-deliveries.test.ts`, `tests/fixtures/adjust-batch-stock.ts`,
`finished-product-detail.ts`. `tasks.md > Archivos esperados` corregido (rutas de tests de UI).

### Desvíos del contrato, acotados
- `NewInventoryMovement['kind']` NO se ensancha en T0: `writeMovement` lo pasa a Prisma, cuyo enum
  aún no tiene los dos valores. Entra con el enum en B1/B2. `InventoryMovementView`,
  `BatchHistoryEntry` y `FinishedProductMovementKind` sí.
- `returnForDeliveryVoid` con `orderId` nulo lanza hasta B2; `findDelivery` devuelve
  `productId: null` y `listDeliveryLines` `note: null` hasta B3.
- Composición: dobles que lanzan para catálogo, lector de esperas, repositorio y unidad de trabajo de
  la entrega; `deliveryCustomerDirectory` devuelve mapa vacío. La unidad de trabajo de la anulación
  sin pedido ya va con adaptadores reales.

### R → test (T0)
- R23 (funciones puras) → `tests/unit/pedidos/direct-delivery.test.ts` (casos `R23: …`). El caso de
  fuentes (sheet y `deliver-direct.ts`) llega en F2.
- R8 (tope de 200 por llamada) → `direct-delivery.test.ts > R8: son 200 productos por llamada`.

### Gate de la tanda (salida real)
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: exit 0, `✖ 9 problems (0 errors, 9 warnings)`. Los 9 avisos son previos y de
  otros archivos (`list-execution-traces.test.ts`, `confirm-catalog-import.test.ts`,
  `order-service.test.ts`).
- `pnpm exec vitest related --run --project ui --project node <42 archivos tocados>`:
  `Test Files 760 passed (760)`, `Tests 13470 passed | 33 skipped (13503)`. El proyecto
  `integration` no corre en local: falta `DATABASE_URL` en el worktree (lo corre CI).
- `pnpm exec vitest run guard`: `Test Files 80 passed (80)`, `Tests 1096 passed | 20 skipped (1116)`.

Veredicto: contrato de T0 publicado y gate de la tanda en verde; paso 0 confirmado para B4.

## F1 — Subir los bloques de entrega a `components/shared` (frontend_dev, 2026-10-16)

### Archivos
- Movidos con `git mv`, misma API (§7.1): `components/shared/order-customer-label.ts`,
  `components/shared/order-customer-picker.tsx`, `components/shared/order-delivery-customer-block.tsx`
  (dentro, sus imports relativos pasan a `@/components/shared/…`).
- `app/(private)/pedidos/components/index.ts`: reexporta las tres desde `@/components/shared/…`.
- Imports `./…` → `@/components/shared/…` en `order-columns.tsx`, `order-customer-dialog.tsx`,
  `order-customer-filter.tsx`, `order-delivery-sheet.tsx`, `order-form.tsx`, `order-list-section.tsx`,
  `order-table.tsx` (sin cambio visual).
- `components/shared/CATALOGO.md`: tres filas (`order-customer-label.ts`, `order-customer-picker.tsx`
  con `EntregaSinPedido.dc.html`; `order-delivery-customer-block.tsx` con `EntregaVariosClientes.dc.html`
  y `EntregaSinPedido.dc.html`). Ninguna tenía fila de origen con otro tablero.
- Rutas en guardias, con nota fechada 2026-10-16 y sin tocar aserciones:
  `tests/guards/guard-identificador-de-request.test.ts` (`SUPERFICIES_QUE_APLANAN`) y
  `tests/guards/guard-piezas-base.test.ts` (`CONSTANTES_QUE_NO_SON_EL_PAR`).
- Los tests de las tres piezas y del sheet de QC-282 importan por el barrel de `/pedidos`: no
  necesitaron cambio. `guard-buscadores.test.ts` cita la ruta vieja solo en listas históricas de
  QC-233 (R21/R4) y sigue verde: no se toca.

### Gate (salida real)
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: `✖ 9 problems (0 errors, 9 warnings)`, los 9 previos y ajenos.
- `pnpm exec vitest run guard`: `Test Files 80 passed (80)`, `Tests 1096 passed | 20 skipped (1116)`
  (incluye `guard-catalogo-de-componentes`).
- `pnpm exec vitest run tests/unit/pedidos-ui`: `Test Files 54 passed (54)`, `Tests 1075 passed | 3 skipped`.
- `pnpm exec vitest related --run <11 archivos tocados>`: `Test Files 67 passed (67)`, `Tests 1442 passed`.

Veredicto: F1 hecha; las tres piezas viven en `shared` con la misma API y el gate de la tanda está en verde.

## F5 — Historial del lote y tabs de movimientos (frontend_dev, 2026-10-16)

### Archivos
- `app/(private)/inventario/components/batch-history.tsx`: los dos tipos sin pedido pintan su etiqueta
  (ya puesta en T0) dentro de `StatusBadge` con los tonos del tablero (`info`, `muted`) y, en lugar del
  pedido, «Cliente» con `customerNames.join(', ')` (`batch-history-entry-customers`), o `EMPTY_MARK` si
  viene vacío. El resto de tipos se pinta igual que antes.
- `finished-product-movements-table.tsx`: sin cambio. T0 ya dejó los dos orígenes en
  `FINISHED_PRODUCT_MOVEMENT_KIND_LABELS`; el pedido sale `EMPTY_MARK` porque esos asientos no lo llevan.
- `tests/unit/inventario/batch-history.test.tsx`: cuatro casos R54.
- `tests/unit/inventario-ui/finished-product-tables.test.tsx`: un caso R55 (solo ese bloque en este
  commit; los casos de F4 van en el suyo).

### R → test
- R54 → `batch-history.test.tsx`: «R54 — un asiento de entrega sin pedido se pinta…», «R54 — un asiento
  de anulación de entrega sin pedido…», «R54 — sin clientes resueltos…», «R54 — los dos tipos sin pedido
  tienen etiqueta propia…».
- R55 (orígenes) → `finished-product-tables.test.tsx`: «R55 — Salidas muestra «Entrega sin pedido» y
  Entradas «Anulación de entrega sin pedido», sin número de pedido».

### Gate (salida real)
- `pnpm run typecheck`: `tsc --noEmit` sin errores.
- `pnpm run lint`: `0 errors, 9 warnings` (todos en archivos ajenos).
- `pnpm exec vitest run tests/unit/inventario/batch-history.test.tsx tests/unit/inventario-ui/finished-product-tables.test.tsx`:
  `Test Files 2 passed (2)`, `Tests 57 passed (57)`; la versión del commit (sin F4): `Tests 32 passed`.
- `pnpm exec vitest related --run batch-history.tsx batch-history.test.tsx`: `Test Files 35 passed (35)`,
  `Tests 583 passed (583)`.
- `pnpm exec vitest run guard`: `78 passed`, 2 rojos ajenos a F5: `guard-formularios-y-acciones` R28
  (el botón «Anular» de F4, sin commitear: bloqueo abierto) y `guard-asignacion-componentizada`, que en
  solitario pasa (`22 passed`): intermitente por carga.

Veredicto: F5 hecha; historial y movimientos muestran la entrega sin pedido y su anulación.

## F2 — Sheet «Entregar sin pedido» y borrador (frontend_dev, 2026-10-16)

### Archivos
- Nuevos: `app/(private)/inventario/components/direct-delivery-sheet.tsx`,
  `direct-delivery-surplus-card.tsx`, `direct-delivery-draft.ts`, `use-direct-delivery-draft.ts`.
- `app/(private)/inventario/components/index.ts`: los cuatro, con sus test ids.
- Tests nuevos: `tests/unit/inventario-ui/direct-delivery-sheet.test.tsx`,
  `direct-delivery-surplus-card.test.tsx`, `direct-delivery-draft.test.ts`.
- `tests/unit/pedidos/direct-delivery.test.ts`: bloque de fuentes de R23.
- `tests/unit/inventario/product-page.test.tsx` y `tests/unit/paridad/inventario-paridad.test.tsx`: doble
  de `order-actions` con nota fechada (el barrel ahora exporta el sheet, que importa esas actions; sin el
  doble se cargaba la composición real y el archivo no arrancaba). Sin cambio de aserciones.
- Sin `filter(`/`toFixed(`/`orderBy` en los archivos nuevos (`product-route-contract.test.ts` en verde).

### R → test
- R10, R11 → `direct-delivery-surplus-card.test.tsx` (desglose, desplegable, 4 casos de la marca) y
  `direct-delivery-sheet.test.tsx` (`R10`, `R11: el contador suma…`).
- R12–R22 → `direct-delivery-sheet.test.tsx` (un caso o más por requisito, con su `R<n>` en el nombre);
  payload exacto en `R22: envia una sola entrega…` contra `deliverDirectInput()` y `R22: … nota en null`.
- R23 → `tests/unit/pedidos/direct-delivery.test.ts` (`R23: el sheet importa del barrel de pedidos cada
  regla, la llama y no la redefine`). **Mitad del servidor pendiente:** `deliver-direct.ts` sigue siendo el
  stub de T0, así que el caso queda como `it.todo` hasta B4.
- R24–R26 → `direct-delivery-sheet.test.tsx` (`describe('despues de enviar')`).
- R27, R28 → `direct-delivery-draft.test.ts` y `direct-delivery-sheet.test.tsx` (`describe('borrador')`).

### Gate (salida real)
- `pnpm run typecheck`: verde (un rojo intermedio era de `finished-product-route-contract.test.ts`, de F4,
  y se resolvió solo).
- `pnpm run lint`: 0 errores, 9 avisos, ninguno en archivos de F2.
- `pnpm exec vitest related --run <archivos de F2 + product-route-contract + los dos tests ajustados>`:
  `Test Files 37 passed (37)`, `Tests 631 passed | 1 todo (632)`.
- `pnpm exec vitest run guard`: `79 passed | 1 failed`. El rojo es
  `guard-formularios-y-acciones` R28 sobre
  `producto-terminado/[id]/components/finished-product-deliveries-table.tsx:103`, archivo de F4 en curso.
