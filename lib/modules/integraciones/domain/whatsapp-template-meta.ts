import { z } from 'zod';

import {
  isWhatsappTemplateCategory,
  statusOf,
  type WhatsappTemplateCategory,
  type WhatsappTemplateStatus,
} from './whatsapp-template';

export type MetaTemplateSnapshot = {
  readonly metaTemplateId: string;
  readonly name: string;
  readonly language: string;
  readonly category: WhatsappTemplateCategory;
  readonly status: WhatsappTemplateStatus;
  readonly statusRaw: string | null;
  readonly rejectedReason: string | null;
  readonly components: unknown;
};

export type MetaTemplateInterpretation =
  | { readonly ok: true; readonly template: MetaTemplateSnapshot }
  | { readonly ok: false; readonly metaTemplateId: string | null };

const META_ID_PATTERN = /^\d+$/;
const NO_REJECTION = 'NONE';

const metaTemplateSchema = z
  .object({
    id: z.string().regex(META_ID_PATTERN),
    name: z.string().min(1),
    language: z.string().min(1),
    status: z.string(),
    category: z.string(),
    components: z.array(z.unknown()).optional(),
    rejected_reason: z.string().nullish(),
  })
  .passthrough();

const idOnlySchema = z.object({ id: z.string().regex(META_ID_PATTERN) });

// Postgres no admite U+0000 en texto ni en jsonb.
function containsNul(value: unknown): boolean {
  if (typeof value === 'string') return value.includes('\u0000');
  if (Array.isArray(value)) return value.some(containsNul);
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).some(([key, inner]) => key.includes('\u0000') || containsNul(inner));
  }
  return false;
}

function rejectedReasonOf(status: string, reason: string | null | undefined): string | null {
  if (status !== 'REJECTED' || reason === null || reason === undefined) return null;
  if (reason.trim() === '' || reason === NO_REJECTION) return null;
  return reason;
}

export function interpretMetaTemplate(raw: unknown): MetaTemplateInterpretation {
  const idOnly = idOnlySchema.safeParse(raw);
  const metaTemplateId = idOnly.success ? idOnly.data.id : null;
  const parsed = metaTemplateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, metaTemplateId };
  const meta = parsed.data;
  const components = meta.components ?? [];
  const texts = [meta.name, meta.language, meta.status, meta.category, meta.rejected_reason ?? ''];
  if (texts.some(containsNul) || containsNul(components)) return { ok: false, metaTemplateId };
  if (!isWhatsappTemplateCategory(meta.category)) return { ok: false, metaTemplateId };
  return {
    ok: true,
    template: {
      metaTemplateId: meta.id,
      name: meta.name,
      language: meta.language,
      category: meta.category,
      ...statusOf(meta.status),
      rejectedReason: rejectedReasonOf(meta.status, meta.rejected_reason),
      components,
    },
  };
}
