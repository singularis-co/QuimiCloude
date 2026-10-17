'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ErrorAlert } from '@/components/shared/error-alert';
import { Spinner } from '@/components/shared/spinner';
import { TextField } from '@/components/shared/text-field';
import type { ErrorState } from '@/lib/modules/errores';
import type { CompanyDeletionImpact } from '@/lib/modules/identity';
import {
  deleteCompanyAction,
  getCompanyDeletionImpactAction,
  type CompanyMutationFormState,
} from '@/lib/modules/identity/adapters/driving/company-actions';

import { COMPANY_DELETE_TEXTS } from './company-labels';

export const COMPANY_DELETE_DIALOG_TESTID = 'company-delete-dialog';
export const COMPANY_DELETE_MESSAGE_TESTID = 'company-delete-message';
export const COMPANY_DELETE_CONFIRM_TESTID = 'company-delete-confirm';
export const COMPANY_DELETE_DISMISS_TESTID = 'company-delete-dismiss';
export const COMPANY_DELETE_FORM_TESTID = 'company-delete-form';
export const COMPANY_DELETE_ERROR_TESTID = 'company-delete-error';
export const COMPANY_DELETE_IMPACT_LOADING_TESTID = 'company-delete-impact-loading';
export const COMPANY_DELETE_IMPACT_TESTID = 'company-delete-impact';
export const COMPANY_DELETE_IMPACT_ERROR_TESTID = 'company-delete-impact-error';
export const COMPANY_DELETE_CONFIRMATION_TESTID = 'company-delete-confirmation';
export const COMPANY_DELETE_CONFIRMATION_ERROR_TESTID = 'company-delete-confirmation-error';

const INITIAL_STATE: CompanyMutationFormState = { status: 'idle' };

type ImpactState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly impact: CompanyDeletionImpact }
  | { readonly status: 'error'; readonly error: ErrorState };

const ERROR_REGION_CLASS = 'rounded-lg border border-destructive/40 p-3 text-sm text-destructive';

function ImpactBlock({ state }: { readonly state: ImpactState }) {
  if (state.status === 'loading') {
    return (
      <p
        role="status"
        className="flex items-center gap-2 text-sm text-muted-foreground"
        data-testid={COMPANY_DELETE_IMPACT_LOADING_TESTID}
      >
        <Spinner />
        {COMPANY_DELETE_TEXTS.loadingImpact}
      </p>
    );
  }

  if (state.status === 'error') {
    return (
      <ErrorAlert
        error={state.error}
        className={ERROR_REGION_CLASS}
        testId={COMPANY_DELETE_IMPACT_ERROR_TESTID}
        withDataCode
      />
    );
  }

  const stats = [
    { key: 'liveUsers', label: COMPANY_DELETE_TEXTS.liveUsers, value: state.impact.liveUsers },
    { key: 'openOrders', label: COMPANY_DELETE_TEXTS.openOrders, value: state.impact.openOrders },
  ] as const;

  return (
    <dl className="m-0 grid grid-cols-2 gap-2.5" data-testid={COMPANY_DELETE_IMPACT_TESTID}>
      {stats.map((stat) => (
        <div key={stat.key} className="flex flex-col gap-1 rounded-lg border border-border p-3">
          <dt className="text-xs text-muted-foreground">{stat.label}</dt>
          <dd className="m-0 font-mono text-lg font-semibold tabular-nums" data-testid={`company-delete-${stat.key}`}>
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export type CompanyDeleteDialogProps = {
  readonly company: { readonly id: string; readonly name: string };
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

export function CompanyDeleteDialog({ company, open, onOpenChange }: CompanyDeleteDialogProps) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(deleteCompanyAction, INITIAL_STATE);
  const [impact, setImpact] = useState<ImpactState>({ status: 'loading' });
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getCompanyDeletionImpactAction(company.id).then((result) => {
      if (cancelled) return;
      setImpact(
        result.status === 'error'
          ? { status: 'error', error: result }
          : { status: 'ready', impact: result.data },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [open, company.id]);

  useEffect(() => {
    if (state.status !== 'success') return;
    onOpenChange(false);
    toast.success(COMPANY_DELETE_TEXTS.success);
    router.refresh();
  }, [state, onOpenChange, router]);

  const error = state.status === 'error' ? state : undefined;
  const mismatch = error?.code === 'company_name_mismatch' ? error.message : undefined;
  const regionError = error !== undefined && mismatch === undefined ? error : undefined;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      variant="destructive"
      texts={{
        title: COMPANY_DELETE_TEXTS.title(company.name),
        description: COMPANY_DELETE_TEXTS.warning,
        dismiss: COMPANY_DELETE_TEXTS.dismiss,
        confirm: COMPANY_DELETE_TEXTS.confirm,
      }}
      testIds={{
        dialog: COMPANY_DELETE_DIALOG_TESTID,
        message: COMPANY_DELETE_MESSAGE_TESTID,
        dismiss: COMPANY_DELETE_DISMISS_TESTID,
        confirm: COMPANY_DELETE_CONFIRM_TESTID,
        form: COMPANY_DELETE_FORM_TESTID,
        error: COMPANY_DELETE_ERROR_TESTID,
      }}
      submit={{
        kind: 'action',
        action: formAction,
        hidden: [{ name: 'companyId', value: company.id }],
        formClassName: 'flex flex-col gap-4',
      }}
      layout="error-in-form"
      isPending={isPending}
      confirmDisabled={impact.status !== 'ready' || confirmation.trim() === ''}
      confirmDescribedBy={regionError === undefined ? undefined : errorId}
      error={regionError}
      errorId={errorId}
      aside={<ImpactBlock state={impact} />}
      descriptionPlacement="after-aside"
    >
      <TextField
        id={`${fieldId}-confirmation`}
        name="confirmationName"
        autoComplete="off"
        label={
          <span>
            {COMPANY_DELETE_TEXTS.confirmationPrefix}
            <strong className="font-semibold">{company.name}</strong>
            {COMPANY_DELETE_TEXTS.confirmationSuffix}
          </span>
        }
        value={confirmation}
        onValueChange={setConfirmation}
        testId={COMPANY_DELETE_CONFIRMATION_TESTID}
        error={mismatch}
        errorTestId={COMPANY_DELETE_CONFIRMATION_ERROR_TESTID}
      />
    </ConfirmDialog>
  );
}
