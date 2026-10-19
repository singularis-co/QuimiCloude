import type { NotificationInbox } from '../ports/notification-inbox';
import type { NotificationLog } from '../ports/notification-log';
import type { NotificationsSwitch } from '../ports/notifications-switch';
import type { RecipientDirectory } from '../ports/recipient-directory';

import type { NotificationCatalog, NotificationRecipient } from './catalog';
import type { ChannelFactory } from './channel-factory';
import type { NotificationEvent } from './notification-event';

export type NotifyDeps = {
  readonly catalog: NotificationCatalog;
  readonly inbox: Pick<NotificationInbox, 'insertIfAbsent'>;
  readonly addon: NotificationsSwitch;
  readonly recipients: RecipientDirectory;
  readonly channels: ChannelFactory;
  readonly log: NotificationLog;
};

export type Notify = (event: NotificationEvent) => Promise<void>;

/**
 * Nunca lanza: quien emite ya terminó su operación, y un fallo al avisar no puede cambiar su
 * resultado. Cada rechazo o fallo queda en el registro.
 */
export function createNotify(deps: NotifyDeps): Notify {
  return async function notify(event) {
    const where = { eventKey: event.key, companyId: event.companyId };
    try {
      const entry = Object.hasOwn(deps.catalog, event.key) ? deps.catalog[event.key] : undefined;
      if (entry === undefined) {
        deps.log.warn('notification_rejected', { ...where, reason: 'unknown_event' });
        return;
      }
      const parsed = entry.schema.safeParse(event.payload);
      if (!parsed.success) {
        deps.log.warn('notification_rejected', { ...where, reason: 'invalid_payload' });
        return;
      }
      const payload = parsed.data;

      if (!(await deps.addon.isOn(event.companyId))) {
        deps.log.info('notification_skipped', { ...where, reason: 'addon_off' });
        return;
      }

      let recipient: NotificationRecipient;
      if (entry.audience.kind === 'role') {
        recipient = { kind: 'role', role: entry.audience.role };
      } else {
        const userId = entry.audience.userIdFrom(payload);
        if (!(await deps.recipients.belongsToCompany(userId, event.companyId))) {
          deps.log.warn('notification_rejected', { ...where, reason: 'recipient_outside_company' });
          return;
        }
        recipient = { kind: 'user', userId };
      }

      const stored = await deps.inbox.insertIfAbsent({
        companyId: event.companyId,
        eventKey: event.key,
        tone: entry.tone(payload),
        title: entry.title(payload),
        body: entry.body(payload),
        bodyTime: entry.bodyTime(payload),
        linkLabel: entry.linkLabel(payload),
        target: entry.target(payload),
        recipient,
        dedupeKey: event.dedupeKey,
      });
      if (stored === null) {
        deps.log.info('notification_duplicate', where);
        return;
      }

      for (const channel of deps.channels.channelsFor(entry.channels)) {
        try {
          await channel.deliver(stored);
        } catch (error) {
          deps.log.error('notification_channel_failed', {
            ...where,
            notificationId: stored.id,
            channel: channel.key,
            error: errorName(error),
          });
        }
      }
    } catch (error) {
      // Solo el nombre: el mensaje puede traer datos de la consulta.
      deps.log.error('notification_failed', { ...where, error: errorName(error) });
    }
  };
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}
