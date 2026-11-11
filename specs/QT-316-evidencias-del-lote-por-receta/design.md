# QT-316 — evidencias-del-lote-por-receta · design.md

> **Zona** fullstack · **Complejidad** medium · **Rama** `feature/QT-316-evidencias-del-lote-por-receta`
> (nace de `origin/dev` con `origin/feature/QT-315-planta-con-varias-recetas` mergeada).
>
> Requisitos: `requirements.md` (R1–R19). Preguntas abiertas P1–P3: este diseño sigue la
> recomendación de cada una y marca dónde cambiaría si el humano decide otra cosa.

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
    `readOrderEvidenceByLine` (QT-315: por línea, una sola firma). **Se reutiliza** la segunda.
  - `lib/modules/asignaciones/ports/step-evidence-repository.ts`: `StepEvidenceRow.orderLineId`,
    `listByLine` y `countByOrders`. **Se amplía** con `countByLines`.
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
| `StepEvidence` (`components/shared/step-evidence`, con `EvidenceStepList` y `EvidenceReadError`) | grupos del diálogo, esqueleto y error, sin cambios | 1. Reutiliza |
| `Dialog` (`components/ui/dialog`) | el diálogo, sin cambios | 1. Reutiliza |
| `EMPTY_MARK` (`lib/shared/ui/empty-mark.ts`) | «—» de la celda | 1. Reutiliza |

**No nace ningún componente.** Cambian tres componentes de la ruta
(`batch-evidence-dialog.tsx`, `batch-evidence-button.tsx` y `finished-product-batches-table.tsx`):
reciben la receta, y el diálogo suma la receta al título y la descripción. Ese cambio visual tiene
su pase `/design` aprobado por el humano el 2026-11-11:

- `docs/diseno/canvas/EvidenciaLoteVariasRecetas.dc.html` (escritorio, interactivo: «Varias
  recetas» / «Una receta», rol y estados de fotos);
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
3. **Aditivo.** Nacen dos casos de uso y dos actions; `getOrderEvidence`, `countOrderEvidence`,
   `readOrderEvidence` y `readOrderEvidenceByLine` no cambian (R16; P1).
4. **Sin migraciones, tablas, permisos ni dependencias** (R18).

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
/** Fotos por linea, de todas las fases, como `countByOrders`. Una linea sin fotos, de otro pedido
 *  o de otra empresa no sale. Clave: `lineId`. */
countByLines(
  companyId: string,
  lines: readonly { readonly orderId: string; readonly lineId: string }[],
): Promise<ReadonlyMap<string, number>>;
```

`step-evidence-prisma.ts`: un solo `groupBy` por `['orderId', 'orderLineId']` con
`where: { companyId, orderLineId: { in: lineIds } }`. Se descartan los grupos cuyo `orderId` no es
el del par pedido. Con `lines` vacío no consulta. Mismas fases que `countByOrders` (P2).

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
2. Entrada mal formada → `OrderNotFoundError`, como `getOrderEvidence` (la pantalla no distingue).
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
  - `getOrderEvidenceAction` y `countOrderEvidenceAction` no cambian (P1).
- `lib/composition/index.ts`: `asignaciones.getLineEvidence` (orders = `orderCatalog`, evidence,
  storage) y `asignaciones.countLineEvidence` (evidence, orders, recipes = `recipeCatalog`). Las
  dos operaciones nuevas se añaden al final del bloque de `asignaciones`, sin reordenar nada.

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
- **`batch-evidence-dialog.tsx`** (R6–R11):
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
| `asignaciones` › barril | `OrderEvidence`, `OrderEvidenceCount`… | + `LineEvidenceCount` | aditivo |
| `asignaciones` › `StepEvidenceRepository` (interno) | `countByOrders` | + `countByLines` | aditivo |
| fachada `asignaciones` (`lib/composition`) | 35 operaciones de hoy (las cuenta el censo) | + `getLineEvidence`, `countLineEvidence` | aditivo |
| `order-evidence-actions.ts` | 2 lecturas | + `getLineEvidenceAction`, `countLineEvidenceAction` | aditivo |
| `pedidos`, `recetas` | — | sin cambios | — |

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
| R16 | `read-order-evidence.test.ts` / `get-order-evidence.test.ts` / `get-execution-evidence.test.ts` / `count-order-evidence.test.ts` verdes **sin modificar** (el reviewer mira el diff); `get-line-evidence.test.ts` comprueba que llama a `readOrderEvidenceByLine` (no hay segunda lectura por línea) |
| R17 | `get-line-evidence.test.ts` y `count-line-evidence.test.ts`: los dobles no exponen escrituras llamadas (`insert`, `replace`, `delete` no llamados) |
| R18 | `tests/guards/guard-identificador-de-request.test.ts` (migraciones y dependencias, sin tocar) y `guard-dependencias-aprobadas.test.ts` |
| R19 | `e2e/consulta-de-evidencia.spec.ts`: caso nuevo «R19 - pedido de dos recetas» |

### Listas cerradas que el cambio toca (se amplían, no se aflojan)

- `tests/unit/composition/asignaciones-facade.test.ts`: el censo de la fachada crece con
  `countLineEvidence` y `getLineEvidence` (comentario con fecha y QT-316).
- `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts`:
  `LECTURAS_DE_EVIDENCIA` crece con `getLineEvidenceAction` y `countLineEvidenceAction`. Con P1
  recomendada, las dos de hoy se quedan. Si se retiran, salen de la lista.
- `tests/unit/identity/session-once-per-request-actions.test.ts`: caso de `getLineEvidenceAction`
  (y de `countLineEvidenceAction` si el censo es por action), junto al de `getOrderEvidenceAction`.
- `tests/unit/asignaciones/evidence-doubles.ts` y `tests/helpers/evidence-off.ts`: implementan
  `StepEvidenceRepository`; ganan `countByLines` o el typecheck se pone rojo.
- `tests/fixtures/finished-product-detail.ts`: las filas de lote ganan `orderLineId`.
- **No se tocan**, comprobado:
  - `tests/unit/recetas/scope.test.ts` y `module-contract.test.ts`: ningún `page.tsx` cambia, la
    pantalla no importa `@/lib/modules/recetas` y ningún archivo nuevo lleva «recipe» o «receta» en
    su ruta. El E2E ampliado ya importa `normalizeRecipeName` hoy, y la lista de E2E de recetas va
    por nombre de archivo.
  - `guard-identificador-de-request`: no nace ningún E2E, ninguna migración ni ningún archivo en
    `ports/`.
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
4. **Ampliar `getOrderEvidence` y `countOrderEvidence` con un `lineId` opcional.** Mezcla dos
   contratos en uno: la salida del conteo cambia de forma, `{ orderId, photoCount }` no lleva
   `lineId` ni `recipeName`. Y rompe QT-315 R34 («`getOrderEvidence` devuelve las fotos del pedido
   como en la rama base»).
5. **Decidir en la UI si nombrar la receta** (pasar `recipeCount` y que la pantalla compare con 1).
   Duplica la regla de QT-315 R29 en un componente. Se prefiere que el dominio entregue
   `recipeName: null`.

## 8. Dependencias de terceros

Ninguna nueva (tablero Movil, «Librerías: ninguna nueva»).
