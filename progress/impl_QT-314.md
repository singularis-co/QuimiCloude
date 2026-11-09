# impl QT-314 — pedido-con-varias-recetas-frontend

Rama `feature/QT-314-pedido-con-varias-recetas-frontend`. Spec aprobado en F1.4 (2026-11-06, db1e1df8c).

## Tanda 1 — `lib/` sin romper la pantalla de hoy (backend_dev) — HECHA

| Task | Commit | Archivos |
|---|---|---|
| T1 | a0f43802f | `lib/modules/pedidos/domain/order-view.ts`, `domain/get-order.ts`, `tests/unit/pedidos/order-view-lines.test.ts` |
| T2 | 5774daf3f | `domain/order-transitions.ts` (`isEditableOrderLineStatus`), `domain/update-order.ts` (sin la copia `EDITABLE_ACTIVE`), `domain/delete-order.ts` (`isDeletableOrder` exportada), `lib/modules/pedidos/index.ts`, `tests/unit/pedidos/order-line-predicates.test.ts` (nuevo), `tests/unit/pedidos/module-contract.test.ts` |
| T3 | 5723ff5b0 | `domain/errors.ts` (`linePositions`, `withLinePositions`, `linePositionsOf`), `domain/order-line-diff.ts`, `domain/create-order.ts`, `domain/update-order.ts`, `index.ts` (1 línea), `tests/unit/pedidos/order-line-positions.test.ts` (nuevo) |
| T4 | ff4943e2a | `domain/get-order-delivery.ts`, `domain/list-order-deliveries.ts`, `adapters/driving/order-actions.ts`, `tests/fixtures/order-delivery-void.ts`, `tests/integration/aislamiento.json`, `tests/unit/pedidos/{get-order-delivery,list-order-deliveries,order-actions-delivery,order-actions-delivery-void,order-actions}.test.ts`, `tests/integration/pedidos/order-delivery-by-line.int.test.ts` (nuevo) |
| T5 | 79849d772 | `adapters/driving/order-actions.ts` (`cancelOrderLineAction`), `tests/unit/pedidos/order-actions.test.ts` (inventarios), `tests/unit/pedidos/order-actions-cancel-line.test.ts` (nuevo) |

## Mapa `R<n> -> test` (lo que cubre la tanda 1)

| R | Test (archivo › caso) |
|---|---|
| R18, R30, R32, R39 (dato) | `tests/unit/pedidos/order-view-lines.test.ts` › «getOrder da a cada receta su original, su version, su imagen y su unidad»; «getOrder no hace mas llamadas a los catalogos con dos recetas que con una»; «listOrders da los mismos cuatro campos a cada receta de cada pedido de la pagina»; «listOrders no hace mas llamadas a los catalogos con dos recetas por pedido que con una»; «una receta sin unidad sale con unitLabel null…» |
| R10 | `tests/unit/pedidos/order-line-predicates.test.ts` › «R10: editables solo PENDIENTE, EN_CURSO y BLOQUEADO…»; «R10: updateOrder sin recetas nuevas rechaza con invalid_transition en cada estado que isEditableOrderLineStatus da por no editable» |
| R11 | ídem › «R11: se quitan solo PENDIENTE y BLOQUEADO; EN_CURSO no» |
| R13 | ídem › «R13: la suma es exacta, a cuatro decimales…»; «R13: el precio de una receta vacio es sin precio…» |
| R36 | ídem › «R36: se cancelan PENDIENTE, EN_CURSO y BLOQUEADO…»; «R36: PARCIAL no es cancelable como estado…» |
| R37 | ídem › «R37: con una receta en cada estado…»; «R37: un pedido PARCIAL se borra si…»; «R37: deleteOrder responde not_deletable justo en los estados que isDeletableOrder rechaza» |
| R10, R11, R13, R36, R37 | ídem › «…lo publicado es la misma funcion que usa el dominio» (identidad con `toBe`, sin copias) |
| R15 | `tests/unit/pedidos/order-line-positions.test.ts` › 8 casos por regla con tres recetas (recipe_not_found [1] alta/edición; order_would_block [1, 2] alta/edición; insufficient_material [1] EN_CURSO; invalid_transition [1]; duplicate_order_recipe [1, 2] alta/edición) + «linePositionsOf ordena… y quita repetidas», «atLinePosition rehace el error…», «assertNoDuplicateOrderRecipe lleva las posiciones de las dos…», «el contrato del modulo publica linePositionsOf» |
| R16 | ídem › «R16: linePositionsOf de un error ajeno… es []»; «R16: un error del modulo que no es de receta no trae posiciones…»; «R16: atLinePosition deja pasar sin tocar un error que no es del modulo»; + `guard-catalogo-de-errores` verde sin tocarla |
| R33 | `tests/unit/pedidos/get-order-delivery.test.ts` › bloque «QT-314 T4 — getOrderDelivery por receta» (TERMINADO con pedido PARCIAL → solo su reparto; EN_CURSO y demás → action_not_allowed; otro pedido / otra empresa / quitada → order_not_found; sin lineId como hoy); `order-actions-delivery.test.ts` › «R33: getOrderDeliveryAction pasa el pedido, la receta y el actor…»; `tests/integration/pedidos/order-delivery-by-line.int.test.ts` › «QT-314 R33, R35: con el pedido PARCIAL, cada receta lee solo su reparto…», «…otro pedido, quitada o leida desde otra empresa es order_not_found» |
| R35 | `tests/unit/pedidos/list-order-deliveries.test.ts` › bloque «QT-314 T4 — listOrderDeliveries por receta» (filtrado a la receta, sin entregas vacías, `lineStatus`, sin lineId como hoy); `order-actions-delivery.test.ts` › «R35: listOrderDeliveriesAction pasa…»; el `.int` de arriba |
| R29 | `tests/unit/pedidos/order-actions-cancel-line.test.ts` › éxito; not_cancellable; order_not_found; motivo vacío/en blanco/501 → invalid_input; 500 se acepta; sin `id`/`lineId` (o vacíos) → invalid_input sin llamar al caso de uso |
| R42 | ídem › «R42: sin pedidos.modificar responde unauthorized»; «R42: sin sesion… unauthorized» |

## Verificación (salida real)

- `pnpm run typecheck`: un solo error, ajeno: `app/layout.tsx(45,56): error TS2304: Cannot find name 'LayoutProps'` (faltan `.next/types` en el worktree; nada de la tanda). Hizo falta `pnpm exec prisma generate` en el worktree.
- `pnpm run lint`: `✖ 11 problems (0 errors, 11 warnings)`, ninguno en archivos tocados.
- `vitest related` **no se usó**: desde `index.ts` / `order-actions.ts` / `lib/composition` arrastra la suite entera (T1 lo probó: no terminó en 150 s). Se verificó por archivo:
  - Cierre de tanda, 22 archivos (los de T1–T5 + `module-contract`, `update-order*`, `delete-order`, `create-order-lines`, `order-line-diff`, `order-actions-{distribution,customer}` y los 3 de UI de entregas): `Test Files 22 passed (22) · Tests 602 passed (602)`.
  - Por task: T1 `tests/unit/pedidos/` + consumidores 2418 pasados; pantalla de hoy `tests/unit/pedidos-ui/` 56 archivos, 1149 pasados (antes de T3–T5; T4 corrió aparte los de UI de entregas, T5 `tests/unit/paridad` 22 archivos, 411 pasados).
  - `.int` por archivo, contra la base efímera (DATABASE_URL del checkout principal solo en ese shell): `order-delivery-by-line` 2/2, `order-delivery` 25/25, `order-delivery-void` 16/16.
- `pnpm exec vitest run guard`: `Tests 1333 passed | 22 skipped (1355)`.

## Notas para el reviewer (decisiones dentro del spec)

1. **T2**: `module-contract.test.ts` quita `update-order.ts` de la lista de consumidores de `isAllowedTransition`, porque ahora usa `isEditableOrderLineStatus` del dueño (es lo que pide T2: sin copias). Lleva comentario.
2. **T3**: `linePositions` se pone con `withLinePositions(positions): this` sobre el error recién construido, para no tocar el constructor `(diagnostic?)` de las ~30 clases. Posición = índice 0-based en `lines` (§ 3.3 punto 4).
3. **T4**: `lineStatus: OrderLineStatus | null`, `null` sin `lineId` (el spec no lo fija). Los casos de uso admiten de forma provisional `(orderId, actor)` y `(orderId, lineId | undefined, actor)` hasta T13. `listOrderDeliveries` con `lineId` no exige estado de receta (R34 necesita ver `ENTREGADO`). Entrada nueva en `tests/integration/aislamiento.json` para el `.int`.
4. **T5**: la acción no parsea `cancelOrderLineSchema`: lo valida el caso de uso tras `pedidos.modificar`, como `cancelOrderAction` (si no, un usuario sin permiso con motivo malo recibiría `invalid_input` en vez de `unauthorized`). Sin `revalidatePath`, como `cancelOrderAction`.

## Bloqueos

- **Tanda 3 / T15 / R44 — «Ver detalle» en el pie de la tarjeta de teléfono (RESUELTO: enmienda F2.1 de R44, 2026-11-09; tests en T16b).**
  R44 pide en la tarjeta los botones «Ver detalle» y «Acciones», y design § 2 (catálogo) dice
  «`DataTable` … `card.footer` para "Ver detalle" y "Acciones"». Pero `DataTableCardLayout.footer`
  (`components/shared/data-table/data-table-cards.tsx`) pinta **una sola columna** de la tabla, y
  `DataTable` no admite columnas solo de tarjeta. Cumplirlo exige (a) una columna nueva que saldría
  también en escritorio (el tablero no la tiene), o (b) ampliar `DataTable` (componente compartido,
  fila del `CATALOGO.md`), que el design no lista entre las piezas a ampliar. No se improvisó:
  el pie queda como estaba (prioridad + «Acciones»); en teléfono el detalle se abre tocando el
  número de pedido o con «Ver detalle» dentro de «Acciones». Opciones: ampliar `DataTable`
  (enmienda del design) o aceptar el número como entrada al detalle (enmienda de R44).
  El resto de T15 cumple su «Hecho».
- **Tanda 3 / T16 — ficha de solo lectura de `order-responsibles-sheet.tsx` (RESUELTO: R51, enmienda F2.1; hecho en T16b).**
  Sigue pintando nombre, imagen, cantidad, unidad y reparto desde los campos planos de la primera
  receta: choca con R24 y bloquea el «Hecho» de T17 (Tanda 4). Ni design § 4.7 ni el tablero dicen
  qué pinta con varias recetas. Opciones en «T16 > Bloqueos de T16». No afecta al «Hecho» de T16
  (R38 funciona y tiene tests).
- **Tanda 3 / T16 — borrador de entrega por pedido, no por receta (RESUELTO: R52, enmienda F2.1; hecho en T16b).** `order-delivery-draft.ts`
  y `use-order-delivery-draft.ts` (fuera del alcance de T16) usan una clave por pedido: con dos recetas
  `TERMINADO`, abrir «Entregar» de la segunda descarta el borrador de la primera. La entrega registrada
  es correcta. El arreglo (añadir `lineId` a la clave) amplía el alcance: decide el leader.

## Tanda 2 — piezas nuevas sin cablear (frontend_dev) — HECHA

Tres frontend_dev en paralelo (T6+T7; T8+T11; T9+T10+T12), sin commit propio; los commits los hizo el implementer.

| Task | Commit | Archivos |
|---|---|---|
| T6, T7 | 36efea69e | `components/shared/row-actions-menu.tsx` (`groupLabel`), `components/shared/notice.tsx` (`actions`), `components/shared/CATALOGO.md` (filas de `RowActionsMenu` y `Notice`, tableros en «Diseño»), `tests/unit/shared-ui/row-actions-menu-group.test.tsx`, `tests/unit/shared-ui/notice-actions.test.tsx` |
| T8 | 38bb0ea0b | `app/(private)/pedidos/components/order-progress.tsx`, `tests/unit/pedidos-ui/order-progress.test.tsx` |
| T9, T10 | 0a339b628 | `order-line-draft.ts`, `order-line-actions.ts`, sus tests |
| T11 | 300c10add | `order-detail-sheet.tsx`, su test |
| T12 | 673598d1c | `order-line-picker-dialog.tsx`, `cancel-order-line-dialog.tsx`, sus tests, `components/index.ts` (solo reexportaciones) |

### T6 y T7

Mapa `R<n> -> test`:
- R25 -> `tests/unit/shared-ui/row-actions-menu-group.test.tsx` (cada caso en `dropdown` y `centered`) > «R25: el rótulo sale justo antes de su ítem y nombra el grupo», «R25: los grupos salen en orden y las acciones sin rótulo quedan fuera de ellos», «R25: el rótulo no es enfocable ni es una acción», «R25: combina con `separatorBefore`: línea, rótulo e ítem, en ese orden»
- R17 -> `tests/unit/shared-ui/notice-actions.test.tsx` > «R17: pinta las acciones dentro del aviso, debajo del texto y en su orden», «R17: cada acción llama a su callback y el aviso sigue siendo una alerta», «R17: sin `actions` no hay fila de acciones ni botones»
- R46 -> ídem > «R46: con acciones, el aviso entra con la animación de los avisos»

Verificación: los 2 tests nuevos + `row-actions-menu-{centrado,href,separator}`, `notice`, `notice-dismiss` sin cambios: `Test Files 7 passed (7) · Tests 55 passed (55)`. Consumidores del menú (`administrator-table`, `work-group-table`, `clientes-page`) y guardias `guard-catalogo-de-componentes`, `guard-piezas-base`, `guard-formularios-y-acciones`: `Test Files 6 passed (6) · Tests 180 passed | 4 skipped (184)`. `vitest related` no terminó en 150 s; se corrió por archivo.

Notas: sin `groupLabel`/`actions` el árbol es el de hoy. En `dropdown` el grupo es `DropdownMenuGroup` + `DropdownMenuLabel`; en `centered`, `div role="group"` con `aria-labelledby` a un rótulo no enfocable.

### Cierre de la tanda (implementer, salida real)

- Los 13 archivos de la tanda (10 nuevos + `row-actions-menu-{centrado,href,separator}`; `notice`, `notice-dismiss`), por archivo: `Test Files 13 passed (13) · Tests 127 passed (127)`.
- `pnpm exec vitest run guard`: `Test Files 87 passed (87) · Tests 1333 passed | 22 skipped (1355)`.
- Typecheck y lint: ver cada sub-sección (solo el `LayoutProps` ajeno; 0 errores de lint).
- Para el reviewer: `responsiblesFrozen` (T10) lleva una copia en la UI del mapa de estados de `asignaciones` (que no publica predicado); sigue la regla escrita en design § 4.6. Si se quiere sin copia, haría falta publicarlo en `lib/` (fuera de esta tanda).

### T8 y T11

Archivos:
- nuevo `app/(private)/pedidos/components/order-progress.tsx` (T8)
- nuevo `app/(private)/pedidos/components/order-detail-sheet.tsx` (T11)
- `app/(private)/pedidos/components/index.ts`: solo reexporta las dos piezas
- nuevo `tests/unit/pedidos-ui/order-progress.test.tsx`
- nuevo `tests/unit/pedidos-ui/order-detail-sheet.test.tsx`

Sin cablear: la pantalla de hoy no las usa todavía (T15).

Mapa `R<n> -> test`:
- R21 -> `order-progress.test.tsx` > «R21: la forma corta pinta «F de T»…», «R21: con 0 de 0…», «R18, R21: en la forma short/long el nombre accesible…»
- R18 -> `order-progress.test.tsx` > «R18: la forma larga pinta «N de M terminadas»…»; `order-detail-sheet.test.tsx` > «R18: la cabecera…», «R18: el resumen…», «R18: hay una tarjeta por receta…», «R18: cada tarjeta lleva…», «R18: la receta cancelada…»
- R46 -> `order-progress.test.tsx` > «R46: la barra anima el cambio de ancho…»
- R19 -> `order-detail-sheet.test.tsx` > «R19: no ofrece ningún control…», «R9, R19: en PARCIAL «Editar» está habilitado…»
- R9 -> `order-detail-sheet.test.tsx` > «R9, R19: en PARCIAL…», «R9: en ENTREGADO…», «R9: en CANCELADO…»

Verificación (salida real):
- `vitest run` de los dos tests + `guard-pedidos-rediseno`, `guard-pantalla-pedidos-se-amplia`, `pedidos-convenciones`, `order-route-contract`: `Test Files 6 passed (6) · Tests 69 passed | 5 skipped (74)`.
- `pnpm run typecheck`: solo el error conocido ajeno `app/layout.tsx(45,56) LayoutProps`.
- `pnpm run lint`: `0 errors, 11 warnings` (todas en tests ajenos).

Notas:
- «Editar» del detalle usa `canEditOrder(order)` de `order-line-actions.ts` (T10, del otro frontend_dev), la misma regla que el menú; no hay copia.
- El reparto por receta enlaza productos (`OrderProducedPresentations`) solo si la receta está `TERMINADO`/`ENTREGADO` y llega `producedProducts` del pedido.

Veredicto: T8 y T11 hechas, en verde, sin cablear.

### T9, T10 y T12

Archivos:
- nuevo `app/(private)/pedidos/components/order-line-draft.ts` (T9)
- nuevo `app/(private)/pedidos/components/order-line-actions.ts` (T10)
- nuevo `app/(private)/pedidos/components/order-line-picker-dialog.tsx` (T12)
- nuevo `app/(private)/pedidos/components/cancel-order-line-dialog.tsx` (T12)
- `app/(private)/pedidos/components/index.ts`: solo reexporta las cuatro piezas
- nuevos `tests/unit/pedidos-ui/order-line-draft.test.ts`, `order-line-actions.test.ts`,
  `order-line-picker-dialog.test.tsx`, `cancel-order-line-dialog.test.tsx`

Sin cablear: la pantalla de hoy no las usa (T14–T16).

Mapa `R<n> -> test`:
- R7 -> `order-line-draft.test.ts` > «R7, R12: las recetas del pedido en su orden…», «R7: envía las no canceladas en su orden…», «R7: la editable viaja…», «R7: cada receta enviada pasa el esquema…», «R7: rowOfPosition…», «R7: lleva el cliente…»
- R8 -> `order-line-draft.test.ts` > «R8: una versión de la misma original…», «R8: dos originales distintas…», «R8: la otra aparición cancelada no cuenta», «R8: una fila no choca consigo misma»
- R10 -> `order-line-draft.test.ts` > «R10: solo lectura las guardadas en un estado no editable…», «R10: la no editable viaja con sus valores guardados…»
- R11 -> `order-line-draft.test.ts` > «R11: se quitan las nuevas y las guardadas en PENDIENTE o BLOQUEADO…»
- R12 -> `order-line-draft.test.ts` > «R12: una cancelada es de solo lectura», «R12: una cancelada no suma…», «R12: el coste estimado es «sin coste»…», «R12: con solo canceladas…»
- R13 -> `order-line-draft.test.ts` > «R13: suma exacta… el 0 es un precio», «R13: sin ningún precio el total es null», «R13: una receta sin precio arranca con el campo vacío…», «R7, R8, R13: precarga…»
- R9 -> `order-line-actions.test.ts` > «R9: habilitado en todo estado salvo ENTREGADO y CANCELADO, PARCIAL incluido»
- R26 -> `order-line-actions.test.ts` > los cuatro «R26: …» de `lineAcceptsAction` y los cuatro de `orderOffersLineAction` en `PARCIAL`
- R27 -> `order-line-actions.test.ts` > «R27: los del tablero…», «R27: sin motivo la que admite…»; `order-line-picker-dialog.test.tsx` > «R27: una opción por receta…», «R27: nombra la acción y el pedido», «R27: «Entregar» deshabilita…», «R27: «Cancelar receta» deja elegir…», «R27: pulsar una deshabilitada no emite nada», «R27: elegir una habilitada emite su lineId», «R27: también con el teclado»
- R36 -> `order-line-actions.test.ts` > «R36: un PARCIAL con alguna receta activa cancelable…», «R36: un PARCIAL sin recetas cancelables…»
- R37 -> `order-line-actions.test.ts` > los cuatro «R37: …»
- R38 -> `order-line-actions.test.ts` > los tres «R38: …»
- R28 -> `cancel-order-line-dialog.test.tsx` > «R28: título, receta, pedido…», «R28: confirmar está deshabilitado…», «R28: un motivo de más de 500…», «R28: llama a `cancelOrderLineAction` con `id`, `lineId` y `reason`», «R28: con éxito cierra…», «R28: muestra el mensaje del catálogo, no se cierra y conserva el motivo»
- R44 -> `order-line-picker-dialog.test.tsx` > «R44: cada opción mide al menos 52 px…», «R44: es un diálogo centrado…»

Verificación (salida real):
- `vitest run` de los 4 tests nuevos: `Test Files 4 passed (4) · Tests 56 passed (56)`.
- `vitest run` de `pedidos-convenciones`, `order-route-contract` y `cancel-order-line-dialog`: `Test Files 3 passed (3) · Tests 49 passed | 3 skipped (52)`.
- `vitest related --run <los 4 archivos>`: no terminó en 150 s (arrastra la suite por el barrel); se corrió por archivo.
- `pnpm run typecheck`: solo el error conocido ajeno `app/layout.tsx(45,56) LayoutProps`.
- `pnpm run lint`: `0 errors, 11 warnings` (todas en archivos ajenos).

Notas:
- `candidateOf(lines, header)` devuelve `{ candidate, rowOfPosition }`: el candidato va tal cual a la acción, sin `rowOfPosition` dentro. `rowOfPosition[i]` es la fila desde 0; el aviso numera desde 1.
- `customerId` del candidato es `''` sin cliente: el esquema es `z.string().optional()` y no admite `null`.
- El diálogo de cancelar receta valida con `cancelOrderSchema`: `cancelOrderLineSchema` no está publicado en el `index.ts`, y en `order-input.ts` es el mismo objeto (`cancelOrderLineSchema = cancelOrderSchema`).
- `responsiblesFrozen` lleva un mapa de estados copiado de `asignaciones/domain/order-state.ts` (`ERROR_POR_ESTADO`), que no publica predicado. Fuera de `PARCIAL` da lo mismo que `isFinalOrderStatus` de hoy.
- Las opciones del selector usan `aria-disabled` y no `disabled`: siguen siendo enfocables y el lector lee el motivo.

Veredicto: T9, T10 y T12 hechas, en verde, sin cablear.

## Tanda 3 — el cambio de la pantalla y del contrato

### T13 (backend_dev)

Una sesión anterior dejó T13 a medias sin commit; esta la revisa contra design § 3.1 y § 3.2 y la termina.

Archivos de `lib/`:
- modificados: `lib/composition/index.ts` (fuera `listOrderLineIds`), `lib/modules/pedidos/index.ts` (fuera `createListOrderLineIds`; publica `cancelOrderLineSchema`), `domain/order-input.ts` (borrados los esquemas planos y los nombres provisionales: `createOrderSchema`/`updateOrderSchema` son los de `lines`, `updateOrderDistributionSchema` lleva `lineId`; `quoteOrderCostSchema` y `orderPresentationAvailabilitySchema` salen de `orderLineInputSchema.pick`), `domain/create-order.ts`, `domain/update-order.ts`, `domain/get-order-delivery.ts` y `domain/list-order-deliveries.ts` (`lineId` obligatorio; `lineStatus` ya no es `null`), `adapters/driving/order-actions.ts` (`createOrderAction(input)`, `updateOrderAction(id, input)`, `OrderLinesErrorState`, `UpdateOrderFormState`, reparto con `parsed.data.lineId`, cotización sin `withOrderLine`, lecturas de entregas con `lineId: string`; borrados `buildCreateCandidate`, `buildUpdateCandidate`, `readPresentationLines`, `singleLineIdOf`, `requireSingleLineIdOf`, `withOrderLine` y los lectores de `FormData` que solo usaban ellos).
- borrado: `lib/modules/pedidos/domain/list-order-line-ids.ts` (no tenía test propio).

Archivos de `tests/`:
- de la sesión anterior: `fixtures/order-delivery-void.ts`, `unit/identity/session-once-per-request-actions.test.ts`, `unit/pedidos/{get-order-delivery,list-order-deliveries,order-actions,order-actions-customer,order-actions-delivery,order-actions-delivery-void,order-actions-distribution,order-input}.test.ts`.
- de esta sesión: `unit/pedidos/order-input-lines.test.ts` (nombres finales + bloque R40), `unit/pedidos/qc138-transversales.test.ts` (R21 sobre la forma con `lines`), `unit/pedidos/qc195-contrato-tipos.test.ts` (`lineId` en `UpdateOrderDistributionInput`), `integration/pedidos/order-delivery.int.test.ts` y `order-delivery-void.int.test.ts` (pasan la receta del escenario, `crearPedido(...).orderLineId`), `integration/pedidos/order-delivery-by-line.int.test.ts` (fuera los dos casos de la lectura sin receta, que ya no existe).

Mapa `R<n> -> test`:
- R14 -> `order-actions.test.ts` > «R14: la cotizacion entrega la entrada tal cual, con el orderLineId que manda el sub-panel», «R14: un orderId en la cotizacion ya no se cambia por una receta del pedido»
- R15 -> `order-actions.test.ts` > «R15: order_would_block del alta y de la edicion trae las posiciones de las recetas que bloquearian», «R15: un fallo de receta trae su codigo, el mensaje del catalogo y su posicion, sin el diagnostico», «R15: las posiciones salen de menor a mayor y sin repetir»
- R31 -> `order-actions-distribution.test.ts` > «R31: llama a la fachada con la receta, el unitId y las lineas ya validadas…», «R31: en un pedido de dos recetas entrega la receta de la entrada, sin leer las del pedido ni rechazarlo», «R31: sin lineId, o con uno sin forma de uuid, responde invalid_input sin llamar a la fachada»
- R40 -> `order-input-lines.test.ts` > «R40: createOrderSchema y updateOrderSchema son un pedido con lines; updateOrderDistributionSchema lleva lineId», «R40: una receta suelta, sin lines, ya no es un pedido valido»; `qc138-transversales.test.ts` > «R21: el esquema del formulario de pedido no declara estado…» (forma con `lines`)
- R41 -> `order-actions.test.ts` > «R41: el alta de tres recetas llega intacta al caso de uso…», «R41: la edicion de tres recetas (dos guardadas y una nueva) llega intacta al caso de uso», «R41: ninguna de las dos lee las recetas del pedido para completar la entrada»
- R33/R35 con `lineId` obligatorio -> `get-order-delivery.test.ts` > «R33: la receta es obligatoria: sin ella responde order_not_found sin consultar»; `list-order-deliveries.test.ts` > «R35: la receta es obligatoria: sin ella responde order_not_found sin leer nada»; `order-actions-delivery.test.ts` > «R33: getOrderDeliveryAction pasa el pedido, la receta…», «R35: listOrderDeliveriesAction pasa el pedido, la receta…»
- QT-313 R44 (retirado): los dos tests «R44: el alta envia una linea…» y «R44: editar desde el formulario un pedido de dos lineas responde invalid_input…» de `order-actions.test.ts` se reescribieron a R41 (los tres de arriba).

Grep del «Hecho» (`createOrderWithLinesSchema|updateOrderWithLinesSchema|updateOrderLineDistributionSchema|requireSingleLineIdOf|listOrderLineIds` en `lib/ app/ tests/`): un solo resultado, `tests/unit/pedidos/order-actions.test.ts:1086`, que es la guardia R41 que busca esos nombres por regex en el fuente de `order-actions.ts` para afirmar que NO están. Se deja: sin el literal no hay guardia.

Verificación (salida real, por archivo):
- `order-input-lines` 18 passed · `order-input` 56 passed · `order-actions` 36 passed · `order-actions-distribution` 26 passed · `order-actions-delivery` 31 passed · `order-actions-delivery-void` 25 passed · `order-actions-customer` 26 passed · `get-order-delivery` 43 passed · `list-order-deliveries` 27 passed · `qc138-transversales` 12 passed · `qc195-contrato-tipos` 6 passed · `session-once-per-request-actions` 118 passed · `pedidos-convenciones` 20 passed | 3 skipped.
- `pnpm exec vitest run guard`: `Test Files 87 passed (87) · Tests 1333 passed | 22 skipped (1355)`.
- Integración (`order-delivery*.int.test.ts`): NO corridos, el worktree no tiene `.env` (`test-db: falta DATABASE_URL`). Compilan (typecheck).
- `pnpm run lint`: `0 errors, 11 warnings` (todas en archivos ajenos).
- `pnpm run typecheck`: `lib/` y los tests que toca T13 en verde. Quedan, para frontend_dev:
  - `app/(private)/pedidos/components/order-deliveries-sheet.tsx(39)`: `listOrderDeliveriesAction` pide `lineId` (T16)
  - `app/(private)/pedidos/components/order-delivery-sheet.tsx(128)`: `getOrderDeliveryAction` pide `lineId` (T16)
  - `app/(private)/pedidos/components/order-form.tsx(334, 339)`: `createOrderAction(input)` / `updateOrderAction(id, input)` (T14)
  - `app/(private)/pedidos/components/order-ingredients-table.tsx(110)`: `createOrderSchema.shape.quantity` -> `orderLineInputSchema.shape.quantity` (T14)
  - `tests/unit/pedidos-ui/order-form.test.tsx(1221, 1262)`: `CreateOrderFormState` de error exige `linePositions` (T14 reescribe `order-form*.test.tsx`)
  - `tests/unit/pedidos-ui/order-sheet.test.tsx(557)`: idem, `CreateOrderFormState` sin `linePositions` (T15)
  - `app/layout.tsx(45) LayoutProps`: ajeno, conocido.

Decisiones nuevas:
- `updateOrderAction` devuelve `UpdateOrderFormState` (con `linePositions` en el error), distinto de `OrderMutationFormState`, que se queda para cancelar, borrar y cliente.
- El test R40 compara por identidad lo publicado en `@/lib/modules/pedidos` con `order-input.ts` en vez de buscar por texto los nombres viejos, para no añadir más literales al Grep del «Hecho».

Veredicto: T13 hecha; `lib/` y sus tests en verde; la pantalla queda rota en los 5 puntos de `app/` listados, que arreglan T14–T16.

### T14 (frontend_dev)

Panel con la forma B (tabla de recetas y sub-panel). Sin commit propio: lo hace el implementer.

Archivos:
- nuevos:
  - `app/(private)/pedidos/components/order-lines-table.tsx` (`OrderLinesTable`, `OrderLinesEmpty`, `OrderLinesTotals`)
  - `app/(private)/pedidos/components/order-line-sheet.tsx` (`OrderLineSheet`)
  - `tests/helpers/order-form-ui.ts` (el pedido de dos recetas y los gestos comunes)
  - `tests/unit/pedidos-ui/order-form-lines-error.test.tsx`, `order-line-sheet.test.tsx`, `order-lines-table.test.tsx`
- modificados (producción):
  - `order-form.tsx`: rehecho;
  - `order-ingredients-table.tsx`: `orderLineInputSchema.shape.quantity`;
  - `use-order-cost-quote.ts`: el 2.º parámetro pasa a ser `orderLineId`; se envía `orderLineId` y nunca `orderId`;
  - `components/index.ts`: solo reexportaciones.
- reescritos: `tests/unit/pedidos-ui/order-form{,-customer,-leftover,-quote,-sale-price}.test.tsx`.
- adaptados, porque montan el panel:
  - `tests/unit/paridad/order-form-image-paridad.test.tsx`: abre el sub-panel; sus snapshots no cambian.
  - `tests/unit/paridad/formularios-paridad.test.tsx` y su `.snap`, entrada «pedido»:
    - el pedido trae una receta;
    - el error de campo pasa a ser el aviso por receta;
    - `errorGeneral` lleva `linePositions`;
    - se regeneran los 7 snapshots del pedido; los de los demás formularios no cambian.
  - `tests/unit/pedidos-ui/pedidos-viewport.test.tsx`: mide los campos en el sub-panel.
  - `tests/unit/pedidos-ui/pedidos-toasts.test.tsx`:
    - el alta pasa por el sub-panel;
    - la edición lleva una receta;
    - el error trae `linePositions`.
  - `tests/unit/pedidos-ui/order-row-wiring.test.tsx`: en un caso, el título nombra el pedido en vez de leer la cantidad.
  - `tests/guards/guard-identificador-de-request.test.ts`: la excepción declarada de `setIngredientsError` se muda, con el mismo motivo, de `order-form.tsx` a `order-line-sheet.tsx`, donde vive ahora.
- borrados: ninguno. `blocked-order-dialog.tsx` se queda: lo usa «Reparto y unidad», pero el panel ya no lo monta.

Mapa `R<n> -> test`:
- R1 -> `order-form.test.tsx` > «R1: cliente, prioridad, tabla vacía con su aviso, «Añadir receta» y «Guardar pedido» deshabilitado», «R1: el panel no tiene campos de receta…», «R1: la prioridad ofrece las cuatro del contrato y arranca en la de defecto»
- R2:
  - `order-form.test.tsx` > «R2: una fila por receta, en el orden del pedido…», «R2: debajo, el total del precio…», «R2: ningún dato de receta sale de los campos planos del pedido»
  - `order-lines-table.test.tsx` > «R2: cabeceras y, por receta…», «R2: «Editar» avisa con la clave de su receta», «R2: sin recetas no pinta tabla…»
- R3:
  - `order-form.test.tsx` > «R3: «Añadir receta» abre el sub-panel vacío…», «R3: el «Editar» de una receta abre el sub-panel con los valores de esa receta»
  - `order-line-sheet.test.tsx` > «R3: al editar, cada campo viene con el valor de esa receta y pide sus insumos», «R3: con una versión…», «R3: elegir una receta con imagen…»
- R4:
  - `order-form.test.tsx` > «R4: una receta nueva aplicada queda al final…», «R4: una receta editada se queda en su sitio…», «R4: si un campo no pasa el esquema…»
  - `order-line-sheet.test.tsx` > los cinco «R4: …» de «aplicar» (con «la cantidad se coloca a dos decimales»), «R4: elegir una versión…», «R4: una línea de reparto añadida viaja con la receta…»
  - `order-form-leftover.test.tsx` > los cuatro «R4: …»
- R5:
  - `order-form.test.tsx` > «R5: «Descartar» cierra el sub-panel y deja la tabla como estaba», «R5: «Volver al pedido» tampoco añade la receta nueva»
  - `order-line-sheet.test.tsx` > «R5: «Descartar» y «Volver al pedido» cierran sin devolver la receta»
- R6 -> `order-form.test.tsx` > «R6: añadir, editar y quitar recetas no llama a ninguna acción de guardado», «R6: cerrar el panel sin guardar pierde el borrador…»
- R7:
  - `order-form.test.tsx` > «R7: el alta envía en una sola operación…», «R7: la edición envía las guardadas con su id, las nuevas sin él, y no envía las canceladas», «R7: con éxito, el panel avisa…», «R7: dentro de `OrderSheet`, guardar cierra el panel, avisa con un toast y refresca el listado»
  - `order-form-customer.test.tsx` > los seis «R7: …»
- R8 -> `order-line-sheet.test.tsx` > «R8: no deja aplicar la misma original…», «R8: sí deja aplicarla si su única otra aparición está cancelada», «R8: editar una receta no choca consigo misma»
- R10:
  - `order-form.test.tsx` > «R10: una receta guardada en un estado no editable sale con «Solo lectura»…», «R10: «Añadir receta» está disponible en PARCIAL y la de solo lectura viaja sin cambios»
  - `order-lines-table.test.tsx` > «R10: las no editables y las canceladas salen con «Solo lectura»…»
- R11:
  - `order-form.test.tsx` > los tres «R11: …»
  - `order-line-sheet.test.tsx` > «R11: una guardada en PENDIENTE o BLOQUEADO ofrece «Quitar receta»…», «R11: una guardada EN_CURSO no lo ofrece…»
- R12 -> `order-form.test.tsx` > «R12: una cancelada sale en solo lectura y no suma…», «R12: con solo canceladas sale el aviso de R1…»
- R13:
  - `order-form.test.tsx` > los dos «R13: …»
  - `order-line-sheet.test.tsx` > los cuatro «R13: …» (vacío, 0, negativo, cinco decimales)
  - `order-lines-table.test.tsx` > los dos «R13: …»
  - `order-form-sale-price.test.tsx` > los cuatro «R13: …»
- R14 -> `order-form-quote.test.tsx` >
  - «R14: una receta guardada se cotiza con su propio identificador de receta»
  - «R14: la segunda receta lleva su identificador y su versión…»
  - «R14: una receta nueva se cotiza sin identificador»
  - «R14: lo cotizado viaja con la receta aplicada…»
  - «R14: una receta EN_CURSO enseña su estimado guardado y no se cotiza…»
  - «R14: una receta PENDIENTE de un pedido EN_CURSO sí se cotiza»
- R17 -> `order-form-lines-error.test.tsx` > los ocho «R17: …»:
  - aviso y fila marcada;
  - numeración por fila, con canceladas;
  - «Guardar bloqueada» en la edición y en el alta;
  - «Revisar receta»;
  - textos y 44 px;
  - otro código, con el mensaje del catálogo;
  - `insufficient_material`.
- R44:
  - `order-lines-table.test.tsx` > «R44: la tabla pasa a tarjetas por debajo de 768 px…»
  - `order-line-sheet.test.tsx` > «R44: en el teléfono el sub-panel ocupa todo el ancho…», «R44: los botones del pie tienen objetivo táctil de 44 px»
- R46:
  - `order-form-lines-error.test.tsx` > «R46: el aviso de error por receta entra con la animación de los avisos»
  - `order-line-sheet.test.tsx` > «R46: el sub-panel entra con la misma curva y duración que el panel»
- R50 -> `order-form.test.tsx` > «R50: muestra el mensaje del catálogo, el panel sigue abierto y el borrador intacto», «R50: no hay regla propia de «sin cambios»…», «R50: un fallo inesperado enseña su identificador en la misma región»

Verificación (salida real, `pnpm exec vitest run <archivo>` uno a uno):
- De T14:

  | Archivo | Pasados |
  |---|---|
  | `order-form` | 31 |
  | `order-form-lines-error` | 9 |
  | `order-line-sheet` | 23 |
  | `order-lines-table` | 7 |
  | `order-form-quote` | 7 |
  | `order-form-customer` | 6 |
  | `order-form-sale-price` | 4 |
  | `order-form-leftover` | 6 |

- Adaptados:

  | Archivo | Pasados |
  |---|---|
  | `formularios-paridad` | 65 |
  | `order-form-image-paridad` | 3 |
  | `pedidos-viewport` | 20 |
  | `pedidos-toasts` | 26 |
  | `order-row-wiring` | 17 |

- Sin tocar, consumidores del panel o de lo que cambió:

  | Archivo | Resultado |
  |---|---|
  | `order-ingredients-table` | 24 passed |
  | `order-cost-quote` | 15 passed |
  | `use-order-cost-quote` | 6 passed |
  | `marca/tablas-marca` | 21 passed |
  | `campos-paridad` | 30 passed |
  | `buscadores-paridad` | 64 passed |
  | `order-sheet-coverage` | 5 passed |
  | `order-sheet-responsibles` | 11 passed |
  | `order-list-section` | 41 passed |
  | `order-table` | 27 passed |
  | `order-cards` | 20 passed |
  | `order-row-actions` | 219 passed |
  | `a11y-tactil` | 5 passed |
  | `read-only` | 45 passed |
  | `pedidos-page-header` | 3 passed |
  | `recipe-picker` | 9 passed |
  | `shared-ui/campos` | 23 passed |
  | `pedidos-convenciones` | 20 passed, 3 skipped |
  | `order-route-contract` | 23 passed |

- Guardias, por archivo:

  | Guardia | Resultado |
  |---|---|
  | `guard-pantalla-pedidos-se-amplia` | 8 passed, 2 skipped |
  | `guard-pedidos-rediseno` | 2 passed |
  | `guard-identificador-de-request` | 23 passed |
  | `guard-formularios-y-acciones` | 20 passed, 3 skipped |
  | `guard-piezas-base` | 25 passed, 1 skipped |
  | `guard-catalogo-de-componentes` | 59 passed |
  | `guard-catalogo-de-errores` | 34 passed |
  | `guard-arquitectura-modulos` | 62 passed |
  | `guard-ambito-empresa-pedidos` | 77 passed |

  También en verde: `guard-anillo-de-foco`, `guard-autorizacion-por-permiso`, `guard-buscadores`, `guard-pantallas-de-anadido`, `guard-pantallas-exigen-permiso`, `guard-qc102-limites-de-la-ficha`, `guard-qc260-limites-de-la-ficha`, `guard-qc261-limites-de-la-ficha`, `guard-qc87-no-reimplementado`, `guard-teclear-y-plazo`, `guard-tests-de-arbol-en-el-gate` y `guard-test-rapido-rojos-heredados`.
- **En rojo, y es de T15:** `order-sheet.test.tsx`, 5 failed y 7 passed. Sus casos rellenan la receta en el panel o leen `recipe-picker-value`, y además tiene su error de tipos en la línea 557. No se toca.
- `pnpm run typecheck`: sin errores en archivos de T14. Quedan solo:
  - `order-deliveries-sheet.tsx(39)` y `order-delivery-sheet.tsx(128)`: de T16;
  - `tests/unit/pedidos-ui/order-sheet.test.tsx(557)`: de T15;
  - `app/layout.tsx(45) LayoutProps`: ajeno.
- `pnpm run lint`: `✖ 11 problems (0 errors, 11 warnings)`, todos en archivos ajenos.
- No se corrió `vitest related` ni la suite completa.

Decisiones nuevas (dentro del spec):
1. **Guardar no usa `<form action>`.**
   - Con `<form action>`, React reinicia los campos no controlados al terminar, y tras un rechazo la prioridad volvería a su valor inicial (R50).
   - El panel sigue siendo `FormSheet`, pero envía por `onSubmit` con `preventDefault`, y `useActionState` recibe la entrada tipada.
   - El `SaveButton` marca el envío con `busy`, y `formAction` recibe una función vacía.
2. **De dónde salen la prioridad y el cliente.** La prioridad se lee del `FormData` del panel, y el cliente, del estado del selector. Con los dos arma el candidato `candidateOf` (T9).
3. **Tabla y tarjetas van las dos en el DOM**, con `md:hidden` y `hidden md:block`.
   - `useIsMobile` necesita `matchMedia`, que jsdom no tiene, y habría roto todos los tests que montan el panel.
   - Las tarjetas llevan `order-lines-card`, y las filas, `order-lines-row`.
4. **El aviso de sobrante pasa a «Aplicar» del sub-panel**, porque el reparto ya es de una receta.
   - Textos: «¿Aplicar la receta igualmente?» y «Aplicar con sobrante».
   - «Aplicar» se deshabilita con `availabilityBlocksSave`, como antes «Guardar».
5. **«Quitar receta» solo sale al editar una receta que ya está en la tabla**: una nueva del borrador, o una guardada en `PENDIENTE` o `BLOQUEADO`. Mientras se añade una, no sale, porque haría lo mismo que «Descartar».
6. **Errores por receta:**
   - las filas se marcan por la `key` de la receta, no por su índice;
   - las marcas siguen después de «Revisar receta», hasta el siguiente guardado;
   - «receta N» es la fila de la tabla en el momento de enviar, desde 1;
   - «Guardar bloqueada» reenvía el candidato guardado con `confirmBlocked: true`.
7. **Una receta nueva sale en la tabla con el estado «Pendiente»**, como en el tablero.
8. **Los errores del servidor que antes marcaban un campo** (`CODE_TO_FIELD`: `recipe_not_found`, `unit_not_found`, los del reparto…) llegan ahora con posiciones y van al aviso por receta. Sin posiciones, van a la región general.

Tests de QT-313 retirados o reescritos: ninguno de los de QT-313 R44 o R54 estaba en `order-form*.test.tsx`. De los casos del formulario de una receta:
- se retiraron o se reescribieron sobre el sub-panel (`order-line-sheet`, `order-form-quote`, `order-form-leftover`) los de:
  - el `FormData`;
  - el campo de estado y la fecha;
  - `CODE_TO_FIELD`;
  - `BlockedOrderDialog` en el panel;
  - el título «receta × cantidad»;
  - el reparto, los insumos y la versión dentro del panel.
- se portaron al panel nuevo el redondeo de la cantidad a dos decimales (`order-line-sheet`) y las cuatro prioridades con su defecto (`order-form`);
- no se portaron los de la tabla de ingredientes con stock (restante, faltante, sin unidad), que ya cubre `order-ingredients-table.test.tsx` montando la tabla sola.

Veredicto: T14 hecha. Sus tests y los adaptados, en verde. Quedan en rojo `order-sheet.test.tsx` (T15) y los dos errores de tipos de T16.

### T15 (frontend_dev)

Listado, menú en tres grupos y cableado del detalle, el selector y «Cancelar receta…». Sin commit propio: lo hace el implementer.

Archivos:
- producción (`app/(private)/pedidos/components/`):
  - `order-row-actions.tsx`: reescrito. Tres grupos con `groupLabel` («Por receta», «Pedido entero»); «Ver detalle» nuevo; «Editar» con `canEditOrder`; acciones de receta con `orderOffersLineAction` y su permiso (`canCancelLine` nuevo); «Cancelar pedido» con `canCancelOrder`; «Eliminar» con `canDeleteOrder`. Fuera `isFinalOrderStatus`, `acceptsDistributionEdit`, `acceptsDelivery` y los mapas `ORDER_STATUS_IS_FINAL`, `ORDER_STATUS_ACCEPTS_DISTRIBUTION_EDIT`, `ORDER_STATUS_ACCEPTS_DELIVERY` y `ORDER_STATUS_HAS_DELIVERIES`. Se queda `ORDER_STATUS_ACCEPTS_CUSTOMER_CHANGE`, como pide design § 4.6. `OrderRowActions` pierde los `on<Acción>` sueltos: solo `onAction`, que es lo que ya usaba la tabla.
  - `order-columns.tsx`: «Fórmula» desde `lines[0]` con «+N más»; columna nueva «Avance» (`OrderProgress` corto) tras «Fórmula»; fuera «Presentación»; precio, coste estimado y coste real desde `salePriceTotal` (con «N sin precio»), `ingredientsCostTotal` y `actualCostTotal`; el número de pedido es un botón que emite `detail`; `canCancelLine` llega al menú. «Motivo de cancelación» se queda (P3).
  - `order-table.tsx`: la tarjeta añade «Avance» a los datos secundarios; pasa `canCancelLine`, `onAction` (para «Editar» desde el detalle) y `producedProducts` del pedido a `OrderRowSheetActions`.
  - `order-sheet.tsx` (`OrderRowSheetActions`): `detail` monta `OrderDetailSheet`; las cuatro acciones de receta abren antes `OrderLinePickerDialog`; elegida la receta, su diálogo; `cancelLine` monta `CancelOrderLineDialog` con la receta elegida.
  - `order-list-section.tsx`: `canCancelLine={canModifyOrders}` (1 línea).
  - `order-responsibles-sheet.tsx` (de T16, lo mínimo): `isFinal={responsiblesFrozen(order)}` en vez de `isFinalOrderStatus(order.status)`. `distributionLabelLine` se queda donde está.
  - `index.ts`: solo reexportaciones (fuera las tres funciones retiradas y `PRESENTATION_NAME_COLUMN_ID`).
- tests reescritos o adaptados:
  - `tests/unit/pedidos-ui/order-row-actions.test.tsx`: reescrito entero a R9, R18, R25, R26, R36, R37, R38.
  - `tests/unit/pedidos-ui/order-columns.test.tsx`: fuera los bloques de «Presentación»; nuevos «Fórmula», «Avance», R23, R24, totales y R39.
  - `tests/unit/pedidos-ui/order-row-wiring.test.tsx`: las acciones de receta pasan por el selector; bloque nuevo de detalle, «Cancelar receta…» y permisos.
  - `tests/unit/pedidos-ui/order-sheet.test.tsx`: el alta pasa por el sub-panel (`anadirReceta` de `tests/helpers/order-form-ui.ts`); el error lleva `linePositions` (arregla el error de tipos de la línea 557); la edición mira la tabla de recetas y el sub-panel.
  - `tests/unit/pedidos-ui/order-cards.test.tsx`, `order-table.test.tsx`, `order-list-section.test.tsx`, `order-list-section-produced.test.tsx`: los pedidos traen recetas; totales en vez de campos planos; R23 en la cabecera; los enlaces al producto terminado se miran en el detalle; bloques nuevos de R44 y R26.
  - `tests/unit/shared-ui/confirm-dialog-montado.test.tsx`: el pedido trae una receta PENDIENTE (si no, «Cancelar pedido» sale deshabilitado).
  - `tests/unit/paridad/pedidos-paridad.test.tsx` y su `.snap`: el pedido trae una receta; se regenera solo el snapshot «con filas» (columna «Avance», sin «Presentación», número como botón). Los otros seis no cambian.
  - `tests/guards/guard-pantalla-pedidos-se-amplia.test.ts`: sale el ancla `isFinalOrderStatus` de `order-row-actions.tsx`, con comentario.
  - De T16, solo lo que rompía el cambio del menú: `order-distribution-dialog.test.tsx` (6 casos de la fila) y `order-delivery-sheet.test.tsx` (2 casos de la fila). El pedido trae una receta en el estado que admite la acción y se elige en el selector. No se toca nada de lo que prueban los diálogos.

Mapa `R<n> -> test`:
- R9:
  - `order-row-actions.test.tsx` > «R9: «Editar» habilitado en todo estado salvo ENTREGADO y CANCELADO, PARCIAL incluido», «R9: en PARCIAL, pulsar «Editar» emite la edición», «R9: en %s «Editar» sale deshabilitado y pulsarlo no emite» (ENTREGADO, CANCELADO)
  - `order-row-wiring.test.tsx` > «R9, R18: «Editar» del detalle cambia al panel de edición del mismo pedido»
- R18:
  - `order-row-actions.test.tsx` > «R18: «Ver detalle» es la primera, está siempre habilitada y emite `detail` con el pedido»
  - `order-columns.test.tsx` > «R18: el número es un botón con nombre accesible que abre el detalle del pedido de la fila»
  - `order-row-wiring.test.tsx` > «R18: «Ver detalle» abre el detalle de solo lectura del pedido elegido», «R18: el número de pedido de la fila abre el mismo detalle»
- R20: `order-columns.test.tsx` > «QC-307 R19, R20, R21, R23: los quince ids, en el orden acordado…», «R20: se rotula «Fórmula»», «R20: con dos recetas pinta la primera y «+1 más»», «R20: N es el número de recetas del pedido menos una, canceladas incluidas», «R20: con una sola receta no hay «+N más»», «R20: la columna «Motivo de cancelación» sigue en el listado»
- R21:
  - `order-columns.test.tsx` > «R21: va justo detrás de «Fórmula», se rotula «Avance» y no ordena ni filtra», «R21: pinta «F de T» con su barra…»
  - `order-cards.test.tsx` > «R44, R21: lleva la barra de avance «F de T» antes del cliente»
- R22:
  - `order-columns.test.tsx` > «R22: los dos costes son los totales del pedido…», «R22: un total «sin coste» pinta el marcador de ausencia», «R22: el precio es el total del pedido y avisa de «N sin precio»», «R22: sin recetas sin precio no hay aviso», «R22: con el total «sin precio» pinta el marcador de ausencia y el aviso»
  - `order-cards.test.tsx` > «R22: el precio de la tarjeta es el total y avisa de «N sin precio»»
- R23:
  - `order-columns.test.tsx` > «R23: ningún id ni rótulo de presentación, y ninguna celda pinta el reparto»
  - `order-table.test.tsx` > «R23: ninguna cabecera dice «Cantidad» ni «Presentación», y «Por entregar» sigue»
  - `order-cards.test.tsx` > «R15, R23: la tarjeta no repite columnas que no nombra…»
- R24:
  - `order-columns.test.tsx` > «R24: el nombre sale de la primera receta y no del campo plano del pedido», «R24: con la primera receta distinta del pedido plano, ninguna celda pinta el dato plano»
  - `order-cards.test.tsx` > «R44: el título es la primera receta con «+N más»» (afirma que no sale el plano)
- R25: `order-row-actions.test.tsx` > los ocho «R25: …» (orden de los tres grupos, rótulos y líneas, rótulo en la única acción de receta, sin rótulo «Por receta» si no hay ninguna, textos del tablero, grupos con nombre en el desplegable, grupos en el diálogo centrado, orden con cualquier estado y permiso, destructivas y testids)
- R26:
  - `order-row-actions.test.tsx` > «R26: «%s» se pinta con su permiso solo si alguna receta del pedido la admite, y nunca deshabilitada» (×4), «R26: «%s» no se pinta sin su permiso, aunque alguna receta la admita» (×3), «R26: «Entregas…» no pide permiso propio», «R26: un PARCIAL con una receta TERMINADO y otra PENDIENTE…», «R26: sin ningún permiso, un PARCIAL solo ofrece «Entregas…»…», «R26: cada acción de receta emite su clase con el pedido de la fila»
  - `order-columns.test.tsx` > «R26: con `canCancelLine` el menu ofrece «Cancelar receta…» si alguna receta es cancelable»
  - `order-list-section.test.tsx` > «R26, R42: con pedidos.modificar, un pedido con una receta cancelable la ofrece», «R26, R42: sin pedidos.modificar no la ofrece»
  - `order-row-wiring.test.tsx` > «R26, R27, R28: «Cancelar receta…» abre el selector y, elegida la receta, su diálogo con el pedido y la receta», «R26: sin el permiso, la fila no ofrece «Cancelar receta…»»
- R27: `order-row-wiring.test.tsx` > «R13, R27: %s abre el selector y, elegida la receta, %s para su pedido, y solo ese» (reparto, entregar, entregas), «R27: una receta que no admite la acción no se puede elegir y el selector sigue abierto»
- R36 (habilitación en el menú): `order-row-actions.test.tsx` > «R36: «Cancelar pedido» se pinta siempre y se habilita solo si alguna receta es cancelable», «R36: con todas las recetas sin cancelar posible, pulsar «Cancelar pedido» no emite»
- R37 (habilitación en el menú): `order-row-actions.test.tsx` > «R37: «Eliminar» se pinta siempre y se habilita si el pedido y todas sus recetas se pueden borrar»
- R38 (menú): `order-row-actions.test.tsx` > «R38: «Responsables» está habilitado en todos los estados, PARCIAL incluido», «R38: en PARCIAL «Cliente» está habilitado y emite el cambio de cliente». El panel de responsables en PARCIAL es de T16.
- R39: `order-columns.test.tsx` > «R39: un pedido PARCIAL se pinta «Parcial» con el tono `progress`»
- R42: `order-list-section.test.tsx` > los dos «R26, R42: …»
- R44: `order-cards.test.tsx` > «R44: el título es la primera receta con «+N más»», «R44, R21: lleva la barra de avance…», «R44: el número de la tarjeta abre el detalle del pedido»
- R45: sin test nuevo. El desplazamiento horizontal de la tabla lo da `DataTable` y no cambia: `pedidos-viewport.test.tsx` sigue en verde (20).

Tests de QT-313 R54 (todos en `order-row-actions.test.tsx`):
- «R54: editar, cancelar y eliminar deshabilitados, sin reparto, entrega ni entregas, con «Responsables» y «Cliente» disponibles» -> reescrito a R9 («Editar» habilitado en PARCIAL y emite), R26 (el PARCIAL con una receta TERMINADO y otra PENDIENTE ofrece entregar, entregas y cancelar receta), R36 («Cancelar pedido» en PARCIAL según sus recetas) y R38 («Responsables» y «Cliente» en PARCIAL).
- «R54: PARCIAL es final y no acepta la edicion acotada de reparto» -> retirado: los dos predicados ya no existen. Lo sustituye R26 («Reparto y unidad…» si alguna receta está POR_EMPACAR, también en PARCIAL).
- Retirados también, porque probaban los mapas por estado del pedido que T15 borra:
  - el bloque «el predicado de estado final es UNO solo»;
  - «los estados de acondicionamiento son finales…»;
  - las tablas «orderRowActionsSpec: reglas por estado y permiso (R12)» y «orden, separador y destructivos (R11)».
  - Los sustituyen los bloques R25 y R26, que miran el estado de las recetas.
- Se conservan (adaptados): disparador de 44 px, sin `:hover`, id como dato, ningún ítem repite el número, «Cliente» cerrado en ENTREGADO y CANCELADO, título y emisión de la especificación.

Verificación (salida real, `pnpm exec vitest run <archivo>` uno a uno):
- De T15:

  | Archivo | Pasados |
  |---|---|
  | `order-row-actions` | 37 |
  | `order-columns` | 88 |
  | `order-row-wiring` | 23 |
  | `order-sheet` | 12 |
  | `order-cards` | 24 |
  | `order-table` | 27 |
  | `order-list-section` | 43 |
  | `order-list-section-produced` | 3 |

- Adaptados:

  | Archivo | Resultado |
  |---|---|
  | `shared-ui/confirm-dialog-montado` | 29 passed |
  | `paridad/pedidos-paridad` | 7 passed (1 snapshot actualizado) |
  | `guard-pantalla-pedidos-se-amplia` | 8 passed, 2 skipped |
  | `order-distribution-dialog` | 29 passed |
  | `order-delivery-sheet` | 42 passed |

- Sin tocar, en verde: `read-only` 45, `a11y-tactil` 5, `pedidos-viewport` 20, `order-sheet-coverage` 5, `order-sheet-responsibles` 11, `order-list-skeleton` 4, `pedidos-convenciones` 20 (3 skipped), `order-route-contract` 23, `marca/tablas-marca` 21, `identity/session-once-per-request-render` 13, `recetas/module-contract` 5, `recetas/scope` 5, `navegacion/pantallas-exigen-permiso` 46, `pedidos-page-header` 3, `order-customer-dialog` 9, `identity/qc78-alcance` 12 (4 skipped), `order-detail-sheet` 9, `order-line-picker-dialog` 9, `cancel-order-line-dialog` 6, `order-responsibles` 13, `order-line-actions` 20, `pedidos-toasts` 26, `cancel-order-dialog` 9, `delete-order-dialog` 9, `order-deliveries-sheet` 11, `order-delivery-list` 24, `assign` 11, `delivery-void-dialog` 20, `guard-pedidos-rediseno` 2.
- `pnpm exec vitest run guard`: `Test Files 87 passed (87) · Tests 1333 passed | 22 skipped (1355)`.
- `pnpm run typecheck`: sin errores en archivos de T15. `order-sheet.test.tsx(557)` ya no falla. Quedan solo:
  - `order-deliveries-sheet.tsx(39)` y `order-delivery-sheet.tsx(128)`: de T16;
  - `app/layout.tsx(45) LayoutProps`: ajeno.
- `pnpm run lint`: `✖ 11 problems (0 errors, 11 warnings)`, todos en archivos ajenos.
- No se corrió `vitest related` ni la suite completa.
- Grep de `isFinalOrderStatus|ORDER_STATUS_IS_FINAL|ORDER_STATUS_ACCEPTS_DISTRIBUTION_EDIT|ORDER_STATUS_ACCEPTS_DELIVERY|ORDER_STATUS_HAS_DELIVERIES|acceptsDistributionEdit|acceptsDelivery` en `app/ lib/ components/ tests/`:
  - un comentario viejo en `order-responsibles.tsx:191`, que no es de T15 y no se toca;
  - el comentario nuevo de la guardia.

Decisiones nuevas (dentro del spec):
1. **El permiso de «Cancelar receta…» llega como `canCancelLine`**, igual que `canEditDistribution` y `canEditCustomer`. La sección le pasa `canModifyOrders` y no hace ninguna lectura de sesión más.
2. **«N sin precio» va dentro de la celda del precio**:
   - en la tabla, debajo del importe; en la tarjeta, al lado;
   - si el total no existe, salen el marcador de ausencia y el aviso;
   - testid `order-row-without-price`: `order-lines-without-price` ya lo usa la tabla de recetas del panel.
3. **El selector va dentro de `OrderRowSheetActions`.**
   - La receta elegida vale para esa apertura y esa acción.
   - Al elegirla, el selector se sustituye por el diálogo de la acción, que hereda la apertura.
   - Cerrar el selector sin elegir cierra la acción.
4. **«Editar» desde el detalle llama a `onAction('edit')`** de la tabla, que cambia la acción activa sin cerrar. El detalle sale y entra el panel del mismo pedido.
5. **El reparto con enlaces al producto terminado** vive ahora en el detalle. La tabla le pasa `producedProductsByOrder[order.id]`, y el detalle filtra por el estado de cada receta, como hace T11.
6. **`OrderRowActions` solo emite `onAction`.** Los `onEdit`/`onCancel`/… sueltos no tenían más consumidor que los tests.

Para T16:
- `OrderRowSheetActions` ya resuelve la receta elegida (`pickedLine: OrderLineView`), pero a `OrderDistributionDialog`, `OrderDeliverySheet` y `OrderDeliveriesSheet` todavía les pasa solo `order`, porque hoy no aceptan `line`.
- Cuando T16 les añada la prop `line` (design § 4.7), hay que pasarles `line={pickedLine}` en las tres ramas de `order-sheet.tsx`. Sus ramas ya solo se montan con una receta elegida.
- `order-responsibles-sheet.tsx` ya usa `responsiblesFrozen(order)`. Su rediseño (R38) y sus campos planos siguen siendo de T16.

Pendiente de decisión (no improvisado):
- **R44, pie de la tarjeta con «Ver detalle» y «Acciones».** `DataTableCardLayout.footer` pinta la celda de una columna de la tabla. Un botón «Ver detalle» ahí necesitaría:
  - o una columna nueva, que también saldría en la tabla de escritorio y el tablero no la tiene;
  - o extender `DataTable` con contenido solo de tarjeta, que design § «Componentes nuevos o con cambio» no lista (solo extiende `RowActionsMenu` y `Notice`).
- Se deja el pie como hoy (prioridad + «Acciones»).
- En el teléfono el detalle se abre igual: desde el número de la tarjeta, que es un botón (test R44), y desde «Ver detalle» en «Acciones».
- Hace falta que el humano elija: extender `DataTable` (paso 2, con su fila de catálogo) o aceptar el número como entrada al detalle.

Veredicto: T15 hecha. Sus tests y los adaptados, en verde. Typecheck limpio en los archivos de T15. Queda abierto el pie de la tarjeta (R44).

### T16 (frontend_dev)

Diálogos por receta y del pedido entero. Sin commit propio: lo hace el implementer.

Archivos:
- producción (`app/(private)/pedidos/components/`):
  - `order-distribution-dialog.tsx`: prop nueva `line` (`id`, `quantity`, `unitId`, `unitLabel`, `presentationLines`). Unidad, reparto, cantidad y etiqueta salen de la receta; la entrada lleva `lineId`. `OrderDistributionDraft` gana `lineId`: lo guardado antes del refresco solo se reusa para su receta. `order` queda en `id` + `numberText`.
  - `order-delivery-sheet.tsx`: prop nueva `line` (`id`, `recipeName`, `recipeImageUrl`). Título e imagen de la receta; `getOrderDeliveryAction(order.id, line.id)`. `order` queda en `id` + `numberText`.
  - `order-deliveries-sheet.tsx`: prop nueva `line` (`id`); `listOrderDeliveriesAction(order.id, line.id)` (también al releer tras anular); pasa `lineStatus` a la lista.
  - `order-delivery-list.tsx`: `orderStatus` -> `lineStatus: OrderLineStatus`; `STATUS_ACCEPTS_VOID` es un mapa por estado de receta.
  - `cancel-order-dialog.tsx`: nombra las recetas que se cancelan (`isCancellableStatus`) y las que se quedan; testids `cancel-order-cancelled-lines` y `cancel-order-kept-lines`.
  - `order-sheet.tsx`: solo `line={pickedLine}` en las ramas `distribution`, `deliver` y `deliveries` (con el mismo `pickedLine === undefined ? null :` que ya usaba `cancelLine`).
  - `order-responsibles.tsx`: solo el comentario viejo de `isFinal` que nombraba `isFinalOrderStatus`.
  - `index.ts`: reexporta los dos testids nuevos.
  - `order-responsibles-sheet.tsx`: sin cambios (ver «Bloqueos de T16»).
- tests:
  - `order-distribution-dialog.test.tsx`: el fixture pone reparto, unidad y cantidad en la receta, y otros distintos en los campos planos; las entradas esperadas llevan `lineId`; bloque nuevo R30.
  - `order-delivery-sheet.test.tsx`: `line` en cada montaje; la lectura se espera con `lineId`; bloque nuevo R32.
  - `order-deliveries-sheet.test.tsx`: `line` y `lineId`; bloque nuevo R34.
  - `order-delivery-list.test.tsx`: `lineStatus` en vez de `orderStatus`; los casos de «Anular» por estado pasan a R34 por estado de receta.
  - `cancel-order-dialog.test.tsx`: bloque nuevo R36.
  - `order-sheet-responsibles.test.tsx`: el fixture admite recetas; bloque nuevo R38.
  - nuevo `order-whole-actions.test.tsx`: R36 y R37 desde una fila viva.
  - `pedidos-toasts.test.tsx`: los dos montajes directos pasan `line` (el typecheck lo pedía).

Mapa `R<n> -> test`:
- R28: ya cubierto por T12 (`cancel-order-line-dialog.test.tsx`) y su cableado por T15 (`order-row-wiring.test.tsx`). T16 no toca `CancelOrderLineDialog`.
- R30: `order-distribution-dialog.test.tsx` > «R30: el diálogo viene con el reparto, la unidad y la cantidad de la receta, no con los del pedido», «R30: elegida la segunda receta en el selector, trae su reparto y guarda con su lineId», «R30: lo guardado de una receta no se arrastra a otra abierta antes del refresco»
- R32: `order-delivery-sheet.test.tsx` > «R32: el panel lleva el nombre y la imagen de la receta elegida, no los del pedido», «R32: pide lo que queda por entregar de esa receta, con el pedido PARCIAL», «R32: registra la entrega de esa receta con el pedido PARCIAL»
- R34:
  - `order-deliveries-sheet.test.tsx` > «R34: pide solo las entregas de la receta elegida, también al releer tras anular», «R34: con la receta %s y el pedido PARCIAL ofrece «Anular»» (TERMINADO, ENTREGADO), «R34: manda el estado de la receta, no el del pedido: …», «R34: con la receta TERMINADO y sin el permiso de anular no ofrece «Anular»»
  - `order-delivery-list.test.tsx` > «R34: con canVoid y la receta %s, cada entrega con algun par sin anular ofrece «Anular» y emite la entrega» (×2), «R34: con la receta %s no ofrece «Anular» aunque haya permiso» (×8)
- R36:
  - `cancel-order-dialog.test.tsx` > «R36: lista las cancelables y, aparte, las que se quedan como están», «R36: con todas cancelables no hay lista de las que se quedan», «R36: varias que se quedan van en plural, también una ya cancelada», «R36: una receta sin nombre se nombra con el marcador de ausencia»
  - `order-whole-actions.test.tsx` > «R36: desde la fila de un PARCIAL, el diálogo nombra las que se cancelan y las que se quedan»
- R37: `order-whole-actions.test.tsx` > «R37: %s sigue `isDeletableOrder`» (×4: un PENDIENTE borrable abre el diálogo de borrar; tres PARCIAL no borrables salen deshabilitados y no lo abren), «R37: los casos cubren las dos ramas de la regla»
- R38: `order-sheet-responsibles.test.tsx` > «R38: con una receta activa %s, «Responsables» abre y ofrece los controles de escritura» (PENDIENTE, EN_CURSO, BLOQUEADO), «R38: sin ninguna receta activa que lo admita (la otra %s), «Responsables» abre sin controles de escritura» (POR_EMPACAR, EN_EMPAQUE, TERMINADO, ENTREGADO, CANCELADO)

Verificación (salida real, `pnpm exec vitest run <archivo>` uno a uno):

| Archivo | Resultado |
|---|---|
| `order-distribution-dialog` | 32 passed (29 + 3) |
| `order-delivery-sheet` | 45 passed (42 + 3) |
| `order-deliveries-sheet` | 16 passed (11 + 5) |
| `order-delivery-list` | 23 passed (antes 24: el `it.each` por estado ya no incluye `PARCIAL`, que no es estado de receta) |
| `cancel-order-dialog` | 13 passed (9 + 4) |
| `order-sheet-responsibles` | 19 passed (11 + 8) |
| `order-whole-actions` (nuevo) | 6 passed |
| `pedidos-toasts` | 26 passed |
| `paridad/confirmaciones-paridad` | 56 passed, sin tocar el snapshot (una pasada con 1 fallo en «estado de usuario», ajeno; dos repeticiones en verde) |
| `order-row-wiring` | 23 passed |
| `order-sheet` | 12 passed |
| `order-responsibles` | 13 passed |
| `pedidos/order-delivery` | 48 passed |
| `guard-formularios-y-acciones` | 20 passed, 3 skipped |
| `guard-pantalla-pedidos-se-amplia` | 8 passed, 2 skipped |
| `guard-piezas-base` | 25 passed, 1 skipped |
| `guard-pedidos-rediseno` | 2 passed |
| `pedidos-convenciones` | 20 passed, 3 skipped |
| `delivery-void-dialog` | 20 passed |

- `pnpm run typecheck`: solo `app/layout.tsx(45,56) LayoutProps` (ajeno). Ya no fallan `order-deliveries-sheet.tsx(39)` ni `order-delivery-sheet.tsx(128)`.
- `pnpm run lint`: `✖ 11 problems (0 errors, 11 warnings)`, todos en archivos ajenos.
- No se corrió `vitest related` ni la suite completa.

Decisiones nuevas (dentro del spec):
1. **El texto de «Cancelar pedido» sigue el tablero**: «Se cancelan las recetas que aún no se fabricaron: A, B y C.» y «D se queda como está.» / «D y E se quedan como están.». El tablero dice «ya está terminada»; aquí no, porque la que se queda puede estar en cualquier estado no cancelable, también `CANCELADO` (se lista entre las que se quedan). Los nombres se unen con `Intl.ListFormat('es')`; una receta sin nombre sale con el marcador de ausencia.
2. **«Un pedido cancelado ya no se puede editar.»** solo sale si el pedido acaba cancelado entero (ninguna receta viva se queda). Sin recetas el texto es el de hoy, y el snapshot de paridad no cambia.
3. **Lo guardado en «Reparto y unidad» antes del refresco va atado a su receta** (`OrderDistributionDraft.lineId`). Si no, guardar una receta y abrir otra antes del refresco precargaba el reparto de la primera.
4. **Los títulos de «Reparto y unidad» y «Entregas» no cambian.** El tablero no los fija. Siguen nombrando el pedido y no la receta.
5. **`OrderDeliveryList` recibe `lineStatus`** y no `orderStatus` (design § 4.7). `OrderDeliveriesSheet` le pasa `view.lineStatus`.

Bloqueos de T16 (no improvisados):
- **`order-responsibles-sheet.tsx`, la ficha de solo lectura.** Hoy pinta nombre, imagen, cantidad, unidad y reparto desde los campos planos de la primera receta. Eso choca con R24 y deja a T17 sin poder borrarlos (su «Hecho» pide que ningún archivo de `app/` los lea). Ni design § 4.7 ni el tablero (`PedidosVariasRecetas*.dc.html` no dibuja este panel) dicen qué pinta con varias recetas, y requirements dice «con sus pantallas de hoy». Opciones:
  - (a) cabecera con la primera receta y «+N más», como la fila y la tarjeta (R20/R44), y fuera las filas «Cantidad» y «Reparto», que ya están por receta en el detalle (R18, R23);
  - (b) una fila por receta con nombre, cantidad y reparto, como las tarjetas del detalle;
  - (c) solo número, estado, prioridad y cliente.
  Lo que pide T16 para R38 (escritura en `PARCIAL`) ya funciona con `responsiblesFrozen(order)` y tiene sus tests. `distributionLabelLine` sigue ahí y lo importa `order-detail-sheet`.
- **El borrador de la entrega va por pedido, no por receta** (`order-delivery-draft.ts` y `use-order-delivery-draft.ts`, fuera del alcance de T16). Con dos recetas `TERMINADO` en el mismo pedido, abrir «Entregar» de la segunda tras dejar a medias la primera descarta los envases de la primera y enseña el aviso «Algunos lotes del borrador ya no están disponibles…». La entrega registrada es correcta; lo que se pierde es el borrador. Arreglarlo es poner `lineId` en la clave y en la validación del borrador. Es poco, pero toca dos archivos que T16 no lista.
- R44 (pie de la tarjeta) sigue abierto desde T15. T16 no lo toca.

Veredicto: T16 hecha salvo la ficha de `order-responsibles-sheet.tsx`, que espera decisión. Los diálogos trabajan por receta, sus tests están en verde y en el typecheck solo queda `LayoutProps`.

### Cierre de la Tanda 3 (implementer, salida real, 2026-11-09)

Commits: `91750769b` (T13), `0e4c22523` (T14), `a48f82d17` (T15), `c460b0302` (T16) y el de este cierre.

- `pnpm exec tsc --noEmit -p .`: solo `app/layout.tsx(45,56) TS2304 LayoutProps` (conocido, faltan `.next/types`).
- `pnpm run lint`: `✖ 11 problems (0 errors, 11 warnings)`, todos en archivos ajenos.
- `tests/unit/pedidos-ui/` (66 archivos) en 11 lotes de 6, `pnpm exec vitest run <6 archivos>`: 11/11 lotes en verde,
  1067 tests pasados y 3 saltados (44, 160, 98, 124, 84, 101, 94, 115, 85, 79+3 skip, 83).
- `pnpm exec vitest run guard`: `Test Files 87 passed (87)`, `Tests 1333 passed | 22 skipped (1355)`.
- `.int` tocados en la tanda, uno a uno, con `.env` copiado del worktree principal (verification.md: cada corrida
  crea y borra su base efímera `qct_*`; no toca la de desarrollo):
  - `order-delivery-by-line.int.test.ts`: 2 passed
  - `order-delivery-void.int.test.ts`: 16 passed
  - `order-delivery.int.test.ts`: 25 passed
- **Rojo encontrado y arreglado:** `tests/unit/shared-ui/catalogo-qc256.test.ts` (6 fallos, no está en
  `tests/baseline-rojos.json`). Lo causó la Tanda 2: T6 y T7 añadieron los tres tableros de
  `PedidosVariasRecetas*` a la columna Diseño de `RowActionsMenu` y `Notice` en `CATALOGO.md`, y el test
  compara esa celda exacta. Se actualizó lo que espera, igual que hizo QC-265 (`b2f85353a`) con el segundo
  tablero de `Notice`. Tras el cambio: 6 passed.
- **Incidente de verificación:** el último lote del bucle salió con argumentos vacíos y `vitest run` corrió
  la suite unitaria entera una vez (1694 archivos en verde, 1 rojo: el `catalogo-qc256` de arriba). No fue
  intencionado. No sustituye al gate de CI.

Bloqueos abiertos al cerrar la tanda (detalle en «Bloqueos»): R44 pie de la tarjeta (T15), ficha de solo
lectura de `order-responsibles-sheet.tsx` (T16, condiciona T17) y borrador de entrega por pedido (T16).

## Tanda 4

### T16b (frontend_dev)

Enmienda F2.1 (design § 4.5 y § 4.7). Resuelve los tres bloqueos de la tanda 3 (R44 pie de la
tarjeta, ficha de «Responsables», borrador de entrega por pedido). Sin commit propio.

Archivos modificados:
- `app/(private)/pedidos/components/order-responsibles-sheet.tsx`: la cabecera conserva número, estado
  del pedido, prioridad y cliente; los datos sueltos de la primera receta (y su imagen) se sustituyen
  por una lista «Recetas» con una fila por receta de `order.lines`, ordenada por `position` y con las
  canceladas: nombre, cantidad con `unitLabel`, reparto (`OrderDistributionLabel` +
  `distributionLabelLine`) y `OrderStatusBadge` de la receta. Nuevo `ORDER_RESPONSIBLES_LINE_TESTID` y
  rótulo `lines`. `responsiblesFrozen` sin cambios.
- `app/(private)/pedidos/components/index.ts`: reexporta `ORDER_RESPONSIBLES_LINE_TESTID`.
- `app/(private)/pedidos/components/order-delivery-draft.ts`: `orderDeliveryDraftKey(orderId, lineId)`;
  el borrador guarda `lineId`; `parseOrderDeliveryDraft(raw, orderId, lineId)` descarta el que no
  coincide en los dos; `newOrderDeliveryDraft`, `loadOrderDeliveryDraft` y `clearOrderDeliveryDraft`
  reciben `lineId`.
- `app/(private)/pedidos/components/use-order-delivery-draft.ts`: `useOrderDeliveryDraft(orderId, lineId)`.
- `app/(private)/pedidos/components/order-delivery-sheet.tsx`: pasa `line.id` al hook.
- tests: `order-sheet-responsibles.test.tsx` (el caso «la ficha muestra los datos del pedido como texto»
  ya no mira la imagen ni los campos planos: monta una receta; bloque nuevo R51),
  `order-delivery-draft.test.ts` (llamadas con `lineId`; caso «sin receta» en los descartes; bloque
  nuevo R52), `order-delivery-sheet.test.tsx` (`DRAFT_KEY` y borradores guardados con `lineId`; bloque
  nuevo R52), `order-cards.test.tsx` (bloque nuevo R44).

Mapa `R<n> -> test`:
- R51 (y R24 en la ficha): `order-sheet-responsibles.test.tsx` > «la ficha pinta una fila por receta del
  pedido, no los campos planos (R51, R24)» > «R51: una fila por receta en el orden del pedido, canceladas
  incluidas», «R51: cada fila lleva el nombre, la cantidad con su unidad, el reparto y el estado de su
  receta», «R51: la receta cancelada sale con su estado», «R51: la cabecera conserva el estado del pedido
  y la prioridad», «R51, R24: ningun dato de los campos planos del pedido sale en la ficha». Pedido de
  tres recetas desordenadas en el arreglo (la ficha sigue `position`), la primera distinta de los
  campos planos («Esmalte azul», 12.5) y la segunda `CANCELADO`.
- R52 (unitario): `order-delivery-draft.test.ts` > «el borrador de entrega va por receta (R52)» >
  «R52: dos recetas del mismo pedido guardan cada una su borrador y se leen cada una con lo suyo»,
  «R52: abrir la segunda receta no borra ni cambia el borrador de la primera», «R52: el borrador de una
  receta no se carga en otra: la otra empieza uno nuevo», «R52: el texto de una receta no vale para otra
  aunque se lea con su clave», «R52: borrar el borrador de una receta deja el de la otra».
- R52 (UI): `order-delivery-sheet.test.tsx` > «el borrador de «Entregar» va por receta (R52)» > «R52: abre
  «Entregar» en dos recetas y, al volver a la primera, trae su borrador; la segunda no lo hereda»
  (desde la fila viva de `OrderTable`, con el selector de receta; con la clave por pedido de antes, la
  segunda receta heredaba el «3» de la primera y el caso falla).
- R44 (enmendado): `order-cards.test.tsx` > «entrada al detalle en la tarjeta de teléfono (R44)» > «R44: el
  pie lleva la prioridad y «Acciones», sin un botón «Ver detalle» aparte», «R44: el único botón «Ver
  detalle» de la tarjeta es el número del pedido», «R44: tocar el número de pedido abre el detalle»,
  «R44: «Ver detalle» dentro de «Acciones» abre el detalle». Código sin cambios.

Grep del «Hecho» (`order\.(recipeName|recipeImageUrl|quantity|unitLabel|presentationLines)` en
`order-responsibles-sheet.tsx`): sin resultados (exit 1).

Verificación (salida real):
- `pnpm run typecheck`: solo `app/layout.tsx(45,56): error TS2304: Cannot find name 'LayoutProps'.` (conocido).
- `pnpm run lint`: `✖ 11 problems (0 errors, 11 warnings)`, todos preexistentes en archivos que no toca T16b.
- `pnpm exec vitest run <10 archivos>`: `Test Files 10 passed (10) · Tests 271 passed | 6 skipped (277)`.

| Archivo | Resultado |
|---|---|
| `order-delivery-draft.test.ts` | 31 passed (25 + 6) |
| `order-delivery-sheet.test.tsx` | 46 passed (45 + 1) |
| `order-sheet-responsibles.test.tsx` | 24 passed (19 + 5) |
| `order-cards.test.tsx` | 28 passed (24 + 4) |
| `order-row-wiring.test.tsx` | 23 passed |
| `order-sheet-coverage.test.tsx` | 5 passed |
| `pedidos-toasts.test.tsx` | 26 passed |
| `pedidos-convenciones.test.ts` | 20 passed, 3 skipped |
| `guard-formularios-y-acciones.test.ts` | 20 passed, 3 skipped |
| `tests/unit/pedidos/order-delivery.test.ts` | 48 passed |

Guardias `guard-pedidos-rediseno`, `guard-pantalla-pedidos-se-amplia`, `guard-catalogo-de-componentes`:
`Test Files 3 passed (3) · Tests 69 passed | 2 skipped (71)`.

Notas para el reviewer:
- La lectura de borradores v1 (de antes de los bloques) se conserva, pero ahora también exige `lineId`:
  un v1 real nunca lo tuvo y vive en la clave por pedido, así que en la práctica ya no se recupera, como
  dice design § 4.7 para cualquier borrador anterior. Los tests de v1 (QC R45) siguen verdes con un v1
  que lleva `lineId`. Retirar esa rama sería limpieza fuera del alcance de T16b; queda a criterio del
  leader.
- La ficha deja de pintar la imagen de la receta: design § 4.7 lista para cada fila nombre, cantidad,
  reparto y estado, sin imagen.

Bloqueos: ninguno nuevo. Los tres de la tanda 3 quedan resueltos por la enmienda F2.1 y este cambio.

Veredicto: T16b hecha; cumple su «Hecho» y deja `order-responsibles-sheet.tsx` sin campos planos para T17.

### T17 (backend_dev)

Decisión P1 (design § 3.4): `OrderView` (y por tanto `OrderSummary`) ya no lleva `recipeId`,
`recipeName`, `recipeVersion`, `recipeImageUrl`, `quantity`, `unitId`, `unitLabel`,
`presentationLines`, `salePrice`, `ingredientsCost`, `packagingCost` ni `actualCost`;
`cancellationReason` del pedido se queda. `toOrderView` deja de rellenarlos.

Archivos de producción:
- `lib/modules/pedidos/domain/order-view.ts`: tipo `OrderView` sin los 12 campos y su doc.
- `lib/modules/pedidos/domain/get-order.ts`: `toOrderView` sin el relleno de la primera línea.
- `scripts/seed-demo/gateway.ts`: `findOrder` busca por `order.lines[0]` (la demo es de una receta).

Tests ajustados:
- Lectura `vista.X` -> `vista.lines[0]?.X`: `tests/unit/pedidos/get-order.test.ts`,
  `list-orders.test.ts`, `order-service.test.ts` (incluido el `toEqual` de la ficha completa),
  `tests/integration/pedidos/order-unit-conversion.int.test.ts`,
  `tests/integration/asignaciones/order-lines-execution.int.test.ts`.
- `actualCost` del pedido (era la suma de activas) -> `actualCostTotal`: `get-order.test.ts`,
  `list-orders.test.ts`, `tests/integration/pedidos/actual-order-cost.int.test.ts`.
- Tests de tipos `tests/unit/pedidos/order-view.test.ts`: las aserciones «en la vista» pasan a
  `OrderLineView` y `OrderView`/`OrderSummary` declaran `false`; test nuevo R24 con los 12 campos.
- Re-propuestos a R24 (antes QT-313 R44, «el pedido conserva los planos»):
  `order-lines-use-cases.int.test.ts` y `order-view-lines.test.ts` comprueban que el dato sale de
  `lines[0]` y que la vista NO tiene la propiedad.
- Fixtures `OrderSummary` sin los 12 campos (solo borrado de líneas): 25 archivos de
  `tests/unit/pedidos-ui/`, `tests/unit/paridad/` y `tests/unit/shared-ui/confirm-dialog-montado.test.tsx`
  y `tests/helpers/order-form-ui.ts`. `order-sheet.test.tsx` conserva CRLF.
- Señuelos de R24 que siguen en tiempo de ejecución, colados con `Object.assign` (el tipo ya no
  los admite en el literal): `pedidoDeDosRecetas` en `tests/helpers/order-form-ui.ts`, el test R24
  de `order-columns.test.tsx` y el R36 de `cancel-order-dialog.test.tsx`. `pedidos-toasts.test.tsx`
  y `order-sheet.test.tsx` leen el reparto/cantidad de la línea.

Grep del «Hecho»:
- `grep -rnE "order\.(recipeName|quantity|presentationLines)\b" "app/(private)/pedidos/"` -> sin
  resultados (exit 1).
- Ningún archivo de `app/` lee los campos de `OrderView`: typecheck verde. Los `order.recipeName`/
  `order.quantity` de `app/(private)/asignacion/**` son de `AssignedOrderSummary` (otro tipo), y los
  de `e2e/` son filas de Prisma, no `OrderView`.

R24 -> test:
- `tests/unit/pedidos/order-view.test.ts` > «QT-314 — la vista del pedido no copia la primera receta»
  > «R24: OrderView y OrderSummary no declaran ninguno de los campos planos de la primera receta».
- `tests/integration/pedidos/order-lines-use-cases.int.test.ts` > «QT-314 R24, QT-313 R1: la receta,
  cantidad, unidad, precio y coste de la ficha salen solo de sus lineas…».
- `tests/unit/pedidos/order-view-lines.test.ts` > «QT-314 R24: un pedido de una linea lleva sus datos
  solo en la linea, sin campos planos en el pedido».

Salida real:
- `pnpm run typecheck`: 1 error, el conocido `app/layout.tsx(45,56) TS2304 LayoutProps`.
- `pnpm run lint`: `0 errors, 11 warnings`, todos en archivos/líneas que T17 no toca.
- `pnpm exec vitest run guard`: `Test Files 87 passed (87) · Tests 1333 passed | 22 skipped`.
- vitest por archivo, los 29 unit tocados: `Test Files 29 passed · Tests 796 passed`
  (tras corregir el `toEqual` de `order-service.test.ts`, 26/26).
- vitest por archivo, `order-view-lines` + 11 unit de pedidos que usan la vista +
  `order-customer.int.test.ts`: `Test Files 13 passed · Tests 372 passed`.
- vitest por archivo, consumidores de `pedidoDeDosRecetas` (`order-form*`, `order-row-actions`):
  `Test Files 7 passed · Tests 100 passed`.
- Integración por archivo (`order-lines-use-cases`, `actual-order-cost`, `order-unit-conversion`,
  `asignaciones/order-lines-execution`): `Test Files 4 passed · Tests 35 passed`.

Bloqueos: ninguno. Nota para T20: `pedidos-convenciones.test.ts` no se ha tocado.

Veredicto: T17 hecha; `OrderView` sin campos planos, typecheck verde y grep del «Hecho» vacío.
