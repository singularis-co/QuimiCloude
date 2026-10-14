import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FINISHED_PRODUCT_MOVEMENT_KIND_LABELS,
  FinishedProductBatchesTable,
  FinishedProductCostsTable,
  FinishedProductDeliveriesTable,
  FinishedProductListSection,
  FinishedProductMovementsTable,
  PAGE_PARAM,
  PAGE_SIZE_PARAM,
  TAB_PARAM,
  WITHOUT_ORDER_LABEL,
  finishedProductListEmptyTestId,
  finishedProductListErrorTestId,
  type FinishedProductListTab,
} from '@/app/(private)/inventario/producto-terminado/[id]/components';
import { MOVEMENT_REASONS, type MovementReason } from '@/lib/modules/inventario';
import { finishedProductDetailRoute } from '@/lib/shared/routes';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import {
  FINISHED_DELIVERY_ROWS,
  FINISHED_IN_MOVEMENTS,
  FINISHED_ORDER_NUMBER,
  FINISHED_OUT_MOVEMENTS,
  FINISHED_PRODUCT_ERROR_STATES,
  FINISHED_PRODUCT_ID,
  FINISHED_VOID_REASON,
  UNPACKAGED_BATCH_ROW,
  VOIDED_DELIVERY_ROW,
  finishedProductBatchRow,
  finishedProductCostRow,
  finishedProductDeliveriesPage,
  finishedProductDeliveryRow,
  finishedProductPage,
} from '../../fixtures/finished-product-detail';
import { setupUser } from '../../helpers/user-event';

const {
  routerMock,
  listBatchesMock,
  listMovementsMock,
  listDeliveriesMock,
  listCostsMock,
} = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  },
  listBatchesMock: vi.fn(),
  listMovementsMock: vi.fn(),
  listDeliveriesMock: vi.fn(),
  listCostsMock: vi.fn(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

// Sin sesion no hay columna «Evidencia» ni conteo: estos casos no cambian con ella.
vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: vi.fn(async () => null) },
  observabilidad: { readRequestIdHeader: vi.fn(async () => 'req-1') },
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-evidence-actions', () => ({
  getOrderEvidenceAction: vi.fn(),
  countOrderEvidenceAction: vi.fn(),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/finished-product-actions', () => ({
  getFinishedProductAction: vi.fn(),
  listFinishedProductBatchesAction: listBatchesMock,
  listFinishedProductMovementsAction: listMovementsMock,
  listFinishedProductDeliveriesAction: listDeliveriesMock,
  listFinishedProductCostsAction: listCostsMock,
  listProducedProductsAction: vi.fn(),
}));

const UNIT = 'L';
const REASON_LABELS = Object.fromEntries(
  MOVEMENT_REASONS.map((reason) => [reason, `motivo:${reason}`]),
) as Record<MovementReason, string>;

function rowOf(id: string): HTMLElement {
  return screen.getByTestId(`data-table-row-${id}`);
}

function cell(row: HTMLElement, testId: string): HTMLElement {
  return within(row).getByTestId(testId);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('Lotes', () => {
  it('R13 — columnas de Lotes con existencia en unidad base y en envases, y «Sin pedido»', () => {
    const conPedido = finishedProductBatchRow();
    render(
      <FinishedProductBatchesTable
        productId={FINISHED_PRODUCT_ID}
        page={finishedProductPage([conPedido, UNPACKAGED_BATCH_ROW])}
        unitLabel={UNIT}
      />,
    );

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    for (const label of [
      'Lote',
      'Pedido de origen',
      'Fecha de entrada',
      'Fecha de producción',
      'Vencimiento',
      'Contenido de envase',
      'Existencia',
      'En envases',
    ]) {
      expect(headers.some((text) => text?.includes(label)), label).toBe(true);
    }

    const fila = rowOf(conPedido.id);
    expect(cell(fila, 'finished-product-batch-row')).toHaveTextContent('L-2026-0225');
    expect(cell(fila, 'finished-product-batch-order')).toHaveTextContent(FINISHED_ORDER_NUMBER);
    expect(cell(fila, 'finished-product-batch-entry-date')).toHaveTextContent('2026-10-10');
    expect(cell(fila, 'finished-product-batch-production-date')).toHaveTextContent('2026-10-10');
    expect(cell(fila, 'finished-product-batch-expiry-date')).toHaveTextContent('2027-10-10');
    expect(cell(fila, 'finished-product-batch-package-content')).toHaveTextContent('1 L');
    expect(cell(fila, 'finished-product-batch-stock')).toHaveTextContent('10.5 L');
    expect(cell(fila, 'finished-product-batch-packaged')).toHaveTextContent('10 envases + 0.5 L');

    const sinPedido = rowOf(UNPACKAGED_BATCH_ROW.id);
    expect(cell(sinPedido, 'finished-product-batch-order')).toHaveTextContent(WITHOUT_ORDER_LABEL);
    expect(cell(sinPedido, 'finished-product-batch-package-content')).toHaveTextContent(EMPTY_MARK);
    expect(cell(sinPedido, 'finished-product-batch-packaged')).toHaveTextContent(EMPTY_MARK);
    expect(cell(sinPedido, 'finished-product-batch-production-date')).toHaveTextContent(EMPTY_MARK);
  });

  it('R13 — un lote agotado sigue en la lista con existencia cero', () => {
    const agotado = finishedProductBatchRow({
      id: 'agotado',
      stock: '0.0000',
      packagedStock: { packages: 0, remainder: null },
    });
    render(
      <FinishedProductBatchesTable
        productId={FINISHED_PRODUCT_ID}
        page={finishedProductPage([agotado])}
        unitLabel={UNIT}
      />,
    );

    expect(cell(rowOf('agotado'), 'finished-product-batch-stock')).toHaveTextContent('0 L');
    expect(cell(rowOf('agotado'), 'finished-product-batch-packaged')).toHaveTextContent('0 envases');
  });
});

describe('Entradas y Salidas', () => {
  function renderMovements(tab: 'entradas' | 'salidas', items = tab === 'entradas' ? FINISHED_IN_MOVEMENTS : FINISHED_OUT_MOVEMENTS) {
    return render(
      <FinishedProductMovementsTable
        productId={FINISHED_PRODUCT_ID}
        tab={tab}
        page={finishedProductPage(items)}
        unitLabel={UNIT}
        reasonLabels={REASON_LABELS}
      />,
    );
  }

  it('R15, R16 — Entradas con su origen: produccion con pedido, apertura y ajuste con motivo', () => {
    renderMovements('entradas');

    const [anulacion, ajuste, produccion, apertura] = FINISHED_IN_MOVEMENTS;

    const filaProduccion = rowOf(produccion.id);
    expect(cell(filaProduccion, 'finished-product-movement-origin')).toHaveTextContent('Producción');
    expect(cell(filaProduccion, 'finished-product-movement-order')).toHaveTextContent(
      FINISHED_ORDER_NUMBER,
    );
    expect(cell(filaProduccion, 'finished-product-movement-quantity')).toHaveTextContent('12 L');
    expect(cell(filaProduccion, 'finished-product-movement-packaged')).toHaveTextContent('12 envases');
    expect(cell(filaProduccion, 'finished-product-movement-row')).toHaveTextContent('2026-10-10 12:00');

    const filaApertura = rowOf(apertura.id);
    expect(cell(filaApertura, 'finished-product-movement-origin')).toHaveTextContent(
      'Apertura (alta o importación)',
    );
    expect(cell(filaApertura, 'finished-product-movement-packaged')).toHaveTextContent(EMPTY_MARK);
    expect(cell(filaApertura, 'finished-product-movement-order')).toHaveTextContent(EMPTY_MARK);

    const filaAjuste = rowOf(ajuste.id);
    expect(cell(filaAjuste, 'finished-product-movement-origin')).toHaveTextContent('Ajuste');
    expect(cell(filaAjuste, 'finished-product-movement-reason')).toHaveTextContent(
      REASON_LABELS.conteo_fisico,
    );
    expect(cell(filaAjuste, 'finished-product-movement-lot')).toHaveTextContent('L-2026-0226');

    expect(within(screen.getByRole('table')).getAllByTestId('finished-product-movement-row')).toHaveLength(4);
    expect(rowOf(anulacion.id)).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').some((th) => th.textContent?.includes('Origen'))).toBe(true);
  });

  it('R35 — Entradas etiqueta el delivery_void como «Anulación de entrega» con su pedido', () => {
    renderMovements('entradas');

    const anulacion = rowOf(FINISHED_IN_MOVEMENTS[0].id);
    expect(cell(anulacion, 'finished-product-movement-origin')).toHaveTextContent(
      'Anulación de entrega',
    );
    expect(cell(anulacion, 'finished-product-movement-order')).toHaveTextContent(
      FINISHED_ORDER_NUMBER,
    );
    expect(FINISHED_PRODUCT_MOVEMENT_KIND_LABELS.delivery_void).toBe('Anulación de entrega');
  });

  it('R17 — Salidas con la entrega y el ajuste que resta, cantidad sin signo', () => {
    renderMovements('salidas');

    const [ajuste, entrega] = FINISHED_OUT_MOVEMENTS;

    const filaEntrega = rowOf(entrega.id);
    expect(cell(filaEntrega, 'finished-product-movement-origin')).toHaveTextContent(
      'Entrega a cliente',
    );
    expect(cell(filaEntrega, 'finished-product-movement-quantity')).toHaveTextContent('4 L');
    expect(cell(filaEntrega, 'finished-product-movement-order')).toHaveTextContent(
      FINISHED_ORDER_NUMBER,
    );

    const filaAjuste = rowOf(ajuste.id);
    expect(cell(filaAjuste, 'finished-product-movement-origin')).toHaveTextContent('Ajuste');
    expect(cell(filaAjuste, 'finished-product-movement-reason')).toHaveTextContent(REASON_LABELS.merma);
    expect(cell(filaAjuste, 'finished-product-movement-quantity')).toHaveTextContent('0.5 L');
    expect(cell(filaAjuste, 'finished-product-movement-packaged')).toHaveTextContent(
      '0 envases + 0.5 L',
    );

    for (const cantidad of screen.getAllByTestId('finished-product-movement-quantity')) {
      expect(cantidad.textContent).not.toContain('-');
    }
    expect(screen.getAllByRole('columnheader').some((th) => th.textContent?.includes('Tipo'))).toBe(true);
  });
});

describe('Entregas', () => {
  function renderDeliveries(page = finishedProductDeliveriesPage()) {
    return render(
      <FinishedProductDeliveriesTable productId={FINISHED_PRODUCT_ID} page={page} unitLabel={UNIT} />,
    );
  }

  it('R19, R20 — Entregas con cliente, pedido, lote, envases y cantidad; dado de baja y ausente', () => {
    const deBaja = finishedProductDeliveryRow({
      movementId: 'de-baja',
      customer: { id: 'c-baja', firstNames: 'Luis', lastNames: 'Gomez', isDeleted: true },
    });
    const ausente = finishedProductDeliveryRow({ movementId: 'ausente', customer: null, packages: null });
    renderDeliveries(finishedProductDeliveriesPage({ items: [FINISHED_DELIVERY_ROWS[0], deBaja, ausente], total: 3 }));

    const activa = rowOf(FINISHED_DELIVERY_ROWS[0].movementId);
    expect(cell(activa, 'finished-product-delivery-row')).toHaveTextContent('2026-10-11 10:00');
    expect(cell(activa, 'finished-product-delivery-customer')).toHaveTextContent('Ana Perez');
    expect(within(activa).queryByTestId('finished-product-delivery-customer-deleted')).toBeNull();
    expect(cell(activa, 'finished-product-delivery-order')).toHaveTextContent(FINISHED_ORDER_NUMBER);
    expect(cell(activa, 'finished-product-delivery-lot')).toHaveTextContent('L-2026-0225');
    expect(cell(activa, 'finished-product-delivery-packages')).toHaveTextContent('4');
    expect(cell(activa, 'finished-product-delivery-quantity')).toHaveTextContent('4 L');

    const filaDeBaja = rowOf('de-baja');
    expect(cell(filaDeBaja, 'finished-product-delivery-customer')).toHaveTextContent('Luis Gomez');
    expect(cell(filaDeBaja, 'finished-product-delivery-customer-deleted')).toBeInTheDocument();

    const filaAusente = rowOf('ausente');
    expect(cell(filaAusente, 'finished-product-delivery-customer')).toHaveTextContent(EMPTY_MARK);
    expect(cell(filaAusente, 'finished-product-delivery-packages')).toHaveTextContent(EMPTY_MARK);
  });

  it('R33 — una fila anulada lleva «Anulada», su motivo y data-voided; la otra de la misma entrega no', () => {
    renderDeliveries();

    const anulada = rowOf(VOIDED_DELIVERY_ROW.movementId);
    expect(cell(anulada, 'finished-product-delivery-row')).toHaveAttribute('data-voided', 'true');
    const marca = cell(anulada, 'finished-product-delivery-void');
    expect(marca).toHaveTextContent('Anulada');
    expect(within(marca).getByTestId('finished-product-delivery-void-reason')).toHaveTextContent(
      FINISHED_VOID_REASON,
    );
    expect(cell(anulada, 'finished-product-delivery-lot')).toHaveTextContent('L-2026-0226');
    expect(cell(anulada, 'finished-product-delivery-packages')).toHaveTextContent('1');

    const viva = rowOf(FINISHED_DELIVERY_ROWS[0].movementId);
    expect(viva).not.toBe(anulada);
    expect(FINISHED_DELIVERY_ROWS[0].orderDeliveryId).toBe(VOIDED_DELIVERY_ROW.orderDeliveryId);
    expect(cell(viva, 'finished-product-delivery-row')).toHaveAttribute('data-voided', 'false');
    expect(within(viva).queryByTestId('finished-product-delivery-void')).toBeNull();
    expect(within(viva).queryByText(FINISHED_VOID_REASON)).toBeNull();
    expect(within(viva).queryByText('Anulada')).toBeNull();
  });

  it('R34 — el total entregado muestra delivered en unidad base y en envases, no la suma de la pagina', () => {
    renderDeliveries(
      finishedProductDeliveriesPage({ delivered: { quantity: '123.4500', packages: 37 }, total: 40, totalPages: 4 }),
    );

    const total = screen.getByTestId('finished-product-deliveries-total');
    expect(within(total).getByTestId('finished-product-deliveries-total-quantity')).toHaveTextContent(
      '123.45 L',
    );
    expect(within(total).getByTestId('finished-product-deliveries-total-packages')).toHaveTextContent(
      '37 envases',
    );
  });

  it('R34 — con todas las filas anuladas el total es cero', () => {
    renderDeliveries(
      finishedProductDeliveriesPage({
        items: [VOIDED_DELIVERY_ROW],
        total: 1,
        delivered: { quantity: '0.0000', packages: 0 },
      }),
    );

    expect(screen.getByTestId('finished-product-deliveries-total-quantity')).toHaveTextContent('0 L');
    expect(screen.getByTestId('finished-product-deliveries-total-packages')).toHaveTextContent(
      '0 envases',
    );
  });

  it('R36 — ninguna fila de Entregas lleva un boton o enlace, tampoco para anular', () => {
    renderDeliveries();

    for (const row of FINISHED_DELIVERY_ROWS) {
      const fila = rowOf(row.movementId);
      expect(within(fila).queryAllByRole('button')).toEqual([]);
      expect(within(fila).queryAllByRole('link')).toEqual([]);
    }
    expect(screen.queryByRole('button', { name: /anular/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /anular/i })).toBeNull();
  });
});

describe('Costo de produccion', () => {
  it('R21 — Costo con lote, pedido, cantidad, envases, unitario y total', () => {
    const sinCosto = finishedProductCostRow({ batchId: 'sin-costo', unitCost: null, totalCost: null });
    render(
      <FinishedProductCostsTable
        productId={FINISHED_PRODUCT_ID}
        page={finishedProductPage([finishedProductCostRow(), sinCosto])}
        unitLabel={UNIT}
      />,
    );

    const fila = rowOf(finishedProductCostRow().batchId);
    expect(cell(fila, 'finished-product-cost-row')).toHaveTextContent('L-2026-0225');
    expect(cell(fila, 'finished-product-cost-order')).toHaveTextContent(FINISHED_ORDER_NUMBER);
    expect(cell(fila, 'finished-product-cost-quantity')).toHaveTextContent('12 L');
    expect(cell(fila, 'finished-product-cost-packaged')).toHaveTextContent('12 envases');
    expect(cell(fila, 'finished-product-cost-unit')).toHaveTextContent('2.5');
    expect(cell(fila, 'finished-product-cost-total')).toHaveTextContent('30');

    expect(cell(rowOf('sin-costo'), 'finished-product-cost-unit')).toHaveTextContent(EMPTY_MARK);
    expect(cell(rowOf('sin-costo'), 'finished-product-cost-total')).toHaveTextContent(EMPTY_MARK);
  });
});

describe('Listados', () => {
  it('R23 — la paginacion navega cambiando page, con su tab y su tamaño', async () => {
    const user = setupUser();
    render(
      <FinishedProductBatchesTable
        productId={FINISHED_PRODUCT_ID}
        page={finishedProductPage([finishedProductBatchRow()], { total: 12, totalPages: 2 })}
        unitLabel={UNIT}
      />,
    );

    await user.click(screen.getByTestId('data-table-next'));

    expect(routerMock.push).toHaveBeenCalledTimes(1);
    const url = new URL(routerMock.push.mock.calls[0][0], 'http://local');
    expect(url.pathname).toBe(finishedProductDetailRoute(FINISHED_PRODUCT_ID));
    expect(url.searchParams.get(TAB_PARAM)).toBe('lotes');
    expect(url.searchParams.get(PAGE_PARAM)).toBe('2');
    expect(url.searchParams.get(PAGE_SIZE_PARAM)).toBe('10');
  });

  const TABS: readonly FinishedProductListTab[] = ['lotes', 'entradas', 'salidas', 'entregas', 'costo'];

  function mockAll(value: unknown) {
    for (const mock of [listBatchesMock, listMovementsMock, listDeliveriesMock, listCostsMock]) {
      mock.mockResolvedValue(value);
    }
  }

  async function renderSection(tab: FinishedProductListTab, page = 1) {
    const tree = await FinishedProductListSection({
      productId: FINISHED_PRODUCT_ID,
      tab,
      paging: { page, pageSize: 10 },
      unitLabel: UNIT,
    });
    return render(<>{tree}</>);
  }

  it('R24 — cada tab sin filas muestra su estado vacio propio, distinto del error', async () => {
    const vacios = new Set<string>();

    for (const tab of TABS) {
      mockAll({
        status: 'success',
        data: tab === 'entregas' ? finishedProductDeliveriesPage({ items: [], total: 0, totalPages: 0 }) : finishedProductPage([], { total: 0, totalPages: 0 }),
      });
      await renderSection(tab);

      const vacio = screen.getByTestId(finishedProductListEmptyTestId(tab));
      vacios.add(vacio.textContent ?? '');
      expect(screen.queryByTestId(finishedProductListErrorTestId(tab))).toBeNull();
      expect(screen.queryByRole('table')).toBeNull();
      expect(within(vacio).queryByRole('link')).toBeNull();
      cleanup();
    }

    expect(vacios.size).toBe(TABS.length);
  });

  it('R24 — cada tab en error muestra su estado de error, no el vacio', async () => {
    for (const tab of TABS) {
      mockAll(FINISHED_PRODUCT_ERROR_STATES.invalidInput);
      await renderSection(tab);

      expect(screen.getByTestId(finishedProductListErrorTestId(tab))).toBeInTheDocument();
      expect(screen.getByTestId(`${finishedProductListErrorTestId(tab)}-message`)).toHaveTextContent(
        FINISHED_PRODUCT_ERROR_STATES.invalidInput.message,
      );
      expect(screen.queryByTestId(finishedProductListEmptyTestId(tab))).toBeNull();
      cleanup();
    }
  });

  it('R24 — una pagina pasada del final ofrece volver a la primera', async () => {
    mockAll({ status: 'success', data: finishedProductPage([], { total: 3, page: 4, totalPages: 1 }) });
    await renderSection('lotes', 4);

    const enlace = screen.getByTestId(`${finishedProductListEmptyTestId('lotes')}-first-page`);
    const url = new URL(enlace.getAttribute('href') as string, 'http://local');
    expect(url.searchParams.get(PAGE_PARAM)).toBe('1');
    expect(url.searchParams.get(TAB_PARAM)).toBe('lotes');
  });

  it('R15, R17, R23 — la seccion pide solo el listado del tab activo, con la direccion de su signo', async () => {
    mockAll({ status: 'success', data: finishedProductPage(FINISHED_IN_MOVEMENTS) });

    await renderSection('entradas', 2);
    expect(listMovementsMock).toHaveBeenCalledWith(FINISHED_PRODUCT_ID, { page: 2, pageSize: 10, direction: 'in' });
    expect(screen.getByTestId('finished-product-entradas')).toBeInTheDocument();
    cleanup();

    await renderSection('salidas');
    expect(listMovementsMock).toHaveBeenLastCalledWith(FINISHED_PRODUCT_ID, { page: 1, pageSize: 10, direction: 'out' });
    expect(listBatchesMock).not.toHaveBeenCalled();
    expect(listDeliveriesMock).not.toHaveBeenCalled();
    expect(listCostsMock).not.toHaveBeenCalled();
  });

  it('R16 — los motivos llegan con la etiqueta de /inventario', async () => {
    mockAll({ status: 'success', data: finishedProductPage(FINISHED_OUT_MOVEMENTS) });
    await renderSection('salidas');

    expect(cell(rowOf(FINISHED_OUT_MOVEMENTS[0].id), 'finished-product-movement-reason')).toHaveTextContent(
      'Merma',
    );
  });
});
