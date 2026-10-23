import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PackingOrdersListSection } from '@/app/(private)/asignacion/components';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';

const { routerMock, getSessionUserMock, getSessionContextMock, listPackingOrdersMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  getSessionUserMock: vi.fn<() => Promise<unknown>>(),
  getSessionContextMock: vi.fn<() => Promise<unknown>>(),
  listPackingOrdersMock: vi.fn<(actor: unknown, query: unknown) => Promise<unknown>>(),
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock, getSessionContext: getSessionContextMock },
  asignaciones: { listPackingOrders: listPackingOrdersMock },
  observabilidad: { readRequestIdHeader: vi.fn(async (): Promise<string | null> => null) },
}));

// La tabla y `AssignmentListError` llaman `useRouter()` y jsdom no monta el App Router.
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

const ACTOR_SESSION = {
  id: 'u-1',
  username: 'empacador.prueba',
  displayName: 'Empacador de Prueba',
  roleName: 'Empacador',
  permissions: ['empaque.modificar'],
};

const PARAMS = { page: 1, pageSize: 10, sort: null, filters: {}, search: '' };

function paginaCon(items: readonly unknown[], overrides: Partial<Record<string, number>> = {}) {
  return {
    items,
    total: overrides.total ?? items.length,
    page: overrides.page ?? 1,
    pageSize: overrides.pageSize ?? 10,
    totalPages: overrides.totalPages ?? 1,
  };
}

const ORDER_ROW = {
  id: 'order-1',
  numberText: '2026-0000030',
  recipeName: 'Jarabe simple',
  quantity: '20',
  presentationLines: [{ presentationId: 'pres-1', presentationName: 'Caja x 12', packages: 4 }],
  unitId: null,
  unitLabel: null,
  packages: '4',
  status: 'POR_EMPACAR',
  priority: 'ALTA',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  packedByName: null,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  getSessionUserMock.mockResolvedValue(ACTOR_SESSION);
  getSessionContextMock.mockResolvedValue({ companyId: 'company-1' });
});

describe('R14, R16 - la seccion pide la pagina y pinta la fila con sus seis datos', () => {
  it('pasa `page`/`pageSize` a `listPackingOrders` y pinta la fila en la tabla compartida', async () => {
    listPackingOrdersMock.mockResolvedValue(paginaCon([ORDER_ROW]));
    const user = setupUser();

    render(await PackingOrdersListSection({ params: PARAMS }));

    expect(listPackingOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u-1', companyId: 'company-1' }),
      { page: 1, pageSize: 10 },
    );
    expect(screen.getByTestId('packing-orders-list-section')).toBeInTheDocument();
    const tabla = screen.getByRole('table');
    expect(within(tabla).getByTestId('data-table-row-order-1')).toBeInTheDocument();
    expect(screen.queryByTestId('packing-order-link')).toBeNull();
    await user.click(within(tabla).getByRole('button', { name: 'Acciones del pedido 2026-0000030' }));
    const entrar = await esperarInteractiva(await screen.findByTestId('assignment-row-enter'));
    expect(entrar).toHaveAttribute('href', '/asignacion/empaque/order-1');
  });
});

describe('R14 - lista vacia: sin filas, sin tabla', () => {
  it('sin pedidos, pinta el mensaje de vacio y no la tabla', async () => {
    listPackingOrdersMock.mockResolvedValue(paginaCon([]));

    render(await PackingOrdersListSection({ params: PARAMS }));

    expect(screen.getByTestId('packing-orders-empty-message')).toHaveTextContent(
      'No hay pedidos por empacar en tu empresa.',
    );
    expect(screen.queryByTestId('packing-orders-table')).toBeNull();
  });

  it('pagina pasada del total: mensaje distinto y enlace de vuelta', async () => {
    listPackingOrdersMock.mockResolvedValue(paginaCon([], { page: 3, totalPages: 2 }));

    render(await PackingOrdersListSection({ params: { ...PARAMS, page: 3 } }));

    expect(screen.getByTestId('packing-orders-empty-message')).toHaveTextContent(
      'Esta página ya no tiene pedidos.',
    );
    expect(screen.getByTestId('packing-orders-first-page')).toHaveAttribute(
      'href',
      expect.stringContaining('vista=por_empacar'),
    );
  });
});

describe('fallo del caso de uso: se pinta el estado de error, no una tabla vacia', () => {
  it('un error inesperado no tumba la pantalla', async () => {
    listPackingOrdersMock.mockRejectedValue(new Error('fallo de base de datos'));

    render(await PackingOrdersListSection({ params: PARAMS }));

    expect(screen.getByTestId('assigned-orders-error')).toBeInTheDocument();
    expect(screen.queryByTestId('packing-orders-table')).toBeNull();
  });
});

describe('R43 - paginacion con objetivos tactiles de 44x44, sin depender de hover', () => {
  it('la paginacion de la tabla compartida cumple el minimo tactil y conserva ?vista=por_empacar', async () => {
    listPackingOrdersMock.mockResolvedValue(paginaCon([ORDER_ROW], { page: 1, totalPages: 2 }));
    const user = setupUser();

    render(await PackingOrdersListSection({ params: PARAMS }));

    const siguiente = screen.getByTestId('data-table-next');
    expect(siguiente.className).toContain('min-h-11');
    expect(siguiente.className).toContain('min-w-11');
    expect(screen.getByTestId('data-table-previous')).toBeDisabled();

    await user.click(siguiente);
    const href = routerMock.push.mock.calls[0]?.[0] ?? '';
    expect(href).toContain('vista=por_empacar');
    expect(href).toContain('page=2');
  });
});
