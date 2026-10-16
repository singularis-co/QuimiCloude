// Las dos actions de las fotos de un pedido desde la ficha. Esta capa no decide nada: se prueba la
// accion REAL contra la composicion doblada. Lo que se mira es el actor que entrega, la traduccion
// de errores por su `code` y que la firma caida va al log y no al navegador.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  countOrderEvidenceAction,
  getOrderEvidenceAction,
} from '@/lib/modules/asignaciones/adapters/driving/order-evidence-actions';
import { OrderNotFoundError, UnauthorizedError, ValidationError } from '@/lib/modules/asignaciones';
import {
  ORDER_EVIDENCE,
  ORDER_EVIDENCE_COUNTS,
  ORDER_EVIDENCE_UNSIGNED,
} from '@/tests/fixtures/order-evidence';

const { getSessionUserMock, getSessionContextMock, getOrderEvidenceMock, countOrderEvidenceMock, logWarnMock } =
  vi.hoisted(() => ({
    getSessionUserMock: vi.fn(),
    getSessionContextMock: vi.fn(),
    getOrderEvidenceMock: vi.fn(),
    countOrderEvidenceMock: vi.fn(),
    logWarnMock: vi.fn(),
  }));

vi.mock('@/lib/composition', () => ({
  observabilidad: { readRequestIdHeader: vi.fn(async () => 'req-1') },
  identity: {
    getSessionUser: getSessionUserMock,
    getSessionContext: getSessionContextMock,
  },
  asignaciones: {
    getOrderEvidence: getOrderEvidenceMock,
    countOrderEvidence: countOrderEvidenceMock,
  },
}));

vi.mock('@/lib/shared/observability/logger', () => ({
  forModule: () => ({ info: vi.fn(), warn: logWarnMock, error: vi.fn() }),
}));

const SESSION_USER = {
  id: 'user-1',
  username: 'ana.perez',
  displayName: 'Ana Perez',
  roleName: 'Ventas',
  permissions: ['pedidos.consultar'],
};
const SESSION_CONTEXT = { userId: 'user-1', companyId: 'company-1', roleName: 'Ventas' };
const ACTOR = { id: 'user-1', companyId: 'company-1', permissions: ['pedidos.consultar'] };
const ORDER_ID = '3f1c9b2e-8d47-4a10-9c65-2b7e4f0a1d38';

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUserMock.mockResolvedValue(SESSION_USER);
  getSessionContextMock.mockResolvedValue(SESSION_CONTEXT);
});

describe('getOrderEvidenceAction', () => {
  it('entrega el actor de la sesion y el id al caso de uso y devuelve solo `evidence`', async () => {
    getOrderEvidenceMock.mockResolvedValue({ evidence: ORDER_EVIDENCE, signingFailure: null });

    const resultado = await getOrderEvidenceAction(ORDER_ID);

    expect(resultado).toEqual({ status: 'success', data: ORDER_EVIDENCE });
    expect(getOrderEvidenceMock).toHaveBeenCalledWith(ACTOR, { orderId: ORDER_ID });
    expect(logWarnMock).not.toHaveBeenCalled();
  });

  it('R11: con la firma caida devuelve los grupos sin fotos y escribe `signingFailure` en el log', async () => {
    getOrderEvidenceMock.mockResolvedValue({ evidence: ORDER_EVIDENCE_UNSIGNED, signingFailure: 'storage caido' });

    const resultado = await getOrderEvidenceAction(ORDER_ID);

    expect(resultado).toEqual({ status: 'success', data: ORDER_EVIDENCE_UNSIGNED });
    expect(JSON.stringify(resultado)).not.toContain('storage caido');
    expect(logWarnMock).toHaveBeenCalledTimes(1);
    expect(logWarnMock).toHaveBeenCalledWith('evidence_read_signing_failed', {
      orderId: ORDER_ID,
      message: 'storage caido',
    });
  });

  it('R2: sin sesion el actor llega ausente y el rechazo lo da el caso de uso, no la accion', async () => {
    getSessionUserMock.mockResolvedValue(null);
    getOrderEvidenceMock.mockRejectedValue(new UnauthorizedError());

    const resultado = await getOrderEvidenceAction(ORDER_ID);

    expect(getOrderEvidenceMock.mock.calls[0]![0]).toBeNull();
    expect(resultado).toMatchObject({ status: 'error', code: 'unauthorized' });
  });

  it('R2: un actor sin el permiso llega igual al caso de uso: la accion no comprueba permisos', async () => {
    getSessionUserMock.mockResolvedValue({ ...SESSION_USER, permissions: ['inventario.consultar'] });
    getOrderEvidenceMock.mockRejectedValue(new UnauthorizedError());

    const resultado = await getOrderEvidenceAction(ORDER_ID);

    expect(getOrderEvidenceMock).toHaveBeenCalledTimes(1);
    expect(resultado).toMatchObject({ status: 'error', code: 'unauthorized' });
  });

  it('R5: `order_not_found` se traduce por su `code`', async () => {
    getOrderEvidenceMock.mockRejectedValue(new OrderNotFoundError());
    await expect(getOrderEvidenceAction('no-es-un-uuid')).resolves.toMatchObject({
      status: 'error',
      code: 'order_not_found',
    });
  });

  it('un error inesperado no se filtra: sale como estado de error con referencia', async () => {
    getOrderEvidenceMock.mockRejectedValue(new Error('boom'));
    const resultado = await getOrderEvidenceAction(ORDER_ID);
    expect(resultado).toMatchObject({ status: 'error', reference: expect.any(String) });
    expect(JSON.stringify(resultado)).not.toContain('boom');
  });
});

describe('countOrderEvidenceAction', () => {
  it('entrega el actor y la lista al caso de uso y devuelve el conteo tal cual', async () => {
    countOrderEvidenceMock.mockResolvedValue(ORDER_EVIDENCE_COUNTS);

    const resultado = await countOrderEvidenceAction([ORDER_ID]);

    expect(resultado).toEqual({ status: 'success', data: ORDER_EVIDENCE_COUNTS });
    expect(countOrderEvidenceMock).toHaveBeenCalledWith(ACTOR, { orderIds: [ORDER_ID] });
  });

  it('R2: `unauthorized` se traduce por su `code`', async () => {
    countOrderEvidenceMock.mockRejectedValue(new UnauthorizedError());
    await expect(countOrderEvidenceAction([ORDER_ID])).resolves.toMatchObject({
      status: 'error',
      code: 'unauthorized',
    });
  });

  it('R6: `invalid_input` se traduce por su `code`', async () => {
    countOrderEvidenceMock.mockRejectedValue(new ValidationError());
    await expect(countOrderEvidenceAction(['no-es-un-uuid'])).resolves.toMatchObject({
      status: 'error',
      code: 'invalid_input',
    });
  });
});
