import { ADMINISTRATOR_QUERYABLE } from './administrator-queryable';
import { ValidationError } from './errors';
import { createListQuerySchema, sanitizeListQuery } from './list-query';
import { requirePlatformPermission, type PlatformActor } from './platform-actor';

import type { AdministratorRow } from './administrator-view';
import type { Page } from './page';

import type { AdministratorRepository } from '../ports/administrator-repository';
import type { ListQueryLog } from '../ports/list-query-log';

export type ListAdministratorsDeps = {
  readonly administrators: AdministratorRepository;
  readonly log: ListQueryLog;
};

const LIST_NAME = 'administrators';

const listQuerySchema = createListQuerySchema();

export function createListAdministrators(
  deps: ListAdministratorsDeps,
): (actor: PlatformActor | null | undefined, input: unknown) => Promise<Page<AdministratorRow>> {
  return async function listAdministrators(
    actor: PlatformActor | null | undefined,
    input: unknown,
  ): Promise<Page<AdministratorRow>> {
    requirePlatformPermission(actor, 'empresas.consultar');

    const parsed = listQuerySchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const { query, ignored } = sanitizeListQuery(parsed.data, ADMINISTRATOR_QUERYABLE);
    deps.log.ignoredFields(LIST_NAME, ignored);

    return deps.administrators.list(query);
  };
}
