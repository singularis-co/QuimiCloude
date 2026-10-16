'use client';

import { useActionState, useEffect, useId } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import type { AdministratorRow } from '@/lib/modules/identity';
import {
  resendAdministratorLinkAction,
  type ResendAdministratorLinkFormState,
} from '@/lib/modules/identity/adapters/driving/administrator-actions';

import { ADMINISTRATOR_RESEND_TEXTS, administratorDisplayName } from './administrator-labels';

export const ADMINISTRATOR_RESEND_DIALOG_TESTID = 'administrator-resend-dialog';
export const ADMINISTRATOR_RESEND_MESSAGE_TESTID = 'administrator-resend-message';
export const ADMINISTRATOR_RESEND_CONFIRM_TESTID = 'administrator-resend-confirm';
export const ADMINISTRATOR_RESEND_DISMISS_TESTID = 'administrator-resend-dismiss';
export const ADMINISTRATOR_RESEND_FORM_TESTID = 'administrator-resend-form';
export const ADMINISTRATOR_RESEND_ERROR_TESTID = 'administrator-resend-error';

const INITIAL_STATE: ResendAdministratorLinkFormState = { status: 'idle' };

export type AdministratorResendLinkDialogProps = {
  readonly administrator: Pick<AdministratorRow, 'id' | 'firstNames' | 'lastNames' | 'email'>;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

// Sin `router.refresh()`: reenviar el enlace no cambia nada de la fila.
export function AdministratorResendLinkDialog({
  administrator,
  open,
  onOpenChange,
}: AdministratorResendLinkDialogProps) {
  const errorId = useId();
  const [state, formAction, isPending] = useActionState(
    resendAdministratorLinkAction,
    INITIAL_STATE,
  );
  const name = administratorDisplayName(administrator);

  useEffect(() => {
    if (state.status !== 'success') return;
    onOpenChange(false);
    if (state.mail === 'sent') toast.success(ADMINISTRATOR_RESEND_TEXTS.sent(name));
    else toast.warning(ADMINISTRATOR_RESEND_TEXTS.mailFailed(name));
  }, [state, onOpenChange, name]);

  const error = state.status === 'error' ? state : undefined;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      texts={{
        title: ADMINISTRATOR_RESEND_TEXTS.title(name),
        description: (
          <>
            {ADMINISTRATOR_RESEND_TEXTS.descriptionBefore}
            <strong className="font-semibold text-foreground">{administrator.email}</strong>
            {ADMINISTRATOR_RESEND_TEXTS.descriptionAfter}
          </>
        ),
        dismiss: ADMINISTRATOR_RESEND_TEXTS.dismiss,
        confirm: ADMINISTRATOR_RESEND_TEXTS.confirm,
        pending: ADMINISTRATOR_RESEND_TEXTS.pending,
      }}
      testIds={{
        dialog: ADMINISTRATOR_RESEND_DIALOG_TESTID,
        message: ADMINISTRATOR_RESEND_MESSAGE_TESTID,
        dismiss: ADMINISTRATOR_RESEND_DISMISS_TESTID,
        confirm: ADMINISTRATOR_RESEND_CONFIRM_TESTID,
        form: ADMINISTRATOR_RESEND_FORM_TESTID,
        error: ADMINISTRATOR_RESEND_ERROR_TESTID,
      }}
      submit={{
        kind: 'action',
        action: formAction,
        hidden: [{ name: 'id', value: administrator.id }],
      }}
      isPending={isPending}
      confirmDescribedBy={error === undefined ? undefined : errorId}
      error={error}
      errorId={errorId}
    />
  );
}
