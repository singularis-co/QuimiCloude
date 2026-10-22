import { Prisma, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';
import { DEFAULT_PAGE_SIZE } from '@/lib/shared/pagination';

import type { NotificationTarget, NotificationTone } from '../../../domain/catalog';
import type {
  InboxCursor,
  InboxItem,
  InboxScope,
  NewNotification,
  NotificationInbox,
  StoredTarget,
} from '../../../ports/notification-inbox';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export const NOTIFICATION_BATCH_SIZE = DEFAULT_PAGE_SIZE;

/** `created_at` con sus microsegundos, en UTC: es la mitad del cursor. */
const CURSOR_TIME = Prisma.sql`to_char(n.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

function visible(scope: InboxScope): Prisma.Sql {
  const recipient =
    scope.roleName === null
      ? Prisma.sql`n.recipient_user_id = ${scope.userId}::uuid`
      : Prisma.sql`(n.recipient_user_id = ${scope.userId}::uuid OR n.recipient_role = ${scope.roleName})`;
  return Prisma.sql`n.company_id = ${scope.companyId}::uuid AND n.created_at >= ${scope.cutoff} AND ${recipient}`;
}

function readBy(userId: string): Prisma.Sql {
  return Prisma.sql`EXISTS (SELECT 1 FROM notification_reads r WHERE r.notification_id = n.id AND r.user_id = ${userId}::uuid)`;
}

function targetParams(target: NotificationTarget | null): string | null {
  if (target === null) return null;
  const params = Object.entries(target).filter(([key]) => key !== 'kind');
  return params.length === 0 ? null : JSON.stringify(Object.fromEntries(params));
}

type InsertedRow = { id: string; created_at: Date };

type BatchRow = {
  id: string;
  tone: NotificationTone;
  title: string;
  body: string;
  body_time: Date | null;
  link_label: string;
  target_kind: string | null;
  created_at: Date;
  cursor_t: string;
  is_read: boolean;
};

function toItem(row: BatchRow): InboxItem {
  const target: StoredTarget | null = row.target_kind === null ? null : { kind: row.target_kind };
  return {
    id: row.id,
    tone: row.tone,
    title: row.title,
    body: row.body,
    bodyTime: row.body_time,
    linkLabel: row.link_label,
    target,
    createdAt: row.created_at,
    read: row.is_read,
  };
}

export function createNotificationInboxPrisma(db: PrismaLike = prisma): NotificationInbox {
  return {
    async insertIfAbsent(notification: NewNotification) {
      const { recipient } = notification;
      const rows = await db.$queryRaw<InsertedRow[]>(Prisma.sql`
        INSERT INTO notifications
          (company_id, event_key, tone, title, body, body_time, link_label, target_kind,
           target_params, recipient_user_id, recipient_role, dedupe_key)
        VALUES (
          ${notification.companyId}::uuid, ${notification.eventKey}, ${notification.tone},
          ${notification.title}, ${notification.body}, ${notification.bodyTime}::timestamptz,
          ${notification.linkLabel}, ${notification.target?.kind ?? null},
          ${targetParams(notification.target)}::jsonb,
          ${recipient.kind === 'user' ? recipient.userId : null}::uuid,
          ${recipient.kind === 'role' ? recipient.role : null},
          ${notification.dedupeKey}
        )
        ON CONFLICT (company_id, dedupe_key) DO NOTHING
        RETURNING id, created_at`);
      const row = rows[0];
      return row === undefined ? null : { ...notification, id: row.id, createdAt: row.created_at };
    },

    async summary(scope) {
      const [counted] = await db.$queryRaw<{ unread: number }[]>(Prisma.sql`
        SELECT count(*)::int AS unread FROM notifications n
        WHERE ${visible(scope)} AND NOT ${readBy(scope.userId)}`);
      const [newest] = await db.$queryRaw<{ id: string; created_at: Date }[]>(Prisma.sql`
        SELECT n.id, n.created_at FROM notifications n
        WHERE ${visible(scope)}
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT 1`);
      return {
        unreadCount: counted?.unread ?? 0,
        newest: newest === undefined ? null : { id: newest.id, createdAt: newest.created_at },
      };
    },

    async listBatch(scope, after: InboxCursor | null) {
      const cut =
        after === null
          ? Prisma.empty
          : Prisma.sql`AND (n.created_at, n.id) < (${after.t}::timestamptz, ${after.i}::uuid)`;
      // Uno de más: si llega, hay otro lote detrás.
      const rows = await db.$queryRaw<BatchRow[]>(Prisma.sql`
        SELECT n.id, n.tone, n.title, n.body, n.body_time, n.link_label, n.target_kind,
               n.created_at, ${CURSOR_TIME} AS cursor_t, ${readBy(scope.userId)} AS is_read
        FROM notifications n
        WHERE ${visible(scope)} ${cut}
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT ${NOTIFICATION_BATCH_SIZE + 1}`);
      const page = rows.slice(0, NOTIFICATION_BATCH_SIZE);
      const last = page.at(-1);
      const next =
        rows.length > NOTIFICATION_BATCH_SIZE && last !== undefined
          ? { t: last.cursor_t, i: last.id }
          : null;
      return { items: page.map(toItem), next };
    },

    async markRead(scope, notificationId) {
      const [row] = await db.$queryRaw<{ found: number }[]>(Prisma.sql`
        WITH target AS (
          SELECT n.id, n.company_id FROM notifications n
          WHERE ${visible(scope)} AND n.id = ${notificationId}::uuid
        ), inserted AS (
          INSERT INTO notification_reads (notification_id, user_id, company_id)
          SELECT id, ${scope.userId}::uuid, company_id FROM target
          ON CONFLICT DO NOTHING
        )
        SELECT count(*)::int AS found FROM target`);
      return (row?.found ?? 0) > 0;
    },

    async markAllRead(scope) {
      const [row] = await db.$queryRaw<{ marked: number }[]>(Prisma.sql`
        WITH inserted AS (
          INSERT INTO notification_reads (notification_id, user_id, company_id)
          SELECT n.id, ${scope.userId}::uuid, n.company_id FROM notifications n
          WHERE ${visible(scope)} AND NOT ${readBy(scope.userId)}
          ON CONFLICT DO NOTHING
          RETURNING 1
        )
        SELECT count(*)::int AS marked FROM inserted`);
      return row?.marked ?? 0;
    },

    async deleteExpired(companyId, cutoff) {
      const { count } = await db.notification.deleteMany({
        where: { companyId, createdAt: { lt: cutoff } },
      });
      return count;
    },
  };
}
