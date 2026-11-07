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

Ninguno.

## Tanda 2 — piezas nuevas sin cablear (frontend_dev) — HECHA

Tres frontend_dev en paralelo (T6+T7; T8+T11; T9+T10+T12), sin commit propio; los commits los hizo el implementer.

| Task | Commit | Archivos |
|---|---|---|
| T6, T7 | 36efea69e | `components/shared/row-actions-menu.tsx` (`groupLabel`), `components/shared/notice.tsx` (`actions`), `components/shared/CATALOGO.md` (filas de `RowActionsMenu` y `Notice`, tableros en «Diseño»), `tests/unit/shared-ui/row-actions-menu-group.test.tsx`, `tests/unit/shared-ui/notice-actions.test.tsx` |
| T8 | 38bb0ea0b | `app/(private)/pedidos/components/order-progress.tsx`, `tests/unit/pedidos-ui/order-progress.test.tsx` |
| T9, T10 | ver `git log` (feat T9+T10) | `order-line-draft.ts`, `order-line-actions.ts`, sus tests |
| T11 | ver `git log` (feat T11) | `order-detail-sheet.tsx`, su test |
| T12 | ver `git log` (feat T12) | `order-line-picker-dialog.tsx`, `cancel-order-line-dialog.tsx`, sus tests, `components/index.ts` (solo reexportaciones) |

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
