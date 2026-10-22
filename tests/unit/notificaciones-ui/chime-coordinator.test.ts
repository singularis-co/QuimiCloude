import { describe, expect, it, vi } from 'vitest';

import type { ChimeOutcome } from '@/app/(private)/components/notifications/chime';
import {
  createChimeCoordinator,
  lastKnownKey,
  SILENT_NOTICE_DESCRIPTION,
  SILENT_NOTICE_SESSION_KEY,
  SILENT_NOTICE_TITLE,
  type KeyValueStore,
  type LockPort,
} from '@/app/(private)/components/notifications/chime-coordinator';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

/** Candado en memoria compartido: las peticiones se atienden de una en una, como Web Locks. */
function memoryLocks(): LockPort {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    request(_name, callback) {
      const run = tail.then(callback);
      tail = run.catch(() => undefined);
      return run;
    },
  };
}

const at = (minute: number, id = `n${minute}`) => ({
  id,
  createdAt: new Date(Date.UTC(2026, 9, 19, 10, minute)).toISOString(),
});

function setup(overrides: { outcome?: ChimeOutcome; storage?: KeyValueStore; session?: KeyValueStore; locks?: LockPort | null } = {}) {
  const play = vi.fn(async (): Promise<ChimeOutcome> => overrides.outcome ?? 'played');
  const info = vi.fn();
  const coordinator = createChimeCoordinator({
    userId: 'u1',
    storage: overrides.storage ?? memoryStore(),
    session: overrides.session ?? memoryStore(),
    locks: overrides.locks === undefined ? memoryLocks() : overrides.locks,
    chime: { play },
    notice: { info },
  });
  return { coordinator, play, info };
}

describe('createChimeCoordinator', () => {
  it('R42: la primera respuesta de la pestaña no suena, aunque traiga no leídos', async () => {
    const { coordinator, play } = setup();
    await coordinator.onSummary({ unreadCount: 3, newest: at(5) });
    expect(play).not.toHaveBeenCalled();
  });

  it('R41: suena una vez con un newest posterior a la marca y con no leídos', async () => {
    const { coordinator, play } = setup();
    await coordinator.onSummary({ unreadCount: 3, newest: at(5) });
    await coordinator.onSummary({ unreadCount: 4, newest: at(6) });
    expect(play).toHaveBeenCalledTimes(1);

    await coordinator.onSummary({ unreadCount: 4, newest: at(6) });
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('R41: no suena sin no leídos, ni con un newest igual o anterior a la marca', async () => {
    const { coordinator, play } = setup();
    await coordinator.onSummary({ unreadCount: 1, newest: at(5) });
    await coordinator.onSummary({ unreadCount: 0, newest: at(6) });
    await coordinator.onSummary({ unreadCount: 2, newest: at(6) });
    await coordinator.onSummary({ unreadCount: 2, newest: at(4) });
    await coordinator.onSummary({ unreadCount: 2, newest: null });
    expect(play).not.toHaveBeenCalled();
  });

  it('R42: la marca es del navegador: una pestaña nueva no suena por lo que ya conocía otra', async () => {
    const storage = memoryStore();
    const a = setup({ storage });
    await a.coordinator.onSummary({ unreadCount: 1, newest: at(5) });
    await a.coordinator.onSummary({ unreadCount: 2, newest: at(6) });
    expect(JSON.parse(storage.data.get(lastKnownKey('u1')) ?? '{}')).toEqual(at(6));

    const b = setup({ storage });
    await b.coordinator.onSummary({ unreadCount: 2, newest: at(6) });
    await b.coordinator.onSummary({ unreadCount: 2, newest: at(6) });
    expect(b.play).not.toHaveBeenCalled();
  });

  it('R43: dos coordinadores con el mismo almacén y candado suenan una vez por llegada', async () => {
    const storage = memoryStore();
    const locks = memoryLocks();
    const play = vi.fn(async (): Promise<ChimeOutcome> => 'played');
    const make = () =>
      createChimeCoordinator({ userId: 'u1', storage, session: memoryStore(), locks, chime: { play }, notice: { info: vi.fn() } });
    const a = make();
    const b = make();

    await Promise.all([a.onSummary({ unreadCount: 1, newest: at(5) }), b.onSummary({ unreadCount: 1, newest: at(5) })]);
    await Promise.all([a.onSummary({ unreadCount: 2, newest: at(6) }), b.onSummary({ unreadCount: 2, newest: at(6) })]);
    expect(play).toHaveBeenCalledTimes(1);

    await Promise.all([b.onSummary({ unreadCount: 3, newest: at(7) }), a.onSummary({ unreadCount: 3, newest: at(7) })]);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('R43: sin Web Locks hace el mismo leer, comparar y escribir', async () => {
    const storage = memoryStore();
    const a = setup({ storage, locks: null });
    const b = setup({ storage, locks: null });
    await a.coordinator.onSummary({ unreadCount: 1, newest: at(5) });
    await b.coordinator.onSummary({ unreadCount: 1, newest: at(5) });
    await a.coordinator.onSummary({ unreadCount: 2, newest: at(6) });
    await b.coordinator.onSummary({ unreadCount: 2, newest: at(6) });
    expect(a.play.mock.calls.length + b.play.mock.calls.length).toBe(1);
  });

  it('R45: sin audio muestra el toast con su texto y botón de cerrar, una vez por sesión, sin lanzar', async () => {
    const session = memoryStore();
    const { coordinator, info } = setup({ outcome: 'unavailable', session });
    await coordinator.onSummary({ unreadCount: 1, newest: at(5) });
    await expect(coordinator.onSummary({ unreadCount: 2, newest: at(6) })).resolves.toBeUndefined();
    await coordinator.onSummary({ unreadCount: 3, newest: at(7) });

    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith('Notificaciones sin sonido', {
      description: 'Tu navegador no permite reproducir audio en esta página. Los avisos siguen llegando.',
      closeButton: true,
    });
    expect(SILENT_NOTICE_TITLE).toBe('Notificaciones sin sonido');
    expect(SILENT_NOTICE_DESCRIPTION).toMatch(/Los avisos siguen llegando/);
    expect(session.data.get(SILENT_NOTICE_SESSION_KEY)).toBe('1');

    const otherTab = setup({ outcome: 'unavailable', session });
    await otherTab.coordinator.onSummary({ unreadCount: 3, newest: at(7) });
    await otherTab.coordinator.onSummary({ unreadCount: 4, newest: at(8) });
    expect(otherTab.info).not.toHaveBeenCalled();
  });

  it('R45: el toast solo sale cuando de verdad tocaba sonar', async () => {
    const { coordinator, info } = setup({ outcome: 'unavailable' });
    await coordinator.onSummary({ unreadCount: 1, newest: at(5) });
    await coordinator.onSummary({ unreadCount: 0, newest: at(6) });
    expect(info).not.toHaveBeenCalled();
  });

  it('R45: un almacén que lanza o un tono que falla no lanzan', async () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const play = vi.fn(async (): Promise<ChimeOutcome> => {
      throw new Error('fallo');
    });
    const coordinator = createChimeCoordinator({
      userId: 'u1',
      storage: broken,
      session: broken,
      locks: null,
      chime: { play },
      notice: { info: vi.fn() },
    });
    await coordinator.onSummary({ unreadCount: 1, newest: at(5) });
    await expect(coordinator.onSummary({ unreadCount: 2, newest: at(6) })).resolves.toBeUndefined();
    expect(play).toHaveBeenCalledTimes(1);
  });
});
