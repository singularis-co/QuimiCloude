// El anfitrión único de la tabla de productos: lo que abre cada ítem del menú de la fila, con
// «Historial» y «Ajustar existencia» decidiendo por los lotes del producto, y las sub-filas de
// lote y de estado sin menú.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductTable, batchTarget } from '@/app/(private)/inventario/components';
import type { DataTableParams } from '@/components/shared/data-table';
import { PRODUCT_TYPES, type ProductBatchView, type ProductView } from '@/lib/modules/inventario';

import { clickRowAction } from '../../helpers/row-actions-menu';
import { setupUser } from '../../helpers/user-event';

const {
  routerMock,
  listProductBatchesActionMock,
  listAliveProductBatchesActionMock,
  listBatchMovementsActionMock,
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
  listAliveProductBatchesActionMock: vi.fn(),
  listBatchMovementsActionMock: vi.fn(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/inventario/adapters/driving/batch-actions', () => ({
  listProductBatchesAction: listProductBatchesActionMock,
  listAliveProductBatchesAction: listAliveProductBatchesActionMock,
  listOrderBatchesAction: vi.fn(),
  listBatchMovementsAction: listBatchMovementsActionMock,
  adjustBatchStockAction: vi.fn(),
}));

const PARAMS: DataTableParams = { page: 1, pageSize: 20, sort: null, filters: {}, search: '' };

function producto(overrides: Partial<ProductView> = {}): ProductView {
  return {
    id: 'product-1',
    name: 'Acido citrico',
    imagePath: null,
    stock: '12',
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
    unitId: null,
    purchaseDate: '2026-03-05',
    expiryDate: null,
    packageContent: null,
    ...overrides,
  };
}

const ACIDO = producto();
const SOSA = producto({ id: 'product-2', name: 'Sosa caustica' });

function montar(products: readonly ProductView[] = [ACIDO, SOSA]) {
  render(<ProductTable products={products} params={PARAMS} totalPages={1} canAdjust />);
}

function disparador(productId: string): HTMLElement {
  return within(screen.getByTestId(`data-table-row-${productId}`)).getByTestId('product-row-actions');
}

async function elegir(productId: string, itemTestId: string) {
  const user = setupUser();
  await clickRowAction(user, disparador(productId), itemTestId);
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  listProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [] });
  listAliveProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [] });
  listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [] });
});

afterEach(cleanup);

describe('batchTarget', () => {
  it('R11 — con exactamente un lote lo elige; con ninguno o con varios, se elige en «Lotes»', () => {
    const uno = lote();
    expect(batchTarget([uno])).toEqual({ kind: 'single', batch: uno });
    expect(batchTarget([])).toEqual({ kind: 'choose' });
    expect(batchTarget([uno, lote({ id: 'batch-2', lot: 'L-002' })])).toEqual({ kind: 'choose' });
  });
});

describe('«Lotes», «Editar» y «Borrar» abren lo de hoy para el producto de la fila', () => {
  it('R12 — «Lotes» abre el panel de lotes del producto y pide sus lotes', async () => {
    montar();
    await elegir(SOSA.id, 'product-batches-open');

    const panel = await screen.findByTestId('product-batches-sheet');
    expect(within(panel).getByRole('heading', { name: 'Sosa caustica' })).toBeInTheDocument();
    expect(listProductBatchesActionMock).toHaveBeenCalledWith(SOSA.id);
  });

  it('R12 — «Editar» abre el panel de edicion del producto', async () => {
    montar();
    await elegir(SOSA.id, 'product-edit-open');

    expect(await screen.findByTestId('product-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('product-form')).toBeInTheDocument();
  });

  it('R12 — «Borrar» abre el dialogo de borrado con el id del producto', async () => {
    montar();
    await elegir(SOSA.id, 'product-delete-open');

    const dialogo = await screen.findByTestId('delete-product-dialog');
    expect(within(dialogo).getByTestId('delete-product-message')).toHaveTextContent('Sosa caustica');
    expect(screen.getByTestId('delete-product-id')).toHaveValue(SOSA.id);
  });

  it('R12 — un solo panel montado a la vez: cerrar «Lotes» y abrir «Borrar» de otra fila deja solo el borrado', async () => {
    montar();
    const user = await elegir(ACIDO.id, 'product-batches-open');
    await screen.findByTestId('product-batches-sheet');
    await user.keyboard('{Escape}');

    await clickRowAction(user, disparador(SOSA.id), 'product-delete-open');

    expect(await screen.findByTestId('delete-product-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('product-batches-sheet')).toBeNull();
    expect(screen.getByTestId('delete-product-id')).toHaveValue(SOSA.id);
  });
});

describe('«Historial» y «Ajustar existencia» deciden por los lotes del producto', () => {
  it('R11 — «Historial» con un lote abre el historial de ese lote', async () => {
    listProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [lote()] });
    montar();
    await elegir(ACIDO.id, 'product-history-open');

    expect(await screen.findByTestId('batch-history-before-ledger')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Historial del lote L-001' })).toBeInTheDocument();
    expect(screen.queryByTestId('batch-history-trigger')).toBeNull();
    expect(listProductBatchesActionMock).toHaveBeenCalledWith(ACIDO.id);
    expect(listBatchMovementsActionMock).toHaveBeenCalledWith('batch-1');
    expect(screen.queryByTestId('product-batches-sheet')).toBeNull();
  });

  it('R11 — «Ajustar existencia» con un lote abre el ajuste de ese lote', async () => {
    listProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [lote({ lot: 'L-777' })] });
    montar();
    await elegir(ACIDO.id, 'product-adjust-open');

    await screen.findByTestId('adjust-batch-dialog');
    expect(screen.getByTestId('adjust-batch-description')).toHaveTextContent('Acido citrico · Lote L-777');
    expect(screen.queryByTestId('adjust-batch-open')).toBeNull();
    expect(screen.queryByTestId('product-batches-sheet')).toBeNull();
  });

  it.each([
    ['sin lotes', [] as ProductBatchView[]],
    ['con varios lotes', [lote(), lote({ id: 'batch-2', lot: 'L-002' })]],
  ])('R11 — «Historial» %s abre «Lotes» para elegir', async (_caso, lotes) => {
    listProductBatchesActionMock.mockResolvedValue({ status: 'success', data: lotes });
    montar();
    await elegir(ACIDO.id, 'product-history-open');

    const panel = await screen.findByTestId('product-batches-sheet');
    expect(within(panel).getByRole('heading', { name: 'Acido citrico' })).toBeInTheDocument();
    expect(screen.queryByTestId('batch-history-before-ledger')).toBeNull();
  });

  it('R11 — «Ajustar existencia» con varios lotes abre «Lotes» para elegir', async () => {
    listProductBatchesActionMock.mockResolvedValue({
      status: 'success',
      data: [lote(), lote({ id: 'batch-2', lot: 'L-002' })],
    });
    montar();
    await elegir(ACIDO.id, 'product-adjust-open');

    expect(await screen.findByTestId('product-batches-sheet')).toBeInTheDocument();
    expect(screen.queryByTestId('adjust-batch-dialog')).toBeNull();
  });

  it('R11 — con un error al leer los lotes abre «Lotes», que pinta su error', async () => {
    listProductBatchesActionMock.mockResolvedValue({
      status: 'error',
      code: 'unexpected',
      message: 'No se pudieron leer los lotes.',
    });
    montar();
    await elegir(ACIDO.id, 'product-history-open');

    expect(await screen.findByTestId('product-batches-error')).toHaveTextContent('No se pudieron leer los lotes.');
  });

  it('R11 — lee todos los lotes, no solo los vivos: con un lote vivo y otro agotado abre «Lotes»', async () => {
    listAliveProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [lote()] });
    listProductBatchesActionMock.mockResolvedValue({
      status: 'success',
      data: [lote(), lote({ id: 'batch-2', lot: 'L-AGOTADO', stock: '0' })],
    });
    montar();
    await elegir(ACIDO.id, 'product-history-open');

    expect(await screen.findByTestId('product-batches-sheet')).toBeInTheDocument();
    expect(listProductBatchesActionMock).toHaveBeenCalledWith(ACIDO.id);
    expect(listAliveProductBatchesActionMock).not.toHaveBeenCalled();
  });

  it('R11 — mientras se piden los lotes no se abre nada', async () => {
    listProductBatchesActionMock.mockReturnValue(new Promise(() => undefined));
    montar();
    await elegir(ACIDO.id, 'product-history-open');

    await waitFor(() => expect(listProductBatchesActionMock).toHaveBeenCalledWith(ACIDO.id));
    expect(screen.queryByTestId('product-batches-sheet')).toBeNull();
    expect(screen.queryByTestId('batch-history-trigger')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('las sub-filas no tienen menu', () => {
  it('R12, R47 — desplegado, ni las sub-filas de lote ni sus tarjetas pintan «Acciones»', async () => {
    listAliveProductBatchesActionMock.mockResolvedValue({
      status: 'success',
      data: [lote(), lote({ id: 'batch-2', lot: 'L-002' })],
    });
    const user = setupUser();
    montar([ACIDO]);
    await user.click(
      within(screen.getByTestId(`data-table-row-${ACIDO.id}`)).getByRole('button', {
        name: 'Mostrar lotes de Acido citrico',
      }),
    );
    await screen.findByTestId(`data-table-row-${ACIDO.id}--batch-batch-2`);

    for (const id of [`${ACIDO.id}--batch-batch-1`, `${ACIDO.id}--batch-batch-2`]) {
      expect(within(screen.getByTestId(`data-table-row-${id}`)).queryByTestId('product-row-actions')).toBeNull();
      expect(within(screen.getByTestId(`data-table-card-${id}`)).queryByTestId('product-row-actions')).toBeNull();
    }
    expect(screen.getAllByTestId('product-row-actions')).toHaveLength(2);
  });

  it('R12, R47 — la sub-fila de estado (cargando) tampoco pinta menu', async () => {
    listAliveProductBatchesActionMock.mockReturnValue(new Promise(() => undefined));
    const user = setupUser();
    montar([ACIDO]);
    await user.click(
      within(screen.getByTestId(`data-table-row-${ACIDO.id}`)).getByRole('button', {
        name: 'Mostrar lotes de Acido citrico',
      }),
    );

    const id = `${ACIDO.id}--batches`;
    expect(within(screen.getByTestId(`data-table-row-${id}`)).queryByTestId('product-row-actions')).toBeNull();
    expect(within(screen.getByTestId(`data-table-card-${id}`)).queryByTestId('product-row-actions')).toBeNull();
  });
});
