import { toBirthDate } from './birth-date';
import { createCompanySchema, toCompanyWrite } from './company-input';
import { throwDuplicate } from './create-user';
import { credentialSetupLinkExpiresAt } from './credential-setup-link';
import { CompanyDuplicateNameError, CompanyDuplicateTaxIdError, ValidationError } from './errors';
import { requirePlatformPermission, type PlatformActor } from './platform-actor';

import type { CompanyRepository } from '../ports/company-repository';
import type { CredentialSetupLinkRepository } from '../ports/credential-setup-link-repository';
import type { CredentialSetupMailer } from '../ports/credential-setup-mailer';
import type { CredentialSetupSecretFactory } from '../ports/credential-setup-secret-factory';

export type CreateCompanyDeps = {
  readonly companies: CompanyRepository;
  readonly secrets: CredentialSetupSecretFactory;
  readonly links: CredentialSetupLinkRepository;
  readonly mailer: CredentialSetupMailer;
  readonly now?: () => Date;
};

// Sin el secreto del enlace: no sale de este caso de uso.
export type CreateCompanyResult = {
  readonly companyId: string;
  readonly administratorId: string;
  readonly mail: 'sent' | 'failed';
};

export function createCreateCompany(
  deps: CreateCompanyDeps,
): (actor: PlatformActor | null | undefined, input: unknown) => Promise<CreateCompanyResult> {
  const now = deps.now ?? (() => new Date());

  return async function createCompany(
    actor: PlatformActor | null | undefined,
    input: unknown,
  ): Promise<CreateCompanyResult> {
    requirePlatformPermission(actor, 'empresas.modificar');

    const parsed = createCompanySchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const company = toCompanyWrite(parsed.data.company);
    const { administrator } = parsed.data;
    const instante = now();

    const created = await deps.companies.createWithAdministrator({
      company,
      administrator: { ...administrator, birthDate: toBirthDate(administrator.birthDate) },
      actorId: actor.id,
      now: instante,
    });
    if (created === 'duplicate_name') throw new CompanyDuplicateNameError();
    if (created === 'duplicate_tax_id') throw new CompanyDuplicateTaxIdError();
    if (created === 'invalid_document_type') throw new ValidationError();
    if (typeof created === 'string') throwDuplicate(created);

    const { companyId, administratorId } = created;
    const mail = await sendCredentialSetupLink(deps, companyId, administratorId, instante);
    return { companyId, administratorId, mail };
  };
}

// El enlace se emite despues del alta y fuera de su transaccion: si falla, la empresa queda creada
// y se informa como correo no enviado.
async function sendCredentialSetupLink(
  deps: CreateCompanyDeps,
  companyId: string,
  administratorId: string,
  instante: Date,
): Promise<'sent' | 'failed'> {
  const { secret, digest } = deps.secrets.create();
  const emision = await deps.links.issueForPendingUser({
    userId: administratorId,
    companyId,
    digest,
    expiresAt: credentialSetupLinkExpiresAt(instante),
    now: instante,
  });

  if (typeof emision === 'object') {
    return deps.mailer.sendCredentialSetupLink({ to: emision.email, secret });
  }
  // Otra emision simultanea gano y ya envio su correo.
  if (emision === 'superseded') return 'sent';
  return 'failed';
}
