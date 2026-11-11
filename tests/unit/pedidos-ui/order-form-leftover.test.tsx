// El aviso de sobrante del sub-panel de una receta: con el reparto en envases dejando cantidad sin
// envasar, «Aplicar» pregunta antes de devolver la receta al borrador.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_DISTRIBUTION_AVAILABLE_TESTID,
  ORDER_LEFTOVER_CONFIRM_TESTID,
  ORDER_LEFTOVER_DIALOG_TESTID,
  ORDER_LEFTOVER_DISMISS_TESTID,
  ORDER_LEFTOVER_MESSAGE_TESTID,
  ORDER_LINES_EDIT_TESTID,
  ORDER_LINES_ROW_TESTID,
  OrderForm,
  leftoverOf,
} from '@/app/(private)/pedidos/components';
import { Sheet } from '@/components/ui/sheet';
import {
  RECETAS,
  UNIDADES,
  aplicar,
  escribirCantidad,
  pedidoDeDosRecetas,
  recetaDetalle,
  subPanel,
} from '../../helpers/order-form-ui';
import { setupUser } from '../../helpers/user-event';

const { quoteAvailabilityMock, updateOrderActionMock, prohibida } = vi.hoisted(() => ({
  quoteAvailabilityMock: vi.fn<(input: unknown) => Promise<unknown>>(),
  updateOrderActionMock: vi.fn(),
  prohibida: (nombre: string) => () => {
    throw new Error(`${nombre} no debe invocarse desde el sub-panel`);
  },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/lib/modules/pedidos/adapters/driving/order-actions', () => ({
  createOrderAction: vi.fn(prohibida('createOrderAction')),
  updateOrderAction: updateOrderActionMock,
  searchOrderCustomersAction: vi.fn(async () => ({
    status: 'success',
    data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 },
  })),
  quoteOrderCostAction: vi.fn(async () => ({ status: 'success', data: { ingredientsCost: null } })),
  quoteOrderPresentationAvailabilityAction: quoteAvailabilityMock,
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

function disponible(available: string) {
  quoteAvailabilityMock.mockResolvedValue({ status: 'success', data: { kind: 'ok', available } });
}

/** Abre la primera receta del pedido y espera a que su disponible esté cotizado. */
async function abrirCotizado(user: ReturnType<typeof setupUser>) {
  render(
    <Sheet open>
      <OrderForm order={pedidoDeDosRecetas()} recipes={RECETAS} units={UNIDADES} bridge={null} onSaved={vi.fn()} />
    </Sheet>,
  );
  const fila = screen.getAllByTestId(ORDER_LINES_ROW_TESTID)[0] as HTMLElement;
  await user.click(within(fila).getByTestId(ORDER_LINES_EDIT_TESTID));
  await waitFor(() =>
    expect(screen.getByTestId(ORDER_DISTRIBUTION_AVAILABLE_TESTID)).toHaveAttribute('data-state', 'ready'),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  disponible('0');
});

afterEach(() => {
  cleanup();
});

describe('aviso de sobrante al aplicar una receta', () => {
  it('R4: con sobrante, «Aplicar» abre el aviso con la cantidad y la unidad, y no aplica', async () => {
    const user = setupUser();
    disponible('2.5000');
    await abrirCotizado(user);

    await aplicar(user);

    expect(await screen.findByTestId(ORDER_LEFTOVER_DIALOG_TESTID)).toBeInTheDocument();
    expect(screen.getByTestId(ORDER_LEFTOVER_MESSAGE_TESTID)).toHaveTextContent('2.5 L');
    expect(screen.getByTestId(ORDER_LEFTOVER_CONFIRM_TESTID)).toHaveTextContent('Aplicar con sobrante');
    expect(subPanel()).not.toBeNull();
  });

  it('R4: «Volver al reparto» cierra el aviso y deja el sub-panel abierto', async () => {
    const user = setupUser();
    disponible('2.5');
    await abrirCotizado(user);

    await aplicar(user);
    await user.click(await screen.findByTestId(ORDER_LEFTOVER_DISMISS_TESTID));

    await waitFor(() => expect(screen.queryByTestId(ORDER_LEFTOVER_DIALOG_TESTID)).not.toBeInTheDocument());
    expect(subPanel()).not.toBeNull();
  });

  it('R4: «Aplicar con sobrante» devuelve la receta a la tabla, sin guardar', async () => {
    const user = setupUser();
    disponible('2.5');
    await abrirCotizado(user);

    await escribirCantidad(user, '17.5');
    await waitFor(() =>
      expect(screen.getByTestId(ORDER_DISTRIBUTION_AVAILABLE_TESTID)).toHaveAttribute('data-state', 'ready'),
    );
    await aplicar(user);
    await user.click(await screen.findByTestId(ORDER_LEFTOVER_CONFIRM_TESTID));

    await waitFor(() => expect(subPanel()).toBeNull());
    expect(screen.getAllByTestId(ORDER_LINES_ROW_TESTID)[0]).toHaveTextContent('17.5 L');
    expect(updateOrderActionMock).not.toHaveBeenCalled();
  });

  it('R4: sin sobrante, «Aplicar» aplica directo', async () => {
    const user = setupUser();
    await abrirCotizado(user);

    await aplicar(user);

    await waitFor(() => expect(subPanel()).toBeNull());
    expect(screen.queryByTestId(ORDER_LEFTOVER_DIALOG_TESTID)).not.toBeInTheDocument();
  });
});

describe('leftoverOf: cuándo hay sobrante que avisar', () => {
  it('solo con un disponible cotizado mayor que cero', () => {
    const ok = (available: string) => leftoverOf({ status: 'ready', data: { kind: 'ok', available } });
    expect(ok('0.0100')).toBe('0.0100');
    expect(ok('0')).toBeNull();
    expect(ok('0.0000')).toBeNull();
    expect(ok('-1')).toBeNull();
  });

  it('cotizando, sin unidad, sin cotizar o con error no avisa', () => {
    expect(leftoverOf({ status: 'quoting' })).toBeNull();
    expect(leftoverOf({ status: 'idle' })).toBeNull();
    expect(leftoverOf({ status: 'without_unit' })).toBeNull();
    expect(
      leftoverOf({ status: 'error', error: { status: 'error', code: 'invalid_input', message: 'x' } }),
    ).toBeNull();
    expect(leftoverOf({ status: 'ready', data: { kind: 'exceeds_quantity', available: '-1' } })).toBeNull();
  });
});
