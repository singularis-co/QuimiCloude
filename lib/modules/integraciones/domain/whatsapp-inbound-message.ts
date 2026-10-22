import { z } from 'zod';

import type { WhatsappMessagePayload, WhatsappMessageType } from './whatsapp-message';

/** Sin esta cabecera no hay `wamid` ni remitente: el mensaje no se puede guardar ni como no soportado. */
export const inboundMessageHeaderSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  timestamp: z.string().regex(/^\d+$/),
  type: z.string(),
});

export type InboundMessageHeader = z.infer<typeof inboundMessageHeaderSchema>;

export type InterpretedMessage = {
  readonly type: WhatsappMessageType;
  readonly body: string | null;
  readonly payload: WhatsappMessagePayload;
};

const textSchema = z.object({ text: z.object({ body: z.string() }) });

const mediaObjectSchema = z.object({
  id: z.string().min(1),
  mime_type: z.string(),
  caption: z.string().optional(),
});

const documentObjectSchema = mediaObjectSchema.extend({ filename: z.string().optional() });

const locationSchema = z.object({
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    name: z.string().optional(),
    address: z.string().optional(),
  }),
});

const contactsSchema = z.object({ contacts: z.array(z.unknown()) });

// Meta omite `emoji` cuando el usuario quita la reacción.
const reactionSchema = z.object({
  reaction: z.object({ message_id: z.string().min(1), emoji: z.string().optional() }),
});

const buttonSchema = z.object({
  button: z.object({ text: z.string(), payload: z.string().optional() }),
});

const replySchema = z.object({ id: z.string(), title: z.string() });

const interactiveSchema = z.object({
  interactive: z.discriminatedUnion('type', [
    z.object({ type: z.literal('button_reply'), button_reply: replySchema }),
    z.object({
      type: z.literal('list_reply'),
      list_reply: replySchema.extend({ description: z.string().optional() }),
    }),
  ]),
});

const MEDIA_TYPES = {
  image: 'IMAGE',
  video: 'VIDEO',
  audio: 'AUDIO',
  sticker: 'STICKER',
} as const satisfies Record<string, WhatsappMessageType>;

function isMediaType(type: string): type is keyof typeof MEDIA_TYPES {
  return Object.hasOwn(MEDIA_TYPES, type);
}

/** Solo las claves que vinieron: `undefined` no es JSON. */
function defined(entries: Record<string, unknown>): WhatsappMessagePayload {
  return Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== undefined));
}

function unsupported(raw: unknown): InterpretedMessage {
  return { type: 'UNSUPPORTED', body: null, payload: raw as WhatsappMessagePayload };
}

function interpretKnown(type: string, raw: unknown): InterpretedMessage | null {
  if (type === 'text') {
    const parsed = textSchema.safeParse(raw);
    return parsed.success ? { type: 'TEXT', body: parsed.data.text.body, payload: {} } : null;
  }
  if (isMediaType(type)) {
    const parsed = z.object({ [type]: mediaObjectSchema }).safeParse(raw);
    if (!parsed.success) return null;
    const media = parsed.data[type] as z.infer<typeof mediaObjectSchema>;
    return {
      type: MEDIA_TYPES[type],
      body: media.caption ?? null,
      payload: defined({ media_id: media.id, mime_type: media.mime_type, caption: media.caption }),
    };
  }
  if (type === 'document') {
    const parsed = z.object({ document: documentObjectSchema }).safeParse(raw);
    if (!parsed.success) return null;
    const document = parsed.data.document;
    return {
      type: 'DOCUMENT',
      body: document.caption ?? null,
      payload: defined({
        media_id: document.id,
        mime_type: document.mime_type,
        caption: document.caption,
        filename: document.filename,
      }),
    };
  }
  if (type === 'location') {
    const parsed = locationSchema.safeParse(raw);
    if (!parsed.success) return null;
    const location = parsed.data.location;
    return {
      type: 'LOCATION',
      body: location.name ?? location.address ?? null,
      payload: defined({
        latitude: location.latitude,
        longitude: location.longitude,
        name: location.name,
        address: location.address,
      }),
    };
  }
  if (type === 'contacts') {
    const parsed = contactsSchema.safeParse(raw);
    if (!parsed.success) return null;
    return { type: 'CONTACTS', body: null, payload: { contacts: parsed.data.contacts } };
  }
  if (type === 'reaction') {
    const parsed = reactionSchema.safeParse(raw);
    if (!parsed.success) return null;
    const { message_id: messageId, emoji: rawEmoji } = parsed.data.reaction;
    const emoji = rawEmoji === undefined || rawEmoji === '' ? null : rawEmoji;
    return { type: 'REACTION', body: emoji, payload: { message_id: messageId, emoji } };
  }
  if (type === 'button') {
    const parsed = buttonSchema.safeParse(raw);
    if (!parsed.success) return null;
    const button = parsed.data.button;
    return { type: 'BUTTON', body: button.text, payload: defined({ text: button.text, payload: button.payload }) };
  }
  if (type === 'interactive') {
    const parsed = interactiveSchema.safeParse(raw);
    if (!parsed.success) return null;
    const interactive = parsed.data.interactive;
    const reply =
      interactive.type === 'button_reply'
        ? { ...interactive.button_reply, description: undefined }
        : interactive.list_reply;
    return {
      type: 'INTERACTIVE',
      body: reply.title,
      payload: defined({
        reply_type: interactive.type,
        id: reply.id,
        title: reply.title,
        description: reply.description,
      }),
    };
  }
  return null;
}

/**
 * Un tipo desconocido, o uno conocido cuyo objeto no casa, se guarda entero como no soportado: así
 * no se pierde nada de lo que mandó Meta. `from` se añade a todo lo demás porque Meta avisa de que
 * puede no coincidir con `contacts[].wa_id`.
 */
export function interpretInboundMessage(header: InboundMessageHeader, raw: unknown): InterpretedMessage {
  const known = interpretKnown(header.type, raw);
  if (known === null) return unsupported(raw);
  return { ...known, payload: { from: header.from, ...known.payload } };
}

export function metaTimestampOf(header: InboundMessageHeader): Date {
  return new Date(Number(header.timestamp) * 1000);
}
