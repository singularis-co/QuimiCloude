// QT-314 T16 — Las acciones del pedido entero desde una fila viva con varias recetas: «Cancelar
// pedido» nombra las recetas que se cancelan y las que se quedan, y «Eliminar» se habilita con la
// misma regla que el servidor. Las actions de pedidos son dobles que fallan si se les llama.

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CANCEL_ORDER_CANCELLED_LINES_TESTID,
  CANCEL_ORDER_DIALOG_TESTID,
  CANCEL_ORDER_KEPT_LINES_TESTID,
  DELETE_ORDER_DIALOG_TESTID,
  OrderTable,
} from '@/app/(private)/pedidos/components';
import { createDefaultParams } from '@/components/shared/data-table';
import {
  formatOrderNumber,
  isDeletableOrder,
  type OrderLineView,
  type OrderStatus,
  type OrderSummary,
} from '@/lib/modules/pedidos';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';
import { WIDE_VIEWPORT, resetViewport, setViewportWidth } from '../../helpers/viewport';
import { VISTA_SIN_LINEAS } from '../../helpers/order-view-lines';
import { lineaPedido } from '../../helpers/order-form-ui';

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
    throw new Error(`${nombre} no debe invocarse por abrir un dialogo`);
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
  getRecipeAction: vi.fn(async () => ({ status: 'error', code: 'recipe_not_found', message: 'sin receta' })),
  listRecipesAction: vi.fn(() => {
    throw new Error('listRecipesAction no debe invocarse desde este archivo');
  }),
}));

const PEDIDO_ID = '11111111-1111-4111-8111-111111111111';

function receta(n: number, status: OrderLineView['status'], recipeName: string): OrderLineView {
  return lineaPedido({ id: `50000000-0000-4000-8000-00000000000${n}`, position: n, status, recipeName });
}

function pedido(status: OrderStatus, lines: readonly OrderLineView[]): OrderSummary {
  return {
    ...VISTA_SIN_LINEAS,
    lines,
    id: PEDIDO_ID,
    number: { year: 2026, sequence: 42 },
    numberText: formatOrderNumber({ year: 2026, sequence: 42 }),
    recipeId: '22222222-2222-4222-8222-222222222222',
    recipeName: 'Esmalte azul',
    recipeVersion: null,
    quantity: '12.5000',
    priority: 'MEDIA',
    status,
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
    unitId: null,
    unitLabel: null,
    pendingDelivery: { kind: 'not_packed' },
    customer: null,
    recipeImageUrl: null,
  };
}

function montar(order: OrderSummary) {
  render(
    <OrderTable
      orders={[order]}
      params={createDefaultParams()}
      totalPages={1}
      recipes={{ items: [], totalPages: 1 }}
      units={[]}
      bridge={null}
    />,
  );
}

async function abrirMenu(user: ReturnType<typeof setupUser>) {
  await user.click(within(screen.getByTestId(`data-table-row-${PEDIDO_ID}`)).getByTestId('order-row-actions'));
}

beforeEach(() => {
  vi.clearAllMocks();
  setViewportWidth(WIDE_VIEWPORT);
});

afterEach(() => {
  cleanup();
  resetViewport();
});

describe('«Cancelar pedido» con varias recetas (R36)', () => {
  it('R36: desde la fila de un PARCIAL, el diálogo nombra las que se cancelan y las que se quedan', async () => {
    const user = setupUser();
    montar(
      pedido('PARCIAL', [
        receta(1, 'PENDIENTE', 'Desengrasante'),
        receta(2, 'TERMINADO', 'Hipoclorito 5 %'),
        receta(3, 'BLOQUEADO', 'Suavizante'),
      ]),
    );

    await abrirMenu(user);
    await user.click(await esperarInteractiva(await screen.findByTestId('order-action-cancel')));

    const dialogo = await screen.findByTestId(CANCEL_ORDER_DIALOG_TESTID);
    expect(within(dialogo).getByTestId(CANCEL_ORDER_CANCELLED_LINES_TESTID)).toHaveTextContent(
      /^Desengrasante y Suavizante$/,
    );
    expect(within(dialogo).getByTestId(CANCEL_ORDER_KEPT_LINES_TESTID)).toHaveTextContent(/^Hipoclorito 5 %$/);
  });
});

describe('«Eliminar» con varias recetas (R37)', () => {
  const casos: readonly (readonly [string, OrderStatus, readonly OrderLineView[]])[] = [
    ['PENDIENTE con dos recetas que aún no se fabricaron', 'PENDIENTE', [receta(1, 'PENDIENTE', 'A'), receta(2, 'EN_CURSO', 'B')]],
    ['PARCIAL con una receta terminada', 'PARCIAL', [receta(1, 'TERMINADO', 'A'), receta(2, 'PENDIENTE', 'B')]],
    ['PARCIAL con una receta cancelada', 'PARCIAL', [receta(1, 'CANCELADO', 'A'), receta(2, 'EN_CURSO', 'B')]],
    ['PARCIAL con una receta por empacar', 'PARCIAL', [receta(1, 'POR_EMPACAR', 'A'), receta(2, 'BLOQUEADO', 'B')]],
  ];

  it.each(casos)('R37: %s sigue `isDeletableOrder`', async (_caso, status, lines) => {
    const user = setupUser();
    const order = pedido(status, lines);
    const borrable = isDeletableOrder(order.status, order.lines);
    montar(order);

    await abrirMenu(user);
    const eliminar = await screen.findByTestId('order-action-delete');

    if (borrable) {
      expect(eliminar).not.toHaveAttribute('aria-disabled', 'true');
      await user.click(await esperarInteractiva(eliminar));
      expect(await screen.findByTestId(DELETE_ORDER_DIALOG_TESTID)).toBeInTheDocument();
    } else {
      expect(eliminar).toHaveAttribute('aria-disabled', 'true');
      await user.click(eliminar);
      expect(screen.queryByTestId(DELETE_ORDER_DIALOG_TESTID)).toBeNull();
    }
  });

  it('R37: los casos cubren las dos ramas de la regla', () => {
    const resultados = casos.map(([, status, lines]) => isDeletableOrder(status, lines));
    expect(resultados).toContain(true);
    expect(resultados).toContain(false);
  });
});
