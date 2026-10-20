'use client';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { formatDecimalDisplay } from '@/lib/shared/ui/decimal-display';
import type { OrderDistributionAvailability } from './use-order-distribution-availability';

export const ORDER_LEFTOVER_DIALOG_TESTID = 'order-leftover-dialog';
export const ORDER_LEFTOVER_MESSAGE_TESTID = 'order-leftover-message';
export const ORDER_LEFTOVER_CONFIRM_TESTID = 'order-leftover-confirm';
export const ORDER_LEFTOVER_DISMISS_TESTID = 'order-leftover-dismiss';

const DEFAULT_TITLE = 'Queda sobrante';
const DEFAULT_CONFIRM_LABEL = 'Guardar con sobrante';
const DEFAULT_DISMISS_LABEL = 'Volver al reparto';

/** El copy por defecto: la cantidad ya formateada y, si se conoce, su unidad. */
function defaultMessage(amount: string, unitLabel: string | null): string {
  const quantity = unitLabel === null ? amount : `${amount} ${unitLabel}`;
  return `Queda sobrante: ${quantity} sin envasar. ¿Guardar el pedido igualmente?`;
}

/**
 * Lo que el reparto deja sin envasar, en la unidad del pedido, o `null` si no queda nada o
 * todavia no se sabe. Solo cuenta un disponible cotizado (`ready` + `ok`): cotizando, sin unidad
 * o con error no se avisa, y el guardado sigue como siempre.
 *
 * Sin coma flotante: el disponible es un decimal en texto y basta con mirar su signo y si tiene
 * algun digito distinto de cero.
 */
export function leftoverOf(availability: OrderDistributionAvailability): string | null {
  if (availability.status !== 'ready' || availability.data.kind !== 'ok') return null;
  const { available } = availability.data;
  return !available.startsWith('-') && /[1-9]/.test(available) ? available : null;
}

export type OrderLeftoverDialogProps = {
  readonly open: boolean;
  /** El sobrante sin formatear, tal como lo devuelve `leftoverOf`. */
  readonly leftover: string;
  readonly unitLabel: string | null;
  readonly onConfirm: () => void;
  readonly onDismiss: () => void;
  readonly title?: string;
  /** Sustituye al mensaje por defecto; recibe la cantidad ya formateada. */
  readonly message?: (amount: string, unitLabel: string | null) => string;
  readonly confirmLabel?: string;
  readonly dismissLabel?: string;
};

/** Aviso previo al guardado cuando el reparto en envases no cubre toda la cantidad del pedido. */
export function OrderLeftoverDialog({
  open,
  leftover,
  unitLabel,
  onConfirm,
  onDismiss,
  title = DEFAULT_TITLE,
  message = defaultMessage,
  confirmLabel = DEFAULT_CONFIRM_LABEL,
  dismissLabel = DEFAULT_DISMISS_LABEL,
}: OrderLeftoverDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
      texts={{
        title,
        description: message(formatDecimalDisplay(leftover), unitLabel),
        dismiss: dismissLabel,
        confirm: confirmLabel,
      }}
      onConfirm={onConfirm}
      testIds={{
        dialog: ORDER_LEFTOVER_DIALOG_TESTID,
        message: ORDER_LEFTOVER_MESSAGE_TESTID,
        dismiss: ORDER_LEFTOVER_DISMISS_TESTID,
        confirm: ORDER_LEFTOVER_CONFIRM_TESTID,
      }}
    />
  );
}
