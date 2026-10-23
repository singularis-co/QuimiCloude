import { effectiveAddons, type Addon } from './company-addons';

import type { CompanyAddonRepository } from '../ports/company-addon-repository';

export type IsCompanyAddonActiveDeps = {
  readonly addons: Pick<CompanyAddonRepository, 'findByCompany'>;
};

/** Consulta del sistema, sin actor: la usan los trabajos que corren sin sesión. */
export function createIsCompanyAddonActive(
  deps: IsCompanyAddonActiveDeps,
): (companyId: string, addon: Addon) => Promise<boolean> {
  return async function isCompanyAddonActive(companyId: string, addon: Addon): Promise<boolean> {
    const found = await deps.addons.findByCompany(companyId);
    if (found === null || !found.alive) return false;
    return effectiveAddons(found.stored).includes(addon);
  };
}
