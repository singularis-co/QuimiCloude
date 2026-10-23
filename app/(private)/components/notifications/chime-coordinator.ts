import type { ChimeOutcome } from './chime';
import type { NewestNotificationRef } from './notification-feed';

export const SILENT_NOTICE_TITLE = 'Notificaciones sin sonido';
export const SILENT_NOTICE_DESCRIPTION =
  'Tu navegador no permite reproducir audio en esta página. Los avisos siguen llegando.';

export const CHIME_LOCK_NAME = 'qc-notificaciones-tono';
export const SILENT_NOTICE_SESSION_KEY = 'qc-notificaciones:sin-sonido';
export const lastKnownKey = (userId: string) => `qc-notificaciones:ultimo:${userId}`;

export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type LockPort = {
  request(name: string, callback: () => Promise<void>): Promise<unknown>;
};

export type SilentNoticePort = {
  info(title: string, options: { description: string; closeButton: boolean }): unknown;
};

export type ChimeCoordinatorDeps = {
  readonly userId: string;
  /** Compartido por las pestañas del navegador (`localStorage`). */
  readonly storage: KeyValueStore | null;
  /** De esta sesión del navegador (`sessionStorage`). */
  readonly session: KeyValueStore | null;
  readonly locks: LockPort | null;
  readonly chime: { play(): Promise<ChimeOutcome> };
  readonly notice: SilentNoticePort;
};

export type ChimeSummary = {
  readonly unreadCount: number;
  readonly newest: NewestNotificationRef;
};

export interface ChimeCoordinator {
  onSummary(summary: ChimeSummary): Promise<void>;
}

type Mark = { readonly createdAt: string; readonly id: string };

function isMark(value: unknown): value is Mark {
  if (typeof value !== 'object' || value === null) return false;
  const { createdAt, id } = value as Record<string, unknown>;
  return typeof createdAt === 'string' && typeof id === 'string';
}

// Un almacén bloqueado (modo privado de Safari) lanza al leer o escribir: se trata como vacío y la
// pestaña sigue con su copia en memoria.
function readItem(store: KeyValueStore | null, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeItem(store: KeyValueStore | null, key: string, value: string): void {
  try {
    store?.setItem(key, value);
  } catch {
    return;
  }
}

function readMark(storage: KeyValueStore | null, key: string): Mark | null {
  const raw = readItem(storage, key);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isMark(parsed) ? { createdAt: parsed.createdAt, id: parsed.id } : null;
  } catch {
    return null;
  }
}

const readFlag = (store: KeyValueStore | null, key: string) => readItem(store, key) !== null;
const writeFlag = (store: KeyValueStore | null, key: string) => writeItem(store, key, '1');
const writeMark = (store: KeyValueStore | null, key: string, mark: Mark) =>
  writeItem(store, key, JSON.stringify(mark));

/** Mismo orden que la bandeja: por fecha y, a igual fecha, por id. */
function isAfter(candidate: Mark, mark: Mark | null): boolean {
  if (mark === null) return true;
  const a = Date.parse(candidate.createdAt);
  const b = Date.parse(mark.createdAt);
  if (a !== b) return a > b;
  return candidate.id > mark.id;
}

/**
 * Decide si una llegada suena. La marca del último aviso conocido es del navegador, no de la
 * pestaña, y el candado hace atómico el «leer, comparar y escribir»: así suena una sola pestaña.
 */
export function createChimeCoordinator(deps: ChimeCoordinatorDeps): ChimeCoordinator {
  const key = lastKnownKey(deps.userId);
  let first = true;
  let memory: Mark | null = null;

  const current = () => readMark(deps.storage, key) ?? memory;
  const advance = (mark: Mark) => {
    memory = mark;
    writeMark(deps.storage, key, mark);
  };

  let warned = false;
  const warnSilentOnce = () => {
    if (warned || readFlag(deps.session, SILENT_NOTICE_SESSION_KEY)) return;
    warned = true;
    writeFlag(deps.session, SILENT_NOTICE_SESSION_KEY);
    deps.notice.info(SILENT_NOTICE_TITLE, { description: SILENT_NOTICE_DESCRIPTION, closeButton: true });
  };

  const claimAndPlay = async (newest: Mark) => {
    if (!isAfter(newest, current())) return;
    advance(newest);
    const outcome = await deps.chime.play();
    if (outcome === 'unavailable') warnSilentOnce();
  };

  return {
    async onSummary(summary) {
      const newest = summary.newest;
      try {
        if (first) {
          first = false;
          if (newest !== null && isAfter(newest, current())) advance(newest);
          return;
        }
        if (newest === null || !isAfter(newest, current())) return;
        if (summary.unreadCount === 0) {
          advance(newest);
          return;
        }
        if (deps.locks === null) await claimAndPlay(newest);
        else await deps.locks.request(CHIME_LOCK_NAME, () => claimAndPlay(newest));
      } catch {
        // El tono es accesorio: un fallo aquí no puede cortar la actualización del conteo.
        return;
      }
    },
  };
}

export function browserLocks(): LockPort | null {
  if (typeof navigator === 'undefined' || navigator.locks === undefined) return null;
  const locks = navigator.locks;
  return { request: (name, callback) => locks.request(name, () => callback()) };
}

export function browserStorage(kind: 'localStorage' | 'sessionStorage'): KeyValueStore | null {
  try {
    return typeof window === 'undefined' ? null : window[kind];
  } catch {
    return null;
  }
}
