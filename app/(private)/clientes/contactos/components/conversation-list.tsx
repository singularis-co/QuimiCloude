'use client';

import { Search } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { SEARCH_DEBOUNCE_MS } from '@/components/shared/data-table';
import { ErrorAlert } from '@/components/shared/error-alert';
import { Spinner } from '@/components/shared/spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ErrorState } from '@/lib/modules/errores';
import type { WhatsappConversationItem, WhatsappConversationList } from '@/lib/modules/integraciones';
import { listWhatsappConversationsAction } from '@/lib/modules/integraciones/adapters/driving/whatsapp-conversation-actions';
import { cn } from '@/lib/utils';

import {
  CONVERSATION_LIST_TESTID,
  CONVERSATION_LIST_TEXT,
  CONVERSATIONS_ERROR_TESTID,
  CONVERSATIONS_LOADING_MORE_TESTID,
  CONVERSATIONS_SEARCH_TESTID,
  CONVERSATIONS_SENTINEL_TESTID,
} from './contact-texts';
import { ConversationsEmpty, ConversationsSearchEmpty } from './contacts-empty-states';
import { ConversationListItem } from './conversation-list-item';
import {
  appendNextPage,
  CONVERSATIONS_PAGE_SIZE,
  fromFirstPage,
  hasMorePages,
  mergePolledFirstPage,
  nextPageNumber,
  type ConversationListState,
} from './conversation-list-state';
import { useEndSentinel } from './use-end-sentinel';

export const CONVERSATIONS_SEARCH_MAX_LENGTH = 100;

type ConversationPage = WhatsappConversationList['page'];

type ListFailure = { readonly kind: 'search' | 'more'; readonly error: ErrorState };

export type ConversationListController = {
  readonly state: ConversationListState;
  readonly searchInput: string;
  readonly setSearchInput: (value: string) => void;
  /** El texto con el que se pidió la lista que se ve; la consulta periódica pide con este. */
  readonly appliedSearch: string;
  readonly searching: boolean;
  readonly loadingMore: boolean;
  readonly failure: ListFailure | null;
  readonly loadMore: () => void;
  readonly retry: () => void;
  readonly clearSearch: () => void;
  /** Página 1 de la consulta periódica; se descarta si se pidió con otra búsqueda. */
  readonly mergePolled: (search: string, page: ConversationPage) => void;
  readonly markRead: (contactId: string) => void;
};

/**
 * Estado de la lista con su búsqueda y sus páginas. Lo crea la pantalla para poder fusionar la
 * consulta periódica y poner a 0 el contador de la conversación leída.
 */
export function useConversationList(initialPage: ConversationPage): ConversationListController {
  const [state, setState] = useState<ConversationListState>(() => fromFirstPage(initialPage));
  const [searchInput, setSearchInputValue] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failure, setFailure] = useState<ListFailure | null>(null);

  const stateRef = useRef(state);
  const appliedSearchRef = useRef(appliedSearch);
  const pendingSearchRef = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);
  // Cada búsqueda nueva invalida lo que esté en vuelo: una respuesta de antes no pisa la lista nueva.
  const generationRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitState = useCallback((next: ConversationListState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const runSearch = useCallback(
    async (search: string) => {
      const generation = ++generationRef.current;
      pendingSearchRef.current = search;
      loadingMoreRef.current = false;
      setLoadingMore(false);
      setSearching(true);
      setFailure(null);
      const result = await listWhatsappConversationsAction({ search, page: 1, pageSize: CONVERSATIONS_PAGE_SIZE });
      if (generation !== generationRef.current) return;
      pendingSearchRef.current = null;
      setSearching(false);
      if (result.status === 'success') {
        appliedSearchRef.current = search;
        setAppliedSearch(search);
        commitState(fromFirstPage(result.data.page));
      } else {
        setFailure({ kind: 'search', error: result });
      }
    },
    [commitState],
  );

  const loadMore = useCallback(async () => {
    const current = stateRef.current;
    if (loadingMoreRef.current || pendingSearchRef.current !== null || !hasMorePages(current)) return;
    const generation = generationRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setFailure(null);
    const result = await listWhatsappConversationsAction({
      search: appliedSearchRef.current,
      page: nextPageNumber(current),
      pageSize: CONVERSATIONS_PAGE_SIZE,
    });
    if (generation !== generationRef.current) return;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    if (result.status === 'success') commitState(appendNextPage(stateRef.current, result.data.page));
    else setFailure({ kind: 'more', error: result });
  }, [commitState]);

  const cancelDebounce = useCallback(() => {
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = null;
  }, []);

  useEffect(() => cancelDebounce, [cancelDebounce]);

  const setSearchInput = useCallback(
    (value: string) => {
      setSearchInputValue(value);
      cancelDebounce();
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        const search = value.trim();
        if (search === (pendingSearchRef.current ?? appliedSearchRef.current)) return;
        void runSearch(search);
      }, SEARCH_DEBOUNCE_MS);
    },
    [cancelDebounce, runSearch],
  );

  const clearSearch = useCallback(() => {
    cancelDebounce();
    setSearchInputValue('');
    void runSearch('');
  }, [cancelDebounce, runSearch]);

  const retry = useCallback(() => {
    if (failure?.kind === 'search') void runSearch(searchInput.trim());
    else if (failure?.kind === 'more') void loadMore();
  }, [failure, loadMore, runSearch, searchInput]);

  const mergePolled = useCallback(
    (search: string, page: ConversationPage) => {
      if (pendingSearchRef.current !== null || search !== appliedSearchRef.current) return;
      commitState(mergePolledFirstPage(stateRef.current, page));
    },
    [commitState],
  );

  const markRead = useCallback(
    (contactId: string) => {
      const current = stateRef.current;
      if (!current.items.some((item) => item.contactId === contactId && item.unreadCount > 0)) return;
      commitState({
        ...current,
        items: current.items.map((item) => (item.contactId === contactId ? { ...item, unreadCount: 0 } : item)),
      });
    },
    [commitState],
  );

  return {
    state,
    searchInput,
    setSearchInput,
    appliedSearch,
    searching,
    loadingMore,
    failure,
    loadMore: () => void loadMore(),
    retry,
    clearSearch,
    mergePolled,
    markRead,
  };
}

export type ConversationListProps = {
  readonly list: ConversationListController;
  readonly selectedContactId: string | null;
  readonly onSelect: (item: WhatsappConversationItem) => void;
  readonly className?: string;
};

function ListFailureNotice({ failure, onRetry }: { readonly failure: ListFailure; readonly onRetry: () => void }) {
  return (
    <ErrorAlert
      error={failure.error}
      testId={CONVERSATIONS_ERROR_TESTID}
      className="m-3 flex flex-col gap-3 rounded-lg border border-destructive/40 bg-card p-4 text-sm"
      after={
        <Button type="button" variant="outline" touch onClick={onRetry} className="self-start">
          {CONVERSATION_LIST_TEXT.retry}
        </Button>
      }
    />
  );
}

/** Buscador, conversaciones en el orden del servidor, carga de la página siguiente y vacíos. */
export function ConversationList({ list, selectedContactId, onSelect, className }: ConversationListProps) {
  const searchId = useId();
  const [now] = useState(() => new Date());
  const { state, failure } = list;
  const more = hasMorePages(state);
  const sentinelRef = useEndSentinel({
    onVisible: list.loadMore,
    enabled: more && !list.loadingMore && !list.searching && failure === null,
    rootMargin: '0px 0px 200px 0px',
  });
  const empty = state.items.length === 0 && !list.searching && failure?.kind !== 'search';

  return (
    <section
      aria-label={CONVERSATION_LIST_TEXT.regionLabel}
      data-testid={CONVERSATION_LIST_TESTID}
      className={cn('flex h-full min-h-0 flex-col bg-card', className)}
    >
      <div className="border-b p-3 md:p-3.5">
        <label htmlFor={searchId} className="sr-only">
          {CONVERSATION_LIST_TEXT.searchLabel}
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={searchId}
            type="search"
            value={list.searchInput}
            maxLength={CONVERSATIONS_SEARCH_MAX_LENGTH}
            placeholder={CONVERSATION_LIST_TEXT.searchPlaceholder}
            data-testid={CONVERSATIONS_SEARCH_TESTID}
            onChange={(event) => list.setSearchInput(event.target.value)}
            className="h-11 pl-8 md:h-9"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-busy={list.searching}>
        {failure?.kind === 'search' ? <ListFailureNotice failure={failure} onRetry={list.retry} /> : null}
        {empty ? (
          list.appliedSearch === '' ? (
            <ConversationsEmpty />
          ) : (
            <ConversationsSearchEmpty onClearSearch={list.clearSearch} />
          )
        ) : (
          <ul className="flex flex-col">
            {state.items.map((item) => (
              <li key={item.contactId}>
                <ConversationListItem
                  item={item}
                  now={now}
                  selected={item.contactId === selectedContactId}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
        )}
        {more ? <div ref={sentinelRef} data-testid={CONVERSATIONS_SENTINEL_TESTID} aria-hidden="true" className="h-px" /> : null}
        {list.loadingMore ? (
          <div
            role="status"
            data-testid={CONVERSATIONS_LOADING_MORE_TESTID}
            className="flex items-center justify-center gap-2 p-3.5 text-[13px] text-muted-foreground"
          >
            <Spinner />
            {CONVERSATION_LIST_TEXT.loadingMore}
          </div>
        ) : null}
        {failure?.kind === 'more' ? <ListFailureNotice failure={failure} onRetry={list.retry} /> : null}
      </div>
    </section>
  );
}
