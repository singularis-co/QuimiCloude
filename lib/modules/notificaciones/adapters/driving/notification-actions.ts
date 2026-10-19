'use server';

import { identity, notificaciones } from '@/lib/composition';
import {
  listNotificationsInputSchema,
  notificationIdSchema,
  UnauthorizedError,
  ValidationError,
  type Actor,
  type NotificationItem,
} from '@/lib/modules/notificaciones';
import { forModule } from '@/lib/shared/observability/logger';
import { runInRequestScope } from '@/lib/shared/request-scope';

import { notificationHref } from './notification-links';

/**
 * `unauthorized`: no hay sesión. `forbidden`: hay sesión pero no el permiso efectivo (también con el
 * añadido apagado). Con cualquiera de los dos el navegador deja de consultar.
 */
export type NotificationActionCode =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_input'
  | 'not_found'
  | 'unexpected';

export type NotificationActionFailure = { readonly ok: false; readonly code: NotificationActionCode };

export type NotificationActionResult<T> = { readonly ok: true; readonly data: T } | NotificationActionFailure;

export type NotificationSummaryView = {
  readonly unreadCount: number;
  readonly newest: { readonly id: string; readonly createdAt: string } | null;
};

/** `body` viaja con la marca `{hora}` sin sustituir: la hora se pinta en la zona del navegador. */
export type NotificationView = {
  readonly id: string;
  readonly tone: NotificationItem['tone'];
  readonly title: string;
  readonly body: string;
  readonly bodyTime: string | null;
  readonly linkLabel: string;
  readonly href: string | null;
  readonly createdAt: string;
  readonly read: boolean;
};

export type NotificationBatchView = {
  readonly items: readonly NotificationView[];
  readonly nextCursor: string | null;
};

const log = forModule('notificaciones');

async function currentActor(): Promise<Actor | null> {
  const [sessionUser, sessionContext] = await runInRequestScope(() =>
    Promise.all([identity.getSessionUser(), identity.getSessionContext()]),
  );
  if (sessionUser === null || sessionContext === null) return null;
  return {
    id: sessionUser.id,
    companyId: sessionContext.companyId,
    roleName: sessionUser.roleName,
    permissions: sessionUser.permissions,
  };
}

function failure(error: unknown, action: string): NotificationActionFailure {
  if (error instanceof UnauthorizedError) return { ok: false, code: 'forbidden' };
  if (error instanceof ValidationError) return { ok: false, code: 'invalid_input' };
  // Solo el nombre: el mensaje puede traer datos de la consulta.
  log.error('notification_action_failed', {
    action,
    error: error instanceof Error ? error.name : typeof error,
  });
  return { ok: false, code: 'unexpected' };
}

function toView(item: NotificationItem): NotificationView {
  return {
    id: item.id,
    tone: item.tone,
    title: item.title,
    body: item.body,
    bodyTime: item.bodyTime?.toISOString() ?? null,
    linkLabel: item.linkLabel,
    href: notificationHref(item.target),
    createdAt: item.createdAt.toISOString(),
    read: item.read,
  };
}

const UNAUTHORIZED: NotificationActionFailure = { ok: false, code: 'unauthorized' };

/** El conteo y el más reciente. Es lo que el navegador consulta cada 30 s. */
export async function getNotificationSummaryAction(): Promise<
  NotificationActionResult<NotificationSummaryView>
> {
  const actor = await currentActor();
  if (actor === null) return UNAUTHORIZED;
  try {
    const summary = await notificaciones.getNotificationSummary(actor);
    log.info('notification_summary_read', { companyId: actor.companyId });
    return {
      ok: true,
      data: {
        unreadCount: summary.unreadCount,
        newest:
          summary.newest === null
            ? null
            : { id: summary.newest.id, createdAt: summary.newest.createdAt.toISOString() },
      },
    };
  } catch (error) {
    return failure(error, 'summary');
  }
}

/**
 * Un lote de hasta 10. Una entrada que no pasa el esquema llega cruda al caso de uso: así el
 * permiso se comprueba antes que la forma, y quien no lo tiene recibe `forbidden` igual.
 */
export async function listNotificationsAction(
  input: unknown,
): Promise<NotificationActionResult<NotificationBatchView>> {
  const actor = await currentActor();
  if (actor === null) return UNAUTHORIZED;
  const parsed = listNotificationsInputSchema.safeParse(input);
  try {
    const batch = await notificaciones.listNotifications(actor, parsed.success ? parsed.data : input);
    return { ok: true, data: { items: batch.items.map(toView), nextCursor: batch.nextCursor } };
  } catch (error) {
    return failure(error, 'list');
  }
}

/** Uno ajeno o inexistente responde `not_found`, sin distinguirlos. */
export async function markNotificationReadAction(
  id: unknown,
): Promise<{ readonly ok: true } | NotificationActionFailure> {
  const actor = await currentActor();
  if (actor === null) return UNAUTHORIZED;
  const parsed = notificationIdSchema.safeParse(id);
  try {
    const outcome = await notificaciones.markNotificationRead(actor, parsed.success ? parsed.data : id);
    return outcome === 'marked' ? { ok: true } : { ok: false, code: 'not_found' };
  } catch (error) {
    return failure(error, 'mark');
  }
}

export async function markAllNotificationsReadAction(): Promise<
  NotificationActionResult<{ readonly marked: number }>
> {
  const actor = await currentActor();
  if (actor === null) return UNAUTHORIZED;
  try {
    return { ok: true, data: await notificaciones.markAllNotificationsRead(actor) };
  } catch (error) {
    return failure(error, 'mark_all');
  }
}
