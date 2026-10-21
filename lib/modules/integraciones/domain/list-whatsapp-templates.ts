import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { ValidationError, WhatsappTemplateNotFoundError } from './errors';
import { scopeOf } from './integraciones-scope';
import type { WhatsappTemplateList, WhatsappTemplateRecord, WhatsappTemplateView } from './whatsapp-template';
import { contentOf } from './whatsapp-template-components';

import type { WhatsappConnectionRepository } from '../ports/whatsapp-connection-repository';
import type { WhatsappTemplateRepository } from '../ports/whatsapp-template-repository';

export type ListWhatsappTemplatesDeps = {
  readonly connections: WhatsappConnectionRepository;
  readonly templates: WhatsappTemplateRepository;
};

const listInputSchema = z.object({ onlyApproved: z.boolean().optional() });
const templateIdSchema = z.string().uuid();

/** Un id sin forma de uuid no puede existir en la base: se trata como no encontrado sin ir al puerto. */
export function isWhatsappTemplateId(id: unknown): id is string {
  return templateIdSchema.safeParse(id).success;
}

/** Campo a campo y sin spread: un campo nuevo de la fila no llega a la vista sin escribirlo aquí. */
export function toWhatsappTemplateView(record: WhatsappTemplateRecord): WhatsappTemplateView {
  return {
    id: record.id,
    name: record.name,
    language: record.language,
    category: record.category,
    status: record.status,
    statusRaw: record.statusRaw,
    rejectedReason: record.rejectedReason,
    content: contentOf(record.components),
    lastSyncedAt: record.lastSyncedAt === null ? null : record.lastSyncedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    mappingStatus: record.mappingStatus,
    enabled: record.enabled,
    variables: [],
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
    return {
      templates: records.map(toWhatsappTemplateView),
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
    return toWhatsappTemplateView(record);
  };
}
