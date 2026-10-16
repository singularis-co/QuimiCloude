import { errorMessage, type ErrorState } from '@/lib/modules/errores';
import type {
  FinishedDistributionLine,
  FinishedProductBatchRow,
  FinishedProductCostRow,
  FinishedProductDeliveriesPage,
  FinishedProductDeliveryRow,
  FinishedProductDetail,
  FinishedProductMovementRow,
  Page,
  ProducedProductLink,
} from '@/lib/modules/inventario';

export const FINISHED_PRODUCT_ID = 'f0000000-0000-4000-8000-000000000225';
export const FINISHED_UNIT_ID = 'c0000000-0000-4000-8000-000000000225';
export const FINISHED_PRESENTATION_ID = 'c1000000-0000-4000-8000-000000000225';
export const FINISHED_ORDER_ID = 'a0000000-0000-4000-8000-000000000225';
export const FINISHED_ORDER_NUMBER = '2026-0000225';
export const FINISHED_CUSTOMER_ID = 'b0000000-0000-4000-8000-000000000225';

/** Contenido 1 L, con existencia. */
export const LITER_BATCH_ID = 'e0000000-0000-4000-8000-000000000225';
/** Contenido 4 L, con existencia. */
export const GALLON_BATCH_ID = 'e0000000-0000-4000-8000-000000000226';
/** Sin contenido de envase. */
export const UNPACKAGED_BATCH_ID = 'e0000000-0000-4000-8000-000000000227';
/** Agotado. */
export const EMPTY_BATCH_ID = 'e0000000-0000-4000-8000-000000000228';

export const FINISHED_DELIVERY_ID = '10000000-0000-4000-8000-000000000225';
export const FINISHED_VOID_REASON = 'El cliente devolvio el producto por error de etiqueta';

/** Dos contenidos (1 L y 4 L) y un lote sin contenido; el lote agotado no aporta nada. */
export function finishedProductDetail(overrides: Partial<FinishedProductDetail> = {}): FinishedProductDetail {
  return {
    id: FINISHED_PRODUCT_ID,
    name: 'Limpiador multiusos',
    imagePath: null,
    qtyAlert: '5.0000',
    unit: { id: FINISHED_UNIT_ID, name: 'Litro', symbol: 'L' },
    presentation: {
      id: FINISHED_PRESENTATION_ID,
      name: 'Botella 1 L',
      content: '1.0000',
      unit: { id: FINISHED_UNIT_ID, name: 'Litro', symbol: 'L' },
    },
    stock: {
      total: '21.7500',
      byPackageContent: [
        { packageContent: '1.0000', packages: 10, remainder: '0.5' },
        { packageContent: '4.0000', packages: 2, remainder: '1' },
      ],
      withoutPackage: '2.2500',
    },
    ...overrides,
  };
}

export function finishedProductBatchRow(overrides: Partial<FinishedProductBatchRow> = {}): FinishedProductBatchRow {
  return {
    id: LITER_BATCH_ID,
    lot: 'L-2026-0225',
    orderId: FINISHED_ORDER_ID,
    orderNumberText: FINISHED_ORDER_NUMBER,
    purchaseDate: '2026-10-10',
    productionDate: '2026-10-10',
    expiryDate: '2027-10-10',
    packageContent: '1.0000',
    stock: '10.5000',
    packagedStock: { packages: 10, remainder: '0.5' },
    createdAt: '2026-10-10T12:00:00.000Z',
    ...overrides,
  };
}

/** Lote sin asiento `production`: «Sin pedido». */
export const UNPACKAGED_BATCH_ROW = finishedProductBatchRow({
  id: UNPACKAGED_BATCH_ID,
  lot: 'L-2026-0227',
  orderId: null,
  orderNumberText: null,
  productionDate: null,
  expiryDate: null,
  packageContent: null,
  stock: '2.2500',
  packagedStock: null,
  createdAt: '2026-10-09T12:00:00.000Z',
});

export function finishedProductMovementRow(
  overrides: Partial<FinishedProductMovementRow> = {},
): FinishedProductMovementRow {
  return {
    id: '20000000-0000-4000-8000-000000000225',
    kind: 'production',
    batchId: LITER_BATCH_ID,
    lot: 'L-2026-0225',
    quantity: '12.0000',
    packaged: { packages: 12, remainder: null },
    orderNumberText: FINISHED_ORDER_NUMBER,
    reason: null,
    createdAt: '2026-10-10T12:00:00.000Z',
    ...overrides,
  };
}

/** Entradas: produccion, apertura, ajuste que suma y anulacion de entrega. */
export const FINISHED_IN_MOVEMENTS: readonly FinishedProductMovementRow[] = [
  finishedProductMovementRow({
    id: '20000000-0000-4000-8000-000000000229',
    kind: 'delivery_void',
    quantity: '2.0000',
    packaged: { packages: 2, remainder: null },
    createdAt: '2026-10-12T09:00:00.000Z',
  }),
  finishedProductMovementRow({
    id: '20000000-0000-4000-8000-000000000228',
    kind: 'adjustment',
    batchId: GALLON_BATCH_ID,
    lot: 'L-2026-0226',
    quantity: '1.0000',
    packaged: { packages: 0, remainder: '1' },
    orderNumberText: null,
    reason: 'conteo_fisico',
    createdAt: '2026-10-11T09:00:00.000Z',
  }),
  finishedProductMovementRow(),
  finishedProductMovementRow({
    id: '20000000-0000-4000-8000-000000000226',
    kind: 'opening',
    batchId: UNPACKAGED_BATCH_ID,
    lot: 'L-2026-0227',
    quantity: '2.2500',
    packaged: null,
    orderNumberText: null,
    createdAt: '2026-10-09T12:00:00.000Z',
  }),
];

/** Salidas: entrega y ajuste que resta, en valor absoluto. */
export const FINISHED_OUT_MOVEMENTS: readonly FinishedProductMovementRow[] = [
  finishedProductMovementRow({
    id: '20000000-0000-4000-8000-000000000231',
    kind: 'adjustment',
    quantity: '0.5000',
    packaged: { packages: 0, remainder: '0.5' },
    orderNumberText: null,
    reason: 'merma',
    createdAt: '2026-10-11T15:00:00.000Z',
  }),
  finishedProductMovementRow({
    id: '20000000-0000-4000-8000-000000000230',
    kind: 'delivery',
    quantity: '4.0000',
    packaged: { packages: 4, remainder: null },
    createdAt: '2026-10-11T10:00:00.000Z',
  }),
];

// 2026-10-15: la fila es una linea de entrega (`deliveryLineId`) y lleva su presentacion.
export function finishedProductDeliveryRow(
  overrides: Partial<FinishedProductDeliveryRow> = {},
): FinishedProductDeliveryRow {
  return {
    deliveryLineId: '30000000-0000-4000-8000-000000000230',
    orderDeliveryId: FINISHED_DELIVERY_ID,
    createdAt: '2026-10-11T10:00:00.000Z',
    customer: { id: FINISHED_CUSTOMER_ID, firstNames: 'Ana', lastNames: 'Perez', isDeleted: false },
    orderNumberText: FINISHED_ORDER_NUMBER,
    presentationName: 'Botella 1 L',
    batchId: LITER_BATCH_ID,
    lot: 'L-2026-0225',
    packages: 4,
    quantity: '4.0000',
    void: null,
    ...overrides,
  };
}

/** Misma entrega que la fila sin anular, otro lote y su linea anulada. */
export const VOIDED_DELIVERY_ROW = finishedProductDeliveryRow({
  deliveryLineId: '30000000-0000-4000-8000-000000000232',
  batchId: GALLON_BATCH_ID,
  lot: 'L-2026-0226',
  packages: 1,
  quantity: '4.0000',
  void: { reason: FINISHED_VOID_REASON },
});

export const FINISHED_DELIVERY_ROWS: readonly FinishedProductDeliveryRow[] = [
  finishedProductDeliveryRow(),
  VOIDED_DELIVERY_ROW,
];

export function finishedProductCostRow(overrides: Partial<FinishedProductCostRow> = {}): FinishedProductCostRow {
  return {
    batchId: LITER_BATCH_ID,
    lot: 'L-2026-0225',
    orderNumberText: FINISHED_ORDER_NUMBER,
    quantity: '12.0000',
    packaged: { packages: 12, remainder: null },
    unitCost: '2.5000',
    totalCost: '30.0000',
    createdAt: '2026-10-10T12:00:00.000Z',
    ...overrides,
  };
}

/** Linea del reparto empacada igual al plan. */
export function finishedDistributionLine(
  overrides: Partial<FinishedDistributionLine> = {},
): FinishedDistributionLine {
  return {
    lineId: 'd0000000-0000-4000-8000-000000000281',
    orderNumberText: FINISHED_ORDER_NUMBER,
    plan: 12,
    packedPackages: 12,
    reason: null,
    reasonOther: null,
    ...overrides,
  };
}

export function finishedProductPage<T>(items: readonly T[], overrides: Partial<Page<T>> = {}): Page<T> {
  return { items, total: items.length, page: 1, pageSize: 10, totalPages: 1, ...overrides };
}

/** `delivered` solo cuenta la fila sin anular. */
export function finishedProductDeliveriesPage(
  overrides: Partial<FinishedProductDeliveriesPage> = {},
): FinishedProductDeliveriesPage {
  return {
    ...finishedProductPage(FINISHED_DELIVERY_ROWS),
    delivered: { quantity: '4.0000', packages: 4 },
    ...overrides,
  };
}

export const PRODUCED_PRODUCT_LINK: ProducedProductLink = {
  orderId: FINISHED_ORDER_ID,
  presentationId: FINISHED_PRESENTATION_ID,
  productId: FINISHED_PRODUCT_ID,
};

const errorState = <C extends Exclude<ErrorState['code'], 'unexpected'>>(code: C) =>
  ({ status: 'error', code, message: errorMessage(code) }) as const;

export const FINISHED_PRODUCT_ERROR_STATES = {
  productNotFound: errorState('product_not_found'),
  unauthorized: errorState('unauthorized'),
  invalidInput: errorState('invalid_input'),
} as const satisfies Record<string, ErrorState>;
