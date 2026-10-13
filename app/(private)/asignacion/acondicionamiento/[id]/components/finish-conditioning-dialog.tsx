'use client';

import { useActionState } from 'react';

import { ConfirmDialogBody, ConfirmDialogFrame } from '@/components/shared/confirm-dialog';
import { CountdownGatedButton } from '@/components/shared/countdown-gated-button';
import {
  finishConditioningAction,
  type FinishConditioningResult,
} from '@/lib/modules/asignaciones/adapters/driving/order-conditioning-actions';

import { CONDITIONING_WAIT_SECONDS } from './conditioning-wait';

export const FINISH_CONDITIONING_DIALOG_TESTID = 'finish-conditioning-dialog';
export const FINISH_CONDITIONING_FORM_TESTID = 'finish-conditioning-form';
export const FINISH_CONDITIONING_CANCEL_TESTID = 'finish-conditioning-cancel';
export const FINISH_CONDITIONING_ERROR_TESTID = 'finish-conditioning-error';
export const FINISH_CONDITIONING_ORDER_ID_FIELD = 'orderId';

export const FINISH_CONDITIONING_TEXTS = {
  title: 'Terminar el acondicionamiento',
  description: (orderNumber: string) => `El pedido ${orderNumber} pasará a Terminado.`,
  cancel: 'Cancelar',
  confirm: 'Terminar',
} as const;

type FinishFormState = { readonly status: 'idle' } | FinishConditioningResult;

const INITIAL_STATE: FinishFormState = { status: 'idle' };
const IGNORED_PREV_STATE: FinishConditioningResult = { status: 'success' };

export type FinishConditioningDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly orderId: string;
  readonly orderNumber: string;
};

export function FinishConditioningDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
}: FinishConditioningDialogProps) {
  return (
    <ConfirmDialogFrame
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="max-h-[100dvh] overflow-y-auto"
      testId={FINISH_CONDITIONING_DIALOG_TESTID}
    >
      <FinishConditioningForm orderId={orderId} orderNumber={orderNumber} />
    </ConfirmDialogFrame>
  );
}

type FinishConditioningFormProps = {
  readonly orderId: string;
  readonly orderNumber: string;
};

// Con éxito la acción redirige fuera del detalle; aquí solo se pinta el rechazo.
function FinishConditioningForm({ orderId, orderNumber }: FinishConditioningFormProps) {
  const [state, formAction, isPending] = useActionState<FinishFormState, FormData>(
    (_previous, formData) => finishConditioningAction(IGNORED_PREV_STATE, formData),
    INITIAL_STATE,
  );

  const error = state.status === 'error' ? state : undefined;

  return (
    <ConfirmDialogBody
      texts={{
        title: FINISH_CONDITIONING_TEXTS.title,
        description: FINISH_CONDITIONING_TEXTS.description(orderNumber),
        dismiss: FINISH_CONDITIONING_TEXTS.cancel,
        confirm: FINISH_CONDITIONING_TEXTS.confirm,
      }}
      testIds={{
        form: FINISH_CONDITIONING_FORM_TESTID,
        dismiss: FINISH_CONDITIONING_CANCEL_TESTID,
        error: FINISH_CONDITIONING_ERROR_TESTID,
      }}
      submit={{
        kind: 'action',
        action: formAction,
        hidden: [{ name: FINISH_CONDITIONING_ORDER_ID_FIELD, value: orderId, controlled: true }],
        formClassName: 'flex flex-col gap-4',
      }}
      layout="form-wraps-all"
      error={error}
      errorStyle="region"
      dismissDisabled={isPending}
      confirmSlot={
        <CountdownGatedButton
          seconds={CONDITIONING_WAIT_SECONDS}
          label={FINISH_CONDITIONING_TEXTS.confirm}
          disabled={isPending}
        />
      }
    />
  );
}
