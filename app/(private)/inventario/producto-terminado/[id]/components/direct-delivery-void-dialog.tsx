'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { ConfirmDialogBody, ConfirmDialogFrame } from '@/components/shared/confirm-dialog';
import { ErrorAlert } from '@/components/shared/error-alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage, UNEXPECTED_ERROR_CODE, type ErrorState } from '@/lib/modules/errores';
import { newRequestId } from '@/lib/modules/observabilidad';
import {
  getDirectDeliveryForVoidAction,
  voidDirectDeliveryAction,
  type DirectDeliveryVoidViewResult,
  type VoidDirectDeliveryActionResult,
  type VoidDirectDeliveryInput,
} from '@/lib/modules/pedidos/adapters/driving/order-actions';
import { touchTarget } from '@/lib/shared/ui/touch-target';

import { movementDateText } from './finished-product-movements-table';

export const DIRECT_DELIVERY_VOID_DIALOG_TESTID = 'direct-delivery-void-dialog';
export const DIRECT_DELIVERY_VOID_LOADING_TESTID = 'direct-delivery-void-loading';
export const DIRECT_DELIVERY_VOID_LOAD_ERROR_TESTID = 'direct-delivery-void-load-error';
export const DIRECT_DELIVERY_VOID_RETRY_TESTID = 'direct-delivery-void-retry';
export const DIRECT_DELIVERY_VOID_CUSTOMER_TESTID = 'direct-delivery-void-customer';
export const DIRECT_DELIVERY_VOID_REASON_TESTID = 'direct-delivery-void-reason';
export const DIRECT_DELIVERY_VOID_EMPTY_ERROR_TESTID = 'direct-delivery-void-empty-error';
export const DIRECT_DELIVERY_VOID_REASON_ERROR_TESTID = 'direct-delivery-void-reason-error';
export const DIRECT_DELIVERY_VOID_REASON_TOO_LONG_TESTID = 'direct-delivery-void-reason-too-long';
export const DIRECT_DELIVERY_VOID_REJECTED_TESTID = 'direct-delivery-void-rejected';
export const DIRECT_DELIVERY_VOID_ERROR_TESTID = 'direct-delivery-void-error';
export const DIRECT_DELIVERY_VOID_CONFIRM_TESTID = 'direct-delivery-void-confirm';
export const DIRECT_DELIVERY_VOID_DISMISS_TESTID = 'direct-delivery-void-dismiss';

/** El mismo tope que aplica el caso de uso al motivo ya recortado. */
export const DIRECT_DELIVERY_VOID_REASON_MAX_LENGTH = 500;

/** 16 px en todos los anchos: por debajo, Safari en iOS hace zoom al enfocar el campo. */
const FIELD_TEXT = 'text-base md:text-base';
const NOTICE_CLASS = 'rounded-lg border border-destructive/40 p-3 text-sm text-destructive';

export const DIRECT_DELIVERY_VOID_TEXTS = {
  title: 'Anular la entrega sin pedido',
  delivery: (dateText: string, presentationName: string | null) =>
    presentationName === null ? `Entrega del ${dateText}.` : `Entrega del ${dateText} · ${presentationName}.`,
  description: 'Marca los clientes cuya parte se anula. Sus envases vuelven a los lotes de los que salieron.',
  customers: 'Clientes de la entrega',
  packages: (packages: number) => `${packages} envases`,
  customer: (customerName: string, packages: number) => `Anular lo de ${customerName} · ${packages} envases`,
  loading: 'Cargando la entrega…',
  retry: 'Reintentar',
  reason: 'Motivo de la anulación',
  empty: 'No hay nada que anular: marca al menos un cliente.',
  reasonRequired: 'Escribe el motivo de la anulación.',
  reasonTooLong: `El motivo no puede pasar de ${DIRECT_DELIVERY_VOID_REASON_MAX_LENGTH} caracteres.`,
  confirm: 'Anular',
  pending: 'Anulando…',
  dismiss: 'Volver',
  voided: 'Entrega anulada',
} as const;

const REREAD_CODE = 'delivery_already_voided' satisfies ErrorState['code'];

function unexpectedFromRejection(): ErrorState {
  return {
    status: 'error',
    code: UNEXPECTED_ERROR_CODE,
    message: errorMessage(UNEXPECTED_ERROR_CODE),
    reference: newRequestId(),
  };
}

export type DirectDeliveryVoidDialogProps = {
  readonly deliveryId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

export function DirectDeliveryVoidDialog({ deliveryId, open, onOpenChange }: DirectDeliveryVoidDialogProps) {
  const fieldId = useId();
  return (
    <ConfirmDialogFrame open={open} onOpenChange={onOpenChange} testId={DIRECT_DELIVERY_VOID_DIALOG_TESTID}>
      <DirectDeliveryVoidDialogBody deliveryId={deliveryId} onOpenChange={onOpenChange} fieldId={fieldId} />
    </ConfirmDialogFrame>
  );
}

type DirectDeliveryVoidView = Extract<DirectDeliveryVoidViewResult, { status: 'success' }>['data'];

type Loaded =
  | { readonly attempt: number; readonly status: 'ready'; readonly view: DirectDeliveryVoidView }
  | { readonly attempt: number; readonly status: 'error'; readonly error: ErrorState };

function settle(attempt: number, result: DirectDeliveryVoidViewResult): Loaded {
  return result.status === 'success'
    ? { attempt, status: 'ready', view: result.data }
    : { attempt, status: 'error', error: result };
}

type BodyProps = Omit<DirectDeliveryVoidDialogProps, 'open'> & { readonly fieldId: string };

/**
 * Se monta con el popup: cada apertura estrena clave de anulación, y los reintentos de esa
 * apertura reutilizan la misma para que el servidor reconozca el envío repetido.
 */
function DirectDeliveryVoidDialogBody({ deliveryId, onOpenChange, fieldId }: BodyProps) {
  const router = useRouter();
  const reasonId = `${fieldId}-reason`;
  const reasonErrorId = `${fieldId}-reason-error`;
  const [voidKey] = useState(() => crypto.randomUUID());
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());
  const [reason, setReason] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [rejected, setRejected] = useState<ErrorState | null>(null);
  const [submitError, setSubmitError] = useState<ErrorState | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let live = true;
    getDirectDeliveryForVoidAction(deliveryId).then(
      (result) => {
        if (live) setLoaded(settle(attempt, result));
      },
      () => {
        if (live) setLoaded({ attempt, status: 'error', error: unexpectedFromRejection() });
      },
    );
    return () => {
      live = false;
    };
  }, [deliveryId, attempt]);

  // Durante una relectura se sigue pintando la vista anterior para no perder lo marcado.
  const view = loaded?.status === 'ready' ? loaded.view : null;
  const loadError = loaded !== null && loaded.attempt === attempt && loaded.status === 'error' ? loaded.error : null;
  const customers = view?.customers ?? [];

  // Tras una relectura un cliente marcado puede haber quedado anulado: ya no se envía.
  const selected = customers.filter((customer) => checked.has(customer.customerId));
  const trimmedReason = reason.trim();
  const showEmpty = attempted && selected.length === 0;
  const showReasonRequired = attempted && trimmedReason === '';
  const showReasonTooLong = attempted && trimmedReason.length > DIRECT_DELIVERY_VOID_REASON_MAX_LENGTH;
  const reasonInvalid = showReasonRequired || showReasonTooLong;

  function toggle(customerId: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  }

  function confirm() {
    if (isPending || view === null) return;
    setAttempted(true);
    if (
      selected.length === 0 ||
      trimmedReason === '' ||
      trimmedReason.length > DIRECT_DELIVERY_VOID_REASON_MAX_LENGTH
    ) {
      return;
    }

    const input: VoidDirectDeliveryInput = {
      deliveryId,
      voidKey,
      customerIds: selected.map((customer) => customer.customerId),
      reason,
    };
    startTransition(async () => {
      let result: VoidDirectDeliveryActionResult;
      try {
        result = await voidDirectDeliveryAction(input);
      } catch {
        result = unexpectedFromRejection();
      }

      if (result.status === 'success') {
        onOpenChange(false);
        toast.success(DIRECT_DELIVERY_VOID_TEXTS.voided);
        router.refresh();
        return;
      }

      if (result.code === REREAD_CODE) {
        setSubmitError(null);
        setRejected(result);
        setAttempt((current) => current + 1);
        return;
      }
      setRejected(null);
      setSubmitError(result);
    });
  }

  const description =
    view === null
      ? DIRECT_DELIVERY_VOID_TEXTS.description
      : `${DIRECT_DELIVERY_VOID_TEXTS.delivery(movementDateText(view.createdAt), view.presentationName)} ${DIRECT_DELIVERY_VOID_TEXTS.description}`;

  return (
    <ConfirmDialogBody
      onOpenChange={onOpenChange}
      variant="destructive"
      texts={{
        title: DIRECT_DELIVERY_VOID_TEXTS.title,
        description,
        dismiss: DIRECT_DELIVERY_VOID_TEXTS.dismiss,
        confirm: DIRECT_DELIVERY_VOID_TEXTS.confirm,
        pending: DIRECT_DELIVERY_VOID_TEXTS.pending,
      }}
      testIds={{
        message: 'direct-delivery-void-message',
        dismiss: DIRECT_DELIVERY_VOID_DISMISS_TESTID,
        confirm: DIRECT_DELIVERY_VOID_CONFIRM_TESTID,
        error: DIRECT_DELIVERY_VOID_ERROR_TESTID,
      }}
      submit={{ kind: 'transition', onConfirm: confirm }}
      isPending={isPending}
      confirmDisabled={view === null}
      error={submitError ?? undefined}
      aside={
        rejected === null ? null : (
          <ErrorAlert
            error={rejected}
            className={NOTICE_CLASS}
            testId={DIRECT_DELIVERY_VOID_REJECTED_TESTID}
            withDataCode
          />
        )
      }
    >
      <div className="flex flex-col gap-4">
        {loadError !== null ? (
          <div className="flex flex-col items-start gap-2">
            <ErrorAlert
              error={loadError}
              className={NOTICE_CLASS}
              testId={DIRECT_DELIVERY_VOID_LOAD_ERROR_TESTID}
              withDataCode
            />
            <Button
              type="button"
              variant="outline"
              touch
              onClick={() => setAttempt((current) => current + 1)}
              data-testid={DIRECT_DELIVERY_VOID_RETRY_TESTID}
            >
              {DIRECT_DELIVERY_VOID_TEXTS.retry}
            </Button>
          </div>
        ) : null}

        {view === null && loadError === null ? (
          <div
            className="flex flex-col gap-2 border-t pt-2"
            role="status"
            aria-label={DIRECT_DELIVERY_VOID_TEXTS.loading}
            data-testid={DIRECT_DELIVERY_VOID_LOADING_TESTID}
          >
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : null}

        {view === null ? null : (
          <fieldset className="flex flex-col gap-0.5 border-t pt-2">
            <legend className="sr-only">{DIRECT_DELIVERY_VOID_TEXTS.customers}</legend>
            {customers.map((customer) => (
              <div key={customer.customerId} className="flex min-h-11 items-center gap-3">
                <Checkbox
                  aria-label={DIRECT_DELIVERY_VOID_TEXTS.customer(customer.customerName, customer.packages)}
                  className={touchTarget}
                  checked={checked.has(customer.customerId)}
                  onCheckedChange={() => toggle(customer.customerId)}
                  disabled={isPending}
                  data-testid={DIRECT_DELIVERY_VOID_CUSTOMER_TESTID}
                  data-customer-id={customer.customerId}
                />
                <span className="text-sm" aria-hidden="true">
                  <span className="font-semibold">{customer.customerName}</span>{' '}
                  <span className="text-muted-foreground">
                    · <span className="font-mono tabular-nums">{customer.packages}</span> envases
                  </span>
                </span>
              </div>
            ))}
            {showEmpty ? (
              <p className="text-sm text-destructive" data-testid={DIRECT_DELIVERY_VOID_EMPTY_ERROR_TESTID}>
                {DIRECT_DELIVERY_VOID_TEXTS.empty}
              </p>
            ) : null}
          </fieldset>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor={reasonId} className="text-sm font-medium">
            {DIRECT_DELIVERY_VOID_TEXTS.reason}
          </label>
          <Textarea
            id={reasonId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={FIELD_TEXT}
            disabled={isPending}
            aria-invalid={reasonInvalid ? true : undefined}
            aria-describedby={reasonInvalid ? reasonErrorId : undefined}
            data-testid={DIRECT_DELIVERY_VOID_REASON_TESTID}
          />
          {showReasonRequired ? (
            <p
              id={reasonErrorId}
              className="text-sm text-destructive"
              data-testid={DIRECT_DELIVERY_VOID_REASON_ERROR_TESTID}
            >
              {DIRECT_DELIVERY_VOID_TEXTS.reasonRequired}
            </p>
          ) : null}
          {showReasonTooLong ? (
            <p
              id={reasonErrorId}
              className="text-sm text-destructive"
              data-testid={DIRECT_DELIVERY_VOID_REASON_TOO_LONG_TESTID}
            >
              {DIRECT_DELIVERY_VOID_TEXTS.reasonTooLong}
            </p>
          ) : null}
        </div>
      </div>
    </ConfirmDialogBody>
  );
}
