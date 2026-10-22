// La etiqueta de cobertura DENTRO del panel que ya existe.
//
// Se ejercita la fila VIVA —desde `<OrderTable>`, con la factoria de columnas por dentro—, mismo
// criterio que `order-sheet-responsibles.test.tsx`: la hoja es el `SheetContent` que ya existe, no
// una pantalla nueva, y eso solo se demuestra montando la tabla entera.

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_RESPONSIBLES_SHEET_TESTID,
  ORDER_SHEET_COVERAGE_TESTID,
  ORDER_SHEET_TESTID,
  OrderTable,
  type RecipePickerPage,
} from '@/app/(private)/pedidos/components';
import type { DataTableParams } from '@/components/shared/data-table';
import { formatOrderNumber, type OrderSummary } from '@/lib/modules/pedidos';
import { DEFAULT_PAGE_SIZE } from '@/lib/shared/pagination';
import { ORDER_COVERAGE_TONES } from '@/lib/shared/ui/order-status';

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
    throw new Error(`${nombre} no debe invocarse por abrir un panel`);
  };
  return {
    listOrdersAction: vi.fn(noDebeInvocarse('listOrdersAction')),
    getOrderAction: vi.fn(noDebeInvocarse('getOrderAction')),
    createOrderAction: vi.fn(noDebeInvocarse('createOrderAction')),
    updateOrderAction: vi.fn(noDebeInvocarse('updateOrderAction')),
    cancelOrderAction: vi.fn(noDebeInvocarse('cancelOrderAction')),
    deleteOrderAction: vi.fn(noDebeInvocarse('deleteOrderAction')),
    listOrderCoverageAction: vi.fn(noDebeInvocarse('listOrderCoverageAction')),
  };
});

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-assignment-actions', () => {
  const noDebeInvocarse = (nombre: string) => () => {
    throw new Error(`${nombre} no debe invocarse por abrir el panel`);
  };
  return {
    listOrderResponsiblesAction: vi.fn(noDebeInvocarse('listOrderResponsiblesAction')),
    listResponsiblesForOrdersAction: vi.fn(noDebeInvocarse('listResponsiblesForOrdersAction')),
    assignResponsiblesAction: vi.fn(noDebeInvocarse('assignResponsiblesAction')),
    unassignResponsibleAction: vi.fn(noDebeInvocarse('unassignResponsibleAction')),
    removeWorkGroupFromOrderAction: vi.fn(noDebeInvocarse('removeWorkGroupFromOrderAction')),
  };
});

vi.mock('@/lib/modules/recetas/adapters/driving/recipe-actions', () => ({
  listRecipeVersionsAction: vi.fn(async () => ({ status: 'success' as const, data: [] })),
  listRecipesAction: vi.fn(() => {
    throw new Error('listRecipesAction no debe invocarse: la primera pagina llega por props');
  }),
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

const RECETA = { id: '22222222-2222-4222-8222-222222222222', name: 'Esmalte azul', imageUrl: null };
const RECETAS: RecipePickerPage = { items: [RECETA], totalPages: 1 };
const UNIDADES = [
  { id: 'u-1', name: 'Litro', symbol: 'L', baseUnitId: null, factor: null, isSystem: true },
];

const PEDIDO_ID = '11111111-1111-4111-8111-111111111111';

const PARAMS: DataTableParams = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sort: null,
  filters: {},
  search: '',
};

function pedido(): OrderSummary {
  return {
    id: PEDIDO_ID,
    number: { year: 2026, sequence: 42 },
    numberText: formatOrderNumber({ year: 2026, sequence: 42 }),
    recipeId: RECETA.id,
    recipeName: RECETA.name,
    recipeVersion: null,
    quantity: '12.5000',
    priority: 'MEDIA',
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
  };
}

function montarLista(coverageByOrder: Readonly<Record<string, 'full' | 'partial' | 'none'>> = {}) {
  render(
    <OrderTable
      orders={[pedido()]}
      params={PARAMS}
      totalPages={1}
      recipes={RECETAS}
      units={UNIDADES}
      bridge={null}
      coverageByOrder={coverageByOrder}
    />,
  );
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

describe('la hoja pinta la cobertura que la fila ya trajo (R35)', () => {
  it.each(['full', 'none', 'partial'] as const)(
    'R7: editar abre el panel con la etiqueta de cobertura `%s` en su tono de StatusBadge (R35)',
    async (coverage) => {
      const user = setupUser();
      montarLista({ [PEDIDO_ID]: coverage });

      await user.click(within(screen.getByTestId(`data-table-row-${PEDIDO_ID}`)).getByTestId('order-row-actions'));
      await user.click(await esperarInteractiva(await screen.findByTestId('order-action-edit')));

      const panel = await screen.findByTestId(ORDER_SHEET_TESTID);
      const etiqueta = within(panel).getByTestId(ORDER_SHEET_COVERAGE_TESTID);
      const badge = within(etiqueta).getByTestId('order-coverage');
      expect(badge).toHaveAttribute('data-coverage', coverage);
      expect(badge).toHaveAttribute('data-slot', 'badge');
      expect(badge).toHaveAttribute('data-tone', ORDER_COVERAGE_TONES[coverage]);
    },
  );

  it('R7: sin entrada en el lote —fallo del lote— la hoja no pinta ninguna etiqueta (R20, R35)', async () => {
    const user = setupUser();
    montarLista({});

    await user.click(within(screen.getByTestId(`data-table-row-${PEDIDO_ID}`)).getByTestId('order-row-actions'));
    await user.click(await esperarInteractiva(await screen.findByTestId('order-action-edit')));

    const panel = await screen.findByTestId(ORDER_SHEET_TESTID);
    expect(within(panel).queryByTestId(ORDER_SHEET_COVERAGE_TESTID)).toBeNull();
  });

  it('«Responsables» abre su propia hoja, no la de edicion: la cobertura queda en «Editar» (R23, R35)', async () => {
    const user = setupUser();
    montarLista({ [PEDIDO_ID]: 'full' });

    await user.click(within(screen.getByTestId(`data-table-row-${PEDIDO_ID}`)).getByTestId('order-row-actions'));
    await user.click(
      await esperarInteractiva(await screen.findByTestId('order-action-responsibles')),
    );

    await screen.findByTestId(ORDER_RESPONSIBLES_SHEET_TESTID);
    expect(screen.queryByTestId(ORDER_SHEET_TESTID)).toBeNull();
    expect(screen.queryByTestId(ORDER_SHEET_COVERAGE_TESTID)).toBeNull();
  });
});
