// QT-314 T14 — El aviso de error por receta del panel del pedido: nombra cada receta con su número
// en la tabla, marca su fila y, si el pedido se bloquearía, ofrece guardarlo bloqueado.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_FORM_ERROR_TESTID,
  ORDER_FORM_LINES_ERROR_ITEM_TESTID,
  ORDER_FORM_LINES_ERROR_TESTID,
  ORDER_FORM_REVIEW_LINE_TESTID,
  ORDER_FORM_SAVE_BLOCKED_TESTID,
  ORDER_FORM_SUBMIT_TESTID,
  ORDER_LINES_CARD_TESTID,
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
  LINEA_A_ID,
  LINEA_B_ID,
  RECETA_A,
  RECETA_B,
  RECETA_C,
  RECETAS,
  UNIDADES,
  anadirReceta,
  lineaB,
  lineaPedido,
  pedidoDeDosRecetas,
  recetaDetalle,
} from '../../helpers/order-form-ui';
import { setupUser } from '../../helpers/user-event';

const { createOrderActionMock, updateOrderActionMock, prohibida } = vi.hoisted(() => ({
  createOrderActionMock: vi.fn<(input: unknown) => Promise<CreateOrderFormState>>(),
  updateOrderActionMock: vi.fn<(id: string, input: unknown) => Promise<UpdateOrderFormState>>(),
  prohibida: (nombre: string) => () => {
    throw new Error(`${nombre} no debe invocarse desde el panel del pedido`);
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
  cancelOrderAction: vi.fn(prohibida('cancelOrderAction')),
  deleteOrderAction: vi.fn(prohibida('deleteOrderAction')),
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

const onSaved = vi.fn();

const WOULD_BLOCK_MESSAGE = 'No hay material suficiente para este pedido.';

function bloquearia(linePositions: readonly number[]) {
  return { status: 'error', code: 'order_would_block', message: WOULD_BLOCK_MESSAGE, linePositions } as const;
}

function renderPanel(order?: OrderSummary) {
  return render(
    <Sheet open>
      <OrderForm order={order} recipes={RECETAS} units={UNIDADES} bridge={null} onSaved={onSaved} />
    </Sheet>,
  );
}

function filas(): HTMLElement[] {
  return screen.getAllByTestId(ORDER_LINES_ROW_TESTID);
}

function avisos(): string[] {
  return screen.getAllByTestId(ORDER_FORM_LINES_ERROR_ITEM_TESTID).map((item) => item.textContent ?? '');
}

async function guardar(user: ReturnType<typeof setupUser>) {
  await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));
}

beforeEach(() => {
  vi.clearAllMocks();
  createOrderActionMock.mockResolvedValue({ status: 'success', id: 'nuevo', numberText: '2026-0000043' });
  updateOrderActionMock.mockResolvedValue({ status: 'success' });
});

afterEach(() => {
  cleanup();
});

describe('aviso de error por receta (R17)', () => {
  it('R17: en el alta, el aviso nombra la receta con su número y marca su fila', async () => {
    const user = setupUser();
    createOrderActionMock.mockResolvedValueOnce(bloquearia([1]));
    renderPanel();

    await anadirReceta(user, { recetaId: RECETA_A.id });
    await anadirReceta(user, { recetaId: RECETA_B.id });
    await guardar(user);

    const aviso = await screen.findByTestId(ORDER_FORM_LINES_ERROR_TESTID);
    expect(aviso).toHaveAttribute('role', 'alert');
    expect(avisos()).toEqual([`No alcanza el material para ${RECETA_B.name} (receta 2).`]);
    expect(filas()[0]).not.toHaveAttribute('data-marked');
    expect(filas()[1]).toHaveAttribute('data-marked', 'true');
    expect(within(filas()[1] as HTMLElement).getByText(/Con error/)).toBeInTheDocument();
    expect(screen.queryByTestId(ORDER_FORM_ERROR_TESTID)).toBeNull();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('R17: la receta N es la fila de la tabla, aunque haya canceladas que no se envían', async () => {
    const user = setupUser();
    const cancelada = lineaPedido({
      id: '50000000-0000-4000-8000-00000000000c',
      position: 0,
      recipeId: RECETA_C.id,
      originalRecipeId: RECETA_C.id,
      recipeName: RECETA_C.name,
      status: 'CANCELADO',
    });
    updateOrderActionMock.mockResolvedValueOnce(bloquearia([0, 1]));
    renderPanel(
      pedidoDeDosRecetas([cancelada, lineaPedido({ position: 1 }), lineaB({ position: 2, status: 'PENDIENTE' })], {
        status: 'PARCIAL',
      }),
    );

    await guardar(user);

    await screen.findByTestId(ORDER_FORM_LINES_ERROR_TESTID);
    expect(avisos()).toEqual([
      `No alcanza el material para ${RECETA_A.name} (receta 2).`,
      `No alcanza el material para ${RECETA_B.name} (receta 3).`,
    ]);
    expect(filas().map((fila) => fila.getAttribute('data-marked'))).toEqual([null, 'true', 'true']);
    expect(screen.getAllByTestId(ORDER_LINES_CARD_TESTID)[1]).toHaveAttribute('data-marked', 'true');
  });

  it('R17: «Guardar bloqueada» reenvía el mismo pedido confirmando que se guarde bloqueado', async () => {
    const user = setupUser();
    updateOrderActionMock.mockResolvedValueOnce(bloquearia([1]));
    renderPanel(pedidoDeDosRecetas([lineaPedido(), lineaB({ status: 'PENDIENTE' })]));

    await guardar(user);
    await user.click(await screen.findByTestId(ORDER_FORM_SAVE_BLOCKED_TESTID));

    await waitFor(() => expect(updateOrderActionMock).toHaveBeenCalledTimes(2));
    const [primero, segundo] = updateOrderActionMock.mock.calls;
    expect(segundo?.[0]).toBe(primero?.[0]);
    expect(segundo?.[1]).toEqual({ ...(primero?.[1] as object), confirmBlocked: true });
    expect((primero?.[1] as { confirmBlocked: boolean }).confirmBlocked).toBe(false);
    expect((segundo?.[1] as { lines: { id?: string }[] }).lines.map((line) => line.id)).toEqual([
      LINEA_A_ID,
      LINEA_B_ID,
    ]);
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('R17: en el alta, «Guardar bloqueada» también reenvía con confirmBlocked', async () => {
    const user = setupUser();
    createOrderActionMock.mockResolvedValueOnce(bloquearia([0]));
    renderPanel();

    await anadirReceta(user);
    await guardar(user);
    await user.click(await screen.findByTestId(ORDER_FORM_SAVE_BLOCKED_TESTID));

    await waitFor(() => expect(createOrderActionMock).toHaveBeenCalledTimes(2));
    expect(createOrderActionMock.mock.calls[1]?.[0]).toMatchObject({ confirmBlocked: true });
  });

  it('R17: «Revisar receta» cierra el aviso sin enviar nada', async () => {
    const user = setupUser();
    updateOrderActionMock.mockResolvedValueOnce(bloquearia([1]));
    renderPanel(pedidoDeDosRecetas());

    await guardar(user);
    await user.click(await screen.findByTestId(ORDER_FORM_REVIEW_LINE_TESTID));

    expect(screen.queryByTestId(ORDER_FORM_LINES_ERROR_TESTID)).toBeNull();
    expect(updateOrderActionMock).toHaveBeenCalledTimes(1);
    expect(filas()).toHaveLength(2);
  });

  it('R17: los textos y los objetivos táctiles de las dos acciones del aviso', async () => {
    const user = setupUser();
    updateOrderActionMock.mockResolvedValueOnce(bloquearia([0]));
    renderPanel(pedidoDeDosRecetas());

    await guardar(user);

    const revisar = await screen.findByTestId(ORDER_FORM_REVIEW_LINE_TESTID);
    const bloqueada = screen.getByTestId(ORDER_FORM_SAVE_BLOCKED_TESTID);
    expect(revisar).toHaveTextContent('Revisar receta');
    expect(bloqueada).toHaveTextContent('Guardar bloqueada');
    for (const boton of [revisar, bloqueada]) {
      expect(boton).toHaveClass('min-h-11', 'min-w-11');
      expect(screen.getByTestId(ORDER_FORM_LINES_ERROR_TESTID)).toContainElement(boton);
    }
  });

  it('R17: otro fallo de receta lleva el mensaje del catálogo con la receta y sin «Guardar bloqueada»', async () => {
    const user = setupUser();
    updateOrderActionMock.mockResolvedValueOnce({
      status: 'error',
      code: 'duplicate_order_recipe',
      message: 'El pedido ya tiene esa fórmula.',
      linePositions: [0, 1],
    });
    renderPanel(pedidoDeDosRecetas());

    await guardar(user);

    await screen.findByTestId(ORDER_FORM_LINES_ERROR_TESTID);
    expect(avisos()).toEqual([
      `El pedido ya tiene esa fórmula. ${RECETA_A.name} (receta 1).`,
      `El pedido ya tiene esa fórmula. ${RECETA_B.name} (receta 2).`,
    ]);
    expect(screen.queryByTestId(ORDER_FORM_SAVE_BLOCKED_TESTID)).toBeNull();
  });

  it('R17: insufficient_material de una receta en curso usa el texto de material', async () => {
    const user = setupUser();
    updateOrderActionMock.mockResolvedValueOnce({
      status: 'error',
      code: 'insufficient_material',
      message: 'No alcanza el material.',
      linePositions: [1],
    });
    renderPanel(pedidoDeDosRecetas());

    await guardar(user);

    await screen.findByTestId(ORDER_FORM_LINES_ERROR_TESTID);
    expect(avisos()).toEqual([`No alcanza el material para ${RECETA_B.name} (receta 2).`]);
    expect(screen.queryByTestId(ORDER_FORM_SAVE_BLOCKED_TESTID)).toBeNull();
  });
});

describe('animación del aviso (R46)', () => {
  it('R46: el aviso de error por receta entra con la animación de los avisos', async () => {
    const user = setupUser();
    updateOrderActionMock.mockResolvedValueOnce(bloquearia([0]));
    renderPanel(pedidoDeDosRecetas());

    await guardar(user);

    expect(await screen.findByTestId(ORDER_FORM_LINES_ERROR_TESTID)).toHaveClass(
      'animate-in',
      'fade-in',
      'duration-(--dur-slow)',
    );
  });
});
