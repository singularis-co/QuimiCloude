import { setAllCompanyAddonsSchema } from './company-addon-input';
import { ADDONS } from './company-addons';
import { toCompanyAddonsView, type CompanyAddonsView } from './company-addons-view';
import { CompanyNotFoundError, ValidationError } from './errors';
import { requirePlatformPermission, type PlatformActor } from './platform-actor';

import type { CompanyAddonRepository } from '../ports/company-addon-repository';

export type SetAllCompanyAddonsDeps = {
  readonly addons: Pick<CompanyAddonRepository, 'apply'>;
  readonly now?: () => Date;
};

export function createSetAllCompanyAddons(
  deps: SetAllCompanyAddonsDeps,
): (actor: PlatformActor | null | undefined, input: unknown) => Promise<CompanyAddonsView> {
  const now = deps.now ?? (() => new Date());

  return async function setAllCompanyAddons(
    actor: PlatformActor | null | undefined,
    input: unknown,
  ): Promise<CompanyAddonsView> {
    requirePlatformPermission(actor, 'empresas.modificar');

    const parsed = setAllCompanyAddonsSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const { companyId, enabled } = parsed.data;
    // Una sola llamada con la lista entera: el puerto lo escribe todo o nada.
    const outcome = await deps.addons.apply({
      companyId,
      ...(enabled ? { enable: ADDONS } : { disable: ADDONS }),
      actorId: actor.id,
      now: now(),
    });
    if (outcome === 'not_found') throw new CompanyNotFoundError();
    return toCompanyAddonsView(companyId, outcome.stored);
  };
}
