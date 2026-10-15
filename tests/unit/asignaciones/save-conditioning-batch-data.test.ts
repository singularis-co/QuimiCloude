// QC-284 T8 (sobre QC-219 T7) — Guardar los datos de lote de un pedido: un solo juego de datos para
// todas sus lineas con lote, y el orden de las reglas, con puertos simulados.
// QC-283: `listOfOrder` y `findRefs` se leen antes de la transaccion de ejecucion, fuera de ella; la
// escritura y la anotacion con la foto van dentro.
import { describe, expect, it, vi } from 'vitest';

import {
  createSaveConditioningBatchData,
  type SaveConditioningBatchDataDeps,
} from '@/lib/modules/asignaciones/domain/save-conditioning-batch-data';
import {
  BatchExpiryNotFutureError,
  BatchProductionDateFutureError,
  ConditioningBatchDuplicateLotError,
  ConditioningBatchNotFoundError,
  OrderConditioningTakenError,
  OrderNotConditionableError,
  OrderNotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/modules/asignaciones/domain/errors';
import { ROLE_ADMINISTRADOR, ROLE_EMPACADOR, ROLE_OPERADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';
import type { NewExecutionEntry } from '@/lib/modules/asignaciones/domain/execution-entry';
import type {
  FinishedBatchLabels,
  FinishedBatchLabelsOutcome,
  FinishedBatchOfOrderLine,
  PresentationCatalog,
  PresentationRef,
} from '@/lib/modules/inventario';
import type { OrderCatalog, OrderStatus } from '@/lib/modules/pedidos';

import {
  ACONDICIONADOR,
  AHORA,
  ANA,
  BETO,
  EMPRESA,
  PEDIDO_1,
  actoresSinElPermiso,
  loteDeLinea,
  transaccionDeAcondicionamiento,
  uuid,
} from './conditioning-doubles';

// AHORA = 2026-10-08T10:00Z: «hoy» es 2026-10-08.
const HOY = '2026-10-08';
const MANANA = '2026-10-09';
const LOTE_A = uuid('7');
const LOTE_B = uuid('8');
const LOTE_C = uuid('9');
const FRASCO = uuid('c');
const GARRAFA = uuid('d');
const SIN_NOMBRE = uuid('e');

type Datos = { lot: string; expiryDate: string; productionDate: string };

function entrada(overrides?: Partial<Datos>) {
  return { orderId: PEDIDO_1, lot: 'CR-2610', expiryDate: '2027-04-30', productionDate: HOY, ...overrides };
}

function presentacion(id: string, name: string): PresentationRef {
  return { id, name, content: '1', unitId: uuid('b') };
}

function montar(options?: {
  readonly status?: OrderStatus | null;
  readonly conditionedBy?: string | null;
  readonly outcome?: FinishedBatchLabelsOutcome;
  readonly append?: (entry: NewExecutionEntry) => Promise<void>;
  readonly ofOrder?: readonly FinishedBatchOfOrderLine[];
}) {
  const status = options?.status === undefined ? 'EN_ACONDICIONAMIENTO' : options.status;
  const conditionedBy = options?.conditionedBy === undefined ? ANA : options.conditionedBy;
  const orden: string[] = [];
  const findAliveById = vi.fn(async () => {
    orden.push('pedido');
    return status === null ? null : { id: PEDIDO_1, status };
  });
  const listAliveSummariesByIds = vi.fn(async () => {
    orden.push('resumen');
    return {
      items: status === null ? [] : [{ id: PEDIDO_1, status, conditionedBy, presentationLines: [] }],
      total: 1,
      page: 1,
      pageSize: 1,
      totalPages: 1,
    };
  });
  const listOfOrder = vi.fn<FinishedBatchLabels['listOfOrder']>(async () => {
    orden.push('lotes');
    return (
      options?.ofOrder ?? [loteDeLinea(SIN_NOMBRE, LOTE_C), loteDeLinea(FRASCO, LOTE_A), loteDeLinea(GARRAFA, LOTE_B)]
    );
  });
  const findRefs = vi.fn<PresentationCatalog['findRefs']>(async () => {
    orden.push('presentaciones');
    return [presentacion(FRASCO, 'Frasco 1 L'), presentacion(GARRAFA, 'Garrafa 5 L')];
  });
  const { transaction, run, writeForOrder, append } = transaccionDeAcondicionamiento({
    outcome: options?.outcome,
    append: options?.append,
    pasos: orden,
  });
  const deps = {
    orders: { findAliveById, listAliveSummariesByIds } as unknown as OrderCatalog,
    batches: { listOfOrder },
    presentations: { findRefs },
    transaction,
    now: () => AHORA,
  } satisfies SaveConditioningBatchDataDeps;
  return {
    deps,
    orden,
    findAliveById,
    listAliveSummariesByIds,
    listOfOrder,
    findRefs,
    run,
    writeForOrder,
    append,
    todos: [findAliveById, listAliveSummariesByIds, listOfOrder, findRefs, run, writeForOrder, append],
  };
}

// Sin valor por defecto en `actor`: un `undefined` explicito tiene que llegar tal cual.
async function fallo(
  deps: SaveConditioningBatchDataDeps,
  input: unknown,
  ...actor: [] | [Actor | null | undefined]
): Promise<unknown> {
  return createSaveConditioningBatchData(deps)(actor.length === 0 ? ACONDICIONADOR : actor[0], input).then(
    () => undefined,
    (error: unknown) => error,
  );
}

describe('R24 — el permiso antes de todo', () => {
  it.each(actoresSinElPermiso(SEED_ROLE_PERMISSIONS, [ROLE_ADMINISTRADOR, ROLE_OPERADOR, ROLE_EMPACADOR]))(
    'R24: %s recibe `unauthorized` aun con una entrada invalida, sin tocar ningun puerto',
    async (_nombre, actor) => {
      const { deps, todos } = montar();

      const error = await fallo(deps, { orderId: 'no-uuid' }, actor);

      expect(error).toBeInstanceOf(UnauthorizedError);
      for (const doble of todos) expect(doble).not.toHaveBeenCalled();
    },
  );
});

describe('R19 — la entrada es exactamente `{ orderId, lot, expiryDate, productionDate }`', () => {
  it.each([
    ['no es un objeto', 7],
    ['sin lote', { orderId: PEDIDO_1, expiryDate: '2027-04-30', productionDate: HOY }],
    ['sin vencimiento', { orderId: PEDIDO_1, lot: 'L', productionDate: HOY }],
    ['sin dia de produccion', { orderId: PEDIDO_1, lot: 'L', expiryDate: '2027-04-30' }],
    ['orderId no uuid', { ...entrada(), orderId: 'pedido' }],
    ['clave de mas', { ...entrada(), companyId: EMPRESA }],
    ['con `lines` (datos por linea)', { ...entrada(), lines: [{ batchId: LOTE_A, lot: 'L' }] }],
    ['con `batchId`', { ...entrada(), batchId: LOTE_A }],
    [
      'la forma por linea de QC-219',
      { orderId: PEDIDO_1, lines: [{ batchId: LOTE_A, lot: 'L', expiryDate: '2027-04-30', productionDate: HOY }] },
    ],
    ['lote vacio', entrada({ lot: '' })],
    ['lote de solo espacios', entrada({ lot: '   ' })],
    ['lote de 61 caracteres', entrada({ lot: 'A'.repeat(61) })],
    ['lote de 60 digitos', entrada({ lot: '9'.repeat(60) })],
    ['vencimiento vacio', entrada({ expiryDate: '' })],
    ['vencimiento sin forma', entrada({ expiryDate: '30/04/2027' })],
    ['vencimiento que no existe', entrada({ expiryDate: '2027-02-30' })],
    ['produccion vacia', entrada({ productionDate: '' })],
    ['produccion que no existe', entrada({ productionDate: '2026-13-01' })],
  ])('R19: %s se rechaza con `invalid_input` sin tocar ningun puerto', async (_nombre, input) => {
    const { deps, todos } = montar();

    const error = await fallo(deps, input);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).code).toBe('invalid_input');
    for (const doble of todos) expect(doble).not.toHaveBeenCalled();
  });

  it.each([
    ['se recorta', '  CR-1  ', 'CR-1'],
    ['de 59 digitos', '9'.repeat(59), '9'.repeat(59)],
    ['de 60 caracteres', 'A'.repeat(60), 'A'.repeat(60)],
  ])('R19: el lote %s y es valido', async (_n, lot, esperado) => {
    const { deps, writeForOrder } = montar();

    await createSaveConditioningBatchData(deps)(ACONDICIONADOR, entrada({ lot }));

    expect(writeForOrder.mock.calls[0]?.[0].label.lot).toBe(esperado);
  });
});

describe('R24 — los errores del pedido, antes de las fechas y de la escritura', () => {
  it('R24: inexistente, de baja o de otra empresa -> `order_not_found`, aunque las fechas fallen', async () => {
    const { deps, writeForOrder } = montar({ status: null });

    expect(await fallo(deps, entrada({ expiryDate: HOY }))).toBeInstanceOf(OrderNotFoundError);
    expect(writeForOrder).not.toHaveBeenCalled();
  });

  it.each([
    ['TERMINADO de otra persona', 'TERMINADO', BETO],
    ['TERMINADO sin quien acondiciona', 'TERMINADO', null],
    ['ENTREGADO de otra persona', 'ENTREGADO', BETO],
    ['ENTREGADO sin quien acondiciona', 'ENTREGADO', null],
  ] as const)('R24: %s -> `order_not_found`', async (_n, status, conditionedBy) => {
    const { deps, writeForOrder } = montar({ status, conditionedBy });

    expect(await fallo(deps, entrada({ expiryDate: HOY }))).toBeInstanceOf(OrderNotFoundError);
    expect(writeForOrder).not.toHaveBeenCalled();
  });

  it('R24: EN_ACONDICIONAMIENTO de otra persona -> `order_conditioning_taken`, aunque las fechas fallen', async () => {
    const { deps, writeForOrder } = montar({ conditionedBy: BETO });

    expect(await fallo(deps, entrada({ expiryDate: HOY }))).toBeInstanceOf(OrderConditioningTakenError);
    expect(writeForOrder).not.toHaveBeenCalled();
  });

  it.each(['POR_ACONDICIONAR', 'PENDIENTE', 'EN_CURSO', 'POR_EMPACAR', 'EN_EMPAQUE', 'CANCELADO', 'BLOQUEADO'] as const)(
    'R24: %s -> `order_not_conditionable`, sin leer el resumen ni escribir',
    async (status) => {
      const { deps, listAliveSummariesByIds, writeForOrder } = montar({ status, conditionedBy: null });

      expect(await fallo(deps, entrada())).toBeInstanceOf(OrderNotConditionableError);
      expect(listAliveSummariesByIds).not.toHaveBeenCalled();
      expect(writeForOrder).not.toHaveBeenCalled();
    },
  );

  it('R24: la empresa sale del actor, nunca de la entrada', async () => {
    const { deps, findAliveById, listAliveSummariesByIds, writeForOrder } = montar();

    await createSaveConditioningBatchData(deps)(ACONDICIONADOR, entrada());

    expect(findAliveById).toHaveBeenCalledWith(PEDIDO_1, EMPRESA);
    expect(listAliveSummariesByIds).toHaveBeenCalledWith(EMPRESA, [PEDIDO_1], ['EN_ACONDICIONAMIENTO'], 1, 1);
    expect(writeForOrder.mock.calls[0]?.[0]).toMatchObject({ companyId: EMPRESA, orderId: PEDIDO_1, actorId: ANA });
  });

  it('R24: el orden de los puertos es pedido -> resumen -> lotes y presentaciones -> escritura -> anotacion', async () => {
    const { deps, orden } = montar();

    await createSaveConditioningBatchData(deps)(ACONDICIONADOR, entrada());

    expect(orden).toEqual(['pedido', 'resumen', 'lotes', 'presentaciones', 'transaccion', 'escribe-lotes', 'anota']);
  });
});

describe('R20 — fechas contra hoy en UTC, antes de escribir', () => {
  it('R20: un vencimiento de hoy -> `batch_expiry_not_future`, sin escribir', async () => {
    const { deps, writeForOrder } = montar();

    const error = await fallo(deps, entrada({ expiryDate: HOY }));

    expect(error).toBeInstanceOf(BatchExpiryNotFutureError);
    expect((error as BatchExpiryNotFutureError).code).toBe('batch_expiry_not_future');
    expect((error as BatchExpiryNotFutureError).batchId).toBeUndefined();
    expect(writeForOrder).not.toHaveBeenCalled();
  });

  it('R20: un vencimiento pasado tambien se rechaza; uno de manana es valido', async () => {
    expect(await fallo(montar().deps, entrada({ expiryDate: '2026-10-07' }))).toBeInstanceOf(BatchExpiryNotFutureError);
    const { deps, writeForOrder } = montar();
    await createSaveConditioningBatchData(deps)(ACONDICIONADOR, entrada({ expiryDate: MANANA }));
    expect(writeForOrder).toHaveBeenCalledTimes(1);
  });

  it('R20: un dia de produccion de manana -> `batch_production_date_future`, sin escribir', async () => {
    const { deps, writeForOrder } = montar();

    const error = await fallo(deps, entrada({ productionDate: MANANA }));

    expect(error).toBeInstanceOf(BatchProductionDateFutureError);
    expect((error as BatchProductionDateFutureError).code).toBe('batch_production_date_future');
    expect((error as BatchProductionDateFutureError).batchId).toBeUndefined();
    expect(writeForOrder).not.toHaveBeenCalled();
  });

  it.each([HOY, '2026-01-15'])('R20: un dia de produccion %s (hoy o anterior) es valido', async (productionDate) => {
    const { deps, writeForOrder } = montar();
    await createSaveConditioningBatchData(deps)(ACONDICIONADOR, entrada({ productionDate }));
    expect(writeForOrder).toHaveBeenCalledTimes(1);
  });

  it('R20: con las dos fechas mal, decide el vencimiento', async () => {
    expect(await fallo(montar().deps, entrada({ expiryDate: HOY, productionDate: MANANA }))).toBeInstanceOf(
      BatchExpiryNotFutureError,
    );
  });

  it('R20: «hoy» es el dia civil UTC aunque en otra zona ya sea manana', async () => {
    const { deps, writeForOrder } = montar();
    const casiMedianoche: SaveConditioningBatchDataDeps = { ...deps, now: () => new Date('2026-10-08T23:30:00.000Z') };

    expect(await fallo(casiMedianoche, entrada({ productionDate: MANANA }))).toBeInstanceOf(
      BatchProductionDateFutureError,
    );
    expect(writeForOrder).not.toHaveBeenCalled();
  });
});

describe('R23 — pedido sin ninguna linea con lote', () => {
  it('R23: sin lotes en `listOfOrder` -> `batch_not_found`, sin abrir la transaccion ni anotar', async () => {
    const { deps, findRefs, run, append } = montar({ ofOrder: [] });

    const error = await fallo(deps, entrada());

    expect(error).toBeInstanceOf(ConditioningBatchNotFoundError);
    expect((error as ConditioningBatchNotFoundError).code).toBe('batch_not_found');
    expect(findRefs).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it('R23: `no_batches` del puerto en carrera -> `batch_not_found`, sin anotar', async () => {
    const { deps, append } = montar({ outcome: { kind: 'no_batches' } });

    const error = await fallo(deps, entrada());

    expect(error).toBeInstanceOf(ConditioningBatchNotFoundError);
    expect((error as ConditioningBatchNotFoundError).code).toBe('batch_not_found');
    expect(append).not.toHaveBeenCalled();
  });

  it('R24: con un pedido sin lotes y un vencimiento de hoy deciden las fechas, sin escribir', async () => {
    const { deps, listOfOrder, writeForOrder } = montar({ ofOrder: [] });

    expect(await fallo(deps, entrada({ expiryDate: HOY }))).toBeInstanceOf(BatchExpiryNotFutureError);
    expect(listOfOrder).not.toHaveBeenCalled();
    expect(writeForOrder).not.toHaveBeenCalled();
  });
});

describe('R21, R22 — choque por la clave del lote', () => {
  it('R21: `duplicate_lot` del puerto se traduce a `batch_duplicate_lot`, con el lote como diagnostico', async () => {
    const { deps } = montar({ outcome: { kind: 'duplicate_lot', batchId: LOTE_A } });

    const error = await fallo(deps, entrada());

    expect(error).toBeInstanceOf(ConditioningBatchDuplicateLotError);
    expect((error as ConditioningBatchDuplicateLotError).code).toBe('batch_duplicate_lot');
    expect((error as ConditioningBatchDuplicateLotError).batchId).toBe(LOTE_A);
  });

  it('R22: `duplicate_lot` en carrera, sin lote, se traduce sin `batchId`', async () => {
    const { deps } = montar({ outcome: { kind: 'duplicate_lot', batchId: null } });

    const error = await fallo(deps, entrada());

    expect(error).toBeInstanceOf(ConditioningBatchDuplicateLotError);
    expect((error as ConditioningBatchDuplicateLotError).batchId).toBeUndefined();
  });
});

describe('R18, R27 — guarda en los estados corregibles', () => {
  it.each(['EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO'] as const)(
    'R18, R27: en %s propio escribe una sola terna para el pedido, con el reloj del caso de uso',
    async (status) => {
      const { deps, writeForOrder, listAliveSummariesByIds } = montar({ status });

      await expect(createSaveConditioningBatchData(deps)(ACONDICIONADOR, entrada())).resolves.toBeUndefined();

      expect(listAliveSummariesByIds).toHaveBeenCalledWith(EMPRESA, [PEDIDO_1], [status], 1, 1);
      expect(writeForOrder).toHaveBeenCalledTimes(1);
      expect(writeForOrder).toHaveBeenCalledWith({
        companyId: EMPRESA,
        orderId: PEDIDO_1,
        label: { lot: 'CR-2610', expiryDate: '2027-04-30', productionDate: HOY },
        actorId: ANA,
        now: AHORA,
      });
    },
  );
});

describe('QC-283 — cada guardado anota una foto en el registro de ejecucion', () => {
  it('R3: la foto lleva una linea por cada lote del pedido, en el orden de `listOfOrder`, con nombre o null', async () => {
    const { deps, orden, listOfOrder, findRefs, append } = montar();

    await createSaveConditioningBatchData(deps)(ACONDICIONADOR, entrada({ lot: '  CR-C  ', productionDate: '2026-09-01' }));

    expect(listOfOrder).toHaveBeenCalledWith(EMPRESA, PEDIDO_1);
    expect(findRefs).toHaveBeenCalledWith([SIN_NOMBRE, FRASCO, GARRAFA], EMPRESA);
    expect(orden.slice(-3)).toEqual(['transaccion', 'escribe-lotes', 'anota']);
    expect(append).toHaveBeenCalledTimes(1);
    const datos = { lot: 'CR-C', expiryDate: '2027-04-30', productionDate: '2026-09-01' };
    expect(append).toHaveBeenCalledWith({
      action: 'conditioning_batch_save',
      companyId: EMPRESA,
      orderId: PEDIDO_1,
      userId: ANA,
      stepPosition: null,
      occurredAt: AHORA,
      batchLines: [
        { batchId: LOTE_C, presentationId: SIN_NOMBRE, presentationName: null, ...datos },
        { batchId: LOTE_A, presentationId: FRASCO, presentationName: 'Frasco 1 L', ...datos },
        { batchId: LOTE_B, presentationId: GARRAFA, presentationName: 'Garrafa 5 L', ...datos },
      ],
    });
  });

  it('R3: una presentacion compartida por dos lotes se pide una sola vez', async () => {
    const { deps, findRefs, append } = montar({ ofOrder: [loteDeLinea(FRASCO, LOTE_A), loteDeLinea(FRASCO, LOTE_B)] });

    await createSaveConditioningBatchData(deps)(ACONDICIONADOR, entrada());

    expect(findRefs).toHaveBeenCalledWith([FRASCO], EMPRESA);
    expect((append.mock.calls[0]?.[0] as { batchLines: readonly unknown[] }).batchLines).toHaveLength(2);
  });

  it.each([
    ['duplicate_lot con lote', { kind: 'duplicate_lot', batchId: LOTE_A }, ConditioningBatchDuplicateLotError, LOTE_A],
    ['duplicate_lot en carrera', { kind: 'duplicate_lot', batchId: null }, ConditioningBatchDuplicateLotError, undefined],
    ['no_batches en carrera', { kind: 'no_batches' }, ConditioningBatchNotFoundError, undefined],
  ] as const)('R4: un rechazo del guardado (%s) no anota y mantiene el error', async (_n, outcome, clase, batchId) => {
    const { deps, append, run } = montar({ outcome });

    const error = await fallo(deps, entrada());

    expect(error).toBeInstanceOf(clase);
    expect((error as { batchId?: string }).batchId).toBe(batchId);
    expect(run).toHaveBeenCalledTimes(1);
    expect(append).not.toHaveBeenCalled();
  });

  it('R4: un rechazo de las reglas (fechas) no lee los lotes, no abre la transaccion ni anota', async () => {
    const { deps, run, append, listOfOrder } = montar();

    expect(await fallo(deps, entrada({ expiryDate: HOY }))).toBeInstanceOf(BatchExpiryNotFutureError);
    expect(listOfOrder).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it('R4: si anotar falla, el error sale de la transaccion para que deshaga el guardado', async () => {
    const roto = new Error('fallo al anotar');
    const { deps, writeForOrder } = montar({
      append: async () => {
        throw roto;
      },
    });

    expect(await fallo(deps, entrada())).toBe(roto);
    expect(writeForOrder).toHaveBeenCalledTimes(1);
  });
});
