import { UNEXPECTED_ERROR_CODE } from '@/lib/modules/errores';

import { requirePermission, type Actor } from './actor';
import { ACCESS_TOKEN_FIELD, decryptStoredSecret } from './connection-secrets';
import { WhatsappMetaRejectedError } from './errors';
import { scopeOf, type IntegracionesScope } from './integraciones-scope';
import { requireTemplateConnection, templateFailureSecrets } from './template-connection';
import { templateGraphErrorOf } from './template-graph-failure';
import { planTemplateSync, templateSyncCounts } from './template-sync-plan';
import { resolveWebhookConnection, type WebhookConnectionDeps } from './webhook-connection';
import type { WhatsappConnectionRecord } from './whatsapp-connection';
import type { TemplateSyncSummary } from './whatsapp-template';
import { interpretMetaTemplate, type MetaTemplateSnapshot } from './whatsapp-template-meta';

import type { SecretCipher } from '../ports/secret-cipher';
import type { WhatsappConnectionRepository } from '../ports/whatsapp-connection-repository';
import type { WhatsappGraphClient } from '../ports/whatsapp-graph-client';
import type { WhatsappTemplateRepository } from '../ports/whatsapp-template-repository';

/** De 100 en 100: 2000 plantillas por conexión. */
export const MAX_TEMPLATE_PAGES = 20;

/** Solo lectura de Meta: la sincronización no puede crear ni borrar nada allí. */
export type SyncTemplatesGraph = Pick<WhatsappGraphClient, 'listTemplatesPage'>;

export type SyncConnectionTemplatesDeps = {
  readonly graph: SyncTemplatesGraph;
  readonly templates: WhatsappTemplateRepository;
  readonly cipher: SecretCipher;
  readonly now?: () => Date;
};

async function readAllPages(
  deps: SyncConnectionTemplatesDeps,
  connection: WhatsappConnectionRecord,
  accessToken: string,
  scope: IntegracionesScope,
): Promise<unknown[]> {
  const items: unknown[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_TEMPLATE_PAGES; page += 1) {
    const result = await deps.graph.listTemplatesPage({ wabaId: connection.wabaId, accessToken, after });
    if (!result.ok) {
      const secrets = await templateFailureSecrets(deps, connection, accessToken, scope);
      throw templateGraphErrorOf('sync', result, secrets);
    }
    items.push(...result.items);
    if (result.next === null) return items;
    after = result.next;
  }
  throw new WhatsappMetaRejectedError(`Graph listar plantillas: más de ${MAX_TEMPLATE_PAGES} páginas`);
}

/** Lee todas las páginas antes de escribir: una lista a medias borraría lo que falta. */
export async function syncConnectionTemplates(
  deps: SyncConnectionTemplatesDeps,
  connection: WhatsappConnectionRecord,
  accessToken: string,
  scope: IntegracionesScope,
): Promise<TemplateSyncSummary> {
  const now = deps.now ?? (() => new Date());
  const startedAt = now();

  const items = await readAllPages(deps, connection, accessToken, scope);
  const snapshots: MetaTemplateSnapshot[] = [];
  const protectedIds: string[] = [];
  let skipped = 0;
  for (const item of items) {
    const interpreted = interpretMetaTemplate(item);
    if (interpreted.ok) {
      snapshots.push(interpreted.template);
      continue;
    }
    skipped += 1;
    if (interpreted.metaTemplateId !== null) protectedIds.push(interpreted.metaTemplateId);
  }

  const locals = await deps.templates.listForSync(connection.id, scope);
  const plan = planTemplateSync({ locals, snapshots, protectedIds });
  const at = now();
  await deps.templates.applySync(connection.id, plan, startedAt, at, scope);

  return { ...templateSyncCounts(plan), skipped, syncedAt: at.toISOString() };
}

export type SyncWhatsappTemplatesDeps = SyncConnectionTemplatesDeps & {
  readonly connections: WhatsappConnectionRepository;
};

export function createSyncWhatsappTemplates(
  deps: SyncWhatsappTemplatesDeps,
): (actor: Actor | null | undefined) => Promise<TemplateSyncSummary> {
  return async function syncWhatsappTemplates(actor) {
    requirePermission(actor);
    const scope = scopeOf(actor);
    const { record, accessToken } = await requireTemplateConnection(deps, scope);
    return syncConnectionTemplates(deps, record, accessToken, scope);
  };
}

export type ResyncWhatsappTemplatesDeps = SyncWhatsappTemplatesDeps & WebhookConnectionDeps;

export type ResyncWhatsappTemplatesOutcome =
  | { readonly kind: 'synced'; readonly summary: TemplateSyncSummary }
  | { readonly kind: 'skipped'; readonly reason: 'missing' | 'addon_off' | 'disabled' }
  | { readonly kind: 'failed'; readonly code: string };

/** Solo el código del catálogo, nunca el mensaje: va a una línea de log. */
export function syncFailureCodeOf(error: unknown): string {
  if (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }
  return UNEXPECTED_ERROR_CODE;
}

/** Corre después de responder a Meta: no lanza, el fallo vuelve como resultado para el log. */
export function createResyncWhatsappTemplates(
  deps: ResyncWhatsappTemplatesDeps,
): (connectionId: string) => Promise<ResyncWhatsappTemplatesOutcome> {
  return async function resyncWhatsappTemplates(connectionId) {
    try {
      const resolved = await resolveWebhookConnection(deps, connectionId);
      if (resolved.kind !== 'ready') return { kind: 'skipped', reason: resolved.kind };
      const { record, scope } = resolved;
      const accessToken = await decryptStoredSecret(deps, record, ACCESS_TOKEN_FIELD, scope);
      return { kind: 'synced', summary: await syncConnectionTemplates(deps, record, accessToken, scope) };
    } catch (error) {
      return { kind: 'failed', code: syncFailureCodeOf(error) };
    }
  };
}
