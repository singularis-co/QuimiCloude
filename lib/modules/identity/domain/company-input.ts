import { z } from 'zod';

import { normalizeCompanyName } from './company-name';
import { ValidationError } from './errors';
import { normalizeKey } from './normalize-key';
import { createUserSchema } from './user-input';

export const COMPANY_NAME_MAX_LENGTH = 80;
export const COMPANY_TAX_ID_MAX_LENGTH = 40;
export const COMPANY_CONTACT_EMAIL_MAX_LENGTH = 160;
export const COMPANY_CONTACT_PHONE_MAX_LENGTH = 40;

// `trim()` antes de `min(1)`: al reves, una cadena de espacios pasaria el minimo.
function requiredText(max: number) {
  return z.string().trim().min(1).max(max);
}

// El campo se exige siempre: un formulario que olvida mandarlo no debe borrar el dato. Vacio es
// «sin valor».
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value));
}

// El correo de contacto sigue la regla del correo de usuario: sin formato ni minusculas.
export const companyDataSchema = z.strictObject({
  name: requiredText(COMPANY_NAME_MAX_LENGTH),
  taxId: optionalText(COMPANY_TAX_ID_MAX_LENGTH),
  contactEmail: optionalText(COMPANY_CONTACT_EMAIL_MAX_LENGTH),
  contactPhone: optionalText(COMPANY_CONTACT_PHONE_MAX_LENGTH),
});

export const companyAdministratorSchema = createUserSchema.omit({ roleId: true, credential: true });

export const createCompanySchema = z.strictObject({
  company: companyDataSchema,
  administrator: companyAdministratorSchema,
});

export const updateCompanySchema = companyDataSchema.extend({ companyId: z.string().uuid() });

export const deleteCompanySchema = z.strictObject({
  companyId: z.string().uuid(),
  confirmationName: z.string().trim().min(1),
});

export const companyIdSchema = z.strictObject({ companyId: z.string().uuid() });

export const listCompanyEventsSchema = z.strictObject({
  companyId: z.string().uuid(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).optional(),
});

export type CompanyDataInput = z.output<typeof companyDataSchema>;
export type CreateCompanyInput = z.output<typeof createCompanySchema>;
export type UpdateCompanyInput = z.output<typeof updateCompanySchema>;
export type DeleteCompanyInput = z.output<typeof deleteCompanySchema>;
export type ListCompanyEventsInput = z.output<typeof listCompanyEventsSchema>;

// La misma regla que el nombre: «900.123.456-7» y «9001234567» chocan.
export function normalizeTaxId(taxId: string): string {
  return normalizeKey(taxId);
}

/** Los datos ya validados con sus formas normalizadas, tal como se escriben. */
export function toCompanyWrite(data: CompanyDataInput) {
  const taxIdNormalized = data.taxId === null ? null : normalizeTaxId(data.taxId);
  // Un nombre o una identificacion sin ningun caracter comparable no se podrian hacer unicos.
  const nameNormalized = normalizeCompanyName(data.name);
  if (nameNormalized === '' || taxIdNormalized === '') throw new ValidationError();
  return {
    name: data.name,
    nameNormalized,
    taxId: data.taxId,
    taxIdNormalized,
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone,
  };
}
