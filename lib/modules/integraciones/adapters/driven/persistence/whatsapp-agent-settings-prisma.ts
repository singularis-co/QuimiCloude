import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { companyScopeColumns } from './company-scope';

import type { IntegracionesScope } from '../../../domain/integraciones-scope';
import type { WhatsappAgentSettings } from '../../../domain/whatsapp-agent-settings';
import type { WhatsappAgentSettingsRepository } from '../../../ports/whatsapp-agent-settings-repository';

/** Exactamente los campos de `WhatsappAgentSettings`: la auditoría no sale. */
const SETTINGS_SELECT = {
  enabled: true,
  confidenceThreshold: true,
  dailyReplyLimit: true,
  contactHourlyReplyLimit: true,
  inactivityHours: true,
  handoffMessage: true,
  greetingMessage: true,
  assistantName: true,
} satisfies Prisma.WhatsappAgentSettingsSelect;

type SettingsRow = Prisma.WhatsappAgentSettingsGetPayload<{ select: typeof SETTINGS_SELECT }>;

function toSettings(row: SettingsRow): WhatsappAgentSettings {
  return {
    enabled: row.enabled,
    confidenceThreshold: row.confidenceThreshold.toNumber(),
    dailyReplyLimit: row.dailyReplyLimit,
    contactHourlyReplyLimit: row.contactHourlyReplyLimit,
    inactivityHours: row.inactivityHours,
    handoffMessage: row.handoffMessage,
    greetingMessage: row.greetingMessage,
    assistantName: row.assistantName,
  };
}

function toColumns(settings: WhatsappAgentSettings, by: string, at: Date) {
  return {
    enabled: settings.enabled,
    // Por texto: un `number` como 0.29 no es exacto en binario y la columna guarda dos decimales.
    confidenceThreshold: new Prisma.Decimal(settings.confidenceThreshold.toFixed(2)),
    dailyReplyLimit: settings.dailyReplyLimit,
    contactHourlyReplyLimit: settings.contactHourlyReplyLimit,
    inactivityHours: settings.inactivityHours,
    handoffMessage: settings.handoffMessage,
    greetingMessage: settings.greetingMessage,
    assistantName: settings.assistantName,
    updatedById: by,
    updatedAt: at,
  };
}

export async function findWhatsappAgentSettings(scope: IntegracionesScope): Promise<WhatsappAgentSettings | null> {
  const row = await prisma.whatsappAgentSettings.findUnique({
    where: companyScopeColumns(scope),
    select: SETTINGS_SELECT,
  });
  return row === null ? null : toSettings(row);
}

/**
 * `where` y `create` con la misma clave única: Prisma lo manda como un solo
 * `INSERT ... ON CONFLICT DO UPDATE`, así que dos guardados a la vez no chocan.
 */
export async function saveWhatsappAgentSettings(
  settings: WhatsappAgentSettings,
  by: string,
  at: Date,
  scope: IntegracionesScope,
): Promise<void> {
  const columns = toColumns(settings, by, at);
  await prisma.whatsappAgentSettings.upsert({
    where: companyScopeColumns(scope),
    create: { ...companyScopeColumns(scope), ...columns },
    update: columns,
    select: { companyId: true },
  });
}

export function createWhatsappAgentSettingsRepository(): WhatsappAgentSettingsRepository {
  return { find: findWhatsappAgentSettings, save: saveWhatsappAgentSettings };
}
