import { orderDistributionLineText } from '@/components/shared/order-distribution-label';
import type {
  WhatsappChatContext,
  WhatsappChatMessage,
  WhatsappCustomerOrder,
  WhatsappMessageStatus,
} from '@/lib/modules/integraciones';
import { ORDER_STATUS_LABELS } from '@/lib/shared/ui/order-status';

import { CHAT_MEDIA_LABELS } from './contact-texts';

export type ChatTarget = { readonly contactId: string } | { readonly customerId: string };

export type ChatDelivery = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export type ChatMessageAuthor = { readonly kind: 'user'; readonly name: string | null } | { readonly kind: 'system' };

export type ChatMediaLabel = (typeof CHAT_MEDIA_LABELS)[keyof typeof CHAT_MEDIA_LABELS];

export type ChatMessageContent =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'image'; readonly src: string | null; readonly caption: string | null }
  | { readonly kind: 'sticker'; readonly src: string | null }
  | {
      readonly kind: 'location';
      readonly latitude: number;
      readonly longitude: number;
      readonly name: string | null;
      readonly address: string | null;
    }
  | { readonly kind: 'label'; readonly label: ChatMediaLabel; readonly caption: string | null }
  | { readonly kind: 'unsupported' };

export type ChatMessageView = {
  readonly id: string;
  readonly side: 'in' | 'out';
  readonly at: string;
  readonly author: ChatMessageAuthor | null;
  readonly delivery: ChatDelivery | null;
  readonly errorReason: string | null;
  readonly retryable: boolean;
  readonly content: ChatMessageContent;
  readonly reaction: { readonly emoji: string } | null;
};

export type ChatOrderLineView = {
  readonly key: string;
  readonly ordered: string;
  readonly delivered: number;
  readonly pending: number;
};

export type ChatOrderView = {
  readonly id: string;
  readonly number: string;
  readonly statusLabel: string;
  readonly productName: string | null;
  readonly totalLabel: string | null;
  readonly lines: readonly ChatOrderLineView[];
};

export type ChatContextView = {
  readonly orders: readonly ChatOrderView[];
  readonly selectedOrderId: string | null;
  readonly values: Readonly<Record<string, string | null>>;
};

export function targetKey(target: ChatTarget): string {
  return 'contactId' in target ? `contact:${target.contactId}` : `customer:${target.customerId}`;
}

const DELIVERY_BY_STATUS: Readonly<Record<WhatsappMessageStatus, ChatDelivery | null>> = {
  RECEIVED: null,
  QUEUED: 'sending',
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
};

const BODY_AS_TEXT_TYPES: ReadonlySet<WhatsappChatMessage['type']> = new Set(['TEXT', 'TEMPLATE', 'BUTTON', 'INTERACTIVE']);

const LABEL_BY_TYPE: Partial<Record<WhatsappChatMessage['type'], ChatMediaLabel>> = {
  AUDIO: CHAT_MEDIA_LABELS.audio,
  VIDEO: CHAT_MEDIA_LABELS.video,
  DOCUMENT: CHAT_MEDIA_LABELS.document,
};

type MediaAttachment = Extract<NonNullable<WhatsappChatMessage['attachment']>, { kind: 'media' }>;

function mediaOf(message: WhatsappChatMessage): MediaAttachment | null {
  return message.attachment?.kind === 'media' ? message.attachment : null;
}

function contentOf(message: WhatsappChatMessage): ChatMessageContent {
  const { type, body, attachment } = message;
  if (BODY_AS_TEXT_TYPES.has(type)) {
    return body !== null && body.trim() !== '' ? { kind: 'text', text: body } : { kind: 'unsupported' };
  }
  if (type === 'IMAGE') {
    const media = mediaOf(message);
    return { kind: 'image', src: media?.mediaUrl ?? null, caption: media?.caption ?? null };
  }
  if (type === 'STICKER') return { kind: 'sticker', src: mediaOf(message)?.mediaUrl ?? null };
  const label = LABEL_BY_TYPE[type];
  if (label !== undefined) return { kind: 'label', label, caption: mediaOf(message)?.caption ?? null };
  if (type === 'LOCATION' && attachment?.kind === 'location') {
    return {
      kind: 'location',
      latitude: attachment.latitude,
      longitude: attachment.longitude,
      name: attachment.name,
      address: attachment.address,
    };
  }
  return { kind: 'unsupported' };
}

function authorOf(message: WhatsappChatMessage): ChatMessageAuthor | null {
  if (message.direction === 'IN') return null;
  if (message.origin === 'SYSTEM') return { kind: 'system' };
  if (message.origin === 'USER') return { kind: 'user', name: message.sentBy?.displayName ?? null };
  return null;
}

type LatestReaction = { readonly at: number; readonly emoji: string | null };

// Por mensaje gana la reacción más reciente; con el mismo instante, la que llega después en la lista.
function latestReactionsOf(messages: readonly WhatsappChatMessage[]): ReadonlyMap<string, LatestReaction> {
  const latest = new Map<string, LatestReaction>();
  for (const message of messages) {
    const attachment = message.attachment;
    if (message.type !== 'REACTION' || attachment?.kind !== 'reaction' || attachment.messageId === null) continue;
    const at = Date.parse(message.at);
    const current = latest.get(attachment.messageId);
    if (current === undefined || at >= current.at) latest.set(attachment.messageId, { at, emoji: attachment.emoji });
  }
  return latest;
}

export function toChatMessages(messages: readonly WhatsappChatMessage[]): ChatMessageView[] {
  const reactions = latestReactionsOf(messages);
  return messages
    .filter((message) => message.type !== 'REACTION')
    .map((message) => {
      const emoji = reactions.get(message.id)?.emoji ?? null;
      return {
        id: message.id,
        side: message.direction === 'IN' ? 'in' : 'out',
        at: message.at,
        author: authorOf(message),
        delivery: message.direction === 'IN' ? null : DELIVERY_BY_STATUS[message.status],
        errorReason: message.errorReason,
        retryable: message.status === 'FAILED' && message.origin === 'USER',
        content: contentOf(message),
        reaction: emoji === null ? null : { emoji },
      };
    });
}

function toChatOrder(order: WhatsappCustomerOrder): ChatOrderView {
  return {
    id: order.id,
    number: order.number,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    productName: order.productName,
    totalLabel: order.total,
    lines: order.lines.map((line, index) => ({
      key: `${index}:${line.presentationId}`,
      ordered: orderDistributionLineText({ presentationName: line.presentationName, packages: line.ordered }),
      delivered: line.delivered,
      pending: line.pending,
    })),
  };
}

export function toChatContext(context: WhatsappChatContext): ChatContextView {
  return {
    orders: context.orders.map(toChatOrder),
    selectedOrderId: context.selectedOrderId,
    values: context.values,
  };
}
