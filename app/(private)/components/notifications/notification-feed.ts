import type {
  NotificationActionResult,
  NotificationSummaryView,
} from '@/lib/modules/notificaciones/adapters/driving/notification-actions';

export const NOTIFICATION_POLL_INTERVAL_MS = 30_000;

export type NewestNotificationRef = NotificationSummaryView['newest'];

export type NotificationSummary =
  | { readonly status: 'ready'; readonly unreadCount: number; readonly newest: NewestNotificationRef }
  | { readonly status: 'error' };

export type FeedStopReason = 'unauthorized';

export interface NotificationFeed {
  start(
    onSummary: (summary: NotificationSummary) => void,
    onStop: (reason: FeedStopReason) => void,
  ): () => void;
  /** Pide ya, sin esperar al siguiente turno. Con la pestaña oculta no hace nada. */
  refresh(): Promise<void>;
}

export interface VisibilityPort {
  isVisible(): boolean;
  subscribe(listener: () => void): () => void;
}

export interface TimerPort {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export type PollingFeedDeps = {
  readonly fetchSummary: () => Promise<NotificationActionResult<NotificationSummaryView>>;
  readonly intervalMs: number;
  readonly visibility: VisibilityPort;
  readonly timers: TimerPort;
};

type Outcome =
  | { readonly kind: 'summary'; readonly summary: NotificationSummary }
  | { readonly kind: 'stop'; readonly reason: FeedStopReason };

async function fetchOnce(fetchSummary: PollingFeedDeps['fetchSummary']): Promise<Outcome> {
  try {
    const result = await fetchSummary();
    if (result.ok) {
      return {
        kind: 'summary',
        summary: { status: 'ready', unreadCount: result.data.unreadCount, newest: result.data.newest },
      };
    }
    if (result.code === 'unauthorized') {
      return { kind: 'stop', reason: result.code };
    }
    return { kind: 'summary', summary: { status: 'error' } };
  } catch {
    // Una acción que no llega al servidor (red caída) cuenta como un error más: el ciclo sigue.
    return { kind: 'summary', summary: { status: 'error' } };
  }
}

/**
 * El siguiente turno se programa al terminar la consulta, nunca con un intervalo fijo: un servidor
 * lento no acumula consultas en vuelo.
 */
export function createPollingFeed(deps: PollingFeedDeps): NotificationFeed {
  const { fetchSummary, intervalMs, visibility, timers } = deps;

  let active = false;
  let timer: unknown = null;
  let inFlight: Promise<void> | null = null;
  let again = false;
  let handlers: {
    onSummary: (summary: NotificationSummary) => void;
    onStop: (reason: FeedStopReason) => void;
  } | null = null;
  let unsubscribe: (() => void) | null = null;

  const clearTimer = () => {
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
  };

  const stop = () => {
    active = false;
    clearTimer();
    unsubscribe?.();
    unsubscribe = null;
  };

  const cycle = async (): Promise<void> => {
    do {
      again = false;
      const outcome = await fetchOnce(fetchSummary);
      if (!active || handlers === null) return;
      if (outcome.kind === 'stop') {
        const { onStop } = handlers;
        stop();
        onStop(outcome.reason);
        return;
      }
      handlers.onSummary(outcome.summary);
    } while (again && active && visibility.isVisible());

    if (active && visibility.isVisible()) {
      timer = timers.setTimeout(() => {
        timer = null;
        void run();
      }, intervalMs);
    }
  };

  const run = (): Promise<void> => {
    if (!active || !visibility.isVisible()) return Promise.resolve();
    if (inFlight !== null) {
      again = true;
      return inFlight;
    }
    clearTimer();
    inFlight = cycle().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  return {
    start(onSummary, onStop) {
      handlers = { onSummary, onStop };
      active = true;
      unsubscribe = visibility.subscribe(() => {
        if (visibility.isVisible()) void run();
        else clearTimer();
      });
      void run();
      return stop;
    },
    refresh: run,
  };
}

export function browserVisibility(doc: Document = document): VisibilityPort {
  return {
    isVisible: () => doc.visibilityState === 'visible',
    subscribe(listener) {
      doc.addEventListener('visibilitychange', listener);
      return () => doc.removeEventListener('visibilitychange', listener);
    },
  };
}

export const browserTimers: TimerPort = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};
