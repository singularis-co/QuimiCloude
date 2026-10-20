import { requirePermission, type Actor } from './actor';
import { ValidationError, WhatsappTemplateNameTakenError } from './errors';
import { scopeOf } from './integraciones-scope';
import { toWhatsappTemplateView } from './list-whatsapp-templates';
import { requireTemplateConnection, templateFailureSecrets } from './template-connection';
import { templateGraphErrorOf } from './template-graph-failure';
import { isWhatsappTemplateCategory, type WhatsappTemplateView } from './whatsapp-template';
import { toMetaComponents } from './whatsapp-template-components';
import { validateWhatsappTemplateDraft } from './whatsapp-template-draft';

import type { SecretCipher } from '../ports/secret-cipher';
import type { WhatsappConnectionRepository } from '../ports/whatsapp-connection-repository';
import type { WhatsappGraphClient } from '../ports/whatsapp-graph-client';
import type { WhatsappTemplateRepository } from '../ports/whatsapp-template-repository';

export type CreateWhatsappTemplateDeps = {
  readonly connections: WhatsappConnectionRepository;
  readonly cipher: SecretCipher;
  readonly graph: Pick<WhatsappGraphClient, 'createTemplate'>;
  readonly templates: WhatsappTemplateRepository;
  readonly now?: () => Date;
};

/**
 * Nace `PENDING` aunque Meta conteste otro estado: el webhook o la siguiente sincronización lo
 * ponen al día. La categoría sí se guarda la de Meta, porque puede reclasificarla al crear.
 */
export function createCreateWhatsappTemplate(
  deps: CreateWhatsappTemplateDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<WhatsappTemplateView> {
  const now = deps.now ?? (() => new Date());

  return async function createWhatsappTemplate(input, actor) {
    requirePermission(actor);
    const scope = scopeOf(actor);

    const validated = validateWhatsappTemplateDraft(input);
    if (!validated.ok) {
      const codes = validated.issues.map((issue) => `${issue.field}:${issue.code}`).join(', ');
      throw new ValidationError(`borrador de plantilla: ${codes}`);
    }
    const draft = validated.draft;

    const { record: connection, accessToken } = await requireTemplateConnection(deps, scope);

    const taken = await deps.templates.findLiveByNameAndLanguage(connection.id, draft.name, draft.language, scope);
    if (taken !== null) throw new WhatsappTemplateNameTakenError();

    const components = toMetaComponents(draft);
    const created = await deps.graph.createTemplate({
      wabaId: connection.wabaId,
      accessToken,
      name: draft.name,
      language: draft.language,
      category: draft.category,
      components,
    });
    if (!created.ok) {
      const secrets = await templateFailureSecrets(deps, connection, accessToken, scope);
      throw templateGraphErrorOf('create', created, secrets);
    }

    const category =
      created.category !== null && isWhatsappTemplateCategory(created.category) ? created.category : draft.category;
    const record = await deps.templates.insertCreated(
      {
        metaTemplateId: created.id,
        name: draft.name,
        language: draft.language,
        category,
        components,
        status: 'PENDING',
        createdById: actor.id,
        lastSyncedAt: now(),
      },
      connection.id,
      scope,
    );
    return toWhatsappTemplateView(record);
  };
}
