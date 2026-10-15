# QC-284 — lote-por-presentacion · design.md

> El **qué** está en `requirements.md` (R1–R32). Aquí va el **cómo**. Las rutas son las de este
> worktree, una rama sobre `origin/dev` con QC-81, QC-209 y QC-219 mergeadas. Ninguna librería
> nueva.

## Lo que ya existe

**Términos buscados.**

- **Board** (`feature_list.json`, nombre y descripción, todos los estados): «lote», «presentación»,
  «GTIN», «único». Aparecen QC-81, QC-90, QC-91, QC-103, QC-209, QC-219 (`done`), QC-196, QC-197 y
  QC-253 (`pending`). Ninguna cambia la unicidad del lote ni junta las líneas en un formulario.
- **`specs/`**: `company_lot_unique`, `batch_duplicate_lot`, `lot_used_by_other_product`,
  `NULLS NOT DISTINCT`, «único parcial».
- **Código**: grafo (`search_graph` sobre el proyecto de este worktree) para `isDuplicateBatchLot`,
  `findBatchesByLots`, `writeFinishedBatchLabels` y `receiveFinishedGoods`. Grep/Read para
  `\blot\b` en `lib/modules/**` y `app/**`, el esquema y las migraciones.

**Resultado.** Nada resuelve la ficha y nada contradice el alcance fuera de lo que lista «Reabre».
Lo que apareció se reutiliza, se cambia o se sustituye:

| Ref | Qué es | Uso aquí |
|---|---|---|
| QC-81 `product_batches_company_lot_unique` (`@@unique([companyId, lot])`, migración `20260913120000_…`) | unicidad (empresa, código) | **se sustituye** por dos índices únicos parciales (§ 1) |
| QC-81 `isDuplicateBatchLot` (`product-prisma.ts`) | reconoce el `P2002` por las columnas `{company_id, lot}` | **se cambia** a los dos conjuntos nuevos (§ 2.1). Lo usan el alta (`writeBatchWithLotRetry`), la importación (`receiveImportedFinishedGoods`) y los datos de lote (`writeForOrder`) |
| QC-81 `resolveLot` | correlativo por empresa | **no cambia** (R5): sigue leyendo el máximo numérico de toda la empresa |
| QC-81 `BatchDuplicateLotError`, código `batch_duplicate_lot` | error del choque | **se reutiliza**; cambia solo su texto (R8) |
| QC-209 `findBatchesByLots`, `checkLot` (`plan-inventory-import.ts`), `lotClash` (`confirm-inventory-import.ts`), `lot_used_by_other_product` | la importación decide duplicado / error por el código solo | **se cambia** a la clave (§ 3) y el motivo de error **se retira** (R10) |
| QC-219 `FinishedBatchLabels`, `writeFinishedBatchLabels`, `save-conditioning-batch-data.ts`, `ConditioningBatchDataForm`, `saveConditioningBatchDataAction` | datos de lote por línea | **se cambian** a un dato por pedido (§ 4, § 5) |
| QC-219 `conditioning-batch-data.ts` (`missingBatchDataLines`, `hasBatchData`) y `finish-conditioning.ts` | «línea con datos» y la precondición de Terminar | **se reutilizan sin cambio** (R26) |
| QC-92 `adjust-batch-stock.ts`, QC-223/QC-226 `finished-goods-return-prisma.ts` (`BatchLotDirectory.findLots`) | ajuste y devolución | **no cambian**: ya identifican el lote por `id`; el código solo se lee para mostrarlo. Se fijan con tests (R12) |
| `scripts/seed-demo/gateway.ts > saveDemoBatchData` | el seed de demo llama a guardar con `lines` | **se adapta** a la entrada nueva |
| `Notice` (`components/shared/notice.tsx`, fila del catálogo con tablero `Avisos.dc.html`) | aviso en línea con tono | **se reutiliza** (paso 1 de la regla de decisión) para el aviso de R15, tono `warning` |
| `Input`, `Label`, `Button`, `ErrorAlert` (filas de `CATALOGO.md`) | campos, botón y error | **se reutilizan** (paso 1), como ya hace el formulario |
| Tablero `docs/diseno/canvas/Acondicionamiento.dc.html` (y `…Movil`, `…Tablet`) | el detalle de acondicionamiento | **ya pinta un solo** «Lote» / «Vencimiento» en la sección «Datos de lote»: el formulario de esta ficha es el del tablero aprobado |
| QC-253 (`pending`) | lote de una línea sin producción | **no entra**: una línea sin lote sigue sin lote y sigue bloqueando Terminar (R17, R23, R26) |

**Sobre la UI.** No hay componente nuevo. `ConditioningBatchDataForm` es un componente de ruta que
cambia de N bloques a uno y compone solo piezas catalogadas (`Input`, `Label`, `Button`,
`ErrorAlert`, `Notice`). El tablero aprobado `docs/diseno/canvas/Acondicionamiento.dc.html` ya
muestra la sección con un único juego de campos. El aviso es un `Notice` `warning`, también de
tablero aprobado (`Avisos.dc.html`). Es la excepción de `docs/perfil-agentes.md > Pase de diseño`
(«solo compone piezas ya catalogadas»), y por eso no se pide un `/design` nuevo.

**Postgres.** CI usa `postgres:17`; la base local documentada en `progress/` es 16.1. Los índices
parciales funcionan en las dos.

## 1. Modelo de datos

### 1.1 Los índices (la presentación vacía, D10)

`product_batches.presentation_id` es anulable. Hoy, de verdad, **solo los lotes de producto
terminado** la llevan: el alta de insumos, envases e instrumentos escribe `presentationId: null`
(`create-product.ts > createSupply`, `createPackaging`). Un `UNIQUE (company_id, product_id,
presentation_id, lot)` normal dejaría pasar dos lotes iguales sin presentación, porque Postgres
trata cada `NULL` como distinto. Se resuelve con **dos índices únicos parciales**, escritos a mano:

```sql
CREATE UNIQUE INDEX "product_batches_product_presentation_lot_unique"
  ON "product_batches" ("company_id", "product_id", "presentation_id", "lot")
  WHERE "presentation_id" IS NOT NULL;

CREATE UNIQUE INDEX "product_batches_product_lot_unique"
  ON "product_batches" ("company_id", "product_id", "lot")
  WHERE "presentation_id" IS NULL;
```

- R1 lo cubre el primero; R2, el segundo.
- **`company_id` delante** aunque `product_id` ya implica la empresa (el disparador
  `product_batches_check_company` lo exige). Las lecturas de lotes filtran siempre por empresa
  primero (`batchCompanyScope`), y así R4 («dos empresas pueden repetir») se ve en el propio índice.
- **Consecuencia** (R3, último punto): un lote con presentación y otro sin ella del mismo producto
  caen en índices distintos y pueden compartir código. Hoy no ocurre: un producto tiene todos sus
  lotes con presentación (terminado) o todos sin ella (los demás). Se deja escrito porque es la
  lectura literal de «sin presentación, único por producto».
- **El correlativo** (`resolveLot`) filtra por `company_id` y una expresión regular. Lo sigue
  sirviendo `product_batches_company_id_idx`, que ya existe. No hace falta índice nuevo.
- **La búsqueda por código de la importación** (`lot IN (…)` dentro de la empresa) también va por
  `product_batches_company_id_idx`. Las empresas tienen cientos de lotes, no millones; si eso
  cambia, un índice no único `(company_id, lot)` se añade sin tocar la regla.
- **RLS:** `product_batches` sigue con `ENABLE` + `FORCE` y sin policies. No cambia.

**`db/schema.prisma`.** Prisma no modela índices parciales. Se **quita**
`@@unique([companyId, lot], map: "product_batches_company_lot_unique")` y se reescribe el comentario
del modelo que dice que `companyId` existe «porque la unicidad `(company_id, lot)` no puede indexar
otra tabla»: ahora la unicidad vive en dos índices parciales de la migración, son drift, y
`companyId` sigue por el disparador y el aislamiento. Ningún código usa la clave compuesta
`companyId_lot` de Prisma (buscado: sin apariciones en `lib/`, `app/`, `tests/`, `e2e/`,
`scripts/`).

### 1.2 Migración `db/migrations/20261014200000_product_batches_lot_per_presentation/` (orden, D10)

**`migration.sql`**, escrita a mano:

1. `CREATE UNIQUE INDEX "product_batches_product_presentation_lot_unique" …`
2. `CREATE UNIQUE INDEX "product_batches_product_lot_unique" …`
3. `DROP INDEX "product_batches_company_lot_unique";`

- **Por qué primero crear y luego quitar** (R28): los índices nuevos son **más débiles** que el
  viejo. Todo dato que cumple (empresa, código) cumple también (empresa, producto, presentación,
  código), así que crearlos no puede fallar por datos. Y no hay ningún instante sin unicidad:
  si la migración se corta entre 2 y 3, la tabla tiene las tres garantías, y la vieja manda.
- **No toca filas** (R28): solo DDL. `CREATE INDEX` no pasa por la RLS, así que no hace falta el
  paréntesis `NO FORCE`/`FORCE` del UP de QC-81.
- **Sin `CONCURRENTLY`**: no puede ir dentro de la transacción de la migración, y la tabla es
  pequeña. El bloqueo de escritura dura lo que tarda en construirse el índice.

**`down.sql`**:

1. `ALTER TABLE "product_batches" NO FORCE ROW LEVEL SECURITY;` (el paso 2 lee filas).
2. `DO $$ … $$`: cuenta los códigos repetidos dentro de una empresa
   (`GROUP BY company_id, lot HAVING count(*) > 1`). Si hay alguno, `RAISE EXCEPTION` con cuántos
   códigos y cuántas filas, y la instrucción: «renombra esos lotes antes de revertir; tras esta
   migración la empresa puede tener el mismo código en varios productos» (R29). Es el mismo patrón
   que el aborto de QC-81 R21.
3. `CREATE UNIQUE INDEX "product_batches_company_lot_unique" ON "product_batches" ("company_id", "lot");`
4. `DROP INDEX "product_batches_product_lot_unique";`
5. `DROP INDEX "product_batches_product_presentation_lot_unique";`
6. `ENABLE` + `FORCE ROW LEVEL SECURITY`.

El orden es el mismo razonamiento al revés: el viejo, que es el estricto, se crea primero y es el
que puede fallar. Si falla, nada se ha quitado.

- El nombre de la migración entra en la lista de migraciones conocidas de
  `tests/guards/guard-identificador-de-request.test.ts`.
- **Timestamp.** La última de `dev` es `20261014180000_admin_without_assigned_orders_view`. Si al
  sincronizar (F2.3) aparece una posterior, se sube el timestamp y se corrige
  `tasks.md > Archivos esperados`.

## 2. `inventario`: escrituras de lotes

### 2.1 `isDuplicateBatchLot` (`product-prisma.ts`)

Hoy compara `meta.target` con el conjunto exacto `{company_id, lot}` (con `@prisma/client` 6.19
`meta.target` trae columnas, no el nombre del índice; QC-38 y QC-81 lo midieron). Pasa a aceptar
**exactamente uno de dos** conjuntos:

- `{company_id, product_id, presentation_id, lot}`;
- `{company_id, product_id, lot}`.

Sigue siendo «conjunto exacto y no contiene», por el mismo motivo de hoy: un índice único nuevo sin
mapear no debe anunciarse como lote duplicado. **Hay que medirlo contra base real** con los índices
parciales: si Prisma no rellenara `meta.target` para un índice parcial, el reconocimiento pasa a
`meta.constraint` / nombre del índice en el mensaje, como `isBatchCompanyScopeViolation`. El test
de integración de R6 lo fija en los dos índices.

Con eso, el alta (`writeBatchWithLotRetry`), la importación (`receiveImportedFinishedGoods`) y la
carrera de los datos de lote (`writeForOrder`) siguen igual: R6 y R7 salen del índice, sin código
nuevo en esos caminos.

### 2.2 `FinishedBatchLabels` (contrato, `finished-batch-labels.ts`)

```ts
/** Los tres datos van juntos: un dato guardado no se borra, solo se sustituye. */
export type FinishedBatchLabel = {
  readonly lot: string;
  readonly expiryDate: string;      // 'AAAA-MM-DD'
  readonly productionDate: string;  // 'AAAA-MM-DD'
};

export type FinishedBatchLabelsOutcome =
  | { readonly kind: 'written' }
  | { readonly kind: 'no_batches' }
  | { readonly kind: 'duplicate_lot'; readonly batchId: string | null };

export interface FinishedBatchLabels {
  listOfOrder(companyId: string, orderId: string): Promise<readonly FinishedBatchOfOrderLine[]>; // sin cambio
  /** El mismo dato en todos los lotes de produccion del pedido. Todo o nada, en su transaccion. */
  writeForOrder(input: {
    readonly companyId: string;
    readonly orderId: string;
    readonly label: FinishedBatchLabel;
    readonly actorId: string;
    readonly now: Date;
  }): Promise<FinishedBatchLabelsOutcome>;
}
```

- `labels: FinishedBatchLabel[]` con `batchId` pasa a `label` único. **El conjunto de lotes lo
  decide el servidor**, no la entrada: no hay forma de escribir en una línea sí y en otra no (D3).
- `batch_not_found` deja de existir en el contrato (no viajan ids); lo sustituye `no_batches` (R23).

### 2.3 `writeFinishedBatchLabels(tx, input, scope)` (`product-prisma.ts`)

1. **Lee y bloquea** los lotes de producción del pedido, como hoy: `SELECT … FOR UPDATE` de
   `product_batches` con asiento `production` del pedido, en la empresa. Ahora también trae
   `product_id` y `presentation_id`. Sin filas → `{ kind: 'no_batches' }` (R23).
2. **Choque previo** (R21). Una sola consulta: ¿existe en la empresa un lote `o` con
   `o.lot = label.lot`, `o.product_id = b.product_id`,
   `o.presentation_id IS NOT DISTINCT FROM b.presentation_id` y `o.id <> b.id`, para algún `b` de
   los bloqueados? Si sí → `{ kind: 'duplicate_lot', batchId: b.id }`. Se excluyen solo los propios
   lotes: un lote de otra línea del mismo pedido tiene otro producto (el producto terminado es por
   receta + presentación, y la línea es única por presentación,
   `order_presentation_lines_order_id_presentation_id_key`), así que no cae en la condición.
3. **Escribe** el mismo `lot`, `expiryDate`, `productionDate`, `updatedBy`, `updatedAt` en cada lote
   bloqueado, con `tx.productBatch.update` por `id` y empresa, como hoy. No toca `stock` ni asientos
   (R18).
4. **Carrera** (R22): el `P2002` de cualquiera de los dos índices sale como excepción, deshace la
   transacción y `writeForOrder` lo traduce a `{ kind: 'duplicate_lot', batchId: null }`.

**Por qué `IS NOT DISTINCT FROM`** y no `=`: hoy los lotes de producción siempre tienen
presentación, pero la regla de la base es de dos índices (§ 1.1) y la comprobación previa debe
decir lo mismo que ellos en el caso sin presentación.

Las guardias del libro (`guard-libro-de-inventario.test.ts`, `qc91-alcance.test.ts`) ya admiten
`writeFinishedBatchLabels` por nombre (QC-219 R27). Sigue sin escribir `stock`, así que no cambian;
el nombre de la función se conserva a propósito.

## 3. `inventario`: importación (R9–R11)

### 3.1 Lectura

`InventoryImportRepository.findBatchesByLots` devuelve también `presentationId`:

```ts
findBatchesByLots(lots, scope): Promise<readonly { lot: string; productId: string; presentationId: string | null }[]>;
```

`ImportCatalogSnapshot.batches` gana el mismo campo.

### 3.2 `plan-inventory-import.ts`

- `PlanState.batchesByLot: Map<lot, productId>` pasa a `batchKeys: Set<string>` con la clave
  `productId + presentationId + lot` (función pura `batchKeyOf(productId, presentationId, lot)`,
  con un separador que no puede aparecer en un uuid ni se confunde con `null`).
- **`checkLot`** se reescribe:
  - si la fila apunta a un producto **existente** y la clave (producto, presentación del lote que
    escribiría la fila, código) está en `batchKeys` → `duplicate` (R9);
  - si una **fila anterior** del archivo escribió el mismo código con la misma identidad
    (`identity.key`, que ya incluye la presentación en envases y terminados) → `duplicate`, como hoy;
  - en cualquier otro caso → nada: la fila sigue su plan (`create` / `add_batch`) (R10).
- **La presentación del lote de una fila**: terminado → la presentación de la fila; insumo, envase e
  instrumento → `null`. Es exactamente lo que escriben los caminos de alta (`finishedWrite`,
  `createSupply`, `createPackaging`), así que la vista previa no puede prometer una clave distinta
  de la que se escribe.
- `lot_used_by_other_product` **se retira** de `IMPORT_ROW_ISSUE_CODES`
  (`inventory-import-contract.ts`), de sus textos y de sus dos usos. Es un catálogo cerrado; quitar
  un código que ya no puede producirse es lo que pide R10.

### 3.3 `confirm-inventory-import.ts > lotClash`

Hoy relee por código y decide `duplicate` (mismo producto) o `lot_used_by_other_product`. Con la
regla nueva, un choque contra el índice solo puede ser con la **misma clave**, así que `lotClash`
devuelve `duplicate` sin releer (R11). Se conserva el `write_failed` para el lote nulo, como hoy.

## 4. `asignaciones`: guardar los datos de lote

### 4.1 `save-conditioning-batch-data.ts`

```ts
export const saveConditioningBatchDataSchema = z.strictObject({
  orderId: z.string().uuid(),
  lot: typedLotSchema,
  expiryDate: civilDateSchema,
  productionDate: civilDateSchema,
});
```

Pasos, y el orden es requisito (R24):

1. `requirePermission(actor, 'acondicionamiento.modificar')`.
2. `safeParse` → `ValidationError` (R19).
3. El pedido, **sin cambio** respecto a QC-219 § 3.1 paso 3.
4. Las fechas contra `civilDayUtc(now)`, sin cambio de criterio (R20). Los errores dejan de llevar
   `batchId`.
5. `batches.writeForOrder({ companyId, orderId, label: { lot, expiryDate, productionDate }, actorId, now })`:
   - `no_batches` → `ConditioningBatchNotFoundError` (`batch_not_found`, R23);
   - `duplicate_lot` → `ConditioningBatchDuplicateLotError` (R21, R22).

`firstDuplicateLot` desaparece: ya no hay dos líneas en la entrada.

### 4.2 Server Action (`order-conditioning-actions.ts`)

| Acción | Entrada (`FormData`) | Éxito | Error |
|---|---|---|---|
| `saveConditioningBatchDataAction(prev, fd)` | `orderId`, `lot`, `expiryDate`, `productionDate` (un valor cada uno) | `revalidatePath(conditioningOrderRoute(id))` → `{ status: 'success' }` | `ErrorState` |

- Se retiran `textValues`/`getAll` y el `batchId` del estado de error. El campo culpable lo deduce el
  formulario por el código (R25), así que la acción no necesita saber de campos.
- `finishConditioningAction` y `finish-conditioning.ts` **no cambian** (R26).

### 4.3 El detalle (`conditioning-order-view.ts`, `get-conditioning-order.ts`)

`ConditioningBatchData` gana un campo; `lines` y `missingCount` no cambian (los usan Terminar, el
aviso de faltantes y el seed):

```ts
export type ConditioningBatchForm =
  | { readonly kind: 'empty' }                                     // pedido sin datos (R14)
  | { readonly kind: 'shared'; readonly lot: string; readonly expiryDate: string; readonly productionDate: string } // uniformes (R14)
  | { readonly kind: 'divergent'; readonly lines: readonly { readonly presentationId: string; readonly lot: string | null }[] } // R15
  | { readonly kind: 'no_batches' };                               // R17

export type ConditioningBatchData = {
  readonly lines: readonly ConditioningBatchLineView[];
  readonly missingCount: number;
  readonly form: ConditioningBatchForm;
};
```

- `form` lo calcula una función pura nueva, `batchDataForm(lines, batches)`, en
  `conditioning-batch-data.ts`, junto a `missingBatchDataLines`, con las definiciones del
  vocabulario de `requirements.md`.
- En `divergent`, `lot` es el código **actual** del lote de cada línea (con datos o provisional);
  `null` = la línea no tiene lote. Va en el orden de alta de las líneas.
- Leer el detalle no escribe nada (R16): `get-conditioning-order.ts` solo usa `listOfOrder`.

## 5. Pantalla

### 5.1 `conditioning-batch-data-form.tsx` (componente de ruta, se reescribe)

- Props: `{ orderId, form: ConditioningBatchForm, divergentLabels }`. `divergentLabels` son las
  líneas ya escritas como en el reparto (`<envases> × <envase o presentación>`), compuestas por la
  pantalla de servidor como hoy.
- Un `<form>` con `orderId` oculto y **tres** `Input` (`text`, `date`, `date`) con sus `Label`, en
  `text-base` y `min-h-11` (QC-219 R5). Una columna en móvil, tres desde `md:`.
- Valores iniciales: los de `shared`, o vacíos (R14, R15).
- Con `divergent`, un `Notice tone="warning"` encima de los campos:
  - título «Hoy las líneas tienen lotes distintos.»;
  - cuerpo: una lista `<ul>` con `<línea>: <lote>` (o «sin lote») por línea, y la frase «Al guardar,
    el lote, el vencimiento y el día de producción pasan a todas las líneas.».
- Con `no_batches`, los tres campos y el botón `disabled` (R17).
- Error: `ErrorAlert` como hoy (R25). `aria-invalid` + `aria-describedby` solo en el campo del mapa
  `{ batch_duplicate_lot: 'lot', batch_expiry_not_future: 'expiryDate',
  batch_production_date_future: 'productionDate' }`.
- Desaparecen los `<fieldset>` por línea, la nota «Lote provisional: X.» y el `required`
  condicional por línea: los tres campos son `required` siempre (solo ayuda; la frontera es el
  caso de uso).
- Se conservan los `data-testid` de sección, formulario, botón y error; se retiran los de línea y
  provisional y nace `conditioning-batch-data-divergent` para el aviso.

### 5.2 `conditioning-order-screen.tsx`

Pasa `order.batchData.form` y las etiquetas de las líneas al formulario. El aviso de faltantes y
`finishBlocked` no cambian.

### 5.3 Textos (se aprueban con el spec)

| Clave | Texto |
|---|---|
| título del aviso | «Hoy las líneas tienen lotes distintos.» |
| cierre del aviso | «Al guardar, el lote, el vencimiento y el día de producción pasan a todas las líneas.» |
| línea sin lote en el aviso | «sin lote» |
| `errors.batch_duplicate_lot` | `'Ya existe un lote con ese valor para ese producto y presentacion.'` (R8) |

## 6. Propuestas que se aprueban con el spec

| # | Propuesta | Dónde |
|---|---|---|
| N1 | Presentación vacía: dos índices únicos parciales; un lote con y otro sin presentación del mismo producto pueden compartir código (§ 1.1) | R2, R3 |
| N2 | El formulario vacío con aviso vale en `EN_ACONDICIONAMIENTO`, `TERMINADO` y `ENTREGADO`, no solo desde «Terminados»: es el mismo formulario, y un pedido en curso puede haber quedado con datos a medias antes de esta ficha | R15 |
| N3 | Sin la nota «Lote provisional: X.»: con un solo campo no hay un provisional que mostrar, y el tablero aprobado no la pinta. QC-219 N1 (campo vacío, no relleno con el automático) se mantiene | R14 |
| N4 | El aviso lista el código actual de cada línea, sea el escrito o el provisional, porque es el que hoy está en el inventario | R15 |
| N5 | Un pedido sin ninguna línea con lote: formulario deshabilitado y `batch_not_found` si se fuerza el envío | R17, R23 |
| N6 | `lot_used_by_other_product` se retira del catálogo cerrado de motivos de la importación | R10 |
| N7 | Texto nuevo de `batch_duplicate_lot` (§ 5.3) | R8 |

## 7. Autorización y aislamiento

- Guardar sigue exigiendo el permiso en su primera línea y que el actor sea quien acondiciona
  (QC-219 R13, R14): los pasos 1 y 3 de § 4.1 no cambian.
- Las tres lecturas nuevas (la clave en la importación, el choque previo y los lotes bloqueados)
  filtran por la empresa del ámbito. Un producto es de una sola empresa, así que «el mismo producto
  en otra empresa» no existe: el test de integración de R4 y el de R21 escriben el mismo código, con
  un producto y una presentación análogos, en una segunda empresa, y comprueban que no choca.
- `tests/unit/identity/roles/acondicionamiento-rol.test.ts` no cambia: los mismos casos de uso
  exigen el permiso.

## 8. Alternativas descartadas

1. **Un solo índice con `NULLS NOT DISTINCT`** (`UNIQUE (company_id, product_id, presentation_id,
   lot) NULLS NOT DISTINCT`). Es una línea en vez de dos y no deja compartir código entre un lote
   con presentación y otro sin ella. **Descartado** por el mismo motivo que en QC-76 (`specs/QC-76-…
   /design.md > 7 (b)`): depende de Postgres ≥ 15, Prisma 6 tampoco lo modela, y el repo ya tiene el
   patrón de únicos parciales escritos a mano (`units_*_unique`, `companies_name_unique`).
2. **Índice de expresión con `COALESCE(presentation_id, '00000000-…')`**. Una sola restricción y
   ningún `NULL`. **Descartado**: mete un uuid mágico en la base, y el `P2002` de un índice de
   expresión no trae columnas en `meta.target`, así que `isDuplicateBatchLot` tendría que decidir
   por el nombre en el texto del error.
3. **Rellenar `presentation_id` en todos los lotes** (insumos y envases con la presentación de su
   producto) y hacer la columna `NOT NULL`. **Descartado**: los instrumentos no tienen
   presentación, y es una migración de datos que nadie ha pedido y que cambia lo que ve
   `/inventario`.
4. **Mantener los datos por línea en el contrato** (`labels` con `batchId`) y que el formulario
   envíe la misma terna N veces. **Descartado**: dejaría al cliente decidir a qué líneas escribe, y
   D3 dice que no se cambian por línea. Con `label` único y los lotes elegidos por el servidor, esa
   regla la garantiza el caso de uso.
5. **Quitar el viejo índice antes de crear los nuevos.** Más corto de leer, pero abre un instante
   sin unicidad si la migración se corta entre los dos pasos (R28).
6. **Un componente nuevo de «formulario de lote compartido»** en `components/shared`. **Descartado**
   por la regla de decisión: solo lo usa esta ruta, y se resuelve componiendo piezas catalogadas.

## 9. Lo que se sustituye de specs mergeados (se aprueba con el spec)

**QC-81** (`specs/QC-81-lote-y-fecha-de-compra/requirements.md`):

- **D2** («¿unicidad global o por empresa? → por empresa») y **R11**: la unicidad pasa a la clave
  producto + presentación + código (R1, R2). Lo que sigue en pie de D2 es «dos empresas pueden
  repetir» (R4).
- **R13**: el choque del alta es por la clave, no por el código en la empresa (R7).
- **R16** y **D6** **no** cambian: el correlativo sigue por empresa (R5).
- El texto del catálogo para `batch_duplicate_lot` aprobado en su `design.md > 7.2` cambia (R8).

**QC-219** (`specs/QC-219-datos-de-lote-en-acondicionamiento/requirements.md`):

- **D2** («uno por línea de presentación») → un formulario por pedido (R13, R18).
- **D3** («único en la empresa») → único por la clave (R21, R22).
- **R1, R2** (bloque por línea, nota del provisional) → R13, R14, R15.
- **R5**, solo en la marca `aria-invalid` del bloque culpable → R25.
- **R6, R7** (escritura y entrada por línea) → R18, R19.
- **R10, R11** (choque en la empresa) → R21, R22.
- **R12** (`batchId` ajeno) → R23.
- **R28** (E2E) → R30.
- **Siguen en pie**: R3, R4, R8, R9, R13–R17 (Terminar), R18–R27 salvo lo dicho.

**QC-209** (`specs/QC-209-importar-inventario-desde-excel/requirements.md`): **R18** se precisa
(la clave incluye la presentación) y **R19** se sustituye (R9, R10). Fila **D7** de QC-209 («mismo
producto y mismo código de lote») queda igual en la práctica, porque la presentación del lote la
fija el producto.

**Tests existentes que cambian:**

- `tests/unit/inventario/schema/inventario-schema.test.ts` (el `@@unique` de lote);
- `tests/unit/inventario/product-batch-lot-retry.test.ts` (columnas del `P2002`);
- `tests/integration/inventario/product-batch-lot.int.test.ts` (R11/R13 de QC-81 pasan a la clave);
- `tests/unit/inventario/plan-inventory-import.test.ts`, `confirm-inventory-import.test.ts`,
  `preview-inventory-import.test.ts`, `inventory-import-kit.ts`;
- `tests/integration/inventario/inventory-import-*.int.test.ts` que esperan
  `lot_used_by_other_product`;
- `tests/unit/asignaciones/save-conditioning-batch-data.test.ts`, `get-conditioning-order.test.ts`,
  `conditioning-batch-data.test.ts`, `order-conditioning-actions.test.ts`;
- `tests/integration/inventario/finished-batch-labels.int.test.ts`,
  `tests/integration/asignaciones/finish-conditioning-batch-data.int.test.ts`;
- `tests/unit/asignaciones-ui/conditioning-batch-data-form.test.tsx`,
  `conditioning-order-screen.test.tsx`, y la paridad
  `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx` con su snapshot;
- `tests/unit/errores/catalogo.test.ts` (texto de R8).

`tests/unit/inventario/schema/product-batch-lot-migration.test.ts` lee la migración de QC-81, que
no se toca: no cambia.

**E2E existente:** `e2e/datos-de-lote-en-acondicionamiento.spec.ts` se reescribe al recorrido de
R30. Su caso «el lote de otro producto choca» es justo lo que esta ficha deroga.

**Cruces posibles.** En el checkout principal hay cambios sin commitear en
`lib/modules/inventario/domain/plan-inventory-import.ts`, `inventory-import-contract.ts` y
`app/(private)/inventario/importar/components/import-texts.ts` (estado de git del 2026-10-14). Si
son de una ficha en vuelo, chocan con § 3; lo detecta `scripts/archivos-en-vuelo.mjs` en F2.0.
QC-281 (`envases-reales-al-terminar-empaque`, worktree abierto) puede tocar `product-prisma.ts`.

**`docs/architecture.md`:** al cerrar, si alguna sección habla de «lote único en la empresa», se
corrige a la clave. Hoy no se encontró ninguna (buscado `lote … únic` en `docs/`).

## 10. Dependencias de terceros

Ninguna (R31). `zod`, Prisma, `Notice`, `Input`, `Label`, `Button` y `ErrorAlert` ya están.
