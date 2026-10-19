import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DIRECT_DELIVERY_ACTIONS_TESTID,
  DIRECT_DELIVERY_LABEL,
  DIRECT_DELIVERY_VOID_DIALOG_TESTID,
  DIRECT_DELIVERY_VOID_TESTID,
  FINISHED_PRODUCT_MOVEMENT_KIND_LABELS,
  FinishedProductBatchesTable,
  FinishedProductCostsTable,
  FinishedProductDeliveriesTable,
  FinishedProductDistributionTable,
  FinishedProductListSection,
  FinishedProductMovementsTable,
  OTHER_REASON_LABEL,
  PACKED_BEFORE_COUNT_LABEL,
  PAGE_PARAM,
  PAGE_SIZE_PARAM,
  TAB_PARAM,
  WITHOUT_BATCH_LABEL,
  WITHOUT_ORDER_LABEL,
  finishedProductListEmptyTestId,
  finishedProductListErrorTestId,
  type FinishedProductListTab,
} from '@/app/(private)/inventario/producto-terminado/[id]/components';
import {
  MOVEMENT_REASONS,
  type FinishedDistributionLine,
  type MovementReason,
} from '@/lib/modules/inventario';
import { identity } from '@/lib/composition';
import type { SessionUser } from '@/lib/modules/identity';
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
  finishedDistributionLine,
  finishedProductCostRow,
  finishedProductDeliveriesPage,
  finishedProductDeliveryRow,
  finishedProductDetail,
  finishedProductPage,
} from '../../fixtures/finished-product-detail';
import { esperarInteractiva, setupUser } from '../../helpers/user-event';
import { DIRECT_DELIVERY_ID, directDeliveryVoidView } from '../../fixtures/direct-delivery';

const {
  routerMock,
  listBatchesMock,
  listMovementsMock,
  listDeliveriesMock,
  listCostsMock,
  listDistributionMock,
  getForVoidMock,
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
  listDistributionMock: vi.fn(),
  getForVoidMock: vi.fn(),
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

vi.mock('@/lib/modules/pedidos/adapters/driving/order-actions', () => ({
  getDirectDeliveryForVoidAction: getForVoidMock,
  voidDirectDeliveryAction: vi.fn(),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/finished-product-actions', () => ({
  getFinishedProductAction: vi.fn(),
  listFinishedProductBatchesAction: listBatchesMock,
  listFinishedProductMovementsAction: listMovementsMock,
  listFinishedProductDeliveriesAction: listDeliveriesMock,
  listFinishedProductCostsAction: listCostsMock,
  listFinishedProductDistributionAction: listDistributionMock,
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

  // 2026-10-16 (QC-288): los asientos de la entrega sin pedido y de su anulación.
  it('R55 — Salidas muestra «Entrega sin pedido» y Entradas «Anulación de entrega sin pedido», sin número de pedido', () => {
    const salida = { ...FINISHED_OUT_MOVEMENTS[1], id: 'salida-directa', kind: 'direct_delivery' as const, orderNumberText: null };
    const entrada = { ...FINISHED_IN_MOVEMENTS[0], id: 'entrada-directa', kind: 'direct_delivery_void' as const, orderNumberText: null };

    renderMovements('salidas', [salida, FINISHED_OUT_MOVEMENTS[1]]);
    const filaSalida = rowOf('salida-directa');
    expect(cell(filaSalida, 'finished-product-movement-row')).toHaveAttribute('data-kind', 'direct_delivery');
    expect(cell(filaSalida, 'finished-product-movement-origin')).toHaveTextContent('Entrega sin pedido');
    expect(cell(filaSalida, 'finished-product-movement-order')).toHaveTextContent(EMPTY_MARK);
    expect(cell(rowOf(FINISHED_OUT_MOVEMENTS[1].id), 'finished-product-movement-origin')).toHaveTextContent(
      'Entrega a cliente',
    );
    cleanup();

    renderMovements('entradas', [entrada]);
    const filaEntrada = rowOf('entrada-directa');
    expect(cell(filaEntrada, 'finished-product-movement-origin')).toHaveTextContent(
      'Anulación de entrega sin pedido',
    );
    expect(cell(filaEntrada, 'finished-product-movement-order')).toHaveTextContent(EMPTY_MARK);

    expect(FINISHED_PRODUCT_MOVEMENT_KIND_LABELS.direct_delivery).toBe('Entrega sin pedido');
    expect(FINISHED_PRODUCT_MOVEMENT_KIND_LABELS.direct_delivery_void).toBe('Anulación de entrega sin pedido');
    expect(new Set(Object.values(FINISHED_PRODUCT_MOVEMENT_KIND_LABELS)).size).toBe(
      Object.keys(FINISHED_PRODUCT_MOVEMENT_KIND_LABELS).length,
    );
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
      deliveryLineId: 'de-baja',
      customer: { id: 'c-baja', firstNames: 'Luis', lastNames: 'Gomez', isDeleted: true },
    });
    // 2026-10-15: la fila es una linea de entrega y sus envases ya no pueden faltar; se quita el caso de
    // envases ausentes.
    const ausente = finishedProductDeliveryRow({ deliveryLineId: 'ausente', customer: null });
    renderDeliveries(finishedProductDeliveriesPage({ items: [FINISHED_DELIVERY_ROWS[0], deBaja, ausente], total: 3 }));

    const activa = rowOf(FINISHED_DELIVERY_ROWS[0].deliveryLineId);
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
  });

  it('R33 — una fila anulada lleva «Anulada», su motivo y data-voided; la otra de la misma entrega no', () => {
    renderDeliveries();

    const anulada = rowOf(VOIDED_DELIVERY_ROW.deliveryLineId);
    expect(cell(anulada, 'finished-product-delivery-row')).toHaveAttribute('data-voided', 'true');
    const marca = cell(anulada, 'finished-product-delivery-void');
    expect(marca).toHaveTextContent('Anulada');
    expect(within(marca).getByTestId('finished-product-delivery-void-reason')).toHaveTextContent(
      FINISHED_VOID_REASON,
    );
    expect(cell(anulada, 'finished-product-delivery-lot')).toHaveTextContent('L-2026-0226');
    expect(cell(anulada, 'finished-product-delivery-packages')).toHaveTextContent('1');

    const viva = rowOf(FINISHED_DELIVERY_ROWS[0].deliveryLineId);
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

  it('R43 — columnas en orden Fecha, Cliente, Pedido, Presentación, Lote, Envases, Cantidad, Anulación', () => {
    renderDeliveries();

    const encabezados = screen.getAllByRole('columnheader').map((th) => th.textContent?.trim());
    expect(encabezados).toEqual([
      'Fecha',
      'Cliente',
      'Pedido',
      'Presentación',
      'Lote',
      'Envases',
      'Cantidad',
      'Anulación',
    ]);
  });

  it('R43 — una fila por linea de entrega: misma entrega y cliente, otra presentacion, filas propias', () => {
    const frasco = finishedProductDeliveryRow({
      deliveryLineId: 'linea-frasco',
      presentationName: 'Frasco 200 ml',
      lot: 'L-2026-0227',
      packages: 10,
      quantity: '2.0000',
    });
    const sinPresentacion = finishedProductDeliveryRow({
      deliveryLineId: 'linea-sin-presentacion',
      presentationName: null,
    });
    renderDeliveries(
      finishedProductDeliveriesPage({
        items: [FINISHED_DELIVERY_ROWS[0], frasco, sinPresentacion],
        total: 3,
      }),
    );

    expect(screen.getAllByTestId('finished-product-delivery-row')).toHaveLength(3);
    expect(frasco.orderDeliveryId).toBe(FINISHED_DELIVERY_ROWS[0].orderDeliveryId);

    const botella = rowOf(FINISHED_DELIVERY_ROWS[0].deliveryLineId);
    expect(cell(botella, 'finished-product-delivery-presentation')).toHaveTextContent('Botella 1 L');
    expect(cell(botella, 'finished-product-delivery-customer')).toHaveTextContent('Ana Perez');

    const filaFrasco = rowOf('linea-frasco');
    expect(cell(filaFrasco, 'finished-product-delivery-presentation')).toHaveTextContent('Frasco 200 ml');
    expect(cell(filaFrasco, 'finished-product-delivery-customer')).toHaveTextContent('Ana Perez');
    expect(cell(filaFrasco, 'finished-product-delivery-order')).toHaveTextContent(FINISHED_ORDER_NUMBER);
    expect(cell(filaFrasco, 'finished-product-delivery-lot')).toHaveTextContent('L-2026-0227');
    expect(cell(filaFrasco, 'finished-product-delivery-packages')).toHaveTextContent('10');
    expect(cell(filaFrasco, 'finished-product-delivery-quantity')).toHaveTextContent('2 L');

    expect(
      cell(rowOf('linea-sin-presentacion'), 'finished-product-delivery-presentation'),
    ).toHaveTextContent(EMPTY_MARK);
  });

  it('R44 — solo la fila de la presentacion anulada lleva «Anulada» y su motivo; las demas de la entrega no', () => {
    const anuladaFrasco = finishedProductDeliveryRow({
      deliveryLineId: 'linea-frasco-anulada',
      presentationName: 'Frasco 200 ml',
      void: { reason: FINISHED_VOID_REASON },
    });
    const vivaBotella = finishedProductDeliveryRow({
      deliveryLineId: 'linea-botella-viva',
      presentationName: 'Botella 1 L',
    });
    renderDeliveries(finishedProductDeliveriesPage({ items: [anuladaFrasco, vivaBotella], total: 2 }));

    const anulada = rowOf('linea-frasco-anulada');
    expect(cell(anulada, 'finished-product-delivery-row')).toHaveAttribute('data-voided', 'true');
    expect(cell(anulada, 'finished-product-delivery-void')).toHaveTextContent('Anulada');
    expect(cell(anulada, 'finished-product-delivery-void-reason')).toHaveTextContent(FINISHED_VOID_REASON);

    const viva = rowOf('linea-botella-viva');
    expect(cell(viva, 'finished-product-delivery-row')).toHaveAttribute('data-voided', 'false');
    expect(within(viva).queryByTestId('finished-product-delivery-void')).toBeNull();
  });

  it('R44 — el total viene de delivered y la paginacion de la pagina de lineas, no de contar filas', async () => {
    const user = setupUser();
    renderDeliveries(
      finishedProductDeliveriesPage({
        delivered: { quantity: '8.0000', packages: 5 },
        total: 45,
        totalPages: 3,
      }),
    );

    expect(screen.getAllByTestId('finished-product-delivery-row')).toHaveLength(FINISHED_DELIVERY_ROWS.length);
    expect(screen.getByTestId('finished-product-deliveries-total-quantity')).toHaveTextContent('8 L');
    expect(screen.getByTestId('finished-product-deliveries-total-packages')).toHaveTextContent('5 envases');
    expect(screen.getByTestId('data-table-page-indicator')).toHaveTextContent('3');

    await user.click(screen.getByTestId('data-table-next'));

    const url = new URL(routerMock.push.mock.calls[0][0], 'http://local');
    expect(url.searchParams.get(TAB_PARAM)).toBe('entregas');
    expect(url.searchParams.get(PAGE_PARAM)).toBe('2');
  });

  // 2026-10-16 (QC-288): las entregas sin pedido conviven con las de pedido en el tab.
  const DIRECTA = finishedProductDeliveryRow({
    deliveryLineId: 'linea-directa',
    orderDeliveryId: DIRECT_DELIVERY_ID,
    createdAt: '2026-10-16T10:05:00.000Z',
    orderNumberText: null,
    withoutOrder: true,
    note: 'Venta mostrador, factura 0012',
  });
  const DIRECTA_SIN_NOTA = finishedProductDeliveryRow({
    deliveryLineId: 'linea-directa-sin-nota',
    orderDeliveryId: DIRECT_DELIVERY_ID,
    orderNumberText: null,
    withoutOrder: true,
    note: null,
  });
  const DIRECTA_ANULADA = finishedProductDeliveryRow({
    deliveryLineId: 'linea-directa-anulada',
    orderNumberText: null,
    withoutOrder: true,
    void: { reason: FINISHED_VOID_REASON },
  });
  const MEZCLADA = finishedProductDeliveriesPage({
    items: [DIRECTA, FINISHED_DELIVERY_ROWS[0], DIRECTA_SIN_NOTA, DIRECTA_ANULADA],
    total: 4,
  });

  function renderMixed(canVoidDirect?: boolean) {
    return render(
      <FinishedProductDeliveriesTable
        productId={FINISHED_PRODUCT_ID}
        page={MEZCLADA}
        unitLabel={UNIT}
        canVoidDirect={canVoidDirect}
      />,
    );
  }

  it('R52 — la fila sin pedido marca «Sin pedido» con su nota debajo; la de pedido muestra su número', () => {
    renderMixed();

    expect(screen.getAllByTestId('finished-product-delivery-row')).toHaveLength(4);
    const directa = cell(rowOf('linea-directa'), 'finished-product-delivery-order');
    const marca = within(directa).getByTestId('finished-product-delivery-direct');
    const nota = within(directa).getByTestId('finished-product-delivery-note');
    expect(marca).toHaveTextContent(DIRECT_DELIVERY_LABEL);
    expect(marca).toHaveAttribute('data-tone', 'info');
    expect(nota).toHaveTextContent('Venta mostrador, factura 0012');
    expect(marca.compareDocumentPosition(nota) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const sinNota = cell(rowOf('linea-directa-sin-nota'), 'finished-product-delivery-order');
    expect(within(sinNota).getByTestId('finished-product-delivery-direct')).toBeInTheDocument();
    expect(within(sinNota).queryByTestId('finished-product-delivery-note')).toBeNull();

    const dePedido = cell(rowOf(FINISHED_DELIVERY_ROWS[0].deliveryLineId), 'finished-product-delivery-order');
    expect(dePedido).toHaveTextContent(FINISHED_ORDER_NUMBER);
    expect(within(dePedido).queryByTestId('finished-product-delivery-direct')).toBeNull();
  });

  it('R52 — mismas columnas que QC-282 y en el orden que llega de la página', () => {
    renderMixed();

    expect(screen.getAllByRole('columnheader').map((th) => th.textContent?.trim())).toEqual([
      'Fecha',
      'Cliente',
      'Pedido',
      'Presentación',
      'Lote',
      'Envases',
      'Cantidad',
      'Anulación',
    ]);
    const filas = within(screen.getByRole('table')).getAllByTestId('finished-product-delivery-row');
    expect(filas.map((fila) => fila.closest('tr')?.getAttribute('data-testid'))).toEqual(
      MEZCLADA.items.map((row) => `data-table-row-${row.deliveryLineId}`),
    );
  });

  it('R43 — con el permiso, el menú de acciones solo en las filas sin pedido no anuladas, con su aria-label', () => {
    renderMixed(true);

    const menu = within(rowOf('linea-directa')).getByTestId(DIRECT_DELIVERY_ACTIONS_TESTID);
    expect(menu).toHaveAccessibleName('Acciones de la entrega sin pedido del 2026-10-16 10:05');
    expect(within(rowOf('linea-directa-sin-nota')).getByTestId(DIRECT_DELIVERY_ACTIONS_TESTID)).toBeInTheDocument();

    expect(within(rowOf('linea-directa-anulada')).queryAllByRole('button')).toEqual([]);
    expect(within(rowOf(FINISHED_DELIVERY_ROWS[0].deliveryLineId)).queryAllByRole('button')).toEqual([]);
    expect(screen.getAllByTestId(DIRECT_DELIVERY_ACTIONS_TESTID)).toHaveLength(2);
    expect(screen.getByTestId('data-table-head-actions')).toHaveTextContent('Acciones');
  });

  it('R43 — la cabecera de la columna de acciones se llama «Acciones» y solo la ve el lector de pantalla', () => {
    renderMixed(true);

    const cabecera = screen.getByRole('columnheader', { name: 'Acciones' });
    expect(cabecera).toBe(screen.getByTestId('data-table-head-actions'));
    expect(within(cabecera).getByText('Acciones')).toHaveClass('sr-only');
  });

  it('R43 — el menú de la fila sin pedido tiene un único ítem «Anular»', async () => {
    const user = setupUser();
    renderMixed(true);

    await user.click(within(rowOf('linea-directa')).getByTestId(DIRECT_DELIVERY_ACTIONS_TESTID));

    const items = await screen.findAllByRole('menuitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Anular');
    expect(items[0]).toHaveAttribute('data-testid', DIRECT_DELIVERY_VOID_TESTID);
  });

  it('R43 — sin el permiso, ni el menú ni «Anular» existen en el DOM, ni la columna de acciones', () => {
    renderMixed(false);

    expect(screen.queryByTestId(DIRECT_DELIVERY_ACTIONS_TESTID)).toBeNull();
    expect(screen.queryByTestId(DIRECT_DELIVERY_VOID_TESTID)).toBeNull();
    expect(screen.queryByRole('button', { name: /anular|acciones/i })).toBeNull();
    expect(screen.queryByTestId('data-table-head-actions')).toBeNull();
  });

  it('R43, R44 — elegir «Anular» en el menú abre el diálogo de esa entrega', async () => {
    const user = setupUser();
    getForVoidMock.mockResolvedValue({ status: 'success', data: directDeliveryVoidView() });
    renderMixed(true);

    await user.click(within(rowOf('linea-directa')).getByTestId(DIRECT_DELIVERY_ACTIONS_TESTID));
    await user.click(await esperarInteractiva(await screen.findByTestId(DIRECT_DELIVERY_VOID_TESTID)));

    expect(await screen.findByTestId(DIRECT_DELIVERY_VOID_DIALOG_TESTID)).toBeInTheDocument();
    expect(getForVoidMock).toHaveBeenCalledWith(DIRECT_DELIVERY_ID);
  });

  it('R36 — ninguna fila de Entregas lleva un boton o enlace, tampoco para anular', () => {
    renderDeliveries();

    for (const row of FINISHED_DELIVERY_ROWS) {
      const fila = rowOf(row.deliveryLineId);
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

describe('Reparto', () => {
  const PRESENTATION = finishedProductDetail().presentation;
  const MINUS = '−';

  function renderDistribution(lines: readonly Partial<FinishedDistributionLine>[]) {
    const rows = lines.map((overrides) => finishedDistributionLine(overrides));
    render(
      <FinishedProductDistributionTable
        productId={FINISHED_PRODUCT_ID}
        page={finishedProductPage(rows)}
        presentation={PRESENTATION}
        reasonLabels={REASON_LABELS}
      />,
    );
  }

  it('R26 — columnas Pedido, Presentación, Plan, Envases reales, Diferencia y Motivo, sin acciones', () => {
    renderDistribution([{}]);

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    for (const label of ['Pedido', 'Presentación', 'Plan', 'Envases reales', 'Diferencia', 'Motivo']) {
      expect(headers.some((text) => text?.includes(label)), label).toBe(true);
    }
    const fila = rowOf(finishedDistributionLine().lineId);
    expect(cell(fila, 'finished-product-distribution-row')).toHaveTextContent(FINISHED_ORDER_NUMBER);
    expect(cell(fila, 'finished-product-distribution-presentation')).toHaveTextContent('Botella 1 L 1 L');
    expect(within(fila).queryByRole('button')).toBeNull();
    expect(within(fila).queryByRole('link')).toBeNull();
  });

  it('R27 — igual al plan: «—» en Diferencia y Motivo, sin nota', () => {
    renderDistribution([{}]);
    const fila = rowOf(finishedDistributionLine().lineId);

    expect(cell(fila, 'finished-product-distribution-plan')).toHaveTextContent('12');
    expect(cell(fila, 'finished-product-distribution-packed')).toHaveTextContent('12');
    expect(cell(fila, 'finished-product-distribution-difference')).toHaveTextContent(EMPTY_MARK);
    expect(cell(fila, 'finished-product-distribution-reason')).toHaveTextContent(EMPTY_MARK);
    expect(within(fila).queryByTestId('finished-product-distribution-reason-note')).toBeNull();
  });

  it('R27 — menos envases: «−N» y el motivo; más envases: «+N» y el motivo', () => {
    renderDistribution([
      { lineId: 'menos', plan: 16, packedPackages: 15, reason: 'rotura' },
      { lineId: 'mas', plan: 12, packedPackages: 13, reason: 'conteo_fisico' },
    ]);

    const menos = rowOf('menos');
    expect(cell(menos, 'finished-product-distribution-packed')).toHaveTextContent('15');
    expect(cell(menos, 'finished-product-distribution-difference')).toHaveTextContent(`${MINUS}1`);
    expect(cell(menos, 'finished-product-distribution-reason')).toHaveTextContent(REASON_LABELS.rotura);

    const mas = rowOf('mas');
    expect(cell(mas, 'finished-product-distribution-difference')).toHaveTextContent('+1');
    expect(cell(mas, 'finished-product-distribution-reason')).toHaveTextContent(REASON_LABELS.conteo_fisico);
  });

  it('R27 — «Otro» lleva el texto escrito entre comillas bajo el motivo', () => {
    const texto = 'Se cayó la caja al pasarla a la estiba.';
    renderDistribution([{ lineId: 'otro', plan: 6, packedPackages: 5, reason: 'otro', reasonOther: texto }]);

    const motivo = cell(rowOf('otro'), 'finished-product-distribution-reason');
    expect(motivo).toHaveTextContent(OTHER_REASON_LABEL);
    expect(within(motivo).getByTestId('finished-product-distribution-reason-note')).toHaveTextContent(
      `«${texto}»`,
    );
  });

  it('R27 — 0 envases reales: «−N» y «Sin lote», también junto al texto de «Otro»', () => {
    renderDistribution([
      { lineId: 'cero', plan: 6, packedPackages: 0, reason: 'merma' },
      { lineId: 'cero-otro', plan: 6, packedPackages: 0, reason: 'otro', reasonOther: 'Se cayó' },
    ]);

    const cero = rowOf('cero');
    expect(cell(cero, 'finished-product-distribution-packed')).toHaveTextContent('0');
    expect(cell(cero, 'finished-product-distribution-difference')).toHaveTextContent(`${MINUS}6`);
    expect(cell(cero, 'finished-product-distribution-reason')).toHaveTextContent(REASON_LABELS.merma);
    expect(cell(cero, 'finished-product-distribution-reason-note')).toHaveTextContent(WITHOUT_BATCH_LABEL);

    expect(cell(rowOf('cero-otro'), 'finished-product-distribution-reason-note')).toHaveTextContent(
      `«Se cayó» · ${WITHOUT_BATCH_LABEL}`,
    );
  });

  it('R27 — sin conteo guardado: envases reales = plan, «—» y «Empacado antes de QC-281»', () => {
    renderDistribution([{ lineId: 'antiguo', plan: 10, packedPackages: null }]);
    const fila = rowOf('antiguo');

    expect(cell(fila, 'finished-product-distribution-packed')).toHaveTextContent('10');
    expect(cell(fila, 'finished-product-distribution-difference')).toHaveTextContent(EMPTY_MARK);
    expect(cell(fila, 'finished-product-distribution-reason')).toHaveTextContent(EMPTY_MARK);
    expect(cell(fila, 'finished-product-distribution-reason-note')).toHaveTextContent(
      PACKED_BEFORE_COUNT_LABEL,
    );
  });

  it('R26 — la paginación de Reparto navega con su tab y su tamaño 10 o 25', async () => {
    const user = setupUser();
    render(
      <FinishedProductDistributionTable
        productId={FINISHED_PRODUCT_ID}
        page={finishedProductPage([finishedDistributionLine()], { total: 30, pageSize: 25, totalPages: 2 })}
        presentation={PRESENTATION}
        reasonLabels={REASON_LABELS}
      />,
    );

    await user.click(screen.getByTestId('data-table-next'));

    const url = new URL(routerMock.push.mock.calls[0][0], 'http://local');
    expect(url.searchParams.get(TAB_PARAM)).toBe('reparto');
    expect(url.searchParams.get(PAGE_PARAM)).toBe('2');
    expect(url.searchParams.get(PAGE_SIZE_PARAM)).toBe('25');
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

  const TABS: readonly FinishedProductListTab[] = [
    'lotes',
    'entradas',
    'salidas',
    'entregas',
    'costo',
    'reparto',
  ];

  function mockAll(value: unknown) {
    for (const mock of [
      listBatchesMock,
      listMovementsMock,
      listDeliveriesMock,
      listCostsMock,
      listDistributionMock,
    ]) {
      mock.mockResolvedValue(value);
    }
  }

  async function renderSection(tab: FinishedProductListTab, page = 1) {
    const tree = await FinishedProductListSection({
      productId: FINISHED_PRODUCT_ID,
      tab,
      paging: { page, pageSize: 10 },
      unitLabel: UNIT,
      presentation: finishedProductDetail().presentation,
    });
    return render(<>{tree}</>);
  }

  it('R24, R28 — cada tab sin filas muestra su estado vacio propio, distinto del error', async () => {
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

  it('R24, R28 — cada tab en error muestra su estado de error, no el vacio', async () => {
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

  it('R28 — Reparto: vacío con su texto, error «No se pudo cargar el reparto.» con «Reintentar»', async () => {
    mockAll({ status: 'success', data: finishedProductPage([], { total: 0, totalPages: 0 }) });
    await renderSection('reparto');
    expect(screen.getByTestId(finishedProductListEmptyTestId('reparto'))).toHaveTextContent(
      'Ningún pedido empacado tiene este producto.',
    );
    cleanup();

    mockAll(FINISHED_PRODUCT_ERROR_STATES.unauthorized);
    await renderSection('reparto');
    expect(screen.getByTestId(finishedProductListErrorTestId('reparto'))).toHaveTextContent(
      'No se pudo cargar el reparto.',
    );
    expect(screen.getByTestId(`${finishedProductListErrorTestId('reparto')}-retry`)).toHaveTextContent(
      'Reintentar',
    );
  });

  it('R28 — Reparto: una página pasada del final ofrece volver a la primera', async () => {
    mockAll({ status: 'success', data: finishedProductPage([], { total: 3, page: 4, totalPages: 1 }) });
    await renderSection('reparto', 4);

    expect(screen.getByTestId(finishedProductListEmptyTestId('reparto'))).toHaveTextContent(
      'Esta página ya no tiene filas.',
    );
    const enlace = screen.getByTestId(`${finishedProductListEmptyTestId('reparto')}-first-page`);
    const url = new URL(enlace.getAttribute('href') as string, 'http://local');
    expect(url.searchParams.get(TAB_PARAM)).toBe('reparto');
    expect(url.searchParams.get(PAGE_PARAM)).toBe('1');
  });

  // 2026-10-16 (QC-288): el permiso de anular baja de la sección; leer el tab no lo exige.
  function sessionUser(permissions: readonly string[]): SessionUser {
    return { id: 'u-1', username: 'admin', displayName: 'Admin', roleName: null, permissions };
  }

  it('R43, R53 — la sección pasa canVoidDirect según entregas.anular, sin pedirlo para leer', async () => {
    const directa = finishedProductDeliveryRow({
      deliveryLineId: 'seccion-directa',
      orderNumberText: null,
      withoutOrder: true,
    });
    listDeliveriesMock.mockResolvedValue({
      status: 'success',
      data: finishedProductDeliveriesPage({ items: [directa], total: 1 }),
    });

    vi.mocked(identity.getSessionUser).mockResolvedValueOnce(
      sessionUser(['inventario.consultar', 'entregas.anular']),
    );
    await renderSection('entregas');
    expect(within(rowOf('seccion-directa')).getByTestId(DIRECT_DELIVERY_ACTIONS_TESTID)).toBeInTheDocument();
    cleanup();

    vi.mocked(identity.getSessionUser).mockResolvedValueOnce(sessionUser(['inventario.consultar']));
    await renderSection('entregas');
    expect(within(rowOf('seccion-directa')).getByTestId('finished-product-delivery-direct')).toBeInTheDocument();
    expect(screen.queryByTestId(DIRECT_DELIVERY_ACTIONS_TESTID)).toBeNull();
    expect(screen.queryByTestId(DIRECT_DELIVERY_VOID_TESTID)).toBeNull();
  });

  it('R26 — la sección de Reparto pide solo su listado, con la página', async () => {
    mockAll({ status: 'success', data: finishedProductPage([finishedDistributionLine()]) });
    await renderSection('reparto', 2);

    expect(listDistributionMock).toHaveBeenCalledWith(FINISHED_PRODUCT_ID, { page: 2, pageSize: 10 });
    expect(listCostsMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('finished-product-reparto')).toBeInTheDocument();
  });
});
