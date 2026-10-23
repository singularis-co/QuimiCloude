import { z } from 'zod';

import type { WhatsappTemplateIssue, WhatsappTemplateIssueCode } from './whatsapp-template-draft';

export const WHATSAPP_VARIABLE_KEY_LIMITS = { keyMaxLength: 40, labelMaxLength: 60, valueMaxLength: 50 } as const;
export const WHATSAPP_VARIABLE_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
// Las constantes las define el front; el punto impide que una choque con una propia.
export const WHATSAPP_CONSTANT_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}\.[a-z][a-z0-9_]{0,39}$/;

export type WhatsappVariableKeyRecord = {
  readonly id: string;
  readonly companyId: string;
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly createdAt: Date;
};

export type WhatsappVariableKeyInput = { readonly key: string; readonly label: string; readonly value: string };

export type WhatsappDictionaryEntryView = {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly usedBy: number;
};

export type WhatsappVariableKeyInputResult =
  | { readonly ok: true; readonly value: WhatsappVariableKeyInput }
  | { readonly ok: false; readonly issues: readonly WhatsappTemplateIssue[] };

const inputShape = z.object({ key: z.string(), label: z.string(), value: z.string() });

function lengthOf(text: string): number {
  return [...text].length;
}

export function isOwnKey(text: string): boolean {
  return WHATSAPP_VARIABLE_KEY_PATTERN.test(text);
}

export function isConstantKey(text: string): boolean {
  return WHATSAPP_CONSTANT_KEY_PATTERN.test(text);
}

type Issues = WhatsappTemplateIssue[];

function add(issues: Issues, field: string, code: WhatsappTemplateIssueCode, message: string): void {
  issues.push({ field, code, message });
}

type Noun = { readonly label: string; readonly required: string };

// Postgres no admite U+0000 en texto.
function checkText(issues: Issues, field: string, value: string, maxLength: number, noun: Noun): boolean {
  const { label } = noun;
  if (value.trim() === '') {
    add(issues, field, 'required', `${label} es ${noun.required}.`);
    return false;
  }
  if (value.includes('\u0000')) {
    add(issues, field, 'invalid_chars', `${label} tiene caracteres no permitidos.`);
    return false;
  }
  if (lengthOf(value) > maxLength) {
    add(issues, field, 'too_long', `${label} admite como mucho ${maxLength} caracteres.`);
    return false;
  }
  return true;
}

const KEY: Noun = { label: 'La clave', required: 'obligatoria' };
const LABEL: Noun = { label: 'La etiqueta', required: 'obligatoria' };
const VALUE: Noun = { label: 'El valor', required: 'obligatorio' };

function checkKey(issues: Issues, key: string): void {
  if (!checkText(issues, 'key', key, WHATSAPP_VARIABLE_KEY_LIMITS.keyMaxLength, KEY)) return;
  if (!WHATSAPP_VARIABLE_KEY_PATTERN.test(key)) {
    add(issues, 'key', 'invalid_chars', 'La clave empieza por una minúscula a-z y solo admite minúsculas a-z, dígitos y guion bajo.');
  }
}

// El valor viaja dentro de un parametro de Meta: una marca de variable no tiene sentido ahi.
function checkValue(issues: Issues, value: string): void {
  if (!checkText(issues, 'value', value, WHATSAPP_VARIABLE_KEY_LIMITS.valueMaxLength, VALUE)) return;
  if (value.includes('{{') || value.includes('}}')) {
    add(issues, 'value', 'not_allowed', 'El valor no admite {{ ni }}.');
  }
}

export function validateWhatsappVariableKeyInput(input: unknown): WhatsappVariableKeyInputResult {
  const parsed = inputShape.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        field: issue.path.map(String).join('.'),
        code: 'required',
        message: 'Falta este dato o no tiene la forma esperada.',
      })),
    };
  }
  const { key, label, value } = parsed.data;
  const issues: Issues = [];
  checkKey(issues, key);
  checkText(issues, 'label', label, WHATSAPP_VARIABLE_KEY_LIMITS.labelMaxLength, LABEL);
  checkValue(issues, value);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { key, label, value } };
}
