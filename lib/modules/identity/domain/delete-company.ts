import { deleteCompanySchema } from './company-input';
import { normalizeCompanyName } from './company-name';
import { CompanyNameMismatchError, CompanyNotFoundError, ValidationError } from './errors';
import { requirePlatformPermission, type PlatformActor } from './platform-actor';

import type { CompanyRepository } from '../ports/company-repository';

export type DeleteCompanyDeps = {
  readonly companies: CompanyRepository;
  readonly now?: () => Date;
};

export function createDeleteCompany(
  deps: DeleteCompanyDeps,
): (actor: PlatformActor | null | undefined, input: unknown) => Promise<void> {
  const now = deps.now ?? (() => new Date());

  return async function deleteCompany(
    actor: PlatformActor | null | undefined,
    input: unknown,
  ): Promise<void> {
    requirePlatformPermission(actor, 'empresas.modificar');

    const parsed = deleteCompanySchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    // La confirmacion se compara con la misma regla que hace unicos los nombres, y la compara el
    // repositorio contra la fila bloqueada para no competir con una edicion simultanea.
    const outcome = await deps.companies.softDelete({
      companyId: parsed.data.companyId,
      confirmationNormalized: normalizeCompanyName(parsed.data.confirmationName),
      actorId: actor.id,
      now: now(),
    });
    if (outcome === 'not_found') throw new CompanyNotFoundError();
    if (outcome === 'name_mismatch') throw new CompanyNameMismatchError();
  };
}
