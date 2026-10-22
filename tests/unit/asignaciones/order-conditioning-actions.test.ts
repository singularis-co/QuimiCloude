// tests/unit/asignaciones/order-conditioning-actions.test.ts
//
// Las dos Server Actions del detalle del acondicionador. Esta capa no decide nada: se prueba la
// accion real con la composicion, `redirect` y `revalidatePath` doblados.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  finishConditioningAction,
  recordConditioningStepAction,
  saveConditioningBatchDataAction,
  startConditioningAction,
} from '@/lib/modules/asignaciones/adapters/driving/order-conditioning-actions';
import {
  BatchExpiryNotFutureError,
  BatchProductionDateFutureError,
  ConditioningBatchDataMissingError,
  ConditioningBatchDuplicateLotError,
  ConditioningBatchNotFoundError,
  ConditioningResponsibleNotAllowedError,
  ConditioningResponsiblesRequiredError,
  ConditioningStepOutOfOrderError,
  ConditioningTeamEmptyError,
  EvidenceRequiredError,
  OrderNotFoundError,
  ConditioningTeamMemberNotAllowedError,
  OrderConditioningTakenError,
  OrderNotConditionableError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/modules/asignaciones';
import { errorMessage } from '@/lib/modules/errores';

const {
  getSessionUserMock,
  getSessionContextMock,
  startConditioningMock,
  finishConditioningMock,
  saveConditioningBatchDataMock,
  recordConditioningStepMock,
  redirectMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  recordConditioningStepMock: vi.fn(),
  saveConditioningBatchDataMock: vi.fn(),
  getSessionUserMock: vi.fn(),
  getSessionContextMock: vi.fn(),
  startConditioningMock: vi.fn(),
  finishConditioningMock: vi.fn(),
  redirectMock: vi.fn<(ruta: string) => never>(),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/composition', () => ({
  observabilidad: { readRequestIdHeader: vi.fn(async () => 'req-1') },
  identity: {
    getSessionUser: getSessionUserMock,
    getSessionContext: getSessionContextMock,
  },
  asignaciones: {
    startConditioning: startConditioningMock,
    finishConditioning: finishConditioningMock,
    saveConditioningBatchData: saveConditioningBatchDataMock,
    recordConditioningStep: recordConditioningStepMock,
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

// El `redirect` real de Next lanza para senalizar la navegacion; el doble lo reproduce.
vi.mock('next/navigation', () => ({
  redirect: (ruta: string): never => {
    redirectMock(ruta);
    throw new Error('NEXT_REDIRECT');
  },
}));

const SESSION_USER = {
  id: 'user-1',
  username: 'ana.perez',
  displayName: 'Ana Perez',
  roleName: 'Administrador de acondicionamiento',
  permissions: ['asignaciones.consultar', 'acondicionamiento.modificar'],
};

const SESSION_CONTEXT = { userId: 'user-1', companyId: 'company-1', roleName: 'Administrador de acondicionamiento' };

const ORDER_ID = '3f1c9b2e-8d47-4a10-9c65-2b7e4f0a1d38';
const BETO = '22222222-2222-4222-8222-222222222222';
const CARLA = '44444444-4444-4444-8444-444444444444';
const GRUPO = '88888888-8888-4888-8888-888888888888';

function formData(entradas: ReadonlyArray<readonly [string, string]>): FormData {
  const datos = new FormData();
  for (const [clave, valor] of entradas) datos.append(clave, valor);
  return datos;
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUserMock.mockResolvedValue(SESSION_USER);
  getSessionContextMock.mockResolvedValue(SESSION_CONTEXT);
});

describe('startConditioningAction — Comenzar con equipo se queda en el detalle', () => {
  it('R27, R28: lee userIds y workGroupIds con getAll y pasa el actor de la sesion al caso de uso', async () => {
    startConditioningMock.mockResolvedValue(undefined);

    await startConditioningAction(
      { status: 'success' },
      formData([
        ['orderId', ORDER_ID],
        ['userIds', BETO],
        ['userIds', CARLA],
        ['workGroupIds', GRUPO],
      ]),
    );

    expect(startConditioningMock).toHaveBeenCalledWith(
      { id: 'user-1', companyId: 'company-1', permissions: SESSION_USER.permissions },
      { orderId: ORDER_ID, userIds: [BETO, CARLA], workGroupIds: [GRUPO] },
    );
  });

  it('R18: sin ninguna casilla marcada llegan dos listas vacias, y el caso de uso decide', async () => {
    startConditioningMock.mockRejectedValue(new ValidationError());

    const resultado = await startConditioningAction({ status: 'success' }, formData([['orderId', ORDER_ID]]));

    expect(startConditioningMock).toHaveBeenCalledWith(expect.anything(), {
      orderId: ORDER_ID,
      userIds: [],
      workGroupIds: [],
    });
    expect(resultado).toMatchObject({ status: 'error', code: 'invalid_input' });
  });

  it('R27: exito -> revalida el detalle del pedido y no redirige', async () => {
    startConditioningMock.mockResolvedValue(undefined);

    const resultado = await startConditioningAction(
      { status: 'success' },
      formData([
        ['orderId', ORDER_ID],
        ['userIds', BETO],
      ]),
    );

    expect(resultado).toEqual({ status: 'success' });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/asignacion/acondicionamiento/${ORDER_ID}`);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it.each([
    ['unauthorized', new UnauthorizedError()],
    ['order_conditioning_taken', new OrderConditioningTakenError()],
    ['order_not_conditionable', new OrderNotConditionableError()],
    ['conditioning_team_member_not_allowed', new ConditioningTeamMemberNotAllowedError()],
    ['conditioning_team_empty', new ConditioningTeamEmptyError()],
  ] as const)('R28: %s se traduce a ErrorState con el texto del catalogo y no revalida', async (code, error) => {
    startConditioningMock.mockRejectedValue(error);

    const resultado = await startConditioningAction(
      { status: 'success' },
      formData([
        ['orderId', ORDER_ID],
        ['userIds', BETO],
      ]),
    );

    expect(resultado).toMatchObject({ status: 'error', code, message: errorMessage(code) });
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe('finishConditioningAction — Terminar vuelve a «Por acondicionar» con el aviso', () => {
  it('R27, D11: con el pedido ya TERMINADO, redirige a /asignacion?vista=por_acondicionar&acondicionado=<numero>', async () => {
    finishConditioningMock.mockResolvedValue({ numberText: '2026-0000007' });

    await expect(finishConditioningAction({ status: 'success' }, formData([['orderId', ORDER_ID]]))).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(finishConditioningMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }), {
      orderId: ORDER_ID,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/asignacion');
    expect(redirectMock).toHaveBeenCalledWith('/asignacion?vista=por_acondicionar&acondicionado=2026-0000007');
  });

  it('R27: un numero con caracteres especiales viaja escapado en la cadena de consulta', async () => {
    finishConditioningMock.mockResolvedValue({ numberText: '2026/0000007' });

    await expect(finishConditioningAction({ status: 'success' }, formData([['orderId', ORDER_ID]]))).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    const [ruta] = redirectMock.mock.calls[0] as [string];
    const params = new URL(ruta, 'http://localhost').searchParams;
    expect(params.get('vista')).toBe('por_acondicionar');
    expect(params.get('acondicionado')).toBe('2026/0000007');
  });

  it.each([
    ['order_conditioning_taken', new OrderConditioningTakenError()],
    ['unauthorized', new UnauthorizedError()],
  ] as const)('R28, R29: %s se traduce a ErrorState y NO redirige', async (code, error) => {
    finishConditioningMock.mockRejectedValue(error);

    const resultado = await finishConditioningAction({ status: 'success' }, formData([['orderId', ORDER_ID]]));

    expect(resultado).toMatchObject({ status: 'error', code, message: errorMessage(code) });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe('QC-219 — finishConditioningAction traduce la falta de datos de lote', () => {
  it('R15: `conditioning_batch_data_missing` llega como ErrorState con su texto, sin redirigir', async () => {
    finishConditioningMock.mockRejectedValue(new ConditioningBatchDataMissingError());

    const resultado = await finishConditioningAction({ status: 'success' }, formData([['orderId', ORDER_ID]]));

    expect(resultado).toEqual({
      status: 'error',
      code: 'conditioning_batch_data_missing',
      message: errorMessage('conditioning_batch_data_missing'),
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe('QC-284 T10 — saveConditioningBatchDataAction: un solo juego de datos por pedido', () => {
  const LOTE_A = '7a7a7a7a-7a7a-4a7a-8a7a-7a7a7a7a7a7a';
  const VACIO = '';

  function datosFd(lot: string, expiryDate: string, productionDate: string) {
    return [
      ['lot', lot],
      ['expiryDate', expiryDate],
      ['productionDate', productionDate],
    ] as const;
  }

  it('R19: lee un valor por campo y pasa el actor de la sesion, sin lineas ni batchId', async () => {
    saveConditioningBatchDataMock.mockResolvedValue(undefined);

    await saveConditioningBatchDataAction(
      { status: 'idle' },
      formData([['orderId', ORDER_ID], ...datosFd('CR-2610', '2027-04-30', '2026-10-01')]),
    );

    expect(saveConditioningBatchDataMock).toHaveBeenCalledWith(
      { id: 'user-1', companyId: 'company-1', permissions: SESSION_USER.permissions },
      { orderId: ORDER_ID, lot: 'CR-2610', expiryDate: '2027-04-30', productionDate: '2026-10-01' },
    );
  });

  it('R19: un `batchId` o datos repetidos del formulario no viajan: solo el primer valor de cada campo', async () => {
    saveConditioningBatchDataMock.mockResolvedValue(undefined);

    await saveConditioningBatchDataAction(
      { status: 'idle' },
      formData([
        ['orderId', ORDER_ID],
        ['batchId', LOTE_A],
        ...datosFd('CR-A', '2027-04-30', '2026-10-01'),
        ...datosFd('CR-B', '2027-05-31', '2026-10-02'),
      ]),
    );

    expect(saveConditioningBatchDataMock.mock.calls[0]?.[1]).toEqual({
      orderId: ORDER_ID,
      lot: 'CR-A',
      expiryDate: '2027-04-30',
      productionDate: '2026-10-01',
    });
  });

  it('R19: un campo ausente llega como `null` y el caso de uso decide', async () => {
    saveConditioningBatchDataMock.mockRejectedValue(new ValidationError());

    const resultado = await saveConditioningBatchDataAction({ status: 'idle' }, formData([['orderId', ORDER_ID]]));

    expect(saveConditioningBatchDataMock.mock.calls[0]?.[1]).toEqual({
      orderId: ORDER_ID,
      lot: null,
      expiryDate: null,
      productionDate: null,
    });
    expect(resultado).toEqual({ status: 'error', code: 'invalid_input', message: errorMessage('invalid_input') });
  });

  it('R19: campos vacios viajan tal cual, sin filtrar', async () => {
    saveConditioningBatchDataMock.mockRejectedValue(new ValidationError());

    await saveConditioningBatchDataAction(
      { status: 'idle' },
      formData([['orderId', ORDER_ID], ...datosFd(VACIO, VACIO, VACIO)]),
    );

    expect(saveConditioningBatchDataMock.mock.calls[0]?.[1]).toEqual({
      orderId: ORDER_ID,
      lot: VACIO,
      expiryDate: VACIO,
      productionDate: VACIO,
    });
  });

  it('R18: exito -> revalida el detalle y no redirige', async () => {
    saveConditioningBatchDataMock.mockResolvedValue(undefined);

    const resultado = await saveConditioningBatchDataAction(
      { status: 'idle' },
      formData([['orderId', ORDER_ID], ...datosFd('CR-A', '2027-04-30', '2026-10-01')]),
    );

    expect(resultado).toEqual({ status: 'success' });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/asignacion/acondicionamiento/${ORDER_ID}`);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it.each([
    ['batch_expiry_not_future', new BatchExpiryNotFutureError()],
    ['batch_production_date_future', new BatchProductionDateFutureError()],
    ['batch_duplicate_lot', new ConditioningBatchDuplicateLotError(LOTE_A)],
    ['batch_duplicate_lot en carrera', new ConditioningBatchDuplicateLotError()],
    ['batch_not_found', new ConditioningBatchNotFoundError()],
    ['unauthorized', new UnauthorizedError()],
    ['order_conditioning_taken', new OrderConditioningTakenError()],
    ['order_not_conditionable', new OrderNotConditionableError()],
  ] as const)(
    'R25: %s se traduce a ErrorState con el codigo y el texto del catalogo, sin `batchId` y sin revalidar',
    async (_n, error) => {
      saveConditioningBatchDataMock.mockRejectedValue(error);

      const resultado = await saveConditioningBatchDataAction(
        { status: 'idle' },
        formData([['orderId', ORDER_ID], ...datosFd('CR-A', '2027-04-30', '2026-10-01')]),
      );

      expect(resultado).toEqual({ status: 'error', code: error.code, message: errorMessage(error.code) });
      expect(resultado).not.toHaveProperty('batchId');
      expect(revalidatePathMock).not.toHaveBeenCalled();
    },
  );
});

describe('QC-299 T13 — recordConditioningStepAction: dejar atras un paso de acondicionamiento', () => {
  const INPUT = { orderId: ORDER_ID, stepPosition: 2, responsibleUserIds: [BETO] };

  it('R31: pasa el actor de la sesion y la entrada tal cual; exito -> devuelve el avance y revalida el detalle', async () => {
    recordConditioningStepMock.mockResolvedValue({ completedCount: 2, allCompleted: false });

    const resultado = await recordConditioningStepAction(INPUT);

    expect(recordConditioningStepMock).toHaveBeenCalledWith(
      { id: 'user-1', companyId: 'company-1', permissions: SESSION_USER.permissions },
      INPUT,
    );
    expect(resultado).toEqual({ status: 'success', data: { completedCount: 2, allCompleted: false } });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/asignacion/acondicionamiento/${ORDER_ID}`);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('R31: sin sesion el actor llega `null` y el caso de uso rechaza con `unauthorized`', async () => {
    getSessionUserMock.mockResolvedValue(null);
    recordConditioningStepMock.mockRejectedValue(new UnauthorizedError());

    const resultado = await recordConditioningStepAction(INPUT);

    expect(recordConditioningStepMock).toHaveBeenCalledWith(null, INPUT);
    expect(resultado).toEqual({ status: 'error', code: 'unauthorized', message: errorMessage('unauthorized') });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it.each([
    ['unauthorized', new UnauthorizedError()],
    ['invalid_input', new ValidationError()],
    ['order_not_found', new OrderNotFoundError()],
    ['order_not_conditionable', new OrderNotConditionableError()],
    ['order_conditioning_taken', new OrderConditioningTakenError()],
    ['conditioning_step_out_of_order', new ConditioningStepOutOfOrderError()],
    ['conditioning_responsibles_required', new ConditioningResponsiblesRequiredError()],
    ['conditioning_responsible_not_allowed', new ConditioningResponsibleNotAllowedError()],
    ['evidence_required', new EvidenceRequiredError()],
  ] as const)('R31: %s se traduce a ErrorState con el texto del catalogo y no revalida', async (_n, error) => {
    recordConditioningStepMock.mockRejectedValue(error);

    const resultado = await recordConditioningStepAction(INPUT);

    expect(resultado).toEqual({ status: 'error', code: error.code, message: errorMessage(error.code) });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('R31: una entrada sin `orderId` de texto no revalida nada', async () => {
    recordConditioningStepMock.mockResolvedValue({ completedCount: 1, allCompleted: true });

    const resultado = await recordConditioningStepAction(null);

    expect(resultado).toEqual({ status: 'success', data: { completedCount: 1, allCompleted: true } });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
