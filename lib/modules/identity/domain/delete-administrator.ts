import { administratorIdSchema } from './administrator-input';
import { CompanyLastAdministratorError, UserNotFoundError } from './errors';
import { requirePlatformPermission, type PlatformActor } from './platform-actor';

import type { AdministratorRepository } from '../ports/administrator-repository';

export type DeleteAdministratorDeps = {
  readonly administrators: AdministratorRepository;
  readonly now?: () => Date;
};

export function createDeleteAdministrator(
  deps: DeleteAdministratorDeps,
): (actor: PlatformActor | null | undefined, input: unknown) => Promise<void> {
  const now = deps.now ?? (() => new Date());

  return async function deleteAdministrator(
    actor: PlatformActor | null | undefined,
    input: unknown,
  ): Promise<void> {
    requirePlatformPermission(actor, 'empresas.modificar');

    // Un identificador mal formado responde igual que uno que no existe.
    const parsed = administratorIdSchema.safeParse(input);
    if (!parsed.success) throw new UserNotFoundError();

    const outcome = await deps.administrators.softDelete({ id: parsed.data.id, now: now() });
    if (outcome === 'not_found') throw new UserNotFoundError();
    if (outcome === 'last_administrator') throw new CompanyLastAdministratorError();
  };
}
