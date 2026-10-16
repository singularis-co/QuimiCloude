import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  CONDITIONING_ORDER_CONDITIONER_COLUMN_ID,
  CONDITIONING_ORDER_NUMBER_COLUMN_ID,
  CONDITIONING_ORDER_PACKAGES_COLUMN_ID,
  CONDITIONING_ORDER_RECIPE_NAME_COLUMN_ID,
  CONDITIONING_ORDER_STATUS_COLUMN_ID,
  CONDITIONING_ORDERS_SKELETON_COLUMN_COUNT,
  FINISHED_ORDER_NUMBER_COLUMN_ID,
  buildConditionedOrdersColumns,
  buildConditioningOrdersColumns,
  buildFinishedOrdersColumns,
  orderDistributionFullText,
} from '@/app/(private)/asignacion/components';
import type { ConditioningOrderRow, FinishedOrderView } from '@/lib/modules/asignaciones';
import { ORDER_STATUS_TONES } from '@/lib/shared/ui/order-status';

afterEach(() => {
  cleanup();
});

const ROW: ConditioningOrderRow = {
  id: 'order-a',
  numberText: '2026-0000040',
  recipeName: 'Jarabe simple',
  quantity: '20',
  unitId: null,
  unitLabel: null,
  presentationLines: [
    { lineId: 'linea-1', packedPackages: null, presentationId: 'pres-1', presentationName: 'Frasco', packagingName: '500 g', packages: 12 },
    { lineId: 'linea-2', packedPackages: null, presentationId: 'pres-2', presentationName: 'Bolsa', packagingName: '1 kg', packages: 4 },
  ],
  status: 'POR_ACONDICIONAR',
  conditionedByName: null,
  conditionedById: null,
};

const FINISHED: FinishedOrderView = {
  id: 'order-c',
  numberText: '2026-0000041',
  recipeName: 'Jarabe simple',
  quantity: '12.5000',
  presentationLines: [{ lineId: 'linea-3', packedPackages: null, presentationId: 'pres-1', presentationName: 'Caja x 12', packagingName: null, packages: 5 }],
  unitId: null,
  unitLabel: null,
  finishedAt: new Date('2026-09-20T15:30:00.000Z'),
  responsibles: [],
};

function renderCell(columnId: string, row: ConditioningOrderRow) {
  const column = buildConditioningOrdersColumns().find((entry) => entry.id === columnId);
  if (column === undefined) throw new Error(`no existe la columna ${columnId}`);
  return render(<>{column.cell(row)}</>);
}

describe('«Por acondicionar»: cinco columnas y el menú', () => {
  it('R8: Nº de pedido, Receta, Envases, Estado y Quién acondiciona, en ese orden, y el menú al final', () => {
    const columns = buildConditioningOrdersColumns();

    expect(columns.map((column) => column.id)).toEqual([
      CONDITIONING_ORDER_NUMBER_COLUMN_ID,
      CONDITIONING_ORDER_RECIPE_NAME_COLUMN_ID,
      CONDITIONING_ORDER_PACKAGES_COLUMN_ID,
      CONDITIONING_ORDER_STATUS_COLUMN_ID,
      CONDITIONING_ORDER_CONDITIONER_COLUMN_ID,
      'actions',
    ]);
    expect(columns.map((column) => column.label)).toEqual([
      'Nº de pedido',
      'Receta',
      'Envases',
      'Estado',
      'Quién acondiciona',
      'Acciones',
    ]);
  });

  it('R8: el esqueleto pinta tantas columnas como la tabla tiene de datos', () => {
    expect(CONDITIONING_ORDERS_SKELETON_COLUMN_COUNT).toBe(
      buildConditioningOrdersColumns().filter((column) => column.menu === undefined).length,
    );
  });

  it('R8: «Envases» es el reparto entero en orden de alta, no un total', () => {
    renderCell(CONDITIONING_ORDER_PACKAGES_COLUMN_ID, ROW);

    expect(screen.getByTestId('order-distribution-full')).toHaveTextContent('12 × 500 g / 4 × 1 kg');
  });

  it('«Envases» sigue siendo solo texto aunque las líneas traigan imagen del envase', () => {
    renderCell(CONDITIONING_ORDER_PACKAGES_COLUMN_ID, {
      ...ROW,
      presentationLines: ROW.presentationLines.map((line) => ({
        ...line,
        packagingImageUrl: 'https://cdn.example/envase.png',
      })),
    });

    const cell = screen.getByTestId('order-distribution-full');
    expect(cell.tagName).toBe('SPAN');
    expect(cell.textContent).toBe('12 × 500 g / 4 × 1 kg');
    expect(cell.querySelectorAll('img')).toHaveLength(0);
  });

  it('R8: un pedido sin reparto dice «Sin presentación»', () => {
    renderCell(CONDITIONING_ORDER_PACKAGES_COLUMN_ID, { ...ROW, presentationLines: [] });

    const cell = screen.getByTestId('order-distribution-full');
    expect(cell).toHaveTextContent('Sin presentación');
    expect(cell).toHaveAttribute('data-empty', 'true');
  });

  it('R8: una línea sin envase cae a la presentación, y sin ninguno de los dos pinta «—»', () => {
    expect(
      orderDistributionFullText([
        { presentationId: 'p1', presentationName: 'Caja x 12', packagingName: null, packages: 3 },
        { presentationId: 'p2', presentationName: null, packagingName: null, packages: 2 },
      ]),
    ).toBe('3 × Caja x 12 / 2 × —');
  });

  it('R8: el estado pinta «Por acondicionar» y «En acondicionamiento» con data-status', () => {
    renderCell(CONDITIONING_ORDER_STATUS_COLUMN_ID, ROW);
    const queued = screen.getByTestId('conditioning-order-status');
    expect(queued).toHaveTextContent('Por acondicionar');
    expect(queued).toHaveAttribute('data-status', 'POR_ACONDICIONAR');
    expect(queued).toHaveAttribute('data-tone', ORDER_STATUS_TONES.POR_ACONDICIONAR);
    cleanup();

    renderCell(CONDITIONING_ORDER_STATUS_COLUMN_ID, { ...ROW, status: 'EN_ACONDICIONAMIENTO' });
    const inProgress = screen.getByTestId('conditioning-order-status');
    expect(inProgress).toHaveTextContent('En acondicionamiento');
    expect(inProgress).toHaveAttribute('data-status', 'EN_ACONDICIONAMIENTO');
    expect(inProgress).toHaveAttribute('data-tone', ORDER_STATUS_TONES.EN_ACONDICIONAMIENTO);
  });

  it('R8: sin receta ni quien acondicione, las celdas pintan «—»', () => {
    renderCell(CONDITIONING_ORDER_RECIPE_NAME_COLUMN_ID, { ...ROW, recipeName: null });
    expect(screen.getByTestId(`conditioning-order-missing-${CONDITIONING_ORDER_RECIPE_NAME_COLUMN_ID}`)).toHaveTextContent('—');
    cleanup();

    renderCell(CONDITIONING_ORDER_CONDITIONER_COLUMN_ID, ROW);
    expect(screen.getByTestId(`conditioning-order-missing-${CONDITIONING_ORDER_CONDITIONER_COLUMN_ID}`)).toHaveTextContent('—');
  });

  it('R8: con quien acondiciona, pinta su nombre', () => {
    renderCell(CONDITIONING_ORDER_CONDITIONER_COLUMN_ID, {
      ...ROW,
      status: 'EN_ACONDICIONAMIENTO',
      conditionedByName: 'Berta Ruiz',
      conditionedById: 'user-2',
    });

    expect(screen.getByText('Berta Ruiz')).toBeInTheDocument();
  });
});

describe('QC-265 R19: el número deja de ser enlace (al detalle se entra por el menú)', () => {
  it('R19: en «Por acondicionar» el número es texto', () => {
    const { container } = renderCell(CONDITIONING_ORDER_NUMBER_COLUMN_ID, ROW);

    expect(container).toHaveTextContent('2026-0000040');
    expect(container.querySelector('a')).toBeNull();
  });

  it('R19: en «Acondicionados» el número es texto', () => {
    const column = buildConditionedOrdersColumns().find((entry) => entry.id === FINISHED_ORDER_NUMBER_COLUMN_ID);
    if (column === undefined) throw new Error('falta la columna del número');
    const { container } = render(<>{column.cell(FINISHED)}</>);

    expect(container).toHaveTextContent('2026-0000041');
    expect(container.querySelector('a')).toBeNull();
  });
});

describe('«Acondicionados»: las columnas del Empacador y el menú', () => {
  it('R12: mismos ids, rótulos, alineación, fijado y orden que buildFinishedOrdersColumns(), y el menú al final', () => {
    const own = buildConditionedOrdersColumns();
    const packer = buildFinishedOrdersColumns();
    const datos = own.filter((column) => column.menu === undefined);

    expect(datos.map(({ id, label, align, defaultPinned }) => ({ id, label, align, defaultPinned }))).toEqual(
      packer.map(({ id, label, align, defaultPinned }) => ({ id, label, align, defaultPinned })),
    );
    expect(own.map((column) => column.label)).toEqual([
      'Nº de pedido',
      'Receta',
      'Cantidad',
      'Presentación',
      'Fecha de terminado',
      'Responsables',
      'Acciones',
    ]);
  });

  it('R12: las celdas de datos pintan lo mismo que las del Empacador', () => {
    const own = buildConditionedOrdersColumns().filter((column) => column.menu === undefined);
    const packer = buildFinishedOrdersColumns();

    own.forEach((column, index) => {
      const packerColumn = packer[index];
      if (packerColumn === undefined) throw new Error('faltan columnas');
      const ownHtml = render(<>{column.cell(FINISHED)}</>).container.innerHTML;
      cleanup();
      const packerHtml = render(<>{packerColumn.cell(FINISHED)}</>).container.innerHTML;
      cleanup();

      expect(ownHtml, column.id).toBe(packerHtml);
    });
  });

  it('R13: las columnas del Empacador siguen sin ningún enlace', () => {
    for (const column of buildFinishedOrdersColumns()) {
      const { container } = render(<>{column.cell(FINISHED)}</>);
      expect(container.querySelector('a'), column.id).toBeNull();
      cleanup();
    }
  });
});
