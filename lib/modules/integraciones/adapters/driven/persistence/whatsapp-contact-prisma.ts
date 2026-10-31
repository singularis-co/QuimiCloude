import { Prisma, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { whatsappContactCompanyScope } from './company-scope';

import type { IntegracionesScope } from '../../../domain/integraciones-scope';
import type { ContactLink } from '../../../domain/whatsapp-contact-link';
import type {
  ConversationModeChange,
  ConversationModeState,
  WhatsappContactBlock,
  WhatsappContactLinkRow,
  WhatsappContactRepository,
} from '../../../ports/whatsapp-contact-repository';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

const LINK_COLUMNS = { id: true, waId: true, customerId: true, customerLinkedBy: true } as const;

type LinkColumns = Prisma.WhatsappContactGetPayload<{ select: typeof LINK_COLUMNS }>;

function toLinkRow(row: LinkColumns): WhatsappContactLinkRow {
  return { id: row.id, waId: row.waId, link: { customerId: row.customerId, linkedBy: row.customerLinkedBy } };
}

export async function findWhatsappContactById(
  db: PrismaLike,
  id: string,
  scope: IntegracionesScope,
): Promise<WhatsappContactLinkRow | null> {
  const row = await db.whatsappContact.findFirst({
    where: { id, ...whatsappContactCompanyScope(scope) },
    select: LINK_COLUMNS,
  });
  return row === null ? null : toLinkRow(row);
}

export async function findWhatsappContactsByWaIds(
  db: PrismaLike,
  waIds: readonly string[],
  scope: IntegracionesScope,
): Promise<readonly WhatsappContactLinkRow[]> {
  if (waIds.length === 0) return [];
  const rows = await db.whatsappContact.findMany({
    where: { waId: { in: [...waIds] }, ...whatsappContactCompanyScope(scope) },
    select: LINK_COLUMNS,
    orderBy: { id: 'asc' },
  });
  return rows.map(toLinkRow);
}

export async function setWhatsappContactLink(
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

export async function setWhatsappContactBlocked(
  db: PrismaLike,
  id: string,
  blocked: WhatsappContactBlock | null,
  scope: IntegracionesScope,
): Promise<'ok' | 'not_found'> {
  const result = await db.whatsappContact.updateMany({
    where: { id, blockedAt: blocked === null ? { not: null } : null, ...whatsappContactCompanyScope(scope) },
    data: blocked === null ? { blockedAt: null, blockedBy: null } : { blockedAt: blocked.at, blockedBy: blocked.by },
  });
  if (result.count > 0) return 'ok';

  // Cero filas es «ya estaba así» o «no existe»: solo la segunda es un error.
  const existing = await db.whatsappContact.findFirst({
    where: { id, ...whatsappContactCompanyScope(scope) },
    select: { id: true },
  });
  return existing === null ? 'not_found' : 'ok';
}

export async function findWhatsappContactMode(
  db: PrismaLike,
  id: string,
  scope: IntegracionesScope,
): Promise<ConversationModeState | null> {
  const row = await db.whatsappContact.findFirst({
    where: { id, ...whatsappContactCompanyScope(scope) },
    select: {
      conversationMode: true,
      conversationModeReason: true,
      conversationModeChangedAt: true,
      lastMessageAt: true,
    },
  });
  if (row === null) return null;
  return {
    mode: row.conversationMode,
    reason: row.conversationModeReason,
    changedAt: row.conversationModeChangedAt,
    lastMessageAt: row.lastMessageAt,
  };
}

export async function setWhatsappContactMode(
  db: PrismaLike,
  id: string,
  change: ConversationModeChange,
  scope: IntegracionesScope,
): Promise<'changed' | 'unchanged' | 'not_found'> {
  // El filtro por modo hace que, de dos cambios simultáneos al mismo destino, el segundo no pise
  // el motivo ni la fecha del primero.
  const result = await db.whatsappContact.updateMany({
    where: { id, conversationMode: { not: change.mode }, ...whatsappContactCompanyScope(scope) },
    data: {
      conversationMode: change.mode,
      conversationModeReason: change.reason,
      conversationModeChangedAt: change.at,
      conversationModeChangedBy: change.by,
    },
  });
  if (result.count > 0) return 'changed';

  const existing = await db.whatsappContact.findFirst({
    where: { id, ...whatsappContactCompanyScope(scope) },
    select: { id: true },
  });
  return existing === null ? 'not_found' : 'unchanged';
}

/**
 * Choque de dos escrituras simultáneas en los teléfonos que escribe `clientes` dentro de la misma
 * transacción: contra uno de los dos únicos parciales de los vínculos vivos de un cliente, o contra
 * el único de `phone_numbers` cuando dos transacciones añaden el mismo número nuevo (Prisma resuelve
 * ese `upsert` con un SELECT y un INSERT, no con `ON CONFLICT`). Prisma trae las columnas y no el
 * nombre del índice: los de los vínculos son los únicos de su tabla con `customer_id`, y el de los
 * números, el único con `e164`.
 */
export function isCustomerPhoneLinkConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const meta = error.meta ?? {};
  const target = meta.target;
  const columns = typeof target === 'string' ? [target] : Array.isArray(target) ? target : [];
  const hasColumn = (name: string) => columns.some((column) => typeof column === 'string' && column.includes(name));
  if (meta.modelName === 'CustomerPhoneNumber') return hasColumn('customer_id');
  if (meta.modelName === 'PhoneNumber') return hasColumn('e164');
  return false;
}

/** Fábrica y no objeto ya construido: dentro de una transacción tiene que escribir por su `tx`. */
export function createWhatsappContactRepository(db: PrismaLike = prisma): WhatsappContactRepository {
  return {
    findById: (id, scope) => findWhatsappContactById(db, id, scope),
    findByWaIds: (waIds, scope) => findWhatsappContactsByWaIds(db, waIds, scope),
    setLink: (id, link, scope) => setWhatsappContactLink(db, id, link, scope),
    setBlocked: (id, blocked, scope) => setWhatsappContactBlocked(db, id, blocked, scope),
    findMode: (id, scope) => findWhatsappContactMode(db, id, scope),
    setMode: (id, change, scope) => setWhatsappContactMode(db, id, change, scope),
  };
}
