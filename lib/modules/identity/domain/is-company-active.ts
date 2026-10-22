import { z } from 'zod';

import type { CompanyMembershipReader } from '../ports/company-membership-reader';

export type IsCompanyActiveDeps = {
  readonly members: Pick<CompanyMembershipReader, 'isCompanyActive'>;
};

const uuid = z.string().uuid();

/** Consulta del sistema, sin actor: la usan los emisores que corren sin sesión. */
export function createIsCompanyActive(deps: IsCompanyActiveDeps): (companyId: string) => Promise<boolean> {
  return async function isCompanyActive(companyId: string): Promise<boolean> {
    // Un id que no es UUID haría fallar el cast de Postgres en vez de responder que no.
    if (!uuid.safeParse(companyId).success) return false;
    return deps.members.isCompanyActive(companyId);
  };
}
