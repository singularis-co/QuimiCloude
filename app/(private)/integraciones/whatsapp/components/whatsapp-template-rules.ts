import { listCountryOptions } from '@/components/shared/country-options';
import {
  CREATABLE_TEMPLATE_CATEGORIES,
  WHATSAPP_TEMPLATE_LANGUAGES,
  type WhatsappDictionaryEntryView,
  type WhatsappTemplateButton,
  type WhatsappTemplateCategory,
  type WhatsappTemplateContent,
  type WhatsappTemplateStatus,
  type WhatsappTemplateVariableView,
  type WhatsappTemplateView,
} from '@/lib/modules/integraciones';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import type { StatusTone } from '@/lib/shared/ui/status-tone';

import { SYSTEM_CONSTANTS, toBackendText, toDisplayText } from './whatsapp-system-constants';

export const TEMPLATE_RULES_TEXTS = {
  status: {
    APPROVED: 'Aprobada',
    PENDING: 'Pendiente',
    REJECTED: 'Rechazada',
    PAUSED: 'Pausada',
    DISABLED: 'Deshabilitada',
    OTHER: 'Otro',
  } satisfies Record<WhatsappTemplateStatus, string>,
  unmapped: 'Sin relacionar',
  notCompatible: 'No compatible',
  notCompatibleNamed: 'Usa variables con nombre. El sistema solo envía variables numeradas.',
  notCompatibleOther:
    'Usa elementos que el sistema no envía (imagen, video, documento, otro tipo de botón o código de verificación). El sistema solo envía plantillas de texto.',
  category: {
    UTILITY: 'Utilidad',
    MARKETING: 'Marketing',
    AUTHENTICATION: 'Autenticación',
  } satisfies Record<WhatsappTemplateCategory, string>,
  headerSlot: 'Encabezado {{1}}',
  buttonSlot: (index: number) => `Botón ${index + 1} {{1}}`,
  languageGroup: { es: 'Español', en: 'Inglés' },
} as const;

export type DisplayVariableKind = 'system' | 'company';

export type DisplayDictionaryEntry = {
  readonly key: string;
  readonly label: string;
  readonly preview: string;
  readonly kind: DisplayVariableKind;
};

export function dictionaryOf(own: readonly WhatsappDictionaryEntryView[]): readonly DisplayDictionaryEntry[] {
  const constants = SYSTEM_CONSTANTS.map(
    (constant): DisplayDictionaryEntry => ({
      key: constant.displayKey,
      label: constant.label,
      preview: constant.example === EMPTY_MARK ? constant.label : constant.example,
      kind: 'system',
    }),
  );
  const companies = own.map(
    (entry): DisplayDictionaryEntry => ({ key: entry.key, label: entry.label, preview: entry.value, kind: 'company' }),
  );
  return [...constants, ...companies];
}

/** Una clave que no está en el diccionario se muestra con la clave como etiqueta. */
export function labelOfKey(key: string, dictionary: readonly DisplayDictionaryEntry[]): string {
  return dictionary.find((entry) => entry.key === key)?.label ?? key;
}

const MARKER_PATTERN = /\{\{([^{}]*)\}\}/g;
const POSITIONAL = /^[1-9]\d*$/;
const URL_VARIABLE = '{{1}}';

function markersOf(text: string): string[] {
  return [...text.matchAll(MARKER_PATTERN)].map((match) => match[1] ?? '');
}

function variableTextsOf(content: WhatsappTemplateContent): string[] {
  const texts = [content.body.text];
  if (content.header !== null) texts.push(content.header.text);
  for (const button of content.buttons) if (button.type === 'URL') texts.push(button.url);
  return texts;
}

export function isMappable(view: WhatsappTemplateView): boolean {
  if (view.content === null) return false;
  const keys = new Set(view.variables.flatMap((variable) => (variable.key === null ? [] : [variable.key])));
  return variableTextsOf(view.content).every((text) =>
    markersOf(text).every((inner) => POSITIONAL.test(inner) || keys.has(inner)),
  );
}

export function isUnmapped(view: WhatsappTemplateView): boolean {
  return isMappable(view) && view.mappingStatus === 'UNMAPPED';
}

function hasNamedMarker(content: WhatsappTemplateContent): boolean {
  const texts = [...variableTextsOf(content), ...(content.footer === null ? [] : [content.footer])];
  for (const button of content.buttons) texts.push(button.text);
  return texts.some((text) => markersOf(text).some((inner) => !POSITIONAL.test(inner)));
}

export function notCompatibleReasonOf(view: WhatsappTemplateView): string {
  if (view.content !== null && hasNamedMarker(view.content)) return TEMPLATE_RULES_TEXTS.notCompatibleNamed;
  return TEMPLATE_RULES_TEXTS.notCompatibleOther;
}

export function slotMarkOf(slot: string): string {
  if (slot === 'header') return TEMPLATE_RULES_TEXTS.headerSlot;
  if (slot.startsWith('button.')) return TEMPLATE_RULES_TEXTS.buttonSlot(Number(slot.slice('button.'.length)));
  return `{{${slot.slice('body.'.length)}}}`;
}

// Dos huecos con la misma clave no se distinguen en el texto: se numeran por orden de aparición.
function renumberBody(text: string, variables: readonly WhatsappTemplateVariableView[]): string {
  const positionsByKey = new Map<string, number[]>();
  for (const variable of variables) {
    if (variable.key === null || !variable.slot.startsWith('body.')) continue;
    const positions = positionsByKey.get(variable.key) ?? [];
    positions.push(variable.position);
    positionsByKey.set(variable.key, positions);
  }
  const seen = new Map<string, number>();
  return text.replace(MARKER_PATTERN, (marker, inner: string) => {
    const positions = positionsByKey.get(inner);
    if (positions === undefined) return marker;
    const index = seen.get(inner) ?? 0;
    seen.set(inner, index + 1);
    return `{{${positions[Math.min(index, positions.length - 1)]}}}`;
  });
}

function renumberSingle(text: string, key: string | null | undefined): string {
  return key === null || key === undefined ? text : text.replaceAll(`{{${key}}}`, URL_VARIABLE);
}

/** El contenido con cada hueco como `{{n}}`, como lo tiene la plantilla. */
export function numberedContentOf(view: WhatsappTemplateView): WhatsappTemplateContent | null {
  const { content, variables } = view;
  if (content === null) return null;
  const keyOfSlot = (slot: string) => variables.find((variable) => variable.slot === slot)?.key;
  const header =
    content.header === null ? null : { ...content.header, text: renumberSingle(content.header.text, keyOfSlot('header')) };
  const buttons = content.buttons.map(
    (button, index): WhatsappTemplateButton =>
      button.type === 'URL' ? { ...button, url: renumberSingle(button.url, keyOfSlot(`button.${index}`)) } : button,
  );
  return {
    header,
    body: { ...content.body, text: renumberBody(content.body.text, variables) },
    footer: content.footer,
    buttons,
  };
}

/** Largo del texto tal como lo recibe Meta: cada clave distinta pasa a `{{n}}`. */
export function metaLengthOf(text: string): number {
  const keys: string[] = [];
  const numbered = toBackendText(text).replace(MARKER_PATTERN, (_marker, inner: string) => {
    let index = keys.indexOf(inner);
    if (index === -1) index = keys.push(inner) - 1;
    return `{{${index + 1}}}`;
  });
  return [...numbered].length;
}

export type BadgePresentation = { readonly label: string; readonly tone: StatusTone };

const STATUS_TONES: Record<WhatsappTemplateStatus, StatusTone> = {
  APPROVED: 'success',
  PENDING: 'waiting',
  REJECTED: 'danger',
  PAUSED: 'progress',
  DISABLED: 'neutral',
  OTHER: 'muted',
};

export function statusBadgeOf(view: Pick<WhatsappTemplateView, 'status' | 'statusRaw'>): BadgePresentation {
  const label = TEMPLATE_RULES_TEXTS.status[view.status];
  const tone = STATUS_TONES[view.status];
  if (view.status !== 'OTHER') return { label, tone };
  return { label: `${label} · ${view.statusRaw ?? EMPTY_MARK}`, tone };
}

/** `null` cuando la plantilla está relacionada: su uso es el interruptor, no una etiqueta. */
export function usageBadgeOf(view: WhatsappTemplateView): BadgePresentation | null {
  if (!isMappable(view)) return { label: TEMPLATE_RULES_TEXTS.notCompatible, tone: 'muted' };
  if (view.mappingStatus === 'UNMAPPED') return { label: TEMPLATE_RULES_TEXTS.unmapped, tone: 'waiting' };
  return null;
}

export function categoryLabelOf(category: WhatsappTemplateCategory): string {
  return TEMPLATE_RULES_TEXTS.category[category];
}

type DatePart = 'day' | 'month' | 'year' | 'hour' | 'minute';
const DATE_PARTS: ReadonlySet<string> = new Set<DatePart>(['day', 'month', 'year', 'hour', 'minute']);

/** `DD/MM/AAAA HH:MM` en la zona del dispositivo, o en `timeZone` si se da. */
export function formatSyncDateTime(iso: string | null, timeZone?: string): string {
  if (iso === null) return EMPTY_MARK;
  const formatter = new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  });
  const found: Partial<Record<DatePart, string>> = {};
  for (const part of formatter.formatToParts(new Date(iso))) {
    if (DATE_PARTS.has(part.type)) found[part.type as DatePart] = part.value;
  }
  return `${found.day}/${found.month}/${found.year} ${found.hour}:${found.minute}`;
}

export type LanguageGroup = 'es' | 'en';

export type LanguageOption = { readonly code: string; readonly name: string; readonly group: LanguageGroup };

const ENGLISH_CODES: ReadonlySet<string> = new Set(['en', 'en_US', 'en_GB']);

function countryNameOf(code: string): string {
  return listCountryOptions().find((option) => option.code === code)?.name ?? code;
}

function languageOptionOf(code: string): LanguageOption | null {
  const [language, country] = code.split('_');
  if (language === 'es') {
    const base = TEMPLATE_RULES_TEXTS.languageGroup.es;
    return { code, group: 'es', name: country === undefined ? base : `${base} · ${countryNameOf(country)}` };
  }
  if (ENGLISH_CODES.has(code)) {
    const base = TEMPLATE_RULES_TEXTS.languageGroup.en;
    return { code, group: 'en', name: country === undefined ? base : `${base} · ${countryNameOf(country)}` };
  }
  return null;
}

function languageOptions(): readonly LanguageOption[] {
  const options = WHATSAPP_TEMPLATE_LANGUAGES.flatMap((code) => {
    const option = languageOptionOf(code);
    return option === null ? [] : [option];
  });
  return [...options.filter((option) => option.group === 'es'), ...options.filter((option) => option.group === 'en')];
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = languageOptions();

type CreatableCategory = (typeof CREATABLE_TEMPLATE_CATEGORIES)[number];

export type TemplateFormDraft = {
  readonly name: string;
  readonly language: string;
  readonly category: CreatableCategory;
  readonly body: string;
  readonly footer: string;
};

export type DuplicatedDraft = TemplateFormDraft & { readonly hadDroppedParts: boolean };

const DUPLICATE_SUFFIX = '_v2';

function isCreatableCategory(category: WhatsappTemplateCategory): category is CreatableCategory {
  return (CREATABLE_TEMPLATE_CATEGORIES as readonly string[]).includes(category);
}

// El alta no crea encabezado ni botones: la copia los pierde y el alta lo avisa.
export function draftFromView(view: WhatsappTemplateView): DuplicatedDraft {
  const content = view.content;
  const copyText = isMappable(view) && content !== null;
  return {
    name: `${view.name}${DUPLICATE_SUFFIX}`,
    language: view.language,
    category: isCreatableCategory(view.category) ? view.category : 'UTILITY',
    body: copyText ? toDisplayText(content.body.text) : '',
    footer: copyText ? toDisplayText(content.footer ?? '') : '',
    hadDroppedParts: content !== null && (content.header !== null || content.buttons.length > 0),
  };
}
