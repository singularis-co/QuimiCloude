import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { WhatsappTemplateNameTakenError } from '../../../domain/errors';

import {
  companyScopeColumns,
  whatsappConnectionCompanyScope,
  whatsappTemplateCompanyScope,
  whatsappTemplateVariableCompanyScope,
} from './company-scope';

import type { IntegracionesScope } from '../../../domain/integraciones-scope';
import type { TemplateSyncPlan } from '../../../domain/template-sync-plan';
import type { TemplateWebhookUpdate, WhatsappTemplateRecord } from '../../../domain/whatsapp-template';
import type { MetaTemplateSnapshot } from '../../../domain/whatsapp-template-meta';
import type { TemplateSlot, TemplateVariableBinding } from '../../../domain/whatsapp-template-variables';
import type {
  NewCreatedTemplateRow,
  TemplateMappingWrite,
  TemplateSyncRow,
} from '../../../ports/whatsapp-template-repository';

/** Los campos de `WhatsappTemplateRecord` salvo `variables`, que se leen aparte. */
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
  mappingStatus: true,
  enabled: true,
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
  mappingStatus: true,
  enabled: true,
} satisfies Prisma.WhatsappTemplateSelect;

type TemplateRow = Prisma.WhatsappTemplateGetPayload<{ select: typeof TEMPLATE_SELECT }>;

function toRecord(row: TemplateRow, variables: readonly TemplateVariableBinding[]): WhatsappTemplateRecord {
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
    mappingStatus: row.mappingStatus,
    enabled: row.enabled,
    variables,
  };
}

const VARIABLE_SELECT = {
  templateId: true,
  slot: true,
  variableKeyId: true,
  systemKey: true,
} satisfies Prisma.WhatsappTemplateVariableSelect;

type VariableRow = Prisma.WhatsappTemplateVariableGetPayload<{ select: typeof VARIABLE_SELECT }>;

// El CHECK de la tabla garantiza la forma del hueco y que hay exactamente un destino. Si aun asi
// llega una fila sin destino, se falla: inventarle uno mostraria un hueco ligado a nada.
export function toBinding(row: VariableRow): TemplateVariableBinding {
  const slot = row.slot as TemplateSlot;
  if (row.systemKey !== null) return { slot, kind: 'system', systemKey: row.systemKey };
  if (row.variableKeyId === null) {
    throw new Error(`la relacion del hueco ${row.slot} de la plantilla ${row.templateId} no tiene destino`);
  }
  return { slot, kind: 'company', variableKeyId: row.variableKeyId };
}

function relationData(columns: { readonly companyId: string }, templateId: string, binding: TemplateVariableBinding) {
  return {
    ...columns,
    templateId,
    slot: binding.slot,
    variableKeyId: binding.kind === 'company' ? binding.variableKeyId : null,
    systemKey: binding.kind === 'system' ? binding.systemKey : null,
  };
}

async function variablesByTemplate(
  tx: Prisma.TransactionClient,
  templateIds: readonly string[],
  scope: IntegracionesScope,
): Promise<ReadonlyMap<string, TemplateVariableBinding[]>> {
  const byTemplate = new Map<string, TemplateVariableBinding[]>();
  if (templateIds.length === 0) return byTemplate;
  const rows = await tx.whatsappTemplateVariable.findMany({
    where: { templateId: { in: [...templateIds] }, ...whatsappTemplateVariableCompanyScope(scope) },
    orderBy: [{ templateId: 'asc' }, { slot: 'asc' }],
    select: VARIABLE_SELECT,
  });
  for (const row of rows) byTemplate.set(row.templateId, [...(byTemplate.get(row.templateId) ?? []), toBinding(row)]);
  return byTemplate;
}

async function withVariables(
  rows: readonly TemplateRow[],
  scope: IntegracionesScope,
): Promise<WhatsappTemplateRecord[]> {
  const byTemplate = await variablesByTemplate(prisma, rows.map((row) => row.id), scope);
  return rows.map((row) => toRecord(row, byTemplate.get(row.id) ?? []));
}

/**
 * Bloquea la fila hasta el final de la transacción. `false` si ya no está viva o sus componentes
 * no son los leídos; la igualdad de `jsonb` no depende del orden de las claves.
 */
async function lockIfUnchanged(
  tx: Prisma.TransactionClient,
  id: string,
  expectedComponents: unknown,
  scope: IntegracionesScope,
): Promise<boolean> {
  const columns = companyScopeColumns(scope);
  const rows = await tx.$queryRaw<{ unchanged: boolean }[]>`
    SELECT ("components" = ${JSON.stringify(expectedComponents)}::jsonb) AS "unchanged"
    FROM "whatsapp_templates"
    WHERE "id" = ${id}::uuid AND "company_id" = ${columns.companyId}::uuid AND "deleted_at" IS NULL
    FOR UPDATE
  `;
  return rows[0]?.unchanged === true;
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

/** Vive solo en la migración. El error del `$queryRaw` no lo nombra (ver `isNameLanguageTaken`). */
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

/** `meta.target` llega como cadena o como array según el motor; se normaliza a array. */
function targetsOf(error: Prisma.PrismaClientKnownRequestError): readonly string[] {
  const target = error.meta?.target;
  if (typeof target === 'string') return [target];
  if (Array.isArray(target)) return target.filter((item): item is string => typeof item === 'string');
  return [];
}

const NAME_LANGUAGE_COLUMNS = ['connection_id', 'language', 'name'] as const;

/**
 * Columnas del `DETAIL` de Postgres: `Key (a, b)=(...) already exists.`. El paréntesis no se
 * traduce con el idioma del servidor, el resto sí; por eso se lee solo la lista de columnas.
 */
function detailColumnsOf(detail: string): readonly string[] {
  const match = /\(([^()]*)\)=\(/.exec(detail);
  if (match?.[1] === undefined) return [];
  return match[1].split(',').map((column) => column.trim().replaceAll('"', ''));
}

function isNameLanguageColumnSet(columns: readonly string[]): boolean {
  const sorted = [...columns].sort();
  return sorted.length === NAME_LANGUAGE_COLUMNS.length && NAME_LANGUAGE_COLUMNS.every((column, i) => sorted[i] === column);
}

/**
 * El alta va por `$queryRaw`, y ahí el único parcial NO llega como `P2002`: medido contra
 * Postgres (`@prisma/client@6.19.3`) llega como `P2010` con
 * `meta = { code: '23505', message: 'Key (connection_id, name, language)=(…) already exists.' }`,
 * sin el nombre del índice en ningún campo. Se reconoce por las columnas del `DETAIL`. Se aceptan
 * también el `P2002` del cliente tipado (columnas o nombre en `meta.target`) y el nombre del
 * índice en el texto. El otro único, `(connection_id, meta_template_id)`, no casa.
 */
export function isNameLanguageTaken(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const targets = targetsOf(error);
    if (targets.some((target) => target.includes(NAME_LANGUAGE_LIVE_INDEX))) return true;
    return targets.includes('name') && targets.includes('language');
  }
  if (sqlStateOf(error) !== UNIQUE_VIOLATION || !(error instanceof Error)) return false;
  const detail = error instanceof Prisma.PrismaClientKnownRequestError ? metaMessageOf(error) : '';
  if (isNameLanguageColumnSet(detailColumnsOf(detail))) return true;
  return `${error.message} ${detail}`.includes(NAME_LANGUAGE_LIVE_INDEX);
}

function metaMessageOf(error: Prisma.PrismaClientKnownRequestError): string {
  const message = error.meta?.message;
  return typeof message === 'string' ? message : '';
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
  return withVariables(rows, scope);
}

export async function findLiveWhatsappTemplateById(
  id: string,
  scope: IntegracionesScope,
): Promise<WhatsappTemplateRecord | null> {
  const row = await prisma.whatsappTemplate.findFirst({
    where: { id, deletedAt: null, ...whatsappTemplateCompanyScope(scope) },
    select: TEMPLATE_SELECT,
  });
  return row === null ? null : ((await withVariables([row], scope))[0] ?? null);
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
  return row === null ? null : ((await withVariables([row], scope))[0] ?? null);
}

/**
 * Si el webhook ya resincronizó y la insertó, gana esa fila (más reciente) y solo se le pone el
 * creador; sus relaciones no se tocan. El `WHERE` del `DO UPDATE` impide tocar una fila de otra
 * empresa. `xmax = 0` solo en la fila recién insertada.
 */
export async function insertCreatedWhatsappTemplate(
  row: NewCreatedTemplateRow,
  connectionId: string,
  scope: IntegracionesScope,
): Promise<{ readonly record: WhatsappTemplateRecord; readonly inserted: boolean }> {
  const columns = companyScopeColumns(scope);
  try {
    return await prisma.$transaction(async (tx) => {
      const returned = await tx.$queryRaw<(TemplateRow & { inserted: boolean })[]>`
        INSERT INTO "whatsapp_templates" (
          "company_id", "connection_id", "meta_template_id", "name", "language", "category",
          "components", "status", "last_synced_at", "created_by", "mapping_status", "enabled", "updated_at"
        ) VALUES (
          ${columns.companyId}::uuid, ${connectionId}::uuid, ${row.metaTemplateId}, ${row.name},
          ${row.language}, ${row.category}::"whatsapp_template_category",
          ${JSON.stringify(row.components)}::jsonb, ${row.status}::"whatsapp_template_status",
          ${row.lastSyncedAt}, ${row.createdById}::uuid,
          ${row.mappingStatus}::"whatsapp_template_mapping_status", ${row.enabled}, now()
        )
        ON CONFLICT ("connection_id", "meta_template_id") DO UPDATE
          SET "created_by" = COALESCE("whatsapp_templates"."created_by", EXCLUDED."created_by"),
              "updated_at" = now()
          WHERE "whatsapp_templates"."company_id" = EXCLUDED."company_id"
        RETURNING "id", "company_id" AS "companyId", "connection_id" AS "connectionId",
          "meta_template_id" AS "metaTemplateId", "name", "language", "category"::text AS "category",
          "components", "status"::text AS "status", "status_raw" AS "statusRaw",
          "rejected_reason" AS "rejectedReason", "last_synced_at" AS "lastSyncedAt",
          "created_by" AS "createdById", "created_at" AS "createdAt", "deleted_at" AS "deletedAt",
          "mapping_status"::text AS "mappingStatus", "enabled", (xmax = 0) AS "inserted"
      `;
      const created = returned[0];
      if (created === undefined) {
        throw new Error('alta de plantilla: la conexión no es de la empresa del ámbito');
      }
      if (!created.inserted) {
        const byTemplate = await variablesByTemplate(tx, [created.id], scope);
        return { record: toRecord(created, byTemplate.get(created.id) ?? []), inserted: false };
      }
      if (row.variables.length > 0) {
        await tx.whatsappTemplateVariable.createMany({
          data: row.variables.map((binding) => relationData(columns, created.id, binding)),
        });
      }
      return { record: toRecord(created, row.variables), inserted: true };
    });
  } catch (error) {
    if (isNameLanguageTaken(error)) throw new WhatsappTemplateNameTakenError('alta de plantilla: otra viva con el mismo nombre e idioma');
    throw error;
  }
}

export async function replaceWhatsappTemplateVariables(
  id: string,
  bindings: readonly TemplateVariableBinding[],
  mapping: TemplateMappingWrite,
  expectedComponents: unknown,
  scope: IntegracionesScope,
): Promise<boolean> {
  const columns = companyScopeColumns(scope);
  return prisma.$transaction(async (tx) => {
    if (!(await lockIfUnchanged(tx, id, expectedComponents, scope))) return false;
    await tx.whatsappTemplateVariable.deleteMany({
      where: { templateId: id, ...whatsappTemplateVariableCompanyScope(scope) },
    });
    if (bindings.length > 0) {
      await tx.whatsappTemplateVariable.createMany({
        data: bindings.map((binding) => relationData(columns, id, binding)),
      });
    }
    await tx.whatsappTemplate.updateMany({
      where: { id, deletedAt: null, ...whatsappTemplateCompanyScope(scope) },
      data: { mappingStatus: mapping.mappingStatus, enabled: mapping.enabled },
    });
    return true;
  });
}

export async function setWhatsappTemplateEnabled(
  id: string,
  enabled: boolean,
  expectedComponents: unknown,
  scope: IntegracionesScope,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    if (!(await lockIfUnchanged(tx, id, expectedComponents, scope))) return false;
    await tx.whatsappTemplate.updateMany({
      where: { id, deletedAt: null, ...whatsappTemplateCompanyScope(scope) },
      data: { enabled },
    });
    return true;
  });
}

/** Una eliminada no tiene relaciones: si vuelve, la sincronización la trata como importada. */
export async function markWhatsappTemplateDeleted(
  id: string,
  at: Date,
  scope: IntegracionesScope,
): Promise<boolean> {
  const [, { count }] = await prisma.$transaction([
    prisma.whatsappTemplateVariable.deleteMany({
      where: { templateId: id, ...whatsappTemplateVariableCompanyScope(scope) },
    }),
    prisma.whatsappTemplate.updateMany({
      where: { id, deletedAt: null, ...whatsappTemplateCompanyScope(scope) },
      data: { deletedAt: at, enabled: false },
    }),
  ]);
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
 * borra: la lista de Meta se leyó antes de que existiera. Las relaciones de una borrada o de una
 * cuyas variables se reinician se quitan con el mismo filtro que su `UPDATE`, antes de él.
 */
export async function applyWhatsappTemplateSync(
  connectionId: string,
  plan: TemplateSyncPlan,
  startedAt: Date,
  at: Date,
  scope: IntegracionesScope,
): Promise<void> {
  const columns = companyScopeColumns(scope);
  const written = plan.updates.filter((update) => update.changed || update.resetVariables);
  const resetIds = written.filter((update) => update.resetVariables).map((update) => update.id);
  const unchangedIds = plan.updates.filter((update) => !update.changed && !update.resetVariables).map((update) => update.id);

  await prisma.$transaction([
    prisma.$executeRaw`
      DELETE FROM "whatsapp_template_variables" AS v
      USING "whatsapp_templates" AS t
      WHERE v."company_id" = ${columns.companyId}::uuid AND t."company_id" = v."company_id"
        AND t."id" = v."template_id" AND t."id" = ANY(${[...plan.deletes]}::uuid[])
        AND t."connection_id" = ${connectionId}::uuid AND t."deleted_at" IS NULL
        AND t."created_at" < ${startedAt}
    `,
    prisma.whatsappTemplate.updateMany({
      where: {
        id: { in: [...plan.deletes] },
        connectionId,
        deletedAt: null,
        createdAt: { lt: startedAt },
        ...whatsappTemplateCompanyScope(scope),
      },
      data: { deletedAt: at, lastSyncedAt: at, enabled: false },
    }),
    prisma.$executeRaw`
      DELETE FROM "whatsapp_template_variables" AS v
      USING "whatsapp_templates" AS t
      WHERE v."company_id" = ${columns.companyId}::uuid AND t."company_id" = v."company_id"
        AND t."id" = v."template_id" AND t."id" = ANY(${resetIds}::uuid[])
        AND t."connection_id" = ${connectionId}::uuid
    `,
    ...written.map((update) =>
      prisma.whatsappTemplate.updateMany({
        where: { id: update.id, connectionId, ...whatsappTemplateCompanyScope(scope) },
        data: {
          ...syncedFields(update.template),
          deletedAt: null,
          lastSyncedAt: at,
          ...(update.resetVariables
            ? { mappingStatus: update.mappingStatusAfterReset, enabled: update.enabledAfterReset }
            : {}),
        },
      }),
    ),
    prisma.whatsappTemplate.updateMany({
      where: { id: { in: unchangedIds }, connectionId, ...whatsappTemplateCompanyScope(scope) },
      data: { lastSyncedAt: at },
    }),
    prisma.whatsappTemplate.createMany({
      data: plan.inserts.map((insert) => ({
        ...columns,
        connectionId,
        metaTemplateId: insert.template.metaTemplateId,
        ...syncedFields(insert.template),
        createdById: null,
        lastSyncedAt: at,
        mappingStatus: insert.mappingStatus,
        enabled: insert.enabled,
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
