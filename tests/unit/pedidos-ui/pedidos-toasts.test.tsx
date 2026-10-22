// Los avisos emergentes de pedidos con `sonner` simulado: cada exito lanza UN `toast.success` con
// su texto, y un error no lanza ninguno.
//
// Las Server Actions son dobles, como en los tests de cada componente: aqui solo importa lo que
// pasa con el aviso cuando la accion vuelve con exito o con error.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CANCEL_ORDER_CONFIRM_TESTID,
  CANCEL_ORDER_ERROR_TESTID,
  CANCEL_ORDER_REASON_TESTID,
  CancelOrderDialog,
  DELETE_ORDER_CONFIRM_TESTID,
  DELETE_ORDER_ERROR_TESTID,
  DeleteOrderDialog,
  ORDER_CUSTOMER_DIALOG_ERROR_TESTID,
  ORDER_CUSTOMER_DIALOG_REMOVE_TESTID,
  ORDER_DELIVERY_BATCH_PACKAGES_TESTID,
  ORDER_DELIVERY_BATCH_TESTID,
  ORDER_DELIVERY_ERROR_TESTID,
  ORDER_DELIVERY_SUBMIT_TESTID,
  ORDER_DISTRIBUTION_AVAILABLE_TESTID,
  ORDER_DISTRIBUTION_DIALOG_ERROR_TESTID,
  ORDER_DISTRIBUTION_DIALOG_SUBMIT_TESTID,
  ORDER_FORM_ERROR_TESTID,
  ORDER_FORM_SUBMIT_TESTID,
  OrderCustomerDialog,
  OrderDeliverySheet,
  OrderDistributionDialog,
  OrderResponsibles,
  OrderSheet,
  RECIPE_PICKER_TESTID,
  RESPONSIBLE_CANDIDATE_TESTID,
  RESPONSIBLE_CONFIRM_TESTID,
  RESPONSIBLE_ERROR_TESTID,
  RESPONSIBLE_REMOVE_GROUP_TESTID,
  RESPONSIBLE_REMOVE_PERSON_TESTID,
  type RecipePickerPage,
} from '@/app/(private)/pedidos/components';
import type { OrderResponsible } from '@/lib/modules/asignaciones';
import { formatOrderNumber, type OrderSummary } from '@/lib/modules/pedidos';
import type { RecipeDetail } from '@/lib/modules/recetas';
import type { UnitView } from '@/lib/modules/unidades';

import {
  DELIVERY_ERROR_STATES,
  DELIVERY_ORDER_ID,
  DELIVER_RESULTS,
  OLDER_BATCH_ID,
  deliveryView,
} from '../../fixtures/order-delivery';
import { esperarInteractiva, setupUser } from '../../helpers/user-event';

const acciones = vi.hoisted(() => ({
  toastSuccess: vi.fn<(message: unknown) => void>(),
  createOrder: vi.fn<(prev: unknown, data: FormData) => Promise<unknown>>(),
  updateOrder: vi.fn<(id: string, prev: unknown, data: FormData) => Promise<unknown>>(),
  cancelOrder: vi.fn<(prev: unknown, data: FormData) => Promise<unknown>>(),
  deleteOrder: vi.fn<(prev: unknown, data: FormData) => Promise<unknown>>(),
  setCustomer: vi.fn<(id: string, input: unknown) => Promise<unknown>>(),
  searchCustomers: vi.fn<(query: unknown, purpose: string) => Promise<unknown>>(),
  updateDistribution: vi.fn<(id: string, input: unknown) => Promise<unknown>>(),
  quoteAvailability: vi.fn<(input: unknown) => Promise<unknown>>(),
  getDelivery: vi.fn<(orderId: string) => Promise<unknown>>(),
  deliver: vi.fn<(input: unknown) => Promise<unknown>>(),
  assign: vi.fn<(prev: unknown, data: FormData) => Promise<unknown>>(),
  unassign: vi.fn<(prev: unknown, data: FormData) => Promise<unknown>>(),
  removeGroup: vi.fn<(prev: unknown, data: FormData) => Promise<unknown>>(),
  getRecipe: vi.fn<(id: string) => Promise<unknown>>(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: acciones.toastSuccess,
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: () => null,
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

vi.mock('@/lib/modules/pedidos/adapters/driving/order-actions', () => {
  const noDebeInvocarse = (nombre: string) => () => {
    throw new Error(`${nombre} no debe invocarse desde los avisos`);
  };
  return {
    createOrderAction: acciones.createOrder,
    updateOrderAction: acciones.updateOrder,
    cancelOrderAction: acciones.cancelOrder,
    deleteOrderAction: acciones.deleteOrder,
    setOrderCustomerAction: acciones.setCustomer,
    searchOrderCustomersAction: acciones.searchCustomers,
    updateOrderDistributionAction: acciones.updateDistribution,
    quoteOrderPresentationAvailabilityAction: acciones.quoteAvailability,
    getOrderDeliveryAction: acciones.getDelivery,
    deliverOrderAction: acciones.deliver,
    quoteOrderCostAction: vi.fn(async () => ({ status: 'success', data: { ingredientsCost: null } })),
    getOrderCustomerFilterOptionAction: vi.fn(noDebeInvocarse('getOrderCustomerFilterOptionAction')),
    listOrdersAction: vi.fn(noDebeInvocarse('listOrdersAction')),
    getOrderAction: vi.fn(noDebeInvocarse('getOrderAction')),
  };
});

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-assignment-actions', () => ({
  assignResponsiblesAction: acciones.assign,
  unassignResponsibleAction: acciones.unassign,
  removeWorkGroupFromOrderAction: acciones.removeGroup,
  listOrderResponsiblesAction: vi.fn(() => {
    throw new Error('listOrderResponsiblesAction no debe invocarse desde los avisos');
  }),
  listResponsiblesForOrdersAction: vi.fn(() => {
    throw new Error('listResponsiblesForOrdersAction no debe invocarse desde los avisos');
  }),
}));

vi.mock('@/lib/modules/recetas/adapters/driving/recipe-actions', () => ({
  getRecipeAction: acciones.getRecipe,
  listRecipeVersionsAction: vi.fn(async () => ({ status: 'success', data: [] })),
  listRecipesAction: vi.fn(() => {
    throw new Error('listRecipesAction no debe invocarse desde los avisos');
  }),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/presentation-actions', () => ({
  listPresentationsAction: vi.fn(async () => ({
    status: 'success',
    data: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 },
  })),
  createPresentationAction: vi.fn(() => {
    throw new Error('createPresentationAction no debe invocarse desde los avisos');
  }),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/product-actions', () => ({
  listProductsAction: vi.fn(async () => ({
    status: 'success',
    data: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 },
  })),
}));

type User = ReturnType<typeof setupUser>;

const ERROR = { status: 'error', code: 'unauthorized', message: 'No tienes permiso.' } as const;

const UNIDAD: UnitView = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Litro',
  symbol: 'L',
  baseUnitId: null,
  factor: null,
  isSystem: true,
};
const ENVASE_ID = '55555555-5555-4555-8555-555555555555';
const RECETA = { id: '22222222-2222-4222-8222-222222222222', name: 'Esmalte azul', imageUrl: null };
const RECETAS: RecipePickerPage = { items: [RECETA], totalPages: 1 };

const PEDIDO_ID = '11111111-1111-4111-8111-111111111111';
const TURNO = 'aaaaaaaa-0000-4000-8000-00000000aaaa';
const ANA = '00000000-0000-4000-8000-000000000000';
const CARLA = '00000002-0000-4000-8000-000000000002';
const MARA = '0000000a-0000-4000-8000-00000000000a';

const RESPONSABLES: readonly OrderResponsible[] = [
  { userId: ANA, displayName: 'Ana Torres', origin: { kind: 'direct' } },
  {
    userId: CARLA,
    displayName: 'Carla Ruiz',
    origin: { kind: 'workGroup', workGroupId: TURNO, workGroupName: 'Turno de mañana' },
  },
];

function pedido(overrides: Partial<OrderSummary> = {}): OrderSummary {
  return {
    id: PEDIDO_ID,
    number: { year: 2026, sequence: 42 },
    numberText: formatOrderNumber({ year: 2026, sequence: 42 }),
    recipeId: RECETA.id,
    recipeName: RECETA.name,
    recipeVersion: null,
    quantity: '100.0000',
    priority: 'MEDIA',
    status: 'POR_EMPACAR',
    cancellationReason: null,
    ingredientsCost: null,
    packagingCost: null,
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    createdBy: null,
    updatedBy: null,
    presentationLines: [
      {
        presentationId: '44444444-4444-4444-8444-444444444444',
        presentationName: '20 L',
        packages: 2,
        packagingProductId: ENVASE_ID,
        packagingName: 'Bidón PET 20 L',
        presentationContent: null,
        presentationUnitLabel: null,
      },
    ],
    unitId: UNIDAD.id,
    unitLabel: UNIDAD.symbol,
    pendingDelivery: { kind: 'not_packed' },
    customer: { id: '6f1c2a3b-4d5e-4f60-8a71-b2c3d4e5f601', name: 'Ana Garcia', isDeleted: false },
    recipeImageUrl: null,
    ...overrides,
  };
}

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

function botonPorDato(testId: string, dato: string, valor: string): HTMLElement {
  const boton = screen.getAllByTestId(testId).find((el) => el.dataset[dato] === valor);
  if (boton === undefined) throw new Error(`no hay ${testId} con ${dato}=${valor}`);
  return boton;
}

function montarResponsables() {
  render(
    <OrderResponsibles
      orderId={PEDIDO_ID}
      responsibles={RESPONSABLES}
      canWrite
      people={[{ id: MARA, displayName: 'Mara Vidal' }]}
      workGroups={[]}
    />,
  );
}

async function asignar(user: User) {
  montarResponsables();
  await user.click(botonPorDato(RESPONSIBLE_CANDIDATE_TESTID, 'userId', MARA));
  await user.click(screen.getByTestId(RESPONSIBLE_CONFIRM_TESTID));
}

async function entregar(user: User) {
  render(
    <OrderDeliverySheet
      order={{ id: DELIVERY_ORDER_ID, numberText: '2026-0000007' }}
      open
      onOpenChange={vi.fn()}
    />,
  );
  const filas = await screen.findAllByTestId(ORDER_DELIVERY_BATCH_TESTID);
  const fila = filas.find((row) => row.getAttribute('data-batch-id') === OLDER_BATCH_ID);
  if (fila === undefined) throw new Error('no hay fila para el lote');
  await user.type(within(fila).getByTestId(ORDER_DELIVERY_BATCH_PACKAGES_TESTID), '2');
  await user.click(screen.getByTestId(ORDER_DELIVERY_SUBMIT_TESTID));
}

type Caso = {
  readonly nombre: string;
  readonly texto: string;
  /** Deja la accion del caso respondiendo con exito (`true`) o con error (`false`). */
  readonly preparar: (exito: boolean) => void;
  readonly actuar: (user: User) => Promise<void>;
  /** La region donde se pinta el error del caso: el aviso no debe salir aunque tarde. */
  readonly errorTestId: string;
};

const CASOS: readonly Caso[] = [
  {
    nombre: 'alta del pedido',
    texto: 'Pedido creado.',
    preparar: (exito) =>
      acciones.createOrder.mockResolvedValue(
        exito
          ? { status: 'success', id: crypto.randomUUID(), numberText: formatOrderNumber({ year: 2026, sequence: 43 }) }
          : ERROR,
      ),
    actuar: async (user) => {
      render(<OrderSheet recipes={RECETAS} units={[UNIDAD]} bridge={null} open onOpenChange={vi.fn()} />);
      await user.click(screen.getByTestId(RECIPE_PICKER_TESTID));
      await user.click(await esperarInteractiva(await screen.findByTestId(`${RECIPE_PICKER_TESTID}-option`)));
      await user.click(screen.getByTestId('presentation-unit-select'));
      await user.click(await esperarInteractiva(await screen.findByTestId('presentation-unit-option')));
      await user.type(screen.getByTestId('order-field-quantity'), '10');
      await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));
    },
    errorTestId: ORDER_FORM_ERROR_TESTID,
  },
  {
    nombre: 'edicion del pedido',
    texto: 'Pedido actualizado.',
    preparar: (exito) => acciones.updateOrder.mockResolvedValue(exito ? { status: 'success' } : ERROR),
    actuar: async (user) => {
      render(
        <OrderSheet
          order={pedido({ status: 'EN_CURSO', presentationLines: [] })}
          recipes={RECETAS}
          units={[UNIDAD]}
          bridge={null}
          open
          onOpenChange={vi.fn()}
        />,
      );
      await user.click(screen.getByTestId(ORDER_FORM_SUBMIT_TESTID));
    },
    errorTestId: ORDER_FORM_ERROR_TESTID,
  },
  {
    nombre: 'cancelacion',
    texto: 'Pedido cancelado.',
    preparar: (exito) => acciones.cancelOrder.mockResolvedValue(exito ? { status: 'success' } : ERROR),
    actuar: async (user) => {
      render(<CancelOrderDialog order={pedido({ status: 'PENDIENTE' })} open onOpenChange={vi.fn()} />);
      await user.type(screen.getByTestId(CANCEL_ORDER_REASON_TESTID), 'El cliente anuló el encargo');
      await user.click(screen.getByTestId(CANCEL_ORDER_CONFIRM_TESTID));
    },
    errorTestId: CANCEL_ORDER_ERROR_TESTID,
  },
  {
    nombre: 'eliminacion',
    texto: 'Pedido eliminado.',
    preparar: (exito) => acciones.deleteOrder.mockResolvedValue(exito ? { status: 'success' } : ERROR),
    actuar: async (user) => {
      render(<DeleteOrderDialog order={pedido({ status: 'PENDIENTE' })} open onOpenChange={vi.fn()} />);
      await user.click(screen.getByTestId(DELETE_ORDER_CONFIRM_TESTID));
    },
    errorTestId: DELETE_ORDER_ERROR_TESTID,
  },
  {
    nombre: 'cambio de cliente',
    texto: 'Cliente actualizado.',
    preparar: (exito) => acciones.setCustomer.mockResolvedValue(exito ? { status: 'success' } : ERROR),
    actuar: async (user) => {
      render(<OrderCustomerDialog order={pedido({ status: 'ENTREGADO' })} open onOpenChange={vi.fn()} />);
      await user.click(screen.getByTestId(ORDER_CUSTOMER_DIALOG_REMOVE_TESTID));
    },
    errorTestId: ORDER_CUSTOMER_DIALOG_ERROR_TESTID,
  },
  {
    nombre: 'cambio de reparto y unidad',
    texto: 'Reparto actualizado.',
    preparar: (exito) =>
      acciones.updateDistribution.mockResolvedValue(exito ? { status: 'success' } : ERROR),
    actuar: async (user) => {
      render(
        <OrderDistributionDialog order={pedido()} units={[UNIDAD]} open onOpenChange={vi.fn()} />,
      );
      await waitFor(() =>
        expect(screen.getByTestId(ORDER_DISTRIBUTION_AVAILABLE_TESTID)).toHaveTextContent('60 L'),
      );
      await user.click(screen.getByTestId(ORDER_DISTRIBUTION_DIALOG_SUBMIT_TESTID));
    },
    errorTestId: ORDER_DISTRIBUTION_DIALOG_ERROR_TESTID,
  },
  {
    nombre: 'entrega que completa el pedido',
    texto: 'Pedido entregado',
    preparar: (exito) =>
      acciones.deliver.mockResolvedValue(
        exito ? { status: 'success', data: DELIVER_RESULTS.completed } : DELIVERY_ERROR_STATES.customerNotFound,
      ),
    actuar: entregar,
    errorTestId: ORDER_DELIVERY_ERROR_TESTID,
  },
  {
    nombre: 'entrega parcial',
    texto: 'Entrega registrada',
    preparar: (exito) =>
      acciones.deliver.mockResolvedValue(
        exito ? { status: 'success', data: DELIVER_RESULTS.partial } : DELIVERY_ERROR_STATES.customerNotFound,
      ),
    actuar: entregar,
    errorTestId: ORDER_DELIVERY_ERROR_TESTID,
  },
  {
    nombre: 'asignar a una persona',
    texto: 'Se añadió 1 persona al pedido.',
    preparar: (exito) => acciones.assign.mockResolvedValue(exito ? { status: 'success', added: 1 } : ERROR),
    actuar: asignar,
    errorTestId: RESPONSIBLE_ERROR_TESTID,
  },
  {
    nombre: 'asignar a varias personas',
    texto: 'Se añadieron 3 personas al pedido.',
    preparar: (exito) => acciones.assign.mockResolvedValue(exito ? { status: 'success', added: 3 } : ERROR),
    actuar: asignar,
    errorTestId: RESPONSIBLE_ERROR_TESTID,
  },
  {
    nombre: 'retirar a un responsable',
    texto: 'Responsable retirado del pedido.',
    preparar: (exito) => acciones.unassign.mockResolvedValue(exito ? { status: 'success' } : ERROR),
    actuar: async (user) => {
      montarResponsables();
      await user.click(botonPorDato(RESPONSIBLE_REMOVE_PERSON_TESTID, 'userId', ANA));
    },
    errorTestId: RESPONSIBLE_ERROR_TESTID,
  },
  {
    nombre: 'retirar un grupo de una persona',
    texto: 'Se retiró 1 persona con el grupo.',
    preparar: (exito) =>
      acciones.removeGroup.mockResolvedValue(exito ? { status: 'success', removed: 1 } : ERROR),
    actuar: async (user) => {
      montarResponsables();
      await user.click(screen.getByTestId(RESPONSIBLE_REMOVE_GROUP_TESTID));
    },
    errorTestId: RESPONSIBLE_ERROR_TESTID,
  },
  {
    nombre: 'retirar un grupo de varias personas',
    texto: 'Se retiraron 3 personas con el grupo.',
    preparar: (exito) =>
      acciones.removeGroup.mockResolvedValue(exito ? { status: 'success', removed: 3 } : ERROR),
    actuar: async (user) => {
      montarResponsables();
      await user.click(screen.getByTestId(RESPONSIBLE_REMOVE_GROUP_TESTID));
    },
    errorTestId: RESPONSIBLE_ERROR_TESTID,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  acciones.getRecipe.mockResolvedValue({ status: 'success', data: recetaDetalle() });
  acciones.quoteAvailability.mockResolvedValue({ status: 'success', data: { kind: 'ok', available: '60' } });
  acciones.searchCustomers.mockResolvedValue({
    status: 'success',
    data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 },
  });
  acciones.getDelivery.mockResolvedValue({ status: 'success', data: deliveryView() });
});

afterEach(() => {
  cleanup();
});

describe('cada exito de pedidos lanza un unico aviso con su texto', () => {
  it.each(CASOS.map((caso) => [caso.nombre, caso] as const))(
    'R21: %s avisa una sola vez con su texto',
    async (_nombre, caso) => {
      const user = setupUser();
      caso.preparar(true);

      await caso.actuar(user);

      await waitFor(() => expect(acciones.toastSuccess).toHaveBeenCalled());
      expect(acciones.toastSuccess.mock.calls).toEqual([[caso.texto]]);
    },
  );
});

describe('un error de pedidos no lanza ningun aviso de exito', () => {
  it.each(CASOS.map((caso) => [caso.nombre, caso] as const))(
    'R21: %s con error no avisa',
    async (_nombre, caso) => {
      const user = setupUser();
      caso.preparar(false);

      await caso.actuar(user);

      expect(await screen.findByTestId(caso.errorTestId)).toBeInTheDocument();
      expect(acciones.toastSuccess).not.toHaveBeenCalled();
    },
  );
});
