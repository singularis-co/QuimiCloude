import type {
  WhatsappChatResult,
  WhatsappConversationListResult,
} from '@/lib/modules/integraciones/adapters/driving/whatsapp-conversation-actions';
import type { WhatsappChat, WhatsappConversationList } from '@/lib/modules/integraciones';

import { CHAT_PAGE_SIZE } from './chat-timeline';
import type { ChatTarget } from './chat-view';
import { CONVERSATIONS_PAGE_SIZE } from './conversation-list-state';

export const CONTACTS_POLL_INTERVAL_MS = 8_000;

export interface VisibilityPort {
  isVisible(): boolean;
  subscribe(listener: () => void): () => void;
}

export interface TimerPort {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export type ContactsPollQuery = {
  readonly search: string;
  readonly chat: { readonly target: ChatTarget; readonly knownMessageIds: ReadonlySet<string> } | null;
};

export type ContactsPollTick = {
  /** `null` si la lista falló en este turno: se sigue mostrando la anterior. */
  readonly list: WhatsappConversationList | null;
  readonly chat: {
    readonly target: ChatTarget;
    readonly chat: WhatsappChat;
    /** Hay entrantes que la pantalla no tenía y la pestaña sigue visible. */
    readonly hasNewInbound: boolean;
  } | null;
};

export type ContactsPollStopReason = 'unauthorized';

export type ContactsPollerDeps = {
  readonly listConversations: (input: {
    search: string;
    page: number;
    pageSize: number;
  }) => Promise<WhatsappConversationListResult>;
  readonly getChat: (input: { target: ChatTarget; pageSize: number }) => Promise<WhatsappChatResult>;
  readonly currentQuery: () => ContactsPollQuery;
  readonly visibility: VisibilityPort;
  readonly timers: TimerPort;
  readonly intervalMs?: number;
};

export interface ContactsPoller {
  start(onTick: (tick: ContactsPollTick) => void, onStop: (reason: ContactsPollStopReason) => void): () => void;
  /** Consulta ya, sin esperar al turno. Con la pestaña oculta no hace nada. */
  refresh(): Promise<void>;
}

type Settled<T> = { readonly kind: 'data'; readonly data: T } | { readonly kind: 'failed' } | { readonly kind: 'stop' };

// Una acción que no llega al servidor (red caída) cuenta como un fallo más del turno: el ciclo sigue.
async function settle<T>(request: () => Promise<{ status: 'success'; data: T } | { status: 'error'; code: string }>): Promise<Settled<T>> {
  try {
    const result = await request();
    if (result.status === 'success') return { kind: 'data', data: result.data };
    return result.code === 'unauthorized' ? { kind: 'stop' } : { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  }
}

function hasNewInbound(chat: WhatsappChat, known: ReadonlySet<string>): boolean {
  return chat.messages.some((message) => message.direction === 'IN' && !known.has(message.id));
}

type Outcome = { readonly kind: 'tick'; readonly tick: ContactsPollTick } | { readonly kind: 'stop' };

async function pollOnce(deps: ContactsPollerDeps): Promise<Outcome> {
  const query = deps.currentQuery();
  const openChat = query.chat;
  const [list, chat] = await Promise.all([
    settle(() => deps.listConversations({ search: query.search, page: 1, pageSize: CONVERSATIONS_PAGE_SIZE })),
    openChat === null
      ? Promise.resolve(null)
      : settle(() => deps.getChat({ target: openChat.target, pageSize: CHAT_PAGE_SIZE })),
  ]);
  if (list.kind === 'stop' || chat?.kind === 'stop') return { kind: 'stop' };
  return {
    kind: 'tick',
    tick: {
      list: list.kind === 'data' ? list.data : null,
      chat:
        openChat === null || chat === null || chat.kind !== 'data'
          ? null
          : {
              target: openChat.target,
              chat: chat.data,
              hasNewInbound: deps.visibility.isVisible() && hasNewInbound(chat.data, openChat.knownMessageIds),
            },
    },
  };
}

/** El turno siguiente se programa al terminar la consulta: un servidor lento no acumula consultas en vuelo. */
export function createContactsPoller(deps: ContactsPollerDeps): ContactsPoller {
  const { visibility, timers } = deps;
  const intervalMs = deps.intervalMs ?? CONTACTS_POLL_INTERVAL_MS;

  let active = false;
  let timer: unknown = null;
  let inFlight: Promise<void> | null = null;
  let again = false;
  let handlers: {
    onTick: (tick: ContactsPollTick) => void;
    onStop: (reason: ContactsPollStopReason) => void;
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
      const outcome = await pollOnce(deps);
      if (!active || handlers === null) return;
      if (outcome.kind === 'stop') {
        const { onStop } = handlers;
        stop();
        onStop('unauthorized');
        return;
      }
      handlers.onTick(outcome.tick);
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
    start(onTick, onStop) {
      handlers = { onTick, onStop };
      active = true;
      unsubscribe = visibility.subscribe(() => {
        if (visibility.isVisible()) void run();
        else clearTimer();
      });
      // La primera página y el chat ya llegan del servidor con la página: el primer turno espera.
      clearTimer();
      timer = visibility.isVisible()
        ? timers.setTimeout(() => {
            timer = null;
            void run();
          }, intervalMs)
        : null;
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
