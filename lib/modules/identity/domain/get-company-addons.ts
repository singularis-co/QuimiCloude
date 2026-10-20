import { companyAddonsQuerySchema } from './company-addon-input';
import { toCompanyAddonsView, type CompanyAddonsView } from './company-addons-view';
import { CompanyNotFoundError, ValidationError } from './errors';
import { requirePlatformPermission, type PlatformActor } from './platform-actor';

import type { CompanyAddonRepository } from '../ports/company-addon-repository';

export type GetCompanyAddonsDeps = {
  readonly addons: Pick<CompanyAddonRepository, 'findByCompany'>;
};

export function createGetCompanyAddons(
  deps: GetCompanyAddonsDeps,
): (actor: PlatformActor | null | undefined, input: unknown) => Promise<CompanyAddonsView> {
  return async function getCompanyAddons(
    actor: PlatformActor | null | undefined,
    input: unknown,
  ): Promise<CompanyAddonsView> {
    requirePlatformPermission(actor, 'empresas.consultar');

    const parsed = companyAddonsQuerySchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    // La lectura vale también para una empresa de baja: si se reactiva, vuelve como estaba.
    const found = await deps.addons.findByCompany(parsed.data.companyId);
    if (found === null) throw new CompanyNotFoundError();
    return toCompanyAddonsView(parsed.data.companyId, found.stored);
  };
}
