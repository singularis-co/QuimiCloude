import { companyIdSchema } from './company-input';
import { CompanyNotFoundError, ValidationError } from './errors';
import { requirePlatformPermission, type PlatformActor } from './platform-actor';

import type { CompanyDeletionImpact } from './company-view';

import type { CompanyOpenOrdersCounter } from '../ports/company-open-orders-counter';
import type { CompanyRepository } from '../ports/company-repository';

export type GetCompanyDeletionImpactDeps = {
  readonly companies: CompanyRepository;
  readonly openOrders: CompanyOpenOrdersCounter;
};

export function createGetCompanyDeletionImpact(
  deps: GetCompanyDeletionImpactDeps,
): (actor: PlatformActor | null | undefined, input: unknown) => Promise<CompanyDeletionImpact> {
  return async function getCompanyDeletionImpact(
    actor: PlatformActor | null | undefined,
    input: unknown,
  ): Promise<CompanyDeletionImpact> {
    requirePlatformPermission(actor, 'empresas.consultar');

    const parsed = companyIdSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const { companyId } = parsed.data;
    const liveUsers = await deps.companies.countLiveUsersOfAlive(companyId);
    if (liveUsers === 'not_found') throw new CompanyNotFoundError();

    const openOrders = await deps.openOrders.countOpenOrders(companyId);
    return { liveUsers, openOrders };
  };
}
