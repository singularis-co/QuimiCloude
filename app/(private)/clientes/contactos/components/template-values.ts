import type { WhatsappSendableTemplate } from '@/lib/modules/integraciones';
import { SYSTEM_CONSTANTS } from '@/lib/shared/ui/whatsapp-system-constants';

import { MISSING_VALUE_TEXT } from './contact-texts';

export type TemplateValues = Readonly<Record<string, string | null>>;

export type MissingTemplateValue = { readonly key: string; readonly label: string };

export type ResolvedTemplate = {
  readonly header: string | null;
  readonly body: string;
  readonly footer: string | null;
  readonly text: string;
  readonly missing: readonly MissingTemplateValue[];
};

const MARKER_PATTERN = /\{\{([^{}]*)\}\}/g;
const PART_SEPARATOR = '\n\n';

const CONSTANT_LABELS: ReadonlyMap<string, string> = new Map(
  SYSTEM_CONSTANTS.map((constant) => [constant.backendKey, constant.label]),
);

function valueOf(values: TemplateValues, key: string): string | null {
  return Object.hasOwn(values, key) ? (values[key] ?? null) : null;
}

function labelOf(template: WhatsappSendableTemplate, key: string): string {
  const constantLabel = CONSTANT_LABELS.get(key);
  if (constantLabel !== undefined) return constantLabel;
  return template.variables.find((variable) => variable.key === key)?.label ?? key;
}

export function resolveTemplate(template: WhatsappSendableTemplate, values: TemplateValues): ResolvedTemplate {
  const missing = new Map<string, MissingTemplateValue>();
  const fill = (text: string): string =>
    text.replace(MARKER_PATTERN, (_marker, key: string) => {
      const value = valueOf(values, key);
      if (value !== null) return value;
      if (!missing.has(key)) missing.set(key, { key, label: labelOf(template, key) });
      return MISSING_VALUE_TEXT.marker(key);
    });

  const { content } = template;
  const header = content.header === null ? null : fill(content.header.text);
  const body = fill(content.body.text);
  const footer = content.footer === null ? null : fill(content.footer);
  const text = [header, body, footer].filter((part): part is string => part !== null && part !== '').join(PART_SEPARATOR);

  return { header, body, footer, text, missing: [...missing.values()] };
}

/** Las propias no van: el servidor pone su valor guardado. */
export function systemConstantsFor(template: WhatsappSendableTemplate, values: TemplateValues): Record<string, string> {
  const constants: Record<string, string> = {};
  for (const variable of template.variables) {
    if (variable.kind !== 'system') continue;
    const value = valueOf(values, variable.key);
    if (value !== null) constants[variable.key] = value;
  }
  return constants;
}

export function missingValuesText(missing: readonly MissingTemplateValue[]): string | null {
  if (missing.length === 0) return null;
  const labels = missing.map((entry) => entry.label);
  const last = labels.pop();
  const list = labels.length === 0 ? last : `${labels.join(MISSING_VALUE_TEXT.separator)}${MISSING_VALUE_TEXT.lastSeparator}${last}`;
  return `${MISSING_VALUE_TEXT.prefix} ${list}`;
}
