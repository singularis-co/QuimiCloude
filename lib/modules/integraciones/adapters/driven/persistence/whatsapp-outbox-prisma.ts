import type { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { companyScopeColumns, whatsappContactCompanyScope, whatsappMessageCompanyScope } from './company-scope';

import type { IntegracionesScope } from '../../../domain/integraciones-scope';
import type { ContactLink } from '../../../domain/whatsapp-contact-link';
import type {
  NewOutboundMessage,
  OutboundContact,
  OutboundMessageRecord,
  OutboundMessageType,
} from '../../../domain/whatsapp-outbound-message';
import type { WhatsappOutboxRepository } from '../../../ports/whatsapp-outbox-repository';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

const CONTACT_COLUMNS = {
  id: true,
  waId: true,
  customerId: true,
  customerLinkedBy: true,
  blockedAt: true,
  lastInboundAt: true,
} as const satisfies Prisma.WhatsappContactSelect;

const MESSAGE_COLUMNS = {
  id: true,
  connectionId: true,
  contactId: true,
  sentById: true,
  type: true,
  body: true,
  templateName: true,
  templateLanguage: true,
  payload: true,
  status: true,
  direction: true,
  origin: true,
  errorCode: true,
  errorReason: true,
  createdAt: true,
} as const satisfies Prisma.WhatsappMessageSelect;

type MessageColumns = Prisma.WhatsappMessageGetPayload<{ select: typeof MESSAGE_COLUMNS }>;

const OUTBOUND_TYPES: readonly OutboundMessageType[] = ['TEXT', 'TEMPLATE'];

/**
 * Solo las filas que caben en un saliente: los entrantes no tienen origen ni, a veces, texto, y un
 * tipo que no es texto ni plantilla no lo escribe este envío.
 */
const OUTBOUND_ROW = {
  direction: 'OUT',
  origin: { not: null },
  sentById: { not: null },
  body: { not: null },
  type: { in: [...OUTBOUND_TYPES] },
} as const satisfies Prisma.WhatsappMessageWhereInput;

function toRecord(row: MessageColumns): OutboundMessageRecord | null {
  const { origin, sentById, body, type, payload } = row;
  if (origin === null || sentById === null || body === null) return null;
  if (type !== 'TEXT' && type !== 'TEMPLATE') return null;
  return {
    id: row.id,
    connectionId: row.connectionId,
    contactId: row.contactId,
    sentById,
    type,
    body,
    templateName: row.templateName,
    templateLanguage: row.templateLanguage,
    payload: payload !== null && typeof payload === 'object' && !Array.isArray(payload) ? { ...payload } : {},
    status: row.status,
    direction: row.direction,
    origin,
    errorCode: row.errorCode,
    errorReason: row.errorReason,
    createdAt: row.createdAt,
  };
}

export async function findWhatsappOutboundContact(
  db: PrismaLike,
  id: string,
  connectionId: string,
  scope: IntegracionesScope,
): Promise<OutboundContact | null> {
  return db.whatsappContact.findFirst({
    where: { id, connectionId, ...whatsappContactCompanyScope(scope) },
    select: CONTACT_COLUMNS,
  });
}

export async function findWhatsappOutboundContactsByWaIds(
  db: PrismaLike,
  connectionId: string,
  waIds: readonly string[],
  scope: IntegracionesScope,
): Promise<readonly OutboundContact[]> {
  if (waIds.length === 0) return [];
  return db.whatsappContact.findMany({
    where: { connectionId, waId: { in: [...waIds] }, ...whatsappContactCompanyScope(scope) },
    select: CONTACT_COLUMNS,
    orderBy: { id: 'asc' },
  });
}

/**
 * `ON CONFLICT DO NOTHING` y relectura, y no un `upsert` de Prisma (un SELECT y un INSERT): dos
 * envíos a la vez al mismo número nuevo chocarían contra el único de `(connection_id, wa_id)`.
 */
export async function ensureWhatsappOutboundContact(
  db: PrismaLike,
  connectionId: string,
  waId: string,
  scope: IntegracionesScope,
): Promise<OutboundContact> {
  const columns = companyScopeColumns(scope);
  await db.$executeRaw`
    INSERT INTO "whatsapp_contacts" ("company_id", "connection_id", "wa_id", "updated_at")
    VALUES (${columns.companyId}::uuid, ${connectionId}::uuid, ${waId}, now())
    ON CONFLICT ("connection_id", "wa_id") DO NOTHING`;
  const contact = await db.whatsappContact.findFirst({
    where: { connectionId, waId, ...whatsappContactCompanyScope(scope) },
    select: CONTACT_COLUMNS,
  });
  if (contact === null) throw new Error('El contacto de WhatsApp pertenece a otra empresa.');
  return contact;
}

export async function linkWhatsappOutboundContact(
  db: PrismaLike,
  id: string,
  link: ContactLink,
  scope: IntegracionesScope,
): Promise<void> {
  await db.whatsappContact.updateMany({
    where: { id, ...whatsappContactCompanyScope(scope) },
    data: { customerId: link.customerId, customerLinkedBy: link.linkedBy },
  });
}

export async function insertWhatsappSendingMessage(
  db: PrismaLike,
  row: NewOutboundMessage,
  scope: IntegracionesScope,
): Promise<OutboundMessageRecord> {
  const created = await db.whatsappMessage.create({
    data: {
      ...companyScopeColumns(scope),
      connectionId: row.connectionId,
      contactId: row.contactId,
      direction: 'OUT',
      status: 'SENDING',
      origin: 'USER',
      sentById: row.sentById,
      attempts: 1,
      type: row.type,
      body: row.body,
      templateName: row.templateName,
      templateLanguage: row.templateLanguage,
      payload: row.payload as Prisma.InputJsonObject,
      metaTimestamp: null,
    },
    select: MESSAGE_COLUMNS,
  });
  const record = toRecord(created);
  if (record === null) throw new Error('El mensaje de WhatsApp recién creado no es un saliente.');
  return record;
}

/** La condición de `SENDING` va en el `where`: no pisa un estado que ya movió otra escritura. */
export async function markWhatsappMessageSent(
  db: PrismaLike,
  id: string,
  wamid: string,
  scope: IntegracionesScope,
): Promise<OutboundMessageRecord | null> {
  const result = await db.whatsappMessage.updateMany({
    where: { id, status: 'SENDING', ...whatsappMessageCompanyScope(scope) },
    data: { status: 'SENT', wamid },
  });
  if (result.count === 0) return null;
  return findWhatsappOutboundMessage(db, id, scope);
}

/** La condición de `SENDING` va en el `where`: no pisa un estado que ya movió otra escritura. */
export async function markWhatsappMessageFailed(
  db: PrismaLike,
  id: string,
  errorCode: string | null,
  errorReason: string,
  scope: IntegracionesScope,
): Promise<OutboundMessageRecord | null> {
  const result = await db.whatsappMessage.updateMany({
    where: { id, status: 'SENDING', ...whatsappMessageCompanyScope(scope) },
    data: { status: 'FAILED', errorCode, errorReason },
  });
  if (result.count === 0) return null;
  return findWhatsappOutboundMessage(db, id, scope);
}

export async function findWhatsappOutboundMessage(
  db: PrismaLike,
  id: string,
  scope: IntegracionesScope,
): Promise<OutboundMessageRecord | null> {
  const row = await db.whatsappMessage.findFirst({
    where: { id, ...OUTBOUND_ROW, ...whatsappMessageCompanyScope(scope) },
    select: MESSAGE_COLUMNS,
  });
  return row === null ? null : toRecord(row);
}

/** `GREATEST` ignora el nulo: un contacto sin fecha toma la del envío, y una más nueva se conserva. */
export async function touchWhatsappContactOnSend(
  db: PrismaLike,
  id: string,
  at: Date,
  scope: IntegracionesScope,
): Promise<void> {
  const columns = companyScopeColumns(scope);
  await db.$executeRaw`
    UPDATE "whatsapp_contacts"
    SET "last_message_at" = GREATEST("last_message_at", ${at}::timestamptz), "updated_at" = now()
    WHERE "id" = ${id}::uuid AND "company_id" = ${columns.companyId}::uuid`;
}

/** Fábrica y no objeto ya construido: dentro de una transacción tiene que escribir por su `tx`. */
export function createWhatsappOutboxRepository(db: PrismaLike = prisma): WhatsappOutboxRepository {
  return {
    findContact: (id, connectionId, scope) => findWhatsappOutboundContact(db, id, connectionId, scope),
    findContactsByWaIds: (connectionId, waIds, scope) =>
      findWhatsappOutboundContactsByWaIds(db, connectionId, waIds, scope),
    ensureContact: (connectionId, waId, scope) => ensureWhatsappOutboundContact(db, connectionId, waId, scope),
    linkContact: (id, link, scope) => linkWhatsappOutboundContact(db, id, link, scope),
    insertSending: (row, scope) => insertWhatsappSendingMessage(db, row, scope),
    markSent: (id, wamid, scope) => markWhatsappMessageSent(db, id, wamid, scope),
    markFailed: (id, errorCode, errorReason, scope) => markWhatsappMessageFailed(db, id, errorCode, errorReason, scope),
    findOutbound: (id, scope) => findWhatsappOutboundMessage(db, id, scope),
    touchContact: (id, at, scope) => touchWhatsappContactOnSend(db, id, at, scope),
  };
}
