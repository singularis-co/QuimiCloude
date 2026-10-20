import { sameComponents } from './template-sync-plan';
import { contentOf } from './whatsapp-template-components';
import type { WhatsappTemplateButton, WhatsappTemplateContent } from './whatsapp-template-draft';

export type TemplateSlot = 'header' | `body.${number}` | `button.${number}`;

export type TemplateVariableBinding =
  | { readonly slot: TemplateSlot; readonly kind: 'system'; readonly systemKey: string }
  | { readonly slot: TemplateSlot; readonly kind: 'company'; readonly variableKeyId: string };

export type TemplateMappingStatus = 'UNMAPPED' | 'MAPPED';

const NUMBERED_MARKER = /\{\{([1-9]\d*)\}\}/g;
const URL_VARIABLE = '{{1}}';

function numbersOf(text: string): number[] {
  const distinct = new Set([...text.matchAll(NUMBERED_MARKER)].map((match) => Number(match[1])));
  return [...distinct].sort((a, b) => a - b);
}

function hasUrlVariable(button: WhatsappTemplateButton): button is Extract<WhatsappTemplateButton, { type: 'URL' }> {
  return button.type === 'URL' && button.url.endsWith(URL_VARIABLE);
}

const ANY_MARKER = /\{\{([^{}]*)\}\}/g;
const POSITIONAL = /^[1-9]\d*$/;

function textsOf(content: WhatsappTemplateContent): string[] {
  const texts = [content.body.text];
  if (content.header !== null) texts.push(content.header.text);
  if (content.footer !== null) texts.push(content.footer);
  for (const button of content.buttons) {
    texts.push(button.text);
    if (button.type === 'URL') texts.push(button.url);
  }
  return texts;
}

// Una variable con nombre (`{{first_name}}`) no tiene numero al que relacionar una clave.
function hasNamedMarker(content: WhatsappTemplateContent): boolean {
  return textsOf(content).some((text) => [...text.matchAll(ANY_MARKER)].some((match) => !POSITIONAL.test(match[1] ?? '')));
}

/** `null` si el contenido no es relacionable: no tiene huecos que se puedan relacionar. */
export function variableSlotsOf(content: WhatsappTemplateContent | null): readonly TemplateSlot[] | null {
  if (content === null || hasNamedMarker(content)) return null;
  const slots: TemplateSlot[] = [];
  if (content.header !== null && content.header.text.includes(URL_VARIABLE)) slots.push('header');
  for (const n of numbersOf(content.body.text)) slots.push(`body.${n}`);
  content.buttons.forEach((button, index) => {
    if (hasUrlVariable(button)) slots.push(`button.${index}`);
  });
  return slots;
}

/** La unica regla del estado del mapeo: quien escribe relaciones o componentes guarda lo que diga. */
export function mappingStatusOf(
  components: unknown,
  bindings: readonly TemplateVariableBinding[],
): TemplateMappingStatus {
  const slots = variableSlotsOf(contentOf(components));
  if (slots === null) return 'UNMAPPED';
  const bound = new Set(bindings.map((binding) => binding.slot));
  return slots.every((slot) => bound.has(slot)) ? 'MAPPED' : 'UNMAPPED';
}

// Se compara el contenido y no el JSON: lo guardado al crear es lo enviado a Meta y la sincronizacion
// trae lo que Meta lista, que puede traer otra forma para el mismo contenido.
export function componentsChanged(before: unknown, after: unknown): boolean {
  const contentBefore = contentOf(before);
  const contentAfter = contentOf(after);
  if (contentBefore !== null && contentAfter !== null) return !sameComponents(contentBefore, contentAfter);
  return !sameComponents(before, after);
}

function keyed(key: string): string {
  return `{{${key}}}`;
}

/** Los huecos relacionados se muestran con su clave; los ejemplos, que son los de Meta, no se tocan. */
export function showKeys(
  content: WhatsappTemplateContent,
  keyBySlot: ReadonlyMap<TemplateSlot, string>,
): WhatsappTemplateContent {
  const headerKey = keyBySlot.get('header');
  const header =
    content.header === null || headerKey === undefined
      ? content.header
      : { ...content.header, text: content.header.text.replaceAll(URL_VARIABLE, keyed(headerKey)) };
  const bodyText = content.body.text.replace(NUMBERED_MARKER, (marker, n: string) => {
    const key = keyBySlot.get(`body.${Number(n)}`);
    return key === undefined ? marker : keyed(key);
  });
  const buttons = content.buttons.map((button, index): WhatsappTemplateButton => {
    const key = keyBySlot.get(`button.${index}`);
    if (key === undefined || !hasUrlVariable(button)) return button;
    return { ...button, url: `${button.url.slice(0, -URL_VARIABLE.length)}${keyed(key)}` };
  });
  return { header, body: { ...content.body, text: bodyText }, footer: content.footer, buttons };
}
