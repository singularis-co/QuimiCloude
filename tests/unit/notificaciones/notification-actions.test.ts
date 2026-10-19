// Las cuatro Server Actions de la bandeja contra los casos de uso reales, con la sesión y la bandeja
// dobladas. Lo que se mira es el borde: la sesión, la entrada y el código que vuelve al navegador.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getNotificationSummaryAction,
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/lib/modules/notificaciones/adapters/driving/notification-actions';
import { encodeNotificationCursor, NOTIFICATIONS_READ_PERMISSION } from '@/lib/modules/notificaciones';

const { getSessionUserMock, getSessionContextMock, inbox } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getSessionContextMock: vi.fn(),
  inbox: {
    summary: vi.fn(),
    listBatch: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

vi.mock('@/lib/composition', async () => {
  const m = await import('@/lib/modules/notificaciones');
  const deps = { inbox, now: () => new Date('2026-10-19T12:00:00.000Z') };
  return {
    identity: { getSessionUser: getSessionUserMock, getSessionContext: getSessionContextMock },
    notificaciones: {
      getNotificationSummary: m.createGetNotificationSummary(deps),
      listNotifications: m.createListNotifications(deps),
      markNotificationRead: m.createMarkNotificationRead(deps),
      markAllNotificationsRead: m.createMarkAllNotificationsRead(deps),
    },
  };
});

vi.mock('@/lib/shared/observability/logger', () => ({
  forModule: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const USER_ID = '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40';
const COMPANY_ID = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';
const NOTICE_ID = '9a1d4e77-2c3b-4f58-8e06-1b7a9d3c5e02';

function sessionWith(permissions: readonly string[]) {
  getSessionUserMock.mockResolvedValue({
    id: USER_ID,
    username: 'ana.perez',
    displayName: 'Ana Perez',
    roleName: 'Operador',
    permissions,
  });
  getSessionContextMock.mockResolvedValue({ userId: USER_ID, companyId: COMPANY_ID, roleName: 'Operador' });
}

const ACTIONS = {
  summary: () => getNotificationSummaryAction(),
  list: () => listNotificationsAction({ cursor: null }),
  markRead: () => markNotificationReadAction(NOTICE_ID),
  markAll: () => markAllNotificationsReadAction(),
};

function inboxUntouched() {
  for (const method of Object.values(inbox)) expect(method).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionWith([NOTIFICATIONS_READ_PERMISSION]);
  inbox.summary.mockResolvedValue({ unreadCount: 0, newest: null });
  inbox.listBatch.mockResolvedValue({ items: [], next: null });
  inbox.markRead.mockResolvedValue(true);
  inbox.markAllRead.mockResolvedValue(0);
});

describe('Server Actions de la bandeja', () => {
  describe.each(Object.entries(ACTIONS))('%s', (_name, run) => {
    it('R40: sin sesión responde unauthorized sin tocar la bandeja', async () => {
      getSessionUserMock.mockResolvedValue(null);

      expect(await run()).toEqual({ ok: false, code: 'unauthorized' });
      inboxUntouched();
    });

    it('R40: con sesión y sin el permiso efectivo responde forbidden sin tocar la bandeja', async () => {
      sessionWith(['inventario.consultar']);

      expect(await run()).toEqual({ ok: false, code: 'forbidden' });
      inboxUntouched();
    });
  });

  it('R22: el resumen viaja con el conteo y el más reciente en ISO', async () => {
    inbox.summary.mockResolvedValue({
      unreadCount: 4,
      newest: { id: NOTICE_ID, createdAt: new Date('2026-10-19T09:12:00.000Z') },
    });

    expect(await getNotificationSummaryAction()).toEqual({
      ok: true,
      data: { unreadCount: 4, newest: { id: NOTICE_ID, createdAt: '2026-10-19T09:12:00.000Z' } },
    });
    expect(inbox.summary.mock.calls[0]![0]).toMatchObject({
      companyId: COMPANY_ID,
      userId: USER_ID,
      roleName: 'Operador',
    });
  });

  it('R25, R49: el lote viaja como vista con href resuelto, {hora} sin sustituir y el cursor siguiente', async () => {
    const next = { t: '2026-10-19T09:00:00.123456Z', i: NOTICE_ID };
    inbox.listBatch.mockResolvedValue({
      items: [
        {
          id: NOTICE_ID,
          tone: 'success',
          title: 'Tanda de PDFs procesada',
          body: 'Se leyó el archivo de la tanda que subiste a las {hora}.',
          bodyTime: new Date('2026-10-19T09:12:00.000Z'),
          linkLabel: 'Ver fórmulas',
          target: { kind: 'formulas' },
          createdAt: new Date('2026-10-19T09:13:00.000Z'),
          read: false,
        },
      ],
      next,
    });

    expect(await listNotificationsAction({ cursor: null })).toEqual({
      ok: true,
      data: {
        items: [
          {
            id: NOTICE_ID,
            tone: 'success',
            title: 'Tanda de PDFs procesada',
            body: 'Se leyó el archivo de la tanda que subiste a las {hora}.',
            bodyTime: '2026-10-19T09:12:00.000Z',
            linkLabel: 'Ver fórmulas',
            href: '/produccion/formulas',
            createdAt: '2026-10-19T09:13:00.000Z',
            read: false,
          },
        ],
        nextCursor: encodeNotificationCursor(next),
      },
    });
  });

  it.each([
    ['un número', { cursor: 7 }],
    ['vacío', { cursor: '' }],
    ['un objeto', { cursor: { t: 'x' } }],
    ['sin la clave', {}],
    ['mal formado', { cursor: 'no-es-un-cursor' }],
  ])('R25: un cursor que no es texto válido (%s) responde invalid_input sin tocar la bandeja', async (_case, input) => {
    expect(await listNotificationsAction(input)).toEqual({ ok: false, code: 'invalid_input' });
    inboxUntouched();
  });

  it('R25: sin permiso, una entrada mal formada responde forbidden: el permiso va antes que la forma', async () => {
    sessionWith([]);

    expect(await listNotificationsAction({ cursor: 7 })).toEqual({ ok: false, code: 'forbidden' });
    expect(await markNotificationReadAction('no-es-uuid')).toEqual({ ok: false, code: 'forbidden' });
    inboxUntouched();
  });

  it.each([['no-es-uuid'], [''], [42], [null]])(
    'R14: un id que no es uuid (%s) se rechaza con invalid_input sin tocar la bandeja',
    async (id) => {
      expect(await markNotificationReadAction(id)).toEqual({ ok: false, code: 'invalid_input' });
      inboxUntouched();
    },
  );

  it('R14: un aviso no visible responde not_found, igual que uno inexistente', async () => {
    inbox.markRead.mockResolvedValue(false);

    expect(await markNotificationReadAction(NOTICE_ID)).toEqual({ ok: false, code: 'not_found' });
    inbox.markRead.mockResolvedValue(true);
    expect(await markNotificationReadAction(NOTICE_ID)).toEqual({ ok: true });
  });

  it('R32: marcar todas devuelve cuántas marcó', async () => {
    inbox.markAllRead.mockResolvedValue(12);

    expect(await markAllNotificationsReadAction()).toEqual({ ok: true, data: { marked: 12 } });
  });

  it('un fallo de la bandeja responde unexpected sin lanzar', async () => {
    inbox.summary.mockRejectedValue(new Error('conexion caida'));

    expect(await getNotificationSummaryAction()).toEqual({ ok: false, code: 'unexpected' });
  });
});
