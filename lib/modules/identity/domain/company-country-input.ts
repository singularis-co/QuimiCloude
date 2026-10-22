import { getCountries, type CountryCode } from 'libphonenumber-js';
import { z } from 'zod';

const COUNTRIES: ReadonlySet<string> = new Set(getCountries());

// La comparacion es exacta, sin recortar ni pasar a mayusculas: el selector solo produce codigos
// de la lista, y cualquier otra forma es un error de quien llama.
const countryCodeSchema = z.custom<CountryCode>(
  (value) => typeof value === 'string' && COUNTRIES.has(value),
);

// `''` es «sin pais». Un campo ausente o `null` no pasa, para que un formulario que no manda el
// campo no vacie el pais por accidente.
export const companyCountrySchema = z.union([z.literal('').transform(() => null), countryCodeSchema]);

export const setCompanyCountrySchema = z.strictObject({
  companyId: z.string().uuid(),
  country: companyCountrySchema,
});

export type SetCompanyCountryInput = z.output<typeof setCompanyCountrySchema>;
