import { Prisma, type PrismaClient } from '@prisma/client';

import { phoneMatchesWaId, waIdCandidates } from '../../../domain/phone-matches-wa-id';

import {
  companyScopeColumns,
  customerCompanyScope,
  customerPhoneNumberCompanyScope,
  phoneNumberCompanyScope,
} from './company-scope';

import type { CustomerScope } from '../../../domain/customer-scope';
import type { CustomerPhoneColumns } from '../../../domain/customer-view';
import type { CustomerPhoneLink, CustomerPhoneRepository } from '../../../ports/customer-phone-repository';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

const NO_PHONE = { phone: null, phoneCountry: null, phoneE164: null, phoneIssue: null } as const;

/**
 * Choque de dos escrituras simultaneas de telefonos: contra uno de los dos unicos parciales de los
 * vinculos vivos de un cliente, o contra el unico de `phone_numbers` cuando dos transacciones dan de
 * alta el mismo numero nuevo (Prisma resuelve ese `upsert` con un SELECT y un INSERT, no con
 * `ON CONFLICT`). Prisma no trae el nombre del indice sino sus columnas: los dos de los vinculos son
 * los unicos de su tabla que llevan `customer_id`, y el de los numeros, el unico con `e164`.
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

async function isAliveCustomer(db: PrismaLike, customerId: string, scope: CustomerScope): Promise<boolean> {
  const row = await db.customer.findFirst({
    where: { id: customerId, deletedAt: null, ...customerCompanyScope(scope) },
    select: { id: true },
  });
  return row !== null;
}

async function listAliveCustomerPhoneLinks(
  db: PrismaLike,
  customerId: string,
  scope: CustomerScope,
): Promise<readonly CustomerPhoneLink[]> {
  const links = await db.customerPhoneNumber.findMany({
    where: { customerId, deletedAt: null, ...customerPhoneNumberCompanyScope(scope) },
    select: { id: true, phoneNumberId: true, main: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (links.length === 0) return [];

  const numbers = await db.phoneNumber.findMany({
    where: { id: { in: links.map((link) => link.phoneNumberId) }, ...phoneNumberCompanyScope(scope) },
    select: { id: true, e164: true },
  });
  const e164ById = new Map(numbers.map((number) => [number.id, number.e164]));

  return links.map((link) => {
    const e164 = e164ById.get(link.phoneNumberId);
    if (e164 === undefined) throw new Error(`vinculo de telefono ${link.id} sin numero en su empresa`);
    return { linkId: link.id, e164, main: link.main };
  });
}

async function addCustomerPhoneLink(
  db: PrismaLike,
  customerId: string,
  e164: string,
  main: boolean,
  now: Date,
  scope: CustomerScope,
): Promise<void> {
  const number = await db.phoneNumber.upsert({
    where: { companyId_e164: { ...companyScopeColumns(scope), e164 } },
    create: { ...companyScopeColumns(scope), e164, createdAt: now, updatedAt: now },
    update: {},
    select: { id: true },
  });
  await db.customerPhoneNumber.create({
    data: {
      ...companyScopeColumns(scope),
      customerId,
      phoneNumberId: number.id,
      main,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });
}

async function removeCustomerPhoneLinks(
  db: PrismaLike,
  linkIds: readonly string[],
  now: Date,
  scope: CustomerScope,
): Promise<void> {
  if (linkIds.length === 0) return;
  await db.customerPhoneNumber.updateMany({
    where: { id: { in: [...linkIds] }, deletedAt: null, ...customerPhoneNumberCompanyScope(scope) },
    data: { deletedAt: now, updatedAt: now },
  });
}

async function setCustomerPhoneLinkMain(
  db: PrismaLike,
  linkId: string,
  main: boolean,
  now: Date,
  scope: CustomerScope,
): Promise<void> {
  await db.customerPhoneNumber.updateMany({
    where: { id: linkId, deletedAt: null, ...customerPhoneNumberCompanyScope(scope) },
    data: { main, updatedAt: now },
  });
}

async function writeCustomerMainMirror(
  db: PrismaLike,
  customerId: string,
  mirror: CustomerPhoneColumns | null,
  actorId: string,
  now: Date,
  scope: CustomerScope,
): Promise<void> {
  await db.customer.updateMany({
    where: { id: customerId, deletedAt: null, ...customerCompanyScope(scope) },
    data: { ...(mirror ?? NO_PHONE), updatedAt: now, updatedBy: actorId },
  });
}

/** Tres lecturas sin `@relation`, cada una con su ambito: un `include` podria cruzar de empresa. */
async function findAliveCustomerOwners(
  db: PrismaLike,
  waId: string,
  scope: CustomerScope,
): Promise<readonly string[]> {
  const candidates = waIdCandidates(waId);
  if (candidates.length === 0) return [];

  const numbers = await db.phoneNumber.findMany({
    where: { e164: { in: [...candidates] }, ...phoneNumberCompanyScope(scope) },
    select: { id: true, e164: true },
  });
  const matching = numbers.filter((number) => phoneMatchesWaId(number.e164, waId));
  if (matching.length === 0) return [];

  const links = await db.customerPhoneNumber.findMany({
    where: {
      phoneNumberId: { in: matching.map((number) => number.id) },
      deletedAt: null,
      ...customerPhoneNumberCompanyScope(scope),
    },
    select: { customerId: true },
  });
  if (links.length === 0) return [];

  const customers = await db.customer.findMany({
    where: {
      id: { in: [...new Set(links.map((link) => link.customerId))] },
      deletedAt: null,
      ...customerCompanyScope(scope),
    },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  return customers.map((customer) => customer.id);
}

export function createCustomerPhoneRepository(db: PrismaLike): CustomerPhoneRepository {
  return {
    isAlive: (customerId, scope) => isAliveCustomer(db, customerId, scope),
    listAliveLinks: (customerId, scope) => listAliveCustomerPhoneLinks(db, customerId, scope),
    addLink: (customerId, e164, main, now, scope) => addCustomerPhoneLink(db, customerId, e164, main, now, scope),
    removeLinks: (linkIds, now, scope) => removeCustomerPhoneLinks(db, linkIds, now, scope),
    setMain: (linkId, main, now, scope) => setCustomerPhoneLinkMain(db, linkId, main, now, scope),
    writeMainMirror: (customerId, mirror, actorId, now, scope) =>
      writeCustomerMainMirror(db, customerId, mirror, actorId, now, scope),
    findAliveOwners: (waId, scope) => findAliveCustomerOwners(db, waId, scope),
  };
}
