import { z } from 'zod';

import {
  inboundMessageHeaderSchema,
  interpretInboundMessage,
  metaTimestampOf,
} from './whatsapp-inbound-message';
import type { WhatsappStatusUpdate } from './whatsapp-message-status';

import type { WhatsappMessagePayload, WhatsappMessageType } from './whatsapp-message';

export const STATUS_ERROR_REASON_MAX_LENGTH = 500;

export type InboundContact = {
  readonly waId: string;
  readonly profileName: string | null;
  readonly latestAt: Date;
};

export type InboundMessage = {
  readonly wamid: string;
  readonly waId: string;
  readonly type: WhatsappMessageType;
  readonly body: string | null;
  readonly payload: WhatsappMessagePayload;
  readonly metaTimestamp: Date;
};

export type InboundStatus = {
  readonly wamid: string;
  readonly status: WhatsappStatusUpdate;
  readonly errorCode: string | null;
  readonly errorReason: string | null;
};

export type InboundBatch = {
  /** Uno por `wa_id`, solo de remitentes de mensajes: nunca del destinatario de un status. */
  readonly contacts: readonly InboundContact[];
  readonly messages: readonly InboundMessage[];
  readonly statuses: readonly InboundStatus[];
  /** `changes` cuenta los de `messages` que no se procesaron: forma rota o teléfono de otra conexión. */
  readonly skipped: { readonly changes: number; readonly messages: number; readonly statuses: number };
};

const notificationSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string().optional(),
      changes: z.array(z.object({ field: z.string(), value: z.unknown() })),
    }),
  ),
});

const contactSchema = z.object({
  wa_id: z.string().min(1),
  profile: z.object({ name: z.string().optional() }).optional(),
});

const valueSchema = z.object({
  metadata: z.object({ phone_number_id: z.string() }),
  contacts: z.array(contactSchema).optional(),
  messages: z.array(z.unknown()).optional(),
  statuses: z.array(z.unknown()).optional(),
});

type ValueContact = z.infer<typeof contactSchema>;

const META_STATUS_UPDATES = {
  sent: 'SENT',
  delivered: 'DELIVERED',
  read: 'READ',
  failed: 'FAILED',
} as const satisfies Record<string, WhatsappStatusUpdate>;

function statusUpdateOf(metaStatus: string): WhatsappStatusUpdate | null {
  return Object.hasOwn(META_STATUS_UPDATES, metaStatus)
    ? META_STATUS_UPDATES[metaStatus as keyof typeof META_STATUS_UPDATES]
    : null;
}

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.string(),
  errors: z.array(z.unknown()).optional(),
});

const statusErrorSchema = z.object({
  code: z.union([z.number(), z.string()]).optional(),
  title: z.string().optional(),
  message: z.string().optional(),
  error_data: z.object({ details: z.string().optional() }).optional(),
});

/**
 * Meta documenta `from` como el teléfono y `contacts[].wa_id` como el id del usuario, y avisa de que
 * pueden no coincidir. Con un solo contacto en el `value` no hay ambigüedad sobre quién escribe.
 */
function senderOf(from: string, contacts: readonly ValueContact[]): { waId: string; profileName: string | null } {
  if (contacts.length === 1) {
    return { waId: contacts[0].wa_id, profileName: contacts[0].profile?.name ?? null };
  }
  const match = contacts.find((contact) => contact.wa_id === from);
  return { waId: from, profileName: match?.profile?.name ?? null };
}

function errorOf(errors: readonly unknown[] | undefined): { code: string | null; reason: string | null } {
  if (errors === undefined || errors.length === 0) return { code: null, reason: null };
  const parsed = statusErrorSchema.safeParse(errors[0]);
  if (!parsed.success) return { code: null, reason: null };
  const error = parsed.data;
  const reason = error.error_data?.details ?? error.message ?? error.title ?? null;
  return {
    code: error.code === undefined ? null : String(error.code),
    reason: reason === null ? null : reason.slice(0, STATUS_ERROR_REASON_MAX_LENGTH),
  };
}

type ContactAccumulator = { waId: string; profileName: string | null; latestAt: Date };

/** Igual que la base: un nombre solo lo pisa uno de un mensaje más reciente, y nunca un `null`. */
function accumulateContact(
  contacts: Map<string, ContactAccumulator>,
  waId: string,
  profileName: string | null,
  at: Date,
): void {
  const current = contacts.get(waId);
  if (current === undefined) {
    contacts.set(waId, { waId, profileName, latestAt: at });
    return;
  }
  if (at.getTime() >= current.latestAt.getTime()) {
    current.latestAt = at;
    if (profileName !== null) current.profileName = profileName;
  } else if (current.profileName === null) {
    current.profileName = profileName;
  }
}

/**
 * `null` si el cuerpo no tiene la forma de una notificación. Lo que no se entiende dentro de una
 * notificación válida se salta con conteo y no tumba el resto.
 */
export function parseWhatsappWebhook(json: unknown, phoneNumberId: string): InboundBatch | null {
  const notification = notificationSchema.safeParse(json);
  if (!notification.success) return null;

  const contacts = new Map<string, ContactAccumulator>();
  const messages: InboundMessage[] = [];
  const seenWamids = new Set<string>();
  const statuses: InboundStatus[] = [];
  const skipped = { changes: 0, messages: 0, statuses: 0 };

  for (const entry of notification.data.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;
      const value = valueSchema.safeParse(change.value);
      if (!value.success || value.data.metadata.phone_number_id !== phoneNumberId) {
        skipped.changes += 1;
        continue;
      }
      const valueContacts = value.data.contacts ?? [];

      for (const raw of value.data.messages ?? []) {
        const header = inboundMessageHeaderSchema.safeParse(raw);
        if (!header.success) {
          skipped.messages += 1;
          continue;
        }
        if (seenWamids.has(header.data.id)) continue;
        seenWamids.add(header.data.id);

        const sender = senderOf(header.data.from, valueContacts);
        const metaTimestamp = metaTimestampOf(header.data);
        const interpreted = interpretInboundMessage(header.data, raw);
        messages.push({
          wamid: header.data.id,
          waId: sender.waId,
          type: interpreted.type,
          body: interpreted.body,
          payload: interpreted.payload,
          metaTimestamp,
        });
        accumulateContact(contacts, sender.waId, sender.profileName, metaTimestamp);
      }

      for (const raw of value.data.statuses ?? []) {
        const parsed = statusSchema.safeParse(raw);
        const status = parsed.success ? statusUpdateOf(parsed.data.status) : null;
        if (!parsed.success || status === null) {
          skipped.statuses += 1;
          continue;
        }
        const error = status === 'FAILED' ? errorOf(parsed.data.errors) : { code: null, reason: null };
        statuses.push({ wamid: parsed.data.id, status, errorCode: error.code, errorReason: error.reason });
      }
    }
  }

  return {
    contacts: [...contacts.values()].map(({ waId, profileName, latestAt }) => ({ waId, profileName, latestAt })),
    messages,
    statuses,
    skipped,
  };
}
