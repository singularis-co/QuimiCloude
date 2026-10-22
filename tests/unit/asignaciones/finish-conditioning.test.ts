// tests/unit/asignaciones/finish-conditioning.test.ts
import { describe, expect, it, vi } from 'vitest';

import {
  ROLE_ACONDICIONAMIENTO,
  ROLE_ADMINISTRADOR,
  ROLE_EMPACADOR,
  SEED_ROLE_PERMISSIONS,
} from '@/lib/modules/identity';

import {
  createFinishConditioning,
  type FinishConditioningDeps,
} from '@/lib/modules/asignaciones/domain/finish-conditioning';
import {
  ConditioningBatchDataMissingError,
  ConditioningStepsPendingError,
  OrderConditioningTakenError,
  OrderNotConditionableError,
  OrderNotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/modules/asignaciones/domain/errors';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';
import type { ExecutionEntryRecord, NewExecutionEntry } from '@/lib/modules/asignaciones/domain/execution-entry';
import type { ExecutionTransaction } from '@/lib/modules/asignaciones/ports/execution-transaction';
import type { FinishedBatchLabels, FinishedBatchOfOrderLine } from '@/lib/modules/inventario';
import type { OrderCatalog } from '@/lib/modules/pedidos';
import type { ConditioningStepView } from '@/lib/modules/recetas';

import { anotacionDePaso, transaccionDeAcondicionamiento } from './conditioning-doubles';

function uuid(seed: string): string {
  return `${seed.repeat(8)}-${seed.repeat(4)}-4${seed.repeat(3)}-8${seed.repeat(3)}-${seed.repeat(12)}`;
}

const EMPRESA = uuid('3');
const ANA = uuid('1');
const BETO = uuid('2');
const LOTE = uuid('8');
const PEDIDO = uuid('7');
const RECETA = uuid('9');
const AHORA = new Date('2026-10-08T12:00:00.000Z');

const ACTOR: Actor = { id: ANA, companyId: EMPRESA, permissions: ['acondicionamiento.modificar'] };

type Resultado = 'ok' | 'not_conditioner' | 'not_conditionable' | 'not_found';

function montar(
  resultado: Resultado,
  options?: {
    readonly target?: { readonly id: string; readonly status: string } | null;
    readonly summaryItems?: readonly unknown[];
    readonly batches?: readonly FinishedBatchOfOrderLine[];
    readonly append?: (entry: NewExecutionEntry) => Promise<void>;
    readonly pasos?: readonly ConditioningStepView[] | null;
    readonly anotaciones?: readonly ExecutionEntryRecord[];
  },
): {
  readonly deps: FinishConditioningDeps;
  readonly findAliveById: ReturnType<typeof vi.fn>;
  readonly listAliveSummariesByIds: ReturnType<typeof vi.fn>;
  readonly finishConditioningAliveById: ReturnType<typeof vi.fn>;
  readonly listOfOrder: ReturnType<typeof vi.fn>;
  readonly run: ReturnType<typeof vi.fn>;
  readonly append: ReturnType<typeof vi.fn>;
  readonly pasos: readonly string[];
  readonly findConditioningStepsById: ReturnType<typeof vi.fn>;
  readonly listEntriesForOrders: ReturnType<typeof vi.fn>;
} {
  const findAliveById = vi.fn(async () =>
    options?.target === undefined ? { id: PEDIDO, status: 'EN_ACONDICIONAMIENTO' } : options.target,
  );
  const listAliveSummariesByIds = vi.fn(async () => ({
    items: options?.summaryItems ?? [
      { id: PEDIDO, number: { year: 2026, sequence: 7 }, recipeId: RECETA, conditionedBy: ANA, presentationLines: [] },
    ],
    total: 1,
    page: 1,
    pageSize: 1,
  }));
  const { transaction, run, finishConditioningAliveById, append, pasos } = transaccionDeAcondicionamiento({
    finish: resultado,
    append: options?.append,
  });
  const listOfOrder = vi.fn<FinishedBatchLabels['listOfOrder']>(async () => options?.batches ?? []);
  const findConditioningStepsById = vi.fn(async () => (options?.pasos === undefined ? [] : options.pasos));
  const listEntriesForOrders = vi.fn(async () => options?.anotaciones ?? []);
  const deps = {
    orders: { findAliveById, listAliveSummariesByIds } as unknown as OrderCatalog,
    batches: { listOfOrder },
    transaction,
    conditioningSteps: { findConditioningStepsById },
    log: { listEntriesForOrders },
    now: () => AHORA,
  } satisfies FinishConditioningDeps;
  return {
    deps,
    findAliveById,
    listAliveSummariesByIds,
    finishConditioningAliveById,
    listOfOrder,
    run,
    append,
    pasos,
    findConditioningStepsById,
    listEntriesForOrders,
  };
}

/** Un catalogo que falla en cuanto se lee cualquiera de sus miembros. */
function catalogoIntocable(): OrderCatalog {
  return new Proxy({} as OrderCatalog, {
    get(_target, prop) {
      throw new Error(`se toco el puerto: ${String(prop)}`);
    },
  });
}

function depsIntocables(): FinishConditioningDeps {
  return {
    orders: catalogoIntocable(),
    batches: {
      listOfOrder: () => {
        throw new Error('se toco el puerto: listOfOrder');
      },
    },
    transaction: new Proxy({} as ExecutionTransaction, {
      get(_target, prop) {
        throw new Error(`se toco la transaccion: ${String(prop)}`);
      },
    }),
    conditioningSteps: {
      findConditioningStepsById: () => {
        throw new Error('se toco el puerto: findConditioningStepsById');
      },
    },
    log: {
      listEntriesForOrders: () => {
        throw new Error('se toco el puerto: listEntriesForOrders');
      },
    },
    now: () => {
      throw new Error('se pidio la hora');
    },
  };
}

describe('finishConditioning — autorizacion', () => {
  const actoresSinPermiso: ReadonlyArray<readonly [string, Actor | null | undefined]> = [
    ['nulo', null],
    ['ausente', undefined],
    [
      'con los permisos de semilla del Administrador',
      { id: ANA, companyId: EMPRESA, permissions: SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]! },
    ],
    [
      'con los permisos de semilla del Empacador',
      { id: ANA, companyId: EMPRESA, permissions: SEED_ROLE_PERMISSIONS[ROLE_EMPACADOR]! },
    ],
    ['con el conjunto vacio', { id: ANA, companyId: EMPRESA, permissions: [] }],
  ];

  it.each(actoresSinPermiso)(
    'R15: actor %s rechaza con unauthorized sin tocar ningun puerto',
    async (_nombre, actor) => {
      const finishConditioning = createFinishConditioning(depsIntocables());
      await expect(finishConditioning(actor, { orderId: PEDIDO })).rejects.toBeInstanceOf(UnauthorizedError);
    },
  );

  it.each(actoresSinPermiso)(
    'R15: actor %s con entrada invalida sigue dando unauthorized: autorizar va antes de validar',
    async (_nombre, actor) => {
      const finishConditioning = createFinishConditioning(depsIntocables());
      await expect(finishConditioning(actor, { orderId: 'no-es-uuid', extra: 1 })).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
    },
  );

  it('R15: un actor con los permisos de semilla del Administrador de acondicionamiento termina', async () => {
    const { deps, finishConditioningAliveById } = montar('ok');
    const actor: Actor = { id: ANA, companyId: EMPRESA, permissions: SEED_ROLE_PERMISSIONS[ROLE_ACONDICIONAMIENTO]! };

    await expect(createFinishConditioning(deps)(actor, { orderId: PEDIDO })).resolves.toEqual({
      numberText: '2026-0000007',
    });
    expect(finishConditioningAliveById).toHaveBeenCalledTimes(1);
  });
});

describe('finishConditioning — validacion de la entrada', () => {
  const entradasInvalidas: ReadonlyArray<readonly [string, unknown]> = [
    ['nula', null],
    ['no objeto', 'texto'],
    ['vacia', {}],
    ['orderId no uuid', { orderId: 'no-es-uuid' }],
    ['orderId numerico', { orderId: 7 }],
    ['con una clave de mas', { orderId: PEDIDO, companyId: EMPRESA }],
  ];

  it.each(entradasInvalidas)('R16: entrada %s rechaza con invalid_input sin tocar ningun puerto', async (_n, entrada) => {
    const finishConditioning = createFinishConditioning({ ...depsIntocables(), now: () => AHORA });
    const error = await finishConditioning(ACTOR, entrada).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).code).toBe('invalid_input');
  });
});

describe('finishConditioning — lectura del numero y traduccion del resultado', () => {
  it('R12: devuelve el numero visible leido ANTES de transicionar, con el estado actual del pedido', async () => {
    const { deps, findAliveById, listAliveSummariesByIds, finishConditioningAliveById } = montar('ok');

    const result = await createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO });

    expect(result).toEqual({ numberText: '2026-0000007' });
    expect(findAliveById).toHaveBeenCalledWith(PEDIDO, EMPRESA);
    expect(listAliveSummariesByIds).toHaveBeenCalledWith(EMPRESA, [PEDIDO], ['EN_ACONDICIONAMIENTO'], 1, 1);
    expect(finishConditioningAliveById).toHaveBeenCalledWith(PEDIDO, EMPRESA, ANA, AHORA);
    expect(listAliveSummariesByIds.mock.invocationCallOrder[0]!).toBeLessThan(
      finishConditioningAliveById.mock.invocationCallOrder[0]!,
    );
  });

  it('R13: not_conditioner rechaza con order_conditioning_taken', async () => {
    const { deps } = montar('not_conditioner');
    const error = await createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OrderConditioningTakenError);
    expect((error as OrderConditioningTakenError).code).toBe('order_conditioning_taken');
  });

  it('R14: not_conditionable rechaza con order_not_conditionable', async () => {
    const { deps } = montar('not_conditionable', { target: { id: PEDIDO, status: 'POR_ACONDICIONAR' } });
    const error = await createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OrderNotConditionableError);
    expect((error as OrderNotConditionableError).code).toBe('order_not_conditionable');
  });

  it('R14: not_found del catalogo rechaza con order_not_found', async () => {
    const { deps } = montar('not_found');
    const error = await createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OrderNotFoundError);
    expect((error as OrderNotFoundError).code).toBe('order_not_found');
  });

  it('R14: pedido inexistente, de baja o de otra empresa rechaza con order_not_found sin transicionar', async () => {
    const { deps, listAliveSummariesByIds, finishConditioningAliveById } = montar('ok', { target: null });
    await expect(createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO })).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
    expect(listAliveSummariesByIds).not.toHaveBeenCalled();
    expect(finishConditioningAliveById).not.toHaveBeenCalled();
  });

  it('R14: si el resumen no aparece rechaza con order_not_found sin transicionar', async () => {
    const { deps, finishConditioningAliveById } = montar('ok', { summaryItems: [] });
    await expect(createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO })).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
    expect(finishConditioningAliveById).not.toHaveBeenCalled();
  });

  it('R14: la empresa sale del actor, nunca de la entrada', async () => {
    const { deps, findAliveById, finishConditioningAliveById } = montar('ok');
    const otro: Actor = { ...ACTOR, companyId: uuid('9') };

    await createFinishConditioning(deps)(otro, { orderId: PEDIDO });
    expect(findAliveById).toHaveBeenCalledWith(PEDIDO, uuid('9'));
    expect(finishConditioningAliveById).toHaveBeenCalledWith(PEDIDO, uuid('9'), ANA, AHORA);
  });
});

describe('QC-219 — Terminar exige los datos de lote', () => {
  const LINEA = { presentationId: 'pres-1', packages: 2, packagingName: 'Botella 1 L' };
  const CON_DATOS: FinishedBatchOfOrderLine = {
    batchId: LOTE,
    orderPresentationLineId: 'linea-1',
    presentationId: 'pres-1',
    lot: 'CR-2610-A',
    expiryDate: '2027-04-30',
    productionDate: '2026-10-01',
  };

  function resumenCon(conditionedBy: string, lineas: readonly unknown[]) {
    return [{ id: PEDIDO, number: { year: 2026, sequence: 7 }, conditionedBy, presentationLines: lineas }];
  }

  it('R15: si alguna linea no tiene datos rechaza con conditioning_batch_data_missing sin llamar a la transicion', async () => {
    const { deps, listOfOrder, finishConditioningAliveById } = montar('ok', {
      summaryItems: resumenCon(ANA, [LINEA]),
      batches: [{ ...CON_DATOS, lot: 'AUTO-1', expiryDate: null, productionDate: null }],
    });

    const error = await createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConditioningBatchDataMissingError);
    expect((error as ConditioningBatchDataMissingError).code).toBe('conditioning_batch_data_missing');
    expect(listOfOrder).toHaveBeenCalledWith(EMPRESA, PEDIDO);
    expect(finishConditioningAliveById).not.toHaveBeenCalled();
  });

  it('R17: una linea sin lote de produccion cuenta como sin datos', async () => {
    const { deps, finishConditioningAliveById } = montar('ok', { summaryItems: resumenCon(ANA, [LINEA]), batches: [] });

    await expect(createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO })).rejects.toBeInstanceOf(
      ConditioningBatchDataMissingError,
    );
    expect(finishConditioningAliveById).not.toHaveBeenCalled();
  });

  it('R17: un pedido sin lineas termina sin pedir datos', async () => {
    const { deps, finishConditioningAliveById } = montar('ok', { summaryItems: resumenCon(ANA, []), batches: [] });

    await expect(createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO })).resolves.toEqual({
      numberText: '2026-0000007',
    });
    expect(finishConditioningAliveById).toHaveBeenCalledTimes(1);
  });

  it('R15: con todas las lineas con datos termina', async () => {
    const { deps, finishConditioningAliveById } = montar('ok', {
      summaryItems: resumenCon(ANA, [LINEA]),
      batches: [CON_DATOS],
    });

    await expect(createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO })).resolves.toEqual({
      numberText: '2026-0000007',
    });
    expect(finishConditioningAliveById).toHaveBeenCalledWith(PEDIDO, EMPRESA, ANA, AHORA);
  });

  it('R16: un acondicionador que no es quien acondiciona recibe order_conditioning_taken aunque falten datos, sin leer los lotes', async () => {
    const { deps, listOfOrder, finishConditioningAliveById } = montar('ok', {
      summaryItems: resumenCon(BETO, [LINEA]),
      batches: [],
    });

    await expect(createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO })).rejects.toBeInstanceOf(
      OrderConditioningTakenError,
    );
    expect(listOfOrder).not.toHaveBeenCalled();
    expect(finishConditioningAliveById).not.toHaveBeenCalled();
  });

  it('R16: un pedido que no esta EN_ACONDICIONAMIENTO da order_not_conditionable antes de mirar los datos', async () => {
    const { deps, listOfOrder } = montar('ok', {
      target: { id: PEDIDO, status: 'TERMINADO' },
      summaryItems: resumenCon(ANA, [LINEA]),
      batches: [],
    });

    await expect(createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO })).rejects.toBeInstanceOf(
      OrderNotConditionableError,
    );
    expect(listOfOrder).not.toHaveBeenCalled();
  });

  it('R16: un pedido inexistente da order_not_found antes de mirar los datos', async () => {
    const { deps, listOfOrder } = montar('ok', { target: null, batches: [] });

    await expect(createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO })).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(listOfOrder).not.toHaveBeenCalled();
  });

  it('R16: sin permiso da unauthorized y una entrada invalida da invalid_input, sin leer los lotes', async () => {
    const finishConditioning = createFinishConditioning(depsIntocables());
    await expect(finishConditioning(null, { orderId: PEDIDO })).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(finishConditioning(ACTOR, { orderId: 'x' })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('QC-283 — Terminar anota en el registro de ejecucion', () => {
  it('R6: anota conditioning_finish en la transaccion, despues de la transicion', async () => {
    const { deps, pasos, append, finishConditioningAliveById } = montar('ok');

    await expect(createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO })).resolves.toEqual({
      numberText: '2026-0000007',
    });

    expect(pasos).toEqual(['transaccion', 'escribe-pedido', 'anota']);
    expect(finishConditioningAliveById).toHaveBeenCalledWith(PEDIDO, EMPRESA, ANA, AHORA);
    expect(append).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledWith({
      action: 'conditioning_finish',
      companyId: EMPRESA,
      orderId: PEDIDO,
      userId: ANA,
      stepPosition: null,
      occurredAt: AHORA,
    });
  });

  it.each([
    ['not_conditioner', OrderConditioningTakenError],
    ['not_conditionable', OrderNotConditionableError],
    ['not_found', OrderNotFoundError],
  ] as const)('R6: un rechazo de la transicion (%s) no anota y mantiene el error', async (resultado, clase) => {
    const { deps, append, run } = montar(resultado);

    await expect(createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO })).rejects.toBeInstanceOf(clase);
    expect(run).toHaveBeenCalledTimes(1);
    expect(append).not.toHaveBeenCalled();
  });

  it('R6: los rechazos previos (datos de lote, otro acondicionador) no abren la transaccion', async () => {
    const linea = { presentationId: 'pres-1', packages: 2, packagingName: 'Botella 1 L' };
    const sinDatos = montar('ok', {
      summaryItems: [{ id: PEDIDO, number: { year: 2026, sequence: 7 }, conditionedBy: ANA, presentationLines: [linea] }],
      batches: [],
    });
    const ajeno = montar('ok', {
      summaryItems: [{ id: PEDIDO, number: { year: 2026, sequence: 7 }, conditionedBy: BETO, presentationLines: [] }],
    });

    await expect(createFinishConditioning(sinDatos.deps)(ACTOR, { orderId: PEDIDO })).rejects.toBeInstanceOf(
      ConditioningBatchDataMissingError,
    );
    await expect(createFinishConditioning(ajeno.deps)(ACTOR, { orderId: PEDIDO })).rejects.toBeInstanceOf(
      OrderConditioningTakenError,
    );
    expect(sinDatos.run).not.toHaveBeenCalled();
    expect(ajeno.run).not.toHaveBeenCalled();
  });

  it('R6: si anotar falla, el error sale de la transaccion para que deshaga la transicion', async () => {
    const roto = new Error('fallo al anotar');
    const { deps, finishConditioningAliveById } = montar('ok', {
      append: async () => {
        throw roto;
      },
    });

    await expect(createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO })).rejects.toBe(roto);
    expect(finishConditioningAliveById).toHaveBeenCalledTimes(1);
  });
});

describe('QC-281 — Terminar el acondicionamiento con envases reales', () => {
  const CON_DATOS: FinishedBatchOfOrderLine = {
    batchId: LOTE,
    orderPresentationLineId: 'linea-1',
    presentationId: 'pres-1',
    lot: 'CR-2610-A',
    expiryDate: '2027-04-30',
    productionDate: '2026-10-01',
  };

  function resumenCon(lineas: readonly unknown[]) {
    return [{ id: PEDIDO, number: { year: 2026, sequence: 7 }, conditionedBy: ANA, presentationLines: lineas }];
  }

  it('R23: una linea empacada con 0 envases no tiene lote y no bloquea Terminar', async () => {
    const { deps, finishConditioningAliveById } = montar('ok', {
      summaryItems: resumenCon([
        { id: 'linea-1', presentationId: 'pres-1', packages: 2, packedPackages: 2, packagingName: null },
        { id: 'linea-2', presentationId: 'pres-2', packages: 3, packedPackages: 0, packagingName: null },
      ]),
      batches: [CON_DATOS],
    });

    await expect(createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO })).resolves.toEqual({
      numberText: '2026-0000007',
    });
    expect(finishConditioningAliveById).toHaveBeenCalledTimes(1);
  });

  it('R23: un pedido con todas sus lineas en 0 termina sin pedir datos de lote', async () => {
    const { deps, finishConditioningAliveById } = montar('ok', {
      summaryItems: resumenCon([{ id: 'linea-1', presentationId: 'pres-1', packages: 2, packedPackages: 0, packagingName: null }]),
      batches: [],
    });

    await expect(createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO })).resolves.toEqual({
      numberText: '2026-0000007',
    });
    expect(finishConditioningAliveById).toHaveBeenCalledTimes(1);
  });

  it('R25: una linea sin conteo guardado se lee con su plan y sin lote sigue bloqueando como hoy', async () => {
    const { deps, finishConditioningAliveById } = montar('ok', {
      summaryItems: resumenCon([{ id: 'linea-1', presentationId: 'pres-1', packages: 2, packedPackages: null, packagingName: null }]),
      batches: [],
    });

    await expect(createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO })).rejects.toBeInstanceOf(
      ConditioningBatchDataMissingError,
    );
    expect(finishConditioningAliveById).not.toHaveBeenCalled();
  });
});

describe('QC-299 — Terminar exige los pasos de acondicionamiento completos', () => {
  const PASOS: readonly ConditioningStepView[] = [{ blocks: [] }, { blocks: [] }];

  it('R25: con un paso sin completar rechaza con conditioning_steps_pending sin leer lotes ni abrir la transaccion', async () => {
    const { deps, listOfOrder, run, findConditioningStepsById, listEntriesForOrders } = montar('ok', {
      pasos: PASOS,
      anotaciones: [anotacionDePaso('conditioning_step_advance', 1, null)],
    });

    const error = await createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConditioningStepsPendingError);
    expect((error as ConditioningStepsPendingError).code).toBe('conditioning_steps_pending');
    expect(findConditioningStepsById).toHaveBeenCalledWith(RECETA, EMPRESA);
    expect(listEntriesForOrders).toHaveBeenCalledWith(EMPRESA, [PEDIDO]);
    expect(listOfOrder).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('R25: sin ningun paso completado tambien rechaza sin cambiar el pedido', async () => {
    const { deps, finishConditioningAliveById, append } = montar('ok', { pasos: PASOS, anotaciones: [] });

    await expect(createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO })).rejects.toBeInstanceOf(
      ConditioningStepsPendingError,
    );
    expect(finishConditioningAliveById).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it('R25: con todos los pasos completados termina como hoy', async () => {
    const { deps, finishConditioningAliveById } = montar('ok', {
      pasos: PASOS,
      anotaciones: [
        anotacionDePaso('conditioning_step_advance', 1, null),
        anotacionDePaso('conditioning_steps_complete', 2, null),
      ],
    });

    await expect(createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO })).resolves.toEqual({
      numberText: '2026-0000007',
    });
    expect(finishConditioningAliveById).toHaveBeenCalledWith(PEDIDO, EMPRESA, ANA, AHORA);
  });

  it.each([
    ['sin pasos', []],
    ['que ya no se encuentra', null],
  ] as const)('R19, R25: una receta %s termina como hoy sin leer el registro', async (_n, pasos) => {
    const { deps, listEntriesForOrders, finishConditioningAliveById } = montar('ok', { pasos });

    await expect(createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO })).resolves.toEqual({
      numberText: '2026-0000007',
    });
    expect(listEntriesForOrders).not.toHaveBeenCalled();
    expect(finishConditioningAliveById).toHaveBeenCalledTimes(1);
  });

  it('R25: quien no acondiciona el pedido recibe su error sin que se lean los pasos', async () => {
    const { deps, findConditioningStepsById } = montar('ok', {
      pasos: PASOS,
      summaryItems: [
        { id: PEDIDO, number: { year: 2026, sequence: 7 }, recipeId: RECETA, conditionedBy: BETO, presentationLines: [] },
      ],
    });

    await expect(createFinishConditioning(deps)(ACTOR, { orderId: PEDIDO })).rejects.toBeInstanceOf(
      OrderConditioningTakenError,
    );
    expect(findConditioningStepsById).not.toHaveBeenCalled();
  });

  it('R31: sin acondicionamiento.modificar rechaza antes de validar y sin leer pasos ni registro', async () => {
    const finishConditioning = createFinishConditioning(depsIntocables());
    await expect(
      finishConditioning({ id: ANA, companyId: EMPRESA, permissions: [] }, { orderId: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('R32: pasos y registro se leen con la empresa del actor', async () => {
    const otra = uuid('4');
    const { deps, findConditioningStepsById, listEntriesForOrders } = montar('ok', {
      pasos: PASOS,
      anotaciones: [anotacionDePaso('conditioning_step_advance', 1, null)],
    });

    await expect(
      createFinishConditioning(deps)({ ...ACTOR, companyId: otra }, { orderId: PEDIDO }),
    ).rejects.toBeInstanceOf(ConditioningStepsPendingError);
    expect(findConditioningStepsById).toHaveBeenCalledWith(RECETA, otra);
    expect(listEntriesForOrders).toHaveBeenCalledWith(otra, [PEDIDO]);
  });
});
