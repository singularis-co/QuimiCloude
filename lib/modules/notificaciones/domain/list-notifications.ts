import type { InboxItem, NotificationInbox } from '../ports/notification-inbox';

import { inboxScopeOf, NOTIFICATIONS_READ_PERMISSION, requirePermission, type Actor } from './actor';
import { ValidationError } from './errors';
import {
  decodeNotificationCursor,
  encodeNotificationCursor,
  listNotificationsInputSchema,
} from './notification-cursor';

export type ListNotificationsDeps = {
  readonly inbox: Pick<NotificationInbox, 'listBatch'>;
  readonly now: () => Date;
};

export type NotificationItem = InboxItem;

export type NotificationBatch = {
  readonly items: readonly NotificationItem[];
  /** `null` cuando no quedan más avisos vigentes. */
  readonly nextCursor: string | null;
};

/**
 * Un lote del más reciente al más antiguo. El cursor solo fija el punto de corte: cada lote vuelve
 * a aplicar qué avisos ve el actor.
 */
export function createListNotifications(deps: ListNotificationsDeps) {
  return async function listNotifications(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<NotificationBatch> {
    requirePermission(actor, NOTIFICATIONS_READ_PERMISSION);
    const parsed = listNotificationsInputSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError('listNotifications: entrada no valida');
    const after = parsed.data.cursor === null ? null : decodeNotificationCursor(parsed.data.cursor);

    const batch = await deps.inbox.listBatch(inboxScopeOf(actor, deps.now()), after);
    return {
      items: batch.items,
      nextCursor: batch.next === null ? null : encodeNotificationCursor(batch.next),
    };
  };
}
