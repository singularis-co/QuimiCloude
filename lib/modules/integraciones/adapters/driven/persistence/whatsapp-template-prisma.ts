import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { WhatsappTemplateNameTakenError } from '../../../domain/errors';

import {
  companyScopeColumns,
  whatsappConnectionCompanyScope,
  whatsappTemplateCompanyScope,
} from './company-scope';

import type { IntegracionesScope } from '../../../domain/integraciones-scope';
import type { TemplateSyncPlan } from '../../../domain/template-sync-plan';
import type { TemplateWebhookUpdate, WhatsappTemplateRecord } from '../../../domain/whatsapp-template';
import type { MetaTemplateSnapshot } from '../../../domain/whatsapp-template-meta';
import type { NewCreatedTemplateRow, TemplateSyncRow } from '../../../ports/whatsapp-template-repository';

/** Exactamente los campos de `WhatsappTemplateRecord`. */
const TEMPLATE_SELECT = {
  id: true,
  companyId: true,
  connectionId: true,
  metaTemplateId: true,
  name: true,
  language: true,
  category: true,
  components: true,
  status: true,
  statusRaw: true,
  rejectedReason: true,
  lastSyncedAt: true,
  createdById: true,
  createdAt: true,
  deletedAt: true,
} satisfies Prisma.WhatsappTemplateSelect;

const SYNC_SELECT = {
  id: true,
  metaTemplateId: true,
  name: true,
  language: true,
  category: true,
  status: true,
  statusRaw: true,
  rejectedReason: true,
  components: true,
  deletedAt: true,
} satisfies Prisma.WhatsappTemplateSelect;

type TemplateRow = Prisma.WhatsappTemplateGetPayload<{ select: typeof TEMPLATE_SELECT }>;

function toRecord(row: TemplateRow): WhatsappTemplateRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    connectionId: row.connectionId,
    metaTemplateId: row.metaTemplateId,
    name: row.name,
    language: row.language,
    category: row.category,
    components: row.components,
    status: row.status,
    statusRaw: row.statusRaw,
    rejectedReason: row.rejectedReason,
    lastSyncedAt: row.lastSyncedAt,
    createdById: row.createdById,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
  };
}

/** Los componentes vienen de un JSON (de Meta o del borrador): ya son JSON válido. */
function jsonOf(components: unknown): Prisma.InputJsonValue {
  return components as Prisma.InputJsonValue;
}

function syncedFields(template: MetaTemplateSnapshot) {
  return {
    name: template.name,
    language: template.language,
    category: template.category,
    status: template.status,
    statusRaw: template.statusRaw,
    rejectedReason: template.rejectedReason,
    components: jsonOf(template.components),
  };
}

/** Vive solo en la migración; un SQL crudo lo nombra en el texto del error de Postgres. */
const NAME_LANGUAGE_LIVE_INDEX = 'whatsapp_templates_name_language_live_key';
const UNIQUE_VIOLATION = '23505';

/** El SQLSTATE sale del campo estructurado del conector, nunca del texto traducido del mensaje. */
function sqlStateOf(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta: unknown = error.meta;
    if (typeof meta === 'object' && meta !== null && 'code' in meta) {
      const code: unknown = (meta as { code: unknown }).code;
      if (typeof code === 'string') return code;
    }
    return error.code;
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    const match = /\bcode:\s*"(\d{5})"/.exec(error.message);
    if (match !== null) return match[1] ?? null;
  }
  return null;
}

function isNameLanguageTaken(error: unknown): boolean {
  if (sqlStateOf(error) !== UNIQUE_VIOLATION || !(error instanceof Error)) return false;
  const meta = error instanceof Prisma.PrismaClientKnownRequestError ? JSON.stringify(error.meta ?? {}) : '';
  return `${error.message} ${meta}`.includes(NAME_LANGUAGE_LIVE_INDEX);
}

export async function listLiveWhatsappTemplates(
  connectionId: string,
  filter: { readonly onlyApproved: boolean },
  scope: IntegracionesScope,
): Promise<readonly WhatsappTemplateRecord[]> {
  const rows = await prisma.whatsappTemplate.findMany({
    where: {
      connectionId,
      deletedAt: null,
      status: filter.onlyApproved ? 'APPROVED' : undefined,
      ...whatsappTemplateCompanyScope(scope),
    },
    orderBy: [{ name: 'asc' }, { language: 'asc' }, { id: 'asc' }],
    select: TEMPLATE_SELECT,
  });
  return rows.map(toRecord);
}

export async function findLiveWhatsappTemplateById(
  id: string,
  scope: IntegracionesScope,
): Promise<WhatsappTemplateRecord | null> {
  const row = await prisma.whatsappTemplate.findFirst({
    where: { id, deletedAt: null, ...whatsappTemplateCompanyScope(scope) },
    select: TEMPLATE_SELECT,
  });
  return row === null ? null : toRecord(row);
}

export async function findLiveWhatsappTemplateByNameAndLanguage(
  connectionId: string,
  name: string,
  language: string,
  scope: IntegracionesScope,
): Promise<WhatsappTemplateRecord | null> {
  const row = await prisma.whatsappTemplate.findFirst({
    where: { connectionId, name, language, deletedAt: null, ...whatsappTemplateCompanyScope(scope) },
    select: TEMPLATE_SELECT,
  });
  return row === null ? null : toRecord(row);
}

/**
 * Si el webhook ya resincronizó y la insertó, gana esa fila (más reciente) y solo se le pone el
 * creador. El `WHERE` del `DO UPDATE` impide tocar una fila de otra empresa.
 */
export async function insertCreatedWhatsappTemplate(
  row: NewCreatedTemplateRow,
  connectionId: string,
  scope: IntegracionesScope,
): Promise<WhatsappTemplateRecord> {
  const columns = companyScopeColumns(scope);
  let inserted: TemplateRow[];
  try {
    inserted = await prisma.$queryRaw<TemplateRow[]>`
      INSERT INTO "whatsapp_templates" (
        "company_id", "connection_id", "meta_template_id", "name", "language", "category",
        "components", "status", "last_synced_at", "created_by", "updated_at"
      ) VALUES (
        ${columns.companyId}::uuid, ${connectionId}::uuid, ${row.metaTemplateId}, ${row.name},
        ${row.language}, ${row.category}::"whatsapp_template_category",
        ${JSON.stringify(row.components)}::jsonb, ${row.status}::"whatsapp_template_status",
        ${row.lastSyncedAt}, ${row.createdById}::uuid, now()
      )
      ON CONFLICT ("connection_id", "meta_template_id") DO UPDATE
        SET "created_by" = COALESCE("whatsapp_templates"."created_by", EXCLUDED."created_by"),
            "updated_at" = now()
        WHERE "whatsapp_templates"."company_id" = EXCLUDED."company_id"
      RETURNING "id", "company_id" AS "companyId", "connection_id" AS "connectionId",
        "meta_template_id" AS "metaTemplateId", "name", "language", "category"::text AS "category",
        "components", "status"::text AS "status", "status_raw" AS "statusRaw",
        "rejected_reason" AS "rejectedReason", "last_synced_at" AS "lastSyncedAt",
        "created_by" AS "createdById", "created_at" AS "createdAt", "deleted_at" AS "deletedAt"
    `;
  } catch (error) {
    if (isNameLanguageTaken(error)) throw new WhatsappTemplateNameTakenError('alta de plantilla: otra viva con el mismo nombre e idioma');
    throw error;
  }
  const created = inserted[0];
  if (created === undefined) {
    throw new Error('alta de plantilla: la conexión no es de la empresa del ámbito');
  }
  return toRecord(created);
}

export async function markWhatsappTemplateDeleted(
  id: string,
  at: Date,
  scope: IntegracionesScope,
): Promise<boolean> {
  const { count } = await prisma.whatsappTemplate.updateMany({
    where: { id, deletedAt: null, ...whatsappTemplateCompanyScope(scope) },
    data: { deletedAt: at },
  });
  return count > 0;
}

export async function listWhatsappTemplatesForSync(
  connectionId: string,
  scope: IntegracionesScope,
): Promise<readonly TemplateSyncRow[]> {
  return prisma.whatsappTemplate.findMany({
    where: { connectionId, ...whatsappTemplateCompanyScope(scope) },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: SYNC_SELECT,
  });
}

/**
 * Una transacción, y primero los borrados: así una plantilla borrada y vuelta a crear en Meta con
 * el mismo nombre e idioma no choca con el único de las vivas. Lo creado desde `startedAt` no se
 * borra: la lista de Meta se leyó antes de que existiera.
 */
export async function applyWhatsappTemplateSync(
  connectionId: string,
  plan: TemplateSyncPlan,
  startedAt: Date,
  at: Date,
  scope: IntegracionesScope,
): Promise<void> {
  const columns = companyScopeColumns(scope);
  const changed = plan.updates.filter((update) => update.changed);
  const unchangedIds = plan.updates.filter((update) => !update.changed).map((update) => update.id);

  await prisma.$transaction([
    prisma.whatsappTemplate.updateMany({
      where: {
        id: { in: [...plan.deletes] },
        connectionId,
        deletedAt: null,
        createdAt: { lt: startedAt },
        ...whatsappTemplateCompanyScope(scope),
      },
      data: { deletedAt: at, lastSyncedAt: at },
    }),
    ...changed.map(({ id, template }) =>
      prisma.whatsappTemplate.updateMany({
        where: { id, connectionId, ...whatsappTemplateCompanyScope(scope) },
        data: { ...syncedFields(template), deletedAt: null, lastSyncedAt: at },
      }),
    ),
    prisma.whatsappTemplate.updateMany({
      where: { id: { in: unchangedIds }, connectionId, ...whatsappTemplateCompanyScope(scope) },
      data: { lastSyncedAt: at },
    }),
    prisma.whatsappTemplate.createMany({
      data: plan.inserts.map((template) => ({
        ...columns,
        connectionId,
        metaTemplateId: template.metaTemplateId,
        ...syncedFields(template),
        createdById: null,
        lastSyncedAt: at,
      })),
      skipDuplicates: true,
    }),
    prisma.whatsappConnection.updateMany({
      where: { id: connectionId, deletedAt: null, ...whatsappConnectionCompanyScope(scope) },
      data: { templatesSyncedAt: at },
    }),
  ]);
}

/** Sin transacción: cada `UPDATE` es atómico e idempotente. */
export async function applyWhatsappTemplateWebhookUpdates(
  connectionId: string,
  updates: readonly TemplateWebhookUpdate[],
  scope: IntegracionesScope,
): Promise<{ readonly unknown: number }> {
  let unknown = 0;
  for (const update of updates) {
    const data =
      update.kind === 'status'
        ? { status: update.status, statusRaw: update.statusRaw, rejectedReason: update.rejectedReason }
        : { category: update.category };
    const { count } = await prisma.whatsappTemplate.updateMany({
      where: {
        connectionId,
        metaTemplateId: update.metaTemplateId,
        deletedAt: null,
        ...whatsappTemplateCompanyScope(scope),
      },
      data,
    });
    if (count === 0) unknown += 1;
  }
  return { unknown };
}
