// La autorización de las cuatro lecturas de la bandeja, en el caso de uso y antes de tocar el puerto.
import { describe, expect, it, vi } from 'vitest';

import { ADDONS, effectivePermissions, type Addon } from '@/lib/modules/identity';
import {
  createGetNotificationSummary,
  createListNotifications,
  createMarkAllNotificationsRead,
  createMarkNotificationRead,
  NOTIFICATIONS_READ_PERMISSION,
  UnauthorizedError,
  type Actor,
} from '@/lib/modules/notificaciones';
import type { NotificationInbox } from '@/lib/modules/notificaciones/ports/notification-inbox';

const NOW = new Date('2026-10-19T12:00:00.000Z');
const NOTICE_ID = '9a1d4e77-2c3b-4f58-8e06-1b7a9d3c5e02';

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
    summary: (actor: Actor | null) => createGetNotificationSummary(deps)(actor),
    list: (actor: Actor | null) => createListNotifications(deps)(actor, { cursor: null }),
    markRead: (actor: Actor | null) => createMarkNotificationRead(deps)(actor, NOTICE_ID),
    markAll: (actor: Actor | null) => createMarkAllNotificationsRead(deps)(actor),
  };
}

function actor(permissions: readonly string[]): Actor {
  return {
    id: '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40',
    companyId: '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13',
    roleName: 'Operador',
    permissions,
  };
}

const OPERATIONS = ['summary', 'list', 'markRead', 'markAll'] as const;

describe('autorización de la bandeja', () => {
  describe.each(OPERATIONS)('%s', (operation) => {
    it('R15: sin notificaciones.consultar lanza UnauthorizedError y no llama a la bandeja', async () => {
      const inbox = inboxSpy();

      await expect(useCases(inbox)[operation](actor(['inventario.consultar']))).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
      await expect(useCases(inbox)[operation](null)).rejects.toBeInstanceOf(UnauthorizedError);

      for (const method of Object.values(inbox)) expect(method).not.toHaveBeenCalled();
    });

    it('R19: con el añadido apagado el permiso no es efectivo y tampoco se lee la bandeja', async () => {
      const inbox = inboxSpy();
      const allButNotifications = ADDONS.filter((addon): addon is Addon => addon !== 'notificaciones');
      const permissions = effectivePermissions([NOTIFICATIONS_READ_PERMISSION], allButNotifications);

      expect(permissions).toEqual([]);
      await expect(useCases(inbox)[operation](actor(permissions))).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
      for (const method of Object.values(inbox)) expect(method).not.toHaveBeenCalled();
    });

    it('R15: con el permiso llega a la bandeja con la empresa, el usuario, el rol y el corte de 90 días', async () => {
      const inbox = inboxSpy();

      await useCases(inbox)[operation](actor([NOTIFICATIONS_READ_PERMISSION]));

      const called = Object.values(inbox).filter((method) => method.mock.calls.length > 0);
      expect(called).toHaveLength(1);
      expect(called[0]!.mock.calls[0]![0]).toEqual({
        companyId: '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13',
        userId: '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40',
        roleName: 'Operador',
        cutoff: new Date('2026-07-21T12:00:00.000Z'),
      });
    });
  });

  it('R14: marcar un aviso no visible responde not_found, igual que uno inexistente', async () => {
    const inbox = inboxSpy();
    const markRead = createMarkNotificationRead({
      inbox: inbox as unknown as NotificationInbox,
      now: () => NOW,
    });
    const reader = actor([NOTIFICATIONS_READ_PERMISSION]);

    inbox.markRead.mockResolvedValueOnce(false);
    const foreign = await markRead(reader, NOTICE_ID);
    inbox.markRead.mockResolvedValueOnce(false);
    const missing = await markRead(reader, '5b6f3d21-9c4e-4a7f-8b03-6d2e1f5a9c44');
    inbox.markRead.mockResolvedValueOnce(true);
    const own = await markRead(reader, NOTICE_ID);

    expect(foreign).toBe('not_found');
    expect(missing).toBe('not_found');
    expect(own).toBe('marked');
  });
});
