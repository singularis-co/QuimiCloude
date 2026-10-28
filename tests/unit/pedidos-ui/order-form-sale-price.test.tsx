// El campo «Precio de venta» del formulario de pedido: viaja en el `FormData` del alta, la edicion
// lo precarga sin ceros de relleno, y un valor que el esquema rechaza se senala en el campo sin
// llamar a la action. Las actions son dobles.

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_FORM_SUBMIT_TESTID,
  OrderForm,
  RECIPE_PICKER_TESTID,
  type RecipePickerPage,
} from '@/app/(private)/pedidos/components';
import { Sheet } from '@/components/ui/sheet';
import { formatOrderNumber, type OrderSummary } from '@/lib/modules/pedidos';
import type {
  CreateOrderFormState,
  OrderMutationFormState,
} from '@/lib/modules/pedidos/adapters/driving/order-actions';
import type { RecipeDetail } from '@/lib/modules/recetas';
import type { UnitView } from '@/lib/modules/unidades';
import { esperarInteractiva, setupUser } from '../../helpers/user-event';

const { createOrderActionMock, updateOrderActionMock, prohibida } = vi.hoisted(() => ({
  createOrderActionMock: vi.fn<(prev: CreateOrderFormState, data: FormData) => Promise<CreateOrderFormState>>(),
  updateOrderActionMock:
    vi.fn<(id: string, prev: OrderMutationFormState, data: FormData) => Promise<OrderMutationFormState>>(),
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
  createOrderAction: createOrderActionMock,
  updateOrderAction: updateOrderActionMock,
  searchOrderCustomersAction: vi.fn(prohibida('searchOrderCustomersAction')),
  setOrderCustomerAction: vi.fn(prohibida('setOrderCustomerAction')),
  cancelOrderAction: vi.fn(prohibida('cancelOrderAction')),
  deleteOrderAction: vi.fn(prohibida('deleteOrderAction')),
  listOrdersAction: vi.fn(prohibida('listOrdersAction')),
  getOrderAction: vi.fn(prohibida('getOrderAction')),
  quoteOrderCostAction: vi.fn(() => Promise.resolve({ status: 'success', data: { ingredientsCost: null } })),
  quoteOrderPresentationAvailabilityAction: vi.fn(() =>
    Promise.resolve({ status: 'success', data: { kind: 'ok', available: '0' } }),
  ),
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

function pedido(overrides: Partial<OrderSummary> = {}): OrderSummary {
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
    packagingCost: null,
    actualCost: null,
    salePrice: null,
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
    ...overrides,
  };
}

const SALE_PRICE_FIELD = 'salePrice';

function renderFormulario(order?: OrderSummary) {
  return render(
    <Sheet open>
      <OrderForm order={order} recipes={RECETAS} units={[UNIDAD]} bridge={null} onSaved={vi.fn()} />
    </Sheet>,
  );
}

function campoPrecio(): HTMLInputElement {
  return screen.getByTestId(`order-field-${SALE_PRICE_FIELD}`) as HTMLInputElement;
}

async function rellenarAlta(user: ReturnType<typeof setupUser>) {
  await user.click(screen.getByTestId(RECIPE_PICKER_TESTID));
  await user.click(await esperarInteractiva(await screen.findByTestId(`${RECIPE_PICKER_TESTID}-option`)));
  await user.click(screen.getByTestId('presentation-unit-select'));
  await user.click(await esperarInteractiva(await screen.findByTestId('presentation-unit-option')));
  await user.type(screen.getByTestId('order-field-quantity'), '10');
}

beforeEach(() => {
  vi.clearAllMocks();
  createOrderActionMock.mockResolvedValue({
    status: 'success',
    id: crypto.randomUUID(),
    numberText: formatOrderNumber({ year: 2026, sequence: 43 }),
  });
  updateOrderActionMock.mockResolvedValue({ status: 'success' });
});

afterEach(() => {
  cleanup();
});

describe('el campo «Precio de venta» del alta', () => {
  it('QC-307 R21: el alta envia salePrice en el FormData', async () => {
    const user = setupUser();
    renderFormulario();

    await rellenarAlta(user);
    await user.type(campoPrecio(), '1250.5');
    await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));

    await waitFor(() => expect(createOrderActionMock).toHaveBeenCalledTimes(1));
    const enviado = createOrderActionMock.mock.calls[0]?.[1] as FormData;
    expect(enviado.get(SALE_PRICE_FIELD)).toBe('1250.5');
  });

  it('QC-307 R21: sin precio el alta se envia igual, con salePrice vacio', async () => {
    const user = setupUser();
    renderFormulario();

    await rellenarAlta(user);
    await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));

    await waitFor(() => expect(createOrderActionMock).toHaveBeenCalledTimes(1));
    const enviado = createOrderActionMock.mock.calls[0]?.[1] as FormData;
    expect(enviado.get(SALE_PRICE_FIELD)).toBe('');
  });

  it('QC-307 R21: el campo es opcional, no `required`, y se rotula «Precio de venta (opcional)»', () => {
    renderFormulario();

    const campo = screen.getByLabelText('Precio de venta (opcional)');
    expect(campo).toBe(campoPrecio());
    expect(campo).not.toBeRequired();
    expect(campo).toHaveAttribute('type', 'number');
    expect(campo).toHaveAttribute('min', '0');
  });
});

describe('el campo «Precio de venta» de la edicion', () => {
  it("QC-307 R21: precarga '1250.5' desde '1250.5000' y lo reenvia", async () => {
    const user = setupUser();
    renderFormulario(pedido({ salePrice: '1250.5000' }));

    expect(campoPrecio().value).toBe('1250.5');
    await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));

    await waitFor(() => expect(updateOrderActionMock).toHaveBeenCalledTimes(1));
    const enviado = updateOrderActionMock.mock.calls[0]?.[2] as FormData;
    expect(enviado.get(SALE_PRICE_FIELD)).toBe('1250.5');
  });

  it('QC-307 R21: sin precio guardado el campo arranca vacio', () => {
    renderFormulario(pedido({ salePrice: null }));

    expect(campoPrecio().value).toBe('');
  });

  it("QC-307 R21: '-1' senala el campo, no llama a la action y conserva lo escrito", async () => {
    const user = setupUser();
    renderFormulario(pedido());

    await user.type(campoPrecio(), '-1');
    await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));

    const error = await screen.findByTestId(`order-error-${SALE_PRICE_FIELD}`);
    expect(error).toHaveTextContent('Ingresa un número mayor o igual a 0, con hasta 4 decimales.');
    expect(campoPrecio()).toHaveAttribute('aria-invalid', 'true');
    expect(campoPrecio().value).toBe('-1');
    expect(updateOrderActionMock).not.toHaveBeenCalled();
    expect(createOrderActionMock).not.toHaveBeenCalled();
  });
});
