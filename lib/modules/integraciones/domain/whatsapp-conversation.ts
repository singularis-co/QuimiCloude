import { z } from 'zod';

import { sendFailureReasonOf } from './whatsapp-send-failure';
import { isWindowOpen, WHATSAPP_WINDOW_MS } from './whatsapp-send-window';

import type { WhatsappConnectionStatus } from './whatsapp-connection';
import type {
  WhatsappMessageDirection,
  WhatsappMessageOrigin,
  WhatsappMessageStatus,
  WhatsappMessageType,
} from './whatsapp-message';
import type { WhatsappTemplateCategory } from './whatsapp-template';
import type { WhatsappTemplateContent } from './whatsapp-template-draft';

export type WhatsappConversationLastMessage = {
  readonly direction: WhatsappMessageDirection;
  readonly type: WhatsappMessageType;
  readonly preview: string | null;
  readonly status: WhatsappMessageStatus;
  readonly at: string;
};

export type WhatsappConversationItem = {
  readonly contactId: string;
  readonly customerId: string;
  readonly customerName: string;
  readonly phone: string;
  readonly isBlocked: boolean;
  readonly unreadCount: number;
  readonly lastMessage: WhatsappConversationLastMessage;
};

export type WhatsappConversationPage = {
  readonly items: readonly WhatsappConversationItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
};

export type WhatsappConversationList = {
  readonly connectionStatus: WhatsappConnectionStatus | null;
  readonly page: WhatsappConversationPage;
};

export type WhatsappChatAttachment =
  | {
      readonly kind: 'media';
      readonly mimeType: string;
      readonly filename: string | null;
      readonly caption: string | null;
    }
  | {
      readonly kind: 'location';
      readonly latitude: number;
      readonly longitude: number;
      readonly name: string | null;
      readonly address: string | null;
    }
  | { readonly kind: 'reaction'; readonly emoji: string | null };

export type WhatsappChatMessage = {
  readonly id: string;
  readonly direction: WhatsappMessageDirection;
  readonly type: WhatsappMessageType;
  readonly body: string | null;
  readonly attachment: WhatsappChatAttachment | null;
  readonly status: WhatsappMessageStatus;
  readonly errorReason: string | null;
  readonly origin: WhatsappMessageOrigin | null;
  readonly sentBy: { readonly id: string; readonly displayName: string | null } | null;
  readonly templateName: string | null;
  readonly at: string;
};

export type WhatsappChatWindow =
  | { readonly open: true; readonly closesAt: string }
  | { readonly open: false; readonly closesAt: null };

export type WhatsappChatContact = {
  readonly id: string;
  readonly phone: string;
  readonly isBlocked: boolean;
  readonly unreadCount: number;
};

export type WhatsappChat = {
  readonly connectionStatus: WhatsappConnectionStatus | null;
  readonly contact: WhatsappChatContact | null;
  readonly customer: { readonly id: string; readonly name: string };
  readonly window: WhatsappChatWindow;
  readonly messages: readonly WhatsappChatMessage[];
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
};

export type WhatsappSendableTemplateVariable = {
  readonly slot: string;
  readonly position: number;
  readonly kind: 'system' | 'company';
  readonly key: string;
  readonly label: string | null;
  readonly value: string | null;
};

export type WhatsappSendableTemplate = {
  readonly id: string;
  readonly name: string;
  readonly language: string;
  readonly category: WhatsappTemplateCategory;
  readonly content: WhatsappTemplateContent;
  readonly variables: readonly WhatsappSendableTemplateVariable[];
};

export const MESSAGE_PREVIEW_MAX_LENGTH = 120;
export const UNKNOWN_SEND_FAILURE_REASON = 'No se pudo enviar el mensaje.';

// Por puntos de código y no por unidades UTF-16: cortar a mitad de un emoji deja un carácter roto.
export function previewOf(body: string | null): string | null {
  if (body === null) return null;
  return Array.from(body).slice(0, MESSAGE_PREVIEW_MAX_LENGTH).join('');
}

const MEDIA_ATTACHMENT_TYPES: readonly WhatsappMessageType[] = ['IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'STICKER'];

const mediaPayloadSchema = z.object({
  mime_type: z.string(),
  filename: z.string().optional(),
  caption: z.string().optional(),
});

const locationPayloadSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
  address: z.string().optional(),
});

const reactionPayloadSchema = z.object({ emoji: z.string().nullish() });

// Cada esquema enumera sus claves: `media_id` y el `wamid` de la reacción nunca salen al chat.
export function attachmentOf(type: WhatsappMessageType, payload: unknown): WhatsappChatAttachment | null {
  if (MEDIA_ATTACHMENT_TYPES.includes(type)) {
    const parsed = mediaPayloadSchema.safeParse(payload);
    if (!parsed.success) return null;
    return {
      kind: 'media',
      mimeType: parsed.data.mime_type,
      filename: parsed.data.filename ?? null,
      caption: parsed.data.caption ?? null,
    };
  }
  if (type === 'LOCATION') {
    const parsed = locationPayloadSchema.safeParse(payload);
    if (!parsed.success) return null;
    return {
      kind: 'location',
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      name: parsed.data.name ?? null,
      address: parsed.data.address ?? null,
    };
  }
  if (type === 'REACTION') {
    const parsed = reactionPayloadSchema.safeParse(payload);
    if (!parsed.success) return null;
    return { kind: 'reaction', emoji: parsed.data.emoji || null };
  }
  return null;
}

export type FailureSource = {
  readonly status: WhatsappMessageStatus;
  readonly errorCode: string | null;
  readonly errorReason: string | null;
};

// Con código se traduce siempre: el motivo guardado puede ser el texto original de Meta.
export function failureReasonOf(message: FailureSource): string | null {
  if (message.status !== 'FAILED') return null;
  const code = message.errorCode;
  if (code !== null && /^\d+$/.test(code) && Number.isSafeInteger(Number(code))) {
    return sendFailureReasonOf(Number(code));
  }
  return message.errorReason ?? UNKNOWN_SEND_FAILURE_REASON;
}

export function windowOf(lastInboundAt: Date | null, now: Date): WhatsappChatWindow {
  if (lastInboundAt === null || !isWindowOpen(lastInboundAt, now)) return { open: false, closesAt: null };
  return { open: true, closesAt: new Date(lastInboundAt.getTime() + WHATSAPP_WINDOW_MS).toISOString() };
}

export function customerNameOf(ref: { readonly firstNames: string; readonly lastNames: string }): string {
  return `${ref.firstNames} ${ref.lastNames}`.trim();
}
