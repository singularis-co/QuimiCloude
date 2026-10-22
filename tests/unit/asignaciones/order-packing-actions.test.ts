// tests/unit/asignaciones/order-packing-actions.test.ts
//
// Las DOS Server Actions de la pantalla de empaque, calcadas de
// `order-execution-actions.test.ts`: esta capa no decide nada, asi que se prueba contra la accion
// REAL con `redirect`/`revalidatePath` doblados, nunca contra un doble de la propia accion.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  finishPackingAction,
  startPackingAction,
} from '@/lib/modules/asignaciones/adapters/driving/order-packing-actions';
import {
  OrderNotPackableError,
  OrderPackingTakenError,
  PackagingStockInsufficientError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/modules/asignaciones';

const {
  getSessionUserMock,
  getSessionContextMock,
  startPackingMock,
  finishPackingMock,
  redirectMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getSessionContextMock: vi.fn(),
  startPackingMock: vi.fn(),
  finishPackingMock: vi.fn(),
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
    startPacking: startPackingMock,
    finishPacking: finishPackingMock,
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

// Mismo patron que `order-execution-actions.test.ts`: el `redirect` real de Next lanza para
// senializar la navegacion, y el doble reproduce ese comportamiento.
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
  roleName: 'Empacador',
  permissions: ['empaque.modificar'],
};

const SESSION_CONTEXT = { userId: 'user-1', companyId: 'company-1', roleName: 'Empacador' };

const ORDER_ID = '3f1c9b2e-8d47-4a10-9c65-2b7e4f0a1d38';

function formDataConPedido(orderId: string): FormData {
  const formData = new FormData();
  formData.append('orderId', orderId);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUserMock.mockResolvedValue(SESSION_USER);
  getSessionContextMock.mockResolvedValue(SESSION_CONTEXT);
});

describe('startPackingAction — Comenzar vuelve a la MISMA pantalla del pedido', () => {
  it('exito: revalida la pantalla del pedido y no redirige (R26)', async () => {
    startPackingMock.mockResolvedValue(undefined);

    const resultado = await startPackingAction({ status: 'success' }, formDataConPedido(ORDER_ID));

    expect(resultado).toEqual({ status: 'success' });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/asignacion/empaque/${ORDER_ID}`);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('un pedido ya tomado por otro empacador se traduce por su `code` y no revalida', async () => {
    startPackingMock.mockRejectedValue(new OrderPackingTakenError());

    const resultado = await startPackingAction({ status: 'success' }, formDataConPedido(ORDER_ID));

    expect(resultado).toMatchObject({ status: 'error', code: 'order_packing_taken' });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('un pedido que ya no admite Comenzar se traduce por su `code`', async () => {
    startPackingMock.mockRejectedValue(new OrderNotPackableError());

    const resultado = await startPackingAction({ status: 'success' }, formDataConPedido(ORDER_ID));

    expect(resultado).toMatchObject({ status: 'error', code: 'order_not_packable' });
  });

  it('un actor sin el permiso lo rechaza el caso de uso, nunca esta capa (R13)', async () => {
    startPackingMock.mockRejectedValue(new UnauthorizedError());

    const resultado = await startPackingAction({ status: 'success' }, formDataConPedido(ORDER_ID));

    expect(resultado).toMatchObject({ status: 'error', code: 'unauthorized' });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe('finishPackingAction — la confirmacion viaja en la URL de vuelta, no en el return', () => {
  it('redirige a `/asignacion?vista=por_empacar&empacado=<numero>` (R26)', async () => {
    finishPackingMock.mockResolvedValue({ numberText: '2026-0000007' });

    await expect(
      finishPackingAction({ status: 'success' }, formDataConPedido(ORDER_ID)),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith('/asignacion?vista=por_empacar&empacado=2026-0000007');
    expect(revalidatePathMock).toHaveBeenCalledWith('/asignacion');
  });

  it('un numero con caracteres especiales viaja escapado en la cadena de consulta', async () => {
    finishPackingMock.mockResolvedValue({ numberText: '2026/0000007' });

    await expect(
      finishPackingAction({ status: 'success' }, formDataConPedido(ORDER_ID)),
    ).rejects.toThrow('NEXT_REDIRECT');

    const [ruta] = redirectMock.mock.calls[0] as [string];
    const params = new URL(ruta, 'http://localhost').searchParams;
    expect(params.get('vista')).toBe('por_empacar');
    expect(params.get('empacado')).toBe('2026/0000007');
  });

  it('quien tiene el pedido en empaque es otro: se traduce por su `code` y NO redirige', async () => {
    finishPackingMock.mockRejectedValue(new OrderPackingTakenError());

    const resultado = await finishPackingAction({ status: 'success' }, formDataConPedido(ORDER_ID));

    expect(resultado).toMatchObject({ status: 'error', code: 'order_packing_taken' });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('un actor sin el permiso lo rechaza el caso de uso, nunca esta capa (R13)', async () => {
    finishPackingMock.mockRejectedValue(new UnauthorizedError());

    const resultado = await finishPackingAction({ status: 'success' }, formDataConPedido(ORDER_ID));

    expect(resultado).toMatchObject({ status: 'error', code: 'unauthorized' });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe('finishPackingAction — conteo real de envases en `lines` (QC-281)', () => {
  const LINEAS = [
    { lineId: '9a1c9b2e-8d47-4a10-9c65-2b7e4f0a1d38', packedPackages: 3, reason: null, reasonOther: null },
    { lineId: '9b1c9b2e-8d47-4a10-9c65-2b7e4f0a1d38', packedPackages: 1, reason: 'otro', reasonOther: 'Se cayo' },
  ];

  function formDataConLineas(lines: string | null): FormData {
    const formData = formDataConPedido(ORDER_ID);
    if (lines !== null) formData.append('lines', lines);
    return formData;
  }

  it('R13: un FormData valido pasa `orderId` y `lines` parseado al caso de uso y redirige como hoy', async () => {
    finishPackingMock.mockResolvedValue({ numberText: '2026-0000007' });

    await expect(
      finishPackingAction({ status: 'success' }, formDataConLineas(JSON.stringify(LINEAS))),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(finishPackingMock).toHaveBeenCalledWith(
      { id: 'user-1', companyId: 'company-1', permissions: ['empaque.modificar'] },
      { orderId: ORDER_ID, lines: LINEAS },
    );
    expect(redirectMock).toHaveBeenCalledWith('/asignacion?vista=por_empacar&empacado=2026-0000007');
    expect(revalidatePathMock).toHaveBeenCalledWith('/asignacion');
  });

  it.each([
    ['sin `lines`', null],
    ['`lines` con JSON roto', '[{"lineId":'],
  ])('R13: %s llega al caso de uso como `lines: undefined`; esta capa no decide', async (_caso, lines) => {
    finishPackingMock.mockRejectedValue(new ValidationError());

    const resultado = await finishPackingAction({ status: 'success' }, formDataConLineas(lines));

    expect(finishPackingMock).toHaveBeenCalledWith(expect.anything(), { orderId: ORDER_ID, lines: undefined });
    expect(resultado).toMatchObject({ status: 'error', code: 'invalid_input' });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it.each([
    [new PackagingStockInsufficientError(), 'packaging_stock_insufficient', 'No alcanza el stock del envase.'],
  ] as const)('R13: el rechazo del servidor se traduce por su `code` %s y no redirige', async (error, code, message) => {
    finishPackingMock.mockRejectedValue(error);

    const resultado = await finishPackingAction({ status: 'success' }, formDataConLineas(JSON.stringify(LINEAS)));

    expect(resultado).toMatchObject({ status: 'error', code, message });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
