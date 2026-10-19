import { companyIdSchema } from './company-input';
import { CompanyNotFoundError, ValidationError } from './errors';
import { requirePlatformPermission, type PlatformActor } from './platform-actor';

import type { CompanyDetail } from './company-view';

import type { CompanyRepository } from '../ports/company-repository';

export type GetCompanyDeps = {
  readonly companies: CompanyRepository;
};

export function createGetCompany(
  deps: GetCompanyDeps,
): (actor: PlatformActor | null | undefined, input: unknown) => Promise<CompanyDetail> {
  return async function getCompany(
    actor: PlatformActor | null | undefined,
    input: unknown,
  ): Promise<CompanyDetail> {
    requirePlatformPermission(actor, 'empresas.consultar');

    const parsed = companyIdSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const company = await deps.companies.findById(parsed.data.companyId);
    if (company === null) throw new CompanyNotFoundError();
    return company;
  };
}
