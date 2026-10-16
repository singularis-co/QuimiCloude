import { listCompanyEventsSchema } from './company-input';
import { CompanyNotFoundError, ValidationError } from './errors';
import { requirePlatformPermission, type PlatformActor } from './platform-actor';

import type { CompanyEventView } from './company-view';
import type { Page } from './page';

import type { CompanyRepository } from '../ports/company-repository';

export type ListCompanyEventsDeps = {
  readonly companies: CompanyRepository;
};

export function createListCompanyEvents(
  deps: ListCompanyEventsDeps,
): (actor: PlatformActor | null | undefined, input: unknown) => Promise<Page<CompanyEventView>> {
  return async function listCompanyEvents(
    actor: PlatformActor | null | undefined,
    input: unknown,
  ): Promise<Page<CompanyEventView>> {
    requirePlatformPermission(actor, 'empresas.consultar');

    const parsed = listCompanyEventsSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const { companyId, page, pageSize } = parsed.data;
    const events = await deps.companies.listEvents(companyId, { page, pageSize });
    if (events === 'not_found') throw new CompanyNotFoundError();
    return events;
  };
}
