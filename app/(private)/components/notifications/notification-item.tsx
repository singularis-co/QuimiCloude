'use client';

import { ArrowRightIcon, FileCheckIcon, FileExclamationPointIcon, FileXIcon, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import type { NotificationView } from '@/lib/modules/notificaciones/adapters/driving/notification-actions';

import { formatClock, formatRelativeTime } from './relative-time';

export const UNREAD_LABEL = 'Sin leer';

const TONES: Record<NotificationView['tone'], { readonly icon: LucideIcon; readonly box: string }> = {
  success: { icon: FileCheckIcon, box: 'bg-success-subtle text-success-text' },
  warning: { icon: FileExclamationPointIcon, box: 'bg-warning-subtle text-warning-text' },
  danger: { icon: FileXIcon, box: 'bg-destructive-subtle text-destructive-text' },
};

export type NotificationEntrance = 'arrive' | 'fade';

const ENTRANCE: Record<NotificationEntrance, string> = {
  arrive:
    'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-(--dur-slow) motion-safe:ease-(--ease-enter)',
  fade: 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-(--dur-slow) motion-safe:ease-(--ease-enter)',
};

const HOUR_MARK = '{hora}';

/**
 * El cuerpo viaja con la marca de la hora sin sustituir para pintarla en la zona del navegador.
 * Sin hora que poner, la marca se quita con su « a las ».
 */
export function renderNotificationBody(body: string, bodyTime: string | null, timeZone?: string): string {
  if (!body.includes(HOUR_MARK)) return body;
  if (bodyTime === null) return body.replaceAll(` a las ${HOUR_MARK}`, '').replaceAll(HOUR_MARK, '');
  return body.replaceAll(HOUR_MARK, formatClock(bodyTime, timeZone));
}

export type NotificationItemProps = {
  readonly notification: NotificationView;
  /** Referencia para la hora relativa; se pasa para que el render no lea el reloj. */
  readonly now: number;
  readonly onSelect: (notification: NotificationView) => void;
  readonly entrance?: NotificationEntrance;
  /** Solo para fijar la zona en pruebas; por defecto, la del navegador. */
  readonly timeZone?: string;
  readonly className?: string;
};

export function NotificationItem({
  notification,
  now,
  onSelect,
  entrance,
  timeZone,
  className,
}: NotificationItemProps) {
  const { title, href, linkLabel, read, tone } = notification;
  const body = renderNotificationBody(notification.body, notification.bodyTime, timeZone);
  const when = formatRelativeTime(notification.createdAt, now, timeZone);
  const label = `${title}. ${body} ${when}${read ? '' : `. ${UNREAD_LABEL}`}`;
  const Icon = TONES[tone].icon;

  const rowClass = cn(
    'grid min-h-11 w-full grid-cols-[36px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-b px-4 py-3.5 text-left text-foreground transition-colors sm:grid-cols-[36px_minmax(0,1fr)_auto]',
    'hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
    !read && 'bg-primary/7',
    entrance !== undefined && ENTRANCE[entrance],
    className,
  );

  const content = (
    <>
      <span
        aria-hidden="true"
        data-tone={tone}
        className={cn('flex size-9 items-center justify-center rounded-[10px]', TONES[tone].box)}
      >
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className={cn('block text-sm', read ? 'font-medium' : 'font-semibold')}>{title}</span>
        <span className="mt-0.5 block text-[13px] leading-[1.45] text-muted-foreground">{body}</span>
        {href !== null && (
          <span className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-medium text-primary">
            {linkLabel}
            <ArrowRightIcon aria-hidden="true" className="size-3.5" />
          </span>
        )}
      </span>
      <span className="col-start-2 flex items-center justify-between gap-2 font-mono text-xs whitespace-nowrap text-muted-foreground sm:col-start-3 sm:flex-col sm:items-end">
        <span>{when}</span>
        {!read && <span data-slot="unread-dot" className="size-[9px] rounded-full bg-primary" />}
      </span>
    </>
  );

  const select = () => onSelect(notification);

  if (href === null) {
    return (
      <button type="button" aria-label={label} data-read={read} className={rowClass} onClick={select}>
        {content}
      </button>
    );
  }

  return (
    <Link href={href} aria-label={label} data-read={read} className={rowClass} onClick={select}>
      {content}
    </Link>
  );
}
