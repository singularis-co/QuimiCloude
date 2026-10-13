import type { CountryCode } from 'libphonenumber-js';

export interface CompanyCountryRepository {
  /** Solo toca empresas vivas: una inexistente y una dada de baja responden igual, `not_found`. */
  setCountryOfAlive(companyId: string, country: CountryCode | null): Promise<'ok' | 'not_found'>;
}
