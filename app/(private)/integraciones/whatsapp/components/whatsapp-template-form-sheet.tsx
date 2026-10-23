'use client';

import { ArrowRightIcon, InfoIcon, XIcon } from 'lucide-react';
import { Fragment, useId, useRef, useState, useTransition, type ChangeEvent, type ReactNode, type SyntheticEvent } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ErrorAlert } from '@/components/shared/error-alert';
import { FieldError } from '@/components/shared/field-error';
import { Notice } from '@/components/shared/notice';
import { SHARED_SELECT_TRIGGER_CLASS } from '@/components/shared/shared-select';
import { Spinner } from '@/components/shared/spinner';
import { TextField } from '@/components/shared/text-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ErrorState } from '@/lib/modules/errores';
import {
  TEMPLATE_LIMITS,
  validateKeyedTemplateDraft,
  type WhatsappDictionaryEntryView,
  type WhatsappTemplateKeyedDraft,
  type WhatsappTemplateView,
} from '@/lib/modules/integraciones';
import { createWhatsappTemplateAction } from '@/lib/modules/integraciones/adapters/driving/whatsapp-template-actions';
import { cn } from '@/lib/utils';

import { WaBubble } from './wa-bubble';
import { systemConstantOf, toBackendText } from './whatsapp-system-constants';
import {
  categoryLabelOf,
  dictionaryOf,
  draftFromView,
  labelOfKey,
  LANGUAGE_OPTIONS,
  metaLengthOf,
  type DisplayDictionaryEntry,
  type TemplateFormDraft,
} from './whatsapp-template-rules';
import { WhatsappTemplateVariableMenu } from './whatsapp-template-variable-menu';

export const WHATSAPP_TEMPLATE_FORM_SHEET_TESTID = 'whatsapp-template-form-sheet';
export const WHATSAPP_TEMPLATE_FORM_TITLE_TESTID = 'whatsapp-template-form-title';
export const WHATSAPP_TEMPLATE_FORM_DESCRIPTION_TESTID = 'whatsapp-template-form-description';
export const WHATSAPP_TEMPLATE_FORM_DROPPED_TESTID = 'whatsapp-template-form-dropped';
export const WHATSAPP_TEMPLATE_FORM_ERROR_TESTID = 'whatsapp-template-form-error';
export const WHATSAPP_TEMPLATE_FORM_NAME_TESTID = 'whatsapp-template-form-name';
export const WHATSAPP_TEMPLATE_FORM_NAME_HINT_TESTID = 'whatsapp-template-form-name-hint';
export const WHATSAPP_TEMPLATE_FORM_NAME_ERROR_TESTID = 'whatsapp-template-form-name-error';
export const WHATSAPP_TEMPLATE_FORM_LANGUAGE_TESTID = 'whatsapp-template-form-language';
export const WHATSAPP_TEMPLATE_FORM_LANGUAGE_OPTION_TESTID = 'whatsapp-template-form-language-option';
export const WHATSAPP_TEMPLATE_FORM_LANGUAGE_GROUP_TESTID = (group: 'es' | 'en') =>
  `whatsapp-template-form-language-group-${group}`;
export const WHATSAPP_TEMPLATE_FORM_LANGUAGE_HINT_TESTID = 'whatsapp-template-form-language-hint';
export const WHATSAPP_TEMPLATE_FORM_CATEGORY_TESTID = 'whatsapp-template-form-category';
export const WHATSAPP_TEMPLATE_FORM_CATEGORY_OPTION_TESTID = 'whatsapp-template-form-category-option';
export const WHATSAPP_TEMPLATE_FORM_CATEGORY_HINT_TESTID = 'whatsapp-template-form-category-hint';
export const WHATSAPP_TEMPLATE_FORM_BODY_TESTID = 'whatsapp-template-form-body';
export const WHATSAPP_TEMPLATE_FORM_BODY_COUNT_TESTID = 'whatsapp-template-form-body-count';
export const WHATSAPP_TEMPLATE_FORM_BODY_ERROR_TESTID = 'whatsapp-template-form-body-error';
export const WHATSAPP_TEMPLATE_FORM_USED_TESTID = 'whatsapp-template-form-used';
export const WHATSAPP_TEMPLATE_FORM_USED_ITEM_TESTID = 'whatsapp-template-form-used-item';
export const WHATSAPP_TEMPLATE_FORM_FOOTER_TESTID = 'whatsapp-template-form-footer';
export const WHATSAPP_TEMPLATE_FORM_FOOTER_COUNT_TESTID = 'whatsapp-template-form-footer-count';
export const WHATSAPP_TEMPLATE_FORM_FOOTER_HINT_TESTID = 'whatsapp-template-form-footer-hint';
export const WHATSAPP_TEMPLATE_FORM_FOOTER_ERROR_TESTID = 'whatsapp-template-form-footer-error';
export const WHATSAPP_TEMPLATE_FORM_CLOSE_TESTID = 'whatsapp-template-form-close';
export const WHATSAPP_TEMPLATE_FORM_CANCEL_TESTID = 'whatsapp-template-form-cancel';
export const WHATSAPP_TEMPLATE_FORM_SUBMIT_TESTID = 'whatsapp-template-form-submit';
export const WHATSAPP_TEMPLATE_FORM_TABS_TESTID = 'whatsapp-template-form-tabs';
export const WHATSAPP_TEMPLATE_FORM_TAB_TESTID = (tab: 'form' | 'preview') => `whatsapp-template-form-tab-${tab}`;
export const WHATSAPP_TEMPLATE_CONFIRM_DIALOG_TESTID = 'whatsapp-template-confirm-dialog';
export const WHATSAPP_TEMPLATE_CONFIRM_MESSAGE_TESTID = 'whatsapp-template-confirm-message';
export const WHATSAPP_TEMPLATE_CONFIRM_SUMMARY_TESTID = 'whatsapp-template-confirm-summary';
export const WHATSAPP_TEMPLATE_CONFIRM_DISMISS_TESTID = 'whatsapp-template-confirm-dismiss';
export const WHATSAPP_TEMPLATE_CONFIRM_SUBMIT_TESTID = 'whatsapp-template-confirm-submit';

export const WHATSAPP_TEMPLATE_FORM_TEXTS = {
  newTitle: 'Nueva plantilla',
  duplicateTitle: 'Duplicar plantilla',
  description: 'Cada plantilla pasa por autorización antes de poder usarla. Suele tardar unas horas.',
  droppedParts: 'La copia no lleva el encabezado ni los botones de la original.',
  submitError: 'No se pudo enviar la plantilla',
  nameLabel: 'Nombre',
  nameHintStart: 'Solo minúsculas, números y guion bajo (_). Ejemplo: ',
  nameHintExample: 'pedido_listo',
  nameHintEnd: '.',
  nameInvalid: 'Usa solo minúsculas, números y guion bajo (_), sin espacios ni tildes.',
  languageLabel: 'Idioma',
  languageHint: 'El idioma del texto: español o inglés.',
  languageGroup: { es: 'Español', en: 'Inglés' },
  categoryLabel: 'Categoría',
  categoryDescription: {
    UTILITY: 'Avisos sobre un pedido o una cuenta: confirmaciones, estados, recordatorios.',
    MARKETING: 'Promociones y novedades. Tiene un costo de envío distinto.',
  },
  bodyLabel: 'Mensaje',
  usedTitle: 'Variables en el mensaje',
  unknownKey: (key: string) =>
    `La variable ${key} no está en el diccionario. Elígela con «Insertar variable» o créala como variable propia.`,
  footerLabel: 'Pie',
  optional: '(opcional)',
  footerHint: 'Texto gris al final del mensaje. Sin variables.',
  counter: (count: number, limit: number) => `${count} / ${limit}`,
  close: 'Cerrar',
  cancel: 'Cancelar',
  submit: 'Enviar a revisión',
  formTab: 'Formulario',
  previewTab: 'Vista previa',
  tabsLabel: 'Plantilla: formulario o vista previa',
  confirmTitle: 'Enviar para autorización',
  confirmStart: 'La plantilla ',
  confirmMiddle: ' se va a enviar para autorización. ',
  confirmLocked: 'No se puede cambiar mientras está en autorización',
  confirmEnd: '; si hace falta otro texto, se duplica.',
  confirmLanguage: 'Idioma',
  confirmCategory: 'Categoría',
  confirmVariables: 'Variables',
  confirmNoVariables: 'Ninguna',
  confirmReview: 'Revisa el mensaje en la vista previa antes de enviarlo.',
  confirmDismiss: 'Volver a revisar',
  confirmSubmit: 'Enviar',
  created: 'Plantilla enviada para autorización.',
  // Hora de ejemplo del tablero de la burbuja.
  previewTime: '09:41',
} as const;

const CATEGORIES = ['UTILITY', 'MARKETING'] as const;

const EMPTY_DRAFT: TemplateFormDraft = { name: '', language: 'es', category: 'UTILITY', body: '', footer: '' };

const NAME_PATTERN = /^[a-z0-9_]*$/;
const MARKER_PATTERN = /\{\{([^{}]*)\}\}/g;

type Field = 'name' | 'language' | 'category' | 'body' | 'footer';

type Selection = { readonly start: number; readonly end: number };

export type WhatsappTemplateFormSheetProps = {
  /** `null` abre el alta vacía; con una plantilla, el alta como copia de ella. */
  readonly source: WhatsappTemplateView | null;
  /** Las variables propias; las constantes las añade el panel. */
  readonly dictionary: readonly WhatsappDictionaryEntryView[];
  readonly onClose: () => void;
  /** Tras crear, con la plantilla que devuelve el servidor; el aviso de éxito ya lo da este panel. */
  readonly onCreated: (view: WhatsappTemplateView) => void;
  /** «Nueva variable propia» del menú de insertar; el borrador sigue aquí mientras tanto. */
  readonly onCreateVariable?: () => void;
};

function uniqueMarkersOf(text: string): string[] {
  const keys: string[] = [];
  for (const match of text.matchAll(MARKER_PATTERN)) {
    const key = (match[1] ?? '').trim();
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

function constantLabelsOf(keys: readonly string[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const key of keys) {
    const constant = systemConstantOf(key);
    if (constant !== undefined) labels[constant.backendKey] = constant.label;
  }
  return labels;
}

/** El borrador tal como lo recibe el backend: constantes con su clave con punto y sin encabezado ni botones. */
export function keyedDraftOf(draft: TemplateFormDraft): WhatsappTemplateKeyedDraft {
  return {
    name: draft.name,
    language: draft.language,
    category: draft.category,
    header: null,
    body: { text: toBackendText(draft.body) },
    footer: draft.footer === '' ? null : draft.footer,
    buttons: [],
    constantLabels: constantLabelsOf(uniqueMarkersOf(draft.body)),
  };
}

function languageLabelOf(code: string): string {
  const option = LANGUAGE_OPTIONS.find((candidate) => candidate.code === code);
  return option === undefined ? code : `${option.name} (${option.code})`;
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}

function Counter({ value, limit, testId }: { readonly value: string; readonly limit: number; readonly testId: string }) {
  const count = metaLengthOf(value);
  const over = count > limit;
  return (
    <span
      className={cn('font-mono text-xs', over ? 'text-destructive' : 'text-muted-foreground')}
      data-over={over ? 'true' : 'false'}
      data-testid={testId}
    >
      {WHATSAPP_TEMPLATE_FORM_TEXTS.counter(count, limit)}
    </span>
  );
}

function UsedVariables({ keys, entries }: { readonly keys: readonly string[]; readonly entries: readonly DisplayDictionaryEntry[] }) {
  if (keys.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5" data-testid={WHATSAPP_TEMPLATE_FORM_USED_TESTID}>
      <span className="text-xs font-medium tracking-[.04em] text-muted-foreground uppercase">
        {WHATSAPP_TEMPLATE_FORM_TEXTS.usedTitle}
      </span>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {keys.map((key) => (
          <li key={key} className="flex flex-wrap items-center gap-2 text-sm" data-testid={WHATSAPP_TEMPLATE_FORM_USED_ITEM_TESTID}>
            <span className="font-mono">{`{{${key}}}`}</span>
            <ArrowRightIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
            <span>{labelOfKey(key, entries)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WhatsappTemplateFormSheet({
  source,
  dictionary,
  onClose,
  onCreated,
  onCreateVariable,
}: WhatsappTemplateFormSheetProps) {
  const isMobile = useIsMobile();
  const baseId = useId();
  const [isPending, startTransition] = useTransition();
  const [initial] = useState(() => {
    if (source === null) return { duplicate: false, hadDroppedParts: false, draft: EMPTY_DRAFT };
    const { hadDroppedParts, ...draft } = draftFromView(source);
    return { duplicate: true, hadDroppedParts, draft };
  });
  const [draft, setDraft] = useState<TemplateFormDraft>(initial.draft);
  const [touched, setTouched] = useState<ReadonlySet<Field>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef<Selection | null>(null);

  const entries = dictionaryOf(dictionary);
  const knownKeys = new Set(entries.map((entry) => entry.key));
  const markers = uniqueMarkersOf(draft.body);
  const usedKeys = markers.filter((key) => knownKeys.has(key));
  const unknownKeys = markers.filter((key) => !knownKeys.has(key));
  const keyed = keyedDraftOf(draft);
  const validation = validateKeyedTemplateDraft(keyed, dictionary);
  const issues = validation.ok ? [] : validation.issues;

  function issueOf(field: string, touchedAs: Field): string | undefined {
    const issue = issues.find((candidate) => candidate.field === field);
    if (issue === undefined) return undefined;
    if (issue.code === 'required' && !touched.has(touchedAs)) return undefined;
    return issue.message;
  }

  const nameError = NAME_PATTERN.test(draft.name) ? issueOf('name', 'name') : WHATSAPP_TEMPLATE_FORM_TEXTS.nameInvalid;
  const bodyError =
    unknownKeys[0] === undefined ? issueOf('body.text', 'body') : WHATSAPP_TEMPLATE_FORM_TEXTS.unknownKey(unknownKeys[0]);
  const footerError = issueOf('footer', 'footer');
  const languageError = issueOf('language', 'language');
  const categoryError = issueOf('category', 'category');
  const canSubmit = validation.ok && unknownKeys.length === 0 && draft.body.trim() !== '' && !isPending;

  function change<K extends Field>(field: K, value: TemplateFormDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setTouched((current) => (current.has(field) ? current : new Set(current).add(field)));
  }

  function rememberSelection(event: SyntheticEvent<HTMLTextAreaElement>) {
    const target = event.currentTarget;
    selectionRef.current = { start: target.selectionStart, end: target.selectionEnd };
  }

  function changeBody(event: ChangeEvent<HTMLTextAreaElement>) {
    rememberSelection(event);
    change('body', event.currentTarget.value);
  }

  function insertVariable(key: string) {
    const marker = `{{${key}}}`;
    const body = draft.body;
    const selection = selectionRef.current;
    const start = Math.min(selection?.start ?? body.length, body.length);
    const end = Math.min(Math.max(selection?.end ?? body.length, start), body.length);
    const next = body.slice(0, start) + marker + body.slice(end);
    const caret = start + marker.length;
    selectionRef.current = { start: caret, end: caret };
    change('body', next);
    requestAnimationFrame(() => bodyRef.current?.setSelectionRange(caret, caret));
  }

  function confirm() {
    const payload = keyed;
    startTransition(async () => {
      const result = await createWhatsappTemplateAction(payload);
      if (result.status === 'error') {
        setError(result);
        setConfirming(false);
        return;
      }
      setError(null);
      setConfirming(false);
      toast.success(WHATSAPP_TEMPLATE_FORM_TEXTS.created);
      onCreated(result.data);
    });
  }

  const ids = {
    name: `${baseId}-name`,
    language: `${baseId}-language`,
    languageHint: `${baseId}-language-hint`,
    languageError: `${baseId}-language-error`,
    category: `${baseId}-category`,
    categoryHint: `${baseId}-category-hint`,
    categoryError: `${baseId}-category-error`,
    body: `${baseId}-body`,
    bodyError: `${baseId}-body-error`,
    footer: `${baseId}-footer`,
  };

  const form = (
    <div className="flex min-w-0 flex-col gap-4">
      {initial.hadDroppedParts ? (
        <Notice tone="warning" testId={WHATSAPP_TEMPLATE_FORM_DROPPED_TESTID}>
          {WHATSAPP_TEMPLATE_FORM_TEXTS.droppedParts}
        </Notice>
      ) : null}

      <TextField
        id={ids.name}
        label={
          <>
            {WHATSAPP_TEMPLATE_FORM_TEXTS.nameLabel} <RequiredMark />
          </>
        }
        value={draft.name}
        onValueChange={(value) => change('name', value)}
        ariaRequired
        autoComplete="off"
        inputClassName="min-h-11 font-mono text-base md:text-base"
        testId={WHATSAPP_TEMPLATE_FORM_NAME_TESTID}
        hint={
          nameError === undefined ? (
            <span className="text-sm text-muted-foreground" data-testid={WHATSAPP_TEMPLATE_FORM_NAME_HINT_TESTID}>
              {WHATSAPP_TEMPLATE_FORM_TEXTS.nameHintStart}
              <span className="font-mono">{WHATSAPP_TEMPLATE_FORM_TEXTS.nameHintExample}</span>
              {WHATSAPP_TEMPLATE_FORM_TEXTS.nameHintEnd}
            </span>
          ) : undefined
        }
        describeHint
        error={nameError}
        errorTestId={WHATSAPP_TEMPLATE_FORM_NAME_ERROR_TESTID}
      />

      <div className="flex flex-col gap-2">
        <Label id={`${ids.language}-label`} htmlFor={ids.language}>
          {WHATSAPP_TEMPLATE_FORM_TEXTS.languageLabel} <RequiredMark />
        </Label>
        <Select<string>
          value={draft.language}
          onValueChange={(next) => {
            if (next !== null) change('language', next);
          }}
          items={LANGUAGE_OPTIONS.map((option) => ({ value: option.code, label: `${option.name} (${option.code})` }))}
        >
          <SelectTrigger
            id={ids.language}
            aria-labelledby={`${ids.language}-label`}
            aria-describedby={languageError === undefined ? ids.languageHint : `${ids.languageHint} ${ids.languageError}`}
            aria-invalid={languageError === undefined ? undefined : true}
            className={SHARED_SELECT_TRIGGER_CLASS}
            data-testid={WHATSAPP_TEMPLATE_FORM_LANGUAGE_TESTID}
          >
            <SelectValue>{(value: string | null) => (value === null ? '' : languageLabelOf(value))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(['es', 'en'] as const).map((group, index) => (
              <Fragment key={group}>
                {index === 0 ? null : <SelectSeparator />}
                <SelectGroup data-testid={WHATSAPP_TEMPLATE_FORM_LANGUAGE_GROUP_TESTID(group)}>
                  <SelectLabel>{WHATSAPP_TEMPLATE_FORM_TEXTS.languageGroup[group]}</SelectLabel>
                  {LANGUAGE_OPTIONS.filter((option) => option.group === group).map((option) => (
                    <SelectItem
                      key={option.code}
                      value={option.code}
                      className="min-h-11 text-base md:text-sm"
                      data-testid={WHATSAPP_TEMPLATE_FORM_LANGUAGE_OPTION_TESTID}
                      data-value={option.code}
                    >
                      {`${option.name} (${option.code})`}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </Fragment>
            ))}
          </SelectContent>
        </Select>
        <span id={ids.languageHint} className="text-sm text-muted-foreground" data-testid={WHATSAPP_TEMPLATE_FORM_LANGUAGE_HINT_TESTID}>
          {WHATSAPP_TEMPLATE_FORM_TEXTS.languageHint}
        </span>
        <FieldError id={ids.languageError} message={languageError} />
      </div>

      <div className="flex flex-col gap-2">
        <Label id={`${ids.category}-label`} htmlFor={ids.category}>
          {WHATSAPP_TEMPLATE_FORM_TEXTS.categoryLabel} <RequiredMark />
        </Label>
        <Select<string>
          value={draft.category}
          onValueChange={(next) => {
            if (next === 'UTILITY' || next === 'MARKETING') change('category', next);
          }}
          items={CATEGORIES.map((category) => ({ value: category, label: categoryLabelOf(category) }))}
        >
          <SelectTrigger
            id={ids.category}
            aria-labelledby={`${ids.category}-label`}
            aria-describedby={categoryError === undefined ? ids.categoryHint : `${ids.categoryHint} ${ids.categoryError}`}
            aria-invalid={categoryError === undefined ? undefined : true}
            className={SHARED_SELECT_TRIGGER_CLASS}
            data-testid={WHATSAPP_TEMPLATE_FORM_CATEGORY_TESTID}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((category) => (
              <SelectItem
                key={category}
                value={category}
                className="min-h-11 py-2"
                data-testid={WHATSAPP_TEMPLATE_FORM_CATEGORY_OPTION_TESTID}
                data-value={category}
              >
                <span className="flex flex-col gap-0.5 whitespace-normal">
                  <span className="text-base font-medium md:text-sm">{categoryLabelOf(category)}</span>
                  <span className="text-xs text-muted-foreground">
                    {WHATSAPP_TEMPLATE_FORM_TEXTS.categoryDescription[category]}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span id={ids.categoryHint} className="text-sm text-muted-foreground" data-testid={WHATSAPP_TEMPLATE_FORM_CATEGORY_HINT_TESTID}>
          {WHATSAPP_TEMPLATE_FORM_TEXTS.categoryDescription[draft.category]}
        </span>
        <FieldError id={ids.categoryError} message={categoryError} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={ids.body}>
            {WHATSAPP_TEMPLATE_FORM_TEXTS.bodyLabel} <RequiredMark />
          </Label>
          <Counter value={draft.body} limit={TEMPLATE_LIMITS.bodyMaxLength} testId={WHATSAPP_TEMPLATE_FORM_BODY_COUNT_TESTID} />
        </div>
        <Textarea
          ref={bodyRef}
          id={ids.body}
          value={draft.body}
          onChange={changeBody}
          onSelect={rememberSelection}
          onBlur={() => setTouched((current) => (current.has('body') ? current : new Set(current).add('body')))}
          aria-required
          aria-invalid={bodyError === undefined ? undefined : true}
          aria-describedby={bodyError === undefined ? undefined : ids.bodyError}
          className="min-h-32 text-base md:text-base"
          data-testid={WHATSAPP_TEMPLATE_FORM_BODY_TESTID}
        />
        <WhatsappTemplateVariableMenu
          dictionary={entries}
          onInsert={insertVariable}
          onCreateVariable={onCreateVariable}
          disabled={isPending}
        />
        <UsedVariables keys={usedKeys} entries={entries} />
        <FieldError id={ids.bodyError} message={bodyError} testId={WHATSAPP_TEMPLATE_FORM_BODY_ERROR_TESTID} />
      </div>

      <TextField
        id={ids.footer}
        label={
          <>
            {WHATSAPP_TEMPLATE_FORM_TEXTS.footerLabel}{' '}
            <span className="font-normal text-muted-foreground">{WHATSAPP_TEMPLATE_FORM_TEXTS.optional}</span>
          </>
        }
        labelRowClassName="flex items-center justify-between gap-2"
        labelAdornment={
          <Counter value={draft.footer} limit={TEMPLATE_LIMITS.footerMaxLength} testId={WHATSAPP_TEMPLATE_FORM_FOOTER_COUNT_TESTID} />
        }
        value={draft.footer}
        onValueChange={(value) => change('footer', value)}
        autoComplete="off"
        testId={WHATSAPP_TEMPLATE_FORM_FOOTER_TESTID}
        hint={
          <span className="text-sm text-muted-foreground" data-testid={WHATSAPP_TEMPLATE_FORM_FOOTER_HINT_TESTID}>
            {WHATSAPP_TEMPLATE_FORM_TEXTS.footerHint}
          </span>
        }
        describeHint
        error={footerError}
        errorTestId={WHATSAPP_TEMPLATE_FORM_FOOTER_ERROR_TESTID}
      />
    </div>
  );

  const preview = (
    <WaBubble
      body={draft.body}
      footer={draft.footer}
      variables={entries.map((entry) => ({ key: entry.key, preview: entry.preview }))}
      time={WHATSAPP_TEMPLATE_FORM_TEXTS.previewTime}
    />
  );

  let content: ReactNode;
  if (isMobile) {
    content = (
      <Tabs defaultValue="form" className="flex flex-col gap-3" data-testid={WHATSAPP_TEMPLATE_FORM_TABS_TESTID}>
        <TabsList aria-label={WHATSAPP_TEMPLATE_FORM_TEXTS.tabsLabel} className="h-auto self-start">
          <TabsTrigger value="form" className="h-auto min-h-11 px-3 py-1" data-testid={WHATSAPP_TEMPLATE_FORM_TAB_TESTID('form')}>
            {WHATSAPP_TEMPLATE_FORM_TEXTS.formTab}
          </TabsTrigger>
          <TabsTrigger
            value="preview"
            className="h-auto min-h-11 px-3 py-1"
            data-testid={WHATSAPP_TEMPLATE_FORM_TAB_TESTID('preview')}
          >
            {WHATSAPP_TEMPLATE_FORM_TEXTS.previewTab}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="form" keepMounted>
          {form}
        </TabsContent>
        <TabsContent value="preview">{preview}</TabsContent>
      </Tabs>
    );
  } else {
    content = (
      <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-6">
        {form}
        <div className="sticky top-0">{preview}</div>
      </div>
    );
  }

  const usedSummary =
    usedKeys.length === 0
      ? WHATSAPP_TEMPLATE_FORM_TEXTS.confirmNoVariables
      : usedKeys.map((key) => labelOfKey(key, entries)).join(', ');

  return (
    <>
      <Sheet
        open
        onOpenChange={(next) => {
          if (!next && !isPending) onClose();
        }}
      >
        <SheetContent
          showCloseButton={false}
          className={cn(
            'gap-0 p-0 data-[side=right]:w-full',
            isMobile ? 'data-[side=right]:max-w-none' : 'data-[side=right]:sm:max-w-[min(1040px,100%)]',
          )}
          data-testid={WHATSAPP_TEMPLATE_FORM_SHEET_TESTID}
          data-layout={isMobile ? 'tabs' : 'columns'}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                touch
                onClick={onClose}
                disabled={isPending}
                data-testid={WHATSAPP_TEMPLATE_FORM_CANCEL_TESTID}
              >
                {WHATSAPP_TEMPLATE_FORM_TEXTS.cancel}
              </Button>
              <Button
                type="button"
                touch
                disabled={!canSubmit}
                onClick={() => setConfirming(true)}
                data-testid={WHATSAPP_TEMPLATE_FORM_SUBMIT_TESTID}
              >
                {WHATSAPP_TEMPLATE_FORM_TEXTS.submit}
              </Button>
            </>
          }
        >
          <SheetHeader className="flex-row items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <SheetTitle data-testid={WHATSAPP_TEMPLATE_FORM_TITLE_TESTID}>
                {initial.duplicate ? WHATSAPP_TEMPLATE_FORM_TEXTS.duplicateTitle : WHATSAPP_TEMPLATE_FORM_TEXTS.newTitle}
              </SheetTitle>
              <SheetDescription data-testid={WHATSAPP_TEMPLATE_FORM_DESCRIPTION_TESTID}>
                {WHATSAPP_TEMPLATE_FORM_TEXTS.description}
              </SheetDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              touch
              aria-label={WHATSAPP_TEMPLATE_FORM_TEXTS.close}
              onClick={onClose}
              disabled={isPending}
              data-testid={WHATSAPP_TEMPLATE_FORM_CLOSE_TESTID}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {error === null ? null : (
              <ErrorAlert
                error={error}
                testId={WHATSAPP_TEMPLATE_FORM_ERROR_TESTID}
                className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
                before={<p className="font-medium">{WHATSAPP_TEMPLATE_FORM_TEXTS.submitError}</p>}
              />
            )}
            {content}
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={confirming}
        onOpenChange={(next) => {
          if (!next && !isPending) setConfirming(false);
        }}
        texts={{
          title: WHATSAPP_TEMPLATE_FORM_TEXTS.confirmTitle,
          description: (
            <>
              {WHATSAPP_TEMPLATE_FORM_TEXTS.confirmStart}
              <span className="font-mono">{draft.name}</span>
              {WHATSAPP_TEMPLATE_FORM_TEXTS.confirmMiddle}
              <strong>{WHATSAPP_TEMPLATE_FORM_TEXTS.confirmLocked}</strong>
              {WHATSAPP_TEMPLATE_FORM_TEXTS.confirmEnd}
            </>
          ),
          dismiss: WHATSAPP_TEMPLATE_FORM_TEXTS.confirmDismiss,
          confirm: WHATSAPP_TEMPLATE_FORM_TEXTS.confirmSubmit,
          pending: (
            <>
              <Spinner />
              {WHATSAPP_TEMPLATE_FORM_TEXTS.confirmSubmit}
            </>
          ),
        }}
        testIds={{
          dialog: WHATSAPP_TEMPLATE_CONFIRM_DIALOG_TESTID,
          message: WHATSAPP_TEMPLATE_CONFIRM_MESSAGE_TESTID,
          dismiss: WHATSAPP_TEMPLATE_CONFIRM_DISMISS_TESTID,
          confirm: WHATSAPP_TEMPLATE_CONFIRM_SUBMIT_TESTID,
        }}
        icon={{ glyph: InfoIcon, tone: 'info' }}
        submit={{ kind: 'transition', onConfirm: confirm }}
        isPending={isPending}
        dismissDisabled={isPending}
      >
        <div className="flex flex-col gap-3 text-sm" data-testid={WHATSAPP_TEMPLATE_CONFIRM_SUMMARY_TESTID}>
          <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-lg border bg-muted/40 px-3 py-2.5">
            <dt className="text-muted-foreground">{WHATSAPP_TEMPLATE_FORM_TEXTS.confirmLanguage}</dt>
            <dd className="m-0 font-mono">{draft.language}</dd>
            <dt className="text-muted-foreground">{WHATSAPP_TEMPLATE_FORM_TEXTS.confirmCategory}</dt>
            <dd className="m-0">{categoryLabelOf(draft.category)}</dd>
            <dt className="text-muted-foreground">{WHATSAPP_TEMPLATE_FORM_TEXTS.confirmVariables}</dt>
            <dd className="m-0">{usedSummary}</dd>
          </dl>
          <p className="m-0 text-muted-foreground">{WHATSAPP_TEMPLATE_FORM_TEXTS.confirmReview}</p>
        </div>
      </ConfirmDialog>
    </>
  );
}
