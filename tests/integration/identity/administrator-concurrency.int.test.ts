/**
 * La baja de Administradores del Maestro bajo carrera, contra Postgres real.
 *
 * Lo que se prueba es que el `SELECT ... FOR UPDATE` del conjunto de Administradores vivos en
 * `softDelete` serializa de verdad dos transacciones que CONFIRMAN. Por eso no sirve el patron de
 * transaccion con ROLLBACK: dos conexiones de verdad, cada una con su `PrismaClient` y su pool, y el
 * repositorio de produccion construido sobre cada cliente (`createAdministratorRepository(db)`). El
 * primer caso demuestra que las dos conexiones son distintas con dos `pg_backend_pid()` leidos desde
 * transacciones que se solapan a proposito.
 *
 * AISLAMIENTO — `commit`: cada caso fabrica su propia empresa con nombre irrepetible y sus propios
 * Administradores, y los borra en `finally` (usuarios y despues empresa, por las FK `RESTRICT`).
 * `afterAll` comprueba que no quedo ninguna empresa propia.
 */
import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { normalizeCompanyName } from '@/lib/modules/identity';
import { createAdministratorRepository } from '@/lib/modules/identity/adapters/driven/persistence/administrator-prisma';
import { NO_CREDENTIAL_SENTINEL } from '@/lib/modules/identity/domain/credential-setup-link';
import { createDeleteAdministrator } from '@/lib/modules/identity/domain/delete-administrator';
import { DOCUMENT_TYPE_CC } from '@/lib/modules/identity/domain/document-type';
import { ROLE_ADMINISTRADOR } from '@/lib/modules/identity/domain/roles';
import { prisma } from '@/lib/shared/db/prisma';

import type { UserAccountStatus } from '@/lib/modules/identity/domain/account-status';
import type { PlatformActor } from '@/lib/modules/identity/domain/platform-actor';
import type { AdministratorRepository } from '@/lib/modules/identity/ports/administrator-repository';

const ACTOR: PlatformActor = { id: randomUUID(), permissions: ['empresas.modificar'] };

let clientA: PrismaClient;
let clientB: PrismaClient;
let repoA: AdministratorRepository;
let repoB: AdministratorRepository;
let administradorRoleId = '';

const createdCompanyIds = new Set<string>();

beforeAll(async () => {
  const role = await prisma.role.findUnique({
    where: { name: ROLE_ADMINISTRADOR },
    select: { id: true },
  });
  if (role === null) {
    throw new Error(`falta el rol ${ROLE_ADMINISTRADOR} en la base de la corrida`);
  }
  administradorRoleId = role.id;
  clientA = new PrismaClient();
  clientB = new PrismaClient();
  repoA = createAdministratorRepository(clientA);
  repoB = createAdministratorRepository(clientB);
});

afterAll(async () => {
  expect([...createdCompanyIds]).toEqual([]);
  await clientA.$disconnect();
  await clientB.$disconnect();
});

function createBarrier(expected: number): () => Promise<void> {
  let pending = expected;
  let open!: () => void;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return async () => {
    pending -= 1;
    if (pending === 0) open();
    await opened;
  };
}

async function backendPidWhileHolding(client: PrismaClient, arrive: () => Promise<void>): Promise<number> {
  return client.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<ReadonlyArray<{ pid: number }>>`SELECT pg_backend_pid()::int AS pid`;
      const pid = rows[0]?.pid;
      if (pid === undefined) throw new Error('pg_backend_pid() no devolvio ninguna fila');
      await arrive();
      return pid;
    },
    { maxWait: 10_000, timeout: 10_000 },
  );
}

type Scenario = { readonly companyId: string; readonly adminIds: readonly string[] };

async function createAdministrator(companyId: string, accountStatus: UserAccountStatus): Promise<string> {
  const marca = randomUUID().replaceAll('-', '');
  const user = await prisma.user.create({
    data: {
      firstNames: 'QC165',
      lastNames: 'Carrera',
      birthDate: new Date('1990-01-01T00:00:00.000Z'),
      email: `qc165.carrera.${marca}@example.test`,
      phone: '000000000',
      documentTypeCode: DOCUMENT_TYPE_CC,
      documentNumber: marca.slice(0, 20),
      username: `qc165.carrera.${marca}`,
      passwordHash: NO_CREDENTIAL_SENTINEL,
      roleId: administradorRoleId,
      companyId,
      accountStatus,
    },
    select: { id: true },
  });
  return user.id;
}

async function withScenario(
  statuses: readonly UserAccountStatus[],
  body: (scenario: Scenario) => Promise<void>,
): Promise<void> {
  const name = `QC165 carrera ${randomUUID()}`;
  const company = await prisma.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  });
  createdCompanyIds.add(company.id);
  try {
    const adminIds: string[] = [];
    for (const status of statuses) adminIds.push(await createAdministrator(company.id, status));
    await body({ companyId: company.id, adminIds });
  } finally {
    await prisma.user.updateMany({
      where: { companyId: company.id },
      data: { accountStatusChangedBy: null },
    });
    await prisma.user.deleteMany({ where: { companyId: company.id } });
    await prisma.company.delete({ where: { id: company.id } });
    createdCompanyIds.delete(company.id);
  }
}

async function aliveAdministrators(companyId: string): Promise<number> {
  return prisma.user.count({
    where: { companyId, roleId: administradorRoleId, deletedAt: null },
  });
}

function codeOf(reason: unknown): string {
  if (reason instanceof Error && 'code' in reason && typeof reason.code === 'string') {
    return reason.code;
  }
  throw reason;
}

describe('Baja simultanea de los dos unicos Administradores de una empresa', () => {
  it('R24: las dos conexiones son reales y distintas', async () => {
    expect(clientA).not.toBe(clientB);
    const arrive = createBarrier(2);
    const [pidA, pidB] = await Promise.all([
      backendPidWhileHolding(clientA, arrive),
      backendPidWhileHolding(clientB, arrive),
    ]);
    expect(pidA).not.toBe(pidB);
  });

  const corridas: ReadonlyArray<readonly [number, readonly UserAccountStatus[]]> = [
    [1, ['active', 'active']],
    [2, ['active', 'pending']],
    [3, ['pending', 'pending']],
    [4, ['active', 'active']],
    [5, ['blocked', 'pending']],
  ];

  it.each(corridas)(
    'R24: corrida %i (%j): como maximo una baja pasa, la otra responde company_last_administrator y la empresa conserva un Administrador vivo',
    async (_corrida, statuses) => {
      await withScenario(statuses, async ({ companyId, adminIds }) => {
        const [primero, segundo] = adminIds;
        const removeA = createDeleteAdministrator({ administrators: repoA });
        const removeB = createDeleteAdministrator({ administrators: repoB });

        const resultados = await Promise.allSettled([
          removeA(ACTOR, { id: primero }),
          removeB(ACTOR, { id: segundo }),
        ]);

        const pasadas = resultados.filter((r) => r.status === 'fulfilled');
        const rechazadas = resultados.filter((r) => r.status === 'rejected');
        expect(pasadas.length).toBeLessThanOrEqual(1);
        expect(rechazadas.length).toBeGreaterThanOrEqual(1);
        for (const rechazo of rechazadas) {
          expect(codeOf(rechazo.reason)).toBe('company_last_administrator');
        }
        expect(await aliveAdministrators(companyId)).toBeGreaterThanOrEqual(1);
        expect(await aliveAdministrators(companyId)).toBe(2 - pasadas.length);
      });
    },
  );

  it.each([1, 2, 3])(
    'R24: corrida %i en el adaptador: los resultados son uno ok y uno last_administrator, y queda exactamente un Administrador vivo',
    async () => {
      await withScenario(['active', 'pending'], async ({ companyId, adminIds }) => {
        const [primero, segundo] = adminIds;
        const now = new Date();
        const resultados = await Promise.all([
          repoA.softDelete({ id: primero as string, now }),
          repoB.softDelete({ id: segundo as string, now }),
        ]);
        expect([...resultados].sort()).toEqual(['last_administrator', 'ok']);
        expect(await aliveAdministrators(companyId)).toBe(1);
      });
    },
  );

  it('R24 (simetrico): con tres Administradores vivos, dos bajas simultaneas pasan las dos y queda uno', async () => {
    await withScenario(['active', 'pending', 'active'], async ({ companyId, adminIds }) => {
      const [primero, segundo] = adminIds;
      const now = new Date();
      const resultados = await Promise.all([
        repoA.softDelete({ id: primero as string, now }),
        repoB.softDelete({ id: segundo as string, now }),
      ]);
      expect(resultados).toEqual(['ok', 'ok']);
      expect(await aliveAdministrators(companyId)).toBe(1);
    });
  });

  it('R24: dos bajas simultaneas del mismo Administrador: una pasa y la otra no lo encuentra', async () => {
    await withScenario(['active', 'active'], async ({ companyId, adminIds }) => {
      const [primero] = adminIds;
      const now = new Date();
      const resultados = await Promise.all([
        repoA.softDelete({ id: primero as string, now }),
        repoB.softDelete({ id: primero as string, now }),
      ]);
      expect([...resultados].sort()).toEqual(['not_found', 'ok']);
      expect(await aliveAdministrators(companyId)).toBe(1);
    });
  });
});
