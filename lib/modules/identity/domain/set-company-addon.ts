import { setCompanyAddonSchema } from './company-addon-input';
import { toCompanyAddonsView, type CompanyAddonsView } from './company-addons-view';
import { CompanyNotFoundError, ValidationError } from './errors';
import { requirePlatformPermission, type PlatformActor } from './platform-actor';

import type { CompanyAddonRepository } from '../ports/company-addon-repository';

export type SetCompanyAddonDeps = {
  readonly addons: Pick<CompanyAddonRepository, 'apply'>;
  readonly now?: () => Date;
};

export function createSetCompanyAddon(
  deps: SetCompanyAddonDeps,
): (actor: PlatformActor | null | undefined, input: unknown) => Promise<CompanyAddonsView> {
  const now = deps.now ?? (() => new Date());

  return async function setCompanyAddon(
    actor: PlatformActor | null | undefined,
    input: unknown,
  ): Promise<CompanyAddonsView> {
    requirePlatformPermission(actor, 'empresas.modificar');

    const parsed = setCompanyAddonSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const { companyId, addon, enabled } = parsed.data;
    const outcome = await deps.addons.apply({
      companyId,
      ...(enabled ? { enable: [addon] } : { disable: [addon] }),
      actorId: actor.id,
      now: now(),
    });
    if (outcome === 'not_found') throw new CompanyNotFoundError();
    return toCompanyAddonsView(companyId, outcome.stored);
  };
}
