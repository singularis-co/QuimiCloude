import { updateAdministratorSchema } from './administrator-input';
import { toBirthDate } from './birth-date';
import { throwDuplicate } from './create-user';
import { UserNotFoundError, ValidationError } from './errors';
import { requirePlatformPermission, type PlatformActor } from './platform-actor';

import type { AdministratorRepository } from '../ports/administrator-repository';

export type UpdateAdministratorDeps = {
  readonly administrators: AdministratorRepository;
  readonly now?: () => Date;
};

export function createUpdateAdministrator(
  deps: UpdateAdministratorDeps,
): (actor: PlatformActor | null | undefined, input: unknown) => Promise<void> {
  const now = deps.now ?? (() => new Date());

  return async function updateAdministrator(
    actor: PlatformActor | null | undefined,
    input: unknown,
  ): Promise<void> {
    requirePlatformPermission(actor, 'empresas.modificar');

    const parsed = updateAdministratorSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const { id, ...data } = parsed.data;
    const outcome = await deps.administrators.update({
      id,
      data: { ...data, birthDate: toBirthDate(data.birthDate) },
      now: now(),
    });
    if (outcome === 'ok') return;
    if (outcome === 'not_found') throw new UserNotFoundError();
    if (outcome === 'invalid_document_type') throw new ValidationError();
    throwDuplicate(outcome);
  };
}
