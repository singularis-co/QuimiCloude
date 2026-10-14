# QC-283 — acondicionamiento-en-el-recorrido · design.md

> **Estado (2026-10-14, spec_author).** Completo y pendiente de aprobación humana. El pase `/design`
> (P0) está aprobado y sus tableros se citan en `## UI`.
>
> Las decisiones citadas como «DC» son filas de `requirements.md > Decisiones cerradas`. Las citadas
> como «R<n>» son requisitos de ese mismo archivo.
>
> Respecto a la versión de solo contratos, cambian:
>
> - **C2.9:** `ExecutionTrace` gana `totalDuration`.
> - **C3.3:** las pausas sustituyen a `BLOQUEADO` (DC P10).
> - **C3.4:** la fila pasa de `durations` a `totalDuration` (DC «¿Duración en la lista y en el
>   detalle?»).
> - **C2.10 y C2.11** se funden en una sola definición de deps.
> - **C4:** cambian los fixtures.

## Lo que ya existe

**Búsqueda previa** (`docs/specs.md > Antes de especificar`):

- En `specs/` no hay ningún spec que registre el acondicionamiento en el recorrido.
- QC-284 toca `FinishedBatchLabels` y va después de esta feature (DC P4).
- QC-167 y QC-261 son el recorrido y su rediseño, y esta feature los amplía.

### Backend

- **Registro de ejecución (QC-82).** Está en `order_execution_entries` / `OrderExecutionEntry`, con
  RLS activada y forzada.
  - Solo se inserta. Lo vigila el test estático
    `tests/unit/asignaciones/execution-log-prisma.test.ts > R31`: sin `update`, `upsert`,
    `delete`, `$executeRaw` ni `$queryRaw` en el adaptador.
  - El puerto es `ExecutionLogRepository` y el adaptador `execution-log-prisma.ts`.
  - La transacción es `ExecutionTransaction`, cableada en `lib/composition/index.ts`
    (`executionTransaction`).
- **El equipo de acondicionamiento (QC-218) vive en `order_conditioning_team_members`.**
  - Se escribe una sola vez, al Comenzar, dentro de `executionTransaction`
    (`writers.team.insertAll`). Nunca se edita ni se borra.
  - Por eso **ya es foto del momento** (DC «¿Dónde se guarda la foto?»).
  - `workGroupName` es la foto del nombre del grupo (DC P9).
  - Se lee con `ConditioningTeamRepository.listByOrderInCompany`.
  - No tiene `@relation` con `OrderExecutionEntry`: las FK están escritas a mano.
- **Comenzar** (`start-conditioning.ts`) ya corre en `executionTransaction`, pero no anota.
- **Guardar datos de lote** (`save-conditioning-batch-data.ts`) escribe con
  `FinishedBatchLabels.writeForOrder`, que abre **su propia** transacción
  (`finished-batch-labels-prisma.ts`). No anota.
- **Terminar** (`finish-conditioning.ts`) llama a `orders.finishConditioningAliveById` **fuera de
  toda transacción**. No anota.
- **Lectura del recorrido (QC-167).**
  - `buildExecutionTrace` (`execution-trace.ts`) da una sola `duration: TraceDuration`, de reloj,
    de la primera anotación a la última.
  - `listExecutionTraces` y `getExecutionTrace` la exponen.
  - Llegan al front por `listExecutionTracesAction` y `getExecutionTraceAction`
    (`execution-trace-actions.ts`).
  - El front deduce «En curso» de `duration.kind === 'open'`.
- **Supervisor = quien comienza.** `startConditioningAliveById` deja al actor como
  `conditioned_by`, y Comenzar exige `acondicionamiento.modificar` (Administrador de
  acondicionamiento, QC-216). Así que el supervisor es el `userId` de la anotación de Comenzar, sin
  columna nueva.
- **No existe acción «pausa».** `resume` se anota cada vez que alguien reentra en un pedido
  `EN_CURSO` (`start-assigned-order.ts`, QC-82 D12). Es la única señal de pausa del registro (C3.3).

### Front y catálogo (`components/shared/CATALOGO.md`, filas consultadas)

| Pieza | Fila del catálogo | Uso en QC-283 | Paso de la regla de decisión |
|---|---|---|---|
| `StatusBadge` | `components/shared/status-badge.tsx` | Insignias «En curso» (`progress`) y «Sin cierre anotado» (`muted`) en las tarjetas de duración | 1 · reutiliza |
| `ResponsibleAvatars` | `components/shared/responsible-avatars.tsx` | Personas de la fila (firmantes + equipo); límite 3 y «+N» ya cubiertos | 1 · reutiliza, sin cambios |
| `DataTable` | `components/shared/data-table/index.ts` | La lista del dashboard, sin cambios de columnas | 1 · reutiliza |
| `Table` y partes | `components/ui/table.tsx` | Tabla de líneas de la foto | 1 · reutiliza |
| `Avatar`, `AvatarFallback` | `components/ui/avatar.tsx` | Supervisor, quien guardó, quien terminó, miembros del equipo | 1 · reutiliza |
| `Card` | `components/ui/card.tsx` | Contenedor de la línea de tiempo (ya lo usa) | 1 · reutiliza |
| `Skeleton` | `components/ui/skeleton.tsx` | Esqueleto del detalle (ya existe en la ruta) | 1 · reutiliza |
| `ArrowLink` | `components/shared/arrow-link.tsx` | «Volver a la lista» (sin cambios) | 1 · reutiliza |
| `avatarTone`, `getInitials`, `EMPTY_MARK` | `lib/shared/ui/*` | Igual que hoy en `StepPerson` | 1 · reutiliza |

**Piezas nuevas:** `ConditioningStartBody`, `ConditioningBatchSaveBody` y
`ConditioningBatchLinesTable`, en `app/(private)/dashboard/recorrido/[id]/components/`.

- Son **paso 3 (compón)**: subcomponentes internos de la ruta que solo componen piezas ya
  catalogadas.
- Sí introducen UI visible nueva, por eso tienen tablero aprobado (`## UI`).
- No suben a `components/shared`: una sola ruta los usa.
- No ganan fila en el catálogo.

**Ninguna librería nueva** (R35). Los iconos son de `lucide-react`, que ya está en
`docs/dependencias.md`: `ClipboardList`, `Download`, `ClipboardCheck` y `Users`.

## Contratos

### C1. Esquema (`db/schema.prisma` + 2 migraciones)

**C1.1 — Tres valores nuevos de `OrderExecutionAction`** (al final, sin reordenar):

```prisma
enum OrderExecutionAction {
  START
  RESUME
  ADVANCE
  GO_BACK
  CANCEL
  FINISH
  PACK_START
  PACK_FINISH
  CONDITIONING_START
  CONDITIONING_BATCH_SAVE
  CONDITIONING_FINISH
}
```

- En el dominio (`execution-entry.ts`) se llaman `'conditioning_start'`,
  `'conditioning_batch_save'` y `'conditioning_finish'`.
- `EXECUTION_ACTION_TO_PRISMA` (`execution-log-prisma.ts`) gana sus tres pares.

**C1.2 — Una columna nueva en `OrderExecutionEntry`, para la foto del guardado de lote:**

```prisma
model OrderExecutionEntry {
  // ...columnas actuales sin cambios...
  batchLines   Json?                @map("batch_lines")
}
```

- SQL: `"batch_lines" JSONB NULL`.
- No hay columna para el supervisor: es el `user_id` de `CONDITIONING_START`.
- No hay columna para el equipo: se lee de `order_conditioning_team_members`.
- Quién guardó es el `user_id` de `CONDITIONING_BATCH_SAVE`.
- `JSONB` ya tiene precedente en el esquema (`Recipe.steps`, `Recipe.packingSteps`).

**C1.3 — Forma exacta de la foto** (un elemento por línea enviada en ese guardado):

```jsonc
// batch_lines: array JSON, al menos 1 elemento, en el orden en que llegaron las líneas
[
  {
    "batchId": "uuid",                 // product_batches.id
    "presentationId": "uuid",
    "presentationName": "Frasco 1 L",  // nombre de la presentación EN ESE INSTANTE; null si el catálogo no la devolvió
    "lot": "L-2026-001",               // ya normalizado por typedLotSchema (lo que se guardó)
    "expiryDate": "2027-10-14",        // AAAA-MM-DD
    "productionDate": "2026-10-14"     // AAAA-MM-DD (DC «¿Día de producción en la foto?»)
  }
]
```

- Lo que se guarda es lo que se escribió en ese guardado, **no** lo que hay hoy en
  `product_batches` (DC «¿Foto del momento?», R5).
- De la presentación solo entra el **nombre** (DC P5).
- Corregir el lote después solo añade otra fila `CONDITIONING_BATCH_SAVE` con su propia foto.

**C1.4 — Restricciones nuevas** (escritas a mano en la migración, como las tres de QC-82; R7):

```sql
ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_batch_lines_matches_action"
  CHECK (("action"::text = 'CONDITIONING_BATCH_SAVE') = ("batch_lines" IS NOT NULL));

ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_batch_lines_non_empty_array"
  CHECK ("batch_lines" IS NULL OR (jsonb_typeof("batch_lines") = 'array' AND jsonb_array_length("batch_lines") >= 1));

ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_conditioning_has_no_step"
  CHECK ("action"::text NOT IN ('CONDITIONING_START','CONDITIONING_BATCH_SAVE','CONDITIONING_FINISH') OR "step_position" IS NULL);
```

- `order_execution_entries_reason_matches_action` (QC-82) ya impide un `reason` en las acciones
  nuevas.
- La forma de cada elemento **no** se comprueba en SQL: la valida zod al escribir y al leer
  (C2.1, R33).

**C1.5 — Migraciones** (R9, R34).

- Siguen el precedente de `order_status_blocked` / `orders_blocked_index`.
- Son dos migraciones porque Prisma Migrate corre cada una en una transacción, y Postgres no deja
  usar un valor de enum añadido en la misma transacción (55P04).

| Migración | UP | DOWN (`down.sql`) |
|---|---|---|
| `20261015120000_order_execution_conditioning_actions` | Solo los 3 `ALTER TYPE "OrderExecutionAction" ADD VALUE IF NOT EXISTS ...` | Ver la lista de abajo |
| `20261015120100_order_execution_batch_lines` | `ADD COLUMN "batch_lines" JSONB` y los 3 CHECK de C1.4 | `DROP CONSTRAINT` de los 3 CHECK y `DROP COLUMN "batch_lines"` |

El `down.sql` de las acciones:

1. Un bloque `DO` hace `RAISE EXCEPTION` si hay filas con las acciones nuevas, y no cambia nada.
2. Si no las hay:
   - borra los CHECK de QC-82 que nombran `action`;
   - renombra el tipo y crea el de 8 valores;
   - hace `ALTER COLUMN ... TYPE ... USING "action"::text::"OrderExecutionAction"`;
   - borra el tipo viejo;
   - recrea los CHECK con su texto literal de QC-82.

Los `down.sql` se aplican en orden inverso: primero el de `batch_lines`, que quita los CHECK que
nombran los valores nuevos.

- Las fechas `20261015…` son posteriores a la última migración del repo (`20261014180000_…`). Si
  al implementar hay otra posterior en `origin/dev`, se usa la siguiente libre.
- **No hay tabla nueva.** La RLS de `order_execution_entries` sigue activada y forzada (QC-82), y la
  tabla sigue siendo de solo inserción (R8).
- **No hay datos hacia atrás:** ninguna migración contiene `INSERT` ni `UPDATE` (R9).

### C2. Backend: dominio, puertos y casos de uso

Leyenda: **NUEVO** = no existe hoy. **MOD** = cambia, con la firma de antes y la de después.
Errores: los de `domain/errors.ts`, **sin ninguno nuevo**.

#### C2.1 — Tipos compartidos nuevos: `lib/modules/asignaciones/domain/conditioning-trace.ts` (NUEVO)

```ts
import { z } from 'zod';

import type { ConditioningTeamMemberView } from './conditioning-order-view';
import type { TraceDuration } from './execution-trace';

export const CONDITIONING_ACTIONS = ['conditioning_start', 'conditioning_batch_save', 'conditioning_finish'] as const;
export type ConditioningAction = (typeof CONDITIONING_ACTIONS)[number];

/** Una línea de la foto de un guardado de lote. Fechas `AAAA-MM-DD`. */
export type ConditioningBatchSnapshotLine = {
  readonly batchId: string;
  readonly presentationId: string;
  /** El nombre en el instante del guardado; `null` si el catálogo no la devolvió. */
  readonly presentationName: string | null;
  readonly lot: string;
  readonly expiryDate: string;
  readonly productionDate: string;
};

/** Valida `batch_lines` al escribir (adaptador) y al leer (filas corruptas lanzan). */
export const conditioningBatchSnapshotSchema = z
  .array(
    z.strictObject({
      batchId: z.string().uuid(),
      presentationId: z.string().uuid(),
      presentationName: z.string().nullable(),
      lot: z.string().min(1),
      expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      productionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .min(1);

export type ExecutionPhase = 'production' | 'packing' | 'conditioning';

/** Una cifra por fase. `null` = la fase no tiene anotación que la abra (C3.3). */
export type TraceDurations = {
  readonly production: TraceDuration | null;
  readonly packing: TraceDuration | null;
  readonly conditioning: TraceDuration | null;
};

/** Un miembro del equipo en el recorrido. `displayName` `null` si el directorio no lo devuelve. */
export type ExecutionTraceTeamMember = {
  readonly userId: string;
  readonly displayName: string | null;
  readonly origin: ConditioningTeamMemberView['origin'];
};
```

`TraceDuration` es el de `execution-trace.ts`, **sin cambios**: `closed | open | unclosed`, con `ms`.

#### C2.2 — `execution-entry.ts` (MOD)

```ts
// ANTES
export const EXECUTION_ACTIONS = ['start','resume','advance','go_back','cancel','finish','pack_start','pack_finish'] as const;
type StepAction = Exclude<ExecutionAction, 'cancel' | PackingAction>;
export type NewExecutionEntry =
  | (Base & { readonly action: StepAction; readonly stepPosition: number | null })
  | (Base & { readonly action: 'cancel'; readonly stepPosition: number | null; readonly reason: string })
  | (Base & { readonly action: PackingAction; readonly stepPosition: null });
export type ExecutionEntryRecord = { id; orderId; userId; action; stepPosition; reason; occurredAt };

// DESPUES
export const EXECUTION_ACTIONS = [
  'start','resume','advance','go_back','cancel','finish','pack_start','pack_finish',
  'conditioning_start','conditioning_batch_save','conditioning_finish',
] as const;
type StepAction = Exclude<ExecutionAction, 'cancel' | PackingAction | ConditioningAction>;
export type NewExecutionEntry =
  | (Base & { readonly action: StepAction; readonly stepPosition: number | null })
  | (Base & { readonly action: 'cancel'; readonly stepPosition: number | null; readonly reason: string })
  | (Base & { readonly action: PackingAction; readonly stepPosition: null })
  | (Base & { readonly action: 'conditioning_start' | 'conditioning_finish'; readonly stepPosition: null })
  | (Base & {
      readonly action: 'conditioning_batch_save';
      readonly stepPosition: null;
      readonly batchLines: readonly ConditioningBatchSnapshotLine[];
    });
export type ExecutionEntryRecord = {
  readonly id: string;
  readonly orderId: string;
  readonly userId: string;
  readonly action: ExecutionAction;
  readonly stepPosition: number | null;
  readonly reason: string | null;
  /** No nulo solo en `conditioning_batch_save`. */
  readonly batchLines: readonly ConditioningBatchSnapshotLine[] | null;
  readonly occurredAt: Date;
};
```

**Frontera de compilación.** Al ampliar `EXECUTION_ACTIONS`, dejan de compilar los dos
`Record<ExecutionAction, …>` del front:

- `EXECUTION_ACTION_LABELS`, en `execution-trace-format.ts`;
- `EXECUTION_TIMELINE_ACTIONS`, en `execution-timeline.tsx`.

Por eso las tres claves entran en la tanda 0, con los textos e iconos **definitivos** del tablero
(`## UI > Textos`).

#### C2.3 — `ExecutionLogRepository` (puerto MOD solo en semántica; adaptador MOD)

Las firmas del puerto no cambian. Cambia lo que hacen:

- **`append(entry)`.** Escribe `batchLines` como `batch_lines` cuando
  `entry.action === 'conditioning_batch_save'`, y `null` en el resto. Antes de escribir, valida con
  `conditioningBatchSnapshotSchema`.
- **`listEntriesForOrders(...)`.** Selecciona `batchLines` y lo parsea con
  `conditioningBatchSnapshotSchema`. Si no pasa, **lanza** (R33).
- **`listExecutedOrderIds(companyId, filter)`.** Con `filter.userId`, devuelve también los
  pedidos donde esa persona está en el equipo (R30, R32):

  ```text
  pedidos con una anotación de userId dentro del rango
  ∪
  pedidos con fila de equipo de userId Y una anotación CONDITIONING_START dentro del rango
  ```

  - **Implementación sin SQL crudo**, para que el test R31 de QC-82 siga verde. Son dos consultas
    Prisma:
    1. `orderConditioningTeamMember.findMany({ where: { companyId, userId }, select: { orderId } })`;
    2. `orderExecutionEntry.groupBy({ by: ['orderId'], where: { companyId, action: 'CONDITIONING_START', orderId: { in }, occurredAt } })`.

    Se unen sin repetir.
  - La segunda rama exige `CONDITIONING_START`: sin él no se reconstruye nada hacia atrás.
  - Para el equipo, el rango se mide sobre el instante de ese Comenzar (DC P7).
  - Las dos consultas filtran por `companyId` (R10).
- **`listUserIdsWithEntries(companyId)`.** **Sin cambios.** El supervisor y quien guarda entran
  porque firman anotaciones. Los miembros del equipo no se listan aparte (R31).

#### C2.4 — `ExecutionWriters` (`ports/execution-transaction.ts`, MOD)

```ts
// ANTES
export type ExecutionWriters = {
  readonly orders: Pick<OrderCatalog, 'transitionAliveById'> & OrderCancellation;
  readonly packing: Pick<OrderCatalog, 'startPackingAliveById' | 'finishPackingAliveById'>;
  readonly log: ExecutionLogRepository;
  readonly conditioning: Pick<OrderCatalog, 'startConditioningAliveById'>;
  readonly team: ConditioningTeamRepository;
};

// DESPUES
export type ExecutionWriters = {
  readonly orders: Pick<OrderCatalog, 'transitionAliveById'> & OrderCancellation;
  readonly packing: Pick<OrderCatalog, 'startPackingAliveById' | 'finishPackingAliveById'>;
  readonly log: ExecutionLogRepository;
  readonly conditioning: Pick<OrderCatalog, 'startConditioningAliveById' | 'finishConditioningAliveById'>;
  readonly team: ConditioningTeamRepository;
  readonly batches: Pick<FinishedBatchLabels, 'writeForOrder'>; // de '@/lib/modules/inventario'
};
```

En `lib/composition/index.ts` (`executionTransaction`) se cablean sobre `tx`:

- `conditioning.finishConditioningAliveById`:
  `createFinishConditioning({ conditioning: createOrderConditioningRepository(tx) })`;
- `batches`: `createFinishedBatchLabels(tx)`.

`tests/helpers/execution-transaction-on-client.ts` gana los dos campos, con el mismo patrón de
«lanza si este archivo no lo usa».

#### C2.5 — `createFinishedBatchLabels` (inventario, adaptador driven MOD)

```ts
// ANTES
export function createFinishedBatchLabels(): FinishedBatchLabels;
// DESPUES
export function createFinishedBatchLabels(db?: Prisma.TransactionClient): FinishedBatchLabels;
```

- **Sin `db`:** igual que hoy, `writeForOrder` abre su `prisma.$transaction`.
- **Con `db`:** escribe con `writeFinishedBatchLabels(db, …)` **sin abrir** otra transacción.
- QC-283 va antes que QC-284. QC-284 se adapta después a esta firma y a la de C2.7 (DC P4).
- Si choca el índice único de lote, devuelve `{ kind: 'duplicate_lot', batchId: null }`, igual que
  hoy. La transacción queda abortada en Postgres, así que quien la abrió **debe** lanzar (C2.7).
- `listOfOrder` lee por `db` si se le pasa.
- El puerto `FinishedBatchLabels` no cambia de firma. Solo cambia el JSDoc de `writeForOrder`:
  «todo o nada, en la transacción que recibe o en la suya».

#### C2.6 — Comenzar: `createStartConditioning` (MOD interno; firma y deps sin cambios) — R1, R2

Dentro de `transaction.run`, después de `teamWriter.insertAll(team)`:

```ts
await log.append({ action: 'conditioning_start', companyId, orderId, userId: actor.id, stepPosition: null, occurredAt: now });
```

- `'already_mine'` (repetir Comenzar) **no** anota (R2).
- Los errores no cambian.
- Si `append` falla, se deshacen la transición y el equipo (R1).

#### C2.7 — Guardar datos de lote: `createSaveConditioningBatchData` (MOD de deps) — R3, R4, R5

```ts
// ANTES
export type SaveConditioningBatchDataDeps = {
  readonly orders: OrderCatalog;
  readonly batches: Pick<FinishedBatchLabels, 'writeForOrder'>;
  readonly now?: () => Date;
};
// DESPUES
export type SaveConditioningBatchDataDeps = {
  readonly orders: OrderCatalog;
  readonly batches: Pick<FinishedBatchLabels, 'listOfOrder'>;          // fuera de tx: batchId -> presentationId
  readonly presentations: Pick<PresentationCatalog, 'findRefs'>;        // fuera de tx: nombre para la foto
  readonly transaction: ExecutionTransaction;                          // la escritura va por writers.batches
  readonly now?: () => Date;
};
// Firma de la funcion SIN cambios
(actor: Actor | null | undefined, input: unknown) => Promise<void>;
```

Las comprobaciones actuales van primero y no cambian. Después, en este orden:

1. **Fuera de la transacción:**
   - `listOfOrder(companyId, orderId)`. Un `batchId` enviado que no aparece lanza
     `ConditioningBatchNotFoundError(batchId)`, el mismo error que hoy da `batch_not_found`.
   - `presentations.findRefs(presentationIds, companyId)`.
   - Con eso se compone `batchLines`, en el orden de `input.lines` y con los valores ya parseados.
2. **`transaction.run(async ({ batches, log }) => { … })`:**
   - `outcome = await batches.writeForOrder({...})`. Si no es `'written'`, se lanza
     `new ExecutionAbortedError(outcome)`.
   - `await log.append({ action: 'conditioning_batch_save', …, stepPosition: null, batchLines, occurredAt: now })`.
3. **Al salir,** `ExecutionAbortedError` se traduce:
   - `batch_not_found` → `ConditioningBatchNotFoundError(outcome.batchId)`;
   - `duplicate_lot` → `ConditioningBatchDuplicateLotError(outcome.batchId ?? undefined)`.

Cableado: `asignaciones.saveConditioningBatchData` pasa `batches: createFinishedBatchLabels()`,
`presentations: presentationCatalog` y `transaction: executionTransaction`.

#### C2.8 — Terminar: `createFinishConditioning` (MOD de deps) — R6

```ts
// DESPUES (ANTES: sin `transaction`)
export type FinishConditioningDeps = {
  readonly orders: OrderCatalog;
  readonly batches: Pick<FinishedBatchLabels, 'listOfOrder'>;
  readonly transaction: ExecutionTransaction;
  readonly now?: () => Date;
};
```

Dentro de `transaction.run`:

```ts
const result = await conditioning.finishConditioningAliveById(orderId, companyId, actor.id, now);
if (result !== 'ok') throw new ExecutionAbortedError(result);
await log.append({ action: 'conditioning_finish', companyId, orderId, userId: actor.id, stepPosition: null, occurredAt: now });
```

Al salir, se traduce igual que hoy:

| Resultado | Error |
|---|---|
| `'not_conditioner'` | `OrderConditioningTakenError` |
| `'not_conditionable'` | `OrderNotConditionableError` |
| otro | `OrderNotFoundError` |

Los errores previos (`ConditioningBatchDataMissingError`, etc.) no cambian.

#### C2.9 — `buildExecutionTrace` (`execution-trace.ts`, MOD) — R19–R24, R26, R28

```ts
// ANTES
export type ExecutionTrace = { steps; firstAt; lastAt; duration: TraceDuration; goBackCount; userIds };
// DESPUES
export type ExecutionTrace = {
  readonly steps: readonly TraceStep[];
  readonly firstAt: Date;
  readonly lastAt: Date;
  /** !order.deleted && estado no final. */
  readonly active: boolean;
  readonly durations: TraceDurations;       // por fase (C3.3)
  readonly totalDuration: TraceDuration;    // suma de fases (C3.3 > Total)
  readonly goBackCount: number;
  readonly userIds: readonly string[];      // solo quien firma anotaciones, no el equipo
};
// Firma sin cambios
export function buildExecutionTrace(entries: readonly ExecutionEntryRecord[], order: TraceOrderState, now: Date): ExecutionTrace;
```

`CLOSING_ACTIONS` desaparece.

#### C2.10 — Lecturas: `createListExecutionTraces` y `createGetExecutionTrace` (MOD de deps); `ConditioningTeamRepository.listByOrdersInCompany` (NUEVO) — R13, R29, R32

```ts
// ConditioningTeamRepository, NUEVO metodo
/** Filas de esos pedidos, ordenadas por pedido y luego por `position`. Con `orderIds` vacio no consulta. */
listByOrdersInCompany(
  companyId: string,
  orderIds: readonly string[],
): Promise<readonly (ConditioningTeamMemberRow & { readonly orderId: string })[]>;

// ANTES
export type ListExecutionTracesDeps = { log; orders; people };
export type GetExecutionTraceDeps = ListExecutionTracesDeps;
// DESPUES
export type ListExecutionTracesDeps = {
  readonly log: ExecutionLogRepository;
  readonly orders: OrderCatalog;
  readonly people: PeopleDirectory;
  readonly team: Pick<ConditioningTeamRepository, 'listByOrdersInCompany'>;
};
export type GetExecutionTraceDeps = ListExecutionTracesDeps;
```

- `getExecutionTrace` usa `listByOrdersInCompany(companyId, [orderId])`: un solo método para las dos
  lecturas.
- El equipo se pide **solo** para los pedidos que tienen `conditioning_start`. Un equipo sin
  Comenzar anotado no sale (R32).
- Los `userId` del equipo se suman a `findPeopleByIds`, incluidos los dados de baja, como hoy.
- Los nombres son los **actuales**. Solo `workGroupName` es foto (DC P9).
- El permiso (`dashboard.consultar`) se comprueba antes de cualquier puerto, como hoy (R11).
- Cableado: `team: createConditioningTeamRepository()` en los dos casos de uso.

### C3. Contrato hacia el front

Las dos Server Actions **no cambian de firma**. Cambia el tipo de `data`:

| Action (`lib/modules/asignaciones/adapters/driving/execution-trace-actions.ts`) | Devuelve |
|---|---|
| `listExecutionTracesAction(input: ExecutionTraceListInput)` | `{ status: 'success'; data: ExecutionTraceList } \| ErrorState` |
| `getExecutionTraceAction(orderId: string)` | `{ status: 'success'; data: ExecutionTraceDetail } \| ErrorState` |

`ExecutionTraceListInput` no cambia. Cambia la semántica de `userId` (C2.3).

#### C3.1 — `ExecutionTraceDetailStep`: unión discriminada por `action` (MOD, `get-execution-trace.ts`)

```ts
type DetailStepBase = {
  readonly id: string;
  readonly orderId: string;
  /** Quien firma la anotación: en `conditioning_start` es el supervisor; en `conditioning_batch_save`, quien guardó. */
  readonly userId: string;
  readonly userDisplayName: string | null;
  readonly occurredAt: Date;
  readonly gapToNextMs: number | null;
  readonly isGoBack: boolean;
};

export type ExecutionTraceDetailStep =
  | (DetailStepBase & {
      readonly action: Exclude<ExecutionAction, ConditioningAction>;   // producción y empaque, como hoy
      readonly stepPosition: number | null;
      readonly reason: string | null;
    })
  | (DetailStepBase & {
      readonly action: 'conditioning_start';
      readonly stepPosition: null;
      readonly reason: null;
      /** Orden de composición (`position`). Vacío si se comenzó sin equipo. */
      readonly team: readonly ExecutionTraceTeamMember[];
    })
  | (DetailStepBase & {
      readonly action: 'conditioning_batch_save';
      readonly stepPosition: null;
      readonly reason: null;
      /** La foto (C1.3), en el orden en que se enviaron las líneas. */
      readonly lines: readonly ConditioningBatchSnapshotLine[];
    })
  | (DetailStepBase & {
      readonly action: 'conditioning_finish';
      readonly stepPosition: null;
      readonly reason: null;
    });
```

- `stepPosition` y `reason` siguen en todas las variantes, para que el código actual compile sin
  estrechar.
- `batchLines` no sale al front con ese nombre: en la variante se llama `lines`.

#### C3.2 — `ExecutionTraceDetail` (MOD, `get-execution-trace.ts`)

```ts
// ANTES: { orderId; numberText; status; deleted; steps; firstAt; lastAt; duration: TraceDuration; goBackCount }
export type ExecutionTraceDetail = {
  readonly orderId: string;
  readonly numberText: string;
  readonly status: OrderStatus;
  readonly deleted: boolean;
  readonly active: boolean;                 // NUEVO: la marca «En curso» (R28)
  readonly steps: readonly ExecutionTraceDetailStep[];
  readonly firstAt: Date;
  readonly lastAt: Date;
  readonly durations: TraceDurations;       // sustituye a `duration` (R25)
  readonly goBackCount: number;
};
```

#### C3.3 — Reglas de las duraciones (`TraceDurations` y `totalDuration`)

**Cada anotación pertenece a una fase:**

| Fase | Anotaciones | La abre | La cierra (`closed`) | Estado de la fase |
|---|---|---|---|---|
| `production` | `start`, `resume`, `advance`, `go_back`, `finish` | `start` | `finish`, o `cancel` mientras está en curso | `EN_CURSO` |
| `packing` | `pack_start`, `pack_finish` | `pack_start` | `pack_finish`, o `cancel` mientras está en curso | `EN_EMPAQUE` |
| `conditioning` | `conditioning_start`, `conditioning_batch_save`, `conditioning_finish` | `conditioning_start` | `conditioning_finish` | `EN_ACONDICIONAMIENTO` |

Un `cancel` pertenece a la fase de la anotación que lo precede. Si esa fase no está abierta o ya
está cerrada, el `cancel` no cierra ninguna (R24).

**Por fase** se usa la primera anotación que la abre (`open_at`) y, si existe, la primera que la
cierra después (`close_at`):

| Situación | Resultado |
|---|---|
| No hay anotación que la abra | `null` (R22). Un `conditioning` sin `conditioning_start` es `null` aunque haya guardados |
| Hay `close_at` | `closed`, con `ms = close_at − open_at − pausas` (R19) |
| Sin cierre, pedido vivo y en el estado de la fase | `open`, con `ms = now − open_at − pausas` (R20) |
| Sin cierre y el pedido ya no está en la fase, o está dado de baja | `unclosed`, con `ms = última anotación de la fase − open_at − pausas` (R21) |

**Pausas (solo `production`, R23, DC P10):**

```text
pausas = Σ ( resume.occurredAt − anterior.occurredAt )
         por cada `resume` de la fase posterior a `open_at` y no posterior al fin de la medida,
         donde `anterior` es la anotación inmediatamente anterior a ese `resume` en el recorrido
```

- **Por qué la anotación anterior.** No hay acción «pausa». Un `resume` se anota al reentrar en un
  pedido `EN_CURSO`, así que el tramo entre la última anotación y el `resume` es el tiempo que nadie
  estuvo en la pantalla.
- Dos `resume` seguidos (recargar la página) descuentan también el tramo entre ellos.
- El resultado nunca baja de 0.
- `packing` y `conditioning` no tienen pausas.
- `BLOQUEADO` no se descuenta: con la matriz actual, un pedido no puede estar en `BLOQUEADO`
  después de `start` (`order-transitions.ts`, `start-assigned-order.ts`).

**Total** (`totalDuration`, R26):

- `ms` = suma de los `ms` de las fases no `null`. Una fase `null` suma 0, y las esperas entre fases
  no cuentan.
- `kind` = `open` si alguna fase es `open`; si no, `unclosed` si alguna es `unclosed`; si no,
  `closed`. Si las tres fases son `null`, es `{ kind: 'closed', ms: 0 }`.
- El redondeo a minutos es de presentación (front, `## UI > Formato`). El `ms` del total es exacto.

**`active`** = `!order.deleted && !FINAL_STATUSES.includes(order.status)`: lo mismo que hoy daba
`duration.kind === 'open'` (R28).

#### C3.4 — Fila de la lista: `ExecutionTraceRow` (MOD, `list-execution-traces.ts`) — R26, R27, R29

```ts
// ANTES: { orderId; numberText; status; deleted; people; firstAt; lastAt; duration: TraceDuration; goBackCount }
export type ExecutionTraceRow = {
  readonly orderId: string;
  readonly numberText: string;
  readonly status: OrderStatus;
  readonly deleted: boolean;
  readonly active: boolean;                 // NUEVO
  /** Quien firma anotaciones y DESPUES el equipo del Comenzar anotado, en orden de `position`,
   *  sin repetir. Nombres actuales del directorio. */
  readonly people: readonly ExecutionTracePerson[];
  readonly firstAt: Date;
  readonly lastAt: Date;
  readonly totalDuration: TraceDuration;    // sustituye a `duration` (C3.3 > Total)
  readonly goBackCount: number;
};
```

**Por qué `totalDuration` y no `durations`** (cambio respecto a la versión anterior de este
contrato):

- La fila solo pinta el total (DC «¿Duración en la lista y en el detalle?»). El desglose está en el
  detalle.
- Si el front recibiera las tres cifras y las sumara, la regla del total (suma, `null` = 0,
  precedencia del `kind`) viviría en un componente, sin test de dominio.
- Si algún día se ordena por duración (P11), se ordenará por ese total, y ese valor ya es del
  dominio.
- Mandar las tres cifras sería pagar por datos que la fila no usa (R27).

#### C3.5 — `ExecutionTraceList.personOptions` (sin cambios de tipo) — R31

Sale de `listUserIdsWithEntries` como hoy. El supervisor y quien guarda aparecen porque firman. Un
miembro del equipo no aparece por serlo. Elegirlo sí encuentra sus pedidos (C2.3).

### C4. Dónde vive cada tipo y cómo trabaja el front sin esperar al backend

| Tipo | Archivo | Se importa desde |
|---|---|---|
| `ConditioningAction`, `ConditioningBatchSnapshotLine`, `ExecutionPhase`, `TraceDurations`, `ExecutionTraceTeamMember` | `lib/modules/asignaciones/domain/conditioning-trace.ts` (NUEVO) | `@/lib/modules/asignaciones` (`import type`) |
| `ExecutionAction` (ampliado) | `lib/modules/asignaciones/domain/execution-entry.ts` | ídem |
| `ExecutionTraceDetail`, `ExecutionTraceDetailStep` | `lib/modules/asignaciones/domain/get-execution-trace.ts` | ídem |
| `ExecutionTraceRow`, `ExecutionTraceList`, `ExecutionTracePerson` | `lib/modules/asignaciones/domain/list-execution-traces.ts` | ídem |
| `TraceDuration` | `lib/modules/asignaciones/domain/execution-trace.ts` | ídem |

- `lib/modules/asignaciones/index.ts` gana
  `export type { ConditioningAction, ConditioningBatchSnapshotLine, ExecutionPhase, TraceDurations, ExecutionTraceTeamMember } from './domain/conditioning-trace'`.
  `conditioningBatchSnapshotSchema` **no** se reexporta.
- **Fixtures:** `tests/fixtures/execution-trace-conditioning.ts`, tipados con estos tipos. Cubren:
  - un `ExecutionTraceDetail` «terminado», con producción, empaque y las tres anotaciones nuevas.
    El Comenzar tiene equipo mixto: dos miembros por grupo y uno directo;
  - dos guardados. El primero tiene dos líneas. El segundo es la corrección, y en él una línea
    tiene `presentationName: null`;
  - un `ExecutionTraceDetail` «en curso», con un Comenzar sin equipo y `conditioning` `open`;
  - un `ExecutionTraceDetail` «anterior», sin Comenzar anotado y con `conditioning: null`;
  - una fase `unclosed`;
  - `ExecutionTraceRow` con `totalDuration` en los tres `kind`, y uno con más de tres personas
    (firmantes + equipo).

  Los datos son los del tablero `RecorridoAcondicionamiento.dc.html` (variantes `terminado`,
  `en_curso` y `anterior`).
- **Orden para el paralelo:** ver `tasks.md > Tanda 0`.

## UI

### Tableros aprobados (P0, 2026-10-14)

| Pantalla | Escritorio | Tablet | Teléfono (ficha: reutiliza, librerías, comportamiento por plataforma) |
|---|---|---|---|
| Detalle del recorrido | `docs/diseno/canvas/RecorridoAcondicionamiento.dc.html` | `docs/diseno/canvas/RecorridoAcondicionamientoTablet.dc.html` | `docs/diseno/canvas/RecorridoAcondicionamientoMovil.dc.html` |
| Lista del dashboard | `docs/diseno/canvas/DashboardAcondicionamiento.dc.html` | `docs/diseno/canvas/DashboardAcondicionamientoTablet.dc.html` | `docs/diseno/canvas/DashboardAcondicionamientoMovil.dc.html` |

La animación no cambia: esqueleto, entrada escalonada de 40 ms (también para las anotaciones
nuevas), realce al pasar el puntero y fundido al filtrar.

### Detalle del recorrido (`execution-trace-detail.tsx`) — R25, R28

- **Rejilla de datos.** Lleva Estado, las tarjetas de duración que no son `null`, en orden
  producción → empaque → acondicionamiento, y Vueltas atrás. Son 5 tarjetas, o 4 en un pedido
  anterior a la feature.
  - Escritorio: una fila.
  - Tablet: 3 + 2 columnas.
  - Teléfono (contenedor ≤ 760 px): 2 columnas.
- **Tarjeta de duración.** Etiqueta de `PHASE_DURATION_LABELS[phase]` y la cifra con
  `formatElapsed(ms)` en monoespaciada, **sin** sufijo. Además:
  - una fase `open` lleva un `StatusBadge` `progress` «En curso»
    (`data-testid="execution-trace-phase-open"`);
  - una fase `unclosed` lleva un `StatusBadge` `muted` «Sin cierre anotado»
    (`data-testid="execution-trace-phase-unclosed"`).

  Cada tarjeta lleva `data-testid="execution-trace-duration"`, `data-phase` y `data-kind`.
- **Estado:** la marca «En curso» pasa a depender de `trace.active` (R28).

### Línea de tiempo (`execution-timeline.tsx` + `conditioning-step-details.tsx`) — R12–R18

- `TimelineStep` sigue igual para producción y empaque.
  - Para las tres acciones nuevas, el cuerpo cambia según `step.action`, estrechando la unión
    discriminada de C3.1.
  - «Paso N» no se pinta, porque `stepPosition` es `null`.
  - «Hasta la siguiente» se mantiene.
- **`conditioning_start` → `ConditioningStartBody`.**
  - Fila «Supervisor» con `StepPerson`.
  - Etiqueta «Equipo de trabajo · N».
  - Lista (`<ul>`) de filas de 40 px como mínimo: avatar, nombre (o `EMPTY_MARK` con «Sin dato»)
    y, si `origin.kind === 'workGroup'`, el icono `Users`, el texto oculto «Grupo de trabajo:» y
    `workGroupName`. En teléfono, el grupo baja debajo del nombre si no cabe.
  - Con `team` vacío, en vez de la lista va el párrafo «Se comenzó sin equipo de trabajo.» (R14).
- **`conditioning_batch_save` → `ConditioningBatchSaveBody`.**
  - Fila «Guardó» con `StepPerson` y «1 presentación» o «N presentaciones».
  - `ConditioningBatchLinesTable`: una `Table` con las columnas Lote · Presentación · Vencimiento ·
    Día de producción. Lote y fechas van en monoespaciada, con las fechas alineadas a la derecha.
  - Debajo, el párrafo «Datos tal como se guardaron en ese momento», con el icono `Camera`.
  - Con el contenedor de 760 px o menos (`@max-[760px]`, el mismo corte que `DataTable`), la tabla
    se oculta y cada línea se pinta como tarjeta. Arriba van lote y presentación; abajo, «Vence
    <fecha>» y «Producido <fecha>» (R18).
  - Una presentación `null` se pinta como «—» con `aria-label="Sin dato"` (R16).
- **`conditioning_finish`.** Solo `StepPerson` (R17).

### Lista del dashboard (`execution-trace-columns.tsx`) — R26–R29

- Las columnas no cambian.
- **Duración.** La celda pinta `formatTraceTotal(row.totalDuration)`, con
  `data-testid="execution-trace-duration"` y `data-kind`.
  - La cifra va en monoespaciada.
  - El sufijo va en texto pequeño y atenuado, igual que en el tablero.
  - En las tarjetas de teléfono, el mismo texto va en la línea de datos.
- **«En curso».** La marca depende de `row.active` y no se mueve de sitio (junto al número,
  QC-261 P4).
- **Personas.** `ResponsibleAvatars` sin cambios. El orden lo da el backend (R29).

### Formato y textos (`execution-trace-format.ts`)

| Constante o función | Valor |
|---|---|
| `EXECUTION_ACTION_LABELS.conditioning_start` | «Comenzar acondicionamiento» |
| `EXECUTION_ACTION_LABELS.conditioning_batch_save` | «Guardado de datos de lote» |
| `EXECUTION_ACTION_LABELS.conditioning_finish` | «Terminar acondicionamiento» |
| `EXECUTION_TIMELINE_ACTIONS` (en `execution-timeline.tsx`) | `conditioning_start`: `progress` + `ClipboardList`; `conditioning_batch_save`: `neutral` + `Download`; `conditioning_finish`: `success` + `ClipboardCheck` |
| `PHASE_DURATION_LABELS` | `production`: «Duración de producción»; `packing`: «Duración de empaque»; `conditioning`: «Duración de acondicionamiento» |
| `PHASE_OPEN_MARK` / `PHASE_UNCLOSED_MARK` | «En curso» / «Sin cierre anotado» |
| `CONDITIONING_TEXTS` | «Supervisor», «Equipo de trabajo · », «Se comenzó sin equipo de trabajo.», «Grupo de trabajo:», «Guardó», «presentación» / «presentaciones», «Lote», «Presentación», «Vencimiento», «Día de producción», «Vence», «Producido», «Datos tal como se guardaron en ese momento» |
| `formatElapsedMinutes(ms)` (NUEVA) | Trunca a minutos enteros: `1 d 02 h 05 min`, `4 h 33 min`, `28 min`, `0 min` |
| `formatTraceTotal(duration)` (NUEVA) | `formatElapsedMinutes(ms)` + `TRACE_DURATION_SUFFIXES[kind]` (los de hoy) |
| `formatSnapshotDate('2027-10-14')` (NUEVA) | `14/10/2027`. Solo reordena la cadena `AAAA-MM-DD`, sin `Date` ni huso, así que servidor y navegador pintan lo mismo |

- **Redondeo del total: trunca.** Es la misma regla que `formatElapsed` («una duración nunca se
  muestra mayor de lo que fue»). En los ejemplos del tablero, truncar y redondear dan lo mismo.
- `formatTraceDuration` se queda, pero ya no la usan la lista ni el detalle. Si al terminar no
  queda ningún consumidor, se borra junto con su test.

## Plan de tests y trazabilidad

| R | Test (archivo › caso) | Tipo |
|---|---|---|
| R1 | `tests/unit/asignaciones/start-conditioning.test.ts` › «R1: anota conditioning_start en la transacción, tras el equipo»; `tests/integration/asignaciones/conditioning-execution-log.int.test.ts` › «R1: si append falla no quedan ni transición ni equipo» | unit + int |
| R2 | `start-conditioning.test.ts` › «R2: already_mine no anota» | unit |
| R3 | `tests/unit/asignaciones/save-conditioning-batch-data.test.ts` › «R3: compone la foto en el orden enviado, con nombre o null»; `conditioning-execution-log.int.test.ts` › «R3: guardado y anotación en la misma transacción» | unit + int |
| R4 | `save-conditioning-batch-data.test.ts` › «R4: rechazo no anota y conserva el error»; `conditioning-execution-log.int.test.ts` › «R4: lote duplicado no anota; append que falla no guarda datos» | unit + int |
| R5 | `conditioning-execution-log.int.test.ts` › «R5: corregir añade otra foto y la primera no cambia» | int |
| R6 | `tests/unit/asignaciones/finish-conditioning.test.ts` › «R6: anota en la transacción; rechazo no anota»; `conditioning-execution-log.int.test.ts` › «R6: si append falla el pedido no cambia» | unit + int |
| R7 | `tests/integration/asignaciones/order-execution-entries-constraints.int.test.ts` › «R7: …» (seis casos de C1.4); `tests/unit/asignaciones/schema/order-execution-conditioning-migration.test.ts` › «R7: los tres CHECK» | int + estático |
| R8 | `tests/unit/asignaciones/execution-log-prisma.test.ts` › R31 de QC-82 (sigue verde) + «R8: la lectura del equipo para el filtro no actualiza ni borra» | estático |
| R9 | `order-execution-conditioning-migration.test.ts` › «R9: ninguna migración inserta ni actualiza filas» | estático |
| R10 | `tests/integration/asignaciones/execution-log-read.int.test.ts` › «R10: el filtro por equipo no cruza empresas»; `tests/integration/asignaciones/conditioning-team-repository.int.test.ts` › «R10: listByOrdersInCompany filtra por empresa» | int |
| R11 | `tests/unit/asignaciones/get-execution-trace.test.ts` y `list-execution-traces.test.ts` › «R11: sin dashboard.consultar no lee registro ni equipo» | unit |
| R12 | `tests/ui/dashboard/execution-trace-detail.test.tsx` › «R12: nombre, tono e icono de las tres anotaciones» | ui |
| R13 | `execution-trace-detail.test.tsx` › «R13: supervisor y equipo en orden, con grupo»; `get-execution-trace.test.ts` › «R13: equipo con nombres actuales y grupo foto» | ui + unit |
| R14 | `execution-trace-detail.test.tsx` › «R14: sin equipo» | ui |
| R15 | `execution-trace-detail.test.tsx` › «R15: quién guardó, n presentaciones, líneas con fechas dd/mm/aaaa y aviso»; `tests/unit/dashboard/execution-trace-format.test.ts` › «R15: formatSnapshotDate» | ui + unit |
| R16 | `execution-trace-detail.test.tsx` › «R16: presentación sin nombre» | ui |
| R17 | `execution-trace-detail.test.tsx` › «R17: Terminar solo con quién» | ui |
| R18 | `execution-trace-detail.test.tsx` › «R18: tarjetas de línea con los mismos datos» (acotado al cuerpo de tarjetas) | ui |
| R19 | `tests/unit/asignaciones/execution-trace.test.ts` › «R19: tres fases cerradas» | unit |
| R20 | `execution-trace.test.ts` › «R20: fase abierta hasta now en su estado» | unit |
| R21 | `execution-trace.test.ts` › «R21: sin cierre fuera de su estado o dado de baja» | unit |
| R22 | `execution-trace.test.ts` › «R22: fase sin apertura es null; guardados sin Comenzar» | unit |
| R23 | `execution-trace.test.ts` › «R23: descuenta pausas antes de cada resume; resume doble; BLOQUEADO no» | unit |
| R24 | `execution-trace.test.ts` › «R24: cancel cierra solo la fase en curso» | unit |
| R25 | `execution-trace-detail.test.tsx` › «R25: tarjetas por fase con insignias; fase null no se pinta» | ui |
| R26 | `execution-trace.test.ts` › «R26: total = suma, null = 0, precedencia del kind»; `execution-trace-format.test.ts` › «R26: formatTraceTotal trunca a minutos»; `tests/ui/dashboard/execution-trace-table.test.tsx` › «R26: celda de duración con total y sufijo» | unit + ui |
| R27 | `list-execution-traces.test.ts` › «R27: la fila trae totalDuration y no el desglose» | unit |
| R28 | `execution-trace-table.test.tsx` y `execution-trace-detail.test.tsx` › «R28: En curso según active; nunca en dado de baja» | ui |
| R29 | `list-execution-traces.test.ts` › «R29: firmantes y después equipo, sin repetir» | unit |
| R30 | `execution-log-read.int.test.ts` › «R30: filtro por miembro del equipo, con rango sobre el Comenzar» | int |
| R31 | `list-execution-traces.test.ts` › «R31: opciones solo de firmantes» | unit |
| R32 | `list-execution-traces.test.ts` › «R32: equipo sin Comenzar no sale»; `execution-log-read.int.test.ts` › «R32: equipo sin Comenzar no filtra» | unit + int |
| R33 | `tests/unit/asignaciones/execution-log-prisma.test.ts` › «R33: foto corrupta lanza al leer» | unit |
| R34 | `order-execution-conditioning-migration.test.ts` › «R34: down.sql de cada migración; guarda RAISE EXCEPTION» | estático |
| R35 | `tests/guards/guard-dependencias-aprobadas.test.ts` (sin cambios, debe seguir verde) | guardia |
| R36 | `e2e/recorrido-acondicionamiento.spec.ts` › «R36 - …» | E2E |

**Tests existentes que cambian:**

- `execution-trace.test.ts`, `list-execution-traces.test.ts` y `get-execution-trace.test.ts`: de
  `duration` a `durations`, `totalDuration` y `active`, con nota fechada. Cambian porque esta
  feature enmienda QC-167 D11/R15.
- `execution-trace-table.test.tsx`, `execution-trace-detail.test.tsx`, `recorrido-rediseno.test.tsx`
  y `textos-dashboard.test.tsx`.
- `save-conditioning-batch-data.test.ts`, `finish-conditioning.test.ts`, `conditioning-doubles.ts`:
  deps nuevas.
- `tests/unit/paridad/recorridos-paridad.test.tsx`: su snapshot se regenera y se revisa a mano.

## Riesgos

1. **La pausa empieza en la última anotación conocida (R23).** QC-82 admite perder un avanzar o
   retroceder. Si se pierde la anotación previa a un `resume`, la pausa medida empieza antes y la
   duración de producción sale **menor** que la real. Es consecuencia de no tener acción «pausa».
2. **Foto corrupta = el recorrido no carga (R33).** Es preferible a pintar a medias. Solo puede
   pasar escribiendo fuera del adaptador, porque el adaptador valida con zod antes de escribir.
3. **`down.sql` del enum.** Recrear un tipo con datos es delicado. Por eso aborta si hay filas
   nuevas, y se prueba en estático. No se ejecuta en la base de test porque cambiaría el esquema de
   otros tests.
4. **Coste de la lista.** La lista hace una consulta más por página (el equipo de los pedidos con
   Comenzar) y el filtro por persona hace dos. Las dos usan índices existentes:
   `order_conditioning_team_members_user_id_idx` y `order_execution_entries_order_id_occurred_at_idx`.

## Alternativas descartadas

- **Foto en una tabla aparte enlazada al registro**, por ejemplo
  `order_execution_batch_snapshots`. **La descartó el humano** (DC «¿Dónde se guarda la foto?»).
- **Una fila del registro por línea guardada**, con columnas escalares. Se descarta por tres
  motivos:
  - un guardado es un suceso, y con N filas no hay clave que las reagrupe;
  - `gapToNextMs` entre ellas sería 0;
  - añadiría cuatro columnas que solo usa una acción.
- **Copiar el equipo al registro.** `order_conditioning_team_members` ya es inmutable desde el
  Comenzar. Duplicarlo abriría dos fuentes que podrían divergir.
- **Mandar las tres duraciones a la fila y sumarlas en el front.** Ver C3.4: la regla del total
  quedaría fuera del dominio y sin test unitario.
- **Acciones `BLOCK` / `UNBLOCK` en el registro para descontar `BLOQUEADO`.** Descartado por
  DC P10, que manda descontar pausas. Además, con la matriz actual el descuento siempre sería 0.
- **Una acción nueva `PAUSE`.** Daría el inicio exacto de cada pausa. Pero hoy no hay ningún gesto
  de «pausar»: el operario cierra la pantalla. Inventar el gesto amplía el alcance de QC-82, y la
  DC P10 habla de pausas «anotadas en el registro», que hoy solo son los `resume`.
- **`DataTable` para las líneas de la foto.** Es una tabla controlada (params, `onParamsChange`,
  paginación y barra de filtros), pensada para listados. Para 1–N líneas estáticas dentro de una
  anotación sobra todo eso. `Table` más el mismo corte de 760 px da el comportamiento
  «tabla ⇄ tarjetas» del tablero sin código de control.
- **Una columna «Duración» ordenable en la lista.** Fuera de alcance (P11). Ordenar en el servidor
  por un valor que se calcula en memoria cambia la paginación de QC-167.
