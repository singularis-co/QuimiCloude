import { z } from 'zod';

export const TAB_BUS_CHANNEL = 'qc-notificaciones';
const STORAGE_BUS_KEY = 'qc-notificaciones:bus';

const summarySchema = z.object({
  unreadCount: z.number().int().nonnegative(),
  newest: z.object({ id: z.string(), createdAt: z.string() }).nullable(),
});

const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('summary'), userId: z.string(), summary: summarySchema }),
  z.object({
    type: z.literal('read'),
    userId: z.string(),
    ids: z.union([z.literal('all'), z.array(z.string())]),
  }),
]);

export type TabMessage = z.infer<typeof messageSchema>;
export type TabPayload =
  | Omit<Extract<TabMessage, { type: 'summary' }>, 'userId'>
  | Omit<Extract<TabMessage, { type: 'read' }>, 'userId'>;

/** Un canal entre pestañas del mismo navegador. No entrega a quien publica. */
export interface TabTransport {
  post(data: unknown): void;
  listen(listener: (data: unknown) => void): () => void;
  close(): void;
}

export interface TabBus {
  publish(payload: TabPayload): void;
  subscribe(listener: (message: TabMessage) => void): () => void;
  close(): void;
}

/** Los mensajes de otro usuario (otra sesión en el mismo navegador) o mal formados se ignoran. */
export function createTabBus(deps: { userId: string; transport: TabTransport }): TabBus {
  const { userId, transport } = deps;
  return {
    publish(payload) {
      transport.post({ ...payload, userId });
    },
    subscribe(listener) {
      return transport.listen((data) => {
        const parsed = messageSchema.safeParse(data);
        if (parsed.success && parsed.data.userId === userId) listener(parsed.data);
      });
    },
    close: () => transport.close(),
  };
}

export function broadcastChannelTransport(name: string = TAB_BUS_CHANNEL): TabTransport | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  const channel = new BroadcastChannel(name);
  return {
    post: (data) => channel.postMessage(data),
    listen(listener) {
      const onMessage = (event: MessageEvent) => listener(event.data);
      channel.addEventListener('message', onMessage);
      return () => channel.removeEventListener('message', onMessage);
    },
    close: () => channel.close(),
  };
}

type StorageEventTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

/**
 * Respaldo sin `BroadcastChannel`: el evento `storage` solo llega a las otras pestañas. El sello
 * hace que dos mensajes iguales seguidos cambien el valor y disparen el evento.
 */
export function storageEventTransport(
  storage: Pick<Storage, 'setItem'>,
  target: StorageEventTarget,
): TabTransport {
  let seq = 0;
  return {
    post(data) {
      seq += 1;
      try {
        storage.setItem(STORAGE_BUS_KEY, JSON.stringify({ data, stamp: `${Date.now()}-${seq}-${Math.random()}` }));
      } catch {
        // Sin almacén no hay respaldo: cada pestaña se pone al día con su propia consulta.
        return;
      }
    },
    listen(listener) {
      const onStorage = (event: StorageEvent) => {
        if (event.key !== STORAGE_BUS_KEY || event.newValue === null) return;
        try {
          const envelope: unknown = JSON.parse(event.newValue);
          if (typeof envelope === 'object' && envelope !== null && 'data' in envelope) listener(envelope.data);
        } catch {
          return;
        }
      };
      target.addEventListener('storage', onStorage);
      return () => target.removeEventListener('storage', onStorage);
    },
    close: () => undefined,
  };
}

export function browserTabTransport(): TabTransport | null {
  if (typeof window === 'undefined') return null;
  const broadcast = broadcastChannelTransport();
  if (broadcast !== null) return broadcast;
  try {
    return storageEventTransport(window.localStorage, window);
  } catch {
    return null;
  }
}
