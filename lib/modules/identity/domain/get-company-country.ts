import type { CountryCode } from 'libphonenumber-js';

import type { CompanyCountryRepository } from '../ports/company-country-repository';

export type GetCompanyCountryDeps = {
  readonly companies: Pick<CompanyCountryRepository, 'findCountryOf'>;
};

/** Sin actor ni permiso propio: el `companyId` sale de la sesion firmada y quien pregunta ya
 *  paso el corte de la pantalla; el pais es un dato de presentacion de su propia empresa. */
export function createGetCompanyCountry(
  deps: GetCompanyCountryDeps,
): (companyId: string) => Promise<CountryCode | null> {
  return function getCompanyCountry(companyId: string): Promise<CountryCode | null> {
    return deps.companies.findCountryOf(companyId);
  };
}
