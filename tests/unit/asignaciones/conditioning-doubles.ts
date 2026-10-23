// Dobles comunes de los tres casos de uso del acondicionador: el catalogo de pedidos y las
// dependencias de `composeOrderRows`, cada metodo un `vi.fn` que se puede inspeccionar.
import { vi } from 'vitest';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';
import type { GetConditioningOrderDeps } from '@/lib/modules/asignaciones/domain/get-conditioning-order';
import type {
  ExecutionAppendOutcome,
  ExecutionEntryRecord,
  NewExecutionEntry,
} from '@/lib/modules/asignaciones/domain/execution-entry';
import type { RecordConditioningStepDeps } from '@/lib/modules/asignaciones/domain/record-conditioning-step';
import type { StepEvidenceRow } from '@/lib/modules/asignaciones/ports/step-evidence-repository';
import type {
  ConditioningTeamMemberRow,
  ConditioningTeamRepository,
} from '@/lib/modules/asignaciones/ports/conditioning-team-repository';
import type { ExecutionTransaction, ExecutionWriters } from '@/lib/modules/asignaciones/ports/execution-transaction';
import type { OrderAssignmentRowWithOrder } from '@/lib/modules/asignaciones/ports/order-assignment-repository';
import type { PersonRef } from '@/lib/modules/identity';
import type {
  FinishedBatchLabels,
  FinishedBatchLabelsOutcome,
  FinishedBatchOfOrderLine,
  PresentationCatalog,
  PresentationRef,
} from '@/lib/modules/inventario';
import type { AssignedOrderSummary, OrderCatalog, Page } from '@/lib/modules/pedidos';
import type { ConditioningStepView, RecipeCatalog, RecipeRef } from '@/lib/modules/recetas';
import type { UnitCatalog, UnitRef } from '@/lib/modules/unidades';

export function uuid(seed: string): string {
  return `${seed.repeat(8)}-${seed.repeat(4)}-4${seed.repeat(3)}-8${seed.repeat(3)}-${seed.repeat(12)}`;
}

export const EMPRESA = uuid('3');
export const ANA = uuid('1');
export const BETO = uuid('2');
export const RECETA = uuid('a');
export const UNIDAD = uuid('b');
export const PEDIDO_1 = uuid('5');
export const PEDIDO_2 = uuid('6');
export const AHORA = new Date('2026-10-08T10:00:00.000Z');

export const ACONDICIONADOR: Actor = {
  id: ANA,
  companyId: EMPRESA,
  permissions: ['asignaciones.consultar', 'acondicionamiento.modificar'],
};

export function resumen(id: string, overrides?: Partial<AssignedOrderSummary>): AssignedOrderSummary {
  return {
    id,
    number: { year: 2026, sequence: 7 },
    recipeId: RECETA,
    quantity: '10.0000',
    priority: 'MEDIA',
    status: 'POR_ACONDICIONAR',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    presentationLines: [],
    unitId: UNIDAD,
    finishedAt: null,
    packedBy: BETO,
    conditionedBy: null,
    ...overrides,
  };
}

export function receta(overrides?: Partial<RecipeRef>): RecipeRef {
  return {
    id: RECETA,
    name: 'Jabon liquido',
    ownName: 'Jabon liquido',
    isUnderReview: false,
    original: null,
    isDeleted: false,
    imageUrl: null,
    ...overrides,
  };
}

export function persona(id: string, displayName: string): PersonRef {
  return { id, displayName, isActive: true, permissions: [], roleName: 'Operador' };
}

type Opciones = {
  readonly items?: readonly AssignedOrderSummary[];
  readonly total?: number;
  readonly refs?: readonly RecipeRef[];
  readonly rows?: readonly OrderAssignmentRowWithOrder[];
  readonly people?: readonly PersonRef[];
  readonly presentations?: readonly PresentationRef[];
  readonly units?: readonly UnitRef[];
  readonly team?: readonly ConditioningTeamMemberRow[];
  /** QC-219: los lotes de produccion del pedido que devuelve `listOfOrder`. */
  readonly batches?: readonly FinishedBatchOfOrderLine[];
  /** QC-299: lo que devuelve el lector de pasos de acondicionamiento (`null` = receta no encontrada). */
  readonly pasos?: readonly ConditioningStepView[] | null;
  readonly anotaciones?: readonly ExecutionEntryRecord[];
  readonly fotos?: readonly StepEvidenceRow[];
};

function pagina(
  items: readonly AssignedOrderSummary[],
  total: number,
  page: number,
  pageSize?: number,
): Page<AssignedOrderSummary> {
  const size = pageSize ?? 10;
  return { items, total, page, pageSize: size, totalPages: Math.max(1, Math.ceil(total / size)) };
}

export function montar(options?: Opciones) {
  const items = options?.items ?? [];
  const total = options?.total ?? items.length;

  // La firma lleva el filtro para que `mock.calls[n][5]` quede tipado; el doble no filtra.
  const listAliveSummariesInCompany = vi.fn(
    async (...args: [string, readonly string[], string, number, number?, unknown?]) =>
      pagina(items, total, args[3], args[4]),
  );
  const listAliveSummariesByIds = vi.fn(
    async (_companyId: string, _ids: readonly string[], _statuses: readonly string[], page: number, pageSize?: number) =>
      pagina(items, total, page, pageSize),
  );
  const listByOrdersInCompany = vi.fn(async () => options?.rows ?? []);
  const findRefsIncludingDeleted = vi.fn(async () => options?.refs ?? []);
  const findRefsIncludingDeletedInCompany = vi.fn(async () => options?.people ?? []);
  const findRefsPresentations = vi.fn(async () => options?.presentations ?? []);
  const findRefsUnits = vi.fn(async () => options?.units ?? []);
  const listTeamByOrderInCompany = vi.fn<ConditioningTeamRepository['listByOrderInCompany']>(async () => options?.team ?? []);
  const listOfOrder = vi.fn<FinishedBatchLabels['listOfOrder']>(async () => options?.batches ?? []);
  const findConditioningStepsById = vi.fn(async () => (options?.pasos === undefined ? [] : options.pasos));
  const listEntriesForOrders = vi.fn(async () => options?.anotaciones ?? []);
  const listEvidenceByOrder = vi.fn(async () => options?.fotos ?? []);
  const createSignedReadUrl = vi.fn(async (path: string) => `firmada:${path}`);

  const deps = {
    assignments: {
      insertMissing: vi.fn(),
      listByOrderInCompany: vi.fn(),
      listByOrdersInCompany,
      deleteOne: vi.fn(),
      deleteByWorkGroup: vi.fn(),
      listOrderIdsByUserInCompany: vi.fn(),
    },
    orders: { listAliveSummariesInCompany, listAliveSummariesByIds } as unknown as OrderCatalog,
    recipes: { findRefsIncludingDeleted } as unknown as RecipeCatalog,
    people: { findRefsIncludingDeletedInCompany },
    presentations: { findRefs: findRefsPresentations } as unknown as PresentationCatalog,
    units: { findRefs: findRefsUnits } as unknown as UnitCatalog,
    team: { insertAll: vi.fn(), listByOrderInCompany: listTeamByOrderInCompany, listByOrdersInCompany: vi.fn() },
    batches: { listOfOrder },
    conditioningSteps: { findConditioningStepsById },
    log: { listEntriesForOrders },
    evidence: { listByOrder: listEvidenceByOrder },
    storage: { createSignedReadUrl },
    now: () => AHORA,
  } as unknown as GetConditioningOrderDeps;

  return {
    deps,
    listAliveSummariesInCompany,
    listAliveSummariesByIds,
    listByOrdersInCompany,
    findRefsIncludingDeleted,
    findRefsIncludingDeletedInCompany,
    findRefsPresentations,
    findRefsUnits,
    listTeamByOrderInCompany,
    listOfOrder,
    findConditioningStepsById,
    listEntriesForOrders,
    listEvidenceByOrder,
    createSignedReadUrl,
    todos: [
      findConditioningStepsById,
      listEntriesForOrders,
      listEvidenceByOrder,
      createSignedReadUrl,
      listAliveSummariesInCompany,
      listAliveSummariesByIds,
      listByOrdersInCompany,
      findRefsIncludingDeleted,
      findRefsIncludingDeletedInCompany,
      findRefsPresentations,
      findRefsUnits,
      listTeamByOrderInCompany,
      listOfOrder,
    ],
  };
}

/** Actores que no deben pasar: nulos, sin permisos y los permisos de semilla de cada rol sin el permiso. */
export function actoresSinElPermiso(seedPermissions: Readonly<Record<string, readonly string[]>>, roles: readonly string[]) {
  const sinPermiso: [string, Actor | null | undefined][] = [
    ['null', null],
    ['undefined', undefined],
    ['sin `permissions`', { id: ANA, companyId: EMPRESA } as unknown as Actor],
    ['permisos vacios', { id: ANA, companyId: EMPRESA, permissions: [] }],
  ];
  for (const rol of roles) {
    sinPermiso.push([`rol ${rol}`, { id: ANA, companyId: EMPRESA, permissions: seedPermissions[rol] ?? [] }]);
  }
  return sinPermiso;
}

/** QC-219: el lote de produccion de una linea; sin `conDatos`, con el lote automatico y sin fechas. */
export function loteDeLinea(
  presentationId: string,
  batchId: string,
  conDatos?: { readonly lot: string; readonly expiryDate: string; readonly productionDate: string },
): FinishedBatchOfOrderLine {
  return {
    batchId,
    orderPresentationLineId: `linea-${presentationId}`,
    presentationId,
    lot: conDatos?.lot ?? `AUTO-${presentationId}`,
    expiryDate: conDatos?.expiryDate ?? null,
    productionDate: conDatos?.productionDate ?? null,
  };
}

/**
 * La transaccion de ejecucion de los casos de uso que escriben en el acondicionamiento, con
 * los tres escritores que usan. `pasos` deja el orden: `transaccion`, `escribe-lotes`,
 * `escribe-pedido` y `anota`.
 */
export function transaccionDeAcondicionamiento(options?: {
  readonly outcome?: FinishedBatchLabelsOutcome;
  readonly finish?: Awaited<ReturnType<OrderCatalog['finishConditioningAliveById']>>;
  readonly append?: (entry: NewExecutionEntry) => Promise<void>;
  readonly pasos?: string[];
}) {
  const pasos = options?.pasos ?? [];
  const writeForOrder = vi.fn<FinishedBatchLabels['writeForOrder']>(async () => {
    pasos.push('escribe-lotes');
    return options?.outcome ?? { kind: 'written' };
  });
  const finishConditioningAliveById = vi.fn<OrderCatalog['finishConditioningAliveById']>(async () => {
    pasos.push('escribe-pedido');
    return options?.finish ?? 'ok';
  });
  const append = vi.fn(async (entry: NewExecutionEntry) => {
    pasos.push('anota');
    if (options?.append) await options.append(entry);
  });
  const run = vi.fn(async <T>(work: (writers: ExecutionWriters) => Promise<T>) => {
    pasos.push('transaccion');
    return work({
      batches: { writeForOrder },
      conditioning: { finishConditioningAliveById },
      log: { append },
    } as unknown as ExecutionWriters);
  });
  const transaction = { run } as ExecutionTransaction;
  return { transaction, run, writeForOrder, finishConditioningAliveById, append, pasos };
}

/** Una anotacion de paso de acondicionamiento leida del registro de `PEDIDO_1`. */
export function anotacionDePaso(
  action: 'conditioning_step_advance' | 'conditioning_steps_complete' | 'conditioning_responsibles_change',
  stepPosition: number,
  responsibleUserIds: readonly string[] | null,
  seq = stepPosition,
): ExecutionEntryRecord {
  return {
    id: `anotacion-${String(seq)}`,
    orderId: PEDIDO_1,
    userId: ANA,
    action,
    stepPosition,
    reason: null,
    batchLines: null,
    responsibleUserIds,
    occurredAt: new Date(AHORA.getTime() - 60_000 + seq * 1_000),
  };
}

/** Una foto de acondicionamiento de `PEDIDO_1` en ese paso. */
export function fotoDeAcondicionamiento(stepPosition: number, slot = 1): StepEvidenceRow {
  return {
    id: `foto-${String(stepPosition)}-${String(slot)}`,
    orderId: PEDIDO_1,
    phase: 'conditioning',
    stepPosition,
    slot,
    path: `${EMPRESA}/${PEDIDO_1}/foto-${String(stepPosition)}-${String(slot)}`,
  };
}

/**
 * Los puertos de `recordConditioningStep` sobre `PEDIDO_1`, `EN_ACONDICIONAMIENTO` a nombre de Ana
 * por defecto. `pasos` es lo que devuelve el lector de la formula (`null` = receta que no se
 * encuentra); `anotaciones`, el registro del pedido.
 */
export function montarRegistroDePaso(options?: {
  readonly status?: AssignedOrderSummary['status'];
  readonly conditionedBy?: string | null;
  readonly target?: null;
  readonly pasos?: readonly ConditioningStepView[] | null;
  readonly anotaciones?: readonly ExecutionEntryRecord[];
  readonly equipo?: readonly ConditioningTeamMemberRow[];
  readonly fotos?: readonly StepEvidenceRow[];
  readonly desenlace?: ExecutionAppendOutcome;
}) {
  const status = options?.status ?? 'EN_ACONDICIONAMIENTO';
  const conditionedBy = options?.conditionedBy === undefined ? ANA : options.conditionedBy;
  const findAliveById = vi.fn<OrderCatalog['findAliveById']>(async () =>
    options?.target === null ? null : { id: PEDIDO_1, status },
  );
  const listAliveSummariesByIds = vi.fn(
    async (_companyId: string, _ids: readonly string[], _statuses: readonly string[], page: number, pageSize?: number) =>
      pagina([resumen(PEDIDO_1, { status, conditionedBy })], 1, page, pageSize),
  );
  const findConditioningStepsById = vi.fn(async () => (options?.pasos === undefined ? [] : options.pasos));
  const listByOrderInCompany = vi.fn<ConditioningTeamRepository['listByOrderInCompany']>(
    async () => options?.equipo ?? [],
  );
  const listEntriesForOrders = vi.fn(async () => options?.anotaciones ?? []);
  const append = vi.fn<(entry: NewExecutionEntry) => Promise<ExecutionAppendOutcome>>(
    async () => options?.desenlace ?? 'ok',
  );
  const listByOrder = vi.fn(async () => options?.fotos ?? []);

  const deps = {
    orders: { findAliveById, listAliveSummariesByIds } as unknown as OrderCatalog,
    conditioningSteps: { findConditioningStepsById },
    team: { listByOrderInCompany },
    log: { append, listEntriesForOrders },
    evidence: { listByOrder },
    now: () => AHORA,
  } satisfies RecordConditioningStepDeps;

  return {
    deps,
    findAliveById,
    listAliveSummariesByIds,
    findConditioningStepsById,
    listByOrderInCompany,
    listEntriesForOrders,
    append,
    listByOrder,
    todos: [
      findAliveById,
      listAliveSummariesByIds,
      findConditioningStepsById,
      listByOrderInCompany,
      listEntriesForOrders,
      append,
      listByOrder,
    ],
  };
}
