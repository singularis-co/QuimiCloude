import { describe, expect, it } from 'vitest';

import {
  INITIAL_LIST_STATE,
  transitionList,
  type ListEvent,
  type NotificationListState,
} from '@/app/(private)/components/notifications/notification-list-state';
import type { NotificationView } from '@/lib/modules/notificaciones/adapters/driving/notification-actions';

function item(n: number, read = false): NotificationView {
  return {
    id: `n${n}`,
    tone: 'success',
    title: `Aviso ${n}`,
    body: 'Se leyó el archivo de la tanda que subiste a las {hora}.',
    bodyTime: '2026-10-19T10:00:00.000Z',
    linkLabel: 'Ver fórmulas',
    href: '/formulas',
    createdAt: new Date(Date.UTC(2026, 9, 19, 10, 0, n)).toISOString(),
    read,
  };
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => item(to - i));

function run(events: ListEvent[], start: NotificationListState = INITIAL_LIST_STATE) {
  return events.reduce((state, event) => transitionList(state, event).state, start);
}

const loaded = (items: NotificationView[], nextCursor: string | null) =>
  run([{ type: 'open' }, { type: 'firstLoaded', batch: { items, nextCursor } }]);

describe('transitionList — primer lote', () => {
  it('R33: abrir pasa a loading y pide el primer lote; con la respuesta pasa a ready', () => {
    const opened = transitionList(INITIAL_LIST_STATE, { type: 'open' });
    expect(opened.state.status).toBe('loading');
    expect(opened.request).toEqual({ kind: 'first' });

    const ready = transitionList(opened.state, { type: 'firstLoaded', batch: { items: range(11, 20), nextCursor: 'c1' } });
    expect(ready.state.status).toBe('ready');
    expect(ready.state.items.map((i) => i.id)).toEqual(range(11, 20).map((i) => i.id));
    expect(ready.request).toBeNull();
  });

  it('R33: abrir otra vez con loading no pide nada', () => {
    const opened = transitionList(INITIAL_LIST_STATE, { type: 'open' }).state;
    expect(transitionList(opened, { type: 'open' }).request).toBeNull();
  });

  it('R33: un fallo deja status = error y retryFirst vuelve a pedir el primer lote', () => {
    const failed = run([{ type: 'open' }, { type: 'firstFailed' }]);
    expect(failed.status).toBe('error');

    const retried = transitionList(failed, { type: 'retryFirst' });
    expect(retried.state.status).toBe('loading');
    expect(retried.request).toEqual({ kind: 'first' });
    expect(transitionList(retried.state, { type: 'retryFirst' }).request).toBeNull();
  });

  it('R33: sin avisos queda ready con la lista vacía y el final en end', () => {
    const empty = loaded([], null);
    expect(empty.status).toBe('ready');
    expect(empty.items).toEqual([]);
    expect(empty.tail).toBe('end');
  });
});

describe('transitionList — lotes siguientes', () => {
  it('R25: loadMore con tail = more pasa a loading y pide con el cursor del final', () => {
    const state = loaded(range(11, 20), 'c1');
    expect(state.tail).toBe('more');
    const next = transitionList(state, { type: 'loadMore' });
    expect(next.state.tail).toBe('loading');
    expect(next.request).toEqual({ kind: 'more', cursor: 'c1' });
  });

  it('R25: un segundo loadMore con el lote en vuelo no pide nada', () => {
    const inFlight = transitionList(loaded(range(11, 20), 'c1'), { type: 'loadMore' }).state;
    const again = transitionList(inFlight, { type: 'loadMore' });
    expect(again.request).toBeNull();
    expect(again.state).toBe(inFlight);
  });

  it('R25: el lote siguiente se añade al final, en orden, y marca sus ids para el fundido', () => {
    const state = run(
      [{ type: 'loadMore' }, { type: 'moreLoaded', cursor: 'c1', batch: { items: range(1, 10), nextCursor: 'c2' } }],
      loaded(range(11, 20), 'c1'),
    );
    expect(state.items.map((i) => i.id)).toEqual(range(1, 20).map((i) => i.id));
    expect(state.moreIds).toEqual(range(1, 10).map((i) => i.id));
    expect(state.cursor).toBe('c2');
    expect(state.tail).toBe('more');
  });

  it('R26: un fallo deja tail = error con los avisos intactos, y retryMore pide con el mismo cursor', () => {
    const before = loaded(range(11, 20), 'c1');
    const failed = run([{ type: 'loadMore' }, { type: 'moreFailed', cursor: 'c1' }], before);
    expect(failed.tail).toBe('error');
    expect(failed.items).toEqual(before.items);

    expect(transitionList(failed, { type: 'loadMore' }).request).toBeNull();
    const retried = transitionList(failed, { type: 'retryMore' });
    expect(retried.state.tail).toBe('loading');
    expect(retried.request).toEqual({ kind: 'more', cursor: 'c1' });
  });

  it('R27: nextCursor = null deja tail = end y no pide más', () => {
    const state = run(
      [{ type: 'loadMore' }, { type: 'moreLoaded', cursor: 'c1', batch: { items: range(8, 10), nextCursor: null } }],
      loaded(range(11, 20), 'c1'),
    );
    expect(state.tail).toBe('end');
    expect(transitionList(state, { type: 'loadMore' }).request).toBeNull();
    expect(loaded(range(1, 3), null).tail).toBe('end');
  });
});

describe('transitionList — avisos nuevos arriba', () => {
  it('R28: un newest que no es el primero de la lista pide el primer lote; si ya lo es, no', () => {
    const state = loaded(range(11, 20), 'c1');
    expect(transitionList(state, { type: 'newest', newest: { id: 'n21', createdAt: 'x' } }).request).toEqual({ kind: 'top' });
    expect(transitionList(state, { type: 'newest', newest: { id: 'n20', createdAt: 'x' } }).request).toBeNull();
    expect(transitionList(INITIAL_LIST_STATE, { type: 'newest', newest: { id: 'n21', createdAt: 'x' } }).request).toBeNull();
  });

  it('R28: la mezcla arriba no duplica ids, pone los nuevos arriba y no toca el cursor del final', () => {
    const state = loaded(range(11, 20), 'c1');
    const merged = transitionList(state, { type: 'topLoaded', batch: { items: range(13, 22), nextCursor: 'otro' } }).state;
    const ids = merged.items.map((i) => i.id);
    expect(ids).toEqual(range(11, 22).map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(merged.freshIds).toEqual(['n22', 'n21']);
    expect(merged.cursor).toBe('c1');
    expect(merged.tail).toBe('more');
  });

  it('R28: un primer lote sin solape sustituye la lista y su cursor', () => {
    const state = loaded(range(11, 20), 'c1');
    const replaced = transitionList(state, { type: 'topLoaded', batch: { items: range(31, 40), nextCursor: 'c9' } }).state;
    expect(replaced.items.map((i) => i.id)).toEqual(range(31, 40).map((i) => i.id));
    expect(replaced.cursor).toBe('c9');
    expect(replaced.tail).toBe('more');
  });

  it('R28: la respuesta de un lote siguiente pedido antes de sustituir la lista se descarta', () => {
    const inFlight = transitionList(loaded(range(11, 20), 'c1'), { type: 'loadMore' }).state;
    const replaced = transitionList(inFlight, { type: 'topLoaded', batch: { items: range(31, 40), nextCursor: 'c9' } }).state;
    const late = transitionList(replaced, { type: 'moreLoaded', cursor: 'c1', batch: { items: range(1, 10), nextCursor: 'c2' } }).state;
    expect(late).toBe(replaced);
  });
});

describe('transitionList — marcar', () => {
  it('R32: marcar todos deja todos los cargados en read: true', () => {
    const state = run([{ type: 'markAllRead' }], loaded([item(3), item(2, true), item(1)], null));
    expect(state.items.every((i) => i.read)).toBe(true);
  });

  it('R31: marcar uno solo cambia ese', () => {
    const state = run([{ type: 'markRead', ids: ['n2'] }], loaded([item(3), item(2), item(1)], null));
    expect(state.items.map((i) => i.read)).toEqual([false, true, false]);
  });
});
