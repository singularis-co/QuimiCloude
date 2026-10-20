import { z } from 'zod';

import { CREATABLE_TEMPLATE_CATEGORIES, type CreatableTemplateCategory } from './whatsapp-template';
import { isWhatsappTemplateLanguage } from './whatsapp-template-languages';

export type WhatsappTemplateButton =
  | { readonly type: 'QUICK_REPLY'; readonly text: string }
  | { readonly type: 'URL'; readonly text: string; readonly url: string; readonly example: string | null }
  | { readonly type: 'PHONE_NUMBER'; readonly text: string; readonly phoneNumber: string };

export type WhatsappTemplateContent = {
  readonly header: { readonly text: string; readonly example: string | null } | null;
  readonly body: { readonly text: string; readonly examples: readonly string[] };
  readonly footer: string | null;
  readonly buttons: readonly WhatsappTemplateButton[];
};

export type WhatsappTemplateDraft = WhatsappTemplateContent & {
  readonly name: string;
  readonly language: string;
  readonly category: CreatableTemplateCategory;
};

export const WHATSAPP_TEMPLATE_ISSUE_CODES = [
  'required',
  'too_long',
  'invalid_chars',
  'invalid_variable',
  'variables_not_sequential',
  'example_missing',
  'example_extra',
  'too_many_buttons',
  'buttons_not_grouped',
  'invalid_url',
  'invalid_phone',
  'not_allowed',
] as const;
export type WhatsappTemplateIssueCode = (typeof WHATSAPP_TEMPLATE_ISSUE_CODES)[number];

export type WhatsappTemplateIssue = {
  readonly field: string;
  readonly code: WhatsappTemplateIssueCode;
  readonly message: string;
};

export type WhatsappTemplateDraftResult =
  | { readonly ok: true; readonly draft: WhatsappTemplateDraft }
  | { readonly ok: false; readonly issues: readonly WhatsappTemplateIssue[] };

export const TEMPLATE_LIMITS = {
  nameMaxLength: 512,
  headerMaxLength: 60,
  bodyMaxLength: 1024,
  footerMaxLength: 60,
  buttonTextMaxLength: 25,
  urlMaxLength: 2000,
  maxButtons: 10,
  maxUrlButtons: 2,
  maxPhoneButtons: 1,
} as const;

const NAME_PATTERN = /^[a-z0-9_]+$/;
const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const MARKER_PATTERN = /\{\{([^{}]*)\}\}/g;
const VARIABLE_NUMBER_PATTERN = /^[1-9]\d*$/;
const URL_VARIABLE = '{{1}}';
const HTTPS_PREFIX = 'https://';

const buttonShape = z.discriminatedUnion('type', [
  z.object({ type: z.literal('QUICK_REPLY'), text: z.string() }),
  z.object({ type: z.literal('URL'), text: z.string(), url: z.string(), example: z.string().nullish() }),
  z.object({ type: z.literal('PHONE_NUMBER'), text: z.string(), phoneNumber: z.string() }),
]);

const draftShape = z.object({
  name: z.string(),
  language: z.string(),
  category: z.string(),
  header: z.object({ text: z.string(), example: z.string().nullish() }).nullish(),
  body: z.object({ text: z.string(), examples: z.array(z.string()).default([]) }),
  footer: z.string().nullish(),
  buttons: z.array(buttonShape).default([]),
});

type DraftShape = z.infer<typeof draftShape>;

function lengthOf(text: string): number {
  return [...text].length;
}

function isBlank(text: string): boolean {
  return text.trim() === '';
}

// Postgres no admite U+0000 en texto ni en jsonb: un texto con el llegaria a Meta y no se podria guardar.
function hasNul(text: string): boolean {
  return text.includes('\u0000');
}

/** Numeros de las marcas `{{n}}` bien formadas, o `null` si alguna marca no lo esta. */
function variablesOf(text: string): number[] | null {
  const numbers: number[] = [];
  for (const match of text.matchAll(MARKER_PATTERN)) {
    const inner = match[1] ?? '';
    if (!VARIABLE_NUMBER_PATTERN.test(inner)) return null;
    numbers.push(Number(inner));
  }
  const rest = text.replace(MARKER_PATTERN, ' ');
  if (rest.includes('{{') || rest.includes('}}')) return null;
  return numbers;
}

function isHttpsUrl(value: string): boolean {
  if (!value.startsWith(HTTPS_PREFIX)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname !== '';
  } catch {
    return false;
  }
}

class IssueList {
  readonly items: WhatsappTemplateIssue[] = [];

  add(field: string, code: WhatsappTemplateIssueCode, message: string): void {
    this.items.push({ field, code, message });
  }

  /** Obligatorio, sin U+0000 y con largo maximo. Devuelve si paso las tres. */
  text(field: string, value: string, maxLength: number, label: string): boolean {
    if (isBlank(value)) {
      this.add(field, 'required', `${label} es obligatorio.`);
      return false;
    }
    if (hasNul(value)) {
      this.add(field, 'invalid_chars', `${label} tiene caracteres no permitidos.`);
      return false;
    }
    if (lengthOf(value) > maxLength) {
      this.add(field, 'too_long', `${label} admite como mucho ${maxLength} caracteres.`);
      return false;
    }
    return true;
  }
}

function checkName(name: string, issues: IssueList): void {
  if (!issues.text('name', name, TEMPLATE_LIMITS.nameMaxLength, 'El nombre')) return;
  if (!NAME_PATTERN.test(name)) {
    issues.add('name', 'invalid_chars', 'El nombre solo admite minúsculas a-z, dígitos y guion bajo.');
  }
}

function checkLanguage(language: string, issues: IssueList): void {
  if (isBlank(language)) issues.add('language', 'required', 'El idioma es obligatorio.');
  else if (!isWhatsappTemplateLanguage(language)) {
    issues.add('language', 'not_allowed', 'WhatsApp no admite ese idioma.');
  }
}

function isCreatableCategory(category: string): category is CreatableTemplateCategory {
  return (CREATABLE_TEMPLATE_CATEGORIES as readonly string[]).includes(category);
}

function checkCategory(category: string, issues: IssueList): void {
  if (!isCreatableCategory(category)) {
    issues.add('category', 'not_allowed', 'La categoría debe ser Marketing o Utilidad.');
  }
}

function checkHeader(header: DraftShape['header'], issues: IssueList): void {
  if (header === null || header === undefined) return;
  const example = header.example ?? null;
  if (!issues.text('header.text', header.text, TEMPLATE_LIMITS.headerMaxLength, 'El encabezado')) return;
  const variables = variablesOf(header.text);
  if (variables === null || variables.length > 1 || (variables.length === 1 && variables[0] !== 1)) {
    issues.add('header.text', 'invalid_variable', 'El encabezado admite como mucho una variable, {{1}}.');
    return;
  }
  if (variables.length === 1) {
    if (example === null || isBlank(example)) {
      issues.add('header.example', 'example_missing', 'Falta el ejemplo de la variable del encabezado.');
    } else if (hasNul(example)) {
      issues.add('header.example', 'invalid_chars', 'El ejemplo tiene caracteres no permitidos.');
    }
  } else if (example !== null) {
    issues.add('header.example', 'example_extra', 'Un encabezado sin variable no lleva ejemplo.');
  }
}

function checkBodyExamples(count: number, examples: readonly string[], issues: IssueList): void {
  if (examples.length < count) {
    issues.add('body.examples', 'example_missing', 'Falta un ejemplo por cada variable del cuerpo.');
  } else if (examples.length > count) {
    issues.add('body.examples', 'example_extra', 'Sobran ejemplos: va uno por cada variable del cuerpo.');
  }
  examples.slice(0, count).forEach((example, index) => {
    const field = `body.examples.${index}`;
    if (isBlank(example)) issues.add(field, 'example_missing', 'El ejemplo no puede estar vacío.');
    else if (hasNul(example)) issues.add(field, 'invalid_chars', 'El ejemplo tiene caracteres no permitidos.');
  });
}

function checkBody(body: DraftShape['body'], issues: IssueList): void {
  if (!issues.text('body.text', body.text, TEMPLATE_LIMITS.bodyMaxLength, 'El cuerpo')) return;
  const variables = variablesOf(body.text);
  if (variables === null) {
    issues.add('body.text', 'invalid_variable', 'Las variables se escriben {{1}}, {{2}}…');
    return;
  }
  const distinct = new Set(variables);
  const sequential = [...distinct].every((n) => n <= distinct.size);
  if (!sequential) {
    issues.add('body.text', 'variables_not_sequential', 'Las variables deben ir numeradas de 1 en adelante sin saltos.');
    return;
  }
  checkBodyExamples(distinct.size, body.examples, issues);
}

function checkFooter(footer: string | null | undefined, issues: IssueList): void {
  if (footer === null || footer === undefined) return;
  if (!issues.text('footer', footer, TEMPLATE_LIMITS.footerMaxLength, 'El pie')) return;
  if (footer.includes('{{')) issues.add('footer', 'not_allowed', 'El pie no admite variables.');
}

type ButtonShape = DraftShape['buttons'][number];

function checkUrlButton(button: Extract<ButtonShape, { type: 'URL' }>, at: string, issues: IssueList): void {
  const example = button.example ?? null;
  if (isBlank(button.url)) {
    issues.add(`${at}.url`, 'required', 'La URL es obligatoria.');
    return;
  }
  if (lengthOf(button.url) > TEMPLATE_LIMITS.urlMaxLength) {
    issues.add(`${at}.url`, 'too_long', `La URL admite como mucho ${TEMPLATE_LIMITS.urlMaxLength} caracteres.`);
    return;
  }
  const variables = variablesOf(button.url);
  const withVariable = variables !== null && variables.length === 1 && button.url.endsWith(URL_VARIABLE);
  if (variables === null || variables.length > 1 || (variables.length === 1 && !withVariable)) {
    issues.add(`${at}.url`, 'invalid_variable', 'La URL admite como mucho una variable, {{1}}, y solo al final.');
    return;
  }
  const base = withVariable ? `${button.url.slice(0, -URL_VARIABLE.length)}x` : button.url;
  if (!isHttpsUrl(base)) {
    issues.add(`${at}.url`, 'invalid_url', 'La URL debe empezar por https://.');
    return;
  }
  if (!withVariable) {
    if (example !== null) issues.add(`${at}.example`, 'example_extra', 'Una URL sin variable no lleva ejemplo.');
    return;
  }
  if (example === null || isBlank(example)) {
    issues.add(`${at}.example`, 'example_missing', 'Falta la URL de ejemplo.');
  } else if (!isHttpsUrl(example) || lengthOf(example) > TEMPLATE_LIMITS.urlMaxLength) {
    issues.add(`${at}.example`, 'invalid_url', 'La URL de ejemplo debe empezar por https://.');
  }
}

function checkButton(button: ButtonShape, index: number, issues: IssueList): void {
  const at = `buttons.${index}`;
  if (issues.text(`${at}.text`, button.text, TEMPLATE_LIMITS.buttonTextMaxLength, 'El texto del botón')) {
    if (button.text.includes('{{')) issues.add(`${at}.text`, 'not_allowed', 'El texto del botón no admite variables.');
  }
  if (button.type === 'URL') checkUrlButton(button, at, issues);
  if (button.type === 'PHONE_NUMBER' && !PHONE_PATTERN.test(button.phoneNumber)) {
    issues.add(`${at}.phoneNumber`, 'invalid_phone', 'El teléfono va con + y entre 8 y 15 dígitos.');
  }
}

/** Las respuestas rapidas van todas juntas: como mucho un cambio entre ellas y el resto. */
function quickRepliesGrouped(buttons: readonly ButtonShape[]): boolean {
  let changes = 0;
  for (let i = 1; i < buttons.length; i += 1) {
    const previous = buttons[i - 1]?.type === 'QUICK_REPLY';
    const current = buttons[i]?.type === 'QUICK_REPLY';
    if (previous !== current) changes += 1;
  }
  return changes <= 1;
}

function checkButtons(buttons: readonly ButtonShape[], issues: IssueList): void {
  const urls = buttons.filter((b) => b.type === 'URL').length;
  const phones = buttons.filter((b) => b.type === 'PHONE_NUMBER').length;
  if (buttons.length > TEMPLATE_LIMITS.maxButtons) {
    issues.add('buttons', 'too_many_buttons', `Como mucho ${TEMPLATE_LIMITS.maxButtons} botones.`);
  }
  if (urls > TEMPLATE_LIMITS.maxUrlButtons) {
    issues.add('buttons', 'too_many_buttons', `Como mucho ${TEMPLATE_LIMITS.maxUrlButtons} botones de URL.`);
  }
  if (phones > TEMPLATE_LIMITS.maxPhoneButtons) {
    issues.add('buttons', 'too_many_buttons', `Como mucho ${TEMPLATE_LIMITS.maxPhoneButtons} botón de teléfono.`);
  }
  if (!quickRepliesGrouped(buttons)) {
    issues.add('buttons', 'buttons_not_grouped', 'Las respuestas rápidas van todas antes o todas después de los demás botones.');
  }
  buttons.forEach((button, index) => checkButton(button, index, issues));
}

function shapeIssuesOf(error: z.ZodError): WhatsappTemplateIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join('.'),
    code: issue.code === 'invalid_union' ? 'not_allowed' : 'required',
    message: issue.code === 'invalid_union' ? 'Ese tipo de botón no está admitido.' : 'Falta este dato o no tiene la forma esperada.',
  }));
}

function buttonOf(button: ButtonShape): WhatsappTemplateButton {
  if (button.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: button.text };
  if (button.type === 'URL') return { type: 'URL', text: button.text, url: button.url, example: button.example ?? null };
  return { type: 'PHONE_NUMBER', text: button.text, phoneNumber: button.phoneNumber };
}

function draftOf(shape: DraftShape, category: CreatableTemplateCategory): WhatsappTemplateDraft {
  const header = shape.header ?? null;
  return {
    name: shape.name,
    language: shape.language,
    category,
    header: header === null ? null : { text: header.text, example: header.example ?? null },
    body: { text: shape.body.text, examples: [...shape.body.examples] },
    footer: shape.footer ?? null,
    buttons: shape.buttons.map(buttonOf),
  };
}

export function validateWhatsappTemplateDraft(input: unknown): WhatsappTemplateDraftResult {
  const parsed = draftShape.safeParse(input);
  if (!parsed.success) return { ok: false, issues: shapeIssuesOf(parsed.error) };
  const shape = parsed.data;
  const issues = new IssueList();
  checkName(shape.name, issues);
  checkLanguage(shape.language, issues);
  checkCategory(shape.category, issues);
  checkHeader(shape.header, issues);
  checkBody(shape.body, issues);
  checkFooter(shape.footer, issues);
  checkButtons(shape.buttons, issues);
  if (issues.items.length > 0 || !isCreatableCategory(shape.category)) return { ok: false, issues: issues.items };
  return { ok: true, draft: draftOf(shape, shape.category) };
}
