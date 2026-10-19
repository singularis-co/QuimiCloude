import { z } from 'zod';

import { parseCustomerPhone } from './customer-phone';

export const CUSTOMER_FIRST_NAMES_MAX_LENGTH = 80;
export const CUSTOMER_LAST_NAMES_MAX_LENGTH = 80;
export const CUSTOMER_CITY_MAX_LENGTH = 80;
export const CUSTOMER_PHONE_MAX_LENGTH = 40;
export const CUSTOMER_EMAIL_MAX_LENGTH = 160;
export const CUSTOMER_ADDRESS_MAX_LENGTH = 200;

/** Convierte en ausencia lo que llega vacio o solo con espacios. */
export function blankToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

const firstNamesSchema = z.string().trim().min(1).max(CUSTOMER_FIRST_NAMES_MAX_LENGTH);
const lastNamesSchema = z.string().trim().min(1).max(CUSTOMER_LAST_NAMES_MAX_LENGTH);
const citySchema = z.string().trim().min(1).max(CUSTOMER_CITY_MAX_LENGTH);
const phoneCountrySchema = z.string().trim().max(2).nullish();
const phoneNumberSchema = z.string().trim().max(CUSTOMER_PHONE_MAX_LENGTH).nullish();
const emailSchema = z.string().trim().max(CUSTOMER_EMAIL_MAX_LENGTH).nullish();
const addressSchema = z.string().trim().max(CUSTOMER_ADDRESS_MAX_LENGTH).nullish();

/** Por que se rechazo el telefono: el caso de uso elige el error con esto. */
export type CustomerPhoneIssueReason = 'country_required' | 'invalid_number' | 'invalid_country';

/**
 * Alta y edicion usan el mismo esquema: reemplazo completo. El telefono es el unico cruce entre
 * campos: el numero se lee con el pais elegido.
 */
export const createCustomerSchema = z
  .object({
    firstNames: firstNamesSchema,
    lastNames: lastNamesSchema,
    city: citySchema,
    phoneCountry: phoneCountrySchema,
    phoneNumber: phoneNumberSchema,
    email: emailSchema,
    address: addressSchema,
  })
  .transform((value, ctx) => {
    const phone = parseCustomerPhone(value.phoneCountry, value.phoneNumber);
    if (phone.kind !== 'ok' && phone.kind !== 'none') {
      const reason: CustomerPhoneIssueReason = phone.kind;
      ctx.addIssue({
        code: 'custom',
        path: [reason === 'invalid_number' ? 'phoneNumber' : 'phoneCountry'],
        message: reason,
        params: { reason },
      });
      return z.NEVER;
    }

    return {
      firstNames: value.firstNames,
      lastNames: value.lastNames,
      city: value.city,
      phone: phone.kind === 'ok' ? phone.phone : null,
      phoneCountry: phone.kind === 'ok' ? phone.phoneCountry : null,
      phoneE164: phone.kind === 'ok' ? phone.phoneE164 : null,
      phoneIssue: null,
      email: blankToNull(value.email),
      address: blankToNull(value.address),
    };
  });

/** La razon del primer problema de telefono de un fallo del esquema, si lo hay. */
export function phoneIssueReason(error: z.ZodError): CustomerPhoneIssueReason | null {
  for (const issue of error.issues) {
    if (issue.code !== 'custom') continue;
    const reason: unknown = issue.params?.reason;
    if (reason === 'country_required' || reason === 'invalid_number' || reason === 'invalid_country') {
      return reason;
    }
  }
  return null;
}

export const updateCustomerSchema = createCustomerSchema;

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
