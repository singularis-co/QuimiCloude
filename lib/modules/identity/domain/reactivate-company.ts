import { companyIdSchema } from './company-input';
import {
  CompanyDuplicateNameError,
  CompanyDuplicateTaxIdError,
  CompanyNotDeletedError,
  CompanyNotFoundError,
  ValidationError,
} from './errors';
import { requirePlatformPermission, type PlatformActor } from './platform-actor';

import type { CompanyRepository } from '../ports/company-repository';

export type ReactivateCompanyDeps = {
  readonly companies: CompanyRepository;
  readonly now?: () => Date;
};

export function createReactivateCompany(
  deps: ReactivateCompanyDeps,
): (actor: PlatformActor | null | undefined, input: unknown) => Promise<void> {
  const now = deps.now ?? (() => new Date());

  return async function reactivateCompany(
    actor: PlatformActor | null | undefined,
    input: unknown,
  ): Promise<void> {
    requirePlatformPermission(actor, 'empresas.modificar');

    const parsed = companyIdSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const outcome = await deps.companies.reactivate({
      companyId: parsed.data.companyId,
      actorId: actor.id,
      now: now(),
    });
    if (outcome === 'not_found') throw new CompanyNotFoundError();
    if (outcome === 'not_deleted') throw new CompanyNotDeletedError();
    if (outcome === 'duplicate_name') throw new CompanyDuplicateNameError();
    if (outcome === 'duplicate_tax_id') throw new CompanyDuplicateTaxIdError();
  };
}
