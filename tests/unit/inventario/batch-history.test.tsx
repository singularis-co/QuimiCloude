import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BatchHistory, movementKindLabel, movementReasonLabel } from '@/app/(private)/inventario/components';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { MOVEMENT_REASONS, type BatchHistoryEntry } from '@/lib/modules/inventario';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import {
  ADJUSTMENT_WITH_COUNT,
  LEGACY_ADJUSTMENT,
  historyEntry,
} from '../../fixtures/adjust-batch-stock';
import { setupUser } from '../../helpers/user-event';

/**
 * La Server Action `listBatchMovementsAction` esta mockeada: es el borde del modulo `inventario`,
 * y sustituirla es lo que permite ejercitar los tres estados sin base de datos (mismo criterio que
 * `product-page.test.tsx`).
 */

const { listBatchMovementsActionMock } = vi.hoisted(() => ({
  listBatchMovementsActionMock: vi.fn(),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/batch-actions', () => ({
  listBatchMovementsAction: listBatchMovementsActionMock,
}));

const BATCH_ID = 'batch-42';
const BATCH_LOT = 'L-2026-09';
const DIALOG_WIDTH_CLASS = 'sm:max-w-[min(1000px,calc(100%-2rem))]';

function asiento(overrides: Partial<BatchHistoryEntry> = {}): BatchHistoryEntry {
  return {
    id: 'asiento-1',
    kind: 'adjustment',
    quantity: '-3',
    reason: 'merma',
    orderNumberText: null,
    authorName: 'Carla Duarte',
    createdAt: '2026-09-10T08:15:00.000Z',
    previousStock: null,
    countedStock: null,
    // 2026-10-16 (QC-288): solo los asientos de entrega sin pedido llevan clientes.
    customerNames: null,
    ...overrides,
  };
}

function abrir() {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const utils = render(<BatchHistory batchId={BATCH_ID} batchLot={BATCH_LOT} open onOpenChange={onOpenChange} />);
  return { ...utils, onOpenChange };
}

/** La fila de la tabla; la tarjeta del mismo asiento repite las celdas y en jsdom no se oculta. */
function fila(entry: Pick<BatchHistoryEntry, 'kind' | 'id'>) {
  return screen.findByTestId(`data-table-row-${entry.kind}-${entry.id}`);
}

/** Alias: en los casos R54 `fila` nombra el elemento. */
const filaDe = fila;

function cabeceras(): string[] {
  const tabla = within(screen.getByTestId('batch-history-list')).getByRole('table');
  return within(tabla)
    .getAllByRole('columnheader')
    .map((th) => th.textContent?.trim() ?? '');
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('BatchHistory en diálogo', () => {
  it('R21 — se titula «Historial del lote <lote>», con el lote en cifras tabulares', async () => {
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [] });
    abrir();

    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('heading', { name: `Historial del lote ${BATCH_LOT}` })).toBeInTheDocument();
    expect(within(dialogo).getByTestId('batch-history-lot')).toHaveClass('font-mono', 'tabular-nums');
  });

  it('R52 — el diálogo llega a 1000 px y deja 16 px a cada lado de la ventana', async () => {
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [] });
    abrir();

    const dialogo = await screen.findByTestId('batch-history-dialog');
    expect(dialogo).toHaveClass(DIALOG_WIDTH_CLASS);
    expect(dialogo).not.toHaveClass('sm:max-w-[1000px]');
  });

  // 2026-10-19 (enmienda QC-288): «Cliente» entra como novena columna, entre «Pedido» y «Autor».
  it('R21 — la tabla tiene las nueve columnas, en orden', async () => {
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [asiento()] });
    abrir();

    await screen.findByTestId('batch-history-list');
    expect(cabeceras()).toEqual([
      'Tipo',
      'Cantidad',
      'Existencia anterior',
      'Total contado',
      'Motivo',
      'Pedido',
      'Cliente',
      'Autor',
      'Fecha',
    ]);
  });

  it('R21 — los asientos salen en el orden en que llegan, con tipo, cantidad, pedido, autor y fecha', async () => {
    const apartado = asiento({
      id: 'apartado-1',
      kind: 'reserve',
      quantity: '5',
      reason: null,
      orderNumberText: 'PED-0042',
      createdAt: '2026-09-15T10:00:00.000Z',
    });
    const alta = asiento({
      id: 'alta-1',
      kind: 'opening',
      quantity: '20',
      reason: null,
      authorName: 'Ana Rios',
      createdAt: '2026-01-05T09:30:00.000Z',
    });
    // La action ya devuelve del mas reciente al mas antiguo: el componente NO reordena.
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [apartado, alta] });
    abrir();

    const filaApartado = await fila(apartado);
    const filaAlta = await fila(alta);
    const tabla = within(screen.getByTestId('batch-history-list')).getByRole('table');
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(filas).toEqual([filaApartado, filaAlta]);

    expect(within(filaApartado).getByTestId('batch-history-entry-kind')).toHaveTextContent(movementKindLabel('reserve'));
    expect(within(filaApartado).getByTestId('batch-history-entry-quantity')).toHaveTextContent('5');
    expect(within(filaApartado).getByTestId('batch-history-entry-order')).toHaveTextContent('PED-0042');
    expect(within(filaApartado).getByTestId('batch-history-entry-author')).toHaveTextContent('Carla Duarte');
    expect(within(filaApartado).getByTestId('batch-history-entry-date')).toHaveTextContent('2026-09-15 10:00');

    expect(within(filaAlta).getByTestId('batch-history-entry-kind')).toHaveTextContent(movementKindLabel('opening'));
    expect(within(filaAlta).getByTestId('batch-history-entry-author')).toHaveTextContent('Ana Rios');
    expect(within(filaAlta).getByTestId('batch-history-entry-date')).toHaveTextContent('2026-01-05 09:30');
  });

  it('R21 — un dato ausente pinta «—» en su celda, sin inventar motivo, pedido ni existencias', async () => {
    const alta = asiento({ id: 'alta-1', kind: 'opening', quantity: '20', reason: null, orderNumberText: null });
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [alta] });
    abrir();

    const row = await fila(alta);
    for (const columna of ['previousStock', 'countedStock', 'reason', 'order']) {
      expect(within(row).getByTestId(`data-table-cell-${columna}`)).toHaveTextContent(EMPTY_MARK);
    }
    expect(within(row).queryByTestId('batch-history-entry-reason')).toBeNull();
    expect(within(row).queryByTestId('batch-history-entry-order')).toBeNull();
    expect(within(row).queryByTestId('batch-history-entry-previous-stock')).toBeNull();
    expect(within(row).queryByTestId('batch-history-entry-counted-stock')).toBeNull();
  });

  it('R21 — sin autor, indica que lo hizo el sistema', async () => {
    const caducidad = asiento({
      kind: 'expire',
      quantity: '-2',
      reason: null,
      orderNumberText: 'PED-0007',
      authorName: null,
    });
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [caducidad] });
    abrir();

    const row = await fila(caducidad);
    expect(within(row).getByTestId('batch-history-entry-author')).toHaveTextContent('Sistema');
    expect(within(row).getByTestId('batch-history-entry-kind')).toHaveTextContent(movementKindLabel('expire'));
  });

  it('R21 — la cantidad se pinta a dos decimales, con la cifra exacta en el title y el aria-label', async () => {
    const consumo = asiento({ kind: 'consume', quantity: '12345.6789', reason: null });
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [consumo] });
    abrir();

    const cantidad = within(await fila(consumo)).getByTestId('batch-history-entry-quantity');
    expect(cantidad).toHaveTextContent('12345.68');
    expect(cantidad).toHaveAttribute('title', '12345.6789');
    expect(cantidad).toHaveAttribute('aria-label', '12345.6789');
  });

  it('R21 — un ajuste con existencia anterior y total contado los pinta en sus columnas', async () => {
    const conteo = historyEntry({ id: 'conteo-1', quantity: '-2.5000', previousStock: '12.3456', countedStock: '9.8456' });
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [conteo] });
    abrir();

    const row = await fila(conteo);
    const anterior = within(row).getByTestId('batch-history-entry-previous-stock');
    const contado = within(row).getByTestId('batch-history-entry-counted-stock');
    expect(within(row).getByTestId('data-table-cell-previousStock')).toContainElement(anterior);
    expect(within(row).getByTestId('data-table-cell-countedStock')).toContainElement(contado);
    expect(anterior).toHaveTextContent('12.35');
    expect(anterior).toHaveAttribute('title', '12.3456');
    expect(anterior).toHaveAttribute('aria-label', '12.3456');
    expect(contado).toHaveTextContent('9.85');
    expect(contado).toHaveAttribute('aria-label', '9.8456');
    expect(within(row).getByTestId('batch-history-entry-quantity')).toHaveTextContent('-2.5');
  });

  it('R21 — las fixtures de ajuste con y sin conteo: el viejo pinta «—» en las dos existencias', async () => {
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [ADJUSTMENT_WITH_COUNT, LEGACY_ADJUSTMENT] });
    abrir();

    const conConteo = await fila(ADJUSTMENT_WITH_COUNT);
    expect(within(conConteo).getByTestId('batch-history-entry-previous-stock')).toHaveTextContent('10');
    expect(within(conConteo).getByTestId('batch-history-entry-counted-stock')).toHaveTextContent('7');

    const viejo = await fila(LEGACY_ADJUSTMENT);
    expect(within(viejo).getByTestId('data-table-cell-previousStock')).toHaveTextContent(EMPTY_MARK);
    expect(within(viejo).getByTestId('data-table-cell-countedStock')).toHaveTextContent(EMPTY_MARK);
    expect(within(viejo).getByTestId('batch-history-entry-reason')).toHaveTextContent('Merma');
  });

  it('R21 — un asiento de entrega y su anulación con sus textos y el signo de hoy', async () => {
    const entrega = asiento({
      id: 'entrega-1',
      kind: 'delivery',
      quantity: '-8.0000',
      reason: null,
      orderNumberText: '2026-0000007',
      createdAt: '2026-10-08T14:20:00.000Z',
    });
    const anulacion = asiento({
      id: 'anulacion-1',
      kind: 'delivery_void',
      quantity: '3.0000',
      reason: null,
      orderNumberText: '2026-0000024',
      createdAt: '2026-10-09T09:00:00.000Z',
    });
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [entrega, anulacion] });
    abrir();

    const filaEntrega = await fila(entrega);
    expect(within(filaEntrega).getByTestId('batch-history-entry-kind')).toHaveTextContent('Entrega a cliente');
    expect(within(filaEntrega).getByTestId('batch-history-entry-quantity')).toHaveAttribute('aria-label', '-8');
    expect(within(filaEntrega).getByTestId('batch-history-entry-order')).toHaveTextContent('2026-0000007');

    const filaAnulacion = await fila(anulacion);
    expect(within(filaAnulacion).getByTestId('batch-history-entry-kind')).toHaveTextContent('Anulación de entrega');
    expect(within(filaAnulacion).getByTestId('batch-history-entry-quantity')).toHaveAttribute('aria-label', '3');
  });

  it('R21 — cada tipo de asiento tiene una etiqueta legible propia, sin reutilizar la de otro', () => {
    const kinds: readonly BatchHistoryEntry['kind'][] = [
      'opening',
      'adjustment',
      'consumption',
      'reserve',
      'release',
      'expire',
      'consume',
      'delivery',
      'delivery_void',
    ];
    const etiquetas = kinds.map(movementKindLabel);
    expect(new Set(etiquetas).size).toBe(kinds.length);
  });

  it('R21 — un mismo id en los dos libros no choca: son dos filas', async () => {
    const ajuste = asiento({ id: 'mismo-id', kind: 'adjustment' });
    const reserva = asiento({ id: 'mismo-id', kind: 'reserve', reason: null, orderNumberText: 'PED-0099' });
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [ajuste, reserva] });
    abrir();

    expect(await fila(ajuste)).toBeInTheDocument();
    expect(await fila(reserva)).toBeInTheDocument();
  });

  // 2026-10-19 (enmienda QC-288): la tarjeta suma el campo «Cliente» en la misma posición que la tabla.
  it('R23 — cada asiento tiene también su tarjeta, con el tipo delante y la cantidad como estado', async () => {
    const conteo = historyEntry({ id: 'conteo-1', quantity: '-2.5000', previousStock: '12.3456', countedStock: '9.8456' });
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [conteo] });
    abrir();

    const tarjeta = await screen.findByTestId(`data-table-card-${conteo.kind}-${conteo.id}`);
    const campos = within(tarjeta)
      .getAllByTestId(/^data-table-card-field-/)
      .map((campo) => campo.dataset.testid);
    expect(campos).toEqual([
      'data-table-card-field-kind',
      'data-table-card-field-quantity',
      'data-table-card-field-previousStock',
      'data-table-card-field-countedStock',
      'data-table-card-field-reason',
      'data-table-card-field-order',
      'data-table-card-field-customer',
      'data-table-card-field-author',
      'data-table-card-field-date',
    ]);
    expect(within(tarjeta).getByTestId('batch-history-entry-quantity')).toHaveTextContent('-2.5');
  });
});

describe('BatchHistory: carga y estados', () => {
  it('R22 — mientras llegan los asientos dice que carga', async () => {
    listBatchMovementsActionMock.mockReturnValue(new Promise(() => undefined));
    abrir();

    expect(await screen.findByTestId('batch-history-loading')).toHaveTextContent('Cargando historial…');
    expect(screen.queryByTestId('batch-history-list')).toBeNull();
  });

  it('R22 — sin ningun asiento, dice que el lote es anterior al libro y no parece un error ni una tabla', async () => {
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [] });
    abrir();

    expect(await screen.findByTestId('batch-history-before-ledger')).toHaveTextContent(
      'Este lote es anterior al libro de movimientos: no tiene historial registrado.',
    );
    expect(screen.queryByTestId('batch-history-error')).toBeNull();
    expect(screen.queryByTestId('batch-history-list')).toBeNull();
  });

  it('R22 — el error de carga tiene su propio marcador y role="alert"', async () => {
    listBatchMovementsActionMock.mockResolvedValue({
      status: 'error',
      code: 'unexpected_error',
      message: 'No se pudo cargar el historial.',
      reference: 'req-1',
    });
    abrir();

    const error = await screen.findByTestId('batch-history-error');
    expect(error).toHaveAttribute('role', 'alert');
    expect(error).toHaveTextContent('No se pudo cargar el historial.');
    expect(screen.queryByTestId('batch-history-before-ledger')).toBeNull();
    expect(screen.queryByTestId('batch-history-list')).toBeNull();
  });

  it('R22 — cerrado no pide nada; pide la primera vez que se abre y no vuelve a pedir al reabrir', async () => {
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [asiento()] });
    const onOpenChange = vi.fn<(open: boolean) => void>();
    const { rerender } = render(
      <BatchHistory batchId={BATCH_ID} batchLot={BATCH_LOT} open={false} onOpenChange={onOpenChange} />,
    );
    expect(listBatchMovementsActionMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();

    rerender(<BatchHistory batchId={BATCH_ID} batchLot={BATCH_LOT} open onOpenChange={onOpenChange} />);
    await screen.findByTestId('batch-history-list');
    rerender(<BatchHistory batchId={BATCH_ID} batchLot={BATCH_LOT} open={false} onOpenChange={onOpenChange} />);
    rerender(<BatchHistory batchId={BATCH_ID} batchLot={BATCH_LOT} open onOpenChange={onOpenChange} />);
    await screen.findByTestId('batch-history-list');

    expect(listBatchMovementsActionMock).toHaveBeenCalledTimes(1);
    expect(listBatchMovementsActionMock).toHaveBeenCalledWith(BATCH_ID);
  });

  it('R21 — controlado, no pinta disparador propio', async () => {
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [] });
    abrir();

    await screen.findByTestId('batch-history-before-ledger');
    expect(screen.queryByTestId('batch-history-trigger')).toBeNull();
  });
});

describe('BatchHistory encima del panel «Lotes»', () => {
  function PanelConHistorial({ onPanelOpenChange }: { readonly onPanelOpenChange: (open: boolean) => void }) {
    const [historyOpen, setHistoryOpen] = useState(true);
    return (
      <Sheet open onOpenChange={onPanelOpenChange}>
        <SheetContent data-testid="panel-lotes">
          <SheetTitle>Lotes</SheetTitle>
          <BatchHistory batchId={BATCH_ID} batchLot={BATCH_LOT} open={historyOpen} onOpenChange={setHistoryOpen} />
        </SheetContent>
      </Sheet>
    );
  }

  it('R23 — cerrar el historial con Escape no cierra el panel', async () => {
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [] });
    const onPanelOpenChange = vi.fn<(open: boolean) => void>();
    const user = setupUser();
    render(<PanelConHistorial onPanelOpenChange={onPanelOpenChange} />);

    await screen.findByTestId('batch-history-before-ledger');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByTestId('batch-history-dialog')).toBeNull());
    expect(screen.getByTestId('panel-lotes')).toBeInTheDocument();
    expect(onPanelOpenChange).not.toHaveBeenCalled();
  });
});

describe('R21, R56 — fecha a la derecha y rotulos de la tarjeta del asiento', () => {
  const completo = asiento({
    id: 'completo-1',
    kind: 'adjustment',
    quantity: '-3',
    previousStock: '12',
    countedStock: '9',
    reason: 'conteo_fisico',
    orderNumberText: 'PED-0042',
    authorName: 'Carla Duarte',
    createdAt: '2026-09-10T08:15:00.000Z',
  });

  function tarjetaDe(entry: Pick<BatchHistoryEntry, 'kind' | 'id'>) {
    return screen.findByTestId(`data-table-card-${entry.kind}-${entry.id}`);
  }

  function rotuloDe(card: HTMLElement, columna: string): HTMLElement | null {
    return within(card).getByTestId(`data-table-card-field-${columna}`).querySelector<HTMLElement>('[data-card-label]');
  }

  it('R21 — la cabecera y la celda de «Fecha» van a la derecha', async () => {
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [completo] });
    abrir();

    const row = await fila(completo);
    expect(screen.getByTestId('data-table-head-date')).toHaveClass('text-right');
    expect(within(row).getByTestId('data-table-cell-date')).toHaveClass('text-right');
    expect(within(row).getByTestId('data-table-cell-author')).not.toHaveClass('text-right');
  });

  it('R56 — «Existencia anterior», «Total contado», «Motivo» y «Pedido» van delante de su valor; autor y fecha, sin rotulo', async () => {
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [completo] });
    abrir();

    const card = await tarjetaDe(completo);
    const esperados: Record<string, string> = {
      previousStock: 'Existencia anterior',
      countedStock: 'Total contado',
      reason: 'Motivo',
      order: 'Pedido',
    };
    for (const [columna, texto] of Object.entries(esperados)) {
      const etiqueta = rotuloDe(card, columna);
      expect(etiqueta, columna).not.toBeNull();
      expect(etiqueta?.textContent?.trim(), columna).toBe(texto);
      expect(etiqueta, columna).toHaveClass('text-muted-foreground', '[table_&]:hidden');
      expect(within(card).getByTestId(`data-table-card-field-${columna}`).textContent?.startsWith(texto), columna).toBe(
        true,
      );
    }
    expect(rotuloDe(card, 'author')).toBeNull();
    expect(rotuloDe(card, 'date')).toBeNull();
  });

  it('R56 — el texto de cada `batch-history-entry-*` sigue siendo solo su valor', async () => {
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [completo] });
    abrir();

    const card = await tarjetaDe(completo);
    expect(within(card).getByTestId('batch-history-entry-previous-stock').textContent).toBe('12');
    expect(within(card).getByTestId('batch-history-entry-counted-stock').textContent).toBe('9');
    expect(within(card).getByTestId('batch-history-entry-reason').textContent).toBe(movementReasonLabel('conteo_fisico'));
    expect(within(card).getByTestId('batch-history-entry-order').textContent).toBe('PED-0042');
    expect(within(card).getByTestId('batch-history-entry-author').textContent).toBe('Carla Duarte');
    expect(within(card).getByTestId('batch-history-entry-date').textContent).toBe('2026-09-10 08:15');
  });

  it('R56 — sin dato, el «—» lleva su rotulo y en la tabla el rotulo se oculta', async () => {
    const alta = asiento({ id: 'alta-1', kind: 'opening', quantity: '20', reason: null, orderNumberText: null });
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [alta] });
    abrir();

    const card = await tarjetaDe(alta);
    expect(within(card).getByTestId('data-table-card-field-reason')).toHaveTextContent(`Motivo ${EMPTY_MARK}`);
    const etiquetaEnTabla = within(await fila(alta))
      .getByTestId('data-table-cell-reason')
      .querySelector('[data-card-label]');
    expect(etiquetaEnTabla).toHaveClass('[table_&]:hidden');
    expect(etiquetaEnTabla?.closest('table')).not.toBeNull();
  });

  it('R56 — cada rotulo del asiento sale tambien cuando todo su valor es «—»', async () => {
    const vacio = asiento({
      id: 'vacio-1',
      kind: 'opening',
      quantity: '20',
      previousStock: null,
      countedStock: null,
      reason: null,
      orderNumberText: null,
    });
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [vacio] });
    abrir();

    const card = await tarjetaDe(vacio);
    const esperados: Record<string, string> = {
      previousStock: 'Existencia anterior',
      countedStock: 'Total contado',
      reason: 'Motivo',
      order: 'Pedido',
    };
    for (const [columna, texto] of Object.entries(esperados)) {
      const etiqueta = rotuloDe(card, columna);
      expect(etiqueta, columna).not.toBeNull();
      expect(etiqueta?.textContent?.trim(), columna).toBe(texto);
      expect(within(card).getByTestId(`data-table-card-field-${columna}`), columna).toHaveTextContent(
        `${texto} ${EMPTY_MARK}`,
      );
    }
    expect(within(card).queryByTestId('batch-history-entry-previous-stock')).toBeNull();
    expect(within(card).queryByTestId('batch-history-entry-counted-stock')).toBeNull();
    expect(within(card).queryByTestId('batch-history-entry-reason')).toBeNull();
    expect(within(card).queryByTestId('batch-history-entry-order')).toBeNull();
  });
});

describe('movementReasonLabel', () => {
  it.each([
    ['merma', 'Merma'],
    ['rotura', 'Rotura'],
    ['conteo_fisico', 'Conteo físico'],
    ['error_de_carga', 'Error de carga'],
  ] as const)('R24, R46 — «%s» se lee «%s»', (reason, label) => {
    expect(movementReasonLabel(reason)).toBe(label);
  });

  it('R46 — hay un caso por cada motivo del dominio', () => {
    expect([...MOVEMENT_REASONS].sort()).toEqual(['conteo_fisico', 'error_de_carga', 'merma', 'rotura']);
  });

  // 2026-10-16 (QC-288): la entrega sin pedido y su anulación nombran al cliente, no un pedido.
  it('R54 — un asiento de entrega sin pedido se pinta «Entrega sin pedido», en negativo y con los clientes en vez del pedido', async () => {
    const entrega = asiento({
      id: 'directa-1',
      kind: 'direct_delivery',
      quantity: '-6.0000',
      reason: null,
      orderNumberText: null,
      authorName: 'Carla Duarte',
      createdAt: '2026-10-16T10:05:00.000Z',
      customerNames: ['Laura Gómez', 'Mario Ruiz'],
    });
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [entrega] });

    abrir();

    const fila = await filaDe(entrega);
    const tipo = within(fila).getByTestId('batch-history-entry-kind');
    expect(tipo).toHaveTextContent('Entrega sin pedido');
    expect(tipo.querySelector('[data-tone]')).toHaveAttribute('data-tone', 'info');
    expect(movementKindLabel('direct_delivery')).toBe('Entrega sin pedido');
    const cantidad = within(fila).getByTestId('batch-history-entry-quantity');
    expect(cantidad).toHaveAttribute('aria-label', '-6');
    expect(cantidad.textContent).toMatch(/^-6/);
    const clientes = within(fila).getByTestId('batch-history-entry-customers');
    expect(clientes).toHaveTextContent('Laura Gómez, Mario Ruiz');
    expect(within(fila).getByTestId('data-table-cell-customer')).toContainElement(clientes);
    expect(within(fila).queryByTestId('batch-history-entry-order')).toBeNull();
    expect(within(fila).getByTestId('data-table-cell-order')).toHaveTextContent(EMPTY_MARK);
    expect(within(fila).getByTestId('batch-history-entry-author')).toHaveTextContent('Carla Duarte');
    expect(within(fila).getByTestId('batch-history-entry-date')).toHaveTextContent('2026-10-16 10:05');

    const tarjeta = screen.getByTestId(`data-table-card-${entrega.kind}-${entrega.id}`);
    expect(within(tarjeta).getByTestId('data-table-card-field-customer')).toHaveTextContent(
      'Cliente Laura Gómez, Mario Ruiz',
    );
    expect(within(tarjeta).getByTestId('data-table-card-field-order')).toHaveTextContent(`Pedido ${EMPTY_MARK}`);
  });

  it('R54 — un asiento de anulación de entrega sin pedido se pinta con su tipo, en positivo y con el cliente', async () => {
    const anulacion = asiento({
      id: 'directa-anulada-1',
      kind: 'direct_delivery_void',
      quantity: '2.0000',
      reason: null,
      orderNumberText: null,
      authorName: 'Laura Gomez',
      createdAt: '2026-10-14T11:30:00.000Z',
      customerNames: ['Mario Ruiz'],
    });
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [anulacion] });

    abrir();

    const fila = await filaDe(anulacion);
    const tipo = within(fila).getByTestId('batch-history-entry-kind');
    expect(tipo).toHaveTextContent('Anulación de entrega sin pedido');
    expect(tipo.querySelector('[data-tone]')).toHaveAttribute('data-tone', 'muted');
    expect(movementKindLabel('direct_delivery_void')).not.toBe(movementKindLabel('delivery_void'));
    const cantidad = within(fila).getByTestId('batch-history-entry-quantity');
    expect(cantidad).toHaveAttribute('aria-label', '2');
    expect(cantidad.textContent).not.toContain('-');
    expect(within(fila).getByTestId('data-table-cell-customer')).toHaveTextContent('Mario Ruiz');
    expect(within(fila).queryByTestId('batch-history-entry-order')).toBeNull();
    expect(within(fila).getByTestId('data-table-cell-order')).toHaveTextContent(EMPTY_MARK);
    expect(within(fila).queryByTestId('batch-history-entry-reason')).toBeNull();
  });

  it('R54 — sin clientes resueltos el asiento sin pedido pinta la marca de vacío; los demás tipos no llevan cliente', async () => {
    const sinClientes = asiento({
      id: 'directa-sin-clientes',
      kind: 'direct_delivery',
      quantity: '-1.0000',
      reason: null,
      customerNames: [],
    });
    const dePedido = asiento({
      id: 'de-pedido',
      kind: 'delivery',
      quantity: '-1.0000',
      reason: null,
      orderNumberText: '2026-0000007',
    });
    listBatchMovementsActionMock.mockResolvedValue({ status: 'success', data: [sinClientes, dePedido] });

    abrir();

    const fila = await filaDe(sinClientes);
    expect(within(fila).queryByTestId('batch-history-entry-customers')).toBeNull();
    expect(within(fila).getByTestId('data-table-cell-customer')).toHaveTextContent(EMPTY_MARK);
    const otra = await filaDe(dePedido);
    expect(within(otra).queryByTestId('batch-history-entry-customers')).toBeNull();
    expect(within(otra).getByTestId('data-table-cell-customer')).toHaveTextContent(EMPTY_MARK);
    expect(within(otra).getByTestId('batch-history-entry-order')).toHaveTextContent('2026-0000007');
    expect(within(otra).getByTestId('batch-history-entry-kind').querySelector('[data-tone]')).toBeNull();
  });

  it('R54 — los dos tipos sin pedido tienen etiqueta propia, distinta de las demás', () => {
    const kinds: readonly BatchHistoryEntry['kind'][] = [
      'opening',
      'adjustment',
      'consumption',
      'reserve',
      'release',
      'expire',
      'consume',
      'delivery',
      'delivery_void',
      'direct_delivery',
      'direct_delivery_void',
    ];
    expect(new Set(kinds.map(movementKindLabel)).size).toBe(kinds.length);
  });
});
