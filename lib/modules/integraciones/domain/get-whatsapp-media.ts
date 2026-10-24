import type { CustomerCatalog } from '@/lib/modules/clientes';

import { requireReadPermission, type Actor } from './actor';
import { ACCESS_TOKEN_FIELD, decryptStoredSecret } from './connection-secrets';
import { SecretUnreadableError, ValidationError, WhatsappMessageNotFoundError } from './errors';
import { scopeOf } from './integraciones-scope';
import { getWhatsappMediaSchema } from './whatsapp-conversation-input';
import { isAllowedMediaContentType, isViewableMediaType, mediaIdOf, WHATSAPP_MEDIA_MAX_BYTES } from './whatsapp-media';

import type { SecretCipher } from '../ports/secret-cipher';
import type { WhatsappConnectionRepository } from '../ports/whatsapp-connection-repository';
import type { WhatsappConversationRepository } from '../ports/whatsapp-conversation-repository';
import type { WhatsappGraphClient } from '../ports/whatsapp-graph-client';

export type GetWhatsappMediaDeps = {
  readonly connections: WhatsappConnectionRepository;
  readonly conversations: Pick<WhatsappConversationRepository, 'findMediaMessage'>;
  readonly customers: Pick<CustomerCatalog, 'findAliveRefById'>;
  readonly graph: Pick<WhatsappGraphClient, 'downloadMedia'>;
  readonly cipher: SecretCipher;
};

/** `unavailable` = el medio existe y se puede ver, pero Meta no lo sirve ahora. */
export type WhatsappMediaResult =
  | {
      readonly kind: 'file';
      readonly contentType: string;
      readonly contentLength: number | null;
      readonly body: ReadableStream<Uint8Array>;
    }
  | { readonly kind: 'unavailable' };

const UNAVAILABLE: WhatsappMediaResult = { kind: 'unavailable' };

async function discard(body: ReadableStream<Uint8Array>): Promise<void> {
  try {
    await body.cancel();
  } catch {
    // Ya se responde «no disponible»; un fallo al soltar la conexión no cambia eso.
  }
}

/**
 * Todas las razones por las que el mensaje no se puede ver dan el mismo «no encontrado», y
 * ninguna llama a Meta. El archivo pasa como stream: no se guarda nada.
 */
export function createGetWhatsappMedia(
  deps: GetWhatsappMediaDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<WhatsappMediaResult> {
  return async function getWhatsappMedia(input, actor) {
    requireReadPermission(actor);
    const scope = scopeOf(actor);

    const parsed = getWhatsappMediaSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const connection = await deps.connections.findLive(scope);
    if (connection === null) throw new WhatsappMessageNotFoundError();

    const message = await deps.conversations.findMediaMessage(parsed.data.messageId, connection.id, scope);
    if (message === null || message.direction !== 'IN' || !isViewableMediaType(message.type)) {
      throw new WhatsappMessageNotFoundError();
    }
    const mediaId = mediaIdOf(message.payload);
    if (mediaId === null || message.customerId === null) throw new WhatsappMessageNotFoundError();
    const customer = await deps.customers.findAliveRefById(message.customerId, scope.companyId);
    if (customer === null) throw new WhatsappMessageNotFoundError();

    let accessToken: string;
    try {
      accessToken = await decryptStoredSecret(deps, connection, ACCESS_TOKEN_FIELD, scope);
    } catch (error) {
      if (error instanceof SecretUnreadableError) return UNAVAILABLE;
      throw error;
    }

    const download = await deps.graph.downloadMedia({ mediaId, accessToken, maxBytes: WHATSAPP_MEDIA_MAX_BYTES });
    if (!download.ok) return UNAVAILABLE;
    if (!isAllowedMediaContentType(download.contentType)) {
      await discard(download.body);
      return UNAVAILABLE;
    }
    return {
      kind: 'file',
      contentType: download.contentType.toLowerCase(),
      contentLength: download.contentLength,
      body: download.body,
    };
  };
}
