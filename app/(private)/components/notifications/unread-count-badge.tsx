'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { useNotifications } from './notifications-provider';

export const NOTIFICATIONS_LABEL = 'Notificaciones';
const MAX_SHOWN = 99;

export function formatUnreadCount(count: number): string {
  return count > MAX_SHOWN ? `${MAX_SHOWN}+` : String(count);
}

/** Nombre accesible de la campana: lleva el número exacto, que la insignia recorta. */
export function notificationsAccessibleName(count: number): string {
  return count > 0
    ? `${NOTIFICATIONS_LABEL}, ${count} sin leer`
    : `${NOTIFICATIONS_LABEL}, ninguna sin leer`;
}

const BUMP_CLASS = 'motion-safe:animate-[notification-count-bump_360ms_var(--ease-enter)_both]';

export type UnreadCountBadgeProps = {
  readonly className?: string;
};

/** Oculta con 0. Es `aria-hidden`: el número ya va en el nombre del botón. */
export function UnreadCountBadge({ className }: UnreadCountBadgeProps) {
  const { summary } = useNotifications();
  if (summary.unreadCount <= 0) return null;

  return (
    <Badge
      // La clave nueva vuelve a montar la insignia y así el pulso arranca otra vez.
      key={summary.arrivals}
      aria-hidden="true"
      data-testid="unread-count-badge"
      className={cn(
        'h-5 min-w-5 px-1.5 font-mono text-[11px] font-semibold tabular-nums',
        summary.arrivals > 0 && BUMP_CLASS,
        className,
      )}
    >
      {formatUnreadCount(summary.unreadCount)}
    </Badge>
  );
}
