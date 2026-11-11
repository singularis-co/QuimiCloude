// El precio de venta de cada receta del pedido: se escribe en el sub-panel, viaja con su receta
// en el candidato, la edición lo precarga sin ceros de relleno y un valor que el esquema rechaza
// se señala sin aplicar (QC-307 R21, QT-314 R13).

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_FORM_SUBMIT_TESTID,
  ORDER_LINES_EDIT_TESTID,
  ORDER_LINES_ROW_TESTID,
  OrderForm,
} from '@/app/(private)/pedidos/components';
import { Sheet } from '@/components/ui/sheet';
import type { OrderSummary } from '@/lib/modules/pedidos';
import type {
  CreateOrderFormState,
  UpdateOrderFormState,
} from '@/lib/modules/pedidos/adapters/driving/order-actions';
import {
  RECETA_C,
  RECETAS,
  UNIDADES,
  abrirAnadirReceta,
  anadirReceta,
  aplicar,
  elegirReceta,
  elegirUnidad,
  escribirCantidad,
  escribirPrecio,
  lineaB,
  lineaPedido,
  pedidoDeDosRecetas,
  recetaDetalle,
  subPanel,
} from '../../helpers/order-form-ui';
import { setupUser } from '../../helpers/user-event';

const { createOrderActionMock, updateOrderActionMock, prohibida } = vi.hoisted(() => ({
  createOrderActionMock: vi.fn<(input: unknown) => Promise<CreateOrderFormState>>(),
  updateOrderActionMock: vi.fn<(id: string, input: unknown) => Promise<UpdateOrderFormState>>(),
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
  searchOrderCustomersAction: vi.fn(async () => ({
    status: 'success',
    data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 },
  })),
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

function renderPanel(order?: OrderSummary) {
  return render(
    <Sheet open>
      <OrderForm order={order} recipes={RECETAS} units={UNIDADES} bridge={null} onSaved={vi.fn()} />
    </Sheet>,
  );
}

function preciosDelAlta(): string[] {
  return (createOrderActionMock.mock.calls[0]?.[0] as { lines: { salePrice: string }[] }).lines.map(
    (line) => line.salePrice,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  createOrderActionMock.mockResolvedValue({ status: 'success', id: 'nuevo', numberText: '2026-0000043' });
  updateOrderActionMock.mockResolvedValue({ status: 'success' });
});

afterEach(() => {
  cleanup();
});

describe('el precio de venta en el alta', () => {
  it('R13: cada receta envía su precio, y sin precio se envía vacío', async () => {
    const user = setupUser();
    renderPanel();

    await anadirReceta(user, { precio: '1250.5' });
    await anadirReceta(user, { recetaId: RECETA_C.id });
    await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));

    await waitFor(() => expect(createOrderActionMock).toHaveBeenCalledTimes(1));
    expect(preciosDelAlta()).toEqual(['1250.5', '']);
  });

  it('R13: el campo es opcional, no `required`, y se rotula «Precio de venta (opcional)»', async () => {
    const user = setupUser();
    renderPanel();

    await abrirAnadirReceta(user);

    const campo = screen.getByLabelText('Precio de venta (opcional)');
    expect(campo).toBe(screen.getByTestId('order-field-salePrice'));
    expect(campo).not.toBeRequired();
  });
});

describe('el precio de venta en la edición', () => {
  it("R13: precarga '1250.5' desde '1250.5000' y lo reenvía con su receta", async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas([lineaPedido({ salePrice: '1250.5000' }), lineaB()]));

    const fila = screen.getAllByTestId(ORDER_LINES_ROW_TESTID)[0] as HTMLElement;
    await user.click(within(fila).getByTestId(ORDER_LINES_EDIT_TESTID));
    expect(await screen.findByTestId('order-field-salePrice')).toHaveValue(1250.5);
    await aplicar(user);
    await waitFor(() => expect(subPanel()).toBeNull());
    await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));

    await waitFor(() => expect(updateOrderActionMock).toHaveBeenCalledTimes(1));
    const lines = (updateOrderActionMock.mock.calls[0]?.[1] as { lines: { salePrice: string }[] }).lines;
    expect(lines.map((line) => line.salePrice)).toEqual(['1250.5', '']);
  });

  it("R13: '-1' señala el campo, no aplica la receta y conserva lo escrito", async () => {
    const user = setupUser();
    renderPanel();

    await abrirAnadirReceta(user);
    await elegirReceta(user);
    await elegirUnidad(user);
    await escribirCantidad(user, '3');
    await escribirPrecio(user, '-1');
    await aplicar(user);

    expect(await screen.findByTestId('order-error-salePrice')).toBeInTheDocument();
    expect(subPanel()).not.toBeNull();
    expect(screen.getByTestId('order-field-salePrice')).toHaveValue(-1);
    expect(screen.queryAllByTestId(ORDER_LINES_ROW_TESTID)).toHaveLength(0);
    expect(createOrderActionMock).not.toHaveBeenCalled();
  });
});
