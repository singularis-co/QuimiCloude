import { administratorIdSchema } from './administrator-input';
import { UserNotFoundError } from './errors';
import { requirePlatformPermission, type PlatformActor } from './platform-actor';

import type { AdministratorDetail } from './administrator-view';

import type { AdministratorRepository } from '../ports/administrator-repository';

export type GetAdministratorDeps = {
  readonly administrators: AdministratorRepository;
};

export function createGetAdministrator(
  deps: GetAdministratorDeps,
): (actor: PlatformActor | null | undefined, input: unknown) => Promise<AdministratorDetail> {
  return async function getAdministrator(
    actor: PlatformActor | null | undefined,
    input: unknown,
  ): Promise<AdministratorDetail> {
    requirePlatformPermission(actor, 'empresas.consultar');

    // Un identificador mal formado responde igual que uno que no existe, para que la ficha no
    // distinga entre los dos casos.
    const parsed = administratorIdSchema.safeParse(input);
    if (!parsed.success) throw new UserNotFoundError();

    const administrator = await deps.administrators.findManageable(parsed.data.id);
    if (administrator === null) throw new UserNotFoundError();
    return administrator;
  };
}
