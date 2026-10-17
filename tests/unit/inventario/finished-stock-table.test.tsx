import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FinishedStockTable,
  packagedStockLabel,
} from '@/app/(private)/inventario/components';
import type { DataTableParams } from '@/components/shared/data-table';
import {
  PRODUCT_TYPES,
  type FinishedStockRow,
  type PackagedStockEntry,
  type ProductView,
} from '@/lib/modules/inventario';
import type { UnitRef } from '@/lib/modules/unidades';
import { finishedProductDetailRoute } from '@/lib/shared/routes';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import { clickRowAction, openRowActionsMenu } from '../../helpers/row-actions-menu';
import { setupUser } from '../../helpers/user-event';

/**
 * Pestana «Producto terminado» agrupada por pedido: la fila es el pedido (o «Sin pedido») y se
 * despliega en sus productos, que conservan las acciones de producto de siempre. Las Server
 * Actions de lotes estan mockeadas: lo que se afirma es que pedido y producto llegan juntos.
 */

const {
  routerMock,
  listProductBatchesActionMock,
  listOrderBatchesActionMock,
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
  listOrderBatchesActionMock: vi.fn(),
  listBatchMovementsActionMock: vi.fn(),
  adjustBatchStockActionMock: vi.fn(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/inventario/adapters/driving/batch-actions', () => ({
  listProductBatchesAction: listProductBatchesActionMock,
  listOrderBatchesAction: listOrderBatchesActionMock,
  listBatchMovementsAction: listBatchMovementsActionMock,
  adjustBatchStockAction: adjustBatchStockActionMock,
}));

const PARAMS: DataTableParams = {
  page: 1,
  pageSize: 10,
  sort: null,
  filters: { type: { kind: 'select', values: [PRODUCT_TYPES.FINISHED_PRODUCT] } },
  search: '',
};

const MILILITRO: UnitRef = {
  id: 'unit-ml',
  name: 'Mililitro',
  symbol: 'ml',
  baseUnitId: null,
  factor: null,
};
const LITRO: UnitRef = {
  id: 'unit-l',
  name: 'Litro',
  symbol: 'L',
  baseUnitId: null,
  factor: null,
};
const UNITS: readonly UnitRef[] = [MILILITRO, LITRO];

function producto(overrides: Partial<ProductView> = {}): ProductView {
  return {
    id: 'product-1',
    name: 'Desengrasante · Botella 250 ml',
    imagePath: null,
    stock: '10',
    unitId: 'unit-l',
    qtyAlert: '3',
    type: PRODUCT_TYPES.FINISHED_PRODUCT,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function entrada(overrides: Partial<PackagedStockEntry> = {}): PackagedStockEntry {
  return { name: 'Botella 250 ml', packages: '6', remainder: null, unitId: 'unit-ml', ...overrides };
}

function pedido(overrides: Partial<Extract<FinishedStockRow, { kind: 'order' }>> = {}): FinishedStockRow {
  const product = producto();
  return {
    kind: 'order',
    key: 'order-1',
    orderId: 'order-1',
    orderNumber: { year: 2026, sequence: 7 },
    numberText: '2026-0007',
    recipeName: 'Desengrasante',
    packagedStock: [entrada()],
    products: [{ product, stock: '1.5', packagedStock: [entrada()] }],
    ...overrides,
  };
}

function sinPedido(): FinishedStockRow {
  const product = producto({ id: 'product-2', name: 'Jabon · Garrafa 5 L', qtyAlert: null });
  return {
    kind: 'withoutOrder',
    key: 'without-product-2',
    productId: 'product-2',
    stock: '12.5000',
    unitId: 'unit-l',
    products: [{ product, stock: '12.5000', packagedStock: null }],
  };
}

function montar(rows: readonly FinishedStockRow[]) {
  return render(
    <FinishedStockTable rows={rows} params={PARAMS} totalPages={1} units={UNITS} canAdjust />,
  );
}

function filaDeGrupo(key: string) {
  return screen.getByTestId(`data-table-row-${key}`);
}

/** jsdom no evalua las consultas de contenedor: la tabla y sus tarjetas estan las dos en el arbol. */
function enLaTabla() {
  return within(screen.getByRole('table'));
}

beforeEach(() => {
  vi.clearAllMocks();
  listOrderBatchesActionMock.mockResolvedValue({ status: 'success', data: [] });
  listProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [] });
});

afterEach(() => {
  cleanup();
});

describe('rotulo de existencia en envases', () => {
  it('solo envases enteros', () => {
    expect(packagedStockLabel([entrada()], UNITS)).toBe('6 × Botella 250 ml');
  });

  it('con resto, el resto lleva el simbolo de su unidad', () => {
    expect(
      packagedStockLabel([entrada({ packages: '5', remainder: '200' })], UNITS),
    ).toBe('5 × Botella 250 ml + 200 ml');
  });

  it('varias presentaciones se unen con coma, en el orden recibido', () => {
    expect(
      packagedStockLabel(
        [entrada(), entrada({ name: 'Botella 1 L', packages: '1', unitId: 'unit-l' })],
        UNITS,
      ),
    ).toBe('6 × Botella 250 ml, 1 × Botella 1 L');
  });

  it('no pluraliza', () => {
    expect(packagedStockLabel([entrada({ packages: '1' })], UNITS)).toBe('1 × Botella 250 ml');
  });
});

describe('fila de pedido', () => {
  it('pinta el numero en «# Pedido», la receta en «Nombre» y la existencia con aria-label y title exactos', () => {
    montar([
      pedido({
        packagedStock: [
          entrada({ remainder: '200' }),
          entrada({ name: 'Botella 1 L', packages: '1', unitId: 'unit-l' }),
        ],
      }),
    ]);

    const fila = filaDeGrupo('order-1');
    expect(within(fila).getByTestId('finished-stock-order-number')).toHaveTextContent(
      /^2026-0007$/,
    );
    expect(within(fila).getByTestId('finished-stock-name')).toHaveTextContent(/^Desengrasante$/);
    const rotulo = '6 × Botella 250 ml + 200 ml, 1 × Botella 1 L';
    const celda = within(fila).getByTestId('finished-stock-packaged');
    expect(celda).toHaveTextContent(rotulo);
    expect(celda).toHaveAttribute('aria-label', rotulo);
    expect(celda).toHaveAttribute('title', rotulo);
  });

  it('sin receta, el numero sigue en «# Pedido» y «Nombre» pinta el marcador de vacio', () => {
    montar([pedido({ recipeName: null })]);
    const fila = filaDeGrupo('order-1');
    expect(within(fila).getByTestId('finished-stock-order-number')).toHaveTextContent(
      /^2026-0007$/,
    );
    expect(within(fila).getByTestId('finished-stock-name')).toHaveTextContent(EMPTY_MARK);
  });

  it('la columna «# Pedido» va entre la imagen y «Nombre» y queda vacia en las sub-filas', async () => {
    const user = setupUser();
    montar([pedido()]);
    const cabeceras = screen
      .getAllByRole('columnheader')
      .map((th) => th.textContent?.trim() ?? '');
    const posicion = cabeceras.indexOf('# Pedido');
    expect(posicion).toBeGreaterThan(-1);
    expect(cabeceras[posicion + 1]).toBe('Nombre');

    await user.click(enLaTabla().getByTestId('finished-stock-toggle'));
    const sub = screen.getByTestId('data-table-row-order-1--product-1');
    expect(within(sub).queryByTestId('finished-stock-order-number')).toBeNull();
  });

  it('sin existencia en envases pinta el marcador de vacio', () => {
    montar([pedido({ packagedStock: null })]);
    const fila = filaDeGrupo('order-1');
    expect(within(fila).queryByTestId('finished-stock-packaged')).toBeNull();
    expect(within(fila).getByTestId('data-table-cell-stock')).toHaveTextContent(EMPTY_MARK);
  });

  it('no ofrece acciones de producto, solo el control de desplegar', () => {
    montar([pedido()]);
    const fila = filaDeGrupo('order-1');
    expect(within(fila).queryByTestId('product-batches-open')).toBeNull();
    expect(within(fila).queryByTestId('product-edit-open')).toBeNull();
    expect(within(fila).queryByTestId('product-delete-open')).toBeNull();
    const toggle = within(fila).getByRole('button', {
      name: 'Productos de Pedido 2026-0007 · Desengrasante',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('nombre y presentacion', () => {
  it('la sub-fila pinta el nombre sin la presentacion y la presentacion en su columna', async () => {
    const user = setupUser();
    const conPresentacion = producto({ presentationId: 'presentation-1', presentationName: 'Botella 250 ml' });
    montar([pedido({ products: [{ product: conPresentacion, stock: '1.5', packagedStock: [entrada()] }] })]);

    expect(within(filaDeGrupo('order-1')).getByTestId('data-table-cell-presentationName').textContent).toBe('');
    await user.click(enLaTabla().getByTestId('finished-stock-toggle'));

    const sub = screen.getByTestId('data-table-row-order-1--product-1');
    expect(within(sub).getByTestId('finished-stock-line-name').textContent).toBe('Desengrasante');
    expect(within(sub).getByTestId('data-table-cell-presentationName').textContent).toBe('Botella 250 ml');
  });

  it('sin presentacion conocida, el nombre queda entero y la columna pinta el marcador', async () => {
    const user = setupUser();
    montar([pedido()]);
    await user.click(enLaTabla().getByTestId('finished-stock-toggle'));

    const sub = screen.getByTestId('data-table-row-order-1--product-1');
    expect(within(sub).getByTestId('finished-stock-line-name').textContent).toBe(
      'Desengrasante · Botella 250 ml',
    );
    expect(within(sub).getByTestId('data-table-cell-presentationName')).toHaveTextContent(EMPTY_MARK);
  });

  it('la fila sin pedido pinta el nombre sin la presentacion y la presentacion en su columna', () => {
    const product = producto({
      id: 'product-2',
      name: 'Jabon · Garrafa 5 L',
      presentationId: 'presentation-2',
      presentationName: 'Garrafa 5 L',
    });
    montar([
      {
        kind: 'withoutOrder',
        key: 'without-product-2',
        productId: 'product-2',
        stock: '12.5000',
        unitId: 'unit-l',
        products: [{ product, stock: '12.5000', packagedStock: null }],
      },
    ]);

    const grupo = filaDeGrupo('without-product-2');
    expect(within(grupo).getByTestId('finished-stock-name').textContent).toBe('Jabon');
    expect(within(grupo).getByTestId('data-table-cell-presentationName').textContent).toBe('Garrafa 5 L');
  });
});

describe('desplegar', () => {
  it('muestra una sub-fila por producto con existencia, alerta y acciones; plegar las quita', async () => {
    const user = setupUser();
    montar([pedido()]);
    expect(screen.queryByTestId('data-table-row-order-1--product-1')).toBeNull();

    const toggle = enLaTabla().getByTestId('finished-stock-toggle');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const sub = screen.getByTestId('data-table-row-order-1--product-1');
    expect(within(sub).getByTestId('finished-stock-line-name')).toHaveTextContent(
      'Desengrasante · Botella 250 ml',
    );
    const existencia = within(sub).getByTestId('finished-stock-packaged');
    expect(existencia).toHaveAttribute('aria-label', '6 × Botella 250 ml');
    expect(existencia).toHaveAttribute('title', '6 × Botella 250 ml');
    expect(within(sub).getByTestId('product-qty-alert')).toHaveTextContent('3');
    const menu = await openRowActionsMenu(user, within(sub).getByTestId('product-row-actions'));
    expect(
      within(menu).getAllByRole('menuitem').map((item) => item.getAttribute('data-testid')),
    ).toEqual([
      'product-batches-open',
      'product-history-open',
      'product-adjust-open',
      'product-edit-open',
      'product-delete-open',
    ]);
    await user.keyboard('{Escape}');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('data-table-row-order-1--product-1')).toBeNull();
  });

  it('R26: el nombre de cada sub-fila enlaza a la ficha de su producto y la fila de grupo no lleva enlace', async () => {
    const user = setupUser();
    const otro = producto({ id: 'product-3', name: 'Desengrasante · Botella 1 L' });
    montar([
      pedido({
        products: [
          { product: producto(), stock: '1.5', packagedStock: [entrada()] },
          { product: otro, stock: '2', packagedStock: null },
        ],
      }),
    ]);

    const fila = filaDeGrupo('order-1');
    expect(within(fila).queryByRole('link')).toBeNull();
    expect(within(fila).queryByTestId('finished-stock-line-link')).toBeNull();

    await user.click(enLaTabla().getByTestId('finished-stock-toggle'));

    const primera = within(screen.getByTestId('data-table-row-order-1--product-1')).getByTestId(
      'finished-stock-line-link',
    );
    expect(primera).toHaveAttribute('href', finishedProductDetailRoute('product-1'));
    expect(primera).toHaveAccessibleName('Desengrasante · Botella 250 ml');

    const segunda = within(screen.getByTestId('data-table-row-order-1--product-3')).getByTestId(
      'finished-stock-line-link',
    );
    expect(segunda).toHaveAttribute('href', finishedProductDetailRoute('product-3'));
    expect(within(fila).queryByRole('link')).toBeNull();
  });

  it('una sub-fila sin envases pinta existencia y unidad', async () => {
    const user = setupUser();
    const product = producto();
    montar([pedido({ products: [{ product, stock: '1.5', packagedStock: null }] })]);
    await user.click(enLaTabla().getByTestId('finished-stock-toggle'));

    const sub = screen.getByTestId('data-table-row-order-1--product-1');
    expect(within(sub).getByTestId('product-stock')).toHaveAttribute('aria-label', '1.5 L');
  });

  it('el panel de lotes de la sub-fila pide solo los lotes de ese pedido y ese producto', async () => {
    const user = setupUser();
    montar([pedido()]);
    await user.click(enLaTabla().getByTestId('finished-stock-toggle'));

    const sub = screen.getByTestId('data-table-row-order-1--product-1');
    await clickRowAction(user, within(sub).getByTestId('product-row-actions'), 'product-batches-open');

    expect(await screen.findByTestId('product-batches-sheet')).toBeInTheDocument();
    expect(listOrderBatchesActionMock).toHaveBeenCalledWith('order-1', 'product-1');
    expect(listProductBatchesActionMock).not.toHaveBeenCalled();
  });

  it('R12 — «Historial» de una linea pide los lotes de ese pedido y ese producto y, con uno, abre su historial', async () => {
    const user = setupUser();
    listOrderBatchesActionMock.mockResolvedValue({
      status: 'success',
      data: [
        {
          id: 'batch-7',
          lot: 'L-007',
          stock: '2',
          unitId: 'unit-l',
          purchaseDate: '2026-03-05',
          expiryDate: null,
          packageContent: null,
        },
      ],
    });
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [] });
    montar([pedido()]);
    await user.click(enLaTabla().getByTestId('finished-stock-toggle'));

    const sub = screen.getByTestId('data-table-row-order-1--product-1');
    await clickRowAction(user, within(sub).getByTestId('product-row-actions'), 'product-history-open');

    expect(await screen.findByTestId('batch-history-before-ledger')).toBeInTheDocument();
    expect(listOrderBatchesActionMock).toHaveBeenCalledWith('order-1', 'product-1');
    expect(listProductBatchesActionMock).not.toHaveBeenCalled();
    expect(listBatchMovementsActionMock).toHaveBeenCalledWith('batch-7');
    expect(screen.queryByTestId('product-batches-sheet')).toBeNull();
  });

  it('R12 — la fila del pedido no pinta menu ni en la tabla ni en su tarjeta', () => {
    montar([pedido()]);

    expect(within(filaDeGrupo('order-1')).queryByTestId('product-row-actions')).toBeNull();
    expect(within(screen.getByTestId('data-table-card-order-1')).queryByTestId('product-row-actions')).toBeNull();
  });

  it('dar de baja desde la sub-fila abre el dialogo del producto', async () => {
    const user = setupUser();
    montar([pedido()]);
    await user.click(enLaTabla().getByTestId('finished-stock-toggle'));

    const sub = screen.getByTestId('data-table-row-order-1--product-1');
    await clickRowAction(user, within(sub).getByTestId('product-row-actions'), 'product-delete-open');
    expect(await screen.findByTestId('delete-product-dialog')).toBeInTheDocument();
  });

  it('editar desde la sub-fila abre el panel del producto terminado con el tipo de solo lectura', async () => {
    const user = setupUser();
    montar([pedido()]);
    await user.click(enLaTabla().getByTestId('finished-stock-toggle'));

    const sub = screen.getByTestId('data-table-row-order-1--product-1');
    await clickRowAction(user, within(sub).getByTestId('product-row-actions'), 'product-edit-open');
    expect(await screen.findByTestId('product-field-type-readonly')).toBeInTheDocument();
  });
});

describe('fila «Sin pedido»', () => {
  it('pinta «Sin pedido» en «# Pedido», el producto en «Nombre» y la existencia con su unidad', () => {
    montar([sinPedido()]);
    const fila = filaDeGrupo('without-product-2');
    expect(within(fila).getByTestId('finished-stock-order-number')).toHaveTextContent(
      /^Sin pedido$/,
    );
    expect(within(fila).getByTestId('finished-stock-name')).toHaveTextContent(
      /^Jabon · Garrafa 5 L$/,
    );
    const existencia = within(fila).getByTestId('product-stock');
    expect(existencia).toHaveTextContent(/^12\.5 L$/);
    expect(existencia).toHaveAttribute('aria-label', '12.5 L');
  });

  it('se despliega igual y su panel de lotes pide los lotes sin pedido del producto', async () => {
    const user = setupUser();
    montar([sinPedido()]);
    const toggle = enLaTabla().getByTestId('finished-stock-toggle');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const sub = screen.getByTestId('data-table-row-without-product-2--product-2');
    expect(within(sub).getByTestId('data-table-cell-qtyAlert')).toHaveTextContent(EMPTY_MARK);
    await clickRowAction(user, within(sub).getByTestId('product-row-actions'), 'product-batches-open');

    expect(await screen.findByTestId('product-batches-sheet')).toBeInTheDocument();
    expect(listOrderBatchesActionMock).toHaveBeenCalledWith(null, 'product-2');
  });
});

describe('rotulos de la tarjeta', () => {
  function campo(card: HTMLElement, columnId: string): HTMLElement {
    return within(card).getByTestId(`data-table-card-field-${columnId}`);
  }

  function rotulo(field: HTMLElement): string | null {
    return field.querySelector('[data-card-label]')?.textContent?.trim() ?? null;
  }

  it('R55 — la tarjeta de la linea rotula «Existencia» y «Alerta», con la cifra intacta', async () => {
    const user = setupUser();
    montar([pedido({ packagedStock: null, products: [{ product: producto(), stock: '10', packagedStock: null }] })]);

    await user.click(enLaTabla().getByTestId('finished-stock-toggle'));
    const card = await screen.findByTestId('data-table-card-order-1--product-1');

    expect(rotulo(campo(card, 'stock'))).toBe('Existencia');
    expect(rotulo(campo(card, 'qtyAlert'))).toBe('Alerta');
    expect(within(campo(card, 'stock')).getByTestId('product-stock').textContent).toBe('10 L');
    expect(within(campo(card, 'qtyAlert')).getByTestId('product-qty-alert').textContent).toBe('3 L');
    for (const label of campo(card, 'stock').querySelectorAll('[data-card-label]')) {
      expect(label).toHaveClass('[table_&]:hidden');
    }
  });

  it('R55 — la tarjeta del pedido rotula su existencia y no la alerta, que no tiene', () => {
    montar([sinPedido()]);

    const card = screen.getByTestId('data-table-card-without-product-2');
    expect(rotulo(campo(card, 'stock'))).toBe('Existencia');
    expect(campo(card, 'qtyAlert')).toBeEmptyDOMElement();
  });
});
