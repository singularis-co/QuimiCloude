# QT-313 — pedido-con-varias-recetas-backend · design.md

> Escrito por `spec_author` (F1.2, 2026-11-03). Lo marcado **PROPUESTA (Pn)** cubre una pregunta
> abierta de `requirements.md` y no está decidido: lo cierra el humano en F1.4. Si decide otra
> cosa, cambian la sección y los requisitos marcados `[depende de Pn]`, no el resto del diseño.

## Lo que ya existe

**Términos buscados:** «varias recetas», «varias fórmulas», «líneas del pedido», `order_lines`,
`OrderLine`, «multi receta», en `feature_list.json` (todos los estados), en `specs/` y en el código
(`lib/`, `db/schema.prisma`).

**Grafo:** el MCP `codebase-memory-mcp` responde, pero **no hay proyecto indexado para este
worktree** (`list_projects` no lista `.worktrees/QT-313-…`). La exploración se hizo con Grep/Read.

| Dónde | Qué apareció | Qué se hace con ello |
|---|---|---|
| Board | **QT-314** `pedido-con-varias-recetas-frontend` (`pending`, `depends_on: QT-313`) | Es la otra mitad de esta ficha (decisión «¿Una ficha o dos?»). No se solapa: aquí no hay pantalla |
| Board | **QC-308** `margen-del-pedido` | Fuera de alcance. Leerá el precio y el coste de la línea que deja esta ficha |
| Board | **QC-293**, **QC-294** (avisos), `pending` | Sin código todavía. Ver § 9 (P4) |
| Specs | QC-219, QC-284, QC-288, QC-281 usan «línea del pedido» para la **línea del reparto** (`OrderPresentationLine`) o del lote, no para una receta | Nombre ocupado: la línea nueva se llama `OrderLine` / `order_lines`; la del reparto conserva su nombre |
| Código | `OrderPresentationLine` (QC-170): el reparto ya es una tabla hija del pedido | **Se reutiliza**: gana `order_line_id` y pasa a colgar de la línea (§ 1.3) |
| Código | `MaterialReservations` (`inventario/domain/reservation.ts`): `syncForOrder`, `releaseForOrder`, `consumeForOrder`, `settlePackagingForOrder` | **Se reutiliza** cambiando la clave: de pedido a línea (§ 3) |
| Código | `order-transitions.ts`, `order-cancellation.ts`, `delete-order.ts`: las reglas de estado, cancelación y baja | **Se reutilizan tal cual** aplicadas a la línea (§ 2) |
| Código | `resolve-ingredients-cost.ts`, `actual-order-cost.ts`, `resolve-distribution.ts`, `order-requirement.ts` | **Se reutilizan** con la línea como unidad de cálculo |
| Código | Ningún modelo, tabla, tipo ni caso de uso que permita más de una receta por pedido | Nada que reutilizar ni duplicar |

**UI:** la ficha no toca pantalla (alcance). No se consultan filas de `components/shared/CATALOGO.md`
ni hace falta pase `/design`. Lo único del lado de la pantalla que se toca son las Server Actions del
formulario actual y de planta, para mapear su entrada de una receta a una línea (§ 5, § 7), sin
cambio visible.

**Dependencias nuevas:** ninguna. Todo se resuelve con Prisma, zod y SQL escrito a mano.

## 1. Modelo de datos

### 1.1 Tabla nueva `order_lines` (`/// @module pedidos`)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | `uuid` PK, `gen_random_uuid()` | |
| `order_id` | `uuid` NOT NULL | FK compuesta `(order_id, company_id)` → `orders_id_company_id_key`. Con `@relation` (mismo módulo) |
| `company_id` | `uuid` NOT NULL | Copia de la del pedido, igual que `order_presentation_lines` (R2). FK a mano, drift |
| `position` | `int` NOT NULL | Orden de alta dentro del pedido, desde 0 (R6). Único `(order_id, position)`. No se reutiliza al quitar |
| `recipe_id` | `uuid` NOT NULL | La receta **efectiva** (la versión, si se eligió). FK compuesta a mano con `company_id`, drift |
| `quantity` | `decimal(14,4)` NOT NULL | CHECK `> 0` |
| `unit_id` | `uuid` NULL | NULL solo en líneas migradas de pedidos antiguos sin unidad (heredado de `orders.unit_id`) |
| `status` | `"OrderStatus"` NOT NULL default `PENDIENTE` | El mismo enum: no nace tipo nuevo (R31) |
| `cancellation_reason` | `text` NULL | CHECK `order_lines_cancellation_reason_matches_status` (copia del de `orders`) |
| `ingredients_cost`, `packaging_cost` | `decimal(14,4)` NULL | CHECK «nulos a la vez» (copia de `orders_packaging_cost_matches_ingredients_cost`) |
| `actual_cost` | `decimal(14,4)` NULL | CHECK no negativo y solo desde `POR_ACONDICIONAR` (copias de los de `orders`) |
| `sale_price` | `decimal(14,4)` NULL | CHECK `order_lines_sale_price_non_negative` (R15) |
| `finished_at` | `timestamptz` NULL | |
| `packed_by`, `conditioned_by` | `uuid` NULL | FK compuestas a mano con `company_id`; CHECK `…_matches_status` copiados de `orders` |
| `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at` | | Borrado lógico (QC-4) |

Índices y restricciones:
- `order_lines_order_id_recipe_id_alive_key`: **único parcial** `(order_id, recipe_id) WHERE
  deleted_at IS NULL` (R5). Una línea cancelada sigue ocupando su receta — PROPUESTA (P9).
- `order_lines_id_company_id_key` y `order_lines_id_order_id_key` (únicos): destino de las FK
  compuestas de las tablas hijas (§ 1.3).
- `(company_id)`, `(recipe_id)`, `(company_id, status) WHERE deleted_at IS NULL`.
- CHECK `order_lines_delivered_not_deleted`: copia de `orders_delivered_not_deleted`.
- **RLS:** `ENABLE` + `FORCE ROW LEVEL SECURITY`, con la misma policy que `orders`. Es defensa en
  profundidad; la frontera es el service (`docs/architecture.md > Acceso a datos`).
- `guard-empresa-en-esquema` la acepta sin tocar la lista de exentas: lleva `company_id`.

### 1.2 `orders` después de la ficha

**Se queda:** `id`, correlativo, `priority` y `customer_id` (PROPUESTA P1), `company_id`, autores,
fechas, `deleted_at`, `reserved_at` (PROPUESTA P2), `status` (**derivado**, § 2.2, PROPUESTA P3) y
`cancellation_reason` (solo cuando el estado derivado es `CANCELADO`, § 2.3).

**Se va** (a la línea): `recipe_id`, `quantity`, `unit_id`, `ingredients_cost`, `packaging_cost`,
`actual_cost`, `sale_price`, `finished_at`, `packed_by`, `conditioned_by`, con sus CHECK, FK e
índices (`orders_recipe_id_idx`, `orders_unit_id_idx`, `orders_packed_by_idx`,
`orders_conditioned_by_idx`). Los índices parciales de listado de `list_query_indexes` que usen
esas columnas se rehacen sobre `order_lines`.

### 1.3 Tablas que ganan `order_line_id`

| Tabla | Módulo | Cambio |
|---|---|---|
| `order_presentation_lines` | pedidos | `order_line_id` NOT NULL, FK compuesta `(order_line_id, order_id)` → `order_lines_id_order_id_key` (impide colgar el reparto de la línea de otro pedido). El único `(order_id, presentation_id)` pasa a `(order_line_id, presentation_id)`: dos recetas pueden repartirse en la misma presentación. `order_id` se queda: lo usan las entregas |
| `reservation_movements` | inventario | `order_line_id` NOT NULL tras el relleno. FK compuesta `(order_line_id, order_id)` a mano, drift. Índice `(order_line_id)` |
| `inventory_movements` | inventario | `order_line_id` NULL. CHECK: obligatorio en `consumption`, `production` y `delivery`, vacío en los asientos sin pedido. FK compuesta a mano, drift |
| `order_execution_entries` | asignaciones | `order_line_id` NOT NULL. Índice `(order_line_id, occurred_at desc)` |
| `order_step_evidence` | asignaciones | `order_line_id` NOT NULL. Único de slot pasa a `(order_line_id, phase, step_position, slot)`: los pasos son de la receta |
| `order_conditioning_team_members` | asignaciones | `order_line_id` NOT NULL. PK pasa a `(order_line_id, user_id)`, único `(order_line_id, position)` |
| `order_assignments` | asignaciones | **Sin cambios** (decisión «¿Quién es responsable?», R35) |
| `order_deliveries`, `…_lines`, `…_voids` | pedidos | **Sin cambios**: la línea de entrega ya apunta a una línea del reparto, que identifica la receta |

`order_id` se conserva en todas: los listados por pedido y las FK actuales siguen valiendo, y la
FK compuesta `(order_line_id, order_id)` garantiza que los dos apuntan al mismo pedido.

### 1.4 Migraciones (tres, cada una con su `down.sql`)

1. **`20261103120000_order_lines`** — crea `order_lines` con sus restricciones y RLS, y la rellena
   con un `INSERT … SELECT` desde `orders`: una línea por pedido, `position = 0`, copiando las diez
   columnas de § 1.2 y `deleted_at` (R7). `down.sql`: `DROP TABLE order_lines`.
2. **`20261103120100_order_lines_references`** — añade `order_line_id` a las seis tablas de § 1.3,
   lo rellena con la única línea de cada pedido (`UPDATE … FROM order_lines`), y después pone
   `NOT NULL`, las FK, los únicos nuevos y los CHECK (R8). Antes de cerrar, un bloque `DO` compara
   los conteos y aborta si alguna fila con `order_id` quedó sin línea. `down.sql`: quita las
   columnas y restaura los únicos y la PK anteriores.
3. **`20261103120200_orders_drop_line_columns`** — quita de `orders` las columnas de § 1.2.
   `down.sql`: **aborta con `RAISE EXCEPTION`** si algún pedido tiene más de una línea viva,
   nombrando cuántos (R9); si no, vuelve a crear las columnas, las rellena desde la línea y
   restaura CHECK, FK e índices.

Las FK, CHECK e índices parciales escritos a mano son drift para Prisma, como en el resto del
esquema: hay que borrar sus `DROP CONSTRAINT` de cualquier migración generada después
(comentario `///` en el modelo).

## 2. Estado

### 2.1 La línea

`order_lines.status` recorre la tabla de `order-transitions.ts` **sin cambios** (R31). Las reglas
de hoy pasan de leerse en el pedido a leerse en la línea:

| Regla | Archivo | Se aplica a |
|---|---|---|
| Transiciones permitidas, «quedarse igual» | `order-transitions.ts` | la línea |
| Cancelable (`PENDIENTE`, `EN_CURSO`, `BLOQUEADO`) | `order-cancellation.ts` | la línea |
| Editable (lo mismo, vía `assertTransition(s, s)`) | `update-order.ts` | la línea |
| Quitable | nuevo, `order-line-removal.ts` | solo `PENDIENTE` — PROPUESTA (P9) |

### 2.2 El pedido — PROPUESTA (P3)

`orders.status` se queda como **columna derivada** y la escribe `deriveOrderStatus(lines)`, función
pura en `domain/order-status-derivation.ts`, en la misma transacción que cualquier cambio de estado
de línea (R34). Regla propuesta, sobre las líneas vivas:

1. Si todas están `CANCELADO` → `CANCELADO`.
2. Si no, se ignoran las canceladas y el pedido toma el estado **menos avanzado** de las que quedan,
   en el orden de `ORDER_STATUS_FLOW` (`PENDIENTE` < `EN_CURSO` < … < `ENTREGADO`).
3. `BLOQUEADO` cuenta como `PENDIENTE` para el orden, y el pedido es `BLOQUEADO` solo si **todas**
   las no canceladas lo están.

Por qué el menos avanzado: los listados de pedidos y las colas de planta filtran por estado, y un
pedido con una receta todavía en `PENDIENTE` tiene trabajo pendiente. Con una sola línea, el
estado del pedido es el de la línea: R44 y R45 se cumplen por construcción.

Las colas de `asignaciones` (por empacar, por acondicionar, terminados) dejan de leer el estado del
pedido y leen el de la **línea**: devuelven una fila por línea (§ 5).

**Alternativa considerada:** quitar `orders.status` y calcularlo al leer. Se descarta: los
listados con filtro y orden por estado (`list-query-sql.ts`, índices parciales) tendrían que
agregar líneas en cada consulta, y el estado del pedido aparece en una decena de lecturas.

### 2.3 Cancelar

- **Una línea** (R27, R28): caso de uso nuevo `cancelOrderLine(orderId, lineId, { reason }, actor)`.
  Bloquea pedido y línea (`FOR UPDATE`, en ese orden siempre para no cruzar candados), comprueba
  cancelable bajo el candado, escribe estado y motivo, `releaseForLine`, vuelve a derivar el estado
  del pedido.
- **El pedido** (R29): `cancelOrder` mantiene su firma. Cancela con el mismo motivo cada línea
  cancelable, en una transacción, y deja intactas las demás — PROPUESTA (P6). Si ninguna es
  cancelable, `not_cancellable`. `orders.cancellation_reason` se escribe solo si el estado derivado
  queda `CANCELADO`; el CHECK de `orders` sigue siendo el mismo.
- **Por otro módulo** (`createCancelAliveOrder`, usado por `asignaciones`): misma regla que
  `cancelOrder`.

### 2.4 Baja del pedido (R47)

`deleteOrder` se permite solo si **todas** las líneas vivas están en `PENDIENTE`, `EN_CURSO` o
`BLOQUEADO` (la lista `NO_BORRABLES` aplicada a cada línea). Marca `deleted_at` en el pedido y en
sus líneas, y libera el material de cada línea, en una transacción.

## 3. Reserva y consumo por línea (`inventario`)

**Decisión:** la clave del libro de reservas pasa de `order_id` a `order_line_id`; `order_id` se
sigue escribiendo para el ámbito y los listados.

`MaterialReservations` cambia el parámetro de sus cuatro métodos: `orderId` → `{ orderId,
orderLineId }`, y se renombran a `syncForLine`, `releaseForLine`, `consumeForLine`,
`settlePackagingForLine`. El algoritmo **no cambia**: lo disponible para una línea es la existencia
menos lo apartado por **cualquier otra línea**, del mismo pedido o de otro. Así:

- R12: las líneas se sincronizan en orden de `position`; la segunda ve lo que apartó la primera.
- R13, R14: el resultado `insufficient` es por línea. El alta acumula las líneas que no alcanzan;
  sin `confirmBlocked` lanza `OrderWouldBlockError` con sus posiciones (la transacción se deshace);
  con él, esas líneas quedan `BLOQUEADO`, sin apartado y con `ingredients_cost = NULL`.
- R27: cancelar una línea libera exactamente lo suyo.
- R36: finalizar consume exactamente lo apartado para esa línea; con insumos compartidos no toca
  lo de la otra.
- R38: `OrderConsumptionLedger.findConsumedLots` filtra por `orderLineId`: el coste real es el de la
  línea.
- R40: `review-blocked-orders.ts` itera líneas `BLOQUEADO` (pedido por `created_at`, línea por
  `position`) y llama a `syncForLine` para cada una.

`inventario` sigue sin saber qué es una línea: recibe un identificador opaco más, igual que hoy
recibe `orderId`.

## 4. Casos de uso y contratos (`pedidos`)

### 4.1 Entrada

```ts
// order-input.ts
const orderLineInputSchema = z.object({
  id: z.string().uuid().optional(),          // presente = editar esa línea (R20)
  recipeId: recipeIdSchema,
  recipeVersionId: /* igual que hoy */,
  quantity: quantitySchema,
  unitId: unitIdSchema,
  presentationLines: presentationLinesSchema,
  salePrice: salePriceSchema,                 // R15: el de QC-307, ahora por línea
});

export const createOrderSchema = z.object({
  lines: z.array(orderLineInputSchema).min(1), // R3
  priority: prioritySchema.default(DEFAULT_ORDER_PRIORITY),  // PROPUESTA P1
  customerId: /* igual que hoy */,                            // PROPUESTA P1
  confirmBlocked: z.boolean().default(false),
});
export const updateOrderSchema = createOrderSchema;          // reemplazo completo, como hoy
export const cancelOrderLineSchema = cancelOrderSchema;       // mismo motivo 1..500
export const updateOrderDistributionSchema = /* igual */ .extend({ lineId: z.string().uuid() }).strict();
```

En `createOrderSchema` una línea con `id` se rechaza (`invalid_input`). La receta duplicada (R4) se
comprueba en el caso de uso con la receta **efectiva** (versión resuelta), no en el esquema —
PROPUESTA (P10).

### 4.2 Casos de uso

| Caso de uso | Cambio |
|---|---|
| `createOrder` | Valida cada línea (R11, error con `linePosition`), costea cada una, abre **una** transacción: crea pedido, crea líneas, `syncForLine` en orden, deriva estado, `reserved_at` (P2) |
| `updateOrder` | Diff contra las líneas vivas bajo candado: editar (R24, R25), añadir (R21), quitar (R22, R23). Solo las líneas cambiadas recalculan coste y apartado (R17) |
| `cancelOrder` | § 2.3 (R29) |
| `cancelOrderLine` | **Nuevo** (R27, R28) |
| `deleteOrder` | § 2.4 (R47) |
| `updateOrderPresentationLines` | Recibe `lineId`; solo esa línea (R26) |
| `quoteOrderCost` | Cotiza una línea (recibe `recipeId`, cantidad, unidad, reparto y, en edición, `orderLineId` para contar su propio apartado como disponible) |
| `expireStaleOrders` | § 6 (R41) |
| `reviewBlockedOrders` | Por línea (R40) |
| `getOrder`, `listOrders` | Devuelven líneas, totales y resumen (§ 4.3) |
| `deliverOrder`, `voidDelivery` | Cuentan el reparto por línea; mueven `TERMINADO` ↔ `ENTREGADO` de la línea (R39) y derivan el pedido |

### 4.3 Salida

```ts
type OrderLineView = {
  id: string; position: number; recipeId: string; recipeName: string;
  quantity: string; unitId: string | null; status: OrderStatus; cancellationReason: string | null;
  presentationLines: readonly OrderPresentationLineView[];
  salePrice: string | null; ingredientsCost: string | null; packagingCost: string | null;
  actualCost: string | null; finishedAt: Date | null;
};
type OrderView = {
  /* lo de hoy menos los campos que pasan a la línea */
  status: OrderStatus;                      // derivado (P3)
  lines: readonly OrderLineView[];          // R6: por position
  progress: { total: number; finished: number };            // R33, P7
  salePriceTotal: string | null; linesWithoutPrice: number; // R16, P8
  ingredientsCostTotal: string | null; actualCostTotal: string | null; // R18, P8
};
```

Las sumas se hacen con aritmética exacta en `BigInt` sobre las cadenas de 4 decimales, el mismo
patrón que `actual-order-cost.ts` (que no publica una suma reutilizable): función pura nueva
`sumDecimal4` en `domain/order-totals.ts`; nunca `number`. Se calculan al leer y no se guardan.
Como no se guardan, una suma que pase de 10 dígitos enteros se devuelve igual: no hay columna que
la limite.

### 4.4 Errores nuevos (catálogo `lib/modules/errores`)

| `code` | Clase | Cuándo |
|---|---|---|
| `duplicate_order_recipe` | `DuplicateOrderRecipeError` | R4 |
| `order_line_not_removable` | `OrderLineNotRemovableError` | R23 |

`OrderWouldBlockError` y los errores de validación de línea ganan un diagnóstico con la posición
de la línea, que va al registro y a la respuesta como dato, no en el texto. Una línea ajena,
quitada o de otro pedido responde `order_not_found` (R43): no nace `order_line_not_found`, para no
distinguir «no existe» de «no es tuya».

## 5. Contrato con `asignaciones`

`OrderCatalog` gana el identificador de línea en las operaciones del flujo:
`transitionAliveById`, `startPackingAliveById`, `finishPackingAliveById`,
`startConditioningAliveById`, `finishConditioningAliveById` reciben `(orderId, lineId, …)`.

- `AssignedOrderSummary` pasa a ser **una fila por línea**: lleva `lineId`, la receta, cantidad,
  unidad y reparto de la línea, y el número, prioridad, cliente y responsables del pedido. Con un
  pedido de una línea, la fila es la de hoy más `lineId` (R45).
- El registro de ejecución, las evidencias y el equipo de acondicionamiento escriben y leen por
  `order_line_id` (R37). Los adaptadores de `asignaciones` que se tocan: `execution-log-prisma.ts`,
  `step-evidence-prisma.ts`, `conditioning-team-prisma.ts`.
- La asignación de responsables (`order_assignments`) no cambia: el responsable del pedido opera
  cualquier línea (R35). La comprobación «¿es responsable?» sigue mirando el pedido.
- **Pantallas de planta:** esta ficha no las cambia. Sus Server Actions pasan la línea única del
  pedido mientras no exista la pantalla que elige receta — PROPUESTA (P5): ficha frontend nueva.

## 6. Caducidad y bloqueo — PROPUESTA (P2)

`orders.reserved_at` se queda **por pedido**: crear o editar cualquier línea lo reinicia, y el
proceso diario, al vencer, cancela con `EXPIRED_ORDER_REASON` las líneas `PENDIENTE` del pedido y
libera su material (R41). Hoy el proceso solo mira pedidos `PENDIENTE`; pasa a mirar pedidos con
alguna línea `PENDIENTE` y la reserva vencida. Si el humano decide «por receta», `reserved_at` baja
a `order_lines` en la migración 1 y el proceso itera líneas; el resto del diseño no cambia.

## 7. Compatibilidad con la pantalla actual (R44)

QT-313 llega antes que QT-314. Mientras tanto, `order-actions.ts` (driving) traduce el
`FormData` de hoy (una receta) a `{ lines: [una línea], … }`, y para editar adjunta el `id` de la
única línea. La lectura que alimenta el formulario expone, para pedidos de una línea, los mismos
campos planos que hoy (`recipeId`, `quantity`, `unitId`, `presentationLines`, `salePrice`) derivados
de `lines[0]`. Con QT-314 ese puente se borra. El puente vive solo en el adaptador driving: el
dominio ya trabaja con líneas.

Hasta QT-314 ninguna pantalla puede crear un pedido de **varias** líneas, así que en producción no
existirán. Si aun así llega uno al puente (datos escritos por tests o por consola), la edición desde
el formulario actual se rechaza con `invalid_input` sin escribir nada, porque reenviar una sola
receta quitaría las demás. No hay cambio visible: no hace falta pase `/design`.

## 8. Otros lectores de las columnas que se van

| Archivo | Qué lee | Pasa a leer |
|---|---|---|
| `inventario/.../finished-stock-prisma.ts` | `orders.recipe_id` por SQL | `order_lines.recipe_id` vía `order_presentation_lines.order_line_id` |
| `pedidos/.../direct-delivery-prisma.ts`, `packed-lines-directory-prisma.ts`, `customer-order-directory-prisma.ts`, `order-catalog-prisma.ts` | receta y cantidad del pedido | las de la línea |
| `integraciones/domain/get-whatsapp-chat-context.ts` | receta del pedido | lista de recetas del pedido (con una línea, igual que hoy, R45) |
| `asignaciones/domain/count-evidence-locking-orders.ts`, `evidence-target.ts`, `compose-order-rows.ts`, `list-execution-traces.ts` | `recipeId` del resumen | `recipeId` de la línea |
| `inventario/domain/finished-goods-dispatch.ts`, `deliverable-batches-prisma.ts` | receta del pedido | receta de la línea del reparto |

## 9. Avisos QC-293 y QC-294 (P4)

No hay código que cambiar: las dos fichas están `pending`. Este diseño deja los dos hechos
disponibles por línea y por pedido (cambio de estado de línea y estado derivado en la misma
transacción), así que cualquiera de las dos respuestas cabe sin rehacer el modelo.

## 10. Alternativas descartadas

1. **Un pedido que agrupa pedidos** (cada receta un `Order` hijo). Descartada por el humano
   (decisión «¿Qué es un pedido con varias fórmulas?»). Además duplicaría correlativos y
   responsables.
2. **Reserva agregada por pedido** (dejar `reservation_movements` por `order_id` y sincronizar la
   suma de las líneas). Ahorra la columna en `inventario`, pero: no puede liberar lo de **una**
   receta sin recalcular todas; con un insumo compartido, finalizar una receta no sabe qué parte
   del apartado es suya; el bloqueo deja de ser por receta (o alcanza todo o nada), y el coste real
   por receta no se puede atribuir. Contradice R14, R27, R36 y R38.
3. **Dejar la receta principal en `orders` y una tabla de líneas «adicionales».** Ahorra la
   migración de datos, pero deja dos caminos para todo (la primera receta en el pedido, las demás
   fuera) y cada regla habría que escribirla dos veces.
4. **Una sola migración** que crea, rellena y borra columnas. Se descarta por la reversión: el
   `down.sql` de la parte destructiva tiene que poder negarse si ya hay pedidos de varias líneas
   (R9) sin deshacer también el relleno. Tres migraciones dejan revertir por partes.
5. **Quitar `orders.status` y calcularlo al leer.** Ver § 2.2.

## 11. Riesgos

- **Tamaño.** Toca tres módulos (`pedidos`, `inventario`, `asignaciones`) y unos 70 archivos que
  leen `recipeId`. Las tasks lo parten para que cada tanda deje el gate en verde (`tasks.md`).
- **Choque con features en vuelo** en `pedidos`, `inventario` y `asignaciones`: lo detecta
  `scripts/archivos-en-vuelo.mjs` con `## Archivos esperados`; el leader decide en F1.0/F2.
- **Concurrencia.** Orden fijo de candados: pedido, después líneas por `position`. Las operaciones
  de una línea también bloquean el pedido, porque re-derivan su estado.
