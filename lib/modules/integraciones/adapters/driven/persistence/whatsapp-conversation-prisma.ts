import { Prisma, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { companyScopeColumns, whatsappContactCompanyScope, whatsappMessageCompanyScope } from './company-scope';

import type { IntegracionesScope } from '../../../domain/integraciones-scope';
import type {
  WhatsappMessageDirection,
  WhatsappMessageOrigin,
  WhatsappMessageStatus,
  WhatsappMessageType,
} from '../../../domain/whatsapp-message';
import type {
  ChatMessageRow,
  ConversationContactRow,
  ConversationMessagesPage,
  ConversationPageQuery,
  ConversationRow,
  MediaMessageRow,
  WhatsappConversationRepository,
} from '../../../ports/whatsapp-conversation-repository';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

const CONTACT_COLUMNS = {
  id: true,
  waId: true,
  customerId: true,
  blockedAt: true,
  lastInboundAt: true,
} as const satisfies Prisma.WhatsappContactSelect;

type ContactSqlRow = {
  readonly id: string;
  readonly wa_id: string;
  readonly customer_id: string | null;
  readonly blocked_at: Date | null;
  readonly last_inbound_at: Date | null;
};

type ConversationSqlRow = ContactSqlRow & {
  readonly unread_count: number;
  readonly last_direction: WhatsappMessageDirection;
  readonly last_type: WhatsappMessageType;
  readonly last_body: string | null;
  readonly last_status: WhatsappMessageStatus;
  readonly last_at: Date;
};

type MessageSqlRow = {
  readonly id: string;
  readonly direction: WhatsappMessageDirection;
  readonly type: WhatsappMessageType;
  readonly body: string | null;
  readonly payload: unknown;
  readonly status: WhatsappMessageStatus;
  readonly error_code: string | null;
  readonly error_reason: string | null;
  readonly origin: WhatsappMessageOrigin | null;
  readonly sent_by: string | null;
  readonly template_name: string | null;
  readonly at: Date;
  readonly reacted_message_id: string | null;
};

type MediaMessageSqlRow = {
  readonly direction: WhatsappMessageDirection;
  readonly type: WhatsappMessageType;
  readonly payload: unknown;
  readonly customer_id: string | null;
};

function toContactRow(row: ContactSqlRow): ConversationContactRow {
  return {
    id: row.id,
    waId: row.wa_id,
    customerId: row.customer_id,
    blockedAt: row.blocked_at,
    lastInboundAt: row.last_inbound_at,
  };
}

function toConversationRow(row: ConversationSqlRow): ConversationRow {
  return {
    ...toContactRow(row),
    unreadCount: row.unread_count,
    lastMessage: {
      direction: row.last_direction,
      type: row.last_type,
      body: row.last_body,
      status: row.last_status,
      at: row.last_at,
    },
  };
}

function toMessageRow(row: MessageSqlRow): ChatMessageRow {
  return {
    id: row.id,
    direction: row.direction,
    type: row.type,
    body: row.body,
    payload: row.payload,
    status: row.status,
    errorCode: row.error_code,
    errorReason: row.error_reason,
    origin: row.origin,
    sentById: row.sent_by,
    templateName: row.template_name,
    at: row.at,
    reactedMessageId: row.reacted_message_id,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Lo que el listado y su total comparten, salvo la empresa, que cada consulta escribe en su SQL. */
function pageFilters(query: ConversationPageQuery): Prisma.Sql {
  const blocked =
    query.blocked === 'blocked'
      ? Prisma.sql`AND c."blocked_at" IS NOT NULL`
      : query.blocked === 'not_blocked'
        ? Prisma.sql`AND c."blocked_at" IS NULL`
        : Prisma.empty;
  const search =
    query.search === null
      ? Prisma.empty
      : query.search.digits === ''
        ? Prisma.sql`AND c."customer_id" = ANY(${[...query.search.nameMatchIds]}::uuid[])`
        : Prisma.sql`AND (c."customer_id" = ANY(${[...query.search.nameMatchIds]}::uuid[])
                          OR c."wa_id" LIKE '%' || ${escapeLike(query.search.digits)} || '%')`;
  return Prisma.sql`
    AND c."connection_id" = ${query.connectionId}::uuid
    AND c."customer_id" = ANY(${[...query.customerIds]}::uuid[])
    ${blocked}
    ${search}`;
}

export async function listWhatsappConversationCustomerIds(
  db: PrismaLike,
  connectionId: string,
  scope: IntegracionesScope,
): Promise<readonly string[]> {
  const columns = companyScopeColumns(scope);
  const rows = await db.$queryRaw<ReadonlyArray<{ readonly customer_id: string }>>`
    SELECT DISTINCT c."customer_id"
    FROM "whatsapp_contacts" c
    WHERE c."company_id" = ${columns.companyId}::uuid
      AND c."connection_id" = ${connectionId}::uuid
      AND c."customer_id" IS NOT NULL
      AND EXISTS (SELECT 1 FROM "whatsapp_messages" m
                  WHERE m."contact_id" = c."id" AND m."company_id" = c."company_id")
    ORDER BY c."customer_id"`;
  return rows.map((row) => row.customer_id);
}

/** Una conversación sin mensajes no aparece: el `LATERAL` sin fila la descarta. */
export async function listWhatsappConversationPage(
  db: PrismaLike,
  query: ConversationPageQuery,
  scope: IntegracionesScope,
): Promise<{ readonly rows: readonly ConversationRow[]; readonly total: number }> {
  if (query.customerIds.length === 0) return { rows: [], total: 0 };
  const columns = companyScopeColumns(scope);
  const filters = pageFilters(query);
  const rows = await db.$queryRaw<ReadonlyArray<ConversationSqlRow>>`
    SELECT c."id", c."wa_id", c."customer_id", c."blocked_at", c."last_inbound_at",
           last."direction"::text AS last_direction, last."type"::text AS last_type,
           last."body" AS last_body, last."status"::text AS last_status, last."at" AS last_at,
           (SELECT count(*)::int FROM "whatsapp_messages" u
            WHERE u."contact_id" = c."id" AND u."company_id" = c."company_id" AND u."direction" = 'IN'
              AND COALESCE(u."meta_timestamp", u."created_at") > COALESCE(c."last_read_at", '-infinity')
           ) AS unread_count
    FROM "whatsapp_contacts" c
    CROSS JOIN LATERAL (
      SELECT m."direction", m."type", m."body", m."status",
             COALESCE(m."meta_timestamp", m."created_at") AS "at", m."id"
      FROM "whatsapp_messages" m
      WHERE m."contact_id" = c."id" AND m."company_id" = c."company_id"
      ORDER BY "at" DESC, m."id" DESC
      LIMIT 1
    ) last
    WHERE c."company_id" = ${columns.companyId}::uuid
      ${filters}
    ORDER BY last."at" DESC, c."id"
    OFFSET ${query.offset} LIMIT ${query.limit}`;
  const counted = await db.$queryRaw<ReadonlyArray<{ readonly total: number }>>`
    SELECT count(*)::int AS total
    FROM "whatsapp_contacts" c
    WHERE c."company_id" = ${columns.companyId}::uuid
      AND EXISTS (SELECT 1 FROM "whatsapp_messages" m
                  WHERE m."contact_id" = c."id" AND m."company_id" = c."company_id")
      ${filters}`;
  return { rows: rows.map(toConversationRow), total: counted[0]?.total ?? 0 };
}

export async function findWhatsappConversationContact(
  db: PrismaLike,
  id: string,
  connectionId: string,
  scope: IntegracionesScope,
): Promise<ConversationContactRow | null> {
  return db.whatsappContact.findFirst({
    where: { id, connectionId, ...whatsappContactCompanyScope(scope) },
    select: CONTACT_COLUMNS,
  });
}

export async function findLatestWhatsappContactOfCustomer(
  db: PrismaLike,
  customerId: string,
  connectionId: string,
  scope: IntegracionesScope,
): Promise<ConversationContactRow | null> {
  const columns = companyScopeColumns(scope);
  const rows = await db.$queryRaw<ReadonlyArray<ContactSqlRow>>`
    SELECT c."id", c."wa_id", c."customer_id", c."blocked_at", c."last_inbound_at"
    FROM "whatsapp_contacts" c
    WHERE c."company_id" = ${columns.companyId}::uuid
      AND c."connection_id" = ${connectionId}::uuid
      AND c."customer_id" = ${customerId}::uuid
      AND EXISTS (SELECT 1 FROM "whatsapp_messages" m
                  WHERE m."contact_id" = c."id" AND m."company_id" = c."company_id")
    ORDER BY c."last_message_at" DESC NULLS LAST, c."id"
    LIMIT 1`;
  const row = rows[0];
  return row === undefined ? null : toContactRow(row);
}

/**
 * La hora del cursor se lee en la misma sentencia: pasada por un `Date` de JS perdería los
 * microsegundos y saltaría o repetiría mensajes con la misma hora.
 */
export async function listWhatsappChatMessages(
  db: PrismaLike,
  contactId: string,
  connectionId: string,
  page: ConversationMessagesPage,
  scope: IntegracionesScope,
): Promise<readonly ChatMessageRow[] | 'cursor_not_found'> {
  if (page.before !== null) {
    const cursor = await db.whatsappMessage.findFirst({
      where: { id: page.before, contactId, connectionId, ...whatsappMessageCompanyScope(scope) },
      select: { id: true },
    });
    if (cursor === null) return 'cursor_not_found';
  }
  const columns = companyScopeColumns(scope);
  const beforeCursor =
    page.before === null
      ? Prisma.empty
      : Prisma.sql`AND (COALESCE(m."meta_timestamp", m."created_at"), m."id") <
            (SELECT COALESCE(b."meta_timestamp", b."created_at"), b."id" FROM "whatsapp_messages" b
             WHERE b."id" = ${page.before}::uuid AND b."contact_id" = m."contact_id"
               AND b."company_id" = m."company_id")`;
  const rows = await db.$queryRaw<ReadonlyArray<MessageSqlRow>>`
    SELECT m."id", m."direction"::text AS direction, m."type"::text AS type, m."body", m."payload",
           m."status"::text AS status, m."error_code", m."error_reason", m."origin"::text AS origin,
           m."sent_by", m."template_name", COALESCE(m."meta_timestamp", m."created_at") AS "at",
           r."id" AS reacted_message_id
    FROM "whatsapp_messages" m
    LEFT JOIN "whatsapp_messages" r
      ON m."type" = 'REACTION'
     AND r."wamid" = m."payload"->>'message_id'
     AND r."contact_id" = m."contact_id"
     AND r."company_id" = m."company_id"
    WHERE m."company_id" = ${columns.companyId}::uuid
      AND m."contact_id" = ${contactId}::uuid
      AND m."connection_id" = ${connectionId}::uuid
      ${beforeCursor}
    ORDER BY "at" DESC, m."id" DESC
    LIMIT ${page.limit}`;
  return rows.map(toMessageRow);
}

export async function countWhatsappChatUnread(
  db: PrismaLike,
  contactId: string,
  scope: IntegracionesScope,
): Promise<number> {
  const columns = companyScopeColumns(scope);
  const rows = await db.$queryRaw<ReadonlyArray<{ readonly unread: number }>>`
    SELECT count(*)::int AS unread
    FROM "whatsapp_contacts" c
    JOIN "whatsapp_messages" m ON m."contact_id" = c."id" AND m."company_id" = c."company_id"
    WHERE c."company_id" = ${columns.companyId}::uuid
      AND c."id" = ${contactId}::uuid
      AND m."direction" = 'IN'
      AND COALESCE(m."meta_timestamp", m."created_at") > COALESCE(c."last_read_at", '-infinity')`;
  return rows[0]?.unread ?? 0;
}

export async function findWhatsappMediaMessage(
  db: PrismaLike,
  messageId: string,
  connectionId: string,
  scope: IntegracionesScope,
): Promise<MediaMessageRow | null> {
  const columns = companyScopeColumns(scope);
  const rows = await db.$queryRaw<ReadonlyArray<MediaMessageSqlRow>>`
    SELECT m."direction"::text AS direction, m."type"::text AS type, m."payload", c."customer_id"
    FROM "whatsapp_messages" m
    JOIN "whatsapp_contacts" c ON c."id" = m."contact_id" AND c."company_id" = m."company_id"
    WHERE m."company_id" = ${columns.companyId}::uuid
      AND m."id" = ${messageId}::uuid
      AND m."connection_id" = ${connectionId}::uuid`;
  const row = rows[0];
  if (row === undefined) return null;
  return { direction: row.direction, type: row.type, payload: row.payload, customerId: row.customer_id };
}

/**
 * Una sola sentencia: la hora sale de la base con sus microsegundos y `GREATEST` impide que dos
 * marcas simultáneas, o una más vieja, hagan retroceder la marca.
 */
export async function advanceWhatsappChatLastRead(
  db: PrismaLike,
  contactId: string,
  upToMessageId: string | null,
  scope: IntegracionesScope,
): Promise<'ok' | 'message_not_found'> {
  const columns = companyScopeColumns(scope);
  const target =
    upToMessageId === null
      ? Prisma.sql`ORDER BY COALESCE(t."meta_timestamp", t."created_at") DESC, t."id" DESC LIMIT 1`
      : Prisma.sql`AND t."id" = ${upToMessageId}::uuid`;
  const rows = await db.$queryRaw<ReadonlyArray<{ readonly found: boolean }>>`
    WITH target AS (
      SELECT COALESCE(t."meta_timestamp", t."created_at") AS "at"
      FROM "whatsapp_messages" t
      WHERE t."company_id" = ${columns.companyId}::uuid AND t."contact_id" = ${contactId}::uuid
      ${target}
    ), advanced AS (
      UPDATE "whatsapp_contacts" c
      SET "last_read_at" = target."at", "updated_at" = now()
      FROM target
      WHERE c."company_id" = ${columns.companyId}::uuid AND c."id" = ${contactId}::uuid
        AND (c."last_read_at" IS NULL OR c."last_read_at" < target."at")
      RETURNING c."id"
    )
    SELECT EXISTS (SELECT 1 FROM target) AS found`;
  if (upToMessageId !== null && rows[0]?.found !== true) return 'message_not_found';
  return 'ok';
}

/** Fábrica y no objeto ya construido: dentro de una transacción tiene que leer por su `tx`. */
export function createWhatsappConversationRepository(db: PrismaLike = prisma): WhatsappConversationRepository {
  return {
    listLinkedCustomerIds: (connectionId, scope) => listWhatsappConversationCustomerIds(db, connectionId, scope),
    listPage: (query, scope) => listWhatsappConversationPage(db, query, scope),
    findContact: (id, connectionId, scope) => findWhatsappConversationContact(db, id, connectionId, scope),
    findLatestContactOfCustomer: (customerId, connectionId, scope) =>
      findLatestWhatsappContactOfCustomer(db, customerId, connectionId, scope),
    listMessages: (contactId, connectionId, page, scope) =>
      listWhatsappChatMessages(db, contactId, connectionId, page, scope),
    countUnread: (contactId, scope) => countWhatsappChatUnread(db, contactId, scope),
    findMediaMessage: (messageId, connectionId, scope) => findWhatsappMediaMessage(db, messageId, connectionId, scope),
    advanceLastRead: (contactId, upToMessageId, scope) =>
      advanceWhatsappChatLastRead(db, contactId, upToMessageId, scope),
  };
}
