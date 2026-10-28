'use client';

import { MessageSquare, SearchX, Unlink } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/shared/empty-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { WHATSAPP_INTEGRATION_ROUTE } from '@/lib/shared/routes';
import { cn } from '@/lib/utils';

import {
  CHAT_NO_SELECTION_TESTID,
  CONTACTS_EMPTY_TEXT,
  CONTACTS_INTEGRATIONS_LINK_TESTID,
  CONTACTS_NOT_CONNECTED_TESTID,
  CONVERSATIONS_CLEAR_SEARCH_TESTID,
  CONVERSATIONS_EMPTY_TESTID,
  CONVERSATIONS_SEARCH_EMPTY_TESTID,
} from './contact-texts';

const CARD_CLASS =
  'flex flex-col items-center justify-center gap-3 rounded-lg border bg-card p-8 text-center [&>p]:max-w-80';
const PLAIN_CLASS = 'flex flex-col items-center justify-center gap-3 p-8 text-center [&>p]:max-w-80';

export type ContactsNotConnectedProps = {
  /** La sesión puede abrir Integraciones; sin ello no hay enlace. */
  readonly canOpenIntegrations: boolean;
  readonly className?: string;
};

export function ContactsNotConnected({ canOpenIntegrations, className }: ContactsNotConnectedProps) {
  return (
    <EmptyState
      testId={CONTACTS_NOT_CONNECTED_TESTID}
      className={cn(CARD_CLASS, className)}
      icon={{ node: <Unlink />, size: 'lg' }}
      heading={{ text: CONTACTS_EMPTY_TEXT.notConnectedTitle, level: 2 }}
      message={CONTACTS_EMPTY_TEXT.notConnectedDescription}
    >
      {canOpenIntegrations ? (
        <Link
          href={WHATSAPP_INTEGRATION_ROUTE}
          data-testid={CONTACTS_INTEGRATIONS_LINK_TESTID}
          className={buttonVariants({ touch: true })}
        >
          {CONTACTS_EMPTY_TEXT.openIntegrations}
        </Link>
      ) : null}
    </EmptyState>
  );
}

export function ConversationsEmpty({ className }: { readonly className?: string }) {
  return (
    <EmptyState
      testId={CONVERSATIONS_EMPTY_TESTID}
      className={cn(PLAIN_CLASS, className)}
      icon={{ node: <MessageSquare />, size: 'lg' }}
      heading={{ text: CONTACTS_EMPTY_TEXT.noConversationsTitle, level: 2 }}
      message={CONTACTS_EMPTY_TEXT.noConversationsDescription}
    />
  );
}

export type ConversationsSearchEmptyProps = {
  readonly onClearSearch: () => void;
  readonly className?: string;
};

// La búsqueda es estado del componente, no de la URL: limpiar es un botón, no el enlace de `EmptyState`.
export function ConversationsSearchEmpty({ onClearSearch, className }: ConversationsSearchEmptyProps) {
  return (
    <EmptyState
      testId={CONVERSATIONS_SEARCH_EMPTY_TESTID}
      className={cn(PLAIN_CLASS, className)}
      icon={{ node: <SearchX /> }}
      message={CONTACTS_EMPTY_TEXT.noSearchResults}
    >
      <Button type="button" variant="outline" touch data-testid={CONVERSATIONS_CLEAR_SEARCH_TESTID} onClick={onClearSearch}>
        {CONTACTS_EMPTY_TEXT.clearSearch}
      </Button>
    </EmptyState>
  );
}

export function ChatNoSelection({ className }: { readonly className?: string }) {
  return (
    <EmptyState
      testId={CHAT_NO_SELECTION_TESTID}
      className={cn(PLAIN_CLASS, 'h-full', className)}
      icon={{ node: <MessageSquare />, size: 'lg' }}
      message={CONTACTS_EMPTY_TEXT.noSelection}
    />
  );
}
