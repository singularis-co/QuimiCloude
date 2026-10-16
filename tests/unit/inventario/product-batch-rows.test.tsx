import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductTable } from '@/app/(private)/inventario/components';
import type { DataTableParams } from '@/components/shared/data-table';
import { PRODUCT_TYPES, type ProductBatchView, type ProductView } from '@/lib/modules/inventario';
import type { UnitRef } from '@/lib/modules/unidades';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import { setupUser } from '../../helpers/user-event';

/**
 * Filas de lotes desplegables en la tabla de productos (Todos/Producto/Maquina/Envase): carga
 * perezosa al desplegar, cache por producto, solo lotes vivos y aviso de vencimiento cercano.
 * Los lotes vivos los filtra el servidor (`listAliveProductBatchesAction`): la tabla pinta lo que
 * recibe, sin filtrar en el cliente.
 */

const { routerMock, listAliveProductBatchesActionMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  },
  listAliveProductBatchesActionMock: vi.fn(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/inventario/adapters/driving/batch-actions', () => ({
  listProductBatchesAction: vi.fn(),
  listAliveProductBatchesAction: listAliveProductBatchesActionMock,
  listOrderBatchesAction: vi.fn(),
  listBatchMovementsAction: vi.fn(),
  adjustBatchStockAction: vi.fn(),
}));

const TODOS: DataTableParams = { page: 1, pageSize: 20, sort: null, filters: {}, search: '' };
const UNITS: readonly UnitRef[] = [{ id: 'unit-kg', name: 'Kilogramo', symbol: 'kg' } as UnitRef];

function producto(overrides: Partial<ProductView> = {}): ProductView {
  return {
    id: 'product-1',
    name: 'Acido citrico',
    imagePath: null,
    stock: '12',
    unitId: 'unit-kg',
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
    stock: '12.0000',
    unitId: 'unit-kg',
    purchaseDate: '2026-03-05',
    expiryDate: null,
    packageContent: null,
    reserved: '2.0000',
    available: '10.0000',
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** jsdom no evalua las consultas de contenedor: la tabla y sus tarjetas estan las dos en el arbol. */
function enLaTabla() {
  return within(screen.getByRole('table'));
}

function toggle(name = 'Acido citrico') {
  return enLaTabla().getByRole('button', { name: `Mostrar lotes de ${name}` });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0));
  listAliveProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('desplegar los lotes de un producto', () => {
  it('despliega y pliega con el chevron, que anuncia su estado con aria-expanded', async () => {
    listAliveProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [lote()] });
    const user = setupUser();
    render(<ProductTable products={[producto()]} params={TODOS} totalPages={1} units={UNITS} />);

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(enLaTabla().queryByTestId('product-batch-row')).toBeNull();

    await user.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    const fila = await enLaTabla().findByTestId('product-batch-row');
    expect(within(fila).getByTestId('product-batch-row-lot')).toHaveTextContent('L-001');
    expect(within(fila).getByTestId('product-batch-row-purchase-date')).toHaveTextContent('2026-03-05');
    expect(within(fila).getByTestId('product-batch-row-expiry-date')).toHaveTextContent(EMPTY_MARK);
    expect(within(fila).queryByTestId('product-batch-row-expiry-relative')).toBeNull();
    expect(listAliveProductBatchesActionMock).toHaveBeenCalledWith('product-1');

    const filaLote = screen.getByTestId('data-table-row-product-1--batch-batch-1');
    expect(within(filaLote).getByTestId('batch-stock')).toHaveTextContent('12 kg');
    expect(within(filaLote).getByTestId('product-batch-row-reserved')).toHaveTextContent('2 kg');
    expect(within(filaLote).getByTestId('product-batch-row-available')).toHaveTextContent('10 kg');

    await user.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(enLaTabla().queryByTestId('product-batch-row')).toBeNull();
  });

  it('pide los lotes una sola vez por producto aunque se pliegue y despliegue', async () => {
    listAliveProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [lote()] });
    const user = setupUser();
    render(<ProductTable products={[producto()]} params={TODOS} totalPages={1} />);

    await user.click(toggle());
    await enLaTabla().findByTestId('product-batch-row');
    await user.click(toggle());
    await user.click(toggle());

    expect(enLaTabla().getByTestId('product-batch-row')).toBeInTheDocument();
    expect(listAliveProductBatchesActionMock).toHaveBeenCalledTimes(1);
  });

  it('mientras carga pinta la sub-fila de «cargando»', async () => {
    const pendiente = deferred<unknown>();
    listAliveProductBatchesActionMock.mockReturnValue(pendiente.promise);
    const user = setupUser();
    render(<ProductTable products={[producto()]} params={TODOS} totalPages={1} />);

    await user.click(toggle());
    expect(enLaTabla().getByTestId('product-batches-row-loading')).toHaveTextContent('Cargando lotes…');

    pendiente.resolve({ status: 'success', data: [lote()] });
    await enLaTabla().findByTestId('product-batch-row');
    expect(enLaTabla().queryByTestId('product-batches-row-loading')).toBeNull();
  });

  it('con error pinta el mensaje y el reintento vuelve a pedir los lotes', async () => {
    listAliveProductBatchesActionMock.mockResolvedValueOnce({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'No tienes permiso.',
    });
    const user = setupUser();
    render(<ProductTable products={[producto()]} params={TODOS} totalPages={1} />);

    await user.click(toggle());
    const error = await enLaTabla().findByTestId('product-batches-row-error');
    expect(error).toHaveTextContent('No tienes permiso.');

    listAliveProductBatchesActionMock.mockResolvedValueOnce({ status: 'success', data: [lote()] });
    await user.click(within(error).getByRole('button', { name: 'Reintentar' }));

    await enLaTabla().findByTestId('product-batch-row');
    expect(enLaTabla().queryByTestId('product-batches-row-error')).toBeNull();
    expect(listAliveProductBatchesActionMock).toHaveBeenCalledTimes(2);
  });

  it('tras invalidar la lista y reabrir, la respuesta vieja aun en vuelo no pisa a la nueva', async () => {
    const vieja = deferred<unknown>();
    const nueva = deferred<unknown>();
    listAliveProductBatchesActionMock.mockReturnValueOnce(vieja.promise).mockReturnValueOnce(nueva.promise);
    const user = setupUser();
    const { rerender } = render(
      <ProductTable products={[producto()]} params={TODOS} totalPages={1} />,
    );

    await user.click(toggle());
    // Una lista nueva (refresh) vacia la cache con la primera peticion aun en vuelo.
    rerender(<ProductTable products={[producto()]} params={TODOS} totalPages={1} />);
    await user.click(toggle());
    expect(listAliveProductBatchesActionMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      vieja.resolve({ status: 'success', data: [lote({ id: 'viejo', lot: 'L-VIEJO' })] });
    });
    expect(enLaTabla().getByTestId('product-batches-row-loading')).toBeInTheDocument();
    expect(enLaTabla().queryByText('L-VIEJO')).toBeNull();

    await act(async () => {
      nueva.resolve({ status: 'success', data: [lote({ id: 'nuevo', lot: 'L-NUEVO' })] });
    });
    expect(enLaTabla().getAllByTestId('product-batch-row-lot').map((dd) => dd.textContent)).toEqual([
      'L-NUEVO',
    ]);
  });

  it('una accion que rechaza tambien acaba en la sub-fila de error', async () => {
    listAliveProductBatchesActionMock.mockRejectedValueOnce(new Error('red'));
    const user = setupUser();
    render(<ProductTable products={[producto()]} params={TODOS} totalPages={1} />);

    await user.click(toggle());
    expect(await enLaTabla().findByTestId('product-batches-row-error')).toBeInTheDocument();
  });

  it('pide solo los lotes vivos al servidor y pinta tal cual lo que devuelve; sin ninguno, el vacio', async () => {
    listAliveProductBatchesActionMock.mockResolvedValue({
      status: 'success',
      data: [
        lote({ id: 'vivo', lot: 'L-VIVO', stock: '0.0001' }),
        lote({ id: 'otro', lot: 'L-OTRO', stock: '3.0000' }),
      ],
    });
    const user = setupUser();
    render(
      <ProductTable
        products={[producto(), producto({ id: 'product-2', name: 'Glicerina' })]}
        params={TODOS}
        totalPages={1}
      />,
    );

    await user.click(toggle());
    await enLaTabla().findAllByTestId('product-batch-row');
    expect(listAliveProductBatchesActionMock).toHaveBeenCalledWith('product-1');
    expect(enLaTabla().getAllByTestId('product-batch-row-lot').map((dd) => dd.textContent)).toEqual([
      'L-VIVO',
      'L-OTRO',
    ]);

    listAliveProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [] });
    await user.click(toggle('Glicerina'));
    expect(await enLaTabla().findByTestId('product-batches-row-empty')).toBeInTheDocument();
  });
});

describe('aviso de vencimiento cercano (hoy = 2026-10-15)', () => {
  it('R48 — pinta en ámbar el vencimiento de un lote a menos de 30 dias o vencido, y no el de 30 o más', async () => {
    listAliveProductBatchesActionMock.mockResolvedValue({
      status: 'success',
      data: [
        lote({ id: 'cerca', lot: 'L-CERCA', expiryDate: '2026-11-13' }),
        lote({ id: 'vencido', lot: 'L-VENCIDO', expiryDate: '2026-10-01' }),
        lote({ id: 'lejos', lot: 'L-LEJOS', expiryDate: '2026-11-14' }),
      ],
    });
    const user = setupUser();
    render(<ProductTable products={[producto()]} params={TODOS} totalPages={1} />);

    await user.click(toggle());
    await enLaTabla().findAllByTestId('product-batch-row');

    const vencimiento = (batchId: string) =>
      within(screen.getByTestId(`data-table-row-product-1--batch-${batchId}`)).getByTestId(
        'product-batch-row-expiry-date',
      );
    for (const id of ['cerca', 'vencido']) {
      expect(vencimiento(id)).toHaveAttribute('data-expiring', 'true');
      expect(vencimiento(id)).toHaveClass('text-warning-text', 'font-semibold');
      expect(vencimiento(id)).not.toHaveClass('text-destructive');
    }
    expect(vencimiento('lejos')).not.toHaveAttribute('data-expiring');
    expect(vencimiento('lejos')).not.toHaveClass('text-warning-text');
    expect(vencimiento('lejos')).not.toHaveClass('text-destructive');
  });

  it('junto a la fecha pinta los dias relativos, tambien para los lejanos', async () => {
    listAliveProductBatchesActionMock.mockResolvedValue({
      status: 'success',
      data: [
        lote({ id: 'vencido', expiryDate: '2026-10-12' }),
        lote({ id: 'ayer', expiryDate: '2026-10-14' }),
        lote({ id: 'hoy', expiryDate: '2026-10-15' }),
        lote({ id: 'manana', expiryDate: '2026-10-16' }),
        lote({ id: 'cerca', expiryDate: '2026-11-04' }),
        lote({ id: 'lejos', expiryDate: '2027-01-13' }),
      ],
    });
    const user = setupUser();
    render(<ProductTable products={[producto()]} params={TODOS} totalPages={1} />);

    await user.click(toggle());
    await enLaTabla().findAllByTestId('product-batch-row');

    const vencimiento = (batchId: string) =>
      within(screen.getByTestId(`data-table-row-product-1--batch-${batchId}`)).getByTestId(
        'product-batch-row-expiry-date',
      );
    const relativo = (batchId: string) =>
      within(vencimiento(batchId)).getByTestId('product-batch-row-expiry-relative');

    expect(vencimiento('vencido')).toHaveTextContent('2026-10-12 (venció hace 3 días)');
    expect(relativo('ayer')).toHaveTextContent('(venció hace 1 día)');
    expect(relativo('hoy')).toHaveTextContent('(vence hoy)');
    expect(relativo('manana')).toHaveTextContent('(vence en 1 día)');
    expect(vencimiento('cerca')).toHaveTextContent('2026-11-04 (vence en 20 días)');
    expect(relativo('lejos')).toHaveTextContent('(vence en 90 días)');
    // El ámbar sigue solo bajo 30 dias: el relativo hereda el color de la fecha.
    expect(vencimiento('cerca')).toHaveClass('text-warning-text');
    expect(vencimiento('lejos')).not.toHaveClass('text-warning-text');
  });

  it('R48 — el vencido lleva el chip «Vencido» en danger y data-expired, con la fecha en ámbar; el proximo y el lejano no', async () => {
    listAliveProductBatchesActionMock.mockResolvedValue({
      status: 'success',
      data: [
        lote({ id: 'vencido', expiryDate: '2026-10-12' }),
        lote({ id: 'hoy', expiryDate: '2026-10-15' }),
        lote({ id: 'cerca', expiryDate: '2026-11-04' }),
        lote({ id: 'lejos', expiryDate: '2027-01-13' }),
        lote({ id: 'sin-fecha', expiryDate: null }),
      ],
    });
    const user = setupUser();
    render(<ProductTable products={[producto()]} params={TODOS} totalPages={1} />);

    await user.click(toggle());
    await enLaTabla().findAllByTestId('product-batch-row');

    const vencimiento = (batchId: string) =>
      within(screen.getByTestId(`data-table-row-product-1--batch-${batchId}`)).getByTestId(
        'product-batch-row-expiry-date',
      );
    expect(vencimiento('vencido')).toHaveAttribute('data-expired', 'true');
    expect(vencimiento('vencido')).toHaveClass('text-warning-text');
    expect(vencimiento('vencido')).not.toHaveClass('text-destructive');
    const chip = within(vencimiento('vencido')).getByTestId('product-batch-row-expired');
    expect(chip).toHaveTextContent('Vencido');
    expect(chip).toHaveAttribute('data-tone', 'danger');

    for (const id of ['hoy', 'cerca', 'lejos', 'sin-fecha']) {
      expect(vencimiento(id)).not.toHaveAttribute('data-expired');
      expect(within(vencimiento(id)).queryByTestId('product-batch-row-expired')).toBeNull();
    }
    expect(vencimiento('cerca')).toHaveClass('text-warning-text');
    expect(vencimiento('cerca')).not.toHaveClass('text-destructive');
  });

  it('cada clave va en negrita y seguida de «:», en su propio bloque', async () => {
    listAliveProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [lote()] });
    const user = setupUser();
    render(<ProductTable products={[producto()]} params={TODOS} totalPages={1} />);

    await user.click(toggle());
    const fila = await enLaTabla().findByTestId('product-batch-row');
    const claves = within(fila).getAllByRole('term');
    expect(claves.map((dt) => dt.textContent)).toEqual([
      'Lote:',
      'Fecha de compra:',
      'Vencimiento:',
    ]);
    for (const dt of claves) {
      expect(dt).toHaveClass('font-bold');
      expect(dt.parentElement).toHaveClass('block');
    }
  });

  it('R48 — resalta en ámbar el nombre del producto segun nextExpiryDate, sin desplegar', () => {
    render(
      <ProductTable
        products={[
          producto({ id: 'cerca', name: 'Cerca', nextExpiryDate: '2026-10-20' }),
          producto({ id: 'vencido', name: 'Vencido', nextExpiryDate: '2026-10-01' }),
          producto({ id: 'treinta', name: 'Treinta', nextExpiryDate: '2026-11-14' }),
          producto({ id: 'lejos', name: 'Lejos', nextExpiryDate: '2027-01-01' }),
          producto({ id: 'sin-fecha', name: 'Sin fecha', nextExpiryDate: null }),
          producto({ id: 'sin-dato', name: 'Sin dato' }),
        ]}
        params={TODOS}
        totalPages={1}
      />,
    );

    const nombre = (id: string) =>
      within(screen.getByTestId(`data-table-row-${id}`)).getByTestId('product-name');
    for (const id of ['cerca', 'vencido']) {
      expect(nombre(id)).toHaveAttribute('data-expiring', 'true');
      expect(nombre(id)).toHaveClass('text-warning-text', 'font-semibold');
      expect(nombre(id)).not.toHaveClass('text-destructive');
    }
    for (const id of ['treinta', 'lejos', 'sin-fecha', 'sin-dato']) {
      expect(nombre(id)).not.toHaveAttribute('data-expiring');
      expect(nombre(id)).not.toHaveClass('text-warning-text');
      expect(nombre(id)).not.toHaveClass('text-destructive');
    }
    expect(listAliveProductBatchesActionMock).not.toHaveBeenCalled();
  });
});

describe('la columna «Tipo» convive con las filas de lotes', () => {
  it('en «Todos» la fila del producto lleva su chip y la del lote no', async () => {
    listAliveProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [lote()] });
    const user = setupUser();
    render(<ProductTable products={[producto()]} params={TODOS} totalPages={1} />);

    expect(screen.getByTestId('data-table-head-type')).toBeInTheDocument();
    await user.click(toggle());
    await enLaTabla().findByTestId('product-batch-row');

    expect(enLaTabla().getAllByTestId('product-type')).toHaveLength(1);
    expect(
      within(screen.getByTestId('data-table-row-product-1--batch-batch-1')).queryByTestId(
        'product-type',
      ),
    ).toBeNull();
  });
});

describe('sin cambio de anchura de la tabla', () => {
  it('el chevron vive en la celda del nombre: no hay columna nueva', () => {
    render(<ProductTable products={[producto()]} params={TODOS} totalPages={1} />);
    const celdaNombre = enLaTabla().getByTestId('data-table-cell-name');
    expect(within(celdaNombre).getByTestId('product-batches-toggle')).toBeInTheDocument();
  });
});

describe('columna «Costo» de la tabla de productos', () => {
  it('pinta la cabecera «Costo» justo despues de la existencia', () => {
    render(<ProductTable products={[producto()]} params={TODOS} totalPages={1} units={UNITS} />);

    expect(screen.getByTestId('data-table-head-averageUnitCost')).toHaveTextContent('Costo');
    const cabeceras = screen
      .getAllByRole('columnheader')
      .map((celda) => celda.getAttribute('data-testid'));
    expect(cabeceras.indexOf('data-table-head-averageUnitCost')).toBe(
      cabeceras.indexOf('data-table-head-stock') + 1,
    );
  });

  it('R6 — «Costo» va a la derecha en la cabecera y en la celda, como las demás cifras', () => {
    render(
      <ProductTable
        products={[producto({ averageUnitCost: '9' })]}
        params={TODOS}
        totalPages={1}
        units={UNITS}
      />,
    );

    expect(screen.getByTestId('data-table-head-averageUnitCost')).toHaveClass('text-right');
    const fila = screen.getByTestId('data-table-row-product-1');
    expect(within(fila).getByTestId('data-table-cell-averageUnitCost')).toHaveClass('text-right');
  });

  it('R6, R47, R53 — la sub-fila de lote alinea sus cifras como su columna y «Tipo», «Presentación» y «Costo» se conservan', async () => {
    listAliveProductBatchesActionMock.mockResolvedValue({
      status: 'success',
      data: [lote({ unitCost: '3.1250' })],
    });
    const user = setupUser();
    render(
      <ProductTable
        products={[producto({ averageUnitCost: '9', presentationName: 'Saco 25 kg' })]}
        params={TODOS}
        totalPages={1}
        units={UNITS}
      />,
    );

    await user.click(toggle());
    await enLaTabla().findByTestId('product-batch-row');

    const filaProducto = screen.getByTestId('data-table-row-product-1');
    const filaLote = screen.getByTestId('data-table-row-product-1--batch-batch-1');
    for (const columna of ['stock', 'averageUnitCost', 'qtyAlert', 'reserved', 'available']) {
      expect(screen.getByTestId(`data-table-head-${columna}`), columna).toHaveClass('text-right');
      expect(within(filaProducto).getByTestId(`data-table-cell-${columna}`), columna).toHaveClass(
        'text-right',
      );
      expect(within(filaLote).getByTestId(`data-table-cell-${columna}`), columna).toHaveClass(
        'text-right',
      );
    }
    // «start» es la alineación natural: la tabla no le añade clase.
    for (const columna of ['type', 'presentationName']) {
      for (const celda of [
        screen.getByTestId(`data-table-head-${columna}`),
        within(filaProducto).getByTestId(`data-table-cell-${columna}`),
        within(filaLote).getByTestId(`data-table-cell-${columna}`),
      ]) {
        expect(celda, columna).not.toHaveClass('text-right');
        expect(celda, columna).not.toHaveClass('text-center');
      }
    }

    expect(within(filaProducto).getByTestId('product-type')).toBeInTheDocument();
    expect(within(filaProducto).getByTestId('data-table-cell-presentationName')).toHaveTextContent(
      'Saco 25 kg',
    );
    expect(within(filaProducto).getByTestId('product-cost')).toHaveTextContent(/^9$/);
    expect(within(filaLote).getByTestId('product-batch-row-cost')).toHaveTextContent(/^3\.125$/);
  });

  it('R6 — «Disponible» va en negrita en la fila del producto y no en la del lote', async () => {
    listAliveProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [lote()] });
    const user = setupUser();
    render(
      <ProductTable
        products={[producto({ reserved: '2', available: '10' })]}
        params={TODOS}
        totalPages={1}
        units={UNITS}
      />,
    );

    await user.click(toggle());
    await enLaTabla().findByTestId('product-batch-row');

    const filaProducto = screen.getByTestId('data-table-row-product-1');
    expect(within(filaProducto).getByTestId('product-available')).toHaveClass('font-semibold');
    expect(within(filaProducto).getByTestId('product-reserved')).not.toHaveClass('font-semibold');
    const filaLote = screen.getByTestId('data-table-row-product-1--batch-batch-1');
    expect(within(filaLote).getByTestId('product-batch-row-available')).not.toHaveClass(
      'font-semibold',
    );
  });

  it('la fila del producto pinta su costo promedio sin ceros de relleno ni redondeo', () => {
    render(
      <ProductTable
        products={[
          producto({ averageUnitCost: '12.5000' }),
          producto({ id: 'product-2', name: 'Sal', averageUnitCost: '0.0025' }),
        ]}
        params={TODOS}
        totalPages={1}
        units={UNITS}
      />,
    );

    const fila1 = screen.getByTestId('data-table-row-product-1');
    expect(within(fila1).getByTestId('product-cost')).toHaveTextContent(/^12\.5$/);
    const fila2 = screen.getByTestId('data-table-row-product-2');
    expect(within(fila2).getByTestId('product-cost')).toHaveTextContent(/^0\.0025$/);
  });

  it('sin costo (null o ausente), la fila del producto pinta el marcador de vacio', () => {
    render(
      <ProductTable
        products={[producto({ averageUnitCost: null }), producto({ id: 'product-2', name: 'Sal' })]}
        params={TODOS}
        totalPages={1}
        units={UNITS}
      />,
    );

    for (const id of ['product-1', 'product-2']) {
      const fila = screen.getByTestId(`data-table-row-${id}`);
      expect(within(fila).getByTestId('data-table-cell-averageUnitCost')).toHaveTextContent(
        EMPTY_MARK,
      );
      expect(within(fila).queryByTestId('product-cost')).toBeNull();
    }
  });

  it('la fila del lote pinta su propio costo unitario, no el promedio del producto', async () => {
    listAliveProductBatchesActionMock.mockResolvedValue({
      status: 'success',
      data: [lote({ unitCost: '3.1250' })],
    });
    const user = setupUser();
    render(
      <ProductTable
        products={[producto({ averageUnitCost: '9.0000' })]}
        params={TODOS}
        totalPages={1}
        units={UNITS}
      />,
    );

    await user.click(toggle());
    await enLaTabla().findByTestId('product-batch-row');

    const filaLote = screen.getByTestId('data-table-row-product-1--batch-batch-1');
    expect(within(filaLote).getByTestId('product-batch-row-cost')).toHaveTextContent(/^3\.125$/);
    const filaProducto = screen.getByTestId('data-table-row-product-1');
    expect(within(filaProducto).getByTestId('product-cost')).toHaveTextContent(/^9$/);
  });

  it('sin costo (null o ausente), la fila del lote pinta el marcador de vacio', async () => {
    listAliveProductBatchesActionMock.mockResolvedValue({
      status: 'success',
      data: [lote({ unitCost: null }), lote({ id: 'batch-2', lot: 'L-002' })],
    });
    const user = setupUser();
    render(<ProductTable products={[producto()]} params={TODOS} totalPages={1} units={UNITS} />);

    await user.click(toggle());
    await enLaTabla().findAllByTestId('product-batch-row');

    for (const id of ['batch-1', 'batch-2']) {
      const filaLote = screen.getByTestId(`data-table-row-product-1--batch-${id}`);
      expect(within(filaLote).getByTestId('data-table-cell-averageUnitCost')).toHaveTextContent(
        EMPTY_MARK,
      );
      expect(within(filaLote).queryByTestId('product-batch-row-cost')).toBeNull();
    }
  });
});
