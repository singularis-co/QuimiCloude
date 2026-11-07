import type { ReactNode } from 'react';

import type { OrderSummary } from '@/lib/modules/pedidos';
import { cn } from '@/lib/utils';

export const ORDER_PROGRESS_TESTID = 'order-progress';
export const ORDER_PROGRESS_BAR_TESTID = 'order-progress-bar';

type OrderProgressValue = OrderSummary['progress'];

export type OrderProgressTexts = {
  readonly short: (finished: number, total: number) => string;
  readonly long: (finished: number, total: number) => string;
};

export const ORDER_PROGRESS_TEXTS: OrderProgressTexts = {
  short: (finished, total) => `${finished} de ${total}`,
  long: (finished, total) => `${finished} de ${total} terminadas`,
};

export type OrderProgressProps = {
  readonly progress: OrderProgressValue;
  /** `short` para la celda y la tarjeta; `long` para el detalle. */
  readonly variant?: 'short' | 'long';
  /** Rótulo a la izquierda del texto, solo en la forma larga. */
  readonly label?: ReactNode;
  readonly texts?: OrderProgressTexts;
  readonly className?: string;
};

function percentOf({ finished, total }: OrderProgressValue): number {
  return total === 0 ? 0 : Math.round((100 * finished) / total);
}

/** Avance «F de T» de las recetas activas de un pedido, con su barra. */
export function OrderProgress({
  progress,
  variant = 'short',
  label,
  texts = ORDER_PROGRESS_TEXTS,
  className,
}: OrderProgressProps) {
  const { finished, total } = progress;
  const text = variant === 'long' ? texts.long(finished, total) : texts.short(finished, total);
  const percent = percentOf(progress);

  return (
    <span
      role="img"
      aria-label={texts.long(finished, total)}
      data-testid={ORDER_PROGRESS_TESTID}
      data-variant={variant}
      data-finished={finished}
      data-total={total}
      className={cn(
        'flex flex-col',
        variant === 'long' ? 'w-full gap-1.5' : 'min-w-21 gap-1',
        className,
      )}
    >
      <span
        className={cn(
          'flex items-baseline gap-3',
          variant === 'long' && label !== undefined ? 'justify-between' : undefined,
        )}
      >
        {variant === 'long' && label !== undefined ? (
          <span className="text-sm font-medium">{label}</span>
        ) : null}
        <span className="font-mono text-[13px] tabular-nums">{text}</span>
      </span>
      <span aria-hidden="true" className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <span
          data-testid={ORDER_PROGRESS_BAR_TESTID}
          className="block h-full rounded-full bg-primary transition-[width] duration-(--dur-slow) ease-(--ease-standard)"
          style={{ width: `${percent}%` }}
        />
      </span>
    </span>
  );
}
