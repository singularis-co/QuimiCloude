'use client';

import { useId } from 'react';

import { OrderDistributionLabel } from '@/components/shared/order-distribution-label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { OrderLineView, OrderView } from '@/lib/modules/pedidos';
import { trimDecimal } from '@/lib/shared/ui/decimal-display';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import { cn } from '@/lib/utils';

import { lineActionDisabledReason, type LineActionKind } from './order-line-actions';
import { OrderStatusBadge } from './order-status-badge';

export const ORDER_LINE_PICKER_DIALOG_TESTID = 'order-line-picker-dialog';
export const ORDER_LINE_PICKER_OPTION_TESTID = 'order-line-picker-option';
export const ORDER_LINE_PICKER_REASON_TESTID = 'order-line-picker-reason';

export type OrderLinePickerTexts = {
  readonly title: string;
  readonly help: string;
};

export const ORDER_LINE_PICKER_TEXTS: Readonly<Record<LineActionKind, OrderLinePickerTexts>> = {
  distribution: {
    title: 'Reparto y unidad',
    help: 'Solo las recetas Por empacar admiten cambiar el reparto y la unidad.',
  },
  deliver: {
    title: 'Entregar',
    help: 'Se entrega lo de las recetas terminadas, aunque el pedido siga Parcial.',
  },
  deliveries: { title: 'Entregas', help: 'Ver o anular las entregas de una receta.' },
  cancelLine: {
    title: 'Cancelar receta',
    help: 'Se puede cancelar una receta Pendiente, En fabricación o Bloqueada.',
  },
};

const DESCRIPTION = (numberText: string) => `Pedido ${numberText}. Elige la receta.`;
const LIST_LABEL = 'Recetas del pedido';
const QUANTITY_SEPARATOR = ' · ';

export type OrderLinePickerDialogProps = {
  readonly order: Pick<OrderView, 'numberText' | 'lines'>;
  readonly action: LineActionKind;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Solo con una receta que admite la acción. */
  readonly onPick: (lineId: string) => void;
  readonly texts?: Partial<OrderLinePickerTexts>;
};

export function OrderLinePickerDialog({
  order,
  action,
  open,
  onOpenChange,
  onPick,
  texts,
}: OrderLinePickerDialogProps) {
  const helpId = useId();
  const { title, help } = { ...ORDER_LINE_PICKER_TEXTS[action], ...texts };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={ORDER_LINE_PICKER_DIALOG_TESTID} data-action={action}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{DESCRIPTION(order.numberText)}</DialogDescription>
        </DialogHeader>
        <ul aria-label={LIST_LABEL} aria-describedby={helpId} className="flex flex-col gap-1">
          {order.lines.map((line) => (
            <li key={line.id}>
              <OrderLineOption
                line={line}
                reason={lineActionDisabledReason(action, line)}
                onPick={onPick}
              />
            </li>
          ))}
        </ul>
        <p id={helpId} className="text-xs text-muted-foreground">
          {help}
        </p>
      </DialogContent>
    </Dialog>
  );
}

type OrderLineOptionProps = {
  readonly line: OrderLineView;
  readonly reason: string | null;
  readonly onPick: (lineId: string) => void;
};

// `aria-disabled` y no `disabled`: la opción sigue enfocable y el lector de pantalla lee su motivo.
function OrderLineOption({ line, reason, onPick }: OrderLineOptionProps) {
  const disabled = reason !== null;
  return (
    <button
      type="button"
      aria-disabled={disabled ? true : undefined}
      onClick={() => {
        if (!disabled) onPick(line.id);
      }}
      data-testid={ORDER_LINE_PICKER_OPTION_TESTID}
      data-line-id={line.id}
      className={cn(
        'flex min-h-13 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm outline-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'cursor-pointer hover:bg-accent focus-visible:bg-accent active:bg-accent',
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">{line.recipeName ?? EMPTY_MARK}</span>
        <span className="text-xs text-muted-foreground">
          {trimDecimal(line.quantity)}
          {line.unitLabel === null ? '' : ` ${line.unitLabel}`}
          {QUANTITY_SEPARATOR}
          <OrderDistributionLabel lines={line.presentationLines} />
        </span>
        {reason === null ? null : (
          <span className="text-xs text-muted-foreground" data-testid={ORDER_LINE_PICKER_REASON_TESTID}>
            {reason}
          </span>
        )}
      </span>
      <OrderStatusBadge status={line.status} />
    </button>
  );
}
