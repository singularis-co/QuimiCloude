import { z } from 'zod';

import type { WhatsappMessageDirection, WhatsappMessageType } from './whatsapp-message';

export const VIEWABLE_MEDIA_TYPES = ['IMAGE', 'STICKER'] as const satisfies readonly WhatsappMessageType[];
export const WHATSAPP_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const WHATSAPP_MEDIA_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const mediaIdPayloadSchema = z.object({ media_id: z.string().min(1) });

/** Dirección de la imagen de un mensaje por su id interno; la inyecta la composición. Nunca apunta a Meta. */
export type MediaUrlOf = (messageId: string) => string;

export function mediaIdOf(payload: unknown): string | null {
  const parsed = mediaIdPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data.media_id : null;
}

export function isViewableMediaType(type: WhatsappMessageType): boolean {
  return (VIEWABLE_MEDIA_TYPES as readonly WhatsappMessageType[]).includes(type);
}

export function isViewableMedia(direction: WhatsappMessageDirection, type: WhatsappMessageType, payload: unknown): boolean {
  return direction === 'IN' && isViewableMediaType(type) && mediaIdOf(payload) !== null;
}

export function isAllowedMediaContentType(contentType: string): boolean {
  return (WHATSAPP_MEDIA_CONTENT_TYPES as readonly string[]).includes(contentType.toLowerCase());
}
