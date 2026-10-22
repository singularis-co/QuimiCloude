import { createAdministratorSchema } from './administrator-input';
import { toBirthDate } from './birth-date';
import { throwDuplicate } from './create-user';
import { sendCredentialSetupLink } from './credential-setup-mail';
import { CompanyNotFoundError, ValidationError } from './errors';
import { requirePlatformPermission, type PlatformActor } from './platform-actor';

import type { AdministratorRepository } from '../ports/administrator-repository';
import type { CredentialSetupLinkRepository } from '../ports/credential-setup-link-repository';
import type { CredentialSetupMailer } from '../ports/credential-setup-mailer';
import type { CredentialSetupSecretFactory } from '../ports/credential-setup-secret-factory';

export type CreateAdministratorDeps = {
  readonly administrators: AdministratorRepository;
  readonly secrets: CredentialSetupSecretFactory;
  readonly links: CredentialSetupLinkRepository;
  readonly mailer: CredentialSetupMailer;
  readonly now?: () => Date;
};

// Sin el secreto del enlace: no sale de este caso de uso.
export type CreateAdministratorResult = {
  readonly administratorId: string;
  readonly mail: 'sent' | 'failed';
};

export function createCreateAdministrator(
  deps: CreateAdministratorDeps,
): (actor: PlatformActor | null | undefined, input: unknown) => Promise<CreateAdministratorResult> {
  const now = deps.now ?? (() => new Date());

  return async function createAdministrator(
    actor: PlatformActor | null | undefined,
    input: unknown,
  ): Promise<CreateAdministratorResult> {
    requirePlatformPermission(actor, 'empresas.modificar');

    const parsed = createAdministratorSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const { companyId, ...administrator } = parsed.data;
    const instante = now();

    const created = await deps.administrators.create({
      companyId,
      administrator: { ...administrator, birthDate: toBirthDate(administrator.birthDate) },
      now: instante,
    });
    if (created === 'company_not_found') throw new CompanyNotFoundError();
    if (created === 'invalid_document_type') throw new ValidationError();
    if (typeof created === 'string') throwDuplicate(created);

    const { administratorId } = created;
    const mail = await sendCredentialSetupLink(deps, companyId, administratorId, instante);
    return { administratorId, mail };
  };
}
