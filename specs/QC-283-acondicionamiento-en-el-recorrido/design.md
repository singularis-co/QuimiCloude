# QC-283 — acondicionamiento-en-el-recorrido · design.md

> **Estado (2026-10-14, spec_author).** Este archivo **solo** cierra los contratos (`## Contratos`).
> Así backend_dev y frontend_dev pueden trabajar en paralelo cuando se apruebe el tablero.
> Todo lo demás del design está **pendiente del pase `/design` (P0)**:
>
> - la UI de las tres anotaciones;
> - dónde y cómo se pintan las tres duraciones;
> - las piezas del catálogo;
> - el plan de tests y la trazabilidad `R<n>`.
>
> Los contratos no dependen del tablero. Si el tablero pide un dato que aquí no está, eso es un
> cambio de contrato y se anota aquí antes de implementarlo.
>
> Las decisiones citadas como «DC» son filas de `requirements.md > Decisiones cerradas`.

## Lo que ya existe

- **Registro de ejecución (QC-82).** Está en `order_execution_entries` / `OrderExecutionEntry` y
  solo se inserta. El puerto es `ExecutionLogRepository` y el adaptador
  `execution-log-prisma.ts`. La transacción es `ExecutionTransaction`, cableada en
  `lib/composition/index.ts` (`executionTransaction`).
- **El equipo de acondicionamiento (QC-218) ya vive en `order_conditioning_team_members`.**
  - Se escribe una sola vez, al Comenzar, dentro de `executionTransaction`
    (`writers.team.insertAll`). Nunca se edita ni se borra.
  - Por eso **ya es foto del momento**: no hace falta copiarlo al registro (DC «¿Dónde se guarda
    la foto?»).
  - Se lee con `ConditioningTeamRepository.listByOrderInCompany`.
- **Comenzar** (`start-conditioning.ts`) ya corre en `executionTransaction`. Hoy **no anota** nada
  en el registro.
- **Guardar datos de lote** (`save-conditioning-batch-data.ts`) escribe con
  `FinishedBatchLabels.writeForOrder`, que abre **su propia** transacción
  (`finished-batch-labels-prisma.ts`). No anota.
- **Terminar** (`finish-conditioning.ts`) llama a `orders.finishConditioningAliveById` **fuera de
  toda transacción**. No anota.
- **Lectura del recorrido (QC-167).**
  - `buildExecutionTrace` (`execution-trace.ts`) da **una** `duration: TraceDuration`.
  - `listExecutionTraces` (`list-execution-traces.ts`) devuelve `ExecutionTraceRow` y
    `personOptions`.
  - `getExecutionTrace` (`get-execution-trace.ts`) devuelve `ExecutionTraceDetail`.
  - Las dos llegan al front por `listExecutionTracesAction` y `getExecutionTraceAction`
    (`execution-trace-actions.ts`).
  - El front decide «En curso» con `duration.kind === 'open'`, en `execution-trace-columns.tsx` y
    `execution-trace-detail.tsx`.
- **Supervisor = quien comienza.** `startConditioningAliveById` deja al actor como
  `conditioned_by`. El Administrador de acondicionamiento (QC-216) es quien tiene
  `acondicionamiento.modificar`. Así que el supervisor de DC «¿Qué se registra?» es el `userId`
  de la anotación de Comenzar. No hace falta ninguna columna nueva.

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

En el dominio (`execution-entry.ts`) se llaman `'conditioning_start'`, `'conditioning_batch_save'` y
`'conditioning_finish'`. `EXECUTION_ACTION_TO_PRISMA` (`execution-log-prisma.ts`) gana sus tres
pares.

**C1.2 — Una columna nueva en `OrderExecutionEntry`, para la foto del guardado de lote:**

```prisma
model OrderExecutionEntry {
  // ...columnas actuales sin cambios...
  batchLines   Json?                @map("batch_lines")
}
```

- SQL: `"batch_lines" JSONB NULL`.
- No hay columna para el supervisor: es `user_id` de `CONDITIONING_START`.
- No hay columna para el equipo: se lee de `order_conditioning_team_members`.
- Quién guardó es `user_id` de `CONDITIONING_BATCH_SAVE`.
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
  `product_batches` (DC «¿Foto del momento?»).
- Corregir el lote después solo añade otra fila `CONDITIONING_BATCH_SAVE` con su propia foto.

**C1.4 — Restricciones nuevas** (a mano en la migración, como las tres de QC-82):

```sql
-- La foto existe si y solo si la accion es el guardado de lote.
ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_batch_lines_matches_action"
  CHECK (("action"::text = 'CONDITIONING_BATCH_SAVE') = ("batch_lines" IS NOT NULL));

ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_batch_lines_non_empty_array"
  CHECK ("batch_lines" IS NULL OR (jsonb_typeof("batch_lines") = 'array' AND jsonb_array_length("batch_lines") >= 1));

-- El acondicionamiento no recorre pasos de la receta.
ALTER TABLE "order_execution_entries" ADD CONSTRAINT "order_execution_entries_conditioning_has_no_step"
  CHECK ("action"::text NOT IN ('CONDITIONING_START','CONDITIONING_BATCH_SAVE','CONDITIONING_FINISH') OR "step_position" IS NULL);
```

`order_execution_entries_reason_matches_action` ya impide un `reason` en las acciones nuevas. La
forma de cada elemento **no** se comprueba en SQL: la valida zod al escribir y al leer (C2.1).

**C1.5 — Migraciones.** Siguen el precedente de `order_status_blocked` / `orders_blocked_index`
(55P04: Prisma Migrate corre cada migración en una transacción):

| Migración | UP | DOWN (`down.sql`) |
|---|---|---|
| `<ts>_order_execution_conditioning_actions` | solo los 3 `ALTER TYPE "OrderExecutionAction" ADD VALUE IF NOT EXISTS ...` | aborta con `RAISE EXCEPTION` si hay filas con esas acciones; si no, recrea el tipo con los 8 valores de antes y re-crea los CHECK que nombran `action` con su texto literal de QC-82 |
| `<ts+1>_order_execution_batch_lines` | `ADD COLUMN "batch_lines" JSONB` + los 3 CHECK de C1.4 | `DROP CONSTRAINT` ×3 + `DROP COLUMN "batch_lines"` |

- No hay tabla nueva. La RLS de `order_execution_entries` ya está activada y forzada (QC-82), y
  la tabla sigue siendo de solo inserción (DC «Heredado»).
- No hay datos hacia atrás: ninguna migración rellena anotaciones (DC «¿Pedidos ya
  acondicionados?»).

### C2. Backend: dominio, puertos y casos de uso

Leyenda: **NUEVO** = no existe hoy. **MOD** = cambia, con la firma de antes y la de después.
Errores: los de `domain/errors.ts`, **sin ninguno nuevo**.

#### C2.1 — Tipos compartidos nuevos: `lib/modules/asignaciones/domain/conditioning-trace.ts` (NUEVO)

Es el archivo de tipos que importa el front, siempre a través del barril `@/lib/modules/asignaciones`
(C4). No tiene lógica, salvo el esquema zod de la foto.

```ts
import { z } from 'zod';

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

/** Valida `batch_lines` al escribir (adaptador) y al leer (filas antiguas o corruptas lanzan). */
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

/** Una cifra por fase. `null` = la fase no tiene anotación que la abra (ver C3.3). */
export type TraceDurations = {
  readonly production: TraceDuration | null;
  readonly packing: TraceDuration | null;
  readonly conditioning: TraceDuration | null;
};

/** Un miembro del equipo en el recorrido. `displayName` `null` si el directorio no lo devuelve. */
export type ExecutionTraceTeamMember = {
  readonly userId: string;
  readonly displayName: string | null;
  readonly origin: ConditioningTeamMemberView['origin']; // reutiliza el de QC-218 (conditioning-order-view.ts)
};
```

(`TraceDuration` es el de `execution-trace.ts`, **sin cambios**: `closed | open | unclosed` con `ms`.)

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

**Frontera de compilación.** Al ampliar `EXECUTION_ACTIONS` dejan de compilar los dos
`Record<ExecutionAction, …>` del front:

- `EXECUTION_ACTION_LABELS`, en `execution-trace-format.ts`;
- `EXECUTION_TIMELINE_ACTIONS`, en `execution-timeline.tsx`.

Por eso C2.1 + C2.2 van en una tanda 0 de solo tipos, junto con las tres claves en esos dos
`Record`. Su texto e icono son provisionales hasta el tablero.

#### C2.3 — `ExecutionLogRepository` (puerto MOD solo en semántica; adaptador MOD)

Las firmas del puerto no cambian. Cambia lo que hacen:

- `append(entry)`: escribe `batchLines` como `batch_lines` cuando
  `entry.action === 'conditioning_batch_save'`, y `null` en el resto.
- `listEntriesForOrders(...)`: selecciona `batchLines` y lo parsea con
  `conditioningBatchSnapshotSchema`. Si no pasa, **lanza**: un dato corrupto no se pinta a medias.
- `listExecutedOrderIds(companyId, filter)`: con `filter.userId`, devuelve también los pedidos
  donde esa persona está en `order_conditioning_team_members` (DC «¿Filtro por persona?»):

  ```text
  pedidos con una anotación de userId dentro del rango
  ∪
  pedidos con fila de equipo de userId Y una anotación CONDITIONING_START dentro del rango
  ```

  La segunda rama exige `CONDITIONING_START`: sin él no se reconstruye nada hacia atrás (DC
  «¿Pedidos ya acondicionados?»). El rango sobre el Comenzar está abierto en P7.
- `listUserIdsWithEntries(companyId)`: **sin cambios**. El supervisor ya entra, porque firma
  `CONDITIONING_START`. Los miembros del equipo no se listan aparte (DC «¿Opciones del filtro por
  persona?»).

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

`tests/helpers/execution-transaction-on-client.ts` gana los dos campos con el mismo patrón de «lanza si
este archivo no lo usa».

#### C2.5 — `createFinishedBatchLabels` (inventario, adaptador driven MOD)

```ts
// ANTES
export function createFinishedBatchLabels(): FinishedBatchLabels;
// DESPUES
export function createFinishedBatchLabels(db?: Prisma.TransactionClient): FinishedBatchLabels;
```

- **Sin `db`:** igual que hoy, `writeForOrder` abre su `prisma.$transaction`.
- **Con `db`:** escribe con `writeFinishedBatchLabels(db, …)` **sin abrir** otra transacción.
- Si choca el índice único de lote, devuelve `{ kind: 'duplicate_lot', batchId: null }` igual que
  hoy. La transacción queda abortada en Postgres, así que quien la abrió **debe** lanzar (C2.7).
- `listOfOrder` lee por `db` si se le pasa.
- El puerto `FinishedBatchLabels` no cambia de firma. Solo cambia el JSDoc de `writeForOrder`:
  «todo o nada, en la transacción que recibe o en la suya».

#### C2.6 — Comenzar: `createStartConditioning` (MOD interno; firma y deps sin cambios)

```ts
// Firma sin cambios
export function createStartConditioning(deps: StartConditioningDeps):
  (actor: Actor | null | undefined, input: unknown) => Promise<void>;
```

Dentro de `transaction.run`, después de `teamWriter.insertAll(team)` y en la misma transacción:

```ts
await log.append({ action: 'conditioning_start', companyId, orderId, userId: actor.id, stepPosition: null, occurredAt: now });
```

- `'already_mine'` (repetir Comenzar) **no** anota, igual que hoy no escribe equipo.
- Los errores no cambian: `ForbiddenError`, `ValidationError`, `OrderNotFoundError`,
  `OrderNotConditionableError`, `OrderConditioningTakenError`, `WorkGroupNotFoundError` y los del
  equipo.
- Si `append` falla, se deshacen la transición y el equipo.

#### C2.7 — Guardar datos de lote: `createSaveConditioningBatchData` (MOD de deps)

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

Orden, después de las comprobaciones actuales (que no cambian):

1. Fuera de la transacción:
   - `listOfOrder(companyId, orderId)`. Un `batchId` enviado que no aparece →
     `ConditioningBatchNotFoundError(batchId)`, el mismo error que hoy da `batch_not_found`.
   - `presentations.findRefs(presentationIds, companyId)`.
   - Con eso se compone `batchLines: ConditioningBatchSnapshotLine[]`, en el orden de `input.lines`
     y con los valores ya parseados.
2. `transaction.run(async ({ batches, log }) => { … })`:
   - `outcome = await batches.writeForOrder({...})`. Si no es `'written'` →
     `throw new ExecutionAbortedError(outcome)`.
   - `await log.append({ action: 'conditioning_batch_save', …, stepPosition: null, batchLines, occurredAt: now })`.
3. Al salir, `ExecutionAbortedError` se traduce:
   - `batch_not_found` → `ConditioningBatchNotFoundError(outcome.batchId)`;
   - `duplicate_lot` → `ConditioningBatchDuplicateLotError(outcome.batchId ?? undefined)`.

- Errores: los mismos que hoy, sin ninguno nuevo.
- Un guardado rechazado no anota. Una anotación que falla deshace el guardado.
- Cableado: `asignaciones.saveConditioningBatchData` pasa `batches: createFinishedBatchLabels()`,
  `presentations: presentationCatalog` y `transaction: executionTransaction`.

#### C2.8 — Terminar: `createFinishConditioning` (MOD de deps)

```ts
// ANTES
export type FinishConditioningDeps = {
  readonly orders: OrderCatalog;
  readonly batches: Pick<FinishedBatchLabels, 'listOfOrder'>;
  readonly now?: () => Date;
};
// DESPUES
export type FinishConditioningDeps = {
  readonly orders: OrderCatalog;                                    // sigue leyendo findAliveById / listAliveSummariesByIds
  readonly batches: Pick<FinishedBatchLabels, 'listOfOrder'>;
  readonly transaction: ExecutionTransaction;                       // la transicion pasa a writers.conditioning
  readonly now?: () => Date;
};
// Firma y resultado SIN cambios
(actor: Actor | null | undefined, input: unknown) => Promise<FinishConditioningResult>; // { numberText }
```

La llamada directa a `deps.orders.finishConditioningAliveById` pasa a hacerse dentro de
`transaction.run`:

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

#### C2.9 — `buildExecutionTrace` (`execution-trace.ts`, MOD)

```ts
// ANTES
export type ExecutionTrace = { steps; firstAt; lastAt; duration: TraceDuration; goBackCount; userIds };
// DESPUES
export type ExecutionTrace = {
  readonly steps: readonly TraceStep[];
  readonly firstAt: Date;
  readonly lastAt: Date;
  /** !order.deleted && estado no final: lo que hoy el front deduce de `duration.kind === 'open'`. */
  readonly active: boolean;
  readonly durations: TraceDurations;       // sustituye a `duration` (enmienda QC-167 D11/R15)
  readonly goBackCount: number;
  readonly userIds: readonly string[];      // sin cambios: solo quien firma anotaciones, no el equipo
};
// Firma sin cambios
export function buildExecutionTrace(entries: readonly ExecutionEntryRecord[], order: TraceOrderState, now: Date): ExecutionTrace;
```

`CLOSING_ACTIONS` desaparece. Las reglas de cada cifra están en C3.3.

#### C2.10 — `createGetExecutionTrace` (MOD de deps)

```ts
// ANTES
export type GetExecutionTraceDeps = ListExecutionTracesDeps;
// DESPUES
export type GetExecutionTraceDeps = ListExecutionTracesDeps & {
  readonly team: Pick<ConditioningTeamRepository, 'listByOrderInCompany'>;
};
```

- Lee el equipo solo si hay una anotación `conditioning_start`.
- Los `userId` del equipo se suman a `findPeopleByIds` (los dados de baja también, como hoy).
- Cableado: `team: createConditioningTeamRepository()`.

`createListExecutionTraces` no cambia de deps.

### C3. Contrato hacia el front (lo que consume frontend_dev)

**Origen de los datos.** Las dos Server Actions **no cambian de firma**. Lo que cambia es el tipo
de `data`:

| Action (`lib/modules/asignaciones/adapters/driving/execution-trace-actions.ts`) | Devuelve |
|---|---|
| `listExecutionTracesAction(input: ExecutionTraceListInput)` | `{ status: 'success'; data: ExecutionTraceList } \| ErrorState` |
| `getExecutionTraceAction(orderId: string)` | `{ status: 'success'; data: ExecutionTraceDetail } \| ErrorState` |

`ExecutionTraceListInput` no cambia: el filtro sigue siendo `userId`. Lo que cambia es su
semántica (C2.3).

#### C3.1 — Entrada de timeline: `ExecutionTraceDetailStep` pasa a unión discriminada por `action` (MOD, en `get-execution-trace.ts`)

```ts
// ANTES
export type ExecutionTraceDetailStep = TraceStep & { readonly userDisplayName: string | null };

// DESPUES
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
      /** La foto del guardado (C1.3), en el orden en que se enviaron las líneas. */
      readonly lines: readonly ConditioningBatchSnapshotLine[];
    })
  | (DetailStepBase & {
      readonly action: 'conditioning_finish';
      readonly stepPosition: null;
      readonly reason: null;
    });
```

- `stepPosition` y `reason` siguen en todas las variantes, para que el código actual de la línea de
  tiempo compile sin estrechar.
- `batchLines` del registro **no** sale al front con ese nombre: en la variante se llama `lines`.

#### C3.2 — Detalle: `ExecutionTraceDetail` (MOD, en `get-execution-trace.ts`)

```ts
// ANTES: { orderId; numberText; status; deleted; steps; firstAt; lastAt; duration: TraceDuration; goBackCount }
// DESPUES
export type ExecutionTraceDetail = {
  readonly orderId: string;
  readonly numberText: string;
  readonly status: OrderStatus;
  readonly deleted: boolean;
  readonly active: boolean;                 // NUEVO: sustituye a `duration.kind === 'open'` para la marca «En curso»
  readonly steps: readonly ExecutionTraceDetailStep[];
  readonly firstAt: Date;
  readonly lastAt: Date;
  readonly durations: TraceDurations;       // sustituye a `duration`
  readonly goBackCount: number;
};
```

#### C3.3 — Las tres duraciones (`TraceDurations`, C2.1)

Cada cifra es un `TraceDuration` (`closed | open | unclosed`, con `ms`) o `null`, y se pinta con el
`formatTraceDuration` de hoy. Una fase se mide desde su primera anotación. Lo que la abre y lo que
la cierra:

| Fase | La abre | La cierra (`closed`) |
|---|---|---|
| `production` | `start` | `finish`, o `cancel` mientras la fase está abierta |
| `packing` | `pack_start` | `pack_finish`, o `cancel` mientras la fase está abierta |
| `conditioning` | `conditioning_start` | `conditioning_finish` |

Reglas:

- **`null`:** no hay anotación que abra la fase.
  - `conditioning` es `null` si no hay `conditioning_start`, aunque haya guardados de lote (DC
    «¿Pedidos sin Comenzar anotado?»).
  - `production` y `packing` también pueden ser `null`, por ejemplo en pedidos de antes de QC-82.
- **`closed`:** la fase tiene la anotación que la cierra. `ms` va de la anotación que la abre a la
  que la cierra.
- **`open`:** no hay cierre, el pedido está vivo y su estado es el de esa fase. `ms` va de la
  anotación que la abre a `now`. Qué estado es «el de esa fase» está abierto en P6.
- **`unclosed`:** no hay cierre y el pedido ya no está en la fase. `ms` va de la anotación que la
  abre a la última anotación de esa fase.

Los conjuntos de estados por fase y a qué fase se atribuye `cancel` están abiertos (P6). Las
**formas** de arriba no dependen de esa respuesta.

#### C3.4 — Fila de la lista: `ExecutionTraceRow` (MOD, en `list-execution-traces.ts`)

```ts
// ANTES: { orderId; numberText; status; deleted; people; firstAt; lastAt; duration: TraceDuration; goBackCount }
// DESPUES
export type ExecutionTraceRow = {
  readonly orderId: string;
  readonly numberText: string;
  readonly status: OrderStatus;
  readonly deleted: boolean;
  readonly active: boolean;                         // NUEVO
  readonly people: readonly ExecutionTracePerson[]; // sin cambios: quien firma anotaciones (supervisor incluido); el equipo NO (P8)
  readonly firstAt: Date;
  readonly lastAt: Date;
  readonly durations: TraceDurations;               // sustituye a `duration`
  readonly goBackCount: number;
};
```

`TRACE_DURATION_COLUMN_ID` y el `data-testid="execution-trace-duration"` actuales los decide el
tablero (P0). No forman parte del contrato de datos.

#### C3.5 — Opciones del filtro por persona: `ExecutionTraceList.personOptions` (sin cambios de tipo)

```ts
export type ExecutionTracePerson = { readonly userId: string; readonly displayName: string };
export type ExecutionTraceList = {
  readonly page: Page<ExecutionTraceRow>;
  readonly personOptions: readonly ExecutionTracePerson[];
};
```

- Salen de `listUserIdsWithEntries` como hoy. El supervisor aparece porque firma
  `conditioning_start` y `conditioning_batch_save`.
- Un miembro del equipo **no** aparece por serlo. Solo aparece si firma alguna anotación (DC
  «¿Opciones del filtro por persona?»).
- Elegir una persona encuentra también los pedidos donde estuvo en el equipo (C2.3).

### C4. Dónde vive cada tipo y cómo trabaja el front sin esperar al backend

| Tipo | Archivo | Se importa desde |
|---|---|---|
| `ConditioningAction`, `ConditioningBatchSnapshotLine`, `ExecutionPhase`, `TraceDurations`, `ExecutionTraceTeamMember` | `lib/modules/asignaciones/domain/conditioning-trace.ts` (NUEVO) | `@/lib/modules/asignaciones` (`import type`) |
| `ExecutionAction` (ampliado) | `lib/modules/asignaciones/domain/execution-entry.ts` | ídem (ya exportado) |
| `ExecutionTraceDetail`, `ExecutionTraceDetailStep` | `lib/modules/asignaciones/domain/get-execution-trace.ts` | ídem (ya exportados) |
| `ExecutionTraceRow`, `ExecutionTraceList`, `ExecutionTracePerson` | `lib/modules/asignaciones/domain/list-execution-traces.ts` | ídem (ya exportados) |
| `TraceDuration` | `lib/modules/asignaciones/domain/execution-trace.ts` | ídem (ya exportado) |

- `lib/modules/asignaciones/index.ts` gana
  `export type { ConditioningAction, ConditioningBatchSnapshotLine, ExecutionPhase, TraceDurations, ExecutionTraceTeamMember } from './domain/conditioning-trace'`.
  `conditioningBatchSnapshotSchema` **no** se reexporta: es del adaptador.
- **Fixtures:** `tests/fixtures/execution-trace-conditioning.ts`, tipados con estos tipos. Cubren:
  - un `ExecutionTraceDetail` con las tres anotaciones nuevas;
  - un Comenzar con equipo mixto (directo y por grupo) y otro sin equipo;
  - un guardado de dos líneas, uno con `presentationName: null` y una corrección posterior;
  - las cuatro formas de cada duración (`closed`, `open`, `unclosed`, `null`);
  - un `ExecutionTraceRow` con `conditioning: null`.

  Los tests de UI de frontend_dev los usan con la acción simulada, como hoy hacen
  `execution-trace-detail.test.tsx` y `execution-trace-table.test.tsx`.
- **Orden mínimo para el paralelo.** La tanda 0 es de solo tipos, sin lógica:
  - C2.1;
  - C2.2;
  - C2.9 y C3.1–C3.4, solo los tipos;
  - las tres claves nuevas en los dos `Record` del front.

  Después, backend (C1, C2.3–C2.10) y front (componentes según el tablero) no comparten archivos.
  La excepción son los dos `Record` del front, que quedan del front.

## Alternativas descartadas

- **Foto en una tabla aparte enlazada al registro** (p. ej. `order_execution_batch_snapshots`, con
  una fila por línea y FK a `order_execution_entries.id`). Daba columnas tipadas y CHECKs por
  campo. **La descartó el humano** (DC «¿Dónde se guarda la foto?»): el registro se queda en una
  sola tabla.
- **Una fila del registro por línea guardada**, con columnas escalares `lot`, `expiry_date`,
  `production_date` y `presentation_id`. Se descarta por tres motivos:
  - un guardado es **un** suceso: con N filas, el recorrido tendría que reagruparlas y no hay clave
    que las una;
  - `gapToNextMs` entre ellas sería 0;
  - añadiría cuatro columnas que solo usa una acción.

  `JSONB` con un array cumple la DC sin tabla extra y con una fila por suceso.
- **Copiar el equipo a `batch_lines` o a otra columna JSON de `CONDITIONING_START`.** No hace
  falta: `order_conditioning_team_members` ya es inmutable desde el Comenzar, así que ya es foto.
  Duplicarlo abriría dos fuentes que podrían divergir.

## Pendiente del pase `/design` (P0)

Esta sección se escribirá con el tablero aprobado:

- el modelo de UI;
- las piezas del catálogo y la regla de decisión;
- los estados en escritorio, tablet y teléfono;
- cómo se pintan las tres duraciones en la fila y en el detalle;
- los textos;
- el plan de tests con su mapa `R<n> -> test`;
- `## Archivos esperados` (va en `tasks.md`).
