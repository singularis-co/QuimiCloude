'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useId } from 'react';
import { toast } from 'sonner';

import {
  ADMINISTRATOR_FIELD_NAMES,
  AdministratorFields,
  administratorFieldName,
  type AdministratorFieldName,
} from '@/components/shared/administrator-fields';
import { ErrorAlert } from '@/components/shared/error-alert';
import { FormSheet } from '@/components/shared/form-sheet';
import { Notice } from '@/components/shared/notice';
import { nextUsernameCandidate } from '@/components/shared/username-from-names';
import { Sheet } from '@/components/ui/sheet';
import { useEntitySheet } from '@/hooks/use-entity-sheet';
import type { ErrorCode, ErrorState } from '@/lib/modules/errores';
import { createCompanyAction } from '@/lib/modules/identity/adapters/driving/company-actions';

import { COMPANY_DATA_FIELDS, CompanyDataFields, type CompanyDataField } from './company-data-fields';
import {
  COMPANY_ADMIN_SECTION_LABEL,
  COMPANY_CREATE_TEXTS,
  COMPANY_DATA_SECTION_LABEL,
  COMPANY_MAIL_NOTICE,
} from './company-labels';

export const COMPANY_CREATE_SHEET_TESTID = 'company-create-sheet';
export const COMPANY_CREATE_FORM_TESTID = 'company-create-form';
export const COMPANY_CREATE_CANCEL_TESTID = 'company-create-cancel';
export const COMPANY_CREATE_SUBMIT_TESTID = 'company-create-submit';
export const COMPANY_CREATE_ERROR_TESTID = 'company-create-error';
export const COMPANY_CREATE_FIELD_PREFIX = 'company-create';
export const COMPANY_CREATE_ADMIN_PREFIX = 'company-create-admin';

const ADMIN_PREFIX = 'admin';

type CreateFieldName = CompanyDataField | `admin${Capitalize<AdministratorFieldName>}`;

export const COMPANY_CREATE_FIELD_NAMES: readonly string[] = [
  ...COMPANY_DATA_FIELDS,
  ...ADMINISTRATOR_FIELD_NAMES.map((field) => administratorFieldName(field, ADMIN_PREFIX)),
];

const CODE_TO_FIELD: Partial<Record<ErrorCode, CreateFieldName>> = {
  company_duplicate_name: 'name',
  company_duplicate_tax_id: 'taxId',
  duplicate_username: 'adminUsername',
  duplicate_email: 'adminEmail',
  duplicate_document: 'adminDocumentNumber',
};

type Values = Readonly<Record<string, string>>;

type CreateState =
  | { readonly status: 'idle' }
  | { readonly status: 'success'; readonly mail: 'sent' | 'failed' }
  | {
      readonly status: 'error';
      readonly error: ErrorState;
      readonly field: CreateFieldName | undefined;
      readonly values: Values;
    };

const INITIAL_STATE: CreateState = { status: 'idle' };
const IDLE_ACTION_STATE = { status: 'idle' } as const;

function readValues(formData: FormData): Values {
  return Object.fromEntries(
    COMPANY_CREATE_FIELD_NAMES.map((name) => {
      const value = formData.get(name);
      return [name, typeof value === 'string' ? value : ''];
    }),
  );
}

async function save(_previous: CreateState, formData: FormData): Promise<CreateState> {
  const values = readValues(formData);
  const result = await createCompanyAction(IDLE_ACTION_STATE, formData);
  if (result.status === 'success') return { status: 'success', mail: result.mail };
  if (result.status === 'error') {
    return { status: 'error', error: result, field: CODE_TO_FIELD[result.code], values };
  }
  return INITIAL_STATE;
}

// Sin las claves vacías: un `''` taparía el valor de partida de `AdministratorFields` (el tipo de
// documento arrancaría sin elegir y el alta llegaría sin él).
function adminValues(values: Values): Partial<Record<AdministratorFieldName, string>> {
  return Object.fromEntries(
    ADMINISTRATOR_FIELD_NAMES.flatMap((field) => {
      const value = values[administratorFieldName(field, ADMIN_PREFIX)] ?? '';
      return value === '' ? [] : [[field, value]];
    }),
  );
}

function adminErrors(
  field: CreateFieldName | undefined,
  message: string,
): Partial<Record<AdministratorFieldName, string>> {
  const match = ADMINISTRATOR_FIELD_NAMES.find(
    (candidate) => administratorFieldName(candidate, ADMIN_PREFIX) === field,
  );
  return match === undefined ? {} : { [match]: message };
}

export type CompanyCreateSheetProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

export function CompanyCreateSheet({ open, onOpenChange }: CompanyCreateSheetProps) {
  const errorId = useId();
  const router = useRouter();
  const [state, formAction] = useActionState(save, INITIAL_STATE);
  const { changeOpen, handleSaved } = useEntitySheet({
    open,
    onOpenChange,
    successMessage: COMPANY_CREATE_TEXTS.success,
  });

  useEffect(() => {
    if (state.status !== 'success') return;
    if (state.mail === 'sent') {
      handleSaved();
      return;
    }
    changeOpen(false);
    toast.warning(COMPANY_CREATE_TEXTS.mailFailed);
    router.refresh();
  }, [state, handleSaved, changeOpen, router]);

  const values = state.status === 'error' ? state.values : {};
  const field = state.status === 'error' ? state.field : undefined;
  const message = state.status === 'error' ? state.error.message : '';
  const formError = state.status === 'error' && field === undefined ? state.error : undefined;
  const usernameSuggestion =
    state.status === 'error' && state.error.code === 'duplicate_username'
      ? nextUsernameCandidate(values.adminUsername ?? '')
      : undefined;

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <FormSheet
        title={COMPANY_CREATE_TEXTS.title}
        description={COMPANY_CREATE_TEXTS.description}
        formAction={formAction}
        saveLabel={COMPANY_CREATE_TEXTS.submit}
        className="w-full pb-[env(safe-area-inset-bottom)] data-[side=right]:w-full sm:max-w-[600px]"
        testIds={{
          sheet: COMPANY_CREATE_SHEET_TESTID,
          form: COMPANY_CREATE_FORM_TESTID,
          cancel: COMPANY_CREATE_CANCEL_TESTID,
          submit: COMPANY_CREATE_SUBMIT_TESTID,
        }}
      >
        {formError === undefined ? null : (
          <ErrorAlert
            error={formError}
            id={errorId}
            className="flex flex-col gap-2 rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
            testId={COMPANY_CREATE_ERROR_TESTID}
            withDataCode
          />
        )}

        <section aria-labelledby={`${errorId}-company`} className="flex flex-col gap-4">
          <h3 id={`${errorId}-company`} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {COMPANY_DATA_SECTION_LABEL}
          </h3>
          <CompanyDataFields
            testIdPrefix={COMPANY_CREATE_FIELD_PREFIX}
            defaultValues={values}
            errors={field === undefined ? {} : { [field]: message }}
          />
        </section>

        <section
          aria-labelledby={`${errorId}-admin`}
          className="flex flex-col gap-4 border-t border-border pt-4"
        >
          <h3 id={`${errorId}-admin`} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {COMPANY_ADMIN_SECTION_LABEL}
          </h3>
          <AdministratorFields
            namePrefix={ADMIN_PREFIX}
            testIdPrefix={COMPANY_CREATE_ADMIN_PREFIX}
            defaultValues={adminValues(values)}
            errors={adminErrors(field, message)}
            usernameAutofill
            usernameSuggestion={usernameSuggestion}
          />
          <Notice tone="info" testId="company-create-mail-notice">
            {COMPANY_MAIL_NOTICE}
          </Notice>
        </section>
      </FormSheet>
    </Sheet>
  );
}
