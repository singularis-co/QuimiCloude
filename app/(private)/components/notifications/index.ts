// Sin `'use client'`: la frontera se declara en cada componente, no en el barril.
export {
  NOTIFICATION_BELL_TEXTS,
  NotificationBell,
  PHONE_PANEL_COLLISION_PADDING,
  PHONE_PANEL_WIDTH_CLASS,
  type NotificationBellProps,
} from './notification-bell';
export {
  NotificationItem,
  renderNotificationBody,
  UNREAD_LABEL,
  type NotificationEntrance,
  type NotificationItemProps,
} from './notification-item';
export {
  NOTIFICATION_TAIL_TEXTS,
  NotificationListTail,
  type NotificationListTailProps,
} from './notification-list-tail';
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
