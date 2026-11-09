/**
 * `createConditioningTeamRepository` contra una base Postgres REAL, construido sobre la `tx` del
 * test: cada `it` corre en una transaccion interactiva que termina en `ROLLBACK`, y lo que se espera
 * que falle va en un SAVEPOINT.
 */
import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { createConditioningTeamRepository } from '@/lib/modules/asignaciones/adapters/driven/persistence/conditioning-team-prisma';
import { normalizeCompanyName, normalizeWorkGroupName } from '@/lib/modules/identity';
import { prisma } from '@/lib/shared/db/prisma';

import type { NewConditioningTeamMember } from '@/lib/modules/asignaciones/ports/conditioning-team-repository';
import { ensureOnlyLine, createOrderWithLine } from '../../helpers/only-order-line';

class RollbackSignal extends Error {
  constructor() {
    super('rollback de aislamiento del test');
    this.name = 'RollbackSignal';
  }
}

async function inRolledBackTransaction(
  body: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await body(tx);
        throw new RollbackSignal();
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error;
  }
}

let savepointSeq = 0;

async function expectThrowsInSavepoint(
  tx: Prisma.TransactionClient,
  run: () => Promise<unknown>,
): Promise<unknown> {
  savepointSeq += 1;
  const savepoint = `sp_team_repo_${String(savepointSeq)}`;
  await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
  try {
    await run();
  } catch (error) {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    return error;
  }
  await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
  throw new Error('se esperaba que la insercion lanzara, pero no lanzo');
}

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

async function createCompany(tx: Prisma.TransactionClient): Promise<string> {
  const name = `Empresa equipo ${token()}`;
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  });
  return company.id;
}

async function createUser(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const marca = token();
  const documentType = await tx.documentType.create({
    data: { code: `DOC${marca.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  });
  const role = await tx.role.create({
    data: { name: `rol-${marca}`, description: 'Rol de prueba' },
    select: { id: true },
  });
  const user = await tx.user.create({
    data: {
      firstNames: 'Ana',
      lastNames: `Perez ${marca.slice(0, 6)}`,
      birthDate: new Date('1990-05-17T00:00:00.000Z'),
      email: `ana.${marca}@quimicloude.test`,
      phone: '+57 300 111 2233',
      documentTypeCode: documentType.code,
      documentNumber: marca.slice(0, 12),
      username: `ana.${marca}`,
      passwordHash: 'hash-de-prueba-no-es-un-algoritmo-real',
      roleId: role.id,
      companyId,
    },
    select: { id: true },
  });
  return user.id;
}

let nextSequence = 840_000;

async function createOrder(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const marca = token();
  const recipe = await tx.recipe.create({
    data: { name: `Receta ${marca}`, nameNormalized: `receta${marca}`, companyId },
    select: { id: true },
  });
  nextSequence += 1;
  const order = await createOrderWithLine(tx, {
      companyId,
      orderYear: new Date().getUTCFullYear(),
      orderSequence: nextSequence,
      recipeId: recipe.id,
      quantity: new Prisma.Decimal('10'),
    });
  return order.id;
}

async function createGroup(tx: Prisma.TransactionClient, companyId: string, name: string): Promise<string> {
  const group = await tx.workGroup.create({
    data: { companyId, name, nameNormalized: normalizeWorkGroupName(name) },
    select: { id: true },
  });
  return group.id;
}

interface Scenario {
  readonly companyId: string;
  readonly orderId: string;
  readonly orderLineId: string;
  readonly users: readonly [string, string, string];
  readonly groupId: string;
  readonly groupName: string;
}

async function seedScenario(tx: Prisma.TransactionClient): Promise<Scenario> {
  const companyId = await createCompany(tx);
  const groupName = `Turno ${token()}`;
  const orderId = await createOrder(tx, companyId);
  return {
    companyId,
    orderId,
    orderLineId: await ensureOnlyLine(tx, orderId),
    users: [await createUser(tx, companyId), await createUser(tx, companyId), await createUser(tx, companyId)],
    groupId: await createGroup(tx, companyId, groupName),
    groupName,
  };
}

/** Una suelta y dos del grupo, en el orden de composicion. */
function teamOf(s: Scenario): readonly NewConditioningTeamMember[] {
  const base = { orderId: s.orderId, orderLineId: s.orderLineId, companyId: s.companyId };
  return [
    { ...base, userId: s.users[0], workGroupId: null, workGroupName: null, position: 0 },
    { ...base, userId: s.users[1], workGroupId: s.groupId, workGroupName: s.groupName, position: 1 },
    { ...base, userId: s.users[2], workGroupId: s.groupId, workGroupName: s.groupName, position: 2 },
  ];
}

type RawMember = {
  readonly user_id: string;
  readonly work_group_id: string | null;
  readonly work_group_name: string | null;
  readonly position: number;
  readonly created_at: Date;
};

async function rawTeam(tx: Prisma.TransactionClient, orderId: string): Promise<readonly RawMember[]> {
  return tx.$queryRaw<RawMember[]>`
    SELECT "user_id"::text AS "user_id", "work_group_id"::text AS "work_group_id", "work_group_name",
           "position", "created_at"
    FROM "order_conditioning_team_members" WHERE "order_id" = CAST(${orderId} AS uuid)
    ORDER BY "position"`;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('createConditioningTeamRepository — insertAll y listByLineInCompany', () => {
  it('R13: insertAll escribe una fila por persona y la lectura las devuelve por `position`', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seedScenario(tx);
      const repo = createConditioningTeamRepository(tx);
      const team = teamOf(s);

      // Se insertan desordenadas: el orden de lectura sale de `position`, no del de insercion.
      expect(await repo.insertAll([team[2]!, team[0]!, team[1]!])).toBe(3);

      expect(await repo.listByLineInCompany(s.companyId, s.orderId, s.orderLineId)).toEqual([
        { userId: s.users[0], workGroupId: null, workGroupName: null },
        { userId: s.users[1], workGroupId: s.groupId, workGroupName: s.groupName },
        { userId: s.users[2], workGroupId: s.groupId, workGroupName: s.groupName },
      ]);
    });
  });

  it('R13: la lectura filtra por empresa y por pedido', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await seedScenario(tx);
      const b = await seedScenario(tx);
      const repo = createConditioningTeamRepository(tx);
      await repo.insertAll(teamOf(a));
      await repo.insertAll(teamOf(b).slice(0, 1));

      expect(await repo.listByLineInCompany(b.companyId, a.orderId, a.orderLineId)).toEqual([]);
      expect(await repo.listByLineInCompany(a.companyId, b.orderId, b.orderLineId)).toEqual([]);
      expect(await repo.listByLineInCompany(b.companyId, b.orderId, b.orderLineId)).toHaveLength(1);
      expect(await repo.listByLineInCompany(a.companyId, a.orderId, a.orderLineId)).toHaveLength(3);
    });
  });

  it('R13: un pedido sin equipo devuelve la lista vacia', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seedScenario(tx);
      expect(await createConditioningTeamRepository(tx).listByLineInCompany(s.companyId, s.orderId, s.orderLineId)).toEqual([]);
    });
  });

  it('R13: una insercion con una persona duplicada lanza y no deja ninguna fila', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seedScenario(tx);
      const repo = createConditioningTeamRepository(tx);
      const team = teamOf(s);
      const duplicada = { ...team[0]!, position: 3 };

      const error = await expectThrowsInSavepoint(tx, () => repo.insertAll([...team, duplicada]));

      expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
      expect(await rawTeam(tx, s.orderId)).toEqual([]);
    });
  });

  it('R13: una segunda insercion que repite a alguien ya guardado lanza y no toca lo guardado', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seedScenario(tx);
      const repo = createConditioningTeamRepository(tx);
      await repo.insertAll(teamOf(s).slice(0, 1));
      const antes = await rawTeam(tx, s.orderId);

      await expectThrowsInSavepoint(tx, () => repo.insertAll(teamOf(s).slice(0, 1)));

      expect(await rawTeam(tx, s.orderId)).toEqual(antes);
    });
  });
});

describe('el equipo guardado no cambia cuando cambian los grupos o las personas (R14)', () => {
  it('R14: renombrar el grupo, darlo de baja, sacar o meter miembros y dar de baja a una persona no cambia ninguna fila', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seedScenario(tx);
      const repo = createConditioningTeamRepository(tx);
      for (const userId of [s.users[1], s.users[2]]) {
        await tx.workGroupMember.create({ data: { companyId: s.companyId, workGroupId: s.groupId, userId } });
      }
      await repo.insertAll(teamOf(s));
      const antes = await rawTeam(tx, s.orderId);
      const leidoAntes = await repo.listByLineInCompany(s.companyId, s.orderId, s.orderLineId);

      const nuevoNombre = `Renombrado ${token()}`;
      await tx.workGroup.update({
        where: { id: s.groupId },
        data: { name: nuevoNombre, nameNormalized: normalizeWorkGroupName(nuevoNombre) },
      });
      await tx.workGroupMember.delete({
        where: { workGroupId_userId: { workGroupId: s.groupId, userId: s.users[2] } },
      });
      const recienLlegado = await createUser(tx, s.companyId);
      await tx.workGroupMember.create({
        data: { companyId: s.companyId, workGroupId: s.groupId, userId: recienLlegado },
      });
      await tx.user.update({ where: { id: s.users[1] }, data: { deletedAt: new Date() } });
      await tx.workGroup.update({ where: { id: s.groupId }, data: { deletedAt: new Date() } });

      expect(await rawTeam(tx, s.orderId)).toEqual(antes);
      expect(await repo.listByLineInCompany(s.companyId, s.orderId, s.orderLineId)).toEqual(leidoAntes);
      expect(antes.map((row) => row.work_group_name)).toEqual([null, s.groupName, s.groupName]);
    });
  });
});

/** Una segunda receta en el pedido del escenario, con su propia linea. */
async function addSecondLine(tx: Prisma.TransactionClient, s: Scenario): Promise<string> {
  const marca = token();
  const recipe = await tx.recipe.create({
    data: { name: `Receta B ${marca}`, nameNormalized: `recetab${marca}`, companyId: s.companyId },
    select: { id: true },
  });
  const line = await tx.orderLine.create({
    data: {
      orderId: s.orderId,
      companyId: s.companyId,
      position: 1,
      recipeId: recipe.id,
      originalRecipeId: recipe.id,
      quantity: '5',
    },
    select: { id: true },
  });
  return line.id;
}

describe('el equipo es el de la receta nombrada (QT-315)', () => {
  it('R13: con dos lineas del mismo pedido, el equipo de una no sale en la otra', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seedScenario(tx);
      const lineB = await addSecondLine(tx, s);
      const repo = createConditioningTeamRepository(tx);
      const team = teamOf(s);
      await repo.insertAll(team.slice(0, 2));
      // La misma persona puede estar en el equipo de las dos recetas.
      await repo.insertAll([
        { ...team[1]!, orderLineId: lineB, position: 0 },
        { ...team[2]!, orderLineId: lineB, position: 1 },
      ]);

      expect(await repo.listByLineInCompany(s.companyId, s.orderId, s.orderLineId)).toEqual([
        { userId: s.users[0], workGroupId: null, workGroupName: null },
        { userId: s.users[1], workGroupId: s.groupId, workGroupName: s.groupName },
      ]);
      expect(await repo.listByLineInCompany(s.companyId, s.orderId, lineB)).toEqual([
        { userId: s.users[1], workGroupId: s.groupId, workGroupName: s.groupName },
        { userId: s.users[2], workGroupId: s.groupId, workGroupName: s.groupName },
      ]);
    });
  });

  it('R13: una linea de otro pedido o de otra empresa no trae equipo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seedScenario(tx);
      const otro = await seedScenario(tx);
      const otroPedido = await createOrder(tx, s.companyId);
      const repo = createConditioningTeamRepository(tx);
      await repo.insertAll(teamOf(s));

      expect(await repo.listByLineInCompany(s.companyId, otroPedido, s.orderLineId)).toEqual([]);
      expect(await repo.listByLineInCompany(otro.companyId, s.orderId, s.orderLineId)).toEqual([]);
    });
  });

  it('R13: listByOrdersInCompany dice de que linea es cada miembro', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seedScenario(tx);
      const lineB = await addSecondLine(tx, s);
      const repo = createConditioningTeamRepository(tx);
      const team = teamOf(s);
      await repo.insertAll([team[0]!, { ...team[1]!, orderLineId: lineB, position: 1 }]);

      const filas = await repo.listByOrdersInCompany(s.companyId, [s.orderId]);

      expect(filas.map((row) => [row.userId, row.orderLineId])).toEqual([
        [s.users[0], s.orderLineId],
        [s.users[1], lineB],
      ]);
    });
  });
});

describe('createConditioningTeamRepository — listByOrdersInCompany', () => {
  it('R10: listByOrdersInCompany filtra por empresa y ordena por pedido y position', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await seedScenario(tx);
      const b = await seedScenario(tx);
      const otroPedidoA = await createOrder(tx, a.companyId);
      const repo = createConditioningTeamRepository(tx);
      const equipoA = teamOf(a);
      const equipoOtro = teamOf({ ...a, orderId: otroPedidoA, orderLineId: await ensureOnlyLine(tx, otroPedidoA) }).slice(0, 2);
      // Se insertan desordenadas y mezcladas entre pedidos.
      await repo.insertAll([equipoA[2]!, equipoOtro[1]!, equipoA[0]!]);
      await repo.insertAll([equipoOtro[0]!, equipoA[1]!]);
      await repo.insertAll(teamOf(b));

      const filas = await repo.listByOrdersInCompany(a.companyId, [a.orderId, otroPedidoA, b.orderId]);

      const fila = (orderId: string, member: NewConditioningTeamMember) => ({
        orderId,
        orderLineId: member.orderLineId,
        userId: member.userId,
        workGroupId: member.workGroupId,
        workGroupName: member.workGroupName,
      });
      const porPedido = [
        [a.orderId, equipoA.map((m) => fila(a.orderId, m))],
        [otroPedidoA, equipoOtro.map((m) => fila(otroPedidoA, m))],
      ] as const;
      const esperado = [...porPedido].sort(([x], [y]) => (x < y ? -1 : 1)).flatMap(([, rows]) => rows);
      expect(filas).toEqual(esperado);
      // Ninguna fila de la otra empresa, aunque se pidiera su pedido.
      expect(filas.some((row) => row.orderId === b.orderId)).toBe(false);
      expect(await repo.listByOrdersInCompany(b.companyId, [a.orderId, otroPedidoA])).toEqual([]);
    });
  });

  it('R10: con orderIds vacio devuelve la lista vacia sin consultar', async () => {
    const sinConsulta = {
      orderConditioningTeamMember: {
        findMany: () => {
          throw new Error('no deberia consultar');
        },
      },
    } as unknown as Prisma.TransactionClient;
    await expect(createConditioningTeamRepository(sinConsulta).listByOrdersInCompany(randomUUID(), [])).resolves.toEqual(
      [],
    );
  });
});
