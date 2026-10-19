'use client';

import { BellIcon, CircleAlertIcon } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import type { NotificationView } from '@/lib/modules/notificaciones/adapters/driving/notification-actions';
import { cn } from '@/lib/utils';

import { NotificationItem, type NotificationEntrance } from './notification-item';
import { NotificationListTail } from './notification-list-tail';
import type { NotificationListState } from './notification-list-state';
import { useNotifications } from './notifications-provider';
import { NOTIFICATIONS_LABEL, notificationsAccessibleName, UnreadCountBadge } from './unread-count-badge';

export const NOTIFICATION_BELL_TEXTS = {
  title: NOTIFICATIONS_LABEL,
  markAll: 'Marcar todas como leídas',
  loading: 'Cargando notificaciones',
  empty: 'No tienes notificaciones.',
  firstError: 'No se pudieron cargar las notificaciones.',
  retry: 'Reintentar',
} as const;

const SKELETON_ROWS = 5;

/** En el teléfono el panel se ancla a la cabecera y no a la campana: 8 px por lado y 16 abajo. */
export const PHONE_PANEL_COLLISION_PADDING = { top: 8, right: 8, bottom: 16, left: 8 } as const;
export const PHONE_PANEL_WIDTH_CLASS = 'w-[calc(100vw-16px)]';
const PANEL_SIDE_OFFSET = 8;

function entranceOf(list: NotificationListState, id: string): NotificationEntrance | undefined {
  if (list.freshIds.includes(id)) return 'arrive';
  if (list.moreIds.includes(id)) return 'fade';
  return undefined;
}

function SkeletonRows({ label }: { readonly label: string }) {
  return (
    <div role="status" aria-label={label} data-testid="notification-skeletons">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 border-b px-4 py-3.5">
          <Skeleton className="size-9 rounded-[10px]" />
          <span className="flex flex-col gap-2 pt-1">
            <Skeleton className="h-3 w-[70%]" />
            <Skeleton className="h-3 w-[90%]" />
          </span>
        </div>
      ))}
    </div>
  );
}

const STATE_BOX_CLASS = 'flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center';

export type NotificationBellProps = {
  readonly texts?: typeof NOTIFICATION_BELL_TEXTS;
};

/** Campana de la cabecera con el panel de avisos. Necesita un `NotificationsProvider` encima. */
export function NotificationBell({ texts = NOTIFICATION_BELL_TEXTS }: NotificationBellProps) {
  const { summary, list, open, loadMore, retryFirst, retryMore, markRead, markAllRead } =
    useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(0);
  // En estado y no en un ref: el centinela no puede observar hasta que el área existe.
  const [scrollArea, setScrollArea] = useState<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const phone = useIsMobile();

  const headerAnchor = useCallback(() => triggerRef.current?.closest('header') ?? null, []);

  const onOpenChange = (next: boolean) => {
    setIsOpen(next);
    if (!next) return;
    setOpenedAt(Date.now());
    open();
  };

  const onSelect = (notification: NotificationView) => {
    setIsOpen(false);
    void markRead(notification.id);
  };

  const now = Math.max(summary.checkedAt ?? 0, openedAt);
  const unread = summary.unreadCount;

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  ref={triggerRef}
                  variant="outline"
                  className="relative size-11"
                  aria-label={notificationsAccessibleName(unread)}
                  data-testid="notification-bell"
                />
              }
            />
          }
        >
          <BellIcon aria-hidden="true" />
          <UnreadCountBadge className="absolute -top-1.5 -right-1.5 shadow-[0_0_0_2px_var(--background)]" />
        </TooltipTrigger>
        <TooltipContent side="bottom">{texts.title}</TooltipContent>
      </Tooltip>
      <PopoverContent
        aria-label={texts.title}
        data-testid="notification-panel"
        align="end"
        sideOffset={PANEL_SIDE_OFFSET}
        anchor={phone ? headerAnchor : undefined}
        collisionPadding={phone ? PHONE_PANEL_COLLISION_PADDING : undefined}
        positionerClassName={phone ? PHONE_PANEL_WIDTH_CLASS : undefined}
        className={cn(
          'gap-0 overflow-hidden p-0',
          phone ? 'max-h-(--available-height) w-full' : 'w-[400px]',
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 pt-3.5 pb-2.5">
          <PopoverTitle className="text-base font-semibold">{texts.title}</PopoverTitle>
          {unread > 0 && (
            <Button variant="link" size="sm" touch onClick={() => void markAllRead()}>
              {texts.markAll}
            </Button>
          )}
        </div>
        <div
          ref={setScrollArea}
          data-testid="notification-scroll-area"
          className={cn(
            'flex flex-col overflow-y-auto overscroll-contain',
            phone ? 'min-h-0 flex-1' : 'h-[520px]',
          )}
        >
          {(list.status === 'idle' || list.status === 'loading') && <SkeletonRows label={texts.loading} />}
          {list.status === 'error' && (
            <div role="alert" className="flex flex-1 flex-col">
              <EmptyState
                testId="notification-first-error"
                message={texts.firstError}
                icon={{ node: <CircleAlertIcon /> }}
                className={STATE_BOX_CLASS}
              >
                <Button variant="outline" touch onClick={retryFirst}>
                  {texts.retry}
                </Button>
              </EmptyState>
            </div>
          )}
          {list.status === 'ready' && list.items.length === 0 && (
            <EmptyState
              testId="notification-empty"
              message={texts.empty}
              icon={{ node: <BellIcon /> }}
              className={STATE_BOX_CLASS}
            />
          )}
          {list.status === 'ready' && list.items.length > 0 && (
            <>
              <div className="flex flex-col">
                {list.items.map((item) => (
                  <NotificationItem
                    key={item.id}
                    notification={item}
                    now={now}
                    onSelect={onSelect}
                    entrance={entranceOf(list, item.id)}
                  />
                ))}
              </div>
              <NotificationListTail
                tail={list.tail}
                root={scrollArea}
                onLoadMore={loadMore}
                onRetry={retryMore}
              />
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
