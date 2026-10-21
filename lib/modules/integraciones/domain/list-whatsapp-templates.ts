import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { ValidationError, WhatsappTemplateNotFoundError } from './errors';
import { scopeOf } from './integraciones-scope';
import type {
  WhatsappTemplateList,
  WhatsappTemplateRecord,
  WhatsappTemplateVariableView,
  WhatsappTemplateView,
} from './whatsapp-template';
import { contentOf } from './whatsapp-template-components';
import { showKeys, variableSlotsOf, type TemplateSlot } from './whatsapp-template-variables';
import type { WhatsappVariableKeyRecord } from './whatsapp-variable-key';

import type { WhatsappConnectionRepository } from '../ports/whatsapp-connection-repository';
import type { WhatsappTemplateRepository } from '../ports/whatsapp-template-repository';
import type { WhatsappVariableKeyRepository } from '../ports/whatsapp-variable-key-repository';

export type ListWhatsappTemplatesDeps = {
  readonly connections: WhatsappConnectionRepository;
  readonly templates: WhatsappTemplateRepository;
  readonly variableKeys: Pick<WhatsappVariableKeyRepository, 'listAll'>;
};

/** Las variables propias de la empresa por id: las relaciones guardan el id, la vista muestra la clave. */
export type OwnKeyIndex = ReadonlyMap<string, Pick<WhatsappVariableKeyRecord, 'key' | 'label'>>;

export function ownKeyIndexOf(records: readonly Pick<WhatsappVariableKeyRecord, 'id' | 'key' | 'label'>[]): OwnKeyIndex {
  return new Map(records.map((record) => [record.id, { key: record.key, label: record.label }]));
}

const listInputSchema = z.object({ onlyApproved: z.boolean().optional() });
const templateIdSchema = z.string().uuid();

/** Un id sin forma de uuid no puede existir en la base: se trata como no encontrado sin ir al puerto. */
export function isWhatsappTemplateId(id: unknown): id is string {
  return templateIdSchema.safeParse(id).success;
}

function positionOf(slot: TemplateSlot): number {
  return slot.startsWith('body.') ? Number(slot.slice('body.'.length)) : 1;
}

// La etiqueta de una constante la conoce el front: la vista solo trae su clave.
function variableViewOf(
  slot: TemplateSlot,
  record: WhatsappTemplateRecord,
  ownKeys: OwnKeyIndex,
): WhatsappTemplateVariableView {
  const position = positionOf(slot);
  const binding = record.variables.find((candidate) => candidate.slot === slot);
  if (binding === undefined) return { slot, position, kind: null, key: null, label: null };
  if (binding.kind === 'system') return { slot, position, kind: 'system', key: binding.systemKey, label: null };
  const own = ownKeys.get(binding.variableKeyId);
  return { slot, position, kind: 'company', key: own?.key ?? null, label: own?.label ?? null };
}

/**
 * Campo a campo y sin spread: un campo nuevo de la fila no llega a la vista sin escribirlo aquí. El
 * estado del mapeo es el guardado: la vista no lo recalcula.
 */
export function toWhatsappTemplateView(record: WhatsappTemplateRecord, ownKeys: OwnKeyIndex): WhatsappTemplateView {
  const content = contentOf(record.components);
  const keyBySlot = new Map<TemplateSlot, string>();
  const variables = (variableSlotsOf(content) ?? []).map((slot) => {
    const view = variableViewOf(slot, record, ownKeys);
    if (view.key !== null) keyBySlot.set(slot, view.key);
    return view;
  });
  return {
    id: record.id,
    name: record.name,
    language: record.language,
    category: record.category,
    status: record.status,
    statusRaw: record.statusRaw,
    rejectedReason: record.rejectedReason,
    content: content === null ? null : showKeys(content, keyBySlot),
    lastSyncedAt: record.lastSyncedAt === null ? null : record.lastSyncedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    mappingStatus: record.mappingStatus,
    enabled: record.enabled,
    variables,
  };
}

/** Leer la copia local no toca Meta: no exige que la conexión esté habilitada. */
export function createListWhatsappTemplates(
  deps: ListWhatsappTemplatesDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<WhatsappTemplateList> {
  return async function listWhatsappTemplates(input, actor) {
    requirePermission(actor);
    const scope = scopeOf(actor);

    const parsed = listInputSchema.safeParse(input ?? {});
    if (!parsed.success) throw new ValidationError();

    const connection = await deps.connections.findLive(scope);
    if (connection === null) return { templates: [], templatesSyncedAt: null };

    const records = await deps.templates.listLive(
      connection.id,
      { onlyApproved: parsed.data.onlyApproved ?? false },
      scope,
    );
    const ownKeys = ownKeyIndexOf(await deps.variableKeys.listAll(scope));
    return {
      templates: records.map((record) => toWhatsappTemplateView(record, ownKeys)),
      templatesSyncedAt:
        connection.templatesSyncedAt === null ? null : connection.templatesSyncedAt.toISOString(),
    };
  };
}

export function createGetWhatsappTemplate(
  deps: ListWhatsappTemplatesDeps,
): (id: string, actor: Actor | null | undefined) => Promise<WhatsappTemplateView> {
  return async function getWhatsappTemplate(id, actor) {
    requirePermission(actor);
    const scope = scopeOf(actor);

    if (!isWhatsappTemplateId(id)) throw new WhatsappTemplateNotFoundError();
    const connection = await deps.connections.findLive(scope);
    if (connection === null) throw new WhatsappTemplateNotFoundError();
    const record = await deps.templates.findLiveById(id, scope);
    if (record === null || record.connectionId !== connection.id) throw new WhatsappTemplateNotFoundError();
    return toWhatsappTemplateView(record, ownKeyIndexOf(await deps.variableKeys.listAll(scope)));
  };
}
