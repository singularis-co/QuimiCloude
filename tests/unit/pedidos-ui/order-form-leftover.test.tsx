// El aviso de sobrante del formulario de pedido: con el reparto en envases dejando cantidad sin
// envasar, Guardar pregunta antes de enviar. Las actions son dobles; la del disponible devuelve
// lo que fija cada test.
//
// Controles y regiones por `data-testid`; el unico assert de texto es la cantidad con su unidad,
// que es justo lo que el aviso tiene que decir.

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BLOCKED_ORDER_CONFIRM_TESTID,
  BLOCKED_ORDER_DIALOG_TESTID,
  ORDER_CONFIRM_BLOCKED_FIELD,
  ORDER_DISTRIBUTION_AVAILABLE_TESTID,
  ORDER_FORM_SUBMIT_TESTID,
  ORDER_LEFTOVER_CONFIRM_TESTID,
  ORDER_LEFTOVER_DIALOG_TESTID,
  ORDER_LEFTOVER_DISMISS_TESTID,
  ORDER_LEFTOVER_MESSAGE_TESTID,
  OrderForm,
  leftoverOf,
  type RecipePickerPage,
} from '@/app/(private)/pedidos/components';
import { Sheet } from '@/components/ui/sheet';
import { formatOrderNumber, type OrderSummary } from '@/lib/modules/pedidos';
import type { OrderMutationFormState } from '@/lib/modules/pedidos/adapters/driving/order-actions';
import type { RecipeDetail } from '@/lib/modules/recetas';
import type { UnitView } from '@/lib/modules/unidades';
import { setupUser } from '../../helpers/user-event';

const { updateOrderActionMock, quoteAvailabilityMock, prohibida } = vi.hoisted(() => ({
  updateOrderActionMock:
    vi.fn<(id: string, prev: OrderMutationFormState, data: FormData) => Promise<OrderMutationFormState>>(),
  quoteAvailabilityMock: vi.fn<(input: unknown) => Promise<unknown>>(),
  prohibida: (nombre: string) => () => {
    throw new Error(`${nombre} no debe invocarse desde el formulario`);
  },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-assignment-actions', () => ({
  assignResponsiblesAction: vi.fn(prohibida('assignResponsiblesAction')),
  unassignResponsibleAction: vi.fn(prohibida('unassignResponsibleAction')),
  removeWorkGroupFromOrderAction: vi.fn(prohibida('removeWorkGroupFromOrderAction')),
  listOrderResponsiblesAction: vi.fn(prohibida('listOrderResponsiblesAction')),
  listResponsiblesForOrdersAction: vi.fn(prohibida('listResponsiblesForOrdersAction')),
}));

vi.mock('@/lib/modules/pedidos/adapters/driving/order-actions', () => ({
  createOrderAction: vi.fn(prohibida('createOrderAction')),
  updateOrderAction: updateOrderActionMock,
  searchOrderCustomersAction: vi.fn(prohibida('searchOrderCustomersAction')),
  setOrderCustomerAction: vi.fn(prohibida('setOrderCustomerAction')),
  cancelOrderAction: vi.fn(prohibida('cancelOrderAction')),
  deleteOrderAction: vi.fn(prohibida('deleteOrderAction')),
  listOrdersAction: vi.fn(prohibida('listOrdersAction')),
  getOrderAction: vi.fn(prohibida('getOrderAction')),
  quoteOrderCostAction: vi.fn(() => Promise.resolve({ status: 'success', data: { ingredientsCost: null } })),
  quoteOrderPresentationAvailabilityAction: quoteAvailabilityMock,
}));

const RECETA = { id: crypto.randomUUID(), name: 'Esmalte azul', imageUrl: null };
const RECETAS: RecipePickerPage = { items: [RECETA], totalPages: 1 };
const UNIDAD: UnitView = { id: crypto.randomUUID(), name: 'Litro', symbol: 'L', baseUnitId: null, factor: null, isSystem: true };

vi.mock('@/lib/modules/recetas/adapters/driving/recipe-actions', () => ({
  listRecipeVersionsAction: vi.fn(async () => ({ status: 'success', data: [] })),
  listRecipesAction: vi.fn(prohibida('listRecipesAction')),
  getRecipeAction: vi.fn(async () => ({ status: 'success', data: recetaDetalle() })),
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

function recetaDetalle(): RecipeDetail {
  return {
    id: RECETA.id,
    name: RECETA.name,
    description: null,
    imageUrl: null,
    stepCount: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdBy: null,
    updatedBy: null,
    steps: [],
    packingSteps: [],
    conditioningSteps: [],
    lines: [],
    tools: [],
    original: null,
    isUnderReview: false,
    displayName: RECETA.name,
  };
}

function pedido(): OrderSummary {
  return {
    id: crypto.randomUUID(),
    number: { year: 2026, sequence: 42 },
    numberText: formatOrderNumber({ year: 2026, sequence: 42 }),
    recipeId: RECETA.id,
    recipeName: RECETA.name,
    recipeVersion: null,
    quantity: '10.0000',
    priority: 'ALTA',
    status: 'EN_CURSO',
    cancellationReason: null,
    ingredientsCost: null,
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    createdBy: null,
    updatedBy: null,
    presentationLines: [],
    unitId: UNIDAD.id,
    unitLabel: UNIDAD.symbol,
    pendingDelivery: { kind: 'not_packed' },
    customer: null,
    recipeImageUrl: null,
  };
}

function disponible(available: string) {
  quoteAvailabilityMock.mockResolvedValue({ status: 'success', data: { kind: 'ok', available } });
}

/** Monta la edicion y espera a que el disponible este cotizado: es lo que decide el aviso. */
async function renderCotizado() {
  render(
    <Sheet open>
      <OrderForm order={pedido()} recipes={RECETAS} units={[UNIDAD]} bridge={null} onSaved={vi.fn()} />
    </Sheet>,
  );
  await waitFor(() =>
    expect(screen.getByTestId(ORDER_DISTRIBUTION_AVAILABLE_TESTID)).toHaveAttribute('data-state', 'ready'),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  updateOrderActionMock.mockResolvedValue({ status: 'success' });
  disponible('0');
});

afterEach(() => {
  cleanup();
});

describe('aviso de sobrante al guardar un pedido', () => {
  it('con sobrante, Guardar abre el aviso con la cantidad y la unidad, y no guarda', async () => {
    const user = setupUser();
    disponible('2.5000');
    await renderCotizado();

    await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));

    expect(await screen.findByTestId(ORDER_LEFTOVER_DIALOG_TESTID)).toBeInTheDocument();
    expect(screen.getByTestId(ORDER_LEFTOVER_MESSAGE_TESTID)).toHaveTextContent('2.5 L');
    expect(updateOrderActionMock).not.toHaveBeenCalled();
  });

  it('«Volver al reparto» cierra el aviso sin guardar', async () => {
    const user = setupUser();
    disponible('2.5');
    await renderCotizado();

    await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));
    await user.click(await screen.findByTestId(ORDER_LEFTOVER_DISMISS_TESTID));

    await waitFor(() => expect(screen.queryByTestId(ORDER_LEFTOVER_DIALOG_TESTID)).not.toBeInTheDocument());
    expect(updateOrderActionMock).not.toHaveBeenCalled();
  });

  it('«Guardar con sobrante» envia el formulario tal cual', async () => {
    const user = setupUser();
    disponible('2.5');
    await renderCotizado();

    await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));
    await user.click(await screen.findByTestId(ORDER_LEFTOVER_CONFIRM_TESTID));

    await waitFor(() => expect(updateOrderActionMock).toHaveBeenCalledTimes(1));
    const enviado = updateOrderActionMock.mock.calls[0]?.[2] as FormData;
    expect(enviado.get('quantity')).toBe('10');
    expect(enviado.get('unitId')).toBe(UNIDAD.id);
    expect(enviado.get(ORDER_CONFIRM_BLOCKED_FIELD)).toBeNull();
    await waitFor(() => expect(screen.queryByTestId(ORDER_LEFTOVER_DIALOG_TESTID)).not.toBeInTheDocument());
  });

  it('tras guardar con sobrante, el aviso de bloqueo sigue funcionando', async () => {
    const user = setupUser();
    disponible('2.5');
    updateOrderActionMock
      .mockResolvedValueOnce({ status: 'error', code: 'order_would_block', message: 'No alcanza el material.' })
      .mockResolvedValueOnce({ status: 'success' });
    await renderCotizado();

    await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));
    await user.click(await screen.findByTestId(ORDER_LEFTOVER_CONFIRM_TESTID));
    await user.click(await screen.findByTestId(BLOCKED_ORDER_CONFIRM_TESTID));

    await waitFor(() => expect(updateOrderActionMock).toHaveBeenCalledTimes(2));
    const confirmado = updateOrderActionMock.mock.calls[1]?.[2] as FormData;
    expect(confirmado.get(ORDER_CONFIRM_BLOCKED_FIELD)).toBe('true');
    expect(screen.queryByTestId(ORDER_LEFTOVER_DIALOG_TESTID)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId(BLOCKED_ORDER_DIALOG_TESTID)).not.toBeInTheDocument());
  });

  it('sin sobrante, Guardar guarda directo', async () => {
    const user = setupUser();
    await renderCotizado();

    await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));

    await waitFor(() => expect(updateOrderActionMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId(ORDER_LEFTOVER_DIALOG_TESTID)).not.toBeInTheDocument();
  });
});

describe('leftoverOf: cuando hay sobrante que avisar', () => {
  it('solo con un disponible cotizado mayor que cero', () => {
    const ok = (available: string) =>
      leftoverOf({ status: 'ready', data: { kind: 'ok', available } });

    expect(ok('0.0100')).toBe('0.0100');
    expect(ok('0')).toBeNull();
    expect(ok('0.0000')).toBeNull();
    expect(ok('-1')).toBeNull();
  });

  it('cotizando, sin unidad, sin cotizar o con error no avisa: se guarda como siempre', () => {
    expect(leftoverOf({ status: 'quoting' })).toBeNull();
    expect(leftoverOf({ status: 'idle' })).toBeNull();
    expect(leftoverOf({ status: 'without_unit' })).toBeNull();
    expect(
      leftoverOf({ status: 'error', error: { status: 'error', code: 'invalid_input', message: 'x' } }),
    ).toBeNull();
    expect(
      leftoverOf({ status: 'ready', data: { kind: 'exceeds_quantity', available: '-1' } }),
    ).toBeNull();
  });
});
