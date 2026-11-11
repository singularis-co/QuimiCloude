import { Notice, type NoticeTone } from '@/components/shared/notice';

export const ASSIGNED_ORDER_MANUFACTURED_TESTID = 'assigned-order-manufactured-notice';
export const ASSIGNED_ORDER_CANCELLED_TESTID = 'assigned-order-cancelled-notice';
export const PACKED_ORDER_NOTICE_TESTID = 'packed-order-notice';
export const CONDITIONED_ORDER_NOTICE_TESTID = 'conditioned-order-notice';

export const ORDER_OUTCOME_NOTICE_CLOSE_LABEL = 'Cerrar';

/**
 * Funciones y no literales, para que un test no pueda comparar contra una copia del texto. Sin
 * receta (pedido de una sola) el aviso nombra solo el pedido.
 */
export function manufacturedOrderNoticeText(orderNumber: string, recipeName?: string): string {
  return recipeName === undefined
    ? `Pedido ${orderNumber} por empacar`
    : `${recipeName} del pedido ${orderNumber}, por empacar`;
}

export function assignedOrderCancelledNoticeText(orderNumber: string, recipeName?: string): string {
  return recipeName === undefined
    ? `Pedido ${orderNumber} cancelado`
    : `${recipeName} del pedido ${orderNumber} cancelada. Su material quedó libre.`;
}

export function packedOrderNoticeText(orderNumber: string, recipeName?: string): string {
  return recipeName === undefined
    ? `Pedido ${orderNumber} empacado`
    : `${recipeName} del pedido ${orderNumber}, empacada`;
}

export function conditionedOrderNoticeText(orderNumber: string, recipeName?: string): string {
  return recipeName === undefined
    ? `Pedido ${orderNumber} acondicionado`
    : `${recipeName} del pedido ${orderNumber}, acondicionada`;
}

export type OrderOutcomeKind = 'manufactured' | 'cancelled' | 'packed' | 'conditioned';

export type OrderOutcomeNoticeProps = {
  readonly kind: OrderOutcomeKind;
  readonly orderNumber: string;
  /** Solo llega cuando el pedido tiene mas de una receta. */
  readonly recipeName?: string;
};

const OUTCOMES: Readonly<
  Record<
    OrderOutcomeKind,
    {
      readonly tone: NoticeTone;
      readonly testId: string;
      readonly text: (orderNumber: string, recipeName?: string) => string;
    }
  >
> = {
  manufactured: {
    tone: 'warning',
    testId: ASSIGNED_ORDER_MANUFACTURED_TESTID,
    text: manufacturedOrderNoticeText,
  },
  cancelled: { tone: 'info', testId: ASSIGNED_ORDER_CANCELLED_TESTID, text: assignedOrderCancelledNoticeText },
  packed: { tone: 'success', testId: PACKED_ORDER_NOTICE_TESTID, text: packedOrderNoticeText },
  conditioned: { tone: 'success', testId: CONDITIONED_ORDER_NOTICE_TESTID, text: conditionedOrderNoticeText },
};

/** Se pinta al volver de una pantalla del operario, con el número que trae la URL. */
export function OrderOutcomeNotice({ kind, orderNumber, recipeName }: OrderOutcomeNoticeProps) {
  const { tone, testId, text } = OUTCOMES[kind];
  return (
    <Notice
      tone={tone}
      testId={testId}
      dismissible={{ label: ORDER_OUTCOME_NOTICE_CLOSE_LABEL, testId: `${testId}-close` }}
    >
      {text(orderNumber, recipeName)}
    </Notice>
  );
}
