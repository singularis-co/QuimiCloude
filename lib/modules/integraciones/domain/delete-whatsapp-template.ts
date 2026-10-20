import { requirePermission, type Actor } from './actor';
import { WhatsappTemplateNotFoundError } from './errors';
import { scopeOf } from './integraciones-scope';
import { isWhatsappTemplateId } from './list-whatsapp-templates';
import { requireTemplateConnection, templateFailureSecrets } from './template-connection';
import { templateGraphErrorOf } from './template-graph-failure';

import type { SecretCipher } from '../ports/secret-cipher';
import type { WhatsappConnectionRepository } from '../ports/whatsapp-connection-repository';
import type { WhatsappGraphClient } from '../ports/whatsapp-graph-client';
import type { WhatsappTemplateRepository } from '../ports/whatsapp-template-repository';

export type DeleteWhatsappTemplateDeps = {
  readonly connections: WhatsappConnectionRepository;
  readonly cipher: SecretCipher;
  readonly graph: Pick<WhatsappGraphClient, 'deleteTemplate'>;
  readonly templates: WhatsappTemplateRepository;
  readonly now?: () => Date;
};

/** Con `hsmId` Meta borra solo ese idioma; por nombre solo, borraría todos. */
export function createDeleteWhatsappTemplate(
  deps: DeleteWhatsappTemplateDeps,
): (id: string, actor: Actor | null | undefined) => Promise<{ readonly id: string }> {
  const now = deps.now ?? (() => new Date());

  return async function deleteWhatsappTemplate(id, actor) {
    requirePermission(actor);
    const scope = scopeOf(actor);

    if (!isWhatsappTemplateId(id)) throw new WhatsappTemplateNotFoundError();

    const { record: connection, accessToken } = await requireTemplateConnection(deps, scope);

    const template = await deps.templates.findLiveById(id, scope);
    if (template === null || template.connectionId !== connection.id) throw new WhatsappTemplateNotFoundError();

    const deleted = await deps.graph.deleteTemplate({
      wabaId: connection.wabaId,
      accessToken,
      hsmId: template.metaTemplateId,
      name: template.name,
    });
    if (!deleted.ok) {
      const secrets = await templateFailureSecrets(deps, connection, accessToken, scope);
      throw templateGraphErrorOf('delete', deleted, secrets);
    }

    // `false` solo si otra petición la marcó entre la lectura y aquí: Meta ya la borró igual.
    await deps.templates.markDeleted(template.id, now(), scope);
    return { id: template.id };
  };
}
