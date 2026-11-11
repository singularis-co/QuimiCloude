// tests/unit/asignaciones/get-execution-trace.test.ts
//
// El recorrido de un pedido, con los puertos simulados: autorizacion primero, un solo error para
// los tres casos de «no hay recorrido» y los dados de baja que si lo abren.

import { describe, expect, it, vi } from 'vitest';

import { OrderNotFoundError, UnauthorizedError } from '@/lib/modules/asignaciones/domain/errors';
import { buildExecutionTrace } from '@/lib/modules/asignaciones/domain/execution-trace';
import {
  createGetExecutionTrace,
  type ExecutionTraceDetail,
  type ExecutionTraceRecipe,
} from '@/lib/modules/asignaciones/domain/get-execution-trace';
import { createListExecutionTraces } from '@/lib/modules/asignaciones/domain/list-execution-traces';
import { PERMISSIONS, type PersonRef } from '@/lib/modules/identity';
import {
  ORDER_STATUS_VALUES,
  type OrderCatalog,
  type OrderHistorySummary,
  type OrderLineStatus,
  type OrderRecipesOutline,
} from '@/lib/modules/pedidos';
import type { PresentationRef } from '@/lib/modules/inventario';
import type { RecipeRef } from '@/lib/modules/recetas';
import type { UnitRef } from '@/lib/modules/unidades';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';
import type { ExecutionAction, ExecutionEntryRecord } from '@/lib/modules/asignaciones/domain/execution-entry';
import type { ConditioningBatchSnapshotLine } from '@/lib/modules/asignaciones/domain/conditioning-trace';
import type { ConditioningTeamMemberRow } from '@/lib/modules/asignaciones/ports/conditioning-team-repository';
import type { ExecutionLogRepository } from '@/lib/modules/asignaciones/ports/execution-log-repository';
import type { PeopleDirectory } from '@/lib/modules/identity';

function uuid(seed: string): string {
  return `${seed.repeat(8)}-${seed.repeat(4)}-4${seed.repeat(3)}-8${seed.repeat(3)}-${seed.repeat(12)}`;
}

const EMPRESA = uuid('3');
const ANA = uuid('1');
const BEA = uuid('2');
const PEDIDO = uuid('a');

const ACTOR: Actor = { id: ANA, companyId: EMPRESA, permissions: ['dashboard.consultar'] };

const T0 = Date.parse('2026-10-01T08:00:00.000Z');
const MIN = 60_000;
const NOW = new Date(T0 + 48 * 60 * MIN);

let seq = 0;
function anotacion(action: ExecutionAction, offsetMin: number, userId = ANA, stepPosition: number | null = 1) {
  seq += 1;
  return {
    id: `e-${String(seq).padStart(4, '0')}`,
    orderId: PEDIDO,
    orderLineId: `linea-${PEDIDO}`,
    userId,
    action,
    stepPosition,
    reason: action === 'cancel' ? 'sin material' : null,
    batchLines: null,
    responsibleUserIds: null,
    occurredAt: new Date(T0 + offsetMin * MIN),
  } satisfies ExecutionEntryRecord;
}

const RECORRIDO: readonly ExecutionEntryRecord[] = [
  anotacion('start', 0, ANA, 1),
  anotacion('advance', 10, ANA, 2),
  anotacion('go_back', 15, BEA, 1),
  anotacion('cancel', 40, BEA, 1),
];

function resumen(overrides?: Partial<OrderHistorySummary>): OrderHistorySummary {
  return { id: PEDIDO, number: { year: 2026, sequence: 42 }, status: 'CANCELADO', deleted: false, ...overrides };
}

const LINEA = `linea-${PEDIDO}`;
const RECETA = uuid('d');

/**
 * Pedido de una sola receta, en la linea de `anotacion`, con el estado del pedido: lo que hoy es
 * el unico recorrido del pedido.
 */
function outlineDeUna(order: OrderHistorySummary | null): OrderRecipesOutline | null {
  if (order === null || order.status === 'PARCIAL') return null;
  const status: OrderLineStatus = order.status;
  return {
    id: PEDIDO,
    deleted: order.deleted,
    recipes: [
      { lineId: LINEA, position: 1, recipeId: RECETA, status, quantity: '10', unitId: null, presentationLines: [] },
    ],
    progress: { total: status === 'CANCELADO' ? 0 : 1, finished: status === 'ENTREGADO' ? 1 : 0 },
  };
}

/** La unica seccion de un pedido de una receta. */
function unica(recorrido: ExecutionTraceDetail): ExecutionTraceRecipe {
  expect(recorrido.recipes).toHaveLength(1);
  return recorrido.recipes[0]!;
}

function montar(options?: {
  readonly order?: OrderHistorySummary | null;
  readonly entries?: readonly ExecutionEntryRecord[];
  readonly people?: readonly PersonRef[];
  readonly team?: readonly (ConditioningTeamMemberRow & { readonly orderId: string; readonly orderLineId: string })[];
  readonly outline?: OrderRecipesOutline | null;
  readonly recipes?: readonly RecipeRef[];
  readonly presentations?: readonly PresentationRef[];
  readonly units?: readonly UnitRef[];
}) {
  const order = options?.order === undefined ? resumen() : options.order;
  const entries = options?.entries ?? RECORRIDO;
  const outline = options?.outline === undefined ? outlineDeUna(order) : options.outline;

  const listEntriesForOrders = vi.fn(async (_companyId: string, ids: readonly string[]) =>
    entries.filter((entry) => ids.includes(entry.orderId)),
  );
  const listExecutedOrderIds = vi.fn(async () => (entries.length === 0 ? [] : [PEDIDO]));
  const listUserIdsWithEntries = vi.fn(async () => [ANA, BEA]);
  const append = vi.fn();
  const findLastStepPosition = vi.fn();
  const log: ExecutionLogRepository = {
    append,
    findLastStepPosition,
    listExecutedOrderIds,
    listEntriesForOrders,
    listUserIdsWithEntries,
  };

  const listSummariesByIdsIncludingDeleted = vi.fn(
    async (_companyId: string, _ids: readonly string[], _statuses: readonly string[], page: number, pageSize?: number) => {
      const items = order === null ? [] : [order];
      return { items, total: items.length, page, pageSize: pageSize ?? 10, totalPages: 1 };
    },
  );
  const listRecipeOutlinesByIdsIncludingDeleted = vi.fn(async (_companyId: string, ids: readonly string[]) =>
    outline === null ? [] : [outline].filter((item) => ids.includes(item.id)),
  );
  const orders = { listSummariesByIdsIncludingDeleted, listRecipeOutlinesByIdsIncludingDeleted } as unknown as OrderCatalog;
  const findRecipeRefs = vi.fn(async (ids: readonly string[]) =>
    (options?.recipes ?? []).filter((recipe) => ids.includes(recipe.id)),
  );
  const recipes = { findRefsIncludingDeleted: findRecipeRefs };
  const findPresentationRefs = vi.fn(async (ids: readonly string[]) =>
    (options?.presentations ?? []).filter((presentation) => ids.includes(presentation.id)),
  );
  const presentations = { findRefs: findPresentationRefs };
  const findUnitRefs = vi.fn(async (ids: readonly string[]) =>
    (options?.units ?? []).filter((unit) => ids.includes(unit.id)),
  );
  const units = { findRefs: findUnitRefs };

  const directorio = options?.people ?? [
    { id: ANA, displayName: 'Ana Perez', isActive: true, permissions: [], roleName: 'Operador' },
    { id: BEA, displayName: 'Bea Gomez', isActive: false, permissions: [], roleName: 'Operador' },
  ];
  const findRefsIncludingDeletedInCompany = vi.fn(
    async (_companyId: string, ids: readonly string[]) => directorio.filter((ref) => ids.includes(ref.id)),
  );
  const people = { findRefsIncludingDeletedInCompany } as unknown as PeopleDirectory;

  const listByOrdersInCompany = vi.fn(async (_companyId: string, ids: readonly string[]) =>
    (options?.team ?? []).filter((row) => ids.includes(row.orderId)),
  );
  const team = { listByOrdersInCompany };

  const todos = [
    listByOrdersInCompany,
    listEntriesForOrders,
    listExecutedOrderIds,
    listUserIdsWithEntries,
    append,
    findLastStepPosition,
    listSummariesByIdsIncludingDeleted,
    findRefsIncludingDeletedInCompany,
    listRecipeOutlinesByIdsIncludingDeleted,
    findRecipeRefs,
    findPresentationRefs,
    findUnitRefs,
  ];
  return {
    abrir: createGetExecutionTrace({ log, orders, people, team, recipes, presentations, units }),
    listar: createListExecutionTraces({ log, orders, people, team, recipes, presentations }),
    listEntriesForOrders,
    listByOrdersInCompany,
    listSummariesByIdsIncludingDeleted,
    findRefsIncludingDeletedInCompany,
    listRecipeOutlinesByIdsIncludingDeleted,
    findRecipeRefs,
    findPresentationRefs,
    findUnitRefs,
    ningunPuertoLlamado: () => todos.every((fn) => fn.mock.calls.length === 0),
  };
}

describe('getExecutionTrace — autorizacion antes de todo', () => {
  const sinElPermiso = PERMISSIONS.map((p) => p.code).filter((code) => code !== 'dashboard.consultar');

  it.each([
    ['ausente (null)', null],
    ['ausente (undefined)', undefined],
    ['sin conjunto de permisos', { id: ANA, companyId: EMPRESA } as unknown as Actor],
    ['con el conjunto vacio', { id: ANA, companyId: EMPRESA, permissions: [], roleName: 'Operador' }],
    ['con todo el catalogo menos dashboard.consultar', { id: ANA, companyId: EMPRESA, permissions: sinElPermiso }],
  ])('R19: un actor %s se rechaza sin llamar a ningun puerto', async (_caso, actor) => {
    const m = montar();
    await expect(m.abrir(actor as Actor | null | undefined, { orderId: PEDIDO }, NOW)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(m.ningunPuertoLlamado()).toBe(true);
  });

  it('R19: con dashboard.consultar solo, el recorrido se lee', async () => {
    const m = montar();
    await expect(m.abrir(ACTOR, { orderId: PEDIDO }, NOW)).resolves.toBeDefined();
  });
});

describe('getExecutionTrace — sin recorrido, el mismo 404', () => {
  async function errorDe(promesa: Promise<unknown>): Promise<unknown> {
    try {
      await promesa;
    } catch (error) {
      return error;
    }
    throw new Error('se esperaba un error');
  }

  it('R18: id mal formado, pedido inexistente o de otra empresa y pedido sin anotaciones dan el mismo error', async () => {
    const malFormado = montar();
    const inexistente = montar({ order: null });
    const sinAnotaciones = montar({ entries: [] });

    const errores = [
      await errorDe(malFormado.abrir(ACTOR, { orderId: 'no-es-un-uuid' }, NOW)),
      await errorDe(inexistente.abrir(ACTOR, { orderId: PEDIDO }, NOW)),
      await errorDe(sinAnotaciones.abrir(ACTOR, { orderId: PEDIDO }, NOW)),
    ];
    for (const error of errores) {
      expect(error).toBeInstanceOf(OrderNotFoundError);
      expect((error as OrderNotFoundError).code).toBe('order_not_found');
      expect((error as Error).message).toBe((errores[0] as Error).message);
    }
    expect(malFormado.ningunPuertoLlamado()).toBe(true);
    expect(inexistente.listEntriesForOrders).not.toHaveBeenCalled();
  });

  it('R18: una entrada con claves de mas tambien es el mismo 404', async () => {
    const m = montar();
    await expect(m.abrir(ACTOR, { orderId: PEDIDO, companyId: uuid('7') }, NOW)).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
    expect(m.ningunPuertoLlamado()).toBe(true);
  });

  it('R18: un pedido dado de baja con anotaciones no es 404, abre su recorrido marcado', async () => {
    const m = montar({ order: resumen({ status: 'EN_CURSO', deleted: true }) });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    expect(recorrido.deleted).toBe(true);
    expect(unica(recorrido).steps).toHaveLength(RECORRIDO.length);
    expect(recorrido.active).toBe(false);
    expect(unica(recorrido).durations.production?.kind).not.toBe('open');
  });

  it('R12 R18: pide a pedidos el pedido en cualquier estado, incluidos los dados de baja', async () => {
    const m = montar();
    await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    expect(m.listSummariesByIdsIncludingDeleted).toHaveBeenCalledWith(EMPRESA, [PEDIDO], ORDER_STATUS_VALUES, 1, 1);
  });
});

describe('getExecutionTrace — lo que muestra', () => {
  it('R13: las anotaciones en orden, con persona, posicion y motivo, y el numero y estado del pedido', async () => {
    const m = montar();
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);

    expect(recorrido).toMatchObject({
      orderId: PEDIDO,
      numberText: '2026-0000042',
      status: 'CANCELADO',
      deleted: false,
    });
    expect(unica(recorrido).goBackCount).toBe(1);
    expect(
      unica(recorrido).steps.map((step) => [step.action, step.userDisplayName, step.stepPosition, step.reason]),
    ).toEqual([
      ['start', 'Ana Perez', 1, null],
      ['advance', 'Ana Perez', 2, null],
      ['go_back', 'Bea Gomez', 1, null],
      ['cancel', 'Bea Gomez', 1, 'sin material'],
    ]);
    expect(unica(recorrido).steps.map((step) => step.gapToNextMs)).toEqual([10 * MIN, 5 * MIN, 25 * MIN, null]);
    expect(unica(recorrido).steps.map((step) => step.isGoBack)).toEqual([false, false, true, false]);
  });

  it('R13: una persona que el directorio ya no devuelve sale sin nombre, no rompe el recorrido', async () => {
    const m = montar({ people: [{ id: ANA, displayName: 'Ana Perez', isActive: true, permissions: [], roleName: 'Operador' }] });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    expect(unica(recorrido).steps.map((step) => step.userDisplayName)).toEqual(['Ana Perez', 'Ana Perez', null, null]);
  });

  it('R15 R27: el detalle trae el desglose y la fila su suma, del mismo calculo', async () => {
    for (const order of [
      resumen({ status: 'CANCELADO' }),
      resumen({ status: 'EN_CURSO' }),
      resumen({ status: 'EN_CURSO', deleted: true }),
    ]) {
      const m = montar({ order });
      const detalle = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
      const { page } = await m.listar(ACTOR, {}, NOW);
      const esperado = buildExecutionTrace(RECORRIDO, order, NOW);
      expect(unica(detalle).durations).toEqual(esperado.durations);
      expect(page.items[0]!.totalDuration).toEqual(esperado.totalDuration);
      expect(detalle.active).toBe(page.items[0]!.active);
      expect(unica(detalle).goBackCount).toBe(page.items[0]!.goBackCount);
    }
  });

  it('R15 R24: con el cancel en produccion y el pedido cancelado, produccion es cerrada', async () => {
    const m = montar();
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    expect(unica(recorrido).durations).toEqual({
      production: { kind: 'closed', ms: 40 * MIN },
      packing: null,
      conditioning: null,
    });
  });

  it('R23: todas las llamadas llevan la empresa del actor', async () => {
    const m = montar();
    await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    expect(m.listSummariesByIdsIncludingDeleted.mock.calls[0]![0]).toBe(EMPRESA);
    expect(m.listEntriesForOrders).toHaveBeenCalledWith(EMPRESA, [PEDIDO]);
    expect(m.findRefsIncludingDeletedInCompany).toHaveBeenCalledWith(EMPRESA, [ANA, BEA], NOW);
  });
});

describe('getExecutionTrace — las anotaciones del acondicionamiento', () => {
  const CARLA = uuid('5');
  const DIEGO = uuid('6');
  const ELENA = uuid('7');
  const GRUPO = uuid('8');
  const directorio: readonly PersonRef[] = [
    { id: ANA, displayName: 'Ana Perez', isActive: true, permissions: [], roleName: 'Supervisor' },
    { id: BEA, displayName: 'Bea Gomez', isActive: true, permissions: [], roleName: 'Operador' },
    { id: CARLA, displayName: 'Carla Diaz Actual', isActive: true, permissions: [], roleName: 'Operador' },
    { id: DIEGO, displayName: 'Diego Sanz', isActive: false, permissions: [], roleName: 'Operador' },
  ];
  const lineas: readonly ConditioningBatchSnapshotLine[] = [
    {
      batchId: uuid('b'),
      presentationId: uuid('c'),
      presentationName: 'Frasco 250 ml',
      lot: 'L-001',
      expiryDate: '2027-10-01',
      productionDate: '2026-10-01',
    },
    {
      batchId: uuid('d'),
      presentationId: uuid('e'),
      presentationName: null,
      lot: 'L-002',
      expiryDate: '2027-11-01',
      productionDate: '2026-10-01',
    },
  ];
  const acondicionado: readonly ExecutionEntryRecord[] = [
    anotacion('conditioning_start', 0, ANA, null),
    { ...anotacion('conditioning_batch_save', 10, BEA, null), batchLines: lineas },
    anotacion('conditioning_finish', 30, ANA, null),
  ];
  const equipo = [
    { orderId: PEDIDO, orderLineId: `linea-${PEDIDO}`, userId: CARLA, workGroupId: GRUPO, workGroupName: 'Turno manana (al comenzar)' },
    { orderId: PEDIDO, orderLineId: `linea-${PEDIDO}`, userId: DIEGO, workGroupId: null, workGroupName: null },
    { orderId: PEDIDO, orderLineId: `linea-${PEDIDO}`, userId: ELENA, workGroupId: null, workGroupName: null },
  ];

  it('R11: sin dashboard.consultar no lee registro ni equipo', async () => {
    const m = montar({ order: resumen({ status: 'TERMINADO' }), entries: acondicionado, team: equipo });
    const sinConsultar = PERMISSIONS.map((p) => p.code).filter((code) => code !== 'dashboard.consultar');
    await expect(
      m.abrir({ id: ANA, companyId: EMPRESA, permissions: sinConsultar }, { orderId: PEDIDO }, NOW),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(m.listEntriesForOrders).not.toHaveBeenCalled();
    expect(m.listByOrdersInCompany).not.toHaveBeenCalled();
  });

  it('R13: equipo con nombres actuales y grupo foto', async () => {
    const m = montar({
      order: resumen({ status: 'TERMINADO' }),
      entries: acondicionado,
      people: directorio,
      team: equipo,
    });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    const comenzar = unica(recorrido).steps[0]!;
    expect(comenzar.action).toBe('conditioning_start');
    if (comenzar.action !== 'conditioning_start') throw new Error('se esperaba el Comenzar');
    // El supervisor es quien firma el Comenzar.
    expect([comenzar.userId, comenzar.userDisplayName]).toEqual([ANA, 'Ana Perez']);
    expect(comenzar.team).toEqual([
      {
        userId: CARLA,
        displayName: 'Carla Diaz Actual',
        origin: { kind: 'workGroup', workGroupId: GRUPO, workGroupName: 'Turno manana (al comenzar)' },
      },
      // Dado de baja: el directorio lo sigue devolviendo con su nombre.
      { userId: DIEGO, displayName: 'Diego Sanz', origin: { kind: 'direct' } },
      // El directorio no lo devuelve: sin nombre, sin romper el recorrido.
      { userId: ELENA, displayName: null, origin: { kind: 'direct' } },
    ]);
    expect(m.listByOrdersInCompany).toHaveBeenCalledWith(EMPRESA, [PEDIDO]);
    expect(m.findRefsIncludingDeletedInCompany).toHaveBeenCalledTimes(1);
    expect(m.findRefsIncludingDeletedInCompany).toHaveBeenCalledWith(EMPRESA, [ANA, BEA, CARLA, DIEGO, ELENA], NOW);
  });

  it('R13: Comenzar sin equipo lleva la lista vacia', async () => {
    const m = montar({ order: resumen({ status: 'EN_ACONDICIONAMIENTO' }), entries: [acondicionado[0]!] });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    expect(unica(recorrido).steps[0]).toMatchObject({ action: 'conditioning_start', team: [], stepPosition: null, reason: null });
    expect(unica(recorrido).durations.conditioning).toEqual({ kind: 'open', ms: NOW.getTime() - T0 });
    expect(recorrido.active).toBe(true);
  });

  it('R13: el guardado lleva su foto como lines y el Terminar solo quien firma', async () => {
    const m = montar({ order: resumen({ status: 'TERMINADO' }), entries: acondicionado, people: directorio });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    const [, guardado, terminar] = unica(recorrido).steps;
    expect(guardado).toEqual({
      id: acondicionado[1]!.id,
      orderId: PEDIDO,
      userId: BEA,
      userDisplayName: 'Bea Gomez',
      occurredAt: acondicionado[1]!.occurredAt,
      gapToNextMs: 20 * MIN,
      isGoBack: false,
      action: 'conditioning_batch_save',
      stepPosition: null,
      reason: null,
      lines: lineas,
    });
    expect(terminar).toEqual({
      id: acondicionado[2]!.id,
      orderId: PEDIDO,
      userId: ANA,
      userDisplayName: 'Ana Perez',
      occurredAt: acondicionado[2]!.occurredAt,
      gapToNextMs: null,
      isGoBack: false,
      action: 'conditioning_finish',
      stepPosition: null,
      reason: null,
    });
    expect(unica(recorrido).durations.conditioning).toEqual({ kind: 'closed', ms: 30 * MIN });
  });

  it('R13: los pasos de produccion no llevan batchLines ni campos de acondicionamiento', async () => {
    const m = montar();
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    for (const step of unica(recorrido).steps) {
      expect(Object.keys(step).sort()).toEqual(
        ['action', 'gapToNextMs', 'id', 'isGoBack', 'occurredAt', 'orderId', 'reason', 'stepPosition', 'userDisplayName', 'userId'],
      );
    }
  });

  it('R32: sin Comenzar anotado no consulta el equipo', async () => {
    const m = montar({ team: equipo });
    await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    expect(m.listByOrdersInCompany).not.toHaveBeenCalled();
  });
});

describe('getExecutionTrace — pasos de acondicionamiento y responsables', () => {
  const CARLA = uuid('4');
  const DIEGO = uuid('5');
  const ELENA = uuid('6');
  const directorio: readonly PersonRef[] = [
    { id: ANA, displayName: 'Ana Perez', isActive: true, permissions: [], roleName: 'Supervisor' },
    { id: BEA, displayName: 'Bea Gomez', isActive: true, permissions: [], roleName: 'Operador' },
    { id: CARLA, displayName: 'Carla Diaz', isActive: true, permissions: [], roleName: 'Operador' },
    { id: DIEGO, displayName: 'Diego Sanz', isActive: false, permissions: [], roleName: 'Operador' },
  ];

  function paso(
    action: 'conditioning_step_advance' | 'conditioning_steps_complete' | 'conditioning_responsibles_change',
    offsetMin: number,
    stepPosition: number,
    responsibleUserIds: readonly string[] | null,
    userId = BEA,
  ): ExecutionEntryRecord {
    return { ...anotacion(action, offsetMin, userId, stepPosition), responsibleUserIds };
  }

  it('R35: «Avanzar» y «Completar pasos» traen paso y responsables con nombre; sin asignacion, lista vacia', async () => {
    const entries = [
      anotacion('conditioning_start', 0, ANA, null),
      paso('conditioning_step_advance', 5, 1, [CARLA, ELENA]),
      paso('conditioning_steps_complete', 12, 2, null),
    ];
    const m = montar({ order: resumen({ status: 'EN_ACONDICIONAMIENTO' }), entries, people: directorio });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    const [, avanzar, completar] = unica(recorrido).steps;
    expect(avanzar).toEqual({
      id: entries[1]!.id,
      orderId: PEDIDO,
      userId: BEA,
      userDisplayName: 'Bea Gomez',
      occurredAt: entries[1]!.occurredAt,
      gapToNextMs: 7 * MIN,
      isGoBack: false,
      action: 'conditioning_step_advance',
      stepPosition: 1,
      reason: null,
      responsibles: [
        { userId: CARLA, displayName: 'Carla Diaz' },
        // El directorio no la devuelve: sin nombre, sin romper el recorrido.
        { userId: ELENA, displayName: null },
      ],
    });
    expect(completar).toMatchObject({ action: 'conditioning_steps_complete', stepPosition: 2, responsibles: [] });
  });

  it('R35: los responsables entran en la misma lectura del directorio que los firmantes', async () => {
    const entries = [
      anotacion('conditioning_start', 0, ANA, null),
      paso('conditioning_step_advance', 5, 1, [CARLA]),
      paso('conditioning_responsibles_change', 9, 1, [DIEGO], ANA),
    ];
    const m = montar({ order: resumen({ status: 'EN_ACONDICIONAMIENTO' }), entries, people: directorio });
    await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    expect(m.findRefsIncludingDeletedInCompany).toHaveBeenCalledTimes(1);
    expect(m.findRefsIncludingDeletedInCompany).toHaveBeenCalledWith(EMPRESA, [ANA, BEA, CARLA, DIEGO], NOW);
  });

  it('R35: las anotaciones de paso cuentan dentro de la fase de acondicionamiento', async () => {
    const entries = [
      anotacion('conditioning_start', 0, ANA, null),
      paso('conditioning_step_advance', 5, 1, null),
      paso('conditioning_steps_complete', 12, 2, null),
      anotacion('conditioning_finish', 30, ANA, null),
    ];
    const m = montar({ order: resumen({ status: 'TERMINADO' }), entries, people: directorio });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    expect(unica(recorrido).durations.conditioning).toEqual({ kind: 'closed', ms: 30 * MIN });
  });

  it('R36: el cambio trae quien lo hizo, el paso, el conjunto anterior y el nuevo', async () => {
    const entries = [
      anotacion('conditioning_start', 0, ANA, null),
      paso('conditioning_step_advance', 5, 1, [CARLA, ELENA]),
      paso('conditioning_responsibles_change', 9, 1, [DIEGO], ANA),
    ];
    const m = montar({ order: resumen({ status: 'EN_ACONDICIONAMIENTO' }), entries, people: directorio });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    expect(unica(recorrido).steps[2]).toEqual({
      id: entries[2]!.id,
      orderId: PEDIDO,
      userId: ANA,
      userDisplayName: 'Ana Perez',
      occurredAt: entries[2]!.occurredAt,
      gapToNextMs: null,
      isGoBack: false,
      action: 'conditioning_responsibles_change',
      stepPosition: 1,
      reason: null,
      previous: [
        { userId: CARLA, displayName: 'Carla Diaz' },
        { userId: ELENA, displayName: null },
      ],
      responsibles: [{ userId: DIEGO, displayName: 'Diego Sanz' }],
    });
  });

  it('R36: el anterior es el vigente de esa posicion: encadena cambios y no mezcla pasos', async () => {
    const entries = [
      anotacion('conditioning_start', 0, ANA, null),
      paso('conditioning_step_advance', 5, 1, [CARLA]),
      paso('conditioning_step_advance', 8, 2, [BEA]),
      paso('conditioning_responsibles_change', 10, 1, [DIEGO], ANA),
      paso('conditioning_responsibles_change', 11, 1, [ELENA, CARLA], ANA),
      paso('conditioning_responsibles_change', 12, 2, [ANA], ANA),
    ];
    const m = montar({ order: resumen({ status: 'EN_ACONDICIONAMIENTO' }), entries, people: directorio });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    const cambios = unica(recorrido).steps.flatMap((step) =>
      step.action === 'conditioning_responsibles_change'
        ? [
            {
              paso: step.stepPosition,
              antes: step.previous.map((person) => person.userId),
              despues: step.responsibles.map((person) => person.userId),
            },
          ]
        : [],
    );
    expect(cambios).toEqual([
      { paso: 1, antes: [CARLA], despues: [DIEGO] },
      { paso: 1, antes: [DIEGO], despues: [ELENA, CARLA] },
      { paso: 2, antes: [BEA], despues: [ANA] },
    ]);
  });

  it('R36: un cambio sobre un paso sin responsables anotados trae el anterior vacio', async () => {
    const entries = [
      anotacion('conditioning_start', 0, ANA, null),
      paso('conditioning_step_advance', 5, 1, null),
      paso('conditioning_responsibles_change', 9, 1, [CARLA], ANA),
    ];
    const m = montar({ order: resumen({ status: 'EN_ACONDICIONAMIENTO' }), entries, people: directorio });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    expect(unica(recorrido).steps[2]).toMatchObject({
      previous: [],
      responsibles: [{ userId: CARLA, displayName: 'Carla Diaz' }],
    });
  });

  it('R36: una anotacion de paso sin posicion o un cambio sin responsables es un registro corrupto y lanza', async () => {
    const comenzar = anotacion('conditioning_start', 0, ANA, null);
    const sinPosicion = { ...paso('conditioning_step_advance', 5, 1, null), stepPosition: null };
    const m1 = montar({ order: resumen({ status: 'EN_ACONDICIONAMIENTO' }), entries: [comenzar, sinPosicion] });
    await expect(m1.abrir(ACTOR, { orderId: PEDIDO }, NOW)).rejects.toThrow(/no tiene paso/);

    const sinResponsables = paso('conditioning_responsibles_change', 5, 1, null);
    const m2 = montar({ order: resumen({ status: 'EN_ACONDICIONAMIENTO' }), entries: [comenzar, sinResponsables] });
    await expect(m2.abrir(ACTOR, { orderId: PEDIDO }, NOW)).rejects.toThrow(/no tiene los responsables/);
  });

  it('R35, R36: el recorrido sigue mostrando como historia los responsables de posiciones que la formula ya no tiene', async () => {
    // La formula actual tiene menos pasos que los anotados: el recorrido no la lee ni recorta.
    const entries = [
      anotacion('conditioning_start', 0, ANA, null),
      paso('conditioning_step_advance', 5, 7, [CARLA]),
      paso('conditioning_responsibles_change', 9, 7, [DIEGO], ANA),
    ];
    const m = montar({ order: resumen({ status: 'EN_ACONDICIONAMIENTO' }), entries, people: directorio });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    expect(unica(recorrido).steps[1]).toMatchObject({
      action: 'conditioning_step_advance',
      stepPosition: 7,
      responsibles: [{ userId: CARLA, displayName: 'Carla Diaz' }],
    });
    expect(unica(recorrido).steps[2]).toMatchObject({
      action: 'conditioning_responsibles_change',
      stepPosition: 7,
      previous: [{ userId: CARLA, displayName: 'Carla Diaz' }],
      responsibles: [{ userId: DIEGO, displayName: 'Diego Sanz' }],
    });
  });

  it('R37: los pasos de produccion siguen sin campos de responsables', async () => {
    const m = montar();
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    for (const step of unica(recorrido).steps) {
      expect(step).not.toHaveProperty('responsibles');
      expect(step).not.toHaveProperty('previous');
    }
  });
});

describe('getExecutionTrace — una seccion por receta', () => {
  const CREMA = uuid('c');
  const TONICO = uuid('e');
  const LINEA_2 = `linea-${PEDIDO}-2`;
  const LINEA_3 = `linea-${PEDIDO}-3`;
  const GALON = uuid('f');
  const VASO = uuid('9');
  const LITRO = uuid('0');
  const CARLA = uuid('5');
  const DIEGO = uuid('6');
  const directorio: readonly PersonRef[] = [
    { id: ANA, displayName: 'Ana Perez', isActive: true, permissions: [], roleName: 'Supervisor' },
    { id: BEA, displayName: 'Bea Gomez', isActive: true, permissions: [], roleName: 'Operador' },
    { id: CARLA, displayName: 'Carla Diaz', isActive: true, permissions: [], roleName: 'Operador' },
    { id: DIEGO, displayName: 'Diego Sanz', isActive: true, permissions: [], roleName: 'Operador' },
  ];
  const catalogos = {
    recipes: [
      { id: RECETA, name: 'Shampoo', ownName: 'Shampoo', isDeleted: false, isUnderReview: false, original: null, imageUrl: null },
      { id: CREMA, name: 'Crema', ownName: 'Crema', isDeleted: false, isUnderReview: false, original: null, imageUrl: null },
      { id: TONICO, name: 'Tonico', ownName: 'Tonico', isDeleted: false, isUnderReview: false, original: null, imageUrl: null },
    ] satisfies RecipeRef[],
    presentations: [
      { id: GALON, name: 'Galón', content: '1', unitId: LITRO },
      { id: VASO, name: 'Vaso', content: '1', unitId: LITRO },
    ] satisfies PresentationRef[],
    units: [{ id: LITRO, name: 'Litro', symbol: 'L' }] as unknown as UnitRef[],
  };

  function de(lineId: string, entry: ExecutionEntryRecord): ExecutionEntryRecord {
    return { ...entry, orderLineId: lineId };
  }

  function recetaDelPedido(
    lineId: string,
    position: number,
    recipeId: string,
    status: OrderLineStatus,
    presentationLines: OrderRecipesOutline['recipes'][number]['presentationLines'] = [],
  ): OrderRecipesOutline['recipes'][number] {
    return { lineId, position, recipeId, status, quantity: `${position}0`, unitId: LITRO, presentationLines };
  }

  function outline(
    recipes: OrderRecipesOutline['recipes'],
    progress: { total: number; finished: number },
    deleted = false,
  ): OrderRecipesOutline {
    return { id: PEDIDO, deleted, recipes, progress };
  }

  it('R25, R27: un PARCIAL de dos recetas mide cada fase con el estado de su linea y suma la duracion', async () => {
    const entries = [
      anotacion('start', 0, ANA, 1),
      anotacion('finish', 30, ANA, 1),
      de(LINEA_2, anotacion('start', 60, BEA, 1)),
      de(LINEA_2, anotacion('go_back', 70, BEA, 1)),
    ];
    const m = montar({
      order: resumen({ status: 'PARCIAL' }),
      entries,
      outline: outline(
        [
          recetaDelPedido(LINEA, 1, RECETA, 'TERMINADO', [{ presentationId: GALON, packages: 10 }]),
          recetaDelPedido(LINEA_2, 2, CREMA, 'EN_CURSO', [{ presentationId: VASO, packages: 4 }]),
        ],
        { total: 2, finished: 1 },
      ),
      people: directorio,
      ...catalogos,
    });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);

    const abierta = NOW.getTime() - (T0 + 60 * MIN);
    expect(recorrido).toMatchObject({
      status: 'PARCIAL',
      active: true,
      progress: { total: 2, finished: 1 },
      totalDuration: { kind: 'open', ms: 30 * MIN + abierta },
      firstAt: new Date(T0),
      lastAt: new Date(T0 + 70 * MIN),
    });
    const [primera, segunda] = recorrido.recipes;
    expect(primera).toMatchObject({
      lineId: LINEA,
      recipeName: 'Shampoo',
      status: 'TERMINADO',
      quantity: '10',
      unitLabel: 'L',
      presentations: [{ label: 'Galón', quantity: 10 }],
      durations: { production: { kind: 'closed', ms: 30 * MIN }, packing: null, conditioning: null },
      totalDuration: { kind: 'closed', ms: 30 * MIN },
      goBackCount: 0,
    });
    expect(segunda).toMatchObject({
      lineId: LINEA_2,
      recipeName: 'Crema',
      status: 'EN_CURSO',
      quantity: '20',
      presentations: [{ label: 'Vaso', quantity: 4 }],
      durations: { production: { kind: 'open', ms: abierta }, packing: null, conditioning: null },
      goBackCount: 1,
    });
    // Cada seccion lleva solo sus anotaciones, y el hueco al siguiente no cruza de receta.
    expect(primera!.steps.map((step) => step.id)).toEqual([entries[0]!.id, entries[1]!.id]);
    expect(segunda!.steps.map((step) => step.id)).toEqual([entries[2]!.id, entries[3]!.id]);
    expect(primera!.steps[1]!.gapToNextMs).toBeNull();
  });

  it('R25: una receta sin anotaciones no tiene seccion pero cuenta en el avance', async () => {
    const m = montar({
      order: resumen({ status: 'PARCIAL' }),
      entries: [anotacion('start', 0, ANA, 1), anotacion('finish', 30, ANA, 1)],
      outline: outline(
        [recetaDelPedido(LINEA, 1, RECETA, 'TERMINADO'), recetaDelPedido(LINEA_2, 2, CREMA, 'PENDIENTE')],
        { total: 2, finished: 1 },
      ),
      ...catalogos,
    });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    expect(recorrido.recipes.map((recipe) => recipe.lineId)).toEqual([LINEA]);
    expect(recorrido.progress).toEqual({ total: 2, finished: 1 });
  });

  it('R25: las secciones van en orden de alta aunque las anotaciones lleguen en otro orden', async () => {
    const m = montar({
      order: resumen({ status: 'PARCIAL' }),
      entries: [de(LINEA_3, anotacion('start', 0, ANA, 1)), anotacion('start', 5, ANA, 1)],
      outline: outline(
        [
          recetaDelPedido(LINEA_3, 3, TONICO, 'EN_CURSO'),
          recetaDelPedido(LINEA, 1, RECETA, 'EN_CURSO'),
          recetaDelPedido(LINEA_2, 2, CREMA, 'PENDIENTE'),
        ],
        { total: 3, finished: 0 },
      ),
      ...catalogos,
    });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    expect(recorrido.recipes.map((recipe) => recipe.recipeName)).toEqual(['Shampoo', 'Tonico']);
  });

  it('R26: equipo y responsables por receta: nada de una seccion pasa a la otra', async () => {
    const entries = [
      anotacion('conditioning_start', 0, ANA, null),
      { ...anotacion('conditioning_step_advance', 5, BEA, 1), responsibleUserIds: [CARLA] },
      de(LINEA_2, anotacion('conditioning_start', 10, ANA, null)),
      // En la otra receta el paso 1 no tenia responsables: el anterior es vacio, no CARLA.
      de(LINEA_2, { ...anotacion('conditioning_responsibles_change', 15, ANA, 1), responsibleUserIds: [DIEGO] }),
    ];
    const m = montar({
      order: resumen({ status: 'EN_ACONDICIONAMIENTO' }),
      entries,
      outline: outline(
        [
          recetaDelPedido(LINEA, 1, RECETA, 'EN_ACONDICIONAMIENTO'),
          recetaDelPedido(LINEA_2, 2, CREMA, 'EN_ACONDICIONAMIENTO'),
        ],
        { total: 2, finished: 0 },
      ),
      team: [
        { orderId: PEDIDO, orderLineId: LINEA, userId: CARLA, workGroupId: null, workGroupName: null },
        { orderId: PEDIDO, orderLineId: LINEA_2, userId: DIEGO, workGroupId: null, workGroupName: null },
      ],
      people: directorio,
      ...catalogos,
    });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    const equipoDe = (index: number) => {
      const comenzar = recorrido.recipes[index]!.steps[0]!;
      if (comenzar.action !== 'conditioning_start') throw new Error('se esperaba el Comenzar');
      return comenzar.team.map((member) => member.userId);
    };
    expect(equipoDe(0)).toEqual([CARLA]);
    expect(equipoDe(1)).toEqual([DIEGO]);
    expect(recorrido.recipes[1]!.steps[1]).toMatchObject({
      action: 'conditioning_responsibles_change',
      previous: [],
      responsibles: [{ userId: DIEGO, displayName: 'Diego Sanz' }],
    });
    expect(m.listByOrdersInCompany).toHaveBeenCalledTimes(1);
    expect(m.findRefsIncludingDeletedInCompany).toHaveBeenCalledTimes(1);
  });

  it('R28: una receta cancelada con anotaciones tiene su seccion, Cancelado y su linea de tiempo hasta la cancelacion', async () => {
    const entries = [
      anotacion('start', 0, ANA, 1),
      anotacion('advance', 10, ANA, 2),
      anotacion('cancel', 25, BEA, 2),
      de(LINEA_2, anotacion('start', 30, ANA, 1)),
    ];
    const m = montar({
      order: resumen({ status: 'EN_CURSO' }),
      entries,
      outline: outline(
        [recetaDelPedido(LINEA, 1, RECETA, 'CANCELADO'), recetaDelPedido(LINEA_2, 2, CREMA, 'EN_CURSO')],
        { total: 1, finished: 0 },
      ),
      ...catalogos,
    });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    const cancelada = recorrido.recipes[0]!;
    expect(cancelada).toMatchObject({ lineId: LINEA, recipeName: 'Shampoo', status: 'CANCELADO' });
    expect(cancelada.steps.map((step) => step.action)).toEqual(['start', 'advance', 'cancel']);
    expect(cancelada.durations.production).toEqual({ kind: 'closed', ms: 25 * MIN });
    expect(recorrido.recipes[1]!.durations.production?.kind).toBe('open');
    expect(recorrido.progress).toEqual({ total: 1, finished: 0 });
  });

  it('R24: un pedido dado de baja muestra las recetas que tenia al darse de baja, sin ninguna fase abierta', async () => {
    const m = montar({
      order: resumen({ status: 'EN_CURSO', deleted: true }),
      entries: [anotacion('start', 0, ANA, 1), de(LINEA_2, anotacion('start', 5, ANA, 1))],
      outline: outline(
        [recetaDelPedido(LINEA, 1, RECETA, 'EN_CURSO'), recetaDelPedido(LINEA_2, 2, CREMA, 'EN_CURSO')],
        { total: 2, finished: 0 },
        true,
      ),
      ...catalogos,
    });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    expect(m.listRecipeOutlinesByIdsIncludingDeleted).toHaveBeenCalledWith(EMPRESA, [PEDIDO]);
    expect(recorrido.deleted).toBe(true);
    expect(recorrido.active).toBe(false);
    expect(recorrido.recipes.map((recipe) => recipe.recipeName)).toEqual(['Shampoo', 'Crema']);
    expect(recorrido.recipes.map((recipe) => recipe.durations.production?.kind)).toEqual(['unclosed', 'unclosed']);
    expect(recorrido.totalDuration.kind).toBe('unclosed');
  });

  it('R29: un pedido de una receta da una sola seccion con el mismo recorrido de siempre', async () => {
    const order = resumen({ status: 'CANCELADO' });
    const m = montar({ order, ...catalogos });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    const esperado = buildExecutionTrace(RECORRIDO, order, NOW);
    const seccion = unica(recorrido);
    expect(seccion.steps.map((step) => step.id)).toEqual(esperado.steps.map((step) => step.id));
    expect(seccion.durations).toEqual(esperado.durations);
    expect(seccion.goBackCount).toBe(esperado.goBackCount);
    expect(recorrido.totalDuration).toEqual(esperado.totalDuration);
    expect([recorrido.firstAt, recorrido.lastAt]).toEqual([esperado.firstAt, esperado.lastAt]);
    expect(recorrido.active).toBe(esperado.active);
  });
});
