'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';

import {
  getNotificationSummaryAction,
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  type NotificationActionFailure,
  type NotificationActionResult,
  type NotificationBatchView,
} from '@/lib/modules/notificaciones/adapters/driving/notification-actions';

import { armChimeUnlock, browserAudioContext, createChime } from './chime';
import {
  browserLocks,
  browserStorage,
  createChimeCoordinator,
  type ChimeCoordinator,
} from './chime-coordinator';
import {
  browserTimers,
  browserVisibility,
  createPollingFeed,
  NOTIFICATION_POLL_INTERVAL_MS,
  type NewestNotificationRef,
  type NotificationFeed,
  type NotificationSummary,
} from './notification-feed';
import {
  INITIAL_LIST_STATE,
  transitionList,
  type ListEvent,
  type ListRequest,
  type NotificationListState,
} from './notification-list-state';
import { browserTabTransport, createTabBus, type TabBus, type TabMessage } from './tab-bus';

export type NotificationsActions = {
  readonly fetchBatch: (input: {
    cursor: string | null;
  }) => Promise<NotificationActionResult<NotificationBatchView>>;
  readonly markRead: (id: string) => Promise<{ readonly ok: true } | NotificationActionFailure>;
  readonly markAllRead: () => Promise<NotificationActionResult<{ readonly marked: number }>>;
};

const DEFAULT_ACTIONS: NotificationsActions = {
  fetchBatch: listNotificationsAction,
  markRead: markNotificationReadAction,
  markAllRead: markAllNotificationsReadAction,
};

export type NotificationsSummaryState = {
  readonly status: 'loading' | 'ready' | 'error';
  readonly unreadCount: number;
  /** Sube cada vez que llega un aviso nuevo tras la primera respuesta: dispara las animaciones. */
  readonly arrivals: number;
  /** Instante de la última respuesta: la hora relativa se recalcula con cada una. */
  readonly checkedAt: number | null;
};

export type NotificationsContextValue = {
  readonly summary: NotificationsSummaryState;
  readonly list: NotificationListState;
  open(): void;
  loadMore(): void;
  retryFirst(): void;
  retryMore(): void;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;
  refresh(): Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export type NotificationsProviderProps = {
  readonly userId: string;
  readonly children: ReactNode;
  /** Sin ella, consulta periódica del resumen con la pestaña visible. */
  readonly feed?: NotificationFeed;
  readonly actions?: NotificationsActions;
  /** `null` desactiva el bus entre pestañas; sin valor, el del navegador. */
  readonly bus?: TabBus | null;
  /** `null` desactiva el tono; sin valor, el del navegador. */
  readonly chime?: ChimeCoordinator | null;
};

const INITIAL_SUMMARY: NotificationsSummaryState = {
  status: 'loading',
  unreadCount: 0,
  arrivals: 0,
  checkedAt: null,
};

function isNewer(next: NewestNotificationRef, previous: NewestNotificationRef): boolean {
  if (next === null || previous === null || next.id === previous.id) return false;
  return Date.parse(next.createdAt) >= Date.parse(previous.createdAt);
}

/** Un fallo al refrescar arriba no cambia nada: lo cargado sigue y el siguiente resumen reintenta. */
function batchEvent(
  request: ListRequest,
  result: NotificationActionResult<NotificationBatchView> | null,
): ListEvent | null {
  const batch = result !== null && result.ok ? result.data : null;
  switch (request.kind) {
    case 'first':
      return batch === null ? { type: 'firstFailed' } : { type: 'firstLoaded', batch };
    case 'more':
      return batch === null
        ? { type: 'moreFailed', cursor: request.cursor }
        : { type: 'moreLoaded', cursor: request.cursor, batch };
    case 'top':
      return batch === null ? null : { type: 'topLoaded', batch };
  }
}

function defaultFeed(): NotificationFeed {
  return createPollingFeed({
    fetchSummary: getNotificationSummaryAction,
    intervalMs: NOTIFICATION_POLL_INTERVAL_MS,
    visibility: browserVisibility(),
    timers: browserTimers,
  });
}

function defaultBus(userId: string): TabBus | null {
  const transport = browserTabTransport();
  return transport === null ? null : createTabBus({ userId, transport });
}

function defaultChime(userId: string): { coordinator: ChimeCoordinator; disarm: () => void } {
  const chime = createChime(browserAudioContext);
  const coordinator = createChimeCoordinator({
    userId,
    storage: browserStorage('localStorage'),
    session: browserStorage('sessionStorage'),
    locks: browserLocks(),
    chime,
    notice: toast,
  });
  return { coordinator, disarm: armChimeUnlock(chime, window) };
}

/** Fuente única del conteo y de la lista del panel para la campana, su insignia y su nombre. */
export function NotificationsProvider({
  userId,
  children,
  feed,
  actions = DEFAULT_ACTIONS,
  bus,
  chime,
}: NotificationsProviderProps) {
  const [summary, setSummary] = useState<NotificationsSummaryState>(INITIAL_SUMMARY);
  const [list, setList] = useState<NotificationListState>(INITIAL_LIST_STATE);

  const listRef = useRef(INITIAL_LIST_STATE);
  const topInFlightRef = useRef(false);
  const actionsRef = useRef(actions);
  const feedRef = useRef<NotificationFeed | null>(null);
  const busRef = useRef<TabBus | null>(null);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  // El reductor decide qué pedir; la respuesta vuelve como otro evento.
  const dispatch = useCallback(function dispatch(event: ListEvent) {
    const { state, request } = transitionList(listRef.current, event);
    if (state !== listRef.current) {
      listRef.current = state;
      setList(state);
    }
    if (request === null) return;
    if (request.kind === 'top') {
      if (topInFlightRef.current) return;
      topInFlightRef.current = true;
    }
    const settle = (result: NotificationActionResult<NotificationBatchView> | null) => {
      if (request.kind === 'top') topInFlightRef.current = false;
      const outcome = batchEvent(request, result);
      if (outcome !== null) dispatch(outcome);
    };
    const cursor = request.kind === 'more' ? request.cursor : null;
    actionsRef.current.fetchBatch({ cursor }).then(settle, () => settle(null));
  }, []);

  useEffect(() => {
    const activeFeed = feed ?? defaultFeed();
    const activeBus = bus === undefined ? defaultBus(userId) : bus;
    const ownChime = chime === undefined ? defaultChime(userId) : null;
    const coordinator = chime === undefined ? (ownChime?.coordinator ?? null) : chime;
    feedRef.current = activeFeed;
    busRef.current = activeBus;

    let first = true;
    let lastNewest: NewestNotificationRef = null;

    const applySummary = (unreadCount: number, newest: NewestNotificationRef) => {
      const arrived = !first && unreadCount > 0 && isNewer(newest, lastNewest);
      first = false;
      if (newest !== null) lastNewest = newest;
      setSummary((prev) => ({
        status: 'ready',
        unreadCount,
        arrivals: prev.arrivals + (arrived ? 1 : 0),
        checkedAt: Date.now(),
      }));
      dispatch({ type: 'newest', newest });
    };

    const onFeedSummary = (next: NotificationSummary) => {
      if (next.status === 'error') {
        setSummary((prev) => ({ ...prev, status: 'error' }));
        return;
      }
      applySummary(next.unreadCount, next.newest);
      activeBus?.publish({
        type: 'summary',
        summary: { unreadCount: next.unreadCount, newest: next.newest },
      });
      void coordinator?.onSummary(next);
    };

    // Un resumen ajeno se aplica sin volver a consultar: si no, dos pestañas se rebotarían el
    // resumen sin fin. Un «leído» sí pide consultar, porque el conteo de esa pestaña puede diferir.
    const onTabMessage = (message: TabMessage) => {
      if (message.type === 'summary') {
        applySummary(message.summary.unreadCount, message.summary.newest);
        return;
      }
      if (message.ids === 'all') {
        dispatch({ type: 'markAllRead' });
        setSummary((prev) => ({ ...prev, unreadCount: 0 }));
      } else {
        const ids = new Set(message.ids);
        const unreadLoaded = listRef.current.items.filter((i) => ids.has(i.id) && !i.read).length;
        dispatch({ type: 'markRead', ids: message.ids });
        setSummary((prev) => ({ ...prev, unreadCount: Math.max(0, prev.unreadCount - unreadLoaded) }));
      }
      void activeFeed.refresh();
    };

    const unsubscribe = activeBus?.subscribe(onTabMessage);
    const stop = activeFeed.start(onFeedSummary, () => undefined);

    return () => {
      stop();
      unsubscribe?.();
      if (bus === undefined) activeBus?.close();
      ownChime?.disarm();
      feedRef.current = null;
      busRef.current = null;
    };
  }, [userId, feed, bus, chime, dispatch]);

  const refresh = useCallback(() => feedRef.current?.refresh() ?? Promise.resolve(), []);

  const markRead = useCallback(
    async (id: string) => {
      const wasUnread = listRef.current.items.some((item) => item.id === id && !item.read);
      dispatch({ type: 'markRead', ids: [id] });
      if (wasUnread) setSummary((prev) => ({ ...prev, unreadCount: Math.max(0, prev.unreadCount - 1) }));
      // Si falla, el siguiente resumen corrige el conteo.
      await actionsRef.current.markRead(id).catch(() => null);
      busRef.current?.publish({ type: 'read', ids: [id] });
      await refresh();
    },
    [dispatch, refresh],
  );

  const markAllRead = useCallback(async () => {
    dispatch({ type: 'markAllRead' });
    setSummary((prev) => ({ ...prev, unreadCount: 0 }));
    await actionsRef.current.markAllRead().catch(() => null);
    busRef.current?.publish({ type: 'read', ids: 'all' });
    await refresh();
  }, [dispatch, refresh]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      summary,
      list,
      open: () => dispatch({ type: 'open' }),
      loadMore: () => dispatch({ type: 'loadMore' }),
      retryFirst: () => dispatch({ type: 'retryFirst' }),
      retryMore: () => dispatch({ type: 'retryMore' }),
      markRead,
      markAllRead,
      refresh,
    }),
    [summary, list, dispatch, markRead, markAllRead, refresh],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (context === null) {
    throw new Error('useNotifications necesita un NotificationsProvider por encima');
  }
  return context;
}
