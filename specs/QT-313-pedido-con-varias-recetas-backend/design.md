# QT-313 — pedido-con-varias-recetas-backend · design.md

> Escrito por `spec_author` (F1.2, 2026-11-03) y revisado en F1.4 (2026-11-03) con las respuestas
> del humano a P1–P13, que ya están en `requirements.md > Decisiones cerradas`. Enmendado en F2.1
> (2026-11-03): `order_line_id` en dos pasos (§ 1.4), `delivery_void` con línea (§ 1.3),
> `PARCIAL` en la pantalla actual (§ 7) y las decisiones provisionales del implementer (§ 12),
> con P14 cerrada; contrato con `orderLineId: null` hasta T14e (§ 3.1). Enmendado otra vez en
> F2.1 (2026-11-04): andamios de transición (§ 4.1.1), `excludeOrderLineId` (§ 4.2) y posición de
> la línea solo en el diagnóstico (§ 4.4); y después, espejo ampliado (§ 4.1.1, punto 3b) y los
> esquemas planos que se quedan para QT-314 (§ 4.1.1, § 7). No queda ninguna pregunta abierta.

## Lo que ya existe

**Términos buscados:** «varias recetas», «varias fórmulas», «líneas del pedido», `order_lines`,
`OrderLine`, «multi receta», en `feature_list.json` (todos los estados), en `specs/` y en el código
(`lib/`, `db/schema.prisma`).

**Grafo:** el MCP `codebase-memory-mcp` responde, pero **no hay proyecto indexado para este
worktree** (`list_projects` no lista `.worktrees/QT-313-…`). La exploración se hizo con Grep/Read.

| Dónde | Qué apareció | Qué se hace con ello |
|---|---|---|
| Board | **QT-314** `pedido-con-varias-recetas-frontend` (`pending`, `depends_on: QT-313`) | Es la otra mitad de esta ficha (decisión «¿Una ficha o dos?»). No se solapa: aquí no hay pantalla |
| Board | **QT-315** `planta-con-varias-recetas` (frontend, depende de QT-313), creada en F1.4 | Las pantallas de planta y el E2E de dos recetas. Esta ficha le deja el contrato por línea (§ 5) |
| Board | **QC-308** `margen-del-pedido` | Fuera de alcance. Leerá el precio y el coste de la línea que deja esta ficha |
| Board | **QC-293**, **QC-294** (avisos), `pending` | Sin código todavía. Decisión P4: sin requisito aquí (§ 9) |
| Specs | QC-219, QC-284, QC-288, QC-281 usan «línea del pedido» para la **línea del reparto** (`OrderPresentationLine`) o del lote, no para una receta | Nombre ocupado: la línea nueva se llama `OrderLine` / `order_lines`; la del reparto conserva su nombre |
| Código | `OrderPresentationLine` (QC-170): el reparto ya es una tabla hija del pedido | **Se reutiliza**: gana `order_line_id` y pasa a colgar de la línea (§ 1.3) |
| Código | `MaterialReservations` (`inventario/domain/reservation.ts`): `syncForOrder`, `releaseForOrder`, `consumeForOrder`, `settlePackagingForOrder` | **Se reutiliza** cambiando la clave: de pedido a línea (§ 3) |
| Código | `order-transitions.ts`, `order-cancellation.ts`, `delete-order.ts`: las reglas de estado, cancelación y baja | **Se reutilizan tal cual** aplicadas a la línea (§ 2) |
| Código | `resolve-ingredients-cost.ts`, `actual-order-cost.ts`, `resolve-distribution.ts`, `order-requirement.ts` | **Se reutilizan** con la línea como unidad de cálculo |
| Código | `order-recipe.ts` (`resolveOrderRecipe`): ya distingue la original (`recipeId`) de la versión elegida (`recipeVersionId`) | **Se reutiliza**: da la receta original de cada línea para la unicidad (§ 1.1) |
| Código | `create-recipe-version.ts` rechaza crear una versión de una versión (`original.original !== null`) | Las versiones tienen **un solo nivel**: la original de una línea es `parent_recipe_id ?? id`, sin recorrer cadenas |
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
| `position` | `int` NOT NULL | Orden de alta dentro del pedido, desde 0 (R6). Único `(order_id, position)` y CHECK `order_lines_position_non_negative` (`>= 0`). No se reutiliza al quitar |
| `recipe_id` | `uuid` NOT NULL | La receta **efectiva** que se fabrica (la versión, si se eligió). **FK simple** a `recipes(id)`, escrita a mano, drift (§ 12) |
| `original_recipe_id` | `uuid` NOT NULL | La receta **original**: `recipe_id` si es original, su `parent_recipe_id` si es versión. La escribe el caso de uso con lo que devuelve `resolveOrderRecipe`; **FK simple** a `recipes(id)`, drift (§ 12). Es la columna de la unicidad (R5) |
| `quantity` | `decimal(14,4)` NOT NULL | CHECK `> 0` |
| `unit_id` | `uuid` NULL | NULL solo en líneas migradas de pedidos antiguos sin unidad (heredado de `orders.unit_id`) |
| `status` | `"OrderStatus"` NOT NULL default `PENDIENTE` | El mismo enum. CHECK `order_lines_status_not_partial`: `status <> 'PARCIAL'` (R48) |
| `cancellation_reason` | `text` NULL | CHECK `order_lines_cancellation_reason_matches_status` (copia del de `orders`) |
| `ingredients_cost`, `packaging_cost` | `decimal(14,4)` NULL | CHECK «nulos a la vez» (copia de `orders_packaging_cost_matches_ingredients_cost`) |
| `actual_cost` | `decimal(14,4)` NULL | CHECK no negativo y solo desde `POR_ACONDICIONAR` (copias de los de `orders`) |
| `sale_price` | `decimal(14,4)` NULL | CHECK `order_lines_sale_price_non_negative` (R15) |
| `reserved_at` | `timestamptz` NULL | Instante desde el que cuentan los 15 días de **esta** línea (R41). Índice parcial `(company_id, reserved_at) WHERE status = 'PENDIENTE' AND deleted_at IS NULL` para el proceso diario |
| `finished_at` | `timestamptz` NULL | CHECK `order_lines_finished_at_requires_delivered` (solo en `TERMINADO`/`ENTREGADO`) y `order_lines_finished_requires_finished_at` (obligatorio en `TERMINADO`): copias de los dos de `orders` (`order_conditioning_states`) (§ 12) |
| `packed_by`, `conditioned_by` | `uuid` NULL | FK compuestas a mano con `company_id`; CHECK `…_matches_status` copiados de `orders` |
| `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at` | | Borrado lógico (QC-4) |

Índices y restricciones:
- `order_lines_order_original_recipe_active_key`: **único parcial** `(order_id,
  original_recipe_id) WHERE deleted_at IS NULL AND status <> 'CANCELADO'` (R5, decisiones P9 y
  P10). Una línea cancelada o quitada libera su receta; la original y sus versiones chocan entre sí.
- `order_lines_id_company_id_key` y `order_lines_id_order_id_key` (únicos): destino de las FK
  compuestas de las tablas hijas (§ 1.3).
- `(company_id)`, `(recipe_id)`, `(company_id, status) WHERE deleted_at IS NULL` y
  `(order_id, status) WHERE deleted_at IS NULL` (el `EXISTS` del filtro de § 2.2.1).
- CHECK `order_lines_delivered_not_deleted`: copia de `orders_delivered_not_deleted`.
- **RLS:** `ENABLE` + `FORCE ROW LEVEL SECURITY`, con la misma policy que `orders`. Es defensa en
  profundidad; la frontera es el service (`docs/architecture.md > Acceso a datos`).
- `guard-empresa-en-esquema` la acepta sin tocar la lista de exentas: lleva `company_id`.

Por qué una columna `original_recipe_id` guardada y no un índice sobre la receta: un índice único
no puede leer `recipes.parent_recipe_id` de otra tabla, y la regla «la original y sus versiones
son la misma» tiene que llegar a la base (R5). La columna no puede desincronizarse: una receta no
cambia de original después de creada.

### 1.2 `orders` después de la ficha

**Se queda:** `id`, correlativo, `priority` y `customer_id` (decisión P1, R42), `company_id`,
autores, fechas, `deleted_at`, `status` (**derivado**, § 2.2) y `cancellation_reason` (solo cuando
el estado derivado es `CANCELADO`, § 2.3).

**Se va** (a la línea): `recipe_id`, `quantity`, `unit_id`, `ingredients_cost`, `packaging_cost`,
`actual_cost`, `sale_price`, `reserved_at` (decisión P2), `finished_at`, `packed_by`,
`conditioned_by`, con sus CHECK, FK e índices (`orders_recipe_id_idx`, `orders_unit_id_idx`,
`orders_packed_by_idx`, `orders_conditioned_by_idx` y el índice de la caducidad). Los índices
parciales de listado de `list_query_indexes` que usen esas columnas se rehacen sobre `order_lines`.

### 1.3 Tablas que ganan `order_line_id`

Estado **final** de cada tabla; cómo se llega en dos pasos está en § 1.4 (decisión «`order_line_id`
en dos pasos»).

| Tabla | Módulo | Cambio |
|---|---|---|
| `order_presentation_lines` | pedidos | `order_line_id` NOT NULL, FK compuesta `(order_line_id, order_id)` → `order_lines_id_order_id_key` (impide colgar el reparto de la línea de otro pedido). El único `(order_id, presentation_id)` pasa a `(order_line_id, presentation_id)`: dos recetas pueden repartirse en la misma presentación. `order_id` se queda: lo usan las entregas |
| `reservation_movements` | inventario | `order_line_id` NOT NULL. FK compuesta `(order_line_id, order_id)` a mano, drift. Índice `(order_line_id)` |
| `inventory_movements` | inventario | `order_line_id` NULL en la columna. CHECK `inventory_movements_order_line_id_matches_kind`: `(kind IN ('consumption', 'production', 'delivery', 'delivery_void')) = (order_line_id IS NOT NULL)`, los mismos cuatro tipos que hoy llevan `order_id`. El `delivery_void` lleva la línea del `delivery` que anula (decisión «`delivery_void` lleva línea», R37): lo escribe `void-delivery.ts` copiándola del asiento anulado. La igualdad no la impone la base (exigiría un disparador, el primero del repositorio); la cubre un test de integración. FK compuesta `(order_line_id, order_id)` a mano, drift |
| `order_execution_entries` | asignaciones | `order_line_id` NOT NULL. Índice `(order_line_id, occurred_at desc)` |
| `order_step_evidence` | asignaciones | `order_line_id` NOT NULL. Único de slot pasa a `(order_line_id, phase, step_position, slot)`: los pasos son de la receta |
| `order_conditioning_team_members` | asignaciones | `order_line_id` NOT NULL. PK pasa a `(order_line_id, user_id)`, único `(order_line_id, position)` |
| `order_assignments` | asignaciones | **Sin cambios** (decisión «¿Quién es responsable?», R35) |
| `order_deliveries`, `…_lines`, `…_voids` | pedidos | **Sin cambios**: la línea de entrega ya apunta a una línea del reparto, que identifica la receta |

`order_id` se conserva en todas: los listados por pedido y las FK actuales siguen valiendo, y la
FK compuesta `(order_line_id, order_id)` garantiza que los dos apuntan al mismo pedido.

### 1.4 Migraciones (cinco, cada una con su `down.sql`)

0. **`20261103115900_order_status_partial`** — `ALTER TYPE "OrderStatus" ADD VALUE 'PARCIAL'
   BEFORE 'PENDIENTE'` (§ 2.2.2), en su propia migración: Postgres no deja usar un valor añadido
   en la misma transacción que lo añade (mismo patrón que `order_status_blocked` +
   `orders_blocked_index`). `down.sql`:
   aborta si alguna fila de `orders` está en `PARCIAL`; si no, recrea el tipo sin el valor, como
   hizo el `down.sql` de `order_status_blocked`.
1. **`20261103120000_order_lines`** — crea `order_lines` con sus restricciones y RLS, y la rellena
   con un `INSERT … SELECT` desde `orders` (con `JOIN recipes` para `original_recipe_id`): una
   línea por pedido, `position = 0`, copiando las once columnas de § 1.2 y `deleted_at` (R7). El
   estado del pedido no se toca: con una línea, su derivado es el mismo. `down.sql`:
   `DROP TABLE order_lines`.
2. **`20261103120100_order_lines_references`** (T2, **paso 1 de 2**) — añade `order_line_id`
   **nullable** a las seis tablas de § 1.3, con un índice simple `(order_line_id)` en cada una, y
   ejecuta el **relleno** (abajo). Solo añade un CHECK, que el código de hoy ya cumple porque nunca
   escribe la columna: en `inventory_movements`, `order_line_id IS NULL OR kind IN ('consumption',
   'production', 'delivery', 'delivery_void')`. No pone `NOT NULL`, FK ni cambia únicos o PK: el
   código anterior a T7/T8/T14a sigue escribiendo esas tablas sin línea y el gate queda verde.
   **No aborta** por filas sin línea. `down.sql`: aborta con `RAISE EXCEPTION` si alguna fila con
   `order_line_id` pertenece a un pedido con más de una línea (perdería a qué receta va), nombrando
   cuántas; si no, quita el CHECK, los índices y las columnas.
3. **`20261103120150_order_lines_references_required`** (T14d, **paso 2 de 2**, después de T14a–c,
   cuando todo el código escribe la línea, y antes de T15 porque su relleno lee las columnas de
   `orders` que T15 borra) — repite el **relleno**; después, un bloque `DO` aborta si queda alguna
   fila sin línea donde debe tenerla (solo posible con datos escritos fuera de la aplicación sobre un
   pedido de varias líneas), nombrando tabla y cuántas. Luego pone `NOT NULL` en cinco tablas,
   sustituye el CHECK de `inventory_movements` por el definitivo de § 1.3, crea las FK compuestas
   `(order_line_id, order_id)` y cambia únicos y PK a los de línea (§ 1.3). `down.sql`: aborta con
   `RAISE EXCEPTION` si volver a los únicos y PK por pedido chocaría (un pedido con dos líneas que
   repiten presentación, persona del equipo o slot de evidencia), nombrando cuántos; si no, deshace
   los únicos, la PK, las FK, el CHECK y los `NOT NULL`, y vuelve al CHECK del paso 1.
4. **`20261103120200_orders_drop_line_columns`** — quita de `orders` las columnas de § 1.2.
   `down.sql`: **aborta con `RAISE EXCEPTION`** si algún pedido tiene más de una línea viva,
   nombrando cuántos (R9); si no, vuelve a crear las columnas, las rellena desde la línea y
   restaura CHECK, FK e índices. Con una línea por pedido ninguno puede estar en `PARCIAL`, así que
   después el `down.sql` de la migración 0 tampoco se niega.

**El relleno** (idéntico en los pasos 1 y 2, idempotente):

1. **Pedidos sin línea.** Entre la migración 1 y T9, el código de hoy sigue creando pedidos sin
   línea. El relleno les crea la suya con el mismo `INSERT … SELECT` de la migración 1, limitado
   a `WHERE NOT EXISTS (SELECT 1 FROM order_lines WHERE order_id = o.id)`. Por eso el paso 2 tiene
   que ir antes de T15: lee las columnas de `orders`.
2. **Filas hijas sin línea.** `UPDATE … SET order_line_id = l.id FROM order_lines l` para cada fila
   con `order_line_id IS NULL` cuyo pedido tiene **exactamente una** línea (contando las quitadas).
   En `inventory_movements` el pedido sale de `order_id`, que llevan los cuatro tipos con línea;
   un `delivery_void` recibe así la misma línea que su `delivery`, porque los dos son del mismo
   pedido de una línea.
3. Una fila sin línea cuyo pedido tiene varias **no se toca**: en el paso 1 se queda `NULL`; en el
   paso 2 la detecta el bloque `DO` y aborta.

Las FK, CHECK e índices parciales escritos a mano son drift para Prisma, como en el resto del
esquema: hay que borrar sus `DROP CONSTRAINT` de cualquier migración generada después
(comentario `///` en el modelo). En `db/schema.prisma`, el paso 1 declara `orderLineId String?` y
el paso 2 lo pasa a `String` en las cinco tablas con `NOT NULL`.

## 2. Estado

### 2.1 La línea

`order_lines.status` recorre la tabla de `order-transitions.ts` **sin cambios** (R31). En el
dominio, `OrderLineStatus = Exclude<OrderStatus, 'PARCIAL'>`: las tablas de transición,
cancelación y baja se tipan con él, así que `PARCIAL` no puede ser ni origen ni destino de una
línea (R48, además del CHECK). Las reglas de hoy pasan de leerse en el pedido a leerse en la línea:

| Regla | Archivo | Se aplica a |
|---|---|---|
| Transiciones permitidas, «quedarse igual» | `order-transitions.ts` | la línea |
| Cancelable (`PENDIENTE`, `EN_CURSO`, `BLOQUEADO`) | `order-cancellation.ts` | la línea |
| Editable (lo mismo, vía `assertTransition(s, s)`) | `update-order.ts` | la línea |
| Quitable | nuevo, `order-line-removal.ts` | `PENDIENTE` y `BLOQUEADO` (decisión P9, R22, R23) |

### 2.2 El pedido: `PARCIAL` (decisión P3)

**Valor nuevo del enum, en una columna derivada.** `orders.status` se queda como columna y gana el
valor `PARCIAL` del mismo enum `OrderStatus` (migración 0). La escribe `deriveOrderStatus(lines)`,
función pura en `domain/order-status-derivation.ts`, en la misma transacción que cualquier alta,
baja o cambio de estado de línea (R34):

1. Sin líneas vivas activas y con alguna cancelada → `CANCELADO`.
2. Todas las activas en el mismo estado → ese estado (incluido `BLOQUEADO`).
3. Activas en estados distintos → `PARCIAL`. Sin excepciones: `TERMINADO` + `ENTREGADO` es
   `PARCIAL`, `PENDIENTE` + `BLOQUEADO` también.

Con una sola línea el estado del pedido es el de la línea, así que R44 y R45 se cumplen por
construcción y la migración no cambia ningún estado. Hasta T15, la misma escritura que deja el
estado derivado deja también `packed_by`, `conditioned_by`, `finished_at` y `actual_cost` de
`orders` coherentes con él (§ 4.1.1, punto 3b), para que los CHECK de `orders` que nombran el
estado se sigan cumpliendo.

**Dónde entra `PARCIAL`:**

| Sitio | Qué cambia |
|---|---|
| `ORDER_STATUS_VALUES` (`order-classification.ts`) | `'PARCIAL'` **el primero**, igual que en el enum (§ 2.2.2; `module-contract.test.ts` compara las dos listas en orden) |
| Filtro por estado del listado (`order-queryable.ts`, `order-prisma.ts`) | Regla de P11 (R49), § 2.2.1 |
| Orden por estado en la base | `PARCIAL` primero por declaración del enum (R52), § 2.2.2 |
| `ORDER_STATUS_FLOW` (orden en pantalla) | `PARCIAL` **el primero**, antes de `PENDIENTE` (decisión P12, R52) |
| Etiqueta y tono (`lib/shared/ui/order-status.ts`) | «Parcial», tono `progress` (decisión P13, R53) |
| Texto al cliente (`integraciones/domain/whatsapp-chat-context.ts`) | «en preparación» (decisión P13, R53) |
| `ORDER_STATUSES_NOT_IN_PROGRESS` | **No** se añade: un `PARCIAL` siempre tiene una línea activa sin entregar, así que está en curso (R50). Lo heredan `order-company-stats-prisma.ts` y el contexto de chat de `integraciones` |
| `STARTED_ORDER_STATUSES`, `isStartedOrderStatus` | Pasan a evaluarse sobre la **línea** (el coste congelado es de cada línea); `PARCIAL` no aparece |
| `order-transitions.ts`, `order-cancellation.ts`, `delete-order.ts` | Tipados con `OrderLineStatus` (§ 2.1); el pedido no se transiciona, se deriva |
| CHECK de `orders` que nombran estados (`cancellation_reason`, `delivered_not_deleted`) | No cambian: `PARCIAL` no está en sus listas, y un pedido `PARCIAL` tiene una línea activa, así que no lleva motivo de cancelación |
| Colas de `asignaciones` | Leen el estado de la **línea**, no el del pedido (§ 5): `PARCIAL` no les llega |

#### 2.2.1 Filtro por estado (decisión P11, R49)

El filtro de estado vive en `orderFilterWhere` (`order-prisma.ts`); `order-queryable.ts` no cambia
de forma (`status` sigue siendo `select` contra `ORDER_STATUS_VALUES`, que ya incluye `PARCIAL`).
Con los valores pedidos `S`:

```ts
// S sin PARCIAL; si S trae PARCIAL, el primer término lo incluye y basta
{ OR: [
    { status: { in: S } },
    { status: 'PARCIAL',
      lines: { some: { deletedAt: null, status: { in: S, not: 'CANCELADO' } } } },
] }
```

- Va en **su propio término** del `AND` de `buildOrderWhere`, después del ámbito y del borrado,
  como cualquier otro filtro: el `OR` acota dentro de la empresa, nunca amplía (la regla del
  comentario de `buildOrderWhere`).
- «Línea activa» excluye las canceladas, así que filtrar por `CANCELADO` no trae un `PARCIAL` con
  una receta cancelada: solo los pedidos `CANCELADO`.
- Varios estados: un solo `OR` con `in: S` en los dos brazos; un pedido no sale dos veces porque
  es una sola consulta sobre `orders` (la relación `lines` va en un `EXISTS`, no en un `JOIN`).
- `total` sale del mismo `where` (no cambia la regla de hoy).
- Necesita la relación `Order.lines` en Prisma, que existe porque `OrderLine` es del mismo módulo.
- Índice: `order_lines (order_id, status) WHERE deleted_at IS NULL` para el `EXISTS` (§ 1.1).

#### 2.2.2 Orden por estado (decisión P12, R52)

Hoy `status` ordena por la **posición de declaración** del enum de Postgres (comentario de
`orderOrderBy` en `order-prisma.ts`). Para que `PARCIAL` vaya el primero sin escribir el orden en
la consulta, la migración 0 lo añade **delante**:

```sql
ALTER TYPE "OrderStatus" ADD VALUE 'PARCIAL' BEFORE 'PENDIENTE';
```

`db/schema.prisma` lo declara el primero en `enum OrderStatus` y `ORDER_STATUS_VALUES` también,
para que `module-contract.test.ts` siga comparando en orden. El comentario de
`ORDER_STATUS_VALUES` que dice que «añadir al final es lo único que Postgres sabe hacer» deja de
ser cierto y se corrige: `ADD VALUE … BEFORE` existe y no recrea el tipo. Prisma no genera el
`BEFORE`: la migración se escribe a mano.

Descartado: ordenar con un `CASE` explícito en la consulta. Obliga a pasar el orden por estado a
SQL crudo (Prisma no ordena por expresión) solo para un valor, y dejaría dos órdenes distintos
para el mismo enum (el de la base y el de la consulta).

El `down.sql` de la migración 0 recrea el tipo sin `PARCIAL` y con los diez valores en su orden
de hoy, igual que el de `order_status_blocked`.

### 2.3 Cancelar

- **Una línea** (R27, R28): caso de uso nuevo `cancelOrderLine(orderId, lineId, { reason }, actor)`.
  Bloquea pedido y línea (`FOR UPDATE`, en ese orden siempre para no cruzar candados), comprueba
  cancelable bajo el candado, escribe estado y motivo, `releaseForLine`, vacía `reserved_at` de la
  línea, vuelve a derivar el estado del pedido.
- **El pedido** (R29, decisión P6): `cancelOrder` mantiene su firma. Cancela con el mismo motivo
  cada línea cancelable, en una transacción, y deja intactas las demás. Si ninguna es cancelable,
  `not_cancellable`. `orders.cancellation_reason` se escribe solo si el estado derivado queda
  `CANCELADO`.
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
  con él, esas líneas quedan `BLOQUEADO`, sin apartado, con `ingredients_cost = NULL` y
  `reserved_at = NULL`.
- R27, R51: cancelar o caducar una línea libera exactamente lo suyo.
- R36: finalizar consume exactamente lo apartado para esa línea; con insumos compartidos no toca
  lo de la otra.
- R38: `OrderConsumptionLedger.findConsumedLots` filtra por `orderLineId`: el coste real es el de la
  línea.
- R40: `review-blocked-orders.ts` itera líneas `BLOQUEADO` (pedido por `created_at`, línea por
  `position`) y llama a `syncForLine` para cada una; la que pasa a `PENDIENTE` estrena su
  `reserved_at`.

`inventario` sigue sin saber qué es una línea: recibe un identificador opaco más, igual que hoy
recibe `orderId`.

### 3.1 Transición: `orderLineId: string | null` hasta T14e (decisión «Pedido sin línea hasta T9»)

Hasta T9 el alta sigue creando pedidos sin línea, y hasta T14e la columna es nullable (§ 1.4). Por
eso, entre T7 y T14e, el contrato de `inventario` acepta **`orderLineId: string | null`** en los
cuatro métodos de `MaterialReservations` y en `OrderConsumptionLedger.findConsumedLots`:

| Valor | Qué filas toca o lee |
|---|---|
| un id | las de esa línea (`order_line_id = id`) |
| `null` | las del pedido **sin línea** (`order_id = orderId AND order_line_id IS NULL`), es decir, las escritas por el código anterior o las de un pedido creado antes de T9 |

Lo disponible sigue siendo la existencia menos lo apartado por cualquier **otra clave**, contando
`(pedido, sin línea)` como una clave más: el algoritmo no cambia.

**Quién pasa el valor.** `pedidos` lo resuelve con un lector nuevo de su puerto de escritura,
`OrderWriteRepository.findOnlyLineId(orderId, scope): Promise<string | null>` (archivos de T8):
devuelve el id de la única línea viva del pedido, o `null` si no tiene ninguna. Con más de una no
se usa: desde T9 quien opera ya conoce la línea. Hasta que cada caso de uso trabaje con líneas
(T9–T14a), los llamantes de hoy pasan lo que devuelve ese lector.

**Cierre.** T14e quita el `null` del tipo (`orderLineId: string`) en `inventario` y en
`findOnlyLineId` desaparece el uso transitorio; con el `NOT NULL` de la base, la rama `null` de
los adaptadores se borra. Las fases no se reordenan.

## 4. Casos de uso y contratos (`pedidos`)

### 4.1 Entrada

```ts
// order-input.ts
const orderLineInputSchema = z.object({
  id: z.string().uuid().optional(),          // presente = editar esa línea (R20)
  recipeId: recipeIdSchema,                  // la original, como hoy
  recipeVersionId: /* igual que hoy */,
  quantity: quantitySchema,
  unitId: unitIdSchema,
  presentationLines: presentationLinesSchema,
  salePrice: salePriceSchema,                 // R15: el de QC-307, ahora por línea
});                                           // sin priority ni customerId: z.object los descarta (R42)

export const createOrderSchema = z.object({
  lines: z.array(orderLineInputSchema).min(1), // R3
  priority: prioritySchema.default(DEFAULT_ORDER_PRIORITY),  // del pedido (P1)
  customerId: /* igual que hoy */,                            // del pedido (P1)
  confirmBlocked: z.boolean().default(false),
});
export const updateOrderSchema = createOrderSchema;          // reemplazo completo, como hoy
export const cancelOrderLineSchema = cancelOrderSchema;       // mismo motivo 1..500
export const updateOrderDistributionSchema = /* igual */ .extend({ lineId: z.string().uuid() }).strict();
```

En `createOrderSchema` una línea con `id` se rechaza (`invalid_input`). La receta duplicada (R4) se
comprueba en el caso de uso comparando la **receta original** de cada línea (`recipeId` de la
entrada, ya validado por `resolveOrderRecipe` como original) contra las demás de la entrada y
contra las líneas activas del pedido: la original y sus versiones son la misma receta (P10), y las
canceladas no cuentan (P9).

Los nombres de arriba son el **estado final**, que deja QT-314 al rehacer el formulario. En
QT-313, ver § 4.1.1.

#### 4.1.1 Transición hasta T15 y QT-314 (decisiones de F2.1, 2026-11-04)

Tres andamios mantienen verde el gate mientras el dominio pasa a líneas y la pantalla sigue siendo
la de una receta. Los andamios 2 y 3 los quitan tasks de QT-313 y no sobreviven a T15; el 1 (los
esquemas) lo quita QT-314.

**1. Esquemas en transición.** Conviven dos juegos en `order-input.ts`:

| Juego | Nombres | Quién lo usa | Hasta |
|---|---|---|---|
| Plano (de hoy) | `createOrderSchema`, `updateOrderSchema`, `updateOrderDistributionSchema` | la pantalla y sus tests; el puente de `order-actions.ts` los parsea | QT-314 |
| De líneas (provisional, existen desde T6) | `createOrderWithLinesSchema`, `updateOrderWithLinesSchema`, `updateOrderLineDistributionSchema` | los casos de uso | QT-314, que los renombra a los nombres de § 4.1 |

El puente de `order-actions.ts` traduce plano → líneas (§ 7) desde T9. **QT-313 no renombra ni
borra ningún esquema** (decisión de F2.1, 2026-11-04): al cerrar esta ficha conviven los dos
juegos, los de líneas con su nombre provisional. Lo hace QT-314, que rehace el formulario. La
pantalla y sus tests no cambian en QT-313.

**2. Estado de la línea en transición.** Mientras una operación todavía escribe el estado del
**pedido** (`setStatus`, `cancelAlive`, `softDeleteAlive`, `finishPackingAlive`, los de
acondicionamiento y la entrega), el adaptador copia el mismo estado —y el motivo de cancelación,
`finished_at`, `packed_by` o `conditioned_by`, si los escribe— a la **única línea viva** del pedido,
en la misma sentencia de la transacción. Así `orders.status` y el estado de la línea no divergen y
los CHECK de `order_lines` se cumplen. Cada task que pasa una operación a escribir por línea (T11
cancelar y baja, T12 entrega y caducidad, T14a ejecución, empaque y acondicionamiento) quita la
copia de esa operación y pasa a derivar el pedido (§ 2.2). Un pedido de varias líneas no puede
existir antes de T9, así que «única línea viva» siempre está definida mientras dura la copia.

**3. Columnas viejas de `orders` en espejo hasta T15.** Los lectores que todavía leen `orders`
(T14b los cambia) necesitan valores correctos. En cada alta o edición, el mismo caso de uso escribe
en `orders` lo de la línea viva de **menor `position`**: `recipe_id`, `quantity`, `unit_id`,
`sale_price`, `ingredients_cost`, `packaging_cost` y `reserved_at`. `updateAlive` deja de
reemplazar el reparto por `order_id`: el reparto se escribe por línea (`order_line_id`). T15 borra
el espejo en el mismo commit que borra las columnas.

**3b. Espejo ampliado desde T14a** (decisión de F2.1, 2026-11-04). Cuando T14a quita la última
copia pedido → línea (punto 2), `orders` deja de recibir `packed_by`, `conditioned_by`,
`finished_at` y `actual_cost` por la vía vieja, pero sus CHECK siguen vivos hasta T15
(`orders_packed_by_matches_status`, `orders_conditioned_by_matches_status`,
`orders_finished_requires_finished_at`, `orders_finished_at_requires_delivered`,
`orders_actual_cost_requires_packed`) y `OrderView.actualCost`, R44 y R45 leen esas columnas.
Por eso `refreshStatus` (re-deriva el estado del pedido, § 2.2) y `mirrorFirstLine` (el espejo del
punto 3) escriben también esas cuatro, en la misma sentencia que el estado derivado:

| Estado derivado del pedido | `packed_by` | `conditioned_by` | `finished_at` | `actual_cost` |
|---|---|---|---|---|
| `PARCIAL`, `CANCELADO`, `PENDIENTE`, `EN_CURSO`, `BLOQUEADO`, `POR_EMPACAR` | NULL | NULL | NULL | NULL |
| `EN_EMPAQUE` | el de la línea activa de menor `position` | NULL | NULL | NULL |
| `POR_ACONDICIONAR` | ídem | NULL | NULL | suma de R18 |
| `EN_ACONDICIONAMIENTO` | ídem | el de la línea activa de menor `position` | NULL | suma de R18 |
| `TERMINADO`, `ENTREGADO` | ídem | ídem | el **mayor** `finished_at` de las líneas activas | suma de R18 |

- Fuera de `PARCIAL`, todas las líneas activas comparten estado; cada línea cumple sus propios
  CHECK (copias de los de `orders`), así que la de menor `position` tiene `packed_by` y
  `conditioned_by` cuando el estado los exige, y todas tienen `finished_at` en `TERMINADO`. El
  pedido termina cuando termina su última línea: de ahí el mayor `finished_at`.
- `actual_cost` es la suma de R18 (líneas activas; NULL si a alguna le falta, o si la suma no cabe
  en `decimal(14,4)`). Con una línea es el de la línea, así que R44 y R45 no cambian.
- `PARCIAL` deja las cuatro en NULL: ningún CHECK de `orders` lista `PARCIAL`, así que NULL los
  cumple todos.
- Las líneas canceladas no cuentan (como en todo § 2.2).
- T15 borra este espejo junto con las columnas y sus cinco CHECK.

### 4.2 Casos de uso

| Caso de uso | Cambio |
|---|---|
| `createOrder` | Valida cada línea (R11, error con `linePosition`), costea cada una, abre **una** transacción: crea pedido, crea líneas, `syncForLine` en orden, `reserved_at` de cada línea que apartó, deriva estado |
| `updateOrder` | Diff contra las líneas vivas bajo candado: editar (R24, R25), añadir (R21), quitar `PENDIENTE`/`BLOQUEADO` (R22, R23). Solo las líneas cambiadas recalculan coste, apartado y `reserved_at` (R17, R41) |
| `cancelOrder` | § 2.3 (R29) |
| `cancelOrderLine` | **Nuevo** (R27, R28) |
| `deleteOrder` | § 2.4 (R47) |
| `updateOrderPresentationLines` | Recibe `lineId`; solo esa línea (R26) |
| `quoteOrderCost` | Cotiza una línea (recibe `recipeId`, cantidad, unidad, reparto y, en edición, `orderLineId` para contar su propio apartado como disponible). En `inventario`, `findCostingBatches` de `ProductCatalog` y de `PackagingCatalog` gana `excludeOrderLineId?: string` y deja de restar lo apartado por esa línea, igual que hoy hace con el pedido (decisión «`excludeOrderLineId` en inventario») |
| `expireStaleOrders` | Por línea (§ 6, R51) |
| `reviewBlockedOrders` | Por línea (R40) |
| `getOrder`, `listOrders` | Devuelven líneas, totales y resumen (§ 4.3); filtro y orden con `PARCIAL` (R49, R52, § 2.2.1, § 2.2.2) |
| `deliverOrder`, `voidDelivery` | Cuentan el reparto por línea; mueven `TERMINADO` ↔ `ENTREGADO` de la línea (R39) y derivan el pedido |

### 4.3 Salida

```ts
type OrderLineView = {
  id: string; position: number; recipeId: string; recipeName: string;
  quantity: string; unitId: string | null; status: OrderLineStatus; cancellationReason: string | null;
  presentationLines: readonly OrderPresentationLineView[];
  salePrice: string | null; ingredientsCost: string | null; packagingCost: string | null;
  actualCost: string | null; finishedAt: Date | null; reservedAt: Date | null;
};
type OrderView = {
  /* lo de hoy menos los campos que pasan a la línea */
  status: OrderStatus;                      // derivado, puede ser PARCIAL (R34)
  lines: readonly OrderLineView[];          // R6: por position
  progress: { total: number; finished: number };            // R33: activas; TERMINADO o ENTREGADO
  salePriceTotal: string | null; linesWithoutPrice: number; // R16: sin canceladas
  ingredientsCostTotal: string | null; actualCostTotal: string | null; // R18: sin canceladas
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

`OrderWouldBlockError` y los errores de validación de línea ganan la posición de la línea (o las
posiciones, en `order_would_block`) **solo en su diagnóstico**, que va al registro del servidor y
nunca al navegador, como el diagnóstico de `InvalidTransitionError`. La respuesta conserva el
código y los campos de hoy: no se amplía la lista cerrada de campos de
`errores/domain/error-state.ts` (decisión «Posición de la línea solo en el diagnóstico», R11, R13).
Señalar la línea en pantalla, si hace falta, es de QT-314. Una línea ajena,
quitada o de otro pedido responde `order_not_found` (R43): no nace `order_line_not_found`, para no
distinguir «no existe» de «no es tuya». La violación del único parcial de § 1.1 (carrera entre
dos ediciones) se traduce a `duplicate_order_recipe` en el adaptador.

## 5. Contrato con `asignaciones`

`OrderCatalog` gana el identificador de línea en las operaciones del flujo:
`transitionAliveById`, `startPackingAliveById`, `finishPackingAliveById`,
`startConditioningAliveById`, `finishConditioningAliveById` reciben `(orderId, lineId, …)`.

- `AssignedOrderSummary` pasa a ser **una fila por línea**: lleva `lineId`, la receta, cantidad,
  unidad, estado y reparto de la línea, y el número, prioridad, cliente y responsables del pedido.
  Las colas filtran por el estado de la **línea**. Con un pedido de una línea, la fila es la de hoy
  más `lineId` (R45).
- El registro de ejecución, las evidencias y el equipo de acondicionamiento escriben y leen por
  `order_line_id` (R37). Los adaptadores de `asignaciones` que se tocan: `execution-log-prisma.ts`,
  `step-evidence-prisma.ts`, `conditioning-team-prisma.ts`.
- La asignación de responsables (`order_assignments`) no cambia: el responsable del pedido opera
  cualquier línea (R35). La comprobación «¿es responsable?» sigue mirando el pedido.
- **Pantallas de planta:** esta ficha no las cambia; son de **QT-315** (decisión P5). Hasta
  entonces, sus Server Actions pasan la línea única del pedido. Este contrato por línea es lo que
  QT-315 consume.

## 6. Caducidad por línea (decisión P2)

`reserved_at` vive en `order_lines` (§ 1.1) y la regla de hoy se aplica a cada línea por su lado
(R41, R51):

- **Se fija** al apartar el material de la línea: al crearla o al editarla con éxito, y cuando la
  revisión de bloqueados la pasa a `PENDIENTE`.
- **Se vacía** al cancelarla, quitarla, consumir su material (finalizar) o dejarla `BLOQUEADO`.
- **No se toca** al crear, editar o cancelar **otra** línea del mismo pedido, ni al cambiar la
  prioridad o el cliente del pedido.
- **El proceso diario** (`expire-stale-orders.ts`, mismo cron y mismo `ORDER_RESERVATION_TTL_DAYS`)
  busca, empresa por empresa, **líneas** `PENDIENTE` vivas con `reserved_at` vencido. Por cada una
  bloquea pedido y línea, vuelve a comprobar estado y plazo bajo el candado, la cancela con
  `EXPIRED_ORDER_REASON`, libera su material y re-deriva el estado del pedido. Una línea que falla
  no impide las demás, igual que hoy con los pedidos (`ExpiredOrderFailure` pasa a llevar
  `lineId`).

## 7. Compatibilidad con la pantalla actual (R44)

QT-313 llega antes que QT-314. Mientras tanto, `order-actions.ts` (driving) traduce el
`FormData` de hoy (una receta) a `{ lines: [una línea], … }`, y para editar adjunta el `id` de la
única línea. La lectura que alimenta el formulario expone, para pedidos de una línea, los mismos
campos planos que hoy (`recipeId`, `quantity`, `unitId`, `presentationLines`, `salePrice`) derivados
de `lines[0]`. El puente vive solo en el adaptador driving: el dominio ya trabaja con líneas.

Por fases (§ 4.1.1): desde T9 el puente parsea el formulario con los esquemas planos y llama a los
casos de uso con los de líneas (`createOrderWithLinesSchema`, `updateOrderWithLinesSchema`,
`updateOrderLineDistributionSchema`). Así se queda al cerrar QT-313: los esquemas planos no se
borran ni los de líneas se renombran aquí. QT-314 rehace el formulario, renombra los esquemas a
los nombres de § 4.1, borra los planos y quita el puente.

Hasta QT-314 ninguna pantalla puede crear un pedido de **varias** líneas, así que en producción no
existirán. Si aun así llega uno al puente (datos escritos por tests o por consola), la edición desde
el formulario actual se rechaza con `invalid_input` sin escribir nada, porque reenviar una sola
receta quitaría las demás. No hay cambio visible: no hace falta pase `/design`.

**`PARCIAL` en la pantalla actual** (decisión de F2.1, R54). Los mapas exhaustivos por estado de
`app/(private)/pedidos/components/` necesitan un valor para `PARCIAL`, y se trata como un estado
final. Revisado en el código que dejó backend_dev, y coincide con la decisión:

| Mapa | Archivo | `PARCIAL` | Efecto |
|---|---|---|---|
| `ORDER_STATUS_IS_FINAL` | `order-row-actions.tsx` | `true` | Editar, cancelar y eliminar deshabilitados; «Responsables» sigue abierto, como en cualquier estado final (QC-102) |
| `ORDER_STATUS_ACCEPTS_DISTRIBUTION_EDIT` | `order-row-actions.tsx` | `false` | Sin editar el reparto |
| `ORDER_STATUS_ACCEPTS_DELIVERY` | `order-row-actions.tsx` | `false` | Sin entregar |
| `ORDER_STATUS_HAS_DELIVERIES` | `order-row-actions.tsx` | `false` | Sin la lista de entregas |
| `ORDER_STATUS_ACCEPTS_CUSTOMER_CHANGE` | `order-row-actions.tsx` | `true` | Cambio de cliente disponible, igual que el servicio (§ 12) |
| `STATUS_ACCEPTS_VOID` | `order-delivery-list.tsx` | `false` | Sin anular entregas |

Son literales de un mapa existente, no componentes ni cambios visibles en ningún pedido real (un
`PARCIAL` no puede existir antes de QT-314): no hace falta pase `/design`. QT-314 y QT-315 los
sustituyen al dar a cada receta sus acciones.

## 8. Otros lectores de las columnas que se van

| Archivo | Qué lee | Pasa a leer |
|---|---|---|
| `inventario/.../finished-stock-prisma.ts` | `orders.recipe_id` por SQL | `order_lines.recipe_id` vía `order_presentation_lines.order_line_id` |
| `pedidos/.../direct-delivery-prisma.ts`, `packed-lines-directory-prisma.ts`, `customer-order-directory-prisma.ts`, `order-catalog-prisma.ts` | receta y cantidad del pedido | las de la línea |
| `pedidos/.../order-company-stats-prisma.ts` | estado del pedido | sin cambio de código; `PARCIAL` cuenta en curso (R50) |
| `integraciones/domain/get-whatsapp-chat-context.ts`, `whatsapp-chat-context.ts` | receta y estado del pedido | lista de recetas del pedido; `PARCIAL` como estado en curso (R45, R50) |
| `asignaciones/domain/count-evidence-locking-orders.ts`, `evidence-target.ts`, `compose-order-rows.ts`, `list-execution-traces.ts`, `list-company-orders.ts` | `recipeId` y estado del resumen | los de la línea |
| `inventario/domain/finished-goods-dispatch.ts`, `deliverable-batches-prisma.ts` | receta del pedido | receta de la línea del reparto |

## 9. Avisos QC-293 y QC-294 (decisión P4)

Sin requisito en esta ficha. Las dos fichas siguen `pending` y decidirán si avisan por receta o por
pedido cuando se acoten. El diseño deja los dos hechos disponibles (cambio de estado de línea y
estado derivado del pedido, en la misma transacción), así que cualquiera de las dos respuestas
cabe sin rehacer el modelo.

## 10. Alternativas descartadas

1. **Un pedido que agrupa pedidos** (cada receta un `Order` hijo). Descartada por el humano
   (decisión «¿Qué es un pedido con varias fórmulas?»). Además duplicaría correlativos y
   responsables.
2. **Reserva agregada por pedido** (dejar `reservation_movements` por `order_id` y sincronizar la
   suma de las líneas). Ahorra la columna en `inventario`, pero: no puede liberar lo de **una**
   receta sin recalcular todas; con un insumo compartido, finalizar una receta no sabe qué parte
   del apartado es suya; el bloqueo deja de ser por receta (o alcanza todo o nada); el coste real
   por receta no se puede atribuir, y la caducidad por receta (P2) no tendría qué liberar.
   Contradice R14, R27, R36, R38 y R51.
3. **Dejar la receta principal en `orders` y una tabla de líneas «adicionales».** Ahorra la
   migración de datos, pero deja dos caminos para todo (la primera receta en el pedido, las demás
   fuera) y cada regla habría que escribirla dos veces.
4. **Una sola migración** que crea, rellena y borra columnas. Se descarta por la reversión: el
   `down.sql` de la parte destructiva tiene que poder negarse si ya hay pedidos de varias líneas
   (R9) sin deshacer también el relleno. Migraciones separadas dejan revertir por partes.
5. **`PARCIAL` en un enum propio del pedido** (`OrderOverallStatus`, con los valores de hoy más
   `PARCIAL`) y `OrderStatus` solo para la línea. Ahorra el CHECK de R48, pero obliga a cambiar el
   tipo de `orders.status` (recrear la columna con conversión), duplica diez valores en dos enums
   que tendrían que moverse juntos y rompe la comparación única de `module-contract.test.ts`. Un
   valor más en el enum compartido y un CHECK en la línea cuestan menos.
6. **Calcular el estado del pedido al leer, sin columna.** Los listados con filtro y orden por
   estado (`list-query-sql.ts`, índices parciales) tendrían que agregar líneas en cada consulta, y
   el estado del pedido aparece en una decena de lecturas.
7. **Unicidad por `recipe_id` efectiva** (la propuesta de F1.2). Descartada por la decisión P10:
   dejaría convivir la original y una versión suya.

## 11. Riesgos

- **Tamaño.** Toca tres módulos (`pedidos`, `inventario`, `asignaciones`) y unos 70 archivos que
  leen `recipeId`. Las tasks lo parten para que cada tanda deje el gate en verde (`tasks.md`).
- **Choque con features en vuelo** en `pedidos`, `inventario` y `asignaciones`: lo detecta
  `scripts/archivos-en-vuelo.mjs` con `## Archivos esperados`; el leader decide en F1.0/F2.
- **Concurrencia.** Orden fijo de candados: pedido, después líneas por `position`. Las operaciones
  de una línea también bloquean el pedido, porque re-derivan su estado. El proceso diario sigue el
  mismo orden.
- **Valor de enum nuevo.** Todo `Record<OrderStatus, …>` exhaustivo deja de compilar hasta decidir
  `PARCIAL`; es lo buscado. Los mapas de línea pasan a `OrderLineStatus` (`order-transitions.ts`,
  `order-cancellation.ts`, `asignaciones/domain/order-state.ts`,
  `count-evidence-locking-orders.ts`). Los dos mapas del **pedido** reciben el valor de la decisión
  P13 (R53): «Parcial» con tono `progress` en `lib/shared/ui/order-status.ts`, y «en preparación»
  en `integraciones/domain/whatsapp-chat-context.ts`.
- **Valor del enum al principio.** `ADD VALUE … BEFORE` cambia la posición relativa de todos los
  valores para `ORDER BY status`: cualquier test que fije el orden por estado de hoy tiene que
  contar con `PARCIAL` delante. Los demás valores no cambian de orden entre sí.
- **Filas sin línea entre los dos pasos (§ 3.1).** Mientras `order_line_id` es nullable y el
  contrato acepta `orderLineId: null`, un pedido sin línea (creado antes de T9) opera con la clave
  `(pedido, sin línea)`, y uno con línea, con la de su línea. **Riesgo:** un pedido con línea que
  aún tenga filas sin ella (escritas por código anterior a T7 después del relleno de T2) partiría
  su apartado en dos claves. En la rama no hay datos persistentes que lo produzcan (las bases de
  test nacen vacías en cada ejecución), y en una base con datos el relleno de T14e los une antes
  del `NOT NULL`. Un test de T7 fija que `null` no lee ni toca filas con línea, y uno de T14e que
  el relleno las une.
- **Contrato con `null` olvidado.** Si T14e no quitara el `null` del tipo, quedaría una rama muerta
  que nadie prueba. El «Hecho» de T14e exige que el tipo sea `string` y que no quede ninguna rama
  `IS NULL` en los adaptadores de reserva y consumo.

## 12. Decisiones provisionales del implementer (F2.1)

Revisadas contra el spec el 2026-11-03. Cuatro se aceptan; la quinta la sustituye la decisión P14.

| Decisión | Dónde | Veredicto |
|---|---|---|
| FK **simple** de `order_lines.recipe_id` y `original_recipe_id` a `recipes(id)` | migración `20261103120000_order_lines` | **Aceptada.** `recipes` no tiene clave `(id, company_id)` (`db/schema.prisma`, modelo `Recipe`), y `orders.recipe_id` ya tenía FK simple. Que la receta sea de la empresa lo garantiza el caso de uso, que la lee con el catálogo de `recetas` acotado a la empresa del actor (R11, R43). Dar a `recipes` esa clave sería tocar otro módulo sin requisito que lo pida |
| CHECK `order_lines_position_non_negative` (`position >= 0`) | misma migración | **Aceptada.** Concreta «desde 0» de R6 |
| CHECK `order_lines_finished_requires_finished_at` | misma migración | **Aceptada.** Es copia de `orders_finished_requires_finished_at` (`order_conditioning_states`), uno de los CHECK de `orders` que § 1.1 manda copiar a la línea. La migración 1 no puede romperlo: copia filas que ya lo cumplían |
| `CUSTOMER_EDITABLE_STATUSES` incluye `PARCIAL` | `pedidos/domain/set-order-customer.ts` | **Aceptada.** El cliente es del pedido (P1, R42) y se puede cambiar en todo estado salvo los finales. Un `PARCIAL` nunca es final: tiene al menos una línea activa sin entregar (R50) |
| `assertOrderAcceptsWrites` deja escribir en **cualquier** `PARCIAL` | `asignaciones/domain/order-state.ts` | **No aceptada; sustituida por la decisión P14 (R55).** Un `PARCIAL` admite asignar, desasignar y quitar grupo solo si al menos una línea activa está en `PENDIENTE`, `EN_CURSO` o `BLOQUEADO`; si no, `OrderProducedFrozenError`, como un pedido fabricado. Para decidirlo, `OrderAssignmentTarget` (lo que devuelve `OrderCatalog.findAliveById`) gana los estados de sus líneas activas, y `assertOrderAcceptsWrites` aplica a un `PARCIAL` el mapa `ERROR_POR_ESTADO` línea a línea: admite si alguna da `null`. Solo afecta a esas tres escrituras: abrir, finalizar y registrar pasos comprueban la **línea** (T14a) |
