// Abrir la pantalla de ejecucion: un PENDIENTE se lee sin comenzarlo; un EN_CURSO se retoma por
// `startAssignedOrder`, que es quien anota el retomar.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrderBlockedError, UnauthorizedError } from '@/lib/modules/asignaciones/domain/errors';
import { createOpenAssignedOrder } from '@/lib/modules/asignaciones/domain/open-assigned-order';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';
import type {
  AssignedOrderExecutionView,
  StartedOrderExecution,
} from '@/lib/modules/asignaciones/domain/assigned-order-execution-view';
import type { StartAssignedOrderDeps } from '@/lib/modules/asignaciones/domain/start-assigned-order';

const { getMock, startMock } = vi.hoisted(() => ({
  getMock: vi.fn<(actor: unknown, input: unknown) => Promise<AssignedOrderExecutionView>>(),
  startMock: vi.fn<(actor: unknown, input: unknown) => Promise<StartedOrderExecution>>(),
}));

vi.mock('@/lib/modules/asignaciones/domain/get-assigned-order-execution', () => ({
  createGetAssignedOrderExecution: () => getMock,
}));

vi.mock('@/lib/modules/asignaciones/domain/start-assigned-order', () => ({
  createStartAssignedOrder: () => startMock,
}));

const ACTOR: Actor = {
  id: '11111111-1111-4111-8111-111111111111',
  companyId: '33333333-3333-4333-8333-333333333333',
  permissions: ['asignaciones.ejecutar'],
};
const INPUT = { orderId: '77777777-7777-4777-8777-777777777777' };

const VISTA: AssignedOrderExecutionView = {
  orderId: INPUT.orderId,
  numberText: '2026-0000007',
  status: 'PENDIENTE',
  recipeName: 'Barniz acrílico',
  orderQuantity: '250',
  steps: [{ blocks: [{ kind: 'paragraph', spans: [{ text: 'Paso uno' }] }] }],
  lines: [],
  tools: [],
  presentationLines: [],
  unitId: null,
  unitLabel: null,
  evidence: [],
};

const deps = {} as StartAssignedOrderDeps;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('openAssignedOrder', () => {
  it('PENDIENTE: devuelve la vista sin comenzar y sin paso de entrada; no llama a comenzar', async () => {
    getMock.mockResolvedValue(VISTA);

    const abierto = await createOpenAssignedOrder(deps)(ACTOR, INPUT);

    expect(abierto).toEqual({ ...VISTA, resumeStepPosition: null });
    expect(getMock).toHaveBeenCalledWith(ACTOR, INPUT);
    expect(startMock).not.toHaveBeenCalled();
  });

  it('EN_CURSO: retoma por `startAssignedOrder`, que anota el retomar', async () => {
    getMock.mockResolvedValue({ ...VISTA, status: 'EN_CURSO' });
    const retomado: StartedOrderExecution = { ...VISTA, status: 'EN_CURSO', resumeStepPosition: 1 };
    startMock.mockResolvedValue(retomado);

    const abierto = await createOpenAssignedOrder(deps)(ACTOR, INPUT);

    expect(abierto).toBe(retomado);
    expect(startMock).toHaveBeenCalledWith(ACTOR, INPUT);
  });

  it.each([
    ['BLOQUEADO', new OrderBlockedError()],
    ['sin permiso', new UnauthorizedError()],
  ])('%s: el rechazo de la lectura sube tal cual, sin comenzar', async (_caso, error) => {
    getMock.mockRejectedValue(error);

    await expect(createOpenAssignedOrder(deps)(ACTOR, INPUT)).rejects.toBe(error);
    expect(startMock).not.toHaveBeenCalled();
  });
});
