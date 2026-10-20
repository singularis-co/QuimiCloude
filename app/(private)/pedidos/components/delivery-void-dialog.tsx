'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { ConfirmDialogBody, ConfirmDialogFrame } from '@/components/shared/confirm-dialog';
import { ErrorAlert } from '@/components/shared/error-alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage, UNEXPECTED_ERROR_CODE, type ErrorState } from '@/lib/modules/errores';
import { newRequestId } from '@/lib/modules/observabilidad';
import { touchTarget } from '@/lib/shared/ui/touch-target';
import {
  voidDeliveryAction,
  type VoidDeliveryActionResult,
  type VoidDeliveryInput,
} from '@/lib/modules/pedidos/adapters/driving/order-actions';

import type { OrderDeliveryHistoryEntry } from './order-delivery-list';

export const DELIVERY_VOID_DIALOG_TESTID = 'delivery-void-dialog';
export const DELIVERY_VOID_GROUP_TESTID = 'delivery-void-group';
export const DELIVERY_VOID_GROUP_TOGGLE_TESTID = 'delivery-void-group-toggle';
export const DELIVERY_VOID_PRESENTATION_TESTID = 'delivery-void-presentation';
export const DELIVERY_VOID_REASON_TESTID = 'delivery-void-reason';
export const DELIVERY_VOID_EMPTY_ERROR_TESTID = 'delivery-void-empty-error';
export const DELIVERY_VOID_REASON_ERROR_TESTID = 'delivery-void-reason-error';
export const DELIVERY_VOID_REASON_TOO_LONG_TESTID = 'delivery-void-reason-too-long';
export const DELIVERY_VOID_REJECTED_TESTID = 'delivery-void-rejected';
export const DELIVERY_VOID_ERROR_TESTID = 'delivery-void-error';
export const DELIVERY_VOID_CONFIRM_TESTID = 'delivery-void-confirm';
export const DELIVERY_VOID_DISMISS_TESTID = 'delivery-void-dismiss';

/** El mismo tope que aplica el caso de uso al motivo ya recortado. */
export const DELIVERY_VOID_REASON_MAX_LENGTH = 500;

/** 16 px en todos los anchos: por debajo, Safari en iOS hace zoom al enfocar el campo. */
const FIELD_TEXT = 'text-base md:text-base';
const NOTICE_CLASS = 'rounded-lg border border-destructive/40 p-3 text-sm text-destructive';

const LABELS = {
  title: 'Anular la entrega',
  description:
    'Marca, por cliente, las presentaciones que se anulan. Sus envases vuelven a los lotes de los que salieron.',
  packages: (packages: number) => `${packages} envases`,
  groupToggle: (customerName: string) => `Anular todo lo de ${customerName}`,
  pair: (presentationName: string, customerName: string, packages: number) =>
    `${presentationName} de ${customerName} · ${packages} envases`,
  reason: 'Motivo de la anulación',
  empty: 'No hay nada que anular: marca al menos una presentación.',
  reasonRequired: 'Escribe el motivo de la anulación.',
  reasonTooLong: `El motivo no puede pasar de ${DELIVERY_VOID_REASON_MAX_LENGTH} caracteres.`,
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

type OpenPair = {
  readonly key: string;
  readonly customerId: string;
  readonly presentationLineId: string;
  readonly presentationName: string;
  readonly packages: number;
};

type OpenGroup = {
  readonly customerId: string;
  readonly customerName: string;
  readonly pairs: readonly OpenPair[];
};

function openGroups(delivery: OrderDeliveryHistoryEntry): OpenGroup[] {
  return delivery.customers
    .map((customer) => ({
      customerId: customer.customerId,
      customerName: customer.customerName,
      pairs: customer.presentations
        .filter((presentation) => presentation.void === null)
        .map((presentation) => ({
          key: `${customer.customerId}:${presentation.presentationLineId}`,
          customerId: customer.customerId,
          presentationLineId: presentation.presentationLineId,
          presentationName: presentation.presentationName,
          packages: presentation.packages,
        })),
    }))
    .filter((group) => group.pairs.length > 0);
}

export type DeliveryVoidDialogProps = {
  readonly delivery: OrderDeliveryHistoryEntry;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Vuelve a leer la lista de entregas de la que sale `delivery`. */
  readonly reload: () => void | Promise<void>;
};

export function DeliveryVoidDialog({ delivery, open, onOpenChange, reload }: DeliveryVoidDialogProps) {
  const fieldId = useId();
  return (
    <ConfirmDialogFrame open={open} onOpenChange={onOpenChange} testId={DELIVERY_VOID_DIALOG_TESTID}>
      <DeliveryVoidDialogBody
        delivery={delivery}
        onOpenChange={onOpenChange}
        reload={reload}
        fieldId={fieldId}
      />
    </ConfirmDialogFrame>
  );
}

type DeliveryVoidDialogBodyProps = Omit<DeliveryVoidDialogProps, 'open'> & {
  readonly fieldId: string;
};

/**
 * Se monta con el popup: cada apertura estrena clave de anulación, y los reintentos de esa
 * apertura reutilizan la misma para que el servidor reconozca el envío repetido.
 */
function DeliveryVoidDialogBody({ delivery, onOpenChange, reload, fieldId }: DeliveryVoidDialogBodyProps) {
  const router = useRouter();
  const reasonId = `${fieldId}-reason`;
  const reasonErrorId = `${fieldId}-reason-error`;
  const [voidKey] = useState(() => crypto.randomUUID());
  const groups = openGroups(delivery);
  const openLines = groups.flatMap((group) => group.pairs);
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());
  const [reason, setReason] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [rejected, setRejected] = useState<ErrorState | null>(null);
  const [submitError, setSubmitError] = useState<ErrorState | null>(null);
  const [isPending, startTransition] = useTransition();

  // Tras una relectura una línea marcada puede haber quedado anulada: ya no se envía.
  const selected = openLines.filter((presentation) => checked.has(presentation.key));
  const trimmedReason = reason.trim();
  const showEmpty = attempted && selected.length === 0;
  const showReasonRequired = attempted && trimmedReason === '';
  const showReasonTooLong = attempted && trimmedReason.length > DELIVERY_VOID_REASON_MAX_LENGTH;
  const reasonInvalid = showReasonRequired || showReasonTooLong;

  function toggle(id: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(group: OpenGroup) {
    setChecked((current) => {
      const next = new Set(current);
      const allChecked = group.pairs.every((pair) => current.has(pair.key));
      for (const pair of group.pairs) {
        if (allChecked) next.delete(pair.key);
        else next.add(pair.key);
      }
      return next;
    });
  }

  function confirm() {
    if (isPending) return;
    setAttempted(true);
    if (
      selected.length === 0 ||
      trimmedReason === '' ||
      trimmedReason.length > DELIVERY_VOID_REASON_MAX_LENGTH
    ) {
      return;
    }

    const input: VoidDeliveryInput = {
      deliveryId: delivery.id,
      voidKey,
      items: selected.map(({ customerId, presentationLineId }) => ({ customerId, presentationLineId })),
      reason,
    };
    startTransition(async () => {
      let result: VoidDeliveryActionResult;
      try {
        result = await voidDeliveryAction(input);
      } catch {
        result = unexpectedFromRejection();
      }

      if (result.status === 'success') {
        onOpenChange(false);
        toast.success(LABELS.voided);
        void reload();
        router.refresh();
        return;
      }

      if (result.code === REREAD_CODE) {
        setSubmitError(null);
        setRejected(result);
        await reload();
        return;
      }
      setRejected(null);
      setSubmitError(result);
    });
  }

  return (
    <ConfirmDialogBody
      onOpenChange={onOpenChange}
      variant="destructive"
      texts={{
        title: LABELS.title,
        description: LABELS.description,
        dismiss: LABELS.dismiss,
        confirm: LABELS.confirm,
        pending: LABELS.pending,
      }}
      testIds={{
        message: 'delivery-void-message',
        dismiss: DELIVERY_VOID_DISMISS_TESTID,
        confirm: DELIVERY_VOID_CONFIRM_TESTID,
        error: DELIVERY_VOID_ERROR_TESTID,
      }}
      submit={{ kind: 'transition', onConfirm: confirm }}
      isPending={isPending}
      error={submitError ?? undefined}
      aside={
        rejected === null ? null : (
          <ErrorAlert error={rejected} className={NOTICE_CLASS} testId={DELIVERY_VOID_REJECTED_TESTID} withDataCode />
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {groups.map((group) => {
            const checkedCount = group.pairs.filter((pair) => checked.has(pair.key)).length;
            const allChecked = checkedCount === group.pairs.length;
            return (
              <fieldset
                key={group.customerId}
                className="flex flex-col gap-0.5 border-t pt-2"
                data-testid={DELIVERY_VOID_GROUP_TESTID}
                data-customer-id={group.customerId}
              >
                <legend className="sr-only">{group.customerName}</legend>
                <div className="flex min-h-11 items-center gap-3">
                  <Checkbox
                    aria-label={LABELS.groupToggle(group.customerName)}
                    className={touchTarget}
                    checked={allChecked}
                    indeterminate={checkedCount > 0 && !allChecked}
                    onCheckedChange={() => toggleGroup(group)}
                    disabled={isPending}
                    data-testid={DELIVERY_VOID_GROUP_TOGGLE_TESTID}
                    data-customer-id={group.customerId}
                  />
                  <span className="text-sm font-semibold" aria-hidden="true">
                    {group.customerName}
                  </span>
                </div>
                <ul className="flex flex-col gap-0.5 pl-8">
                  {group.pairs.map((pair) => {
                    return (
                      <li key={pair.key} className="flex min-h-11 items-center gap-3">
                        <Checkbox
                          aria-label={LABELS.pair(pair.presentationName, group.customerName, pair.packages)}
                          className={touchTarget}
                          checked={checked.has(pair.key)}
                          onCheckedChange={() => toggle(pair.key)}
                          disabled={isPending}
                          data-testid={DELIVERY_VOID_PRESENTATION_TESTID}
                          data-customer-id={group.customerId}
                          data-presentation-line-id={pair.presentationLineId}
                        />
                        <span className="text-sm" aria-hidden="true">
                          {pair.presentationName}{' '}
                          <span className="text-muted-foreground">· {LABELS.packages(pair.packages)}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          })}
          {showEmpty ? (
            <p className="text-sm text-destructive" data-testid={DELIVERY_VOID_EMPTY_ERROR_TESTID}>
              {LABELS.empty}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={reasonId} className="text-sm font-medium">
            {LABELS.reason}
          </label>
          <Textarea
            id={reasonId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={FIELD_TEXT}
            disabled={isPending}
            aria-invalid={reasonInvalid ? true : undefined}
            aria-describedby={reasonInvalid ? reasonErrorId : undefined}
            data-testid={DELIVERY_VOID_REASON_TESTID}
          />
          {showReasonRequired ? (
            <p id={reasonErrorId} className="text-sm text-destructive" data-testid={DELIVERY_VOID_REASON_ERROR_TESTID}>
              {LABELS.reasonRequired}
            </p>
          ) : null}
          {showReasonTooLong ? (
            <p
              id={reasonErrorId}
              className="text-sm text-destructive"
              data-testid={DELIVERY_VOID_REASON_TOO_LONG_TESTID}
            >
              {LABELS.reasonTooLong}
            </p>
          ) : null}
        </div>
      </div>
    </ConfirmDialogBody>
  );
}
