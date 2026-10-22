import { z } from 'zod';

import { CREATABLE_TEMPLATE_CATEGORIES, type CreatableTemplateCategory } from './whatsapp-template';
import {
  validateWhatsappTemplateDraft,
  type WhatsappTemplateButton,
  type WhatsappTemplateContent,
  type WhatsappTemplateDraft,
  type WhatsappTemplateIssue,
} from './whatsapp-template-draft';
import type { TemplateSlot, TemplateVariableBinding } from './whatsapp-template-variables';
import { isConstantKey, isOwnKey } from './whatsapp-variable-key';

/**
 * El borrador que escribe la pantalla: variables como `{{clave}}` y sin ejemplos. Las constantes
 * las define el front, que manda su etiqueta para usarla como ejemplo; no se guarda.
 */
export type WhatsappTemplateKeyedDraft = {
  readonly name: string;
  readonly language: string;
  readonly category: string;
  readonly header: { readonly text: string } | null;
  readonly body: { readonly text: string };
  readonly footer: string | null;
  readonly buttons: readonly (
    | { readonly type: 'QUICK_REPLY'; readonly text: string }
    | { readonly type: 'URL'; readonly text: string; readonly url: string }
    | { readonly type: 'PHONE_NUMBER'; readonly text: string; readonly phoneNumber: string }
  )[];
  readonly constantLabels?: Readonly<Record<string, string>>;
};

/** Una variable propia de la empresa: el diccionario no tiene constantes. */
export type DictionaryEntry = { readonly id: string; readonly key: string; readonly label: string };

export type WhatsappTemplateKeyedDraftResult =
  | { readonly ok: true; readonly draft: WhatsappTemplateDraft; readonly bindings: readonly TemplateVariableBinding[] }
  | { readonly ok: false; readonly issues: readonly WhatsappTemplateIssue[] };

const MARKER_PATTERN = /\{\{([^{}]*)\}\}/g;
const URL_VARIABLE = '{{1}}';
// Los ejemplos son las etiquetas del diccionario: no se validan en la app, si Meta los rechaza
// responde con su error.
const EXAMPLE_FIELD = /^(header\.example|body\.examples(\.\d+)?|buttons\.\d+\.example)$/;
const TRANSLATED_FIELD = /^(header\.text|body\.text|buttons\.\d+\.url)$/;

// `z.object` descarta las claves que no declara: un ejemplo que llegue se ignora.
const buttonShape = z.discriminatedUnion('type', [
  z.object({ type: z.literal('QUICK_REPLY'), text: z.string() }),
  z.object({ type: z.literal('URL'), text: z.string(), url: z.string() }),
  z.object({ type: z.literal('PHONE_NUMBER'), text: z.string(), phoneNumber: z.string() }),
]);

const keyedDraftShape = z.object({
  name: z.string(),
  language: z.string(),
  category: z.string(),
  header: z.object({ text: z.string() }).nullish(),
  body: z.object({ text: z.string() }),
  footer: z.string().nullish(),
  buttons: z.array(buttonShape).default([]),
  constantLabels: z.record(z.string(), z.string()).nullish(),
});

type KeyedShape = z.infer<typeof keyedDraftShape>;

function shapeIssuesOf(error: z.ZodError): WhatsappTemplateIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join('.'),
    code: issue.code === 'invalid_union' ? 'not_allowed' : 'required',
    message: issue.code === 'invalid_union' ? 'Ese tipo de botón no está admitido.' : 'Falta este dato o no tiene la forma esperada.',
  }));
}

type Translation = {
  readonly text: string;
  /** Claves en el orden de su numero: la de `{{1}}` primero. */
  readonly keys: readonly string[];
};

/** Cada clave distinta recibe el siguiente numero por orden de primera aparicion. */
function translate(text: string): Translation {
  const keys: string[] = [];
  const translated = text.replace(MARKER_PATTERN, (_marker, inner: string) => {
    let index = keys.indexOf(inner);
    if (index === -1) index = keys.push(inner) - 1;
    return `{{${index + 1}}}`;
  });
  return { text: translated, keys };
}

class MarkerCheck {
  readonly issues: WhatsappTemplateIssue[] = [];
  readonly fields = new Set<string>();

  constructor(
    private readonly byKey: ReadonlyMap<string, DictionaryEntry>,
    private readonly constantLabels: ReadonlyMap<string, string>,
  ) {}

  /** Comprueba las marcas de un campo; devuelve si todas son claves validas con su ejemplo. */
  check(field: string, text: string): boolean {
    const before = this.issues.length;
    for (const match of text.matchAll(MARKER_PATTERN)) {
      const problem = this.problemOf(match[1] ?? '');
      if (problem !== null) {
        this.add(field, problem.code, problem.message);
        break;
      }
    }
    return this.issues.length === before;
  }

  // Una constante no se busca en ningun sitio: la define el front y basta con su forma.
  private problemOf(key: string): Pick<WhatsappTemplateIssue, 'code' | 'message'> | null {
    if (isConstantKey(key)) {
      if ((this.constantLabels.get(key) ?? '').trim() !== '') return null;
      return { code: 'example_missing', message: `Falta la etiqueta de la constante {{${key}}}.` };
    }
    if (!isOwnKey(key)) {
      return {
        code: 'invalid_variable',
        message: 'Las variables se escriben {{clave}}, con una variable propia o una constante entidad.campo.',
      };
    }
    if (this.byKey.has(key)) return null;
    return { code: 'unknown_key', message: `La variable {{${key}}} no es una variable propia de la empresa.` };
  }

  private add(field: string, code: WhatsappTemplateIssue['code'], message: string): void {
    this.issues.push({ field, code, message });
    this.fields.add(field);
  }
}

type Translated = {
  readonly content: WhatsappTemplateContent;
  readonly keyedFields: ReadonlySet<string>;
  readonly keysBySlot: ReadonlyMap<TemplateSlot, string>;
};

function translatedDraftOf(shape: KeyedShape, labelOf: (key: string) => string): Translated {
  const keyedFields = new Set<string>();
  const keysBySlot = new Map<TemplateSlot, string>();
  const note = (field: string, translation: Translation): void => {
    if (translation.keys.length > 0) keyedFields.add(field);
  };

  const headerShape = shape.header ?? null;
  let header: { text: string; example: string | null } | null = null;
  if (headerShape !== null) {
    const translation = translate(headerShape.text);
    note('header.text', translation);
    const first = translation.keys[0];
    if (first !== undefined) keysBySlot.set('header', first);
    header = { text: translation.text, example: first === undefined ? null : labelOf(first) };
  }

  const body = translate(shape.body.text);
  note('body.text', body);
  body.keys.forEach((key, index) => keysBySlot.set(`body.${index + 1}`, key));

  const buttons = shape.buttons.map((button, index): WhatsappTemplateButton => {
    if (button.type !== 'URL') return button;
    const translation = translate(button.url);
    note(`buttons.${index}.url`, translation);
    const first = translation.keys[0];
    if (first === undefined || !translation.text.endsWith(URL_VARIABLE)) {
      return { ...button, url: translation.text, example: null };
    }
    keysBySlot.set(`button.${index}`, first);
    return { ...button, url: translation.text, example: translation.text.replace(URL_VARIABLE, labelOf(first)) };
  });

  return {
    content: {
      header,
      body: { text: body.text, examples: body.keys.map(labelOf) },
      footer: shape.footer ?? null,
      buttons,
    },
    keyedFields,
    keysBySlot,
  };
}

function isCreatableCategory(category: string): category is CreatableTemplateCategory {
  return (CREATABLE_TEMPLATE_CATEGORIES as readonly string[]).includes(category);
}

function bindingOf(
  slot: TemplateSlot,
  key: string,
  byKey: ReadonlyMap<string, DictionaryEntry>,
): TemplateVariableBinding | null {
  if (isConstantKey(key)) return { slot, kind: 'system', systemKey: key };
  const entry = byKey.get(key);
  return entry === undefined ? null : { slot, kind: 'company', variableKeyId: entry.id };
}

// El largo se mide sobre lo que recibe Meta, con las variables ya numeradas.
function onKeyedField(issue: WhatsappTemplateIssue, keyedFields: ReadonlySet<string>): WhatsappTemplateIssue {
  if (issue.code !== 'too_long' || !TRANSLATED_FIELD.test(issue.field) || !keyedFields.has(issue.field)) return issue;
  return { ...issue, message: `${issue.message.replace(/\.$/, '')} una vez numeradas las variables.` };
}

export function validateKeyedTemplateDraft(
  input: unknown,
  dictionary: readonly DictionaryEntry[],
): WhatsappTemplateKeyedDraftResult {
  const parsed = keyedDraftShape.safeParse(input);
  if (!parsed.success) return { ok: false, issues: shapeIssuesOf(parsed.error) };
  const shape = parsed.data;

  const byKey = new Map<string, DictionaryEntry>();
  for (const entry of dictionary) if (!byKey.has(entry.key)) byKey.set(entry.key, entry);

  const constantLabels = new Map(Object.entries(shape.constantLabels ?? {}));
  const markers = new MarkerCheck(byKey, constantLabels);
  if (shape.header) markers.check('header.text', shape.header.text);
  markers.check('body.text', shape.body.text);
  shape.buttons.forEach((button, index) => {
    if (button.type === 'URL') markers.check(`buttons.${index}.url`, button.url);
  });

  const labelOf = (key: string): string =>
    (isConstantKey(key) ? constantLabels.get(key) : byKey.get(key)?.label) ?? key;
  const translated = translatedDraftOf(shape, labelOf);
  const draft = { ...translated.content, name: shape.name, language: shape.language, category: shape.category };
  const result = validateWhatsappTemplateDraft(draft);
  const ruleIssues = result.ok
    ? []
    : result.issues
        .filter((issue) => !EXAMPLE_FIELD.test(issue.field) && !markers.fields.has(issue.field))
        .map((issue) => onKeyedField(issue, translated.keyedFields));
  const issues = [...markers.issues, ...ruleIssues];
  if (issues.length > 0 || !isCreatableCategory(draft.category)) return { ok: false, issues };

  const bindings: TemplateVariableBinding[] = [];
  for (const [slot, key] of translated.keysBySlot) {
    const binding = bindingOf(slot, key, byKey);
    if (binding !== null) bindings.push(binding);
  }
  return { ok: true, draft: { ...draft, category: draft.category }, bindings };
}
