import { Prisma, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { whatsappContactCompanyScope } from './company-scope';

import type { IntegracionesScope } from '../../../domain/integraciones-scope';
import type { ContactLink } from '../../../domain/whatsapp-contact-link';
import type {
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

/**
 * Choque contra uno de los dos únicos parciales de los vínculos vivos de un cliente, la tabla que
 * escribe `clientes` dentro de la misma transacción. Prisma trae sus columnas y no el nombre del
 * índice; los dos son los únicos de esa tabla que llevan `customer_id`.
 */
export function isCustomerPhoneLinkConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const meta = error.meta ?? {};
  if (meta.modelName !== 'CustomerPhoneNumber') return false;
  const target = meta.target;
  const columns = typeof target === 'string' ? [target] : Array.isArray(target) ? target : [];
  return columns.some((column) => typeof column === 'string' && column.includes('customer_id'));
}

/** Fábrica y no objeto ya construido: dentro de una transacción tiene que escribir por su `tx`. */
export function createWhatsappContactRepository(db: PrismaLike = prisma): WhatsappContactRepository {
  return {
    findById: (id, scope) => findWhatsappContactById(db, id, scope),
    findByWaIds: (waIds, scope) => findWhatsappContactsByWaIds(db, waIds, scope),
    setLink: (id, link, scope) => setWhatsappContactLink(db, id, link, scope),
    setBlocked: (id, blocked, scope) => setWhatsappContactBlocked(db, id, blocked, scope),
  };
}
