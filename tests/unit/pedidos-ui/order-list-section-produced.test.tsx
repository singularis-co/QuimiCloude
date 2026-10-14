// La sección de /pedidos pide el producto terminado solo de los pedidos producidos de la página, y
// si esa lectura falla la lista se pinta igual, sin enlaces.
//
// `OrderListSection` es un Server Component `async`: se le llama como función y se pinta lo que
// devuelve. Los bordes de los módulos que no se ejercitan aquí se sustituyen igual que en
// `order-list-section.test.tsx`.

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_PRODUCED_PRODUCT_LINK_TESTID,
  OrderListSection,
} from '@/app/(private)/pedidos/components';
import type { DataTableParams } from '@/components/shared/data-table';
import type { ProducedProductsResult } from '@/lib/modules/inventario/adapters/driving/finished-product-actions';
import { formatOrderNumber, type OrderSummary } from '@/lib/modules/pedidos';
import type { OrderListResult } from '@/lib/modules/pedidos/adapters/driving/order-actions';
import type { UnitView } from '@/lib/modules/unidades';
import { DEFAULT_PAGE_SIZE } from '@/lib/shared/pagination';
import { finishedProductDetailRoute } from '@/lib/shared/routes';
import { WIDE_VIEWPORT, resetViewport, setViewportWidth } from '../../helpers/viewport';

const { listOrdersActionMock, listProducedProductsActionMock, routerMock, getSessionUserMock } =
  vi.hoisted(() => ({
    listOrdersActionMock: vi.fn<(query: unknown) => Promise<OrderListResult>>(),
    listProducedProductsActionMock:
      vi.fn<(orderIds: readonly string[]) => Promise<ProducedProductsResult>>(),
    getSessionUserMock: vi.fn(async () => ({
      id: '55555555-5555-4555-8555-555555555555',
      permissions: ['pedidos.consultar', 'inventario.consultar'],
    })),
    routerMock: {
      push: vi.fn<(href: string) => void>(),
      replace: vi.fn<(href: string) => void>(),
      refresh: vi.fn<() => void>(),
      back: vi.fn<() => void>(),
      forward: vi.fn<() => void>(),
      prefetch: vi.fn<(href: string) => void>(),
    },
  }));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock },
}));

vi.mock('@/lib/modules/inventario/adapters/driving/finished-product-actions', () => ({
  listProducedProductsAction: listProducedProductsActionMock,
}));

vi.mock('@/lib/modules/pedidos/adapters/driving/order-actions', () => ({
  listOrdersAction: listOrdersActionMock,
  getOrderAction: vi.fn(() => {
    throw new Error('getOrderAction no debe invocarse desde la lista');
  }),
  listOrderCoverageAction: vi.fn(async () => ({ status: 'success' as const, data: [] })),
  getOrderCustomerFilterOptionAction: vi.fn(() => {
    throw new Error('getOrderCustomerFilterOptionAction no debe invocarse sin filtro de cliente');
  }),
  searchOrderCustomersAction: vi.fn(() => {
    throw new Error('searchOrderCustomersAction no debe invocarse sin abrir el filtro');
  }),
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-assignment-actions', () => ({
  listResponsiblesForOrdersAction: vi.fn(async () => ({ status: 'success' as const, data: [] })),
  listOrderResponsiblesAction: vi.fn(() => {
    throw new Error('listOrderResponsiblesAction no debe invocarse desde la lista');
  }),
  listResponsibleCandidatesAction: vi.fn(async () => ({ status: 'success' as const, data: [] })),
  assignResponsiblesAction: vi.fn(),
  unassignResponsibleAction: vi.fn(),
  removeWorkGroupFromOrderAction: vi.fn(),
}));

vi.mock('@/lib/modules/identity/adapters/driving/work-group-actions', () => ({
  listWorkGroupsAction: vi.fn(async () => ({
    status: 'success' as const,
    data: { items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 },
  })),
}));

vi.mock('@/lib/modules/recetas/adapters/driving/recipe-actions', () => ({
  listRecipeVersionsAction: vi.fn(async () => ({ status: 'success' as const, data: [] })),
  listRecipesAction: vi.fn(async () => ({
    status: 'success' as const,
    data: { items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 },
  })),
  getRecipeAction: vi.fn(async (id: string) => ({
    status: 'success' as const,
    data: {
      id,
      name: 'Receta',
      description: null,
      imageUrl: null,
      stepCount: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdBy: null,
      updatedBy: null,
      steps: [],
      lines: [],
    },
  })),
}));

vi.mock('@/lib/modules/unidades/adapters/driving/unit-actions', () => ({
  listUnitsAction: vi.fn(async () => ({ status: 'success' as const, data: [] })),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/presentation-actions', () => ({
  listPresentationsAction: vi.fn(async () => ({
    status: 'success' as const,
    data: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 },
  })),
  createPresentationAction: vi.fn(() => {
    throw new Error('createPresentationAction no debe invocarse desde este archivo');
  }),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/product-actions', () => ({
  listProductsAction: vi.fn(async () => ({
    status: 'success' as const,
    data: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 },
  })),
}));

const PEDIDO_PENDIENTE = '11111111-1111-4111-8111-111111111111';
const PEDIDO_TERMINADO = '22222222-2222-4222-8222-222222222221';
const PEDIDO_ENTREGADO = '33333333-3333-4333-8333-333333333331';
const PEDIDO_CANCELADO = '44444444-4444-4444-8444-444444444441';
const PRESENTACION_ID = '66666666-6666-4666-8666-666666666666';
const PRODUCTO_ID = '77777777-7777-4777-8777-777777777777';

const RECIPES_VACIAS = { items: [], totalPages: 1 };
const UNITS_VACIAS: readonly UnitView[] = [];

const PARAMETROS: DataTableParams = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sort: null,
  filters: {},
  search: '',
};

function pedido(id: string, sequence: number, status: OrderSummary['status']): OrderSummary {
  return {
    id,
    number: { year: 2026, sequence },
    numberText: formatOrderNumber({ year: 2026, sequence }),
    recipeId: '88888888-8888-4888-8888-888888888888',
    recipeName: 'Esmalte azul',
    recipeVersion: null,
    quantity: '12.5000',
    priority: 'MEDIA',
    status,
    cancellationReason: status === 'CANCELADO' ? 'Sin stock' : null,
    ingredientsCost: null,
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    createdBy: null,
    updatedBy: null,
    presentationLines: [
      {
        presentationId: PRESENTACION_ID,
        presentationName: 'Bidón 20L',
        packages: 2,
        packagingProductId: null,
        packagingName: null,
      },
    ],
    unitId: null,
    unitLabel: null,
    customer: null,
  };
}

function pagina(items: readonly OrderSummary[]): OrderListResult {
  return {
    status: 'success',
    data: { items, total: items.length, page: 1, pageSize: DEFAULT_PAGE_SIZE, totalPages: 1 },
  };
}

async function pintarSeccion() {
  render(
    await OrderListSection({
      params: PARAMETROS,
      recipes: RECIPES_VACIAS,
      units: UNITS_VACIAS,
      bridge: null,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setViewportWidth(WIDE_VIEWPORT);
});

afterEach(() => {
  cleanup();
  resetViewport();
});

describe('la sección de /pedidos y el producto terminado de sus pedidos producidos', () => {
  it('R29: si la consulta de productos falla, la lista se pinta igual y sin ningún enlace', async () => {
    listOrdersActionMock.mockResolvedValue(
      pagina([pedido(PEDIDO_TERMINADO, 2, 'TERMINADO'), pedido(PEDIDO_ENTREGADO, 3, 'ENTREGADO')]),
    );
    listProducedProductsActionMock.mockResolvedValue({
      status: 'error',
      code: 'unauthorized',
      message: 'No tienes permiso.',
    });

    await pintarSeccion();

    expect(screen.getByTestId('order-list')).toBeInTheDocument();
    expect(screen.queryByTestId('order-list-error')).toBeNull();
    expect(
      within(screen.getByTestId(`data-table-row-${PEDIDO_TERMINADO}`)).getByText(
        formatOrderNumber({ year: 2026, sequence: 2 }),
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId(`data-table-row-${PEDIDO_ENTREGADO}`)).getByText(
        formatOrderNumber({ year: 2026, sequence: 3 }),
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText('2 × Bidón 20L').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId(ORDER_PRODUCED_PRODUCT_LINK_TESTID)).toHaveLength(0);
  });

  it('R29: sin pedidos TERMINADO ni ENTREGADO en la página no se consultan productos', async () => {
    listOrdersActionMock.mockResolvedValue(
      pagina([pedido(PEDIDO_PENDIENTE, 1, 'PENDIENTE'), pedido(PEDIDO_CANCELADO, 4, 'CANCELADO')]),
    );

    await pintarSeccion();

    expect(screen.getByTestId('order-list')).toBeInTheDocument();
    expect(listProducedProductsActionMock).not.toHaveBeenCalled();
    expect(screen.queryAllByTestId(ORDER_PRODUCED_PRODUCT_LINK_TESTID)).toHaveLength(0);
  });

  it('R27, R29: con pedidos producidos se consulta una sola vez con sus ids y se pintan los enlaces', async () => {
    listOrdersActionMock.mockResolvedValue(
      pagina([
        pedido(PEDIDO_PENDIENTE, 1, 'PENDIENTE'),
        pedido(PEDIDO_TERMINADO, 2, 'TERMINADO'),
        pedido(PEDIDO_ENTREGADO, 3, 'ENTREGADO'),
        pedido(PEDIDO_CANCELADO, 4, 'CANCELADO'),
      ]),
    );
    listProducedProductsActionMock.mockResolvedValue({
      status: 'success',
      data: [
        { orderId: PEDIDO_TERMINADO, presentationId: PRESENTACION_ID, productId: PRODUCTO_ID },
        { orderId: PEDIDO_ENTREGADO, presentationId: PRESENTACION_ID, productId: PRODUCTO_ID },
      ],
    });

    await pintarSeccion();

    expect(listProducedProductsActionMock).toHaveBeenCalledTimes(1);
    expect(listProducedProductsActionMock).toHaveBeenCalledWith([PEDIDO_TERMINADO, PEDIDO_ENTREGADO]);

    const enlaces = screen.getAllByTestId(ORDER_PRODUCED_PRODUCT_LINK_TESTID);
    expect(enlaces).toHaveLength(2);
    for (const enlace of enlaces) {
      expect(enlace).toHaveAttribute('href', finishedProductDetailRoute(PRODUCTO_ID));
    }
  });
});
