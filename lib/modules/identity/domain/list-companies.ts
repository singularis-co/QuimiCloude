import { COMPANY_QUERYABLE } from './company-queryable';
import { ValidationError } from './errors';
import { createListQuerySchema, sanitizeListQuery } from './list-query';
import { requirePlatformPermission, type PlatformActor } from './platform-actor';

import { toCompanyRow, type CompanyRow } from './company-view';
import type { Page } from './page';

import type { CompanyRepository } from '../ports/company-repository';
import type { ListQueryLog } from '../ports/list-query-log';

export type ListCompaniesDeps = {
  readonly companies: CompanyRepository;
  readonly log: ListQueryLog;
};

const LIST_NAME = 'companies';

const listQuerySchema = createListQuerySchema();

export function createListCompanies(
  deps: ListCompaniesDeps,
): (actor: PlatformActor | null | undefined, input: unknown) => Promise<Page<CompanyRow>> {
  return async function listCompanies(
    actor: PlatformActor | null | undefined,
    input: unknown,
  ): Promise<Page<CompanyRow>> {
    requirePlatformPermission(actor, 'empresas.consultar');

    const parsed = listQuerySchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const { query, ignored } = sanitizeListQuery(parsed.data, COMPANY_QUERYABLE);
    deps.log.ignoredFields(LIST_NAME, ignored);

    const page = await deps.companies.list(query);
    return { ...page, items: page.items.map(toCompanyRow) };
  };
}
