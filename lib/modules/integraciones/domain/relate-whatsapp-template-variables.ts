import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import {
  ActionNotAllowedError,
  ValidationError,
  WhatsappTemplateNotFoundError,
  WhatsappTemplateNotMappableError,
  WhatsappTemplateNotMappedError,
  WhatsappVariableKeyNotFoundError,
} from './errors';
import { scopeOf, type IntegracionesScope } from './integraciones-scope';
import { isWhatsappTemplateId, ownKeyIndexOf, toWhatsappTemplateView } from './list-whatsapp-templates';
import type { WhatsappTemplateRecord, WhatsappTemplateView } from './whatsapp-template';
import { contentOf } from './whatsapp-template-components';
import {
  mappingStatusOf,
  variableSlotsOf,
  type TemplateSlot,
  type TemplateVariableBinding,
} from './whatsapp-template-variables';
import { isConstantKey, isOwnKey } from './whatsapp-variable-key';

import type { WhatsappConnectionRepository } from '../ports/whatsapp-connection-repository';
import type { WhatsappTemplateRepository } from '../ports/whatsapp-template-repository';
import type { WhatsappVariableKeyRepository } from '../ports/whatsapp-variable-key-repository';

export type RelateWhatsappTemplateVariablesDeps = {
  readonly connections: WhatsappConnectionRepository;
  readonly templates: WhatsappTemplateRepository;
  readonly variableKeys: Pick<WhatsappVariableKeyRepository, 'findByKeys' | 'listAll'>;
};

// La entrada lleva la clave y no el id: es lo que el usuario ve en `{{clave}}`.
const relateInputSchema = z.object({
  templateId: z.string(),
  bindings: z.array(z.object({ slot: z.string(), key: z.string() })),
});

const enabledInputSchema = z.object({ templateId: z.string(), enabled: z.boolean() });

/** No exige la conexión habilitada: relacionar y habilitar no llaman a Meta. */
async function requireLiveTemplate(
  deps: RelateWhatsappTemplateVariablesDeps,
  templateId: string,
  scope: IntegracionesScope,
): Promise<WhatsappTemplateRecord> {
  if (!isWhatsappTemplateId(templateId)) throw new WhatsappTemplateNotFoundError();
  const connection = await deps.connections.findLive(scope);
  if (connection === null) throw new WhatsappTemplateNotFoundError();
  const record = await deps.templates.findLiveById(templateId, scope);
  if (record === null || record.connectionId !== connection.id) throw new WhatsappTemplateNotFoundError();
  return record;
}

type RequestedBinding = { readonly slot: TemplateSlot; readonly key: string };

function requestedBindingsOf(
  slots: readonly TemplateSlot[],
  bindings: readonly { readonly slot: string; readonly key: string }[],
): RequestedBinding[] {
  const seen = new Set<string>();
  return bindings.map(({ slot, key }) => {
    const known = slots.find((candidate) => candidate === slot);
    if (known === undefined) throw new ValidationError(`hueco desconocido: ${slot}`);
    if (seen.has(known)) throw new ValidationError(`hueco repetido: ${slot}`);
    seen.add(known);
    if (!isConstantKey(key) && !isOwnKey(key)) throw new ValidationError(`clave sin forma valida en ${slot}`);
    return { slot: known, key };
  });
}

// Una constante no se busca en ningun sitio: la define el front y basta con su forma.
async function resolveBindings(
  deps: RelateWhatsappTemplateVariablesDeps,
  requested: readonly RequestedBinding[],
  scope: IntegracionesScope,
) {
  const ownKeys = [...new Set(requested.filter(({ key }) => !isConstantKey(key)).map(({ key }) => key))];
  const found = ownKeys.length === 0 ? [] : await deps.variableKeys.findByKeys(ownKeys, scope);
  const idByKey = new Map(found.map((record) => [record.key, record.id]));
  const bindings = requested.map(({ slot, key }): TemplateVariableBinding => {
    if (isConstantKey(key)) return { slot, kind: 'system', systemKey: key };
    const variableKeyId = idByKey.get(key);
    if (variableKeyId === undefined) throw new WhatsappVariableKeyNotFoundError();
    return { slot, kind: 'company', variableKeyId };
  });
  return { bindings, found };
}

/**
 * Sustituye todas las relaciones de la plantilla. Quedar relacionada no la habilita; quedar sin
 * relacionar sí la deshabilita, en la misma escritura.
 */
export function createRelateWhatsappTemplateVariables(
  deps: RelateWhatsappTemplateVariablesDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<WhatsappTemplateView> {
  return async function relateWhatsappTemplateVariables(input, actor) {
    requirePermission(actor);
    const scope = scopeOf(actor);

    const parsed = relateInputSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const record = await requireLiveTemplate(deps, parsed.data.templateId, scope);
    const slots = variableSlotsOf(contentOf(record.components));
    if (slots === null) throw new WhatsappTemplateNotMappableError();

    const requested = requestedBindingsOf(slots, parsed.data.bindings);
    const { bindings, found } = await resolveBindings(deps, requested, scope);

    const mappingStatus = mappingStatusOf(record.components, bindings);
    const mapping = { mappingStatus, enabled: mappingStatus === 'MAPPED' && record.enabled };
    const written = await deps.templates.replaceVariables(record.id, bindings, mapping, record.components, scope);
    if (!written) throw new ActionNotAllowedError('la plantilla cambió');

    return toWhatsappTemplateView({ ...record, ...mapping, variables: bindings }, ownKeyIndexOf(found));
  };
}

/** Habilitar no mira el estado de Meta: solo que esté relacionada. Deshabilitar no tiene condición. */
export function createSetWhatsappTemplateEnabled(
  deps: RelateWhatsappTemplateVariablesDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<WhatsappTemplateView> {
  return async function setWhatsappTemplateEnabled(input, actor) {
    requirePermission(actor);
    const scope = scopeOf(actor);

    const parsed = enabledInputSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { templateId, enabled } = parsed.data;

    const record = await requireLiveTemplate(deps, templateId, scope);
    if (enabled && record.mappingStatus !== 'MAPPED') throw new WhatsappTemplateNotMappedError();

    const written = await deps.templates.setEnabled(record.id, enabled, record.components, scope);
    if (!written) throw new ActionNotAllowedError('la plantilla cambió');

    const ownKeys = ownKeyIndexOf(await deps.variableKeys.listAll(scope));
    return toWhatsappTemplateView({ ...record, enabled }, ownKeys);
  };
}
