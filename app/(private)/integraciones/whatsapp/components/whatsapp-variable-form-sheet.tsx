'use client';

import { TriangleAlertIcon, XIcon } from 'lucide-react';
import { useId, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ErrorAlert } from '@/components/shared/error-alert';
import { FormSheet } from '@/components/shared/form-sheet';
import { TextField } from '@/components/shared/text-field';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose } from '@/components/ui/sheet';
import type { ErrorState } from '@/lib/modules/errores';
import { validateWhatsappVariableKeyInput, type WhatsappDictionaryEntryView } from '@/lib/modules/integraciones';
import {
  createWhatsappVariableKeyAction,
  updateWhatsappVariableKeyAction,
} from '@/lib/modules/integraciones/adapters/driving/whatsapp-variable-key-actions';

import { keyFromLabel, keyProblemOf, VARIABLE_RULES_TEXTS, valueFormatWarning } from './whatsapp-variable-rules';

export const WHATSAPP_VARIABLE_SHEET_TESTID = 'whatsapp-variable-sheet';
export const WHATSAPP_VARIABLE_FORM_TESTID = 'whatsapp-variable-form';
export const WHATSAPP_VARIABLE_TITLE_TESTID = 'whatsapp-variable-title';
export const WHATSAPP_VARIABLE_CLOSE_TESTID = 'whatsapp-variable-close';
export const WHATSAPP_VARIABLE_CANCEL_TESTID = 'whatsapp-variable-cancel';
export const WHATSAPP_VARIABLE_SAVE_TESTID = 'whatsapp-variable-save';
export const WHATSAPP_VARIABLE_ERROR_TESTID = 'whatsapp-variable-error';
export const WHATSAPP_VARIABLE_LABEL_TESTID = 'whatsapp-variable-label';
export const WHATSAPP_VARIABLE_LABEL_ERROR_TESTID = 'whatsapp-variable-label-error';
export const WHATSAPP_VARIABLE_KEY_TESTID = 'whatsapp-variable-key';
export const WHATSAPP_VARIABLE_KEY_ERROR_TESTID = 'whatsapp-variable-key-error';
export const WHATSAPP_VARIABLE_VALUE_TESTID = 'whatsapp-variable-value';
export const WHATSAPP_VARIABLE_VALUE_ERROR_TESTID = 'whatsapp-variable-value-error';
export const WHATSAPP_VARIABLE_CONFIRM_DIALOG_TESTID = 'whatsapp-variable-confirm-dialog';
export const WHATSAPP_VARIABLE_CONFIRM_MESSAGE_TESTID = 'whatsapp-variable-confirm-message';
export const WHATSAPP_VARIABLE_CONFIRM_BEFORE_TESTID = 'whatsapp-variable-confirm-before';
export const WHATSAPP_VARIABLE_CONFIRM_AFTER_TESTID = 'whatsapp-variable-confirm-after';
export const WHATSAPP_VARIABLE_CONFIRM_WARNING_TESTID = 'whatsapp-variable-confirm-warning';
export const WHATSAPP_VARIABLE_CONFIRM_DISMISS_TESTID = 'whatsapp-variable-confirm-dismiss';
export const WHATSAPP_VARIABLE_CONFIRM_SUBMIT_TESTID = 'whatsapp-variable-confirm-submit';
export const WHATSAPP_VARIABLE_CONFIRM_ERROR_TESTID = 'whatsapp-variable-confirm-error';

export const WHATSAPP_VARIABLE_FORM_TEXTS = {
  newTitle: 'Nueva variable',
  editTitle: 'Editar variable',
  description: 'Un dato fijo de tu empresa para usar en las plantillas.',
  close: 'Cerrar',
  cancel: 'Cancelar',
  save: 'Guardar',
  saving: 'Guardando…',
  label: 'Etiqueta',
  labelHint: 'Cómo se ve en la app. Hasta 60 caracteres.',
  key: 'Clave',
  keyHintNew: 'Se arma sola desde la etiqueta: sin tildes ni mayúsculas, espacios como _. No se puede cambiar después.',
  keyHintEdit: 'La clave no se cambia después de crear la variable.',
  value: 'Valor',
  valueHint: 'Lo que se envía al cliente. Hasta 50 caracteres.',
  valueHintInUse: (usedBy: number) =>
    `${usedBy === 1 ? 'Lo usa 1 plantilla' : `Lo usan ${usedBy} plantillas`}. El valor nuevo se envía desde el próximo mensaje. Hasta 50 caracteres.`,
  confirmTitle: 'Revisa el cambio',
  confirmDescription: (label: string, usedBy: number) =>
    `«${label}» se envía en ${usedBy} ${usedBy === 1 ? 'plantilla' : 'plantillas'}. Desde el próximo mensaje, los clientes recibirán el valor nuevo.`,
  confirmBefore: 'Antes',
  confirmAfter: 'Ahora',
  confirmDismiss: 'Volver a revisar',
  confirmSubmit: 'Guardar cambio',
  created: 'Variable creada.',
  updated: 'Variable actualizada.',
  updatedInUse: 'Variable actualizada. El valor nuevo se envía desde el próximo mensaje.',
} as const;

/** Qué abre el panel de variable: una nueva o la propia que se edita. */
export type WhatsappVariableSheetTarget = 'new' | WhatsappDictionaryEntryView;

export type WhatsappVariableFormSheetProps = {
  /** Con valor, el panel está abierto. */
  readonly target: WhatsappVariableSheetTarget | null;
  /** Las variables propias de la empresa: una nueva no puede repetir su clave. */
  readonly entries: readonly WhatsappDictionaryEntryView[];
  readonly onClose: () => void;
  /** Tras guardar, con la entrada que devuelve el servidor; el aviso de éxito ya lo da este panel. */
  readonly onSaved: (entry: WhatsappDictionaryEntryView) => void;
};

type Field = 'label' | 'value';

const INPUT_CLASS = 'min-h-11 text-base md:text-base';

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}

export function WhatsappVariableFormSheet({ target, entries, onClose, onSaved }: WhatsappVariableFormSheetProps) {
  const baseId = useId();
  const [isPending, startTransition] = useTransition();
  // Se conserva el último para que el panel no se vacíe mientras se cierra.
  const [shown, setShown] = useState<WhatsappVariableSheetTarget | null>(target);
  const [openedFor, setOpenedFor] = useState<WhatsappVariableSheetTarget | null>(target);
  const [label, setLabel] = useState(target === null || target === 'new' ? '' : target.label);
  const [value, setValue] = useState(target === null || target === 'new' ? '' : target.value);
  const [touched, setTouched] = useState<ReadonlySet<Field>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  if (target !== openedFor) {
    setOpenedFor(target);
    if (target !== null) {
      setShown(target);
      setLabel(target === 'new' ? '' : target.label);
      setValue(target === 'new' ? '' : target.value);
      setTouched(new Set());
      setConfirming(false);
      setError(null);
    }
  }

  const editing = shown === null || shown === 'new' ? null : shown;
  const key = editing === null ? keyFromLabel(label) : editing.key;
  const input = { key, label, value };

  const keyProblem =
    editing === null
      ? keyProblemOf(
          key,
          entries.map((entry) => entry.key),
        )
      : null;
  const validation = validateWhatsappVariableKeyInput(input);
  const issues = validation.ok ? [] : validation.issues;

  function issueOf(field: Field): string | undefined {
    const issue = issues.find((candidate) => candidate.field === field);
    if (issue === undefined) return undefined;
    if (issue.code === 'required' && !touched.has(field)) return undefined;
    return issue.message;
  }

  const keyError =
    keyProblem === null || (keyProblem === VARIABLE_RULES_TEXTS.keyEmpty && !touched.has('label'))
      ? undefined
      : keyProblem;
  const canSave = keyProblem === null && issues.length === 0;
  const usedBy = editing?.usedBy ?? 0;
  const needsConfirm = editing !== null && usedBy > 0 && value !== editing.value;
  const showWarning = editing !== null && valueFormatWarning(editing.value, value);

  function change(field: Field, next: string) {
    if (field === 'label') setLabel(next);
    else setValue(next);
    setTouched((current) => (current.has(field) ? current : new Set(current).add(field)));
  }

  function save(viaDialog: boolean) {
    const entry = editing;
    startTransition(async () => {
      const result =
        entry === null
          ? await createWhatsappVariableKeyAction(input)
          : await updateWhatsappVariableKeyAction(entry.id, { key: entry.key, label, value });
      if (result.status === 'error') {
        setError(result);
        return;
      }
      setError(null);
      setConfirming(false);
      toast.success(
        entry === null
          ? WHATSAPP_VARIABLE_FORM_TEXTS.created
          : viaDialog
            ? WHATSAPP_VARIABLE_FORM_TEXTS.updatedInUse
            : WHATSAPP_VARIABLE_FORM_TEXTS.updated,
      );
      onSaved(result.data);
    });
  }

  function submit() {
    if (!canSave || isPending) return;
    setError(null);
    if (needsConfirm) {
      setConfirming(true);
      return;
    }
    save(false);
  }

  const texts = WHATSAPP_VARIABLE_FORM_TEXTS;

  return (
    <>
      <Sheet
        open={target !== null}
        onOpenChange={(next) => {
          if (!next && !isPending) onClose();
        }}
      >
        <FormSheet
          title={editing === null ? texts.newTitle : texts.editTitle}
          description={texts.description}
          headerExtra={
            <SheetClose
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  touch
                  className="absolute top-2 right-2"
                  aria-label={texts.close}
                  disabled={isPending}
                  data-testid={WHATSAPP_VARIABLE_CLOSE_TESTID}
                />
              }
            >
              <XIcon aria-hidden="true" />
            </SheetClose>
          }
          showCloseButton={false}
          formAction={submit}
          noValidate
          testIds={{
            sheet: WHATSAPP_VARIABLE_SHEET_TESTID,
            form: WHATSAPP_VARIABLE_FORM_TESTID,
            cancel: WHATSAPP_VARIABLE_CANCEL_TESTID,
            submit: WHATSAPP_VARIABLE_SAVE_TESTID,
            title: WHATSAPP_VARIABLE_TITLE_TESTID,
          }}
          cancelLabel={texts.cancel}
          saveLabel={texts.save}
          pendingLabel={texts.saving}
          canSave={canSave}
          busy={isPending}
          cancelTouch="prop"
        >
          {error === null || confirming ? null : (
            <ErrorAlert
              error={error}
              testId={WHATSAPP_VARIABLE_ERROR_TESTID}
              className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
            />
          )}
          <TextField
            id={`${baseId}-label`}
            label={
              <>
                {texts.label} <RequiredMark />
              </>
            }
            value={label}
            onValueChange={(next) => change('label', next)}
            ariaRequired
            autoComplete="off"
            hint={texts.labelHint}
            describeHint
            error={issueOf('label')}
            testId={WHATSAPP_VARIABLE_LABEL_TESTID}
            errorTestId={WHATSAPP_VARIABLE_LABEL_ERROR_TESTID}
          />
          <TextField
            id={`${baseId}-key`}
            label={texts.key}
            value={key}
            readOnly
            inputClassName={`${INPUT_CLASS} bg-muted font-mono`}
            hint={editing === null ? texts.keyHintNew : texts.keyHintEdit}
            describeHint
            error={keyError}
            testId={WHATSAPP_VARIABLE_KEY_TESTID}
            errorTestId={WHATSAPP_VARIABLE_KEY_ERROR_TESTID}
          />
          <TextField
            id={`${baseId}-value`}
            label={
              <>
                {texts.value} <RequiredMark />
              </>
            }
            value={value}
            onValueChange={(next) => change('value', next)}
            ariaRequired
            autoComplete="off"
            hint={usedBy > 0 ? texts.valueHintInUse(usedBy) : texts.valueHint}
            describeHint
            error={issueOf('value')}
            testId={WHATSAPP_VARIABLE_VALUE_TESTID}
            errorTestId={WHATSAPP_VARIABLE_VALUE_ERROR_TESTID}
          />
        </FormSheet>
      </Sheet>
      <ConfirmDialog
        open={confirming}
        onOpenChange={(next) => {
          if (!next && !isPending) setConfirming(false);
        }}
        texts={{
          title: texts.confirmTitle,
          description: texts.confirmDescription(editing?.label ?? '', usedBy),
          dismiss: texts.confirmDismiss,
          confirm: texts.confirmSubmit,
        }}
        testIds={{
          dialog: WHATSAPP_VARIABLE_CONFIRM_DIALOG_TESTID,
          message: WHATSAPP_VARIABLE_CONFIRM_MESSAGE_TESTID,
          dismiss: WHATSAPP_VARIABLE_CONFIRM_DISMISS_TESTID,
          confirm: WHATSAPP_VARIABLE_CONFIRM_SUBMIT_TESTID,
          error: WHATSAPP_VARIABLE_CONFIRM_ERROR_TESTID,
        }}
        icon={{ glyph: TriangleAlertIcon, tone: 'warning' }}
        submit={{ kind: 'transition', onConfirm: () => save(true) }}
        isPending={isPending}
        dismissDisabled={isPending}
        error={error ?? undefined}
        errorStyle="inline"
      >
        <dl className="m-0 flex flex-col gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <dt className="text-xs font-medium tracking-[.04em] text-muted-foreground uppercase">
              {texts.confirmBefore}
            </dt>
            <dd
              className="m-0 whitespace-pre-wrap text-muted-foreground line-through [overflow-wrap:anywhere]"
              data-testid={WHATSAPP_VARIABLE_CONFIRM_BEFORE_TESTID}
            >
              {editing?.value}
            </dd>
          </div>
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <dt className="text-xs font-medium tracking-[.04em] text-muted-foreground uppercase">
              {texts.confirmAfter}
            </dt>
            <dd
              className="m-0 font-semibold whitespace-pre-wrap [overflow-wrap:anywhere]"
              data-testid={WHATSAPP_VARIABLE_CONFIRM_AFTER_TESTID}
            >
              {value}
            </dd>
          </div>
        </dl>
        {showWarning ? (
          <p className="m-0 text-sm text-destructive" data-testid={WHATSAPP_VARIABLE_CONFIRM_WARNING_TESTID}>
            {VARIABLE_RULES_TEXTS.valueFormatWarning}
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
