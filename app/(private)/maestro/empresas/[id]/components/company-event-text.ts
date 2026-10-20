import type { CompanyEventView } from '@/lib/modules/identity';
import { ADDON_NAMES, type AddonNameKey } from '@/lib/shared/ui/addon-names';

import { COMPANY_FIELD_LABELS, formatCompanyDate } from '../../components';

export const COMPANY_EVENT_TEXTS = {
  created: 'Dio de alta la empresa',
  updated: 'Editó',
  deleted: 'Dio de baja la empresa',
  reactivated: 'Reactivó la empresa',
  addonEnabled: 'Prendió',
  addonDisabled: 'Apagó',
  unknown: 'Registró un cambio',
} as const;

export type CompanyEventTextInput = Pick<CompanyEventView, 'kind' | 'fields' | 'addon'>;

const NAMES = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' });

function fieldLabel(field: string): string | undefined {
  return Object.hasOwn(COMPANY_FIELD_LABELS, field)
    ? COMPANY_FIELD_LABELS[field as keyof typeof COMPANY_FIELD_LABELS]
    : undefined;
}

function addonName(addon: string): string | undefined {
  return Object.hasOwn(ADDON_NAMES, addon) ? ADDON_NAMES[addon as AddonNameKey] : undefined;
}

function unknownChange(technicalNames: readonly string[]): string {
  if (technicalNames.length === 0) return COMPANY_EVENT_TEXTS.unknown;
  return `${COMPANY_EVENT_TEXTS.unknown} (${NAMES.format(technicalNames)})`;
}

// El historial viene de la base tal cual: un campo sin etiqueta sale por su nombre técnico.
function updatedText(fields: readonly string[]): string {
  const labels = fields.map(fieldLabel);
  if (fields.length === 0) return COMPANY_EVENT_TEXTS.unknown;
  if (labels.some((label) => label === undefined)) {
    return unknownChange(fields.map((field, index) => labels[index] ?? field));
  }
  return `${COMPANY_EVENT_TEXTS.updated} ${NAMES.format(labels as string[])}`;
}

function addonText(prefix: string, addon: string | null): string {
  if (addon === null) return COMPANY_EVENT_TEXTS.unknown;
  const name = addonName(addon);
  return name === undefined ? unknownChange([addon]) : `${prefix} ${name}`;
}

/** Nombra lo que cambió, nunca sus valores; un tipo desconocido no hace fallar la pantalla. */
export function companyEventText({ kind, fields, addon }: CompanyEventTextInput): string {
  switch (kind) {
    case 'company.created':
      return COMPANY_EVENT_TEXTS.created;
    case 'company.updated':
      return updatedText(fields);
    case 'company.deleted':
      return COMPANY_EVENT_TEXTS.deleted;
    case 'company.reactivated':
      return COMPANY_EVENT_TEXTS.reactivated;
    case 'addon.enabled':
      return addonText(COMPANY_EVENT_TEXTS.addonEnabled, addon);
    case 'addon.disabled':
      return addonText(COMPANY_EVENT_TEXTS.addonDisabled, addon);
    default:
      return COMPANY_EVENT_TEXTS.unknown;
  }
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

// En UTC, como la fecha de la lista, para que servidor y navegador pinten la misma hora.
export function formatCompanyEventInstant(date: Date): string {
  return `${formatCompanyDate(date)} ${twoDigits(date.getUTCHours())}:${twoDigits(date.getUTCMinutes())}`;
}
