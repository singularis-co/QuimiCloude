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
