import { z } from 'zod';

import type { NotificationInbox } from '../ports/notification-inbox';

import { inboxScopeOf, NOTIFICATIONS_READ_PERMISSION, requirePermission, type Actor } from './actor';
import { ValidationError } from './errors';

export const notificationIdSchema = z.uuid();

export type MarkNotificationReadDeps = {
  readonly inbox: Pick<NotificationInbox, 'markRead'>;
  readonly now: () => Date;
};

/** Uno ajeno y uno inexistente dan lo mismo, `not_found`, y ninguno escribe nada. */
export type MarkNotificationReadOutcome = 'marked' | 'not_found';

export function createMarkNotificationRead(deps: MarkNotificationReadDeps) {
  return async function markNotificationRead(
    actor: Actor | null | undefined,
    notificationId: unknown,
  ): Promise<MarkNotificationReadOutcome> {
    requirePermission(actor, NOTIFICATIONS_READ_PERMISSION);
    const parsed = notificationIdSchema.safeParse(notificationId);
    if (!parsed.success) throw new ValidationError('markNotificationRead: id no es uuid');

    const found = await deps.inbox.markRead(inboxScopeOf(actor, deps.now()), parsed.data);
    return found ? 'marked' : 'not_found';
  };
}
