// Sin `'use client'`: la frontera se declara en cada componente, no en el barril.
export {
  NotificationItem,
  renderNotificationBody,
  UNREAD_LABEL,
  type NotificationEntrance,
  type NotificationItemProps,
} from './notification-item';
export {
  NotificationsProvider,
  useNotifications,
  type NotificationsActions,
  type NotificationsContextValue,
  type NotificationsProviderProps,
  type NotificationsSummaryState,
} from './notifications-provider';
export {
  formatUnreadCount,
  NOTIFICATIONS_LABEL,
  notificationsAccessibleName,
  UnreadCountBadge,
} from './unread-count-badge';
