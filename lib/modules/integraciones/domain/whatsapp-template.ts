import type { WhatsappTemplateContent } from './whatsapp-template-draft';

export const WHATSAPP_TEMPLATE_CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'] as const;
export type WhatsappTemplateCategory = (typeof WHATSAPP_TEMPLATE_CATEGORIES)[number];

export const CREATABLE_TEMPLATE_CATEGORIES = ['MARKETING', 'UTILITY'] as const;
export type CreatableTemplateCategory = (typeof CREATABLE_TEMPLATE_CATEGORIES)[number];

export const KNOWN_TEMPLATE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED'] as const;
export type KnownTemplateStatus = (typeof KNOWN_TEMPLATE_STATUSES)[number];
export type WhatsappTemplateStatus = KnownTemplateStatus | 'OTHER';

export const TEMPLATE_STATUS_RAW_MAX_LENGTH = 100;

export type WhatsappTemplateRecord = {
  readonly id: string;
  readonly companyId: string;
  readonly connectionId: string;
  readonly metaTemplateId: string;
  readonly name: string;
  readonly language: string;
  readonly category: WhatsappTemplateCategory;
  readonly components: unknown;
  readonly status: WhatsappTemplateStatus;
  readonly statusRaw: string | null;
  readonly rejectedReason: string | null;
  readonly lastSyncedAt: Date | null;
  readonly createdById: string | null;
  readonly createdAt: Date;
  readonly deletedAt: Date | null;
};

export type WhatsappTemplateView = {
  readonly id: string;
  readonly name: string;
  readonly language: string;
  readonly category: WhatsappTemplateCategory;
  readonly status: WhatsappTemplateStatus;
  readonly statusRaw: string | null;
  readonly rejectedReason: string | null;
  readonly content: WhatsappTemplateContent | null;
  readonly lastSyncedAt: string | null;
  readonly createdAt: string;
};

export type WhatsappTemplateList = {
  readonly templates: readonly WhatsappTemplateView[];
  readonly templatesSyncedAt: string | null;
};

export type TemplateSyncSummary = {
  readonly imported: number;
  readonly updated: number;
  readonly deleted: number;
  readonly skipped: number;
  readonly syncedAt: string;
};

function isKnownStatus(raw: string): raw is KnownTemplateStatus {
  return (KNOWN_TEMPLATE_STATUSES as readonly string[]).includes(raw);
}

export function statusOf(raw: string): { status: WhatsappTemplateStatus; statusRaw: string | null } {
  if (isKnownStatus(raw)) return { status: raw, statusRaw: null };
  return { status: 'OTHER', statusRaw: [...raw].slice(0, TEMPLATE_STATUS_RAW_MAX_LENGTH).join('') };
}

export function isWhatsappTemplateCategory(value: string): value is WhatsappTemplateCategory {
  return (WHATSAPP_TEMPLATE_CATEGORIES as readonly string[]).includes(value);
}
