import { requirePermission, type Actor } from './actor';
import { ValidationError, WhatsappTemplateNameTakenError } from './errors';
import { scopeOf, type IntegracionesScope } from './integraciones-scope';
import { ownKeyIndexOf, toWhatsappTemplateView } from './list-whatsapp-templates';
import { requireTemplateConnection, templateFailureSecrets } from './template-connection';
import { templateGraphErrorOf } from './template-graph-failure';
import { isWhatsappTemplateCategory, type WhatsappTemplateRecord, type WhatsappTemplateView } from './whatsapp-template';
import { contentOf, toMetaComponents } from './whatsapp-template-components';
import { validateKeyedTemplateDraft } from './whatsapp-template-keyed-draft';
import {
  mappingStatusOf,
  variableSlotsOf,
  type TemplateSlot,
  type TemplateVariableBinding,
} from './whatsapp-template-variables';

import type { SecretCipher } from '../ports/secret-cipher';
import type { WhatsappConnectionRepository } from '../ports/whatsapp-connection-repository';
import type { WhatsappGraphClient } from '../ports/whatsapp-graph-client';
import type { WhatsappTemplateRepository } from '../ports/whatsapp-template-repository';
import type { WhatsappVariableKeyRepository } from '../ports/whatsapp-variable-key-repository';

export type CreateWhatsappTemplateDeps = {
  readonly connections: WhatsappConnectionRepository;
  readonly cipher: SecretCipher;
  readonly graph: Pick<WhatsappGraphClient, 'createTemplate'>;
  readonly templates: WhatsappTemplateRepository;
  readonly variableKeys: Pick<WhatsappVariableKeyRepository, 'listAll'>;
  readonly now?: () => Date;
};

function sameSlots(a: readonly TemplateSlot[] | null, b: readonly TemplateSlot[]): boolean {
  if (a === null || a.length !== b.length) return false;
  const inB = new Set(b);
  return a.every((slot) => inB.has(slot));
}

/**
 * Si la sincronización ya había guardado la plantilla, gana su fila: se le pone la relación de la
 * creación solo si no tiene ninguna y sus huecos son los creados.
 */
async function adoptRaceRow(
  deps: CreateWhatsappTemplateDeps,
  record: WhatsappTemplateRecord,
  bindings: readonly TemplateVariableBinding[],
  scope: IntegracionesScope,
): Promise<WhatsappTemplateRecord> {
  const slots = variableSlotsOf(contentOf(record.components));
  if (record.variables.length > 0 || !sameSlots(slots, bindings.map((binding) => binding.slot))) return record;
  const mappingStatus = mappingStatusOf(record.components, bindings);
  const mapping = { mappingStatus, enabled: mappingStatus === 'MAPPED' };
  const replaced = await deps.templates.replaceVariables(record.id, bindings, mapping, record.components, scope);
  return replaced ? { ...record, ...mapping, variables: bindings } : record;
}

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

    const ownKeys = await deps.variableKeys.listAll(scope);
    const validated = validateKeyedTemplateDraft(input, ownKeys);
    if (!validated.ok) {
      const codes = validated.issues.map((issue) => `${issue.field}:${issue.code}`).join(', ');
      throw new ValidationError(`borrador de plantilla: ${codes}`);
    }
    const { draft, bindings } = validated;

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
    const mappingStatus = mappingStatusOf(components, bindings);
    const { record, inserted } = await deps.templates.insertCreated(
      {
        metaTemplateId: created.id,
        name: draft.name,
        language: draft.language,
        category,
        components,
        status: 'PENDING',
        createdById: actor.id,
        lastSyncedAt: now(),
        variables: bindings,
        mappingStatus,
        enabled: mappingStatus === 'MAPPED',
      },
      connection.id,
      scope,
    );
    const final = inserted ? record : await adoptRaceRow(deps, record, bindings, scope);
    return toWhatsappTemplateView(final, ownKeyIndexOf(ownKeys));
  };
}
