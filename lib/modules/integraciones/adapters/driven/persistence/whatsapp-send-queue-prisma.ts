import type { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { companyScopeColumns, whatsappMessageCompanyScope } from './company-scope';

import type { IntegracionesScope } from '../../../domain/integraciones-scope';
import type { ClaimedMessage, NewQueuedMessage } from '../../../domain/whatsapp-outbound-message';
import type { WhatsappSendQueueRepository } from '../../../ports/whatsapp-send-queue-repository';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

type ClaimedRow = {
  readonly id: string;
  readonly connection_id: string;
  readonly contact_id: string;
  readonly template_name: string | null;
  readonly template_language: string | null;
  readonly template_components: unknown;
  readonly attempts: number;
};

function toClaimed(row: ClaimedRow): ClaimedMessage {
  return {
    id: row.id,
    connectionId: row.connection_id,
    contactId: row.contact_id,
    templateName: row.template_name ?? '',
    templateLanguage: row.template_language ?? '',
    templateComponents: Array.isArray(row.template_components) ? row.template_components : [],
    attempts: row.attempts,
  };
}

export async function insertWhatsappQueuedMessage(
  db: PrismaLike,
  row: NewQueuedMessage,
  scope: IntegracionesScope,
): Promise<{ readonly id: string }> {
  return db.whatsappMessage.create({
    data: {
      ...companyScopeColumns(scope),
      connectionId: row.connectionId,
      contactId: row.contactId,
      direction: 'OUT',
      status: 'QUEUED',
      origin: 'SYSTEM',
      sentById: null,
      attempts: 0,
      type: 'TEMPLATE',
      body: row.body,
      templateName: row.templateName,
      templateLanguage: row.templateLanguage,
      payload: row.payload as Prisma.InputJsonObject,
      templateComponents: row.templateComponents as Prisma.InputJsonArray,
      metaTimestamp: null,
    },
    select: { id: true },
  });
}

/** El SQL crudo no pasa por `@updatedAt`: la marca de último cambio, que mira el barrido, va a mano. */
export async function recordWhatsappQueuePublication(
  db: PrismaLike,
  id: string,
  queueMessageId: string,
  scope: IntegracionesScope,
): Promise<void> {
  const columns = companyScopeColumns(scope);
  await db.$executeRaw`
    UPDATE "whatsapp_messages"
       SET "queue_message_id" = ${queueMessageId}, "updated_at" = now()
     WHERE "id" = ${id}::uuid AND "company_id" = ${columns.companyId}::uuid AND "origin" = 'SYSTEM'
       AND "status" = 'QUEUED'`;
}

/**
 * Una sola sentencia: Postgres serializa dos `UPDATE` sobre la misma fila y el segundo reevalúa el
 * `WHERE` tras el primero, así que de dos entregas simultáneas solo una encuentra `QUEUED`.
 */
export async function claimWhatsappQueuedMessage(
  db: PrismaLike,
  id: string,
  maxAttempts: number,
  scope: IntegracionesScope,
): Promise<ClaimedMessage | null> {
  const columns = companyScopeColumns(scope);
  const rows = await db.$queryRaw<ReadonlyArray<ClaimedRow>>`
    UPDATE "whatsapp_messages"
       SET "status" = 'SENDING', "attempts" = "attempts" + 1, "updated_at" = now()
     WHERE "id" = ${id}::uuid AND "company_id" = ${columns.companyId}::uuid AND "origin" = 'SYSTEM'
       AND "status" = 'QUEUED' AND "attempts" < ${maxAttempts}::int
    RETURNING "id"::text, "connection_id"::text, "contact_id"::text, "template_name", "template_language",
              "template_components", "attempts"`;
  const row = rows[0];
  return row === undefined ? null : toClaimed(row);
}

export async function releaseWhatsappClaimedMessage(
  db: PrismaLike,
  id: string,
  scope: IntegracionesScope,
): Promise<void> {
  const columns = companyScopeColumns(scope);
  await db.$executeRaw`
    UPDATE "whatsapp_messages"
       SET "status" = 'QUEUED', "updated_at" = now()
     WHERE "id" = ${id}::uuid AND "company_id" = ${columns.companyId}::uuid AND "origin" = 'SYSTEM'
       AND "status" = 'SENDING'`;
}

export async function listStaleWhatsappQueuedMessages(
  db: PrismaLike,
  before: Date,
  maxAttempts: number,
  limit: number,
  scope: IntegracionesScope,
): Promise<readonly string[]> {
  const rows = await db.whatsappMessage.findMany({
    where: {
      ...whatsappMessageCompanyScope(scope),
      origin: 'SYSTEM',
      status: 'QUEUED',
      attempts: { lt: maxAttempts },
      updatedAt: { lt: before },
    },
    select: { id: true },
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    take: limit,
  });
  return rows.map((row) => row.id);
}

export async function failExhaustedWhatsappMessages(
  db: PrismaLike,
  maxAttempts: number,
  reason: string,
  scope: IntegracionesScope,
): Promise<number> {
  const result = await db.whatsappMessage.updateMany({
    where: { ...whatsappMessageCompanyScope(scope), origin: 'SYSTEM', status: 'QUEUED', attempts: { gte: maxAttempts } },
    data: { status: 'FAILED', errorCode: null, errorReason: reason },
  });
  return result.count;
}

export async function failStaleWhatsappQueuedMessages(
  db: PrismaLike,
  before: Date,
  reason: string,
  scope: IntegracionesScope,
): Promise<number> {
  const result = await db.whatsappMessage.updateMany({
    where: { ...whatsappMessageCompanyScope(scope), origin: 'SYSTEM', status: 'QUEUED', updatedAt: { lt: before } },
    data: { status: 'FAILED', errorCode: null, errorReason: reason },
  });
  return result.count;
}

export async function failStuckWhatsappSendingMessages(
  db: PrismaLike,
  before: Date,
  reason: string,
  scope: IntegracionesScope,
): Promise<number> {
  const result = await db.whatsappMessage.updateMany({
    where: { ...whatsappMessageCompanyScope(scope), origin: 'SYSTEM', status: 'SENDING', updatedAt: { lt: before } },
    data: { status: 'FAILED', errorCode: null, errorReason: reason },
  });
  return result.count;
}

export function createWhatsappSendQueueRepository(db: PrismaLike = prisma): WhatsappSendQueueRepository {
  return {
    insertQueued: (row, scope) => insertWhatsappQueuedMessage(db, row, scope),
    recordPublished: (id, queueMessageId, scope) => recordWhatsappQueuePublication(db, id, queueMessageId, scope),
    claim: (id, maxAttempts, scope) => claimWhatsappQueuedMessage(db, id, maxAttempts, scope),
    release: (id, scope) => releaseWhatsappClaimedMessage(db, id, scope),
    listStaleQueued: (before, maxAttempts, limit, scope) =>
      listStaleWhatsappQueuedMessages(db, before, maxAttempts, limit, scope),
    failExhausted: (maxAttempts, reason, scope) => failExhaustedWhatsappMessages(db, maxAttempts, reason, scope),
    failStaleQueued: (before, reason, scope) => failStaleWhatsappQueuedMessages(db, before, reason, scope),
    failStuckSending: (before, reason, scope) => failStuckWhatsappSendingMessages(db, before, reason, scope),
  };
}
