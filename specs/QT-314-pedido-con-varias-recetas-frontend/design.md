# QT-314 — pedido-con-varias-recetas-frontend · design.md

> **Fuente visual (pase `/design`, aprobado por el humano el 2026-11-06).** Página «3 · Pedidos»
> del canvas del proyecto, copiada a:
> - `docs/diseno/canvas/PedidosVariasRecetas.dc.html`: escritorio, interactivo. Incluye el
>   listado, el detalle, editar y nuevo con sub-panel, el selector de receta, cancelar receta,
>   cancelar pedido y el error por receta.
> - `docs/diseno/canvas/PedidosVariasRecetasTablet.dc.html`: tablet.
> - `docs/diseno/canvas/PedidosVariasRecetasMovil.dc.html`: teléfono y la ficha por plataforma
>   (Reutiliza / Nuevo / Librerías / Escritorio / Estados / Tablet / Teléfono / Animación).
>
> Todo componente nuevo o con cambio visual de esta ficha cita esos tableros
> (`docs/perfil-agentes.md > Pase de diseño para componentes nuevos`). Sin dependencias nuevas
> (R47).

## Lo que ya existe

**Buscado** en el board (`feature_list.json`: `varias recetas`, `varias fórmulas`, `cancelar
receta`, `detalle del pedido`, `ficha del pedido`, `panel de detalle`), en `specs/` (los mismos
términos, `cancelOrderLineAction` y `order-detail`) y en el código. El MCP del grafo no tiene
proyecto para este worktree, así que el código se buscó con Grep/Read.

| Qué apareció | Dónde | Qué hacemos |
|---|---|---|
| QT-313 (backend de varias recetas, `done`) | `specs/QT-313-…/{requirements,design}.md` | Lo consumimos. § 4.1 da los nombres finales de los esquemas, y § 4.1.1 y § 7 lo que deja a esta ficha: renombrar, borrar los planos y quitar el puente. R44 y R54 dejan de aplicar (`requirements.md`) |
| QT-315 (planta con varias recetas, `pending`) | `feature_list.json` | Fuera de alcance: no toca `app/(private)/pedidos/` |
| QC-308 (margen del pedido, `pending`) | `feature_list.json` | Fuera de alcance (Lo que NO entra) |
| QC-246 «contactos con chat» | `app/(private)/clientes/contactos/components/chat-order-detail.tsx` | Es el detalle de un pedido dentro del chat, sobre `WhatsappCustomerOrder`, no sobre `OrderSummary`. No sirve como panel de detalle de Pedidos y no se toca |
| Caso de uso `cancelOrderLine` | `lib/modules/pedidos/domain/cancel-order-line.ts`, `lib/composition/index.ts:1793` | Se reutiliza. Esta ficha solo le pone la acción de servidor (R29) |
| `updateOrderPresentationLines` por `lineId` | `domain/update-order-presentation-lines.ts` | Se reutiliza. La acción deja de calcular la línea (R31) |
| `quoteOrderCostSchema` con `orderLineId` | `domain/order-input.ts:287` | Se reutiliza. La acción deja de cambiar `orderId` por la única línea (R14) |
| `deliverOrder`, `voidDelivery` por línea | `domain/deliver-order.ts`, `domain/void-delivery.ts` | Se reutilizan sin cambios: ya validan por receta y admiten `PARCIAL` |
| `orderTotals`, `orderProgress`, `sumDecimal4` | `domain/order-totals.ts` | Se reutilizan. `sumDecimal4` sale al contrato para el total del panel (R13) |
| `OrderView.lines`, `progress`, `salePriceTotal`, `linesWithoutPrice`, `ingredientsCostTotal`, `actualCostTotal` | `domain/order-view.ts` | Se reutilizan. `OrderLineView` gana cuatro campos (§ 3.4) |
| Patrón de filas en sub-panel | `app/(private)/proveedores/[id]/components/catalog-line-sheet.tsx`, `catalog-line-form.tsx` | Es el modelo del sub-panel (alta y edición de una fila en panel propio) |
| Patrón de líneas en formulario | `app/(private)/produccion/formulas/components/recipe-lines-field.tsx` | Es el modelo de la tabla de recetas del panel |
| Campos del formulario de hoy | `app/(private)/pedidos/components/{recipe-picker,recipe-version-select,order-field,order-distribution-field,order-cost-quote,order-ingredients-table,order-recipe-image,order-leftover-dialog,use-order-cost-quote,use-order-distribution-availability}` | Se reutilizan dentro del sub-panel, sin cambios de forma |

**Catálogo consultado** (`components/shared/CATALOGO.md`), con la pieza que reutilizamos de cada
fila:

| Fila | Uso en esta ficha |
|---|---|
| `DataTable` | Listado y tarjetas de teléfono (`card.footer` para «Ver detalle» y «Acciones») |
| `RowActionsMenu` | Menú de la fila, **extendido** con rótulos de grupo (§ 4.6) |
| `FormSheet`, `SaveButton` | El panel del pedido. Su pie fijo «Cancelar / Guardar pedido» encaja |
| `Sheet`, `SheetContent`, `SheetHeader`, `SheetFooter` | El sub-panel y el detalle. Ninguno de los dos es un `<form>` con Server Action, así que `FormSheet` no sirve: su pie no admite «Quitar receta» |
| `Dialog`, `DialogContent` | Selector de receta |
| `ConfirmDialog` | Cancelar receta y cancelar pedido |
| `Notice` | Aviso de error por receta, **extendido** con acciones (§ 4.3) |
| `StatusBadge` (vía `OrderStatusBadge` de la ruta) y `ORDER_STATUS_LABELS`/`ORDER_STATUS_TONES` | Estado del pedido y de cada receta (R39). La guardia `guard-pedidos-rediseno` sigue mandando: ningún mapa propio |
| `PriorityMark` | Prioridad en el detalle |
| `ResponsibleAvatars` | Responsables en el detalle |
| `OrderDistributionLabel`, `orderDistributionLineText` | Reparto resumido en la tabla del panel, el detalle y el selector |
| `OrderCustomerPicker`, `orderCustomerLabel` | Cliente del panel y del detalle |
| `PresentationUnitSelect`, `AsyncAutocomplete` | Dentro de los campos que ya usa el formulario (receta, unidad) |
| `Table`, `TableHeader`, `TableBody`, `TableRow` | Tabla de recetas del panel en escritorio y tablet |
| `formatDecimalDisplay`, `trimDecimal`, `EMPTY_MARK` | Importes y marcadores |
| `useEntitySheet`, `useIsMobile` | Apertura y aviso del panel. Tarjetas en el teléfono |
| `Toaster` | Avisos de éxito |

**Componentes nuevos o con cambio, con su paso de la regla de decisión**
(`docs/perfil-agentes.md > Regla de decisión para componentes`):

| Pieza | Dónde | Paso | Por qué |
|---|---|---|---|
| `RowActionsMenu`: `groupLabel` por ítem | `components/shared/row-actions-menu.tsx` | 2 · extender | El tablero pinta los rótulos «Por receta» y «Pedido entero». `separatorBefore` ya pone la raya, pero no hay rótulo. La prop es opcional: sin ella, el árbol no cambia |
| `Notice`: `actions` | `components/shared/notice.tsx` | 2 · extender | El tablero pone «Revisar receta» y «Guardar bloqueada» dentro del aviso, y la fila dice «No cubre: acciones dentro». La prop es opcional |
| `OrderProgress` (barra «N de M») | `app/(private)/pedidos/components/order-progress.tsx` | 4 · crear | No hay barra de avance en el catálogo (buscado «progress»: solo `StatusBadge`, `CountdownRing` y la subida de archivos). La usa una sola ruta en tres sitios: celda, tarjeta y detalle |
| `OrderLinesTable` (tabla de recetas del panel) | `…/components/order-lines-table.tsx` | 3 · componer | `Table` + `OrderStatusBadge` + `OrderDistributionLabel` + `Button`. En el teléfono pasa a tarjetas, como `DataTable` con `card` |
| `OrderLineSheet` (sub-panel) | `…/components/order-line-sheet.tsx` | 3 · componer | `Sheet` + los campos de hoy del formulario (fila de arriba) + `Notice` |
| `OrderDetailSheet` (detalle) | `…/components/order-detail-sheet.tsx` | 3 · componer | `Sheet` + `OrderStatusBadge`, `PriorityMark`, `ResponsibleAvatars`, `OrderDistributionLabel`, `OrderProgress` |
| `OrderLinePickerDialog` (selector) | `…/components/order-line-picker-dialog.tsx` | 3 · componer | `Dialog` + opciones con `OrderStatusBadge` |
| `CancelOrderLineDialog` | `…/components/cancel-order-line-dialog.tsx` | 3 · componer | `ConfirmDialog`, como `cancel-order-dialog.tsx`. No se extiende `CancelOrderDialog` (paso 2) porque cambian la acción, el campo oculto de la receta y todos los textos: extenderlo sería ramificar el componente entero por una prop |
| `OrderForm` | `…/components/order-form.tsx` | cambio visual | Se rehace con la forma B. Tablero citado arriba |
| `OrderRowActions`, `order-columns`, `order-table`, `order-sheet`, `cancel-order-dialog`, `order-distribution-dialog`, `order-delivery-sheet`, `order-deliveries-sheet`, `order-delivery-list`, `order-responsibles-sheet` | `…/components/` | cambio | Pasan a trabajar por receta. Los cambios visibles están en el tablero |

Ninguna pieza nueva sube a `components/shared`: todas las usa una sola ruta. Las dos
extensiones actualizan su fila del catálogo (punto de extensión y celda `Diseño`) en el mismo
commit.

## 1. Modelo de datos

**Sin tablas, columnas, RLS ni migraciones nuevas.** QT-313 dejó el modelo de líneas (`order_lines`,
`order_line_id` en las tablas hijas, `PARCIAL`). Esta ficha solo cambia contratos de `lib/` y la
pantalla. Se mantiene la frontera de autorización de siempre: cada caso de uso exige su permiso
(R42).

## 2. Rutas

- Una sola ruta, `app/(private)/pedidos/page.tsx`. **No nace `/pedidos/[id]`**: el detalle es un
  panel lateral sobre el listado, como el panel de alta (§ 6, alternativa B).
- Los datos del detalle salen de la fila que el listado ya trajo (`OrderSummary`, con `lines`,
  `progress` y totales). No hay lectura nueva por fila ni `getOrderAction` desde el cliente.

## 3. Contratos de `lib/` (los hace `backend_dev`)

### 3.1 Esquemas finales (R40)

En `lib/modules/pedidos/domain/order-input.ts`, como dice QT-313 § 4.1:

| Hoy | Después |
|---|---|
| `createOrderSchema`, `updateOrderSchema` (planos, una receta) | **Se borran** |
| `createOrderWithLinesSchema` | `createOrderSchema` |
| `updateOrderWithLinesSchema` | `updateOrderSchema` |
| `updateOrderDistributionSchema` (plano, sin `lineId`) | **Se borra** |
| `updateOrderLineDistributionSchema` | `updateOrderDistributionSchema` |
| `cancelOrderLineSchema` | igual |
| `orderLineInputSchema` (sin publicar) | **Se publica** en `index.ts`: el sub-panel valida con él (R4) |
| `quoteOrderCostSchema`, `orderPresentationAvailabilitySchema` (`createOrderSchema.pick(...)`) | Se derivan de `orderLineInputSchema.pick(...)`, con la misma forma de hoy |

Los tipos siguen a sus esquemas: `CreateOrderInput`, `UpdateOrderInput` y
`UpdateOrderDistributionInput` pasan a ser los de líneas, y desaparecen `CreateOrderWithLinesInput`,
`UpdateOrderWithLinesInput` y `UpdateOrderLineDistributionInput`. `update-order-presentation-lines.ts`
tiene su propio `UpdateOrderPresentationLinesInput`, que no cambia. `order-ingredients-table.tsx` usa
hoy `createOrderSchema.shape.quantity` y pasa a usar `orderLineInputSchema.shape.quantity`.

### 3.2 Acciones de servidor (`adapters/driving/order-actions.ts`)

| Acción | Hoy | Después |
|---|---|---|
| `createOrderAction` | `(prev, formData)`: `buildCreateCandidate` envuelve una receta | `(input: unknown)`. El candidato tipado lo arma el panel y se entrega **tal cual** al caso de uso (R41) |
| `updateOrderAction` | `(id, prev, formData)` + `requireSingleLineIdOf` | `(id, input: unknown)`, sin leer líneas (R41) |
| `updateOrderDistributionAction` | `(id, input)`: esquema plano + `requireSingleLineIdOf` | `(id, input)`: parsea `updateOrderDistributionSchema` (con `lineId`) y pasa `parsed.data.lineId` (R31) |
| `quoteOrderCostAction` | `withOrderLine` cambia `orderId` por la única línea | Entrega `input` tal cual: el sub-panel manda `orderLineId` (R14) |
| `cancelOrderLineAction` | no existe | **Nueva**: `(prev, formData)` con `id`, `lineId` y `reason` en campos ocultos, el mismo patrón que `cancelOrderAction`. Sin `id` o sin `lineId` responde `invalid_input` sin llamar al caso de uso (R29) |
| `getOrderDeliveryAction` | `(orderId)` | `(orderId, lineId)` (R33) |
| `listOrderDeliveriesAction` | `(orderId)` | `(orderId, lineId)` (R35) |

Se borran `buildCreateCandidate`, `buildUpdateCandidate`, `readPresentationLines`, `singleLineIdOf`,
`requireSingleLineIdOf` y `withOrderLine`. Al quedarse sin consumidor, también se borran el caso de
uso `createListOrderLineIds` (`domain/list-order-line-ids.ts`), su entrada `listOrderLineIds` en
`lib/composition/index.ts` y sus tests. Era el lector del puente y nada más lo usa (verificado con
Grep).

**Por qué `input: unknown` y no `FormData` en el alta y la edición.** Un pedido de N recetas, cada
una con un reparto de M líneas, es una estructura anidada. La entrega (`deliverOrderAction`) ya
recibe una entrada así, tipada, y la valida el caso de uso. La alternativa de seguir con `FormData`
se descarta en § 6.

### 3.3 Posición de las recetas que fallan (R15, R16)

Esta ficha reabre la decisión de QT-313 «Posición de la línea solo en el diagnóstico» (fila «Errores
por receta»). Las posiciones salen como **dato**, no como texto:

1. **Dominio.** `PedidosError` gana `readonly linePositions: readonly number[]`, que vale `[]` si no
   se dice nada. `atLinePosition` (`domain/order-line-diff.ts`) rehace el error con la misma clase,
   como hoy, y además le pone `[position]`. El `OrderWouldBlockError` de `create-order.ts` y
   `update-order.ts` lleva `blocked`. El `InsufficientMaterialError` de una receta `EN_CURSO` y
   `assertNoDuplicateOrderRecipe` llevan las posiciones de sus recetas (en una repetida, las dos).
   `domain/errors.ts` publica `linePositionsOf(error: unknown): readonly number[]`: ordena de menor a
   mayor, quita repetidas y devuelve `[]` para cualquier valor que no sea un `PedidosError`. El
   `instanceof` vive ahí, en el dominio.
2. **Borde.** `createOrderAction` y `updateOrderAction` devuelven
   `OrderLinesErrorState = ErrorState & { readonly linePositions: readonly number[] }`. Se compone
   así: `{ ...(await toErrorState(error)), linePositions: linePositionsOf(error) }`.
3. **Lo que no cambia** (R16):
   - `ErrorState` y su lista cerrada (`errores/domain/error-state.ts`): la guardia
     `guard-catalogo-de-errores` caso 8 sigue verde sin tocarla.
   - El traductor sigue construyendo campo a campo (caso 9). El spread de arriba está en
     `order-actions.ts`, no en el traductor, y extiende el estado ya traducido, nunca el error.
   - `order-actions.ts` no usa `instanceof` (caso 2: ese archivo ya construye un
     `{ status: 'error', … message }` para `MISSING_ID_ERROR`).
   - El diagnóstico sigue yendo solo al registro.
   - Las demás acciones devuelven `ErrorState` como hoy.
4. **Posición = índice en `lines` de la entrada enviada.** La tabla del panel también enseña las
   recetas canceladas, y esas no se envían (R7), así que el panel guarda, al enviar, qué fila es
   cada índice (§ 4.1) y numera «receta N» por la fila de la tabla (desde 1).

El mensaje sigue saliendo del catálogo. El texto «No alcanza el material para X (receta N).» lo
compone la pantalla (§ 4.3) a partir del código, las posiciones y los nombres que ya tiene. El
insumo que falta («Falta fragancia lavanda» en el tablero) **no** viaja en la respuesta: no está
decidido y ampliaría la respuesta otra vez. Lo enseñan la cotización y la tabla de insumos del
sub-panel.

### 3.4 `OrderLineView` ampliada

La edición de una receta y el detalle necesitan lo que hoy solo tiene el pedido plano:

```ts
type OrderLineView = {
  /* lo de hoy */
  readonly originalRecipeId: string;   // la original: el sub-panel la manda como `recipeId` y compara repetidas (R8)
  readonly recipeVersion: { originalId: string; originalName: string; versionName: string } | null;
  readonly recipeImageUrl: string | null; // la de la original si es versión, como hoy en OrderView
  readonly unitLabel: string | null;      // símbolo o nombre de la unidad de la receta
};
```

`toOrderLineView` (`domain/get-order.ts`) los rellena con lo mismo que hoy lee `toOrderView` para la
primera receta: el `RecipeRef`, ya leído para todas, y las etiquetas de unidad, ya leídas en una sola
llamada. No hay consulta nueva por receta. `OrderLineRow.originalRecipeId` ya existe.

**Campos planos de `OrderView` (decisión P1).** Se borran `recipeId`, `recipeName`,
`recipeVersion`, `recipeImageUrl`, `quantity`, `unitId`, `unitLabel`, `presentationLines`,
`salePrice`, `ingredientsCost`, `packagingCost` y `actualCost`, y su relleno en `toOrderView` (T17,
cuando la pantalla ya no los lee). `cancellationReason` del pedido se queda. Así R24 lo garantiza
también el tipo, no solo los tests.

### 3.5 Entregas por receta (R33, R35)

- `getOrderDelivery(orderId, lineId, actor)`. Bloquea por la receta, no por el pedido: busca la línea
  viva del pedido (si no es de este pedido o de esta empresa, o está quitada, responde
  `order_not_found`). Si no está en `TERMINADO` lanza `ActionNotAllowedError`. Filtra
  `findPresentationLinesForFinish` por `orderLineId === lineId`. **Ya no exige que el pedido esté en
  `TERMINADO`**, así que funciona con el pedido en `PARCIAL`. El resto (lotes por receta, cliente
  vivo) no cambia.
- `listOrderDeliveries(orderId, lineId, actor)` filtra las líneas del historial a las presentaciones
  de esa receta, quita las entregas que se quedan vacías y añade `lineStatus` a la cabecera de la
  vista. `orderStatus` se queda.
- `deliverOrder` y `voidDelivery` no cambian: ya comprueban la receta de cada presentación y el
  estado del pedido derivado.
- Por fases: en la tanda 1, `lineId` entra **opcional** y sin él se comportan como hoy, para que la
  pantalla de hoy siga en verde. En la tanda 3 pasa a obligatorio (T13).

### 3.6 Predicados publicados para la pantalla

La pantalla anticipa las reglas del servidor sin copiarlas. Hoy hay copias en
`ORDER_STATUS_IS_FINAL` y en los mapas de `order-row-actions.tsx`. El contrato publica, como
funciones puras y seguras para el cliente:

| Predicado | Regla (fuente) | Lo usa |
|---|---|---|
| `isEditableOrderLineStatus(status)` | `status !== 'CANCELADO' && isAllowedTransition(status, status)` (hoy `EDITABLE_ACTIVE` de `update-order.ts`) | R10 |
| `isCancellableStatus(status)` | `domain/order-cancellation.ts` | R26, R27, R36 |
| `isRemovableOrderLineStatus(status)` | `domain/order-line-removal.ts` | R11 |
| `isDeletableOrder(status, lines)` | `isDeletable` de `domain/delete-order.ts` | R37 |
| `sumDecimal4(values)` | `domain/order-totals.ts` | R13 |
| `linePositionsOf(error)` | § 3.3 | solo el borde |

## 4. Pantalla (la hace `frontend_dev`)

### 4.1 El borrador del pedido (`order-line-draft.ts`, funciones puras)

El panel guarda en estado de cliente una lista de `OrderLineDraft`:

```ts
type OrderLineDraft = {
  readonly key: string;                      // estable en el borrador; las nuevas, generada
  readonly saved: OrderLineView | null;      // null = nueva
  readonly recipe: { id: string; name: string; imageUrl: string | null }; // la original
  readonly recipeVersionId: string | null;
  readonly quantity: string; readonly unitId: string; readonly unitLabel: string | null;
  readonly presentationLines: readonly OrderDistributionLine[];
  readonly salePrice: string;                // texto tal cual; el esquema decide
  readonly ingredientsCost: string | null;   // el guardado, o el último cotizado
};
```

Funciones, cada una con su test unitario:

- `draftFromOrder(order)`: las líneas del pedido, por `position`, **canceladas incluidas**.
- `candidateOf(draft, header)`: `{ lines, priority, customerId, confirmBlocked }`. Las canceladas
  no van. Las no editables van con sus valores guardados, sin tocar, y las editables con lo del
  borrador. Las guardadas llevan `id` y las nuevas no. Devuelve también `rowOfPosition`, que dice
  qué fila de la tabla es cada índice de `lines` (§ 3.3).
- `isSameRecipe(a, b)`: compara `originalRecipeId` (R8). Las canceladas no cuentan.
- `draftTotals(draft)`: el total con `sumDecimal4` y cuántas no tienen precio, más el coste
  estimado («sin coste» si a alguna activa le falta). Cuenta solo las no canceladas (R12, R13).
- `canRemove(line)`, `isReadOnly(line)`: con los predicados de § 3.6.

### 4.2 Panel del pedido (`order-form.tsx`, rehecho)

- Sigue siendo `FormSheet` dentro de `OrderSheet` (`useEntitySheet`: cierre, toast y
  `router.refresh()`). Contiene el cliente (`OrderCustomerPicker`), la prioridad (`SelectField`), la
  cabecera «Recetas N» con «Añadir receta», `OrderLinesTable` y la caja de total y coste estimado.
- `formAction` es una función de cliente que llama a `createOrderAction(candidate)` o a
  `updateOrderAction(id, candidate)` con `candidateOf(...)`.
  - **Con éxito** (R7): `handleSaved`.
  - **Error con `linePositions`**: guarda el estado para el aviso (§ 4.3).
  - **`order_would_block`**: el aviso ofrece «Guardar bloqueada», que reenvía el mismo candidato con
    `confirmBlocked: true` (R17). Sustituye en este panel a `BlockedOrderDialog`, que sigue en
    «Reparto y unidad».
- `canSave` es falso mientras no haya ninguna receta no cancelada (R12). No hay otra regla de «sin
  cambios» (decisión P2). Un rechazo sin posiciones, como `invalid_transition`, muestra el mensaje
  del catálogo en el panel y conserva el borrador (R50).
- Título y descripción, del tablero: «Nuevo pedido» / «Editar pedido 2026-…».

### 4.3 Sub-panel y aviso de error

- `OrderLineSheet` es un `Sheet` **controlado y hermano** del panel, abierto encima. En teléfono
  ocupa la pantalla entera, y en tablet y escritorio se apila a la derecha. La cabecera lleva el
  botón «Volver al pedido» (flecha) y el texto «Los cambios se guardan con "Guardar pedido"».
  El pie lleva «Quitar receta» (solo si `canRemove`, R11), «Descartar» y «Aplicar».
- No es un `<form>` ni llama a ninguna acción de guardado: «Aplicar» valida con
  `orderLineInputSchema` y con `isSameRecipe` y devuelve el `OrderLineDraft` al panel (R4, R8). La
  cotización (`useOrderCostQuote` con `orderLineId = saved?.id`, R14), la disponibilidad del reparto
  y los insumos (`getRecipeAction`) se reutilizan como están hoy en el formulario.
- `frozen` de la cotización pasa a mirar el estado de **la receta** (`isStartedOrderStatus(saved.status)`),
  no el del pedido.
- El aviso es `Notice` con `tone="danger"` y la prop nueva `actions`, al principio del cuerpo del
  panel. Textos por código:
  - `order_would_block` e `insufficient_material`: «No alcanza el material para {receta} (receta
    {n}).».
  - Los demás con posiciones: «{mensaje del catálogo} {receta} (receta {n}).».
  - Las filas marcadas usan el estilo del tablero: borde izquierdo y fondo de peligro.

### 4.4 Detalle (`order-detail-sheet.tsx`)

`Sheet` de solo lectura con los bloques del tablero (R18):

- **Resumen**: estado, prioridad, `OrderProgress` largo («N de M terminadas»), precio total con «N
  sin precio», coste estimado, coste real y responsables (`responsiblesByOrder`, el lote que ya trae
  la sección).
- **Una tarjeta por receta**: nombre, estado, cantidad con `unitLabel`, reparto, precio, coste
  estimado, coste real y «Motivo de cancelación: …» si está cancelada.

El reparto es el que hoy pintaba la columna Presentación: `OrderDistributionLabel`, o
`OrderProducedPresentations` cuando la sección trae productos para esa presentación. El pie lleva
«Cerrar» y «Editar» (R9, R19). Se abre desde el número de pedido (un botón en la celda) y desde «Ver
detalle».

### 4.5 Listado (`order-columns.tsx`, `order-table.tsx`)

| Columna | Hoy | Después |
|---|---|---|
| Fórmula | `order.recipeName` | Rótulo «Fórmula»: `lines[0].recipeName` + «+N más», N = `lines.length - 1` (R20; decisión P3: manda la decisión escrita sobre el tablero) |
| Avance | — | **Nueva**: `OrderProgress` corto «F de T» (R21) |
| Presentación | reparto de la línea 0 | **Sale** (R23) |
| Precio de venta | `salePrice` | `salePriceTotal` + «N sin precio» (R22) |
| Costo estimado | `ingredientsCost` | `ingredientsCostTotal` |
| Costo real | `actualCost` | `actualCostTotal` |
| Nº de pedido | texto | botón que abre el detalle |

La tarjeta de teléfono se ajusta igual: título con la primera receta y «+N más», barra de avance, y
pie con «Ver detalle» y «Acciones» (R44). El resto de columnas (Estado, Prioridad, Cliente, Por
entregar, Fecha, Motivo de cancelación, Cobertura, Responsables) no cambia. «Motivo de
cancelación» se conserva aunque el tablero no la pinte (decisión P3).

### 4.6 Menú de la fila y selector

`orderRowActionsSpec` queda en tres grupos (R25). `RowActionsMenu` gana `groupLabel` por ítem:
pinta un rótulo no interactivo antes del ítem, en las dos presentaciones (`dropdown` y `centered`),
y combina con `separatorBefore`. Habilitación:

| Ítem | Se pinta si | Habilitado si |
|---|---|---|
| Ver detalle | siempre | siempre |
| Editar | siempre (como hoy) | estado del pedido ∉ {`ENTREGADO`, `CANCELADO`} (R9) |
| Responsables | siempre | siempre (R38) |
| Cliente | `canEditCustomer` | `ORDER_STATUS_ACCEPTS_CUSTOMER_CHANGE` de hoy (`PARCIAL`: sí) |
| Reparto y unidad… | `canEditDistribution` y alguna receta `POR_EMPACAR` | siempre (R26) |
| Entregar… | `canDeliver` y alguna receta `TERMINADO` | siempre |
| Entregas… | alguna receta `TERMINADO` o `ENTREGADO` | siempre |
| Cancelar receta… | `canModifyOrders` (`pedidos.modificar`, ya lo calcula `order-list-section.tsx`) y alguna receta cancelable | siempre |
| Cancelar pedido | siempre (como hoy) | alguna receta activa cancelable (R36) |
| Eliminar | siempre (como hoy) | `isDeletableOrder` (R37) |

`ORDER_STATUS_IS_FINAL`, `ORDER_STATUS_ACCEPTS_DISTRIBUTION_EDIT`, `ORDER_STATUS_ACCEPTS_DELIVERY` y
`ORDER_STATUS_HAS_DELIVERIES` se sustituyen por predicados sobre las recetas
(`order-line-actions.ts`): `lineAcceptsAction(kind, line)` y `orderOffersLineAction(kind, order)`.
Los motivos de una receta deshabilitada son los del tablero: «Solo Por empacar», «Aún no está
terminada», «Sin entregas», «No se puede cancelar en este estado».

`isFinalOrderStatus` deja de existir. `order-responsibles-sheet.tsx` pasa a
`responsiblesFrozen(order)`: igual que hoy fuera de `PARCIAL`, y en `PARCIAL` congelado si ninguna
receta activa está en `PENDIENTE`, `EN_CURSO` o `BLOQUEADO` (R38, la regla de QT-313 R55).

El selector `OrderLinePickerDialog` es un `Dialog` centrado (también en escritorio, como en el
tablero) con una opción por receta: nombre, motivo o «cantidad · reparto», y estado, con 52 px de
alto mínimo (R27, R44). Se abre siempre, también con una sola receta, porque la decisión dice
«eligiendo primero la receta». `OrderRowSheetActions` (`order-sheet.tsx`) amplía `OrderRowAction`
con `detail`, `cancelLine` y el par `{ action, lineId }` para las acciones de una receta. El selector
se monta en el mismo sitio, uno por tabla.

### 4.7 Diálogos y paneles por receta

| Pieza | Cambio |
|---|---|
| `CancelOrderLineDialog` | Textos del tablero; campos ocultos `id`, `lineId` y motivo; `cancelOrderLineAction`; el error se queda en el diálogo (R28) |
| `OrderDistributionDialog` | Recibe `line: OrderLineView`. Unidad, reparto, cantidad y etiqueta salen de la receta, y manda `lineId` (R30) |
| `OrderDeliverySheet` | Recibe `line`. El título y la imagen son los de la receta, y llama a `getOrderDeliveryAction(order.id, line.id)` (R32) |
| `OrderDeliveriesSheet`, `OrderDeliveryList` | `listOrderDeliveriesAction(order.id, line.id)`. `STATUS_ACCEPTS_VOID` mira `view.lineStatus` (`TERMINADO` o `ENTREGADO`), no el estado del pedido (R34) |
| `CancelOrderDialog` | Lista las recetas que se cancelan y las que se quedan, con `isCancellableStatus` (R36) |

### 4.8 Plataformas y animación (R44–R46)

- **Teléfono** (< 768 px): el listado en tarjetas (`DataTable` con `card`). El panel, el sub-panel y
  el detalle a pantalla completa (`side="bottom"` o el ancho completo que ya usa `FormSheet` en
  teléfono). `OrderLinesTable` pinta tarjetas con «Editar receta». Targets de 44 px y 52 px en el
  selector. Inputs de 16 px (los campos reutilizados ya lo cumplen).
- **Tablet**: la tabla dentro de su caja con scroll horizontal (`DataTable` ya lo hace); el panel y
  el sub-panel apilados a la derecha.
- **Animación**:
  - el sub-panel usa la entrada y la salida de `Sheet` (300/150 ms);
  - el aviso, la entrada de `Notice`;
  - `OrderProgress`, `transition-[width]` con la duración de los tokens de movimiento;
  - el menú, la de `RowActionsMenu`.
- Nada depende de `:hover` y no hay excepción de solo escritorio.

## 5. Tests

- **`lib/`**: unidad con dobles para § 3.3–3.6. Para las acciones, su test contra dobles, el de
  siempre: alta y edición de 3 recetas sin `invalid_input`, `linePositions` en `order_would_block` y
  en un fallo de receta, y `cancelOrderLineAction`. Más los `.int` de entregas por receta contra la
  base. La guardia `guard-catalogo-de-errores` debe seguir verde **sin cambiarla** (R16).
- **Pantalla**: `*.test.tsx` en el proyecto `ui`, con un pedido de dos recetas cuya primera receta
  difiere del resto, para que R24 muerda.
- **E2E**: spec nuevo `e2e/pedidos-varias-recetas.spec.ts` (R48), que comprueba en la base, por
  receta, lo apartado y lo liberado al cancelar. Los E2E de pedidos que existen se adaptan (R49),
  con helpers comunes en `e2e/helpers/order-form.ts` para abrir el panel, añadir una receta y
  guardar. `e2e/pedido-con-varias-recetas.spec.ts` (QT-313 R46) se adapta al alta nueva y conserva
  lo que comprueba.
- **QT-313 R44 y R54**: sus casos (`order-actions.test.ts`, `order-row-actions.test.tsx`,
  `order-delivery-list.test.tsx`) se reescriben a R7, R41, R9, R26, R36 y R38. No se dejan en
  `skip`.

## 6. Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| **A. Ampliar `ErrorState`** con `linePositions` en `lib/modules/errores` | Abre la lista cerrada que protege la guardia (caso 8) para todos los módulos, por un dato que solo da `pedidos` en dos acciones. § 3.3 lo resuelve en el borde de `pedidos` sin tocar el tipo compartido |
| **B. Ruta `/pedidos/[id]` para el detalle** | La decisión pide un panel. Una ruta obliga a una lectura nueva (`getOrder`), pierde la página, el orden y los filtros del listado al volver, y no la pide el tablero |
| **C. Seguir con `FormData` en el alta y la edición**, con nombres indexados (`lines[0].quantity`) o con las recetas en JSON en un campo oculto | Con índices, el borde tendría que reconstruir una estructura anidada a mano, y eso es lógica de forma en el adaptador. Con JSON, se codifica dos veces y se valida un texto. La entrega ya usa una entrada tipada para lo mismo (§ 3.2) |
| **D. Formularios A o C del lienzo** (todas las recetas desplegadas en el panel, o un asistente) | Descartadas por el humano al elegir B (fila «Forma del formulario») |
| **E. Mantener `requireSingleLineIdOf` para «Reparto y unidad»** | Rechaza justo los pedidos que esta ficha hace posibles (R31) |
| **F. Ocultar las acciones de una receta cuando ninguna receta las admite, y además deshabilitarlas en el menú** | Mezcla dos señales. Se sigue el patrón de hoy (se pintan si alguna receta las admite), y el «por qué no» de cada receta lo dice el selector |
| **G. Saltar el selector cuando el pedido tiene una sola receta** | La decisión dice «eligiendo primero la receta», y el tablero no pinta ese atajo |

## 7. Riesgos

- **Conflicto de archivos amplio.** La ficha toca casi toda `app/(private)/pedidos/components/` y
  muchos E2E. `archivos-en-vuelo.mjs` lo detecta con `## Archivos esperados`. QT-315 está
  `pending` y toca las pantallas de planta, no estas.
- **La tanda 3 es de dos agentes a la vez.** El renombrado de esquemas y la firma nueva de las
  acciones rompen la pantalla de hoy, así que T13 (backend) y T14–T16 (frontend) van en la misma
  tanda, y el gate se mira al cerrar las cuatro.
- **E2E lentos de adaptar.** Unos 25 specs abren el panel de hoy. Los helpers comunes de § 5 evitan
  repetir el recorrido en cada uno.
