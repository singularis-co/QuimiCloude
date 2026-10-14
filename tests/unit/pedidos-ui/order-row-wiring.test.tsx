// QC-35 T11/T12 — El CABLEADO de la fila: R23, R24, R25, R37, R38.
//
// Este archivo existe por un agujero real: mientras las columnas fueron un array estatico, la
// celda de acciones no podia recibir los catalogos del panel y los tres botones de la fila **no
// abrian nada**. Aqui se ejercita la fila VIVA -desde `<OrderTable>`, con la factoria de columnas
// por dentro- y se comprueba que cada boton abre lo suyo, y que con el pedido en estado final no
// abre ninguno.
//
// **Las seis actions son dobles que FALLAN si se les llama**: abrir un panel o un dialogo no
// invoca ninguna operacion.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { setupUser } from '../../helpers/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CANCEL_ORDER_DIALOG_TESTID,
  CANCEL_ORDER_ID_TESTID,
  DELETE_ORDER_DIALOG_TESTID,
  DELETE_ORDER_ID_TESTID,
  ORDER_FORM_CANCEL_TESTID,
  ORDER_FORM_TESTID,
  ORDER_SHEET_RESPONSIBLES_TESTID,
  OrderTable,
  type RecipePickerPage,
} from '@/app/(private)/pedidos/components';
import type { DataTableParams } from '@/components/shared/data-table';
import { formatOrderNumber, type OrderStatus, type OrderSummary } from '@/lib/modules/pedidos';
import { DEFAULT_PAGE_SIZE } from '@/lib/shared/pagination';

import { WIDE_VIEWPORT, resetViewport, setViewportWidth } from '../../helpers/viewport';

const { routerMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/pedidos/adapters/driving/order-actions', () => {
  const noDebeInvocarse = (nombre: string) => () => {
    throw new Error(`${nombre} no debe invocarse por abrir un panel o un dialogo`);
  };
  return {
    listOrdersAction: vi.fn(noDebeInvocarse('listOrdersAction')),
    getOrderAction: vi.fn(noDebeInvocarse('getOrderAction')),
    createOrderAction: vi.fn(noDebeInvocarse('createOrderAction')),
    updateOrderAction: vi.fn(noDebeInvocarse('updateOrderAction')),
    cancelOrderAction: vi.fn(noDebeInvocarse('cancelOrderAction')),
    deleteOrderAction: vi.fn(noDebeInvocarse('deleteOrderAction')),
  };
});

vi.mock('@/lib/modules/recetas/adapters/driving/recipe-actions', () => ({
  listRecipeVersionsAction: vi.fn(async () => ({ status: 'success' as const, data: [] })),
  listRecipesAction: vi.fn(() => {
    throw new Error('listRecipesAction no debe invocarse: la primera pagina llega por props');
  }),
  // El panel de edicion pide el detalle de la receta al montar (los ingredientes). Resuelve
  // vacio: abrir el panel no debe invocar una operacion, pero el fetch del detalle si ocurre.
  getRecipeAction: vi.fn(async (id: string) => ({
    status: 'success' as const,
    data: {
      id,
      name: 'Esmalte azul',
      description: null,
      imageUrl: null,
      stepCount: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdBy: null,
      updatedBy: null,
      steps: [],
      lines: [],
    },
  })),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/presentation-actions', () => ({
  listPresentationsAction: vi.fn(async () => ({
    status: 'success' as const,
    data: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 },
  })),
  createPresentationAction: vi.fn(() => {
    throw new Error('createPresentationAction no debe invocarse desde este archivo');
  }),
}));

type PropsDeDoble = {
  readonly order: { readonly id: string };
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

const { crearDoble } = vi.hoisted(() => ({
  crearDoble: async (testId: string) => {
    const { createElement } = await import('react');
    return function Doble({ order, open, onOpenChange }: PropsDeDoble) {
      return createElement(
        'div',
        { 'data-testid': testId, 'data-order-id': order.id, 'data-open': String(open) },
        createElement('button', {
          type: 'button',
          'data-testid': 'cerrar-doble',
          onClick: () => onOpenChange(false),
        }),
      );
    };
  },
}));

vi.mock('@/app/(private)/pedidos/components/order-customer-dialog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/(private)/pedidos/components/order-customer-dialog')>()),
  OrderCustomerDialog: await crearDoble('doble-cliente'),
}));

vi.mock('@/app/(private)/pedidos/components/order-distribution-dialog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/(private)/pedidos/components/order-distribution-dialog')>()),
  OrderDistributionDialog: await crearDoble('doble-reparto'),
}));

vi.mock('@/app/(private)/pedidos/components/order-delivery-sheet', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/(private)/pedidos/components/order-delivery-sheet')>()),
  OrderDeliverySheet: await crearDoble('doble-entregar'),
}));

vi.mock('@/app/(private)/pedidos/components/order-deliveries-sheet', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/(private)/pedidos/components/order-deliveries-sheet')>()),
  OrderDeliveriesSheet: await crearDoble('doble-entregas'),
}));

const RECETA = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Esmalte azul',
  imageUrl: null,
};
const RECETAS: RecipePickerPage = { items: [RECETA], totalPages: 1 };

const UNIDADES = [
  { id: 'u-1', name: 'Litro', symbol: 'L', baseUnitId: null, factor: null, isSystem: true },
];

function pedido(status: OrderStatus): OrderSummary {
  return {
    id: 'o1',
    number: { year: 2026, sequence: 42 },
    numberText: formatOrderNumber({ year: 2026, sequence: 42 }),
    recipeId: RECETA.id,
    recipeName: RECETA.name,
    recipeVersion: null,
    quantity: '12.5000',
    priority: 'MEDIA',
    status,
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

const PARAMS: DataTableParams = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sort: null,
  filters: {},
  search: '',
};

/** Monta la LISTA entera: la celda de acciones es la que la factoria de columnas construye. */
function montarLista(status: OrderStatus = 'PENDIENTE') {
  render(
    <OrderTable
      orders={[pedido(status)]}
      params={PARAMS}
      totalPages={1}
      recipes={RECETAS}
      units={UNIDADES}
      bridge={null}
    />,
  );
}

/**
 * Las cuatro acciones viven detras del menu "de los 3 puntos" (ver el comentario de cabecera de
 * `order-row-actions.tsx`): se abre el disparador antes de buscar cualquier accion por testid.
 */
function abrirMenu(): void {
  fireEvent.click(screen.getByTestId('order-row-actions'));
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  setViewportWidth(WIDE_VIEWPORT);
});

afterEach(() => {
  cleanup();
  resetViewport();
});

describe('desde una fila viva, cada accion abre lo suyo (R23, R25, R37, R38)', () => {
  it('la fila trae el disparador y, cerrada, no monta ningun panel ni dialogo', () => {
    montarLista();

    expect(screen.getByTestId('order-row-actions')).toBeInTheDocument();
    abrirMenu();
    expect(screen.getByTestId('order-action-edit')).toBeEnabled();
    expect(screen.getByTestId('order-action-cancel')).toBeEnabled();
    expect(screen.getByTestId('order-action-delete')).toBeEnabled();

    expect(screen.queryByTestId(ORDER_FORM_TESTID)).toBeNull();
    expect(screen.queryByTestId(CANCEL_ORDER_DIALOG_TESTID)).toBeNull();
    expect(screen.queryByTestId(DELETE_ORDER_DIALOG_TESTID)).toBeNull();
  });

  it('pulsar editar abre el panel lateral con el pedido precargado', async () => {
    const user = setupUser();
    montarLista();

    abrirMenu();
    await user.click(await screen.findByTestId('order-action-edit'));

    expect(await screen.findByTestId(ORDER_FORM_TESTID)).toBeInTheDocument();
    expect(screen.queryByTestId(CANCEL_ORDER_DIALOG_TESTID)).toBeNull();
    expect(screen.queryByTestId(DELETE_ORDER_DIALOG_TESTID)).toBeNull();
  });

  it('pulsar cancelar abre el dialogo de motivo, y solo ese', async () => {
    const user = setupUser();
    montarLista();

    abrirMenu();
    await user.click(await screen.findByTestId('order-action-cancel'));

    expect(await screen.findByTestId(CANCEL_ORDER_DIALOG_TESTID)).toBeInTheDocument();
    expect(screen.queryByTestId(ORDER_FORM_TESTID)).toBeNull();
    expect(screen.queryByTestId(DELETE_ORDER_DIALOG_TESTID)).toBeNull();
  });

  it('pulsar borrar abre la confirmacion, y solo esa', async () => {
    const user = setupUser();
    montarLista();

    abrirMenu();
    await user.click(await screen.findByTestId('order-action-delete'));

    expect(await screen.findByTestId(DELETE_ORDER_DIALOG_TESTID)).toBeInTheDocument();
    expect(screen.queryByTestId(ORDER_FORM_TESTID)).toBeNull();
    expect(screen.queryByTestId(CANCEL_ORDER_DIALOG_TESTID)).toBeNull();
  });
});

describe('con el pedido en estado final ninguna de las tres abre nada (R24)', () => {
  for (const status of ['ENTREGADO', 'CANCELADO'] as const) {
    it(`estado ${status}: los tres items deshabilitados y ningun panel ni dialogo montado`, () => {
      montarLista(status);

      abrirMenu();
      for (const testId of ['order-action-edit', 'order-action-cancel', 'order-action-delete']) {
        const item = screen.getByTestId(testId);
        expect(item).toHaveAttribute('aria-disabled', 'true');
        // El primitivo deja el item en el arbol pero bloquea su `onSelect`: el evento nativo se
        // dispara a mano, sin pasar por la comprobacion de `pointer-events` de `user-event`.
        fireEvent.click(item);
      }

      expect(screen.queryByTestId(ORDER_FORM_TESTID)).toBeNull();
      expect(screen.queryByTestId(CANCEL_ORDER_DIALOG_TESTID)).toBeNull();
      expect(screen.queryByTestId(DELETE_ORDER_DIALOG_TESTID)).toBeNull();
    });
  }
});

// ---------------------------------------------------------------------------------------------
// Un anfitrion por tabla (R13): el menu de cada fila emite y la tabla monta UN panel o dialogo,
// el del pedido elegido. Cliente, Reparto y unidad, Entregar y Entregas se sustituyen por
// dobles que muestran para que pedido y si estan abiertos: aqui se prueba el cableado, no su
// contenido (cada uno tiene su archivo).
// ---------------------------------------------------------------------------------------------

const PEDIDO_A: OrderSummary = { ...pedido('PENDIENTE'), id: 'o1' };
const PEDIDO_B: OrderSummary = {
  ...pedido('PENDIENTE'),
  id: 'o2',
  number: { year: 2026, sequence: 43 },
  numberText: formatOrderNumber({ year: 2026, sequence: 43 }),
  quantity: '30.0000',
};

function montarDos(orders: readonly OrderSummary[] = [PEDIDO_A, PEDIDO_B]) {
  render(
    <OrderTable
      orders={orders}
      params={PARAMS}
      totalPages={1}
      recipes={RECETAS}
      units={UNIDADES}
      bridge={null}
      canEditCustomer
      canEditDistribution
      canDeliver
    />,
  );
}

async function elegir(user: ReturnType<typeof setupUser>, order: OrderSummary, testId: string) {
  const fila = screen.getByTestId(`data-table-row-${order.id}`);
  await user.click(within(fila).getByTestId('order-row-actions'));
  await user.click(await screen.findByTestId(testId));
}

function doblesMontados(): HTMLElement[] {
  return screen.queryAllByTestId(/^doble-/);
}

describe('R13: un solo anfitrion por tabla abre lo de cada item para su pedido', () => {
  it('R13: «Editar» abre el panel del pedido elegido, en el formulario', async () => {
    const user = setupUser();
    montarDos();

    await elegir(user, PEDIDO_B, 'order-action-edit');

    await screen.findByTestId(ORDER_FORM_TESTID);
    expect((screen.getByTestId('order-field-quantity') as HTMLInputElement).value).toBe('30');
    expect(screen.getByTestId(ORDER_SHEET_RESPONSIBLES_TESTID)).toHaveAttribute('data-section', 'form');
  });

  it('R13: «Responsables» abre el MISMO panel, en su seccion, y no un segundo', async () => {
    const user = setupUser();
    montarDos();

    await elegir(user, PEDIDO_A, 'order-action-responsibles');

    await screen.findByTestId(ORDER_FORM_TESTID);
    expect(screen.getAllByTestId(ORDER_FORM_TESTID)).toHaveLength(1);
    expect(screen.getAllByTestId(ORDER_SHEET_RESPONSIBLES_TESTID)).toHaveLength(1);
    expect(screen.getByTestId(ORDER_SHEET_RESPONSIBLES_TESTID)).toHaveAttribute(
      'data-section',
      'responsibles',
    );
    expect((screen.getByTestId('order-field-quantity') as HTMLInputElement).value).toBe('12.5');
  });

  it('R13: «Cancelar» y «Eliminar» abren su dialogo con el id del pedido elegido', async () => {
    const user = setupUser();
    montarDos();

    await elegir(user, PEDIDO_B, 'order-action-cancel');
    expect(await screen.findByTestId(CANCEL_ORDER_ID_TESTID)).toHaveValue(PEDIDO_B.id);
    expect(screen.queryByTestId(DELETE_ORDER_DIALOG_TESTID)).toBeNull();
  });

  it('R13: «Eliminar» abre la confirmacion con el id del pedido elegido', async () => {
    const user = setupUser();
    montarDos();

    await elegir(user, PEDIDO_A, 'order-action-delete');
    expect(await screen.findByTestId(DELETE_ORDER_ID_TESTID)).toHaveValue(PEDIDO_A.id);
    expect(screen.queryByTestId(CANCEL_ORDER_DIALOG_TESTID)).toBeNull();
  });

  it.each([
    ['order-action-customer', 'doble-cliente', 'PENDIENTE'],
    ['order-action-distribution', 'doble-reparto', 'POR_EMPACAR'],
    ['order-action-deliver', 'doble-entregar', 'TERMINADO'],
    ['order-action-deliveries', 'doble-entregas', 'ENTREGADO'],
  ] as const)('R13: %s abre %s para su pedido, abierto, y solo ese', async (item, doble, status) => {
    const user = setupUser();
    const a = { ...PEDIDO_A, status };
    const b = { ...PEDIDO_B, status };
    montarDos([a, b]);

    await elegir(user, b, item);

    const montado = await screen.findByTestId(doble);
    expect(montado).toHaveAttribute('data-order-id', b.id);
    expect(montado).toHaveAttribute('data-open', 'true');
    expect(doblesMontados()).toHaveLength(1);
    expect(screen.queryByTestId(ORDER_FORM_TESTID)).toBeNull();
  });
});

describe('R13: nunca dos abiertos, y el cerrado sigue montado para animar', () => {
  it('R13: al cerrar, el dialogo queda montado y cerrado, con el mismo pedido', async () => {
    const user = setupUser();
    montarDos();

    await elegir(user, PEDIDO_A, 'order-action-customer');
    await user.click(await screen.findByTestId('cerrar-doble'));

    const montado = screen.getByTestId('doble-cliente');
    expect(montado).toHaveAttribute('data-open', 'false');
    expect(montado).toHaveAttribute('data-order-id', PEDIDO_A.id);
  });

  it('R13: elegir otro item tras cerrar sustituye lo montado: nunca hay dos', async () => {
    const user = setupUser();
    montarDos([
      { ...PEDIDO_A, status: 'POR_EMPACAR' },
      { ...PEDIDO_B, status: 'POR_EMPACAR' },
    ]);

    await elegir(user, PEDIDO_A, 'order-action-customer');
    await user.click(await screen.findByTestId('cerrar-doble'));
    await elegir(user, PEDIDO_B, 'order-action-distribution');

    expect(doblesMontados().map((nodo) => nodo.getAttribute('data-testid'))).toEqual(['doble-reparto']);
    expect(screen.getByTestId('doble-reparto')).toHaveAttribute('data-order-id', PEDIDO_B.id);
    expect(screen.queryByTestId(ORDER_FORM_TESTID)).toBeNull();
    expect(screen.queryByTestId(CANCEL_ORDER_DIALOG_TESTID)).toBeNull();
    expect(screen.queryByTestId(DELETE_ORDER_DIALOG_TESTID)).toBeNull();
  });

  it('R13: tras cerrar el panel de un pedido, el dialogo de otro abre solo, sin el panel', async () => {
    const user = setupUser();
    montarDos();

    await elegir(user, PEDIDO_A, 'order-action-edit');
    await user.click(await screen.findByTestId(ORDER_FORM_CANCEL_TESTID));
    await waitFor(() => expect(screen.queryByTestId(ORDER_FORM_TESTID)).toBeNull());
    await elegir(user, PEDIDO_B, 'order-action-delete');

    expect(await screen.findByTestId(DELETE_ORDER_ID_TESTID)).toHaveValue(PEDIDO_B.id);
    expect(screen.queryByTestId(ORDER_FORM_TESTID)).toBeNull();
    expect(doblesMontados()).toHaveLength(0);
  });
});
