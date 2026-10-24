import type { CompanyNameReader } from '../ports/company-name-reader';

export type GetCompanyNameDeps = {
  readonly companies: Pick<CompanyNameReader, 'findNameOf'>;
};

/** Sin actor ni permiso propio: el `companyId` sale de la sesion firmada y el caso de uso que lo
 *  pide ya autorizo; el nombre es un dato de presentacion de su propia empresa. */
export function createGetCompanyName(
  deps: GetCompanyNameDeps,
): (companyId: string) => Promise<string | null> {
  return function getCompanyName(companyId: string): Promise<string | null> {
    return deps.companies.findNameOf(companyId);
  };
}
