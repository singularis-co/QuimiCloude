import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  browserTimers,
  createPollingFeed,
  NOTIFICATION_POLL_INTERVAL_MS,
  type NotificationSummary,
  type VisibilityPort,
} from '@/app/(private)/components/notifications/notification-feed';
import type {
  NotificationActionResult,
  NotificationSummaryView,
} from '@/lib/modules/notificaciones/adapters/driving/notification-actions';

type SummaryResult = NotificationActionResult<NotificationSummaryView>;

const OK: SummaryResult = { ok: true, data: { unreadCount: 2, newest: { id: 'n1', createdAt: '2026-10-19T10:00:00.000Z' } } };

function fakeVisibility(initial = true) {
  let visible = initial;
  const listeners = new Set<() => void>();
  const port: VisibilityPort = {
    isVisible: () => visible,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    port,
    set(next: boolean) {
      visible = next;
      for (const l of listeners) l();
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createPollingFeed', () => {
  it('R37: consulta al arrancar y luego cada 30 s', async () => {
    const fetchSummary = vi.fn(async () => OK);
    const visibility = fakeVisibility();
    const summaries: NotificationSummary[] = [];
    const feed = createPollingFeed({ fetchSummary, intervalMs: NOTIFICATION_POLL_INTERVAL_MS, visibility: visibility.port, timers: browserTimers });

    feed.start((s) => summaries.push(s), () => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSummary).toHaveBeenCalledTimes(1);
    expect(summaries).toEqual([{ status: 'ready', unreadCount: 2, newest: OK.ok ? OK.data.newest : null }]);

    await vi.advanceTimersByTimeAsync(29_999);
    expect(fetchSummary).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchSummary).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchSummary).toHaveBeenCalledTimes(3);
    expect(NOTIFICATION_POLL_INTERVAL_MS).toBe(30_000);
  });

  it('R37: sin solapes: con una consulta lenta no sale otra hasta que responde, y el plazo cuenta desde la respuesta', async () => {
    const pending = deferred<SummaryResult>();
    const fetchSummary = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(OK);
    const visibility = fakeVisibility();
    const feed = createPollingFeed({ fetchSummary, intervalMs: 30_000, visibility: visibility.port, timers: browserTimers });

    feed.start(() => {}, () => {});
    await vi.advanceTimersByTimeAsync(90_000);
    expect(fetchSummary).toHaveBeenCalledTimes(1);

    pending.resolve(OK);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(fetchSummary).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchSummary).toHaveBeenCalledTimes(2);
  });

  it('R37: un refresh con una consulta en vuelo no la solapa: pide otra al terminar', async () => {
    const pending = deferred<SummaryResult>();
    const fetchSummary = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(OK);
    const visibility = fakeVisibility();
    const feed = createPollingFeed({ fetchSummary, intervalMs: 30_000, visibility: visibility.port, timers: browserTimers });

    feed.start(() => {}, () => {});
    const refreshed = feed.refresh();
    expect(fetchSummary).toHaveBeenCalledTimes(1);
    pending.resolve(OK);
    await refreshed;
    expect(fetchSummary).toHaveBeenCalledTimes(2);
  });

  it('R38: con la pestaña oculta no consulta, y consulta en el acto al volver visible', async () => {
    const fetchSummary = vi.fn(async () => OK);
    const visibility = fakeVisibility(false);
    const feed = createPollingFeed({ fetchSummary, intervalMs: 30_000, visibility: visibility.port, timers: browserTimers });

    feed.start(() => {}, () => {});
    await vi.advanceTimersByTimeAsync(120_000);
    await feed.refresh();
    expect(fetchSummary).not.toHaveBeenCalled();

    visibility.set(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSummary).toHaveBeenCalledTimes(1);
  });

  it('R38: al ocultarse cancela el turno programado y al volver reanuda el ciclo', async () => {
    const fetchSummary = vi.fn(async () => OK);
    const visibility = fakeVisibility();
    const feed = createPollingFeed({ fetchSummary, intervalMs: 30_000, visibility: visibility.port, timers: browserTimers });

    feed.start(() => {}, () => {});
    await vi.advanceTimersByTimeAsync(0);
    visibility.set(false);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(fetchSummary).toHaveBeenCalledTimes(1);

    visibility.set(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSummary).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchSummary).toHaveBeenCalledTimes(3);
  });

  it('R40: se para con unauthorized', async () => {
    const fetchSummary = vi.fn(async (): Promise<SummaryResult> => ({ ok: false, code: 'unauthorized' }));
    const visibility = fakeVisibility();
    const onStop = vi.fn();
    const onSummary = vi.fn();
    const feed = createPollingFeed({ fetchSummary, intervalMs: 30_000, visibility: visibility.port, timers: browserTimers });

    feed.start(onSummary, onStop);
    await vi.advanceTimersByTimeAsync(0);
    expect(onStop).toHaveBeenCalledWith('unauthorized');

    await vi.advanceTimersByTimeAsync(300_000);
    visibility.set(false);
    visibility.set(true);
    await feed.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSummary).toHaveBeenCalledTimes(1);
    expect(onSummary).not.toHaveBeenCalled();
  });

  it('R56: un resumen vacío no detiene la consulta', async () => {
    const EMPTY: SummaryResult = { ok: true, data: { unreadCount: 0, newest: null } };
    const fetchSummary = vi.fn(async () => EMPTY);
    const visibility = fakeVisibility();
    const onStop = vi.fn();
    const summaries: NotificationSummary[] = [];
    const feed = createPollingFeed({ fetchSummary, intervalMs: 30_000, visibility: visibility.port, timers: browserTimers });

    feed.start((s) => summaries.push(s), onStop);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(fetchSummary).toHaveBeenCalledTimes(3);
    expect(onStop).not.toHaveBeenCalled();
    expect(summaries).toEqual([
      { status: 'ready', unreadCount: 0, newest: null },
      { status: 'ready', unreadCount: 0, newest: null },
      { status: 'ready', unreadCount: 0, newest: null },
    ]);
  });

  it('un error deja summary.status = error y el ciclo sigue', async () => {
    const fetchSummary = vi
      .fn<() => Promise<SummaryResult>>()
      .mockResolvedValueOnce({ ok: false, code: 'unexpected' })
      .mockRejectedValueOnce(new Error('red caída'))
      .mockResolvedValue(OK);
    const visibility = fakeVisibility();
    const summaries: NotificationSummary[] = [];
    const feed = createPollingFeed({ fetchSummary, intervalMs: 30_000, visibility: visibility.port, timers: browserTimers });

    feed.start((s) => summaries.push(s), () => {});
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(summaries.map((s) => s.status)).toEqual(['error', 'error', 'ready']);
  });

  it('la función que devuelve start para el ciclo', async () => {
    const fetchSummary = vi.fn(async () => OK);
    const visibility = fakeVisibility();
    const feed = createPollingFeed({ fetchSummary, intervalMs: 30_000, visibility: visibility.port, timers: browserTimers });

    const stop = feed.start(() => {}, () => {});
    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(300_000);
    visibility.set(true);
    expect(fetchSummary).toHaveBeenCalledTimes(1);
  });
});
