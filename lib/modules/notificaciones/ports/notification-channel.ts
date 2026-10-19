import type { StoredNotification } from './notification-inbox';

/** Un canal nuevo (correo, teléfono, WhatsApp, Telegram) amplía esta unión y registra su adaptador. */
export type ChannelKey = 'in_app';

export type DeliverableNotification = StoredNotification;

export interface NotificationChannel {
  readonly key: ChannelKey;
  deliver(notification: DeliverableNotification): Promise<void>;
}
