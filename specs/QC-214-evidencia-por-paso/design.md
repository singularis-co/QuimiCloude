# QC-214 — evidencia-por-paso · design.md

## Lo que ya existe

**Términos buscados** (2026-10-13): `evidencia`, `evidence`, `foto`, `photo`, `requiere evidencia`.

| Dónde | Qué apareció | Qué se hace |
|---|---|---|
| Board (`feature_list.json`) | **QC-271** (ver las fotos en el detalle del pedido y en el registro de ejecución), bloqueada por esta. Las otras coincidencias de `foto`/`evidencia` (QC-114, QC-143…) usan la palabra en otro sentido. | Nada se re-crea: QC-271 está en «Lo que NO entra». Esta ficha le deja el modo de solo lectura de la pieza (R24). |
| `specs/` | `evidencia` aparece en 60 specs como palabra corriente («evidencia del gate»). Ningún spec de fotos por paso. | Nada. |
| Código (grafo, proyecto del worktree) | Ningún símbolo de evidencia ni de fotos de ejecución. Sí lo que se reutiliza abajo. | Se reutiliza. |

**Código que se reutiliza** (verificado leyendo el archivo):

- Pasos: `lib/modules/recetas/domain/recipe-input.ts` (`recipeStepSchema`, `.strict()`, sin id por
  paso); se leen con ese mismo esquema en `recipe-prisma.ts > toSteps` y
  `recipe-catalog-prisma.ts > toExecutionSteps`. Las versiones no guardan pasos: se leen de su
  original (`RecipeOriginalRow`, `findExecutionContentById`, `findPackingStepsById`).
- Validación de imagen por contenido y tope de 5 MB: `validateRecipeImage` y `MAX_IMAGE_BYTES`,
  publicados en el barrel de `recetas` (QC-25).
- Storage privado con subida firmada: el patrón de `lib/modules/documentos` —puerto
  `DocumentStorage`, `buildDocumentPath`/`isPathInCompany`, `READ_LINK_TTL_SECONDS = 15 * 60`,
  adaptador `@supabase/storage-js`, doble en memoria encendido solo por `playwright.config.ts` y
  vigilado por `tests/guards/guard-dobles-e2e.test.ts`—. Se calca, no se importa: es de otro
  módulo y sus adaptadores driven no se comparten.
- Ejecución: `record-step-move.ts`, `finish-assigned-order.ts`, `get-assigned-order-execution.ts`
  (`asignaciones.ejecutar` + responsable asignado). Empaque: `get-packing-order.ts`,
  `finish-packing.ts` (`empaque.modificar` + `packedBy`).
- Pedidos en curso: `OrderCatalog.listAliveSummariesInCompany` y `listAliveSummariesByIds`
  (contrato de `pedidos`, ya usado por `asignaciones`; el resumen trae `recipeId` y `status`).

### Filas de `components/shared/CATALOGO.md` consultadas

| Fila | Decisión | Paso de la regla |
|---|---|---|
| `StepReader` | Se **extiende** con tres props opcionales (§ 8.2). Los usos actuales no cambian. | 2 · extender |
| `StepDocumentView` | Se reutiliza tal cual (ignora el campo nuevo del paso). | 1 · reutilizar |
| `Checkbox` | Consultada para el switch y descartada: el tablero aprobado pide un interruptor (`role="switch"`), no una casilla. | — |
| `Card`, `Button`, `Dialog`, `Spinner` | Se reutilizan dentro de la pieza nueva `StepEvidence`. | 1 · reutilizar |
| `ConfirmDialog`, `ConfirmDialogFrame`, `ConfirmDialogBody` | La confirmación de terminar se reutiliza con otro texto (R23). «Falta evidencia» se compone con el marco. | 1 y 3 |
| `Notice` | El aviso de bloqueo del editor (tono `warning`). | 1 · reutilizar |
| `ErrorAlert` | Los rechazos del servidor en las dos pantallas y en el editor. | 1 · reutilizar |
| `compressImage` | Compresión en el navegador (`maxBytes` 5 MB, `maxDimension`, `accept`). | 1 · reutilizar |
| `isAcceptedType`, `toAcceptAttribute`, `formatMegabytes` (`file-types.ts`) | Filtro de tipo y atributo `accept`. | 1 · reutilizar |
| `FileField`, `DocumentUpload` | Consultadas y descartadas: son de un archivo o de una tanda de PDF en filas, sin miniaturas cuadradas, sin cambiar en el sitio ni progreso por casilla. | — |

**Piezas nuevas:**

- `components/ui/switch.tsx` — paso 4 (crear): no hay primitivo de interruptor en el catálogo. Sobre
  `@base-ui/react` Switch (ya en `docs/dependencias.md`). Tablero: `FormulaEvidencia*.dc.html`.
- `components/shared/step-evidence/` (`StepEvidence`, `EvidenceMissingDialog`) — paso 3 (componer).
  Va a `components/shared` desde el primer commit porque **dos rutas** la montan en esta misma
  ficha: `app/(private)/asignacion/[id]` (Ejecución) y `app/(private)/asignacion/empaque/[id]`
  (Empaque). Tablero: `EvidenciaPaso*.dc.html`.

Ninguna dependencia nueva.

## 1. Tableros aprobados (fuente del comportamiento visual)

Aprobados por el humano el 2026-10-13 (`requirements.md > Decisiones cerradas`, última fila):

| Tablero | Qué fija |
|---|---|
| `docs/diseno/canvas/EvidenciaPaso.dc.html` | Escritorio: bloque «Evidencia» debajo de las casillas del paso, cuadrícula de 3 casillas cuadradas (foto · subiendo con anillo, barra y % · error con «Quitar» · «Añadir foto»/«Añadir otra foto»), contador `n/3`, «Obligatoria · de 1 a 3 fotos», motivos del pie (orden: elementos pendientes > «Espera a que termine de subir la foto.» > «Sube al menos 1 foto de evidencia para continuar.»), diálogo «Falta evidencia», confirmación con «Al terminar, las fotos de evidencia quedan fijas…», visor ampliado, estado terminado («Fijada al terminar»). Props de demo: `empaque`, `terminado`, `errorDeArchivo`. |
| `docs/diseno/canvas/EvidenciaPasoTablet.dc.html` | Tablet: igual que escritorio a todo el ancho. |
| `docs/diseno/canvas/EvidenciaPasoMovil.dc.html` | **Ficha**: dónde, qué reutiliza, pieza nueva `step-evidence`, entrada `<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment">`, estados, bloqueos, tamaños (casillas ~110 px, botones de 44 px), animación (`qc-rise` 200 ms, barra 300 ms). |
| `docs/diseno/canvas/FormulaEvidencia.dc.html` | Escritorio: switch «Requiere evidencia» a la derecha de la barra del paso (`ed-tb`), borde del paso en tono primario y línea de ayuda cuando está encendido, resumen por lista, aviso de bloqueo y mover/quitar deshabilitados (prop `pedidosConFotos`). |
| `docs/diseno/canvas/FormulaEvidenciaTablet.dc.html` | Tablet: igual que escritorio. |
| `docs/diseno/canvas/FormulaEvidenciaMovil.dc.html` | **Ficha**: `components/ui/switch` (pista 36 × 20, botón 16 px, `--primary`/`--input`), barra partida en dos líneas en teléfono, área táctil de 44 px, animación de 200 ms. |

Lo que las fichas dejan «por confirmar» va en `requirements.md > Preguntas abiertas` 1, 2, 3 y 8.

## 2. El flag en el paso

`recipeStepSchema` gana un campo opcional:

```ts
z.object({
  blocks: z.array(recipeStepBlockSchema),
  requiresEvidence: z.boolean().optional(),
}).strict()
```

- Ausente = apagado (R2). Las fórmulas existentes no se migran: su JSON no lo trae.
- El editor lo envía solo cuando está encendido (`true`); apagar lo quita. Así el JSON de una
  fórmula que nunca usó la evidencia no cambia al guardarla.
- `.strict()` ya rechaza un valor no booleano (R4).
- `RecipeStepView` es alias de `RecipeStepDocument`: el campo sale en todas las lecturas —detalle,
  `findExecutionContentById`, `findPackingStepsById`— sin tocar los adaptadores, que ya parsean con
  el mismo esquema (R3). Las versiones lo heredan por construcción (R6).
- **Sin migración de base** para el flag: vive en el JSONB `recipes.steps` / `recipes.packing_steps`.

## 3. Modelo de datos

### 3.1 Tabla `order_step_evidence` (módulo `asignaciones`)

Identificadores en inglés (decisión «Identificadores y empresa»).

```prisma
enum EvidencePhase {
  MANUFACTURING
  PACKING
  @@map("evidence_phase")
}

/// @module asignaciones
model OrderStepEvidence {
  id           String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  companyId    String        @map("company_id") @db.Uuid
  orderId      String        @map("order_id") @db.Uuid
  phase        EvidencePhase
  stepPosition Int           @map("step_position")
  slot         Int           @db.SmallInt
  path         String
  contentType  String        @map("content_type")
  sizeBytes    Int           @map("size_bytes")
  uploadedBy   String        @map("uploaded_by") @db.Uuid
  createdAt    DateTime      @default(now()) @map("created_at") @db.Timestamptz(6)

  @@unique([orderId, phase, stepPosition, slot], map: "order_step_evidence_slot_key")
  @@unique([companyId, path], map: "order_step_evidence_company_path_key")
  @@index([companyId, orderId], map: "order_step_evidence_company_id_order_id_idx")
  @@index([uploadedBy], map: "order_step_evidence_uploaded_by_idx")
  @@map("order_step_evidence")
}
```

| Columna / restricción | Por qué |
|---|---|
| `company_id` | Columna de empresa obligatoria (`docs/checkpoints-proyecto.md`). Toda consulta del adaptador filtra por ella (R39). |
| `slot` 1..3, único por `(order, phase, step, slot)` | **Tope de 3 en la base**: dos registros simultáneos no pueden dejar 4 fotos (R29). También es la posición de la casilla: «Cambiar» reusa el mismo `slot` (R19). |
| `step_position` ≥ 1 | Las fotos se atan al número de paso, como decidió el humano (los pasos no tienen id). |
| `path` único por empresa + CHECK de prefijo | `path LIKE company_id::text || '/' || order_id::text || '/%'`: la base tampoco admite una ruta fuera de `<empresa>/<pedido>/` (R30, R31). |
| `content_type` | CHECK `IN ('image/jpeg','image/png','image/webp')`: el detectado por contenido, nunca el que declara el cliente. |
| `size_bytes` | CHECK `> 0 AND <= 5242880` (R32). |
| Sin `updated_at`/`deleted_at` | Una foto no se edita: «Cambiar» borra la fila vieja e inserta otra en el mismo `slot`; «Quitar» la borra. Las fotos de un pedido cancelado o dado de baja se conservan porque **nada** las borra (R38). |

FK escritas a mano (sin `@relation`: `Order` es de `pedidos` y `User` de `identity`), como en
`order_conditioning_team_members`:

- `(order_id, company_id) → orders(id, company_id)` `ON DELETE RESTRICT ON UPDATE CASCADE`.
- `(uploaded_by, company_id) → users(id, company_id)` `ON DELETE RESTRICT ON UPDATE CASCADE`.
- `company_id → companies(id)` `ON DELETE RESTRICT`.

### 3.2 RLS

`ALTER TABLE "order_step_evidence" ENABLE ROW LEVEL SECURITY;` y `FORCE ROW LEVEL SECURITY;`, sin
policies, al final de la migración (patrón del repo). Defensa en profundidad: la frontera es el
caso de uso (`docs/architecture.md > Acceso a datos y autorizacion`).

### 3.3 Migración

`db/migrations/20261013120000_order_step_evidence/`:

- `migration.sql`: `CREATE TYPE "evidence_phase"`, la tabla y sus índices (generado por Prisma con
  `pnpm run db:migrate:create`), y a mano los CHECK, las tres FK y la RLS.
- `down.sql`: `DROP TABLE "order_step_evidence";` y `DROP TYPE "evidence_phase";` (revierte
  exactamente lo anterior).

No toca ninguna tabla existente.

## 4. Puertos y adaptadores

### 4.1 `asignaciones/ports/step-evidence-repository.ts`

```ts
export type EvidencePhase = 'manufacturing' | 'packing';   // el tipo vive en domain/step-evidence.ts
export type StepEvidenceRow = {
  readonly id: string; readonly orderId: string; readonly phase: EvidencePhase;
  readonly stepPosition: number; readonly slot: number; readonly path: string;
};
export interface StepEvidenceRepository {
  listByOrder(companyId: string, orderId: string, phase: EvidencePhase): Promise<readonly StepEvidenceRow[]>;
  findById(companyId: string, orderId: string, phase: EvidencePhase, id: string): Promise<StepEvidenceRow | null>;
  /** Primer `slot` libre del paso; `'limit'` si no hay o si otro lo ocupo a la vez (23505). */
  insert(row: NewStepEvidence): Promise<StepEvidenceRow | 'limit'>;
  /** Borra `replacedId` e inserta la nueva en su mismo `slot`, en una transaccion. */
  replace(replacedId: string, row: NewStepEvidence): Promise<StepEvidenceRow | 'not_found'>;
  delete(companyId: string, orderId: string, phase: EvidencePhase, id: string): Promise<StepEvidenceRow | null>;
  /** De esos pedidos, los que tienen al menos una foto en la fase dada. */
  listOrderIdsWithEvidence(companyId: string, candidates: readonly { orderId: string; phase: EvidencePhase }[]): Promise<readonly string[]>;
}
```

Adaptador: `adapters/driven/persistence/step-evidence-prisma.ts` (único que toca
`prisma.orderStepEvidence`).

### 4.2 `asignaciones/ports/evidence-storage.ts`

```ts
export interface EvidenceStorage {
  createSignedUpload(path: string): Promise<{ path: string; uploadUrl: string; token: string }>;
  createSignedReadUrl(path: string, expiresInSeconds: number): Promise<string>;
  /** `null` si la ruta no existe: no se subio nada. */
  download(path: string): Promise<Uint8Array | null>;
  remove(path: string): Promise<void>;
}
```

- `adapters/driven/storage/evidence-storage-supabase.ts`: `@supabase/storage-js` (ya aprobada) contra
  el bucket de `SUPABASE_EVIDENCE_BUCKET`, con `SUPABASE_STORAGE_URL`/`SUPABASE_STORAGE_KEY`
  reutilizadas (mismo criterio que los PDF). Config en
  `adapters/driven/config/evidence-storage-config-env.ts`.
- `adapters/driven/storage/evidence-storage-memory.ts`: doble. Guarda las rutas que firma y se
  niega a leer o borrar una que no firmó; `download` devuelve un PNG mínimo válido (la subida real
  la intercepta el E2E); las URL apuntan a `https://evidencias-e2e.invalid` (no resuelve).
- `adapters/driven/config/evidence-e2e-doubles-env.ts`: `evidenceE2EDoublesEnabled()` lee
  `EVIDENCE_E2E_DOUBLES`. Solo la enciende `playwright.config.ts`; se añade a `VIGILADAS` de
  `tests/guards/guard-dobles-e2e.test.ts`.

**Fuera del código (lo hace el humano):** crear el bucket **privado** de evidencias en cada proyecto
de Supabase (producción y preview), con límite de 5 MB por archivo y tipos `image/jpeg`,
`image/png`, `image/webp`, y poner su nombre en `SUPABASE_EVIDENCE_BUCKET`.

### 4.3 `recetas/ports/recipe-step-lock-reader.ts`

```ts
export interface RecipeStepLockReader {
  /** Pedidos en curso con fotos cuya receta es alguna de `recipeIds`. */
  countOrdersWithEvidenceInProgress(recipeIds: readonly string[], companyId: string): Promise<number>;
}
```

Lo implementa `lib/composition` llamando a `createCountEvidenceLockingOrders` del barrel de
`asignaciones` (§ 5.6). `recetas` no importa `asignaciones`: solo declara lo que necesita, y no
aparece ningún ciclo entre barrels (`asignaciones` ya importa `recetas`).

`RecipeRepository` gana `listVersionIdsIncludingDeleted(originalId, scope)`: una versión dada de
baja puede tener pedidos en curso que se ejecutan con los pasos de la original.

## 5. Casos de uso

Todos abren con `requirePermission` antes de validar la entrada y antes de tocar un puerto
(patrón del módulo). La empresa sale siempre del actor.

### 5.1 `asignaciones/domain/step-evidence.ts` (puro)

- `MAX_EVIDENCE_PER_STEP = 3`, `EVIDENCE_READ_LINK_TTL_SECONDS = 15 * 60`.
- `buildEvidencePath(companyId, orderId)` → `<companyId>/<orderId>/<crypto.randomUUID()>` (R30).
- `isEvidencePathOf(path, companyId, orderId)`: tres segmentos exactos, los dos primeros iguales,
  sin `..` (R31; mismo criterio que `isCropPathOf`).
- `stepRequiresEvidence(steps, position)` y `missingEvidencePositions(steps, rows)`: posiciones
  que exigen evidencia en la lista **actual** y no tienen ninguna fila (R35, R36, R37).

### 5.2 `evidence-target.ts` — quién puede, sobre qué pedido y qué lista

`resolveEvidenceTarget(deps, actor, orderId, phase)` devuelve `{ recipeId, steps }` o lanza:

| Fase | Permiso | Condición | Pasos |
|---|---|---|---|
| `manufacturing` | `asignaciones.ejecutar` | responsable asignado (`listOrderIdsByUserInCompany`) y `EN_CURSO` | `RecipeCatalog.findExecutionContentById(recipeId).steps` |
| `packing` | `empaque.modificar` | `EN_EMPAQUE` y `packedBy === actor.id` | `RecipePackingStepsReader.findPackingStepsById(recipeId)` |

Cualquier otro caso: `OrderNotFoundError` («no es tuyo» y «no existe» son la misma respuesta), salvo
`BLOQUEADO` → `OrderBlockedError`, como hoy. Cubre R26, R27, R38 (un pedido que ya no está en curso
para esa fase se rechaza) y R39.

### 5.3 `request-evidence-upload.ts`

Entrada `{ orderId, phase, stepPosition, replacesEvidenceId? }` (zod `strictObject`).
1. `resolveEvidenceTarget`.
2. `stepRequiresEvidence` o `ValidationError` (R28).
3. Sin `replacesEvidenceId`: si el paso ya tiene 3 filas → `EvidenceLimitError` (R29). Con él: la
   fila debe existir en ese pedido, fase y paso → si no, `EvidenceNotFoundError`.
4. `storage.createSignedUpload(buildEvidencePath(companyId, orderId))`.

Salida `{ path, uploadUrl, token }`. No escribe ninguna fila.

### 5.4 `register-evidence.ts`

Entrada `{ orderId, phase, stepPosition, path, replacesEvidenceId? }`.
1. `resolveEvidenceTarget`; R28 otra vez (la fórmula pudo cambiar entre pedir y registrar).
2. `isEvidencePathOf(path, companyId, orderId)` o `ValidationError` (R31).
3. `storage.download(path)`; `null` → `EvidenceInvalidFileError`. `validateRecipeImage(bytes)` del
   barrel de `recetas`; si falla → `storage.remove(path)` y `EvidenceInvalidFileError` (R32).
4. `insert` (→ `'limit'` = `remove(path)` + `EvidenceLimitError`, R29) o `replace` (luego
   `remove` del archivo viejo, best-effort).
5. Devuelve las fotos del paso con URL firmada de 15 min (R33).

Un `remove` que falla no deshace el registro: vuelve como advertencia con operación y ruta, y la
Server Action la escribe en el log (mismo criterio que `update-recipe.ts > removeImageSafely`;
nunca un `catch` vacío).

### 5.5 `remove-evidence.ts`

Entrada `{ orderId, phase, evidenceId }`. `resolveEvidenceTarget` → `delete` (→ `null` =
`EvidenceNotFoundError`) → `storage.remove` best-effort → fotos del paso (R19, R21).

### 5.6 `count-evidence-locking-orders.ts`

`createCountEvidenceLockingOrders({ orders, evidence })(companyId, recipeIds)`: servicio interno
(sin actor: lo llama `recetas` después de autorizar). Recorre por páginas
`orders.listAliveSummariesInCompany(companyId, ['EN_CURSO', 'EN_EMPAQUE'], 'work_queue', …)`, se queda
con los de `recipeId ∈ recipeIds`, y pregunta a `evidence.listOrderIdsWithEvidence` con fase
`manufacturing` para `EN_CURSO` y `packing` para `EN_EMPAQUE`. Devuelve cuántos.

Por qué así: los pedidos en curso son la cola de trabajo de planta (acotada); las fotos crecen sin
fin. Y no se escribe SQL contra `orders` desde `asignaciones`.

### 5.7 Cambios en casos de uso existentes

| Archivo | Cambio | R |
|---|---|---|
| `record-step-move.ts` | Con `direction: 'advance'` y `stepPosition ≥ 2`, si el paso `stepPosition - 1` exige evidencia y no tiene filas → `EvidenceRequiredError`, sin anotar. Deps nuevas: `recipes`, `evidence`; lee `recipeId` con `listAliveSummariesByIds`. | R34, R37 |
| `finish-assigned-order.ts` | Antes de `ensurePackerAssignments`: `missingEvidencePositions(steps, filas de fabricación)` no vacío → `EvidenceRequiredError`. | R35, R37 |
| `finish-packing.ts` | Igual con los pasos de envasado y las filas de `packing`, antes de la transacción. | R36, R37 |
| `get-assigned-order-execution.ts` (y por tanto `start-assigned-order.ts`) | La vista gana `evidence: readonly StepEvidenceView[]` (fabricación) con URL firmadas. | R14, R33 |
| `get-packing-order.ts` | `PackingOrderDetail` gana `packingEvidence`, solo cuando salen los pasos (`EN_EMPAQUE` y quien empaca). | R14, R27, R33 |
| `errors.ts` | `EvidenceRequiredError` (`evidence_required`), `EvidenceLimitError` (`evidence_limit`), `EvidenceInvalidFileError` (`evidence_invalid_file`), `EvidenceNotFoundError` (`evidence_not_found`). | R29, R32, R34–R36 |

`StepEvidenceView = { stepPosition: number; photos: readonly { id: string; slot: number; url: string }[] }`.

**Carrera aceptada.** La comprobación de fotos de terminar va fuera de la transacción de
transición: si quien ejecuta quita la última foto en el mismo instante en que termina, puede pasar.
Lo provoca la misma persona desde su propia pantalla, y la cuadrícula ya bloquea el botón.

### 5.8 `recetas`

- `recipe-step-lock.ts` (puro): `detectLockedStepChange(previous, next)` → `'removed' | 'moved' |
  null`, por lista:
  - `'removed'` si `next.length < previous.length` (R9).
  - `'moved'` si existe `i < previous.length` tal que `next[i]` no es igual a `previous[i]` y
    `previous[i]` aparece igual en otra posición `k ≠ i` de `next` (R10).
  - «Igual» = mismos `blocks` en forma canónica; `requiresEvidence` **no** cuenta, para que
    cambiar el switch nunca parezca mover.
- `update-recipe.ts`: tras leer la receta, si `detectLockedStepChange` da algo en alguna lista,
  pregunta `stepLocks.countOrdersWithEvidenceInProgress([id, ...listVersionIdsIncludingDeleted])` y,
  si es > 0, lanza `RecipeStepsLockedError` (`recipe_steps_locked`) antes de persistir (R9–R12).
  Solo pregunta cuando hace falta: una edición normal no paga la consulta.
- `get-recipe-step-lock.ts`: `(id, actor) → { lockingOrders: number }`, con `recetas.consultar`,
  para que el editor pinte el aviso (R8).

**Cómo se detecta reordenar sin id de paso, y su límite (lo pidió el leader).** Como editar el
texto de un paso está permitido, una permutación cuyos pasos además se reescriben es, vista desde el
servidor, idéntica a reescribir cada paso en su sitio: no hay dato que las distinga sin dar
identidad a los pasos, y eso está fuera de alcance. El servidor cierra lo que sí es distinguible:

- **Quitar** se detecta siempre (la lista se acorta; añadir solo al final no la acorta nunca).
- **Mover** se detecta cuando el paso movido llega con su contenido intacto, que es lo que produce
  arrastrar en el editor.

Lo que queda (mover y reescribir a la vez desde una petición hecha a mano) deja las fotos atadas a
la posición, que es exactamente el resultado de una edición de texto, permitida. El editor además
deshabilita mover y quitar (R8). Falso positivo posible: reescribir un paso para que quede igual
que otro paso que también cambia de sitio; se rechaza con el mismo mensaje, y basta con no hacer
las dos cosas en el mismo guardado.

## 6. Borde: Server Actions y variables

`lib/modules/asignaciones/adapters/driving/step-evidence-actions.ts` (`'use server'`, importado por
su ruta exacta; actor con `runInRequestScope`, una sola lectura de sesión):

| Acción | Entrada | Salida |
|---|---|---|
| `requestEvidenceUploadAction` | `{ orderId, phase, stepPosition, replacesEvidenceId? }` | `{ status: 'success', data: { path, uploadUrl, token } } \| ErrorState` |
| `registerEvidenceAction` | `{ orderId, phase, stepPosition, path, replacesEvidenceId? }` | `{ status: 'success', data: { photos } } \| ErrorState` |
| `removeEvidenceAction` | `{ orderId, phase, evidenceId }` | `{ status: 'success', data: { photos } } \| ErrorState` |

`recordStepMoveAction`, `finishAssignedOrderAction` y `finishPackingAction` no cambian de firma: el
error nuevo sale por el `ErrorState` de siempre.

`lib/modules/recetas/adapters/driving/recipe-actions.ts` gana `getRecipeStepLockAction(id)`;
`updateRecipeAction` devuelve el código nuevo por el traductor de siempre.

`lib/modules/errores`: los cinco códigos en `error-codes.ts` y su mensaje en `error-catalog.ts`.

**Variables** (`.env.example`, vacías, y fila en `docs/architecture.md > Variables por entorno`,
que vigila `tests/guards/guard-variables-por-entorno.test.ts`):

| Variable | Production | Preview | Local |
|---|---|---|---|
| `SUPABASE_EVIDENCE_BUCKET` | bucket privado de producción | bucket privado del proyecto de preview | según dev |
| `EVIDENCE_E2E_DOUBLES` | ausente | ausente (pregunta abierta 6) | vacía; solo la pone `playwright.config.ts` |

## 7. Subida desde el navegador

1. `requestEvidenceUploadAction` → enlace firmado.
2. `compressImage(file, { maxBytes: MAX_IMAGE_BYTES, maxDimension: 1600, accept })` (pregunta
   abierta 2). `not_compressible`, tipo no admitido o > 5 MB → casilla en error, sin subir (R17).
3. `PUT` al `uploadUrl` con `XMLHttpRequest` —no `fetch`—, porque solo `xhr.upload.onprogress` da
   el porcentaje que pinta la casilla (R16). API del navegador, soportada en Safari iOS y Chrome
   Android: sin dependencia.
4. `registerEvidenceAction` → la foto cuenta (R18). Un fallo en 1, 3 o 4 deja la casilla en error.

Un archivo subido y nunca registrado (pantalla cerrada a medias) queda en el bucket sin fila: no se
lee nunca. Su limpieza, como la de los pedidos cancelados, va aparte.

## 8. UI

### 8.1 Editor de fórmulas (`app/(private)/produccion/formulas/`)

- `recipe-step-editor.tsx`: el `Switch` con icono de cámara y texto «Requiere evidencia» a la
  derecha de la barra `ed-tb`; en teléfono, la barra en dos líneas (tablero). Encendido: borde
  primario y línea de ayuda (R1, R5). Recibe `locked` para deshabilitar mover y quitar.
- `recipe-steps-field.tsx`: prop opcional `showEvidenceSwitch` (por defecto `false`, así la
  revisión de la fórmula importada de PDF no cambia) y el resumen por lista (R5).
- `recipe-form.tsx`: `showEvidenceSwitch` en las dos listas; `lockingOrders` por prop → `Notice`
  `warning` arriba (R8). El `ErrorAlert` muestra `recipe_steps_locked` si el servidor rechaza.
- `[id]/page.tsx`: pide `getRecipeStepLockAction(id)` en el mismo `Promise.all`.
- `recipe-version-form.tsx`: en los pasos heredados (ya `inert`), la marca «Requiere evidencia» de
  cada paso que la tiene (R6).

### 8.2 Extensión de `StepReader` (paso 2)

Tres props opcionales; sin ellas el comportamiento es el de hoy:

| Prop | Qué hace |
|---|---|
| `renderStepAddon?: (position: number) => ReactNode` | Se pinta debajo de `StepDocumentView` del paso actual. |
| `stepBlockReason?: (position: number) => string \| null` | Motivo extra de bloqueo del paso actual: deshabilita «Siguiente» y el botón de terminar, y se muestra en el hueco del motivo cuando no hay elementos pendientes (orden del tablero). |
| `stepRequest?: { readonly position: number; readonly id: number }` | Al cambiar `id`, va a `position` y llama a `onStepChange` con la dirección que corresponda. Lo usa «Falta evidencia» (R22). |

La fila del catálogo anota los tres puntos de extensión.

### 8.3 `components/shared/step-evidence/`

- `StepEvidence`: props `photos`, `readOnly?`, `onAdd(file)`, `onChange(id, file)`, `onRemove(id)`
  y el estado de cada casilla (`ok` · `uploading` + porcentaje · `error` + mensaje). Pinta la
  cuadrícula de 3, el contador, los textos de R13 y R24, el visor (`Dialog`, R20) y la entrada de
  archivo de R25. No llama a ninguna Server Action: la pantalla le pasa los callbacks.
- `upload-evidence.ts`: los pasos 1–4 de § 7, con las Server Actions recibidas por parámetro.
- `EvidenceMissingDialog`: lista de «Paso <n>» con un botón cada uno y «Cerrar» (R22).

### 8.4 Pantallas

- `order-execution-screen.tsx`: estado de fotos por paso, inicializado con `execution.evidence`
  (R14); `renderStepAddon` monta `StepEvidence` en los pasos que exigen evidencia;
  `stepBlockReason` devuelve el motivo de subida o de 0 fotos (R15, R16); al terminar,
  `missingEvidencePositions` (el mismo del barrel, en cliente) decide entre «Falta evidencia» y la
  confirmación con el texto de R23.
- `packing-order-screen.tsx`: lo mismo con `order.packingEvidence` y la fase `packing`.

**Multiplataforma** (`docs/architecture.md > Regla: multiplataforma`): botones de foto y casillas de
al menos 44 × 44 px; nada depende de `:hover`; el pie sigue siendo el de `StepReader` (con su
`safe-area-inset-bottom`); el visor se cierra con un botón de 44 px. Sin excepción declarada.

## 9. Alternativas descartadas

1. **Guardar el flag en una columna paralela** (`recipes.steps_evidence boolean[]`). Descartada:
   al reordenar o quitar pasos, las dos listas se desalinean sin que nada lo detecte, y el dato es
   del paso. El campo opcional en el JSON viaja con el paso, no pide migración y ya lo valida
   `.strict()`.
2. **Un módulo `evidencias` propio.** Descartada: sus reglas son las de la ejecución y el empaque
   (quién ejecuta, quién empaca, estados), y terminar necesita contar fotos. Un módulo aparte
   tendría que importar el contrato de `asignaciones` y `asignaciones` el suyo: ciclo.
3. **Subir los bytes por una Server Action**, como la imagen de receta (QC-25). Descartada: la
   decisión cerrada pide subida directa firmada, y un cuerpo de hasta 5 MB por foto por la
   aplicación cuesta memoria y tiempo de función.
4. **Detectar el reordenado con la posición de origen que mandara el cliente** (el editor ya tiene
   una `key` por paso). Descartada: el servidor no puede fiarse de ese dato, y la comprobación por
   contenido (§ 5.8) no necesita nada del cliente.
5. **Marcar las fotos como «fijas» con una columna `fixed_at` al terminar** y contar el bloqueo con
   ella. Descartada: obliga a escribir en `order_step_evidence` dentro de las transacciones de
   terminar, y el estado del pedido ya dice si está en curso.
6. **Validar el formato solo en el navegador.** Descartada: la decisión «Formato y tamaño» pide
   validar por contenido, y una petición hecha a mano saltaría el navegador.

## 10. Trazabilidad prevista (R → test)

| R | Test |
|---|---|
| R1, R2, R5 | `tests/unit/recetas-ui/recipe-step-editor.test.tsx`, `tests/unit/recetas-ui/recipe-steps-field.test.tsx`, `tests/unit/shared-ui/switch.test.tsx` |
| R3, R4 | `tests/unit/recetas/recipe-input.test.ts`, `tests/integration/recetas/step-evidence-flag.int.test.ts` |
| R6 | `tests/unit/recetas-ui/recipe-version-form-evidence.test.tsx`, `tests/integration/recetas/step-evidence-flag.int.test.ts` |
| R7 | `tests/unit/recetas/update-recipe.test.ts` |
| R8 | `tests/unit/recetas-ui/recipe-form-evidence-lock.test.tsx`, `tests/unit/recetas/get-recipe-step-lock.test.ts` |
| R9–R12 | `tests/unit/recetas/recipe-step-lock.test.ts`, `tests/unit/recetas/update-recipe.test.ts`, `tests/unit/asignaciones/count-evidence-locking-orders.test.ts` |
| R13–R17, R19–R21, R24, R25 | `tests/unit/shared-ui/step-evidence.test.tsx` |
| R15, R16, R22 | `tests/unit/recetas-ui/step-reader.test.tsx`, `tests/unit/asignaciones-ui/order-execution-evidence.test.tsx`, `tests/unit/asignaciones-ui/packing-order-evidence.test.tsx` |
| R18 | `tests/unit/shared-ui/upload-evidence.test.ts` |
| R23 | `tests/unit/asignaciones-ui/order-execution-evidence.test.tsx`, `tests/unit/asignaciones-ui/packing-order-evidence.test.tsx` |
| R26–R33 | `tests/unit/asignaciones/step-evidence.test.ts`, `request-evidence-upload.test.ts`, `register-evidence.test.ts`, `remove-evidence.test.ts`, `step-evidence-actions.test.ts` (todos en `tests/unit/asignaciones/`) |
| R29 (concurrencia), R30, R31, R39 | `tests/integration/asignaciones/step-evidence-repository.int.test.ts`, `tests/integration/asignaciones/step-evidence-constraints.int.test.ts` |
| R34 | `tests/unit/asignaciones/record-step-move-evidence.test.ts` |
| R35, R37 | `tests/unit/asignaciones/finish-assigned-order.test.ts` |
| R36 | `tests/unit/asignaciones/finish-packing.test.ts` |
| R38 | `tests/unit/asignaciones/register-evidence.test.ts`, `tests/integration/asignaciones/step-evidence-repository.int.test.ts` (cancelar no borra) |
| E2E | `e2e/ejecucion-receta.spec.ts`: paso con evidencia, Siguiente bloqueado, subida simulada, avance, «Falta evidencia», finalizar |
