// El campo «Cliente» del panel del pedido: es del pedido entero y viaja en el candidato del alta
// y de la edición (QT-314: el candidato es la entrada tipada con `lines`, no un `FormData`).

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ORDER_FORM_SUBMIT_TESTID, OrderForm } from '@/app/(private)/pedidos/components';
import { Sheet } from '@/components/ui/sheet';
import type { OrderCustomer, OrderSummary } from '@/lib/modules/pedidos';
import type {
  CreateOrderFormState,
  OrderCustomerOptionsResult,
  UpdateOrderFormState,
} from '@/lib/modules/pedidos/adapters/driving/order-actions';
import {
  RECETAS,
  UNIDADES,
  anadirReceta,
  pedidoDeDosRecetas,
  recetaDetalle,
} from '../../helpers/order-form-ui';
import { setupUser } from '../../helpers/user-event';

const { createOrderActionMock, updateOrderActionMock, searchCustomersMock, prohibida } = vi.hoisted(() => ({
  createOrderActionMock: vi.fn<(input: unknown) => Promise<CreateOrderFormState>>(),
  updateOrderActionMock: vi.fn<(id: string, input: unknown) => Promise<UpdateOrderFormState>>(),
  searchCustomersMock: vi.fn<(query: unknown, purpose: string) => Promise<OrderCustomerOptionsResult>>(),
  prohibida: (nombre: string) => () => {
    throw new Error(`${nombre} no debe invocarse desde el panel`);
  },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/lib/modules/pedidos/adapters/driving/order-actions', () => ({
  createOrderAction: createOrderActionMock,
  updateOrderAction: updateOrderActionMock,
  searchOrderCustomersAction: searchCustomersMock,
  setOrderCustomerAction: vi.fn(prohibida('setOrderCustomerAction')),
  quoteOrderCostAction: vi.fn(async () => ({ status: 'success', data: { ingredientsCost: null } })),
  quoteOrderPresentationAvailabilityAction: vi.fn(async () => ({
    status: 'success',
    data: { kind: 'ok', available: '0' },
  })),
}));

vi.mock('@/lib/modules/recetas/adapters/driving/recipe-actions', () => ({
  listRecipeVersionsAction: vi.fn(async () => ({ status: 'success', data: [] })),
  listRecipesAction: vi.fn(prohibida('listRecipesAction')),
  getRecipeAction: vi.fn(async (id: string) => ({ status: 'success', data: recetaDetalle(id) })),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/presentation-actions', () => ({
  listPresentationsAction: vi.fn(async () => ({
    status: 'success',
    data: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 },
  })),
  createPresentationAction: vi.fn(prohibida('createPresentationAction')),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/product-actions', () => ({
  listProductsAction: vi.fn(async () => ({
    status: 'success',
    data: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 },
  })),
}));

const CLIENTE: OrderCustomer = { id: '6f1c2a3b-4d5e-4f60-8a71-b2c3d4e5f601', name: 'Ana Garcia', isDeleted: false };

function renderPanel(order?: OrderSummary) {
  return render(
    <Sheet open>
      <OrderForm order={order} recipes={RECETAS} units={UNIDADES} bridge={null} onSaved={vi.fn()} />
    </Sheet>,
  );
}

function campoCliente(): HTMLElement {
  return screen.getByRole('combobox', { name: 'Cliente (opcional)' });
}

function clienteDelAlta(): unknown {
  return (createOrderActionMock.mock.calls[0]?.[0] as { customerId: unknown }).customerId;
}

function clienteDeLaEdicion(): unknown {
  return (updateOrderActionMock.mock.calls[0]?.[1] as { customerId: unknown }).customerId;
}

beforeEach(() => {
  vi.clearAllMocks();
  createOrderActionMock.mockResolvedValue({ status: 'success', id: 'nuevo', numberText: '2026-0000043' });
  updateOrderActionMock.mockResolvedValue({ status: 'success' });
  searchCustomersMock.mockResolvedValue({
    status: 'success',
    data: { items: [CLIENTE], total: 1, page: 1, pageSize: 10, totalPages: 1 },
  });
});

afterEach(() => {
  cleanup();
});

describe('el campo «Cliente» del alta', () => {
  it('R7: sin elegir cliente el alta envía customerId vacío', async () => {
    const user = setupUser();
    renderPanel();

    await anadirReceta(user);
    await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));

    await waitFor(() => expect(createOrderActionMock).toHaveBeenCalledTimes(1));
    expect(clienteDelAlta()).toBe('');
    expect(searchCustomersMock).not.toHaveBeenCalled();
  });

  it('R7: eligiendo un cliente el alta envía su id, y lo busca solo entre los vivos', async () => {
    const user = setupUser();
    renderPanel();

    await anadirReceta(user);
    await user.click(campoCliente());
    await user.click(await screen.findByText('Ana Garcia'));
    await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));

    await waitFor(() => expect(createOrderActionMock).toHaveBeenCalledTimes(1));
    expect(clienteDelAlta()).toBe(CLIENTE.id);
    expect(searchCustomersMock).toHaveBeenCalledWith(expect.anything(), 'assign');
  });
});

describe('el campo «Cliente» de la edición', () => {
  it('R7: viene precargado con el cliente actual y lo reenvía', async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas(undefined, { customer: CLIENTE }));

    expect(campoCliente()).toHaveValue('Ana Garcia');
    await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));

    await waitFor(() => expect(updateOrderActionMock).toHaveBeenCalledTimes(1));
    expect(clienteDeLaEdicion()).toBe(CLIENTE.id);
  });

  it('R7: precargado con un cliente dado de baja, muestra el sufijo y conserva su id', async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas(undefined, { customer: { ...CLIENTE, isDeleted: true } }));

    expect(campoCliente()).toHaveValue('Ana Garcia (eliminado)');
    await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));

    await waitFor(() => expect(updateOrderActionMock).toHaveBeenCalledTimes(1));
    expect(clienteDeLaEdicion()).toBe(CLIENTE.id);
  });

  it('R7: vaciar el campo envía customerId vacío', async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas(undefined, { customer: CLIENTE }));

    await user.clear(campoCliente());
    await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));

    await waitFor(() => expect(updateOrderActionMock).toHaveBeenCalledTimes(1));
    expect(clienteDeLaEdicion()).toBe('');
  });

  it('R7: sin cliente en el pedido, la edición arranca vacía y envía vacío', async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas());

    expect(campoCliente()).toHaveValue('');
    await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));

    await waitFor(() => expect(updateOrderActionMock).toHaveBeenCalledTimes(1));
    expect(clienteDeLaEdicion()).toBe('');
  });
});
