import { errorMessage, type ErrorState } from '@/lib/modules/errores';
import type {
  DeliverDirectResult,
  DirectDeliveryView,
  DirectDeliveryVoidView,
  VoidDirectDeliveryResult,
} from '@/lib/modules/pedidos';
import type { DeliverDirectInput } from '@/lib/modules/pedidos/adapters/driving/order-actions';

export const DIRECT_PRODUCT_ID = 'a0000000-0000-4000-8000-000000000288';
export const DIRECT_DELIVERY_KEY = 'b0000000-0000-4000-8000-000000000288';
export const DIRECT_DELIVERY_ID = '10000000-0000-4000-8000-000000000288';
export const DIRECT_VOID_KEY = 'b0000000-0000-4000-8000-000000000289';

export const DIRECT_FIRST_CUSTOMER_ID = 'c0000000-0000-4000-8000-000000000288';
export const DIRECT_SECOND_CUSTOMER_ID = 'c0000000-0000-4000-8000-000000000289';

/** 12 envases enteros. */
export const DIRECT_OLDER_BATCH_ID = 'e0000000-0000-4000-8000-000000000288';
/** 8 envases enteros. */
export const DIRECT_NEWER_BATCH_ID = 'e0000000-0000-4000-8000-000000000289';

export const DIRECT_FIRST_ORDER_ID = 'd0000000-0000-4000-8000-000000000288';
export const DIRECT_SECOND_ORDER_ID = 'd0000000-0000-4000-8000-000000000289';

const DIRECT_PRESENTATION_ID = 'f0000000-0000-4000-8000-000000000288';

/** Como el tablero: 20 envases en stock, dos pedidos que esperan 5 y 3, excedente 12 y dos lotes. */
export function directDeliveryView(overrides: Partial<DirectDeliveryView> = {}): DirectDeliveryView {
  return {
    productId: DIRECT_PRODUCT_ID,
    productName: 'Desengrasante industrial · Botella 1 L',
    presentationName: 'Botella 1 L',
    stockPackages: 20,
    waiting: [
      { orderId: DIRECT_FIRST_ORDER_ID, numberText: '2026-0000031', missingPackages: 5 },
      { orderId: DIRECT_SECOND_ORDER_ID, numberText: '2026-0000034', missingPackages: 3 },
    ],
    waitingPackages: 8,
    surplusPackages: 12,
    batches: [
      {
        batchId: DIRECT_OLDER_BATCH_ID,
        presentationId: DIRECT_PRESENTATION_ID,
        lot: 'L-2026-0288',
        purchaseDate: '2026-10-01',
        expiryDate: '2027-10-01',
        packageContent: '1.0000',
        availablePackages: 12,
      },
      {
        batchId: DIRECT_NEWER_BATCH_ID,
        presentationId: DIRECT_PRESENTATION_ID,
        lot: 'L-2026-0289',
        purchaseDate: '2026-10-10',
        expiryDate: null,
        packageContent: '1.0000',
        availablePackages: 8,
      },
    ],
    ...overrides,
  };
}

/** Dos clientes con su parte sin anular, por nombre ascendente. */
export function directDeliveryVoidView(overrides: Partial<DirectDeliveryVoidView> = {}): DirectDeliveryVoidView {
  return {
    deliveryId: DIRECT_DELIVERY_ID,
    createdAt: '2026-10-16T10:30:00.000Z',
    presentationName: 'Botella 1 L',
    customers: [
      { customerId: DIRECT_FIRST_CUSTOMER_ID, customerName: 'Ana Perez', packages: 4 },
      { customerId: DIRECT_SECOND_CUSTOMER_ID, customerName: 'Bruno Diaz', packages: 2 },
    ],
    ...overrides,
  };
}

export const DIRECT_DELIVERY_RESULTS = {
  delivered: { status: 'delivered' },
  alreadyRegistered: { status: 'already_registered' },
  voided: { status: 'voided' },
  voidAlreadyRegistered: { status: 'already_registered' },
} as const satisfies Record<string, DeliverDirectResult | VoidDirectDeliveryResult>;

const errorState = <C extends Exclude<ErrorState['code'], 'unexpected'>>(code: C) =>
  ({ status: 'error', code, message: errorMessage(code) }) as const;

/** Un `ErrorState` por cada codigo que puede devolver la entrega sin pedido o su anulacion. */
export const DIRECT_DELIVERY_ERROR_STATES = {
  exceedsSurplus: errorState('delivery_exceeds_surplus'),
  productNotFound: errorState('product_not_found'),
  batchNotFound: errorState('batch_not_found'),
  batchInsufficient: errorState('delivery_batch_insufficient'),
  customerNotFound: errorState('customer_not_found'),
  deliveryNotFound: errorState('delivery_not_found'),
  alreadyVoided: errorState('delivery_already_voided'),
  invalidInput: errorState('invalid_input'),
  unauthorized: errorState('unauthorized'),
} as const satisfies Record<string, ErrorState>;

/** Dos clientes que comparten `DIRECT_OLDER_BATCH_ID`; el segundo lleva ademas el otro lote. */
export function deliverDirectInput(overrides: Partial<DeliverDirectInput> = {}): DeliverDirectInput {
  return {
    productId: DIRECT_PRODUCT_ID,
    deliveryKey: DIRECT_DELIVERY_KEY,
    note: 'Venta mostrador, factura 0012',
    customers: [
      {
        customerId: DIRECT_FIRST_CUSTOMER_ID,
        allocations: [{ batchId: DIRECT_OLDER_BATCH_ID, packages: 4 }],
      },
      {
        customerId: DIRECT_SECOND_CUSTOMER_ID,
        allocations: [
          { batchId: DIRECT_OLDER_BATCH_ID, packages: 1 },
          { batchId: DIRECT_NEWER_BATCH_ID, packages: 1 },
        ],
      },
    ],
    ...overrides,
  };
}
