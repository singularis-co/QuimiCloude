import { credentialSetupLinkExpiresAt } from './credential-setup-link';
import { UserNotFoundError, UserNotPendingError } from './errors';

import type { CredentialSetupLinkRepository } from '../ports/credential-setup-link-repository';
import type { CredentialSetupMailer } from '../ports/credential-setup-mailer';
import type { CredentialSetupSecretFactory } from '../ports/credential-setup-secret-factory';

export type CredentialSetupMailDeps = {
  readonly secrets: CredentialSetupSecretFactory;
  readonly links: CredentialSetupLinkRepository;
  readonly mailer: CredentialSetupMailer;
};

export type CredentialSetupTarget = {
  readonly userId: string;
  readonly companyId: string;
  readonly now: Date;
};

// Para el alta: el enlace se emite despues y fuera de su transaccion, asi que si falla el usuario
// queda creado y se informa como correo no enviado.
export async function sendCredentialSetupLink(
  deps: CredentialSetupMailDeps,
  companyId: string,
  userId: string,
  now: Date,
): Promise<'sent' | 'failed'> {
  const { secret, digest } = deps.secrets.create();
  const emision = await deps.links.issueForPendingUser({
    userId,
    companyId,
    digest,
    expiresAt: credentialSetupLinkExpiresAt(now),
    now,
  });

  if (typeof emision === 'object') {
    return deps.mailer.sendCredentialSetupLink({ to: emision.email, secret });
  }
  // Otra emision simultanea gano y ya envio su correo.
  if (emision === 'superseded') return 'sent';
  return 'failed';
}

// Para el reenvio: el usuario llega del llamante, asi que un objetivo que no sirve es un error.
// El destinatario lo resuelve el repositorio, nunca la entrada, para que el ERP no sirva de
// reenviador hacia una direccion ajena.
export async function resendCredentialSetupLinkTo(
  deps: CredentialSetupMailDeps,
  target: CredentialSetupTarget,
): Promise<'sent' | 'failed'> {
  // El secreto va antes de saber si el usuario sirve: el repositorio resuelve al usuario e
  // inserta en la misma transaccion. Si no sirve, el secreto no se persiste ni se envia.
  const { secret, digest } = deps.secrets.create();
  const emision = await deps.links.issueForPendingUser({
    userId: target.userId,
    companyId: target.companyId,
    digest,
    expiresAt: credentialSetupLinkExpiresAt(target.now),
    now: target.now,
  });

  if (typeof emision === 'object') {
    return deps.mailer.sendCredentialSetupLink({ to: emision.email, secret });
  }
  if (emision === 'not_found') throw new UserNotFoundError();
  if (emision === 'user_not_pending') throw new UserNotPendingError();
  // Otra emision simultanea gano y ya envio su correo: no se manda un segundo.
  if (emision === 'superseded') return 'sent';
  // Emitido sin destinatario: no hay a quien escribir, y un fallo de correo no hace fallar la
  // operacion.
  return 'failed';
}
