import type { NotificationChannel } from '../../../ports/notification-channel';
import type { NotificationLog } from '../../../ports/notification-log';

/**
 * El navegador consulta la bandeja, así que el aviso ya es visible al guardarse y aquí solo queda
 * la traza. Es el punto donde se publicaría si la entrega pasa a ser en tiempo real.
 */
export function createInAppChannel(log: NotificationLog): NotificationChannel {
  return {
    key: 'in_app',
    async deliver(notification) {
      log.info('notification_delivered', {
        channel: 'in_app',
        notificationId: notification.id,
        companyId: notification.companyId,
        eventKey: notification.eventKey,
      });
    },
  };
}
