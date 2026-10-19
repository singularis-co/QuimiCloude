import type { InboxSummary, NotificationInbox } from '../ports/notification-inbox';

import { inboxScopeOf, type Actor } from './actor';

export type GetNotificationSummaryDeps = {
  readonly inbox: Pick<NotificationInbox, 'summary'>;
  readonly now: () => Date;
};

export type NotificationSummary = InboxSummary;

/** El conteo de no leídos y el aviso más reciente; la lista se pide aparte, por lotes. */
export function createGetNotificationSummary(deps: GetNotificationSummaryDeps) {
  return async function getNotificationSummary(
    actor: Actor,
  ): Promise<NotificationSummary> {
    return deps.inbox.summary(inboxScopeOf(actor, deps.now()));
  };
}
