import type { CountryCode } from 'libphonenumber-js';

export interface CompanyCountryRepository {
  /** Solo toca empresas vivas: una inexistente y una dada de baja responden igual, `not_found`.
   *  Un cambio real deja su evento de historial en la misma transaccion; el mismo pais, ninguno. */
  setCountryOfAlive(
    companyId: string,
    country: CountryCode | null,
    actorId: string,
    now: Date,
  ): Promise<'ok' | 'not_found'>;
}
