import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  PACKING_ORDER_NUMBER_COLUMN_ID,
  PACKING_ORDER_PACKER_COLUMN_ID,
  PACKING_ORDER_PRESENTATION_COLUMN_ID,
  PACKING_ORDER_RECIPE_NAME_COLUMN_ID,
  PACKING_ORDER_STATUS_COLUMN_ID,
  PACKING_ORDERS_COLUMN_COUNT,
  buildPackingOrdersColumns,
} from '@/app/(private)/asignacion/components';
import type { PackingOrderRow } from '@/lib/modules/asignaciones';
import { ORDER_STATUS_TONES } from '@/lib/shared/ui/order-status';

afterEach(() => {
  cleanup();
});

const POR_EMPACAR_ORDER: PackingOrderRow = {
  id: 'order-1',
  numberText: '2026-0000021',
  recipeName: 'Jarabe simple',
  quantity: '40',
  presentationLines: [{ lineId: 'linea-1', packedPackages: null, presentationId: 'pres-1', presentationName: 'Caja x 12', packagingName: null, packages: 5 }],
  unitId: null,
  unitLabel: null,
  status: 'POR_EMPACAR',
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

describe('R14 - las cinco columnas de «Por empacar», y el menú', () => {
  it('declara numero, receta, presentacion, estado y quien empaca, en ese orden, y el menú al final', () => {
    const columns = buildPackingOrdersColumns();

    expect(columns.map((column) => column.id)).toEqual([
      PACKING_ORDER_NUMBER_COLUMN_ID,
      PACKING_ORDER_RECIPE_NAME_COLUMN_ID,
      PACKING_ORDER_PRESENTATION_COLUMN_ID,
      PACKING_ORDER_STATUS_COLUMN_ID,
      PACKING_ORDER_PACKER_COLUMN_ID,
      'actions',
    ]);
    expect(columns.filter((column) => column.menu === undefined)).toHaveLength(PACKING_ORDERS_COLUMN_COUNT);
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
