import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import {
  ASSIGNED_ORDER_ENTER_TESTID,
  AssignedOrdersTable,
  CompanyOrdersTable,
  ConditionedOrdersTable,
  ConditioningOrdersTable,
  FinishedOrdersTable,
  PackingOrdersTable,
  buildConditionedOrdersColumns,
  buildConditioningOrdersColumns,
  buildPackingOrdersColumns,
} from '@/app/(private)/asignacion/components';
import type { DataTableColumn, DataTableParams } from '@/components/shared/data-table';
import type {
  AssignedOrderView,
  CompanyOrderView,
  ConditioningOrderRow,
  FinishedOrderView,
  PackingOrderRow,
} from '@/lib/modules/asignaciones';
import {
  assignedOrderRoute,
  conditioningOrderRoute,
  packingOrderRoute,
} from '@/lib/shared/routes';

// Las tablas llaman `useRouter()` y jsdom no monta el App Router.
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
}));

const PARAMS: DataTableParams = { page: 1, pageSize: 10, sort: null, filters: {}, search: '' };

const ORDER_ID = '33333333-3333-4333-8333-333333333333';
const NUMBER = '2026-0000050';
const LINE_A = '55555555-5555-4555-8555-555555555555';
const LINE_B = '66666666-6666-4666-8666-666666666666';

const COMMON = {
  id: ORDER_ID,
  numberText: NUMBER,
  quantity: '10',
  presentationLines: [],
  unitId: null,
  unitLabel: null,
} as const;

function twoRecipes<
  T extends {
    readonly lineId: string;
    readonly recipeName: string | null;
    readonly recipe: { readonly position: number; readonly count: number };
  },
>(base: Omit<T, 'lineId' | 'recipeName' | 'recipe'>): readonly T[] {
  return [
    { ...base, lineId: LINE_A, recipeName: 'Jarabe simple', recipe: { position: 1, count: 2 } } as T,
    { ...base, lineId: LINE_B, recipeName: 'Barniz acrílico', recipe: { position: 2, count: 2 } } as T,
  ];
}

const ASSIGNED = twoRecipes<AssignedOrderView>({
  ...COMMON,
  priority: 'MEDIA',
  status: 'PENDIENTE',
  otherResponsibles: [],
});

const COMPANY = twoRecipes<CompanyOrderView>({
  ...COMMON,
  priority: 'MEDIA',
  status: 'PARCIAL',
  responsibles: [],
  finishedAt: null,
});

const FINISHED = twoRecipes<FinishedOrderView>({
  ...COMMON,
  finishedAt: new Date('2026-09-20T15:30:00.000Z'),
  responsibles: [],
});

const PACKING = twoRecipes<PackingOrderRow>({
  ...COMMON,
  status: 'POR_EMPACAR',
  priority: 'MEDIA',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  packedByName: null,
  packedById: null,
});

const CONDITIONING = twoRecipes<ConditioningOrderRow>({
  ...COMMON,
  status: 'POR_ACONDICIONAR',
  conditionedByName: null,
  conditionedById: null,
});

const TABLES: readonly (readonly [string, () => ReactElement])[] = [
  [
    'asignados',
    () => <AssignedOrdersTable rows={ASSIGNED} params={PARAMS} totalPages={1} vista="asignados" canExecute />,
  ],
  ['todos', () => <CompanyOrdersTable rows={COMPANY} params={PARAMS} totalPages={1} statuses={[]} />],
  ['terminados', () => <FinishedOrdersTable rows={FINISHED} params={PARAMS} totalPages={1} />],
  ['por empacar', () => <PackingOrdersTable rows={PACKING} params={PARAMS} totalPages={1} />],
  ['por acondicionar', () => <ConditioningOrdersTable rows={CONDITIONING} params={PARAMS} totalPages={1} />],
  ['acondicionados', () => <ConditionedOrdersTable rows={FINISHED} params={PARAMS} totalPages={1} />],
];

/** Los ítems «Entrar» del menú de la fila. */
function enterHref<T>(columns: readonly DataTableColumn<T>[], row: T): string | undefined {
  const spec = columns.find((column) => column.menu !== undefined)?.menu?.(row);
  return spec?.items.find((item) => item.key === 'enter')?.href;
}

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  consoleError.mockRestore();
});

describe('R2 — dos recetas del mismo pedido son dos filas', () => {
  it.each(TABLES)(
    'R2: «%s» pinta una fila por receta con el mismo número de pedido, sin claves repetidas',
    (_vista, table) => {
      render(table());

      const filas = within(screen.getByRole('table'))
        .getAllByRole('row')
        .filter((fila) => within(fila).queryByText(NUMBER) !== null);
      expect(filas).toHaveLength(2);
      expect(screen.getByTestId(`data-table-card-${LINE_A}`)).toBeInTheDocument();
      expect(screen.getByTestId(`data-table-card-${LINE_B}`)).toBeInTheDocument();
      const duplicadas = consoleError.mock.calls.filter((args) =>
        args.some((arg) => typeof arg === 'string' && arg.includes('same key')),
      );
      expect(duplicadas).toEqual([]);
    },
  );

  it('R2, R4: en «asignados» las dos filas del mismo pedido llevan a destinos distintos', () => {
    render(<AssignedOrdersTable rows={ASSIGNED} params={PARAMS} totalPages={1} vista="asignados" canExecute />);

    const destinos = new Set(
      within(screen.getByRole('table'))
        .getAllByTestId(ASSIGNED_ORDER_ENTER_TESTID)
        .map((enlace) => enlace.getAttribute('href')),
    );
    expect(destinos).toEqual(
      new Set([assignedOrderRoute(ORDER_ID, LINE_A), assignedOrderRoute(ORDER_ID, LINE_B)]),
    );
  });
});

describe('R4 — «Entrar» abre la pantalla de esa receta', () => {
  it('R4: «Por empacar» entra al empaque de cada receta, con ?receta=<lineId>', () => {
    const columns = buildPackingOrdersColumns();
    expect(PACKING.map((row) => enterHref(columns, row))).toEqual([
      packingOrderRoute(ORDER_ID, LINE_A),
      packingOrderRoute(ORDER_ID, LINE_B),
    ]);
    expect(enterHref(columns, PACKING[0])).toBe(`/asignacion/empaque/${ORDER_ID}?receta=${LINE_A}`);
  });

  it('R4: «Por acondicionar» entra al acondicionamiento de cada receta', () => {
    const columns = buildConditioningOrdersColumns();
    expect(CONDITIONING.map((row) => enterHref(columns, row))).toEqual([
      conditioningOrderRoute(ORDER_ID, LINE_A),
      conditioningOrderRoute(ORDER_ID, LINE_B),
    ]);
  });

  it('R4: «Acondicionados» entra al acondicionamiento de cada receta', () => {
    const columns = buildConditionedOrdersColumns();
    expect(FINISHED.map((row) => enterHref(columns, row))).toEqual([
      conditioningOrderRoute(ORDER_ID, LINE_A),
      conditioningOrderRoute(ORDER_ID, LINE_B),
    ]);
  });
});

function oneRecipe<T extends { readonly recipe: { readonly position: number; readonly count: number } }>(
  rows: readonly T[],
): readonly T[] {
  return [{ ...rows[0], recipe: { position: 1, count: 1 } }];
}

const SINGLE_TABLES: readonly (readonly [string, () => ReactElement])[] = [
  [
    'asignados',
    () => (
      <AssignedOrdersTable rows={oneRecipe(ASSIGNED)} params={PARAMS} totalPages={1} vista="asignados" canExecute />
    ),
  ],
  ['todos', () => <CompanyOrdersTable rows={oneRecipe(COMPANY)} params={PARAMS} totalPages={1} statuses={[]} />],
  ['terminados', () => <FinishedOrdersTable rows={oneRecipe(FINISHED)} params={PARAMS} totalPages={1} />],
  ['por empacar', () => <PackingOrdersTable rows={oneRecipe(PACKING)} params={PARAMS} totalPages={1} />],
  [
    'por acondicionar',
    () => <ConditioningOrdersTable rows={oneRecipe(CONDITIONING)} params={PARAMS} totalPages={1} />,
  ],
  ['acondicionados', () => <ConditionedOrdersTable rows={oneRecipe(FINISHED)} params={PARAMS} totalPages={1} />],
];

describe('R3 — «Receta N de M» bajo el nombre de la receta', () => {
  it.each(TABLES)('R3: «%s» pinta «Receta 1 de 2» y «Receta 2 de 2» en la tabla', (_vista, table) => {
    render(table());

    const tabla = screen.getByRole('table');
    expect(within(tabla).getByText('Receta 1 de 2')).toBeInTheDocument();
    expect(within(tabla).getByText('Receta 2 de 2')).toBeInTheDocument();
  });

  it.each(TABLES)('R3, R30: «%s» en el telefono, cada tarjeta lleva su «Receta N de M»', (_vista, table) => {
    render(table());

    expect(within(screen.getByTestId(`data-table-card-${LINE_A}`)).getByText('Receta 1 de 2')).toBeInTheDocument();
    expect(within(screen.getByTestId(`data-table-card-${LINE_B}`)).getByText('Receta 2 de 2')).toBeInTheDocument();
  });

  it.each(SINGLE_TABLES)('R3, R29: «%s» con una sola receta no pinta «Receta 1 de 1»', (_vista, table) => {
    render(table());

    expect(screen.getAllByText('Jarabe simple').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Receta \d+ de \d+/)).toBeNull();
  });

  it('R30: en el telefono, el «Entrar» de la tarjeta de «asignados» mide 44 × 44 px y nombra la receta', () => {
    render(TABLES[0][1]());

    const tarjeta = screen.getByTestId(`data-table-card-${LINE_B}`);
    const entrar = within(tarjeta).getByTestId(ASSIGNED_ORDER_ENTER_TESTID);
    expect(entrar).toHaveClass('min-h-11', 'min-w-11');
    expect(entrar).toHaveAccessibleName(`Entrar a Barniz acrílico del pedido ${NUMBER}`);
  });
});
