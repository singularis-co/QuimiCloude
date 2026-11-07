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
