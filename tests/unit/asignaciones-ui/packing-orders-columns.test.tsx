import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PACKING_ORDER_NUMBER_COLUMN_ID,
  PACKING_ORDER_PACKER_COLUMN_ID,
  PACKING_ORDER_PRESENTATION_COLUMN_ID,
  PACKING_ORDER_PRIORITY_COLUMN_ID,
  PACKING_ORDER_QUANTITY_COLUMN_ID,
  PACKING_ORDER_RECIPE_NAME_COLUMN_ID,
  PACKING_ORDER_STATUS_COLUMN_ID,
  PACKING_ORDERS_COLUMN_COUNT,
  PackingOrdersTable,
  buildCompanyOrdersColumns,
  buildPackingOrdersColumns,
} from '@/app/(private)/asignacion/components';
import type { PackingOrderRow } from '@/lib/modules/asignaciones';
import type { CompanyOrderView } from '@/lib/modules/asignaciones';
import { ORDER_PRIORITY_LEVELS, ORDER_STATUS_TONES } from '@/lib/shared/ui/order-status';

// La tabla llama `useRouter()` y jsdom no monta el App Router.
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

const POR_EMPACAR_ORDER: PackingOrderRow = {
  id: 'order-1',
  numberText: '2026-0000021',
  recipeName: 'Jarabe simple',
  quantity: '40',
  presentationLines: [{ lineId: 'linea-1', packedPackages: null, presentationId: 'pres-1', presentationName: 'Caja x 12', packagingName: null, packages: 5, presentationContent: null, presentationUnitLabel: null }],
  unitId: null,
  unitLabel: null,
  status: 'POR_EMPACAR',
  priority: 'MEDIA',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  packedByName: null,
  packedById: null,
};

const EN_EMPAQUE_ORDER: PackingOrderRow = {
  ...POR_EMPACAR_ORDER,
  id: 'order-2',
  status: 'EN_EMPAQUE',
  packedByName: 'Ana López García',
  packedById: 'user-2',
};

function renderCell(columnId: string, order: PackingOrderRow) {
  const columns = buildPackingOrdersColumns();
  const column = columns.find((entry) => entry.id === columnId);
  if (column === undefined) throw new Error(`no existe la columna ${columnId}`);
  return render(<>{column.cell(order)}</>);
}

describe('R14 - las siete columnas de «Por empacar», y el menú', () => {
  it('declara numero, receta, cantidad, presentacion, prioridad, estado y quien empaca, en ese orden, y el menú al final', () => {
    const columns = buildPackingOrdersColumns();

    expect(columns.map((column) => column.id)).toEqual([
      PACKING_ORDER_NUMBER_COLUMN_ID,
      PACKING_ORDER_RECIPE_NAME_COLUMN_ID,
      PACKING_ORDER_QUANTITY_COLUMN_ID,
      PACKING_ORDER_PRESENTATION_COLUMN_ID,
      PACKING_ORDER_PRIORITY_COLUMN_ID,
      PACKING_ORDER_STATUS_COLUMN_ID,
      PACKING_ORDER_PACKER_COLUMN_ID,
      'actions',
    ]);
    expect(columns.filter((column) => column.menu === undefined)).toHaveLength(PACKING_ORDERS_COLUMN_COUNT);
  });
});

describe('R12 - sin columna «Envases»', () => {
  it('R12: ninguna columna de «Por empacar» se llama ni pinta «Envases»', () => {
    const columns = buildPackingOrdersColumns({ canViewTrace: true });

    expect(columns.map((column) => column.label)).not.toContain('Envases');
    expect(columns.map((column) => column.id)).not.toContain('packages');
    for (const column of columns.filter((entry) => entry.menu === undefined)) {
      const { container } = render(<>{column.cell(POR_EMPACAR_ORDER)}</>);
      expect(container.textContent ?? '').not.toMatch(/Envases/);
      cleanup();
    }
  });
});

describe('QC-265 R19 - el número deja de ser enlace', () => {
  it('R19: el número es texto; a la pantalla de empaque se entra por el menú', () => {
    const { container } = renderCell(PACKING_ORDER_NUMBER_COLUMN_ID, POR_EMPACAR_ORDER);

    expect(container).toHaveTextContent('2026-0000021');
    expect(container.querySelector('a')).toBeNull();
    expect(screen.queryByTestId('packing-order-link')).toBeNull();
  });
});

describe('R14, QC-265 R16 - estado (`StatusBadge` con tono) y quien empaca', () => {
  it('POR_EMPACAR: la etiqueta es «Por empacar» y quien empaca queda vacio', () => {
    renderCell(PACKING_ORDER_STATUS_COLUMN_ID, POR_EMPACAR_ORDER);
    expect(screen.getByTestId('packing-order-status')).toHaveTextContent('Por empacar');
    expect(screen.getByTestId('packing-order-status')).toHaveAttribute('data-status', 'POR_EMPACAR');
    expect(screen.getByTestId('packing-order-status')).toHaveAttribute(
      'data-tone',
      ORDER_STATUS_TONES.POR_EMPACAR,
    );
    cleanup();

    renderCell(PACKING_ORDER_PACKER_COLUMN_ID, POR_EMPACAR_ORDER);
    expect(screen.getByTestId('packing-order-missing-packedByName')).toBeInTheDocument();
  });

  it('EN_EMPAQUE: la etiqueta es «En empaque» y trae el nombre de quien empaca', () => {
    renderCell(PACKING_ORDER_STATUS_COLUMN_ID, EN_EMPAQUE_ORDER);
    expect(screen.getByTestId('packing-order-status')).toHaveTextContent('En empaque');
    expect(screen.getByTestId('packing-order-status')).toHaveAttribute(
      'data-tone',
      ORDER_STATUS_TONES.EN_EMPAQUE,
    );
    cleanup();

    renderCell(PACKING_ORDER_PACKER_COLUMN_ID, EN_EMPAQUE_ORDER);
    expect(screen.getByText('Ana López García')).toBeInTheDocument();
  });
});

describe('R14 - receta, presentacion y envases', () => {
  it('con datos, los pinta; sin ellos, el marcador de ausencia', () => {
    renderCell(PACKING_ORDER_RECIPE_NAME_COLUMN_ID, POR_EMPACAR_ORDER);
    expect(screen.getByText('Jarabe simple')).toBeInTheDocument();
    cleanup();

    renderCell(PACKING_ORDER_RECIPE_NAME_COLUMN_ID, { ...POR_EMPACAR_ORDER, recipeName: null });
    expect(screen.getByTestId('packing-order-missing-recipeName')).toBeInTheDocument();
    cleanup();

    renderCell(PACKING_ORDER_PRESENTATION_COLUMN_ID, POR_EMPACAR_ORDER);
    expect(screen.getByTestId('order-distribution')).toHaveTextContent('5 × Caja x 12');
  });
});

function renderCompanyCell(columnId: string, order: Pick<CompanyOrderView, 'quantity' | 'unitLabel' | 'priority'>) {
  const column = buildCompanyOrdersColumns({ showFinishedAt: false }).find((entry) => entry.id === columnId);
  if (column === undefined) throw new Error(`no existe la columna ${columnId}`);
  return render(<>{column.cell(order as CompanyOrderView)}</>);
}

describe('Cantidad - la misma celda que «Todos»', () => {
  it('pinta cantidad y unidad con el formato de las otras pestañas', () => {
    const order = { ...POR_EMPACAR_ORDER, quantity: '12.5000', unitId: 'unit-l', unitLabel: 'L' };
    const { container } = renderCell(PACKING_ORDER_QUANTITY_COLUMN_ID, order);
    const packingText = container.textContent;
    cleanup();
    const { container: companyContainer } = renderCompanyCell('quantity', order);

    expect(packingText).toBe(companyContainer.textContent);
    expect(packingText).toMatch(/^12[,.]5 L$/);
  });

  it('sin unidad, la cifra va sola', () => {
    const { container } = renderCell(PACKING_ORDER_QUANTITY_COLUMN_ID, POR_EMPACAR_ORDER);
    const packingText = container.textContent;
    cleanup();
    const { container: companyContainer } = renderCompanyCell('quantity', POR_EMPACAR_ORDER);

    expect(packingText).toBe('40');
    expect(packingText).toBe(companyContainer.textContent);
  });

  it('alinea y titula la columna como en «Todos»', () => {
    const packing = buildPackingOrdersColumns().find((column) => column.id === PACKING_ORDER_QUANTITY_COLUMN_ID);
    const company = buildCompanyOrdersColumns({ showFinishedAt: false }).find((column) => column.id === 'quantity');

    expect(packing?.label).toBe(company?.label);
    expect(packing?.align).toBe(company?.align);
    expect(packing?.sortable).toBe(company?.sortable);
  });
});

describe('Prioridad - el mismo `PriorityMark` que «Todos» y «Mis asignados»', () => {
  it('pinta la marca con el nivel y la etiqueta de la prioridad', () => {
    renderCell(PACKING_ORDER_PRIORITY_COLUMN_ID, { ...POR_EMPACAR_ORDER, priority: 'ALTA' });
    const packingMark = screen.getByTestId('packing-order-priority');
    expect(packingMark).toHaveAttribute('data-priority', 'ALTA');
    const packingHtml = packingMark.outerHTML.replace('packing-order-priority', 'X');
    cleanup();

    renderCompanyCell('priority', { ...POR_EMPACAR_ORDER, priority: 'ALTA' });
    const companyMark = screen.getByTestId('company-order-priority');
    expect(packingHtml).toBe(companyMark.outerHTML.replace('company-order-priority', 'X'));
    expect(ORDER_PRIORITY_LEVELS.ALTA).toBeDefined();
  });

  it('la columna no se declara ordenable, igual que en «Todos»', () => {
    const packing = buildPackingOrdersColumns().find((column) => column.id === PACKING_ORDER_PRIORITY_COLUMN_ID);
    const company = buildCompanyOrdersColumns({ showFinishedAt: false }).find((column) => column.id === 'priority');

    expect(packing?.label).toBe('Prioridad');
    expect(packing?.sortable).toBe(company?.sortable);
  });
});

describe('Orden - la tabla respeta el orden que manda el servidor', () => {
  it('pinta las filas tal cual llegan: prioridad alta primero y, a igual prioridad, el más antiguo', () => {
    const rows: PackingOrderRow[] = [
      { ...POR_EMPACAR_ORDER, id: 'alta', numberText: '2026-0000003', priority: 'ALTA', createdAt: new Date('2026-03-01T00:00:00.000Z') },
      { ...POR_EMPACAR_ORDER, id: 'media-vieja', numberText: '2026-0000001', priority: 'MEDIA', createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { ...POR_EMPACAR_ORDER, id: 'media-nueva', numberText: '2026-0000002', priority: 'MEDIA', createdAt: new Date('2026-02-01T00:00:00.000Z') },
    ];
    const params = { page: 1, pageSize: 10, sort: null, filters: {}, search: '' };

    render(<PackingOrdersTable rows={rows} params={params} totalPages={1} />);

    const renderedIds = screen
      .getAllByTestId(/^data-table-row-/)
      .map((row) => row.getAttribute('data-testid')?.replace('data-table-row-', ''));
    expect(renderedIds).toEqual(['alta', 'media-vieja', 'media-nueva']);
    expect(within(screen.getByTestId('data-table-row-alta')).getByTestId('packing-order-priority')).toHaveAttribute(
      'data-priority',
      'ALTA',
    );
  });
});
