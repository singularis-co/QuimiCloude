'use client';

import { BanIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { OrderDeliveryHistoryView, OrderStatus } from '@/lib/modules/pedidos';

export type OrderDeliveryHistoryEntry = OrderDeliveryHistoryView['deliveries'][number];

export const ORDER_DELIVERIES_EMPTY_TESTID = 'order-deliveries-empty';
export const ORDER_DELIVERY_ENTRY_TESTID = 'order-delivery-entry';
export const ORDER_DELIVERY_ENTRY_PRESENTATION_TESTID = 'order-delivery-entry-presentation';
export const ORDER_DELIVERY_ENTRY_BATCH_TESTID = 'order-delivery-entry-batch';
export const ORDER_DELIVERY_ENTRY_VOIDED_TESTID = 'order-delivery-entry-voided';
export const ORDER_DELIVERY_VOID_TESTID = 'order-delivery-void';

const EMPTY_TEXT = 'Este pedido todavía no tiene entregas.';
const LIST_LABEL = 'Entregas del pedido';
const DATE_LABEL = 'Fecha';
const CUSTOMER_LABEL = 'Cliente';
const AUTHOR_LABEL = 'Entregó';
const PACKAGES_LABEL = 'Envases';
const LOT_LABEL = 'Lote';
const VOIDED_LABEL = 'Anulada';
const VOID_REASON_LABEL = 'Motivo';
const VOID_AUTHOR_LABEL = 'Anuló';
const VOID_DATE_LABEL = 'Fecha de anulación';
const VOID_ACTION_LABEL = 'Anular';

const STATUS_ACCEPTS_VOID: Readonly<Record<OrderStatus, boolean>> = {
  PENDIENTE: false,
  EN_CURSO: false,
  POR_EMPACAR: false,
  EN_EMPAQUE: false,
  ENTREGADO: true,
  CANCELADO: false,
  BLOQUEADO: false,
  POR_ACONDICIONAR: false,
  EN_ACONDICIONAMIENTO: false,
  TERMINADO: true,
};

/**
 * Recorta el ISO tal cual llega, en UTC: `toLocaleString` depende del huso del entorno y
 * desalinea el render del servidor y el del navegador.
 */
function formatDeliveryDate(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

export type OrderDeliveryListProps = {
  /** En el orden en que se pintan: la más reciente primero. */
  readonly deliveries: OrderDeliveryHistoryView['deliveries'];
  /** Lo decide el servidor con el permiso de anular entregas; sin él, la acción no se pinta. */
  readonly canVoid: boolean;
  readonly orderStatus: OrderStatus;
  readonly onVoid?: (delivery: OrderDeliveryHistoryEntry) => void;
};

export function OrderDeliveryList({ deliveries, canVoid, orderStatus, onVoid }: OrderDeliveryListProps) {
  if (deliveries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid={ORDER_DELIVERIES_EMPTY_TESTID}>
        {EMPTY_TEXT}
      </p>
    );
  }

  const statusAcceptsVoid = canVoid && STATUS_ACCEPTS_VOID[orderStatus];

  return (
    <ul className="flex flex-col gap-4" aria-label={LIST_LABEL}>
      {deliveries.map((delivery) => {
        const showVoid =
          statusAcceptsVoid && delivery.presentations.some((presentation) => presentation.void === null);
        const dateText = formatDeliveryDate(delivery.createdAt);
        return (
          <li
            key={delivery.id}
            className="flex flex-col gap-3 rounded-lg border p-3"
            data-testid={ORDER_DELIVERY_ENTRY_TESTID}
            data-delivery-id={delivery.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">{DATE_LABEL}</dt>
                <dd data-testid="order-delivery-entry-date">
                  <time dateTime={delivery.createdAt}>{dateText}</time>
                </dd>
                <dt className="text-muted-foreground">{CUSTOMER_LABEL}</dt>
                <dd data-testid="order-delivery-entry-customer">{delivery.customerName}</dd>
                <dt className="text-muted-foreground">{AUTHOR_LABEL}</dt>
                <dd data-testid="order-delivery-entry-author">{delivery.authorName}</dd>
              </dl>
              {showVoid ? (
                <Button
                  type="button"
                  variant="outline"
                  touch
                  data-testid={ORDER_DELIVERY_VOID_TESTID}
                  aria-label={`${VOID_ACTION_LABEL} la entrega del ${dateText}`}
                  onClick={() => onVoid?.(delivery)}
                >
                  <BanIcon aria-hidden="true" />
                  {VOID_ACTION_LABEL}
                </Button>
              ) : null}
            </div>
            <ul className="flex flex-col gap-2">
              {delivery.presentations.map((presentation) => (
                <li
                  key={presentation.presentationLineId}
                  className="flex flex-col gap-1 border-t pt-2 text-sm"
                  data-testid={ORDER_DELIVERY_ENTRY_PRESENTATION_TESTID}
                  data-presentation-line-id={presentation.presentationLineId}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium" data-testid="order-delivery-entry-presentation-name">
                      {presentation.presentationName}
                    </span>
                    <span data-testid="order-delivery-entry-presentation-packages">
                      <span className="text-muted-foreground">{PACKAGES_LABEL} </span>
                      {presentation.packages}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-0.5">
                    {presentation.batches.map((batch) => (
                      <li
                        key={batch.batchId}
                        className="flex justify-between gap-2 text-muted-foreground"
                        data-testid={ORDER_DELIVERY_ENTRY_BATCH_TESTID}
                        data-batch-id={batch.batchId}
                      >
                        <span>
                          {LOT_LABEL} <span data-testid="order-delivery-entry-batch-lot">{batch.lot}</span>
                        </span>
                        <span>
                          {PACKAGES_LABEL}{' '}
                          <span data-testid="order-delivery-entry-batch-packages">{batch.packages}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {presentation.void === null ? null : (
                    <div
                      className="flex flex-col gap-1 rounded-md bg-muted p-2"
                      data-testid={ORDER_DELIVERY_ENTRY_VOIDED_TESTID}
                    >
                      <Badge variant="destructive">{VOIDED_LABEL}</Badge>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                        <dt className="text-muted-foreground">{VOID_REASON_LABEL}</dt>
                        <dd className="break-words" data-testid="order-delivery-entry-void-reason">
                          {presentation.void.reason}
                        </dd>
                        <dt className="text-muted-foreground">{VOID_AUTHOR_LABEL}</dt>
                        <dd data-testid="order-delivery-entry-void-author">{presentation.void.authorName}</dd>
                        <dt className="text-muted-foreground">{VOID_DATE_LABEL}</dt>
                        <dd data-testid="order-delivery-entry-void-date">
                          <time dateTime={presentation.void.createdAt}>
                            {formatDeliveryDate(presentation.void.createdAt)}
                          </time>
                        </dd>
                      </dl>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
