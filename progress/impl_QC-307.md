# QC-307 — precio-de-venta-del-pedido · bitácora del implementer

## Tanda 2 — T5 · Casos de uso y adaptadores (backend)

Fecha: 2026-10-28. Delegado en `backend_dev`. T1–T4 y T9 ya estaban en `91078ecb`.

### Qué se hizo

Había un WIP sin commitear de una sesión anterior. Se revisó viñeta a viñeta contra T5 y
`design.md > 3.1, 3.2, 4.1, 4.2`: el código de producción cuadraba y se conservó sin cambios.
Solo faltaban dos fixtures de test.

Producción (WIP conservado):
- `lib/modules/pedidos/domain/create-order.ts` — `salePrice` en `NewOrder`, tras `requirePermission` y el `parse`.
- `lib/modules/pedidos/domain/update-order.ts` — `salePrice` en `OrderEdit`; el atajo compara el precio vía `isCustomerOnlyEdit`.
- `lib/modules/pedidos/domain/order-edit-change.ts` — `ComparableEdit.salePrice` y `sameSalePrice` (`null` solo igual a `null`; si no, `sameDecimal`).
- `lib/modules/pedidos/domain/get-order.ts` — `salePrice: row.salePrice` en la vista.
- `lib/modules/pedidos/adapters/driven/persistence/order-prisma.ts` — `ORDER_SELECT`, `toOrderRow` (`null` no pasa a `'0.0000'`), `insertAliveOrder` y `updateAliveOrder` (sustituye siempre, también con `null`).
- `lib/modules/pedidos/adapters/driving/order-actions.ts` — `salePrice` en `buildCreateCandidate`.

Tests:
- Casos QC-307 nuevos en `tests/unit/pedidos/{create-order,update-order,order-edit-change,get-order,list-orders,set-order-customer,update-order-presentation-lines}.test.ts`.
- `tests/unit/asignaciones/{list-assigned-orders,get-assigned-order-execution}.test.ts` — `salePrice: '99.0000'` colado en los casos `CLAVE_DE_IMPORTE` y `@ts-expect-error` sobre `AssignedOrderSummary` / `AssignedOrderExecutionView`.
- Nuevo `tests/integration/pedidos/order-sale-price.int.test.ts` (11 casos, base real).
- Corregidos por backend_dev (fixtures que el WIP no cubría; ambos en `Archivos esperados > Fixtures`):
  `tests/unit/pedidos/company-scope.test.ts` (`salePrice: null` en la fila Prisma; sin ello `TypeError ... 'toFixed'`) y
  `tests/unit/pedidos/order-service.test.ts` (`salePrice: null` en 3 `toEqual` exactos y en la lista de claves de `NewOrder`).
- `tests/guards/guard-identificador-de-request.test.ts` — añade `20261022120000_orders_sale_price` a `MIGRACIONES_ESPERADAS` (la guardia compara cada carpeta de `db/migrations`; mismo movimiento que QC-305).
- `tests/integration/aislamiento.json` — entrada `commit` para el nuevo `*.int.test.ts` (lo exige `guard-aislamiento-integracion`; `withOrderTransaction` abre su propia transacción).

### Desvíos del spec

- Código de producción: ninguno.
- Fixtures: `order-service.test.ts` cambia 3 aserciones `toEqual` añadiendo `salePrice: null` (T4 decía «no se cambia ninguna aserción»; es forma del contrato, no de comportamiento, y T4 no lo detectó porque el test es de unidad sin tipado estricto del literal).
- Verificación: `vitest related --run` no terminó (3 h; `order-prisma.ts` y `order-actions.ts` llegan vía `lib/composition`, equivale a la suite completa). Se sustituyó por `vitest run` acotado a 36 archivos (tocados + tests de `pedidos` que importan un módulo tocado + no-UI de `Archivos esperados`).
- Tests UI (`pedidos-ui`, `paridad`, `shared-ui`) no corridos en esta tanda: son de T6–T7. Typecheck en verde.

### Salida de los comandos

- `pnpm run typecheck` — `tsc --noEmit`, exit 0. **Verde.**
- `pnpm run lint` — `✖ 10 problems (0 errors, 10 warnings)`, exit 0; los 10 warnings en archivos ajenos o preexistentes (imports sin usar en `order-service.test.ts:16-17` ya estaban). **Verde.**
- `vitest run` acotado (36 archivos): 1.ª pasada `Test Files 2 failed | 26 passed`, `Tests 5 failed | 1074 passed` (los dos fixtures); tras corregir `Test Files 36 passed (36)`, `Tests 1294 passed (1294)`. **Verde.**
- Recomprobación del implementer (11 archivos tocados de unidad): `Test Files 11 passed (11)`, `Tests 469 passed (469)`. **Verde.**
- `pnpm exec vitest run guard` — en solitario: `Test Files 87 passed (87)`, `Tests 1276 passed | 22 skipped (1298)`. **Verde.** (Una primera pasada concurrente dio 4 timeouts en `guard-asignacion-componentizada` y `guard-editor-aislado`, ajenos al diff; en solitario 29 passed.)
- `pnpm exec vitest run tests/integration/pedidos/order-sale-price.int.test.ts` — `Test Files 1 passed (1)`, `Tests 11 passed (11)`. **Verde.** La plantilla de test-db se construye desde `db/migrations`, la de T1 incluida.

### Mapa R → test (Tanda 2)

| R | Archivo | Caso |
|---|---|---|
| R2 | `tests/integration/pedidos/order-sale-price.int.test.ts` | `R2: el alta con '1250.5' se lee como '1250.5000', en la fila devuelta y releida`; `R2, R6: el alta sin precio se lee como null, nunca como 0` |
| R6 | integración | `R6: el alta con '0' se lee como '0.0000', no como ausencia de precio` |
| R6 | `tests/unit/pedidos/create-order.test.ts` | `QC-307 R6: con precio, el puerto recibe la cadena; con 0, "0"; sin precio o en blanco, null` |
| R6 | `tests/unit/pedidos/get-order.test.ts` | `QC-307 R6: un pedido sin precio sale con salePrice null, no "0.0000" ni ausente; un 0 sale como 0` |
| R7 | `create-order.test.ts` | `QC-307 R7: un precio "-1" falla con invalid_input y no escribe` |
| R9 | integración | `R9: un UPDATE crudo a -1 sale con 23514 y el precio guardado no cambia` |
| R10 | `tests/unit/pedidos/update-order.test.ts` | `QC-307 R10: la edicion sustituye el precio guardado, lo pone a 0 y lo quita con el campo vacio o ausente` |
| R10 | integración | `R10: updateAliveOrder sustituye el precio por uno nuevo, luego por 0 y luego lo quita` |
| R11 | `update-order.test.ts` | `it.each<OrderStatus>` de estados no editables en el `describe` QC-307 (`invalid_transition`, sin escribir) |
| R12 | `update-order.test.ts` | `QC-307 R12: cliente y precio cambiados a la vez van por el camino completo y escriben los dos` |
| R12 | `tests/unit/pedidos/order-edit-change.test.ts` | `QC-307 R12: sin precio en la edicion y sin precio guardado es igual`; `…sin precio frente a un precio 0 no es igual, en los dos sentidos`; `…"12.5" es igual al guardado "12.5000"`; `…"12.5" frente a "13" no es igual` |
| R13 | `update-order.test.ts` | `QC-307 R13: solo el cliente cambiado (el precio llega igual, "1250.5" frente a "1250.5000") va por el atajo y updateAlive no se llama` |
| R13 | `tests/unit/pedidos/set-order-customer.test.ts` | `QC-307 R13: con un pedido que tiene precio y una entrada que trae salePrice, el puerto solo recibe el cliente` |
| R13 | `tests/unit/pedidos/update-order-presentation-lines.test.ts` | `QC-307 R13: con un pedido que tiene precio, el puerto recibe unidad y reparto y ningun precio; updateAlive no se llama` |
| R13 | integración | `R13: setCustomerAlive escribe el cliente y deja sale_price intacto`; `…updatePresentationLinesAlive…`; `…cancelAliveOrder…`; `R13: el borrado logico conserva la fila y su sale_price` |
| R15 | `create-order.test.ts` | `QC-307 R15: sin pedidos.modificar falla con unauthorized antes de validar, aunque el precio sea invalido, y sin escribir` |
| R16 | `get-order.test.ts` | `QC-307 R16: con pedidos.consultar la ficha trae salePrice tal como viene de la fila, y el coste aparte`; `QC-307 R16: ${etiqueta} se rechaza sin leer el repositorio ni los catalogos` |
| R16 | `tests/unit/pedidos/list-orders.test.ts` | `QC-307 R16: cada fila lleva salePrice tal como viene de la fila; sin precio, null`; `QC-307 R16: rechaza ${etiqueta} sin leer el repositorio` |
| R17 | `tests/unit/asignaciones/list-assigned-orders.test.ts` | `R24, R17 (QC-307): ninguna clave de importe (… salePrice...) en ninguna fila, aunque el resumen las traiga`; `R24, R17 (QC-307): el contrato del resumen asignado no declara actualCost ni salePrice (comprobacion de tipo)`; `@ts-expect-error` en `_r17TipoSinPrecio` |
| R17 | `tests/unit/asignaciones/get-assigned-order-execution.test.ts` | `R24, R17 (QC-307): ninguna clave de importe (… salePrice...) en toda la vista, aunque el resumen las traiga`; `R24, R17 (QC-307): el contrato de la vista no declara actualCost ni salePrice (comprobacion de tipo)`; `_r17TipoSinPrecio` |
| R17 | integración | `R17: los resumenes de OrderCatalog y su findAliveById no traen ninguna clave de precio, con un pedido que si lo tiene` |
| R18 | integración | `R18: un INSERT crudo que no nombra sale_price deja la columna en NULL, no en 0` |
| R20 | `list-orders.test.ts` | `QC-307 R20: el precio no esta en la lista blanca y pedirlo como orden o filtro se poda y se anota` |
| R23 | `create-order.test.ts` | `QC-307 R23: el coste estimado que se escribe es el mismo con precio que sin el` |

### Dudas abiertas

- `vitest related` no es practicable para adaptadores que cuelgan de `lib/composition`; queda a `./init.sh` (T10) y a `gate-completo` en CI.
- Rama 193 commits detrás de `origin/dev`; no se mergeó (encargo). Nada falló atribuible a ello.
