'use client';

import { useActionState, useId, useState, type ReactNode } from 'react';

import { ConfirmDialogBody, ConfirmDialogFrame } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  cancelAssignedOrderAction,
  type CancelAssignedOrderResult,
} from '@/lib/modules/asignaciones/adapters/driving/order-execution-actions';
import type { ErrorCode } from '@/lib/modules/errores';
import { cancelOrderSchema } from '@/lib/modules/pedidos';

/**
 * Cancela la receta desde su ejecucion pidiendo antes el motivo; las demas recetas del pedido
 * siguen. La accion redirige a la lista cuando sale bien, asi que aqui solo se pinta el rechazo.
 */

export const ORDER_CANCEL_TRIGGER_TESTID = 'order-cancel-trigger';
export const ORDER_CANCEL_DIALOG_TESTID = 'order-cancel-dialog';
export const ORDER_CANCEL_FORM_TESTID = 'order-cancel-form';
export const ORDER_CANCEL_REASON_TESTID = 'order-cancel-reason';
export const ORDER_CANCEL_CONFIRM_TESTID = 'order-cancel-confirm';
export const ORDER_CANCEL_DISMISS_TESTID = 'order-cancel-dismiss';
export const ORDER_CANCEL_ERROR_TESTID = 'order-cancel-error';

export const ORDER_CANCEL_ORDER_ID_FIELD = 'orderId';
export const ORDER_CANCEL_LINE_ID_FIELD = 'lineId';
export const ORDER_CANCEL_STEP_POSITION_FIELD = 'stepPosition';
export const ORDER_CANCEL_REASON_FIELD = 'reason';

export const ORDER_CANCEL_TEXTS = {
  trigger: 'Cancelar esta receta',
  title: 'Cancelar esta receta',
  reasonLabel: 'Motivo de la cancelación',
  reasonHelp: 'Entre 1 y 500 caracteres.',
  reasonRequired: 'Escribe el motivo de la cancelación.',
  confirm: 'Cancelar la receta',
  dismiss: 'Volver',
} as const;

/** Sin nombre, la receta está dada de baja: se nombra solo el pedido. */
export function orderCancelDescription(recipeName: string | null, numberText: string): ReactNode {
  return (
    <>
      {recipeName === null ? (
        'Se cancela esta receta'
      ) : (
        <>
          Se cancela <span className="font-medium text-foreground">{recipeName}</span>
        </>
      )}{' '}
      del pedido <span className="font-mono">{numberText}</span> y se libera su material. Las demás
      recetas del pedido siguen.
    </>
  );
}

// Por debajo de 16 px Safari en iOS hace zoom al enfocar el campo.
const FIELD_TEXT = 'text-base md:text-base';

// Sin `reference`: es un rechazo del propio formulario, no del servidor.
const INVALID_INPUT_CODE = 'invalid_input' satisfies ErrorCode;

type CancelFormState = { readonly status: 'idle' } | CancelAssignedOrderResult;

const INITIAL_STATE: CancelFormState = { status: 'idle' };
const IGNORED_PREV_STATE: CancelAssignedOrderResult = { status: 'success' };

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

type OrderCancelFormProps = {
  readonly orderId: string;
  readonly lineId: string;
  readonly stepPosition: number | null;
  readonly recipeName: string | null;
  readonly numberText: string;
};

export type OrderCancelDialogProps = OrderCancelFormProps & {
  /** Con `open` y `onOpenChange` la apertura la decide quien lo usa y no se pinta disparador. */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
};

export function OrderCancelDialog({
  orderId,
  lineId,
  stepPosition,
  recipeName,
  numberText,
  open,
  onOpenChange,
}: OrderCancelDialogProps) {
  const controlled = open !== undefined && onOpenChange !== undefined;

  return (
    <ConfirmDialogFrame
      open={controlled ? open : undefined}
      onOpenChange={controlled ? onOpenChange : undefined}
      trigger={
        controlled
          ? undefined
          : {
              render: (
                <Button
                  type="button"
                  variant="outline"
                  touch
                  data-testid={ORDER_CANCEL_TRIGGER_TESTID}
                />
              ),
              children: ORDER_CANCEL_TEXTS.trigger,
            }
      }
      testId={ORDER_CANCEL_DIALOG_TESTID}
    >
      {/* El popup se desmonta al cerrar: cada apertura empieza sin motivo ni error previos. */}
      <OrderCancelForm
        orderId={orderId}
        lineId={lineId}
        stepPosition={stepPosition}
        recipeName={recipeName}
        numberText={numberText}
      />
    </ConfirmDialogFrame>
  );
}

function OrderCancelForm({
  orderId,
  lineId,
  stepPosition,
  recipeName,
  numberText,
}: OrderCancelFormProps) {
  const fieldId = useId();
  const reasonId = `${fieldId}-reason`;
  const helpId = `${fieldId}-help`;
  const errorId = `${fieldId}-error`;
  const [reason, setReason] = useState('');

  const [state, formAction, isPending] = useActionState<CancelFormState, FormData>(
    async (_previous, formData) => {
      const parsed = cancelOrderSchema.safeParse({
        reason: readString(formData, ORDER_CANCEL_REASON_FIELD),
      });
      if (!parsed.success) {
        return {
          status: 'error',
          code: INVALID_INPUT_CODE,
          message: ORDER_CANCEL_TEXTS.reasonRequired,
        };
      }
      formData.set(ORDER_CANCEL_REASON_FIELD, parsed.data.reason);
      return cancelAssignedOrderAction(IGNORED_PREV_STATE, formData);
    },
    INITIAL_STATE,
  );

  const error = state.status === 'error' ? state : undefined;

  return (
    <ConfirmDialogBody
      texts={{
        title: ORDER_CANCEL_TEXTS.title,
        description: orderCancelDescription(recipeName, numberText),
        dismiss: ORDER_CANCEL_TEXTS.dismiss,
        confirm: ORDER_CANCEL_TEXTS.confirm,
      }}
      testIds={{
        form: ORDER_CANCEL_FORM_TESTID,
        dismiss: ORDER_CANCEL_DISMISS_TESTID,
        confirm: ORDER_CANCEL_CONFIRM_TESTID,
        error: ORDER_CANCEL_ERROR_TESTID,
      }}
      variant="destructive"
      layout="form-wraps-all"
      confirmAs="button"
      submit={{
        kind: 'action',
        action: formAction,
        formClassName: 'flex flex-col gap-4',
        hidden: [
          { name: ORDER_CANCEL_ORDER_ID_FIELD, value: orderId, controlled: true },
          { name: ORDER_CANCEL_LINE_ID_FIELD, value: lineId, controlled: true },
          {
            name: ORDER_CANCEL_STEP_POSITION_FIELD,
            value: stepPosition === null ? '' : String(stepPosition),
            controlled: true,
          },
        ],
      }}
      isPending={isPending}
      dismissDisabled={isPending}
      error={error}
      errorId={errorId}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor={reasonId} className="text-sm font-medium">
          {ORDER_CANCEL_TEXTS.reasonLabel}
        </label>
        <Textarea
          id={reasonId}
          name={ORDER_CANCEL_REASON_FIELD}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={FIELD_TEXT}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={error === undefined ? helpId : `${helpId} ${errorId}`}
          data-testid={ORDER_CANCEL_REASON_TESTID}
        />
        <span id={helpId} className="text-xs text-muted-foreground">
          {ORDER_CANCEL_TEXTS.reasonHelp}
        </span>
      </div>
    </ConfirmDialogBody>
  );
}
