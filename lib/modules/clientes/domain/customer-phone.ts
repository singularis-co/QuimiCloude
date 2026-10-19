// `max` y no el punto de entrada por defecto: con los metadatos `min`, `isValid()` solo mira la
// longitud y aceptaria numeros que no existen en el pais.
import {
  AsYouType,
  getCountries,
  parsePhoneNumberFromString,
  type CountryCode,
  type PhoneNumber,
} from 'libphonenumber-js/max';

import type { Customer } from './customer';

export type CustomerPhoneIssue = 'invalid_format' | 'duplicate';

export type ParsedCustomerPhone =
  | { readonly kind: 'none' }
  | { readonly kind: 'country_required' }
  | { readonly kind: 'invalid_country' }
  | { readonly kind: 'invalid_number' }
  | {
      readonly kind: 'ok';
      readonly phoneCountry: CountryCode;
      readonly phoneE164: string;
      readonly phone: string;
    };

const SUPPORTED_COUNTRIES: ReadonlySet<string> = new Set(getCountries());

function isCountryCode(value: string): value is CountryCode {
  return SUPPORTED_COUNTRIES.has(value);
}

function digitsOf(number: PhoneNumber): string {
  return number.number.slice(1);
}

/**
 * Lo que escribe el formulario: un pais y un numero. El numero tiene que ser valido para ESE
 * pais; uno con `+` de otro pais no cambia el pais elegido.
 */
export function parseCustomerPhone(
  country: string | null | undefined,
  number: string | null | undefined,
): ParsedCustomerPhone {
  const text = number?.trim() ?? '';
  if (text === '') return { kind: 'none' };

  const code = country?.trim() ?? '';
  if (code === '') return { kind: 'country_required' };
  if (!isCountryCode(code)) return { kind: 'invalid_country' };

  const parsed = parsePhoneNumberFromString(text, code);
  if (parsed === undefined || !parsed.isValid() || parsed.country !== code) {
    return { kind: 'invalid_number' };
  }

  return {
    kind: 'ok',
    phoneCountry: code,
    phoneE164: digitsOf(parsed),
    phone: parsed.formatInternational(),
  };
}

export type ParsedLegacyPhone =
  | { readonly kind: 'ok'; readonly phoneCountry: CountryCode; readonly phoneE164: string }
  | { readonly kind: 'invalid' };

/**
 * El texto libre antiguo. `country` es el pais por defecto; si el texto trae `+`, manda el pais
 * del propio numero.
 */
export function parseCustomerPhoneText(text: string, country: CountryCode): ParsedLegacyPhone {
  const parsed = parsePhoneNumberFromString(text, country);
  if (parsed === undefined || !parsed.isValid() || parsed.country === undefined) {
    return { kind: 'invalid' };
  }
  return { kind: 'ok', phoneCountry: parsed.country, phoneE164: digitsOf(parsed) };
}

function parseE164(e164: string, country?: CountryCode): PhoneNumber | undefined {
  return parsePhoneNumberFromString(`+${e164}`, country);
}

export function formatPhoneNational(e164: string, country: CountryCode): string {
  return parseE164(e164, country)?.formatNational() ?? e164;
}

export function formatPhoneInternational(e164: string): string {
  return parseE164(e164)?.formatInternational() ?? `+${e164}`;
}

/** El pais que identifica el prefijo de un numero con `+`, o `null` si no identifica uno solo. */
export function countryFromInternationalInput(text: string): CountryCode | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('+')) return null;
  const typing = new AsYouType();
  typing.input(trimmed);
  return typing.getCountry() ?? null;
}

export type CustomerPhoneDescription =
  | { readonly kind: 'international'; readonly text: string }
  | {
      readonly kind: 'issue';
      readonly legacyPhone: string;
      readonly issue: CustomerPhoneIssue;
      readonly label: string;
    }
  | { readonly kind: 'none' };

const ISSUE_SHORT_LABEL: Readonly<Record<CustomerPhoneIssue, string>> = {
  invalid_format: 'Sin formato válido',
  duplicate: 'Duplicado: revisar',
};

/** Lo que muestra la lista en la columna del telefono. */
export function describeCustomerPhone(
  customer: Pick<Customer, 'phone' | 'phoneE164' | 'phoneIssue'>,
): CustomerPhoneDescription {
  if (customer.phoneE164 !== null) {
    return { kind: 'international', text: formatPhoneInternational(customer.phoneE164) };
  }
  if (customer.phoneIssue !== null && customer.phone !== null) {
    return {
      kind: 'issue',
      legacyPhone: customer.phone,
      issue: customer.phoneIssue,
      label: ISSUE_SHORT_LABEL[customer.phoneIssue],
    };
  }
  return { kind: 'none' };
}
