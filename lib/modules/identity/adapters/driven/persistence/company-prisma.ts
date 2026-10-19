import { Prisma, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';
import { buildPage, toOffsetLimit } from '@/lib/shared/pagination';

import { COMPANY_FIELDS, changedCompanyFields } from '../../../domain/company-event';
import { normalizeCompanyName } from '../../../domain/company-name';
import { COMPANY_STATUSES } from '../../../domain/company-queryable';
import { NO_CREDENTIAL_SENTINEL } from '../../../domain/credential-setup-link';
import { ROLE_ADMINISTRADOR } from '../../../domain/roles';

import { duplicateKeyOf } from './user-admin-prisma';

import type { CompanyEventKind, CompanyField } from '../../../domain/company-event';
import type {
  CompanyDetail,
  CompanyEventView,
  CompanyRow,
  CompanyStatus,
} from '../../../domain/company-view';
import type { ListQuery } from '../../../domain/list-query';
import type { Page } from '../../../domain/page';
import type { CompanyMembershipReader } from '../../../ports/company-membership-reader';
import type { CompanyDuplicate, CompanyRepository } from '../../../ports/company-repository';
import type { DuplicateKey } from '../../../ports/user-admin-repository';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

// Lo que Prisma anuncia en `meta.target` para cada indice unico parcial de `companies`.
const TAX_ID_UNIQUE_MARKER = 'tax_id_normalized';
const NAME_UNIQUE_MARKER = 'name_normalized';

const SAVEPOINT = 'company_write';

function isRootClient(db: PrismaLike): db is PrismaClient {
  return '$transaction' in db;
}

// Dentro de una transaccion ajena, una sentencia fallida la aborta entera: el savepoint deshace
// solo esta operacion y deja la transaccion usable para quien la abrio.
export async function atomically<T>(
  db: PrismaLike,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (isRootClient(db)) return db.$transaction(fn, { maxWait: 10_000, timeout: 30_000 });
  await db.$executeRawUnsafe(`SAVEPOINT ${SAVEPOINT}`);
  try {
    const result = await fn(db);
    await db.$executeRawUnsafe(`RELEASE SAVEPOINT ${SAVEPOINT}`);
    return result;
  } catch (error) {
    // Si el rollback tambien falla, se relanza el error de la operacion: es el que explica el fallo.
    await db.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${SAVEPOINT}`).catch(() => undefined);
    throw error;
  }
}

function isKnownError(error: unknown, code: string): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function targetsOf(error: Prisma.PrismaClientKnownRequestError): readonly string[] {
  const target = error.meta?.target;
  if (typeof target === 'string') return [target];
  if (Array.isArray(target)) return target.filter((item): item is string => typeof item === 'string');
  return [];
}

function companyDuplicateOf(error: unknown): CompanyDuplicate | null {
  if (!isKnownError(error, 'P2002')) return null;
  const targets = targetsOf(error);
  if (targets.some((target) => target.includes(TAX_ID_UNIQUE_MARKER))) return 'duplicate_tax_id';
  if (targets.some((target) => target.includes(NAME_UNIQUE_MARKER))) return 'duplicate_name';
  return null;
}

// El `P2002` se traduce aqui, despues del rollback: dentro, la transaccion ya esta abortada.
async function withCompanyDuplicates<T>(
  run: () => Promise<T>,
): Promise<T | CompanyDuplicate> {
  try {
    return await run();
  } catch (error) {
    const duplicate = companyDuplicateOf(error);
    if (duplicate !== null) return duplicate;
    throw error;
  }
}

export function recordCompanyEvent(
  tx: Prisma.TransactionClient,
  event: {
    companyId: string;
    kind: CompanyEventKind;
    actorId: string;
    now: Date;
    fields?: readonly CompanyField[];
  },
) {
  return tx.companyEvent.create({
    data: {
      companyId: event.companyId,
      kind: event.kind,
      actorId: event.actorId,
      occurredAt: event.now,
      details: event.fields === undefined ? Prisma.DbNull : { fields: [...event.fields] },
    },
    select: { id: true },
  });
}

function statusOf(deletedAt: Date | null): CompanyStatus {
  return deletedAt === null ? 'active' : 'deleted';
}

function requestedStatuses(query: ListQuery): ReadonlySet<CompanyStatus> {
  const filter = query.filters.status;
  const values = filter?.kind === 'select' ? filter.values : [];
  const known = COMPANY_STATUSES.filter((status) => values.includes(status));
  return new Set(known.length === 0 ? ['active'] : known);
}

function listWhere(query: ListQuery): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  const statuses = requestedStatuses(query);
  if (statuses.size === 1) {
    conditions.push(
      statuses.has('active') ? Prisma.sql`c.deleted_at IS NULL` : Prisma.sql`c.deleted_at IS NOT NULL`,
    );
  }
  // La forma normalizada solo tiene [a-z0-9]: no deja comodines de LIKE que escapar.
  const term = normalizeCompanyName(query.search);
  if (term !== '') {
    const pattern = `%${term}%`;
    conditions.push(
      Prisma.sql`(c.name_normalized LIKE ${pattern} OR c.tax_id_normalized LIKE ${pattern})`,
    );
  }
  return conditions.length === 0
    ? Prisma.empty
    : Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

function listOrderBy(query: ListQuery): Prisma.Sql {
  const direction = query.sort?.direction === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const column =
    query.sort?.columnId === 'createdAt' ? Prisma.sql`c.created_at` : Prisma.sql`c.name_normalized`;
  return Prisma.sql`ORDER BY ${column} ${direction}, c.id ASC`;
}

type CompanyListRow = {
  id: string;
  name: string;
  tax_id: string | null;
  country: string | null;
  live_user_count: number;
  created_at: Date;
  deleted_at: Date | null;
};

function fieldsOf(details: Prisma.JsonValue | null): readonly CompanyField[] {
  if (typeof details !== 'object' || details === null || Array.isArray(details)) return [];
  const fields = details.fields;
  if (!Array.isArray(fields)) return [];
  return fields.every(isCompanyField) ? fields : [];
}

function isCompanyField(value: unknown): value is CompanyField {
  return COMPANY_FIELDS.some((field) => field === value);
}

function addonOf(details: Prisma.JsonValue | null): string | null {
  if (typeof details !== 'object' || details === null || Array.isArray(details)) return null;
  return typeof details.addon === 'string' ? details.addon : null;
}

export function createCompanyRepository(db: PrismaLike = prisma): CompanyRepository {
  return {
    async createWithAdministrator({ company, administrator, actorId, now }) {
      let writingEvent = false;
      try {
        return await atomically(db, async (tx) => {
          const role = await tx.role.findUnique({
            where: { name: ROLE_ADMINISTRADOR },
            select: { id: true },
          });
          if (role === null) throw new Error(`no existe el rol ${ROLE_ADMINISTRADOR}`);

          const created = await tx.company.create({
            data: { ...company, createdAt: now, updatedAt: now },
            select: { id: true },
          });
          const user = await tx.user.create({
            data: {
              companyId: created.id,
              roleId: role.id,
              firstNames: administrator.firstNames,
              lastNames: administrator.lastNames,
              birthDate: administrator.birthDate,
              email: administrator.email,
              phone: administrator.phone,
              documentTypeCode: administrator.documentTypeCode,
              documentNumber: administrator.documentNumber,
              username: administrator.username,
              passwordHash: NO_CREDENTIAL_SENTINEL,
              mustChangeCredential: true,
              accountStatus: 'pending',
              accountStatusChangedAt: now,
              createdAt: now,
              updatedAt: now,
            },
            select: { id: true },
          });
          writingEvent = true;
          await recordCompanyEvent(tx, { companyId: created.id, kind: 'company.created', actorId, now });
          return { companyId: created.id, administratorId: user.id };
        });
      } catch (error) {
        const duplicate = companyDuplicateOf(error);
        if (duplicate !== null) return duplicate;
        if (isKnownError(error, 'P2002')) {
          const key: DuplicateKey | null = duplicateKeyOf(error);
          if (key !== null) return key;
        }
        // Antes del evento, la unica clave ajena que la entrada puede romper es la del tipo de
        // documento (el rol se resolvio dentro). La del evento es su autor: si no existe, el fallo
        // es inesperado y se relanza, como en el resto de escrituras con evento.
        if (isKnownError(error, 'P2003') && !writingEvent) return 'invalid_document_type';
        throw error;
      }
    },

    async update({ companyId, data, actorId, now }) {
      return withCompanyDuplicates(() =>
        atomically(db, async (tx) => {
          const rows = await tx.$queryRaw<
            Array<{
              name: string;
              tax_id: string | null;
              contact_email: string | null;
              contact_phone: string | null;
            }>
          >`SELECT name, tax_id, contact_email, contact_phone FROM companies
            WHERE id = ${companyId}::uuid FOR UPDATE`;
          const current = rows[0];
          if (current === undefined) return 'not_found' as const;

          const fields = changedCompanyFields(
            {
              name: current.name,
              taxId: current.tax_id,
              contactEmail: current.contact_email,
              contactPhone: current.contact_phone,
            },
            {
              name: data.name,
              taxId: data.taxId,
              contactEmail: data.contactEmail,
              contactPhone: data.contactPhone,
            },
          );
          if (fields.length === 0) return 'unchanged' as const;

          await tx.company.update({
            where: { id: companyId },
            data: { ...data, updatedAt: now },
            select: { id: true },
          });
          await recordCompanyEvent(tx, { companyId, kind: 'company.updated', actorId, now, fields });
          return 'ok' as const;
        }),
      );
    },

    async softDelete({ companyId, confirmationNormalized, actorId, now }) {
      return atomically(db, async (tx) => {
        const deleted = await tx.$queryRaw<Array<{ id: string }>>`
          UPDATE companies SET deleted_at = ${now}, updated_at = ${now}
          WHERE id = ${companyId}::uuid AND deleted_at IS NULL
            AND name_normalized = ${confirmationNormalized}
          RETURNING id`;
        if (deleted.length === 0) {
          const alive = await tx.company.findFirst({
            where: { id: companyId, deletedAt: null },
            select: { id: true },
          });
          return alive === null ? 'not_found' : 'name_mismatch';
        }
        await recordCompanyEvent(tx, { companyId, kind: 'company.deleted', actorId, now });
        return 'ok';
      });
    },

    async reactivate({ companyId, actorId, now }) {
      return withCompanyDuplicates(() =>
        atomically(db, async (tx) => {
          const rows = await tx.$queryRaw<Array<{ deleted_at: Date | null }>>`
            SELECT deleted_at FROM companies WHERE id = ${companyId}::uuid FOR UPDATE`;
          const current = rows[0];
          if (current === undefined) return 'not_found' as const;
          if (current.deleted_at === null) return 'not_deleted' as const;

          await tx.company.update({
            where: { id: companyId },
            data: { deletedAt: null, updatedAt: now },
            select: { id: true },
          });
          await recordCompanyEvent(tx, { companyId, kind: 'company.reactivated', actorId, now });
          return 'ok' as const;
        }),
      );
    },

    async list(query: ListQuery): Promise<Page<CompanyRow>> {
      const { offset, limit } = toOffsetLimit(query.page, query.pageSize);
      const where = listWhere(query);
      const rows = await db.$queryRaw<CompanyListRow[]>`
        SELECT c.id, c.name, c.tax_id, c.country, c.created_at, c.deleted_at,
          (SELECT count(*)::int FROM users u
            WHERE u.company_id = c.id AND u.deleted_at IS NULL) AS live_user_count
        FROM companies c
        ${where}
        ${listOrderBy(query)}
        LIMIT ${limit} OFFSET ${offset}`;
      const totals = await db.$queryRaw<Array<{ total: number }>>`
        SELECT count(*)::int AS total FROM companies c ${where}`;
      const items = rows.map(
        (row): CompanyRow => ({
          id: row.id,
          name: row.name,
          taxId: row.tax_id,
          country: row.country,
          liveUserCount: row.live_user_count,
          createdAt: row.created_at,
          status: statusOf(row.deleted_at),
        }),
      );
      return buildPage(items, totals[0]?.total ?? 0, query.page, limit);
    },

    async findById(companyId: string): Promise<CompanyDetail | null> {
      const row = await db.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          name: true,
          taxId: true,
          contactEmail: true,
          contactPhone: true,
          country: true,
          createdAt: true,
          deletedAt: true,
        },
      });
      if (row === null) return null;
      return { ...row, status: statusOf(row.deletedAt) };
    },

    async countLiveUsersOfAlive(companyId: string): Promise<number | 'not_found'> {
      const alive = await db.company.findFirst({
        where: { id: companyId, deletedAt: null },
        select: { id: true },
      });
      if (alive === null) return 'not_found';
      return db.user.count({ where: { companyId, deletedAt: null } });
    },

    async listEvents(
      companyId: string,
      requested: { readonly page?: number; readonly pageSize?: number },
    ): Promise<Page<CompanyEventView> | 'not_found'> {
      const company = await db.company.findUnique({
        where: { id: companyId },
        select: { id: true },
      });
      if (company === null) return 'not_found';

      const page = requested.page ?? 1;
      const { offset, limit } = toOffsetLimit(page, requested.pageSize);
      const rows = await db.companyEvent.findMany({
        where: { companyId },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit,
        select: {
          id: true,
          kind: true,
          occurredAt: true,
          details: true,
          actor: { select: { id: true, firstNames: true, lastNames: true } },
        },
      });
      const total = await db.companyEvent.count({ where: { companyId } });
      const items = rows.map(
        (row): CompanyEventView => ({
          id: row.id,
          kind: row.kind,
          occurredAt: row.occurredAt,
          actor: row.actor,
          fields: fieldsOf(row.details),
          addon: addonOf(row.details),
        }),
      );
      return buildPage(items, total, page, limit);
    },
  };
}

export function createCompanyMembershipReader(db: PrismaLike = prisma): CompanyMembershipReader {
  return {
    async isUserInCompany(userId, companyId) {
      const row = await db.user.findFirst({
        where: { id: userId, companyId, deletedAt: null },
        select: { id: true },
      });
      return row !== null;
    },
  };
}
