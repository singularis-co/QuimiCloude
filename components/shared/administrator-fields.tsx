'use client';

import { useId, type ReactNode } from 'react';

import { DatePicker } from '@/components/shared/date-picker';
import { SelectField } from '@/components/shared/select-field';
import { TextField } from '@/components/shared/text-field';
import { DOCUMENT_TYPE_CODES } from '@/lib/modules/identity';
import { parseDateLocalISO } from '@/lib/shared/ui/date-civil';

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

export type AdministratorFieldsProps = {
  readonly namePrefix?: string;
  readonly defaultValues?: Partial<Record<AdministratorFieldName, string>>;
  readonly errors?: Partial<Record<AdministratorFieldName, string>>;
  readonly testIdPrefix: string;
};

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
}: AdministratorFieldsProps) {
  const baseId = useId();
  const idOf = (field: AdministratorFieldName): string => `${baseId}-${field}`;
  const nameOf = (field: AdministratorFieldName): string =>
    administratorFieldName(field, namePrefix);

  const text = (
    field: AdministratorFieldName,
    type?: 'text' | 'email' | 'tel',
    autoComplete?: string,
  ) => (
    <TextField
      id={idOf(field)}
      name={nameOf(field)}
      label={<RequiredLabel field={field} />}
      type={type}
      autoComplete={autoComplete}
      defaultValue={defaultValues[field] ?? ''}
      remountOnDefault
      ariaRequired={REQUIRED_FIELDS.has(field) ? true : undefined}
      testId={administratorFieldTestId(testIdPrefix, field)}
      error={errors[field]}
      errorTestId={administratorFieldErrorTestId(testIdPrefix, field)}
    />
  );

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

      {text('username', 'text', 'off')}
    </div>
  );
}
