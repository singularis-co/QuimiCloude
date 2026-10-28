'use client';

import { ArrowRightIcon, Link2Icon, XIcon } from 'lucide-react';
import { useId, useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
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
import { useIsMobile } from '@/hooks/use-mobile';
import type { ErrorState } from '@/lib/modules/errores';
import type {
  WhatsappDictionaryEntryView,
  WhatsappTemplateContent,
  WhatsappTemplateView,
} from '@/lib/modules/integraciones';
import { relateWhatsappTemplateVariablesAction } from '@/lib/modules/integraciones/adapters/driving/whatsapp-template-actions';
import { touchTarget } from '@/lib/shared/ui/touch-target';
import { cn } from '@/lib/utils';

import { WaBubble, type WaBubbleVariable } from './wa-bubble';
import { displayKeyOf, toBackendKey } from './whatsapp-system-constants';
import {
  dictionaryOf,
  numberedContentOf,
  slotMarkOf,
  type DisplayDictionaryEntry,
} from './whatsapp-template-rules';

export const WHATSAPP_RELATE_SHEET_TESTID = 'whatsapp-relate-sheet';
export const WHATSAPP_RELATE_TEXT_TESTID = 'whatsapp-relate-text';
export const WHATSAPP_RELATE_SLOT_TESTID = (slot: string) => `whatsapp-relate-slot-${slot}`;
export const WHATSAPP_RELATE_SLOT_MARK_TESTID = (slot: string) => `whatsapp-relate-slot-mark-${slot}`;
export const WHATSAPP_RELATE_SELECT_TESTID = (slot: string) => `whatsapp-relate-select-${slot}`;
export const WHATSAPP_RELATE_MISSING_TESTID = (slot: string) => `whatsapp-relate-missing-${slot}`;
export const WHATSAPP_RELATE_OPTION_TESTID = 'whatsapp-relate-option';
export const WHATSAPP_RELATE_HELP_TESTID = 'whatsapp-relate-help';
export const WHATSAPP_RELATE_CLOSE_TESTID = 'whatsapp-relate-close';
export const WHATSAPP_RELATE_CANCEL_TESTID = 'whatsapp-relate-cancel';
export const WHATSAPP_RELATE_SAVE_TESTID = 'whatsapp-relate-save';
export const WHATSAPP_RELATE_CONFIRM_DIALOG_TESTID = 'whatsapp-relate-confirm-dialog';
export const WHATSAPP_RELATE_CONFIRM_MESSAGE_TESTID = 'whatsapp-relate-confirm-message';
export const WHATSAPP_RELATE_CONFIRM_LINE_TESTID = 'whatsapp-relate-confirm-line';
export const WHATSAPP_RELATE_CONFIRM_DISMISS_TESTID = 'whatsapp-relate-confirm-dismiss';
export const WHATSAPP_RELATE_CONFIRM_SUBMIT_TESTID = 'whatsapp-relate-confirm-submit';
export const WHATSAPP_RELATE_CONFIRM_ERROR_TESTID = 'whatsapp-relate-confirm-error';

export const WHATSAPP_RELATE_TEXTS = {
  title: 'Relacionar variables',
  descriptionEnd: ' · Elige qué dato va en cada hueco. Con todos relacionados puedes habilitarla.',
  templateText: 'Texto de la plantilla',
  placeholder: 'Elige un dato…',
  systemGroup: 'Constantes del sistema',
  ownGroup: 'Variables propias',
  help: '¿Falta un dato? Créalo en Variables y vuelve aquí.',
  slotLabel: (mark: string) => `Dato para el hueco ${mark}`,
  missing: (mark: string) => `Falta relacionar el hueco ${mark}.`,
  close: 'Cerrar',
  cancel: 'Cancelar',
  save: 'Guardar',
  formTab: 'Formulario',
  previewTab: 'Vista previa',
  tabsLabel: 'Relacionar variables: formulario o vista previa',
  confirmTitle: 'Revisa la relación',
  confirmDescriptionEnd: ' enviará estos datos en cada mensaje:',
  confirmDismiss: 'Volver a revisar',
  confirmSubmit: 'Guardar relación',
  related: 'Variables relacionadas. Ya puedes habilitarla.',
  // Hora de ejemplo del tablero de la burbuja.
  previewTime: '09:41',
} as const;

export type WhatsappTemplateRelateSheetProps = {
  /** Con valor, el panel está abierto para esa plantilla. */
  readonly template: WhatsappTemplateView | null;
  /** Las variables propias; las constantes las añade el panel. */
  readonly dictionary: readonly WhatsappDictionaryEntryView[];
  readonly onClose: () => void;
  /** Tras guardar con éxito, con la plantilla que devuelve el servidor; el aviso de éxito ya lo da este panel. */
  readonly onRelated: (view: WhatsappTemplateView) => void;
};

type Selection = Readonly<Record<string, string | null>>;

const BODY_SLOT = /^body\.(\d+)$/;

/** En el cuerpo el hueco se nombra por su número; el encabezado y los botones, por su marca. */
function slotNameOf(slot: string): string {
  return BODY_SLOT.exec(slot)?.[1] ?? slotMarkOf(slot);
}

function initialSelection(
  view: WhatsappTemplateView,
  dictionary: readonly DisplayDictionaryEntry[],
): Selection {
  const selection: Record<string, string | null> = {};
  for (const variable of view.variables) {
    const key = variable.key === null ? null : displayKeyOf(variable.key);
    selection[variable.slot] = key !== null && dictionary.some((entry) => entry.key === key) ? key : null;
  }
  return selection;
}

function templateTextOf(content: WhatsappTemplateContent | null): string {
  if (content === null) return '';
  const parts: string[] = [];
  if (content.header !== null) parts.push(content.header.text);
  parts.push(content.body.text);
  for (const button of content.buttons) if (button.type === 'URL') parts.push(button.url);
  return parts.join('\n\n');
}

function OptionContent({ entry }: { readonly entry: DisplayDictionaryEntry }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className="truncate">{entry.label}</span>
      <span className="ml-auto font-mono text-xs text-muted-foreground">{entry.key}</span>
    </span>
  );
}

export function WhatsappTemplateRelateSheet({
  template,
  dictionary,
  onClose,
  onRelated,
}: WhatsappTemplateRelateSheetProps) {
  const isMobile = useIsMobile();
  const baseId = useId();
  const [isPending, startTransition] = useTransition();
  const entries = dictionaryOf(dictionary);
  const systemEntries = entries.filter((entry) => entry.kind === 'system');
  const ownEntries = entries.filter((entry) => entry.kind === 'company');

  // Se conserva la última para que el panel no se vacíe mientras se cierra.
  const [shown, setShown] = useState<WhatsappTemplateView | null>(template);
  const [selection, setSelection] = useState<Selection>(() =>
    template === null ? {} : initialSelection(template, entries),
  );
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  if (template !== null && template !== shown) {
    setShown(template);
    setSelection(initialSelection(template, entries));
    setConfirming(false);
    setError(null);
  }

  const slots = shown?.variables ?? [];
  const missing = slots.filter((variable) => (selection[variable.slot] ?? null) === null);
  const entryOf = (key: string | null | undefined) =>
    key === null || key === undefined ? undefined : entries.find((entry) => entry.key === key);

  const numbered = shown === null ? null : numberedContentOf(shown);
  const bodyVariables: WaBubbleVariable[] = [];
  const headerVariables: WaBubbleVariable[] = [];
  for (const variable of slots) {
    const entry = entryOf(selection[variable.slot]);
    if (entry === undefined) continue;
    if (variable.slot === 'header') headerVariables.push({ key: '1', preview: entry.preview });
    const n = BODY_SLOT.exec(variable.slot)?.[1];
    if (n !== undefined) bodyVariables.push({ key: n, preview: entry.preview });
  }

  function choose(slot: string, key: string | null) {
    setSelection((current) => ({ ...current, [slot]: key }));
  }

  function confirm() {
    if (shown === null) return;
    const target = shown;
    const bindings = slots.map((variable) => ({
      slot: variable.slot,
      key: toBackendKey(selection[variable.slot] ?? ''),
    }));
    startTransition(async () => {
      const result = await relateWhatsappTemplateVariablesAction({ templateId: target.id, bindings });
      if (result.status === 'error') {
        setError(result);
        return;
      }
      setError(null);
      setConfirming(false);
      toast.success(WHATSAPP_RELATE_TEXTS.related);
      onRelated(result.data);
    });
  }

  const form = (
    <div className="flex min-w-0 flex-col gap-3.5">
      <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 px-3 py-2.5">
        <span className="text-xs font-medium tracking-[.04em] text-muted-foreground uppercase">
          {WHATSAPP_RELATE_TEXTS.templateText}
        </span>
        <p className="m-0 text-sm leading-normal whitespace-pre-wrap" data-testid={WHATSAPP_RELATE_TEXT_TESTID}>
          {templateTextOf(numbered)}
        </p>
      </div>
      {slots.map((variable) => {
        const value = selection[variable.slot] ?? null;
        const mark = slotMarkOf(variable.slot);
        const missingId = `${baseId}-${variable.slot}-missing`;
        return (
          <div
            key={variable.slot}
            className="flex flex-col gap-1"
            data-testid={WHATSAPP_RELATE_SLOT_TESTID(variable.slot)}
          >
            <div className="grid grid-cols-[minmax(5rem,auto)_minmax(0,1fr)] items-center gap-3">
              <span
                className="font-mono text-sm font-semibold"
                data-testid={WHATSAPP_RELATE_SLOT_MARK_TESTID(variable.slot)}
              >
                {mark}
              </span>
              <Select<string>
                value={value}
                onValueChange={(next) => choose(variable.slot, next)}
                items={entries.map((entry) => ({ value: entry.key, label: entry.label }))}
              >
                <SelectTrigger
                  aria-label={WHATSAPP_RELATE_TEXTS.slotLabel(slotNameOf(variable.slot))}
                  aria-invalid={value === null ? true : undefined}
                  aria-describedby={value === null ? missingId : undefined}
                  className={cn('w-full text-base', touchTarget)}
                  data-testid={WHATSAPP_RELATE_SELECT_TESTID(variable.slot)}
                >
                  <SelectValue>
                    {(selected: string | null) => {
                      const entry = entryOf(selected);
                      return entry === undefined ? (
                        <span className="text-muted-foreground">{WHATSAPP_RELATE_TEXTS.placeholder}</span>
                      ) : (
                        <OptionContent entry={entry} />
                      );
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>{WHATSAPP_RELATE_TEXTS.systemGroup}</SelectLabel>
                    {systemEntries.map((entry) => (
                      <SelectItem
                        key={entry.key}
                        value={entry.key}
                        className={cn('text-base', touchTarget)}
                        data-testid={WHATSAPP_RELATE_OPTION_TESTID}
                        data-group="system"
                      >
                        <OptionContent entry={entry} />
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  {ownEntries.length === 0 ? null : (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>{WHATSAPP_RELATE_TEXTS.ownGroup}</SelectLabel>
                        {ownEntries.map((entry) => (
                          <SelectItem
                            key={entry.key}
                            value={entry.key}
                            className={cn('text-base', touchTarget)}
                            data-testid={WHATSAPP_RELATE_OPTION_TESTID}
                            data-group="company"
                          >
                            <OptionContent entry={entry} />
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            {value === null ? (
              <span
                id={missingId}
                className="text-sm text-destructive"
                data-testid={WHATSAPP_RELATE_MISSING_TESTID(variable.slot)}
              >
                {WHATSAPP_RELATE_TEXTS.missing(slotNameOf(variable.slot))}
              </span>
            ) : null}
          </div>
        );
      })}
      <span className="text-sm text-muted-foreground" data-testid={WHATSAPP_RELATE_HELP_TESTID}>
        {WHATSAPP_RELATE_TEXTS.help}
      </span>
    </div>
  );

  const preview = (
    <WaBubble
      body={numbered?.body.text ?? ''}
      header={numbered?.header?.text ?? null}
      footer={numbered?.footer ?? null}
      buttons={(numbered?.buttons ?? []).map((button) => ({ type: button.type, text: button.text }))}
      variables={bodyVariables}
      headerVariables={headerVariables}
      unmappedSlots
      time={WHATSAPP_RELATE_TEXTS.previewTime}
    />
  );

  let content: ReactNode;
  if (isMobile) {
    content = (
      <Tabs defaultValue="form" className="flex flex-col gap-3">
        <TabsList aria-label={WHATSAPP_RELATE_TEXTS.tabsLabel} className="h-auto self-start">
          <TabsTrigger value="form" className="h-auto min-h-11 px-3 py-1">
            {WHATSAPP_RELATE_TEXTS.formTab}
          </TabsTrigger>
          <TabsTrigger value="preview" className="h-auto min-h-11 px-3 py-1">
            {WHATSAPP_RELATE_TEXTS.previewTab}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="form">{form}</TabsContent>
        <TabsContent value="preview">{preview}</TabsContent>
      </Tabs>
    );
  } else {
    content = (
      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-5">
        {form}
        <div className="sticky top-0">{preview}</div>
      </div>
    );
  }

  return (
    <>
      <Sheet
        open={template !== null}
        onOpenChange={(next) => {
          if (!next && !isPending) onClose();
        }}
      >
        <SheetContent
          showCloseButton={false}
          className={cn(
            'gap-0 p-0 data-[side=right]:w-full',
            isMobile ? 'data-[side=right]:max-w-none' : 'data-[side=right]:sm:max-w-[min(860px,100%)]',
          )}
          data-testid={WHATSAPP_RELATE_SHEET_TESTID}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                touch
                onClick={onClose}
                disabled={isPending}
                data-testid={WHATSAPP_RELATE_CANCEL_TESTID}
              >
                {WHATSAPP_RELATE_TEXTS.cancel}
              </Button>
              <Button
                type="button"
                touch
                disabled={missing.length > 0 || isPending}
                onClick={() => {
                  setError(null);
                  setConfirming(true);
                }}
                data-testid={WHATSAPP_RELATE_SAVE_TESTID}
              >
                {WHATSAPP_RELATE_TEXTS.save}
              </Button>
            </>
          }
        >
          <SheetHeader className="flex-row items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <SheetTitle>{WHATSAPP_RELATE_TEXTS.title}</SheetTitle>
              <SheetDescription>
                <span className="font-mono">{shown?.name}</span>
                {WHATSAPP_RELATE_TEXTS.descriptionEnd}
              </SheetDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              touch
              aria-label={WHATSAPP_RELATE_TEXTS.close}
              onClick={onClose}
              disabled={isPending}
              data-testid={WHATSAPP_RELATE_CLOSE_TESTID}
            >
              <XIcon aria-hidden />
            </Button>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{content}</div>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={confirming}
        onOpenChange={(next) => {
          if (!next && !isPending) setConfirming(false);
        }}
        texts={{
          title: WHATSAPP_RELATE_TEXTS.confirmTitle,
          description: (
            <>
              <span className="font-mono">{shown?.name}</span>
              {WHATSAPP_RELATE_TEXTS.confirmDescriptionEnd}
            </>
          ),
          dismiss: WHATSAPP_RELATE_TEXTS.confirmDismiss,
          confirm: WHATSAPP_RELATE_TEXTS.confirmSubmit,
        }}
        testIds={{
          dialog: WHATSAPP_RELATE_CONFIRM_DIALOG_TESTID,
          message: WHATSAPP_RELATE_CONFIRM_MESSAGE_TESTID,
          dismiss: WHATSAPP_RELATE_CONFIRM_DISMISS_TESTID,
          confirm: WHATSAPP_RELATE_CONFIRM_SUBMIT_TESTID,
          error: WHATSAPP_RELATE_CONFIRM_ERROR_TESTID,
        }}
        icon={{ glyph: Link2Icon, tone: 'info' }}
        submit={{ kind: 'transition', onConfirm: confirm }}
        isPending={isPending}
        dismissDisabled={isPending}
        error={error ?? undefined}
        errorStyle="inline"
      >
        <ul className="m-0 flex list-none flex-col gap-1.5 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
          {slots.map((variable) => {
            const entry = entryOf(selection[variable.slot]);
            return (
              <li
                key={variable.slot}
                className="flex flex-wrap items-center gap-2"
                data-testid={WHATSAPP_RELATE_CONFIRM_LINE_TESTID}
              >
                <span className="font-mono font-semibold">{slotMarkOf(variable.slot)}</span>
                <ArrowRightIcon aria-hidden className="size-3.5 text-muted-foreground" />
                <span>{entry?.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{entry?.key}</span>
              </li>
            );
          })}
        </ul>
      </ConfirmDialog>
    </>
  );
}
