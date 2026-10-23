'use client';

import type { CountryCode } from 'libphonenumber-js';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useId, useState } from 'react';

import { listCountryOptions } from '@/components/shared/country-options';
import { CountrySelect } from '@/components/shared/country-select';
import { ErrorAlert } from '@/components/shared/error-alert';
import { FormSheet } from '@/components/shared/form-sheet';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useEntitySheet } from '@/hooks/use-entity-sheet';
import type { ErrorCode, ErrorState } from '@/lib/modules/errores';
import type { CompanyDetail } from '@/lib/modules/identity';
import {
  getCompanyAction,
  setCompanyCountryAction,
  updateCompanyAction,
} from '@/lib/modules/identity/adapters/driving/company-actions';

import { COMPANY_DATA_FIELDS, CompanyDataFields, type CompanyDataField } from './company-data-fields';
import { COMPANY_EDIT_TEXTS, COMPANY_FIELD_LABELS } from './company-labels';

export const COMPANY_EDIT_SHEET_TESTID = 'company-edit-sheet';
export const COMPANY_EDIT_FORM_TESTID = 'company-edit-form';
export const COMPANY_EDIT_CANCEL_TESTID = 'company-edit-cancel';
export const COMPANY_EDIT_SUBMIT_TESTID = 'company-edit-submit';
export const COMPANY_EDIT_ERROR_TESTID = 'company-edit-error';
export const COMPANY_EDIT_LOADING_TESTID = 'company-edit-loading';
export const COMPANY_EDIT_COUNTRY_TESTID = 'company-edit-country';
export const COMPANY_EDIT_COUNTRY_ERROR_TESTID = 'company-edit-country-error';
export const COMPANY_EDIT_FIELD_PREFIX = 'company-edit';

const SHEET_CLASS = 'w-full pb-[env(safe-area-inset-bottom)] data-[side=right]:w-full sm:max-w-md';
const ERROR_REGION_CLASS =
  'flex flex-col gap-2 rounded-lg border border-destructive/40 p-3 text-sm text-destructive';

const CODE_TO_FIELD: Partial<Record<ErrorCode, CompanyDataField>> = {
  company_duplicate_name: 'name',
  company_duplicate_tax_id: 'taxId',
};

type Values = Readonly<Record<string, string>>;

type EditState =
  | { readonly status: 'idle' }
  | { readonly status: 'success' }
  | {
      readonly status: 'error';
      readonly step: 'data' | 'country';
      readonly error: ErrorState;
      readonly values: Values;
    };

const INITIAL_STATE: EditState = { status: 'idle' };
const IDLE_ACTION_STATE = { status: 'idle' } as const;

function readValues(formData: FormData): Values {
  return Object.fromEntries(
    COMPANY_DATA_FIELDS.map((name) => {
      const value = formData.get(name);
      return [name, typeof value === 'string' ? value : ''];
    }),
  );
}

// El país va aparte porque la edición no lo acepta; solo se manda si los datos se guardaron.
async function save(_previous: EditState, formData: FormData): Promise<EditState> {
  const values = readValues(formData);
  const data = await updateCompanyAction(IDLE_ACTION_STATE, formData);
  if (data.status === 'error') return { status: 'error', step: 'data', error: data, values };

  const country = await setCompanyCountryAction(IDLE_ACTION_STATE, formData);
  if (country.status === 'error') return { status: 'error', step: 'country', error: country, values };

  return { status: 'success' };
}

function knownCountry(code: string | null): CountryCode | null {
  if (code === null) return null;
  return listCountryOptions().find((option) => option.code === code)?.code ?? null;
}

function valuesOf(detail: CompanyDetail): Values {
  return {
    name: detail.name,
    taxId: detail.taxId ?? '',
    contactEmail: detail.contactEmail ?? '',
    contactPhone: detail.contactPhone ?? '',
  };
}

type EditFormProps = {
  readonly detail: CompanyDetail;
  readonly onSaved: () => void;
};

function CompanyEditForm({ detail, onSaved }: EditFormProps) {
  const baseId = useId();
  const router = useRouter();
  const [state, formAction] = useActionState(save, INITIAL_STATE);
  const [country, setCountry] = useState<CountryCode | null>(() => knownCountry(detail.country));

  useEffect(() => {
    if (state.status === 'success') onSaved();
    // Los datos sí quedaron guardados: la lista tiene que enseñarlos aunque el país fallara.
    if (state.status === 'error' && state.step === 'country') router.refresh();
  }, [state, onSaved, router]);

  const failed = state.status === 'error' ? state : undefined;
  const field = failed?.step === 'data' ? CODE_TO_FIELD[failed.error.code] : undefined;
  const countryError = failed?.step === 'country' ? failed.error : undefined;
  const formError =
    failed?.step === 'data' && field === undefined ? failed.error : undefined;

  return (
    <FormSheet
      title={COMPANY_EDIT_TEXTS.title}
      description={COMPANY_EDIT_TEXTS.description(detail.name)}
      formAction={formAction}
      className={SHEET_CLASS}
      testIds={{
        sheet: COMPANY_EDIT_SHEET_TESTID,
        form: COMPANY_EDIT_FORM_TESTID,
        cancel: COMPANY_EDIT_CANCEL_TESTID,
        submit: COMPANY_EDIT_SUBMIT_TESTID,
      }}
    >
      {formError === undefined ? null : (
        <ErrorAlert
          error={formError}
          className={ERROR_REGION_CLASS}
          testId={COMPANY_EDIT_ERROR_TESTID}
          withDataCode
        />
      )}
      <input type="hidden" name="companyId" value={detail.id} />
      <CompanyDataFields
        testIdPrefix={COMPANY_EDIT_FIELD_PREFIX}
        defaultValues={failed?.values ?? valuesOf(detail)}
        errors={field === undefined || failed === undefined ? {} : { [field]: failed.error.message }}
      />
      <CountrySelect
        id={`${baseId}-country`}
        value={country}
        onChange={setCountry}
        label={COMPANY_FIELD_LABELS.country}
        error={countryError?.message}
        testId={COMPANY_EDIT_COUNTRY_TESTID}
      />
      {countryError === undefined ? null : (
        // El mensaje ya va junto a País; aquí solo sale la referencia de un error inesperado.
        <ErrorAlert
          error={countryError}
          role={null}
          className="text-sm"
          testId={COMPANY_EDIT_COUNTRY_ERROR_TESTID}
          renderCatalogued={() => null}
        />
      )}
      <input type="hidden" name="country" value={country ?? ''} />
    </FormSheet>
  );
}

type DetailState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly detail: CompanyDetail }
  | { readonly status: 'error'; readonly error: ErrorState };

export type CompanyEditSheetProps = {
  readonly companyId: string;
  /** Con la ficha ya leída (el detalle) no se vuelve a pedir; la fila de la lista no la trae. */
  readonly detail?: CompanyDetail;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

export function CompanyEditSheet({ companyId, detail, open, onOpenChange }: CompanyEditSheetProps) {
  const [loaded, setLoaded] = useState<DetailState>(
    detail === undefined ? { status: 'loading' } : { status: 'ready', detail },
  );
  const { changeOpen, handleSaved } = useEntitySheet({
    open,
    onOpenChange,
    successMessage: COMPANY_EDIT_TEXTS.success,
  });

  useEffect(() => {
    if (!open || detail !== undefined) return;
    let cancelled = false;
    void getCompanyAction(companyId).then((result) => {
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
  }, [open, companyId, detail]);

  const shown: DetailState = detail === undefined ? loaded : { status: 'ready', detail };

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      {shown.status === 'ready' ? (
        <CompanyEditForm detail={shown.detail} onSaved={handleSaved} />
      ) : (
        <SheetContent side="right" className={SHEET_CLASS} data-testid={COMPANY_EDIT_SHEET_TESTID}>
          <SheetHeader>
            <SheetTitle>{COMPANY_EDIT_TEXTS.title}</SheetTitle>
            <SheetDescription>{COMPANY_EDIT_TEXTS.loading}</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {shown.status === 'loading' ? (
              <div
                className="flex flex-col gap-3"
                role="status"
                aria-busy="true"
                aria-label={COMPANY_EDIT_TEXTS.loading}
                data-testid={COMPANY_EDIT_LOADING_TESTID}
              >
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} className="h-11 w-full" />
                ))}
              </div>
            ) : (
              <ErrorAlert
                error={shown.error}
                className={ERROR_REGION_CLASS}
                testId={COMPANY_EDIT_ERROR_TESTID}
                withDataCode
              />
            )}
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
