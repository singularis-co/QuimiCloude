import type { NotificationInbox } from '../ports/notification-inbox';

import { retentionCutoff } from './retention';

export type PurgeExpiredNotificationsDeps = {
  readonly inbox: Pick<NotificationInbox, 'deleteExpired'>;
  readonly now: () => Date;
};

/** Sin actor: lo llama la tarea diaria, una empresa cada vez, viva o dada de baja. */
export function createPurgeExpiredNotifications(deps: PurgeExpiredNotificationsDeps) {
  return async function purgeExpiredNotifications(
    companyId: string,
  ): Promise<{ readonly deleted: number }> {
    const deleted = await deps.inbox.deleteExpired(companyId, retentionCutoff(deps.now()));
    return { deleted };
  };
}
