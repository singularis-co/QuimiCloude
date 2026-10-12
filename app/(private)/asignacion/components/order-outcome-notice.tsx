export const PACKED_ORDER_NOTICE_TESTID = 'packed-order-notice';
export const CONDITIONED_ORDER_NOTICE_TESTID = 'conditioned-order-notice';

/** Funciones y no literales, para que un test no pueda comparar contra una copia del texto. */
export function packedOrderNoticeText(orderNumber: string): string {
  return `Pedido ${orderNumber} empacado`;
}

export function conditionedOrderNoticeText(orderNumber: string): string {
  return `Pedido ${orderNumber} acondicionado`;
}

export type OrderOutcomeKind = 'packed' | 'conditioned';

export type OrderOutcomeNoticeProps = {
  readonly kind: OrderOutcomeKind;
  readonly orderNumber: string;
};

const OUTCOMES: Record<
  OrderOutcomeKind,
  { readonly testId: string; readonly text: (orderNumber: string) => string }
> = {
  packed: { testId: PACKED_ORDER_NOTICE_TESTID, text: packedOrderNoticeText },
  conditioned: { testId: CONDITIONED_ORDER_NOTICE_TESTID, text: conditionedOrderNoticeText },
};

/** Se pinta al volver de Terminar, con el número que trae la URL. */
export function OrderOutcomeNotice({ kind, orderNumber }: OrderOutcomeNoticeProps) {
  const outcome = OUTCOMES[kind];
  return (
    <p
      role="status"
      data-testid={outcome.testId}
      className="rounded-lg border border-emerald-400/40 bg-emerald-50 p-3 text-sm font-medium text-emerald-900"
    >
      {outcome.text(orderNumber)}
    </p>
  );
}
