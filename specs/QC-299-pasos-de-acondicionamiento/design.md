# QC-299 — pasos-de-acondicionamiento · design.md

> Cubre `requirements.md` R1–R39. Sin dependencias nuevas. Dos migraciones (enums; columnas,
> CHECK e índice). Sin tabla nueva. Grafo de código: el MCP responde pero **no tiene indexado este
> worktree** (`list_projects` no lo lista); lo explorado se leyó con Grep/Read sobre
> `.worktrees/QC-299-pasos-de-acondicionamiento`.

## Lo que ya existe

**Términos buscados:** «pasos de acondicionamiento», `conditioningSteps` / `conditioning_steps`,
«asignación requerida» / `requiresAssignment`, «responsables por paso», «guardar el avance».

| Dónde | Qué apareció | Qué se hace |
|---|---|---|
| Board (`feature_list.json`) | Nada igual. QC-211 (pasos de envasado, `done`) es el espejo; QC-214 (evidencia), QC-216, QC-218, QC-219 y QC-283 son la base; QC-291 va después (bloqueada por esta). QC-175/QC-176 hablan de «avance guardado» de PDF: otro dominio. | Se replica QC-211 y se reutiliza lo de QC-214/218/219/283. |
| `specs/` | Solo QC-82 (registro de ejecución), QC-211 y esta ficha. | QC-82: el registro de solo anexar se reutiliza para guardar el avance y los responsables. |
| Código | `Recipe.packingSteps` + `RecipePackingStepsReader` (QC-211); `recipeStepSchema` con `requiresEvidence` (QC-214); `step-evidence.ts`, `evidence-target.ts`, `useStepEvidence`, `StepEvidence` (QC-214); `detectLockedStepChange` + `countEvidenceLockingOrders` (bloqueo por fotos); `OrderExecutionEntry` con `batch_lines` (QC-283); `StepReader` con `initialStepPosition`, `onStepChange`, `renderStepAddon`, `stepBlockReason`, `stepRequest`, `finishLabel`, `finishBusy`; `getConditioningOrder`, `startConditioning`, `finishConditioning`, `ConditioningTeamRepository` (QC-218/219); `getExecutionTrace` y `conditioning-step-details.tsx` (QC-283). | Todo se reutiliza o se extiende; nada se re-crea. Ningún símbolo `conditioningSteps` ni `requiresAssignment` existe. |

**Catálogo (`components/shared/CATALOGO.md`) consultado:** `StepReader`, `StepEvidence`,
`StepDocumentView`, `Switch`, `Tooltip`, `Separator`, `Avatar`, `Button`, `Card`, `Notice`,
`EmptyState`, `ResponsibleAvatars`, `CountdownRing`.

| Pieza | Paso de la regla de decisión | Tablero |
|---|---|---|
| Sección «Acondicionamiento» del formulario | 1. Reutiliza `RecipeStepsField` (tercera instancia) | `FormulaAcondicionamiento{,Tablet,Movil}.dc.html` |
| Switch «Asignación requerida» y switches solo-icono con tooltip | 2. Extiende `RecipeStepEditor` (prop `assignment`, `Switch` + `Tooltip`) | `FormulaAcondicionamiento*` |
| Paso a paso del acondicionador | 1. Reutiliza `StepReader mode="ejecucion"` + `useStepEvidence` | `AcondicionamientoPasos{,Tablet,Movil}.dc.html` |
| Selector «Responsables del paso» | 3. Compone `Button` (`aria-pressed`) + `Avatar`, nuevo en `acondicionamiento/[id]/components/` | `AcondicionamientoPasos*` |
| «Pasos completos» y «Retomaste donde ibas» | 1. Reutiliza `EmptyState` y `Notice` | `AcondicionamientoPasos*` |
| «Datos de lote» bloqueada | 2. Extiende `ConditioningBatchDataForm` (prop `locked`) | `AcondicionamientoPasos*` |
| Responsables y cambio en el recorrido | 3. Compone `Avatar` en `conditioning-step-details.tsx` | `RecorridoPasosAcondicionamiento{,Tablet,Movil}.dc.html` |
| Pasos heredados en el formulario de versión | 1. Calca el bloque de envasado (`StepDocumentView`, `inert`); excepción del pase de diseño, ver P5 | — |

Ninguna pieza sube a `components/shared`: todas tienen una sola ruta consumidora.

## 1. Resumen

Los pasos de acondicionamiento son **una tercera lista de documentos de paso** en la receta
(`conditioning_steps`), como `packing_steps`, con una marca más por paso (`requiresAssignment`). Se
leen por un lector propio que solo recibe `getConditioningOrder`, la autorización de fotos y
`finishConditioning`.

El **avance** y los **responsables** no tienen tabla propia: son anotaciones nuevas del registro
de ejecución de solo anexar (QC-82/QC-283), con una columna `responsible_user_ids`. De ese registro
salen a la vez el punto de retoma (R26), los responsables vigentes por paso (R28) y lo que pinta
el recorrido (R35, R36).

| Quién lee | Por dónde | Recibe |
|---|---|---|
| Administrador (formulario, ficha, versión) | `getRecipe` → `RecipeDetail` | `steps`, `packingSteps`, `conditioningSteps` |
| Operador | `RecipeCatalog.findExecutionContentById` (sin cambios) | solo `steps` |
| Empacador | `RecipePackingStepsReader` (sin cambios) | solo `packingSteps` |
| Acondicionador | `RecipeConditioningStepsReader.findConditioningStepsById` (nuevo) | solo `conditioningSteps` |

## 2. Modelo de datos

### 2.1 Migración 1 — `db/migrations/<ts>_conditioning_step_actions/`

Solo `ADD VALUE` (55P04: un valor nuevo no se usa en la misma transacción; mismo patrón que
`20261015120000_order_execution_conditioning_actions`):

```sql
ALTER TYPE "OrderExecutionAction" ADD VALUE IF NOT EXISTS 'CONDITIONING_STEP_ADVANCE';
ALTER TYPE "OrderExecutionAction" ADD VALUE IF NOT EXISTS 'CONDITIONING_STEPS_COMPLETE';
ALTER TYPE "OrderExecutionAction" ADD VALUE IF NOT EXISTS 'CONDITIONING_RESPONSIBLES_CHANGE';
ALTER TYPE "evidence_phase" ADD VALUE IF NOT EXISTS 'CONDITIONING';
```

`down.sql`: aborta con `RAISE EXCEPTION` si hay filas con esos valores (en
`order_execution_entries` o `order_step_evidence`); si no, recrea los dos tipos con sus valores de
antes (`RENAME` → `CREATE TYPE` → `ALTER COLUMN ... USING` → `DROP TYPE`), quitando y reponiendo
con su texto literal los CHECK que nombran `action` (calco del down de `20261015120000`). Va
después del down de la migración 2.

### 2.2 Migración 2 — `db/migrations/<ts+1>_conditioning_steps/`

```sql
ALTER TABLE "recipes" ADD COLUMN "conditioning_steps" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "order_execution_entries" ADD COLUMN "responsible_user_ids" JSONB;

-- Las anotaciones de paso de acondicionamiento llevan siempre posición.
ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_conditioning_step_has_position"
  CHECK ("action"::text NOT IN ('CONDITIONING_STEP_ADVANCE','CONDITIONING_STEPS_COMPLETE','CONDITIONING_RESPONSIBLES_CHANGE')
         OR "step_position" IS NOT NULL);

-- Responsables solo en esas tres; obligatorios en el cambio; nunca lista vacía.
ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_responsibles_matches_action"
  CHECK (("responsible_user_ids" IS NULL
          OR "action"::text IN ('CONDITIONING_STEP_ADVANCE','CONDITIONING_STEPS_COMPLETE','CONDITIONING_RESPONSIBLES_CHANGE'))
     AND ("action"::text <> 'CONDITIONING_RESPONSIBLES_CHANGE' OR "responsible_user_ids" IS NOT NULL));
ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_responsibles_non_empty_array"
  CHECK ("responsible_user_ids" IS NULL
         OR (jsonb_typeof("responsible_user_ids") = 'array' AND jsonb_array_length("responsible_user_ids") >= 1));

-- Un paso se completa una sola vez por pedido: dos pestañas no pueden completar el mismo (R27).
CREATE UNIQUE INDEX "order_execution_entries_conditioning_step_once"
  ON "order_execution_entries" ("order_id", "step_position")
  WHERE "action"::text IN ('CONDITIONING_STEP_ADVANCE','CONDITIONING_STEPS_COMPLETE');
```

`down.sql`: `DROP INDEX`, `DROP CONSTRAINT` ×3, `DROP COLUMN "responsible_user_ids"`,
`DROP COLUMN "conditioning_steps"`. No toca nada más (R1).

- **Sin relleno** (R1): el `DEFAULT '[]'` deja todas las fórmulas sin pasos de acondicionamiento.
- **Sin tabla nueva, sin cambio de RLS**: `recipes` y `order_execution_entries` ya tienen
  `company_id`, RLS y `FORCE ROW LEVEL SECURITY`; las columnas lo heredan. La autorización real va
  en el caso de uso (`docs/architecture.md > Acceso a datos y autorizacion`).
- **`responsible_user_ids` JSONB y no `uuid[]`**: mismo criterio que `batch_lines`; Prisma no
  modela listas opcionales en Postgres. La forma (`uuid` distintos, al menos uno) la valida zod al
  escribir y al leer, como `conditioningBatchSnapshotSchema`. Sin FK por elemento: el usuario ya se
  valida contra el equipo en el caso de uso (R23).
- `CONDITIONING_HAS_NO_STEP` (`order_execution_entries_conditioning_has_no_step`) no cambia: solo
  nombra las tres acciones de QC-283.

### 2.3 `db/schema.prisma`

`Recipe.conditioningSteps Json @default("[]") @map("conditioning_steps")`;
`OrderExecutionEntry.responsibleUserIds Json? @map("responsible_user_ids")`; tres valores nuevos en
`OrderExecutionAction`; `CONDITIONING` en `EvidencePhase`. Sin comentarios con `QC-`/`R<n>`.
`tests/unit/recetas/schema/recetas-schema.test.ts` pasa a fijar los `Json` de `Recipe` como
`['conditioningSteps', 'packingSteps', 'steps']`.

## 3. Dominio `recetas`

### 3.1 Esquemas (`domain/recipe-input.ts`)

`recipeStepSchema` es `z.object(...).strict().superRefine(...)` y no se puede `.extend`. Se separa la
forma de las reglas:

```ts
const recipeStepShape = { blocks: z.array(recipeStepBlockSchema), requiresEvidence: z.boolean().optional() };
function refineStep(document, ctx) { /* no vacío + tope de 30: el superRefine de hoy, sin cambios */ }

export const recipeStepSchema = z.object(recipeStepShape).strict().superRefine(refineStep);
export const conditioningStepSchema = z
  .object({ ...recipeStepShape, requiresAssignment: z.boolean().optional() })
  .strict()
  .superRefine(refineStep);

const conditioningStepsSchema = z.array(conditioningStepSchema).max(MAX_RECIPE_STEPS);
```

- `recipeStepSchema` sigue **estricto**: un paso del operador o de envasado con `requiresAssignment`
  se rechaza (R5) sin código nuevo.
- `createRecipeSchema.conditioningSteps = conditioningStepsSchema.default([])` (R1).
- `updateRecipeSchema.conditioningSteps = conditioningStepsSchema.optional()`: **omitida =
  conservar** (patrón de `tools`). La confirmación de importación por PDF no la manda, así que un
  reemplazo conserva los pasos cargados a mano (R7, P4). El formulario siempre la manda.
- Los esquemas de versión no cambian: sin `.strict()`, la clave se descarta en el borde (R14).
- La autorización no cambia: `recetas.modificar` en la primera línea de los casos de uso (R6).

### 3.2 Tipos, puerto, casos de uso y adaptador

| Archivo | Cambio |
|---|---|
| `domain/recipe-view.ts` | `ConditioningStepView = RecipeStepView & { requiresAssignment?: boolean }`; `RecipeDetail.conditioningSteps`. |
| `ports/recipe-repository.ts` | `NewRecipe.conditioningSteps?` (ausente = conservar), `RecipeRow.conditioningSteps`, `RecipeOriginalRow.conditioningSteps`. |
| `domain/create-recipe.ts` | pasa `conditioningSteps`. |
| `domain/update-recipe.ts` | pasa `conditioningSteps` solo si viene; `assertStepsNotLocked` añade `detectLockedStepChange(existing.conditioningSteps, data.conditioningSteps)` cuando viene (R34). |
| `domain/update-recipe-version.ts` | `conditioningSteps: []` explícito (R14). |
| `domain/get-recipe.ts` | `conditioningSteps: shared.conditioningSteps` (la original si es versión: R15). |
| `adapters/driven/persistence/recipe-prisma.ts` | `select` del `parent`, `toRecipeRow` con un `toConditioningSteps` tolerante (descarta el elemento inválido conservando el orden, como `toSteps`), escritura en alta y reemplazo **solo si `data.conditioningSteps !== undefined`**; versión escribe `[]`. |

`detectLockedStepChange` ya ignora `requiresEvidence` en su forma canónica; se le añade
`requiresAssignment` a lo ignorado: encender un switch nunca es mover.

### 3.3 Lector nuevo `RecipeConditioningStepsReader`

```ts
// lib/modules/recetas/domain/recipe-conditioning-steps-reader.ts
export interface RecipeConditioningStepsReader {
  /** Incluida una receta dada de baja. Una versión devuelve los de su original. `null` = no existe o es de otra empresa. */
  findConditioningStepsById(id: RecipeId, companyId: string): Promise<readonly ConditioningStepView[] | null>;
}
```

En `recipe-catalog-prisma.ts`, calco de `findPackingStepsById`: `recipeCompanyScope` sin
`deletedAt: null` (R33), `select: { conditioningSteps: true, parent: { select: { conditioningSteps: true } } }`,
función pura exportada `toRecipeConditioningSteps(row)`. `findExecutionContentById` y
`findPackingStepsById` **no cambian** su `select` (R30).

## 4. Dominio `asignaciones`

### 4.1 Registro de ejecución

`execution-entry.ts`: tres acciones nuevas en `EXECUTION_ACTIONS` y en `ConditioningAction`
(`conditioning-trace.ts`): `conditioning_step_advance`, `conditioning_steps_complete`,
`conditioning_responsibles_change`. Variantes de `NewExecutionEntry`:

```ts
| (Base & { action: 'conditioning_step_advance' | 'conditioning_steps_complete'; stepPosition: number;
            responsibleUserIds: readonly string[] | null })
| (Base & { action: 'conditioning_responsibles_change'; stepPosition: number; responsibleUserIds: readonly string[] })
```

`ExecutionEntryRecord.responsibleUserIds: readonly string[] | null`. Esquema zod
`conditioningResponsiblesSchema = z.array(z.string().uuid()).min(1).refine(distintos)` en
`conditioning-trace.ts`, usado por `execution-log-prisma.ts` al escribir y al leer (fila corrupta
lanza). El adaptador traduce la violación de `order_execution_entries_conditioning_step_once` a un
desenlace `'step_already_completed'`. `PHASE_OF_ACTION` mapea las tres a `'conditioning'`: la
duración de la fase sigue midiéndose de `conditioning_start` a `conditioning_finish` (R38).
`ExecutionLogRepository` no gana métodos: se lee con `listEntriesForOrders(companyId, [orderId])`.

### 4.2 Avance (`domain/conditioning-steps.ts`, puro)

```ts
export type ConditioningProgress = {
  readonly completedCount: number;                       // recortado a steps.length
  readonly responsibles: ReadonlyMap<number, readonly string[]>; // vigentes por posición
};
export function conditioningProgress(entries, stepsCount): ConditioningProgress;
export function sameResponsibles(a, b): boolean;           // como conjunto
```

- `completedCount` = mayor `stepPosition` de `conditioning_step_advance` /
  `conditioning_steps_complete` (el índice único garantiza que solo se escribe el siguiente).
- Responsables vigentes de una posición = los de la **última** anotación de esa posición que los
  traiga (advance, complete o change). Nada se edita ni se borra (R28).

### 4.3 Caso de uso nuevo `recordConditioningStep`

Entrada (`z.strictObject`): `{ orderId: uuid, stepPosition: int ≥ 1, responsibleUserIds: uuid[] (default []) }`.
Salida: `{ completedCount, allCompleted }`.

1. `requirePermission(actor, 'acondicionamiento.modificar')` antes de validar (R31).
2. Resumen vivo `EN_ACONDICIONAMIENTO` de la empresa con `conditionedBy === actor.id`; si no,
   `OrderNotConditionableError` / `OrderConditioningTakenError` / `OrderNotFoundError` como
   `finishConditioning` (R29, R32).
3. `steps = findConditioningStepsById(summary.recipeId, companyId) ?? []`; `step = steps[pos-1]`;
   sin paso → `ConditioningStepOutOfOrderError` (R27).
4. Responsables: si `step.requiresAssignment`, exigir ≥ 1, distintos y ⊆ equipo
   (`team.listByOrderInCompany`) ∪ {actor} → si no, `ConditioningResponsiblesRequiredError` /
   `ConditioningResponsibleNotAllowedError`; si no tiene la marca, exigir lista vacía (R22, R23).
5. `progress = conditioningProgress(entries, steps.length)`:
   - `pos === completedCount + 1` → **completar**: si `step.requiresEvidence` y no hay foto de
     fase `conditioning` en `pos` → `EvidenceRequiredError` (R21). Anota
     `conditioning_steps_complete` si `pos === steps.length`, si no `conditioning_step_advance`, con
     `responsibleUserIds` o `null` (R35). Desenlace `'step_already_completed'` →
     `ConditioningStepOutOfOrderError`.
   - `pos <= completedCount` → **revisitar**: si el paso tiene la marca y el conjunto difiere de
     `progress.responsibles.get(pos)`, anota `conditioning_responsibles_change` (R28); si no,
     no escribe nada.
   - `pos > completedCount + 1` → `ConditioningStepOutOfOrderError` (R27).

Errores nuevos en `domain/errors.ts` y en `errores` (`error-codes.ts`, `error-catalog.ts`):
`conditioning_step_out_of_order` («La pantalla quedó desactualizada. Recárgala para seguir.»),
`conditioning_responsibles_required` («Elige al menos un responsable para avanzar.»),
`conditioning_responsible_not_allowed` («Solo puedes elegir a personas del equipo o a ti.»),
`conditioning_steps_pending` («Completa los pasos de acondicionamiento antes de terminar.»).

### 4.4 `getConditioningOrder`

`ConditioningOrderDetail.conditioningSteps: ConditioningStepsView | null`:

```ts
export type ConditioningStepsView = {
  readonly steps: readonly ConditioningStepView[];
  readonly completedCount: number;
  readonly responsibles: readonly { stepPosition: number; userIds: readonly string[] }[];
  /** El equipo en su orden y, primero, el propio acondicionador con `isSelf`. */
  readonly candidates: readonly { userId: string; displayName: string; isSelf: boolean }[];
  readonly evidence: readonly StepEvidenceView[];
};
```

Solo se lee **si** `status === 'EN_ACONDICIONAMIENTO' && conditionedBy === actor.id`; si no, `null`
**sin llamar al lector** (R17). Con lista vacía también `null` (R19). Evidencia con
`readStepEvidence(..., 'conditioning', steps)`. Deps nuevas: `conditioningSteps`, `log`,
`evidence`, `storage`. Los nombres salen de la lectura de personas que ya hace
`composeConditioningOrderDetail`.

### 4.5 `finishConditioning`

Tras comprobar actor y estado y antes de los datos de lote: si hay pasos y
`completedCount < steps.length` → `ConditioningStepsPendingError` (R25, P1). Deps nuevas:
`conditioningSteps`, `log`. `saveConditioningBatchData` no cambia (P1).

### 4.6 Fotos de evidencia

- `step-evidence.ts`: `EVIDENCE_PHASES = ['manufacturing', 'packing', 'conditioning']`.
- `evidence-target.ts`: fase `conditioning` → `requirePermission('acondicionamiento.modificar')`,
  resumen `EN_ACONDICIONAMIENTO` con `conditionedBy === actor.id`, pasos de
  `findConditioningStepsById`. `requireEvidenceAccess` añade `acondicionamiento.modificar`.
- `count-evidence-locking-orders.ts`: `PHASE_BY_STATUS.EN_ACONDICIONAMIENTO = 'conditioning'` (R34).
- `read-order-evidence.ts` / `order-evidence.ts`: `OrderEvidence.conditioning` (grupos por paso),
  para la cifra de fotos del recorrido (R35). La ficha de producto terminado no lo pinta.
- Adaptadores de `order_step_evidence`: mapeo `conditioning ↔ CONDITIONING`.

### 4.7 Recorrido (`get-execution-trace.ts`)

Variantes nuevas de `ExecutionTraceDetailStep`:

```ts
| (DetailStepBase & { action: 'conditioning_step_advance' | 'conditioning_steps_complete';
     stepPosition: number; reason: null; responsibles: readonly TracePerson[] })
| (DetailStepBase & { action: 'conditioning_responsibles_change';
     stepPosition: number; reason: null; previous: readonly TracePerson[]; responsibles: readonly TracePerson[] })
```

`TracePerson = { userId; displayName: string | null }`. `previous` = responsables vigentes de esa
posición **antes** de la anotación (calculado recorriendo las anotaciones en orden). Los ids de
responsables entran en la misma `findPeopleByIds`. `list-execution-traces.ts` no cambia la lista
(R37), solo compila con las acciones nuevas.

### 4.8 Server Action

`order-conditioning-actions.ts`: `recordConditioningStepAction(input)` → `{ status: 'success', data }`
o el `ErrorState` traducido, calco de `saveConditioningBatchDataAction`. Composición en
`lib/composition/index.ts`: `createRecordConditioningStep`, deps nuevas de `getConditioningOrder`,
`finishConditioning` y de los casos de uso de fotos.

## 5. UI

### 5.1 Formulario de fórmula (tablero `FormulaAcondicionamiento*`)

- `recipe-step-editor.tsx`: el `Switch` de evidencia pasa a **solo icono** (`CameraIcon`), envuelto
  en `Tooltip` con el texto completo, que abre con hover **y con foco** (R10); nombre accesible
  completo con paso y sección. Prop nueva opcional `assignment?: RecipeStepSwitchControl` (icono
  `UserPlus`), mismo patrón. Debajo del editor, la línea de ayuda de cada switch encendido. Sin
  `assignment` el editor pinta lo de hoy salvo el switch solo-icono, que el tablero aprobado aplica
  a las tres secciones.
- `recipe-steps-field.tsx`: prop `showAssignmentSwitch?: boolean` (por defecto `false`); el resumen
  `<prefijo>-evidence-summary` añade «· N piden responsables» cuando la hay (R11). Prefijo
  `recipe-conditioning-step`; ayuda por `optionalHelp`.
  - **Enmienda 2026-10-21 (implementación):** la ayuda es una prop nueva `optionalDescription`
    (texto visible bajo el título, como el tablero, más la marca «(opcional)») y no
    `optionalHelp`, que pinta un tooltip «!» y pide un texto «Qué son los pasos de…» que no fija
    ningún documento. «Envasado» sigue con `optionalHelp` como estaba.
- `recipe-form.tsx` / `recipe-form-state.ts`: `conditioningSteps` en estado, carga (R13) y payload
  (R12); `extractStepErrors(issues, 'conditioningSteps')`; tercera sección tras un segundo
  `Separator` (`recipe-form-conditioning-separator`) (R8). La vista previa no cambia.
- `recipe-version-form.tsx`: bloque `inert` `recipe-version-inherited-conditioning-steps` /
  `recipe-version-conditioning-steps-empty` («La receta original no tiene pasos de
  acondicionamiento.») (R16).

### 5.2 Pantalla de acondicionamiento (tablero `AcondicionamientoPasos*`)

- `page.tsx`: `stepsPending = order.conditioningSteps !== null && completedCount < steps.length`;
  `canFinish` sigue igual; `Terminar` se oculta mientras `stepsPending` (R25).
  - **Enmienda 2026-10-21 (implementación):** `page.tsx` no cambia. `stepsPending` y el ocultar
    «Terminar» viven en `conditioning-order-screen.tsx`, que pasa a `'use client'`: los completados
    se toman como el máximo entre lo que trae el servidor y lo que devolvió la última
    `recordConditioningStepAction`, para que «Terminar» aparezca justo al completar y para
    «Volver a los pasos» sin depender del refresco de la ruta. El comportamiento de R25 no cambia.
- `conditioning-steps-panel.tsx` (nuevo, `'use client'`): `StepReader mode="ejecucion"`,
  `minStepSeconds={5}`, `title="Pasos de acondicionamiento"`, `finishLabel="Completar pasos"`,
  `initialStepPosition={completedCount + 1}`. `renderStepAddon` compone el addon de
  `useStepEvidence({ phase: 'conditioning' })` y `ConditioningStepResponsiblesPicker`;
  `stepBlockReason` = el de evidencia o «Elige al menos un responsable para avanzar.» (R20–R22).
  `onStepChange({direction: 'advance', position})` y `onFinish` llaman a
  `recordConditioningStepAction` con el paso que se deja; ante error, `stepRequest` devuelve al
  paso y se pinta el error. Con todo completado pinta «Pasos completos» (`EmptyState`) con «Volver
  a los pasos» (R24). `Notice` «Retomaste donde ibas» si `0 < completedCount < steps.length` al
  montar (R26). Testid raíz `conditioning-order-steps`.
- `conditioning-step-responsibles-picker.tsx` (nuevo): botones `aria-pressed` con `Avatar`,
  mínimo 48 px de alto, el actor primero con «(tú)», contador «N elegidos» / «Ninguno elegido».
- `conditioning-batch-data-form.tsx`: prop `locked?: boolean` → campos y botón `disabled`, nota «Al
  completar los pasos» (R25). Sin la prop, nada cambia.
- `conditioning-order-screen.tsx`: monta el panel solo con `order.conditioningSteps !== null`; si
  no, la pantalla de hoy byte a byte (R19).

### 5.3 Recorrido (tablero `RecorridoPasosAcondicionamiento*`)

- `execution-trace-format.ts`: etiquetas «Avanzar», «Completar pasos», «Cambio de responsables».
- `execution-timeline.tsx`: delega en `conditioning-step-details.tsx` (`ConditioningStepBody`:
  «Responsables» + avatares; `ConditioningResponsiblesChangeBody`: «Antes» tachado → nuevo) y
  pinta «N fotos de evidencia» con `evidence.data.conditioning` en la última anotación de esa
  posición. «Paso N» sin «de M» (P2).

### 5.4 Multiplataforma

Sin excepción: el paso a paso es el modo `ejecucion` de `StepReader`; el selector usa objetivos de
48 px y `aria-pressed` (no depende de hover); el tooltip de los switches abre también con foco y el
nombre accesible lleva el texto completo, así que en táctil nada queda escondido tras un hover.
  **Enmienda 2026-10-21 (decisión del humano tras la revisión 1):** en táctil la ayuda también abre al mantener pulsado el switch 500 ms (`IconSwitch` de `recipe-step-editor.tsx` controla el `open` del `Tooltip`; el componente compartido no cambia); soltar tras la pulsación larga no cambia el switch y la ayuda se cierra al tocar fuera.

## 6. Contratos (resumen)

| Contrato | Antes | Después |
|---|---|---|
| `createRecipeSchema` | `steps`, `packingSteps` | + `conditioningSteps` (`default([])`) |
| `updateRecipeSchema` | `steps`, `packingSteps` | + `conditioningSteps` (opcional = conservar) |
| `recipeStepSchema` | `blocks`, `requiresEvidence?` | sin cambios (estricto) |
| `conditioningStepSchema` | — | + `requiresAssignment?` |
| `RecipeDetail` | … | + `conditioningSteps` |
| `RecipeConditioningStepsReader` | — | `findConditioningStepsById` |
| `ConditioningOrderDetail` | … | + `conditioningSteps: ConditioningStepsView \| null` |
| `recordConditioningStep` | — | `{orderId, stepPosition, responsibleUserIds}` → `{completedCount, allCompleted}` |
| `ExecutionEntryRecord` | … | + `responsibleUserIds` |
| `EvidencePhase` | `manufacturing`, `packing` | + `conditioning` |
| `OrderEvidence` | `manufacturing`, `packing` | + `conditioning` |
| `RecipeStepEditorProps` | `evidence?` | + `assignment?` |
| `RecipeStepsFieldProps` | … | + `showAssignmentSwitch?` |
| `ConditioningBatchDataFormProps` | … | + `locked?` |

## 7. Dependencias

Ninguna nueva: zod, Prisma, tiptap, dnd-kit, lucide-react y los componentes del catálogo.

## 8. Coordinación con otras fichas

- **QC-291** (rediseño de la pantalla del operario, `pending`, bloqueada por esta): toca
  `StepReader` y la ejecución del operador. Esta ficha **no cambia** `StepReader`; si QC-291 lo
  cambia, este panel lo hereda. Va después (decisión cerrada).
- **Fichas en vuelo de la misma persona** (QC-203, QC-288): `scripts/archivos-en-vuelo.mjs` dirá si
  alguna toca `recipe-form.tsx`, `composition/index.ts` o `schema.prisma`; si choca, la segunda
  rebasa.
- `lib/composition/index.ts`, `db/schema.prisma` y `error-codes.ts` son de alto tráfico: rebasar
  sobre `origin/dev` antes de cada tanda.

## 9. Alternativas descartadas

- **A. Tabla `order_conditioning_step_progress` (una fila por pedido y paso, con responsables).**
  Descartada. Cambiar un responsable sería un `UPDATE`, y la decisión pide que cada cambio sea un
  registro nuevo sin editar el anterior (heredado de QC-82). Además el recorrido tendría que leer
  dos fuentes. El registro de ejecución ya es de solo anexar, ya alimenta el recorrido y ya
  guarda la foto de los datos de lote en una columna JSON.
- **B. `requiresAssignment` en el `recipeStepSchema` compartido.** Descartada: pasos del operador y
  de envasado aceptarían una marca que no tiene efecto, y la decisión la limita a
  acondicionamiento. Con un esquema propio, el estricto de siempre la rechaza.
- **C. Guardar el avance en el navegador (`localStorage`).** Descartada: la decisión pide guardarlo
  en el servidor; otro dispositivo o una sesión nueva perdería el paso y los responsables.
- **D. Anotar también «Retroceder» y retomar en el último paso visto.** Descartada por defecto
  (P6): cada vuelta atrás escribiría una fila sin valor para el recorrido, y el tablero no la
  muestra.
- **E. Añadir `conditioningSteps` a `RecipeCatalog` o a `RecipeExecutionContent`.** Descartada por
  lo mismo que QC-211 §10.C/D: la separación de R30 dejaría de cumplirse por construcción.
- **F. `conditioningSteps` con `default([])` en la edición.** Descartada: el reemplazo por PDF no la
  manda y borraría los pasos cargados a mano (R7).
- **G. Guardar «de M» en cada anotación para pintar «Paso N de M».** Pendiente de P2; descartada
  por defecto porque añade una columna para una cifra que el tablero solo usa como texto.

## 10. Riesgos

- **Editar la fórmula con un pedido a medias** (lectura en vivo): si se añaden pasos tras
  «Completar pasos», el pedido vuelve a tener pasos pendientes; si se quitan, `completedCount` se
  recorta. Mover/quitar con fotos lo impide R34; con solo responsables, no (P3).
- **Dos pestañas**: el índice único hace que solo una complete cada paso; la otra recibe
  `conditioning_step_out_of_order` y recarga.
- **Doble envío de «Completar pasos»**: `finishBusy` + el mismo índice único.

## 11. Trazabilidad prevista

| Requisito | Test previsto |
|---|---|
| R1 | `tests/unit/recetas/recipe-input.test.ts`; `tests/unit/recetas/schema/recetas-schema.test.ts`; `tests/integration/recetas/recipe-conditioning-steps-migration.int.test.ts` |
| R2, R3, R5 | `tests/unit/recetas/recipe-input.test.ts` |
| R4, R6, R14, R15 | `tests/unit/recetas/conditioning-steps.test.ts`; `tests/integration/recetas/conditioning-steps.int.test.ts` |
| R7 | `tests/unit/documentos/confirm-formula-import.test.ts`; `tests/unit/recetas/conditioning-steps.test.ts` |
| R8, R11, R12, R13 | `tests/unit/recetas-ui/recipe-form-conditioning-steps.test.tsx` |
| R9, R10 | `tests/unit/recetas-ui/recipe-step-editor.test.tsx`; `tests/unit/recetas-ui/recipe-steps-field.test.tsx` |
| R16 | `tests/unit/recetas-ui/recipe-version-form.test.tsx` |
| R17, R19, R31 | `tests/unit/asignaciones/get-conditioning-order.test.ts`; `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx` |
| R18, R20, R22, R24, R26 | `tests/unit/asignaciones-ui/conditioning-steps-panel.test.tsx`; `tests/unit/asignaciones-ui/conditioning-step-responsibles-picker.test.tsx` |
| R21, R23, R27, R28, R29 | `tests/unit/asignaciones/record-conditioning-step.test.ts`; `tests/unit/asignaciones/conditioning-steps.test.ts` |
| R25 | `tests/unit/asignaciones/finish-conditioning.test.ts`; `tests/unit/asignaciones-ui/conditioning-batch-data-form.test.tsx` |
| R30 | `tests/unit/recetas/recipe-conditioning-steps-reader.test.ts`; `tests/unit/asignaciones/get-conditioning-order.test.ts` |
| R32, R33 | `tests/integration/asignaciones/conditioning-steps-progress.int.test.ts`; `tests/integration/recetas/conditioning-steps.int.test.ts` |
| R34 | `tests/unit/recetas/conditioning-steps.test.ts`; `tests/unit/asignaciones/count-evidence-locking-orders.test.ts` |
| R35, R36, R38 | `tests/unit/asignaciones/get-execution-trace.test.ts`; `tests/unit/asignaciones/execution-trace.test.ts`; `tests/ui/dashboard/execution-trace-detail.test.tsx` |
| R37 | `tests/unit/asignaciones/list-execution-traces.test.ts` |
| R39 | `e2e/pasos-de-acondicionamiento.spec.ts` |
