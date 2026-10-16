'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useId } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Notice } from '@/components/shared/notice';
import type { AdministratorRow } from '@/lib/modules/identity';
import {
  deleteAdministratorAction,
  type AdministratorMutationFormState,
} from '@/lib/modules/identity/adapters/driving/administrator-actions';

import { ADMINISTRATOR_DELETE_TEXTS, administratorDisplayName } from './administrator-labels';

export const ADMINISTRATOR_DELETE_DIALOG_TESTID = 'administrator-delete-dialog';
export const ADMINISTRATOR_DELETE_MESSAGE_TESTID = 'administrator-delete-message';
export const ADMINISTRATOR_DELETE_CONFIRM_TESTID = 'administrator-delete-confirm';
export const ADMINISTRATOR_DELETE_DISMISS_TESTID = 'administrator-delete-dismiss';
export const ADMINISTRATOR_DELETE_FORM_TESTID = 'administrator-delete-form';
export const ADMINISTRATOR_DELETE_ERROR_TESTID = 'administrator-delete-error';
export const ADMINISTRATOR_DELETE_LAST_TESTID = 'administrator-delete-last';

const INITIAL_STATE: AdministratorMutationFormState = { status: 'idle' };

export type AdministratorDeleteDialogProps = {
  readonly administrator: Pick<
    AdministratorRow,
    'id' | 'firstNames' | 'lastNames' | 'company' | 'isLastAdministrator'
  >;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

export function AdministratorDeleteDialog({
  administrator,
  open,
  onOpenChange,
}: AdministratorDeleteDialogProps) {
  const baseId = useId();
  const errorId = `${baseId}-error`;
  const lastId = `${baseId}-last`;
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(deleteAdministratorAction, INITIAL_STATE);

  useEffect(() => {
    if (state.status !== 'success') return;
    onOpenChange(false);
    toast.success(ADMINISTRATOR_DELETE_TEXTS.success);
    router.refresh();
  }, [state, onOpenChange, router]);

  const name = administratorDisplayName(administrator);
  const company = administrator.company.name;
  const error = state.status === 'error' ? state : undefined;
  const isLast = administrator.isLastAdministrator;
  const describedBy = [isLast ? lastId : undefined, error === undefined ? undefined : errorId]
    .filter((id) => id !== undefined)
    .join(' ');

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      variant="destructive"
      texts={{
        title: ADMINISTRATOR_DELETE_TEXTS.title(name),
        description: ADMINISTRATOR_DELETE_TEXTS.description(name, company),
        dismiss: ADMINISTRATOR_DELETE_TEXTS.dismiss,
        confirm: ADMINISTRATOR_DELETE_TEXTS.confirm,
      }}
      testIds={{
        dialog: ADMINISTRATOR_DELETE_DIALOG_TESTID,
        message: ADMINISTRATOR_DELETE_MESSAGE_TESTID,
        dismiss: ADMINISTRATOR_DELETE_DISMISS_TESTID,
        confirm: ADMINISTRATOR_DELETE_CONFIRM_TESTID,
        form: ADMINISTRATOR_DELETE_FORM_TESTID,
        error: ADMINISTRATOR_DELETE_ERROR_TESTID,
      }}
      submit={{
        kind: 'action',
        action: formAction,
        hidden: [{ name: 'id', value: administrator.id }],
      }}
      isPending={isPending}
      confirmDisabled={isLast}
      confirmDescribedBy={describedBy === '' ? undefined : describedBy}
      error={error}
      errorId={errorId}
      aside={
        isLast ? (
          <Notice
            tone="warning"
            id={lastId}
            title={ADMINISTRATOR_DELETE_TEXTS.lastTitle(company)}
            testId={ADMINISTRATOR_DELETE_LAST_TESTID}
          >
            {ADMINISTRATOR_DELETE_TEXTS.lastMessage}
          </Notice>
        ) : null
      }
    />
  );
}
