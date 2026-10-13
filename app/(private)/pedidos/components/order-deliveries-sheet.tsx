'use client';

import { useCallback, useEffect, useState } from 'react';

import { ErrorAlert } from '@/components/shared/error-alert';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage, UNEXPECTED_ERROR_CODE, type ErrorState } from '@/lib/modules/errores';
import { newRequestId } from '@/lib/modules/observabilidad';
import type { OrderDeliveryHistoryView, OrderSummary } from '@/lib/modules/pedidos';
import {
  listOrderDeliveriesAction,
  type OrderDeliveriesResult,
} from '@/lib/modules/pedidos/adapters/driving/order-actions';

import { DeliveryVoidDialog } from './delivery-void-dialog';
import { OrderDeliveryList } from './order-delivery-list';

export const ORDER_DELIVERIES_SHEET_TESTID = 'order-deliveries-sheet';
export const ORDER_DELIVERIES_SKELETON_TESTID = 'order-deliveries-skeleton';
export const ORDER_DELIVERIES_ERROR_TESTID = 'order-deliveries-error';

const LABELS = {
  title: (numberText: string) => `Entregas del pedido ${numberText}`,
  description: 'Lo entregado de este pedido, de la entrega más reciente a la más antigua.',
} as const;

function unexpectedFromRejection(): ErrorState {
  return {
    status: 'error',
    code: UNEXPECTED_ERROR_CODE,
    message: errorMessage(UNEXPECTED_ERROR_CODE),
    reference: newRequestId(),
  };
}

async function readDeliveries(orderId: string): Promise<OrderDeliveriesResult> {
  try {
    return await listOrderDeliveriesAction(orderId);
  } catch {
    return unexpectedFromRejection();
  }
}

function ErrorNotice({ error }: { readonly error: ErrorState }) {
  return (
    <ErrorAlert
      error={error}
      className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
      testId={ORDER_DELIVERIES_ERROR_TESTID}
      withDataCode
    />
  );
}

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly error: ErrorState }
  | { readonly kind: 'ready'; readonly view: OrderDeliveryHistoryView };

export type OrderDeliveriesSheetProps = {
  readonly order: Pick<OrderSummary, 'id' | 'numberText'>;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Lo decide el servidor con el permiso de anular entregas. */
  readonly canVoid: boolean;
};

/** Historial de entregas de un pedido, con la anulación de cada una. */
export function OrderDeliveriesSheet({ order, open, onOpenChange, canVoid }: OrderDeliveriesSheetProps) {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [reloadError, setReloadError] = useState<ErrorState | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const apply = useCallback((result: OrderDeliveriesResult) => {
    if (result.status === 'error') {
      // Con datos ya pintados un fallo de relectura no los borra: se avisa encima.
      setLoad((previous) => (previous.kind === 'ready' ? previous : { kind: 'error', error: result }));
      setReloadError(result);
      return;
    }
    setReloadError(null);
    setLoad({ kind: 'ready', view: result.data });
  }, []);

  const reload = useCallback(async () => {
    apply(await readDeliveries(order.id));
  }, [apply, order.id]);

  useEffect(() => {
    let active = true;
    void readDeliveries(order.id).then((result) => {
      if (active) apply(result);
    });
    return () => {
      active = false;
    };
  }, [apply, order.id]);

  const view = load.kind === 'ready' ? load.view : null;
  // Se busca en la vista vigente: tras una relectura el diálogo ve la entrega ya actualizada.
  const voiding = view?.deliveries.find((delivery) => delivery.id === voidingId) ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} disableEscapeDismissal={false} disablePointerDismissal={false}>
      <SheetContent
        side="right"
        className="w-full pb-[env(safe-area-inset-bottom)] data-[side=right]:w-full sm:max-w-lg"
        data-testid={ORDER_DELIVERIES_SHEET_TESTID}
      >
        <SheetHeader>
          <SheetTitle>{LABELS.title(order.numberText)}</SheetTitle>
          <SheetDescription>{LABELS.description}</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4" aria-busy={load.kind === 'loading'}>
          {load.kind === 'loading' ? (
            <div className="flex flex-col gap-3" data-testid={ORDER_DELIVERIES_SKELETON_TESTID} aria-hidden="true">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : null}

          {load.kind === 'error' ? <ErrorNotice error={load.error} /> : null}

          {view === null ? null : (
            <>
              {reloadError === null ? null : <ErrorNotice error={reloadError} />}
              <OrderDeliveryList
                deliveries={view.deliveries}
                canVoid={canVoid}
                orderStatus={view.orderStatus}
                onVoid={(delivery) => setVoidingId(delivery.id)}
              />
            </>
          )}
        </div>
        {voiding === null ? null : (
          <DeliveryVoidDialog
            delivery={voiding}
            open
            onOpenChange={(next) => {
              if (!next) setVoidingId(null);
            }}
            reload={reload}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
