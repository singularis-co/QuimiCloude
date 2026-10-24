'use client';

import { CircleAlert, FileText, Mic, Video } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { ChatImageViewer } from './chat-image-viewer';
import { ChatLocationCard } from './chat-location-card';
import { ChatMediaImage } from './chat-media-image';
import { ChatMessageStatus } from './chat-message-status';
import { formatMessageTime } from './chat-time-format';
import type { ChatMediaLabel, ChatMessageView } from './chat-view';
import { CHAT_IMAGE_TEXT, CHAT_MEDIA_LABELS, CHAT_MESSAGE_TESTID, CHAT_MESSAGE_TEXT } from './contact-texts';

export type ChatMessageProps = {
  readonly message: ChatMessageView;
  /** Nombre del cliente del chat, para la cabecera del visor de imagen. */
  readonly customerName: string;
  /** La sesión puede enviar por WhatsApp. */
  readonly canSend: boolean;
  readonly onRetry: (messageId: string) => void;
};

const LABEL_ICONS: Readonly<Record<ChatMediaLabel, typeof FileText>> = {
  [CHAT_MEDIA_LABELS.audio]: Mic,
  [CHAT_MEDIA_LABELS.video]: Video,
  [CHAT_MEDIA_LABELS.document]: FileText,
};

const TEXT_CLASS = 'text-sm leading-[1.45] whitespace-pre-wrap';

function Caption({ text }: { readonly text: string | null }) {
  return text === null ? null : <span className={TEXT_CLASS}>{text}</span>;
}

// El fallo se recuerda por `src`: si el mensaje llega con otra ruta, se vuelve a intentar.
function useMediaFailure(src: string | null) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return { failed: src !== null && failedSrc === src, markFailed: () => setFailedSrc(src) };
}

function ChatImageContent({
  src,
  caption,
  customerName,
  time,
}: {
  readonly src: string | null;
  readonly caption: string | null;
  readonly customerName: string;
  readonly time: string;
}) {
  const [open, setOpen] = useState(false);
  const { failed, markFailed } = useMediaFailure(src);
  const image = <ChatMediaImage kind="image" src={src} caption={caption} failed={failed} onError={markFailed} />;

  return (
    <>
      {src === null ? (
        image
      ) : (
        <>
          <button
            type="button"
            aria-label={CHAT_IMAGE_TEXT.open}
            onClick={() => setOpen(true)}
            className="block max-w-full cursor-zoom-in rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {image}
          </button>
          <ChatImageViewer
            open={open}
            onOpenChange={setOpen}
            src={src}
            caption={caption}
            customerName={customerName}
            time={time}
            failed={failed}
            onError={markFailed}
          />
        </>
      )}
      <Caption text={caption} />
    </>
  );
}

function ChatSticker({ src }: { readonly src: string | null }) {
  const { failed, markFailed } = useMediaFailure(src);
  return <ChatMediaImage kind="sticker" src={src} failed={failed} onError={markFailed} />;
}

function Reaction({ emoji }: { readonly emoji: string }) {
  return (
    <span
      role="img"
      aria-label={CHAT_MESSAGE_TEXT.reaction(emoji)}
      className="absolute right-2.5 -bottom-3.5 rounded-full border bg-card px-1.5 text-sm leading-5.5 shadow-xs"
    >
      {emoji}
    </span>
  );
}

function bodyOf(message: ChatMessageView, customerName: string, time: string): ReactNode {
  const { content } = message;
  switch (content.kind) {
    case 'text':
      return <span className={TEXT_CLASS}>{content.text}</span>;
    case 'image':
      return <ChatImageContent src={content.src} caption={content.caption} customerName={customerName} time={time} />;
    case 'location':
      return (
        <ChatLocationCard
          latitude={content.latitude}
          longitude={content.longitude}
          name={content.name}
          address={content.address}
        />
      );
    case 'label': {
      const Icon = LABEL_ICONS[content.label];
      return (
        <>
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
            <Icon aria-hidden="true" className="size-3.5" />
            {content.label}
          </span>
          <Caption text={content.caption} />
        </>
      );
    }
    case 'unsupported':
    case 'sticker':
      return <span className="text-sm text-muted-foreground italic">{CHAT_MESSAGE_TEXT.unsupported}</span>;
  }
}

function authorLabel(message: ChatMessageView): string | null {
  if (message.author === null) return null;
  return message.author.kind === 'system' ? CHAT_MESSAGE_TEXT.system : message.author.name;
}

export function ChatMessage({ message, customerName, canSend, onRetry }: ChatMessageProps) {
  const time = formatMessageTime(message.at);
  const outgoing = message.side === 'out';
  const align = outgoing ? 'self-end' : 'self-start';

  if (message.content.kind === 'sticker') {
    return (
      <div
        data-testid={CHAT_MESSAGE_TESTID}
        data-side={message.side}
        className={cn('relative flex flex-col items-end gap-1', align, message.reaction !== null && 'mb-3.5')}
      >
        <ChatSticker src={message.content.src} />
        <time dateTime={message.at} className="rounded-full bg-card px-2 py-px text-[11px] text-muted-foreground">
          {time}
        </time>
        {message.reaction !== null && <Reaction emoji={message.reaction.emoji} />}
      </div>
    );
  }

  const failed = message.delivery === 'failed';
  const author = authorLabel(message);
  const reason = message.errorReason;

  return (
    <div
      data-testid={CHAT_MESSAGE_TESTID}
      data-side={message.side}
      data-delivery={message.delivery ?? undefined}
      className={cn(
        'relative flex max-w-[80%] flex-col gap-1 border px-3 py-2 [overflow-wrap:anywhere] md:max-w-[62%]',
        align,
        outgoing ? 'rounded-[10px_10px_2px_10px]' : 'rounded-[10px_10px_10px_2px]',
        failed
          ? 'border-destructive-border bg-destructive-subtle'
          : outgoing
            ? 'border-success-border bg-success-subtle'
            : 'bg-card',
        message.content.kind === 'unsupported' && 'border-dashed',
        message.delivery === 'sending' && 'opacity-85',
        message.reaction !== null && 'mb-3.5',
      )}
    >
      {author !== null && (
        <span className={cn('text-xs font-semibold', message.author?.kind === 'system' ? 'text-muted-foreground' : 'text-primary')}>
          {author}
        </span>
      )}
      {bodyOf(message, customerName, time)}
      {failed ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5 text-xs text-destructive-text">
            <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
            {reason === null ? CHAT_MESSAGE_TEXT.failedWithoutReason : CHAT_MESSAGE_TEXT.failed(reason)}
          </span>
          {message.retryable && canSend && (
            <Button type="button" variant="outline" size="sm" touch onClick={() => onRetry(message.id)}>
              {CHAT_MESSAGE_TEXT.retry}
            </Button>
          )}
          <time dateTime={message.at} className="ml-auto text-[11px] text-muted-foreground">
            {time}
          </time>
        </div>
      ) : (
        <span className="flex items-center gap-1 self-end text-[11px] text-muted-foreground">
          <time dateTime={message.at}>{time}</time>
          {message.delivery !== null && <ChatMessageStatus delivery={message.delivery} />}
        </span>
      )}
      {message.reaction !== null && <Reaction emoji={message.reaction.emoji} />}
    </div>
  );
}
