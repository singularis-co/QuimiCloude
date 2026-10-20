import type { CountryCode } from 'libphonenumber-js/max';

/** El pais de una empresa, o `null` si no lo tiene, no existe o esta dada de baja. */
export type CompanyCountryLookup = (companyId: string) => Promise<CountryCode | null>;
