import { cleanup, render, screen, within } from '@testing-library/react';
import { HistoryIcon } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PRODUCT_BATCHES_CARD,
  ProductBatchesPanel,
  buildProductBatchColumns,
} from '@/app/(private)/inventario/components';
import type { RowActionsSpec } from '@/components/shared/data-table';
import { PRODUCT_TYPES, type ProductBatchView } from '@/lib/modules/inventario';
import type { UnitRef } from '@/lib/modules/unidades';

/**
 * `product-batches-panel.tsx` y `product-batch-columns.tsx`: el panel monta un `DataTable` local
 * con una fila y una tarjeta por lote. jsdom no evalua la consulta de contenedor, asi que las dos
 * salen en el arbol: cada aserción se acota a `data-table-row-<id>` o a `data-table-card-<id>`.
 */

function unidad(overrides: Partial<UnitRef> = {}): UnitRef {
  return {
    id: crypto.randomUUID(),
    name: 'Kilogramo',
    symbol: 'kg',
    baseUnitId: null,
    factor: null,
    ...overrides,
  };
}

function lote(overrides: Partial<ProductBatchView> = {}): ProductBatchView {
  return {
    id: crypto.randomUUID(),
    lot: 'L-001',
    stock: '10',
    unitId: crypto.randomUUID(),
    purchaseDate: '2026-03-05',
    expiryDate: null,
    packageContent: null,
    ...overrides,
  };
}

function fila(id: string): HTMLElement {
  return screen.getByTestId(`data-table-row-${id}`);
}

function tarjeta(id: string): HTMLElement {
  return screen.getByTestId(`data-table-card-${id}`);
}

function celda(id: string, columna: string): HTMLElement {
  return within(fila(id)).getByTestId(`data-table-cell-${columna}`);
}

function menuDeLote(batch: ProductBatchView): RowActionsSpec {
  return {
    items: [{ key: 'history', label: 'Historial', icon: HistoryIcon, onSelect: vi.fn() }],
    triggerLabel: `Acciones del lote ${batch.lot}`,
    title: batch.lot,
  };
}

afterEach(() => {
  cleanup();
});

describe('R15 — el panel de lotes es una tabla', () => {
  it('R15 — columnas «Lote», «Cantidad», «Fecha de compra», «Vencimiento», «Apartado», «Disponible» y acciones', () => {
    const columnas = buildProductBatchColumns({ menu: menuDeLote });
    expect(columnas.map((columna) => columna.id)).toEqual([
      'lot',
      'quantity',
      'purchaseDate',
      'expiryDate',
      'reserved',
      'available',
      'actions',
    ]);
    expect(columnas.slice(0, 6).map((columna) => columna.label)).toEqual([
      'Lote',
      'Cantidad',
      'Fecha de compra',
      'Vencimiento',
      'Apartado',
      'Disponible',
    ]);
    expect(buildProductBatchColumns({}).map((columna) => columna.id)).not.toContain('actions');
  });

  it('R15 — lote, cifras y fechas en cifras tabulares; las cifras y las dos fechas a la derecha', () => {
    const columnas = new Map(buildProductBatchColumns({ menu: menuDeLote }).map((c) => [c.id, c]));
    for (const id of ['lot', 'quantity', 'purchaseDate', 'expiryDate', 'reserved', 'available']) {
      expect(columnas.get(id)?.tabular, id).toBe(true);
    }
    for (const id of ['quantity', 'purchaseDate', 'expiryDate', 'reserved', 'available']) {
      expect(columnas.get(id)?.align, id).toBe('end');
    }
    expect(columnas.get('lot')?.align).toBe('start');
  });

  it('R15 — la cabecera y la celda de «Fecha de compra» y «Vencimiento» van a la derecha', () => {
    render(<ProductBatchesPanel batches={[lote({ id: 'b1', expiryDate: '2027-03-05' })]} />);

    for (const columna of ['purchaseDate', 'expiryDate']) {
      expect(screen.getByTestId(`data-table-head-${columna}`), columna).toHaveClass('text-right');
      expect(celda('b1', columna), columna).toHaveClass('text-right');
    }
    expect(celda('b1', 'lot')).not.toHaveClass('text-right');
  });

  it('R15 — cada lote es una fila de la tabla con los testids de hoy en su celda', () => {
    const kilogramo = unidad({ id: 'unit-kg', symbol: 'kg' });
    render(
      <ProductBatchesPanel
        batches={[
          lote({
            id: 'b1',
            lot: 'L-001',
            stock: '10',
            unitId: 'unit-kg',
            purchaseDate: '2026-03-05',
            expiryDate: '2027-03-05',
            reserved: '4',
            available: '6',
          }),
        ]}
        units={[kilogramo]}
        batchMenu={menuDeLote}
      />,
    );

    const tabla = within(screen.getByTestId('product-batches-panel')).getByRole('table');
    const cabeceras = within(tabla).getAllByRole('columnheader');
    expect(cabeceras.slice(0, 6).map((th) => th.textContent?.trim())).toEqual([
      'Lote',
      'Cantidad',
      'Fecha de compra',
      'Vencimiento',
      'Apartado',
      'Disponible',
    ]);

    expect(within(celda('b1', 'lot')).getByTestId('product-batch-lot')).toHaveTextContent('L-001');
    expect(within(celda('b1', 'quantity')).getByTestId('product-batch-quantity')).toHaveTextContent('10 kg');
    expect(within(celda('b1', 'purchaseDate')).getByTestId('product-batch-purchase-date')).toHaveTextContent(
      '2026-03-05',
    );
    expect(within(celda('b1', 'expiryDate')).getByTestId('product-batch-expiry-date')).toHaveTextContent(
      '2027-03-05',
    );
    expect(within(celda('b1', 'reserved')).getByTestId('product-batch-reserved')).toHaveTextContent('4 kg');
    expect(within(celda('b1', 'available')).getByTestId('product-batch-available')).toHaveTextContent('6 kg');
    expect(celda('b1', 'quantity')).toHaveClass('text-right', 'font-mono', 'tabular-nums');
    expect(celda('b1', 'available')).toHaveClass('text-right');
    expect(within(celda('b1', 'actions')).getByRole('button', { name: 'Acciones del lote L-001' })).toBeInTheDocument();
  });

  it('R15 — la disposicion en tres lineas desaparece y no queda ningun `dd` fuera de un `dl`', () => {
    render(
      <ProductBatchesPanel
        batches={[lote({ id: 'b1', expiryDate: '2027-03-05', reserved: '2', available: '8' })]}
      />,
    );

    expect(screen.queryByTestId(/^product-batch-line-/)).toBeNull();
    const panel = screen.getByTestId('product-batches-panel');
    expect(panel.querySelector('dl')).toBeNull();
    expect(panel.querySelector('dd')).toBeNull();
    expect(within(fila('b1')).getByTestId('product-batch-expiry-date').tagName).toBe('SPAN');
  });

  it('R15 — sin vencimiento la celda lleva el marcador de vacio y no el testid de la fecha', () => {
    render(<ProductBatchesPanel batches={[lote({ id: 'b2', expiryDate: null })]} />);

    expect(within(fila('b2')).queryByTestId('product-batch-expiry-date')).toBeNull();
    expect(celda('b2', 'expiryDate')).toHaveTextContent('—');
    expect(within(fila('b2')).getByTestId('product-batch-purchase-date')).toBeInTheDocument();
  });

  it('pinta cada lote con su unidad derivada, sin convertir', () => {
    const kilogramo = unidad({ id: 'unit-kg', symbol: 'kg' });
    const litro = unidad({ id: 'unit-l', name: 'Litro', symbol: 'L' });
    render(
      <ProductBatchesPanel
        batches={[
          lote({ id: 'b1', stock: '10', unitId: 'unit-kg' }),
          lote({ id: 'b2', stock: '25', unitId: 'unit-l' }),
        ]}
        units={[kilogramo, litro]}
      />,
    );

    expect(within(fila('b1')).getByTestId('product-batch-quantity')).toHaveTextContent('10 kg');
    expect(within(fila('b2')).getByTestId('product-batch-quantity')).toHaveTextContent('25 L');
  });

  it('sin catalogo la cantidad se pinta sola; con una unidad desconocida, el marcador de vacio', () => {
    render(<ProductBatchesPanel batches={[lote({ id: 'b1', stock: '7' })]} />);
    expect(within(fila('b1')).getByTestId('product-batch-quantity')).toHaveTextContent(/^7$/);
    cleanup();

    render(
      <ProductBatchesPanel
        batches={[lote({ id: 'b1', stock: '4', unitId: 'unit-desconocida' })]}
        units={[unidad({ id: 'unit-kg' })]}
      />,
    );
    expect(within(fila('b1')).getByTestId('product-batch-quantity')).toHaveTextContent('4 —');
  });

  it('la cantidad se pinta a dos decimales, con la cifra exacta en el title y el aria-label', () => {
    render(
      <ProductBatchesPanel
        batches={[
          lote({ id: 'b1', stock: '0.0001' }),
          lote({ id: 'b2', stock: '1.5' }),
          lote({ id: 'b3', stock: '12345.6789' }),
        ]}
      />,
    );

    const b1 = within(fila('b1')).getByTestId('product-batch-quantity');
    expect(b1).toHaveTextContent(/^0$/);
    expect(b1).toHaveAttribute('title', '0.0001');
    expect(b1).toHaveAttribute('aria-label', '0.0001');

    const b2 = within(fila('b2')).getByTestId('product-batch-quantity');
    expect(b2).toHaveTextContent('1.5');
    expect(b2).not.toHaveAttribute('title');
    expect(b2).toHaveAttribute('aria-label', '1.5');

    const b3 = within(fila('b3')).getByTestId('product-batch-quantity');
    expect(b3).toHaveTextContent('12345.68');
    expect(b3).toHaveAttribute('title', '12345.6789');
    expect(b3).toHaveAttribute('aria-label', '12345.6789');
  });

  it('pinta el apartado y el disponible junto a su unidad, con la cifra exacta; el disponible en negrita', () => {
    const kilogramo = unidad({ id: 'unit-kg', symbol: 'kg' });
    render(
      <ProductBatchesPanel
        batches={[lote({ id: 'b1', unitId: 'unit-kg', reserved: '4.1234', available: '5.8766' })]}
        units={[kilogramo]}
      />,
    );

    const apartado = within(fila('b1')).getByTestId('product-batch-reserved');
    expect(apartado).toHaveTextContent('4.12 kg');
    expect(apartado).toHaveAttribute('title', '4.1234');
    expect(apartado).toHaveAttribute('aria-label', '4.1234 kg');

    const disponible = within(fila('b1')).getByTestId('product-batch-available');
    expect(disponible).toHaveTextContent('5.88 kg');
    expect(disponible).toHaveAttribute('title', '5.8766');
    expect(disponible).toHaveAttribute('aria-label', '5.8766 kg');
    expect(disponible).toHaveClass('font-semibold');
  });

  it('sin apartado ni disponible, sus celdas llevan el marcador de vacio y no sus testids', () => {
    render(<ProductBatchesPanel batches={[lote({ id: 'b1' })]} />);

    expect(within(fila('b1')).queryByTestId('product-batch-reserved')).toBeNull();
    expect(within(fila('b1')).queryByTestId('product-batch-available')).toBeNull();
    expect(celda('b1', 'reserved')).toHaveTextContent('—');
    expect(celda('b1', 'available')).toHaveTextContent('—');
  });
});

describe('R16 — envases, presentacion y vacio', () => {
  it('R16 — division exacta: el numero de envases va debajo de la cantidad, en su celda', () => {
    render(<ProductBatchesPanel batches={[lote({ id: 'b1', stock: '50.0000', packageContent: '1.0000' })]} />);

    expect(within(celda('b1', 'quantity')).getByTestId('product-batch-packages')).toHaveTextContent(
      '50 envases',
    );
  });

  it('R16 — un solo envase se muestra en singular', () => {
    render(<ProductBatchesPanel batches={[lote({ id: 'b1', stock: '1.0000', packageContent: '1.0000' })]} />);

    expect(within(fila('b1')).getByTestId('product-batch-packages')).toHaveTextContent('1 envase');
  });

  it('R16 — division no entera o sin contenido de envase: ninguna cifra de envases', () => {
    render(
      <ProductBatchesPanel
        batches={[
          lote({ id: 'b1', stock: '49.5000', packageContent: '1.0000' }),
          lote({ id: 'b2', stock: '50.0000', packageContent: null }),
        ]}
      />,
    );

    expect(screen.queryByTestId('product-batch-packages')).toBeNull();
  });

  it('R16 — la linea de presentacion del envase va encima de la tabla', () => {
    render(
      <ProductBatchesPanel
        batches={[lote({ id: 'b1' })]}
        product={{ type: PRODUCT_TYPES.PACKAGING, unitId: null, presentationId: 'p-1', presentationName: '500 ml' }}
      />,
    );

    const linea = screen.getByTestId('product-batches-packaging-presentation');
    expect(linea).toHaveTextContent('Presentación del envase: 500 ml');
    expect(
      linea.compareDocumentPosition(screen.getByTestId('product-batches-panel')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('R16 — lista vacia: texto propio y ninguna tabla', () => {
    render(<ProductBatchesPanel batches={[]} />);

    expect(screen.getByTestId('product-batches-panel')).toHaveTextContent(
      'Este producto todavía no tiene lotes registrados.',
    );
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByTestId(/product-batch-/)).toBeNull();
  });
});

describe('R17 — «Sobre-reservado»', () => {
  it('R17 — un lote sobre-reservado lleva «Sobre-reservado» con StatusBadge danger en la celda del lote', () => {
    render(
      <ProductBatchesPanel
        batches={[lote({ id: 'b1', stock: '5', reserved: '8', available: '0', overReserved: true })]}
      />,
    );

    const marca = within(celda('b1', 'lot')).getByTestId('product-batch-over-reserved');
    expect(marca).toHaveTextContent('Sobre-reservado');
    expect(marca).toHaveAttribute('data-tone', 'danger');
  });

  it('R17 — sin sobre-reserva, la marca no aparece', () => {
    render(
      <ProductBatchesPanel
        batches={[lote({ id: 'b1', reserved: '4', available: '6', overReserved: false })]}
      />,
    );

    expect(screen.queryByTestId('product-batch-over-reserved')).toBeNull();
  });
});

describe('R18 — el menu de cada lote', () => {
  it('R18 — `batchMenu` se pide por lote y su disparador se llama «Acciones del lote <lote>»', () => {
    const batchMenu = vi.fn(menuDeLote);
    render(
      <ProductBatchesPanel
        batches={[lote({ id: 'b1', lot: 'L-001' }), lote({ id: 'b2', lot: 'L-002' })]}
        batchMenu={batchMenu}
      />,
    );

    expect(batchMenu).toHaveBeenCalledWith(expect.objectContaining({ id: 'b1' }));
    expect(batchMenu).toHaveBeenCalledWith(expect.objectContaining({ id: 'b2' }));
    expect(within(fila('b1')).getByRole('button', { name: 'Acciones del lote L-001' })).toBeInTheDocument();
    expect(within(fila('b2')).getByRole('button', { name: 'Acciones del lote L-002' })).toBeInTheDocument();
  });

  it('R18 — sin `batchMenu` no hay columna de acciones', () => {
    render(<ProductBatchesPanel batches={[lote({ id: 'b1' })]} />);

    expect(within(fila('b1')).queryByTestId('data-table-cell-actions')).toBeNull();
    expect(within(fila('b1')).queryByRole('button')).toBeNull();
  });
});

describe('R19 — cada lote en tarjeta', () => {
  it('R19 — la tarjeta lleva lote, «Cantidad», «Apartado», «Disponible», «Fecha de compra» y «Vencimiento» en ese orden', () => {
    expect(PRODUCT_BATCHES_CARD).toEqual({
      primary: 'lot',
      meta: ['quantity', 'reserved', 'available', 'purchaseDate', 'expiryDate'],
    });

    render(
      <ProductBatchesPanel
        batches={[
          lote({ id: 'b1', lot: 'L-001', expiryDate: '2027-03-05', reserved: '4', available: '6' }),
        ]}
        batchMenu={menuDeLote}
      />,
    );

    const card = tarjeta('b1');
    const campos = [...card.querySelectorAll('[data-testid^="data-table-card-field-"]')].map((campo) =>
      campo.getAttribute('data-testid')?.replace('data-table-card-field-', ''),
    );
    expect(campos).toEqual(['lot', 'quantity', 'reserved', 'available', 'purchaseDate', 'expiryDate']);
    expect(within(card).getByTestId('product-batch-lot')).toHaveTextContent('L-001');
    expect(within(card).getByTestId('product-batch-expiry-date')).toHaveTextContent('2027-03-05');
  });

  it('R19 — la tarjeta tiene el boton «Acciones» de 44 px que abre el menu centrado', () => {
    render(<ProductBatchesPanel batches={[lote({ id: 'b1', lot: 'L-001' })]} batchMenu={menuDeLote} />);

    const acciones = within(tarjeta('b1')).getByRole('button', { name: 'Acciones del lote L-001' });
    expect(acciones).toHaveTextContent('Acciones');
    expect(acciones).toHaveAttribute('aria-haspopup', 'dialog');
    expect(acciones).toHaveClass('min-h-11');
  });

  it('R19 — sin `batchMenu` la tarjeta no tiene «Acciones»', () => {
    render(<ProductBatchesPanel batches={[lote({ id: 'b1' })]} />);

    expect(within(tarjeta('b1')).queryByRole('button')).toBeNull();
  });
});

describe('R56 — rotulos de la tarjeta del lote', () => {
  function campoDeTarjeta(id: string, columna: string): HTMLElement {
    return within(tarjeta(id)).getByTestId(`data-table-card-field-${columna}`);
  }

  function rotuloDe(campo: HTMLElement): HTMLElement | null {
    return campo.querySelector<HTMLElement>('[data-card-label]');
  }

  function panelConUnLote() {
    const kilogramo = unidad({ id: 'unit-kg', symbol: 'kg' });
    render(
      <ProductBatchesPanel
        batches={[
          lote({
            id: 'b1',
            lot: 'L-001',
            stock: '10',
            unitId: 'unit-kg',
            purchaseDate: '2026-03-05',
            expiryDate: '2027-03-05',
            reserved: '4',
            available: '6',
          }),
        ]}
        units={[kilogramo]}
        batchMenu={menuDeLote}
      />,
    );
  }

  it('R56 — «Cantidad», «Apartado», «Disponible», «Fecha de compra» y «Vencimiento» van delante de su cifra; el lote, sin rotulo', () => {
    panelConUnLote();

    const esperados: Record<string, string> = {
      quantity: 'Cantidad',
      reserved: 'Apartado',
      available: 'Disponible',
      purchaseDate: 'Fecha de compra',
      expiryDate: 'Vencimiento',
    };
    for (const [columna, texto] of Object.entries(esperados)) {
      const campo = campoDeTarjeta('b1', columna);
      const etiqueta = rotuloDe(campo);
      expect(etiqueta, columna).not.toBeNull();
      expect(etiqueta?.textContent?.trim(), columna).toBe(texto);
      expect(campo.textContent?.startsWith(texto), columna).toBe(true);
      expect(etiqueta, columna).toHaveClass('text-muted-foreground', '[table_&]:hidden');
    }
    expect(rotuloDe(campoDeTarjeta('b1', 'lot'))).toBeNull();
  });

  it('R56 — el texto de cada `product-batch-*` sigue siendo solo su valor', () => {
    panelConUnLote();
    const card = tarjeta('b1');

    expect(within(card).getByTestId('product-batch-lot').textContent).toBe('L-001');
    expect(within(card).getByTestId('product-batch-quantity').textContent).toBe('10 kg');
    expect(within(card).getByTestId('product-batch-reserved').textContent).toBe('4 kg');
    expect(within(card).getByTestId('product-batch-available').textContent).toBe('6 kg');
    expect(within(card).getByTestId('product-batch-purchase-date').textContent).toBe('2026-03-05');
    // La fecha de vencimiento lleva dentro su relativo de hoy («vence en …», 08b69744), no el rotulo.
    const vencimiento = within(card).getByTestId('product-batch-expiry-date').textContent ?? '';
    expect(vencimiento.startsWith('2027-03-05')).toBe(true);
    expect(vencimiento).not.toContain('Vencimiento');
    for (const testId of [
      'product-batch-quantity',
      'product-batch-reserved',
      'product-batch-available',
      'product-batch-purchase-date',
      'product-batch-expiry-date',
    ]) {
      expect(within(card).getByTestId(testId).querySelector('[data-card-label]'), testId).toBeNull();
    }
  });

  it('R56 — en la fila de la tabla el rotulo lleva `[table_&]:hidden` y la cabecera no cambia', () => {
    panelConUnLote();

    const etiqueta = celda('b1', 'quantity').querySelector('[data-card-label]');
    expect(etiqueta).toHaveClass('[table_&]:hidden');
    expect(etiqueta?.closest('table')).not.toBeNull();
    expect(screen.getByTestId('data-table-head-quantity')).toHaveTextContent('Cantidad');
  });
});

describe('resaltado de vencimiento en la celda «Vencimiento» (hoy = 2026-10-15)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function vencimiento(id: string) {
    return within(celda(id, 'expiryDate')).getByTestId('product-batch-expiry-date');
  }

  it('R15, R48 — ámbar bajo 30 dias, dias relativos siempre y chip «Vencido» en danger solo en el vencido, incluso sin existencia', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0));
    render(
      <ProductBatchesPanel
        batches={[
          lote({ id: 'vencido', stock: '0', expiryDate: '2026-10-12' }),
          lote({ id: 'ayer', expiryDate: '2026-10-14' }),
          lote({ id: 'hoy', expiryDate: '2026-10-15' }),
          lote({ id: 'manana', expiryDate: '2026-10-16' }),
          lote({ id: 'cerca', expiryDate: '2026-11-04' }),
          lote({ id: 'treinta', expiryDate: '2026-11-14' }),
          lote({ id: 'lejos', expiryDate: '2027-01-13' }),
        ]}
      />,
    );

    expect(vencimiento('vencido')).toHaveTextContent('2026-10-12 (venció hace 3 días)');
    expect(vencimiento('vencido')).toHaveAttribute('data-expiring', 'true');
    expect(vencimiento('vencido')).toHaveAttribute('data-expired', 'true');
    expect(vencimiento('vencido')).toHaveClass('text-warning-text', 'font-semibold');
    expect(vencimiento('vencido')).not.toHaveClass('text-destructive');
    const chip = within(vencimiento('vencido')).getByTestId('product-batch-expired');
    expect(chip).toHaveTextContent('Vencido');
    expect(chip).toHaveAttribute('data-tone', 'danger');

    const relativo = (id: string) => within(vencimiento(id)).getByTestId('product-batch-expiry-relative');
    expect(relativo('ayer')).toHaveTextContent('(venció hace 1 día)');
    expect(relativo('hoy')).toHaveTextContent('(vence hoy)');
    expect(relativo('manana')).toHaveTextContent('(vence en 1 día)');
    expect(relativo('cerca')).toHaveTextContent('(vence en 20 días)');
    expect(relativo('lejos')).toHaveTextContent('(vence en 90 días)');

    expect(vencimiento('cerca')).toHaveAttribute('data-expiring', 'true');
    expect(vencimiento('cerca')).toHaveClass('text-warning-text', 'font-semibold');
    expect(vencimiento('cerca')).not.toHaveClass('text-destructive');
    for (const id of ['treinta', 'lejos']) {
      expect(vencimiento(id)).not.toHaveAttribute('data-expiring');
      expect(vencimiento(id)).not.toHaveClass('text-warning-text');
      expect(vencimiento(id)).not.toHaveClass('text-destructive');
    }
    for (const id of ['hoy', 'manana', 'cerca', 'treinta', 'lejos']) {
      expect(vencimiento(id)).not.toHaveAttribute('data-expired');
      expect(within(vencimiento(id)).queryByTestId('product-batch-expired')).toBeNull();
    }
  });

  it('R15 — la tarjeta conserva el relativo y el chip «Vencido»', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0));
    render(<ProductBatchesPanel batches={[lote({ id: 'vencido', expiryDate: '2026-10-12' })]} />);

    const fecha = within(tarjeta('vencido')).getByTestId('product-batch-expiry-date');
    expect(within(fecha).getByTestId('product-batch-expiry-relative')).toHaveTextContent('(venció hace 3 días)');
    expect(within(fecha).getByTestId('product-batch-expired')).toHaveTextContent('Vencido');
  });
});

describe('multiplataforma', () => {
  it('ningun texto del panel depende de `hover` para volverse visible', () => {
    render(<ProductBatchesPanel batches={[lote({ id: 'b1' })]} batchMenu={menuDeLote} />);

    expect(document.querySelector('[class*="hover:"][class*="hidden"]')).toBeNull();
  });
});
