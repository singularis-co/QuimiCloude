// tests/unit/asignaciones/get-execution-trace.test.ts
//
// El recorrido de un pedido, con los puertos simulados: autorizacion primero, un solo error para
// los tres casos de «no hay recorrido» y los dados de baja que si lo abren.

import { describe, expect, it, vi } from 'vitest';

import { OrderNotFoundError, UnauthorizedError } from '@/lib/modules/asignaciones/domain/errors';
import { buildExecutionTrace } from '@/lib/modules/asignaciones/domain/execution-trace';
import { createGetExecutionTrace } from '@/lib/modules/asignaciones/domain/get-execution-trace';
import { createListExecutionTraces } from '@/lib/modules/asignaciones/domain/list-execution-traces';
import { PERMISSIONS, type PersonRef } from '@/lib/modules/identity';
import { ORDER_STATUS_VALUES, type OrderCatalog, type OrderHistorySummary } from '@/lib/modules/pedidos';

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

function montar(options?: {
  readonly order?: OrderHistorySummary | null;
  readonly entries?: readonly ExecutionEntryRecord[];
  readonly people?: readonly PersonRef[];
  readonly team?: readonly (ConditioningTeamMemberRow & { readonly orderId: string })[];
}) {
  const order = options?.order === undefined ? resumen() : options.order;
  const entries = options?.entries ?? RECORRIDO;

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
  // Solo la lista lee el reparto; sin reparto, recetas y presentaciones no se consultan.
  const listDeliveryProgressByIdsIncludingDeleted = vi.fn(async () => []);
  const orders = { listSummariesByIdsIncludingDeleted, listDeliveryProgressByIdsIncludingDeleted } as unknown as OrderCatalog;
  const recipes = { findRefsIncludingDeleted: vi.fn(async () => []) };
  const presentations = { findRefs: vi.fn(async () => []) };

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
  ];
  return {
    abrir: createGetExecutionTrace({ log, orders, people, team }),
    listar: createListExecutionTraces({ log, orders, people, team, recipes, presentations }),
    listEntriesForOrders,
    listByOrdersInCompany,
    listSummariesByIdsIncludingDeleted,
    findRefsIncludingDeletedInCompany,
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
    expect(recorrido.steps).toHaveLength(RECORRIDO.length);
    expect(recorrido.active).toBe(false);
    expect(recorrido.durations.production?.kind).not.toBe('open');
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
      goBackCount: 1,
    });
    expect(
      recorrido.steps.map((step) => [step.action, step.userDisplayName, step.stepPosition, step.reason]),
    ).toEqual([
      ['start', 'Ana Perez', 1, null],
      ['advance', 'Ana Perez', 2, null],
      ['go_back', 'Bea Gomez', 1, null],
      ['cancel', 'Bea Gomez', 1, 'sin material'],
    ]);
    expect(recorrido.steps.map((step) => step.gapToNextMs)).toEqual([10 * MIN, 5 * MIN, 25 * MIN, null]);
    expect(recorrido.steps.map((step) => step.isGoBack)).toEqual([false, false, true, false]);
  });

  it('R13: una persona que el directorio ya no devuelve sale sin nombre, no rompe el recorrido', async () => {
    const m = montar({ people: [{ id: ANA, displayName: 'Ana Perez', isActive: true, permissions: [], roleName: 'Operador' }] });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    expect(recorrido.steps.map((step) => step.userDisplayName)).toEqual(['Ana Perez', 'Ana Perez', null, null]);
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
      expect(detalle.durations).toEqual(esperado.durations);
      expect(page.items[0]!.totalDuration).toEqual(esperado.totalDuration);
      expect(detalle.active).toBe(page.items[0]!.active);
      expect(detalle.goBackCount).toBe(page.items[0]!.goBackCount);
    }
  });

  it('R15 R24: con el cancel en produccion y el pedido cancelado, produccion es cerrada', async () => {
    const m = montar();
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    expect(recorrido.durations).toEqual({
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
    { orderId: PEDIDO, userId: CARLA, workGroupId: GRUPO, workGroupName: 'Turno manana (al comenzar)' },
    { orderId: PEDIDO, userId: DIEGO, workGroupId: null, workGroupName: null },
    { orderId: PEDIDO, userId: ELENA, workGroupId: null, workGroupName: null },
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
    const comenzar = recorrido.steps[0]!;
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
    expect(recorrido.steps[0]).toMatchObject({ action: 'conditioning_start', team: [], stepPosition: null, reason: null });
    expect(recorrido.durations.conditioning).toEqual({ kind: 'open', ms: NOW.getTime() - T0 });
    expect(recorrido.active).toBe(true);
  });

  it('R13: el guardado lleva su foto como lines y el Terminar solo quien firma', async () => {
    const m = montar({ order: resumen({ status: 'TERMINADO' }), entries: acondicionado, people: directorio });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    const [, guardado, terminar] = recorrido.steps;
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
    expect(recorrido.durations.conditioning).toEqual({ kind: 'closed', ms: 30 * MIN });
  });

  it('R13: los pasos de produccion no llevan batchLines ni campos de acondicionamiento', async () => {
    const m = montar();
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    for (const step of recorrido.steps) {
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
    const [, avanzar, completar] = recorrido.steps;
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
    expect(recorrido.durations.conditioning).toEqual({ kind: 'closed', ms: 30 * MIN });
  });

  it('R36: el cambio trae quien lo hizo, el paso, el conjunto anterior y el nuevo', async () => {
    const entries = [
      anotacion('conditioning_start', 0, ANA, null),
      paso('conditioning_step_advance', 5, 1, [CARLA, ELENA]),
      paso('conditioning_responsibles_change', 9, 1, [DIEGO], ANA),
    ];
    const m = montar({ order: resumen({ status: 'EN_ACONDICIONAMIENTO' }), entries, people: directorio });
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    expect(recorrido.steps[2]).toEqual({
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
    const cambios = recorrido.steps.flatMap((step) =>
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
    expect(recorrido.steps[2]).toMatchObject({
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
    expect(recorrido.steps[1]).toMatchObject({
      action: 'conditioning_step_advance',
      stepPosition: 7,
      responsibles: [{ userId: CARLA, displayName: 'Carla Diaz' }],
    });
    expect(recorrido.steps[2]).toMatchObject({
      action: 'conditioning_responsibles_change',
      stepPosition: 7,
      previous: [{ userId: CARLA, displayName: 'Carla Diaz' }],
      responsibles: [{ userId: DIEGO, displayName: 'Diego Sanz' }],
    });
  });

  it('R37: los pasos de produccion siguen sin campos de responsables', async () => {
    const m = montar();
    const recorrido = await m.abrir(ACTOR, { orderId: PEDIDO }, NOW);
    for (const step of recorrido.steps) {
      expect(step).not.toHaveProperty('responsibles');
      expect(step).not.toHaveProperty('previous');
    }
  });
});
