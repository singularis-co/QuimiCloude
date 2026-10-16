import { errorMessage, type ErrorState } from '@/lib/modules/errores';
import type { DeliverOrderResult, OrderDeliveryView } from '@/lib/modules/pedidos';
import type { DeliverOrderInput } from '@/lib/modules/pedidos/adapters/driving/order-actions';

export const DELIVERY_ORDER_ID = 'a0000000-0000-4000-8000-000000000001';
export const DELIVERY_KEY = 'b0000000-0000-4000-8000-0000000000b1';
export const DELIVERY_CUSTOMER_ID = 'c0000000-0000-4000-8000-00000000000a';
/** Segundo cliente de la entrega a varios clientes. */
export const SECOND_DELIVERY_CUSTOMER_ID = 'c0000000-0000-4000-8000-00000000000b';

/** Linea completa: ya no le falta ningun envase y no ofrece lotes. */
export const COMPLETE_LINE_ID = 'd0000000-0000-4000-8000-000000000001';
/** Linea con envases pendientes y dos lotes entregables. */
export const PENDING_LINE_ID = 'd0000000-0000-4000-8000-000000000002';
export const OLDER_BATCH_ID = 'e0000000-0000-4000-8000-000000000001';
export const NEWER_BATCH_ID = 'e0000000-0000-4000-8000-000000000002';

/** Segunda linea con envases pendientes, con un solo lote. Solo en `multiCustomerDeliveryView`. */
export const SECOND_PENDING_LINE_ID = 'd0000000-0000-4000-8000-000000000003';
export const GALLON_BATCH_ID = 'e0000000-0000-4000-8000-000000000003';

const PENDING_PRESENTATION_ID = 'f0000000-0000-4000-8000-000000000002';
const SECOND_PENDING_PRESENTATION_ID = 'f0000000-0000-4000-8000-000000000003';

export function deliveryView(overrides: Partial<OrderDeliveryView> = {}): OrderDeliveryView {
  return {
    orderId: DELIVERY_ORDER_ID,
    numberText: '2026-0000007',
    customer: { id: DELIVERY_CUSTOMER_ID, name: 'Ana Perez', isDeleted: false },
    lines: [
      {
        presentationLineId: COMPLETE_LINE_ID,
        presentationName: 'Galon 4 L',
        orderedPackages: 4,
        deliveredPackages: 4,
        remainingPackages: 0,
        batches: [],
      },
      {
        presentationLineId: PENDING_LINE_ID,
        presentationName: 'Botella 1 L',
        orderedPackages: 10,
        deliveredPackages: 3,
        remainingPackages: 7,
        batches: [
          {
            batchId: OLDER_BATCH_ID,
            presentationId: PENDING_PRESENTATION_ID,
            lot: 'L-2026-0001',
            purchaseDate: '2026-09-30',
            expiryDate: '2027-09-30',
            packageContent: '1.0000',
            availablePackages: 4,
          },
          {
            batchId: NEWER_BATCH_ID,
            presentationId: PENDING_PRESENTATION_ID,
            lot: 'L-2026-0002',
            purchaseDate: '2026-10-05',
            expiryDate: null,
            packageContent: '1.0000',
            availablePackages: 6,
          },
        ],
      },
    ],
    ...overrides,
  };
}

// 2026-10-15: vista para repartir entre varios clientes. `deliveryView` se conserva tal cual
// para los casos de un solo bloque.
/** Dos presentaciones con envases pendientes; `OLDER_BATCH_ID` lo comparten los dos clientes de
 *  `deliverInput`. */
export function multiCustomerDeliveryView(overrides: Partial<OrderDeliveryView> = {}): OrderDeliveryView {
  const base = deliveryView();
  const pending = base.lines.find((line) => line.presentationLineId === PENDING_LINE_ID);
  if (pending === undefined) throw new Error('multiCustomerDeliveryView: falta la linea pendiente');
  return {
    ...base,
    lines: [
      pending,
      {
        presentationLineId: SECOND_PENDING_LINE_ID,
        presentationName: 'Galon 4 L',
        orderedPackages: 5,
        deliveredPackages: 0,
        remainingPackages: 5,
        batches: [
          {
            batchId: GALLON_BATCH_ID,
            presentationId: SECOND_PENDING_PRESENTATION_ID,
            lot: 'L-2026-0003',
            purchaseDate: '2026-10-06',
            expiryDate: null,
            packageContent: '4.0000',
            availablePackages: 5,
          },
        ],
      },
    ],
    ...overrides,
  };
}

export const DELIVER_RESULTS = {
  partial: { status: 'delivered', orderStatus: 'TERMINADO' },
  completed: { status: 'delivered', orderStatus: 'ENTREGADO' },
  alreadyRegistered: { status: 'already_registered', orderStatus: 'ENTREGADO' },
} as const satisfies Record<string, DeliverOrderResult>;

const errorState = <C extends Exclude<ErrorState['code'], 'unexpected'>>(code: C) =>
  ({ status: 'error', code, message: errorMessage(code) }) as const;

/** Un `ErrorState` por cada codigo que puede devolver la entrega. */
export const DELIVERY_ERROR_STATES = {
  exceedsRemaining: errorState('delivery_exceeds_remaining'),
  batchInsufficient: errorState('delivery_batch_insufficient'),
  batchNotFound: errorState('batch_not_found'),
  actionNotAllowed: errorState('action_not_allowed'),
  orderNotFound: errorState('order_not_found'),
  customerNotFound: errorState('customer_not_found'),
  invalidInput: errorState('invalid_input'),
  unauthorized: errorState('unauthorized'),
} as const satisfies Record<string, ErrorState>;

// 2026-10-15: la entrega lleva `customers` en vez de `customerId` y `allocations`.
/** Dos clientes que comparten `OLDER_BATCH_ID`; el segundo lleva ademas la otra presentacion. */
export function deliverInput(overrides: Partial<DeliverOrderInput> = {}): DeliverOrderInput {
  return {
    orderId: DELIVERY_ORDER_ID,
    deliveryKey: DELIVERY_KEY,
    customers: [
      {
        customerId: DELIVERY_CUSTOMER_ID,
        allocations: [{ presentationLineId: PENDING_LINE_ID, batchId: OLDER_BATCH_ID, packages: 3 }],
      },
      {
        customerId: SECOND_DELIVERY_CUSTOMER_ID,
        allocations: [
          { presentationLineId: PENDING_LINE_ID, batchId: OLDER_BATCH_ID, packages: 1 },
          { presentationLineId: SECOND_PENDING_LINE_ID, batchId: GALLON_BATCH_ID, packages: 2 },
        ],
      },
    ],
    ...overrides,
  };
}
