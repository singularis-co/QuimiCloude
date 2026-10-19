import { toCompanyWrite, updateCompanySchema } from './company-input';
import {
  CompanyDuplicateNameError,
  CompanyDuplicateTaxIdError,
  CompanyNotFoundError,
  ValidationError,
} from './errors';
import { requirePlatformPermission, type PlatformActor } from './platform-actor';

import type { CompanyRepository } from '../ports/company-repository';

export type UpdateCompanyDeps = {
  readonly companies: CompanyRepository;
  readonly now?: () => Date;
};

export function createUpdateCompany(
  deps: UpdateCompanyDeps,
): (actor: PlatformActor | null | undefined, input: unknown) => Promise<void> {
  const now = deps.now ?? (() => new Date());

  return async function updateCompany(
    actor: PlatformActor | null | undefined,
    input: unknown,
  ): Promise<void> {
    requirePlatformPermission(actor, 'empresas.modificar');

    const parsed = updateCompanySchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const { companyId, ...data } = parsed.data;
    const outcome = await deps.companies.update({
      companyId,
      data: toCompanyWrite(data),
      actorId: actor.id,
      now: now(),
    });
    if (outcome === 'not_found') throw new CompanyNotFoundError();
    if (outcome === 'duplicate_name') throw new CompanyDuplicateNameError();
    if (outcome === 'duplicate_tax_id') throw new CompanyDuplicateTaxIdError();
  };
}
