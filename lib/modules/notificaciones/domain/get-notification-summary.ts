import type { InboxSummary, NotificationInbox } from '../ports/notification-inbox';

import { inboxScopeOf, NOTIFICATIONS_READ_PERMISSION, requirePermission, type Actor } from './actor';

export type GetNotificationSummaryDeps = {
  readonly inbox: Pick<NotificationInbox, 'summary'>;
  readonly now: () => Date;
};

export type NotificationSummary = InboxSummary;

/** El conteo de no leídos y el aviso más reciente; la lista se pide aparte, por lotes. */
export function createGetNotificationSummary(deps: GetNotificationSummaryDeps) {
  return async function getNotificationSummary(
    actor: Actor | null | undefined,
  ): Promise<NotificationSummary> {
    requirePermission(actor, NOTIFICATIONS_READ_PERMISSION);
    return deps.inbox.summary(inboxScopeOf(actor, deps.now()));
  };
}
