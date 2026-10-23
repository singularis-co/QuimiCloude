import { setCompanyCountrySchema } from './company-country-input';
import { CompanyNotFoundError, ValidationError } from './errors';
import { requirePlatformPermission, type PlatformActor } from './platform-actor';

import type { CompanyCountryRepository } from '../ports/company-country-repository';

export type SetCompanyCountryDeps = {
  readonly companies: Pick<CompanyCountryRepository, 'setCountryOfAlive'>;
  readonly now?: () => Date;
};

export function createSetCompanyCountry(
  deps: SetCompanyCountryDeps,
): (actor: PlatformActor | null | undefined, input: unknown) => Promise<void> {
  const now = deps.now ?? (() => new Date());
  return async function setCompanyCountry(
    actor: PlatformActor | null | undefined,
    input: unknown,
  ): Promise<void> {
    // Primero el permiso: sin el, ni se valida la entrada ni se toca el puerto.
    requirePlatformPermission(actor, 'empresas.modificar');

    const parsed = setCompanyCountrySchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const { companyId, country } = parsed.data;
    const outcome = await deps.companies.setCountryOfAlive(companyId, country, actor.id, now());
    if (outcome === 'not_found') throw new CompanyNotFoundError();
  };
}
