// tests/unit/asignaciones/list-execution-traces.test.ts
//
// La lista de pedidos ejecutados del dashboard, con los puertos simulados: autorizacion primero,
// la frontera zod, los filtros que viajan a cada puerto y la fila que sale de `buildExecutionTrace`.
//
// Enmendado el 2026-10-14 (QC-283): la fila cambia `duration` por `active` y `totalDuration`, y sus
// personas suman el equipo del Comenzar anotado; los casos de la fila se migran a esos campos.

import { describe, expect, it, vi } from 'vitest';

import { UnauthorizedError, ValidationError } from '@/lib/modules/asignaciones/domain/errors';
import { buildExecutionTrace } from '@/lib/modules/asignaciones/domain/execution-trace';
import {
  createListExecutionTraces,
  type ListExecutionTracesDeps,
} from '@/lib/modules/asignaciones/domain/list-execution-traces';
import { PERMISSIONS, type PersonRef } from '@/lib/modules/identity';
import { ORDER_STATUS_VALUES, type OrderCatalog, type OrderHistorySummary, type Page } from '@/lib/modules/pedidos';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';
import type { ExecutionAction, ExecutionEntryRecord } from '@/lib/modules/asignaciones/domain/execution-entry';
import type { ConditioningTeamMemberRow } from '@/lib/modules/asignaciones/ports/conditioning-team-repository';
import type { ExecutionLogRepository } from '@/lib/modules/asignaciones/ports/execution-log-repository';
import type { PeopleDirectory } from '@/lib/modules/identity';

/** Un uuid valido y legible a partir de un solo digito hexadecimal. */
function uuid(seed: string): string {
  return `${seed.repeat(8)}-${seed.repeat(4)}-4${seed.repeat(3)}-8${seed.repeat(3)}-${seed.repeat(12)}`;
}

const EMPRESA = uuid('3');
const ANA = uuid('1');
const BEA = uuid('2');
const PEDIDO_A = uuid('a');
const PEDIDO_B = uuid('b');
const PEDIDO_C = uuid('c');

const ACTOR: Actor = { id: ANA, companyId: EMPRESA, permissions: ['dashboard.consultar'] };

const T0 = Date.parse('2026-10-01T08:00:00.000Z');
const MIN = 60_000;
const NOW = new Date(T0 + 48 * 60 * MIN);

let seq = 0;
function anotacion(
  orderId: string,
  action: ExecutionAction,
  offsetMin: number,
  userId = ANA,
): ExecutionEntryRecord {
  seq += 1;
  return {
    id: `e-${String(seq).padStart(4, '0')}`,
    orderId,
    userId,
    action,
    stepPosition: action === 'pack_start' || action === 'pack_finish' || action.startsWith('conditioning_') ? null : 1,
    reason: action === 'cancel' ? 'sin material' : null,
    batchLines: null,
    occurredAt: new Date(T0 + offsetMin * MIN),
  };
}

function resumen(id: string, overrides?: Partial<OrderHistorySummary>): OrderHistorySummary {
  return { id, number: { year: 2026, sequence: 42 }, status: 'ENTREGADO', deleted: false, ...overrides };
}

function persona(id: string, displayName: string): PersonRef {
  return { id, displayName, isActive: true, permissions: [], roleName: 'Operador' };
}

type TeamRow = ConditioningTeamMemberRow & { readonly orderId: string };

function miembro(orderId: string, userId: string, group?: { id: string; name: string }): TeamRow {
  return { orderId, userId, workGroupId: group?.id ?? null, workGroupName: group?.name ?? null };
}

function pagina(items: readonly OrderHistorySummary[], page = 1, pageSize = 10): Page<OrderHistorySummary> {
  return { items, total: items.length, page, pageSize, totalPages: 1 };
}

function montar(options?: {
  readonly executedIds?: readonly string[];
  readonly orders?: readonly OrderHistorySummary[];
  readonly entries?: readonly ExecutionEntryRecord[];
  readonly usersWithEntries?: readonly string[];
  readonly people?: readonly PersonRef[];
  readonly team?: readonly TeamRow[];
}) {
  const listExecutedOrderIds = vi.fn(async () => options?.executedIds ?? [PEDIDO_A]);
  const listEntriesForOrders = vi.fn(async (_companyId: string, ids: readonly string[]) =>
    (options?.entries ?? []).filter((entry) => ids.includes(entry.orderId)),
  );
  const listUserIdsWithEntries = vi.fn(async () => options?.usersWithEntries ?? [ANA]);
  const append = vi.fn();
  const findLastStepPosition = vi.fn();
  const log: ExecutionLogRepository = {
    append,
    findLastStepPosition,
    listExecutedOrderIds,
    listEntriesForOrders,
    listUserIdsWithEntries,
  };

  const listSummariesByIdsIncludingDeleted = vi.fn<OrderCatalog['listSummariesByIdsIncludingDeleted']>(
    async (_companyId, _ids, _statuses, page, pageSize) => pagina(options?.orders ?? [], page, pageSize ?? 10),
  );
  const orders = { listSummariesByIdsIncludingDeleted } as unknown as OrderCatalog;

  const directorio = options?.people ?? [persona(ANA, 'Ana Perez'), persona(BEA, 'Bea Gomez')];
  const findRefsIncludingDeletedInCompany = vi.fn(
    async (_companyId: string, ids: readonly string[]) => directorio.filter((ref) => ids.includes(ref.id)),
  );
  const people = { findRefsIncludingDeletedInCompany } as unknown as PeopleDirectory;

  const listByOrdersInCompany = vi.fn(async (_companyId: string, ids: readonly string[]) =>
    (options?.team ?? []).filter((row) => ids.includes(row.orderId)),
  );
  const team = { listByOrdersInCompany };

  const deps: ListExecutionTracesDeps = { log, orders, people, team };
  const todos = [
    listByOrdersInCompany,
    listExecutedOrderIds,
    listEntriesForOrders,
    listUserIdsWithEntries,
    append,
    findLastStepPosition,
    listSummariesByIdsIncludingDeleted,
    findRefsIncludingDeletedInCompany,
  ];
  return {
    listar: createListExecutionTraces(deps),
    listExecutedOrderIds,
    listEntriesForOrders,
    listUserIdsWithEntries,
    listSummariesByIdsIncludingDeleted,
    findRefsIncludingDeletedInCompany,
    listByOrdersInCompany,
    ningunPuertoLlamado: () => todos.every((fn) => fn.mock.calls.length === 0),
  };
}

describe('listExecutionTraces — autorizacion antes de todo', () => {
  const sinElPermiso = PERMISSIONS.map((p) => p.code).filter((code) => code !== 'dashboard.consultar');

  it.each([
    ['ausente (null)', null],
    ['ausente (undefined)', undefined],
    ['sin conjunto de permisos', { id: ANA, companyId: EMPRESA } as unknown as Actor],
    ['con el conjunto vacio', { id: ANA, companyId: EMPRESA, permissions: [] }],
    ['con todo el catalogo menos dashboard.consultar', { id: ANA, companyId: EMPRESA, permissions: sinElPermiso }],
  ])('R19: un actor %s se rechaza sin llamar a ningun puerto', async (_caso, actor) => {
    const m = montar();
    await expect(m.listar(actor as Actor | null | undefined, {}, NOW)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(m.ningunPuertoLlamado()).toBe(true);
  });

  it('R19: con dashboard.consultar solo, la lista se lee', async () => {
    const m = montar();
    await expect(m.listar(ACTOR, {}, NOW)).resolves.toBeDefined();
  });

  it('R19: la entrada invalida de un actor sin permiso sigue siendo error de autorizacion', async () => {
    const m = montar();
    await expect(m.listar(null, { pageSize: 50 }, NOW)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe('listExecutionTraces — la frontera de entrada', () => {
  it.each([
    ['pageSize 50', { pageSize: 50 }],
    ['page 0', { page: 0 }],
    ['userId que no es uuid', { userId: 'ana' }],
    ['una clave de mas', { sort: 'number' }],
    ['una fecha que no existe', { from: '2026-02-30' }],
    ['una fecha con otro formato', { to: '01/10/2026' }],
    ['un numero de mas de 20 caracteres', { orderNumber: '1'.repeat(21) }],
  ])('R5: %s es ValidationError sin tocar ningun puerto', async (_caso, input) => {
    const m = montar();
    await expect(m.listar(ACTOR, input, NOW)).rejects.toBeInstanceOf(ValidationError);
    expect(m.ningunPuertoLlamado()).toBe(true);
  });

  it('R5: sin pagina ni tamano, pide la pagina 1 de 10', async () => {
    const m = montar();
    await m.listar(ACTOR, {}, NOW);
    const [, , , page, pageSize] = m.listSummariesByIdsIncludingDeleted.mock.calls[0]!;
    expect([page, pageSize]).toEqual([1, 10]);
  });

  it('R5: la pagina 3 de 25 llega tal cual a pedidos', async () => {
    const m = montar();
    await m.listar(ACTOR, { page: 3, pageSize: 25 }, NOW);
    const [, , , page, pageSize] = m.listSummariesByIdsIncludingDeleted.mock.calls[0]!;
    expect([page, pageSize]).toEqual([3, 25]);
  });
});

describe('listExecutionTraces — el filtro por numero', () => {
  it('R6: un texto con letras no es invalido, llega tal cual como numberContains', async () => {
    const m = montar();
    await expect(m.listar(ACTOR, { orderNumber: 'abc' }, NOW)).resolves.toBeDefined();
    expect(m.listSummariesByIdsIncludingDeleted.mock.calls[0]![5]).toEqual({ numberContains: 'abc' });
  });

  it('R6: los espacios de los extremos se quitan antes de mandarlo', async () => {
    const m = montar();
    await m.listar(ACTOR, { orderNumber: '  2026-0000042 ' }, NOW);
    expect(m.listSummariesByIdsIncludingDeleted.mock.calls[0]![5]).toEqual({ numberContains: '2026-0000042' });
  });

  it('R6: un texto vacio tras quitar espacios es filtro ausente y no se manda', async () => {
    const m = montar();
    await m.listar(ACTOR, { orderNumber: '   ' }, NOW);
    expect(m.listSummariesByIdsIncludingDeleted.mock.calls[0]![5]).toBeUndefined();
  });
});

describe('listExecutionTraces — que pedidos salen', () => {
  it('R1: sin ningun pedido ejecutado, pagina vacia sin preguntar a pedidos', async () => {
    const m = montar({ executedIds: [] });
    const { page, personOptions } = await m.listar(ACTOR, { pageSize: 25 }, NOW);
    expect(page).toEqual({ items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 });
    expect(m.listSummariesByIdsIncludingDeleted).not.toHaveBeenCalled();
    expect(m.listEntriesForOrders).not.toHaveBeenCalled();
    // El filtro de persona se puede pintar aunque la lista quede vacia.
    expect(personOptions).toEqual([{ userId: ANA, displayName: 'Ana Perez' }]);
  });

  it('R1 R24: la pagina la pide a listSummariesByIdsIncludingDeleted con los ids del registro', async () => {
    const m = montar({ executedIds: [PEDIDO_A, PEDIDO_B] });
    await m.listar(ACTOR, {}, NOW);
    expect(m.listSummariesByIdsIncludingDeleted).toHaveBeenCalledTimes(1);
    expect(m.listSummariesByIdsIncludingDeleted.mock.calls[0]![1]).toEqual([PEDIDO_A, PEDIDO_B]);
  });

  it('R9: «solo cancelados» pide solo CANCELADO', async () => {
    const m = montar();
    await m.listar(ACTOR, { cancelledOnly: true }, NOW);
    expect(m.listSummariesByIdsIncludingDeleted.mock.calls[0]![2]).toEqual(['CANCELADO']);
  });

  it('R9: sin «solo cancelados» pide todos los estados', async () => {
    const m = montar();
    await m.listar(ACTOR, { cancelledOnly: false }, NOW);
    expect(m.listSummariesByIdsIncludingDeleted.mock.calls[0]![2]).toEqual(ORDER_STATUS_VALUES);
  });

  it('R4: las filas salen en el orden en que pedidos pagina, sin reordenar', async () => {
    const m = montar({
      executedIds: [PEDIDO_A, PEDIDO_B, PEDIDO_C],
      orders: [
        resumen(PEDIDO_C, { number: { year: 2026, sequence: 9 } }),
        resumen(PEDIDO_A, { number: { year: 2026, sequence: 5 } }),
        resumen(PEDIDO_B, { number: { year: 2025, sequence: 70 } }),
      ],
      entries: [
        anotacion(PEDIDO_A, 'start', 0),
        anotacion(PEDIDO_B, 'start', 0),
        anotacion(PEDIDO_C, 'start', 0),
      ],
    });
    const { page } = await m.listar(ACTOR, {}, NOW);
    expect(page.items.map((row) => row.numberText)).toEqual(['2026-0000009', '2026-0000005', '2025-0000070']);
  });

  it('R10: todos los filtros viajan a la vez, cada uno a su puerto', async () => {
    const m = montar();
    await m.listar(
      ACTOR,
      { userId: BEA, from: '2026-10-01', to: '2026-10-03', cancelledOnly: true, orderNumber: '42' },
      NOW,
    );
    expect(m.listExecutedOrderIds).toHaveBeenCalledWith(EMPRESA, {
      userId: BEA,
      occurredFrom: new Date('2026-10-01T00:00:00.000Z'),
      occurredBefore: new Date('2026-10-04T00:00:00.000Z'),
    });
    const [, , statuses, , , filter] = m.listSummariesByIdsIncludingDeleted.mock.calls[0]!;
    expect(statuses).toEqual(['CANCELADO']);
    expect(filter).toEqual({ numberContains: '42' });
  });
});

describe('listExecutionTraces — persona y fechas', () => {
  it('R7: el filtro de persona llega al registro', async () => {
    const m = montar();
    await m.listar(ACTOR, { userId: BEA }, NOW);
    expect(m.listExecutedOrderIds).toHaveBeenCalledWith(EMPRESA, { userId: BEA });
  });

  it('R8: el rango va de las 00:00Z de «desde» inclusivo al dia siguiente a «hasta» exclusivo', async () => {
    const m = montar();
    await m.listar(ACTOR, { from: '2026-10-01', to: '2026-10-01' }, NOW);
    expect(m.listExecutedOrderIds).toHaveBeenCalledWith(EMPRESA, {
      occurredFrom: new Date('2026-10-01T00:00:00.000Z'),
      occurredBefore: new Date('2026-10-02T00:00:00.000Z'),
    });
  });

  it('R8: un extremo vacio no acota por ese lado', async () => {
    const m = montar();
    await m.listar(ACTOR, { to: '2026-12-31' }, NOW);
    expect(m.listExecutedOrderIds).toHaveBeenCalledWith(EMPRESA, {
      occurredBefore: new Date('2027-01-01T00:00:00.000Z'),
    });
  });

  it('R8: sin rango ni persona, el registro no recibe ningun filtro', async () => {
    const m = montar();
    await m.listar(ACTOR, {}, NOW);
    expect(m.listExecutedOrderIds).toHaveBeenCalledWith(EMPRESA, {});
  });

  it('R7: las opciones de persona incluyen a las dadas de baja, por nombre', async () => {
    const DADA_DE_BAJA = uuid('9');
    const m = montar({
      usersWithEntries: [BEA, DADA_DE_BAJA, ANA],
      people: [
        persona(ANA, 'Ana Perez'),
        persona(BEA, 'Bea Gomez'),
        { ...persona(DADA_DE_BAJA, 'Abel Ruiz'), isActive: false },
      ],
    });
    const { personOptions } = await m.listar(ACTOR, {}, NOW);
    expect(m.findRefsIncludingDeletedInCompany).toHaveBeenCalledWith(EMPRESA, [BEA, DADA_DE_BAJA, ANA], NOW);
    expect(personOptions).toEqual([
      { userId: DADA_DE_BAJA, displayName: 'Abel Ruiz' },
      { userId: ANA, displayName: 'Ana Perez' },
      { userId: BEA, displayName: 'Bea Gomez' },
    ]);
  });
});

describe('listExecutionTraces — la fila', () => {
  const entregado = [
    anotacion(PEDIDO_A, 'start', 0),
    anotacion(PEDIDO_A, 'go_back', 10, BEA),
    anotacion(PEDIDO_A, 'finish', 60),
    anotacion(PEDIDO_A, 'pack_start', 120, BEA),
    anotacion(PEDIDO_A, 'pack_finish', 150, BEA),
  ];

  it('R2 R15 R27: la fila lleva active y un solo total, el mismo que da buildExecutionTrace', async () => {
    const orden = resumen(PEDIDO_A, { status: 'ENTREGADO' });
    const m = montar({ orders: [orden], entries: entregado });
    const { page } = await m.listar(ACTOR, {}, NOW);
    const [fila] = page.items;
    const esperado = buildExecutionTrace(entregado, orden, NOW);
    expect(fila).toEqual({
      orderId: PEDIDO_A,
      numberText: '2026-0000042',
      status: 'ENTREGADO',
      deleted: false,
      active: false,
      people: [
        { userId: ANA, displayName: 'Ana Perez' },
        { userId: BEA, displayName: 'Bea Gomez' },
      ],
      firstAt: esperado.firstAt,
      lastAt: esperado.lastAt,
      totalDuration: esperado.totalDuration,
      goBackCount: 1,
    });
    // Produccion 60 + empaque 30: la espera entre finish y pack_start no cuenta.
    expect(fila!.totalDuration).toEqual({ kind: 'closed', ms: 90 * MIN });
  });

  it('R3 R20: un pedido activo sale con el total abierto hasta el instante de la consulta', async () => {
    const m = montar({
      orders: [resumen(PEDIDO_A, { status: 'EN_CURSO' })],
      entries: [anotacion(PEDIDO_A, 'start', 0), anotacion(PEDIDO_A, 'advance', 5)],
    });
    const { page } = await m.listar(ACTOR, {}, NOW);
    expect(page.items[0]!.active).toBe(true);
    expect(page.items[0]!.totalDuration).toEqual({ kind: 'open', ms: NOW.getTime() - T0 });
  });

  it('R1 R2 R3 R21: un pedido dado de baja sale marcado, sin active, y su total no es abierto', async () => {
    const m = montar({
      orders: [resumen(PEDIDO_A, { status: 'EN_CURSO', deleted: true })],
      entries: [anotacion(PEDIDO_A, 'start', 0), anotacion(PEDIDO_A, 'advance', 5)],
    });
    const { page } = await m.listar(ACTOR, {}, NOW);
    expect(page.items[0]!.deleted).toBe(true);
    expect(page.items[0]!.active).toBe(false);
    expect(page.items[0]!.totalDuration).toEqual({ kind: 'unclosed', ms: 5 * MIN });
  });

  it('R1: el total y la paginacion son los de pedidos', async () => {
    const m = montar({ orders: [resumen(PEDIDO_A)], entries: [anotacion(PEDIDO_A, 'start', 0)] });
    m.listSummariesByIdsIncludingDeleted.mockResolvedValueOnce({
      items: [resumen(PEDIDO_A)],
      total: 31,
      page: 4,
      pageSize: 10,
      totalPages: 4,
    });
    const { page } = await m.listar(ACTOR, { page: 4 }, NOW);
    expect({ ...page, items: page.items.length }).toEqual({ items: 1, total: 31, page: 4, pageSize: 10, totalPages: 4 });
  });
});

describe('listExecutionTraces — empresa y numero de consultas', () => {
  it('R23: todas las llamadas llevan la empresa del actor', async () => {
    const m = montar({
      orders: [resumen(PEDIDO_A)],
      entries: [anotacion(PEDIDO_A, 'start', 0), anotacion(PEDIDO_A, 'conditioning_start', 5)],
    });
    await m.listar(ACTOR, {}, NOW);
    expect(m.listByOrdersInCompany).toHaveBeenCalled();
    const llamadas = [
      ...m.listUserIdsWithEntries.mock.calls,
      ...m.listExecutedOrderIds.mock.calls,
      ...m.listSummariesByIdsIncludingDeleted.mock.calls,
      ...m.listEntriesForOrders.mock.calls,
      ...m.findRefsIncludingDeletedInCompany.mock.calls,
      ...m.listByOrdersInCompany.mock.calls,
    ] as unknown as readonly (readonly unknown[])[];
    expect(llamadas.length).toBeGreaterThan(0);
    for (const llamada of llamadas) expect(llamada[0]).toBe(EMPRESA);
  });

  it('R23: una entrada con companyId se rechaza y no toca ningun puerto', async () => {
    const m = montar();
    await expect(m.listar(ACTOR, { companyId: uuid('7') }, NOW)).rejects.toBeInstanceOf(ValidationError);
    expect(m.ningunPuertoLlamado()).toBe(true);
  });

  it('R1: las consultas por pagina son constantes, no una por fila', async () => {
    const ids = ['0', '4', '5', '6', '7', '8', 'd', 'e', 'f', 'a'].map(uuid);
    const m = montar({
      executedIds: ids,
      orders: ids.map((id) => resumen(id)),
      entries: ids.flatMap((id) => [anotacion(id, 'conditioning_start', 0, ANA), anotacion(id, 'cancel', 3, BEA)]),
      usersWithEntries: [ANA, BEA],
      team: ids.map((id) => miembro(id, BEA)),
    });
    const { page } = await m.listar(ACTOR, { orderNumber: '42' }, NOW);
    expect(page.items).toHaveLength(10);
    expect(m.listUserIdsWithEntries).toHaveBeenCalledTimes(1);
    expect(m.listExecutedOrderIds).toHaveBeenCalledTimes(1);
    expect(m.listSummariesByIdsIncludingDeleted).toHaveBeenCalledTimes(1);
    expect(m.listEntriesForOrders).toHaveBeenCalledTimes(1);
    expect(m.listByOrdersInCompany).toHaveBeenCalledTimes(1);
    // Una para las opciones de persona y otra para toda la pagina.
    expect(m.findRefsIncludingDeletedInCompany).toHaveBeenCalledTimes(2);
  });
});

describe('listExecutionTraces — el equipo del acondicionamiento', () => {
  const CARLA = uuid('5');
  const DIEGO = uuid('6');
  const ELENA = uuid('7');
  const GRUPO = { id: uuid('8'), name: 'Turno manana' };
  const directorio = [
    persona(ANA, 'Ana Perez'),
    persona(BEA, 'Bea Gomez'),
    persona(CARLA, 'Carla Diaz'),
    persona(DIEGO, 'Diego Sanz'),
    persona(ELENA, 'Elena Mora'),
  ];

  it('R11: sin dashboard.consultar no lee registro ni equipo', async () => {
    const m = montar({
      orders: [resumen(PEDIDO_A)],
      entries: [anotacion(PEDIDO_A, 'conditioning_start', 0)],
      team: [miembro(PEDIDO_A, CARLA)],
    });
    const sinConsultar = PERMISSIONS.map((p) => p.code).filter((code) => code !== 'dashboard.consultar');
    await expect(
      m.listar({ id: ANA, companyId: EMPRESA, permissions: sinConsultar }, {}, NOW),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(m.listEntriesForOrders).not.toHaveBeenCalled();
    expect(m.listExecutedOrderIds).not.toHaveBeenCalled();
    expect(m.listByOrdersInCompany).not.toHaveBeenCalled();
  });

  it('R29: firmantes y despues equipo, sin repetir', async () => {
    const m = montar({
      orders: [resumen(PEDIDO_A, { status: 'EN_ACONDICIONAMIENTO' })],
      entries: [anotacion(PEDIDO_A, 'start', 0, BEA), anotacion(PEDIDO_A, 'conditioning_start', 10, ANA)],
      people: directorio,
      // BEA firma y ademas esta en el equipo: sale una sola vez, en su sitio de firmante.
      team: [miembro(PEDIDO_A, DIEGO, GRUPO), miembro(PEDIDO_A, BEA), miembro(PEDIDO_A, CARLA, GRUPO)],
    });
    const { page } = await m.listar(ACTOR, {}, NOW);
    expect(page.items[0]!.people).toEqual([
      { userId: BEA, displayName: 'Bea Gomez' },
      { userId: ANA, displayName: 'Ana Perez' },
      { userId: DIEGO, displayName: 'Diego Sanz' },
      { userId: CARLA, displayName: 'Carla Diaz' },
    ]);
  });

  it('R29: nombres actuales del directorio, con una sola lectura de equipo y de personas por pagina', async () => {
    const m = montar({
      executedIds: [PEDIDO_A, PEDIDO_B],
      orders: [resumen(PEDIDO_A), resumen(PEDIDO_B)],
      entries: [anotacion(PEDIDO_A, 'conditioning_start', 0, ANA), anotacion(PEDIDO_B, 'conditioning_start', 0, ANA)],
      people: [persona(ANA, 'Ana Perez'), persona(ELENA, 'Elena Mora Nueva')],
      team: [miembro(PEDIDO_A, ELENA, GRUPO), miembro(PEDIDO_B, ELENA)],
    });
    const { page } = await m.listar(ACTOR, {}, NOW);
    expect(page.items.map((row) => row.people.map((p) => p.displayName))).toEqual([
      ['Ana Perez', 'Elena Mora Nueva'],
      ['Ana Perez', 'Elena Mora Nueva'],
    ]);
    expect(m.listByOrdersInCompany).toHaveBeenCalledTimes(1);
    expect(m.listByOrdersInCompany).toHaveBeenCalledWith(EMPRESA, [PEDIDO_A, PEDIDO_B]);
    expect(m.findRefsIncludingDeletedInCompany).toHaveBeenCalledWith(EMPRESA, [ANA, ELENA], NOW);
  });

  it('R32: equipo sin Comenzar no sale', async () => {
    const m = montar({
      executedIds: [PEDIDO_A, PEDIDO_B],
      orders: [resumen(PEDIDO_A), resumen(PEDIDO_B)],
      entries: [
        anotacion(PEDIDO_A, 'start', 0, ANA),
        anotacion(PEDIDO_A, 'finish', 10, ANA),
        anotacion(PEDIDO_B, 'conditioning_start', 0, ANA),
      ],
      people: directorio,
      team: [miembro(PEDIDO_A, CARLA), miembro(PEDIDO_B, DIEGO)],
    });
    const { page } = await m.listar(ACTOR, {}, NOW);
    expect(m.listByOrdersInCompany).toHaveBeenCalledWith(EMPRESA, [PEDIDO_B]);
    expect(page.items.map((row) => row.people.map((p) => p.userId))).toEqual([[ANA], [ANA, DIEGO]]);
  });

  it('R32: sin ningun Comenzar en la pagina no consulta el equipo', async () => {
    const m = montar({
      orders: [resumen(PEDIDO_A)],
      entries: [anotacion(PEDIDO_A, 'start', 0, ANA)],
      team: [miembro(PEDIDO_A, CARLA)],
    });
    await m.listar(ACTOR, {}, NOW);
    expect(m.listByOrdersInCompany).not.toHaveBeenCalled();
  });

  it('R31: opciones solo de firmantes', async () => {
    const m = montar({
      orders: [resumen(PEDIDO_A)],
      entries: [
        anotacion(PEDIDO_A, 'conditioning_start', 0, ANA),
        anotacion(PEDIDO_A, 'conditioning_batch_save', 5, BEA),
      ],
      usersWithEntries: [ANA, BEA],
      people: directorio,
      team: [miembro(PEDIDO_A, CARLA), miembro(PEDIDO_A, DIEGO)],
    });
    const { personOptions, page } = await m.listar(ACTOR, {}, NOW);
    expect(personOptions).toEqual([
      { userId: ANA, displayName: 'Ana Perez' },
      { userId: BEA, displayName: 'Bea Gomez' },
    ]);
    // El equipo si sale en la fila, pero no en las opciones.
    expect(page.items[0]!.people.map((p) => p.userId)).toEqual([ANA, BEA, CARLA, DIEGO]);
  });

  it('R27: la fila trae totalDuration y no el desglose', async () => {
    const m = montar({
      orders: [resumen(PEDIDO_A, { status: 'TERMINADO' })],
      entries: [
        anotacion(PEDIDO_A, 'start', 0),
        anotacion(PEDIDO_A, 'finish', 30),
        anotacion(PEDIDO_A, 'conditioning_start', 100),
        anotacion(PEDIDO_A, 'conditioning_finish', 145),
      ],
    });
    const { page } = await m.listar(ACTOR, {}, NOW);
    const fila = page.items[0]!;
    expect(Object.keys(fila)).not.toContain('durations');
    expect(Object.keys(fila)).not.toContain('duration');
    expect(fila.totalDuration).toEqual({ kind: 'closed', ms: 75 * MIN });
  });
});
