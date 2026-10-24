'use client';

import { ChevronLeft, MessageSquare } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ErrorAlert } from '@/components/shared/error-alert';
import { Spinner } from '@/components/shared/spinner';
import { Button } from '@/components/ui/button';
import {
  getWhatsappChatAction,
  markWhatsappChatReadAction,
} from '@/lib/modules/integraciones/adapters/driving/whatsapp-conversation-actions';
import { retryWhatsappMessageAction } from '@/lib/modules/integraciones/adapters/driving/whatsapp-message-actions';
import type { ErrorState } from '@/lib/modules/errores';
import type { WhatsappChat, WhatsappChatMessage, WhatsappSendableTemplate } from '@/lib/modules/integraciones';
import { SYSTEM_CONSTANTS, constantLabelsForBackend } from '@/lib/shared/ui/whatsapp-system-constants';
import { cn } from '@/lib/utils';

import { ChatComposer, sentMessage } from './chat-composer';
import { ChatHeader } from './chat-header';
import { ChatMessageList } from './chat-message-list';
import { CHAT_PAGE_SIZE, mergeLatestMessages, prependOlderMessages } from './chat-timeline';
import { toChatMessages, type ChatContextView, type ChatMessageView, type ChatTarget } from './chat-view';
import {
  CHAT_CONTEXT_ERROR_TESTID,
  CHAT_EMPTY_TESTID,
  CHAT_HEADER_TEXT,
  CHAT_LOAD_ERROR_TESTID,
  CHAT_LOADING_TESTID,
  CHAT_OLDER_ERROR_TESTID,
  CHAT_PANEL_TESTID,
  CHAT_PANEL_TEXT,
  CHAT_RETRY_ERROR_TESTID,
} from './contact-texts';

export type ChatPanelProps = {
  /**
   * El chat abierto. Lo que traiga una consulta periódica o una recarga se une por id con lo ya
   * pintado; los anteriores, los provisionales y los reintentos los lleva el panel.
   */
  readonly chat: WhatsappChat | null;
  /** Carga inicial del chat (abrir otra conversación o reintentarla); no la consulta periódica. */
  readonly chatLoading: boolean;
  readonly chatError: ErrorState | null;
  readonly onRetryChat: () => void;
  readonly context: ChatContextView | null;
  readonly contextLoading: boolean;
  /** Error de la carga del contexto al abrir el chat. */
  readonly contextError: ErrorState | null;
  readonly onRetryContext: () => void;
  /** Error del último cambio de pedido; se pinta junto al selector. */
  readonly orderError: ErrorState | null;
  readonly onSelectOrder: (orderId: string) => void;
  readonly canSend: boolean;
  readonly templates: readonly WhatsappSendableTemplate[];
  readonly onBack: () => void;
  /** La conversación quedó leída: el padre pone su contador a 0. */
  readonly onChatRead: (contactId: string) => void;
  /** Tras enviar al cliente sin conversación: el chat se vuelve a pedir por `{ customerId }`. */
  readonly onReloadChat: () => void;
  readonly className?: string;
};

type RetryFailure = { readonly kind: 'missing_values'; readonly message: string } | { readonly kind: 'error'; readonly error: ErrorState };

const PENDING_PREFIX = 'pending:';

function isProvisional(message: ChatMessageView): boolean {
  return message.id.startsWith(PENDING_PREFIX);
}

const SYSTEM_KEYS: ReadonlySet<string> = new Set(SYSTEM_CONSTANTS.map((constant) => constant.backendKey));

// El panel no sabe de qué plantilla salió el fallido: el servidor solo usa las que la plantilla pide.
function retryConstantsOf(context: ChatContextView | null): Record<string, string> {
  const constants: Record<string, string> = {};
  for (const [key, value] of Object.entries(context?.values ?? {})) {
    if (SYSTEM_KEYS.has(key) && value !== null) constants[key] = value;
  }
  return constants;
}

function BackBar({ onBack }: { readonly onBack: () => void }) {
  return (
    <div className="border-b bg-card py-2 pl-1 md:hidden">
      <Button type="button" variant="ghost" size="icon" touch aria-label={CHAT_HEADER_TEXT.back} onClick={onBack}>
        <ChevronLeft aria-hidden="true" className="size-5" />
      </Button>
    </div>
  );
}

function RetryButton({ onRetry, testId }: { readonly onRetry: () => void; readonly testId?: string }) {
  return (
    <Button type="button" variant="outline" touch onClick={onRetry} data-testid={testId} className="self-start">
      {CHAT_PANEL_TEXT.retry}
    </Button>
  );
}

const PANEL_CLASS = 'flex h-full min-h-0 flex-col bg-muted/40';

/**
 * Cabecera, historial y caja del chat abierto. El padre carga el chat y su contexto y guarda el
 * pedido elegido; el panel guarda los mensajes que añade él (anteriores, provisionales,
 * reintentos) y marca leída la conversación al abrirla. Una instancia por cliente: cambiar de
 * chat empieza de cero.
 */
export function ChatPanel(props: ChatPanelProps) {
  const { chat, chatLoading, chatError, onRetryChat, onBack, className } = props;

  if (chatError !== null) {
    return (
      <section data-testid={CHAT_PANEL_TESTID} className={cn(PANEL_CLASS, className)}>
        <BackBar onBack={onBack} />
        <div className="flex flex-1 items-center justify-center p-6">
          <ErrorAlert
            error={chatError}
            testId={CHAT_LOAD_ERROR_TESTID}
            className="flex max-w-md flex-col gap-3 rounded-lg border border-destructive/40 bg-card p-4 text-sm"
            after={<RetryButton onRetry={onRetryChat} />}
          />
        </div>
      </section>
    );
  }

  if (chatLoading || chat === null) {
    return (
      <section data-testid={CHAT_PANEL_TESTID} aria-busy="true" className={cn(PANEL_CLASS, className)}>
        <BackBar onBack={onBack} />
        <div data-testid={CHAT_LOADING_TESTID} className="flex flex-1 items-center justify-center text-muted-foreground">
          <Spinner size="lg" />
        </div>
      </section>
    );
  }

  return <ChatConversation key={chat.customer.id} {...props} chat={chat} />;
}

type ChatConversationProps = ChatPanelProps & { readonly chat: WhatsappChat };

function ChatConversation({
  chat,
  context,
  contextLoading,
  contextError,
  onRetryContext,
  orderError,
  onSelectOrder,
  canSend,
  templates,
  onBack,
  onChatRead,
  onReloadChat,
  className,
}: ChatConversationProps) {
  const [now] = useState(() => new Date());
  const [syncedChat, setSyncedChat] = useState(chat);
  const [serverMessages, setServerMessages] = useState<readonly WhatsappChatMessage[]>(chat.messages);
  const [localMessages, setLocalMessages] = useState<readonly ChatMessageView[]>([]);
  const [nextCursor, setNextCursor] = useState(chat.nextCursor);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<ErrorState | null>(null);
  const [retryFailure, setRetryFailure] = useState<RetryFailure | null>(null);
  const retryingRef = useRef(new Set<string>());
  const markedRef = useRef(false);

  // Una consulta nueva del mismo chat se une con lo cargado; el cursor de anteriores no cambia.
  if (chat !== syncedChat) {
    setSyncedChat(chat);
    setServerMessages((current) => mergeLatestMessages(current, chat.messages));
  }

  const contactId = chat.contact?.id ?? null;
  const customerId = chat.customer.id;
  const serverViews = useMemo(() => toChatMessages(serverMessages), [serverMessages]);
  const messages = useMemo(() => mergeLatestMessages(localMessages, serverViews), [localMessages, serverViews]);
  const lastShownId = serverViews.at(-1)?.id ?? null;
  const hasMessages = messages.some((message) => !isProvisional(message));

  useEffect(() => {
    if (markedRef.current || contactId === null || lastShownId === null) return;
    markedRef.current = true;
    void markWhatsappChatReadAction({ contactId, upToMessageId: lastShownId }).then((result) => {
      if (result.status === 'success') onChatRead(contactId);
    });
  }, [contactId, lastShownId, onChatRead]);

  const loadOlder = useCallback(
    async (cursor: string) => {
      setLoadingOlder(true);
      setOlderError(null);
      const target: ChatTarget = contactId === null ? { customerId } : { contactId };
      const result = await getWhatsappChatAction({ target, before: cursor, pageSize: CHAT_PAGE_SIZE });
      setLoadingOlder(false);
      if (result.status !== 'success') {
        setOlderError(result);
        return;
      }
      setServerMessages((current) => prependOlderMessages(current, result.data.messages));
      setNextCursor(result.data.nextCursor);
    },
    [contactId, customerId],
  );

  async function retry(messageId: string) {
    if (retryingRef.current.has(messageId)) return;
    retryingRef.current.add(messageId);
    setRetryFailure(null);
    const result = await retryWhatsappMessageAction({
      messageId,
      constants: retryConstantsOf(context),
      constantLabels: { ...constantLabelsForBackend() },
    });
    retryingRef.current.delete(messageId);
    if (result.status === 'success') {
      const message = sentMessage(result.data);
      setLocalMessages((current) => [...current, message]);
      return;
    }
    setRetryFailure(
      result.status === 'missing_values' ? { kind: 'missing_values', message: result.message } : { kind: 'error', error: result },
    );
  }

  return (
    <section data-testid={CHAT_PANEL_TESTID} className={cn(PANEL_CLASS, className)}>
      <ChatHeader
        customerName={chat.customer.name}
        phone={chat.contact?.phone ?? ''}
        window={chat.window}
        context={context}
        contextLoading={contextLoading}
        orderError={orderError}
        onSelectOrder={onSelectOrder}
        onBack={onBack}
      />

      {contextError !== null && (
        <ErrorAlert
          error={contextError}
          testId={CHAT_CONTEXT_ERROR_TESTID}
          className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2.5 text-sm text-destructive-text md:px-5"
          after={<RetryButton onRetry={onRetryContext} />}
        />
      )}

      {messages.length === 0 ? (
        <div
          data-testid={CHAT_EMPTY_TESTID}
          className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground"
        >
          <MessageSquare aria-hidden="true" className="size-7" />
          <p className="text-[15px] font-medium text-foreground">{CHAT_PANEL_TEXT.emptyTitle}</p>
          <p className="max-w-[420px] text-[13px] leading-normal">{CHAT_PANEL_TEXT.emptyDescription}</p>
        </div>
      ) : (
        <ChatMessageList
          messages={messages}
          now={now}
          nextCursor={nextCursor}
          loadingOlder={loadingOlder}
          onLoadOlder={(cursor) => void loadOlder(cursor)}
          customerName={chat.customer.name}
          canSend={canSend}
          onRetry={(messageId) => void retry(messageId)}
        />
      )}

      {olderError !== null && (
        <ErrorAlert error={olderError} testId={CHAT_OLDER_ERROR_TESTID} className="bg-card px-4 py-2 text-sm text-destructive-text md:px-5" />
      )}
      {retryFailure !== null &&
        (retryFailure.kind === 'missing_values' ? (
          <p role="alert" data-testid={CHAT_RETRY_ERROR_TESTID} className="bg-card px-4 py-2 text-sm text-destructive-text md:px-5">
            {retryFailure.message}
          </p>
        ) : (
          <ErrorAlert
            error={retryFailure.error}
            testId={CHAT_RETRY_ERROR_TESTID}
            className="bg-card px-4 py-2 text-sm text-destructive-text md:px-5"
          />
        ))}

      <ChatComposer
        contactId={contactId}
        customerId={customerId}
        canSend={canSend}
        window={chat.window}
        hasMessages={hasMessages}
        templates={templates}
        context={context}
        contextLoading={contextLoading}
        onSelectOrder={onSelectOrder}
        onOptimistic={(message) => setLocalMessages((current) => [...current, message])}
        onSent={(pendingId, message) =>
          setLocalMessages((current) => current.map((entry) => (entry.id === pendingId ? message : entry)))
        }
        onSendFailed={(pendingId) => setLocalMessages((current) => current.filter((entry) => entry.id !== pendingId))}
        onReloadChat={onReloadChat}
      />
    </section>
  );
}
