# impl QT-313 — pedido-con-varias-recetas-backend

## Fase 1 — Modelo (backend_dev, 2026-11-03)

Hechas: **T0** y **T1** (commit 8b79a3328) y **T2** tras la enmienda df0c5c21f (paso 1 de 2: `order_line_id` nullable).

### Archivos

Creados:
- `db/migrations/20261103115900_order_status_partial/migration.sql` + `down.sql`
- `db/migrations/20261103120000_order_lines/migration.sql` + `down.sql`
- `tests/helpers/migration-script.ts` (ejecutar migration/down reales en transaccion con ROLLBACK)
- `tests/unit/pedidos/order-classification.test.ts`
- `tests/unit/integraciones/whatsapp-chat-context.test.ts`
- `tests/integration/pedidos/order-status-partial-migration.int.test.ts`
- `tests/integration/pedidos/order-lines-migration.int.test.ts`

Modificados (produccion):
- `db/schema.prisma` — `PARCIAL` primero en `OrderStatus`; modelo `OrderLine` (`@module pedidos`); `Order.lines`
- `lib/modules/pedidos/domain/order-classification.ts` — `PARCIAL` primero en `ORDER_STATUS_VALUES` y `ORDER_STATUS_FLOW`; `OrderLineStatus`; comentario corregido
- `lib/modules/pedidos/index.ts` — exporta `OrderLineStatus`
- `lib/modules/pedidos/domain/order-transitions.ts`, `order-cancellation.ts` — mapas `Record<OrderLineStatus,…>`; `PARCIAL` nunca transiciona ni se cancela como estado
- `lib/modules/asignaciones/domain/order-state.ts`, `count-evidence-locking-orders.ts` — mapas `OrderLineStatus`
- `lib/modules/pedidos/domain/set-order-customer.ts` — `PARCIAL` admite cambio de cliente
- `lib/shared/ui/order-status.ts` — «Parcial», tono `progress`
- `lib/modules/integraciones/domain/whatsapp-chat-context.ts` — `PARCIAL` → «en preparación»
- `app/(private)/pedidos/components/order-row-actions.tsx`, `order-delivery-list.tsx` — clave `PARCIAL` en los mapas totales
- `scripts/seed-demo/data.ts` — `PARCIAL` en `UNREACHABLE_ORDER_STATUSES`

Tests existentes ajustados: lista al final de `tasks.md > Archivos esperados`.

### Mapa R<n> → test (fase 1)

| R | Test |
|---|---|
| R2 | `order-lines-migration.int.test.ts` › «R2: la base rechaza una linea cuya empresa no es la de su pedido», «R2: order_lines tiene RLS activada y forzada» |
| R5 | `order-lines-migration.int.test.ts` › «R5: la base rechaza dos lineas activas con la misma original, y tambien original + version», «R5: la base admite la misma original si una de las dos esta cancelada o quitada» |
| R6 | `order-lines-migration.int.test.ts` › «R6: la base rechaza dos lineas con la misma posicion en un pedido» (parcial: el orden de lectura es T8/T13) |
| R7 | `order-lines-migration.int.test.ts` › «R7: cada pedido, borrados incluidos, queda con exactamente una linea…», «R7: la bajada quita la tabla y deja orders como estaba» |
| R15 | `order-lines-migration.int.test.ts` › «R15: la base rechaza cantidad 0 y precio de linea negativo, y admite precio 0» |
| R48 | `order-lines-migration.int.test.ts` › «R48: la base rechaza una linea PARCIAL»; `order-classification.test.ts` › «R48: PARCIAL no es origen ni destino…» |
| R50 | `order-classification.test.ts` › «R50: PARCIAL no esta entre los estados que dejan de estar en curso»; `tests/unit/integraciones/whatsapp-chat-context.test.ts` › «R50: un pedido PARCIAL cuenta como abierto…» |
| R52 | `order-classification.test.ts` › «R52: PARCIAL es el primero de la lista…», «R52: PARCIAL va delante de PENDIENTE…»; `order-status-partial-migration.int.test.ts` › los cuatro casos R52 (enum, orden asc/desc, bajada que aborta, bajada limpia) |
| R53 | `tests/unit/shared-ui/order-status.test.ts` › «R53 — se nombra «Parcial» con el tono progress»; `tests/unit/integraciones/whatsapp-chat-context.test.ts` › «R53: un pedido PARCIAL se lee «en preparación»» |
| R8 | `tests/integration/pedidos/order-lines-references-migration.int.test.ts` › «R8, R37: los conteos de las seis tablas no cambian y toda fila de un pedido de una linea apunta a ella, delivery_void con la misma linea que su delivery», «R8: un pedido creado sin linea antes de la migracion la recibe…», «R8: la bajada se niega si una fila con linea es de un pedido de varias lineas…» y otros cinco R8 |
| R37 (base, paso 1) | mismo archivo › «R37: la base rechaza linea en un asiento opening o adjustment y la admite en los cuatro tipos con pedido» |

### Verificacion (salida real)

- `pnpm run typecheck` → exit 0 (tras `pnpm exec next typegen`; sin el, `LayoutProps` falta, error de entorno conocido)
- `pnpm run lint` → 0 errores, 10 warnings, ninguno en archivos de esta tanda
- `pnpm exec vitest related --run --project node --project ui <archivos de T0>` → primera corrida 5 archivos rojos por listas de estados escritas a mano (ajustados); los 5 vueltos a correr: `Test Files 5 passed (5)`, `Tests 322 passed (322)`. Corrida completa del related: `Test Files 5 failed | 532 passed (537)` antes del ajuste.
- Unit de T0: `Test Files 9 passed (9)`, `Tests 272 passed (272)`
- `vitest related` de los ultimos cambios (`set-order-customer.ts`, `seed-demo/data.ts`, `order-row-actions.tsx`): `Test Files 506 passed (506)`, `Tests 9545 passed | 2 skipped`
- `eslint` sobre los archivos tocados: 0 errores
- Integracion (base efimera, plantilla reconstruida con las migraciones nuevas): `order-status-partial-migration`, `order-lines-migration`, `order-status-blocked-rollback`, `order-conditioning-states-rollback` → `Test Files 4 passed (4)`, `Tests 17 passed (17)`
- Integracion de todos los `.int` que leen un `down.sql` (56 archivos): 1 rojo (`pedidos/company-scope`, la FK nueva colgaba de `orders_id_company_id_key`), ajustado y vuelto a correr: `Tests 12 passed (12)`
- `pnpm exec vitest run guard` → `Test Files 87 passed (87)`, `Tests 1327 passed | 22 skipped`

### T2 (2026-11-03, tras la enmienda)

Archivos: `db/migrations/20261103120100_order_lines_references/{migration.sql,down.sql}` (nuevos),
`tests/integration/pedidos/order-lines-references-migration.int.test.ts` (nuevo), `db/schema.prisma`
(`orderLineId String?` + indice en los seis modelos), `tests/guards/guard-identificador-de-request.test.ts`,
`tests/integration/aislamiento.json`.

Verificacion (salida real):
- `pnpm run typecheck` → sin errores; `pnpm run lint` → 0 errores
- `order-lines-references-migration.int` → `Test Files 1 passed (1)`, `Tests 8 passed (8)` (plantilla reconstruida)
- 16 `.int` que bajan o tocan estas tablas/migraciones → `Test Files 16 passed (16)`, `Tests 133 passed (133)`
- `pnpm exec vitest run guard` → `Test Files 87 passed (87)`, `Tests 1327 passed | 22 skipped`
- Pendiente de CI: que ningun `.int` no corrido compare filas enteras de las seis tablas con `toEqual` (ahora llevan `orderLineId: null`).

El bloqueo original de T2 lo resolvio la enmienda del spec (T2 en dos pasos; el paso 2 es T14e).

## Decisiones del humano (2026-11-03) sobre lo hecho fuera del spec en T3–T6

- Todas las lineas canceladas: costes totales `"0.0000"`, precio total `null`. Se queda; lo fija un test en `order-totals.test.ts`.
- Quitar la linea X y anadir otra X en la misma edicion: admitido; el adaptador escribe bajas antes que altas por el indice unico parcial. Test de integracion en T10.
- Aceptadas tal cual: `id` repetido en una edicion → `invalid_input`; `id` de linea cancelada sin cambios pasa, con cambios → `invalid_transition`; `deriveOrderStatus([])` lanza error de programacion; textos «El pedido ya tiene esa fórmula.» y «Esa fórmula ya no se puede quitar del pedido.».
- Nombres de los esquemas de T6 provisionales: T9, T10 y T14c los renombran a los del design y borran los planos.

## Fase 2 — Dominio puro (T3–T6, 2026-11-03)

Archivos: `lib/modules/pedidos/domain/{order-status-derivation,order-totals,order-line-diff,order-line-removal}.ts` (nuevos), `order-input.ts`, `order-edit-change.ts`, `errors.ts`, `lib/modules/errores/domain/{error-codes,error-catalog}.ts`; tests `tests/unit/pedidos/{order-status-derivation,order-totals,order-line-diff,order-input-lines}.test.ts` (nuevos), `tests/unit/errores/catalogo.test.ts`, `tests/unit/pedidos/module-contract.test.ts`.

Mapa R → test:
| R | Test |
|---|---|
| R3, R15, R42 | `order-input-lines.test.ts` |
| R4, R20, R22, R23, R24 | `order-line-diff.test.ts` (p. ej. «R4: la original y una version suya son la misma receta», «R23: quitar una EN_CURSO rechaza con order_line_not_removable…», «R24: una linea en estado no editable con cambios rechaza con invalid_transition») |
| R16, R18, R33 | `order-totals.test.ts` (incl. «R16, R18: todas canceladas: costes 0.0000 y precio null», «R33: TERMINADO y ENTREGADO cuentan como terminadas») |
| R34 | `order-status-derivation.test.ts` |

Verificacion (salida real, backend_dev de cierre):
- `pnpm run typecheck` → exit 0; `pnpm run lint` → 0 errores
- `vitest related --run` (node + ui + integration, base efimera) → 1184 archivos / 19939 tests en verde (node 576, ui 362, integration 246)
- `pnpm exec vitest run guard` → 87 archivos en verde

## Fase 3 — Reserva y consumo por linea (T7, 2026-11-03)

Archivos de produccion: `lib/modules/inventario/domain/{reservation,order-consumption,inventory-movement}.ts`, `lib/modules/inventario/index.ts`, `lib/modules/inventario/adapters/driven/persistence/{reservation-prisma,order-consumption-prisma,batch-movement-prisma,product-prisma}.ts` (en `product-prisma.ts` solo `consumeBatchStock`), `lib/modules/pedidos/ports/order-write-repository.ts` y `adapters/driven/persistence/order-prisma.ts` (`findOnlyLineId`), y los llamantes de `pedidos`: `create-order`, `delete-order`, `expire-stale-orders`, `order-cancellation`, `order-packing`, `order-requirement`, `review-blocked-orders`, `transition-order`, `update-order-presentation-lines`, `update-order`.
Tests: nuevo `tests/integration/pedidos/order-lines-repository.int.test.ts`; ampliados `tests/integration/inventario/{reservation,order-consumption-ledger}.int.test.ts`; ajustados los listados en `tasks.md > Archivos esperados` (bloque de la fase 3).

Mapa R → test:
| R | Test |
|---|---|
| R12 | `reservation.int` › «QT-313 R12, R37: dos lineas que comparten insumo apartan en orden; la segunda ve lo que aparto la primera» |
| R27 | `reservation.int` › «QT-313 R27, R37: liberar una linea asienta solo su release y deja intacto lo de la otra» |
| R36 | `reservation.int` › «QT-313 R36, R37: consumir una linea consume solo lo suyo y el asiento consumption lleva su linea» |
| R37 (reserva y consumption) | `reservation.int` › los tres de arriba, «QT-313 R37: liquidar los envases de una linea…», «QT-313 R37: con orderLineId null el pedido aparta, libera y consume como hoy…»; `order-lines-repository.int` › cuatro de `findOnlyLineId` (una linea, ninguna, otra empresa, quitada/dos vivas) |
| R38 | `order-consumption-ledger.int` › «QT-313 R38: lee solo los asientos consumption de la linea pedida; con null, solo los del pedido sin linea» |

Verificacion (salida real):
- backend_dev: `pnpm run typecheck` exit 0, `pnpm run lint` 0 errores, guardias en verde, los 3 `.int` de «Hecho» `Tests 46 passed (46)`, unit tocados en verde. Su `vitest related` completo murio por memoria.
- implementer, integracion en tandas con `--maxWorkers=1` (base efimera):
  - `settle-packaging`, `qc195-packaging-catalog`, `qc195-packaging-list`, `order-unit-of-work`, `order-unit-conversion`, `qc195-packaging-reservation` → `Test Files 6 passed (6)`, `Tests 45 passed (45)`
  - `order-reservation`, `order-reservation-concurrency`, `order-reservation-tools`, `order-crud`, `order-expiry`, `review-blocked-orders`, `order-packing`, `order-conditioning`, `order-repository`, `order-cost-quote`, `order-ingredients-cost`, `actual-order-cost` → `Test Files 12 passed (12)`, `Tests 142 passed (142)`
  - `company-scope`, `company-scope-queries`, `finish-with-finished-goods`, `order-customer`, `order-sale-price`, `order-content-copy`, `order-delivery-repository`, `order-delivery-void`, `direct-delivery-void`, `order-packed-counts`, `pedidos-constraints`, `order-lines-repository`, `order-finished-at`, `order-duplicate-number` → `Test Files 14 passed (14)`, `Tests 193 passed (193)`
- Base huerfana `qct_qt313pedidoc_db1ee7f3_mw15rf1o_pew`: ya no existia al consultarla (`pg_database` sin `qct_qt313%`); la barrio la corrida siguiente.

Desviaciones aceptadas por el humano (2026-11-03):
- `inventory-movement.ts` tocado (anadido a Archivos esperados).
- `findOnlyLineId` lanza si hay mas de una linea viva: valido porque antes de T9 no hay pedidos de varias lineas. **T14e lo elimina junto con el `orderLineId: null`.**
- **Para revisar en T8–T13:** (1) `findReservedAndAvailableByBatch` y `findCoverageByOrderIds` siguen agrupando por pedido, no por linea; (2) el doble `tests/helpers/order-unit-of-work-double.ts` devuelve `null` en `findOnlyLineId`.

## Fase 4 — T8 Puertos y persistencia de linea (2026-11-04)

Archivos de produccion: `lib/modules/pedidos/ports/{order-write-repository,order-repository}.ts`, `lib/modules/pedidos/adapters/driven/persistence/order-prisma.ts`, `lib/modules/pedidos/domain/order-view.ts` (`OrderLineRow`), `lib/composition/index.ts`.
Tests: `tests/integration/pedidos/order-lines-repository.int.test.ts` (ampliado), `tests/unit/pedidos/order-view.test.ts`, `tests/helpers/order-unit-of-work-double.ts` y 16 `.int` de `pedidos` ajustados (listados en `tasks.md > Archivos esperados`).

Mapa R → test (`order-lines-repository.int`):
| R | Test |
|---|---|
| R5 | «QT-313 R5: anadir la version de una receta que ya esta activa lanza duplicate_order_recipe», «QT-313 R5: con la linea de esa receta cancelada, o quitada en la misma escritura, la receta se vuelve a anadir», «QT-313 R5: dos altas a la vez de la misma receta en el mismo pedido: una entra y la otra es duplicate_order_recipe» |
| R6 | «QT-313 R6: leer y bloquear devuelven las lineas por position…», «QT-313 R6: las altas toman position despues de la mayor del pedido…» |
| R34 (persistencia) | «QT-313 R34: el estado del pedido se deriva de sus lineas; todas canceladas dan CANCELADO con el motivo de la ultima» |
| R41 (persistencia) | «QT-313 R41: el plazo de una linea se escribe sin mover su updated_at ni tocar la otra» |
| R43 | «QT-313 R43: leer las lineas con el ambito de otra empresa devuelve [] y bloquear devuelve null», «QT-313 R43: una linea de otro pedido o quitada no se bloquea…», «QT-313 R43: una escritura de lineas que nombra una linea de otro pedido devuelve null y no la toca» |

Verificacion (salida real):
- backend_dev: `pnpm run typecheck` exit 0, `pnpm run lint` 0 errores, guardias en verde, `vitest related --project node` → `Test Files 124 passed`, `Tests 2871 passed`; `order-lines-repository.int` → 14/14.
- implementer, `vitest related --project ui --maxWorkers=1` (archivos de produccion de T8) → `Test Files 1 failed | 337 passed (338)`, `Tests 1 failed | 5612 passed | 1 skipped`. El rojo: `tests/unit/inventario/batch-history.test.tsx` › «R23 — cerrar el historial con Escape…», `Test timed out in 20000ms` (corria en paralelo con la integracion). Solo: `Test Files 1 passed (1)`, `Tests 33 passed (33)`. No lo toca T8.
- implementer, integracion `--maxWorkers=1`:
  - tanda A (finish-with-finished-goods, order-content-copy, order-cost-quote, order-customer, order-delivery-concurrency, order-delivery-void-concurrency, order-delivery-void, order-ingredients-cost) → `Test Files 8 passed (8)`, `Tests 93 passed (93)`
  - tanda B (order-reservation-concurrency, order-reservation-tools, order-reservation, order-unit-conversion, qc170-distribution-company-scope, qc170-distribution-concurrency, qc195-packaging-reservation, review-blocked-orders, order-lines-repository) → `Test Files 1 failed | 8 passed (9)`, `Tests 2 failed | 92 passed (94)`: los dos de `qc170-distribution-concurrency` por `Test timed out in 20000ms` con la corrida de ui en paralelo. Repetido solo → `9 passed (9)`; con sus vecinos dos veces → `Test Files 3 passed (3)`, `Tests 32 passed (32)` y `3 passed (3)`, `32 passed (32)`. Sin reproducir. Si CI lo vuelve a dar, mirar el orden de bloqueos de T8 (pedido y luego lineas).

Decisiones del humano sobre T8 (2026-11-04):
- Aceptados: `OrderLineRow` en `order-view.ts`, `setLineStatus`, `setLineIngredientsCost` y el borrado fisico del reparto de una linea quitada.
- **Intercambio de recetas en una edicion** (A de X a Y y B de Y a X): lo resuelve T10, escribiendo primero las lineas que cambian de receta en un orden que no viole el indice, o con receta temporal. Si no hay forma limpia, parar y preguntar antes de rechazarlo.
- **CHECK viejos de `orders` frente a `refreshStatus`:** los cubre T14a con un test que derive un estado de empaque o terminado.
- **Limitacion transitoria:** en T9 `create` recibe `presentationLines: []`; hasta T14d dos lineas no pueden compartir presentacion.

## Fase 4 — T9 Alta con lineas y T10 Edicion con lineas (2026-11-04, enmienda 984d0b4d2)

Produccion: `pedidos/domain/{create-order,update-order,update-order-presentation-lines,quote-order-cost,resolve-ingredients-cost,order-input,order-line-diff,order-edit-change,order-view}.ts`, `pedidos/domain/list-order-line-ids.ts` (nuevo), `pedidos/index.ts`, `pedidos/ports/order-write-repository.ts`, `pedidos/adapters/driven/persistence/order-prisma.ts`, `pedidos/adapters/driving/order-actions.ts` (puente), `inventario/domain/{costing-batch,product-catalog,packaging-catalog}.ts`, `inventario/index.ts`, `inventario/adapters/driven/persistence/{product-catalog-prisma,packaging-catalog-prisma,reservation-prisma}.ts`, `lib/composition/index.ts`, `scripts/seed-demo/gateway.ts`. Sin cambios en `app/`, `tests/unit/pedidos-ui` ni `errores/domain/error-state.ts`.
Tests nuevos: `tests/unit/pedidos/{create-order-lines,update-order-lines}.test.ts`, `tests/integration/pedidos/order-lines-use-cases.int.test.ts`, helper `tests/helpers/single-recipe-order.ts`; ~40 ajustados (lista en `tasks.md > Archivos esperados`).

Mapa R → test (Unit-alta = `create-order-lines.test.ts`, Unit-edicion = `update-order-lines.test.ts`, Int = `order-lines-use-cases.int.test.ts`, prefijo «QT-313» en Int):
| R | Test |
|---|---|
| R4 | Unit-alta «R4: la original y una version suya…»; Unit-edicion «R4: volver a anadir…»; Int «R4: …duplicate_order_recipe», «R4: volver a anadir la receta de una linea cancelada», «R4, R5: quitar la linea… y anadir otra de la misma receta», «R4, R5: dos lineas que se intercambian la receta» |
| R10, R17 | Unit-alta «R10, R17: un alta de dos lineas…», «R10: si falla la segunda linea…»; Int «R10, R12, R17, R34, R41…», «R10, R11…» |
| R11 | Unit-alta «R11: una segunda linea invalida…» (mismos campos, posicion en el diagnostico); Int «R10, R11» |
| R12, R41 | Unit-alta «R12, R41: aparta linea a linea…»; Int |
| R13 | Unit-alta «R13: …sin campos nuevos y con la posicion en el diagnostico»; Int «R13: …no queda nada escrito» |
| R14, R34 | Unit-alta «R14: …», «R34: …»; Int «R14, R34: …PARCIAL»; Unit-edicion «R34…» |
| R20, R21, R22 | Unit-edicion «R20…», «R21…», «R22…»; Int «R20, R21, R22: …» |
| R23 | Unit-edicion «R23: quitar una linea EN_CURSO…» |
| R24 | Unit-edicion «R24: …si llega igual, no impide editar la otra» |
| R17, R25, R41 (edicion) | Unit-edicion «R17, R25, R41…», «R25: …BLOQUEADO…»; Int «R17, R25, R41: …identicos», «R17, R25: findCostingBatches con excludeOrderLineId…»; `order-actions.test.ts` › «R25: la cotizacion de la edicion…» |
| R26 | Unit-edicion «R26: …POR_EMPACAR…», «R26, R43»; Int «R26: editar el reparto de una linea no toca el de la otra» |
| R30 | Unit-alta «R30: …sin validar la entrada ni tocar ningun puerto»; Unit-edicion «R30…» |
| R42 | Unit-alta «R42: …» |
| R43 | Unit-edicion «R43…»; `qc170-distribution-company-scope.int` › «R29, QT-313 R43: …» |
| R44 | Int «R44: el pedido copia receta, cantidad, unidad, precio, costes y reserved_at…»; `order-actions.test.ts` › «R44: el alta envia una linea…», «R44: …dos lineas responde invalid_input» |

Verificacion (salida real, backend_dev):
- `pnpm run typecheck` exit 0; `pnpm run lint` 0 errores (10 warnings previos); guardias `Test Files 87 passed (87)`, `Tests 1334 passed | 22 skipped`
- node, related de los 63 archivos → `Test Files 295 passed (295)`, `Tests 6477 passed | 6 skipped`
- ui, proyecto entero en 3 tandas (superconjunto del related) → 149/149 (2785), 133/133 (2005), 141/141 (1862 + 1 skipped)
- integracion entera en 5 tandas, `--maxWorkers=1`, base efimera:
  - pedidos 64/65 → el rojo, una carrera en `qc170-distribution-concurrency`, se arreglo calculando el coste antes del candado; repetidos los 13 `.int` de edicion → 13 passed, 172 tests
  - asignaciones+scripts+documentos 35 passed (268); inventario 55 passed (486 + 1 skipped); identity 41 passed (593); resto 71/72 (910/911, el rojo es `unidades-constraints`, abajo)
  - tras el ultimo cambio de adaptador: 8 `.int` de acondicionamiento y lineas → 8 passed (75); `order-lines-use-cases.int` → 13/13

Desviaciones de implementacion (no estaban escritas en el spec; para el reviewer):
1. El puente construye el candidato de lineas directo del `FormData` (sin pasar por los esquemas planos) para que el permiso se compruebe antes que la validacion (R30). Los esquemas planos quedan intactos para la pantalla.
2. Lectura nueva `listOrderLineIds` (dominio, contrato y composicion): el puente nombra la unica linea en edicion, reparto y cotizacion; con mas de una → `invalid_input`; sin ninguna, edicion y reparto → `invalid_input`, la cotizacion no excluye nada.
3. Puerto: `updateAlive(id, {priority, customerId}, actorId, now, scope)` sin coste; `mirrorFirstLine` nuevo; `updatePresentationLinesAlive` eliminado.
4. Copia de estado a la linea: lanza si hay mas de una linea viva; Comenzar/Terminar acondicionamiento abren su propia transaccion con el cliente global (`startConditioningAndCopy`, `finishConditioningAndCopy`).
5. Edicion sin altas exige al menos una linea activa editable, si no `invalid_transition` (con una receta = hoy). Cambiar solo prioridad o cliente ya no recalcula ni vuelve a apartar (R25); se ajustaron los tests que fijaban lo anterior.
6. `quoteOrderCostSchema`: `orderId` → `orderLineId`; el puente traduce el `orderId` de la pantalla.
7. Intercambio de recetas: si dos o mas lineas cambian de receta, `writeLines` les pone `deleted_at`, las edita y las restaura en la misma transaccion; si al restaurar choca el unico → `duplicate_order_recipe`.
8. `order-presentation-availability.ts` sin cambios (su entrada no tiene pedido ni linea).
9. Rojos de tareas previas arreglados en el related: `qc145-estado-solo-planta.test.ts` (escritores de linea de T8) y 3 tests de inventario sin el `orderLineId: null` de T7.
10. Los `.int` borran `order_lines` antes que `orders` (FK `RESTRICT`); los que fuerzan estados tambien los escriben en la linea.

Rojos que vienen de T0/T1 (no del related de T9/T10; ninguno en `tests/baseline-rojos.json`): `tests/unit/pedidos/schema/pedidos-schema.test.ts` (4), `order-status-blocked-migration.test.ts` (1), `order-conditioning-states-migration.test.ts` (1), `tests/integration/unidades/unidades-constraints.int.test.ts` (1, falta `order_lines_unit_id_fkey`). Son regresiones de esta feature: se arreglan en la tanda siguiente.

## Regresiones de T0/T1 arregladas (2026-11-04)

Solo tests; el schema y las migraciones no cambian:
- `tests/unit/pedidos/schema/pedidos-schema.test.ts`: admite `OrderLine` y espera `PARCIAL` el primero.
- `order-status-blocked-migration.test.ts` y `order-conditioning-states-migration.test.ts`: `valoresDelEsquema()` ya no incluye `PARCIAL`, porque ese valor entra después con `ADD VALUE … BEFORE`.
- `tests/integration/unidades/unidades-constraints.int.test.ts`: añade `order_lines_unit_id_fkey`.

Resultado: los 3 unit 68/68; `unidades-constraints` 30/30.

## Fase 4 — T11 Cancelar linea/pedido y baja, T12 Entrega, anulacion, bloqueados y caducidad (2026-11-04)

T11, produccion:
- `pedidos/domain/cancel-order-line.ts` (nuevo).
- `order-cancellation.ts`: añade `cancelLockedLine` y cancela por linea con `lockAliveLines`, `refreshStatus` y `mirrorFirstLine`.
- `cancel-order.ts` y `delete-order.ts`.
- `order-prisma.ts`: `cancelAlive` ya no copia el estado; `softDeleteAlive` marca el pedido y sus lineas vivas.
- Puertos, `pedidos/index.ts` y `lib/composition/index.ts` (`pedidos.cancelOrderLine`).

T12, produccion:
- `pedidos/domain`: `deliver-order.ts`, `void-delivery.ts`, `order-delivery-target.ts` (nuevo), `review-blocked-orders.ts`, `expire-stale-orders.ts`, `order-expiry.ts` (solo comentarios) y `void-direct-delivery.ts`.
- `order-delivery-void-prisma.ts`.
- `inventario`: `finished-goods-dispatch.ts`, `finished-goods-dispatch-prisma.ts`, `finished-goods-return.ts` y `product-prisma.ts`, que escribe la linea en `delivery` y `delivery_void`.
- `findBlockedOrderIds` y `findExpirableOrders` leen `order_lines`.

Tests:
- Nuevos: `tests/unit/pedidos/{cancel-order-line,delivery-by-line,expire-stale-order-lines}.test.ts` y `tests/integration/pedidos/{order-lines-state,order-lines-delivery}.int.test.ts`.
- Los ajustados estan listados en `tasks.md > Archivos esperados`.

Mapa R → test:
| R | Test |
|---|---|
| R27 | `cancel-order-line.test.ts` › «R27: cancela la linea con su motivo recortado, libera solo lo suyo…», «R27: cancela una linea BLOQUEADO…»; `order-lines-state.int` › «QT-313 R27, R34: cancelar una linea…» |
| R28 | `cancel-order-line.test.ts` › «R28: una linea en estado no cancelable…», «R28: sin motivo, vacio…», «R28, R43: …»; `order-lines-state.int` › «QT-313 R28: una linea POR_EMPACAR responde not_cancellable…» |
| R29 | `cancel-order-line.test.ts` › «R29: cancela con el mismo motivo todas las lineas cancelables… POR_EMPACAR», «R29: si ninguna linea es cancelable…», «R29: cancelar por encargo…»; `order-lines-state.int` › «QT-313 R29, R34: …POR_EMPACAR…», «QT-313 R29: con todas las lineas canceladas… CANCELADO…» |
| R30 | `cancel-order-line.test.ts` › «R30: sin pedidos.modificar responde unauthorized antes de validar el motivo…», «R30: cancelar el pedido sin pedidos.modificar…» |
| R47 | `cancel-order-line.test.ts` › «R47: libera el material de cada linea…», «R47: con una linea ya consumida…», «R47: si una linea se consumio entre la lectura y el candado…»; `order-lines-state.int` › «QT-313 R47: la baja marca el pedido y sus dos lineas…», «QT-313 R47: con una linea ya consumida…» |
| R37 (delivery, delivery_void) | `delivery-by-line.test.ts` › «R37: cada salida de producto terminado lleva la linea y la receta de su reparto», «R37: cada devolucion lleva la linea del asiento de entrega que anula»; `order-lines-delivery.int` › «QT-313 R37, R39: …», «QT-313 R37: un pedido sin linea escribe null…» |
| R39 | `delivery-by-line.test.ts` › cuatro «R39: …» de entrega y tres de anulacion; `order-lines-delivery.int` › «QT-313 R37, R39: …» |
| R40 | `expire-stale-order-lines.test.ts` › «R40: con dos lineas BLOQUEADO y material para una…»; `order-lines-state.int` › «QT-313 R40: …estrena plazo…»; `order-repository.int` › «R16, R18, QT-313 R40 — solo las lineas BLOQUEADO…» |
| R51 | `expire-stale-order-lines.test.ts` › «R51: con dos lineas PENDIENTE de plazos distintos…», «R51: si bajo el candado la linea ya tiene un plazo nuevo…»; `order-lines-state.int` › «QT-313 R51, R34: …» |
| Andamio retirado (T11) | `order-lines-state.int` › «QT-313 T11: cancelAlive y softDeleteAlive ya no copian el estado…»; `order-cancellation.test.ts` › «QT-313 R27, R29, R51: ninguna operacion del modulo escribe el estado del pedido con cancelAlive…» |

Verificacion (salida real, backend_dev):
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores (10 warnings previos).
- Guardias: `Test Files 87 passed (87)`, `Tests 1334 passed | 22 skipped`.
- related node: `Test Files 302 passed (302)`, `Tests 6606 passed | 6 skipped`.
- related ui: `Test Files 1 failed | 339 passed (340)`, `Tests 1 failed | 5650 passed | 1 skipped`.
  - El rojo es `tests/unit/paridad/confirmaciones-paridad.test.tsx`, que cae en una instantanea distinta cada vez.
  - Repetido solo, fallo una vez en otro caso y despues paso 56/56. Es inestable y no tiene relacion con T11/T12; si sale en CI, revisarlo aparte.
- Integracion con `--maxWorkers=1` sobre base efimera:
  - pedidos (67 archivos): 4 archivos rojos (10 tests), de tests que forzaban el estado solo en `orders` o esperaban la forma vieja. Ajustados y repetidos: 5/5 archivos, 74 tests.
  - `order-lines-state.int` 9/9 y `order-lines-delivery.int` 2/2.
  - inventario 55/55 (486 tests, 1 skipped).
  - asignaciones, scripts, documentos e integraciones 60/60 (627).
  - clientes, proveedores, recetas, unidades, notificaciones e infra 47/47 (552).
  - identity 41/41 (593).

Desviaciones (para el reviewer; la 1 es para el leader):
1. **El «Hecho» de T12 contradice a R34.**
   - El «Hecho» de T12 dice que en R51 el pedido «queda `PARCIAL`».
   - Con una linea cancelada y otra `PENDIENTE`, la regla de R34 (design § 2.2) da `PENDIENTE`: las canceladas no cuentan y, si todas las activas tienen el mismo estado, el pedido toma ese estado.
   - R51 no dice nada del estado del pedido.
   - Se siguio R34 y los tests lo fijan. Hay que corregir el texto del «Hecho» de T12.
2. `cancelAlive` sigue en el puerto y el adaptador, sin copia y sin ningun llamante de dominio. Seis `.int` lo usan para sembrar pedidos cancelados.
3. `findBlockedIds` conserva el nombre pero devuelve `{orderId, lineId}[]`.
4. Entregar y anular pueden devolver `orderStatus` `PARCIAL`, y las respuestas a una clave ya registrada lo admiten.
5. Los pedidos sin linea siguen la ruta de pedido en entrega y anulacion (`setStatus`); por eso existe el test R37 con `null`. La copia en `setStatus` se mantiene hasta T14a.
6. **Riesgo para T14a:** el CHECK `orders_finished_at_requires_delivered` rechazaria un pedido `PARCIAL` con `finished_at`. Pasaria al entregar una linea de un pedido TERMINADO de varias lineas. Por eso R39 con varias lineas solo tiene test unitario. No se puede dar antes de T14a.
7. Cancelar, baja, caducidad y revision llaman a `mirrorFirstLine` en lugar de a `setReservedAt` del pedido.
8. `order-pending-delivery.ts` y `order-expiry-cron-route.ts` no cambian. `deliveryStateOf` trata `PARCIAL` como `not_packed`; es logica de listado que corresponde a T13/T14c.
9. Los fallos de caducidad y revision llevan `lineId`, y los conteos son de lineas, no de pedidos.
10. En `tests/helpers/order-delivery-seed.ts`, `crearPedido` crea una linea por defecto (con la opcion `sinLinea` para no crearla).
11. No hay Server Action para `cancelOrderLine`: es trabajo de pantalla de QT-314.
12. Dos regex ampliadas:
    - `authorization.test.ts` admite `deps.unitOfWork`;
    - la guardia `guard-ambito-empresa-pedidos.test.ts` comprueba `lockAliveLines`/`refreshStatus`.

## Fase 4 — T13 Lecturas (2026-11-04)

Produccion:
- `pedidos/domain/order-view.ts`: tipo `OrderLineView`. `OrderView` añade `lines`, `progress`, `salePriceTotal`, `linesWithoutPrice`, `ingredientsCostTotal` y `actualCostTotal`, y conserva los campos planos.
- `pedidos/domain/get-order.ts`: `toOrderView` recibe las lineas; nuevas `toOrderLineView`, `orderRecipeIds` y `toPresentationLineViews`.
- `pedidos/domain/list-orders.ts`: hace una sola lectura de lineas por pagina.
- `pedidos/ports/order-repository.ts`: añade `findAliveLinesByOrderIds`.
- `order-prisma.ts`: añade `findAliveOrderLinesByOrderIds`, y `orderStatusFilterWhere` aplica el `OR` de design § 2.2.1 en su propio termino del `AND`.
- `pedidos/index.ts` y `lib/composition/index.ts`.
- Sin cambios: `order-queryable.ts`, `list-query-sql.ts`, `list-order-summaries.ts` y `order-catalog-prisma.ts` (vease la desviacion 5).

Tests:
- Nuevos: `tests/unit/pedidos/order-view-lines.test.ts`, un bloque «QT-313: filtro y orden por estado» en `tests/integration/pedidos/list-query-orders.int.test.ts` y el helper `tests/helpers/order-view-lines.ts`.
- Ajustados: 8 unit de `pedidos`, 18 `.int` de `pedidos` (llevan el metodo nuevo del puerto) y 29 tests de pantalla, estos solo en su fixture. El bloque «T13» de `tasks.md > Archivos esperados` lista las rutas.

Mapa R → test:
| R | Test |
|---|---|
| R6 | `order-view-lines.test.ts` › «R6: devuelve las lineas por position aunque lleguen desordenadas…», «R6, R33, R34: lee las lineas de toda la pagina en una sola llamada…»; `list-query-orders.int` › «QT-313 R6, R43: las lineas de varios pedidos salen por position y nunca las de otra empresa» |
| R16 | `order-view-lines.test.ts` › «R16: el precio total suma las lineas activas con precio…», «R16: sin ninguna linea activa con precio el total es null…», «R16, R18: cada fila del listado lleva sus totales…» |
| R18 | `order-view-lines.test.ts` › «R18: los costes totales suman las lineas activas exactas…», «R18: si una linea activa no tiene coste, el total es null» |
| R33 | `order-view-lines.test.ts` › «R33: el avance cuenta las lineas activas…» y «R6, R33, R34» |
| R34 | `order-view-lines.test.ts` › «R34: el pedido sale con su estado derivado PARCIAL y cada linea con el suyo» |
| R44 (lectura) | `order-view-lines.test.ts` › «R44: un pedido de una linea conserva los campos planos de hoy junto a la linea» |
| R49 | `list-query-orders.int` › «QT-313 R49: EN_CURSO trae…», «…PARCIAL trae solo los pedidos PARCIAL», «…EN_CURSO y PENDIENTE a la vez… total coincide», «…CANCELADO no trae un PARCIAL…», «…nunca trae pedidos de otra empresa…»; `order-customer-filter-where.test.ts` › «QT-313 R49: el estado va en su propio termino del AND…» |
| R52 | `list-query-orders.int` › «QT-313 R52: ordenar por estado ascendente pone los PARCIAL antes que los PENDIENTE, y descendente los deja al final» |

Verificacion (salida real, backend_dev):
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores.
- Guardias: `Test Files 87 passed (87)`, `Tests 1335 passed | 22 skipped`.
- node: la primera corrida dio 3 archivos y 9 tests en rojo, de dobles con la forma vieja. Ajustados: `Test Files 179 passed (179)`, `Tests 4200 passed | 1 skipped`.
- ui: `Test Files 338 passed (338)`, `Tests 5613 passed | 1 skipped`.
- Integracion con `--maxWorkers=1`:
  - `list-query-orders.int`: 29/29. El primer rojo venia de una siembra que coincidia en fecha con otro caso; se corrigio.
  - Los 18 `.int` ajustados: 9/102 y 9/93.
  - El resto de `pedidos`: 24/261 y 24/213.
  - 42 `.int` de otros modulos: 514 tests en verde, 1 skipped.

Desviaciones (para el reviewer):
1. **Fixtures de pantalla.** `OrderView` gano campos obligatorios (design § 4.3), y los 29 tests de pantalla que montan su `OrderSummary` a mano dejaron de compilar. A cada fixture se le añadio `...VISTA_SIN_LINEAS`; ninguna asercion cambia. La alternativa, campos opcionales, se apartaria del design.
2. **Metodo nuevo del puerto `findAliveLinesByOrderIds`**, para que el listado no haga una consulta por fila.
3. **Pedido sin lineas:** los costes totales valen `'0.0000'` y el precio `null`, la misma regla que el humano acepto en T4.
4. **Brazo de lineas del filtro:** quita `PARCIAL` y `CANCELADO` de la lista y usa `in`. El resultado es el mismo que con el design.
5. **Lo que T13 no toca:** `order-queryable` no cambia (design § 2.2.1). Los resumenes y el catalogo son de `asignaciones` (T14a/T14d). `deliveryStateOf` sigue tratando `PARCIAL` como `not_packed`, y la busqueda por nombre sigue mirando la receta copiada en `orders`; las dos quedan para T14c/T15.
6. `OrderLineView` no lleva `unitLabel`, como dice design § 4.3.

## Fase 5 — T14b Otros lectores y T14c Puente (2026-11-05, enmienda c69dd4f5e)

T14b, produccion:
- `integraciones/domain/{get-whatsapp-chat-context,whatsapp-chat-context}.ts`
- `inventario/adapters/driven/persistence/finished-stock-prisma.ts`
- `pedidos/adapters/driven/persistence/{customer-order-directory-prisma,direct-delivery-prisma,packed-lines-directory-prisma}.ts`
- `pedidos/domain/{customer-order-directory,get-order-delivery}.ts`
- `pedidos/ports/direct-delivery-repository.ts`

Todos dejan de leer de `orders` la receta, la cantidad, la unidad, el precio y los costes, y los toman de la linea.

T14b, tests: `.int` de `finished-stock`, `customer-order-directory`, `direct-delivery`, `direct-delivery-repository`, `order-delivery`, `packed-lines-directory` y `whatsapp-chat-context-flow`, mas los unit de `get-whatsapp-chat-context`, `whatsapp-chat-context` y `get-order-delivery`, todos con casos `R45`.

T14c (enmienda c69dd4f5e): los esquemas no se renombran ni se borran; eso pasa a QT-314. El puente y R44 quedaron hechos en T9/T10/T13; esta task solo añade el test de R54.

Mapa R → test:
| R | Test |
|---|---|
| R44 | `order-actions.test.ts` › «R44: el alta envia una linea…», «R44: …dos lineas responde invalid_input»; `order-view-lines.test.ts` › «R44: un pedido de una linea conserva los campos planos de hoy junto a la linea» |
| R45 (lectores) | los `.int` de T14b listados arriba: con un pedido de una linea, cada lector da lo mismo que hoy |
| R54 | `tests/unit/pedidos-ui/order-row-actions.test.tsx` › «R54: editar, cancelar y eliminar deshabilitados, sin reparto, entrega ni entregas, con «Responsables» y «Cliente» disponibles», «R54: PARCIAL es final y no acepta la edicion acotada de reparto» |

Verificacion (salida real):
- backend_dev T14b: typecheck y lint en verde, guardias en verde, `related --project node` → 167/167, y los `.int` tocados en verde.
- backend_dev T14c: `order-row-actions.test.tsx` → 219/219; eslint limpio; typecheck en verde.
- implementer:
  - Los ui que dieron rojo por plazo en la corrida del backend_dev, repetidos solos con `--maxWorkers=1` (`configuracion-ui/user-form` y `recetas-ui/`): `Test Files 33 passed (33)`, `Tests 666 passed (666)`. Era la maquina, no el codigo.
  - `.int` de entregas repetidos tras el ultimo cambio de `get-order-delivery.ts` (`order-delivery`, `direct-delivery`, `direct-delivery-repository`, `order-delivery-repository`, `order-lines-delivery`), con `--maxWorkers=1`: `Test Files 5 passed (5)`, `Tests 70 passed (70)`.
  - **Pendiente:** `vitest related --project ui` de los 9 archivos de produccion de T14b. Claude Code lo corto dos veces por falta de memoria del sistema, una en la corrida del backend_dev y otra en la mia, y no se ha relanzado. Los 9 archivos son adaptadores y dominio sin UI. Lo cubren el `./init.sh` del leader o CI.

Desviaciones aceptadas por el humano (2026-11-05), para el reviewer:
1. `get-order-delivery.ts` estaba fuera de la lista; ahora esta en «Archivos esperados».
2. La fila de producto terminado lleva la receta de la primera linea.
3. En WhatsApp, `productName` une los nombres de las lineas con «, ».
4. `recipeIds` en el directorio de pedidos del cliente.
5. Las entregas sin pedido cuentan la linea `TERMINADO`.

## Fase 5 — T14a `asignaciones` por linea y espejo ampliado (2026-11-05, enmienda c69dd4f5e)

Produccion:
- `pedidos`:
  - dominio: `order-catalog.ts`, `transition-order.ts`, `order-packing.ts`, `order-conditioning.ts`;
  - puertos: `order-write-repository.ts`, `order-packing-repository.ts`, `order-conditioning-repository.ts`;
  - `order-prisma.ts`: sin copia de estado pedido → linea, con `stampAliveOrderLineStatus`, `setOrderLineActualCost` y el espejo ampliado en `refreshStatus`/`mirrorFirstLine` (`packed_by`, `conditioned_by`, `finished_at`, `actual_cost`; NULL en `PARCIAL`; design § 4.1.1, punto 3b);
  - `order-catalog-prisma.ts`: resumenes por linea.
- `inventario`: `domain/finished-goods.ts`, `finished-goods-prisma.ts`, `product-prisma.ts` (el asiento `production` lleva la linea de su reparto).
- `asignaciones`:
  - `domain/only-order-line.ts` (nuevo);
  - casos de uso de abrir, finalizar, empaque, acondicionamiento, pasos, evidencias, cancelar y lecturas de ejecucion/empaque/acondicionamiento;
  - `compose-order-rows` por `lineId`;
  - puertos y adaptadores de registro de ejecucion, evidencias y equipo de acondicionamiento.

Tests:
- Nuevos: `tests/integration/asignaciones/order-lines-execution.int.test.ts`, `tests/unit/pedidos/order-lines-no-copy.test.ts` y el helper `tests/helpers/only-order-line.ts`.
- Unos 50 ajustados, listados al final de `tasks.md > Archivos esperados`.

Mapa R → test (Int = `order-lines-execution.int`):
| R | Test |
|---|---|
| R31, R32 | Int › «QT-313 R31, R32: una linea recorre todo el flujo y la otra se queda PENDIENTE…», «QT-313 R31: una linea que no esta en `from` responde stale…» |
| R35 | Int › «QT-313 R35, R37: el responsable del pedido abre, finaliza y empaca su linea…», «QT-313 R35: con dos lineas en el mismo estado, abrir responde invalid_input sin escribir» |
| R36 | Int › «QT-313 R36: finalizar una linea consume solo lo apartado para ella…» |
| R37 (production), R38 | Int › «QT-313 R38, R37: terminar el empaque guarda el coste real de esa linea…» |
| R37 (registro de ejecucion, equipo, evidencias) | Int › «QT-313 R35, R37…», «QT-313 R37: el equipo de acondicionamiento y las evidencias…» |
| R19 | Int › «QT-313 R45, R19: el resumen de un pedido de una linea es el de hoy mas lineId, sin precio» |
| R45 | Int › «QT-313 R45: un pedido de dos lineas en el mismo estado sale como dos filas…»; `order-catalog.test.ts` › tres «QT-313 R45: …» |
| R44, R45 (espejo) | Int › «QT-313 R44, R45: OrderView de un pedido de una linea lleva el coste real…» |
| CHECK de `orders` (espejo ampliado) | Int › «QT-313 orders_packed_by_matches_status…», «…orders_conditioned_by_matches_status…», «…orders_finished_requires_finished_at…», «…orders_finished_at_requires_delivered…», «…orders_actual_cost_requires_packed…» |
| Sin copia pedido → linea | `order-lines-no-copy.test.ts` › tres «QT-313 R31, R32…» |

Verificacion (salida real):
- backend_dev:
  - `pnpm run typecheck`: exit 0.
  - Guardias: 87/87 archivos (1336 tests en verde, 22 skipped).
  - `related --project node`: `Test Files 302 passed (302)`, `Tests 6696 passed | 6 skipped`.
  - Integracion con `--maxWorkers=1` en lotes de ≤ 15:
    - `order-lines-execution`: 15/15.
    - asignaciones A: 6 rojos de fixtures, corregidos; verde al repetir.
    - asignaciones B: 15/15 (131).
    - pedidos C: 7 rojos de fixtures, corregidos; verde al repetir.
    - pedidos D: 2 rojos, corregidos (`order-repository` 15/15, `order-sale-price`).
    - inventario E: 9/9 (61).
- implementer:
  - `pnpm run lint`: `0 errors, 10 warnings` (los previos).
  - `finished-orders.int`, `responsible-eligibility.int` y `order-lines-execution.int` repetidos tras quitar los imports: `Test Files 3 passed (3)`, `Tests 30 passed (30)`.
- Sin correr:
  - `related --project ui`: no se lanzo por riesgo de memoria. Ningun tipo de vista cambia y el typecheck incluye la UI.
  - Los `.int` que quedaron fuera de los lotes. Los cubren el `./init.sh` del leader y CI.

Desviaciones (para el reviewer):
1. **Las Server Actions no cambian.** El caso de uso resuelve la unica linea del pedido en el estado que lee (`only-order-line.ts`). Con dos o mas lineas en ese estado responde `invalid_input` sin escribir. La entrada no gana `orderLineId`; eso queda para QT-315. Consecuencia: un pedido de varias lineas aun no se opera desde `asignaciones`. R35 se cubre con una linea, y las operaciones por linea con dos lineas se prueban en el catalogo.
2. **Solo `AssignedOrderSummary` lleva `lineId`** (una fila por linea; `compose-order-rows` indexa por `lineId`). Las vistas de `asignaciones` no lo llevan, para no tocar los fixtures de pantalla. El «mas `lineId`» del «Hecho» de R45 se cumple en el contrato, no en las vistas.
3. `OrderAssignmentTarget` no cambia (T14d).
4. Puertos:
   - `OrderCatalog`: las cinco operaciones del flujo reciben `(id, lineId, companyId, …)`.
   - `OrderWriteRepository`: salen `finishPackingAlive` y `setActualCost`; entran `stampLineStatus` y `setLineActualCost`.
   - `setReservedAt` queda sin llamante de produccion; lo quita T15.
   - Comenzar el empaque y el acondicionamiento bloquean pedido y linea en su propia transaccion.
5. `findPresentationLinesForFinish` lee todo el pedido y el dominio filtra por linea.
6. `list-execution-traces` y `listDeliveryProgress…` siguen leyendo la receta del pedido, que es el espejo.
7. `refreshStatus` reescribe siempre las cuatro columnas de etapa en una sola sentencia. `updated_at` solo se mueve si cambian el estado o el motivo.
8. `transitionAliveById` con destino `CANCELADO` lanza `InvalidTransitionError`; antes fallaba contra el CHECK de la base.
9. Lecturas nuevas:
   - Comenzar el empaque lee el resumen antes de escribir y distingue `not_found` de `not_packable`.
   - Abrir lee la linea aparte.
   - `findOnlyLine` admite el estado al que puede pasar la linea en una carrera.
10. Helper de test `tests/helpers/only-order-line.ts` (`ensureOnlyLine`, `syncOnlyLine`, `onOnlyLine`, `singleLineFlow`).
11. Corregido un rojo previo de T7: `tests/unit/inventario/batch-movement-prisma.test.ts` no esperaba `orderLineId: null`.
12. `qc145-estado-solo-planta.test.ts` cambia su lista de escritores de estado.

## Fase 5 — T14d Responsables en un PARCIAL (R55, 2026-11-05)

Produccion:
- `asignaciones/domain/order-state.ts`: `assertOrderAcceptsWrites` aplica el mapa linea a linea y basta con que una linea admita la escritura. Sustituye la regla provisional de T0, que admitia cualquier `PARCIAL`.
- `pedidos/domain/order-catalog.ts`: `OrderAssignmentTarget` pasa a `{id, status, activeLineStatuses}`.
- `order-catalog-prisma.ts`: `findAliveOrderTargetById` lee los estados de las lineas vivas y no canceladas.

Mapa R → test:
| R | Test |
|---|---|
| R55 | `tests/integration/asignaciones/order-lines-execution.int.test.ts` › «QT-313 R55: un PARCIAL con una linea PENDIENTE admite asignar, quitar grupo y desasignar», «QT-313 R55: un PARCIAL con todas sus lineas activas fabricadas rechaza las tres con order_produced_frozen sin escribir», «QT-313 R55: una linea cancelada no cuenta…», «QT-313 R55: una linea quitada (deleted_at) en PENDIENTE no cuenta…»; `tests/unit/asignaciones/order-state.test.ts` › «R55: un PARCIAL con una linea ${abierta} y otra TERMINADO admite…» (parametrizado), «R55: un PARCIAL con todas sus lineas activas en … rechaza…» (parametrizado), «R55: una linea cancelada no cuenta…», «R55: assertOrderAcceptsWrites aplica el mapa linea a linea…»; `tests/unit/pedidos/order-catalog.test.ts` › tres «QT-313 R55: …» |

Verificacion (salida real):
- backend_dev:
  - `pnpm run typecheck` y `pnpm run lint` en verde.
  - Guardias 87/87.
  - `related --project node` → 125/125.
  - `.int` por lotes con `--maxWorkers=1`, en verde.
- Caso añadido despues, a peticion del humano (la linea quitada cuenta como fuera):
  - `order-lines-execution.int` → `Test Files 1 passed (1)`, `Tests 19 passed (19)`.
  - eslint del archivo, limpio.

Desviaciones aceptadas por el humano (2026-11-05), para el reviewer:
1. El campo nuevo se llama `activeLineStatuses`.
2. Algunos fixtures de test necesitaron rodeos para fabricar un `PARCIAL` con lineas en estados concretos.
3. Tres rutas nuevas en «Archivos esperados».
