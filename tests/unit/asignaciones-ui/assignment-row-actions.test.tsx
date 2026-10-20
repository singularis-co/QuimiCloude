// El menú ⋯ de las filas de `/asignacion`: «Entrar» por vista, «Ver recorrido» solo con permiso,
// nada sin ítems, y la tarjeta con «Entrar» y «Acciones».
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ASSIGNED_ORDER_ENTER_TESTID,
  ASSIGNMENT_ROW_ACTIONS_TESTID,
  ASSIGNMENT_ROW_ENTER_TESTID,
  ASSIGNMENT_ROW_TRACE_TESTID,
  AssignedOrdersTable,
  AssignmentRowActions,
  PackingOrdersTable,
  assignmentRowActions,
  buildAssignedOrdersColumns,
  buildCompanyOrdersColumns,
  buildConditionedOrdersColumns,
  buildConditioningOrdersColumns,
  buildFinishedOrdersColumns,
  buildPackingOrdersColumns,
} from '@/app/(private)/asignacion/components';
import type { DataTableColumn } from '@/components/shared/data-table';
import type {
  AssignedOrderView,
  ConditioningOrderRow,
  FinishedOrderView,
  PackingOrderRow,
} from '@/lib/modules/asignaciones';
import {
  conditioningOrderRoute,
  executionTraceRoute,
  packingOrderRoute,
} from '@/lib/shared/routes';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';

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

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const PARAMS = { page: 1, pageSize: 10, sort: null, filters: {}, search: '' };

const ASSIGNED: AssignedOrderView = {
  id: 'order-a',
  numberText: '2026-0000010',
  recipeName: 'Jarabe simple',
  quantity: '12.500',
  priority: 'ALTA',
  status: 'PENDIENTE',
  otherResponsibles: [],
  presentationLines: [],
  unitId: null,
  unitLabel: null,
};

const FINISHED: FinishedOrderView = {
  id: 'order-f',
  numberText: '2026-0000011',
  recipeName: 'Jarabe simple',
  quantity: '12.5000',
  presentationLines: [],
  unitId: null,
  unitLabel: null,
  finishedAt: new Date('2026-09-20T15:30:00.000Z'),
  responsibles: [],
};

const PACKING: PackingOrderRow = {
  id: 'order-p',
  numberText: '2026-0000012',
  recipeName: 'Jarabe simple',
  quantity: '40',
  presentationLines: [],
  unitId: null,
  unitLabel: null,
  status: 'POR_EMPACAR',
  packedByName: null,
  packedById: null,
};

const CONDITIONING: ConditioningOrderRow = {
  id: 'order-c',
  numberText: '2026-0000013',
  recipeName: 'Jarabe simple',
  quantity: '20',
  unitId: null,
  unitLabel: null,
  presentationLines: [],
  status: 'POR_ACONDICIONAR',
  conditionedByName: null,
  conditionedById: null,
};

/** Los ítems del menú de la fila, tal como los recibe `RowActionsMenu`. */
function menuItems<T>(columns: readonly DataTableColumn<T>[], row: T) {
  const conMenu = columns.filter((column) => column.menu !== undefined);
  expect(conMenu.length).toBeLessThanOrEqual(1);
  const spec = conMenu[0]?.menu?.(row);
  return (spec?.items ?? []).map(({ key, label, href, testId }) => ({ key, label, href, testId }));
}

const ENTER = (href: string) => ({ key: 'enter', label: 'Entrar', href, testId: ASSIGNMENT_ROW_ENTER_TESTID });
const TRACE = (id: string) => ({
  key: 'trace',
  label: 'Ver recorrido',
  href: executionTraceRoute(id),
  testId: ASSIGNMENT_ROW_TRACE_TESTID,
});

describe('R19 — «Entrar» del menú lleva a la pantalla de cada vista', () => {
  it('R19: «Por empacar» entra a la pantalla de empaque', () => {
    expect(menuItems(buildPackingOrdersColumns(), PACKING)).toEqual([ENTER(packingOrderRoute('order-p'))]);
  });

  it('R19: «Por acondicionar» entra a la de acondicionamiento', () => {
    expect(menuItems(buildConditioningOrdersColumns(), CONDITIONING)).toEqual([
      ENTER(conditioningOrderRoute('order-c')),
    ]);
  });

  it('R19: «Acondicionados» y «Entregados» (la misma tabla) entran a la de acondicionamiento', () => {
    expect(menuItems(buildConditionedOrdersColumns(), FINISHED)).toEqual([
      ENTER(conditioningOrderRoute('order-f')),
    ]);
  });

  it('R19: en esas cuatro vistas el número es texto, no un enlace', () => {
    const numeros: [readonly DataTableColumn<never>[], unknown][] = [
      [buildPackingOrdersColumns() as readonly DataTableColumn<never>[], PACKING],
      [buildConditioningOrdersColumns() as readonly DataTableColumn<never>[], CONDITIONING],
      [buildConditionedOrdersColumns() as readonly DataTableColumn<never>[], FINISHED],
    ];
    for (const [columns, row] of numeros) {
      const numero = columns.find((column) => column.id === 'orderNumber');
      if (numero === undefined) throw new Error('falta la columna del número');
      const { container } = render(<>{numero.cell(row as never)}</>);
      expect(container.querySelector('a')).toBeNull();
      cleanup();
    }
    expect(screen.queryByTestId('conditioning-order-link')).toBeNull();
    expect(screen.queryByTestId('packing-order-link')).toBeNull();
  });
});

describe('R20 — «Ver recorrido» solo con `dashboard.consultar`', () => {
  it('R20: con `canViewTrace`, cada vista suma «Ver recorrido» a `/dashboard/recorrido/<id>`', () => {
    expect(menuItems(buildAssignedOrdersColumns({ canExecute: true, canViewTrace: true }), ASSIGNED)).toEqual([
      TRACE('order-a'),
    ]);
    expect(menuItems(buildFinishedOrdersColumns({ canViewTrace: true }), FINISHED)).toEqual([TRACE('order-f')]);
    expect(
      menuItems(buildCompanyOrdersColumns({ showFinishedAt: false, canViewTrace: true }), {
        ...ASSIGNED,
        responsibles: [],
        finishedAt: null,
      }),
    ).toEqual([TRACE('order-a')]);
    expect(menuItems(buildPackingOrdersColumns({ canViewTrace: true }), PACKING)).toEqual([
      ENTER(packingOrderRoute('order-p')),
      TRACE('order-p'),
    ]);
    expect(menuItems(buildConditioningOrdersColumns({ canViewTrace: true }), CONDITIONING)).toEqual([
      ENTER(conditioningOrderRoute('order-c')),
      TRACE('order-c'),
    ]);
    expect(menuItems(buildConditionedOrdersColumns({ canViewTrace: true }), FINISHED)).toEqual([
      ENTER(conditioningOrderRoute('order-f')),
      TRACE('order-f'),
    ]);
    expect(TRACE('order-a').href).toBe('/dashboard/recorrido/order-a');
  });

  it('R20: sin el permiso, las vistas sin «Entrar» en el menú no emiten la columna de acciones', () => {
    for (const columns of [
      buildAssignedOrdersColumns({ canExecute: true }),
      buildFinishedOrdersColumns(),
      buildCompanyOrdersColumns({ showFinishedAt: true }),
    ]) {
      expect(columns.some((column) => column.menu !== undefined)).toBe(false);
    }
  });

  it('R20: una fila sin ítems no pinta el menú', () => {
    const { container } = render(<AssignmentRowActions orderNumber="2026-0000010" />);

    expect(container).toBeEmptyDOMElement();
    expect(assignmentRowActions({ orderNumber: '2026-0000010' }).items).toEqual([]);
  });

  it('R20: con ítems, el disparador nombra el pedido y abre «Entrar» y «Ver recorrido» como enlaces', async () => {
    const user = setupUser();
    render(
      <AssignmentRowActions
        orderNumber="2026-0000012"
        enterHref={packingOrderRoute('order-p')}
        traceHref={executionTraceRoute('order-p')}
      />,
    );

    const disparador = screen.getByTestId(ASSIGNMENT_ROW_ACTIONS_TESTID);
    expect(disparador).toHaveAccessibleName('Acciones del pedido 2026-0000012');
    await user.click(disparador);

    const entrar = await screen.findByTestId(ASSIGNMENT_ROW_ENTER_TESTID);
    await esperarInteractiva(entrar);
    expect(entrar).toHaveTextContent('Entrar');
    expect(entrar).toHaveAttribute('href', '/asignacion/empaque/order-p');
    expect(screen.getByTestId(ASSIGNMENT_ROW_TRACE_TESTID)).toHaveAttribute(
      'href',
      '/dashboard/recorrido/order-p',
    );
  });
});

describe('R18 — en «Mis asignados» «Entrar» es la única acción visible', () => {
  it('R18: el menú no repite «Entrar»; «Entrar» sigue en su columna con la conducta de hoy', () => {
    const columns = buildAssignedOrdersColumns({ canExecute: true, canViewTrace: true });
    expect(menuItems(columns, ASSIGNED).map((item) => item.key)).toEqual(['trace']);

    const entrar = columns.find((column) => column.id === 'enter');
    if (entrar === undefined) throw new Error('falta la columna «Entrar»');
    render(<>{entrar.cell({ ...ASSIGNED, status: 'EN_CURSO' })}</>);
    expect(screen.getByTestId(ASSIGNED_ORDER_ENTER_TESTID)).toHaveAttribute('href', '/asignacion/order-a');
  });

  it('R18: pendiente, «Entrar» es un enlace directo: se comienza dentro de la pantalla', () => {
    const entrar = buildAssignedOrdersColumns({ canExecute: true }).find((column) => column.id === 'enter');
    if (entrar === undefined) throw new Error('falta la columna «Entrar»');
    render(<>{entrar.cell(ASSIGNED)}</>);

    const trigger = screen.getByTestId(ASSIGNED_ORDER_ENTER_TESTID);
    expect(trigger.tagName).toBe('A');
    expect(trigger).toHaveAttribute('href', '/asignacion/order-a');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('R21 — con 760 px o menos, cada fila es una tarjeta', () => {
  it('R21: «Mis asignados» pinta número, estado, receta, datos y «Entrar» en el pie de 44 px', () => {
    render(
      <AssignedOrdersTable
        rows={[{ ...ASSIGNED, status: 'EN_CURSO' }]}
        params={PARAMS}
        totalPages={1}
        vista="asignados"
        canExecute
        canViewTrace
      />,
    );

    const tarjeta = screen.getByTestId('data-table-card-order-a');
    const campo = (id: string) => within(tarjeta).getByTestId(`data-table-card-field-${id}`);
    expect(campo('orderNumber')).toHaveTextContent('2026-0000010');
    expect(within(campo('status')).getByTestId('assigned-order-status')).toHaveTextContent('En fabricación');
    expect(campo('recipeName')).toHaveTextContent('Jarabe simple');
    expect(campo('quantity')).toHaveTextContent('12.500');
    expect(within(campo('priority')).getByTestId('assigned-order-priority')).toHaveTextContent('Alta');
    const entrar = within(campo('enter')).getByTestId(ASSIGNED_ORDER_ENTER_TESTID);
    expect(entrar.className).toContain('min-h-11');
    expect(within(tarjeta).getByTestId(ASSIGNMENT_ROW_ACTIONS_TESTID)).toHaveTextContent('Acciones');
  });

  it('R21: «Acciones» de la tarjeta abre el menú centrado, con 44 px', async () => {
    const user = setupUser();
    render(<PackingOrdersTable rows={[PACKING]} params={PARAMS} totalPages={1} />);

    const tarjeta = screen.getByTestId('data-table-card-order-p');
    expect(within(tarjeta).queryByRole('link')).toBeNull();
    const acciones = within(tarjeta).getByTestId(ASSIGNMENT_ROW_ACTIONS_TESTID);
    expect(acciones).toHaveTextContent('Acciones');
    expect(acciones.className).toContain('min-h-11');

    await user.click(acciones);
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveAccessibleName('Pedido 2026-0000012');
    expect(within(dialogo).getByTestId(ASSIGNMENT_ROW_ENTER_TESTID)).toHaveAttribute(
      'href',
      '/asignacion/empaque/order-p',
    );
  });

  it('R21: sin ítems, la tarjeta no pinta «Acciones»', () => {
    render(
      <AssignedOrdersTable rows={[ASSIGNED]} params={PARAMS} totalPages={1} vista="asignados" canExecute />,
    );

    const tarjeta = screen.getByTestId('data-table-card-order-a');
    expect(within(tarjeta).queryByTestId(ASSIGNMENT_ROW_ACTIONS_TESTID)).toBeNull();
    expect(within(tarjeta).getByTestId(ASSIGNED_ORDER_ENTER_TESTID)).toBeInTheDocument();
  });
});
