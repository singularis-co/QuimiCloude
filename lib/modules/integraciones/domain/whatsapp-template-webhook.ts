import { z } from 'zod';

import { isWhatsappTemplateCategory, statusOf, type TemplateWebhookUpdate } from './whatsapp-template';

export const TEMPLATE_STATUS_FIELD = 'message_template_status_update';
export const TEMPLATE_CATEGORY_FIELD = 'template_category_update';
export const TEMPLATE_REJECTED_REASON_MAX_LENGTH = 500;

const NO_REJECTION = 'NONE';
const META_ID_PATTERN = /^[1-9]\d*$/;

const metaIdSchema = z.union([z.number(), z.string()]);

const statusChangeSchema = z
  .object({
    event: z.string().min(1),
    message_template_id: metaIdSchema,
    message_template_name: z.string().optional(),
    message_template_language: z.string().optional(),
    reason: z.string().nullish(),
  })
  .passthrough();

// El aviso previo trae `correct_category` y el cambio hecho `previous_category`: los dos traen `new_category`.
const categoryChangeSchema = z
  .object({
    message_template_id: metaIdSchema,
    new_category: z.string(),
    previous_category: z.string().optional(),
    correct_category: z.string().optional(),
  })
  .passthrough();

export function isTemplateWebhookField(field: string): boolean {
  return field === TEMPLATE_STATUS_FIELD || field === TEMPLATE_CATEGORY_FIELD;
}

// Un id por encima de 2^53 ya llegó cambiado de `JSON.parse`: cruzarlo podría tocar otra plantilla.
function metaIdOf(raw: number | string): string | null {
  if (typeof raw === 'number' && !Number.isSafeInteger(raw)) return null;
  const id = String(raw);
  return META_ID_PATTERN.test(id) ? id : null;
}

// Postgres no admite U+0000 en texto.
function anyNul(values: readonly (string | null | undefined)[]): boolean {
  return values.some((value) => typeof value === 'string' && value.includes('\u0000'));
}

function rejectedReasonOf(status: string, reason: string | null | undefined): string | null {
  if (status !== 'REJECTED' || reason === null || reason === undefined) return null;
  if (reason.trim() === '' || reason === NO_REJECTION) return null;
  return [...reason].slice(0, TEMPLATE_REJECTED_REASON_MAX_LENGTH).join('');
}

function statusUpdateOf(value: unknown): TemplateWebhookUpdate | null {
  const parsed = statusChangeSchema.safeParse(value);
  if (!parsed.success) return null;
  const change = parsed.data;
  const metaTemplateId = metaIdOf(change.message_template_id);
  if (metaTemplateId === null) return null;
  if (anyNul([change.event, change.reason, change.message_template_name, change.message_template_language])) {
    return null;
  }
  const { status, statusRaw } = statusOf(change.event);
  return { kind: 'status', metaTemplateId, status, statusRaw, rejectedReason: rejectedReasonOf(status, change.reason) };
}

function categoryUpdateOf(value: unknown): TemplateWebhookUpdate | null {
  const parsed = categoryChangeSchema.safeParse(value);
  if (!parsed.success) return null;
  const change = parsed.data;
  const metaTemplateId = metaIdOf(change.message_template_id);
  if (metaTemplateId === null || !isWhatsappTemplateCategory(change.new_category)) return null;
  return { kind: 'category', metaTemplateId, category: change.new_category };
}

/** `null` si el cambio no se puede guardar tal cual: se salta con conteo, sin tumbar el resto. */
export function interpretTemplateChange(field: string, value: unknown): TemplateWebhookUpdate | null {
  if (field === TEMPLATE_STATUS_FIELD) return statusUpdateOf(value);
  if (field === TEMPLATE_CATEGORY_FIELD) return categoryUpdateOf(value);
  return null;
}
