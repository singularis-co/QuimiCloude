import { Notice, type NoticeTone } from '@/components/shared/notice';

export const ASSIGNED_ORDER_DELIVERED_TESTID = 'assigned-order-delivered-notice';
export const ASSIGNED_ORDER_CANCELLED_TESTID = 'assigned-order-cancelled-notice';
export const PACKED_ORDER_NOTICE_TESTID = 'packed-order-notice';
export const CONDITIONED_ORDER_NOTICE_TESTID = 'conditioned-order-notice';

export const ORDER_OUTCOME_NOTICE_CLOSE_LABEL = 'Cerrar';

/** Funciones y no literales, para que un test no pueda comparar contra una copia del texto. */
export function assignedOrderDeliveredNoticeText(orderNumber: string): string {
  return `Pedido ${orderNumber} por empacar`;
}

/** Sin envases ni producto (una URL de antes) se queda el texto corto. */
export function assignedOrderDeliveredWithPackagesText(
  orderNumber: string,
  packages: string,
  productName: string,
): string {
  const count = Number(packages);
  const unit = count === 1 ? 'envase' : 'envases';
  return `${assignedOrderDeliveredNoticeText(orderNumber)}. Entraron ${packages} ${unit} de ${productName}.`;
}

export function assignedOrderCancelledNoticeText(orderNumber: string): string {
  return `Pedido ${orderNumber} cancelado`;
}

export function packedOrderNoticeText(orderNumber: string): string {
  return `Pedido ${orderNumber} empacado`;
}

export function conditionedOrderNoticeText(orderNumber: string): string {
  return `Pedido ${orderNumber} acondicionado`;
}

export type OrderOutcomeKind = 'delivered' | 'cancelled' | 'packed' | 'conditioned';

export type OrderOutcomeNoticeProps = {
  readonly kind: OrderOutcomeKind;
  readonly orderNumber: string;
  /** Solo `delivered`: envases enteros que entraron. */
  readonly packages?: string;
  /** Solo `delivered`: producto terminado que los recibió. */
  readonly productName?: string;
};

const OUTCOMES: Readonly<
  Record<OrderOutcomeKind, { readonly tone: NoticeTone; readonly testId: string }>
> = {
  delivered: { tone: 'warning', testId: ASSIGNED_ORDER_DELIVERED_TESTID },
  cancelled: { tone: 'info', testId: ASSIGNED_ORDER_CANCELLED_TESTID },
  packed: { tone: 'success', testId: PACKED_ORDER_NOTICE_TESTID },
  conditioned: { tone: 'success', testId: CONDITIONED_ORDER_NOTICE_TESTID },
};

function outcomeText({ kind, orderNumber, packages, productName }: OrderOutcomeNoticeProps): string {
  switch (kind) {
    case 'delivered':
      return packages !== undefined && productName !== undefined
        ? assignedOrderDeliveredWithPackagesText(orderNumber, packages, productName)
        : assignedOrderDeliveredNoticeText(orderNumber);
    case 'cancelled':
      return assignedOrderCancelledNoticeText(orderNumber);
    case 'packed':
      return packedOrderNoticeText(orderNumber);
    case 'conditioned':
      return conditionedOrderNoticeText(orderNumber);
  }
}

/** Se pinta al volver de una pantalla del operario, con el número que trae la URL. */
export function OrderOutcomeNotice(props: OrderOutcomeNoticeProps) {
  const { tone, testId } = OUTCOMES[props.kind];
  return (
    <Notice
      tone={tone}
      testId={testId}
      dismissible={{ label: ORDER_OUTCOME_NOTICE_CLOSE_LABEL, testId: `${testId}-close` }}
    >
      {outcomeText(props)}
    </Notice>
  );
}
