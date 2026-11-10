// tests/unit/asignaciones/cancel-assigned-order.test.ts
import { describe, expect, it, vi } from 'vitest';

import {
  createCancelAssignedOrder,
  type CancelAssignedOrderDeps,
} from '@/lib/modules/asignaciones/domain/cancel-assigned-order';
import {
  NotCancellableError,
  OrderNotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/modules/asignaciones/domain/errors';
import { cancelOrderSchema } from '@/lib/modules/pedidos';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';
import type { NewExecutionEntry } from '@/lib/modules/asignaciones/domain/execution-entry';
import type { ExecutionLogRepository } from '@/lib/modules/asignaciones/ports/execution-log-repository';
import type {
  ExecutionTransaction,
  ExecutionWriters,
} from '@/lib/modules/asignaciones/ports/execution-transaction';
import type { OrderAssignmentRepository } from '@/lib/modules/asignaciones/ports/order-assignment-repository';
import type { PermissionCode } from '@/lib/modules/identity';
import type { OrderCatalog, OrderStatus } from '@/lib/modules/pedidos';

function uuid(seed: string): string {
  return `${seed.repeat(8)}-${seed.repeat(4)}-4${seed.repeat(3)}-8${seed.repeat(3)}-${seed.repeat(12)}`;
}

const EMPRESA = uuid('3');
const OTRA_EMPRESA = uuid('9');
const ANA = uuid('1');
const BETO = uuid('2');
const PEDIDO = uuid('7');
const LINEA = uuid('e');
const OTRA_LINEA = uuid('f');
const OTRO_PEDIDO = uuid('8');
const AHORA = new Date('2026-10-06T12:00:00.000Z');
const NUMERO_PEDIDO = { year: 2026, sequence: 7 };

const ACTOR: Actor = {
  id: ANA,
  companyId: EMPRESA,
  permissions: ['asignaciones.consultar', 'asignaciones.ejecutar'],
};

const PERMISOS_EMPACADOR: readonly PermissionCode[] = [
  'asignaciones.consultar',
  'terminados.consultar',
  'empaque.modificar',
];

type CancelOutcome = 'ok' | 'not_found' | 'not_cancellable';

function montar(options?: {
  readonly status?: OrderStatus | null;
  readonly ids?: readonly string[];
  readonly outcome?: CancelOutcome;
  readonly appendFalla?: Error;
}) {
  const eventos: string[] = [];
  const listOrderIdsByUserInCompany = vi.fn(async () => options?.ids ?? [PEDIDO]);
  const status = options?.status === undefined ? 'EN_CURSO' : options.status;
  // El pedido esta PARCIAL a proposito: la cancelacion es de la linea y no mira el pedido.
  const findAliveById = vi.fn(async () => ({ id: PEDIDO, status: 'PARCIAL' as const, activeLineStatuses: [] }));
  // Dos recetas del pedido en el mismo estado; `status: null` = ninguna existe para el actor.
  const findAliveLineSummary = vi.fn(async (_companyId: string, _orderId: string, lineId: string) => {
    eventos.push('findAliveLineSummary');
    if (status === null || (lineId !== LINEA && lineId !== OTRA_LINEA)) return null;
    return { id: PEDIDO, lineId, number: NUMERO_PEDIDO, recipeId: 'receta-1', quantity: '10.0000', priority: 'MEDIA', status };
  });
  const cancelAliveById = vi.fn();
  const cancelLineAliveById = vi.fn<ExecutionWriters['orders']['cancelLineAliveById']>(async () => {
    eventos.push('cancelLineAliveById');
    return options?.outcome ?? 'ok';
  });
  const append = vi.fn<ExecutionLogRepository['append']>(async () => {
    eventos.push('append');
    if (options?.appendFalla) throw options.appendFalla;
    return 'ok';
  });
  const transitionAliveById = vi.fn();
  const runRejections: unknown[] = [];
  const writers = {
    orders: { cancelAliveById, cancelLineAliveById, transitionAliveById },
    packing: { startPackingAliveById: vi.fn(), finishPackingAliveById: vi.fn() },
    log: { append, findLastStepPosition: vi.fn() },
  } as unknown as ExecutionWriters;
  const run = vi.fn(async <T,>(work: (w: ExecutionWriters) => Promise<T>): Promise<T> => {
    eventos.push('run:open');
    try {
      const value = await work(writers);
      eventos.push('run:commit');
      return value;
    } catch (error) {
      eventos.push('run:rollback');
      runRejections.push(error);
      throw error;
    }
  });

  const deps: CancelAssignedOrderDeps = {
    assignments: { listOrderIdsByUserInCompany } as unknown as OrderAssignmentRepository,
    orders: { findAliveById, findAliveLineSummary } as unknown as OrderCatalog,
    transaction: { run } as ExecutionTransaction,
    now: () => AHORA,
  };
  return {
    deps,
    eventos,
    runRejections,
    listOrderIdsByUserInCompany,
    findAliveById,
    findAliveLineSummary,
    cancelAliveById,
    cancelLineAliveById,
    append,
    run,
  };
}

function ningunDobleLlamado(d: ReturnType<typeof montar>): void {
  expect(d.listOrderIdsByUserInCompany).not.toHaveBeenCalled();
  expect(d.findAliveLineSummary).not.toHaveBeenCalled();
  expect(d.run).not.toHaveBeenCalled();
  expect(d.cancelLineAliveById).not.toHaveBeenCalled();
  expect(d.append).not.toHaveBeenCalled();
}

const ENTRADA = { orderId: PEDIDO, lineId: LINEA, stepPosition: 2, reason: 'Se derramo el lote' } as const;

describe('cancelAssignedOrder — prologo (R26, R27, R28)', () => {
  it('R26: sin actor o sin permisos rechaza sin llamar a ningun doble', async () => {
    for (const actor of [null, undefined, { id: ANA, companyId: EMPRESA, permissions: [] }]) {
      const d = montar();
      await expect(createCancelAssignedOrder(d.deps)(actor, ENTRADA)).rejects.toThrow(UnauthorizedError);
      ningunDobleLlamado(d);
    }
  });

  it('R26: `asignaciones.consultar` solo NO basta', async () => {
    const d = montar();
    await expect(
      createCancelAssignedOrder(d.deps)(
        { id: ANA, companyId: EMPRESA, permissions: ['asignaciones.consultar'] },
        ENTRADA,
      ),
    ).rejects.toThrow(UnauthorizedError);
    ningunDobleLlamado(d);
  });

  // Nota del 2026-10-06: el caso del 2026-09-26 «tambien con los permisos del Empacador» se
  // invierte. QC-201 dejo al Empacador sin `asignaciones.ejecutar`, que es lo que exige cancelar.
  it('R26, R27: un actor con exactamente los permisos del Empacador es rechazado sin llamar a ningun doble', async () => {
    const d = montar();
    await expect(
      createCancelAssignedOrder(d.deps)({ id: ANA, companyId: EMPRESA, permissions: PERMISOS_EMPACADOR }, ENTRADA),
    ).rejects.toThrow(UnauthorizedError);
    ningunDobleLlamado(d);
  });

  it('R27: no asignado, otra empresa e inexistente dan la misma respuesta, sin abrir la transaccion', async () => {
    for (const [d, actor] of [
      [montar({ ids: [OTRO_PEDIDO] }), ACTOR],
      [montar({ status: null }), ACTOR],
      [montar({ ids: [] }), { ...ACTOR, companyId: OTRA_EMPRESA }],
    ] as const) {
      const error = await createCancelAssignedOrder(d.deps)(actor, ENTRADA).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(OrderNotFoundError);
      expect((error as OrderNotFoundError).code).toBe('order_not_found');
      expect(d.run).not.toHaveBeenCalled();
      expect(d.cancelLineAliveById).not.toHaveBeenCalled();
      expect(d.append).not.toHaveBeenCalled();
    }
  });

  it('R27: lo cancela un responsable asignado que no lo arranco', async () => {
    const d = montar();
    const beto: Actor = { id: BETO, companyId: EMPRESA, permissions: ['asignaciones.ejecutar'] };
    await createCancelAssignedOrder(d.deps)(beto, ENTRADA);
    expect(d.listOrderIdsByUserInCompany).toHaveBeenCalledWith(EMPRESA, BETO);
    expect(d.cancelLineAliveById).toHaveBeenCalledWith(PEDIDO, LINEA, EMPRESA, ENTRADA.reason, BETO, AHORA);
    expect(d.append.mock.calls[0]?.[0]).toMatchObject({ userId: BETO });
  });

  it('R28: la empresa sale del actor, nunca de la entrada', async () => {
    const d = montar();
    await createCancelAssignedOrder(d.deps)(ACTOR, ENTRADA);
    expect(d.listOrderIdsByUserInCompany).toHaveBeenCalledWith(EMPRESA, ANA);
    expect(d.findAliveLineSummary).toHaveBeenCalledWith(EMPRESA, PEDIDO, LINEA);
    expect(d.cancelLineAliveById.mock.calls[0]?.[2]).toBe(EMPRESA);
    expect(d.append.mock.calls[0]?.[0]).toMatchObject({ companyId: EMPRESA });
  });

  it('R28: el esquema estricto rechaza un `companyId` en la entrada, sin tocar ningun puerto', async () => {
    const d = montar();
    await expect(
      createCancelAssignedOrder(d.deps)(ACTOR, { ...ENTRADA, companyId: OTRA_EMPRESA }),
    ).rejects.toThrow(ValidationError);
    ningunDobleLlamado(d);
  });

  it('R30: no necesita `pedidos.modificar` ni `asignaciones.modificar`', async () => {
    const d = montar();
    const actor: Actor = { id: ANA, companyId: EMPRESA, permissions: ['asignaciones.ejecutar'] };
    await expect(createCancelAssignedOrder(d.deps)(actor, ENTRADA)).resolves.toEqual({
      numberText: expect.any(String),
    });
    expect(d.cancelLineAliveById).toHaveBeenCalledTimes(1);
  });
});

describe('cancelAssignedOrder — el motivo (R9, R10)', () => {
  it.each([
    ['ausente', { orderId: PEDIDO, lineId: LINEA, stepPosition: 2 }],
    ['vacio', { ...ENTRADA, reason: '' }],
    ['solo espacios', { ...ENTRADA, reason: '   \t  ' }],
    ['no texto', { ...ENTRADA, reason: 42 }],
  ])('R9: motivo %s es invalid_input sin abrir la transaccion', async (_caso, entrada) => {
    const d = montar();
    const error = await createCancelAssignedOrder(d.deps)(ACTOR, entrada).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).code).toBe('invalid_input');
    ningunDobleLlamado(d);
  });

  it('R10: el tope es el mismo que `cancelOrderSchema`: 500 entra, 501 no', async () => {
    const quinientos = 'a'.repeat(500);
    const quinientosUno = 'a'.repeat(501);
    expect(cancelOrderSchema.safeParse({ reason: quinientos }).success).toBe(true);
    expect(cancelOrderSchema.safeParse({ reason: quinientosUno }).success).toBe(false);

    const ok = montar();
    await createCancelAssignedOrder(ok.deps)(ACTOR, { ...ENTRADA, reason: quinientos });
    expect(ok.cancelLineAliveById).toHaveBeenCalledTimes(1);

    const largo = montar();
    await expect(
      createCancelAssignedOrder(largo.deps)(ACTOR, { ...ENTRADA, reason: quinientosUno }),
    ).rejects.toThrow(ValidationError);
    ningunDobleLlamado(largo);
  });

  it('R9, R22: el motivo se normaliza igual que `cancelOrderSchema` y ese mismo llega a los dos', async () => {
    const d = montar();
    await createCancelAssignedOrder(d.deps)(ACTOR, { ...ENTRADA, reason: '  Se derramo  ' });
    expect(d.cancelLineAliveById.mock.calls[0]?.[3]).toBe('Se derramo');
    expect(d.append.mock.calls[0]?.[0]).toMatchObject({ reason: 'Se derramo' });
  });

  it('stepPosition invalida es invalid_input sin tocar ningun puerto', async () => {
    for (const stepPosition of [0, 1.5, '2', undefined]) {
      const d = montar();
      await expect(
        createCancelAssignedOrder(d.deps)(ACTOR, { ...ENTRADA, stepPosition }),
      ).rejects.toThrow(ValidationError);
      ningunDobleLlamado(d);
    }
  });
});

describe('cancelAssignedOrder — la escritura (R22, R23, R24, R29)', () => {
  it("R22, R23: 'ok' anota una vez `cancel` con el MISMO motivo y el MISMO instante que la cancelacion", async () => {
    const d = montar();
    const result = await createCancelAssignedOrder(d.deps)(ACTOR, ENTRADA);

    expect(result).toEqual({ numberText: expect.stringContaining('7') });
    expect(d.cancelLineAliveById).toHaveBeenCalledTimes(1);
    expect(d.cancelLineAliveById).toHaveBeenCalledWith(PEDIDO, LINEA, EMPRESA, ENTRADA.reason, ANA, AHORA);
    expect(d.append).toHaveBeenCalledTimes(1);
    expect(d.append).toHaveBeenCalledWith({
      action: 'cancel',
      companyId: EMPRESA,
      orderId: PEDIDO,
      orderLineId: LINEA,
      userId: ANA,
      stepPosition: 2,
      reason: ENTRADA.reason,
      occurredAt: AHORA,
    });
    const [, , , motivoCancelado, , instanteCancelado] = d.cancelLineAliveById.mock.calls[0] as unknown as [
      string,
      string,
      string,
      string,
      string,
      Date,
    ];
    const anotacion = d.append.mock.calls[0]?.[0] as Extract<NewExecutionEntry, { action: 'cancel' }>;
    expect(anotacion.reason).toBe(motivoCancelado);
    expect(anotacion.occurredAt).toBe(instanteCancelado);
  });

  it('R22, R24: la cancelacion y la anotacion van dentro de la MISMA transaccion, con el numero leido antes', async () => {
    const d = montar();
    await createCancelAssignedOrder(d.deps)(ACTOR, ENTRADA);
    expect(d.run).toHaveBeenCalledTimes(1);
    expect(d.eventos).toEqual([
      'findAliveLineSummary',
      'run:open',
      'cancelLineAliveById',
      'append',
      'run:commit',
    ]);
  });

  it('R25: devuelve el numero visible del pedido, leido de la receta en el estado que tenia', async () => {
    const d = montar({ status: 'BLOQUEADO' });
    const result = await createCancelAssignedOrder(d.deps)(ACTOR, ENTRADA);
    expect(d.findAliveLineSummary).toHaveBeenCalledWith(EMPRESA, PEDIDO, LINEA);
    expect(result.numberText).toMatch(/7/);
  });

  it("R29: 'not_cancellable' es NotCancellableError, sin anotar, y sale desde DENTRO de run", async () => {
    const d = montar({ status: 'POR_EMPACAR', outcome: 'not_cancellable' });
    const error = await createCancelAssignedOrder(d.deps)(ACTOR, ENTRADA).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotCancellableError);
    expect((error as NotCancellableError).code).toBe('not_cancellable');
    expect(d.append).not.toHaveBeenCalled();
    expect(d.eventos).toContain('run:rollback');
    expect(d.eventos).not.toContain('run:commit');
    expect(d.runRejections).toHaveLength(1);
  });

  it.each(['POR_EMPACAR', 'EN_EMPAQUE', 'ENTREGADO', 'CANCELADO'] as const)(
    'R29: %s lo decide `pedidos` bajo el candado: se pide la cancelacion y su not_cancellable se traduce',
    async (status) => {
      const d = montar({ status, outcome: 'not_cancellable' });
      await expect(createCancelAssignedOrder(d.deps)(ACTOR, ENTRADA)).rejects.toThrow(NotCancellableError);
      expect(d.cancelLineAliveById).toHaveBeenCalledTimes(1);
      expect(d.append).not.toHaveBeenCalled();
    },
  );

  it("R29: 'not_found' es OrderNotFoundError, sin anotar, y sale desde dentro de run", async () => {
    const d = montar({ outcome: 'not_found' });
    await expect(createCancelAssignedOrder(d.deps)(ACTOR, ENTRADA)).rejects.toThrow(OrderNotFoundError);
    expect(d.append).not.toHaveBeenCalled();
    expect(d.eventos).toContain('run:rollback');
    expect(d.runRejections).toHaveLength(1);
  });

  it('R24: si `append` lanza, el error se propaga tal cual desde dentro de run y no se confirma nada', async () => {
    const fallo = new Error('registro caido');
    const d = montar({ appendFalla: fallo });
    await expect(createCancelAssignedOrder(d.deps)(ACTOR, ENTRADA)).rejects.toBe(fallo);
    expect(d.cancelLineAliveById).toHaveBeenCalledTimes(1);
    expect(d.runRejections).toEqual([fallo]);
    expect(d.eventos).not.toContain('run:commit');
  });

  it("R29: un BLOQUEADO cancela por 'ok' y se anota", async () => {
    const d = montar({ status: 'BLOQUEADO', outcome: 'ok' });
    await createCancelAssignedOrder(d.deps)(ACTOR, ENTRADA);
    expect(d.cancelLineAliveById).toHaveBeenCalledTimes(1);
    expect(d.append).toHaveBeenCalledTimes(1);
    expect(d.append.mock.calls[0]?.[0]).toMatchObject({ action: 'cancel', reason: ENTRADA.reason });
  });

  it('R5: con una receta sin pasos la posicion `null` se anota tal cual', async () => {
    const d = montar();
    await createCancelAssignedOrder(d.deps)(ACTOR, { ...ENTRADA, stepPosition: null });
    expect(d.append.mock.calls[0]?.[0]).toMatchObject({ stepPosition: null });
  });
});

describe('cancelAssignedOrder — la receta nombrada (R14, R15, R16, R17)', () => {
  it('R16: cancela solo la receta nombrada por `cancelLineAliveById` y anota en su registro', async () => {
    const d = montar();
    await createCancelAssignedOrder(d.deps)(ACTOR, { ...ENTRADA, lineId: OTRA_LINEA });
    expect(d.cancelLineAliveById).toHaveBeenCalledTimes(1);
    expect(d.cancelLineAliveById).toHaveBeenCalledWith(PEDIDO, OTRA_LINEA, EMPRESA, ENTRADA.reason, ANA, AHORA);
    expect(d.cancelAliveById).not.toHaveBeenCalled();
    expect(d.append.mock.calls[0]?.[0]).toMatchObject({ action: 'cancel', orderLineId: OTRA_LINEA });
  });

  it('R16: con el pedido PARCIAL decide `pedidos` por la linea; el estado del pedido no se lee', async () => {
    const d = montar({ status: 'EN_CURSO' });
    await createCancelAssignedOrder(d.deps)(ACTOR, ENTRADA);
    expect(d.findAliveById).not.toHaveBeenCalled();
    expect(d.cancelLineAliveById).toHaveBeenCalledTimes(1);
  });

  it('R17: una receta en un estado no cancelable da not_cancellable sin anotar', async () => {
    const d = montar({ status: 'POR_EMPACAR', outcome: 'not_cancellable' });
    await expect(createCancelAssignedOrder(d.deps)(ACTOR, ENTRADA)).rejects.toThrow(NotCancellableError);
    expect(d.append).not.toHaveBeenCalled();
    expect(d.eventos).not.toContain('run:commit');
  });

  it('R17: el motivo sigue siendo obligatorio y de 1 a 500 caracteres con la receta en la entrada', async () => {
    for (const reason of [undefined, '', '   ', 'a'.repeat(501)]) {
      const d = montar();
      await expect(createCancelAssignedOrder(d.deps)(ACTOR, { ...ENTRADA, reason })).rejects.toThrow(ValidationError);
      ningunDobleLlamado(d);
    }
  });

  it('R14: sin lineId, o con uno que no es uuid, da invalid_input sin tocar ningun puerto', async () => {
    const sinLinea = Object.fromEntries(Object.entries(ENTRADA).filter(([clave]) => clave !== 'lineId'));
    for (const entrada of [sinLinea, { ...ENTRADA, lineId: 'linea-unica' }]) {
      const d = montar();
      await expect(createCancelAssignedOrder(d.deps)(ACTOR, entrada)).rejects.toThrow(ValidationError);
      ningunDobleLlamado(d);
    }
  });

  it('R14: una receta de otro pedido, quitada o inexistente da order_not_found sin abrir la transaccion', async () => {
    const d = montar();
    await expect(createCancelAssignedOrder(d.deps)(ACTOR, { ...ENTRADA, lineId: uuid('6') })).rejects.toThrow(
      OrderNotFoundError,
    );
    expect(d.run).not.toHaveBeenCalled();
  });

  it('R15: quien es responsable del pedido puede cancelar cualquiera de sus recetas', async () => {
    for (const lineId of [LINEA, OTRA_LINEA]) {
      const d = montar();
      await createCancelAssignedOrder(d.deps)(ACTOR, { ...ENTRADA, lineId });
      expect(d.cancelLineAliveById).toHaveBeenCalledWith(PEDIDO, lineId, EMPRESA, ENTRADA.reason, ANA, AHORA);
    }
  });
});
