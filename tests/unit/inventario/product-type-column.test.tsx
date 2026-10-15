import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PRODUCT_SKELETON_COLUMN_COUNT,
  PRODUCT_TYPE_LABELS,
  PRODUCT_TYPE_TONES,
  ProductTable,
  buildProductColumns,
} from '@/app/(private)/inventario/components';
import type { DataTableParams } from '@/components/shared/data-table';
import { PRODUCT_TYPE_VALUES, PRODUCT_TYPES, type ProductView } from '@/lib/modules/inventario';

/**
 * Columna «Tipo» de la tabla de inventario: solo en la pestana «Todos» (sin filtro de tipo), con
 * un chip de etiqueta y tono propios por tipo. Con un tipo filtrado no sale: todas las filas
 * dirian lo mismo.
 */

const { routerMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/inventario/adapters/driving/batch-actions', () => ({
  listProductBatchesAction: vi.fn(),
  listOrderBatchesAction: vi.fn(),
  listBatchMovementsAction: vi.fn(),
  adjustBatchStockAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

function producto(overrides: Partial<ProductView> = {}): ProductView {
  return {
    id: crypto.randomUUID(),
    name: 'Hidróxido de sodio',
    imagePath: null,
    stock: '0',
    unitId: null,
    qtyAlert: null,
    type: PRODUCT_TYPES.PRODUCT,
    createdAt: new Date('2026-01-15T10:20:30.000Z'),
    updatedAt: new Date('2026-02-20T08:00:00.000Z'),
    ...overrides,
  };
}

const TODOS: DataTableParams = { page: 1, pageSize: 10, sort: null, filters: {}, search: '' };

describe('columna «Tipo» de la tabla de inventario', () => {
  it('sin `showType` no existe y el esqueleto sigue contando las columnas por defecto', () => {
    const columnas = buildProductColumns({ rowActions: () => null });

    expect(columnas.some((columna) => columna.id === 'type')).toBe(false);
    expect(PRODUCT_SKELETON_COLUMN_COUNT).toBe(columnas.length);
  });

  it('con `showType` va justo despues de la presentacion, sin orden ni filtro de cabecera', () => {
    const columnas = buildProductColumns({ rowActions: () => null, showType: true });
    const ids = columnas.map((columna) => columna.id);
    const tipo = columnas.find((columna) => columna.id === 'type');

    expect(ids.indexOf('type')).toBe(ids.indexOf('presentationName') + 1);
    expect(tipo?.sortable).toBeFalsy();
    expect(tipo?.filter).toBeUndefined();
  });

  it('cada tipo tiene su propio tono, distinto de los demas, y ninguno es `danger`', () => {
    const tonos = PRODUCT_TYPE_VALUES.map((type) => PRODUCT_TYPE_TONES[type]);

    expect(new Set(tonos).size).toBe(PRODUCT_TYPE_VALUES.length);
    expect(tonos).not.toContain('danger');
  });

  it('en «Todos» la tabla pinta la columna y cada fila su chip con etiqueta y tono del tipo', () => {
    const productos = PRODUCT_TYPE_VALUES.map((type) => producto({ type, name: `Producto ${type}` }));

    render(<ProductTable products={productos} params={TODOS} totalPages={1} />);

    expect(screen.getByTestId('data-table-head-type')).toBeInTheDocument();
    const chips = screen.getAllByTestId('product-type');
    expect(chips).toHaveLength(PRODUCT_TYPE_VALUES.length);

    for (const type of PRODUCT_TYPE_VALUES) {
      const chip = chips.find((candidato) => candidato.getAttribute('data-type') === type);
      expect(chip, `falta el chip de «${type}»`).toBeDefined();
      expect(chip).toHaveAttribute('data-tone', PRODUCT_TYPE_TONES[type]);
      expect(within(chip as HTMLElement).getByText(PRODUCT_TYPE_LABELS[type])).toBeInTheDocument();
    }
  });

  it('con un tipo filtrado la columna no sale', () => {
    const params: DataTableParams = {
      ...TODOS,
      filters: { type: { kind: 'select', values: [PRODUCT_TYPES.MACHINE] } },
    };

    render(
      <ProductTable
        products={[producto({ type: PRODUCT_TYPES.MACHINE })]}
        params={params}
        totalPages={1}
      />,
    );

    expect(screen.queryByTestId('data-table-head-type')).toBeNull();
    expect(screen.queryByTestId('product-type')).toBeNull();
  });
});
