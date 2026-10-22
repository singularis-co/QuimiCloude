import type { IntegracionesScope } from './integraciones-scope';
import type { WhatsappConnectionRecord } from './whatsapp-connection';
import { isWhatsappConnectionId } from './whatsapp-connection-input';

import type { IntegrationsSwitch } from '../ports/integrations-switch';
import type { WhatsappConnectionRepository } from '../ports/whatsapp-connection-repository';
import type { WhatsappWebhookDirectory } from '../ports/whatsapp-webhook-directory';

export type WebhookConnectionDeps = {
  readonly directory: WhatsappWebhookDirectory;
  readonly integrations: IntegrationsSwitch;
  readonly connections: WhatsappConnectionRepository;
};

export type WebhookConnection =
  | { readonly kind: 'missing' }
  | { readonly kind: 'addon_off' }
  | { readonly kind: 'disabled' }
  | {
      readonly kind: 'ready';
      readonly record: WhatsappConnectionRecord;
      readonly scope: IntegracionesScope;
    };

/**
 * Meta no trae sesión: la empresa sale de la fila de la conexión, nunca de la petición. Un id que
 * no es UUID no llega a la base.
 */
export async function resolveWebhookConnection(
  deps: WebhookConnectionDeps,
  connectionId: string,
): Promise<WebhookConnection> {
  if (!isWhatsappConnectionId(connectionId)) return { kind: 'missing' };

  const companyId = await deps.directory.companyOfConnection(connectionId);
  if (companyId === null) return { kind: 'missing' };

  // Con el añadido apagado, los mensajes que lleguen se descartan como si la conexión lo estuviera.
  if (!(await deps.integrations.isOn(companyId))) return { kind: 'addon_off' };

  const scope: IntegracionesScope = { companyId };
  const record = await deps.connections.findLiveById(connectionId, scope);
  if (record === null) return { kind: 'missing' };
  if (record.status === 'DISABLED') return { kind: 'disabled' };

  return { kind: 'ready', record, scope };
}
