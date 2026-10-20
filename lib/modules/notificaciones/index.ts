// Contrato del módulo `notificaciones`: solo reexporta de ./domain. Las Server Actions no pasan por
// aquí; la UI las importa por su ruta.
export {
  NOTIFICATION_CATALOG,
  type Audience,
  type CatalogEntry,
  type NotificationCatalog,
  type NotificationRecipient,
  type NotificationTarget,
  type NotificationTone,
} from './domain/catalog';
export type { NotificationEvent } from './domain/notification-event';
export { createNotify, type Notify, type NotifyDeps } from './domain/notify';
export {
  createChannelFactory,
  type ChannelFactory,
  type ChannelRegistry,
} from './domain/channel-factory';
export { NotificacionesError, ValidationError } from './domain/errors';
export type { Actor } from './domain/actor';
export { RETENTION_DAYS, retentionCutoff } from './domain/retention';
export {
  decodeNotificationCursor,
  encodeNotificationCursor,
  listNotificationsInputSchema,
  type ListNotificationsInput,
} from './domain/notification-cursor';
export {
  createGetNotificationSummary,
  type GetNotificationSummaryDeps,
  type NotificationSummary,
} from './domain/get-notification-summary';
export {
  createListNotifications,
  type ListNotificationsDeps,
  type NotificationBatch,
  type NotificationItem,
} from './domain/list-notifications';
export {
  createMarkNotificationRead,
  notificationIdSchema,
  type MarkNotificationReadDeps,
  type MarkNotificationReadOutcome,
} from './domain/mark-notification-read';
export {
  createMarkAllNotificationsRead,
  type MarkAllNotificationsReadDeps,
} from './domain/mark-all-notifications-read';
export {
  createPurgeExpiredNotifications,
  type PurgeExpiredNotificationsDeps,
} from './domain/purge-expired-notifications';
