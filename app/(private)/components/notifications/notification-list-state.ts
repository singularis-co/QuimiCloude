import type {
  NotificationBatchView,
  NotificationView,
} from '@/lib/modules/notificaciones/adapters/driving/notification-actions';

import type { NewestNotificationRef } from './notification-feed';

export type ListStatus = 'idle' | 'loading' | 'ready' | 'error';
export type ListTail = 'more' | 'loading' | 'error' | 'end';

export type NotificationListState = {
  readonly status: ListStatus;
  readonly items: readonly NotificationView[];
  readonly tail: ListTail;
  /** Cursor del final de la lista: el lote siguiente empieza ahí. */
  readonly cursor: string | null;
  /** Los que entraron arriba en la última mezcla, para animar su llegada. */
  readonly freshIds: readonly string[];
  /** Los que llegaron con el último lote del final, para su fundido. */
  readonly moreIds: readonly string[];
};

/** `first` y `top` piden lo mismo (sin cursor); cambia qué se hace con la respuesta. */
export type ListRequest =
  | { readonly kind: 'first' }
  | { readonly kind: 'top' }
  | { readonly kind: 'more'; readonly cursor: string };

export type ListEvent =
  | { readonly type: 'open' }
  | { readonly type: 'retryFirst' }
  | { readonly type: 'firstLoaded'; readonly batch: NotificationBatchView }
  | { readonly type: 'firstFailed' }
  | { readonly type: 'loadMore' }
  | { readonly type: 'retryMore' }
  | { readonly type: 'moreLoaded'; readonly cursor: string; readonly batch: NotificationBatchView }
  | { readonly type: 'moreFailed'; readonly cursor: string }
  | { readonly type: 'newest'; readonly newest: NewestNotificationRef }
  | { readonly type: 'topLoaded'; readonly batch: NotificationBatchView }
  | { readonly type: 'markRead'; readonly ids: readonly string[] }
  | { readonly type: 'markAllRead' };

export type ListTransition = {
  readonly state: NotificationListState;
  readonly request: ListRequest | null;
};

export const INITIAL_LIST_STATE: NotificationListState = {
  status: 'idle',
  items: [],
  tail: 'end',
  cursor: null,
  freshIds: [],
  moreIds: [],
};

const stay = (state: NotificationListState): ListTransition => ({ state, request: null });

function fromBatch(batch: NotificationBatchView): NotificationListState {
  return {
    status: 'ready',
    items: batch.items,
    tail: batch.nextCursor === null ? 'end' : 'more',
    cursor: batch.nextCursor,
    freshIds: [],
    moreIds: [],
  };
}

function mergeTop(state: NotificationListState, batch: NotificationBatchView): NotificationListState {
  const known = new Set(state.items.map((item) => item.id));
  const overlaps = batch.items.some((item) => known.has(item.id));
  // Sin ningún id en común llegaron más de un lote entre dos consultas: mezclar dejaría un hueco.
  if (!overlaps) return { ...fromBatch(batch), freshIds: batch.items.map((item) => item.id) };

  const inBatch = new Set(batch.items.map((item) => item.id));
  return {
    ...state,
    items: [...batch.items, ...state.items.filter((item) => !inBatch.has(item.id))],
    freshIds: batch.items.filter((item) => !known.has(item.id)).map((item) => item.id),
    moreIds: [],
  };
}

function appendMore(
  state: NotificationListState,
  batch: NotificationBatchView,
): NotificationListState {
  const known = new Set(state.items.map((item) => item.id));
  const added = batch.items.filter((item) => !known.has(item.id));
  return {
    ...state,
    items: [...state.items, ...added],
    tail: batch.nextCursor === null ? 'end' : 'more',
    cursor: batch.nextCursor,
    freshIds: [],
    moreIds: added.map((item) => item.id),
  };
}

function markRead(
  state: NotificationListState,
  isTarget: (item: NotificationView) => boolean,
): NotificationListState {
  return {
    ...state,
    items: state.items.map((item) => (!item.read && isTarget(item) ? { ...item, read: true } : item)),
  };
}

/**
 * Reductor puro de la lista del panel. Devuelve el estado siguiente y, si toca, la petición que
 * hay que hacer: quien lo usa no decide cuándo pedir, así nunca hay dos lotes en vuelo.
 */
export function transitionList(state: NotificationListState, event: ListEvent): ListTransition {
  switch (event.type) {
    case 'open':
      if (state.status === 'idle' || state.status === 'error') {
        return { state: { ...state, status: 'loading' }, request: { kind: 'first' } };
      }
      return state.status === 'ready' ? { state, request: { kind: 'top' } } : stay(state);

    case 'retryFirst':
      return state.status === 'error'
        ? { state: { ...state, status: 'loading' }, request: { kind: 'first' } }
        : stay(state);

    case 'firstLoaded':
      return state.status === 'loading' ? stay(fromBatch(event.batch)) : stay(state);

    case 'firstFailed':
      return state.status === 'loading' ? stay({ ...state, status: 'error' }) : stay(state);

    case 'loadMore':
      if (state.status !== 'ready' || state.tail !== 'more' || state.cursor === null) return stay(state);
      return { state: { ...state, tail: 'loading' }, request: { kind: 'more', cursor: state.cursor } };

    case 'retryMore':
      if (state.status !== 'ready' || state.tail !== 'error' || state.cursor === null) return stay(state);
      return { state: { ...state, tail: 'loading' }, request: { kind: 'more', cursor: state.cursor } };

    case 'moreLoaded':
      // Una respuesta de un cursor que ya no es el del final (la lista se sustituyó) se descarta.
      if (state.tail !== 'loading' || state.cursor !== event.cursor) return stay(state);
      return stay(appendMore(state, event.batch));

    case 'moreFailed':
      if (state.tail !== 'loading' || state.cursor !== event.cursor) return stay(state);
      return stay({ ...state, tail: 'error' });

    case 'newest':
      if (state.status !== 'ready' || event.newest === null) return stay(state);
      return event.newest.id === state.items[0]?.id ? stay(state) : { state, request: { kind: 'top' } };

    case 'topLoaded':
      return state.status === 'ready' ? stay(mergeTop(state, event.batch)) : stay(state);

    case 'markRead': {
      const ids = new Set(event.ids);
      return stay(markRead(state, (item) => ids.has(item.id)));
    }

    case 'markAllRead':
      return stay(markRead(state, () => true));
  }
}
