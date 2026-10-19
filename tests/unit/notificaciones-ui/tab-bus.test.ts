import { describe, expect, it, vi } from 'vitest';

import {
  INITIAL_LIST_STATE,
  transitionList,
  type NotificationListState,
} from '@/app/(private)/components/notifications/notification-list-state';
import {
  createTabBus,
  storageEventTransport,
  type TabMessage,
  type TabTransport,
} from '@/app/(private)/components/notifications/tab-bus';
import type { NotificationView } from '@/lib/modules/notificaciones/adapters/driving/notification-actions';

/** Un «navegador» en memoria: lo que publica una pestaña llega a las demás, no a ella. */
function memoryHub() {
  const tabs = new Set<{ deliver: (data: unknown) => void }>();
  const open = (): TabTransport => {
    const listeners = new Set<(data: unknown) => void>();
    const tab = { deliver: (data: unknown) => listeners.forEach((l) => l(structuredClone(data))) };
    tabs.add(tab);
    return {
      post: (data) => tabs.forEach((other) => other !== tab && other.deliver(data)),
      listen(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      close: () => tabs.delete(tab),
    };
  };
  return { open };
}

const view = (id: string): NotificationView => ({
  id,
  tone: 'success',
  title: 'Tanda de PDFs procesada',
  body: 'Se leyó el archivo.',
  bodyTime: null,
  linkLabel: 'Ver fórmulas',
  href: '/formulas',
  createdAt: '2026-10-19T10:00:00.000Z',
  read: false,
});

/** La parte de una pestaña que el bus actualiza: conteo y lista cargada. */
function tab(bus: ReturnType<typeof createTabBus>) {
  const state: { unreadCount: number; list: NotificationListState } = {
    unreadCount: 3,
    list: transitionList(transitionList(INITIAL_LIST_STATE, { type: 'open' }).state, {
      type: 'firstLoaded',
      batch: { items: [view('a'), view('b'), view('c')], nextCursor: null },
    }).state,
  };
  const refresh = vi.fn();
  bus.subscribe((message: TabMessage) => {
    if (message.type === 'summary') {
      state.unreadCount = message.summary.unreadCount;
      return;
    }
    state.list = transitionList(
      state.list,
      message.ids === 'all' ? { type: 'markAllRead' } : { type: 'markRead', ids: message.ids },
    ).state;
    if (message.ids === 'all') state.unreadCount = 0;
    refresh();
  });
  return { state, refresh };
}

describe('createTabBus', () => {
  it('R39: un resumen publicado actualiza el conteo de la otra pestaña, no el de la que publica', () => {
    const hub = memoryHub();
    const busA = createTabBus({ userId: 'u1', transport: hub.open() });
    const busB = createTabBus({ userId: 'u1', transport: hub.open() });
    const a = tab(busA);
    const b = tab(busB);

    busA.publish({ type: 'summary', summary: { unreadCount: 7, newest: { id: 'z', createdAt: '2026-10-19T11:00:00.000Z' } } });

    expect(b.state.unreadCount).toBe(7);
    expect(a.state.unreadCount).toBe(3);
    expect(b.refresh).not.toHaveBeenCalled();
  });

  it('R39: un «leído» publicado marca los avisos cargados de la otra pestaña y le pide refrescar', () => {
    const hub = memoryHub();
    const busA = createTabBus({ userId: 'u1', transport: hub.open() });
    const b = tab(createTabBus({ userId: 'u1', transport: hub.open() }));

    busA.publish({ type: 'read', ids: ['b'] });
    expect(b.state.list.items.map((i) => i.read)).toEqual([false, true, false]);
    expect(b.refresh).toHaveBeenCalledTimes(1);

    busA.publish({ type: 'read', ids: 'all' });
    expect(b.state.list.items.every((i) => i.read)).toBe(true);
    expect(b.state.unreadCount).toBe(0);
  });

  it('R39: ignora mensajes de otro usuario y mensajes mal formados', () => {
    const hub = memoryHub();
    const other = hub.open();
    const b = tab(createTabBus({ userId: 'u1', transport: hub.open() }));

    createTabBus({ userId: 'u2', transport: hub.open() }).publish({ type: 'read', ids: 'all' });
    other.post({ type: 'summary', userId: 'u1', summary: { unreadCount: -1, newest: null } });
    other.post('basura');

    expect(b.state.unreadCount).toBe(3);
    expect(b.state.list.items.every((i) => !i.read)).toBe(true);
  });

  it('R39: sin BroadcastChannel el respaldo por el evento storage entrega el mensaje', () => {
    const target = new EventTarget() as EventTarget & Pick<Window, 'addEventListener' | 'removeEventListener'>;
    const written: string[] = [];
    const transport = storageEventTransport({ setItem: (_k, v) => void written.push(v) }, target);
    const received: unknown[] = [];
    transport.listen((data) => received.push(data));

    transport.post({ type: 'read', userId: 'u1', ids: ['a'] });
    const event = new Event('storage') as StorageEvent;
    Object.assign(event, { key: 'qc-notificaciones:bus', newValue: written[0] });
    target.dispatchEvent(event);

    expect(received).toEqual([{ type: 'read', userId: 'u1', ids: ['a'] }]);
  });
});
