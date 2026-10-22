'use client';

import { useId, type ReactNode } from 'react';

import { TextField } from '@/components/shared/text-field';

import { COMPANY_FIELD_LABELS, COMPANY_TAX_ID_HINT } from './company-labels';

export const COMPANY_DATA_FIELDS = ['name', 'taxId', 'contactEmail', 'contactPhone'] as const;

export type CompanyDataField = (typeof COMPANY_DATA_FIELDS)[number];

const TEST_ID_SUFFIX: Readonly<Record<CompanyDataField, string>> = {
  name: 'name',
  taxId: 'tax-id',
  contactEmail: 'contact-email',
  contactPhone: 'contact-phone',
};

export function companyFieldTestId(prefix: string, field: CompanyDataField): string {
  return `${prefix}-${TEST_ID_SUFFIX[field]}`;
}

export function companyFieldErrorTestId(prefix: string, field: CompanyDataField): string {
  return `${prefix}-error-${TEST_ID_SUFFIX[field]}`;
}

function NameLabel(): ReactNode {
  return (
    <>
      {COMPANY_FIELD_LABELS.name}
      <span aria-hidden="true" className="ml-0.5 text-destructive">
        *
      </span>
    </>
  );
}

export type CompanyDataFieldsProps = {
  readonly testIdPrefix: string;
  readonly defaultValues?: Readonly<Partial<Record<string, string>>>;
  readonly errors?: Readonly<Partial<Record<string, string>>>;
};

/** Nombre, identificación fiscal, correo y teléfono de contacto, con los nombres de la acción. */
export function CompanyDataFields({
  testIdPrefix,
  defaultValues = {},
  errors = {},
}: CompanyDataFieldsProps) {
  const baseId = useId();

  const field = (name: CompanyDataField, type: 'text' | 'email' | 'tel', label: ReactNode) => (
    <TextField
      id={`${baseId}-${name}`}
      name={name}
      label={label}
      type={type}
      autoComplete="off"
      defaultValue={defaultValues[name] ?? ''}
      remountOnDefault
      ariaRequired={name === 'name' ? true : undefined}
      hint={name === 'taxId' ? COMPANY_TAX_ID_HINT : undefined}
      testId={companyFieldTestId(testIdPrefix, name)}
      error={errors[name]}
      errorTestId={companyFieldErrorTestId(testIdPrefix, name)}
    />
  );

  return (
    <div className="@container flex flex-col gap-4">
      {field('name', 'text', <NameLabel />)}
      {field('taxId', 'text', COMPANY_FIELD_LABELS.taxId)}
      <div className="grid grid-cols-1 gap-4 @min-[480px]:grid-cols-2">
        {field('contactEmail', 'email', COMPANY_FIELD_LABELS.contactEmail)}
        {field('contactPhone', 'tel', COMPANY_FIELD_LABELS.contactPhone)}
      </div>
    </div>
  );
}
