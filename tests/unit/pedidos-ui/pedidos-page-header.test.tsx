// La cabecera de /pedidos: la pantalla entera (Server Component resuelto) con los bordes de los
// modulos como dobles, igual que la paridad de pedidos.

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ORDER_CREATE_OPEN_TESTID, ORDER_SHEET_TESTID } from '@/app/(private)/pedidos/components';
import PedidosPage from '@/app/(private)/pedidos/page';
import { PERMISSIONS, type SessionUser } from '@/lib/modules/identity';
import { formatOrderNumber, type OrderSummary } from '@/lib/modules/pedidos';
import type { OrderListResult } from '@/lib/modules/pedidos/adapters/driving/order-actions';
import { ORDERS_LABEL } from '@/lib/shared/navigation/private-nav';
import { DEFAULT_PAGE_SIZE } from '@/lib/shared/pagination';
import { ORDERS_ROUTE } from '@/lib/shared/routes';

import { resolverServerComponents } from '../paridad/arbol-accesible';
import { setupUser } from '../../helpers/user-event';
import { WIDE_VIEWPORT, clearSidebarStateCookie, resetViewport, setViewportWidth } from '../../helpers/viewport';

type CookieStoreStub = { get: (name: string) => { name: string; value: string } | undefined };

const USUARIO: SessionUser = {
  id: 'u-cabecera',
  username: 'carla.duarte',
  displayName: 'Carla Duarte Salas',
  roleName: 'Administrador',
  permissions: PERMISSIONS.map((permiso) => permiso.code),
};

const { routerMock, cookiesMock, getSessionUserMock, listOrdersActionMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  cookiesMock: vi.fn<() => Promise<CookieStoreStub>>(),
  getSessionUserMock: vi.fn(),
  listOrdersActionMock: vi.fn<(query: unknown) => Promise<OrderListResult>>(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => ORDERS_ROUTE,
  useRouter: () => routerMock,
  redirect: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock, endSession: vi.fn() },
}));

vi.mock('@/lib/modules/identity/adapters/driving/work-group-actions', () => ({
  listWorkGroupsAction: vi.fn(async () => ({
    status: 'success' as const,
    data: { items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 },
  })),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/finished-product-actions', () => ({
  listProducedProductsAction: vi.fn(async () => ({ status: 'success' as const, data: [] })),
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-assignment-actions', () => ({
  assignResponsiblesAction: vi.fn(),
  unassignResponsibleAction: vi.fn(),
  removeWorkGroupFromOrderAction: vi.fn(),
  listOrderResponsiblesAction: vi.fn(),
  listResponsiblesForOrdersAction: vi.fn(async () => ({ status: 'success', data: [] })),
  listResponsibleCandidatesAction: vi.fn(async () => ({ status: 'success', data: [] })),
}));

vi.mock('@/lib/modules/pedidos/adapters/driving/order-actions', () => ({
  listOrdersAction: listOrdersActionMock,
  createOrderAction: vi.fn(),
  updateOrderAction: vi.fn(),
  cancelOrderAction: vi.fn(),
  deleteOrderAction: vi.fn(),
  getOrderAction: vi.fn(),
  getOrderCustomerFilterOptionAction: vi.fn(),
  listOrderCoverageAction: vi.fn(async () => ({ status: 'success', data: [] })),
  quoteOrderCostAction: vi.fn(async () => ({ status: 'success', data: { ingredientsCost: null } })),
}));

vi.mock('@/lib/modules/recetas/adapters/driving/recipe-actions', () => ({
  listRecipeVersionsAction: vi.fn(async () => ({ status: 'success' as const, data: [] })),
  listRecipesAction: vi.fn(async () => ({
    status: 'success' as const,
    data: { items: [], total: 0, page: 1, pageSize: 100, totalPages: 1 },
  })),
  getRecipeAction: vi.fn(),
}));

vi.mock('@/lib/modules/unidades/adapters/driving/unit-actions', () => ({
  listUnitsAction: vi.fn(async () => ({ status: 'success' as const, data: [] })),
  getMassVolumeBridgeAction: vi.fn(async () => ({ status: 'success' as const, data: null })),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/presentation-actions', () => ({
  listPresentationsAction: vi.fn(async () => ({
    status: 'success' as const,
    data: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 },
  })),
  createPresentationAction: vi.fn(),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/product-actions', () => ({
  listProductsAction: vi.fn(async () => ({
    status: 'success' as const,
    data: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 },
  })),
}));

function pedido(): OrderSummary {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    number: { year: 2026, sequence: 42 },
    numberText: formatOrderNumber({ year: 2026, sequence: 42 }),
    recipeId: '11111111-1111-4111-8111-111111111111',
    recipeName: 'Esmalte azul',
    recipeVersion: null,
    quantity: '12.5000',
    priority: 'MEDIA',
    status: 'PENDIENTE',
    cancellationReason: null,
    ingredientsCost: null,
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    createdBy: null,
    updatedBy: null,
    presentationLines: [],
    unitId: null,
    unitLabel: null,
    customer: null,
  };
}

async function renderPantalla() {
  const arbol = await PedidosPage({ searchParams: Promise.resolve({}) });
  return render(<>{await resolverServerComponents(arbol)}</>);
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUserMock.mockResolvedValue(USUARIO);
  cookiesMock.mockResolvedValue({ get: () => undefined });
  listOrdersActionMock.mockResolvedValue({
    status: 'success',
    data: { items: [pedido()], total: 1, page: 1, pageSize: DEFAULT_PAGE_SIZE, totalPages: 1 },
  });
  clearSidebarStateCookie();
  setViewportWidth(WIDE_VIEWPORT);
});

afterEach(() => {
  cleanup();
  resetViewport();
  clearSidebarStateCookie();
});

describe('cabecera de /pedidos', () => {
  it('R1: la pantalla vive dentro de PageShell y su cabecera es PageHeader', async () => {
    const { container } = await renderPantalla();

    const shell = container.querySelector<HTMLElement>('[data-slot="page-shell"]');
    expect(shell).not.toBeNull();
    const cabecera = shell!.querySelector<HTMLElement>('[data-slot="page-header"]');
    expect(cabecera).not.toBeNull();
    expect(cabecera!.parentElement).toBe(shell);
    expect(within(shell!).getByTestId('order-list')).toBeInTheDocument();
  });

  it('R1: «Pedidos» es el unico h1, con pedidos-title, dentro de la cabecera', async () => {
    const { container } = await renderPantalla();

    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent(ORDERS_LABEL);
    expect(ORDERS_LABEL).toBe('Pedidos');
    expect(titulos[0]).toHaveAttribute('data-testid', 'pedidos-title');
    expect(screen.getAllByTestId('pedidos-title')).toHaveLength(1);
    expect(container.querySelector('[data-slot="page-header"]')!.contains(titulos[0]!)).toBe(true);
  });

  it('R1: «Nuevo pedido» vive en las acciones de la cabecera, mide 44 px y abre el panel de alta', async () => {
    const user = setupUser();
    const { container } = await renderPantalla();

    const acciones = container.querySelector<HTMLElement>('[data-slot="page-header-actions"]');
    expect(acciones).not.toBeNull();
    const nuevo = within(acciones!).getByTestId(ORDER_CREATE_OPEN_TESTID);
    expect(screen.getAllByTestId(ORDER_CREATE_OPEN_TESTID)).toHaveLength(1);
    expect(nuevo).toHaveClass('min-h-11', 'min-w-11');
    expect(nuevo).toHaveTextContent('Nuevo pedido');

    expect(screen.queryByTestId(ORDER_SHEET_TESTID)).toBeNull();
    await user.click(nuevo);

    expect(await screen.findByTestId(ORDER_SHEET_TESTID)).toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});
