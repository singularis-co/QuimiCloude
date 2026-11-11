'use client';

import { BanIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialogBody, ConfirmDialogFrame } from '@/components/shared/confirm-dialog';
import { Textarea } from '@/components/ui/textarea';
import type { ErrorCode } from '@/lib/modules/errores';
import { cancelOrderSchema, type OrderLineView, type OrderView } from '@/lib/modules/pedidos';
import {
  cancelOrderLineAction,
  type OrderMutationFormState,
} from '@/lib/modules/pedidos/adapters/driving/order-actions';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

export const CANCEL_ORDER_LINE_DIALOG_TESTID = 'cancel-order-line-dialog';
export const CANCEL_ORDER_LINE_MESSAGE_TESTID = 'cancel-order-line-message';
export const CANCEL_ORDER_LINE_REASON_TESTID = 'cancel-order-line-reason';
export const CANCEL_ORDER_LINE_CONFIRM_TESTID = 'cancel-order-line-confirm';
export const CANCEL_ORDER_LINE_DISMISS_TESTID = 'cancel-order-line-dismiss';
export const CANCEL_ORDER_LINE_ERROR_TESTID = 'cancel-order-line-error';
export const CANCEL_ORDER_LINE_FORM_TESTID = 'cancel-order-line-form';
export const CANCEL_ORDER_LINE_ID_TESTID = 'cancel-order-line-id';
export const CANCEL_ORDER_LINE_LINE_ID_TESTID = 'cancel-order-line-line-id';

/** Los nombres que lee `cancelOrderLineAction`. */
export const CANCEL_ORDER_LINE_ID_FIELD = 'id';
export const CANCEL_ORDER_LINE_LINE_ID_FIELD = 'lineId';
export const CANCEL_ORDER_LINE_REASON_FIELD = 'reason';

export type CancelOrderLineDialogTexts = {
  readonly title: string;
  readonly reasonLabel: string;
  readonly reasonHelp: string;
  readonly reasonRequired: string;
  readonly confirm: string;
  readonly pending: string;
  readonly dismiss: string;
  readonly success: string;
};

export const CANCEL_ORDER_LINE_TEXTS: CancelOrderLineDialogTexts = {
  title: 'Cancelar la receta',
  reasonLabel: 'Motivo de la cancelación',
  reasonHelp: 'Entre 1 y 500 caracteres.',
  reasonRequired: 'Escribe el motivo de la cancelación.',
  confirm: 'Cancelar la receta',
  pending: 'Cancelando…',
  dismiss: 'Volver',
  success: 'Receta cancelada. Su material quedó libre.',
};

/** 16 px en todos los anchos: por debajo, Safari en iOS amplía la página al enfocar el campo. */
const FIELD_TEXT = 'text-base md:text-base';

const INVALID_INPUT_CODE = 'invalid_input' satisfies ErrorCode;
const INITIAL_STATE: OrderMutationFormState = { status: 'idle' };

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export type CancelOrderLineDialogProps = {
  readonly order: Pick<OrderView, 'id' | 'numberText'>;
  readonly line: Pick<OrderLineView, 'id' | 'recipeName'>;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly texts?: Partial<CancelOrderLineDialogTexts>;
};

export function CancelOrderLineDialog({ open, onOpenChange, ...rest }: CancelOrderLineDialogProps) {
  const fieldId = useId();
  return (
    <ConfirmDialogFrame open={open} onOpenChange={onOpenChange} testId={CANCEL_ORDER_LINE_DIALOG_TESTID}>
      <CancelOrderLineDialogBody {...rest} onOpenChange={onOpenChange} fieldId={fieldId} />
    </ConfirmDialogFrame>
  );
}

type CancelOrderLineDialogBodyProps = Omit<CancelOrderLineDialogProps, 'open'> & {
  readonly fieldId: string;
};

// Se monta con el popup: cada apertura arranca sin el motivo ni el rechazo de la anterior.
function CancelOrderLineDialogBody({
  order,
  line,
  onOpenChange,
  fieldId,
  texts: textsOverride,
}: CancelOrderLineDialogBodyProps) {
  const texts = { ...CANCEL_ORDER_LINE_TEXTS, ...textsOverride };
  const reasonId = `${fieldId}-reason`;
  const helpId = `${fieldId}-help`;
  const errorId = `${fieldId}-error`;
  const router = useRouter();
  const [reason, setReason] = useState('');

  const [state, formAction, isPending] = useActionState(
    async (_previous: OrderMutationFormState, formData: FormData): Promise<OrderMutationFormState> => {
      const parsed = cancelOrderSchema.safeParse({
        reason: readString(formData, CANCEL_ORDER_LINE_REASON_FIELD),
      });
      if (!parsed.success) {
        return { status: 'error', code: INVALID_INPUT_CODE, message: texts.reasonRequired };
      }
      const result = await cancelOrderLineAction({ status: 'idle' }, formData);
      return result.status === 'error' ? result : { status: 'success' };
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.status !== 'success') return;
    onOpenChange(false);
    toast.success(texts.success);
    router.refresh();
  }, [state, onOpenChange, router, texts.success]);

  const error = state.status === 'error' ? state : undefined;
  const isEmpty = reason.trim() === '';

  return (
    <ConfirmDialogBody
      onOpenChange={onOpenChange}
      variant="destructive"
      icon={{ glyph: BanIcon, tone: 'danger' }}
      texts={{
        title: texts.title,
        description: (
          <>
            Se va a cancelar <span className="font-semibold">{line.recipeName ?? EMPTY_MARK}</span>{' '}
            del pedido <span className="font-mono">{order.numberText}</span> y se libera su material.
            Las demás recetas siguen igual.
          </>
        ),
        dismiss: texts.dismiss,
        confirm: texts.confirm,
        pending: texts.pending,
      }}
      testIds={{
        message: CANCEL_ORDER_LINE_MESSAGE_TESTID,
        dismiss: CANCEL_ORDER_LINE_DISMISS_TESTID,
        confirm: CANCEL_ORDER_LINE_CONFIRM_TESTID,
        form: CANCEL_ORDER_LINE_FORM_TESTID,
        error: CANCEL_ORDER_LINE_ERROR_TESTID,
        errorMessage: 'cancel-order-line-error-message',
      }}
      submit={{
        kind: 'action',
        action: formAction,
        hidden: [
          { name: CANCEL_ORDER_LINE_ID_FIELD, value: order.id, testId: CANCEL_ORDER_LINE_ID_TESTID },
          {
            name: CANCEL_ORDER_LINE_LINE_ID_FIELD,
            value: line.id,
            testId: CANCEL_ORDER_LINE_LINE_ID_TESTID,
          },
        ],
        formClassName: 'flex flex-col gap-3',
      }}
      layout="error-in-form"
      isPending={isPending}
      confirmDisabled={isEmpty}
      error={error}
      errorId={errorId}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor={reasonId} className="text-sm font-medium">
          {texts.reasonLabel}
        </label>
        <Textarea
          id={reasonId}
          name={CANCEL_ORDER_LINE_REASON_FIELD}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={FIELD_TEXT}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={error === undefined ? helpId : `${helpId} ${errorId}`}
          data-testid={CANCEL_ORDER_LINE_REASON_TESTID}
        />
        <span id={helpId} className="text-xs text-muted-foreground">
          {texts.reasonHelp}
        </span>
      </div>
    </ConfirmDialogBody>
  );
}
