import type { NotificationInbox } from '../ports/notification-inbox';

import { inboxScopeOf, NOTIFICATIONS_READ_PERMISSION, requirePermission, type Actor } from './actor';

export type MarkAllNotificationsReadDeps = {
  readonly inbox: Pick<NotificationInbox, 'markAllRead'>;
  readonly now: () => Date;
};

/** Todos los vigentes no leídos del actor, estén o no cargados en el panel. */
export function createMarkAllNotificationsRead(deps: MarkAllNotificationsReadDeps) {
  return async function markAllNotificationsRead(
    actor: Actor | null | undefined,
  ): Promise<{ readonly marked: number }> {
    requirePermission(actor, NOTIFICATIONS_READ_PERMISSION);
    const marked = await deps.inbox.markAllRead(inboxScopeOf(actor, deps.now()));
    return { marked };
  };
}
