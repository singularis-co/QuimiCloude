// La frontera de las cuatro lecturas de la bandeja, en el caso de uso: no piden permiso, y el alcance
// (empresa, usuario, rol y corte de 90 días) sale del actor de la sesión.
import { describe, expect, it, vi } from 'vitest';

import {
  createGetNotificationSummary,
  createListNotifications,
  createMarkAllNotificationsRead,
  createMarkNotificationRead,
  type Actor,
} from '@/lib/modules/notificaciones';
import type { NotificationInbox } from '@/lib/modules/notificaciones/ports/notification-inbox';

const NOW = new Date('2026-10-19T12:00:00.000Z');
const NOTICE_ID = '9a1d4e77-2c3b-4f58-8e06-1b7a9d3c5e02';

const SCOPE = {
  companyId: '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13',
  userId: '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40',
  roleName: 'Operador',
  cutoff: new Date('2026-07-21T12:00:00.000Z'),
};

function inboxSpy() {
  return {
    insertIfAbsent: vi.fn(),
    summary: vi.fn(async () => ({ unreadCount: 0, newest: null })),
    listBatch: vi.fn(async () => ({ items: [], next: null })),
    markRead: vi.fn(async () => false),
    markAllRead: vi.fn(async () => 0),
    deleteExpired: vi.fn(),
  } satisfies { [K in keyof NotificationInbox]: unknown };
}

function useCases(inbox: ReturnType<typeof inboxSpy>) {
  const deps = { inbox: inbox as unknown as NotificationInbox, now: () => NOW };
  return {
    summary: (actor: Actor) => createGetNotificationSummary(deps)(actor),
    list: (actor: Actor) => createListNotifications(deps)(actor, { cursor: null }),
    markRead: (actor: Actor) => createMarkNotificationRead(deps)(actor, NOTICE_ID),
    markAll: (actor: Actor) => createMarkAllNotificationsRead(deps)(actor),
  };
}

/** Un actor sin ningún campo de permisos: el tipo `Actor` ya no los lleva. */
const ACTOR: Actor = { id: SCOPE.userId, companyId: SCOPE.companyId, roleName: SCOPE.roleName };

const OPERATIONS = ['summary', 'list', 'markRead', 'markAll'] as const;

describe('alcance de la bandeja', () => {
  describe.each(OPERATIONS)('%s', (operation) => {
    it('R15: un actor sin ningún permiso lee su bandeja con empresa, usuario, rol y corte de 90 días', async () => {
      const inbox = inboxSpy();

      await useCases(inbox)[operation](ACTOR);

      const called = Object.values(inbox).filter((method) => method.mock.calls.length > 0);
      expect(called).toHaveLength(1);
      expect(called[0]!.mock.calls[0]![0]).toEqual(SCOPE);
    });
  });

  it('R15: marcar pasa a la bandeja el mismo alcance', async () => {
    const inbox = inboxSpy();
    const cases = useCases(inbox);

    await cases.markRead(ACTOR);
    await cases.markAll(ACTOR);

    expect(inbox.markRead).toHaveBeenCalledWith(SCOPE, NOTICE_ID);
    expect(inbox.markAllRead).toHaveBeenCalledWith(SCOPE);
  });

  it('R14: marcar un aviso no visible responde not_found, igual que uno inexistente', async () => {
    const inbox = inboxSpy();
    const markRead = createMarkNotificationRead({
      inbox: inbox as unknown as NotificationInbox,
      now: () => NOW,
    });

    inbox.markRead.mockResolvedValueOnce(false);
    const foreign = await markRead(ACTOR, NOTICE_ID);
    inbox.markRead.mockResolvedValueOnce(false);
    const missing = await markRead(ACTOR, '5b6f3d21-9c4e-4a7f-8b03-6d2e1f5a9c44');
    inbox.markRead.mockResolvedValueOnce(true);
    const own = await markRead(ACTOR, NOTICE_ID);

    expect(foreign).toBe('not_found');
    expect(missing).toBe('not_found');
    expect(own).toBe('marked');
  });
});
