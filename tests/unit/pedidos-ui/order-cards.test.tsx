// La lista de pedidos en tarjetas. jsdom no evalua las consultas de contenedor, asi que la tabla
// y las tarjetas estan las dos en el arbol: aqui se mira la tarjeta y su menu centrado, y que los
// estados de la lista no cambian por tenerla.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACTUAL_COST_COLUMN_ID,
  ACTUAL_COST_TESTID,
  CANCEL_ORDER_ID_TESTID,
  MISSING_VALUE_MARK,
  ORDER_ACTION_CUSTOMER_TESTID,
  ORDER_CUSTOMER_DIALOG_TESTID,
  ORDER_LIST_NO_MATCHES_TESTID,
  ORDER_NO_MATCHES_MESSAGE,
  ORDER_PRIORITY_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_TABLE_TEXTS,
  OrderTable,
  PAGE_PARAM,
  PRODUCTION_COST_COLUMN_ID,
  PRODUCTION_COST_TESTID,
} from '@/app/(private)/pedidos/components';
import type { DataTableParams } from '@/components/shared/data-table';
import { formatOrderNumber, type OrderSummary } from '@/lib/modules/pedidos';
import { DEFAULT_PAGE_SIZE } from '@/lib/shared/pagination';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';
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
    throw new Error(`${nombre} no debe invocarse desde las tarjetas`);
  };
  return {
    listOrdersAction: vi.fn(noDebeInvocarse('listOrdersAction')),
    getOrderAction: vi.fn(noDebeInvocarse('getOrderAction')),
    createOrderAction: vi.fn(noDebeInvocarse('createOrderAction')),
    updateOrderAction: vi.fn(noDebeInvocarse('updateOrderAction')),
    cancelOrderAction: vi.fn(noDebeInvocarse('cancelOrderAction')),
    deleteOrderAction: vi.fn(noDebeInvocarse('deleteOrderAction')),
    // El dialogo «Cliente» busca clientes al abrirse; aqui basta con una lista vacia.
    searchOrderCustomersAction: vi.fn(async () => ({
      status: 'success' as const,
      data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 },
    })),
  };
});

vi.mock('@/lib/modules/recetas/adapters/driving/recipe-actions', () => ({
  listRecipeVersionsAction: vi.fn(async () => ({ status: 'success' as const, data: [] })),
  listRecipesAction: vi.fn(async () => ({
    status: 'success' as const,
    data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 },
  })),
  // «Editar» abre el panel, que pide los ingredientes de la receta del pedido.
  getRecipeAction: vi.fn(async () => ({ status: 'error', code: 'recipe_not_found', message: 'sin receta' })),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/presentation-actions', () => ({
  listPresentationsAction: vi.fn(async () => ({
    status: 'success' as const,
    data: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 },
  })),
  createPresentationAction: vi.fn(),
}));

function pedido(id: string, sequence: number, overrides: Partial<OrderSummary> = {}): OrderSummary {
  return {
    id,
    number: { year: 2026, sequence },
    numberText: formatOrderNumber({ year: 2026, sequence }),
    recipeId: '22222222-2222-4222-8222-222222222222',
    recipeName: `Receta ${sequence}`,
    recipeVersion: null,
    quantity: '12.5000',
    priority: 'ALTA',
    status: 'PENDIENTE',
    cancellationReason: null,
    ingredientsCost: null,
    packagingCost: null,
    actualCost: null,
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    createdBy: null,
    updatedBy: null,
    presentationLines: [],
    unitId: null,
    unitLabel: null,
    pendingDelivery: { kind: 'not_packed' },
    customer: null,
    recipeImageUrl: null,
    ...overrides,
  };
}

const CON_CLIENTE = pedido('o1', 7, {
  customer: { id: '6f1c2a3b-4d5e-4f60-8a71-b2c3d4e5f601', name: 'Ana Garcia', isDeleted: false },
});
const SIN_CLIENTE = pedido('o2', 8, { priority: 'CRITICA', status: 'EN_CURSO' });

function parametros(overrides: Partial<DataTableParams> = {}): DataTableParams {
  return { page: 1, pageSize: DEFAULT_PAGE_SIZE, sort: null, filters: {}, search: '', ...overrides };
}

function montar({
  orders = [CON_CLIENTE, SIN_CLIENTE],
  params = parametros(),
  totalPages = 1,
  noMatches,
  canEditCustomer,
}: {
  readonly orders?: readonly OrderSummary[];
  readonly params?: DataTableParams;
  readonly totalPages?: number;
  readonly noMatches?: { readonly clearHref: string };
  readonly canEditCustomer?: boolean;
} = {}) {
  render(
    <OrderTable
      orders={orders}
      params={params}
      totalPages={totalPages}
      recipes={{ items: [], totalPages: 1 }}
      units={[]}
      bridge={null}
      noMatches={noMatches}
      canEditCustomer={canEditCustomer}
    />,
  );
}

function tarjeta(order: OrderSummary): HTMLElement {
  return screen.getByTestId(`data-table-card-${order.id}`);
}

function campo(card: HTMLElement, columnId: string): HTMLElement {
  return within(card).getByTestId(`data-table-card-field-${columnId}`);
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

describe('cada pedido en su tarjeta', () => {
  it('R15: una tarjeta por pedido, en el orden en que llegan', () => {
    montar();

    const tarjetas = within(screen.getByTestId('data-table-cards')).getAllByRole('listitem');
    expect(tarjetas.map((card) => card.getAttribute('data-testid'))).toEqual([
      `data-table-card-${CON_CLIENTE.id}`,
      `data-table-card-${SIN_CLIENTE.id}`,
    ]);
  });

  it('R15: arriba el numero en monoespaciada y el estado; la receta como titulo', () => {
    montar();
    const card = tarjeta(CON_CLIENTE);

    const numero = campo(card, 'orderNumber');
    expect(numero).toHaveTextContent(CON_CLIENTE.numberText);
    expect(numero).toHaveClass('font-mono');
    expect(within(campo(card, 'status')).getByTestId('order-status')).toHaveTextContent(ORDER_STATUS_LABELS.PENDIENTE);
    expect(campo(card, 'recipeName')).toHaveTextContent('Receta 7');
    expect(campo(card, 'recipeName')).toHaveClass('font-semibold');
    expect(numero.compareDocumentPosition(campo(card, 'recipeName')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('R15: cliente y fecha de solicitud como datos secundarios, iguales que en la fila', () => {
    montar();
    const card = tarjeta(CON_CLIENTE);
    const fila = screen.getByTestId(`data-table-row-${CON_CLIENTE.id}`);

    expect(campo(card, 'customer')).toHaveTextContent('Ana Garcia');
    for (const columnId of ['customer', 'createdAt']) {
      const celda = within(fila).getByTestId(`data-table-cell-${columnId}`);
      expect(campo(card, columnId).textContent).toBe(celda.textContent);
    }
    // La cantidad salio de la lista el 2026-10-16: ni celda ni campo de tarjeta.
    expect(within(card).queryByTestId('data-table-card-field-quantity')).toBeNull();
    expect(within(fila).queryByTestId('data-table-cell-quantity')).toBeNull();
  });

  it('R15: sin cliente, la tarjeta pinta el mismo marcador de ausencia que la fila', () => {
    montar();

    expect(within(campo(tarjeta(SIN_CLIENTE), 'customer')).getByTestId('order-missing-customer')).toBeInTheDocument();
  });

  it('R15: abajo la prioridad y el boton «Acciones» de al menos 44 px', () => {
    montar();
    const card = tarjeta(SIN_CLIENTE);

    expect(within(campo(card, 'priority')).getByTestId('order-priority')).toHaveTextContent(ORDER_PRIORITY_LABELS.CRITICA);
    const acciones = within(card).getByTestId('order-row-actions');
    expect(acciones).toHaveTextContent(ORDER_TABLE_TEXTS.cardActions ?? '');
    expect(acciones).toHaveAccessibleName(`Acciones del pedido ${SIN_CLIENTE.numberText}`);
    expect(acciones).toHaveAttribute('data-order-id', SIN_CLIENTE.id);
    expect(acciones.className).toContain('min-h-11');
    expect(campo(card, 'priority').compareDocumentPosition(acciones) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('R15: los textos de la tarjeta son «Acciones» y «Cerrar»', () => {
    expect(ORDER_TABLE_TEXTS.cardActions).toBe('Acciones');
    expect(ORDER_TABLE_TEXTS.closeMenu).toBe('Cerrar');
  });

  it('R15: la tarjeta no repite columnas que no nombra (cobertura, responsables, presentacion, motivo)', () => {
    montar();
    const card = tarjeta(CON_CLIENTE);

    for (const columnId of ['coverage', 'responsibles', 'presentationName', 'cancellationReason']) {
      expect(within(card).queryByTestId(`data-table-card-field-${columnId}`)).toBeNull();
    }
  });
});

describe('«Acciones» abre el menu en un dialogo centrado', () => {
  it('R15: el dialogo se titula «Pedido <numero>» y ofrece los items del menu, de al menos 48 px', async () => {
    const user = setupUser();
    montar();

    await user.click(within(tarjeta(CON_CLIENTE)).getByTestId('order-row-actions'));

    const dialogo = await screen.findByRole('dialog', { name: `Pedido ${CON_CLIENTE.numberText}` });
    const editar = within(dialogo).getByTestId('order-action-edit');
    expect(editar).toHaveTextContent('Editar');
    expect(editar.className).toContain('min-h-12');
    expect(within(dialogo).getByTestId('order-action-cancel')).toBeInTheDocument();
    expect(within(dialogo).getByTestId('order-action-delete')).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  });

  it('R15: elegir un item del dialogo abre lo suyo para el pedido de esa tarjeta', async () => {
    const user = setupUser();
    montar();

    await user.click(within(tarjeta(SIN_CLIENTE)).getByTestId('order-row-actions'));
    const dialogo = await screen.findByRole('dialog', { name: `Pedido ${SIN_CLIENTE.numberText}` });
    await user.click(await esperarInteractiva(within(dialogo).getByTestId('order-action-cancel')));

    expect(await screen.findByTestId(CANCEL_ORDER_ID_TESTID)).toHaveValue(SIN_CLIENTE.id);
  });
});

// Al elegir un item que abre otro modal, el cierre del dialogo de «Acciones» no debe devolver el
// foco a su boton: quedaria fuera del modal nuevo. Se mira cuando el dialogo de «Acciones» ya no
// esta, que es cuando su cierre ha hecho todo lo que iba a hacer con el foco.
describe('el foco pasa al modal que abre el item elegido en la tarjeta', () => {
  async function elegirEnTarjeta(order: OrderSummary, testId: string) {
    const user = setupUser();
    const acciones = within(tarjeta(order)).getByTestId('order-row-actions');
    await user.click(acciones);
    const dialogo = await screen.findByRole('dialog', { name: `Pedido ${order.numberText}` });
    await user.click(await esperarInteractiva(within(dialogo).getByTestId(testId)));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: `Pedido ${order.numberText}` })).toBeNull());
    return acciones;
  }

  it('R15: «Editar» deja el foco dentro del panel del pedido', async () => {
    montar();

    const acciones = await elegirEnTarjeta(CON_CLIENTE, 'order-action-edit');

    const panel = await screen.findByRole('dialog');
    await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));
    expect(document.activeElement).not.toBe(acciones);
  });

  it('R15: «Cliente» deja el foco dentro del dialogo de cliente', async () => {
    montar({ canEditCustomer: true });

    const acciones = await elegirEnTarjeta(CON_CLIENTE, ORDER_ACTION_CUSTOMER_TESTID);

    const dialogo = await screen.findByTestId(ORDER_CUSTOMER_DIALOG_TESTID);
    await waitFor(() => expect(dialogo.contains(document.activeElement)).toBe(true));
    expect(document.activeElement).not.toBe(acciones);
  });
});

describe('los estados de la lista no cambian con las tarjetas', () => {
  it('R17: vacio: sin tarjetas y con el mensaje de hoy', () => {
    montar({ orders: [] });

    expect(screen.queryByTestId('data-table-cards')).toBeNull();
    expect(screen.getByTestId('data-table-empty')).toHaveTextContent(ORDER_TABLE_TEXTS.empty);
  });

  it('R17: sin coincidencias: sin tarjetas, con su mensaje y «Limpiar la busqueda»', () => {
    montar({ orders: [], params: parametros({ search: 'nada' }), noMatches: { clearHref: '/pedidos' } });

    expect(screen.queryByTestId('data-table-cards')).toBeNull();
    expect(screen.getByTestId('data-table-empty')).toHaveTextContent(ORDER_NO_MATCHES_MESSAGE);
    expect(screen.getByTestId(ORDER_LIST_NO_MATCHES_TESTID)).toBeInTheDocument();
  });

  it('R17: la paginacion es una sola, fuera de las tarjetas, y avanza como hoy', async () => {
    const user = setupUser();
    montar({ totalPages: 3 });

    expect(screen.getAllByTestId('data-table-pagination')).toHaveLength(1);
    expect(within(screen.getByTestId('data-table-cards')).queryByTestId('data-table-pagination')).toBeNull();
    expect(screen.getByTestId('data-table-page-indicator')).toHaveTextContent('Página 1 de 3');

    await user.click(screen.getByTestId('data-table-next'));

    const href = routerMock.push.mock.calls.at(-1)?.[0] ?? '';
    expect(new URLSearchParams(href.slice(href.indexOf('?') + 1)).get(PAGE_PARAM)).toBe('2');
  });
});

// La tarjeta de telefono lleva tambien los dos costes,
// con la MISMA celda que la tabla: rotulo de tarjeta delante, importe con `formatMoneyDisplay` y el
// exacto en `title` si se redondea, o el guion «Sin dato».
describe('R19: los costes en la tarjeta de telefono', () => {
  const CON_COSTES = pedido('o3', 9, { ingredientsCost: '120.0000', actualCost: '12752.5512' });

  it('R19: con valor, «Costo estimado» y «Costo real» con su importe, en ese orden, tras la fecha', () => {
    montar({ orders: [CON_COSTES] });
    const card = tarjeta(CON_COSTES);

    const estimado = campo(card, PRODUCTION_COST_COLUMN_ID);
    const real = campo(card, ACTUAL_COST_COLUMN_ID);
    expect(within(estimado).getByText('Costo estimado')).toHaveAttribute('data-card-label');
    expect(within(real).getByText('Costo real')).toHaveAttribute('data-card-label');

    const importeEstimado = within(estimado).getByTestId(PRODUCTION_COST_TESTID);
    expect(importeEstimado.textContent).toBe('$120.00');
    expect(importeEstimado).not.toHaveAttribute('title');
    const importeReal = within(real).getByTestId(ACTUAL_COST_TESTID);
    expect(importeReal.textContent).toBe('$12,752.55');
    expect(importeReal).toHaveAttribute('title', '12752.5512');

    const fecha = campo(card, 'createdAt');
    expect(fecha.compareDocumentPosition(estimado) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(estimado.compareDocumentPosition(real) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('R19: sin valor, el guion con el rotulo accesible «Sin dato», nunca 0', () => {
    montar({ orders: [SIN_CLIENTE] });
    const card = tarjeta(SIN_CLIENTE);

    for (const id of [PRODUCTION_COST_COLUMN_ID, ACTUAL_COST_COLUMN_ID]) {
      const celda = campo(card, id);
      const guion = within(celda).getByTestId(`order-missing-${id}`);
      expect(guion, id).toHaveTextContent(MISSING_VALUE_MARK);
      expect(guion, id).toHaveAccessibleName('Sin dato');
      expect(celda, id).not.toHaveTextContent('0');
    }
  });

  it('R19: el rotulo de tarjeta no cambia el texto del importe en la fila de la tabla', () => {
    montar({ orders: [CON_COSTES] });
    const fila = screen.getByTestId(`data-table-row-${CON_COSTES.id}`);

    expect(within(fila).getByTestId(ACTUAL_COST_TESTID).textContent).toBe('$12,752.55');
    expect(within(fila).getByText('Costo real')).toHaveClass('[table_&]:hidden');
  });

  // Sin `pedidos.consultar` la pantalla entera da 404 antes de pintar nada: es la misma condicion
  // que decide las columnas. La tarjeta no tiene otra: sus costes salen de esas mismas columnas.
  it('R19: sin pedidos.consultar no aparecen: la pagina corta antes de pintar la lista', () => {
    const fuente = readFileSync(join(process.cwd(), 'app/(private)/pedidos/page.tsx'), 'utf8');
    const corte = fuente.indexOf("await requirePagePermission('pedidos.consultar');");
    expect(corte).toBeGreaterThan(-1);
    expect(corte).toBeLessThan(fuente.indexOf('<OrderListSection'));

    const tabla = readFileSync(join(process.cwd(), 'app/(private)/pedidos/components/order-table.tsx'), 'utf8');
    expect(tabla).not.toMatch(/canSee\w*Cost|hasPermission|requirePermission/);
  });
});
