# Revisión cruzada QC-281 × QC-282 tras el merge (bee2bcb8)

Revisor: reviewer. Fecha: 2026-10-15. Alcance: solo cómo se afectan entre sí las dos features. La revisión
propia de QC-282 está en `progress/review_QC-282.md` y aquí no se repite.
Grafo de código: no se usó. La revisión se hizo con Grep/Read y `git diff` contra los dos padres del merge
(`ef6699a9` es QC-282 y `d65de543` es dev con QC-281); el merge-base es `ccde16f7`.

## Verificación ejecutada
- `pnpm run typecheck`: exit 0.
- `vitest run` sobre deliver-order, get-order-delivery, list-order-deliveries, void-delivery, order-delivery,
  packing-count, `tests/unit/pedidos/schema`, `tests/unit/pedidos-ui`, list-finished-product-deliveries,
  list-finished-product-distribution, finished-product-tables y guard-identificador-de-request:
  81 archivos y 1679 tests pasan; 3 están en skip.
- No se corrieron integración ni E2E, por la restricción del leader.

## Checklist
- [x] 1. El tope por envases reales se aplica a la suma de todos los clientes, y el tope por lote se mantiene.
- [x] 2. Los pedidos legados (`packedPackages` null) funcionan con varios clientes.
- [x] 3. Al anular por cliente, la devolución a inventario y los contadores quedan coherentes.
- [x] 4. Los tabs Reparto y Entregas leen datos coherentes. Ninguna query de QC-281 lee `order_deliveries.customer_id`.
- [x] 5. Las migraciones 120200 y 130000 aplican y revierten en orden y no se pisan.
- [x] 6. Los tests y E2E de QC-281 siguen siendo válidos. No queda ningún uso de la forma vieja.
- [x] 7. Ningún conflicto resuelto perdió contenido de ninguno de los dos lados.

## Detalle

### 1. Tope por envases reales sobre la suma de clientes
- Servidor, en `lib/modules/pedidos/domain/deliver-order.ts:118` y `:134-144`:
  - `flattenBlocks(input.customers)` junta las asignaciones de todos los clientes.
  - `checkDelivery` las suma por presentación (`order-delivery.ts:82`) frente a `effectivePackages(line) - entregado`.
  - Por tanto, el tope de QC-281 limita la suma de todos los clientes, no a cada cliente por separado.
- Tope por lote: lo aplica `dispatchForDelivery` una vez por presentación, con las asignaciones de todos los
  clientes agrupadas (`deliver-order.ts:147-161`). Los dos topes son independientes y los dos se cumplen.
- Lectura del sheet, en `get-order-delivery.ts:75-77`:
  - `orderedPackages = effectivePackages(line)` y `remaining` sale de ahí.
  - Solo se buscan lotes para las presentaciones con algo pendiente (`:81-88`). Una línea con 0 envases reales no ofrece lotes.
- Sheet, en `app/(private)/pedidos/components/order-delivery-sheet.tsx`:
  - «Entregas X de Y» (`:171-177` y `order-delivery-summary.tsx:37`): X es la suma de todos los bloques e Y
    es el `remainingPackages` del servidor, que ya sale de los envases reales.
  - «Disponibles» y «Solo hay N» (`:195-196`, `:283-285`): son el stock del lote menos lo asignado por los
    demás bloques. No dependen de QC-281, que es lo correcto.
  - `checkDelivery(view.lines, …)` (`:164`) usa los mismos `remainingPackages`.

### 2. Pedidos legados
`effectivePackages` (`packing-count.ts:237-239`) devuelve `packages` cuando `packedPackages` es null. Esa rama
no depende de cuántos clientes lleve la entrega. Los fixtures de QC-282 llevan `packedPackages: null`
(`deliver-order.test.ts:74-75` y `:706`), así que los casos de varios clientes ya ejercitan la rama legada.

### 3. Anulación por cliente de una entrega hecha con envases reales
- `sumOrderDeliveredPackages` (`order-delivery-prisma.ts:86-98`) excluye las líneas anuladas
  (`voidLine: null`). Una anulación parcial devuelve a «pendiente» justo lo anulado, frente al tope real.
- `void-delivery.ts:117-133` devuelve a inventario solo las líneas anuladas y pasa el pedido de `ENTREGADO` a `TERMINADO`.
- QC-281 no tiene contadores que dependan de las entregas:
  - el conteo real vive en `order_presentation_lines` y no lo toca ni la entrega ni la anulación;
  - la tab Reparto lee plan y real, no entregas.

  No hay nada que pueda desincronizarse.

### 4. Detalle de producto terminado
- Tab Reparto: `packed-lines-directory-prisma.ts:45-75` lee solo `order_presentation_lines` y `orders`, y no toca entregas.
- Tab Entregas: `order-delivery-directory-prisma.ts:37-60` lee `order_delivery_lines.customerId`, que es la columna nueva.
- Ninguna query de QC-281 lee `order_deliveries.customer_id`.
- `schema.prisma`:
  - `OrderDelivery` ya no tiene `customerId`;
  - `OrderDeliveryLine` lo tiene, con `@@unique([deliveryId, customerId, batchId])`, en `:860` y `:870`;
  - `packed*` está en `OrderPresentationLine`, en `:805-810`.

### 5. Migraciones
- 120200 solo toca `order_presentation_lines`. 130000 solo toca `order_deliveries` y `order_delivery_lines`.
- No comparten objetos, constraints ni índices.
- El rollback en orden inverso (primero 130000, luego 120200) es independiente.
- El censo `MIGRACIONES_ESPERADAS` las lista en orden 120200 → 130000, y 130000 sigue siendo la última.

### 6. Tests y E2E de QC-281
- `e2e/envases-reales-empaque.spec.ts` no crea ni lee entregas: no hay coincidencias con deliver, entreg ni customer.
- Lo que QC-281 añadió a integración no toca `order_deliveries`:
  - `order-packed-counts`, `packed-lines-directory`, `settle-packaging` y `finish-with-finished-goods`;
  - las únicas coincidencias son el estado `ENTREGADO` y el error `OrderDeliveredFrozenError`.
- Los casos de QC-281 en `deliver-order.test.ts:1038-1113` ya usan `customers: [clienteA(...)]`.
- Los de `get-order-delivery.test.ts` usan la vista, cuya forma de líneas no cambia.
- Usos residuales de la forma vieja: no queda ninguno.
  - `order_deliveries.customer_id` solo aparece en la propia migración y en su test de migración, que son intencionados.
  - También aparece en `order-delivery-append-only.test.ts:94`, como cadena de ejemplo de SQL mutante para el detector.
  - Todos los `INSERT INTO "order_deliveries"` de integración van sin `customer_id`.

### 7. Conflictos resueltos
Cada archivo se comparó contra los dos padres.
- `canvas.json`:
  - Es JSON válido. `boards` y `order` tienen 113 cada uno y no hay huérfanos ni duplicados.
  - Ningún board, nota o página de ninguno de los dos padres falta en el merge.
  - Ningún board modificado por un lado volvió a su contenido base.
- `lib/modules/inventario/index.ts`: conserva `FinishedDeliveryLineRecord` de QC-282 y `STOCK_INCREASE_REASONS`,
  `PackingReasonView`, `FinishedDistribution*` y `createListFinishedProductDistribution` de QC-281.
- `guard-identificador-de-request.test.ts`: conserva las dos altas de E2E (`envases-reales-empaque` y
  `entrega-a-varios-clientes`) y las dos migraciones, en orden.
- `aislamiento.json`: es JSON válido y conserva `order-packed-counts`, `settle-packaging` y `packed-lines-directory`
  (QC-281) y `order-delivery-lines-customer-migration` (QC-282).
- `deliver-order.test.ts`: todos los títulos `it` y `describe` de los dos padres siguen en el merge. Son 66, frente a 61 y 40.
- `list-finished-product-deliveries.test.ts`:
  - Faltan 5 títulos de dev (R19, R20, R33 ×2 y R34 sobre `linesByBatch` y `findDeliveryDetails`).
  - Ya faltaban en el padre QC-282: los quitó o reescribió QC-282 en su rediseño del tab, que está aprobado en su revisión.
  - QC-281 solo añadía `recipeId: null` a ese archivo, y el merge lo conserva. No se perdió nada de QC-281.

## Hallazgos
1. **menor**: no hay ningún test que combine en un mismo caso envases reales menores que el plan con varios clientes.
   - Archivos: `tests/unit/pedidos/deliver-order.test.ts:1038-1113` y `:879-1036`. Los casos de QC-281 usan
     un solo cliente y los de QC-282 usan `packedPackages: null`.
   - El código lo cubre por construcción: `checkDelivery` suma todas las asignaciones antes de comparar.
   - Un caso como «A=4 y B=4 con `packedPackages: 7` → `delivery_exceeds_remaining`» fijaría la interacción
     contra una regresión futura. No bloquea, porque R24 (QC-281) y R25 (QC-282) ya tienen cada uno su test.

## Veredicto
**OK**: no se encontró ninguna rotura entre QC-281 y QC-282 tras el merge.
