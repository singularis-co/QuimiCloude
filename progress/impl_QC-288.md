# QC-288 — entrega-sin-pedido · bitácora de implementación

## Estado (implementer, 2026-10-19)

- **Hechas y subidas, T0–TI** (`git log --oneline origin/dev..HEAD`):
  - T0 contrato: `c5277de2` (marca `2eedd7d5`).
  - F1 bloques de entrega a `components/shared`: `03acde62`.
  - F5 historial y tabs de movimientos: `a72e407a`.
  - F2 sheet y borrador: `2aa0a133`.
  - B1 migraciones: `33549f7b`. B2 adaptadores de pedidos: `4bba97f1`. B3 salida/devolución de
    inventario: `1d9fb746`. B4 casos de uso: `85196262`. B5 actions y composición: `89a4d9bf`.
  - F3 entradas: `62f1214e` (listado y hueco de la ficha) y `72db4457` (entrada en la ficha).
  - F4 tab Entregas y anular: `340f64e7`.
  - TC barrido de censos y guardias: `f58206c3`.
  - TI E2E: `169be815`.
  - Bitácora: `6cb244d4`, `d12932ff`.
- **Decisiones humanas F3/F4:** cerradas en `requirements.md > Decisiones cerradas`, commit `68be26f5`
  (F3 opción (a), contrato enmendado; F4 opción (a), «Anular» en el menú de la fila; sin tarjetas en
  teléfono).
- **Merge `593450fc` de `origin/dev` (QC-263, QC-166):** decisión humana (a), «Cliente» como novena
  columna del historial del lote (enmienda QC-263 R21/R23).
- **Pendiente:**
  - TZ del leader: `./init.sh` lo corre el leader (`AGENTS.md > Quién corre qué`).
  - Rojo E2E conocido, para que el leader lo clasifique: `e2e/detalle-de-producto-terminado.spec.ts`
    «R31, R27, R26: tras una entrega parcial…» (l. 548): `finished-stock-name` resuelve a 2 elementos
    por la tabla + tarjeta de QC-263. El código es idéntico al de `origin/dev`; no es de QC-288.
  - Revisión (reviewer).
- **Mapa R<n> → test:** completo, R1–R57, en «Mapa R<n> → test (consolidado)» abajo.

## Mapa R<n> → test (consolidado)

Salida de grep sobre los casos (`it`/`test`/`describe`/`it.each`) añadidos por la rama
(`git diff origin/dev...HEAD -- tests e2e`). Un caso concreto por requisito (se prefiere `it`/`test` a `describe`); la columna «n» es cuántos casos
añadidos llevan ese R en el nombre. R1 y R57 se cubren con tests que la rama no toca (ver notas).

| R | n | archivo | caso |
|---|---|---|---|
| R1 | — | `tests/unit/identity/permissions.test.ts` | R1: ningun otro rol recibe entregas.modificar / …entregas.anular (sin cambios en la rama; diff de permisos … |
| R2 | 6 | `tests/unit/pedidos/deliver-direct.test.ts` | R2: sin entregas.modificar responde unauthorized antes de validar, y ningun puerto se llama |
| R3 | 4 | `tests/unit/pedidos/get-direct-delivery-for-void.test.ts` | R3: sin entregas.anular responde unauthorized antes de validar el id y sin leer nada |
| R4 | 12 | `tests/unit/pedidos/deliver-direct.test.ts` | R4: un actor con entregas.modificar y un rol distinto de Administrador es aceptado |
| R5 | 7 | `tests/unit/inventario-ui/finished-product-header.test.tsx` | R5: con `actions`, la cabecera las pinta en el hueco de acciones de PageHeader |
| R6 | 6 | `tests/unit/inventario-ui/finished-stock-list-section.test.tsx` | R6: si la lectura del excedente falla, la tabla recibe el mapa vacio |
| R7 | 3 | `tests/unit/inventario-ui/direct-delivery-button.test.tsx` | R7: pulsar «Entregar» abre el sheet «Entregar sin pedido» de ese producto |
| R8 | 11 | `tests/unit/inventario-ui/finished-stock-list-section.test.tsx` | R8: pide el excedente de los productos distintos de la pagina en una sola llamada y lo pasa a la tabla |
| R9 | 15 | `tests/integration/inventario/deliverable-batches.int.test.ts` | R9: un lote sin contenido de envase no suma envases ni sale como entregable; los lotes van por fecha y lote |
| R10 | 5 | `tests/unit/inventario-ui/direct-delivery-sheet.test.tsx` | R10: muestra la tarjeta «Excedente» con lo de la vista |
| R11 | 2 | `tests/unit/inventario-ui/direct-delivery-sheet.test.tsx` | R11: el contador suma lo escrito en todos los bloques |
| R12 | 3 | `tests/unit/inventario-ui/direct-delivery-draft.test.ts` | R12: un borrador nuevo tiene un solo bloque vacio, la nota vacia y la clave de entrega dada |
| R13 | 1 | `tests/unit/inventario-ui/direct-delivery-sheet.test.tsx` | R13: cada bloque lista los lotes entregables con su codigo, sus disponibles y un campo, sin fechas |
| R14 | 5 | `tests/unit/inventario-ui/direct-delivery-draft.test.ts` | R14: añadir pone al final un bloque vacio con una clave nueva |
| R15 | 1 | `tests/unit/inventario-ui/direct-delivery-sheet.test.tsx` | R15: el buscador de cliente de cada bloque pide los clientes con purpose="deliver" |
| R16 | 3 | `tests/unit/inventario-ui/direct-delivery-sheet.test.tsx` | R16: los disponibles de un lote restan lo escrito en todos los bloques, igual en todos |
| R17 | 1 | `tests/unit/inventario-ui/direct-delivery-sheet.test.tsx` | R17: si lo escrito en un lote supera sus disponibles, marca «Solo hay N» en todos los bloques, avisa y desh… |
| R18 | 1 | `tests/unit/inventario-ui/direct-delivery-sheet.test.tsx` | R18: si los escritos superan el excedente, avisa con el excedente y deshabilita «Entregar» |
| R19 | 3 | `tests/unit/inventario-ui/direct-delivery-sheet.test.tsx` | R19: un bloque sin cliente muestra «Elige el cliente.» bajo su campo y no envia |
| R20 | 2 | `tests/unit/inventario-ui/direct-delivery-sheet.test.tsx` | R20: una nota de mas de 500 caracteres sin los espacios de los extremos avisa y no envia |
| R21 | 2 | `tests/unit/inventario-ui/direct-delivery-sheet.test.tsx` | R21: con excedente cero muestra «No hay envases libres…» con el stock, sin bloques ni nota y «Entregar» des… |
| R22 | 2 | `tests/unit/inventario-ui/direct-delivery-sheet.test.tsx` | R22: envia una sola entrega con la clave del borrador, el producto, cada bloque con sus envases > 0 por lot… |
| R23 | 30 | `tests/unit/pedidos/direct-delivery.test.ts` | R23: lo que falta es lo pedido menos lo entregado |
| R24 | 1 | `tests/unit/inventario-ui/direct-delivery-sheet.test.tsx` | R24: tras %s borra el borrador, cierra, avisa y refresca |
| R25 | 3 | `tests/unit/inventario-ui/direct-delivery-sheet.test.tsx` | R25: tras %s sigue abierto, muestra el mensaje, relee y conserva el borrador |
| R26 | 2 | `tests/unit/inventario-ui/direct-delivery-sheet.test.tsx` | R26: tras %s muestra el mensaje y sigue abierto con los bloques y la nota |
| R27 | 11 | `tests/unit/inventario-ui/direct-delivery-draft.test.ts` | R27: la clave es propia del producto |
| R28 | 6 | `tests/unit/inventario-ui/direct-delivery-draft.test.ts` | R28: quita de todos los bloques los envases de los lotes que ya no se ofrecen y lo avisa |
| R29 | 7 | `tests/unit/pedidos/deliver-direct.test.ts` | R29: ${caso} responde invalid_input sin leer ni escribir nada |
| R30 | 8 | `tests/integration/pedidos/direct-delivery.int.test.ts` | R30: producto inexistente, dado de baja, que no es terminado o de otra empresa: product_not_found |
| R31 | 5 | `tests/integration/pedidos/direct-delivery.int.test.ts` | R31: un cliente inexistente, dado de baja o de otra empresa: customer_not_found |
| R32 | 10 | `tests/integration/inventario/finished-goods-dispatch.int.test.ts` | R32: el producto de la empresa B pedido con el ambito de A no se bloquea; un producto dado de baja tampoco |
| R33 | 8 | `tests/integration/pedidos/direct-delivery.int.test.ts` | R33: 20 en stock y 8 que esperan: 13 envases son delivery_exceeds_surplus sin escribir nada y 12 pasan |
| R34 | 6 | `tests/integration/inventario/finished-goods-dispatch.int.test.ts` | R34: si la suma de los clientes para un lote supera sus envases, insufficient con los disponibles y nada es… |
| R35 | 7 | `tests/integration/pedidos/direct-delivery-concurrency.int.test.ts` | R35: dos entregas sin pedido a la vez que juntas superan el excedente (7 + 7 con 12): una aplicada y la otr… |
| R36 | 9 | `tests/integration/pedidos/direct-delivery-repository.int.test.ts` | R36, R37: create guarda la entrega sin pedido con su empresa, producto, nota, clave, autor e instante |
| R37 | 9 | `tests/integration/inventario/finished-goods-dispatch.int.test.ts` | R37: con un lote repetido entre clientes, un decremento y un asiento direct_delivery por lote con la suma, … |
| R38 | 18 | `tests/integration/pedidos/direct-delivery-repository.int.test.ts` | R38: la misma clave en la misma empresa da duplicate_key y no deja una segunda fila |
| R39 | 6 | `tests/integration/pedidos/direct-delivery.int.test.ts` | R39: si falla la escritura de las lineas, despues de la salida de todos los lotes, no queda ni entrega, ni … |
| R40 | 13 | `tests/integration/pedidos/direct-delivery-constraints.int.test.ts` | R40: control positivo: una entrega sin pedido con su linea, su asiento, su anulacion y su devolucion se acepta |
| R41 | 8 | `tests/integration/pedidos/direct-delivery-constraints.int.test.ts` | R41: las cuatro tablas siguen con RLS activada y forzada y sin updated_at ni deleted_at |
| R42 | 10 | `tests/integration/pedidos/direct-deliveries-migration.int.test.ts` | R42: existe exactamente una carpeta de cada migracion y la del tipo va antes |
| R43 | 6 | `tests/unit/inventario-ui/finished-product-tables.test.tsx` | R43 — con el permiso, el menú de acciones solo en las filas sin pedido no anuladas, con su aria-label |
| R44 | 11 | `tests/integration/pedidos/direct-delivery-void.int.test.ts` | R44: fecha, presentacion y los clientes con su parte sin anular; tras anular a Ana solo queda Bruno |
| R45 | 5 | `tests/unit/inventario-ui/direct-delivery-void-dialog.test.tsx` | R45 — sin ningún cliente marcado avisa «No hay nada que anular» y no envía |
| R46 | 6 | `tests/unit/inventario-ui/direct-delivery-void-dialog.test.tsx` | R46 — envía la entrega, la clave, el motivo y solo los clientes marcados |
| R47 | 6 | `tests/integration/pedidos/direct-delivery-void.int.test.ts` | R47: un cliente sin lineas en esa entrega, y una entrada mal formada, responden invalid_input |
| R48 | 13 | `tests/integration/pedidos/direct-delivery-void.int.test.ts` | R48: una entrega inexistente, de otra empresa o de pedido responde delivery_not_found; la anulacion de pedi… |
| R49 | 5 | `tests/integration/pedidos/direct-delivery-void.int.test.ts` | R49: anulada Ana, pedir Ana y Bruno responde delivery_already_voided y Bruno sigue sin anular |
| R50 | 13 | `tests/integration/inventario/finished-goods-return.int.test.ts` | R50: un asiento direct_delivery_void por lote con la suma en positivo, la anulacion, el autor, sin pedido n… |
| R51 | 16 | `tests/integration/pedidos/direct-delivery-void-concurrency.int.test.ts` | R51: dos anulaciones a la vez que comparten a Ana: una aplicada y la otra delivery_already_voided, y el lot… |
| R52 | 8 | `tests/integration/pedidos/order-delivery-directory.int.test.ts` | R52: las lineas sin pedido salen mezcladas con las de pedido, en el mismo orden, con orderId nulo y su nota |
| R53 | 4 | `tests/integration/pedidos/order-delivery-directory.int.test.ts` | R53: el total entregado suma las lineas no anuladas de las entregas sin pedido |
| R54 | 14 | `tests/integration/pedidos/order-delivery-directory.int.test.ts` | R54: por asiento, los clientes de la entrega o de la anulacion en ese lote, ordenados y sin repetir |
| R55 | 1 | `tests/unit/inventario-ui/finished-product-tables.test.tsx` | R55 — Salidas muestra «Entrega sin pedido» y Entradas «Anulación de entrega sin pedido», sin número de pedido |
| R56 | 2 | `e2e/entrega-sin-pedido.spec.ts` | R56: entrega sin pedido a dos clientes que comparten un lote con nota, tope del excedente, tab Entregas con… |
| R57 | — | `tests/guards/guard-dependencias-aprobadas.test.ts` | toda dependencia de package.json tiene su fila en el registro (guardia sin R en el nombre) + diff de packag… |

Notas:
- **R1** es un «NO DEBE»: lo fija `permissions.test.ts` (y `tests/guards/guard-permisos-sembrados.test.ts`), verdes sin editarse; el diff de la rama no toca `lib/modules/identity/domain/permissions.ts` ni seeds de permisos.
- **R57**: `git diff origin/dev...HEAD -- package.json pnpm-lock.yaml` vacío (2026-10-19) y
  `pnpm exec vitest run tests/guards/guard-dependencias-aprobadas.test.ts` → `Test Files 1 passed (1)`, `Tests 2 passed (2)`.
  Los casos «(R57)» de `tests/unit/pedidos/scope.test.ts` son el R57 de QC-35 (alcance del módulo), no este.

## Archivos tocados (consolidado)

`git diff --name-status origin/dev...HEAD` (2026-10-19), 144 archivos.

### Producción (70)
- M `app/(private)/inventario/components/batch-history.tsx`
- A `app/(private)/inventario/components/direct-delivery-button.tsx`
- A `app/(private)/inventario/components/direct-delivery-draft.ts`
- A `app/(private)/inventario/components/direct-delivery-sheet.tsx`
- A `app/(private)/inventario/components/direct-delivery-surplus-card.tsx`
- M `app/(private)/inventario/components/finished-stock-list-section.tsx`
- M `app/(private)/inventario/components/finished-stock-table.tsx`
- M `app/(private)/inventario/components/index.ts`
- M `app/(private)/inventario/components/product-row-actions.tsx`
- M `app/(private)/inventario/components/product-row-dialogs.tsx`
- A `app/(private)/inventario/components/use-direct-delivery-draft.ts`
- A `app/(private)/inventario/producto-terminado/[id]/components/direct-delivery-void-dialog.tsx`
- M `app/(private)/inventario/producto-terminado/[id]/components/finished-product-deliveries-table.tsx`
- M `app/(private)/inventario/producto-terminado/[id]/components/finished-product-header.tsx`
- M `app/(private)/inventario/producto-terminado/[id]/components/finished-product-list-section.tsx`
- M `app/(private)/inventario/producto-terminado/[id]/components/finished-product-movements-table.tsx`
- M `app/(private)/inventario/producto-terminado/[id]/components/index.ts`
- M `app/(private)/inventario/producto-terminado/[id]/page.tsx`
- M `app/(private)/pedidos/components/index.ts`
- M `app/(private)/pedidos/components/order-columns.tsx`
- M `app/(private)/pedidos/components/order-customer-dialog.tsx`
- M `app/(private)/pedidos/components/order-customer-filter.tsx`
- M `app/(private)/pedidos/components/order-delivery-sheet.tsx`
- M `app/(private)/pedidos/components/order-form.tsx`
- M `app/(private)/pedidos/components/order-list-section.tsx`
- M `app/(private)/pedidos/components/order-responsibles-sheet.tsx`
- M `app/(private)/pedidos/components/order-table.tsx`
- R `components/shared/order-customer-label.ts`
- R `components/shared/order-customer-picker.tsx`
- R `components/shared/order-delivery-customer-block.tsx`
- A `db/migrations/20261016130000_inventory_movement_kind_direct_delivery/down.sql`
- A `db/migrations/20261016130000_inventory_movement_kind_direct_delivery/migration.sql`
- A `db/migrations/20261016130100_direct_deliveries/down.sql`
- A `db/migrations/20261016130100_direct_deliveries/migration.sql`
- M `db/schema.prisma`
- M `lib/composition/index.ts`
- M `lib/modules/errores/domain/error-catalog.ts`
- M `lib/modules/errores/domain/error-codes.ts`
- M `lib/modules/inventario/adapters/driven/persistence/batch-movement-prisma.ts`
- M `lib/modules/inventario/adapters/driven/persistence/deliverable-batches-prisma.ts`
- M `lib/modules/inventario/adapters/driven/persistence/finished-goods-dispatch-prisma.ts`
- M `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts`
- M `lib/modules/inventario/domain/finished-goods-dispatch.ts`
- M `lib/modules/inventario/domain/finished-goods-return.ts`
- M `lib/modules/inventario/domain/finished-product-detail.ts`
- M `lib/modules/inventario/domain/inventory-movement.ts`
- M `lib/modules/inventario/domain/list-batch-movements.ts`
- M `lib/modules/inventario/domain/list-finished-product-deliveries.ts`
- M `lib/modules/inventario/domain/reservation.ts`
- M `lib/modules/inventario/index.ts`
- M `lib/modules/inventario/ports/product-repository.ts`
- A `lib/modules/pedidos/adapters/driven/persistence/direct-delivery-prisma.ts`
- M `lib/modules/pedidos/adapters/driven/persistence/order-delivery-directory-prisma.ts`
- M `lib/modules/pedidos/adapters/driven/persistence/order-delivery-prisma.ts`
- M `lib/modules/pedidos/adapters/driven/persistence/order-delivery-void-prisma.ts`
- M `lib/modules/pedidos/adapters/driving/order-actions.ts`
- A `lib/modules/pedidos/domain/deliver-direct.ts`
- M `lib/modules/pedidos/domain/deliver-order.ts`
- A `lib/modules/pedidos/domain/direct-delivery.ts`
- M `lib/modules/pedidos/domain/errors.ts`
- A `lib/modules/pedidos/domain/get-direct-delivery-for-void.ts`
- A `lib/modules/pedidos/domain/get-direct-delivery.ts`
- A `lib/modules/pedidos/domain/list-direct-delivery-surplus.ts`
- M `lib/modules/pedidos/domain/void-delivery.ts`
- A `lib/modules/pedidos/domain/void-direct-delivery.ts`
- M `lib/modules/pedidos/index.ts`
- A `lib/modules/pedidos/ports/direct-delivery-repository.ts`
- A `lib/modules/pedidos/ports/direct-delivery-unit-of-work.ts`
- M `lib/modules/pedidos/ports/order-delivery-repository.ts`
- M `lib/modules/pedidos/ports/order-delivery-void-repository.ts`

### Tests (62)
- A `e2e/entrega-sin-pedido.spec.ts`
- M `tests/fixtures/adjust-batch-stock.ts`
- A `tests/fixtures/direct-delivery.ts`
- M `tests/fixtures/finished-product-detail.ts`
- M `tests/guards/guard-buscadores.test.ts`
- M `tests/guards/guard-identificador-de-request.test.ts`
- M `tests/guards/guard-piezas-base.test.ts`
- A `tests/helpers/direct-delivery-seed.ts`
- M `tests/integration/aislamiento.json`
- M `tests/integration/inventario/deliverable-batches.int.test.ts`
- M `tests/integration/inventario/finished-goods-dispatch.int.test.ts`
- M `tests/integration/inventario/finished-goods-return.int.test.ts`
- M `tests/integration/inventario/finished-product-detail.int.test.ts`
- M `tests/integration/inventario/ledger-cuadre.int.test.ts`
- A `tests/integration/pedidos/direct-deliveries-migration.int.test.ts`
- A `tests/integration/pedidos/direct-delivery-concurrency.int.test.ts`
- A `tests/integration/pedidos/direct-delivery-constraints.int.test.ts`
- A `tests/integration/pedidos/direct-delivery-repository.int.test.ts`
- A `tests/integration/pedidos/direct-delivery-void-concurrency.int.test.ts`
- A `tests/integration/pedidos/direct-delivery-void.int.test.ts`
- A `tests/integration/pedidos/direct-delivery.int.test.ts`
- M `tests/integration/pedidos/order-delivery-directory.int.test.ts`
- M `tests/integration/pedidos/order-delivery-void-repository.int.test.ts`
- M `tests/unit/errores/catalogo.test.ts`
- M `tests/unit/identity/session-once-per-request-actions.test.ts`
- A `tests/unit/inventario-ui/direct-delivery-button.test.tsx`
- A `tests/unit/inventario-ui/direct-delivery-draft.test.ts`
- A `tests/unit/inventario-ui/direct-delivery-sheet.test.tsx`
- A `tests/unit/inventario-ui/direct-delivery-surplus-card.test.tsx`
- A `tests/unit/inventario-ui/direct-delivery-void-dialog.test.tsx`
- A `tests/unit/inventario-ui/finished-product-header.test.tsx`
- M `tests/unit/inventario-ui/finished-product-page.test.tsx`
- M `tests/unit/inventario-ui/finished-product-tables.test.tsx`
- A `tests/unit/inventario-ui/finished-stock-list-section.test.tsx`
- M `tests/unit/inventario/adjust-batch-stock.test.ts`
- M `tests/unit/inventario/authorization.test.ts`
- M `tests/unit/inventario/batch-history.test.tsx`
- M `tests/unit/inventario/batch-movement-prisma.test.ts`
- M `tests/unit/inventario/finished-goods-dispatch-prisma.test.ts`
- M `tests/unit/inventario/finished-goods-return-prisma.test.ts`
- M `tests/unit/inventario/finished-stock-table.test.tsx`
- A `tests/unit/inventario/list-batch-movements.test.ts`
- M `tests/unit/inventario/list-finished-product-deliveries.test.ts`
- M `tests/unit/inventario/product-page.test.tsx`
- M `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts`
- M `tests/unit/inventario/schema/finished-product-enum-values-migration.test.ts`
- M `tests/unit/inventario/schema/inventario-schema.test.ts`
- M `tests/unit/paridad/inventario-paridad.test.tsx`
- A `tests/unit/pedidos/deliver-direct.test.ts`
- M `tests/unit/pedidos/deliver-order.test.ts`
- A `tests/unit/pedidos/direct-delivery.test.ts`
- A `tests/unit/pedidos/get-direct-delivery-for-void.test.ts`
- A `tests/unit/pedidos/get-direct-delivery.test.ts`
- A `tests/unit/pedidos/list-direct-delivery-surplus.test.ts`
- M `tests/unit/pedidos/module-contract.test.ts`
- M `tests/unit/pedidos/order-actions.test.ts`
- M `tests/unit/pedidos/order-delivery-append-only.test.ts`
- A `tests/unit/pedidos/schema/direct-deliveries-migration.test.ts`
- M `tests/unit/pedidos/schema/pedidos-schema.test.ts`
- M `tests/unit/pedidos/scope.test.ts`
- M `tests/unit/pedidos/void-delivery.test.ts`
- A `tests/unit/pedidos/void-direct-delivery.test.ts`

### Specs y docs (12)
- M `components/shared/CATALOGO.md`
- A `docs/diseno/canvas/EntregaSinPedido.dc.html`
- A `docs/diseno/canvas/EntregaSinPedidoMovil.dc.html`
- A `docs/diseno/canvas/EntregaSinPedidoTablet.dc.html`
- M `docs/diseno/canvas/canvas.json`
- A `progress/features/QC-288.md`
- A `progress/impl_QC-288.md`
- M `specs/QC-225-detalle-de-producto-terminado/requirements.md`
- M `specs/QC-263-rediseno-inventario/requirements.md`
- A `specs/QC-288-entrega-sin-pedido/design.md`
- A `specs/QC-288-entrega-sin-pedido/requirements.md`
- A `specs/QC-288-entrega-sin-pedido/tasks.md`

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

## F3 — Entradas: cabecera de la ficha y menú del listado (frontend_dev, 2026-10-16) — cerrada (ver Cierre)

**Bloqueada la parte de `producto-terminado/[id]/page.tsx`.** Lo que pide `design.md > 7.4` para la
ficha choca con `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts`, que
`design.md > 9` no enmienda en ese punto. Probado cableando la página tal cual el diseño: 3 rojos, los 3
de `page.tsx`, y la página se dejó como estaba en HEAD.
1. `R7, R36` y `QC-225 R7 (enmienda QC-288), R43`: de `order-actions` la ruta solo admite
   `deliverDirectAction`, `voidDirectDeliveryAction` y `getDirectDeliveryForVoidAction`; §7.4 manda a la
   página llamar a `listDirectDeliverySurplusAction`.
2. `R16 — la ruta solo llama desde el servidor a valores del barrel de /inventario que no vienen de un
   modulo de cliente`: `DirectDeliveryButton` es `'use client'` (guarda el estado de apertura) y la
   página lo importaría del barrel de `/inventario`.
Falta decisión del leader/humano: enmendar ese contrato (lista de lecturas + R16 para componentes que
se pintan como JSX) o cambiar el diseño. Hasta entonces R5 solo tiene cubierta la cabecera.

### Archivos
- Nuevo: `app/(private)/inventario/components/direct-delivery-button.tsx`.
- `app/(private)/inventario/components/product-row-actions.tsx`: prop opcional `directDelivery`; con ella,
  ítem «Entregar» (`product-action-direct-delivery`, `TruckIcon`) tras «Lotes», y el sheet montado solo
  mientras está abierto. Sin la prop, ítems y orden iguales.
- `finished-stock-table.tsx`: prop opcional `surplusByProduct`; da `directDelivery` solo con excedente > 0.
- `finished-stock-list-section.tsx`: con `entregas.modificar` (mismo `assertPermission` que
  `order-list-section.tsx`), una llamada a `listDirectDeliverySurplusAction` con los productos distintos
  de la página (tandas de 200); error o rechazo dejan el mapa vacío.
- `app/(private)/inventario/components/index.ts`: `DirectDeliveryButton`, `DIRECT_DELIVERY_OPEN_TESTID`,
  `PRODUCT_ACTION_DIRECT_DELIVERY_TESTID`.
- `producto-terminado/[id]/components/finished-product-header.tsx`: prop opcional `actions` al hueco de
  `PageHeader`.
- Tests nuevos: `tests/unit/inventario-ui/direct-delivery-button.test.tsx`,
  `finished-product-header.test.tsx`, `finished-stock-list-section.test.tsx`.
- `tests/unit/inventario/finished-stock-table.test.tsx`: doble de `order-actions` (nota fechada) y bloque
  «Entregar» sin pedido. `product-page.test.tsx` y `inventario-paridad.test.tsx`: el doble de
  `listDirectDeliverySurplusAction` resuelve `{ status: 'success', data: {} }`.

### R → test
- R5 → `finished-product-header.test.tsx` (`R5: con actions…`, `R5: sin actions…`). **Falta la página**
  (ver bloqueo): `finished-product-page.test.tsx` sin caso nuevo.
- R6 → `finished-stock-table.test.tsx` (`R6: solo la fila con excedente…`, `R6: sin mapa…`) y
  `finished-stock-list-section.test.tsx` (`R6: …falla`, `R6: …rechaza`, `R6: sin entregas.modificar /
  sin sesion`, `R6: el permiso decide, no el rol`).
- R7 → `direct-delivery-button.test.tsx` (2 casos) y `finished-stock-table.test.tsx` (`R7: «Entregar» del
  menu abre el sheet…`).
- R8 → `finished-stock-list-section.test.tsx` (`R8: … una sola llamada`, `R8: con 1/25 filas…`,
  `R8: … tandas de 200`).

### Gate (salida real)
- `pnpm run typecheck`: verde.
- `pnpm run lint`: 0 errores, 9 avisos preexistentes, ninguno en archivos de F3.
- Tests nuevos y `finished-stock-table.test.tsx`: `Test Files 4 passed (4)`, `Tests 37 passed (37)`.
- `product-route-contract.test.ts` + `finished-product-route-contract.test.ts`: `2 passed`, `40 passed`.
- `pnpm exec vitest related --run <archivos de F3 + contratos + tests tocados>`:
  `Test Files 1 failed | 39 passed (40)`, `Tests 1 failed | 639 passed (640)`. El rojo fue un tiempo
  agotado (21 s) en `product-page.test.tsx` («un guardado rechazado por un campo…»); solo y con
  `--testTimeout=120000`: `Test Files 1 passed`, `Tests 88 passed (88)`.
- `pnpm exec vitest run guard`: `74 passed | 3 failed`. Dos eran tiempos agotados por carga
  (`guard-asignacion-componentizada`, `guard-archivos-en-vuelo-sin-ruido`: con `--testTimeout=120000`,
  `2 passed`, `31 passed`). El rojo real sigue siendo `guard-formularios-y-acciones` R28 sobre
  `finished-product-deliveries-table.tsx:103`, de F4.

### Cierre (frontend_dev, 2026-10-16)

Decisión del humano (`requirements.md > Decisiones cerradas`, commit `68be26f5`): se enmienda el
contrato de la ruta y el botón se importa por su ruta directa. Grafo: sin proyecto para este worktree;
Grep/Read.

Archivos:
- `app/(private)/inventario/producto-terminado/[id]/page.tsx`: tras `getFinishedProductAction`, con
  `entregas.modificar` (`assertPermission` sobre `identity.getSessionUser()`) llama una vez a
  `listDirectDeliverySurplusAction([product.id])`; con excedente > 0 pasa
  `actions={<DirectDeliveryButton productId=… />}` a `FinishedProductHeader`. Sin permiso, sin sesión,
  con error, con rechazo o con 0, no pasa nada. `DirectDeliveryButton` se importa de
  `@/app/(private)/inventario/components/direct-delivery-button`, no del barrel.
- `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts`: nota fechada
  2026-10-16; `listDirectDeliverySurplusAction` entra en las lecturas de `pedidos` admitidas, y el caso
  «QC-225 R7 (enmienda QC-288), R43» exige ahora que la página importe solo esa action de `pedidos`.
  Las aserciones previas (incluidas las R16) no cambian.
- `tests/unit/inventario-ui/finished-product-page.test.tsx`: dobles de `@/lib/composition` y de
  `order-actions` (nota fechada) y bloque «Entregar» en la cabecera (7 casos R5).
- `specs/QC-225-detalle-de-producto-terminado/requirements.md`: enmienda fechada bajo R7.
- `specs/QC-288-entrega-sin-pedido/tasks.md`: F3 `[x]`; ese spec, en `Archivos esperados`.

R → test (completa el mapa de arriba):
- R5 → `finished-product-page.test.tsx` («R5 — con entregas.modificar y excedente > 0, la cabecera
  muestra «Entregar» (tab general/stock)», «R5 — con excedente cero…», «R5 — sin el producto en la
  respuesta…», «R5 — si el excedente no se pudo leer…», «R5 — sin entregas.modificar o sin sesión…»,
  «R5 — el permiso decide, no el rol…») y `finished-product-header.test.tsx` (2).

Gate (salida real):
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: `✖ 9 problems (0 errors, 9 warnings)`, los 9 previos y ajenos.
- `finished-product-page` + `finished-product-route-contract` + `product-route-contract`:
  `Test Files 3 passed (3)`, `Tests 55 passed (55)`.
- `finished-product-route-contract` + `product-route-contract` + `finished-product-header` +
  `direct-delivery-button`: `Test Files 4 passed (4)`, `Tests 44 passed (44)`.
- `pnpm exec vitest related --run page.tsx`: `Test Files 1 passed (1)`, `Tests 15 passed (15)`.
- `pnpm exec vitest run guard`: primer pase `1 failed | 79 passed (80)`, un tiempo agotado (24,9 s) en
  `guard-asignacion-componentizada`; sola, `22 passed (22)`; segundo pase completo
  `Test Files 80 passed (80)`, `Tests 1099 passed | 20 skipped (1119)`.

Veredicto: F3 hecha; R5–R8 de pantalla en verde, con el contrato de la ruta enmendado y R16 intacta.

## F4 — Tab Entregas y diálogo de anular (frontend_dev, 2026-10-16)

Decisión del humano (`requirements.md > Decisiones cerradas`, commit `68be26f5`): la fila usa el menú de
acciones con un único ítem «Anular»; `guard-formularios-y-acciones` no cambia. En teléfono no hay
tarjetas: la tab queda como hoy, con la tabla y su scroll horizontal. Grafo: sin proyecto para este
worktree; Grep/Read.

### Archivos
- Nuevo: `app/(private)/inventario/producto-terminado/[id]/components/direct-delivery-void-dialog.tsx`.
- `finished-product-deliveries-table.tsx`: celda Pedido con «Sin pedido» (`StatusBadge` `info`) y la
  nota debajo; con `canVoidDirect`, `actionsColumn({ menu })` cuyo menú
  (`finished-product-delivery-actions`, `aria-label` «Acciones de la entrega sin pedido del <fecha>»)
  tiene un único ítem «Anular» (`finished-product-delivery-direct-void`, `XCircleIcon`, destructivo)
  solo en filas `withoutOrder && void === null`; en las demás el menú no tiene ítems y no se pinta.
- `finished-product-list-section.tsx`: `canVoidDirect` con `entregas.anular` (`assertPermission`), solo
  si la página se leyó.
- `components/index.ts` de la ficha: exporta el diálogo, sus test ids y los de la tabla.
- `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts`: enmienda de QC-225
  R7 con nota fechada (admite `deliverDirectAction`, `voidDirectDeliveryAction`,
  `getDirectDeliveryForVoidAction`; sigue prohibiendo `voidDeliveryAction` y las demás).
- Tests: `tests/unit/inventario-ui/finished-product-tables.test.tsx`,
  `tests/unit/inventario-ui/direct-delivery-void-dialog.test.tsx` (nuevo).
- **Sin cambio en `components/shared`:** la extensión `srOnlyLabel` de `data-table` (y su fila de
  `CATALOGO.md`) se retiró. Con la columna de menú la cabecera «Acciones» es visible, como en el resto de
  tablas con `actionsColumn` (p. ej. `customer-columns.tsx`); ya no hace falta ocultarla.

### R → test
- R43 → `finished-product-tables` («R43 — con el permiso, el menú de acciones solo en las filas sin
  pedido no anuladas…», «R43 — el menú de la fila sin pedido tiene un único ítem «Anular»», «R43 — sin
  el permiso, ni el menú ni «Anular» existen en el DOM…», «R43, R44 — elegir «Anular» en el menú abre el
  diálogo…», «R43, R53 — la sección pasa canVoidDirect según entregas.anular…»); contrato
  `finished-product-route-contract` («QC-225 R7 (enmienda QC-288), R43 …» ×2).
- R44 → `direct-delivery-void-dialog` (3 casos «R44 — …»).
- R45 → `direct-delivery-void-dialog` («R45 — sin ningún cliente marcado…», «R45 (QC-224 R13) …»,
  «R45 (QC-224 R14) …» ×2).
- R46 → `direct-delivery-void-dialog` (4 casos «R46 — …»).
- R52 → `finished-product-tables` («R52 — la fila sin pedido marca «Sin pedido» con su nota…», «R52 —
  mismas columnas que QC-282…»).
- R55 → `finished-product-tables` («R55 — Salidas muestra «Entrega sin pedido»…», de F5).

### Gate (salida real)
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: `✖ 9 problems (0 errors, 9 warnings)`, los 9 previos y ajenos.
- `finished-product-tables.test.tsx` + `direct-delivery-void-dialog.test.tsx`: `Test Files 2 passed (2)`,
  `Tests 57 passed (57)`.
- `pnpm exec vitest related --run` sobre los cuatro archivos de producción de F4:
  `Test Files 8 passed (8)`, `Tests 97 passed (97)`.
- `pnpm exec vitest run guard`: `Test Files 80 passed (80)`, `Tests 1099 passed | 20 skipped (1119)`.
- `finished-product-route-contract.test.ts` + `product-route-contract.test.ts`: `Test Files 2 passed (2)`,
  `Tests 40 passed (40)`.

Veredicto: F4 hecha; R43–R46 y R52 de pantalla en verde, la guardia R28 en verde sin cambiarla.

## B1 — Migraciones y esquema (2026-10-16)

Grafo: sin proyecto para este worktree; Grep/Read.

### Comprobaciones previas (§1.2), contra una copia de la plantilla de test (`qct_tpl_b2687cf7fda6`, PG 16.1)
- Los cinco CHECK que se reescriben tienen hoy exactamente el texto de referencia (QC-224 §3.2):
  `order_delivery_id_matches_kind` = `kind::text = 'delivery'`, `delivery_quantity_negative`,
  `order_delivery_void_id_matches_kind`, `delivery_void_quantity_positive` y
  `reason_matches_kind` (con `delivery_void`). Ninguna migración posterior los reescribió.
- `products_company_id_id_key` = `UNIQUE (company_id, id)`.
- Los índices parciales `inventory_movements_one_delivery_per_batch` y `..._one_delivery_void_per_batch`
  tienen predicado `IS NOT NULL` sobre la columna: cubren los tipos nuevos sin cambio.
- El único dependiente del tipo `InventoryMovementKind` es `inventory_movements.kind`; los CHECK y el
  índice que usan el literal tipado son los mismos que suelta el molde de `delivery_void/down.sql`.
- `[POR VERIFICAR]` de §1.1 cerrado: dos `ADD VALUE` en el mismo archivo los aplica `prisma migrate
  deploy` sin error (una sola migración).
- Ninguna diferencia cambia el diseño. Dos añadidos menores al SQL de referencia:
  1. el disparador de líneas devuelve `NEW` si no encuentra la entrega de esa empresa (`IF NOT FOUND`),
     para que la FK siga rechazando con 23503 la línea de otra empresa (lo esperan las suites de QC-223);
     el de asientos filtra también por `company_id` y solo compara si encontró la fila;
  2. el `down.sql` de `direct_deliveries` aborta también si hay asientos de los tipos nuevos (R42 lo
     nombra), y abre/cierra el paréntesis de RLS como `order_delivery_lines_customer/down.sql`.

### Archivos
Nuevos:
- `db/migrations/20261016130000_inventory_movement_kind_direct_delivery/{migration,down}.sql`
- `db/migrations/20261016130100_direct_deliveries/{migration,down}.sql`
- `tests/unit/pedidos/schema/direct-deliveries-migration.test.ts`
- `tests/integration/pedidos/direct-deliveries-migration.int.test.ts` (esquema de usar y tirar con copia
  propia del enum, `commit`)
- `tests/integration/pedidos/direct-delivery-constraints.int.test.ts` (`transaccion`)

Modificados:
- `db/schema.prisma` (§1.3; sin `prisma format`, que reflowaba modelos ajenos) + `prisma generate`.
- `lib/modules/inventario/domain/inventory-movement.ts`: `NewInventoryMovement['kind']` =
  `InventoryMovementView['kind']` (gana los dos tipos).
- `lib/modules/pedidos/adapters/driven/persistence/order-delivery-prisma.ts` (`sumOrderDeliveredPackages`)
  y `order-delivery-void-prisma.ts` (`listOrderDeliveryHistory`): saltan la línea sin línea del reparto,
  que en una entrega de pedido no puede existir; lo exige el tipo anulable.
- Censos, con nota fechada 2026-10-16 y aserciones previas intactas:
  `tests/guards/guard-identificador-de-request.test.ts` (`MIGRACIONES_ESPERADAS` + 2),
  `tests/unit/inventario/schema/inventario-schema.test.ts` (caso nuevo del enum),
  `tests/unit/inventario/schema/finished-product-enum-values-migration.test.ts` (el censo exacto del enum
  vive aquí: + 2 valores al final), `tests/unit/pedidos/schema/pedidos-schema.test.ts` (caso nuevo:
  `orderId?`, `productId?` sin `@relation`, `note?`, línea del reparto anulable),
  `tests/integration/aislamiento.json` (+ las dos suites nuevas).
- Sin cambio, verificado: `tests/unit/clientes/scope.test.ts` (la migración no toca `customers`); no hay
  censo de migraciones que tocan `products` en `tests/unit/inventario/*`; `customers-migration.int.test.ts`
  no arrastra la migración nueva (no referencia `customers` ni tablas de sus dependientes).
- `specs/QC-288-entrega-sin-pedido/tasks.md`: B1 `[x]`.

### R → test
- R40 → `tests/integration/pedidos/direct-delivery-constraints.int.test.ts` (9 casos `R40`/`R41`: XOR,
  nota, producto de otra empresa, líneas, `direct_delivery`, `direct_delivery_void`, empresa B) +
  `order-delivery-constraints.int.test.ts` y `order-delivery-void-constraints.int.test.ts` sin cambio, en
  verde; estático en `tests/unit/pedidos/schema/direct-deliveries-migration.test.ts` (`R40: …`).
- R41 → `direct-deliveries-migration.test.ts` (`R41: no crea tablas ni updated_at/deleted_at`,
  `R41: … nombre en ingles`, `R41: el UP solo anade los dos valores`), `pedidos-schema.test.ts`
  (`QC-288 R40, R41`), `inventario-schema.test.ts` (`R41: InventoryMovementKind …`),
  `direct-delivery-constraints.int.test.ts` (`R41: … RLS … sin updated_at ni deleted_at`).
- R42 → `tests/integration/pedidos/direct-deliveries-migration.int.test.ts` (UP intacto sobre entregas
  con anulaciones; DOWN sin entregas sin pedido deja el esquema previo y el UP lo repone; DOWN abortado
  con una entrega sin pedido; DOWN de las dos abortado con asientos `direct_delivery(_void)`) + los casos
  `R42` del estático.

### Reversión con `pnpm run db:rollback` (base de test, nunca la de desarrollo)
Copia `qc288_b1_scratch` de la plantilla, `prisma migrate deploy` (2 migraciones), dos
`db:rollback` (el segundo desde un cwd con `db/migrations` sin la carpeta ya revertida, porque el script
revierte la última carpeta del disco). Huella del esquema (restricciones, índices, columnas,
disparadores, funciones y enum de `public`): plantilla `93162223…` (958 objetos) → migrada `87ae9dfd…`
(968) → tras los dos rollbacks `93162223…` (958), y 0 filas de las dos en `_prisma_migrations`. Base
borrada al terminar.

### Gate (salida real)
Entorno: sin `.env` en el worktree; `DATABASE_URL`, `DIRECT_URL` y `SEED_*` exportadas solo en el
comando desde el `.env` del repo principal (el sembrado de la plantilla nueva pide `SEED_*`).
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: `✖ 9 problems (0 errors, 9 warnings)`, los 9 previos y ajenos.
- `pnpm exec vitest run guard`: `Test Files 80 passed (80)`, `Tests 1096 passed | 20 skipped (1116)`.
- `pnpm exec vitest run tests/unit/pedidos/schema/ tests/unit/inventario/schema/ tests/unit/clientes/scope.test.ts`:
  `Test Files 38 passed (38)`, `Tests 522 passed (522)`.
- Integración (base efímera `qct_qc288_…`, plantilla `qct_tpl_8f650250810d`): las tres suites nuevas +
  `order-delivery-constraints` + `order-delivery-void-constraints` + `customers-migration` +
  `order-delivery-lines-customer-migration`: `Test Files 6 passed (6)`, `Tests 50 passed (50)`.
- `pnpm exec vitest related --run <2 adaptadores + 9 tests tocados>`: `Test Files 2 failed | 392 passed (395)`,
  `Tests 2 failed | 6556 passed | 2 skipped`, 1 worker caído (presión de disco/memoria, ver abajo). Los dos
  rojos NO son de B1 y no están en `tests/baseline-rojos.json`: vienen de T0 (`c5277de2`), que añadió campos
  al contrato sin tocar estas expectativas de integración:
  - `tests/integration/inventario/finished-product-detail.int.test.ts` (R19, R43, R44): la fila trae
    `note: null` y `withoutOrder: false` (`inventario/domain/list-finished-product-deliveries.ts:98`).
  - `tests/integration/pedidos/order-delivery-void-repository.int.test.ts` (R18): `findDelivery` trae
    `createdAt` y `productId: null` (`order-delivery-void-prisma.ts`, `findDeliveryForVoid`).
  Los tocan B2 y B3 (sus adaptadores), no se corrigen aquí.
- `related` sobre `inventory-movement.ts` no se completó: el tipo está detrás del barrel de `inventario` y
  su conjunto es casi la suite entera (cortado a los 15 min). Su cambio es solo de tipo; lo cubre
  `typecheck`.
- Incidencia de entorno: con el disco C: al 100 % (3 GB libres) el Postgres local se interrumpió a las
  15:04 y tardó ~20 min en recuperar (fsync de ~98 bases). Nada de B1 lo causó; la corrida de `related`
  se repitió entera tras la recuperación.

Veredicto: B1 hecha; las dos migraciones aplican y revierten limpias, R40–R42 tienen test en verde y el
gate de la tanda está verde salvo dos rojos heredados de T0.

## B3 — `pedidos`: adaptadores driven (2026-10-16)

Grafo: sin proyecto para este worktree; Grep/Read. Composición sin tocar (la ata B5).

### Archivos
Nuevos:
- `lib/modules/pedidos/adapters/driven/persistence/direct-delivery-prisma.ts`:
  `createDirectDeliveryRepository` (`findByKey`, `create` con P2002 → `duplicate_key`, `addLines` con
  `createMany` y línea del reparto nula) y `createWaitingOrdersReader` (`listWaitingLines`: un
  `orderPresentationLine.findMany` con todos los pares en un `OR`, pedido `TERMINADO` sin borrar de la
  empresa; lo entregado con un `groupBy` de líneas sin anular; `numberText` con `formatOrderNumber`,
  envases con `effectivePackages`). Sin pares, no consulta.
- `tests/integration/pedidos/direct-delivery-repository.int.test.ts` (`transaccion`, en `aislamiento.json`).

Modificados:
- `order-delivery-void-prisma.ts`: `findDelivery` selecciona `productId` (ya traía `createdAt`).
  `findDeliveryLines` y `findByKey` ya admitían los nulos por el tipo de B1; lo prueban los casos nuevos.
- `order-delivery-directory-prisma.ts`: `listDeliveryLines` trae `delivery.note`; nueva
  `findCustomerIdsForMovements` (un `findMany` de líneas por `(entrega, lote)` y otro de líneas de
  anulación por `(anulación, lote)`, ids ordenados y sin repetir; sin referencias, no consulta).
- `order-delivery-prisma.ts`: sin cambio; `findByKey` ya devuelve `orderId` nulo (probado).
- Tests con nota fechada 2026-10-16 y aserciones previas intactas:
  `order-delivery-void-repository.int.test.ts` (el rojo heredado de T0: `findDelivery` con `productId`
  y `createdAt`; + 4 casos sin pedido), `order-delivery-directory.int.test.ts` (`note: null` en los dos
  `toEqual` previos, que también estaban rojos desde T0; + 2 entregas sin pedido en lotes propios y 8
  casos), `tests/unit/pedidos/module-contract.test.ts` (censo cerrado de `@prisma/client` y del cliente
  compartido: + `direct-delivery-prisma.ts`), `tests/integration/aislamiento.json` (+1).
- `specs/QC-288-entrega-sin-pedido/tasks.md`: B3 `[x]`.

### R → test
- R9 (parte `pedidos`) → `direct-delivery-repository.int.test.ts` (`R9: solo cuentan los pedidos vivos …`
  con otra receta, otra presentación, EN_ACONDICIONAMIENTO, ENTREGADO, borrado, empresa B y una línea
  anulada; `R9: varios pares en una sola consulta`; `R9: con el ambito de B …`; `R9: sin pares …`).
- R38 (base) → `direct-delivery-repository.int.test.ts` (5 casos `R38`: duplicada, clave de una entrega de
  pedido, única por empresa, `findByKey` de los dos tipos, `findByKey` de pedido con `orderId` nulo).
- R47, R48, R51 (adaptador) → `order-delivery-void-repository.int.test.ts` (bloque «con entregas sin pedido»).
- R52 → `order-delivery-directory.int.test.ts` (`R52: … mezcladas …`, `R52: pagina sobre la mezcla`,
  `R52, R53: con el ambito de B …`).
- R53 → `order-delivery-directory.int.test.ts` (`R53: el total entregado suma …`).
- R54 → `order-delivery-directory.int.test.ts` (`findCustomerIdsForMovements`: 4 casos `R54`, incluida una
  consulta por tipo de referencia y empresa B).

### Gate (salida real)
Entorno: `DATABASE_URL`, `DIRECT_URL` y `SEED_*` exportadas solo en el comando desde el `.env` del repo
principal.
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: `✖ 9 problems (0 errors, 9 warnings)`, los 9 previos y ajenos.
- `pnpm exec vitest run guard`: `Test Files 1 failed | 79 passed (80)`, `Tests 1 failed | 1097 passed | 20 skipped`.
  El rojo es `guard-formularios-y-acciones` R28, de los archivos de F4 sin commit (conocido, no de B3).
- Integración: las 3 suites de B3 + `order-delivery-repository`, `order-delivery`, `order-delivery-void` y
  `direct-delivery-constraints`: `Test Files 7 passed (7)`, `Tests 111 passed (111)`.
- `tests/unit/pedidos/module-contract.test.ts` + `order-delivery-append-only.test.ts` (los dos barridos que
  leen estos adaptadores): `module-contract` en verde salvo «las Server Actions viven en UN SOLO archivo
  driving», que señala `app/(private)/inventario/components/direct-delivery-draft.ts` (F2); y
  `order-delivery-append-only` R32/R33 rojos por `voidDirectDeliveryAction` y `createVoidDirectDelivery`
  (nombres de T0). Ninguno nombra un archivo de B3 y ninguno está en `tests/baseline-rojos.json`.
- `vitest related` no se corrió: los adaptadores cuelgan de `lib/composition`, cuyo conjunto es casi la
  suite entera (B1 lo cortó a los 15 min) y el disco C: está al 98 %. Se corrieron las suites nombradas.

Veredicto: B3 hecha; adaptadores de la entrega sin pedido con R9, R38 (base) y R52–R54 en verde; quedan tres
rojos ajenos (F2, T0 y F4) señalados arriba.

## B2 — `inventario`: salida, devolución y lecturas (2026-10-16)

Grafo: sin proyecto para este worktree; Grep/Read.

### Archivos
Producción (`lib/modules/inventario/`):
- `adapters/driven/persistence/product-prisma.ts`: `dispatchFinishedGoods` recibe el origen discriminado
  (`FinishedGoodsDispatchOrigin`: `order` con pedido/receta/presentación, `direct` con `productId`); el bloqueo
  `FOR NO KEY UPDATE` pasa a un ayudante privado `lockAliveFinishedProduct` (por receta+presentación o por id) que
  comparten la salida y `lockFinishedProductForDelivery` (nueva, lectura con bloqueo, sin escritura: receta,
  presentación y lotes con contenido). Con `direct` el asiento es `direct_delivery`, `orderId: null`.
  `returnFinishedGoods`: `orderId: string | null`; nulo → `direct_delivery_void`; sigue sin mirar `deleted_at`.
- `finished-goods-dispatch-prisma.ts`: `createFinishedGoodsDirectDispatch(tx)` (`lockForDirectDelivery` suma
  `wholePackagesIn` de los lotes leídos con el producto bloqueado; `dispatchDirect`). `createFinishedGoodsDispatch`
  pasa `origin: 'order'`.
- `finished-goods-return-prisma.ts`: quitado el stub de T0 que lanzaba con `orderId` nulo.
- `deliverable-batches-prisma.ts`: `findForDelivery` y `findSurplusBases` (§5), con las envolturas de
  `company-scope.ts` en `products`, `product_batches` y `presentations`.
- `batch-movement-prisma.ts`: selecciona `orderDeliveryId` y `orderDeliveryVoidId` y los devuelve en el asiento del
  libro físico. Para tiparlo: `domain/reservation.ts` gana `BatchMovementRecord` (= `BatchHistoryEntry` + las dos
  referencias opcionales) y `ports/product-repository.ts > findBatchMovements` devuelve ese tipo. Desvío menor:
  `product-repository.ts` no estaba en `tasks.md > Archivos esperados`; es el puerto que B5 necesita leer.
  `list-batch-movements.ts` (B5) no se toca: hoy propaga las dos referencias en el spread hasta que B5 resuelva los
  clientes.
- `domain/inventory-movement.ts` y `writeMovement`: solo comentarios (el tipo ya lo ensanchó B1).
- `finished-product-detail-prisma.ts` **no cambia**: desde QC-282 el tab Entregas lo lee `pedidos`
  (`order-delivery-directory-prisma.ts`, B3); `note`/`withoutOrder` no son lecturas de `inventario`.

Censos sin cambio: `guard-libro-de-inventario`, `qc121-alcance` y `qc91-alcance` siguen contando los mismos nueve
caminos (la escritura de lotes sigue en `dispatchFinishedGoods`/`returnFinishedGoods`; el bloqueo nuevo solo lee).

Tests (nota fechada 2026-10-16, aserciones previas intactas):
- u `tests/unit/inventario/finished-goods-dispatch-prisma.test.ts`: `baseInput` lleva `origin: 'order'`; + 4 casos
  `origen direct` y 3 de `createFinishedGoodsDirectDispatch`.
- u `finished-goods-return-prisma.test.ts` (+1), `batch-movement-prisma.test.ts` (+1).
- int `finished-goods-dispatch.int.test.ts` (+6), `finished-goods-return.int.test.ts` (+3),
  `deliverable-batches.int.test.ts` (+2), `ledger-cuadre.int.test.ts` (+1).
- int `finished-product-detail.int.test.ts`: el rojo heredado de T0 que vio B1; la fila esperada gana
  `withoutOrder: false` y `note: null`.

### R → test
- R9 (parte de `inventario`) → `deliverable-batches.int.test.ts` (`R9: un lote sin contenido de envase no suma…`,
  `R9: ni el producto de otra empresa, ni el dado de baja…`), `finished-goods-dispatch.int.test.ts`
  (`R9: lockForDirectDelivery…`), u `finished-goods-dispatch-prisma.test.ts` (`R9: lockForDirectDelivery…`).
- R32 → `finished-goods-dispatch.int.test.ts` (`R32: el producto de la empresa B…`, `R32: un lote de la empresa B…`,
  `R32: un lote de otro producto… o sin contenido`) + 3 casos `R32` del unitario.
- R34 → `finished-goods-dispatch.int.test.ts` (`R34: si la suma de los clientes para un lote supera…`) + unitario.
- R37 → `finished-goods-dispatch.int.test.ts` (`R37: con un lote repetido entre clientes…`),
  `ledger-cuadre.int.test.ts` (`QC-288 R37, R50: …`), unitarios `R37` (dispatch y `batch-movement-prisma`).
- R50 (parte de `inventario`) → `finished-goods-return.int.test.ts` (3 casos `R50`, dado de baja y empresa B),
  `ledger-cuadre.int.test.ts` (`QC-288 R37, R50`), u `finished-goods-return-prisma.test.ts` (`R50: …`).

### Gate (salida real)
Entorno: `DATABASE_URL`, `DIRECT_URL` y `SEED_*` exportadas solo en el comando desde el `.env` del repo principal.
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: `✖ 9 problems (0 errors, 9 warnings)`, los 9 previos y ajenos.
- `pnpm exec vitest run guard`: `Test Files 1 failed | 79 passed (80)`, `Tests 1 failed | 1097 passed | 20 skipped`.
  El rojo es el conocido de F4 sin confirmar (`guard-formularios-y-acciones` R28,
  `finished-product-deliveries-table.tsx`), ajeno.
- Suites de B2 (integración, base efímera): `finished-goods-dispatch`, `finished-goods-return`,
  `deliverable-batches`, `ledger-cuadre`, `finished-product-detail`: `Test Files 5 passed (5)`, `Tests 48 passed (48)`.
- Llamadores de la salida y la devolución + historial (integración): las 5 anteriores + `order-delivery-void`,
  `order-delivery-concurrency`, `order-delivery-void-concurrency`, `reservation`, `adjust-by-count`,
  `company-scope-queries`: `Tests 2 failed | 147 passed (149)`; los 2 rojos son de `adjust-by-count` en la corrida
  conjunta (no toca nada de B2) y sola da `Tests 11 passed (11)`: intermitencia de entorno.
- Unitarios `tests/unit/inventario tests/unit/pedidos tests/unit/asignaciones` (proyecto node):
  `Test Files 3 failed | 277 passed (280)`, `Tests 4 failed | 5569 passed | 8 skipped | 1 todo`. Los 4 rojos son
  censos ajenos a B2, de código ya confirmado de T0/F2/F4: `pedidos/order-delivery-append-only.test.ts` R32/R33
  (`voidDirectDeliveryAction`, `createVoidDirectDelivery`), `pedidos/module-contract.test.ts` y
  `pedidos/scope.test.ts` R57 (UI de `inventario` y `components/shared` importan `pedidos`). Son de TC.
- `vitest related` no se corrió: `product-prisma.ts` y las fábricas cuelgan de `lib/composition` (conjunto casi
  entero) y el disco C: está casi lleno. Se corrieron las suites nombradas.

Veredicto: B2 hecha; salida y devolución sin pedido y lecturas de `inventario` con R9, R32, R34, R37 y R50 en verde;
los rojos que quedan son ajenos y están señalados.

## B4 — `pedidos`: casos de uso (2026-10-16)

Grafo: sin proyecto para este worktree; Grep/Read.

### Paso 0 (T0: `finishConditioningAlive` no bloquea el producto)
- Puerto nuevo `WaitingOrdersLock.lockWaitingCandidates(pair, scope)` en `ports/direct-delivery-repository.ts`, en el
  ámbito de la transacción como `waitingLock`. Adaptador `createWaitingOrdersLock(tx)` en `direct-delivery-prisma.ts`:
  `SELECT … FROM orders o … status IN (TERMINADO, EN_ACONDICIONAMIENTO) AND EXISTS (línea de esa presentación)
  ORDER BY o.id FOR SHARE OF o`, con la empresa de `companyScopeColumns` (guardia de SQL crudo en verde).
- La receta y la presentación hacen falta antes del bloqueo del producto: `deliverDirect` las lee **sin bloqueo**,
  fuera de la transacción y tras los clientes, con `catalog.findSurplusBases([productId])` (dep nueva `catalog`;
  vacío → `ProductNotFoundError`). Dentro: paso 0 → `lockForDirectDelivery` → si receta/presentación del bloqueo no
  son las leídas, `Error` interno (ningún camino de la app cambia la identidad de un producto terminado) → clave →
  `listWaitingLines` (solo `TERMINADO`) → tope. Orden pedidos → producto → lote.
- Comprobado por mutación: sin la llamada del paso 0, el caso del acondicionamiento de
  `direct-delivery-concurrency.int.test.ts` se pone rojo.

### Archivos
Producción:
- `lib/modules/pedidos/domain/{get-direct-delivery,list-direct-delivery-surplus,deliver-direct,get-direct-delivery-for-void,void-direct-delivery}.ts`: cuerpos reales (§2.6, §3, §4).
- `lib/modules/pedidos/ports/direct-delivery-repository.ts` (+ `WaitingOrdersLock`), `direct-delivery-unit-of-work.ts` (+ `waitingLock`).
- `lib/modules/pedidos/adapters/driven/persistence/direct-delivery-prisma.ts` (+ `createWaitingOrdersLock`).
- `lib/composition/index.ts`: solo lo que piden las suites de integración: catálogo real (`findForDelivery`,
  `findSurplusBases`), lector y repositorio reales y la unidad de trabajo de la entrega con `withOrderTransaction`.
  `deliveryCustomerDirectory` y `listBatchMovements` quedan para B5.
- `deliver-order.ts` y `void-delivery.ts`: sin cambio; las enmiendas de §2.6 ya venían de T0 y aquí se prueban.

Tests:
- Nuevos u: `tests/unit/pedidos/{deliver-direct,void-direct-delivery,get-direct-delivery,list-direct-delivery-surplus,get-direct-delivery-for-void}.test.ts`.
- Nuevos int (`commit`, en `aislamiento.json`): `tests/integration/pedidos/{direct-delivery,direct-delivery-concurrency,direct-delivery-void,direct-delivery-void-concurrency}.int.test.ts`;
  ayudante `tests/helpers/direct-delivery-seed.ts` (sobre `order-delivery-seed.ts`).
- Modificados, con nota fechada y aserciones previas intactas: `deliver-order.test.ts` (+2), `void-delivery.test.ts` (+2),
  `direct-delivery.test.ts` (el `it.todo` de R23 pasa a caso real sobre `deliver-direct.ts`).

### Desvíos menores
- `getDirectDeliveryForVoid`: §2.6 pide líneas, producto y clientes en un `Promise.all`, pero los ids de cliente salen de
  las líneas. Van líneas + producto en paralelo y luego los clientes (una llamada; ninguna si todos están anulados). Un
  cliente sin ref sale con su id corto, como en `list-order-deliveries`.
- `deliverDirect` gana la dep `catalog` (lectura previa del paso 0), que el contrato de T0 no tenía.

### R → test
- R2 → u `deliver-direct`, `get-direct-delivery`, `list-direct-delivery-surplus` («R2: sin entregas.modificar…»).
- R3 → u `void-direct-delivery`, `get-direct-delivery-for-void` («R3: sin entregas.anular…»).
- R4 → los cinco u («R4: … otro rol es aceptado», «R4: un Administrador sin … es rechazado»).
- R8 → u `list-direct-delivery-surplus` («R8: con 1/25/200 productos son una lectura del catalogo y una de los pedidos»,
  forma, lista vacía, pares distintos, ids repetidos).
- R29 → u `deliver-direct` (16 casos de forma, producto y cliente sin uuid, nota de 500) + `get-direct-delivery` (id sin uuid).
- R30 → u `deliver-direct` (catálogo y bloqueo nulos); int `direct-delivery` («R30: producto inexistente, dado de baja, que
  no es terminado o de otra empresa»).
- R31 → u `deliver-direct` (2); int `direct-delivery` («R31: …»).
- R32 → u `deliver-direct`; int `direct-delivery` («R32: un lote de otro producto o de otra empresa»).
- R33 → u `deliver-direct` (12 pasan, 13 no, excedente bajo bloqueo); int `direct-delivery` («R33: 20 en stock y 8 que
  esperan: 13 … y 12 pasan», «R33: una linea de entrega anulada vuelve a esperar…»).
- R34 → u `deliver-direct`; int `direct-delivery` («R34: dos clientes que juntos piden a un lote mas…»).
- R35 → u `deliver-direct` (orden pedidos → producto → lectura); int `direct-delivery-concurrency` (dos entregas 7 + 7;
  una sin pedido a la vez que una de pedido; el acondicionamiento retenido que la entrega espera: paso 0).
- R36, R37 → u `deliver-direct` (create, dispatch, addLines, nota); int `direct-delivery` («R36: …», «R37: …»).
- R38 → u `deliver-direct` (6), `deliver-order` («QC-288 … R38» ×2); int `direct-delivery` («R38: la misma clave…»,
  «R38: la clave de una entrega de pedido…», empresa B).
- R39 → u `deliver-direct` (fallos dentro de `run`); int `direct-delivery` (fallo forzado tras la salida; lote ajeno en el
  segundo cliente).
- R44 (dominio) → u `get-direct-delivery-for-void`; int `direct-delivery-void` («R44: …»).
- R47 → u `void-direct-delivery` (10 de forma + cliente sin líneas); int `direct-delivery-void` («R47: …»).
- R48 → u `void-direct-delivery`, `get-direct-delivery-for-void`, `void-delivery` («QC-288 … R48» ×2); int
  `direct-delivery-void` («R48: …», empresa B).
- R49 → u `void-direct-delivery` (2); int `direct-delivery-void` («R49: …»).
- R50 → u `void-direct-delivery` (3); int `direct-delivery-void` («R50: guarda la anulacion…», «R50: con el producto dado
  de baja…»).
- R51 → u `void-direct-delivery` (clave ×5, fallo de la devolución); int `direct-delivery-void` (clave, clave de pedido,
  fallo forzado), `direct-delivery-void-concurrency` (dos anulaciones que comparten cliente; misma clave a la vez).
- R23 (mitad del servidor) → u `direct-delivery.test.ts` («R23: deliver-direct.ts toma del dominio las reglas…»).

### Gate (salida real)
Entorno: `DATABASE_URL`, `DIRECT_URL` y `SEED_*` exportadas solo en el comando desde el `.env` del repo principal.
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: `✖ 9 problems (0 errors, 9 warnings)`, los 9 previos y ajenos.
- Unitarios de B4 (`deliver-direct`, `void-direct-delivery`, `get-direct-delivery`, `list-direct-delivery-surplus`,
  `get-direct-delivery-for-void`, `direct-delivery`, `deliver-order`, `void-delivery`): `Test Files 8 passed (8)`,
  `Tests 283 passed (283)`.
- Integración, las cuatro suites de B4: `Test Files 4 passed (4)`, `Tests 29 passed (29)`.
- Integración vecina (`direct-delivery-repository`, `order-delivery`, `order-delivery-void`, `order-delivery-concurrency`,
  `direct-delivery-constraints`): `Test Files 5 passed (5)`, `Tests 61 passed (61)`.
- `pnpm exec vitest run --project node tests/unit/pedidos`: `Test Files 3 failed | 99 passed (102)`,
  `Tests 4 failed | 2170 passed | 3 skipped`. Los 4 rojos son los censos de TC ya vistos en B2, sin empeorar:
  `order-delivery-append-only` R32/R33 (`voidDirectDeliveryAction`, `createVoidDirectDelivery`, nombres de T0),
  `module-contract` (`direct-delivery-draft.ts`, F2) y `scope` R57 (UI de `inventario` y `components/shared`).
- `pnpm exec vitest run guard`: `Test Files 1 failed | 79 passed (80)`, `Tests 1 failed | 1098 passed | 20 skipped`; el
  rojo es el conocido `guard-formularios-y-acciones` R28 de F4 sin commit.
- `vitest related` no se corrió: los archivos cuelgan de `lib/composition` (conjunto casi entero) y el disco C: está al 98 %.

Veredicto: B4 hecha; los cinco casos de uso, con el paso 0 y sus transacciones, tienen R2–R4, R8, R29–R39 y R47–R51 en verde.

## B5 — Actions, composición y lecturas de `inventario` (2026-10-16)

Grafo: sin proyecto para este worktree; Grep/Read.

### Archivos
Producción:
- `lib/modules/pedidos/adapters/driving/order-actions.ts`: **sin cambio**. Las cinco actions ya tenían su cuerpo
  real desde T0 (actor con `currentActor()` una vez, `pedidos.<caso>`, `toErrorState`); B5 solo lo verifica con el censo.
- `lib/composition/index.ts`: `deliveryCustomerDirectory` deja de ser un doble y se ata a
  `findCustomerIdsForMovements` (B3). Dos líneas; el resto del atado de §6 ya lo hizo B4. No quedan dobles de QC-288.
- `lib/modules/inventario/domain/list-batch-movements.ts`: refs solo de `direct_delivery` (entrega) y
  `direct_delivery_void` (solo la anulación), una llamada a `deliveryCustomers` en el mismo `Promise.all` que autores y
  pedidos (ninguna si no hay refs) y luego una a `customers.findRefsIncludingDeleted` (ninguna sin ids). Nombres
  `nombres apellidos`, orden `localeCompare('es')`; el id que no vuelve sale tal cual. Salida campo a campo: las
  referencias `orderDeliveryId`/`orderDeliveryVoidId` ya no se filtran por el spread (nota de B2).
- `lib/modules/inventario/domain/list-finished-product-deliveries.ts`: **sin cambio**; `withoutOrder`, `note` y los números
  solo para `orderId` no nulo ya estaban (T0/B3). B5 añade sus pruebas.

Tests:
- Nuevo u `tests/unit/inventario/list-batch-movements.test.ts` (6 casos R54).
- u `list-finished-product-deliveries.test.ts`: + bloque «entregas sin pedido» (3 R52, 1 R53), nota fechada.
- u `tests/unit/identity/session-once-per-request-actions.test.ts`: `ACCIONES` + las cinco actions, nota fechada.

### R → test
- R52 → u `list-finished-product-deliveries` («R52: la fila sin pedido sale con withoutOrder, su nota…», «R52: solo se
  piden numeros para los orderId no nulos», «R52: una pagina solo de entregas sin pedido no llama al directorio…»).
- R53 → u `list-finished-product-deliveries` («R53: el total entregado es el del directorio sobre todos los lotes…»).
- R54 (dominio) → u `list-batch-movements` (6 casos «R54: …»); adaptador ya en int `order-delivery-directory` (B3).

### Gate (salida real)
Entorno: `DATABASE_URL`, `DIRECT_URL` y `SEED_*` exportadas solo en el comando desde el `.env` del repo principal.
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: `✖ 9 problems (0 errors, 9 warnings)`, los 9 previos y ajenos; los archivos de B5, limpios.
- Unitarios: `list-batch-movements`, `list-finished-product-deliveries`, `session-once-per-request-actions`,
  `pedidos/order-actions`, `adjust-batch-stock`, `inventario/authorization`: `Test Files 6 passed (6)`, `Tests 233 passed (233)`.
- Integración: `direct-delivery`, `direct-delivery-concurrency`, `direct-delivery-void`, `direct-delivery-void-concurrency`,
  `order-delivery-directory`: `Test Files 5 passed (5)`, `Tests 51 passed (51)`.
- `pnpm exec vitest run guard`: `Test Files 1 failed | 79 passed (80)`, `Tests 1 failed | 1098 passed | 20 skipped`; el
  rojo es el conocido `guard-formularios-y-acciones` R28 de F4 sin commit.
- `vitest related` no se corrió sobre `lib/composition/index.ts` (conjunto = suite entera; disco C: casi lleno).

Veredicto: B5 hecha; composición sin dobles y R52–R54 de dominio en verde; los censos de TC siguen igual.

## TC — Barrido de censos y guardias (backend_dev, 2026-10-19)

Sobre `593450fc` (merge de `origin/dev` con QC-263 y QC-166). Sin cambios en código de producción.

### Archivos
- `tests/unit/pedidos/order-delivery-append-only.test.ts` — nota QC-288; `NOMBRES_ADMITIDOS` se amplía
  con `createVoidDirectDelivery` y `voidDirectDeliveryAction` (cerrada: cuatro y solo cuatro; los dos de
  QC-224 se siguen afirmando aparte); bloque nuevo «la entrega sin pedido es solo de inserción (QC-288 R41)»:
  `direct-delivery-prisma.ts` en el barrido, solo `orderDelivery.create`/`orderDeliveryLine.createMany`, sin
  `update`/`delete`/`upsert`; los dos nombres nuevos exportados una vez en `lib/` y su archivo limpio; caso
  sintético con un tercer nombre que sigue en rojo.
- `tests/unit/pedidos/scope.test.ts` (R57) — `CONSUMIDORES_DE_LA_ENTREGA_SIN_PEDIDO`, exclusión nombrada por
  ARCHIVO (7 de `inventario`, 2 de `components/shared`); `consumosPorDentroDelModulo` intacto; anclas nuevas:
  cada nombre consume de verdad `pedidos`, y otro archivo de `inventario` o de `components/shared` sigue cayendo.
- `tests/unit/pedidos/module-contract.test.ts` («un solo archivo driving») — la misma lista por archivo; esos
  archivos siguen obligados a consumir solo el barrel o el driving por ruta exacta; ancla: los nueve se ven.
- `tests/guards/guard-buscadores.test.ts` — la ruta vieja del buscador es registro HISTÓRICO de QC-233
  (`NO_SE_TOCAN_R21` solo se aplica al diff de la rama de QC-233 y el detector compara contra esa lista):
  texto conservado y nota fechada en la lista y en el caso sintético. No es censo vivo.
- `specs/QC-288-entrega-sin-pedido/tasks.md` — TC `[x]`.

### design.md §9, fila por fila
| Fila | Resultado |
|---|---|
| `guard-identificador-de-request` | verificada: las dos migraciones están (l. 738–739); `entrega-sin-pedido.spec.ts` es de TI |
| `inventario-schema.test.ts` | verificada (enmendada en B1/T0) |
| `pedidos-schema.test.ts` | verificada (enmendada en B1) |
| `order-delivery-constraints` / `order-delivery-void-constraints` (int) | sin cambio, verdes: `Test Files 2 passed (2)`, `Tests 25 passed (25)` |
| `clientes/scope.test.ts` | sin cambio, verde |
| `inventario/scope.test.ts`, `company-scope.test.ts` | sin cambio, verdes; el censo de migraciones de `scope` mide modelos aislados por empresa, no FK hacia `products` |
| `guard-libro-de-inventario`, `qc121-alcance`, `qc91-alcance` | sin cambio, verdes; el diff contra `origin/dev` en `lib/` y `app/` no añade ni quita ningún `productBatch.create/update/upsert/delete` ni `UPDATE/INSERT/DELETE` sobre `product_batches` |
| `order-delivery-append-only` | **enmendada** (arriba) |
| `pedidos/module-contract.test.ts` | **enmendada**: §9 decía «sin cambio», pero los consumidores de `/inventario` y `components/shared` (§7.1, §7.2, §7.4) la ponían en rojo |
| `pedidos/scope.test.ts` R57 | **enmendada** (no estaba en §9; mismo motivo) |
| `session-once-per-request-actions` | verificada (enmendada en B5) |
| `finished-product-route-contract` | verificada (enmendada en F4) |
| `product-route-contract` | verde, sin cambio |
| `guard-catalogo-de-componentes` + `CATALOGO.md` | verificada: tres filas (l. 79–81) |
| `aislamiento.json` | verificada: las 7 suites `.int.test.ts` nuevas tienen modo |
| `tests/unit/errores/*` | verificada: `delivery_exceeds_surplus` (catalogo.test.ts l. 81) |
| `guard-buscadores` | nota histórica (arriba) |

### R → test
- R1 → sin cambio en `lib/modules/identity/domain/permissions.ts` ni en ninguna migración/seed de permisos
  (diff contra `origin/dev`); lo fijan `tests/unit/identity/permissions.test.ts` («R2: contiene exactamente los
  códigos…», `SEED_ROLE_PERMISSIONS[...]).toEqual(...)`, «R1: ningún otro rol recibe entregas.modificar/anular») y
  `tests/guards/guard-permisos-sembrados.test.ts`, verdes sin editarse.
- R41 → `order-delivery-append-only.test.ts` («R41: el adaptador de la entrega sin pedido…», «R41: los dos nombres
  de la anulación sin pedido…», «R41: un tercer nombre…», y R32/R33 ampliados), además de los de B1.

### Gate (salida real)
Entorno de integración: `.env` del repo principal exportado solo en el comando.
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, todos previos y ajenos; los 4 archivos tocados, limpios.
- `pnpm exec vitest run guard`: `Test Files 81 passed (81)`, `Tests 1109 passed | 20 skipped (1129)`.
- `pnpm exec vitest run tests/unit/pedidos tests/unit/inventario tests/unit/inventario-ui tests/unit/pedidos-ui
  tests/unit/errores tests/unit/identity tests/unit/clientes`: `Test Files 470 passed (470)`,
  `Tests 8720 passed | 44 skipped (8764)`.
- Censos de lotes y permisos (`qc121-alcance`, `qc91-alcance`, `guard-libro-de-inventario`, `permissions`,
  `guard-permisos-sembrados`): `Test Files 5 passed (5)`, `Tests 197 passed (197)`.

Veredicto: TC hecha; cuatro censos enmendados con nota y lista por archivo, ninguna violación de diseño, sin tocar producción.

## TI — E2E (frontend_dev, 2026-10-19)

### Archivos
- `e2e/entrega-sin-pedido.spec.ts` (nuevo).
- `tests/guards/guard-identificador-de-request.test.ts`: alta de `entrega-sin-pedido.spec.ts` en `E2E_ESPERADOS`
  (nota 2026-10-19).
- `specs/QC-288-entrega-sin-pedido/tasks.md`: TI `[x]`.

Base local (`localhost`): `pnpm run db:migrate` aplicó `20261016130000_inventory_movement_kind_direct_delivery` y
`20261016130100_direct_deliveries` (aditivas; nada revertido ni reseteado).

### R → test
- R56 → `e2e/entrega-sin-pedido.spec.ts`:
  - «R56: entrega sin pedido a dos clientes que comparten un lote con nota, tope del excedente, tab Entregas con
    «Sin pedido», anulacion de un cliente e historial del lote»: viñetas 1, 2, 4 y 5 (Postgres: una entrega con
    `order_id` NULL, `product_id` y nota; tres líneas por cliente y lote; un asiento `direct_delivery` por lote con
    la suma; existencia de cada lote; pedido intacto y ninguna entrega de pedido; anulación solo de A, lote 1 +3,
    B conserva sus dos líneas; historial con «Entrega sin pedido» + «Ana…, Bea…» y la anulación con A).
  - «R56: un producto sin excedente no tiene «Entregar» ni en la cabecera de su ficha ni en el menu de su fila; el
    que tiene excedente lo ofrece despues de «Lotes»»: viñeta 3.

### Salida real
- `pnpm exec playwright test e2e/entrega-sin-pedido.spec.ts`: `4 passed (2.2m)` (2 tests × chromium/webkit).
- Los cuatro citados, primera corrida (6 workers): `7 failed, 5 passed (6.3m)`. Seis eran `page.waitForURL: Timeout
  60000ms` en el login de chromium (saturación de `next dev` con 6 workers en frío).
- Los cuatro citados, segunda corrida `--workers=2`: `2 failed, 10 passed (3.0m)`:
  - `entrega-a-varios-clientes.spec.ts`: 2/2 passed.
  - `anular-entrega.spec.ts`: 4/4 passed.
  - `producto-terminado.spec.ts`: 2/2 passed.
  - `detalle-de-producto-terminado.spec.ts`: 2 passed, 2 failed («R31, R27, R26: tras una entrega parcial…», en
    chromium y webkit). Paso 4, l. 548: `getByTestId('finished-stock-name').filter(receta)` → `Received: 2`
    (`Expected: 1`). En la pestaña «Producto terminado» de `/inventario` el nombre del grupo sale en la fila y en
    la tarjeta del rediseño QC-263. El spec, `finished-stock-columns.tsx` y `components/shared/data-table` no
    cambian contra `origin/dev`, y QC-288 no toca ese paso. No se reescribe aquí; no se corrió sobre `origin/dev`.
    Así queda para el leader.
  Ninguno de los cuatro necesitó cambios de import ni de selector por F1/F4.
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, todos previos; los dos archivos tocados, limpios.
- `pnpm exec vitest run guard`: `Test Files 81 passed (81)`, `Tests 1109 passed | 20 skipped (1129)`.

Veredicto: TI hecha; el E2E de R56 queda en verde en los dos navegadores. Hay un rojo ajeno en
`detalle-de-producto-terminado.spec.ts` (selector roto por QC-263 en dev), que queda reportado.

## Revisión vuelta 1

### H3 — Cabecera «Acciones» solo para lector en la tab Entregas (frontend_dev, 2026-10-19)
- No había mecanismo previo. Extensión opcional `srOnlyLabel?: boolean` en `DataTableColumn`
  (`data-table-types.ts`), pintada como `sr-only` en `DataTableHeaderCell` (`data-table-header-menu.tsx`) y
  aceptada por `actionsColumn` (`actions-column.tsx`), que solo la añade si vale `true`: los usuarios actuales no
  cambian (el `toEqual` de R24 sigue en verde). Fila de `DataTable` en `components/shared/CATALOGO.md` actualizada.
- Solo la usa `finished-product-deliveries-table.tsx`.
- Tests: `finished-product-tables.test.tsx` «R43 — la cabecera de la columna de acciones se llama «Acciones» y
  solo la ve el lector de pantalla»; `tests/unit/shared-ui/actions-column.test.tsx`: por defecto visible / con
  `srOnlyLabel` oculta y con nombre accesible.
- `pnpm run typecheck`: exit 0. `pnpm run lint`: 0 errors, 10 warnings (previos).
- `vitest run tests/unit/inventario-ui tests/unit/shared-ui tests/unit/shared/data-table.test.tsx`: 71 files, 865 passed.
- `vitest run guard`: 81 files, 1109 passed | 20 skipped.
