import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BELOW_ALERT_LABEL,
  FinishedStockTable,
  ProductTable,
} from '@/app/(private)/inventario/components';
import type { DataTableParams } from '@/components/shared/data-table';
import {
  PRODUCT_TYPES,
  type FinishedStockRow,
  type PackagedStockEntry,
  type ProductView,
} from '@/lib/modules/inventario';
import type { UnitRef } from '@/lib/modules/unidades';
import { setupUser } from '../../helpers/user-event';

/**
 * Aviso de existencia por debajo de la alerta de cantidad: tono de advertencia (no de error),
 * icono oculto a lectores de pantalla, `title` y texto oculto, con `data-alert`. La regla es la de
 * siempre: la alerta SUPERA la existencia, no la iguala.
 */

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

vi.mock('@/lib/modules/inventario/adapters/driving/batch-actions', () => ({
  listProductBatchesAction: vi.fn(),
  listAliveProductBatchesAction: vi.fn(),
  listOrderBatchesAction: vi.fn(),
  listBatchMovementsAction: vi.fn(),
  adjustBatchStockAction: vi.fn(),
}));

const TODOS: DataTableParams = { page: 1, pageSize: 20, sort: null, filters: {}, search: '' };
const TERMINADO: DataTableParams = {
  ...TODOS,
  filters: { type: { kind: 'select', values: [PRODUCT_TYPES.FINISHED_PRODUCT] } },
};
const UNITS: readonly UnitRef[] = [
  { id: 'unit-kg', name: 'Kilogramo', symbol: 'kg', baseUnitId: null, factor: null },
  { id: 'unit-ml', name: 'Mililitro', symbol: 'ml', baseUnitId: null, factor: null },
];

function producto(overrides: Partial<ProductView> = {}): ProductView {
  return {
    id: 'product-1',
    name: 'Acido citrico',
    imagePath: null,
    stock: '2',
    unitId: 'unit-kg',
    qtyAlert: '5',
    type: PRODUCT_TYPES.PRODUCT,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function existenciaDe(id: string): HTMLElement {
  return within(screen.getByTestId(`data-table-row-${id}`)).getByTestId('product-stock');
}

function afirmaAviso(celda: HTMLElement) {
  expect(celda).toHaveAttribute('data-alert', 'true');
  expect(celda).toHaveClass('text-warning-text');
  expect(celda.className).not.toContain('text-destructive');
  // El `title` del aviso va en su marca: el de la celda sigue siendo la cifra exacta.
  const marca = within(celda).getByTitle(BELOW_ALERT_LABEL);
  const icono = marca.querySelector('svg');
  expect(icono).not.toBeNull();
  expect(icono).toHaveAttribute('aria-hidden', 'true');
  const oculto = within(marca).getByText(BELOW_ALERT_LABEL);
  expect(oculto).toHaveClass('sr-only');
}

function afirmaSinAviso(celda: HTMLElement) {
  expect(celda).not.toHaveAttribute('data-alert');
  expect(celda.className).not.toContain('text-warning-text');
  expect(celda.className).not.toContain('text-destructive');
  expect(celda.querySelector('svg')).toBeNull();
  expect(within(celda).queryByText(BELOW_ALERT_LABEL)).toBeNull();
  expect(within(celda).queryByTitle(BELOW_ALERT_LABEL)).toBeNull();
}

afterEach(cleanup);

describe('aviso de existencia en la tabla de productos', () => {
  it('R7 — por debajo de la alerta, la existencia va en ámbar con icono, title y texto oculto', () => {
    render(<ProductTable products={[producto()]} params={TODOS} totalPages={1} units={UNITS} />);

    const celda = existenciaDe('product-1');
    afirmaAviso(celda);
    // La cifra exacta sigue siendo lo que se anuncia de la celda.
    expect(celda).toHaveAttribute('aria-label', '2 kg');
    expect(celda).toHaveTextContent('2 kg');
  });

  it('R7 — con la cifra redondeada, la celda en alarma conserva la exacta en su title', () => {
    render(
      <ProductTable
        products={[producto({ stock: '0.0001' })]}
        params={TODOS}
        totalPages={1}
        units={UNITS}
      />,
    );

    const celda = existenciaDe('product-1');
    afirmaAviso(celda);
    expect(celda).toHaveAttribute('title', '0.0001');
    expect(celda).toHaveAttribute('aria-label', '0.0001 kg');
  });

  it('R7 — en la alerta exacta y por encima, la existencia no lleva aviso', () => {
    render(
      <ProductTable
        products={[
          producto({ id: 'igual', stock: '5' }),
          producto({ id: 'encima', name: 'Sal', stock: '9' }),
          producto({ id: 'sin-alerta', name: 'Agua', stock: '0', qtyAlert: null }),
        ]}
        params={TODOS}
        totalPages={1}
        units={UNITS}
      />,
    );

    for (const id of ['igual', 'encima', 'sin-alerta']) afirmaSinAviso(existenciaDe(id));
  });

  it('R7 — la existencia de un lote nunca lleva el aviso del producto', async () => {
    const { listAliveProductBatchesAction } = await import(
      '@/lib/modules/inventario/adapters/driving/batch-actions'
    );
    vi.mocked(listAliveProductBatchesAction).mockResolvedValue({
      status: 'success',
      data: [
        {
          id: 'batch-1',
          lot: 'L-001',
          stock: '2.0000',
          unitId: 'unit-kg',
          purchaseDate: '2026-03-05',
          expiryDate: null,
          packageContent: null,
          reserved: '0',
          available: '2.0000',
        },
      ],
    });
    const user = setupUser();
    render(<ProductTable products={[producto()]} params={TODOS} totalPages={1} units={UNITS} />);

    await user.click(within(screen.getByRole('table')).getByRole('button', { name: 'Mostrar lotes de Acido citrico' }));
    await screen.findByTestId('data-table-row-product-1--batch-batch-1');

    const lote = within(screen.getByTestId('data-table-row-product-1--batch-batch-1')).getByTestId(
      'batch-stock',
    );
    afirmaSinAviso(lote);
    afirmaAviso(existenciaDe('product-1'));
  });
});

describe('aviso de existencia en «Producto terminado»', () => {
  function entrada(): PackagedStockEntry {
    return { name: 'Botella 250 ml', packages: '6', remainder: null, unitId: 'unit-ml' };
  }

  function grupo(product: ProductView, packaged: readonly PackagedStockEntry[] | null): FinishedStockRow {
    return {
      kind: 'withoutOrder',
      key: `without-${product.id}`,
      productId: product.id,
      stock: product.stock,
      unitId: product.unitId,
      products: [{ product, stock: product.stock, packagedStock: packaged }],
    };
  }

  async function desplegar(key: string) {
    const user = setupUser();
    const fila = screen.getByTestId(`data-table-row-${key}`);
    await user.click(within(fila).getByTestId('finished-stock-toggle'));
  }

  function terminado(overrides: Partial<ProductView> = {}): ProductView {
    return producto({ type: PRODUCT_TYPES.FINISHED_PRODUCT, name: 'Jabon · Garrafa 5 L', ...overrides });
  }

  it('R8 — la línea de producto por debajo de la alerta lleva el mismo aviso, en cifra suelta', async () => {
    const product = terminado();
    render(
      <FinishedStockTable
        rows={[grupo(product, null)]}
        params={TERMINADO}
        totalPages={1}
        units={UNITS}
        canAdjust
      />,
    );
    await desplegar('without-product-1');

    const linea = screen.getByTestId('data-table-row-without-product-1--product-1');
    afirmaAviso(within(linea).getByTestId('product-stock'));
  });

  it('R8 — la línea en envases por debajo de la alerta lleva el mismo aviso y conserva su rótulo', async () => {
    const product = terminado();
    render(
      <FinishedStockTable
        rows={[grupo(product, [entrada()])]}
        params={TERMINADO}
        totalPages={1}
        units={UNITS}
        canAdjust
      />,
    );
    await desplegar('without-product-1');

    const linea = screen.getByTestId('data-table-row-without-product-1--product-1');
    const celda = within(linea).getByTestId('finished-stock-packaged');
    afirmaAviso(celda);
    expect(celda).toHaveAttribute('aria-label', '6 × Botella 250 ml');
    expect(celda).toHaveAttribute('title', '6 × Botella 250 ml');
    expect(celda).toHaveTextContent('6 × Botella 250 ml');
  });

  it('R8 — en la alerta exacta y por encima, la línea no lleva aviso', async () => {
    const product = terminado({ stock: '5' });
    render(
      <FinishedStockTable
        rows={[grupo(product, [entrada()]), grupo(terminado({ id: 'product-2', stock: '9' }), null)]}
        params={TERMINADO}
        totalPages={1}
        units={UNITS}
        canAdjust
      />,
    );
    await desplegar('without-product-1');
    await desplegar('without-product-2');

    afirmaSinAviso(
      within(screen.getByTestId('data-table-row-without-product-1--product-1')).getByTestId(
        'finished-stock-packaged',
      ),
    );
    afirmaSinAviso(
      within(screen.getByTestId('data-table-row-without-product-2--product-2')).getByTestId(
        'product-stock',
      ),
    );
  });
});
