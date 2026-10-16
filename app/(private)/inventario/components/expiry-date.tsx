'use client';

import { useSyncExternalStore } from 'react';

import { StatusBadge } from '@/components/shared/status-badge';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import { formatDateLocalISO } from '@/lib/shared/ui/date-civil';
import { cn } from '@/lib/utils';

import { expiryRelativeLabel, isExpired } from './expiry-warning';

/** Clase del aviso de vencimiento cercano: la comparten el nombre del producto y la fecha. */
export const EXPIRING_CLASS = 'font-semibold text-destructive';

const subscribeToNothing = () => () => {};
const localToday = () => formatDateLocalISO(new Date());
// En el servidor no hay «hoy» del usuario: sin el, nada se marca y se pinta tras hidratar.
const noTodayOnServer = () => null;

/** «Hoy» del usuario como `YYYY-MM-DD`; `null` en el servidor para no romper la hidratacion. */
export function useLocalToday(): string | null {
  return useSyncExternalStore(subscribeToNothing, localToday, noTodayOnServer);
}

export type ExpiryDateProps = {
  /** Vencimiento `YYYY-MM-DD`; sin el se pinta `EMPTY_MARK` y nada mas. */
  readonly date: string | null;
  /** Vence a menos de `EXPIRY_WARNING_DAYS` (o ya vencio): la fecha va en rojo. */
  readonly expiring: boolean;
  /** Dias hasta el vencimiento (`daysUntil`); `null` sin «hoy» (servidor): sin relativo ni chip. */
  readonly daysToExpiry: number | null;
  /** Texto del chip de lote vencido. */
  readonly expiredLabel: string;
  readonly testIds: {
    readonly date: string;
    readonly relative: string;
    readonly expired: string;
  };
  readonly className?: string;
};

/**
 * Valor `<dd>` de un vencimiento: la fecha, sus dias relativos con el mismo color y, si ya
 * vencio, el chip «Vencido». Lo comparten la sub-fila de lote de la tabla y el panel de lotes.
 */
export function ExpiryDate({
  date,
  expiring,
  daysToExpiry,
  expiredLabel,
  testIds,
  className,
}: ExpiryDateProps) {
  const known = date !== null && daysToExpiry !== null;
  const expired = known && isExpired(daysToExpiry);
  return (
    <dd
      data-testid={testIds.date}
      data-expiring={expiring ? 'true' : undefined}
      data-expired={expired ? 'true' : undefined}
      className={cn('font-mono tabular-nums', className, expiring && EXPIRING_CLASS)}
    >
      {date ?? EMPTY_MARK}
      {known ? (
        <span data-testid={testIds.relative} className="font-sans">
          {` (${expiryRelativeLabel(daysToExpiry)})`}
        </span>
      ) : null}
      {expired ? (
        <StatusBadge
          tone="danger"
          label={expiredLabel}
          data-testid={testIds.expired}
          className="ml-2 align-middle font-sans"
        />
      ) : null}
    </dd>
  );
}
