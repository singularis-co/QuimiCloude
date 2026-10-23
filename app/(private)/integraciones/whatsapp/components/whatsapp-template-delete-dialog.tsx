'use client';

import { Trash2Icon } from 'lucide-react';
import { useState, useTransition } from 'react';

import { DeleteConfirmDialog } from '@/components/shared/delete-confirm-dialog';
import type { ErrorState } from '@/lib/modules/errores';
import type { WhatsappTemplateView } from '@/lib/modules/integraciones';
import { deleteWhatsappTemplateAction } from '@/lib/modules/integraciones/adapters/driving/whatsapp-template-actions';

export const WHATSAPP_DELETE_TEMPLATE_DIALOG_TESTID = 'whatsapp-delete-template-dialog';
export const WHATSAPP_DELETE_TEMPLATE_MESSAGE_TESTID = 'whatsapp-delete-template-message';
export const WHATSAPP_DELETE_TEMPLATE_DISMISS_TESTID = 'whatsapp-delete-template-dismiss';
export const WHATSAPP_DELETE_TEMPLATE_CONFIRM_TESTID = 'whatsapp-delete-template-confirm';
export const WHATSAPP_DELETE_TEMPLATE_ERROR_TESTID = 'whatsapp-delete-template-error';

export const WHATSAPP_DELETE_TEMPLATE_TEXTS = {
  title: 'Eliminar la plantilla',
  descriptionStart: 'Se va a eliminar ',
  descriptionEnd: '. Esta acción no se puede deshacer.',
  dismiss: 'Volver',
} as const;

export type WhatsappTemplateDeleteDialogProps = {
  /** Con valor, el diálogo está abierto para esa plantilla. */
  readonly template: WhatsappTemplateView | null;
  readonly onClose: () => void;
  readonly onDeleted: (template: WhatsappTemplateView) => void;
};

export function WhatsappTemplateDeleteDialog({ template, onClose, onDeleted }: WhatsappTemplateDeleteDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorState | null>(null);
  // Se conserva la última para que el texto no se vacíe mientras el diálogo se cierra.
  const [shown, setShown] = useState<WhatsappTemplateView | null>(template);
  if (template !== null && template !== shown) {
    setShown(template);
    setError(null);
  }

  function confirm() {
    if (shown === null) return;
    const target = shown;
    startTransition(async () => {
      const result = await deleteWhatsappTemplateAction(target.id);
      if (result.status === 'error') {
        setError(result);
        return;
      }
      setError(null);
      onDeleted(target);
    });
  }

  return (
    <DeleteConfirmDialog
      open={template !== null}
      onOpenChange={(next) => {
        if (!next && !isPending) onClose();
      }}
      texts={{
        title: WHATSAPP_DELETE_TEMPLATE_TEXTS.title,
        description: (
          <>
            {WHATSAPP_DELETE_TEMPLATE_TEXTS.descriptionStart}
            <span className="font-mono">{shown?.name}</span>
            {WHATSAPP_DELETE_TEMPLATE_TEXTS.descriptionEnd}
          </>
        ),
        dismiss: WHATSAPP_DELETE_TEMPLATE_TEXTS.dismiss,
      }}
      testIds={{
        dialog: WHATSAPP_DELETE_TEMPLATE_DIALOG_TESTID,
        message: WHATSAPP_DELETE_TEMPLATE_MESSAGE_TESTID,
        dismiss: WHATSAPP_DELETE_TEMPLATE_DISMISS_TESTID,
        confirm: WHATSAPP_DELETE_TEMPLATE_CONFIRM_TESTID,
        error: WHATSAPP_DELETE_TEMPLATE_ERROR_TESTID,
      }}
      icon={{ glyph: Trash2Icon, tone: 'danger' }}
      submit={{ kind: 'transition', onConfirm: confirm }}
      isPending={isPending}
      dismissDisabled={isPending}
      error={error ?? undefined}
      errorStyle="inline"
    />
  );
}
