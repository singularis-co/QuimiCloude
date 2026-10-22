'use server';

import { identity, notificaciones } from '@/lib/composition';
import {
  decodeNotificationCursor,
  listNotificationsInputSchema,
  notificationIdSchema,
  ValidationError,
  type Actor,
  type NotificationItem,
} from '@/lib/modules/notificaciones';
import { forModule } from '@/lib/shared/observability/logger';
import { runInRequestScope } from '@/lib/shared/request-scope';

import { notificationHref } from './notification-links';

/** `unauthorized` solo cuando no hay sesión: con él el navegador deja de consultar. */
export type NotificationActionCode = 'unauthorized' | 'invalid_input' | 'not_found' | 'unexpected';

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

/**
 * `no_company`: hay sesión pero no empresa (el Maestro). No tiene bandeja, así que recibe respuestas
 * vacías y la consulta del navegador sigue sin errores.
 */
type CurrentActor =
  | { readonly kind: 'none' }
  | { readonly kind: 'no_company' }
  | { readonly kind: 'company'; readonly actor: Actor };

async function currentActor(): Promise<CurrentActor> {
  const [sessionUser, sessionContext] = await runInRequestScope(() =>
    Promise.all([identity.getSessionUser(), identity.getSessionContext()]),
  );
  if (sessionUser === null) return { kind: 'none' };
  if (sessionContext === null) return { kind: 'no_company' };
  return {
    kind: 'company',
    actor: { id: sessionUser.id, companyId: sessionContext.companyId, roleName: sessionUser.roleName },
  };
}

function failure(error: unknown, action: string): NotificationActionFailure {
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
const NOT_FOUND: NotificationActionFailure = { ok: false, code: 'not_found' };

/** El conteo y el más reciente. Es lo que el navegador consulta cada 30 s. */
export async function getNotificationSummaryAction(): Promise<
  NotificationActionResult<NotificationSummaryView>
> {
  const current = await currentActor();
  if (current.kind === 'none') return UNAUTHORIZED;
  if (current.kind === 'no_company') return { ok: true, data: { unreadCount: 0, newest: null } };
  const { actor } = current;
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

/** Un lote de hasta 10. */
export async function listNotificationsAction(
  input: unknown,
): Promise<NotificationActionResult<NotificationBatchView>> {
  const current = await currentActor();
  if (current.kind === 'none') return UNAUTHORIZED;
  const parsed = listNotificationsInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'invalid_input' };
  try {
    if (current.kind === 'no_company') {
      // Sin bandeja que leer, pero un cursor mal formado se rechaza igual que con empresa.
      if (parsed.data.cursor !== null) decodeNotificationCursor(parsed.data.cursor);
      return { ok: true, data: { items: [], nextCursor: null } };
    }
    const batch = await notificaciones.listNotifications(current.actor, parsed.data);
    return { ok: true, data: { items: batch.items.map(toView), nextCursor: batch.nextCursor } };
  } catch (error) {
    return failure(error, 'list');
  }
}

/** Uno ajeno o inexistente responde `not_found`, sin distinguirlos. */
export async function markNotificationReadAction(
  id: unknown,
): Promise<{ readonly ok: true } | NotificationActionFailure> {
  const current = await currentActor();
  if (current.kind === 'none') return UNAUTHORIZED;
  const parsed = notificationIdSchema.safeParse(id);
  if (!parsed.success) return { ok: false, code: 'invalid_input' };
  // Sin empresa no hay avisos: responde como uno inexistente.
  if (current.kind === 'no_company') return NOT_FOUND;
  try {
    const outcome = await notificaciones.markNotificationRead(current.actor, parsed.data);
    return outcome === 'marked' ? { ok: true } : NOT_FOUND;
  } catch (error) {
    return failure(error, 'mark');
  }
}

export async function markAllNotificationsReadAction(): Promise<
  NotificationActionResult<{ readonly marked: number }>
> {
  const current = await currentActor();
  if (current.kind === 'none') return UNAUTHORIZED;
  if (current.kind === 'no_company') return { ok: true, data: { marked: 0 } };
  try {
    return { ok: true, data: await notificaciones.markAllNotificationsRead(current.actor) };
  } catch (error) {
    return failure(error, 'mark_all');
  }
}
