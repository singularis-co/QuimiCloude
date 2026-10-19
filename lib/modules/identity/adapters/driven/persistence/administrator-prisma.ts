import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/lib/shared/db/prisma';
import { buildPage, toOffsetLimit } from '@/lib/shared/pagination';

import { NO_CREDENTIAL_SENTINEL } from '../../../domain/credential-setup-link';
import { ROLE_ADMINISTRADOR } from '../../../domain/roles';
import { changeRevokesSessions, floorToSecond } from '../../../domain/session-revocation';

import { atomically } from './company-prisma';
import { insensitiveContainsCondition, selectCondition } from './list-query-sql';
import { duplicateKeyOf } from './user-admin-prisma';

import type {
  AdministratorCompany,
  AdministratorDetail,
  AdministratorRow,
} from '../../../domain/administrator-view';
import type { ListQuery, ListSort } from '../../../domain/list-query';
import type { Page } from '../../../domain/page';
import type { AdministratorRepository } from '../../../ports/administrator-repository';
import type { DuplicateKey } from '../../../ports/user-admin-repository';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

// Vivo, con el rol de Administrador y de empresa viva. El Maestro no tiene empresa: queda fuera.
const MANAGEABLE = {
  deletedAt: null,
  role: { name: ROLE_ADMINISTRADOR },
  company: { deletedAt: null },
} satisfies Prisma.UserWhereInput;

const COMPANY_SELECT = { select: { id: true, name: true } } as const;

const ROW_SELECT = {
  id: true,
  firstNames: true,
  lastNames: true,
  username: true,
  email: true,
  accountStatus: true,
  createdAt: true,
  company: COMPANY_SELECT,
} satisfies Prisma.UserSelect;

const DETAIL_SELECT = {
  id: true,
  firstNames: true,
  lastNames: true,
  birthDate: true,
  email: true,
  phone: true,
  documentTypeCode: true,
  documentNumber: true,
  username: true,
  accountStatus: true,
  accountStatusChangedAt: true,
  createdAt: true,
  updatedAt: true,
  company: COMPANY_SELECT,
} satisfies Prisma.UserSelect;

type RowPayload = Prisma.UserGetPayload<{ select: typeof ROW_SELECT }>;
type DetailPayload = Prisma.UserGetPayload<{ select: typeof DETAIL_SELECT }>;

const uuidSchema = z.string().uuid();

function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}

// El `where` ya exige empresa viva; una fila sin ella es un dato roto, no un caso de negocio.
function companyOf(row: { readonly company: AdministratorCompany | null }): AdministratorCompany {
  if (row.company === null) throw new Error('administrador sin empresa');
  return { id: row.company.id, name: row.company.name };
}

function toRow(row: RowPayload, isLastAdministrator: boolean): AdministratorRow {
  return {
    id: row.id,
    firstNames: row.firstNames,
    lastNames: row.lastNames,
    username: row.username,
    email: row.email,
    company: companyOf(row),
    accountStatus: row.accountStatus,
    createdAt: row.createdAt,
    isLastAdministrator,
  };
}

function toDetail(row: DetailPayload, isLastAdministrator: boolean): AdministratorDetail {
  return {
    id: row.id,
    firstNames: row.firstNames,
    lastNames: row.lastNames,
    birthDate: row.birthDate,
    email: row.email,
    phone: row.phone,
    documentTypeCode: row.documentTypeCode,
    documentNumber: row.documentNumber,
    username: row.username,
    company: companyOf(row),
    accountStatus: row.accountStatus,
    accountStatusChangedAt: row.accountStatusChangedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isLastAdministrator,
  };
}

function listWhere(query: ListQuery): Prisma.UserWhereInput {
  const filter = query.filters.companyId;
  const companies =
    filter?.kind === 'select' ? selectCondition(filter.values.filter(isUuid)) : null;
  const search = insensitiveContainsCondition(query.search);
  return {
    ...MANAGEABLE,
    ...(companies === null ? {} : { companyId: companies }),
    ...(search === null
      ? {}
      : {
          OR: [
            { firstNames: search },
            { lastNames: search },
            { email: search },
            { username: search },
          ],
        }),
  };
}

// Sin desempate por `id`, dos filas empatadas pueden cambiar de pagina entre consultas.
function listOrderBy(sort: ListSort | null): Prisma.UserOrderByWithRelationInput[] {
  const tieBreaker = { id: 'asc' } as const;
  if (sort === null) return [{ createdAt: 'desc' }, tieBreaker];
  const dir = sort.direction;
  switch (sort.columnId) {
    case 'lastNames':
      return [{ lastNames: dir }, tieBreaker];
    case 'firstNames':
      return [{ firstNames: dir }, tieBreaker];
    case 'username':
      return [{ username: dir }, tieBreaker];
    case 'email':
      return [{ email: dir }, tieBreaker];
    case 'accountStatus':
      return [{ accountStatus: dir }, tieBreaker];
    case 'createdAt':
      return [{ createdAt: dir }, tieBreaker];
    case 'companyName':
      return [{ company: { name: dir } }, tieBreaker];
    default:
      return [{ createdAt: 'desc' }, tieBreaker];
  }
}

function isKnownError(error: unknown, code: string): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

// Se traduce fuera de la transaccion: dentro, la transaccion ya esta abortada.
function writeFailureOf(error: unknown): DuplicateKey | 'invalid_document_type' | null {
  if (isKnownError(error, 'P2002')) return duplicateKeyOf(error);
  // El rol y la empresa se resolvieron dentro: la unica clave ajena que la entrada puede romper
  // es la del tipo de documento.
  if (isKnownError(error, 'P2003')) return 'invalid_document_type';
  return null;
}

export function createAdministratorRepository(db: PrismaLike = prisma): AdministratorRepository {
  async function liveAdministratorCounts(
    companyIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    if (companyIds.length === 0) return new Map();
    const groups = await db.user.groupBy({
      by: ['companyId'],
      where: { ...MANAGEABLE, companyId: { in: [...companyIds] } },
      _count: { _all: true },
    });
    const counts = new Map<string, number>();
    for (const group of groups) {
      if (group.companyId !== null) counts.set(group.companyId, group._count._all);
    }
    return counts;
  }

  return {
    async list(query: ListQuery): Promise<Page<AdministratorRow>> {
      const { offset, limit } = toOffsetLimit(query.page, query.pageSize);
      const where = listWhere(query);
      const [rows, total] = await Promise.all([
        db.user.findMany({
          where,
          select: ROW_SELECT,
          orderBy: listOrderBy(query.sort),
          skip: offset,
          take: limit,
        }),
        db.user.count({ where }),
      ]);
      const counts = await liveAdministratorCounts([
        ...new Set(rows.map((row) => companyOf(row).id)),
      ]);
      const items = rows.map((row) => toRow(row, counts.get(companyOf(row).id) === 1));
      return buildPage(items, total, query.page, limit);
    },

    async findManageable(id: string): Promise<AdministratorDetail | null> {
      const row = await db.user.findFirst({
        where: { id, ...MANAGEABLE },
        select: DETAIL_SELECT,
      });
      if (row === null) return null;
      const companyId = companyOf(row).id;
      const live = await db.user.count({ where: { ...MANAGEABLE, companyId } });
      return toDetail(row, live === 1);
    },

    async create({ companyId, administrator, now }) {
      try {
        return await atomically(db, async (tx) => {
          // `FOR SHARE` hace esperar a una baja simultanea de la empresa, que actualiza esta fila.
          const companies = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM companies
            WHERE id = ${companyId}::uuid AND deleted_at IS NULL
            FOR SHARE`;
          if (companies.length === 0) return 'company_not_found' as const;

          const role = await tx.role.findUnique({
            where: { name: ROLE_ADMINISTRADOR },
            select: { id: true },
          });
          if (role === null) throw new Error(`no existe el rol ${ROLE_ADMINISTRADOR}`);

          const created = await tx.user.create({
            data: {
              companyId,
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
          return { administratorId: created.id };
        });
      } catch (error) {
        const outcome = writeFailureOf(error);
        if (outcome !== null) return outcome;
        throw error;
      }
    },

    async update({ id, data, now }) {
      try {
        return await atomically(db, async (tx) => {
          const target = await tx.user.findFirst({
            where: { id, ...MANAGEABLE },
            select: { companyId: true },
          });
          if (target === null || target.companyId === null) return 'not_found' as const;

          const { count } = await tx.user.updateMany({
            where: { id, companyId: target.companyId, deletedAt: null },
            data: {
              firstNames: data.firstNames,
              lastNames: data.lastNames,
              birthDate: data.birthDate,
              email: data.email,
              phone: data.phone,
              documentTypeCode: data.documentTypeCode,
              documentNumber: data.documentNumber,
              username: data.username,
              updatedAt: now,
            },
          });
          return count === 1 ? ('ok' as const) : ('not_found' as const);
        });
      } catch (error) {
        const outcome = writeFailureOf(error);
        if (outcome !== null) return outcome;
        throw error;
      }
    },

    async softDelete({ id, now }) {
      return atomically(db, async (tx) => {
        const target = await tx.user.findFirst({
          where: { id, ...MANAGEABLE },
          select: { companyId: true },
        });
        if (target === null || target.companyId === null) return 'not_found';
        const companyId = target.companyId;

        // Se bloquea el conjunto entero de Administradores vivos, no solo el objetivo: dos bajas
        // simultaneas en la misma empresa se serializan, y la segunda relee el conjunto ya reducido.
        const alive = await tx.$queryRaw<ReadonlyArray<{ id: string }>>`
          SELECT id FROM users
          WHERE company_id = ${companyId}::uuid
            AND role_id = (SELECT id FROM roles WHERE name = ${ROLE_ADMINISTRADOR})
            AND deleted_at IS NULL
          FOR UPDATE`;
        const aliveIds = alive.map((row) => row.id);
        if (!aliveIds.includes(id)) return 'not_found';
        if (aliveIds.length === 1) return 'last_administrator';

        const stamp = changeRevokesSessions({ kind: 'delete' })
          ? { sessionsValidFrom: floorToSecond(now) }
          : {};
        const { count } = await tx.user.updateMany({
          where: { id, companyId, deletedAt: null },
          data: { ...stamp, deletedAt: now, updatedAt: now },
        });
        return count === 1 ? 'ok' : 'not_found';
      });
    },
  };
}
