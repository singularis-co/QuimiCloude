import { formatDaySeparator, localDayKey } from './chat-time-format';

export const CHAT_PAGE_SIZE = 30;

type Timed = { readonly id: string; readonly at: string };

export type ChatTimelineEntry<T extends Timed> =
  | { readonly kind: 'day'; readonly key: string; readonly label: string }
  | { readonly kind: 'message'; readonly key: string; readonly message: T };

// Orden estable: con el mismo instante se respeta el orden en que llegaron.
function sortByTime<T extends Timed>(messages: readonly T[]): T[] {
  return messages
    .map((message, index) => ({ message, index, at: Date.parse(message.at) }))
    .sort((a, b) => a.at - b.at || a.index - b.index)
    .map((entry) => entry.message);
}

function unionById<T extends Timed>(base: readonly T[], winners: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const message of base) byId.set(message.id, message);
  for (const message of winners) byId.set(message.id, message);
  return sortByTime([...byId.values()]);
}

/** Lo que llega de una consulta nueva reemplaza a lo que ya había con el mismo id. */
export function mergeLatestMessages<T extends Timed>(current: readonly T[], latest: readonly T[]): T[] {
  return unionById(current, latest);
}

/** Lo ya cargado es más fresco que una página de anteriores: con el mismo id se queda lo cargado. */
export function prependOlderMessages<T extends Timed>(current: readonly T[], older: readonly T[]): T[] {
  return unionById(older, current);
}

export function withDaySeparators<T extends Timed>(messages: readonly T[], now: Date): ChatTimelineEntry<T>[] {
  const entries: ChatTimelineEntry<T>[] = [];
  let previousDay: string | null = null;
  for (const message of messages) {
    const day = localDayKey(message.at);
    if (day !== previousDay) {
      entries.push({ kind: 'day', key: `day:${day}`, label: formatDaySeparator(message.at, now) });
      previousDay = day;
    }
    entries.push({ kind: 'message', key: message.id, message });
  }
  return entries;
}
