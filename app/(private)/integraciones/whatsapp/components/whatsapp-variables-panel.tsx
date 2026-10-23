'use client';

import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { DeleteConfirmDialog } from '@/components/shared/delete-confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ErrorState } from '@/lib/modules/errores';
import type { WhatsappDictionaryEntryView } from '@/lib/modules/integraciones';
import { deleteWhatsappVariableKeyAction } from '@/lib/modules/integraciones/adapters/driving/whatsapp-variable-key-actions';

import { SYSTEM_CONSTANTS } from './whatsapp-system-constants';
import { WhatsappVariableFormSheet, type WhatsappVariableSheetTarget } from './whatsapp-variable-form-sheet';

export const WHATSAPP_VARIABLES_PANEL_TESTID = 'whatsapp-variables-panel';
export const WHATSAPP_VARIABLES_INTRO_TESTID = 'whatsapp-variables-intro';
export const WHATSAPP_CONSTANTS_TABLE_TESTID = 'whatsapp-constants-table';
export const WHATSAPP_CONSTANTS_CARDS_TESTID = 'whatsapp-constants-cards';
export const WHATSAPP_OWN_VARIABLES_TABLE_TESTID = 'whatsapp-own-variables-table';
export const WHATSAPP_OWN_VARIABLES_CARDS_TESTID = 'whatsapp-own-variables-cards';
export const WHATSAPP_OWN_VARIABLES_EMPTY_TESTID = 'whatsapp-own-variables-empty';
export const WHATSAPP_NEW_VARIABLE_TESTID = 'whatsapp-new-variable';
export const WHATSAPP_NEW_VARIABLE_EMPTY_TESTID = 'whatsapp-new-variable-empty';
export const WHATSAPP_DELETE_VARIABLE_DIALOG_TESTID = 'whatsapp-delete-variable-dialog';
export const WHATSAPP_DELETE_VARIABLE_MESSAGE_TESTID = 'whatsapp-delete-variable-message';
export const WHATSAPP_DELETE_VARIABLE_CONFIRM_TESTID = 'whatsapp-delete-variable-confirm';
export const WHATSAPP_DELETE_VARIABLE_DISMISS_TESTID = 'whatsapp-delete-variable-dismiss';
export const WHATSAPP_DELETE_VARIABLE_ERROR_TESTID = 'whatsapp-delete-variable-error';

export const ownVariableEditTestId = (id: string) => `whatsapp-own-variable-edit-${id}`;
export const ownVariableDeleteTestId = (id: string) => `whatsapp-own-variable-delete-${id}`;
export const ownVariableCardEditTestId = (id: string) => `whatsapp-own-variable-card-edit-${id}`;
export const ownVariableCardDeleteTestId = (id: string) => `whatsapp-own-variable-card-delete-${id}`;

export const WHATSAPP_VARIABLES_TEXTS = {
  introBefore: 'Las variables se insertan en las plantillas como ',
  introKey: '{{clave}}',
  introAfter:
    '. Al enviar, el sistema pone el dato real. Meta ve la etiqueta como ejemplo cuando revisa la plantilla.',
  constantsTitle: 'Constantes del sistema',
  constantsDescription: 'Las resuelve el sistema con el dato de cada envío. No se editan.',
  ownTitle: 'Variables propias',
  ownDescription:
    'Datos fijos de tu empresa, como un número de cuenta. Se guardan una vez y sirven para todas las plantillas; se envía el valor guardado.',
  newVariable: 'Nueva variable',
  ownEmpty: 'Todavía no hay variables propias.',
  columns: {
    label: 'Etiqueta',
    key: 'Clave',
    description: 'Descripción',
    example: 'Ejemplo',
    value: 'Valor',
    usedBy: 'Plantillas que la usan',
    actions: 'Acciones',
  },
  exampleCard: (example: string) => `Ejemplo: ${example}`,
  usedByCard: 'Usada en ',
  edit: 'Editar',
  delete: 'Eliminar',
  editLabel: (label: string) => `Editar ${label}`,
  deleteLabel: (label: string) => `Eliminar ${label}`,
  deleteTitle: 'Eliminar la variable',
  deleteDescription: (label: string) => `Se va a eliminar «${label}». Esta acción no se puede deshacer.`,
  deleteBlocked: (label: string, usedBy: number) =>
    `No se puede eliminar «${label}»: la usan ${usedBy} plantillas. Quítala de esas plantillas primero.`,
  deleteDismiss: 'Volver',
  deleted: 'Variable eliminada.',
} as const;

export type { WhatsappVariableSheetTarget } from './whatsapp-variable-form-sheet';

export type WhatsappVariablesPanelProps = {
  readonly entries: readonly WhatsappDictionaryEntryView[];
  readonly hasConnection: boolean;
};

const SECTION_HEAD_CLASS = 'flex flex-col gap-1';
const SECTION_TITLE_CLASS = 'font-heading text-base leading-snug font-semibold';
const MOBILE_LIST_CLASS = 'flex flex-col rounded-xl border border-border md:hidden';
const MOBILE_ITEM_CLASS = 'flex flex-col gap-2 border-b border-border px-4 py-3.5 last:border-b-0';
const DESKTOP_TABLE_CLASS = 'hidden md:block';

function ConstantsSection() {
  const { columns } = WHATSAPP_VARIABLES_TEXTS;
  return (
    <Card>
      <CardHeader className={SECTION_HEAD_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>{WHATSAPP_VARIABLES_TEXTS.constantsTitle}</h2>
        <CardDescription>{WHATSAPP_VARIABLES_TEXTS.constantsDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={DESKTOP_TABLE_CLASS}>
          <Table data-testid={WHATSAPP_CONSTANTS_TABLE_TESTID}>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{columns.label}</TableHead>
                <TableHead scope="col">{columns.key}</TableHead>
                <TableHead scope="col">{columns.description}</TableHead>
                <TableHead scope="col">{columns.example}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SYSTEM_CONSTANTS.map((constant) => (
                <TableRow key={constant.displayKey}>
                  <TableCell className="font-medium">{constant.label}</TableCell>
                  <TableCell className="font-mono">{constant.displayKey}</TableCell>
                  <TableCell className="max-w-[360px] whitespace-normal text-muted-foreground">
                    {constant.description}
                  </TableCell>
                  <TableCell>{constant.example}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ul className={MOBILE_LIST_CLASS} data-testid={WHATSAPP_CONSTANTS_CARDS_TESTID}>
          {SYSTEM_CONSTANTS.map((constant) => (
            <li key={constant.displayKey} className={MOBILE_ITEM_CLASS}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{constant.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{constant.displayKey}</span>
              </div>
              <span className="text-[13px] text-muted-foreground">{constant.description}</span>
              <span className="text-[13px] text-muted-foreground">
                {WHATSAPP_VARIABLES_TEXTS.exampleCard(constant.example)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

type OwnRowsProps = {
  readonly entries: readonly WhatsappDictionaryEntryView[];
  readonly onEdit: (entry: WhatsappDictionaryEntryView) => void;
  readonly onDelete: (entry: WhatsappDictionaryEntryView) => void;
};

function OwnVariablesTable({ entries, onEdit, onDelete }: OwnRowsProps) {
  const { columns } = WHATSAPP_VARIABLES_TEXTS;
  return (
    <div className={DESKTOP_TABLE_CLASS}>
      <Table data-testid={WHATSAPP_OWN_VARIABLES_TABLE_TESTID}>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{columns.label}</TableHead>
            <TableHead scope="col">{columns.key}</TableHead>
            <TableHead scope="col">{columns.value}</TableHead>
            <TableHead scope="col" className="text-right">
              {columns.usedBy}
            </TableHead>
            <TableHead scope="col">
              <span className="sr-only">{columns.actions}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">{entry.label}</TableCell>
              <TableCell className="font-mono">{entry.key}</TableCell>
              <TableCell className="whitespace-normal">{entry.value}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{entry.usedBy}</TableCell>
              <TableCell className="text-right">
                <span className="inline-flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    touch
                    aria-label={WHATSAPP_VARIABLES_TEXTS.editLabel(entry.label)}
                    data-testid={ownVariableEditTestId(entry.id)}
                    onClick={() => onEdit(entry)}
                  >
                    <PencilIcon aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    touch
                    aria-label={WHATSAPP_VARIABLES_TEXTS.deleteLabel(entry.label)}
                    data-testid={ownVariableDeleteTestId(entry.id)}
                    onClick={() => onDelete(entry)}
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function OwnVariablesCards({ entries, onEdit, onDelete }: OwnRowsProps) {
  return (
    <ul className={MOBILE_LIST_CLASS} data-testid={WHATSAPP_OWN_VARIABLES_CARDS_TESTID}>
      {entries.map((entry) => (
        <li key={entry.id} className={MOBILE_ITEM_CLASS}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{entry.label}</span>
            <span className="font-mono text-xs text-muted-foreground">{entry.key}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted-foreground">
            <span>{entry.value}</span>
            <span>
              {WHATSAPP_VARIABLES_TEXTS.usedByCard}
              <span className="font-mono">{entry.usedBy}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              touch
              aria-label={WHATSAPP_VARIABLES_TEXTS.editLabel(entry.label)}
              data-testid={ownVariableCardEditTestId(entry.id)}
              onClick={() => onEdit(entry)}
            >
              {WHATSAPP_VARIABLES_TEXTS.edit}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              touch
              aria-label={WHATSAPP_VARIABLES_TEXTS.deleteLabel(entry.label)}
              data-testid={ownVariableCardDeleteTestId(entry.id)}
              onClick={() => onDelete(entry)}
            >
              {WHATSAPP_VARIABLES_TEXTS.delete}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

type DeleteVariableDialogProps = {
  readonly entry: WhatsappDictionaryEntryView | null;
  readonly onClose: () => void;
};

function DeleteVariableDialog({ entry, onClose }: DeleteVariableDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorState | null>(null);
  // Se conserva la última para que el texto no se vacíe mientras el diálogo se cierra.
  const [shown, setShown] = useState<WhatsappDictionaryEntryView | null>(entry);
  if (entry !== null && entry !== shown) {
    setShown(entry);
    setError(null);
  }

  const inUse = shown !== null && shown.usedBy > 0;
  const description =
    shown === null
      ? ''
      : inUse
        ? WHATSAPP_VARIABLES_TEXTS.deleteBlocked(shown.label, shown.usedBy)
        : WHATSAPP_VARIABLES_TEXTS.deleteDescription(shown.label);

  function confirm() {
    if (shown === null || inUse) return;
    const id = shown.id;
    startTransition(async () => {
      const result = await deleteWhatsappVariableKeyAction(id);
      if (result.status === 'error') {
        setError(result);
        return;
      }
      setError(null);
      onClose();
      toast.success(WHATSAPP_VARIABLES_TEXTS.deleted);
      router.refresh();
    });
  }

  return (
    <DeleteConfirmDialog
      open={entry !== null}
      onOpenChange={(next) => {
        if (!next && !isPending) onClose();
      }}
      texts={{
        title: WHATSAPP_VARIABLES_TEXTS.deleteTitle,
        description,
        dismiss: WHATSAPP_VARIABLES_TEXTS.deleteDismiss,
      }}
      testIds={{
        dialog: WHATSAPP_DELETE_VARIABLE_DIALOG_TESTID,
        message: WHATSAPP_DELETE_VARIABLE_MESSAGE_TESTID,
        dismiss: WHATSAPP_DELETE_VARIABLE_DISMISS_TESTID,
        confirm: WHATSAPP_DELETE_VARIABLE_CONFIRM_TESTID,
        error: WHATSAPP_DELETE_VARIABLE_ERROR_TESTID,
      }}
      icon={{ glyph: Trash2Icon, tone: 'danger' }}
      submit={{ kind: 'transition', onConfirm: confirm }}
      isPending={isPending}
      confirmDisabled={inUse}
      dismissDisabled={isPending}
      error={error ?? undefined}
      errorStyle="inline"
    />
  );
}

export function WhatsappVariablesPanel({ entries }: WhatsappVariablesPanelProps) {
  const router = useRouter();
  const [sheetTarget, setSheetTarget] = useState<WhatsappVariableSheetTarget | null>(null);
  const [deleting, setDeleting] = useState<WhatsappDictionaryEntryView | null>(null);

  const newVariableButton = (testId: string) => (
    <Button type="button" touch="mobile" data-testid={testId} onClick={() => setSheetTarget('new')}>
      <PlusIcon aria-hidden="true" />
      {WHATSAPP_VARIABLES_TEXTS.newVariable}
    </Button>
  );

  return (
    <section
      data-testid={WHATSAPP_VARIABLES_PANEL_TESTID}
      data-count={entries.length}
      className="flex flex-col gap-4"
    >
      <p className="max-w-[720px] text-sm text-muted-foreground" data-testid={WHATSAPP_VARIABLES_INTRO_TESTID}>
        {WHATSAPP_VARIABLES_TEXTS.introBefore}
        <span className="font-mono">{WHATSAPP_VARIABLES_TEXTS.introKey}</span>
        {WHATSAPP_VARIABLES_TEXTS.introAfter}
      </p>

      <ConstantsSection />

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className={SECTION_HEAD_CLASS}>
            <h2 className={SECTION_TITLE_CLASS}>{WHATSAPP_VARIABLES_TEXTS.ownTitle}</h2>
            <CardDescription>{WHATSAPP_VARIABLES_TEXTS.ownDescription}</CardDescription>
          </div>
          {entries.length === 0 ? null : newVariableButton(WHATSAPP_NEW_VARIABLE_TESTID)}
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <EmptyState testId={WHATSAPP_OWN_VARIABLES_EMPTY_TESTID} message={WHATSAPP_VARIABLES_TEXTS.ownEmpty}>
              {newVariableButton(WHATSAPP_NEW_VARIABLE_EMPTY_TESTID)}
            </EmptyState>
          ) : (
            <>
              <OwnVariablesTable entries={entries} onEdit={setSheetTarget} onDelete={setDeleting} />
              <OwnVariablesCards entries={entries} onEdit={setSheetTarget} onDelete={setDeleting} />
            </>
          )}
        </CardContent>
      </Card>

      <WhatsappVariableFormSheet
        target={sheetTarget}
        entries={entries}
        onClose={() => setSheetTarget(null)}
        onSaved={() => {
          setSheetTarget(null);
          router.refresh();
        }}
      />
      <DeleteVariableDialog entry={deleting} onClose={() => setDeleting(null)} />
    </section>
  );
}
