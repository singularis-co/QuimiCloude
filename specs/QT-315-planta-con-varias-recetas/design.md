# QT-315 — planta-con-varias-recetas · design.md

> **Fuente visual.** El pase `/design` lo aprobó el humano el 2026-11-09. Es la página «6 ·
> Operario» del canvas del proyecto, copiada a:
> - `docs/diseno/canvas/PlantaVariasRecetas.dc.html`: escritorio, interactivo, con cuatro
>   pantallas.
>   - Asignación por receta.
>   - Pantalla de una receta, con «Otras recetas del pedido» y «Cancelar esta receta».
>   - Recorridos.
>   - Recorrido del pedido por secciones.
> - `docs/diseno/canvas/PlantaVariasRecetasTablet.dc.html`: tablet.
> - `docs/diseno/canvas/PlantaVariasRecetasMovil.dc.html`: teléfono y la ficha por plataforma
>   (Reutiliza / Nuevo / Librerías / Escritorio / Estados / Tablet / Teléfono / Animación).
>
> Todo componente nuevo o con cambio visual de esta ficha cita esos tableros
> (`docs/perfil-agentes.md > Pase de diseño para componentes nuevos`).
>
> Sin modelo de datos, sin migraciones, sin permisos y sin dependencias nuevas, por decisión
> (R32). No hay excepción de multiplataforma: todo lo nuevo cumple
> `docs/architecture.md > Componentes > Regla: multiplataforma`.

## Lo que ya existe

**Buscado.**
- **En el board** (`feature_list.json`): «varias recetas», «receta», «planta», «recorrido» y
  «asignacion».
- **En `specs/`:** `onlyLineOf`, `lineId`, «Receta N de M», `order-progress` y `cancelOrderLine`.
- **En el código:** el MCP del grafo no tiene proyecto indexado para este worktree. Lo busqué
  con Grep/Read.

| Qué apareció | Dónde | Qué hacemos |
|---|---|---|
| QT-313, el backend de varias recetas (`done`) | `specs/QT-313-…`, `lib/modules/pedidos` | Lo consumimos. El esquema ya es por línea: `order_execution_entries`, `order_step_evidence` (único `order_line_id, phase, step_position, slot`), `order_conditioning_team_members` (PK `order_line_id, user_id`) e `inventory_movements.order_line_id`. Por eso **no hace falta migración** |
| QT-314, el frontend de pedidos (`in_progress`, PR #319, rama base) | `specs/QT-314-…`, `app/(private)/pedidos/components/order-progress.tsx`, `order-columns.tsx` (`OrderRecipesCell`) | Reutilizamos `OrderProgress` y la regla «+N más». Al usarlas una segunda ruta, **suben a `components/shared`** (§ 7) |
| QC-291, el rediseño del operario (en vuelo, mismo dueño) | `feature_list.json` | Fuera de alcance. Por decisión, QT-315 va primero (§ 9) |
| `cancelOrderLine` y `cancelLockedLine` | `lib/modules/pedidos/domain/cancel-order-line.ts`, `order-cancellation.ts` | Los reutilizamos. `cancelLockedLine` es la regla de QT-313 R27 y R28; la envuelve un método nuevo de `OrderCancellation` sin permiso, como `cancelAliveById` (§ 3.1) |
| `orderProgress` | `lib/modules/pedidos/domain/order-totals.ts` | Lo reutilizamos para el avance del Dashboard y del Recorrido |
| `transitionAliveById`, `startPackingAliveById`, `finishPackingAliveById`, `startConditioningAliveById` y `finishConditioningAliveById` | `OrderCatalog` | No cambian: ya reciben `lineId` |
| `NewExecutionEntry.orderLineId`, `NewStepEvidence.orderLineId` y `NewConditioningTeamMember.orderLineId` | `lib/modules/asignaciones/ports/*` | Las escrituras ya son por línea. Cambian las **lecturas** (§ 3.3) |
| `onlyLineOf` y `findOnlyLine` | `lib/modules/asignaciones/domain/only-order-line.ts` | **Se borran** (§ 3.4) |

**Mapa del leader, confirmado** (Grep/Read sobre el worktree):

- **Usos de `onlyLineOf` / `findOnlyLine`.** Aparecen en los 16 sitios citados: `start-assigned-order` (71 y 108), `finish-assigned-order`, `start-packing`, `finish-packing`, `start-conditioning`, `finish-conditioning`, `record-conditioning-step`, `save-conditioning-batch-data`, `cancel-assigned-order`, `evidence-target` (55, 68 y 81), `record-step-move`, `get-assigned-order-execution`, `get-packing-order` y `get-conditioning-order`.
- **`getRowId`, `compose-order-rows.ts:97` y `list-assigned-orders.ts:88-103`.** Confirmados.
- **Una precisión.** `order-prisma.ts:1416` (`lines[0]`) **no es un resto**: lee una sola fila con `WHERE id = lineId` y no hay que tocarla. El que sí aplana es `order-catalog-prisma.ts:340` (`toOrderDeliveryProgress`, `take: 1`).

**Hallazgos que el mapa no tenía.** Son lecturas por pedido que mezclarían las recetas y entran por R13:

- **`ExecutionLogRepository.findLastStepPosition`.** Lee por `orderId`. Al retomar una receta, la posición podría salir de la otra.
- **`listEntriesForOrders`.** Se filtra por pedido. De ahí sale el avance de los pasos de acondicionamiento en `get-conditioning-order:64`, `finish-conditioning:59` y `record-conditioning-step:100`.
- **`StepEvidenceRepository`.** `listByOrder`, `findById`, `delete` y el cálculo del `slot` libre en `insert` y `replace` leen por `orderId`. El tope de fotos por paso se compartiría entre recetas.
- **`ConditioningTeamRepository.listByOrderInCompany`.** El equipo es por línea en la base, pero se lee por pedido.
- **`FinishedBatchLabels.listOfOrder` y `writeForOrder`** (inventario). Leen y escriben los datos de lote de todos los asientos `production` del pedido.
- **E2E que usan las rutas de planta y faltan en la lista del leader.** Son `consulta-de-evidencia`, `reserva-de-material`, `recetas-porcentaje`, `producto-terminado`, `envases-del-pedido`, `pedidos-terminados`, `coste-real-de-produccion`, `pedido-en-varias-presentaciones`, `pasos-de-envasado` y `pedido-con-varias-recetas` (QT-314). Usan `assignedOrderRoute`, `packingOrderRoute` o `conditioningOrderRoute`, y entran en T13.

**Catálogo consultado** (`components/shared/CATALOGO.md`), con la pieza que reutilizamos:

| Fila | Uso en esta ficha |
|---|---|
| `DataTable` | Las seis listas y el Dashboard, sin cambios. `getRowId` pasa a `lineId` en las listas de Asignación |
| `StatusBadge` + `STATUS_TONES` | Estado de la receta en filas, cabecera, «Otras recetas» y secciones; «Parcial» con tono `progress` |
| `PriorityMark` | Prioridad del pedido en las filas, como hoy |
| `ResponsibleAvatars` | Responsables del pedido en las filas, como hoy |
| `ConfirmDialog` | «Cancelar esta receta». Es el diálogo de hoy, `order-cancel-dialog.tsx`, con otros textos |
| `Notice` | Avisos de vuelta a la lista (`order-outcome-notice.tsx`), como hoy |
| `Button`, `ArrowLink` | «Entrar» e «Ir a esta receta» |
| `touchTarget` | «Entrar» e «Ir a esta receta» de 44 × 44 px en el teléfono (R30) |
| `EMPTY_MARK` | Receta sin nombre resoluble |

**Componentes nuevos o con cambio, con su paso de la regla de decisión**
(`docs/perfil-agentes.md > Regla de decisión para componentes`):

| Pieza | Dónde | Paso | Por qué |
|---|---|---|---|
| `OrderProgress` | de `app/(private)/pedidos/components/` a `components/shared/order-progress.tsx` | 1 · reutilizar, y **sube** | La necesita una segunda ruta, el Dashboard (R21). Sube sin cambiar su API y gana su fila en el catálogo en el mismo commit (celda `Diseño`: `PedidosVariasRecetas.dc.html` y `PlantaVariasRecetas.dc.html`). Su tipo de entrada pasa a `{ finished: number; total: number }` estructural, sin importar `OrderSummary`, porque `components/shared` no depende de un módulo |
| `RecipesFirstMore` («primera receta +N más») | de `OrderRecipesCell` (`order-columns.tsx`) a `components/shared/recipes-first-more.tsx` | 1 · reutilizar, y **sube** | La necesita una segunda ruta, el Dashboard (R21). Recibe `first: ReactNode` y `moreCount: number`. Pedidos la usa en `OrderRecipesCell` sin cambio visible, y gana su fila |
| `RecipeOfOrderLabel` («Receta N de M») | `app/(private)/asignacion/components/recipe-of-order-label.tsx` | 4 · crear | No hay pieza que pinte una posición dentro de un total. Es texto `cap`, tablero de escritorio, celda «Receta». Lo usan las seis listas y la cabecera, todas bajo `/asignacion` |
| `RecipeHeader` (cabecera de la receta y «Otras recetas del pedido») | `app/(private)/asignacion/components/recipe-header.tsx` | 3 · componer | `StatusBadge` + `RecipeOfOrderLabel` + `Button`. Es el bloque `card` del tablero, «Pantalla de una receta». Lo usan las tres pantallas de receta, que cuelgan de `/asignacion` |
| `OrderCancelDialog` | `app/(private)/asignacion/[id]/components/order-cancel-dialog.tsx` | cambio | Pasa a «Cancelar esta receta», con los textos del tablero y un campo oculto `lineId` |
| `OrderOutcomeNotice` | `app/(private)/asignacion/components/order-outcome-notice.tsx` | cambio | `delivered` pasa a `manufactured` y el texto nombra la receta (R19, R20) |
| `ExecutionTraceRecipeSection` | `app/(private)/dashboard/recorrido/[id]/components/execution-trace-recipe-section.tsx` | 3 · componer | `StatusBadge` + `ExecutionTimeline` + las piezas de fotos de hoy (`trace-step-evidence`, `trace-packing-evidence` y `trace-other-steps-evidence`). Tablero «Recorrido del pedido» |
| Columnas de las seis listas, `assigned-order-enter-trigger`, `execution-trace-columns`, `execution-trace-detail` | sus rutas | cambio | Pasan a trabajar por receta. Los cambios visibles están en los tableros |

## 1. Decisiones generales

- **La receta viaja de punta a punta.** Cada acción y cada lectura de una receta recibe
  `{ orderId, lineId }`, valida los dos con zod (uuid) y opera sobre esa línea. Desaparece
  cualquier búsqueda de «la única receta en el estado X».
- **El estado que manda es el de la línea.** Las pantallas y los casos de uso dejan de mirar
  `OrderAssignmentTarget.status`, el del pedido, que puede ser `PARCIAL`. Miran
  `AssignedOrderSummary.status` de la línea nombrada (R10).
- **Autorización.** No cambia. Va primero `requirePermission` y después la asignación del
  pedido (`listOrderIdsByUserInCompany`), donde aplica hoy. Después se comprueba la línea. Una
  línea de otro pedido, de otra empresa o quitada da `OrderNotFoundError`, igual que un pedido
  inexistente (R14, QT-313 R43).
- **Sin modelo de datos ni migraciones** (decisión «¿Una ficha o dos?», R32). Los cambios de
  esta ficha son contratos entre módulos, puertos y adaptadores. RLS no cambia: no hay tablas
  nuevas.

## 2. Rutas

**Decisión.** La receta va en la consulta de la dirección: `?receta=<lineId>`.

| Ruta | Hoy | Después |
|---|---|---|
| Ejecución | `/asignacion/<orderId>` | `/asignacion/<orderId>?receta=<lineId>` |
| Empaque | `/asignacion/empaque/<orderId>` | `/asignacion/empaque/<orderId>?receta=<lineId>` |
| Acondicionamiento | `/asignacion/acondicionamiento/<orderId>` | `/asignacion/acondicionamiento/<orderId>?receta=<lineId>` |
| Recorrido | `/dashboard/recorrido/<orderId>` | sin cambio: es del pedido, con secciones |

**`lib/shared/routes.ts`:**
- `assignedOrderRoute(orderId, lineId)`, `packingOrderRoute(orderId, lineId)` y
  `conditioningOrderRoute(orderId, lineId)`: el segundo argumento es **obligatorio**, así que
  `typecheck` encuentra todos los usos.
- Constante nueva `RECIPE_PARAM = 'receta'`.
- `DELIVERED_ORDER_PARAM` (`'entregado'`) pasa a `MANUFACTURED_ORDER_PARAM = 'fabricado'` (R19).
  `DELIVERED_ORDER_PACKAGES_PARAM` y `DELIVERED_ORDER_PRODUCT_PARAM` **se borran**: Finalizar ya
  no da de alta lotes y nadie las escribe.
- Constante nueva `OUTCOME_RECIPE_PARAM = 'receta_aviso'`. Lleva el nombre de la receta al aviso
  (R20). Solo se escribe con más de una receta viva.
- Se corrige el comentario de `PACKED_ORDER_PARAM`, que dice «queda `ENTREGADO`».

**Páginas.** Cada `page.tsx` lee `searchParams[RECIPE_PARAM]`. Si falta, si está repetido o no es
un uuid, responde `notFound()` antes de llamar al caso de uso (R9). En los demás casos pasa
`{ orderId, lineId }`. `asignacion/empaque/[id]/page.tsx:63` captura hoy solo
`OrderNotFoundError`; pasa a capturar también `ValidationError`, como acondicionamiento.

## 3. Backend

### 3.1 `pedidos`: contrato con `asignaciones` (backend_dev)

Tres cambios, los tres aditivos. Ningún consumidor actual cambia de comportamiento.

1. **`OrderCatalog.findAliveLineSummary(companyId, orderId, lineId): Promise<AssignedOrderSummary | null>`**.
   - Devuelve la fila de **esa** línea viva de ese pedido vivo, en cualquier estado, canceladas
     incluidas.
   - `null` si el pedido o la línea no existen, son de otra empresa, la línea es de otro pedido
     o está quitada.
   - Mismo mapeo que `listAliveSummariesByIds` (`toAssignedOrderSummary`).
   - Sustituye a cada `listAliveSummariesByIds(companyId, [orderId], [status], 1, 1)` +
     `onlyLineOf`.
2. **`OrderCatalog.listRecipeOutlinesByIdsIncludingDeleted(companyId, orderIds): Promise<readonly OrderRecipesOutline[]>`**.
   Es una sola consulta por página.

   ```ts
   type OrderRecipeOutline = {
     readonly lineId: string;
     readonly position: number;          // 1..count, orden de alta
     readonly recipeId: string;
     readonly status: OrderLineStatus;
     readonly quantity: string;          // decimal en cadena
     readonly unitId: string | null;
     readonly presentationLines: readonly { readonly presentationId: string; readonly packages: number }[];
   };
   type OrderRecipesOutline = {
     readonly id: string;
     readonly deleted: boolean;
     readonly recipes: readonly OrderRecipeOutline[]; // canceladas incluidas (decisión P1)
     readonly progress: OrderProgress;                // orderProgress(recipes): sin canceladas
   };
   ```

   - **Pedido vivo:** sus líneas vivas.
   - **Pedido dado de baja:** las líneas con `deleted_at` igual al `deleted_at` del pedido (R24).
     `softDeleteAlive` las sella con el mismo instante (`delete-order.ts:74-95`).
   - **Quién lo usa:**
     - «Receta N de M» de las listas y de la cabecera (R3, R7);
     - «Otras recetas» (R8);
     - el Dashboard (R21 a R24);
     - el Recorrido (R25).
   - Se exporta también el tipo `OrderProgress`.
   - No se toca `listDeliveryProgressByIdsIncludingDeleted`: la siguen usando el listado de
     Pedidos y `integraciones` (alternativa B, § 8).
3. **`OrderCancellation.cancelLineAliveById(orderId, lineId, companyId, reason, actorId, now)`**.
   - Devuelve `'ok' | 'not_found' | 'not_cancellable'`.
   - Hace dentro de la transacción recibida lo mismo que `cancel-order-line.ts`:
     1. `lockAliveLine`;
     2. `isCancellableStatus`;
     3. `cancelLockedLine` con `releaseReason: 'release'`;
     4. `refreshStatus`.
   - Sin permiso ni validación del motivo, que es de quien llama, como `cancelAliveById`.
   - Se extrae una función interna `cancelLineInsideTransaction`, que comparten `cancelOrderLine`
     y este método. La regla queda en un solo sitio.
   - `composition` la ata en `executionTransaction.orders`, con `joinOrderUnitOfWork(tx)`.

### 3.2 `inventario` (backend_dev)

`FinishedBatchLabels.listOfOrder(companyId, orderId, orderLineId)` y
`writeForOrder({ …, orderLineId })` filtran los asientos `production` también por
`order_line_id`. El parámetro es obligatorio; los únicos consumidores están en `asignaciones`
(R13).

### 3.3 `asignaciones`: puertos y adaptadores driven (backend_dev)

| Puerto | Antes | Después |
|---|---|---|
| `ExecutionLogRepository` | `findLastStepPosition(companyId, orderId)` | `findLastStepPosition(companyId, orderId, orderLineId)` |
| `ExecutionEntryRecord` | sin línea | gana `orderLineId` (se lee de la columna, ya `NOT NULL`) |
| `StepEvidenceRepository` | `listByOrder(companyId, orderId, phase)`, `findById(…, id)`, `delete(…, id)` | `listByLine(companyId, orderId, orderLineId, phase)`, `findById(companyId, orderId, orderLineId, phase, id)`, `delete(companyId, orderId, orderLineId, phase, id)`. `insert` y `replace` buscan el `slot` libre por `order_line_id`. `StepEvidenceRow` gana `orderLineId`. `listOrderIdsWithEvidence` y `countByOrders` no cambian |
| `ConditioningTeamRepository` | `listByOrderInCompany(companyId, orderId)` | `listByLineInCompany(companyId, orderId, orderLineId)`. Las filas de `listByOrdersInCompany` ganan `orderLineId` |
| `ExecutionWriters.orders` | `transitionAliveById` + `OrderCancellation` | además, `cancelLineAliveById` (§ 3.1) |
| `ExecutionWriters.batches` | `writeForOrder` | `writeForOrder` con `orderLineId` (§ 3.2) |

### 3.4 `asignaciones`: casos de uso (backend_dev)

**`only-order-line.ts` se borra.** En su lugar va `domain/order-line-target.ts`:

```ts
/** La linea nombrada de un pedido vivo de la empresa; `OrderNotFoundError` si no lo es. */
export async function findLine(
  orders: Pick<OrderCatalog, 'findAliveLineSummary'>,
  companyId: string,
  orderId: string,
  lineId: string,
): Promise<AssignedOrderSummary>
```

Esquema común de entrada: `orderLineInputSchema = z.strictObject({ orderId: uuid, lineId: uuid })`,
que cada caso de uso extiende con sus campos.

| Caso de uso | Entrada nueva | Qué cambia |
|---|---|---|
| `openAssignedOrder`, `getAssignedOrderExecution`, `startAssignedOrder` | `{ orderId, lineId }` | La puerta `PENDIENTE` / `EN_CURSO` / `BLOQUEADO` mira el estado de la línea. Retomar usa `findLastStepPosition(…, lineId)`. La carrera de `start` se relee con `findLine` |
| `recordStepMove` | `{ orderId, lineId, direction, stepPosition }` | `findLine` en lugar de `findOnlyLine` y fotos por línea |
| `finishAssignedOrder` | `{ orderId, lineId, stepPosition }` | Además devuelve `recipeName` y `recipeCount` para el aviso (R20) |
| `cancelAssignedOrder` | `{ orderId, lineId, stepPosition, reason }` | Llama a `cancelLineAliveById`, no a `cancelAliveById` (R16, R17). Anota `cancel` con `orderLineId: lineId`. Devuelve `numberText`, `recipeName` y `recipeCount` |
| `startPacking`, `getPackingOrder` | `{ orderId, lineId }` | `findLine` y estado de la línea |
| `finishPacking` | `{ orderId, lineId, counts: [{ presentationLineId, packedPackages, reason, reasonOther }] }` | Hoy `lines[].lineId` es la línea **de presentación**. Se renombra a `counts[].presentationLineId` para no confundirla con la receta. El caso de uso la traduce a `PackedLineCount.lineId` de `pedidos`, que no cambia |
| `startConditioning`, `getConditioningOrder`, `finishConditioning`, `recordConditioningStep`, `saveConditioningBatchData` | `{ orderId, lineId, … }` | `findLine`. Equipo, entradas y fotos se leen por línea, y los datos de lote, con `orderLineId` |
| `requestEvidenceUpload`, `registerEvidence`, `removeEvidence` (`evidence-target.ts`) | `{ orderId, lineId, phase, … }` | `resolveEvidenceTarget(deps, actor, orderId, lineId, phase)`, con el estado y la persona de la línea |
| `getExecutionEvidence` | `{ orderId }` | Devuelve las fotos **agrupadas por línea** (§ 3.6) |

**Vistas de detalle.** `AssignedOrderExecutionView`, `PackingOrderDetail` y
`ConditioningOrderDetail` ganan esto:

```ts
readonly lineId: string;
readonly recipe: { readonly position: number; readonly count: number };
readonly otherRecipes: readonly {
  readonly lineId: string;
  readonly recipeName: string | null;
  readonly status: OrderLineStatus;
}[];
```

Salen de `listRecipeOutlinesByIdsIncludingDeleted(companyId, [orderId])` y de
`recipes.findRefsIncludingDeleted`. `recipe.position` y `recipe.count` cuentan las canceladas
(decisión P1, R3, R7).

**«Ir a esta receta» (decisión P2, R8).** Lo decide la pantalla con el estado de la otra receta
y los permisos de la sesión. El caso de uso no lo decide: es navegación, no autorización. La
pantalla de destino vuelve a autorizar con sus reglas de hoy.

| Estado de la otra receta | Destino | Permiso que exige |
|---|---|---|
| `PENDIENTE`, `EN_CURSO` | `assignedOrderRoute(orderId, lineId)` | el de la ejecución (R15) |
| `POR_EMPACAR`, `EN_EMPAQUE` | `packingOrderRoute(orderId, lineId)` | `empaque.modificar` |
| `POR_ACONDICIONAR`, `EN_ACONDICIONAMIENTO` | `conditioningOrderRoute(orderId, lineId)` | `acondicionamiento.modificar` |
| cualquier otro (`CANCELADO`, terminada, `BLOQUEADO`, `ENTREGADO`) | sin enlace | — |

Sin el permiso de la fila, la receta sale con su nombre y su estado, sin enlace. La función
pura que elige el destino vive junto a `RecipeHeader` y recibe el estado y los permisos.

**Vistas de lista.** `AssignedOrderView`, `CompanyOrderView`, `FinishedOrderView`,
`PackingOrderRow` y `ConditioningOrderRow` ganan `lineId` y
`recipe: { position, count }`.
- `composeOrderRows` lee los outlines de la página en **una** llamada más.
- `id` sigue siendo el pedido: lo usan las acciones de responsables (R5).

### 3.5 Dashboard: `listExecutionTraces` (backend_dev)

- **Agrupación.** Las anotaciones de cada pedido se agrupan por `orderLineId`.
- **Recorrido por receta.** `buildExecutionTrace` se llama **por receta**, con
  `{ status: <estado de la línea>, deleted }` (R27). `buildExecutionTrace` no cambia de firma: ya
  recibe un `TraceOrderState`.
- **Fila del pedido.** Se forma así:
  - **`totalDuration`:** la suma de los `totalDuration` de sus recetas, con la misma regla de
    `sumDurations` (abierta gana a sin cerrar, y sin cerrar gana a cerrada; R23).
  - **`goBackCount`:** la suma.
  - **`firstAt` y `lastAt`:** el mínimo y el máximo.
  - **`active` y `people`:** como hoy, sobre el pedido.
- **`ExecutionTraceRow` cambia:**
  - **`formulaName` y `formulaImageUrl`:** los de la **primera** receta en orden de alta.
  - **`moreRecipes: number`** (nuevo): recetas del outline menos 1, con la regla de QT-314.
  - **`progress: OrderProgress`** (nuevo).
  - **`presentations`** pasa a `recipes: readonly { recipeName: string | null; presentations:
    ExecutionTracePresentation[] }[]`, en orden de alta (R22).
- **Catálogo.** `listDeliveryProgressByIdsIncludingDeleted` deja de usarse aquí y lo sustituye
  `listRecipeOutlinesByIdsIncludingDeleted`.

### 3.6 Recorrido: `getExecutionTrace` y `getExecutionEvidence` (backend_dev)

`ExecutionTraceDetail` queda así:

```ts
{
  orderId, numberText, status, deleted, active,
  progress: OrderProgress,
  totalDuration: TraceDuration,
  firstAt, lastAt,
  recipes: readonly ExecutionTraceRecipe[],   // orden de alta; solo las que tienen anotaciones (P3)
}
type ExecutionTraceRecipe = {
  lineId, recipeName: string | null, status: OrderLineStatus,
  quantity: string, unitLabel: string | null,
  presentations: readonly ExecutionTracePresentation[],
  steps: readonly ExecutionTraceDetailStep[],
  durations: TraceDurations, totalDuration: TraceDuration, goBackCount: number,
}
```

- **Qué recetas tienen sección (decisión P3, R25).** Solo las que tienen al menos una
  anotación. `progress` sale del outline y cuenta todas las vivas, también las que no tienen
  sección.
- **Lo que sale de nivel pedido.** `steps`, `durations` y `goBackCount` salen del nivel pedido.
- **Responsables por paso.** El mapa de responsables vigentes de
  `conditioning_responsibles_change` se reconstruye **por receta**.
- **Equipo.** El equipo de `conditioning_start` es el de esa línea.
- **Fotos.** `getExecutionEvidence` devuelve
  `{ recipes: readonly { lineId: string; evidence: OrderEvidence }[] }`. `readOrderEvidence` gana
  una variante por línea, y la de `getOrderEvidence` (Inventario) no cambia: su separación por
  receta es de **QT-316** (decisión P4, R34).

### 3.7 Adaptadores driving (backend_dev)

| Acción | Firma nueva |
|---|---|
| `openAssignedOrderAction`, `startAssignedOrderAction` | `(orderId, lineId)` |
| `finishAssignedOrderAction`, `cancelAssignedOrderAction` | El `FormData` lleva `lineId`. Redirigen con `MANUFACTURED_ORDER_PARAM` o `CANCELLED_ORDER_PARAM` y, con más de una receta, `OUTCOME_RECIPE_PARAM` |
| `recordStepMoveAction` | `{ orderId, lineId, direction, stepPosition }` |
| `startPackingAction`, `finishPackingAction` | El `FormData` lleva `lineId`. `finishPacking` lee `counts`. `revalidatePath(packingOrderRoute(orderId, lineId))` |
| `startConditioningAction`, `finishConditioningAction`, `saveConditioningBatchDataAction`, `recordConditioningStepAction` | La entrada lleva `lineId` |
| `requestEvidenceUploadAction`, `registerEvidenceAction`, `removeEvidenceAction` | La entrada lleva `lineId` |
| `getExecutionTraceAction`, `getExecutionEvidenceAction` | Sin cambio de firma. Cambia el tipo de vuelta (§ 3.6) |

**Restos que se corrigen** (fila «Restos de nombres viejos»):
- el comentario de `finishPackingAction`, que dice «Deja el pedido `ENTREGADO`», pasa a decir
  que deja la receta en `POR_ACONDICIONAR`;
- `DELIVERED_ORDER_PARAM` pasa a `MANUFACTURED_ORDER_PARAM` (§ 2);
- el comentario de `finishAssignedOrderAction` pasa a hablar de la receta.

## 4. UI (frontend_dev)

### 4.1 Listas de Asignación (R1–R5, R30)

- **Filas.** Las seis tablas pasan a `getRowId={(row) => row.lineId}`:
  - `assigned-orders-table:111`;
  - `company-orders-table:129`;
  - `packing-orders-table:73`;
  - `conditioning-orders-table:73`;
  - `conditioned-orders-table:77`;
  - `finished-orders-table:73`.
- **Celda «Receta».** Pinta el nombre y, si `recipe.count > 1`, `RecipeOfOrderLabel`.
- **«Entrar».** `AssignedOrderEnterTrigger`, y los enlaces de las columnas de empaque y
  acondicionamiento, usan `…Route(row.id, row.lineId)`. El `aria-label` sigue el tablero:
  «Entrar a <receta> del pedido <número>».
- **Teléfono.** `DataTable` con `card` ya pasa a tarjetas. La tarjeta lleva
  `RecipeOfOrderLabel` y el «Entrar» con `touchTarget`.
- **`assignment-row-actions`.** No cambia de lógica: actúa sobre `row.id`, el pedido (R5).

### 4.2 Pantallas de una receta (R6–R10, R18)

- **Cabecera.** `RecipeHeader` va arriba en ejecución, empaque y acondicionamiento:
  - la fase, «Pedido <número>» y «Receta N de M»;
  - el `h1` con la receta;
  - cantidad · reparto;
  - el `StatusBadge`;
  - la caja «Otras recetas del pedido» con `StatusBadge` e «Ir a esta receta» según la tabla de
    § 3.4 (decisión P2).
- **Cuerpo.** El de cada pantalla es el de hoy y recibe la vista de **esa** receta.
- **Ejecución.** `OrderCancelDialog` pasa a «Cancelar esta receta». El título, el texto, el
  motivo y los botones son los del tablero. El `FormData` lleva `orderId`, `lineId`, `reason` y
  `stepPosition`.
- **`page.tsx`.** La de ejecución deja de mirar `target.status` del pedido.

### 4.3 Avisos (R19, R20)

`OrderOutcomeNotice` cambia el `kind` `delivered` por `manufactured`. Los textos son funciones,
como hoy:

| Aviso | Una receta (como hoy) | Con `recipeName` |
|---|---|---|
| Fabricada | «Pedido <n> por empacar» | «<receta> del pedido <n>, por empacar» |
| Cancelada | «Pedido <n> cancelado» | «<receta> del pedido <n> cancelada. Su material quedó libre.» (tablero) |
| Empacada | «Pedido <n> empacado» | «<receta> del pedido <n>, empacada» |
| Acondicionada | «Pedido <n> acondicionado» | «<receta> del pedido <n>, acondicionada» |

`asignacion/page.tsx` lee `OUTCOME_RECIPE_PARAM`. La variante con envases y producto se borra.

### 4.4 Dashboard (R21–R23)

`execution-trace-columns`:
- **«Fórmula».** `RecipesFirstMore`.
- **«Avance».** Columna nueva, con `OrderProgress` corto.
- **«Presentaciones».** Agrupadas por receta en orden de alta, unidas con « · », sin sumar.
- **«Estado».** «Parcial» con tono `progress`.
- **Teléfono.** La tarjeta lleva la barra, como el tablero.

### 4.5 Recorrido (R25–R28)

`execution-trace-detail` pinta:
- el resumen: Estado, `OrderProgress` largo («F de T terminadas») y Duración;
- un `ExecutionTraceRecipeSection` por receta, con el nombre (`h2`), `StatusBadge`, «cantidad ·
  reparto · duración · vueltas atrás», su `ExecutionTimeline` y sus fotos.

`trace-evidence-placement` coloca las fotos de **esa** línea. En el teléfono las secciones se
apilan (R30).

## 5. Contratos que cambian entre módulos

| Contrato | Módulo | Cambio | Consumidores |
|---|---|---|---|
| `OrderCatalog.findAliveLineSummary` | pedidos | nuevo | asignaciones |
| `OrderCatalog.listRecipeOutlinesByIdsIncludingDeleted`, `OrderRecipesOutline`, `OrderProgress` | pedidos | nuevo | asignaciones |
| `OrderCancellation.cancelLineAliveById` | pedidos | nuevo | asignaciones (`ExecutionWriters`) |
| `FinishedBatchLabels.listOfOrder` y `writeForOrder` | inventario | `orderLineId` obligatorio | asignaciones |

Ningún contrato pierde un método: `listAliveSummariesByIds`, `cancelAliveById` y
`listDeliveryProgressByIdsIncludingDeleted` se quedan para sus otros consumidores.

## 6. Verificación

- **Unit (`tests/unit/asignaciones/`).** Un caso por `R<n>` con dobles de dos recetas en el
  mismo estado:
  - la acción opera solo sobre la nombrada (R11, R12);
  - las lecturas no mezclan (R13);
  - una línea ajena o quitada da `order_not_found` (R14);
  - sin `lineId` da `invalid_input` (R14);
  - los permisos se mantienen (R15).
- **Integración (`tests/integration/asignaciones/`, base real).**
  - Un pedido de dos recetas: cancelar una desde la ejecución libera solo su material y deja la
    otra igual (R16, R17).
  - El tope de fotos por paso es por receta (R13).
  - El equipo y los datos de lote, por receta (R13).
  - `findAliveLineSummary` y los outlines, incluido el pedido dado de baja (R24).
  - Rechazo cruzado por empresa (`docs/architecture.md > Dominio` n.º 1).
- **UI (`tests/unit/asignaciones-ui/`, `tests/ui/dashboard/`).**
  - «Receta N de M» y su ausencia con una receta (R3, R29);
  - las filas por `lineId` (R2);
  - la cabecera y «Otras recetas» (R7, R8);
  - los avisos (R19, R20);
  - la página 404 sin receta (R9);
  - las columnas del Dashboard (R21–R23);
  - las secciones del Recorrido (R25–R28), incluida la receta sin anotaciones que no tiene
    sección y cuenta en el avance.
- **Inventario sin cambios (R34).** Los tests que ya cubren `getOrderEvidence` siguen verdes
  sin tocarlos, y el diff no toca `batch-evidence-dialog.tsx`.
- **E2E.** El nuevo es `e2e/planta-con-varias-recetas.spec.ts` (R33). Los E2E de planta de
  hoy se adaptan (T13).
- **Guardias y `R32`.** `pnpm exec vitest run guard`. El reviewer comprueba que el diff no toca
  `db/` ni las dependencias de `package.json`.

## 7. Componentes que suben a `components/shared`

`OrderProgress` y `RecipesFirstMore` suben en T11, cada uno con su fila en el catálogo en el
mismo commit. Consumidores identificados:
- `app/(private)/pedidos/components/order-columns.tsx`, `order-detail-sheet.tsx` (QT-314);
- `app/(private)/dashboard/components/execution-trace-columns.tsx`;
- `app/(private)/dashboard/recorrido/[id]/components/execution-trace-detail.tsx`.

El barril de pedidos deja de exportar `OrderProgress`. Sus importadores pasan a
`@/components/shared/order-progress`.

## 8. Alternativas descartadas

- **A. La receta como segmento de la ruta** (`/asignacion/<orderId>/receta/<lineId>`).
  - **Ventaja.** Es más «ruta» que la consulta.
  - **Por qué se descarta.**
    - Obliga a mover `page.tsx` y su carpeta `components/` en las tres pantallas. La regla 8 de
      `frontend_dev` exige que la página importe de su propio `./components`.
    - Eso supone renombrar unos 25 archivos que **QC-291 también toca**, y la integración de
      QC-291 sería mucho más cara.
  - **La consulta.** Lleva la receta en la dirección igual (decisión «Una fila por receta»).
    Deja los archivos donde están y la página la exige, con 404 si falta (R9).
- **B. Ampliar `OrderDeliveryProgress`** (que `recipeId` pase a lista) en vez de un método
  nuevo.
  - **Por qué se descarta.** Lo consumen también el listado de Pedidos (`list-orders.ts`) y el
    contexto de chat de `integraciones`. Cambiar su forma toca dos módulos que esta ficha no
    necesita.
- **C. Dejar la búsqueda por estado y elegir la primera línea** en vez de pasar `lineId`.
  - **Por qué se descarta.** Con dos recetas en el mismo estado, la pantalla no sabe cuál
    es. Es el error que quita esta ficha (R12).
- **D. Una fila del Dashboard por receta.**
  - **Por qué se descarta.** Contradice la decisión «Pedido con secciones».

## 9. QC-291

QT-315 trabaja sobre las pantallas de hoy y no importa nada de la rama de QC-291. Los archivos que
comparten están en `tasks.md > Archivos esperados`. `archivos-en-vuelo.mjs` mostrará el choque y
el humano ya lo aceptó con la fila «Orden con QC-291». QC-291 se adapta al integrar `dev`.
