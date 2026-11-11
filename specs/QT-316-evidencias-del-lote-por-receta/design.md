# QT-316 — evidencias-del-lote-por-receta · design.md

> **Zona** fullstack · **Complejidad** medium · **Rama** `feature/QT-316-evidencias-del-lote-por-receta`
> (nace de `origin/dev` con `origin/feature/QT-315-planta-con-varias-recetas` mergeada).
>
> Requisitos: `requirements.md` (R1–R21). P1–P3 cerradas por el humano el 2026-11-11 (retirar las
> lecturas del pedido entero, mostrar acondicionamiento, receta quitada sin nombre). Queda abierta
> P4 (`readOrderEvidence` y `countByOrders` sin consumidor): el diseño sigue su recomendación,
> retirarlos, y § 3.5 dice qué cambia si no.

## Lo que ya existe

**Búsqueda** (`docs/specs.md > Antes de especificar`). Términos: «evidencia», «lote», «receta»,
«línea», «countByOrders», «readOrderEvidenceByLine».

- **Board** (`feature_list.json`): `QC-214 evidencia-por-paso` (toma de fotos), `QC-271
  consulta-de-evidencia-por-paso` (la columna y el diálogo de hoy) y `QT-316` (esta). No hay otra
  ficha que separe la evidencia del lote por receta.
- **Specs:** QT-315 la dejó fuera a propósito (P4 y R34) y deja hecha la lectura por línea. QT-313
  R43 da la regla de la receta ajena.
- **Código:** el MCP `codebase-memory-mcp` responde, pero no tiene índice de este worktree (no está
  en `list_projects`). La exploración se hizo con Grep/Read sobre el worktree:
  - `lib/modules/asignaciones/domain/read-order-evidence.ts`: `readOrderEvidence` (todo el pedido) y
    `readOrderEvidenceByLine` (QT-315: por línea, una sola firma). **Se reutiliza** la segunda. La
    primera solo la usa `getOrderEvidence` (y su test): **se retira** con ella (P1, P4).
  - `lib/modules/asignaciones/domain/get-order-evidence.ts` y `count-order-evidence.ts` (QC-271):
    su único consumidor es la ficha de producto terminado, a través de `order-evidence-actions.ts`.
    **Se retiran** (P1).
  - `lib/modules/asignaciones/ports/step-evidence-repository.ts`: `StepEvidenceRow.orderLineId`,
    `listByLine` y `countByOrders`. **Se amplía** con `countByLines`. `countByOrders` solo lo usa
    `countOrderEvidence`: **se retira** (P4).
  - `lib/modules/asignaciones/domain/recipe-of-order.ts`: `readRecipeOutlines` (QT-315). **Se
    reutiliza** para saber cuántas recetas vivas tiene el pedido y cuál es la de la línea.
  - `OrderCatalog.listRecipeOutlinesByIdsIncludingDeleted` y `RecipeCatalog.findRefsIncludingDeleted`
    ya están atados en `asignaciones` (`lib/composition/index.ts`). **Se reutilizan**, sin cambios.
  - `inventory_movements.order_line_id`: el CHECK `inventory_movements_order_line_id_matches_kind`
    lo hace obligatorio en `production`, y la FK compuesta con `order_id` garantiza que la línea es
    del pedido. **Se lee**, sin migración.
  - `lib/modules/inventario/adapters/driven/persistence/finished-product-detail-prisma.ts`
    (`listFinishedProductBatches`) ya lee el asiento `production` de cada lote para sacar `orderId`.
    **Se amplía** el `select` con `orderLineId`.

**UI** (`components/shared/CATALOGO.md`, filas consultadas):

| Fila | Uso | Paso de la regla de decisión |
|---|---|---|
| `DataTable` (`components/shared/data-table`) | la tabla de lotes, sin cambios | 1. Reutiliza |
| `StepEvidence` (`components/shared/step-evidence`, con `EvidenceStepList` y `EvidenceReadError`) | grupos del diálogo (también «Acondicionamiento»), esqueleto y error, sin cambios: `EvidenceStepList` recibe el nombre de la fase como `phaseLabel` (texto libre), así que la pieza no necesita conocer la fase nueva | 1. Reutiliza |
| `Dialog` (`components/ui/dialog`) | el diálogo, sin cambios | 1. Reutiliza |
| `EMPTY_MARK` (`lib/shared/ui/empty-mark.ts`) | «—» de la celda | 1. Reutiliza |

**No nace ningún componente.** Cambian tres componentes de la ruta
(`batch-evidence-dialog.tsx`, `batch-evidence-button.tsx` y `finished-product-batches-table.tsx`):
reciben la receta, y el diálogo suma la receta al título y la descripción y el grupo
«Acondicionamiento». Ese cambio visual tiene su pase `/design` aprobado por el humano el 2026-11-11:

- `docs/diseno/canvas/EvidenciaLoteVariasRecetas.dc.html` (escritorio, interactivo: «Varias
  recetas» / «Una receta», rol y estados de fotos). Actualizado en `3080a2ebd` con el grupo
  «Acondicionamiento» (P2): el lote de ejemplo cuenta 7 fotos de las tres fases y el diálogo pinta
  los tres grupos;
- `docs/diseno/canvas/EvidenciaLoteVariasRecetasTablet.dc.html`;
- `docs/diseno/canvas/EvidenciaLoteVariasRecetasMovil.dc.html`, con la ficha: Reutiliza, Cambia,
  Librerías (ninguna), Estados, Tablet, Teléfono y Animación (la de QC-271).

## 1. Decisiones generales

1. **La línea viaja desde el libro hasta el diálogo.** El listado de lotes de `inventario` publica
   la línea del asiento `production` (`orderLineId`). La pantalla cuenta y lee por `(orderId,
   lineId)`. `asignaciones` no consulta `inventario`.
2. **El nombre de la receta llega con el conteo**, no con la lectura de fotos. Así el título está
   completo desde que se abre el diálogo, sin salto al terminar de leer, y la pantalla no importa
   `recetas` (lo prohíben `tests/unit/recetas/scope.test.ts` y `module-contract.test.ts`). Quien
   decide si se nombra la receta es el dominio: `recipeName` llega `null` cuando el pedido tiene una
   sola receta viva (R8) o cuando no se resuelve (R9). La UI no cuenta recetas.
3. **En `asignaciones` el cambio NO es solo aditivo** (P1). Nacen dos casos de uso y dos actions
   por línea, y **se retiran** las dos lecturas del pedido entero de QC-271: `getOrderEvidence` y
   `countOrderEvidence`, sus actions y, por P4, `readOrderEvidence` y
   `StepEvidenceRepository.countByOrders`. La fachada pierde dos operaciones y el barril pierde
   `createGetOrderEvidence`, `createCountOrderEvidence`, sus tipos `Deps` y `OrderEvidenceCount`.
   El contrato de la fachada encoge, pero no rompe a nadie: el único consumidor era esta ficha (§ 3.5,
   § 5). En `inventario` el cambio sí es aditivo. `readOrderEvidenceByLine` no cambia (R16).
4. **Acondicionamiento en el diálogo** (P2, R20). La lectura ya trae `conditioning`
   (`OrderEvidence.conditioning`) y el conteo ya cuenta las tres fases: solo cambia la UI.
5. **Sin migraciones, tablas, permisos ni dependencias** (R18).

## 2. Modelo de datos

- **Sin cambios de esquema.** Se leen `inventory_movements.order_line_id` (asiento `production`) y
  `order_step_evidence.order_line_id`. Los dos ya existen, con índice (`inventory_movements_order_line_id_idx`
  y `order_step_evidence_order_line_id_idx`).
- **RLS:** sin tablas nuevas, nada que activar. Como en todo el repo, la frontera es el caso de uso
  (`docs/architecture.md > Acceso a datos y autorizacion`): las dos lecturas nuevas exigen
  `pedidos.consultar` y filtran por `companyId` en el adaptador.
- **Migraciones:** ninguna. `guard-identificador-de-request` (`MIGRACIONES_ESPERADAS`) no cambia.

## 3. Backend

### 3.1 `inventario`: la línea del lote (backend_dev · R5)

- `lib/modules/inventario/domain/finished-product-detail.ts`: `FinishedProductBatchRow` gana
  `orderLineId: string | null`, `null` exactamente cuando `orderId` es `null`.
  `FinishedProductBatchRecord` (puerto) la hereda por el `Omit`.
- `lib/modules/inventario/ports/finished-product-detail-repository.ts`: solo el comentario de
  `listBatches` («`orderId` y `orderLineId` salen del asiento `production` del lote»).
- `finished-product-detail-prisma.ts` › `listFinishedProductBatches`: el `select` del asiento suma
  `orderLineId: true` y el mapeo `orderLineId: row.movements[0]?.orderLineId ?? null`. Misma
  consulta, sin `include`.
- `list-finished-product-batches.ts`: no cambia (copia la fila con `...batch`).
- **Contrato:** aditivo. El único consumidor de la fila fuera del módulo es la pantalla de la ficha.

### 3.2 `asignaciones`: puerto y adaptador (backend_dev · R4, R15)

`StepEvidenceRepository` (archivo existente: **no nace ningún archivo en `ports/`**, que pondría en
rojo `guard-identificador-de-request > hallazgosDePuertoNuevo`) gana:

```ts
/** Fotos por linea, de las tres fases. Una linea sin fotos, de otro pedido o de otra empresa no
 *  sale. Clave: `lineId`. */
countByLines(
  companyId: string,
  lines: readonly { readonly orderId: string; readonly lineId: string }[],
): Promise<ReadonlyMap<string, number>>;
```

`step-evidence-prisma.ts`: un solo `groupBy` por `['orderId', 'orderLineId']` con
`where: { companyId, orderLineId: { in: lineIds } }`. Se descartan los grupos cuyo `orderId` no es
el del par pedido. Con `lines` vacío no consulta. Cuenta las tres fases (fabricación, envasado y
acondicionamiento), las mismas que pinta el diálogo (P2, R20). En el mismo archivo se retira
`countByOrders` (§ 3.5).

### 3.3 `asignaciones`: casos de uso (backend_dev)

**`domain/count-line-evidence.ts` · `createCountLineEvidence`** (R1, R2, R4, R7, R8, R9, R13, R15)

```ts
deps: {
  evidence: Pick<StepEvidenceRepository, 'countByLines'>;
  orders: Pick<OrderCatalog, 'listRecipeOutlinesByIdsIncludingDeleted'>;
  recipes: Pick<RecipeCatalog, 'findRefsIncludingDeleted'>;
}
input: { lines: { orderId: uuid; lineId: uuid }[] }   // z.strictObject, max 25
output: readonly LineEvidenceCount[]
```

1. `requirePermission(actor, 'pedidos.consultar')`.
2. Entrada inválida (más de 25, id no uuid o clave sobrante) → `ValidationError` (`invalid_input`),
   sin llamar a ningún puerto.
3. Quita los pares repetidos; con la lista vacía devuelve `[]` sin llamar.
4. `countByLines` una vez. De las líneas con fotos, sus pedidos van a `readRecipeOutlines` (una
   llamada) y sus `recipeId` a `findRefsIncludingDeleted` (una llamada, solo si hace falta
   algún nombre).
5. `recipeName` es el nombre de la receta de la línea SI el outline del pedido tiene **más de una**
   receta (canceladas incluidas, la regla de QT-315 R3) **y** la línea está en él. Si no, `null`.
6. Solo salen las líneas con `photoCount > 0`, en el orden de la entrada.

Coste: tres consultas por página como máximo, sean cuantos sean los lotes (R4).

**`domain/get-line-evidence.ts` · `createGetLineEvidence`** (R6, R10, R12, R13, R14, R16)

```ts
deps: ReadOrderEvidenceDeps & { orders: ... & Pick<OrderCatalog, 'listRecipeOutlinesByIdsIncludingDeleted'> }
input: { orderId: uuid; lineId: uuid }   // z.strictObject
output: OrderEvidenceRead                // { evidence: OrderEvidence; signingFailure }
```

1. `requirePermission(actor, 'pedidos.consultar')`.
2. Entrada mal formada → `OrderNotFoundError`, como hacía `getOrderEvidence` (la pantalla no
   distingue).
3. `readOrderEvidenceByLine(deps, companyId, orderId)`. Lanza `OrderNotFoundError` si el pedido no
   es de la empresa; acepta los dados de baja.
4. Si `recipes` trae la línea, devuelve su `evidence` y el `signingFailure` de la lectura.
5. Si no la trae: con la línea en el outline del pedido (receta viva sin fotos), devuelve la
   evidencia vacía. Si no está en el outline (de otro pedido, de otra empresa, inexistente, o
   quitada y sin fotos, P3), lanza `OrderNotFoundError`.

Las fotos de otras recetas se firman dentro de `readOrderEvidenceByLine` (una sola llamada al
proveedor), pero **no salen del dominio**. Es el precio de reutilizar sin rehacer (decisión «Lo que
ya existe»); ver § 7.

**Tipos** (`domain/order-evidence.ts`, exportados por el barril `index.ts`):

```ts
/** Una receta del pedido con fotos. `recipeName` `null` = la pantalla no nombra la receta. */
export type LineEvidenceCount = {
  readonly orderId: string;
  readonly lineId: string;
  readonly photoCount: number;
  readonly recipeName: string | null;
};
```

### 3.4 Adaptadores driving y composición (backend_dev)

- `adapters/driving/order-evidence-actions.ts` (existente) gana, con el mismo `currentActor()` y el
  mismo `toErrorState`:
  - `getLineEvidenceAction(orderId: string, lineId: string): Promise<OrderEvidenceResult>`. La firma
    caída va a `log.warn('evidence_read_signing_failed', { orderId, lineId, message })`, como hoy.
  - `countLineEvidenceAction(lines: readonly { orderId: string; lineId: string }[]): Promise<LineEvidenceCountResult>`.
  - Se retiran `getOrderEvidenceAction`, `countOrderEvidenceAction` y `OrderEvidenceCountResult`
    (§ 3.5). `OrderEvidenceResult` se queda: es el resultado de `getLineEvidenceAction`.
- `lib/composition/index.ts`: `asignaciones.getLineEvidence` (orders = `orderCatalog`, evidence,
  storage) y `asignaciones.countLineEvidence` (evidence, orders, recipes = `recipeCatalog`) ocupan
  el sitio de `getOrderEvidence` y `countOrderEvidence`, al final del bloque de `asignaciones`. Salen
  sus dos imports. No se reordena nada más.

### 3.5 Lo que se retira (backend_dev · R21; P1 y P4)

| Pieza | Archivo | Por qué no le queda consumidor |
|---|---|---|
| `getOrderEvidence` (`createGetOrderEvidence`, `GetOrderEvidenceDeps`) | `lib/modules/asignaciones/domain/get-order-evidence.ts` (se borra) | solo lo llamaba `getOrderEvidenceAction` |
| `countOrderEvidence` (`createCountOrderEvidence`, `CountOrderEvidenceDeps`) | `lib/modules/asignaciones/domain/count-order-evidence.ts` (se borra) | solo lo llamaba `countOrderEvidenceAction` |
| `getOrderEvidenceAction`, `countOrderEvidenceAction`, `OrderEvidenceCountResult` | `adapters/driving/order-evidence-actions.ts` | solo los importaban `batch-evidence-dialog.tsx` y `finished-product-list-section.tsx`, que pasan a las de línea |
| `OrderEvidenceCount` | `domain/order-evidence.ts` y barril | solo lo usaban `countOrderEvidence` y su action |
| `readOrderEvidence` | `domain/read-order-evidence.ts` | solo lo llamaba `getOrderEvidence`; el barril no lo exporta (P4) |
| `StepEvidenceRepository.countByOrders` | puerto y `step-evidence-prisma.ts` | solo lo llamaba `countOrderEvidence` (P4) |

Comprobado con Grep sobre `app/`, `components/`, `lib/`, `tests/`, `e2e/`, `scripts/` y `docs/`: no
hay más consumidores. `getExecutionEvidence` (el Recorrido) usa `readOrderEvidenceByLine` y no se
toca. `readOrderEvidenceRows`, `signAll`, `toEvidence` y `allRows` se quedan en
`read-order-evidence.ts` porque los usa `readOrderEvidenceByLine`.

**Tests que se van o se mudan:**
- `tests/unit/asignaciones/get-order-evidence.test.ts` y `count-order-evidence.test.ts` se borran.
  Sus casos (permiso antes de todo, por permiso y nunca por rol, entrada, empresa) tienen su
  equivalente en `get-line-evidence.test.ts` y `count-line-evidence.test.ts` (T3, T4).
- `tests/unit/asignaciones/read-order-evidence.test.ts`: los casos de `readOrderEvidence` pasan a
  `readOrderEvidenceByLine`, sin perder ninguno: qué fotos se leen, pedidos cancelados y dados de
  baja, la firma, la empresa y el acondicionamiento (QC-299 R21 y R32).
- `tests/integration/asignaciones/step-evidence-repository.int.test.ts`: el `describe` de
  `countByOrders` (QC-271 R6 y R29) pasa a `countByLines`, con los mismos casos por línea.
- `tests/fixtures/order-evidence.ts`: `ORDER_EVIDENCE_COUNTS` pasa a `LINE_EVIDENCE_COUNTS`
  (`LineEvidenceCount[]`). `ORDER_EVIDENCE` y los demás se quedan: los usan el Recorrido y
  `evidence-step-list`.

**QT-315 R34 queda superado.** R34 decía que QT-315 no debía cambiar la consulta de evidencias del
lote, y que esa consulta debía seguir devolviendo las fotos del pedido «como en la rama base». Era
una frontera de alcance **de QT-315**: protegía la ficha de producto terminado hasta que QT-316 la
separara por receta (decisión P4 de QT-315). QT-316 es esa separación. Con ella, la lectura del
pedido entero no tiene ningún consumidor. El humano decidió retirarla aquí (P1, 2026-11-11), en vez
de dejar código muerto que un futuro consumidor podría usar para volver a mezclar las recetas.

Los tests de R34 en QT-315 son los de `get-order-evidence.test.ts` y el E2E de QC-271, sin
modificar. Se borran (unit) o cambian de forma (E2E, R19) en esta ficha. El reviewer de QT-316 no
debe leer su desaparición como regresión de QT-315. Si QT-315 aún no está mergeado cuando se integre
esta rama, su `impl_QT-315.md` sigue siendo cierto en su propia rama.

**Si el humano rechaza P4** (conservar `readOrderEvidence` y `countByOrders`): salen las dos últimas
filas de la tabla. `read-order-evidence.test.ts` y el `describe` de `countByOrders` en la integración
no se tocan, y la retirada se anota en `progress/deudas.md`. Nada más cambia.

## 4. UI (frontend_dev)

Ruta `app/(private)/inventario/producto-terminado/[id]/components/`. Sin componente nuevo. El
`page.tsx` no se toca: si su código mencionara «receta», caería en `tests/unit/recetas/scope.test.ts`.

- **`finished-product-list-section.tsx` › `loadEvidenceCounts`** (R1, R3, R4, R13): arma los pares
  `(orderId, orderLineId)` de las filas con pedido y llama a `countLineEvidenceAction` una vez.
  Devuelve `Map<lineId, { photoCount, recipeName }>`. Sin permiso, o si el conteo falla, la columna
  no se pinta, como hoy.
- **`finished-product-batches-table.tsx`** (R1, R2, R3): `EvidenceCounts` pasa a
  `ReadonlyMap<string, { photoCount: number; recipeName: string | null }>` por `lineId`. La celda
  busca por `row.orderLineId`. Sin entrada o con 0, «—».
- **`batch-evidence-button.tsx`**: props nuevas `lineId` y `recipeName`; pasa las dos al diálogo.
- **`batch-evidence-dialog.tsx`** (R6–R11, R20):
  - tercer `PhaseSection` tras Envasado: `name={BATCH_EVIDENCE_TEXTS.conditioning}`,
    `phaseLabel={BATCH_EVIDENCE_TEXTS.conditioningPhase}`, `groups={current.evidence.conditioning}`,
    `testId="batch-evidence-conditioning"`. `PhaseSection` ya devuelve `null` con los grupos vacíos,
    así que un grupo vacío no se pinta (R20). `BATCH_EVIDENCE_TEXTS` gana
    `conditioning: 'Acondicionamiento'` y `conditioningPhase: 'acondicionamiento'`, en minúscula
    como `manufacturingPhase` y `packingPhase`, porque `STEP_EVIDENCE_TEXTS.groupLabel` la mete en
    mitad de una frase. **`components/shared/step-evidence` no cambia**: recibe la fase como texto;
    no tiene lista de fases;
  - se quita el comentario de `OrderEvidence.conditioning` en `order-evidence.ts`, que decía «la
    ficha de producto terminado no lo pinta», porque ya no es verdad;
  - props `lineId` y `recipeName`; lee con `getLineEvidenceAction(orderId, lineId)` (el efecto
    depende también de `lineId`);
  - con `recipeName !== null`, el título suma ` · <recipeName>` y la descripción pasa a
    `BATCH_EVIDENCE_TEXTS.recipeDescription` («Fotos tomadas durante la ejecución de esta receta del
    pedido. Solo consulta.»); con `null`, todo como hoy;
  - `photoCount` es el de la receta: da las casillas esqueleto (R10);
  - el `DialogTitle` gana `break-words [overflow-wrap:anywhere]` para partir palabras largas en el
    teléfono (R11). `BATCH_EVIDENCE_DIALOG_CLASS` no cambia.
- Animación, tablet y estados: los de QC-271 (tablero Movil, ficha).

## 5. Contratos que cambian

| Contrato | Antes | Después | Tipo |
|---|---|---|---|
| `inventario` › `FinishedProductBatchRow` | `orderId` | + `orderLineId: string \| null` | aditivo |
| `asignaciones` › barril | `OrderEvidenceCount`, `createGetOrderEvidence`, `createCountOrderEvidence` y sus `Deps` | − esos cinco; + `LineEvidenceCount`, `createGetLineEvidence`, `createCountLineEvidence` | **no aditivo** (retira) |
| `asignaciones` › `StepEvidenceRepository` (interno) | `countByOrders` | − `countByOrders`; + `countByLines` | **no aditivo**, interno al módulo |
| fachada `asignaciones` (`lib/composition`) | `getOrderEvidence`, `countOrderEvidence` | − esas dos; + `getLineEvidence`, `countLineEvidence` (el total del censo no cambia) | **no aditivo** (retira) |
| `order-evidence-actions.ts` | `getOrderEvidenceAction`, `countOrderEvidenceAction` | − esas dos; + `getLineEvidenceAction`, `countLineEvidenceAction` | **no aditivo** (retira) |
| `pedidos`, `recetas` | — | sin cambios | — |

Lo que se retira no rompe a nadie: el único consumidor era la ficha de producto terminado, que se
cambia en la misma rama (§ 3.5). Es una retirada decidida por el humano (P1), no una conveniencia
del diseño.

## 6. Verificación (R → test)

| R | Test previsto |
|---|---|
| R1 | `tests/unit/inventario-ui/finished-product-batches-evidence.test.tsx`: dos lotes del mismo pedido y distinta línea, cada celda con el conteo de su línea |
| R2 | mismo archivo: línea sin entrada en el mapa → «—» y sin botón, aunque el pedido tenga otra línea con fotos; `count-line-evidence.test.ts`: línea con 0 no sale |
| R3 | mismo archivo: lote sin pedido → «—» |
| R4 | `count-line-evidence.test.ts`: 25 líneas de 10 pedidos → `countByLines`, outlines y nombres una vez cada uno; `finished-product-list-section` (unit de `loadEvidenceCounts` en `finished-product-tables.test.tsx`): una sola llamada a la action |
| R5 | `tests/integration/inventario/finished-product-detail.int.test.ts`: lote con asiento `production` → `orderLineId` de ese asiento; lote sin él → `null`; `tests/unit/inventario/list-finished-product-batches.test.ts`: la fila conserva `orderLineId` |
| R6 | `tests/unit/asignaciones/get-line-evidence.test.ts`: pedido de dos líneas con fotos → solo las de la nombrada; `batch-evidence-dialog.test.tsx`: llama a `getLineEvidenceAction` con `(orderId, lineId)` |
| R7 | `count-line-evidence.test.ts`: dos recetas (una cancelada cuenta) → `recipeName`; `batch-evidence-dialog.test.tsx`: título «Evidencia · Lote L · Pedido N · <receta>» y descripción de la receta |
| R8 | `count-line-evidence.test.ts`: una sola receta viva → `recipeName: null`; `batch-evidence-dialog.test.tsx`: con `null`, título y descripción de hoy |
| R9 | `count-line-evidence.test.ts`: receta que no vuelve del catálogo y línea fuera del outline → `null` |
| R10 | `batch-evidence-dialog.test.tsx`: esqueleto con el `photoCount` de la receta, error con «Reintentar»; `order-evidence-actions.test.ts`: firma caída → `log.warn` con `lineId` y `success` |
| R11 | `batch-evidence-dialog.test.tsx`: el título lleva la clase de partido de palabras y el contenido `BATCH_EVIDENCE_DIALOG_CLASS` |
| R12 | `get-line-evidence.test.ts`: pedido dado de baja, receta borrada del catálogo y línea quitada con fotos → las fotos salen; `count-line-evidence.test.ts`: cuentan |
| R13 | `get-line-evidence.test.ts` y `count-line-evidence.test.ts`: sin `pedidos.consultar` → `UnauthorizedError` sin llamar a ningún puerto; `finished-product-tables.test.tsx`: sin permiso no hay columna ni conteo; `tests/guards/guard-permisos-sembrados.test.ts` sin cambios |
| R14 | `get-line-evidence.test.ts`: pedido ajeno, línea de otro pedido, línea inexistente e ids mal formados → `OrderNotFoundError` sin firmar (`createSignedReadUrls` no llamado en la entrada mal formada y en el pedido ajeno; en la línea ajena no sale ninguna foto) |
| R15 | `count-line-evidence.test.ts`: 26 líneas o id no uuid → `ValidationError` sin llamar; `tests/integration/asignaciones/step-evidence-repository.int.test.ts`: `countByLines` no cuenta filas de otra empresa ni un par con el pedido cambiado |
| R16 | `get-execution-evidence.test.ts` y los casos de `readOrderEvidenceByLine` en `read-order-evidence.test.ts` verdes **sin modificar** (el reviewer mira el diff: los casos que se mudan de `readOrderEvidence` se añaden, ninguno de los de línea cambia); `get-line-evidence.test.ts` comprueba que llama a `readOrderEvidenceByLine` (no hay segunda lectura por línea) |
| R17 | `get-line-evidence.test.ts` y `count-line-evidence.test.ts`: los dobles no exponen escrituras llamadas (`insert`, `replace`, `delete` no llamados) |
| R18 | `tests/guards/guard-identificador-de-request.test.ts` (migraciones y dependencias, sin tocar) y `guard-dependencias-aprobadas.test.ts` |
| R19 | `e2e/consulta-de-evidencia.spec.ts`: caso nuevo «R19 - pedido de dos recetas» (con fotos de las tres fases en la receta A y los tres grupos en su diálogo) |
| R20 | `batch-evidence-dialog.test.tsx`: con fotos de acondicionamiento, la sección `batch-evidence-conditioning` con «Acondicionamiento», sus pasos y su total; sin ellas, la sección no existe; la suma de los totales de las secciones es igual al `photoCount` de la celda; `get-line-evidence.test.ts`: la evidencia trae `conditioning` de la línea |
| R21 | `asignaciones-facade.test.ts` (el censo ya no lista `getOrderEvidence` ni `countOrderEvidence`); `finished-product-route-contract.test.ts` (`LECTURAS_DE_EVIDENCIA` solo admite las de línea); `order-evidence-actions.test.ts` (el módulo ya no exporta las dos actions: `Object.keys` del import); typecheck (los archivos borrados no se importan) |

### Listas cerradas que el cambio toca (se reescriben por P1; no se aflojan)

- `tests/unit/composition/asignaciones-facade.test.ts`: en el censo de la fachada salen
  `countOrderEvidence` y `getOrderEvidence` y entran `countLineEvidence` y `getLineEvidence`. El
  total sigue igual. Lleva un comentario con fecha, QT-316 y P1, y el título del `it` lo nombra. Los
  dos casos «QC-271 R2» (rechazo sin `pedidos.consultar` sin llegar a la base) pasan a las
  operaciones de línea.
- `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts`:
  `LECTURAS_DE_EVIDENCIA` pasa a `getLineEvidenceAction` y `countLineEvidenceAction`, con su
  comentario de fecha y QT-316. Las de hoy salen: la lista sigue cerrada y con dos nombres.
- `tests/unit/identity/session-once-per-request-actions.test.ts`: la entrada de
  `getOrderEvidenceAction` pasa a `getLineEvidenceAction` (`('no-es-un-uuid', 'no-es-un-uuid')`).
  Si el censo exige una entrada por action exportada, entra también `countLineEvidenceAction`.
- `tests/unit/asignaciones/evidence-doubles.ts` y `tests/helpers/evidence-off.ts`: implementan
  `StepEvidenceRepository`. Pierden `countByOrders` y ganan `countByLines`, o el typecheck se pone
  rojo.
- `tests/fixtures/finished-product-detail.ts`: las filas de lote ganan `orderLineId`.
- `tests/fixtures/order-evidence.ts`: `ORDER_EVIDENCE_COUNTS` pasa a `LINE_EVIDENCE_COUNTS`.
- `tests/guards/guard-dobles-e2e.test.ts` cita `specs/QC-271-…/design.md > 4` como prosa y no
  cambia.
- **No se tocan**, comprobado:
  - `tests/unit/recetas/scope.test.ts` y `module-contract.test.ts`: ningún `page.tsx` cambia, la
    pantalla no importa `@/lib/modules/recetas` y ningún archivo nuevo lleva «recipe» o «receta» en
    su ruta. El E2E ampliado ya importa `normalizeRecipeName` hoy, y la lista de E2E de recetas va
    por nombre de archivo.
  - `guard-identificador-de-request`: no nace ningún E2E, ninguna migración ni ningún archivo en
    `ports/`. Borrar dos archivos de `domain/` no le afecta: su barrido de `domain/` exige más de 20
    archivos y hay muchos más.
  - `guard-lote-sin-join`: el adaptador nuevo no usa `include`.

## 7. Alternativas descartadas

1. **Una lectura nueva por línea con `listByLine`, que firma solo las fotos de esa receta.**
   Ahorraría firmar las fotos de las otras recetas del pedido. Se descarta porque la tabla de
   decisiones fija reutilizar `readOrderEvidenceByLine` sin rehacerla. Además, la firma ya es una
   sola llamada para todo el pedido (con el tope por paso, un puñado de rutas), y las URLs de otras
   recetas no salen del dominio.
2. **Que `asignaciones` resuelva la línea desde el lote** (`getBatchEvidence(batchId)`). Obligaría
   a `asignaciones` a consultar el libro de `inventario` con un hueco nuevo, y a `inventario` a
   publicar un puerto o un método para otros módulos. La pantalla ya tiene la fila del lote: basta
   con que la fila traiga la línea (aditivo en `inventario`, cero dependencias nuevas entre módulos).
3. **Nombre de la receta en la lectura del diálogo** (no en el conteo). El título cambiaría al
   terminar de leer (salto visible) y en el error no se sabría la receta. Además, la lectura tendría
   que llamar otra vez al catálogo de recetas por cada apertura.
4. **Ampliar `getOrderEvidence` y `countOrderEvidence` con un `lineId` opcional**, en vez de
   retirarlos y crear los de línea. Mezcla dos contratos en uno: la salida del conteo cambia de
   forma (`{ orderId, photoCount }` no lleva `lineId` ni `recipeName`), y el «sin `lineId`»
   conservaría justo la lectura del pedido entero que P1 manda retirar.
5. **Conservar las lecturas del pedido entero** como código sin consumidor (la recomendación
   inicial de P1). La descartó el humano: el código muerto se puede volver a usar y mezclar otra vez
   las recetas, y los censos lo mantendrían vivo sin motivo.
6. **Contar solo fabricación y envasado** para que la celda cuadre con el diálogo de hoy, en vez de
   pintar el acondicionamiento. Escondería fotos que existen. El humano eligió mostrarlas (P2).
7. **Decidir en la UI si nombrar la receta** (pasar `recipeCount` y que la pantalla compare con 1).
   Duplica la regla de QT-315 R29 en un componente. Se prefiere que el dominio entregue
   `recipeName: null`.

## 8. Dependencias de terceros

Ninguna nueva (tablero Movil, «Librerías: ninguna nueva»).
