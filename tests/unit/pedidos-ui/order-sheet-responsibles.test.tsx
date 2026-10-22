// QC-102 T14 — La hoja de responsables: R23, R24, R26, R29.
//
// Se ejercita la fila VIVA —desde `<OrderTable>`, con la factoria de columnas por dentro—: la
// entrada «Responsables» de la fila y el `+N` de la columna abren la misma hoja, con la ficha del
// pedido en solo lectura, y «Editar» abre el formulario sin responsables.
//
// **Las actions de `asignaciones` estan mockeadas y se CUENTAN**: R26 es exactamente «abrir el
// panel no emite ninguna consulta», y eso solo se demuestra con el contador a cero.
//
// **Ninguna navegacion**: `router.push` es un doble, y que siga sin llamarse es la mitad de «ni
// ruta nueva» de R23.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_FORM_TESTID,
  ORDER_RECIPE_IMAGE_TESTID,
  ORDER_RESPONSIBLES_CLOSE_TESTID,
  ORDER_RESPONSIBLES_SHEET_LABELS,
  ORDER_RESPONSIBLES_SHEET_TESTID,
  ORDER_RESPONSIBLES_SUMMARY_TESTID,
  ORDER_RESPONSIBLES_TESTID,
  ORDER_SHEET_RESPONSIBLES_TESTID,
  ORDER_SHEET_TESTID,
  OrderTable,
  RESPONSIBLE_CANDIDATE_TESTID,
  RESPONSIBLE_CONFIRM_TESTID,
  RESPONSIBLE_GROUP_NAME_TESTID,
  RESPONSIBLE_PERSON_TESTID,
  RESPONSIBLE_REMOVE_GROUP_TESTID,
  RESPONSIBLE_REMOVE_PERSON_TESTID,
  RESPONSIBLE_SEARCH_TESTID,
  RESPONSIBLE_WORK_GROUP_TESTID,
  responsiblesOverflowLabel,
  type OrderResponsiblesCatalog,
  type RecipePickerPage,
} from '@/app/(private)/pedidos/components';
import type { DataTableParams } from '@/components/shared/data-table';
import type { OrderResponsible } from '@/lib/modules/asignaciones';
import { formatOrderNumber, type OrderStatus, type OrderSummary } from '@/lib/modules/pedidos';
import { DEFAULT_PAGE_SIZE } from '@/lib/shared/pagination';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';
import { WIDE_VIEWPORT, resetViewport, setViewportWidth } from '../../helpers/viewport';

const { routerMock, listaDeResponsables, listaEnLote } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  /** Contadores de R26: abrir el panel no debe moverlos del cero. */
  listaDeResponsables: vi.fn(async () => ({ status: 'success' as const, data: [] })),
  listaEnLote: vi.fn(async () => ({ status: 'success' as const, data: [] })),
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
  };
});

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-assignment-actions', () => {
  const noDebeInvocarse = (nombre: string) => () => {
    throw new Error(`${nombre} no debe invocarse por abrir el panel`);
  };
  return {
    listOrderResponsiblesAction: listaDeResponsables,
    listResponsiblesForOrdersAction: listaEnLote,
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
const TURNO = 'aaaaaaaa-0000-4000-8000-00000000aaaa';
const TURNO_NOMBRE = 'Turno de la mañana';

/** Cinco: tres caben en la fila y dos sobran, asi que el `+N` existe (R17). */
const RESPONSABLES: readonly OrderResponsible[] = [
  { userId: 'u-0', displayName: 'Ana Torres', origin: { kind: 'direct' } },
  {
    userId: 'u-1',
    displayName: 'Bruno Diaz',
    origin: { kind: 'workGroup', workGroupId: TURNO, workGroupName: TURNO_NOMBRE },
  },
  { userId: 'u-2', displayName: 'Carla Ruiz', origin: { kind: 'direct' } },
  { userId: 'u-3', displayName: 'Diego Sanz', origin: { kind: 'direct' } },
  { userId: 'u-4', displayName: 'Elena Mora', origin: { kind: 'direct' } },
];

const CATALOGO_CON_ESCRITURA: OrderResponsiblesCatalog = {
  canWrite: true,
  people: [{ id: 'u-9', displayName: 'Mara Vidal' }],
  workGroups: [{ id: TURNO, name: TURNO_NOMBRE }],
};

const PARAMS: DataTableParams = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sort: null,
  filters: {},
  search: '',
};

function pedido(status: OrderStatus): OrderSummary {
  return {
    id: PEDIDO_ID,
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

/** La LISTA entera, con el lote ya repartido por el servidor (lo que hace `OrderListSection`). */
function montarLista(
  status: OrderStatus = 'PENDIENTE',
  catalogo: OrderResponsiblesCatalog = CATALOGO_CON_ESCRITURA,
) {
  render(
    <OrderTable
      orders={[pedido(status)]}
      params={PARAMS}
      totalPages={1}
      recipes={RECETAS}
      units={UNIDADES}
      bridge={null}
      responsiblesByOrder={{ [PEDIDO_ID]: RESPONSABLES }}
      responsiblesCatalog={catalogo}
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

async function abrirResponsablesPorLaFila(user: ReturnType<typeof setupUser>) {
  await user.click(within(screen.getByTestId(`data-table-row-${PEDIDO_ID}`)).getByTestId('order-row-actions'));
  await user.click(
    await esperarInteractiva(await screen.findByTestId('order-action-responsibles')),
  );
}

describe('«Responsables» abre su propia hoja: ficha de solo lectura y gestion de responsables (R23)', () => {
  it('la entrada de la fila abre UNA hoja de responsables, sin formulario de edicion, y no navega', async () => {
    const user = setupUser();
    montarLista();

    expect(screen.queryByTestId(ORDER_RESPONSIBLES_SHEET_TESTID)).toBeNull();

    await abrirResponsablesPorLaFila(user);

    const hojas = await screen.findAllByTestId(ORDER_RESPONSIBLES_SHEET_TESTID);
    expect(hojas).toHaveLength(1);
    const seccion = within(hojas[0]).getByTestId(ORDER_SHEET_RESPONSIBLES_TESTID);
    expect(seccion).toHaveAttribute('data-section', 'responsibles');
    expect(within(seccion).getByTestId(ORDER_RESPONSIBLES_TESTID)).toBeInTheDocument();

    expect(screen.queryByTestId(ORDER_SHEET_TESTID)).toBeNull();
    expect(screen.queryByTestId(ORDER_FORM_TESTID)).toBeNull();
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('la ficha muestra los datos del pedido como texto: ningun campo de edicion del pedido', async () => {
    const user = setupUser();
    montarLista();

    await abrirResponsablesPorLaFila(user);

    const ficha = await screen.findByTestId(ORDER_RESPONSIBLES_SUMMARY_TESTID);
    expect(ficha).toHaveTextContent(RECETA.name);
    expect(ficha).toHaveTextContent(formatOrderNumber({ year: 2026, sequence: 42 }));
    expect(ficha).toHaveTextContent('12.5');
    expect(within(ficha).getByTestId('order-status')).toHaveAttribute('data-status', 'PENDIENTE');
    expect(within(ficha).getByTestId('order-priority')).toHaveAttribute('data-priority', 'MEDIA');
    expect(within(ficha).getByText(ORDER_RESPONSIBLES_SHEET_LABELS.distribution)).toBeInTheDocument();
    expect(within(ficha).getByText(ORDER_RESPONSIBLES_SHEET_LABELS.customer)).toBeInTheDocument();
    expect(within(ficha).getByTestId(ORDER_RECIPE_IMAGE_TESTID)).toBeInTheDocument();

    expect(within(ficha).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(ficha).queryAllByRole('combobox')).toHaveLength(0);
    expect(within(ficha).queryAllByRole('spinbutton')).toHaveLength(0);
    expect(within(ficha).queryAllByRole('button')).toHaveLength(0);
    expect(ficha.querySelectorAll('input, select, textarea')).toHaveLength(0);
  });

  it('el `+N` de la columna abre ESA MISMA hoja, tambien una sola (R35, H5)', async () => {
    const user = setupUser();
    montarLista();

    await user.click(screen.getByRole('button', { name: responsiblesOverflowLabel(2) }));

    const hojas = await screen.findAllByTestId(ORDER_RESPONSIBLES_SHEET_TESTID);
    expect(hojas).toHaveLength(1);
    expect(within(hojas[0]).getByTestId(ORDER_RESPONSIBLES_SUMMARY_TESTID)).toBeInTheDocument();
    expect(screen.queryByTestId(ORDER_FORM_TESTID)).toBeNull();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('«Editar» abre el formulario SIN la seccion de responsables (R24)', async () => {
    const user = setupUser();
    montarLista();

    await user.click(within(screen.getByTestId(`data-table-row-${PEDIDO_ID}`)).getByTestId('order-row-actions'));
    await user.click(await esperarInteractiva(await screen.findByTestId('order-action-edit')));

    expect(await screen.findByTestId(ORDER_FORM_TESTID)).toBeInTheDocument();
    expect(screen.queryByTestId(ORDER_SHEET_RESPONSIBLES_TESTID)).toBeNull();
    expect(screen.queryByTestId(ORDER_RESPONSIBLES_TESTID)).toBeNull();
    expect(screen.queryByTestId(RESPONSIBLE_SEARCH_TESTID)).toBeNull();
    expect(screen.queryByTestId(ORDER_RESPONSIBLES_SUMMARY_TESTID)).toBeNull();
  });

  it('«Cerrar» cierra la hoja de responsables', async () => {
    const user = setupUser();
    montarLista();

    await abrirResponsablesPorLaFila(user);
    await user.click(await screen.findByTestId(ORDER_RESPONSIBLES_CLOSE_TESTID));

    await waitFor(() => expect(screen.queryByTestId(ORDER_RESPONSIBLES_SUMMARY_TESTID)).toBeNull());
  });
});

describe('abrir el panel NO emite ninguna consulta de responsables (R26)', () => {
  it('los contadores de las dos lecturas siguen a CERO tras abrir por la fila', async () => {
    const user = setupUser();
    montarLista();

    await user.click(within(screen.getByTestId(`data-table-row-${PEDIDO_ID}`)).getByTestId('order-row-actions'));
    await user.click(
      await esperarInteractiva(await screen.findByTestId('order-action-responsibles')),
    );
    await screen.findByTestId(ORDER_SHEET_RESPONSIBLES_TESTID);

    expect(listaDeResponsables).toHaveBeenCalledTimes(0);
    expect(listaEnLote).toHaveBeenCalledTimes(0);
  });

  it('tambien a cero abriendo por el `+N`, y lo que se pinta es lo que la fila ya trajo', async () => {
    const user = setupUser();
    montarLista();

    await user.click(screen.getByRole('button', { name: responsiblesOverflowLabel(2) }));
    const seccion = await screen.findByTestId(ORDER_SHEET_RESPONSIBLES_TESTID);

    // Los CINCO, sin limite y con el nombre del grupo congelado de la propia fila (R25, R12).
    expect(within(seccion).getAllByTestId(RESPONSIBLE_PERSON_TESTID)).toHaveLength(5);
    expect(
      within(seccion)
        .getAllByTestId(RESPONSIBLE_GROUP_NAME_TESTID)
        .map((nodo) => nodo.textContent),
    ).toContain(TURNO_NOMBRE);

    expect(listaDeResponsables).toHaveBeenCalledTimes(0);
    expect(listaEnLote).toHaveBeenCalledTimes(0);
  });
});

describe('con el pedido ENTREGADO o CANCELADO la seccion CALLA (R29)', () => {
  const CONTROLES_DE_ESCRITURA = [
    RESPONSIBLE_SEARCH_TESTID,
    RESPONSIBLE_CANDIDATE_TESTID,
    RESPONSIBLE_WORK_GROUP_TESTID,
    RESPONSIBLE_CONFIRM_TESTID,
    RESPONSIBLE_REMOVE_PERSON_TESTID,
    RESPONSIBLE_REMOVE_GROUP_TESTID,
  ] as const;

  it.each(['ENTREGADO', 'CANCELADO'] as const)(
    'con un pedido %s: ningun control de asignar ni de quitar, y NINGUNA frase que lo explique',
    async (status) => {
      const user = setupUser();
      // Con `canWrite: true` a proposito: lo que apaga los controles aqui es el ESTADO, no el
      // permiso. Si se cayera el corte por estado, este caso lo dice.
      montarLista(status);

      await user.click(within(screen.getByTestId(`data-table-row-${PEDIDO_ID}`)).getByTestId('order-row-actions'));
      await user.click(
        await esperarInteractiva(await screen.findByTestId('order-action-responsibles')),
      );
      const seccion = await screen.findByTestId(ORDER_SHEET_RESPONSIBLES_TESTID);

      for (const testId of CONTROLES_DE_ESCRITURA) {
        expect(within(seccion).queryAllByTestId(testId)).toHaveLength(0);
      }

      // Pero los responsables SI se ven: consultarlos es lo que QC-87 R13 permite en todo estado.
      expect(within(seccion).getAllByTestId(RESPONSIBLE_PERSON_TESTID)).toHaveLength(5);

      // Y la seccion no da explicaciones: ni «cerrado», ni «no se puede», ni «entregado».
      const texto = (seccion.textContent ?? '').toLocaleLowerCase();
      for (const palabra of [
        'no se puede',
        'cerrado',
        'bloquead',
        'ya no',
        'entregado',
        'cancelado',
      ]) {
        expect(texto).not.toContain(palabra);
      }
    },
  );

  it.each(['PENDIENTE', 'EN_CURSO'] as const)(
    'con un pedido %s los controles SI se montan: el corte es por estado y por nada mas',
    async (status) => {
      const user = setupUser();
      montarLista(status);

      await user.click(within(screen.getByTestId(`data-table-row-${PEDIDO_ID}`)).getByTestId('order-row-actions'));
      await user.click(
        await esperarInteractiva(await screen.findByTestId('order-action-responsibles')),
      );
      const seccion = await screen.findByTestId(ORDER_SHEET_RESPONSIBLES_TESTID);

      expect(within(seccion).getByTestId(RESPONSIBLE_SEARCH_TESTID)).toBeInTheDocument();
      expect(within(seccion).getByTestId(RESPONSIBLE_CONFIRM_TESTID)).toBeInTheDocument();
      expect(within(seccion).getAllByTestId(RESPONSIBLE_REMOVE_PERSON_TESTID)).toHaveLength(5);
      expect(within(seccion).getAllByTestId(RESPONSIBLE_REMOVE_GROUP_TESTID)).toHaveLength(1);
    },
  );
});
