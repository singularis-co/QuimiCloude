// QT-314 T14 — La cotización del sub-panel, abierto desde el panel del pedido de dos recetas.
// La recotización en sí la cubren `order-cost-quote.test.tsx` y `use-order-cost-quote.test.ts`;
// aquí se comprueba el cableado: con qué receta se pide y qué llega a la tabla.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MISSING_VALUE_MARK,
  ORDER_COST_QUOTE_DEBOUNCE_MS,
  ORDER_COST_QUOTE_ERROR_TESTID,
  ORDER_COST_QUOTE_VALUE_TESTID,
  ORDER_LINES_COST_TESTID,
  ORDER_LINES_EDIT_TESTID,
  ORDER_LINES_ROW_TESTID,
  OrderForm,
} from '@/app/(private)/pedidos/components';
import { Sheet } from '@/components/ui/sheet';
import type { OrderSummary } from '@/lib/modules/pedidos';
import type { OrderCostQuoteResult } from '@/lib/modules/pedidos/adapters/driving/order-actions';
import {
  ENVASE,
  LINEA_A_ID,
  LINEA_B_ID,
  RECETA_A,
  RECETA_C,
  RECETAS,
  UNIDAD,
  UNIDADES,
  VERSION_B,
  abrirAnadirReceta,
  aplicar,
  elegirReceta,
  elegirUnidad,
  escribirCantidad,
  lineaB,
  lineaPedido,
  pedidoDeDosRecetas,
  recetaDetalle,
  subPanel,
} from '../../helpers/order-form-ui';
import { setupUser } from '../../helpers/user-event';

const { quoteOrderCostActionMock, prohibida } = vi.hoisted(() => ({
  quoteOrderCostActionMock: vi.fn<(input: unknown) => Promise<OrderCostQuoteResult>>(),
  prohibida: (nombre: string) => () => {
    throw new Error(`${nombre} no debe invocarse al cotizar`);
  },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/lib/modules/pedidos/adapters/driving/order-actions', () => ({
  createOrderAction: vi.fn(prohibida('createOrderAction')),
  updateOrderAction: vi.fn(prohibida('updateOrderAction')),
  searchOrderCustomersAction: vi.fn(async () => ({
    status: 'success',
    data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 },
  })),
  quoteOrderCostAction: quoteOrderCostActionMock,
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

async function editar(user: ReturnType<typeof setupUser>, indice: number) {
  const fila = screen.getAllByTestId(ORDER_LINES_ROW_TESTID)[indice] as HTMLElement;
  await user.click(within(fila).getByTestId(ORDER_LINES_EDIT_TESTID));
  return (await screen.findByTestId('order-line-sheet')) as HTMLElement;
}

function valorCotizado(): string | null {
  return screen.getByTestId(ORDER_COST_QUOTE_VALUE_TESTID).textContent;
}

const esperarRebote = () => new Promise((resolve) => setTimeout(resolve, ORDER_COST_QUOTE_DEBOUNCE_MS + 100));

beforeEach(() => {
  vi.clearAllMocks();
  quoteOrderCostActionMock.mockResolvedValue({ status: 'success', data: { ingredientsCost: '20.0000' } });
});

afterEach(() => {
  cleanup();
});

describe('cotización por receta (R14)', () => {
  it('R14: una receta guardada se cotiza con su propio identificador de receta', async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas());

    await editar(user, 0);
    expect(valorCotizado()).toBe('$ 40.00');
    expect(quoteOrderCostActionMock).not.toHaveBeenCalled();
    await escribirCantidad(user, '7');

    await waitFor(() =>
      expect(quoteOrderCostActionMock).toHaveBeenLastCalledWith({
        recipeId: RECETA_A.id,
        quantity: '7',
        unitId: UNIDAD.id,
        orderLineId: LINEA_A_ID,
        presentationLines: [{ packagingProductId: ENVASE, packages: 3 }],
      }),
    );
    expect(quoteOrderCostActionMock.mock.calls.flat()).not.toContainEqual(
      expect.objectContaining({ orderId: expect.anything() }),
    );
    await waitFor(() => expect(valorCotizado()).toBe('$ 20.00'));
  });

  it('R14: la segunda receta lleva su identificador y su versión, no los de la primera', async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas([lineaPedido(), lineaB({ status: 'PENDIENTE' })]));

    await editar(user, 1);
    await escribirCantidad(user, '9');

    await waitFor(() =>
      expect(quoteOrderCostActionMock).toHaveBeenLastCalledWith({
        recipeId: VERSION_B,
        quantity: '9',
        unitId: UNIDAD.id,
        orderLineId: LINEA_B_ID,
      }),
    );
  });

  it('R14: una receta nueva se cotiza sin identificador', async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas());

    await abrirAnadirReceta(user);
    expect(valorCotizado()).toBe(MISSING_VALUE_MARK);
    await elegirReceta(user, RECETA_C.id);
    await elegirUnidad(user);
    await escribirCantidad(user, '4');

    await waitFor(() =>
      expect(quoteOrderCostActionMock).toHaveBeenLastCalledWith({
        recipeId: RECETA_C.id,
        quantity: '4',
        unitId: UNIDAD.id,
      }),
    );
  });

  it('R14: lo cotizado viaja con la receta aplicada y cambia el coste estimado del panel', async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas());

    await editar(user, 0);
    await escribirCantidad(user, '7');
    await waitFor(() => expect(valorCotizado()).toBe('$ 20.00'));
    await aplicar(user);
    await waitFor(() => expect(subPanel()).toBeNull());

    expect(screen.getByTestId(ORDER_LINES_COST_TESTID)).toHaveTextContent('45.00');
  });
});

describe('estimado congelado según el estado de la receta', () => {
  it('R14: una receta EN_CURSO enseña su estimado guardado y no se cotiza, aunque el pedido esté PENDIENTE', async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas());

    await editar(user, 1);
    expect(valorCotizado()).toBe('$ 25.00');
    await escribirCantidad(user, '9');
    await esperarRebote();

    expect(quoteOrderCostActionMock).not.toHaveBeenCalled();
  });

  it('R14: una receta PENDIENTE de un pedido EN_CURSO sí se cotiza', async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas(undefined, { status: 'EN_CURSO' }));

    await editar(user, 0);
    await escribirCantidad(user, '6');

    await waitFor(() => expect(quoteOrderCostActionMock).toHaveBeenCalledTimes(1));
  });
});

describe('cotización fallida', () => {
  it('pinta el error y deja aplicar la receta igual', async () => {
    const user = setupUser();
    quoteOrderCostActionMock.mockResolvedValue({
      status: 'error',
      code: 'recipe_not_found',
      message: 'La fórmula no existe.',
    });
    renderPanel(pedidoDeDosRecetas());

    await editar(user, 0);
    await escribirCantidad(user, '6');
    expect(await screen.findByTestId(ORDER_COST_QUOTE_ERROR_TESTID)).toHaveTextContent('La fórmula no existe.');
    await aplicar(user);

    await waitFor(() => expect(subPanel()).toBeNull());
    expect(screen.getAllByTestId(ORDER_LINES_ROW_TESTID)[0]).toHaveTextContent('6 L');
  });
});
