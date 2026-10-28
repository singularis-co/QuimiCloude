'use client';

import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';

import { Spinner } from '@/components/shared/spinner';
import { cn } from '@/lib/utils';

import { ChatMessage } from './chat-message';
import { withDaySeparators } from './chat-timeline';
import type { ChatMessageView } from './chat-view';
import {
  CHAT_DAY_SEPARATOR_TESTID,
  CHAT_HISTORY_TEXT,
  CHAT_MESSAGE_LIST_TESTID,
  CHAT_OLDER_SENTINEL_TESTID,
} from './contact-texts';
import { useEndSentinel } from './use-end-sentinel';

/** Distancia al fondo, en px, por debajo de la cual se considera que el usuario está al final. */
export const CHAT_BOTTOM_THRESHOLD_PX = 48;

export type ChatMessageListProps = {
  /** Mensajes ya unidos y ordenados de más antiguo a más reciente. */
  readonly messages: readonly ChatMessageView[];
  /** Referencia para los separadores «Hoy» / «Ayer». */
  readonly now: Date;
  /** Cursor de la página anterior; `null` cuando no quedan mensajes más antiguos. */
  readonly nextCursor: string | null;
  /** Hay una página de anteriores en camino. */
  readonly loadingOlder: boolean;
  readonly onLoadOlder: (cursor: string) => void;
  readonly customerName: string;
  readonly canSend: boolean;
  readonly onRetry: (messageId: string) => void;
  readonly className?: string;
};

type Edges = { readonly first: string | null; readonly last: string | null };

function edgesOf(messages: readonly ChatMessageView[]): Edges {
  return { first: messages[0]?.id ?? null, last: messages.at(-1)?.id ?? null };
}

/**
 * Historial del chat. Monta una instancia por chat (`key` con el contacto): la posición inicial
 * al final solo se aplica al montar.
 */
export function ChatMessageList({
  messages,
  now,
  nextCursor,
  loadingOlder,
  onLoadOlder,
  customerName,
  canSend,
  onRetry,
  className,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Se miden en cada scroll y tras cada render: en el layout effect el DOM ya trae los mensajes
  // nuevos, así que la medida previa tiene que estar guardada de antes.
  const fromBottomRef = useRef(0);
  const atBottomRef = useRef(true);
  const edgesRef = useRef<Edges | null>(null);

  const entries = useMemo(() => withDaySeparators(messages, now), [messages, now]);

  const measure = useCallback(() => {
    const element = scrollRef.current;
    if (element === null) return;
    fromBottomRef.current = element.scrollHeight - element.scrollTop;
    atBottomRef.current = fromBottomRef.current - element.clientHeight < CHAT_BOTTOM_THRESHOLD_PX;
  }, []);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element === null) return;
    const previous = edgesRef.current;
    const current = edgesOf(messages);

    if (previous === null) {
      element.scrollTop = element.scrollHeight;
    } else {
      if (current.first !== previous.first) element.scrollTop = element.scrollHeight - fromBottomRef.current;
      if (current.last !== previous.last && atBottomRef.current) element.scrollTop = element.scrollHeight;
    }

    edgesRef.current = current;
    measure();
  }, [messages, measure]);

  const loadOlder = useCallback(() => {
    if (nextCursor !== null) onLoadOlder(nextCursor);
  }, [nextCursor, onLoadOlder]);

  const sentinelRef = useEndSentinel<HTMLDivElement>({
    onVisible: loadOlder,
    enabled: nextCursor !== null && !loadingOlder,
  });

  return (
    <div
      ref={scrollRef}
      onScroll={measure}
      data-testid={CHAT_MESSAGE_LIST_TESTID}
      className={cn('flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-4 py-4 md:px-6', className)}
    >
      {nextCursor !== null && (
        <div ref={sentinelRef} data-testid={CHAT_OLDER_SENTINEL_TESTID} aria-hidden="true" className="h-px shrink-0" />
      )}
      {loadingOlder && (
        <div role="status" className="flex items-center gap-1.5 self-center text-xs text-muted-foreground">
          <Spinner size="sm" />
          {CHAT_HISTORY_TEXT.loadingOlder}
        </div>
      )}
      {entries.map((entry) =>
        entry.kind === 'day' ? (
          <div
            key={entry.key}
            data-testid={CHAT_DAY_SEPARATOR_TESTID}
            className="self-center rounded-full border bg-card px-2.5 py-0.5 text-xs text-muted-foreground"
          >
            {entry.label}
          </div>
        ) : (
          <ChatMessage
            key={entry.key}
            message={entry.message}
            customerName={customerName}
            canSend={canSend}
            onRetry={onRetry}
          />
        ),
      )}
    </div>
  );
}
