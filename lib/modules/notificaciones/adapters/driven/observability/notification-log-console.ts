import { forModule } from '@/lib/shared/observability/logger';

import type { NotificationLog } from '../../../ports/notification-log';

export function createNotificationLogConsole(): NotificationLog {
  return forModule('notificaciones');
}
