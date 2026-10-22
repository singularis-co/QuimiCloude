import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { setupUser } from '../../helpers/user-event';

vi.mock('@/lib/modules/notificaciones/adapters/driving/notification-actions', () => ({
  getNotificationSummaryAction: vi.fn(),
  listNotificationsAction: vi.fn(),
  markNotificationReadAction: vi.fn(),
  markAllNotificationsReadAction: vi.fn(),
}));

import {
  NotificationsProvider,
  notificationsAccessibleName,
  UnreadCountBadge,
  useNotifications,
  type NotificationsActions,
} from '@/app/(private)/components/notifications';
import type { ChimeCoordinator } from '@/app/(private)/components/notifications/chime-coordinator';
import type { NotificationFeed, NotificationSummary } from '@/app/(private)/components/notifications/notification-feed';
import type { TabBus, TabMessage } from '@/app/(private)/components/notifications/tab-bus';
import type { NotificationView } from '@/lib/modules/notificaciones/adapters/driving/notification-actions';

const at = (n: number) => new Date(Date.UTC(2026, 9, 19, 10, n)).toISOString();

const view = (n: number, read = false): NotificationView => ({
  id: `n${n}`,
  tone: 'success',
  title: `Aviso ${n}`,
  body: 'Se leyó el archivo.',
  bodyTime: null,
  linkLabel: 'Ver fórmulas',
  href: '/formulas',
  createdAt: at(n),
  read,
});

function fakeFeed() {
  let onSummary: ((s: NotificationSummary) => void) | null = null;
  const feed: NotificationFeed = {
    start(listener) {
      onSummary = listener;
      return () => {
        onSummary = null;
      };
    },
    refresh: vi.fn(async () => undefined),
  };
  const emit = (unreadCount: number, newest: number | null) =>
    act(() => {
      onSummary?.({
        status: 'ready',
        unreadCount,
        newest: newest === null ? null : { id: `n${newest}`, createdAt: at(newest) },
      });
    });
  const fail = () => act(() => onSummary?.({ status: 'error' }));
  return { feed, emit, fail };
}

function fakeBus() {
  let listener: ((m: TabMessage) => void) | null = null;
  const bus = {
    publish: vi.fn<TabBus['publish']>(),
    subscribe(l: (m: TabMessage) => void) {
      listener = l;
      return () => {
        listener = null;
      };
    },
    close: vi.fn(),
  } satisfies TabBus;
  const deliver = (message: TabMessage) => act(() => listener?.(message));
  return { bus, deliver };
}

function fakeActions(batches: NotificationView[][] = []) {
  const queue = [...batches];
  return {
    fetchBatch: vi.fn(async () => ({ ok: true as const, data: { items: queue.shift() ?? [], nextCursor: null } })),
    markRead: vi.fn(async () => ({ ok: true as const })),
    markAllRead: vi.fn(async () => ({ ok: true as const, data: { marked: 1 } })),
  } satisfies NotificationsActions;
}

function Probe() {
  const { summary, list, open, markRead, markAllRead } = useNotifications();
  return (
    <div>
      <button type="button" aria-label={notificationsAccessibleName(summary.unreadCount)} onClick={open}>
        <UnreadCountBadge />
      </button>
      <span data-testid="summary-status">{summary.status}</span>
      <ul>
        {list.items.map((item) => (
          <li key={item.id} data-read={String(item.read)}>
            <button type="button" onClick={() => void markRead(item.id)}>
              {item.id}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => void markAllRead()}>
        todas
      </button>
    </div>
  );
}

function renderProvider(options: { actions?: NotificationsActions; chime?: ChimeCoordinator | null } = {}) {
  const feed = fakeFeed();
  const bus = fakeBus();
  const actions = options.actions ?? fakeActions();
  render(
    <NotificationsProvider userId="u1" feed={feed.feed} bus={bus.bus} chime={options.chime ?? null} actions={actions}>
      <Probe />
    </NotificationsProvider>,
  );
  return { ...feed, ...bus, actions };
}

const bell = () => screen.getByRole('button', { name: /^Notificaciones,/ });
const ids = () => screen.getAllByRole('listitem').map((li) => li.textContent);

describe('NotificationsProvider + UnreadCountBadge', () => {
  it('R22: con 0 no hay insignia y el nombre dice «ninguna sin leer»', () => {
    const { emit } = renderProvider();
    emit(0, null);
    expect(screen.queryByTestId('unread-count-badge')).toBeNull();
    expect(bell()).toHaveAccessibleName('Notificaciones, ninguna sin leer');
  });

  it('R22: insignia y nombre accesible leen el mismo número del contexto; con 100, «99+»', () => {
    const { emit } = renderProvider();
    emit(5, 1);
    expect(screen.getByTestId('unread-count-badge')).toHaveTextContent(/^5$/);
    expect(bell()).toHaveAccessibleName('Notificaciones, 5 sin leer');

    emit(100, 1);
    expect(screen.getByTestId('unread-count-badge')).toHaveTextContent(/^99\+$/);
    expect(screen.getByTestId('unread-count-badge')).toHaveAttribute('aria-hidden', 'true');
    expect(bell()).toHaveAccessibleName('Notificaciones, 100 sin leer');
  });

  it('R22: arranca en loading y un error no borra el último conteo', () => {
    const { emit, fail } = renderProvider();
    expect(screen.getByTestId('summary-status')).toHaveTextContent('loading');
    emit(3, 1);
    fail();
    expect(screen.getByTestId('summary-status')).toHaveTextContent('error');
    expect(bell()).toHaveAccessibleName('Notificaciones, 3 sin leer');
  });

  it('R37: con la lista sin cargar, un newest nuevo solo cambia el conteo', () => {
    const { emit, actions } = renderProvider();
    emit(1, 1);
    emit(2, 2);
    expect(actions.fetchBatch).not.toHaveBeenCalled();
    expect(bell()).toHaveAccessibleName('Notificaciones, 2 sin leer');
  });

  it('R37: con la lista cargada, un newest nuevo pide el primer lote y lo mezcla arriba', async () => {
    const actions = fakeActions([[view(2), view(1)], [view(3), view(2), view(1)]]);
    const { emit } = renderProvider({ actions });
    emit(2, 2);

    await setupUser().click(bell());
    await waitFor(() => expect(ids()).toEqual(['n2', 'n1']));
    expect(actions.fetchBatch).toHaveBeenLastCalledWith({ cursor: null });

    emit(2, 2);
    expect(actions.fetchBatch).toHaveBeenCalledTimes(1);

    emit(3, 3);
    await waitFor(() => expect(ids()).toEqual(['n3', 'n2', 'n1']));
    expect(actions.fetchBatch).toHaveBeenCalledTimes(2);
    expect(actions.fetchBatch).toHaveBeenLastCalledWith({ cursor: null });
  });

  it('R36: el conteo solo pulsa cuando llega un aviso nuevo, y el pulso va bajo motion-safe', () => {
    const { emit } = renderProvider();
    emit(1, 1);
    expect(screen.getByTestId('unread-count-badge').className).not.toMatch(/animate/);

    emit(2, 2);
    const animated = screen
      .getByTestId('unread-count-badge')
      .className.split(/\s+/)
      .filter((c) => /animate/.test(c));
    expect(animated).toEqual(['motion-safe:animate-[notification-count-bump_360ms_var(--ease-enter)_both]']);
  });

  it('R39: cada resumen propio se publica en el bus para las demás pestañas', () => {
    const { emit, bus } = renderProvider();
    emit(4, 2);
    expect(bus.publish).toHaveBeenCalledWith({
      type: 'summary',
      summary: { unreadCount: 4, newest: { id: 'n2', createdAt: at(2) } },
    });
  });

  it('R39: un resumen de otra pestaña actualiza el conteo sin volver a consultar', () => {
    const { emit, deliver, feed } = renderProvider();
    emit(1, 1);
    deliver({ type: 'summary', userId: 'u1', summary: { unreadCount: 6, newest: { id: 'n6', createdAt: at(6) } } });
    expect(bell()).toHaveAccessibleName('Notificaciones, 6 sin leer');
    expect(feed.refresh).not.toHaveBeenCalled();
  });

  it('R39: un «leído» de otra pestaña marca los cargados, ajusta el conteo y refresca', async () => {
    const actions = fakeActions([[view(2), view(1)]]);
    const { emit, deliver, feed } = renderProvider({ actions });
    emit(2, 2);
    await setupUser().click(bell());
    await waitFor(() => expect(ids()).toEqual(['n2', 'n1']));

    deliver({ type: 'read', userId: 'u1', ids: ['n1'] });
    expect(screen.getByRole('button', { name: 'n1' }).closest('li')).toHaveAttribute('data-read', 'true');
    expect(bell()).toHaveAccessibleName('Notificaciones, 1 sin leer');
    expect(feed.refresh).toHaveBeenCalledTimes(1);

    deliver({ type: 'read', userId: 'u1', ids: 'all' });
    expect(bell()).toHaveAccessibleName('Notificaciones, ninguna sin leer');
  });

  it('R32: marcar todas deja el conteo a 0 y los cargados como leídos, llama a la acción y lo publica', async () => {
    const actions = fakeActions([[view(2), view(1)]]);
    const { emit, bus, feed } = renderProvider({ actions });
    emit(5, 2);
    await setupUser().click(bell());
    await waitFor(() => expect(ids()).toEqual(['n2', 'n1']));

    await setupUser().click(screen.getByRole('button', { name: 'todas' }));
    expect(bell()).toHaveAccessibleName('Notificaciones, ninguna sin leer');
    expect(screen.getAllByRole('listitem').every((li) => li.getAttribute('data-read') === 'true')).toBe(true);
    await waitFor(() => expect(bus.publish).toHaveBeenCalledWith({ type: 'read', ids: 'all' }));
    expect(actions.markAllRead).toHaveBeenCalledTimes(1);
    expect(feed.refresh).toHaveBeenCalled();
  });

  it('R31: marcar uno lo marca en el acto, baja el conteo y lo publica tras la acción', async () => {
    const actions = fakeActions([[view(2), view(1)]]);
    const { emit, bus } = renderProvider({ actions });
    emit(2, 2);
    await setupUser().click(bell());
    await waitFor(() => expect(ids()).toEqual(['n2', 'n1']));

    await setupUser().click(screen.getByRole('button', { name: 'n2' }));
    expect(bell()).toHaveAccessibleName('Notificaciones, 1 sin leer');
    expect(actions.markRead).toHaveBeenCalledWith('n2');
    await waitFor(() => expect(bus.publish).toHaveBeenCalledWith({ type: 'read', ids: ['n2'] }));
  });

  it('R41: cada resumen propio pasa por el coordinador del tono', () => {
    const onSummary = vi.fn(async () => undefined);
    const { emit } = renderProvider({ chime: { onSummary } });
    emit(1, 1);
    emit(2, 2);
    expect(onSummary).toHaveBeenCalledTimes(2);
    expect(onSummary).toHaveBeenLastCalledWith({ status: 'ready', unreadCount: 2, newest: { id: 'n2', createdAt: at(2) } });
  });

  it('useNotifications fuera del proveedor lanza', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/NotificationsProvider/);
    spy.mockRestore();
  });
});
