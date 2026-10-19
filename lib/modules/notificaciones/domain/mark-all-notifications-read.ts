import type { NotificationInbox } from '../ports/notification-inbox';

import { inboxScopeOf, type Actor } from './actor';

export type MarkAllNotificationsReadDeps = {
  readonly inbox: Pick<NotificationInbox, 'markAllRead'>;
  readonly now: () => Date;
};

/** Todos los vigentes no leídos del actor, estén o no cargados en el panel. */
export function createMarkAllNotificationsRead(deps: MarkAllNotificationsReadDeps) {
  return async function markAllNotificationsRead(
    actor: Actor,
  ): Promise<{ readonly marked: number }> {
    const marked = await deps.inbox.markAllRead(inboxScopeOf(actor, deps.now()));
    return { marked };
  };
}
