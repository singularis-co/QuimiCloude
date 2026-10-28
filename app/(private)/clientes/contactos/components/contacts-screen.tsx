'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ErrorState } from '@/lib/modules/errores';
import type {
  WhatsappChat,
  WhatsappConversationItem,
  WhatsappConversationList,
  WhatsappSendableTemplate,
} from '@/lib/modules/integraciones';
import {
  getWhatsappChatAction,
  getWhatsappChatContextAction,
  listWhatsappConversationsAction,
  markWhatsappChatReadAction,
  type WhatsappChatContextResult,
  type WhatsappChatResult,
} from '@/lib/modules/integraciones/adapters/driving/whatsapp-conversation-actions';
import { cn } from '@/lib/utils';

import { settleAction } from './action-rejection';
import { ChatPanel } from './chat-panel';
import { CHAT_PAGE_SIZE } from './chat-timeline';
import { targetKey, toChatContext, toChatMessages, type ChatContextView, type ChatTarget } from './chat-view';
import { CONTACTS_CHAT_PANE_TESTID, CONTACTS_SCREEN_TESTID } from './contact-texts';
import { ChatNoSelection } from './contacts-empty-states';
import {
  browserTimers,
  browserVisibility,
  createContactsPoller,
  type ContactsPollTick,
  type TimerPort,
  type VisibilityPort,
} from './contacts-poller';
import { searchOfSelection, selectionFromSearch } from './contacts-selection';
import { ConversationList, useConversationList } from './conversation-list';

export type ContactsScreenProps = {
  readonly initialPage: WhatsappConversationList['page'];
  /** La selección que traía la URL (`?contacto=` o `?cliente=`). */
  readonly initialSelection: ChatTarget | null;
  /** Lo que devolvió el servidor al pedir el chat y su contexto; `null` sin selección. */
  readonly initialChat: WhatsappChatResult | null;
  readonly initialContext: WhatsappChatContextResult | null;
  readonly templates: readonly WhatsappSendableTemplate[];
  readonly canSend: boolean;
  /** El cliente de `?cliente=`: su teléfono va en la cabecera mientras el chat no tiene contacto. */
  readonly requestedCustomer?: { readonly id: string; readonly phone: string } | null;
  readonly pollPorts?: { readonly visibility: VisibilityPort; readonly timers: TimerPort };
  readonly className?: string;
};

type ChatState = {
  readonly chat: WhatsappChat | null;
  readonly loading: boolean;
  readonly error: ErrorState | null;
};

type ContextState = {
  readonly context: ChatContextView | null;
  readonly loading: boolean;
  readonly error: ErrorState | null;
  readonly orderError: ErrorState | null;
};

const IDLE_CHAT: ChatState = { chat: null, loading: false, error: null };
const IDLE_CONTEXT: ContextState = { context: null, loading: false, error: null, orderError: null };

// Marca las entradas del historial que abrió la pantalla: «Volver» solo retrocede sobre una de ellas.
const HISTORY_KEY = 'contactsChat';

function chatStateOf(result: WhatsappChatResult | null): ChatState {
  if (result === null) return IDLE_CHAT;
  return result.status === 'success'
    ? { chat: result.data, loading: false, error: null }
    : { chat: null, loading: false, error: result };
}

function contextStateOf(result: WhatsappChatContextResult | null): ContextState {
  if (result === null) return IDLE_CONTEXT;
  return result.status === 'success'
    ? { context: toChatContext(result.data), loading: false, error: null, orderError: null }
    : { context: null, loading: false, error: result, orderError: null };
}

function messageIdsOf(chat: WhatsappChat | null): Set<string> {
  return new Set(chat?.messages.map((message) => message.id) ?? []);
}

function isOwnHistoryEntry(): boolean {
  const state: unknown = window.history.state;
  return typeof state === 'object' && state !== null && (state as Record<string, unknown>)[HISTORY_KEY] === true;
}

/**
 * Lista y chat de WhatsApp: lado a lado en escritorio, uno u otro en teléfono. La selección vive
 * en la URL; la pantalla carga el chat y su contexto al abrirlo y mantiene la consulta periódica.
 */
export function ContactsScreen({
  initialPage,
  initialSelection,
  initialChat,
  initialContext,
  templates,
  canSend,
  requestedCustomer = null,
  pollPorts,
  className,
}: ContactsScreenProps) {
  const list = useConversationList(initialPage);
  const { mergePolled, markRead, appliedSearch } = list;

  const [selection, setSelection] = useState<ChatTarget | null>(initialSelection);
  const [chatState, setChatState] = useState<ChatState>(() => chatStateOf(initialChat));
  const [contextState, setContextState] = useState<ContextState>(() => contextStateOf(initialContext));

  const selectionKeyRef = useRef<string | null>(initialSelection === null ? null : targetKey(initialSelection));
  const openChatRef = useRef<ChatTarget | null>(
    initialSelection !== null && initialChat?.status === 'success' ? initialSelection : null,
  );
  const knownIdsRef = useRef<Set<string>>(messageIdsOf(initialChat?.status === 'success' ? initialChat.data : null));
  const chatSeqRef = useRef(0);
  const contextSeqRef = useRef(0);
  const searchRef = useRef(appliedSearch);
  const polledSearchRef = useRef(appliedSearch);

  useEffect(() => {
    searchRef.current = appliedSearch;
  }, [appliedSearch]);

  const loadChat = useCallback(async (target: ChatTarget) => {
    const key = targetKey(target);
    const seq = ++chatSeqRef.current;
    openChatRef.current = null;
    setChatState({ chat: null, loading: true, error: null });
    const result = await settleAction(() => getWhatsappChatAction({ target, pageSize: CHAT_PAGE_SIZE }));
    if (seq !== chatSeqRef.current || selectionKeyRef.current !== key) return;
    if (result.status === 'success') {
      knownIdsRef.current = messageIdsOf(result.data);
      openChatRef.current = target;
    }
    setChatState(chatStateOf(result));
  }, []);

  const loadContext = useCallback(async (target: ChatTarget, orderId?: string) => {
    const key = targetKey(target);
    const seq = ++contextSeqRef.current;
    const changingOrder = orderId !== undefined;
    setContextState((current) =>
      changingOrder ? { ...current, loading: true, orderError: null } : { ...IDLE_CONTEXT, loading: true },
    );
    const result = await settleAction(() =>
      getWhatsappChatContextAction(changingOrder ? { target, orderId } : { target }),
    );
    if (seq !== contextSeqRef.current || selectionKeyRef.current !== key) return;
    if (result.status === 'success' || !changingOrder) {
      setContextState(contextStateOf(result));
      return;
    }
    setContextState((current) => ({ ...current, loading: false, orderError: result }));
  }, []);

  const open = useCallback(
    (target: ChatTarget) => {
      selectionKeyRef.current = targetKey(target);
      knownIdsRef.current = new Set();
      setSelection(target);
      void loadChat(target);
      void loadContext(target);
    },
    [loadChat, loadContext],
  );

  const clearSelection = useCallback(() => {
    selectionKeyRef.current = null;
    openChatRef.current = null;
    chatSeqRef.current += 1;
    contextSeqRef.current += 1;
    setSelection(null);
    setChatState(IDLE_CHAT);
    setContextState(IDLE_CONTEXT);
  }, []);

  function select(item: WhatsappConversationItem) {
    const target: ChatTarget = { contactId: item.contactId };
    if (selectionKeyRef.current === targetKey(target) || (selection !== null && chatState.chat?.customer.id === item.customerId)) return;
    const url = `${window.location.pathname}${searchOfSelection(target)}`;
    // Entre chats se reemplaza la entrada: «Atrás» vuelve a la lista, no al chat anterior.
    if (selection === null) window.history.pushState({ [HISTORY_KEY]: true }, '', url);
    else window.history.replaceState(isOwnHistoryEntry() ? { [HISTORY_KEY]: true } : null, '', url);
    open(target);
  }

  function back() {
    if (isOwnHistoryEntry()) {
      window.history.back();
      return;
    }
    window.history.replaceState(null, '', window.location.pathname);
    clearSelection();
  }

  useEffect(() => {
    const onPopState = () => {
      const target = selectionFromSearch(new URLSearchParams(window.location.search));
      if (target === null) clearSelection();
      else if (selectionKeyRef.current !== targetKey(target)) open(target);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [clearSelection, open]);

  const markReadUpTo = useCallback(
    async (contactId: string, upToMessageId: string) => {
      const result = await settleAction(() => markWhatsappChatReadAction({ contactId, upToMessageId }));
      if (result.status === 'success') markRead(contactId);
    },
    [markRead],
  );

  const onTick = useCallback(
    (tick: ContactsPollTick) => {
      if (tick.list !== null) mergePolled(polledSearchRef.current, tick.list.page);
      const polled = tick.chat;
      const openChat = openChatRef.current;
      if (polled === null || openChat === null || targetKey(polled.target) !== targetKey(openChat)) return;
      for (const message of polled.chat.messages) knownIdsRef.current.add(message.id);
      setChatState((current) => (current.chat === null ? current : { ...current, chat: polled.chat }));
      const contactId = polled.chat.contact?.id;
      const lastShown = toChatMessages(polled.chat.messages).at(-1);
      if (polled.hasNewInbound && contactId !== undefined && lastShown !== undefined) {
        void markReadUpTo(contactId, lastShown.id);
      }
    },
    [markReadUpTo, mergePolled],
  );

  const visibility = pollPorts?.visibility;
  const timers = pollPorts?.timers;

  useEffect(() => {
    const poller = createContactsPoller({
      listConversations: (input) => {
        polledSearchRef.current = input.search;
        return listWhatsappConversationsAction(input);
      },
      getChat: (input) => getWhatsappChatAction(input),
      currentQuery: () => {
        const target = openChatRef.current;
        return {
          search: searchRef.current,
          chat: target === null ? null : { target, knownMessageIds: knownIdsRef.current },
        };
      },
      visibility: visibility ?? browserVisibility(),
      timers: timers ?? browserTimers,
    });
    return poller.start(onTick, () => {});
  }, [onTick, timers, visibility]);

  const reloadChat = useCallback(async () => {
    const target = openChatRef.current;
    if (target === null) return;
    const key = targetKey(target);
    const seq = ++chatSeqRef.current;
    const result = await settleAction(() => getWhatsappChatAction({ target, pageSize: CHAT_PAGE_SIZE }));
    if (seq !== chatSeqRef.current || selectionKeyRef.current !== key || result.status !== 'success') return;
    for (const message of result.data.messages) knownIdsRef.current.add(message.id);
    setChatState((current) => ({ ...current, chat: result.data }));
  }, []);

  const chat = chatState.chat;
  const customerId = chat?.customer.id ?? (selection !== null && 'customerId' in selection ? selection.customerId : null);
  const listedItem = customerId === null ? undefined : list.state.items.find((item) => item.customerId === customerId);
  const selectedContactId =
    chat?.contact?.id ?? (selection !== null && 'contactId' in selection ? selection.contactId : (listedItem?.contactId ?? null));
  const customerPhone =
    listedItem?.phone ?? (requestedCustomer !== null && requestedCustomer.id === customerId ? requestedCustomer.phone : null);
  const view = selection === null ? 'list' : 'chat';

  return (
    <div
      data-testid={CONTACTS_SCREEN_TESTID}
      data-view={view}
      className={cn('flex h-full min-h-0 overflow-hidden bg-card md:rounded-lg md:border', className)}
    >
      <ConversationList
        list={list}
        selectedContactId={selectedContactId}
        onSelect={select}
        className={cn('w-full md:w-[360px] md:shrink-0 md:border-r', view === 'chat' && 'max-md:hidden')}
      />
      <div
        data-testid={CONTACTS_CHAT_PANE_TESTID}
        className={cn('flex min-h-0 min-w-0 flex-1 flex-col bg-muted/40', view === 'list' && 'max-md:hidden')}
      >
        {selection === null ? (
          <ChatNoSelection />
        ) : (
          <ChatPanel
            chat={chat}
            chatLoading={chatState.loading}
            chatError={chatState.error}
            onRetryChat={() => void loadChat(selection)}
            context={contextState.context}
            contextLoading={contextState.loading}
            contextError={contextState.error}
            onRetryContext={() => void loadContext(selection)}
            orderError={contextState.orderError}
            onSelectOrder={(orderId) => void loadContext(selection, orderId)}
            canSend={canSend}
            templates={templates}
            onBack={back}
            onChatRead={markRead}
            onReloadChat={() => void reloadChat()}
            customerPhone={customerPhone}
            className="flex-1"
          />
        )}
      </div>
    </div>
  );
}
