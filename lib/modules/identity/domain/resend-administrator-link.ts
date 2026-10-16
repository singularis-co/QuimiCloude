import { administratorIdSchema } from './administrator-input';
import { resendCredentialSetupLinkTo } from './credential-setup-mail';
import { UserNotFoundError, ValidationError } from './errors';
import { requirePlatformPermission, type PlatformActor } from './platform-actor';

import type { AdministratorRepository } from '../ports/administrator-repository';
import type { CredentialSetupLinkRepository } from '../ports/credential-setup-link-repository';
import type { CredentialSetupMailer } from '../ports/credential-setup-mailer';
import type { CredentialSetupSecretFactory } from '../ports/credential-setup-secret-factory';

export type ResendAdministratorLinkDeps = {
  readonly administrators: AdministratorRepository;
  readonly secrets: CredentialSetupSecretFactory;
  readonly links: CredentialSetupLinkRepository;
  readonly mailer: CredentialSetupMailer;
  readonly now?: () => Date;
};

// Ni el secreto ni el destinatario: los dos se quedan en este caso de uso.
export type ResendAdministratorLinkResult = { readonly mail: 'sent' | 'failed' };

type IdIssue = { readonly code: string; readonly path: readonly PropertyKey[] };

// Un identificador bien colocado pero mal formado es un Administrador que no existe; cualquier otra
// forma (una clave de mas, como un correo de destino) es una entrada invalida.
function onlyMalformedId(issues: readonly IdIssue[]): boolean {
  return issues.every((issue) => issue.code === 'invalid_format' && issue.path[0] === 'id');
}

export function createResendAdministratorLink(
  deps: ResendAdministratorLinkDeps,
): (actor: PlatformActor | null | undefined, input: unknown) => Promise<ResendAdministratorLinkResult> {
  const now = deps.now ?? (() => new Date());

  return async function resendAdministratorLink(
    actor: PlatformActor | null | undefined,
    input: unknown,
  ): Promise<ResendAdministratorLinkResult> {
    requirePlatformPermission(actor, 'empresas.modificar');

    const parsed = administratorIdSchema.safeParse(input);
    if (!parsed.success) {
      throw onlyMalformedId(parsed.error.issues) ? new UserNotFoundError() : new ValidationError();
    }

    const administrator = await deps.administrators.findManageable(parsed.data.id);
    if (administrator === null) throw new UserNotFoundError();

    const mail = await resendCredentialSetupLinkTo(deps, {
      userId: administrator.id,
      companyId: administrator.company.id,
      now: now(),
    });
    return { mail };
  };
}
