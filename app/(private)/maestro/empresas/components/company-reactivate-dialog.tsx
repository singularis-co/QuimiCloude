'use client';

import { RotateCcwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useId } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ErrorAlert } from '@/components/shared/error-alert';
import { Notice } from '@/components/shared/notice';
import {
  reactivateCompanyAction,
  type CompanyMutationFormState,
} from '@/lib/modules/identity/adapters/driving/company-actions';

import { COMPANY_REACTIVATE_TEXTS } from './company-labels';

export const COMPANY_REACTIVATE_DIALOG_TESTID = 'company-reactivate-dialog';
export const COMPANY_REACTIVATE_ICON_TESTID = 'company-reactivate-icon';
export const COMPANY_REACTIVATE_MESSAGE_TESTID = 'company-reactivate-message';
export const COMPANY_REACTIVATE_CONFIRM_TESTID = 'company-reactivate-confirm';
export const COMPANY_REACTIVATE_DISMISS_TESTID = 'company-reactivate-dismiss';
export const COMPANY_REACTIVATE_FORM_TESTID = 'company-reactivate-form';
export const COMPANY_REACTIVATE_ERROR_TESTID = 'company-reactivate-error';

const INITIAL_STATE: CompanyMutationFormState = { status: 'idle' };

export type CompanyReactivateDialogProps = {
  readonly company: { readonly id: string; readonly name: string };
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

export function CompanyReactivateDialog({ company, open, onOpenChange }: CompanyReactivateDialogProps) {
  const errorId = useId();
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(reactivateCompanyAction, INITIAL_STATE);

  useEffect(() => {
    if (state.status !== 'success') return;
    onOpenChange(false);
    toast.success(COMPANY_REACTIVATE_TEXTS.success);
    router.refresh();
  }, [state, onOpenChange, router]);

  const error = state.status === 'error' ? state : undefined;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={{ glyph: RotateCcwIcon, tone: 'info', testId: COMPANY_REACTIVATE_ICON_TESTID }}
      texts={{
        title: COMPANY_REACTIVATE_TEXTS.title(company.name),
        description: COMPANY_REACTIVATE_TEXTS.description,
        dismiss: COMPANY_REACTIVATE_TEXTS.dismiss,
        confirm: COMPANY_REACTIVATE_TEXTS.confirm,
      }}
      testIds={{
        dialog: COMPANY_REACTIVATE_DIALOG_TESTID,
        message: COMPANY_REACTIVATE_MESSAGE_TESTID,
        dismiss: COMPANY_REACTIVATE_DISMISS_TESTID,
        confirm: COMPANY_REACTIVATE_CONFIRM_TESTID,
        form: COMPANY_REACTIVATE_FORM_TESTID,
      }}
      submit={{
        kind: 'action',
        action: formAction,
        hidden: [{ name: 'companyId', value: company.id }],
      }}
      isPending={isPending}
      confirmDescribedBy={error === undefined ? undefined : errorId}
      aside={
        error === undefined ? null : (
          <Notice tone="danger" id={errorId} testId={COMPANY_REACTIVATE_ERROR_TESTID}>
            {/* Sin rol propio: el aviso ya es la región que lo anuncia. */}
            <ErrorAlert error={error} role={null} cataloguedAs="p" />

          </Notice>
        )
      }
    />
  );
}
