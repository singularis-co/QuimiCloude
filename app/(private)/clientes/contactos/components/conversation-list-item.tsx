'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { WhatsappConversationItem, WhatsappMessageType } from '@/lib/modules/integraciones';
import { avatarTone } from '@/lib/shared/ui/avatar-tone';
import { getInitials } from '@/lib/shared/ui/initials';
import { cn } from '@/lib/utils';

import { formatListTime } from './chat-time-format';
import {
  CONVERSATION_ITEM_TESTID,
  CONVERSATION_LIST_TEXT,
  CONVERSATION_PREVIEW_LABELS,
  CONVERSATION_UNREAD_TESTID,
} from './contact-texts';

const PREVIEW_LABEL_BY_TYPE: Partial<Record<WhatsappMessageType, string>> = {
  IMAGE: CONVERSATION_PREVIEW_LABELS.image,
  STICKER: CONVERSATION_PREVIEW_LABELS.sticker,
  AUDIO: CONVERSATION_PREVIEW_LABELS.audio,
  VIDEO: CONVERSATION_PREVIEW_LABELS.video,
  DOCUMENT: CONVERSATION_PREVIEW_LABELS.document,
  LOCATION: CONVERSATION_PREVIEW_LABELS.location,
  REACTION: CONVERSATION_PREVIEW_LABELS.reaction,
};

export function conversationPreview(lastMessage: WhatsappConversationItem['lastMessage']): string {
  const preview = lastMessage.preview;
  if (preview !== null && preview.trim() !== '') return preview;
  return PREVIEW_LABEL_BY_TYPE[lastMessage.type] ?? CONVERSATION_PREVIEW_LABELS.unsupported;
}

export type ConversationListItemProps = {
  readonly item: WhatsappConversationItem;
  readonly selected: boolean;
  readonly now: Date;
  readonly onSelect: (item: WhatsappConversationItem) => void;
};

export function ConversationListItem({ item, selected, now, onSelect }: ConversationListItemProps) {
  const unread = item.unreadCount > 0;
  return (
    <button
      type="button"
      data-testid={CONVERSATION_ITEM_TESTID}
      data-contact-id={item.contactId}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(item)}
      className={cn(
        'flex w-full min-w-0 gap-3 border-b px-3.5 py-3 text-left transition-colors outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        selected ? 'bg-primary/10' : 'bg-card active:bg-muted md:hover:bg-muted/60',
      )}
    >
      <Avatar size="lg" tone={avatarTone(item.customerId)} aria-hidden="true" className="max-md:size-11">
        <AvatarFallback className="font-semibold">{getInitials(item.customerName)}</AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-semibold md:text-sm">{item.customerName}</span>
          <span
            suppressHydrationWarning
            className={cn('shrink-0 text-xs', unread ? 'font-medium text-primary' : 'text-muted-foreground')}
          >
            {formatListTime(item.lastMessage.at, now)}
          </span>
        </span>
        <span className="font-mono text-xs text-muted-foreground">{item.phone}</span>
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm text-muted-foreground md:text-[13px]">
            {conversationPreview(item.lastMessage)}
          </span>
          {unread ? (
            <span
              role="img"
              aria-label={CONVERSATION_LIST_TEXT.unread(item.unreadCount)}
              data-testid={CONVERSATION_UNREAD_TESTID}
              className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground"
            >
              {item.unreadCount}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
