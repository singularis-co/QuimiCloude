import { z } from 'zod';

import type { NotificationInbox } from '../ports/notification-inbox';

import { inboxScopeOf, type Actor } from './actor';
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
    actor: Actor,
    notificationId: unknown,
  ): Promise<MarkNotificationReadOutcome> {
    const parsed = notificationIdSchema.safeParse(notificationId);
    if (!parsed.success) throw new ValidationError('markNotificationRead: id no es uuid');

    const found = await deps.inbox.markRead(inboxScopeOf(actor, deps.now()), parsed.data);
    return found ? 'marked' : 'not_found';
  };
}
