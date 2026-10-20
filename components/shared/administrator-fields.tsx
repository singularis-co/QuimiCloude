'use client';

import { useId, useState, type ReactNode } from 'react';

import { DatePicker } from '@/components/shared/date-picker';
import { SelectField } from '@/components/shared/select-field';
import { TextField } from '@/components/shared/text-field';
import {
  USERNAME_SUGGESTION_HINT,
  usernameFromNames,
  usernameSuggestionApplyLabel,
} from '@/components/shared/username-from-names';
import { Button } from '@/components/ui/button';
import { DOCUMENT_TYPE_CODES } from '@/lib/modules/identity';
import { parseDateLocalISO } from '@/lib/shared/ui/date-civil';
import { touchTarget } from '@/lib/shared/ui/touch-target';

export const ADMINISTRATOR_FIELD_NAMES = [
  'firstNames',
  'lastNames',
  'birthDate',
  'email',
  'phone',
  'documentTypeCode',
  'documentNumber',
  'username',
] as const;

export type AdministratorFieldName = (typeof ADMINISTRATOR_FIELD_NAMES)[number];

export const ADMINISTRATOR_FIELD_LABELS: Readonly<Record<AdministratorFieldName, string>> = {
  firstNames: 'Nombres',
  lastNames: 'Apellidos',
  birthDate: 'Fecha de nacimiento',
  email: 'Correo',
  phone: 'Teléfono',
  documentTypeCode: 'Tipo de documento',
  documentNumber: 'Número de documento',
  username: 'Nombre de usuario',
};

export const ADMINISTRATOR_BIRTH_DATE_PLACEHOLDER = 'aaaa-mm-dd';

// Fecha de nacimiento, Teléfono y Número de documento van marcados aunque el tablero no lo
// haga: el servidor los exige.
const REQUIRED_FIELDS: ReadonlySet<AdministratorFieldName> = new Set([
  'firstNames',
  'lastNames',
  'birthDate',
  'email',
  'phone',
  'documentNumber',
  'username',
]);

const TEST_ID_SUFFIX: Readonly<Record<AdministratorFieldName, string>> = {
  firstNames: 'first-names',
  lastNames: 'last-names',
  birthDate: 'birth-date',
  email: 'email',
  phone: 'phone',
  documentTypeCode: 'document-type',
  documentNumber: 'document-number',
  username: 'username',
};

/** `admin` + `firstNames` = `adminFirstNames`; sin prefijo, el nombre tal cual. */
export function administratorFieldName(field: AdministratorFieldName, namePrefix?: string): string {
  if (namePrefix === undefined || namePrefix === '') return field;
  return `${namePrefix}${field.charAt(0).toUpperCase()}${field.slice(1)}`;
}

export function administratorFieldTestId(testIdPrefix: string, field: AdministratorFieldName): string {
  return `${testIdPrefix}-${TEST_ID_SUFFIX[field]}`;
}

export function administratorFieldErrorTestId(
  testIdPrefix: string,
  field: AdministratorFieldName,
): string {
  return `${testIdPrefix}-error-${TEST_ID_SUFFIX[field]}`;
}

export function administratorUsernameSuggestionTestIds(testIdPrefix: string): {
  readonly suggestion: string;
  readonly apply: string;
} {
  return {
    suggestion: `${testIdPrefix}-username-suggestion`,
    apply: `${testIdPrefix}-username-suggestion-apply`,
  };
}

export type AdministratorFieldsProps = {
  readonly namePrefix?: string;
  readonly defaultValues?: Partial<Record<AdministratorFieldName, string>>;
  readonly errors?: Partial<Record<AdministratorFieldName, string>>;
  readonly testIdPrefix: string;
  /** Propone el nombre de usuario a partir de nombres y apellidos hasta que se edita a mano. */
  readonly usernameAutofill?: boolean;
  /** Nombre de usuario libre que se ofrece aplicar junto al campo. */
  readonly usernameSuggestion?: string;
};

type AutofillValues = {
  readonly firstNames: string;
  readonly lastNames: string;
  readonly username: string;
};

function isAutofillField(field: AdministratorFieldName): field is keyof AutofillValues {
  return field === 'firstNames' || field === 'lastNames' || field === 'username';
}

function RequiredLabel({ field }: { readonly field: AdministratorFieldName }): ReactNode {
  const label = ADMINISTRATOR_FIELD_LABELS[field];
  if (!REQUIRED_FIELDS.has(field)) return label;
  return (
    <>
      {label}
      <span aria-hidden="true" className="ml-0.5 text-destructive">
        *
      </span>
    </>
  );
}

const PAIR_ROW = 'grid grid-cols-1 gap-4 @min-[480px]:grid-cols-2';
const DOCUMENT_ROW = 'grid grid-cols-1 gap-4 @min-[480px]:grid-cols-[160px_minmax(0,1fr)]';

export function AdministratorFields({
  namePrefix,
  defaultValues = {},
  errors = {},
  testIdPrefix,
  usernameAutofill = false,
  usernameSuggestion,
}: AdministratorFieldsProps) {
  const baseId = useId();
  const idOf = (field: AdministratorFieldName): string => `${baseId}-${field}`;
  const nameOf = (field: AdministratorFieldName): string =>
    administratorFieldName(field, namePrefix);

  const [autofill, setAutofill] = useState<AutofillValues>(() => ({
    firstNames: defaultValues.firstNames ?? '',
    lastNames: defaultValues.lastNames ?? '',
    username: defaultValues.username ?? '',
  }));
  const [usernameEdited, setUsernameEdited] = useState(false);

  function changeName(field: 'firstNames' | 'lastNames', value: string) {
    setAutofill((previous) => {
      const next = { ...previous, [field]: value };
      if (usernameEdited) return next;
      return { ...next, username: usernameFromNames(next.firstNames, next.lastNames) };
    });
  }

  function changeUsername(value: string) {
    setUsernameEdited(true);
    setAutofill((previous) => ({ ...previous, username: value }));
  }

  const onChangeOf: Readonly<Record<keyof AutofillValues, (value: string) => void>> = {
    firstNames: (value) => changeName('firstNames', value),
    lastNames: (value) => changeName('lastNames', value),
    username: changeUsername,
  };

  const text = (
    field: AdministratorFieldName,
    type?: 'text' | 'email' | 'tel',
    autoComplete?: string,
    children?: ReactNode,
  ) => {
    const autofillField = usernameAutofill && isAutofillField(field) ? field : undefined;
    return (
      <TextField
        id={idOf(field)}
        name={nameOf(field)}
        label={<RequiredLabel field={field} />}
        type={type}
        autoComplete={autoComplete}
        value={autofillField === undefined ? undefined : autofill[autofillField]}
        onValueChange={autofillField === undefined ? undefined : onChangeOf[autofillField]}
        defaultValue={autofillField === undefined ? (defaultValues[field] ?? '') : undefined}
        remountOnDefault
        ariaRequired={REQUIRED_FIELDS.has(field) ? true : undefined}
        testId={administratorFieldTestId(testIdPrefix, field)}
        error={errors[field]}
        errorTestId={administratorFieldErrorTestId(testIdPrefix, field)}
      >
        {children}
      </TextField>
    );
  };

  const currentUsername = usernameAutofill ? autofill.username : undefined;
  // Ya aplicada, la recomendacion sobra.
  const suggestion =
    usernameSuggestion === undefined || usernameSuggestion === currentUsername
      ? undefined
      : usernameSuggestion;
  const suggestionTestIds = administratorUsernameSuggestionTestIds(testIdPrefix);

  const birthDate = defaultValues.birthDate ?? '';
  const birthDateDefault = birthDate === '' ? undefined : parseDateLocalISO(birthDate);

  return (
    <div className="@container flex flex-col gap-4">
      <div className={PAIR_ROW}>
        {text('firstNames', 'text', 'off')}
        {text('lastNames', 'text', 'off')}
      </div>

      <DatePicker
        // Remonta al cambiar el valor de partida: el día elegido vive en estado.
        key={birthDate}
        mode="single"
        name={nameOf('birthDate')}
        label={<RequiredLabel field="birthDate" />}
        defaultValue={birthDateDefault}
        placeholder={ADMINISTRATOR_BIRTH_DATE_PLACEHOLDER}
        triggerTestId={administratorFieldTestId(testIdPrefix, 'birthDate')}
        valueTestId={`${administratorFieldTestId(testIdPrefix, 'birthDate')}-value`}
        error={errors.birthDate}
        errorTestId={administratorFieldErrorTestId(testIdPrefix, 'birthDate')}
      />

      <div className={PAIR_ROW}>
        {text('email', 'email', 'off')}
        {text('phone', 'tel', 'off')}
      </div>

      <div className={DOCUMENT_ROW}>
        <SelectField
          name={nameOf('documentTypeCode')}
          label={<RequiredLabel field="documentTypeCode" />}
          options={DOCUMENT_TYPE_CODES.map((code) => ({ value: code, label: code }))}
          defaultValue={defaultValues.documentTypeCode ?? DOCUMENT_TYPE_CODES[0]}
          remountOnDefault
          triggerTestId={administratorFieldTestId(testIdPrefix, 'documentTypeCode')}
          error={errors.documentTypeCode}
          errorTestId={administratorFieldErrorTestId(testIdPrefix, 'documentTypeCode')}
        />
        {text('documentNumber', 'text', 'off')}
      </div>

      {text(
        'username',
        'text',
        'off',
        suggestion === undefined ? null : (
          <div className="flex flex-col gap-2 text-sm" data-testid={suggestionTestIds.suggestion}>
            <p>{USERNAME_SUGGESTION_HINT}</p>
            <Button
              type="button"
              variant="outline"
              className={`w-full ${touchTarget}`}
              data-testid={suggestionTestIds.apply}
              onClick={() => changeUsername(suggestion)}
            >
              <span className="truncate">{usernameSuggestionApplyLabel(suggestion)}</span>
            </Button>
          </div>
        ),
      )}
    </div>
  );
}
