import { z } from 'zod';

import type { CompanyMembershipReader } from '../ports/company-membership-reader';

export type IsUserInCompanyDeps = {
  readonly members: CompanyMembershipReader;
};

const uuid = z.string().uuid();

/** Consulta del sistema, sin actor: la usan los emisores que corren sin sesión. */
export function createIsUserInCompany(
  deps: IsUserInCompanyDeps,
): (userId: string, companyId: string) => Promise<boolean> {
  return async function isUserInCompany(userId: string, companyId: string): Promise<boolean> {
    // Un id que no es UUID haría fallar el cast de Postgres en vez de responder que no.
    if (!uuid.safeParse(userId).success || !uuid.safeParse(companyId).success) return false;
    return deps.members.isUserInCompany(userId, companyId);
  };
}
