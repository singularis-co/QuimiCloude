'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useId, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import {
  ADMINISTRATOR_FIELD_NAMES,
  AdministratorFields,
  type AdministratorFieldName,
} from '@/components/shared/administrator-fields';
import { ErrorAlert } from '@/components/shared/error-alert';
import { FormSheet } from '@/components/shared/form-sheet';
import { Notice } from '@/components/shared/notice';
import { SelectField } from '@/components/shared/select-field';
import { StatusBadge } from '@/components/shared/status-badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useEntitySheet } from '@/hooks/use-entity-sheet';
import type { ErrorCode, ErrorState } from '@/lib/modules/errores';
import { ROLE_ADMINISTRADOR, type AdministratorDetail } from '@/lib/modules/identity';
import {
  createAdministratorAction,
  getAdministratorAction,
  updateAdministratorAction,
} from '@/lib/modules/identity/adapters/driving/administrator-actions';
import { formatCivilDate } from '@/lib/shared/ui/date-civil';

import {
  ADMINISTRATOR_COMPANY_FIELD_LABEL,
  ADMINISTRATOR_COMPANY_HINT,
  ADMINISTRATOR_COMPANY_PLACEHOLDER,
  ADMINISTRATOR_CREATE_TEXTS,
  ADMINISTRATOR_EDIT_TEXTS,
  ADMINISTRATOR_MAIL_NOTICE,
  ADMINISTRATOR_ROLE_LABEL,
} from './administrator-labels';
import type { ActiveCompany } from './load-active-companies';

export const ADMINISTRATOR_SHEET_TESTID = 'administrator-sheet';
export const ADMINISTRATOR_FORM_TESTID = 'administrator-form';
export const ADMINISTRATOR_CANCEL_TESTID = 'administrator-cancel';
export const ADMINISTRATOR_SUBMIT_TESTID = 'administrator-submit';
export const ADMINISTRATOR_SHEET_ERROR_TESTID = 'administrator-sheet-error';
export const ADMINISTRATOR_SHEET_LOADING_TESTID = 'administrator-sheet-loading';
export const ADMINISTRATOR_COMPANY_SELECT_TESTID = 'administrator-company';
export const ADMINISTRATOR_COMPANY_FIXED_TESTID = 'administrator-company-fixed';
export const ADMINISTRATOR_ROLE_TESTID = 'administrator-role';
export const ADMINISTRATOR_MAIL_NOTICE_TESTID = 'administrator-mail-notice';
export const ADMINISTRATOR_FIELD_PREFIX = 'administrator';

const COMPANY_FIELD = 'companyId';
const ID_FIELD = 'id';

const SHEET_CLASS =
  'w-full pb-[env(safe-area-inset-bottom)] data-[side=right]:w-full sm:max-w-[600px]';
const ERROR_REGION_CLASS =
  'flex flex-col gap-2 rounded-lg border border-destructive/40 p-3 text-sm text-destructive';

const CODE_TO_FIELD: Partial<Record<ErrorCode, AdministratorFieldName>> = {
  duplicate_username: 'username',
  duplicate_email: 'email',
  duplicate_document: 'documentNumber',
};

type PersonValues = Partial<Record<AdministratorFieldName, string>>;

type Rejected = {
  readonly status: 'error';
  readonly error: ErrorState;
  readonly field: AdministratorFieldName | undefined;
  readonly values: PersonValues;
  readonly companyId: string;
};

// Sin las claves vacías: un `''` taparía el valor de partida de `AdministratorFields` (el tipo de
// documento arrancaría sin elegir y el envío llegaría sin él).
function readPersonValues(formData: FormData): PersonValues {
  return Object.fromEntries(
    ADMINISTRATOR_FIELD_NAMES.flatMap((field) => {
      const value = formData.get(field);
      return typeof value === 'string' && value !== '' ? [[field, value]] : [];
    }),
  );
}

function rejected(error: ErrorState, formData: FormData): Rejected {
  const companyId = formData.get(COMPANY_FIELD);
  return {
    status: 'error',
    error,
    field: CODE_TO_FIELD[error.code],
    values: readPersonValues(formData),
    companyId: typeof companyId === 'string' ? companyId : '',
  };
}

function personErrors(state: Rejected | undefined): PersonValues {
  if (state?.field === undefined) return {};
  return { [state.field]: state.error.message };
}

function SheetErrorRegion({ state }: { readonly state: Rejected | undefined }) {
  if (state === undefined || state.field !== undefined) return null;
  return (
    <ErrorAlert
      error={state.error}
      className={ERROR_REGION_CLASS}
      testId={ADMINISTRATOR_SHEET_ERROR_TESTID}
      withDataCode
    />
  );
}

function FixedField({
  label,
  testId,
  children,
}: {
  readonly label: string;
  readonly testId: string;
  readonly children: ReactNode;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="text-sm font-medium">
        {label}
      </span>
      <div className="text-sm" data-testid={testId}>
        {children}
      </div>
    </div>
  );
}

function RoleField() {
  return (
    <FixedField label={ADMINISTRATOR_ROLE_LABEL} testId={ADMINISTRATOR_ROLE_TESTID}>
      <StatusBadge tone="neutral" label={ROLE_ADMINISTRADOR} />
    </FixedField>
  );
}

const TEST_IDS = {
  sheet: ADMINISTRATOR_SHEET_TESTID,
  form: ADMINISTRATOR_FORM_TESTID,
  cancel: ADMINISTRATOR_CANCEL_TESTID,
  submit: ADMINISTRATOR_SUBMIT_TESTID,
} as const;

const IDLE_ACTION_STATE = { status: 'idle' } as const;

type CreateState =
  | { readonly status: 'idle' }
  | { readonly status: 'success'; readonly mail: 'sent' | 'failed' }
  | Rejected;

async function create(_previous: CreateState, formData: FormData): Promise<CreateState> {
  const result = await createAdministratorAction(IDLE_ACTION_STATE, formData);
  if (result.status === 'success') return { status: 'success', mail: result.mail };
  if (result.status === 'error') return rejected(result, formData);
  return { status: 'idle' };
}

type CreateSheetProps = {
  readonly companies: readonly ActiveCompany[];
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

function AdministratorCreateSheet({ companies, open, onOpenChange }: CreateSheetProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(create, { status: 'idle' });
  const { changeOpen, handleSaved } = useEntitySheet({
    open,
    onOpenChange,
    successMessage: ADMINISTRATOR_CREATE_TEXTS.success,
  });

  useEffect(() => {
    if (state.status !== 'success') return;
    if (state.mail === 'sent') {
      handleSaved();
      return;
    }
    changeOpen(false);
    toast.warning(ADMINISTRATOR_CREATE_TEXTS.mailFailed);
    router.refresh();
  }, [state, handleSaved, changeOpen, router]);

  const failed = state.status === 'error' ? state : undefined;

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <FormSheet
        title={ADMINISTRATOR_CREATE_TEXTS.title}
        description={ADMINISTRATOR_CREATE_TEXTS.description}
        formAction={formAction}
        saveLabel={ADMINISTRATOR_CREATE_TEXTS.submit}
        className={SHEET_CLASS}
        testIds={TEST_IDS}
      >
        <SheetErrorRegion state={failed} />
        <div className="flex flex-col gap-2">
          <SelectField
            name={COMPANY_FIELD}
            label={
              <>
                {ADMINISTRATOR_COMPANY_FIELD_LABEL}
                <span aria-hidden="true" className="ml-0.5 text-destructive">
                  *
                </span>
              </>
            }
            noneOption={{ value: '', label: ADMINISTRATOR_COMPANY_PLACEHOLDER }}
            options={companies.map((company) => ({ value: company.id, label: company.name }))}
            defaultValue={failed?.companyId ?? ''}
            remountOnDefault
            triggerTestId={ADMINISTRATOR_COMPANY_SELECT_TESTID}
          />
          <p className="text-sm text-muted-foreground">{ADMINISTRATOR_COMPANY_HINT}</p>
        </div>
        <AdministratorFields
          testIdPrefix={ADMINISTRATOR_FIELD_PREFIX}
          defaultValues={failed?.values ?? {}}
          errors={personErrors(failed)}
        />
        <RoleField />
        <Notice tone="info" testId={ADMINISTRATOR_MAIL_NOTICE_TESTID}>
          {ADMINISTRATOR_MAIL_NOTICE}
        </Notice>
      </FormSheet>
    </Sheet>
  );
}

type EditState = { readonly status: 'idle' } | { readonly status: 'success' } | Rejected;

async function update(_previous: EditState, formData: FormData): Promise<EditState> {
  const result = await updateAdministratorAction(IDLE_ACTION_STATE, formData);
  if (result.status === 'success') return { status: 'success' };
  if (result.status === 'error') return rejected(result, formData);
  return { status: 'idle' };
}

function detailValues(detail: AdministratorDetail): PersonValues {
  return {
    firstNames: detail.firstNames,
    lastNames: detail.lastNames,
    birthDate: formatCivilDate(detail.birthDate),
    email: detail.email,
    phone: detail.phone,
    documentTypeCode: detail.documentTypeCode,
    documentNumber: detail.documentNumber,
    username: detail.username,
  };
}

type EditFormProps = {
  readonly detail: AdministratorDetail;
  readonly onSaved: () => void;
};

function AdministratorEditForm({ detail, onSaved }: EditFormProps) {
  const [state, formAction] = useActionState(update, { status: 'idle' });

  useEffect(() => {
    if (state.status === 'success') onSaved();
  }, [state, onSaved]);

  const failed = state.status === 'error' ? state : undefined;

  return (
    <FormSheet
      title={ADMINISTRATOR_EDIT_TEXTS.title}
      description={ADMINISTRATOR_EDIT_TEXTS.description}
      formAction={formAction}
      saveLabel={ADMINISTRATOR_EDIT_TEXTS.submit}
      className={SHEET_CLASS}
      testIds={TEST_IDS}
    >
      <SheetErrorRegion state={failed} />
      {/* Sin `companyId`: la edición no lo acepta y la empresa no se puede cambiar. */}
      <input type="hidden" name={ID_FIELD} value={detail.id} />
      <FixedField
        label={ADMINISTRATOR_COMPANY_FIELD_LABEL}
        testId={ADMINISTRATOR_COMPANY_FIXED_TESTID}
      >
        {detail.company.name}
      </FixedField>
      <AdministratorFields
        testIdPrefix={ADMINISTRATOR_FIELD_PREFIX}
        defaultValues={failed?.values ?? detailValues(detail)}
        errors={personErrors(failed)}
      />
      <RoleField />
    </FormSheet>
  );
}

type DetailState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly detail: AdministratorDetail }
  | { readonly status: 'error'; readonly error: ErrorState };

type EditSheetProps = {
  readonly administratorId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

function AdministratorEditSheet({ administratorId, open, onOpenChange }: EditSheetProps) {
  const [loaded, setLoaded] = useState<DetailState>({ status: 'loading' });
  const { changeOpen, handleSaved } = useEntitySheet({
    open,
    onOpenChange,
    successMessage: ADMINISTRATOR_EDIT_TEXTS.success,
  });

  // La fila no trae teléfono, documento ni fecha de nacimiento.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getAdministratorAction(administratorId).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.status === 'error'
          ? { status: 'error', error: result }
          : { status: 'ready', detail: result.data },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [open, administratorId]);

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      {loaded.status === 'ready' ? (
        <AdministratorEditForm detail={loaded.detail} onSaved={handleSaved} />
      ) : (
        <SheetContent side="right" className={SHEET_CLASS} data-testid={ADMINISTRATOR_SHEET_TESTID}>
          <SheetHeader>
            <SheetTitle>{ADMINISTRATOR_EDIT_TEXTS.title}</SheetTitle>
            <SheetDescription>{ADMINISTRATOR_EDIT_TEXTS.loading}</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {loaded.status === 'loading' ? (
              <div
                className="flex flex-col gap-3"
                role="status"
                aria-busy="true"
                aria-label={ADMINISTRATOR_EDIT_TEXTS.loading}
                data-testid={ADMINISTRATOR_SHEET_LOADING_TESTID}
              >
                {Array.from({ length: 6 }, (_, index) => (
                  <Skeleton key={index} className="h-11 w-full" />
                ))}
              </div>
            ) : (
              <ErrorAlert
                error={loaded.error}
                className={ERROR_REGION_CLASS}
                testId={ADMINISTRATOR_SHEET_ERROR_TESTID}
                withDataCode
              />
            )}
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}

export type AdministratorSheetProps =
  | ({ readonly mode: 'create' } & CreateSheetProps)
  | ({ readonly mode: 'edit' } & EditSheetProps);

/** Alta o edición de un Administrador. Se monta abierta: cada apertura empieza limpia. */
export function AdministratorSheet(props: AdministratorSheetProps) {
  if (props.mode === 'create') {
    return (
      <AdministratorCreateSheet
        companies={props.companies}
        open={props.open}
        onOpenChange={props.onOpenChange}
      />
    );
  }
  return (
    <AdministratorEditSheet
      administratorId={props.administratorId}
      open={props.open}
      onOpenChange={props.onOpenChange}
    />
  );
}
