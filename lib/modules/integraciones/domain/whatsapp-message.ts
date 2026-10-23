export const WHATSAPP_MESSAGE_DIRECTIONS = ['IN', 'OUT'] as const;
export type WhatsappMessageDirection = (typeof WHATSAPP_MESSAGE_DIRECTIONS)[number];

export const WHATSAPP_MESSAGE_TYPES = [
  'TEXT',
  'IMAGE',
  'AUDIO',
  'VIDEO',
  'DOCUMENT',
  'STICKER',
  'LOCATION',
  'CONTACTS',
  'REACTION',
  'BUTTON',
  'INTERACTIVE',
  'TEMPLATE',
  'UNSUPPORTED',
] as const;
export type WhatsappMessageType = (typeof WHATSAPP_MESSAGE_TYPES)[number];

export const WHATSAPP_MESSAGE_STATUSES = [
  'RECEIVED',
  'QUEUED',
  'SENDING',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
] as const;
export type WhatsappMessageStatus = (typeof WHATSAPP_MESSAGE_STATUSES)[number];

export const WHATSAPP_MESSAGE_ORIGINS = ['USER', 'SYSTEM'] as const;
export type WhatsappMessageOrigin = (typeof WHATSAPP_MESSAGE_ORIGINS)[number];

/** Un entrante nace con este estado y ningún status de Meta lo cambia. */
export const INBOUND_MESSAGE_STATUS: WhatsappMessageStatus = 'RECEIVED';
export const INBOUND_MESSAGE_DIRECTION: WhatsappMessageDirection = 'IN';

/** Contenido propio de cada tipo; se guarda como JSON. */
export type WhatsappMessagePayload = { readonly [key: string]: unknown };
