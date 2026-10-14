import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getFinishedProductAction,
  listFinishedProductBatchesAction,
  listFinishedProductCostsAction,
  listFinishedProductDeliveriesAction,
  listFinishedProductMovementsAction,
  listProducedProductsAction,
} from '@/lib/modules/inventario/adapters/driving/finished-product-actions';
import { ProductNotFoundError, UnauthorizedError, ValidationError } from '@/lib/modules/inventario';
import {
  FINISHED_ORDER_ID,
  FINISHED_PRODUCT_ERROR_STATES,
  FINISHED_PRODUCT_ID,
} from '@/tests/fixtures/finished-product-detail';

const { casos, getSessionUserMock, getSessionContextMock } = vi.hoisted(() => ({
  casos: {
    getFinishedProduct: vi.fn(),
    listFinishedProductBatches: vi.fn(),
    listFinishedProductMovements: vi.fn(),
    listFinishedProductDeliveries: vi.fn(),
    listFinishedProductCosts: vi.fn(),
    listProducedProducts: vi.fn(),
  },
  getSessionUserMock: vi.fn(),
  getSessionContextMock: vi.fn(),
}));

vi.mock('@/lib/composition', () => ({
  observabilidad: { readRequestIdHeader: vi.fn(async () => '7c9e6679-7425-40de-944b-e07fc1f90ae7') },
  identity: { getSessionUser: getSessionUserMock, getSessionContext: getSessionContextMock },
  inventario: casos,
}));

const ACTOR = { id: 'user-lector-1', companyId: 'company-a', permissions: ['inventario.consultar'] };

type Accion = {
  readonly nombre: string;
  readonly casoDeUso: keyof typeof casos;
  readonly invocar: () => Promise<unknown>;
  readonly argumentos: readonly unknown[];
};

const ACCIONES: readonly Accion[] = [
  {
    nombre: 'getFinishedProductAction',
    casoDeUso: 'getFinishedProduct',
    invocar: () => getFinishedProductAction(FINISHED_PRODUCT_ID),
    argumentos: [FINISHED_PRODUCT_ID, ACTOR],
  },
  {
    nombre: 'listFinishedProductBatchesAction',
    casoDeUso: 'listFinishedProductBatches',
    invocar: () => listFinishedProductBatchesAction(FINISHED_PRODUCT_ID, { page: 2 }),
    argumentos: [FINISHED_PRODUCT_ID, { page: 2 }, ACTOR],
  },
  {
    nombre: 'listFinishedProductMovementsAction',
    casoDeUso: 'listFinishedProductMovements',
    invocar: () => listFinishedProductMovementsAction(FINISHED_PRODUCT_ID, { direction: 'in' }),
    argumentos: [FINISHED_PRODUCT_ID, { direction: 'in' }, ACTOR],
  },
  {
    nombre: 'listFinishedProductDeliveriesAction',
    casoDeUso: 'listFinishedProductDeliveries',
    invocar: () => listFinishedProductDeliveriesAction(FINISHED_PRODUCT_ID, { page: 1 }),
    argumentos: [FINISHED_PRODUCT_ID, { page: 1 }, ACTOR],
  },
  {
    nombre: 'listFinishedProductCostsAction',
    casoDeUso: 'listFinishedProductCosts',
    invocar: () => listFinishedProductCostsAction(FINISHED_PRODUCT_ID, {}),
    argumentos: [FINISHED_PRODUCT_ID, {}, ACTOR],
  },
  {
    nombre: 'listProducedProductsAction',
    casoDeUso: 'listProducedProducts',
    invocar: () => listProducedProductsAction([FINISHED_ORDER_ID]),
    argumentos: [[FINISHED_ORDER_ID], ACTOR],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUserMock.mockResolvedValue({
    id: 'user-lector-1',
    username: 'luis.mora',
    displayName: 'Luis Mora',
    roleName: 'Operador',
    permissions: ['inventario.consultar'],
  });
  getSessionContextMock.mockResolvedValue({ userId: 'user-lector-1', companyId: 'company-a', roleName: 'Operador' });
});

describe.each(ACCIONES)('$nombre', ({ casoDeUso, invocar, argumentos }) => {
  it('R2: traduce unauthorized a su ErrorState', async () => {
    casos[casoDeUso].mockRejectedValue(new UnauthorizedError());

    await expect(invocar()).resolves.toEqual(FINISHED_PRODUCT_ERROR_STATES.unauthorized);
  });

  it('R5: traduce product_not_found a su ErrorState', async () => {
    casos[casoDeUso].mockRejectedValue(new ProductNotFoundError());

    await expect(invocar()).resolves.toEqual(FINISHED_PRODUCT_ERROR_STATES.productNotFound);
  });

  it('R23: traduce invalid_input a su ErrorState', async () => {
    casos[casoDeUso].mockRejectedValue(new ValidationError());

    await expect(invocar()).resolves.toEqual(FINISHED_PRODUCT_ERROR_STATES.invalidInput);
  });

  it('R25: lee la sesion una vez y pasa al caso de uso el actor de la sesion, con la empresa del servidor', async () => {
    casos[casoDeUso].mockResolvedValue({ ok: true });

    await expect(invocar()).resolves.toEqual({ status: 'success', data: { ok: true } });
    expect(getSessionUserMock).toHaveBeenCalledTimes(1);
    expect(getSessionContextMock).toHaveBeenCalledTimes(1);
    expect(casos[casoDeUso]).toHaveBeenCalledTimes(1);
    expect(casos[casoDeUso]).toHaveBeenCalledWith(...argumentos);
  });

  it('R2: sin sesion pasa un actor null y devuelve unauthorized', async () => {
    getSessionUserMock.mockResolvedValue(null);
    casos[casoDeUso].mockRejectedValue(new UnauthorizedError());

    await expect(invocar()).resolves.toEqual(FINISHED_PRODUCT_ERROR_STATES.unauthorized);
    expect(casos[casoDeUso].mock.calls[0]?.at(-1)).toBeNull();
  });
});
