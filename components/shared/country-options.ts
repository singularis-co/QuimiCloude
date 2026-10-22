// components/shared/country-options.ts
//
// Lista de países de `CountrySelect` y su filtro, sin DOM. La lista de códigos y prefijos sale de
// `libphonenumber-js`; el nombre, de `Intl.DisplayNames` en español. «Sin país» no es una opción
// de esta lista: lo pinta el componente.

import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';

export type CountryOption = {
  readonly code: CountryCode;
  readonly name: string;
  readonly callingCode: string;
};

const CALLING_CODE_QUERY = /^\+?\d+$/;

function buildCountryOptions(): readonly CountryOption[] {
  const displayNames = new Intl.DisplayNames('es', { type: 'region' });
  return getCountries()
    .map((code) => ({
      code,
      name: displayNames.of(code) ?? code,
      callingCode: getCountryCallingCode(code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

let countryOptions: readonly CountryOption[] | undefined;

/** Una opción por país, ordenadas por nombre en español. Se calcula una vez por módulo. */
export function listCountryOptions(): readonly CountryOption[] {
  countryOptions ??= buildCountryOptions();
  return countryOptions;
}

/** Solo dígitos, con o sin un `+` delante, tras quitar los espacios de los extremos. */
export function isCallingCodeQuery(query: string): boolean {
  return CALLING_CODE_QUERY.test(query.trim());
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/** Por prefijo si el texto es de dígitos; si no, por nombre sin tildes ni mayúsculas. */
export function filterCountryOptions(
  options: readonly CountryOption[],
  query: string,
): readonly CountryOption[] {
  const text = query.trim();
  if (text === '') return options;
  if (isCallingCodeQuery(text)) {
    const digits = text.replace('+', '');
    return options.filter((option) => option.callingCode.startsWith(digits));
  }
  const needle = normalize(text);
  return options.filter((option) => normalize(option.name).includes(needle));
}

/** «Colombia (+57)». */
export function countryOptionLabel(option: CountryOption): string {
  return `${option.name} (+${option.callingCode})`;
}
