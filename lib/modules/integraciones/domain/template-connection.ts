import { ACCESS_TOKEN_FIELD, APP_SECRET_FIELD, decryptStoredSecret, readStoredSecret } from './connection-secrets';
import { ActionNotAllowedError, SecretUnreadableError, WhatsappConnectionNotFoundError } from './errors';
import type { IntegracionesScope } from './integraciones-scope';
import type { WhatsappConnectionRecord } from './whatsapp-connection';

import type { SecretCipher } from '../ports/secret-cipher';
import type { WhatsappConnectionRepository } from '../ports/whatsapp-connection-repository';

export type TemplateConnectionDeps = {
  readonly connections: WhatsappConnectionRepository;
  readonly cipher: SecretCipher;
};

export type TemplateConnection = {
  readonly record: WhatsappConnectionRecord;
  readonly accessToken: string;
};

/**
 * `PENDING` y `ERROR` se aceptan: el token puede funcionar aunque el webhook no se haya verificado.
 * El App Secret no se descifra: las llamadas de plantillas no lo usan.
 */
export async function requireTemplateConnection(
  deps: TemplateConnectionDeps,
  scope: IntegracionesScope,
): Promise<TemplateConnection> {
  const record = await deps.connections.findLive(scope);
  if (record === null) throw new WhatsappConnectionNotFoundError();
  if (record.status === 'DISABLED') throw new ActionNotAllowedError('conexión deshabilitada');
  const accessToken = await decryptStoredSecret(deps, record, ACCESS_TOKEN_FIELD, scope);
  return { record, accessToken };
}

/** Los secretos que se tachan del texto de Meta: el App Secret solo se lee si hay un fallo que tachar. */
export async function templateFailureSecrets(
  deps: { readonly cipher: SecretCipher },
  record: WhatsappConnectionRecord,
  accessToken: string,
  scope: IntegracionesScope,
): Promise<readonly string[]> {
  try {
    return [accessToken, await readStoredSecret(deps, record, APP_SECRET_FIELD, scope)];
  } catch (error) {
    if (error instanceof SecretUnreadableError) return [accessToken];
    throw error;
  }
}
