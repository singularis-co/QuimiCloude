# QC-203 — agrupar-insumos-por-familia-de-unidad · design.md

## Lo que ya existe

**Buscado** (2026-10-14, F1.2): `familia de unidad`, `homónimo`/`homonimo`, `nombre + unidad`,
`misma familia`, `convert`, `materia prima sin unidad`.

| Dónde | Qué apareció | Qué se hace con ello |
|---|---|---|
| Board (`feature_list.json`) | QC-195 (done, familia `baseUnitId ?? id` para envases del pedido), QC-199 (done, homónimo por nombre + unidad), QC-204 (conversión pedido → insumo), QC-205 (unicidad en base, aparte), QC-209 (done, importación Excel), QC-121 y QC-159 (done). Ninguna agrupa el alta por familia. | Se reutiliza su código (abajo). QC-205 sigue aparte (`[D11]`). |
| Specs | `misma familia` solo aparece en otros sentidos (QC-49, QC-81: «familia» de errores o de bloqueos). | Nada que reutilizar. |
| Código | `convertQuantity` (`lib/modules/unidades/domain/convert-quantity.ts`), exacta, publicada por el contrato de `unidades`. | Se usa para cantidad, costo y comparación (`[D3]`). |
| Código | `effectiveBaseId` privada en `convert-quantity.ts:93`; el mismo criterio repetido sin helper en `convert-with-approximation.ts:12`, `get-assigned-order-execution.ts:36`, `compatible-unit-ids.ts:16`, `unit-prisma.ts:228`. | Se **publica** la de `convert-quantity.ts` como `unitFamilyId` (§3.1). Las otras cuatro copias no se tocan en esta ficha (son de otros módulos y otras fichas). |
| Código | `UnitRef` ya trae `baseUnitId` y `factor`; `listVisibleRefs` y `findRefs` del `UnitCatalog`. | El formulario ya recibe `formUnits: UnitRef[]`; el servidor pide `findRefs`. |
| Código | `deriveUnitCost` (`inventario/domain/unit-cost.ts`, QC-52). | Deriva el unitario sobre la existencia convertida (`[D7]`). |
| Código | `createCreateProduct` → `createSupply` → `findAliveIdByNameInUnit` + `addOrCreate` (`create-product.ts`). | Se cambia la búsqueda del homónimo (§4). `addOrCreate` y `addBatchToAlive` se reutilizan. |
| Código | `planInventoryImport` / `resolveIdentity` (`plan-inventory-import.ts:451-461`) y `confirmInventoryImport`, que escribe cada fila con `createProduct` (`confirm-inventory-import.ts:112`). | La confirmación hereda la regla del alta; la vista previa se adapta (§7). |
| Código | `suggestUnitId` (`documentos/domain/suggest-unit.ts`), ya usada por la revisión de catálogo (`catalog-import-review.tsx:232`). | Sugiere la unidad de la materia prima nueva (`[D10]`). |
| Código | `confirmFormulaImport` (R25/R26 de QC-159) y `createCreateRawMaterial` (sin unidad). | Se enmiendan (§8). |

**Catálogo de componentes consultado** (`components/shared/CATALOGO.md`):

| Fila | Uso | Paso de la regla de decisión |
|---|---|---|
| `Notice` (`components/shared/notice.tsx`) | Aviso de conversión, tono `info`, `role="status"`, entrada `qc-rise`. | 1 — reutiliza tal cual. |
| `PresentationUnitSelect` (`components/shared/presentation-unit-select.tsx`) | Selector «Unidad» del alta (ya lo usa) y de la materia prima nueva. | 2 — se **extiende** con la prop opcional `hint` (ayuda visible bajo el campo, enlazada por `aria-describedby`). Hoy `helper` es un tooltip y los tableros piden texto visible. Los usos actuales no cambian. Se anota en su fila. |
| `FieldError` (`components/shared/field-error.tsx`) | Error bajo «Existencia», «Costo unitario» y «Unidad» (ya lo pintan `ProductField`, `ProductCostFields` y `PresentationUnitSelect`). | 1 |
| `Sheet` (`components/ui/sheet.tsx`) | Panel «Nuevo producto», sin cambios. | 1 |
| `SharedSelect` | Descartado para la unidad de la fórmula: el tablero pide «el mismo selector de Nuevo producto», que es `PresentationUnitSelect`. | — |
| `Alert` | Descartado: no tiene tono `info` ni animación de entrada; `Notice` sí. | — |

**Componentes nuevos**: dos internos de la ruta `inventario` que solo componen piezas catalogadas
(`supply-conversion-notice.tsx`, que compone `Notice`, y el hook `use-supply-homonyms.ts`). Paso 3
de la regla. No suben a `components/shared`: solo los usa una ruta.

**Tableros aprobados** (pase `/design` aprobado por el humano el 2026-10-14):

- `docs/diseno/canvas/AltaConversion.dc.html`, `docs/diseno/canvas/AltaConversionTablet.dc.html`,
  `docs/diseno/canvas/AltaConversionMovil.dc.html` — aviso de conversión en «Nuevo producto»
  (estados convierte, varios, cantidad-no-cabe, costo-no-cabe, sin-homónimo y guardado).
- `docs/diseno/canvas/ImportarFormulaUnidad.dc.html`,
  `docs/diseno/canvas/ImportarFormulaUnidadTablet.dc.html`,
  `docs/diseno/canvas/ImportarFormulaUnidadMovil.dc.html` — campo «Unidad» obligatorio en la fila
  «Crear materia prima» (sugerida, sin coincidencia, sin unidad en el PDF, elegida a mano, confirmar
  con alguna vacía y resumen).

Ninguno introduce un componente nuevo ni una librería nueva (`@base-ui/react` y `lucide-react` ya
están).

**La importación desde Excel no cambia visualmente**: la vista previa ya pinta `sumar lote` y
los motivos de error como texto. Solo hay dos motivos nuevos (§7), así que no necesita tablero.

## 1. Resumen

La identidad de un insumo pasa de «nombre + unidad» a «nombre + familia». Toda la regla vive en
**dos funciones puras** de `inventario` (§3), publicadas por su contrato, que es seguro para el
cliente. Las usan los mismos sitios: el alta en el servidor (§4), el aviso en el navegador (§5) y
la vista previa del Excel (§7). Así lo que el aviso anuncia y lo que el servidor escribe sale del
mismo código. La materia prima de fórmula gana unidad y su homónimo se busca por familia (§8).

## 2. Modelo de datos

- **Sin migración.** Sin tablas, columnas, índices ni restricciones nuevas (`[D4]`, `[D11]`). La
  familia se deriva de `units.base_unit_id` en cada consulta. No se guarda.
- **RLS sin cambios**: no hay tabla nueva. La frontera de empresa sigue en el caso de uso
  (`docs/architecture.md > Acceso a datos y autorizacion`). Toda consulta nueva lleva el ámbito de
  empresa y su test de acceso cruzado.
- Columnas que se leen: `products.name_normalized`, `unit_id`, `stock` (suma de lotes),
  `type`, `created_at`, `id`, `deleted_at`, `company_id`; `units.base_unit_id`, `factor`.
- Columnas que se escriben: las de siempre de `product_batches` (`stock` y `unit_cost` ya
  convertidos) y, en la materia prima de fórmula, `products.unit_id`, que `products.create` no
  escribía hasta ahora (§8.3).
- Precisión: `Decimal(14,4)`, siempre como texto en el dominio, nunca `number` (`[D13]`).

## 3. Dominio puro

### 3.1 `unidades`: publicar la familia

`convert-quantity.ts` pasa a exportar `unitFamilyId(unit: Pick<UnitConversion, 'id' | 'baseUnitId'>): UnitId`
(hoy `effectiveBaseId`, privada) y la usa por dentro. El barrel `lib/modules/unidades/index.ts` la
reexporta. Es la **única** definición de familia que usa esta ficha (`[D2]`: «se reutiliza, no se
duplica»).

### 3.2 `inventario/domain/supply-family.ts` (nuevo, puro)

```ts
export type SupplyHomonym = {
  readonly id: string;
  readonly name: string;
  readonly type: ProductType;
  readonly unitId: UnitId;
  readonly stock: string;          // texto decimal
};

export type SupplyTarget = {
  readonly target: SupplyHomonym;
  /** Los homónimos de la familia, en el orden recibido (antigüedad). */
  readonly family: readonly SupplyHomonym[];
};

/** `candidates` llega ordenado por created_at, id ascendentes. `units` contiene la unidad del
 *  alta y las de los candidatos (UnitRef o UnitConversion). Devuelve null sin homónimo. */
export function pickSupplyTarget(
  unitId: UnitId,
  candidates: readonly SupplyHomonym[],
  units: readonly UnitConversion[],
): SupplyTarget | null;

export type ConvertedSupplyBatch =
  | { readonly kind: 'ok'; readonly stock: string; readonly unitCost: string | null }
  | { readonly kind: 'stock_out_of_range'; readonly stock: string }
  | { readonly kind: 'cost_out_of_range'; readonly stock: string; readonly unitCost: string };

/** Convierte existencia y, si viene, costo unitario de `from` a `to` (misma familia). */
export function convertSupplyBatch(
  batch: { readonly stock: string; readonly unitCost: string | null },
  from: UnitConversion,
  to: UnitConversion,
): ConvertedSupplyBatch;
```

Reglas:

- **Familia** (R1, R2): `unitFamilyId(candidato) === unitFamilyId(unidad del alta)`. Si falta la
  unidad de un candidato en `units`, ese candidato no cuenta: no es visible para la empresa. Una
  unidad sin base y sin derivadas forma su propia familia sin código especial (R2).
- **Destino** (R5): cada existencia se convierte a la unidad base de la familia con
  `convertQuantity(stock, unidadCandidato, base)`. Pasar a la base multiplica por un factor de 4
  decimales: la división siempre termina y el resultado es exacto, con 8 decimales como mucho. Se
  compara **sin truncar** con `compareDecimals` (nueva, exacta, en `decimal-quantity.ts`).
  `compareQuantities` no sirve: trunca a 4 decimales. Gana la mayor. En empate gana la primera de
  la lista, o sea la más antigua y, con la misma fecha, la de menor `id`.
- **Cantidad** (R4, R8): `convertQuantity(stock, from, to)`. «Cabe» = casa con el patrón decimal
  del ERP (`^\d{1,10}(\.\d{1,4})?$`, el de `product-input.ts`, que se exporta como
  `isStoredDecimal`). Si no casa → `stock_out_of_range`. Una división que no termina sale con 12
  decimales y tampoco casa, así que se rechaza sin redondear (`[D6]`).
- **Costo unitario** (R6, R9): el precio por unidad se convierte al revés que la cantidad:
  `convertQuantity(unitCost, to, from)`. Ejemplo: 0,004 por ml → `0.004 × f(l)/f(ml)` = 4 por l.
  Si no casa → `cost_out_of_range`.
- **Costo total** (R7): no entra aquí. Quien llama deriva con `deriveUnitCost(totalCost, stockConvertido)`
  después de convertir, y si da `null` rechaza igual que hoy.
- Si `from.id === to.id`, devuelve la entrada tal cual (`kind: 'ok'`).

`decimal-quantity.ts` gana `compareDecimals(a, b)`, exacta y sin escala fija. Las funciones
existentes no cambian.

## 4. Alta manual (servidor)

### 4.1 Puerto y adaptador

`ProductRepository`:

- **Nuevo** `findAliveSupplyHomonyms(name: string, scope): Promise<readonly SupplyHomonym[]>`.
  Devuelve los productos vivos de la empresa con el nombre normalizado y `unit_id IS NOT NULL`, de
  cualquier tipo (como hoy `findAliveIdByNameInUnit`). Orden `created_at, id` ascendentes, con
  `stock` como texto.
- **Se retira** `findAliveIdByNameInUnit`: su único llamante era `createSupply`. Dejarlo sería
  código muerto. Sus dobles en los tests se actualizan (lista en `tasks.md`) y su entrada de
  `tests/integration/aislamiento.json` pasa al método nuevo.

### 4.2 `createSupply` (en `create-product.ts`)

1. Permiso `inventario.modificar` y zod: sin cambios (R11).
2. `candidatos = products.findAliveSupplyHomonyms(nombre, scope)`.
3. `refs = units.findRefs([unitId del alta, ...unitIds de candidatos], companyId)`. Si la unidad del
   alta no está → `ValidationError`, como hoy.
4. `destino = pickSupplyTarget(...)`. Si es `null` → `createWithFirstBatch` con la unidad del alta
   (R3).
5. Si `destino.target.type` es terminado → `ActionNotAllowedError` (R10). `addBatchToAlive` lo
   vuelve a comprobar bajo bloqueo, como hoy.
6. Si la unidad del destino es otra: `convertSupplyBatch`.
   - `stock_out_of_range` → `ConvertedStockOutOfRangeError` (R8).
   - `cost_out_of_range` → `ConvertedCostOutOfRangeError` (R9).
   - Si el alta traía solo costo total, se deriva con `deriveUnitCost` sobre la existencia
     convertida (R7).
7. `addBatchToAlive(destino.id, loteConvertido, …)` (R4).
8. Devuelve `{ id, lot, conversion? }` con
   `conversion = { productName, stock, unitId }` solo si hubo conversión (R17).

Todo lo que rechaza ocurre antes de escribir (R8, R9, R10). Los demás homónimos no se tocan (R29).

### 4.3 Errores nuevos

Clases de `InventarioError` en `inventario/domain/errors.ts`, publicadas por el barrel:

| Clase | `code` | Mensaje del catálogo (`errores/domain/error-catalog.ts`) |
|---|---|---|
| `ConvertedStockOutOfRangeError` | `converted_stock_out_of_range` | «La existencia convertida a la unidad del producto no cabe en 4 decimales. Ingrésala en la unidad del producto.» |
| `ConvertedCostOutOfRangeError` | `converted_cost_out_of_range` | «El costo unitario convertido a la unidad del producto no cabe en 4 decimales. Ingresa el lote en la unidad del producto.» |

Son dos líneas nuevas en `ERROR_CODES` (enmienda del catálogo de errores, 2026-10-14). La
aprobación de este spec las aprueba. Los dos son distintos de `invalid_input`: la entrada tiene
forma válida y lo que falla es el resultado de convertirla.

### 4.4 Consulta de homónimos para el aviso

- Caso de uso `createFindSupplyHomonyms({ products })` en `inventario/domain/find-supply-homonyms.ts`.
  Primero `requirePermission(actor, 'inventario.modificar')` (R11). Después zod del nombre (1–200
  tras recortar; si está vacío devuelve `[]` sin consultar). Por último
  `products.findAliveSupplyHomonyms(nombre, { companyId: actor.companyId })` (R12).
- Server Action `findSupplyHomonymsAction(name: unknown)` en `product-actions.ts`. Devuelve
  `{ status: 'success'; data: readonly SupplyHomonym[] } | ErrorState`.
- `createProductAction` añade `conversion?` a su estado de éxito.
- Si el servidor rechaza con uno de los dos códigos nuevos, el formulario pinta el mensaje del
  catálogo en el campo (R16).

## 5. Aviso en «Nuevo producto» (UI)

Tableros: `AltaConversion.dc.html` (escritorio), `AltaConversionTablet.dc.html`,
`AltaConversionMovil.dc.html` (ficha con Reutiliza, Estados, Animación y Por confirmar).

- **Datos que necesita el formulario**: nombre, unidad, existencia y costo unitario.
  - `ProductNamePicker` gana la prop opcional `onNameChange(name)`. Es un componente de la ruta,
    sin fila en el catálogo.
  - `PresentationUnitSelect` pasa a modo controlado (`value`, `onValueChange`) y conserva
    `name="unitId"`. El componente ya admite las dos cosas a la vez.
  - La existencia ya está controlada (`stockValue`).
  - `ProductCostFields` gana la prop opcional `onUnitCostChange`.
- **`use-supply-homonyms.ts`** (hook de la ruta) pide `findSupplyHomonymsAction(nombre)` con
  rebote de 400 ms (el mismo que `ProductNamePicker`) y solo cuando cambia el nombre. La unidad y
  la existencia se recalculan en el navegador, sin pedir nada (R13).
  - Si la lectura falla, el aviso no se pinta y el servidor sigue decidiendo al guardar. Es una
    degradación aceptada: el aviso informa, no autoriza.
- **`supply-conversion-notice.tsx`** compone `Notice tone="info"` y no pinta nada si no hay aviso
  (R15).
  - Va entre «Unidad» y «Existencia», a todo el ancho. En teléfono queda encima de «Existencia»,
    como pide el tablero.
  - `Notice` ya es `role="status"`, o sea polite. Entra con `qc-rise`.
  - `data-testid="supply-conversion-notice"`.
- **Cuándo se pinta**: tipo insumo, alta y no edición, con nombre, unidad y existencia válida.
  - Con `pickSupplyTarget` no nulo y el destino en otra unidad, se pinta el aviso que convierte
    (R13).
  - Con más de un homónimo de la familia, se pinta el aviso «varios», aunque el destino tenga la
    misma unidad. En ese caso va sin líneas de conversión (R14).
  - La ayuda bajo «Unidad» (`hint` de `PresentationUnitSelect`) solo sale cuando se convierte.
- **Al guardar** (`save`), antes de enviar, se corre `convertSupplyBatch` con el mismo destino. Si
  algo no cabe, el error va al campo `stock` o `unitCost` con el texto dinámico de §6, y el
  formulario no se envía ni pierde lo escrito (R16).
  - El error entra con `qc-err`, que ya aplica `FieldError`.
  - El servidor revalida: si su respuesta trae uno de los códigos nuevos (§4.3), el mensaje del
    catálogo va a ese mismo campo.
- **Éxito** (R17): `onSaved` recibe `{ lot?, conversion? }`. Con `conversion`, `ProductSheet`
  muestra el texto de §6 con los datos del servidor. Sin ella, el de hoy.
- Los números se muestran con coma decimal y sin ceros sobrantes, como el resto del formulario
  (`lib/shared/ui/decimal-display.ts`).

## 6. Textos

Se toman de los tableros (su «Por confirmar» lo cierra la aprobación de este spec). `{n}` es el
nombre del destino, `{ua}` la unidad del alta y `{ud}` la del destino. Cada unidad se muestra con
su símbolo, o con su nombre si no tiene.

| Dónde | Texto |
|---|---|
| Aviso, título (uno) | `Ya existe {n} en {ud}` |
| Aviso, título (varios) | `Ya existen {n} en {u1} ({e1} {u1}) y en {u2} ({e2} {u2})`. Con más de dos: `en A (…), en B (…) y en C (…)` |
| Aviso, cuerpo (uno) | `El lote se agregará a ese producto, convertido a {ud}:` |
| Aviso, cuerpo (varios, convierte) | `El lote va a la que tiene más existencia, {n} · {ud}, convertido:` |
| Aviso, cuerpo (varios, misma unidad) | `El lote va a la que tiene más existencia, {n} · {ud}.` |
| Aviso, línea de cantidad | `{e} {ua} = {e'} {ud}` |
| Aviso, línea de costo (solo con costo unitario escrito) | `{c} por {ua} = {c'} por {ud}` |
| Ayuda bajo «Unidad» | `Misma familia que {ud}: se convierte al guardar.` |
| Error bajo «Existencia» | `{e} {ua} son {e'} {ud} y no caben en 4 decimales. Ingresa la existencia en {ud}.` |
| Error bajo «Costo unitario» | `El costo por {ud} quedaría en {c'} y no cabe en 4 decimales. Ingresa el lote en {ud}.` |
| Toast con conversión | `Se agregó un lote de {e'} {ud} a {n} · {ud}.` |
| Fórmula, sugerida | `Sugerida del PDF: «{leída}».` |
| Fórmula, sin coincidencia | `El PDF dice «{leída}»: no coincide con ninguna unidad. Elige una.` |
| Fórmula, más de una coincidencia | `El PDF dice «{leída}»: coincide con más de una unidad. Elige una.` (texto propio de este spec: el tablero no pinta este caso) |
| Fórmula, sin unidad en el PDF | `El PDF no trae unidad. Elige una.` |
| Fórmula, elegida a mano | `Elegida por ti.` |
| Fórmula, error | `Elige la unidad de la materia prima.` |
| Excel, motivo de existencia | `Existencia: convertida a la unidad del producto no cabe en 4 decimales; escríbela en esa unidad.` |
| Excel, motivo de costo | `Costo unitario: convertido a la unidad del producto no cabe en 4 decimales; escribe el lote en esa unidad.` |

## 7. Importación desde Excel (QC-209)

- `ImportProductRef` gana `stock: string`. `findAliveProductsByNormalizedNames` y
  `findAliveFinishedProducts` lo seleccionan.
- `resolveIdentity` (insumo):
  - La clave pasa a `P|{nombre}|{familia}`.
  - El destino en base sale de `pickSupplyTarget(unitId de la fila, productos del snapshot con ese
    nombre y unidad, snapshot.units)` (R18).
  - Si no hay destino en base, se busca en el archivo por la clave de familia. `FileProduct` gana
    `unitId`: la unidad de la fila que lo crea, que es a la que se convierten las siguientes.
  - La clave `alsoOccupies` del producto terminado pasa a `P|{derivado}|{familia de la unidad de la
    presentación}`, para que la colisión con un insumo siga viéndose.
- **Conversión en la vista previa** (R20): con destino en otra unidad, se corre
  `convertSupplyBatch`.
  - `stock_out_of_range` → motivo `converted_stock_out_of_range` en `stock`.
  - `cost_out_of_range` → `converted_cost_out_of_range` en `unitCost`.
  - Solo con costo total: `deriveUnitCost(total, existenciaConvertida) === null` →
    `total_cost_too_low` en `totalCost`, un motivo que ya existe.
- **Confirmación** (R19): sin cambios de flujo, porque cada fila pasa por `createProduct`, que ya
  convierte (§4.2). `writeRow` traduce las dos clases nuevas a sus motivos, por si la base cambió
  entre la vista previa y la confirmación.
- **Vista previa y confirmación no divergen** por la regla de «más existencia». Una fila de insumo
  siempre suma al destino de su familia, que es el de mayor existencia, así que el orden entre los
  homónimos no cambia durante el archivo. En un empate, la primera suma rompe el empate a favor del
  mismo destino.
- `IMPORT_ROW_ISSUE_CODES` gana los dos códigos, con sus textos (§6).

## 8. Materia prima desde fórmula (QC-159)

Tableros: `ImportarFormulaUnidad.dc.html`, `ImportarFormulaUnidadTablet.dc.html`,
`ImportarFormulaUnidadMovil.dc.html`.

### 8.1 Borde y revisión (puro)

- `formula-import-input.ts`: la línea `new` gana `unitId: z.string().uuid()`, obligatorio. Sin él,
  zod falla → `invalid_input` (R24).
- `review-formula-import.ts`: `DraftLine` `new` gana `unitId: string | null` y un `RowProblem`
  nuevo, `new_unit_missing`, que impide `canConfirm` (R23). El navegador usa esta misma función
  pura.

### 8.2 Confirmación (`confirm-formula-import.ts`)

- `FormulaImportDeps` gana `units: Pick<UnitCatalog, 'findRefs'>`. Lo cablea `lib/composition`.
- Tras resolver los nombres, y **antes de crear nada** (QC-159 R27):
  - `refs = units.findRefs([unidades elegidas, ...unidades de los homónimos], companyId)`.
  - Si una unidad elegida no está → `ValidationError` (R24).
- Elegibles para reutilizar: los homónimos `isIngredientType`, con `unitId` y de la misma familia
  que la unidad elegida (`unitFamilyId`).
  - Si hay uno, se reutiliza.
  - Si hay más de uno → `ValidationError`.
  - Si no hay ninguno, se crea (R26). Un homónimo sin unidad no cuenta (`[D4]`).
- `createRawMaterial({ name, unitId }, actor)` (R25). El permiso `inventario.modificar` va antes de
  crear, como hoy (R28).
- `FormulaImportSummary` gana `created: { name, unitId }[]` y `reused: { name }[]`. Los contadores
  actuales se mantienen (R27).

### 8.3 `createRawMaterial` y el adaptador

- Esquema `{ name, unitId: uuid }`.
- `deps.units.findRefs`: si la unidad no es visible → `ValidationError`.
- `products.create` con `unitId`.
- `product-prisma.ts > createProduct` escribe `unitId` cuando viene (hoy lo ignora).

### 8.4 UI de la revisión

- `formula-import-review.tsx`: cada fila gana `newUnitId` y `newUnitSource`
  (`'suggested' | 'none' | 'ambiguous' | 'missing' | 'picked'`).
  - El valor inicial es `suggestUnitId(unitRead, units)` (R21, R22).
  - `units` ya llega de `listUnitsAction()` en `page.tsx`, con las unidades de sistema y las de la
    empresa: lo que el tablero dejaba «Por confirmar».
  - Para distinguir «más de una» de «ninguna», la fila cuenta las coincidencias con la misma
    normalización (`normalizeUnitName`). No se cambia `suggestUnitId`, que usa la revisión de
    catálogo.
- `formula-ingredient-row.tsx`, modo `create`: `PresentationUnitSelect` controlado, con
  `name={null}`, `hint` y `error`.
  - Escritorio: va junto a «Nombre». Teléfono: debajo, a todo el ancho.
  - Entra con `fade`. El error, con `qc-err` tras «Confirmar» (R23).
  - `ROW_PROBLEM_LABELS` gana `new_unit_missing: 'sin unidad'`.
- `formula-import-summary.tsx`: bajo cada contador, la lista `Nombre · u` de las creadas y los
  nombres de las reutilizadas, o `—` si no hay (R27).

## 9. Enmiendas a otros specs

Esta ficha **enmienda**, y la tarea T9 lo anota en cada archivo con una línea «Enmendado por
QC-203»:

- **QC-159 R25**: la materia prima nueva **nace con unidad**, la elegida en la revisión (R25 de
  esta ficha). Ya no «sin unidad».
- **QC-159 R26**: el homónimo se busca por **nombre normalizado + familia** de la unidad elegida
  (R26). Se mantiene «uno reutiliza, más de uno rechaza».
- **QC-199 R10**: el homónimo del alta de insumo se busca por **familia**, no por unidad. Uno en
  otra unidad de la familia recibe el lote convertido en vez de dar otro producto. Entre varios gana
  el de más existencia: también entre duplicados de la misma unidad, donde antes ganaba el más
  antiguo (R5, consecuencia directa de `[D5]`).
- **QC-121 R5 y R6**, en lo que toca al insumo: «misma unidad» pasa a «misma familia», y un
  homónimo en otra unidad de la familia ya no da otro producto ni pasa «sin aviso». Recibe el lote
  convertido y el formulario avisa antes (R4, R13). Entre familias distintas, R6 sigue igual.
- **QC-209 R14 y R15**: en los insumos, la identidad es nombre + familia (R18).

## 10. Alternativas descartadas

1. **Agrupar al leer** (sumar existencias de homónimos en listados y consumos). Descartada por el
   humano (`[D1]`): reparte la regla por todas las lecturas y deja los datos partidos.
2. **Columna `unit_family_id` en `products`, o índice por familia.**
   - Exige migración, que `[D4]` descarta, y duplica un dato que ya se deriva de `units`.
   - Si la base de una unidad cambiara, habría que reescribirla.
   - La unicidad en base es de QC-205 (`[D11]`).
3. **Calcular el aviso en el servidor en cada cambio** (una action que devuelve el plan entero).
   - Haría una ida y vuelta por cada tecla en «Existencia» o cada cambio de «Unidad».
   - Con una lectura por nombre y la función pura compartida, el navegador calcula lo mismo que el
     servidor sin pedir nada más.
4. **Reutilizar `listProductsAction` con `search` para encontrar los homónimos.**
   - Busca por «contiene», está paginado y no compara el nombre normalizado exacto.
   - Pide el permiso de consulta y no el del alta.
5. **Redondear la cantidad o el costo convertidos.** Descartado por el humano (`[D6]`, `[D7]`).
6. **Conservar `findAliveIdByNameInUnit` junto al método nuevo.** Quedaría sin llamantes: código
   muerto que invita a volver a la regla vieja.

## 11. Límites conocidos

- **Carrera entre dos altas**: dos altas a la vez del mismo nombre y familia, sin homónimo previo,
  pueden crear dos productos. Lo cierra QC-205 (`[D11]`). Mientras tanto, R5 sigue funcionando con
  varios homónimos (R29).
- **El aviso es informativo**: el destino se decide en el servidor al guardar. Si la base cambió
  entre la lectura y el guardado, manda el servidor, y el toast refleja lo que se escribió (R17).

## 12. Dependencias

Ninguna nueva.
