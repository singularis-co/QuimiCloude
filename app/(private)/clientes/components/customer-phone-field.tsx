'use client';

import { useId, useState, type ClipboardEvent } from 'react';
import type { CountryCode } from 'libphonenumber-js';

import { countryOptionLabel, listCountryOptions } from '@/components/shared/country-options';
import { CountrySelect } from '@/components/shared/country-select';
import { FieldError } from '@/components/shared/field-error';
import { StatusBadge } from '@/components/shared/status-badge';
import { TextField } from '@/components/shared/text-field';
import {
  CUSTOMER_PHONE_MAX_LENGTH,
  countryFromInternationalInput,
  formatPhoneNational,
  parseCustomerPhone,
  type CustomerPhoneIssue,
  type CustomerView,
} from '@/lib/modules/clientes';

export const CUSTOMER_PHONE_COUNTRY_FIELD = 'phoneCountry';
export const CUSTOMER_PHONE_NUMBER_FIELD = 'phoneNumber';

const FIELD_LABEL = 'Teléfono';
const COUNTRY_LABEL = 'País del teléfono';
const NUMBER_LABEL = 'Número de teléfono';
const PINNED_LABEL = 'País de la empresa';
const HINT_WITH_COMPANY_COUNTRY = 'Opcional. El país viene marcado con el de la empresa.';
const HINT_WITHOUT_COMPANY_COUNTRY = 'Opcional. Elige el país antes de escribir el número.';

const ISSUE_LONG_LABEL: Readonly<Record<CustomerPhoneIssue, string>> = {
  invalid_format: 'Teléfono sin formato válido',
  duplicate: 'Teléfono duplicado: revisar',
};

const ISSUE_HELP_AFTER_PHONE: Readonly<Record<CustomerPhoneIssue, string>> = {
  invalid_format: '. Escribe un número válido para reemplazarlo; si lo dejas vacío, se conserva.',
  duplicate:
    ', que ya tiene otro cliente. Escribe otro número para reemplazarlo; si lo dejas vacío, se conserva.',
};

const ISSUE_HELP_BEFORE_PHONE = 'Antes: ';

/** 48 px por debajo de escritorio; 44 px y 16 px de letra en todos los anchos. */
const NUMBER_INPUT_CLASS = 'min-h-11 max-lg:min-h-12 font-mono text-base md:text-base';

function asCountryCode(value: string | null | undefined): CountryCode | null {
  if (value === null || value === undefined) return null;
  return listCountryOptions().find((option) => option.code === value)?.code ?? null;
}

/** «Este número no es válido para Colombia (+57).» El catálogo no lleva el país. */
export function phoneNumberInvalidMessage(country: string | null | undefined): string | null {
  const option = listCountryOptions().find((candidate) => candidate.code === country);
  return option === undefined
    ? null
    : `Este número no es válido para ${countryOptionLabel(option)}.`;
}

export type CustomerPhoneFieldErrors = {
  readonly country?: string;
  readonly number?: string;
};

export type CustomerPhoneFieldTestIds = {
  readonly country: string;
  readonly number: string;
  readonly countryError: string;
  readonly numberError: string;
  readonly issue: string;
};

export type CustomerPhoneFieldProps = {
  readonly companyCountry: CountryCode | null;
  /** Cliente que se edita. Ausente en el alta. */
  readonly customer?: CustomerView;
  /** Los del último envío. Un objeto nuevo por envío: así se pintan aunque repitan el texto. */
  readonly errors?: CustomerPhoneFieldErrors;
  readonly testIds: CustomerPhoneFieldTestIds;
};

function initialNumber(customer: CustomerView | undefined, country: CountryCode | null): string {
  const e164 = customer?.phoneE164 ?? null;
  if (e164 === null || country === null) return '';
  return formatPhoneNational(e164, country);
}

export function CustomerPhoneField({
  companyCountry,
  customer,
  errors,
  testIds,
}: CustomerPhoneFieldProps) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const countryId = `${baseId}-country`;
  const countryErrorId = `${baseId}-country-error`;
  const numberId = `${baseId}-number`;
  const helpId = `${baseId}-help`;

  const [country, setCountry] = useState<CountryCode | null>(() =>
    customer === undefined ? companyCountry : asCountryCode(customer.phoneCountry),
  );
  const [number, setNumber] = useState(() =>
    initialNumber(customer, asCountryCode(customer?.phoneCountry)),
  );

  const [shown, setShown] = useState<CustomerPhoneFieldErrors>(errors ?? {});
  // Un error del servidor (p. ej. el duplicado) sigue a la vista hasta que se cambia el numero.
  const [edited, setEdited] = useState(false);
  const [lastErrors, setLastErrors] = useState(errors);
  if (errors !== lastErrors) {
    setLastErrors(errors);
    setShown(errors ?? {});
    setEdited(false);
  }

  const settle = (text: string, selected: CountryCode | null, changed: boolean) => {
    const fromPrefix = countryFromInternationalInput(text);
    const target = fromPrefix ?? selected;
    if (fromPrefix !== null && fromPrefix !== selected) setCountry(fromPrefix);

    const parsed = parseCustomerPhone(target, text);
    if (parsed.kind === 'ok') {
      setNumber(formatPhoneNational(parsed.phoneE164, parsed.phoneCountry));
      setShown((current) => ({
        country: fromPrefix === null ? current.country : undefined,
        number: changed ? undefined : current.number,
      }));
      return;
    }
    const numberError =
      parsed.kind === 'invalid_number' ? (phoneNumberInvalidMessage(target) ?? undefined) : undefined;
    setShown((current) => ({
      country: fromPrefix === null ? current.country : undefined,
      number: numberError ?? (changed ? undefined : current.number),
    }));
  };

  const handleCountryChange = (next: CountryCode | null) => {
    setCountry(next);
    setShown((current) => ({ number: current.number }));
    if (number.trim() !== '') settle(number, next, true);
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const pasted = countryFromInternationalInput(event.clipboardData.getData('text'));
    if (pasted === null) return;
    setCountry(pasted);
    setShown((current) => ({ number: current.number }));
  };

  const issue = customer?.phoneIssue ?? null;
  const legacyPhone = customer?.phone ?? null;
  const help =
    issue !== null && legacyPhone !== null ? (
      <p
        id={helpId}
        className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
        data-testid={testIds.issue}
      >
        <StatusBadge tone="waiting" label={ISSUE_LONG_LABEL[issue]} />
        <span>
          {ISSUE_HELP_BEFORE_PHONE}
          <span className="font-mono">{legacyPhone}</span>
          {ISSUE_HELP_AFTER_PHONE[issue]}
        </span>
      </p>
    ) : customer === undefined ? (
      <p id={helpId} className="text-sm text-muted-foreground">
        {companyCountry === null ? HINT_WITHOUT_COMPANY_COUNTRY : HINT_WITH_COMPANY_COUNTRY}
      </p>
    ) : null;

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-sm leading-none font-medium">
        {FIELD_LABEL}
      </span>

      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={help === null ? undefined : helpId}
        className="flex items-start gap-2"
        onPaste={handlePaste}
      >
        <div className="w-[200px] shrink-0 max-[640px]:w-28">
          <CountrySelect
            id={countryId}
            value={country}
            onChange={handleCountryChange}
            label={COUNTRY_LABEL}
            hideLabel
            compactOnMobile
            pinned={companyCountry === null ? undefined : { code: companyCountry, label: PINNED_LABEL }}
            error={shown.country}
            errorId={countryErrorId}
            testId={testIds.country}
          />
        </div>
        <input type="hidden" name={CUSTOMER_PHONE_COUNTRY_FIELD} value={country ?? ''} />

        <div className="min-w-0 flex-1">
          <TextField
            id={numberId}
            name={CUSTOMER_PHONE_NUMBER_FIELD}
            label={NUMBER_LABEL}
            labelRowClassName="sr-only"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            maxLength={CUSTOMER_PHONE_MAX_LENGTH}
            ariaRequired={false}
            value={number}
            onValueChange={(next) => {
              setNumber(next);
              setEdited(true);
            }}
            onBlur={() => settle(number, country, edited)}
            inputClassName={NUMBER_INPUT_CLASS}
            error={shown.number}
            testId={testIds.number}
            errorTestId={testIds.numberError}
          />
        </div>
      </div>

      <FieldError id={countryErrorId} message={shown.country} testId={testIds.countryError} />
      {help}
    </div>
  );
}
