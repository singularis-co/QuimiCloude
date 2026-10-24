import { WhatsappTemplateNotSendableError } from './errors';
import type { WhatsappTemplateRecord } from './whatsapp-template';
import { contentOf } from './whatsapp-template-components';
import type { WhatsappTemplateContent } from './whatsapp-template-draft';
import { variableSlotsOf, type TemplateSlot } from './whatsapp-template-variables';

export type TemplateMessage = {
  readonly name: string;
  readonly language: string;
  readonly components: readonly unknown[];
  readonly body: string;
  readonly values: Readonly<Record<string, string>>;
};

export type MissingTemplateValue = { readonly key: string; readonly label: string };

export type OwnVariableValue = { readonly key: string; readonly value: string };

export type TemplateMessageResult =
  | { readonly ok: true; readonly message: TemplateMessage }
  | { readonly ok: false; readonly missing: readonly MissingTemplateValue[] };

const NUMBERED_MARKER = /\{\{([1-9]\d*)\}\}/g;
const HEADER_MARKER = '{{1}}';
const TEXT_PARTS_SEPARATOR = '\n\n';
const UNRESOLVED: { readonly key: undefined; readonly value: undefined } = { key: undefined, value: undefined };

export function isSendable(template: WhatsappTemplateRecord): boolean {
  return (
    template.deletedAt === null &&
    template.enabled &&
    template.mappingStatus === 'MAPPED' &&
    template.status === 'APPROVED'
  );
}

function valueOf(record: Readonly<Record<string, string>>, key: string): string | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function labelOf(constantLabels: Readonly<Record<string, string>>, key: string): string {
  const label = valueOf(constantLabels, key);
  return label === undefined || label.trim() === '' ? key : label;
}

function textParameter(text: string): { readonly type: 'text'; readonly text: string } {
  return { type: 'text', text };
}

function metaComponentsOf(slots: readonly TemplateSlot[], valueBySlot: ReadonlyMap<TemplateSlot, string>): unknown[] {
  const at = (slot: TemplateSlot): string => valueBySlot.get(slot) ?? '';
  const components: unknown[] = [];
  if (slots.includes('header')) components.push({ type: 'header', parameters: [textParameter(at('header'))] });
  const bodySlots = slots.filter((slot) => slot.startsWith('body.'));
  if (bodySlots.length > 0) {
    components.push({ type: 'body', parameters: bodySlots.map((slot) => textParameter(at(slot))) });
  }
  for (const slot of slots) {
    if (!slot.startsWith('button.')) continue;
    const index = slot.slice('button.'.length);
    components.push({ type: 'button', sub_type: 'url', index, parameters: [textParameter(at(slot))] });
  }
  return components;
}

// Con un reemplazo de texto, un `$&` o `$1` dentro del valor se interpretaria como patron.
function finalTextOf(content: WhatsappTemplateContent, valueBySlot: ReadonlyMap<TemplateSlot, string>): string {
  const parts: string[] = [];
  const headerValue = valueBySlot.get('header');
  if (content.header !== null) {
    parts.push(headerValue === undefined ? content.header.text : content.header.text.replaceAll(HEADER_MARKER, () => headerValue));
  }
  parts.push(
    content.body.text.replace(NUMBERED_MARKER, (marker, n: string) => valueBySlot.get(`body.${Number(n)}`) ?? marker),
  );
  if (content.footer !== null) parts.push(content.footer);
  return parts.join(TEXT_PARTS_SEPARATOR);
}

/**
 * Un contenido no relacionable o un hueco sin valor propio no deberian llegar con el mapeo completo;
 * si llegan, la plantilla no se puede enviar.
 */
export function buildTemplateMessage(
  template: WhatsappTemplateRecord,
  ownValues: ReadonlyMap<string, OwnVariableValue>,
  constants: Readonly<Record<string, string>>,
  constantLabels: Readonly<Record<string, string>>,
): TemplateMessageResult {
  const content = contentOf(template.components);
  const slots = variableSlotsOf(content);
  if (content === null || slots === null) {
    throw new WhatsappTemplateNotSendableError(`Plantilla ${template.id}: contenido no relacionable`);
  }
  const bindingBySlot = new Map(template.variables.map((binding) => [binding.slot, binding]));
  const valueBySlot = new Map<TemplateSlot, string>();
  const values: Record<string, string> = {};
  const missing: MissingTemplateValue[] = [];
  for (const slot of slots) {
    const binding = bindingBySlot.get(slot);
    const own = binding?.kind === 'company' ? ownValues.get(binding.variableKeyId) : undefined;
    const { key, value } =
      binding?.kind === 'system' ? { key: binding.systemKey, value: valueOf(constants, binding.systemKey) } : (own ?? UNRESOLVED);
    if (key === undefined) {
      throw new WhatsappTemplateNotSendableError(`Plantilla ${template.id}: hueco ${slot} sin valor`);
    }
    if (value === undefined || value.trim() === '') {
      if (!missing.some((entry) => entry.key === key)) missing.push({ key, label: labelOf(constantLabels, key) });
      continue;
    }
    valueBySlot.set(slot, value);
    values[key] = value;
  }
  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    message: {
      name: template.name,
      language: template.language,
      components: metaComponentsOf(slots, valueBySlot),
      body: finalTextOf(content, valueBySlot),
      values,
    },
  };
}
