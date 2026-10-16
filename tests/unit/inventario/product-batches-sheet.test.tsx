import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductTable } from '@/app/(private)/inventario/components';
import type { DataTableParams } from '@/components/shared/data-table';
import { PRODUCT_TYPES, type ProductBatchView, type ProductView } from '@/lib/modules/inventario';
import type { UnitRef } from '@/lib/modules/unidades';
import { clickRowAction, openRowActionsMenu } from '../../helpers/row-actions-menu';
import { esperarInteractiva, setupUser } from '../../helpers/user-event';

/**
 * Enganche del panel de lotes al listado (R22, `specs/QC-92-ajuste-de-inventario/tasks.md > T13`).
 *
 * `ProductTable` se monta sola, con una fila, sin `ProductListSection` ni `lib/composition`: lo
 * que se afirma aqui es que la fila abre el panel del producto correcto y que este pide sus lotes
 * a `listProductBatchesAction`. Las tres Server Actions del modulo estan mockeadas, mismo criterio
 * que `batch-history.test.tsx` y `adjust-batch-dialog.test.tsx`.
 */

const {
  routerMock,
  listProductBatchesActionMock,
  listBatchMovementsActionMock,
  adjustBatchStockActionMock,
} = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  },
  listProductBatchesActionMock: vi.fn(),
  listBatchMovementsActionMock: vi.fn(),
  adjustBatchStockActionMock: vi.fn(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/inventario/adapters/driving/batch-actions', () => ({
  listProductBatchesAction: listProductBatchesActionMock,
  listBatchMovementsAction: listBatchMovementsActionMock,
  adjustBatchStockAction: adjustBatchStockActionMock,
}));

const PARAMS: DataTableParams = {
  page: 1,
  pageSize: 20,
  sort: null,
  filters: {},
  search: '',
};

function producto(overrides: Partial<ProductView> = {}): ProductView {
  return {
    id: 'product-9',
    name: 'Acido citrico',
    imagePath: null,
    stock: '0',
    unitId: null,
    qtyAlert: null,
    type: PRODUCT_TYPES.PRODUCT,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function lote(overrides: Partial<ProductBatchView> = {}): ProductBatchView {
  return {
    id: 'batch-1',
    lot: 'L-001',
    stock: '12',
    unitId: 'unit-kg',
    purchaseDate: '2026-03-05',
    expiryDate: null,
    packageContent: null,
    ...overrides,
  };
}

async function abrirPanel() {
  const user = setupUser();
  await clickRowAction(user, within(screen.getByRole('table')).getByTestId('product-row-actions'), 'product-batches-open');
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  listProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [] });
});

afterEach(() => {
  cleanup();
});

describe('la fila abre el panel de lotes DEL producto (R22)', () => {
  it('pide los lotes de ese producto y pinta lote, cantidad con unidad y fecha', async () => {
    const batches = [lote({ id: 'b1', lot: 'L-001', stock: '12', purchaseDate: '2026-03-05' })];
    listProductBatchesActionMock.mockResolvedValue({ status: 'success', data: batches });

    render(
      <ProductTable
        products={[producto({ id: 'product-9' })]}
        params={PARAMS}
        totalPages={1}
      />,
    );

    await abrirPanel();

    await waitFor(() => expect(listProductBatchesActionMock).toHaveBeenCalledWith('product-9'));

    const fila = await screen.findByTestId('data-table-row-b1');
    expect(within(fila).getByTestId('product-batch-lot')).toHaveTextContent('L-001');
    expect(within(fila).getByTestId('product-batch-quantity')).toHaveTextContent('12');
    expect(within(fila).getByTestId('product-batch-purchase-date')).toHaveTextContent('2026-03-05');
  });
});

describe('R15, R20 — cabecera y ancho del panel', () => {
  it('R15 — pinta «Lotes» encima del titulo, que sigue siendo el nombre del producto', async () => {
    render(<ProductTable products={[producto({ name: 'Acido citrico' })]} params={PARAMS} totalPages={1} />);

    await abrirPanel();

    const titulo = await screen.findByRole('heading', { name: 'Acido citrico' });
    const etiqueta = screen.getByTestId('product-batches-label');
    expect(etiqueta).toHaveTextContent(/^Lotes$/);
    expect(etiqueta.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(etiqueta.closest('[data-slot="sheet-header"]')).toBe(titulo.closest('[data-slot="sheet-header"]'));
    expect(screen.getByRole('dialog', { name: 'Acido citrico' })).toBeInTheDocument();
  });

  it('R20 — mide hasta 900 px y ocupa todo el ancho en una ventana mas estrecha', async () => {
    render(<ProductTable products={[producto()]} params={PARAMS} totalPages={1} />);

    await abrirPanel();

    const panel = await screen.findByTestId('product-batches-sheet');
    expect(panel).toHaveClass('data-[side=right]:w-full', 'data-[side=right]:sm:max-w-[900px]');
    expect(panel).not.toHaveClass('data-[side=right]:w-3/4');
    expect(panel).not.toHaveClass('data-[side=right]:sm:max-w-sm');
  });
});

describe('R16 — estados del panel', () => {
  it('R16 — mientras se piden los lotes pinta «Cargando lotes…»', async () => {
    listProductBatchesActionMock.mockReturnValue(new Promise(() => {}));
    render(<ProductTable products={[producto()]} params={PARAMS} totalPages={1} />);

    await abrirPanel();

    expect(await screen.findByTestId('product-batches-loading')).toHaveTextContent('Cargando lotes…');
  });

  it('R16 — sin lotes pinta el vacio de hoy', async () => {
    render(<ProductTable products={[producto()]} params={PARAMS} totalPages={1} />);

    await abrirPanel();

    expect(await screen.findByTestId('product-batches-panel')).toHaveTextContent(
      'Este producto todavía no tiene lotes registrados.',
    );
  });
});

async function abrirMenuDelLote(lot: string) {
  const fila = await screen.findByTestId('data-table-row-b1');
  return within(fila).getByRole('button', { name: `Acciones del lote ${lot}` });
}

describe('R18 — el menu de cada lote', () => {
  it('R18 — con permiso ofrece «Historial» y «Ajustar existencia», en ese orden', async () => {
    listProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [lote({ id: 'b1' })] });
    render(<ProductTable products={[producto()]} params={PARAMS} totalPages={1} canAdjust />);

    const user = await abrirPanel();
    const menu = await openRowActionsMenu(user, await abrirMenuDelLote('L-001'));

    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['Historial', 'Ajustar existencia']);
    expect(items.map((item) => item.getAttribute('data-testid'))).toEqual([
      'batch-history-trigger',
      'adjust-batch-open',
    ]);
  });

  it('R18 — sin permiso solo ofrece «Historial»', async () => {
    listProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [lote({ id: 'b1' })] });
    render(<ProductTable products={[producto()]} params={PARAMS} totalPages={1} canAdjust={false} />);

    const user = await abrirPanel();
    const menu = await openRowActionsMenu(user, await abrirMenuDelLote('L-001'));

    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Historial']);
    expect(within(menu).queryByTestId('adjust-batch-open')).toBeNull();
  });

  it('R18 — «Historial» abre el historial de ese lote encima del panel', async () => {
    listProductBatchesActionMock.mockResolvedValue({
      status: 'success',
      data: [lote({ id: 'b1', lot: 'L-001' })],
    });
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [] });
    render(<ProductTable products={[producto()]} params={PARAMS} totalPages={1} />);

    const user = await abrirPanel();
    await clickRowAction(user, await abrirMenuDelLote('L-001'), 'batch-history-trigger');

    await waitFor(() => expect(listBatchMovementsActionMock).toHaveBeenCalledWith('b1'));
    expect(await screen.findByTestId('batch-history-lot')).toHaveTextContent('L-001');
    expect(screen.getByTestId('product-batches-sheet')).toBeInTheDocument();
  });

  it('R18 — «Ajustar existencia» abre el ajuste de ese lote y, tras ajustar, se vuelven a pedir los lotes', async () => {
    listProductBatchesActionMock.mockResolvedValue({
      status: 'success',
      data: [lote({ id: 'b1', lot: 'L-001', stock: '12' })],
    });
    adjustBatchStockActionMock.mockResolvedValue({
      status: 'success',
      stock: '10.0000',
      reserved: '0.0000',
      overReserved: false,
    });
    render(<ProductTable products={[producto()]} params={PARAMS} totalPages={1} canAdjust />);

    const user = await abrirPanel();
    await clickRowAction(user, await abrirMenuDelLote('L-001'), 'adjust-batch-open');

    expect(await screen.findByTestId('adjust-batch-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('adjust-batch-description')).toHaveTextContent('Acido citrico · Lote L-001');
    await user.type(screen.getByTestId('adjust-batch-counted'), '10');
    await user.click(screen.getByTestId('adjust-batch-reason'));
    await user.click(await esperarInteractiva(await screen.findByRole('option', { name: 'Merma' })));
    await user.click(screen.getByTestId('adjust-batch-confirm'));

    await waitFor(() => expect(adjustBatchStockActionMock).toHaveBeenCalledTimes(1));
    const enviado = adjustBatchStockActionMock.mock.calls[0]?.[1] as FormData;
    expect(enviado.get('batchId')).toBe('b1');
    await waitFor(() => expect(listProductBatchesActionMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('data-table-row-b1')).toBeInTheDocument();
    // Una sola recarga por ajuste, no una por cada repintado del panel.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(listProductBatchesActionMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('product-batches-sheet')).toBeInTheDocument();
  });
});

describe('el estado de error se distingue del panel con datos (R22)', () => {
  it('pinta el mensaje con role="alert" y no el panel de lotes', async () => {
    listProductBatchesActionMock.mockResolvedValue({
      status: 'error',
      code: 'unexpected_error',
      message: 'No se pudieron cargar los lotes.',
      reference: 'req-1',
    });

    render(
      <ProductTable
        products={[producto({ id: 'product-9' })]}
        params={PARAMS}
        totalPages={1}
      />,
    );

    await abrirPanel();

    const aviso = await screen.findByTestId('product-batches-error');
    expect(aviso).toHaveAttribute('role', 'alert');
    expect(aviso).toHaveTextContent('No se pudieron cargar los lotes.');
    expect(screen.queryByTestId('product-batches-panel')).toBeNull();
  });
});

describe('canAdjust decide si el control de ajuste existe en el DOM (R22, R21)', () => {
  it('sin canAdjust el panel se ve pero el control de ajuste NO existe', async () => {
    listProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [lote()] });

    render(
      <ProductTable
        products={[producto({ id: 'product-9' })]}
        params={PARAMS}
        totalPages={1}
        canAdjust={false}
      />,
    );

    await abrirPanel();

    expect(await screen.findByTestId('product-batches-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('adjust-batch-open')).toBeNull();
  });

  it('con canAdjust el control de ajuste SI existe, en el menu del lote', async () => {
    listProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [lote({ id: 'b1' })] });

    render(
      <ProductTable
        products={[producto({ id: 'product-9' })]}
        params={PARAMS}
        totalPages={1}
        canAdjust
      />,
    );

    const user = await abrirPanel();
    const menu = await openRowActionsMenu(user, await abrirMenuDelLote('L-001'));

    expect(within(menu).getByTestId('adjust-batch-open')).toBeInTheDocument();
  });
});

const UNIDAD_KG: UnitRef = {
  id: 'unit-kg',
  name: 'Kilogramo',
  symbol: 'kg',
  baseUnitId: null,
  factor: null,
};

describe('el panel se titula "nombre · unidad" (T15)', () => {
  it('con catalogo y unidad, el titulo y el aria-label del disparador llevan el simbolo', async () => {
    render(
      <ProductTable
        products={[producto({ id: 'product-9', name: 'Acido citrico', unitId: 'unit-kg' })]}
        params={PARAMS}
        totalPages={1}
        units={[UNIDAD_KG]}
      />,
    );

    expect(
      within(screen.getByRole('table')).getByRole('button', { name: 'Acciones de Acido citrico · kg' }),
    ).toBeInTheDocument();

    await abrirPanel();

    expect(await screen.findByRole('heading', { name: 'Acido citrico · kg' })).toBeInTheDocument();
  });

  it('sin catalogo de unidades, el titulo y el aria-label solo llevan el nombre', async () => {
    render(
      <ProductTable
        products={[producto({ id: 'product-9', name: 'Acido citrico', unitId: 'unit-kg' })]}
        params={PARAMS}
        totalPages={1}
      />,
    );

    expect(within(screen.getByRole('table')).getByRole('button', { name: 'Acciones de Acido citrico' })).toBeInTheDocument();

    await abrirPanel();

    expect(await screen.findByRole('heading', { name: 'Acido citrico' })).toBeInTheDocument();
  });

  it('con catalogo pero sin unidad en el producto, el titulo y el aria-label solo llevan el nombre', async () => {
    render(
      <ProductTable
        products={[producto({ id: 'product-9', name: 'Acido citrico', unitId: null })]}
        params={PARAMS}
        totalPages={1}
        units={[UNIDAD_KG]}
      />,
    );

    expect(within(screen.getByRole('table')).getByRole('button', { name: 'Acciones de Acido citrico' })).toBeInTheDocument();

    await abrirPanel();

    expect(await screen.findByRole('heading', { name: 'Acido citrico' })).toBeInTheDocument();
  });
});
