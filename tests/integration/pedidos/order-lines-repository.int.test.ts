/**
 * Las lineas del pedido en `order-prisma.ts` contra Postgres real: `findOnlyLineId`, la lectura y
 * el bloqueo por `position`, las escrituras de linea, el estado derivado y el unico de receta
 * activa.
 *
 * Casi todos los casos corren en una transaccion que termina en ROLLBACK, y el repositorio recibe
 * ese mismo `tx`. La carrera de R5 no puede: necesita dos transacciones que confirmen de verdad,
 * asi que siembra una empresa efimera con el cliente global y la borra en un `finally`.
 */
import { Prisma } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { DuplicateOrderRecipeError } from '@/lib/modules/pedidos/domain/errors';
import {
  createOrderWriteRepository,
  findAliveOrderLines,
} from '@/lib/modules/pedidos/adapters/driven/persistence/order-prisma';
import { withOrderTransaction } from '@/lib/modules/pedidos/adapters/driven/persistence/order-unit-of-work-prisma';
import { prisma } from '@/lib/shared/db/prisma';

import {
  freshSequence,
  inRolledBackTransaction,
  seedCompany,
  seedRecipe,
  seedUser,
  token,
} from '../../helpers/migration-script';

import type { NewOrderLine } from '@/lib/modules/pedidos/ports/order-write-repository';

type Db = Prisma.TransactionClient;
type Base = { readonly companyId: string; readonly recipeId: string };
type Fixture = Base & { readonly actorId: string; readonly unitId: string };

const AHORA = new Date('2026-11-03T12:00:00.000Z');

async function seedBase(tx: Db): Promise<Base> {
  const companyId = await seedCompany(tx);
  const recipeId = await seedRecipe(tx, companyId);
  return { companyId, recipeId };
}

async function seedFixture(tx: Db): Promise<Fixture> {
  const base = await seedBase(tx);
  const actorId = await seedUser(tx, base.companyId);
  const marca = token();
  const unit = await tx.unit.create({
    data: { name: `Unidad ${marca}`, nameNormalized: `unidad${marca}`, companyId: base.companyId },
    select: { id: true },
  });
  return { ...base, actorId, unitId: unit.id };
}

async function insertOrder(tx: Db, base: Base): Promise<string> {
  const { id } = await tx.order.create({
    data: {
      companyId: base.companyId,
      orderYear: 2026,
      orderSequence: freshSequence(),
      recipeId: base.recipeId,
      quantity: new Prisma.Decimal('10'),
    },
    select: { id: true },
  });
  return id;
}

async function insertLine(tx: Db, base: Base, orderId: string, position: number): Promise<string> {
  const recipeId = position === 0 ? base.recipeId : await seedRecipe(tx, base.companyId);
  const { id } = await tx.orderLine.create({
    data: {
      orderId,
      companyId: base.companyId,
      position,
      recipeId,
      originalRecipeId: recipeId,
      quantity: new Prisma.Decimal('10'),
    },
    select: { id: true },
  });
  return id;
}

function newLine(fixture: Fixture, recipeId: string, originalRecipeId: string = recipeId): NewOrderLine {
  return {
    recipeId,
    originalRecipeId,
    quantity: '5',
    unitId: fixture.unitId,
    salePrice: null,
    presentationLines: [],
    status: 'PENDIENTE',
    cost: null,
  };
}

const EMPTY = { removedIds: [], edited: [], added: [] } as const;

afterAll(async () => {
  await prisma.$disconnect();
});

describe('QT-313 OrderWriteRepository.findOnlyLineId', () => {
  it('QT-313 R37: con una linea devuelve su id', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const orderId = await insertOrder(tx, base);
      const lineId = await insertLine(tx, base, orderId, 0);

      expect(await createOrderWriteRepository(tx).findOnlyLineId(orderId, { companyId: base.companyId })).toBe(lineId);
    });
  });

  it('QT-313 R37: sin ninguna linea devuelve null', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const orderId = await insertOrder(tx, base);

      expect(await createOrderWriteRepository(tx).findOnlyLineId(orderId, { companyId: base.companyId })).toBeNull();
    });
  });

  it('QT-313 R37: con el ambito de otra empresa devuelve null aunque el pedido tenga linea', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const otra = await seedCompany(tx);
      const orderId = await insertOrder(tx, base);
      await insertLine(tx, base, orderId, 0);

      expect(await createOrderWriteRepository(tx).findOnlyLineId(orderId, { companyId: otra })).toBeNull();
    });
  });

  it('QT-313 R37: una linea quitada no cuenta; con dos vivas lanza en vez de elegir una', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const orderId = await insertOrder(tx, base);
      const primera = await insertLine(tx, base, orderId, 0);
      const segunda = await insertLine(tx, base, orderId, 1);
      const repository = createOrderWriteRepository(tx);

      await expect(repository.findOnlyLineId(orderId, { companyId: base.companyId })).rejects.toThrow(
        /mas de una linea/u,
      );

      await tx.orderLine.update({ where: { id: segunda }, data: { deletedAt: new Date() } });
      expect(await repository.findOnlyLineId(orderId, { companyId: base.companyId })).toBe(primera);
    });
  });
});

describe('QT-313 orden de las lineas', () => {
  it('QT-313 R6: leer y bloquear devuelven las lineas por position aunque se dieran de alta en otro orden; la quitada no sale y la cancelada si', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const scope = { companyId: base.companyId };
      const orderId = await insertOrder(tx, base);
      const tercera = await insertLine(tx, base, orderId, 2);
      const primera = await insertLine(tx, base, orderId, 0);
      const segunda = await insertLine(tx, base, orderId, 1);
      const quitada = await insertLine(tx, base, orderId, 3);
      await tx.orderLine.update({ where: { id: quitada }, data: { deletedAt: AHORA } });
      await tx.orderLine.update({
        where: { id: segunda },
        data: { status: 'CANCELADO', cancellationReason: 'sin material' },
      });

      const leidas = await findAliveOrderLines(orderId, scope, tx);
      expect(leidas.map((line) => line.id)).toEqual([primera, segunda, tercera]);
      expect(leidas.map((line) => line.position)).toEqual([0, 1, 2]);
      expect(leidas[1]?.status).toBe('CANCELADO');

      const bloqueadas = await createOrderWriteRepository(tx).lockAliveLines(orderId, scope);
      expect(bloqueadas?.order.id).toBe(orderId);
      expect(bloqueadas?.lines.map((line) => line.id)).toEqual([primera, segunda, tercera]);
    });
  });

  it('QT-313 R6: las altas toman position despues de la mayor del pedido, quitadas incluidas, y vuelven en el orden pedido con su reparto', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await seedFixture(tx);
      const scope = { companyId: fixture.companyId };
      const orderId = await insertOrder(tx, fixture);
      await insertLine(tx, fixture, orderId, 0);
      const quitada = await insertLine(tx, fixture, orderId, 1);
      await tx.orderLine.update({ where: { id: quitada }, data: { deletedAt: AHORA } });
      const recetaA = await seedRecipe(tx, fixture.companyId);
      const recetaB = await seedRecipe(tx, fixture.companyId);

      const anadidas = await createOrderWriteRepository(tx).writeLines(
        orderId,
        { ...EMPTY, added: [newLine(fixture, recetaA), newLine(fixture, recetaB)] },
        fixture.actorId,
        AHORA,
        scope,
      );

      expect(anadidas?.map((line) => [line.recipeId, line.position])).toEqual([
        [recetaA, 2],
        [recetaB, 3],
      ]);
      expect(anadidas?.[0]).toMatchObject({ quantity: '5.0000', unitId: fixture.unitId, status: 'PENDIENTE' });
      expect((await findAliveOrderLines(orderId, scope, tx)).map((line) => line.position)).toEqual([0, 2, 3]);
    });
  });
});

describe('QT-313 una linea ajena responde como un pedido inexistente', () => {
  it('QT-313 R43: leer las lineas con el ambito de otra empresa devuelve [] y bloquear devuelve null', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const otra = { companyId: await seedCompany(tx) };
      const orderId = await insertOrder(tx, base);
      const lineId = await insertLine(tx, base, orderId, 0);
      const repository = createOrderWriteRepository(tx);

      expect(await findAliveOrderLines(orderId, otra, tx)).toEqual([]);
      expect(await repository.lockAliveLines(orderId, otra)).toBeNull();
      expect(await repository.lockAliveLine(orderId, lineId, otra)).toBeNull();
    });
  });

  it('QT-313 R43: una linea de otro pedido o quitada no se bloquea, no se cancela, no cambia de estado ni de plazo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const scope = { companyId: base.companyId };
      const pedido = await insertOrder(tx, base);
      const otroPedido = await insertOrder(tx, base);
      const ajena = await insertLine(tx, base, otroPedido, 0);
      const quitada = await insertLine(tx, base, pedido, 0);
      await tx.orderLine.update({ where: { id: quitada }, data: { deletedAt: AHORA } });
      const antes = await tx.orderLine.findUniqueOrThrow({ where: { id: ajena } });
      const repository = createOrderWriteRepository(tx);

      for (const lineId of [ajena, quitada]) {
        expect(await repository.lockAliveLine(pedido, lineId, scope)).toBeNull();
        expect(await repository.cancelLine(pedido, lineId, 'motivo', null, AHORA, scope)).toBe('not_found');
        expect(await repository.setLineStatus(pedido, lineId, 'PENDIENTE', 'EN_CURSO', null, AHORA, scope)).toBe(
          'not_found',
        );
        expect(await repository.setLineIngredientsCost(pedido, lineId, null, null, AHORA, scope)).toBe('not_found');
        await repository.setLineReservedAt(pedido, lineId, AHORA, scope);
      }

      expect(await tx.orderLine.findUniqueOrThrow({ where: { id: ajena } })).toEqual(antes);
      expect(await repository.lockAliveLine(otroPedido, ajena, scope)).toMatchObject({ line: { id: ajena } });
    });
  });

  it('QT-313 R43: una escritura de lineas que nombra una linea de otro pedido devuelve null y no la toca', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await seedFixture(tx);
      const scope = { companyId: fixture.companyId };
      const pedido = await insertOrder(tx, fixture);
      const otroPedido = await insertOrder(tx, fixture);
      const ajena = await insertLine(tx, fixture, otroPedido, 0);
      const antes = await tx.orderLine.findUniqueOrThrow({ where: { id: ajena } });
      const repository = createOrderWriteRepository(tx);
      const otraReceta = await seedRecipe(tx, fixture.companyId);

      expect(
        await repository.writeLines(
          pedido,
          { ...EMPTY, edited: [{ lineId: ajena, line: newLine(fixture, otraReceta), cost: 'keep' }] },
          fixture.actorId,
          AHORA,
          scope,
        ),
      ).toBeNull();
      expect(
        await repository.writeLines(pedido, { ...EMPTY, removedIds: [ajena] }, fixture.actorId, AHORA, scope),
      ).toBeNull();
      expect(
        await repository.writeLines(otroPedido, EMPTY, fixture.actorId, AHORA, { companyId: await seedCompany(tx) }),
      ).toBeNull();

      expect(await tx.orderLine.findUniqueOrThrow({ where: { id: ajena } })).toEqual(antes);
    });
  });
});

describe('QT-313 una receta activa por pedido', () => {
  it('QT-313 R5: anadir la version de una receta que ya esta activa lanza duplicate_order_recipe', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await seedFixture(tx);
      const orderId = await insertOrder(tx, fixture);
      await insertLine(tx, fixture, orderId, 0);
      const version = await seedRecipe(tx, fixture.companyId, fixture.recipeId);

      const error = await createOrderWriteRepository(tx)
        .writeLines(
          orderId,
          { ...EMPTY, added: [newLine(fixture, version, fixture.recipeId)] },
          fixture.actorId,
          AHORA,
          { companyId: fixture.companyId },
        )
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(DuplicateOrderRecipeError);
      expect(error).toMatchObject({ code: 'duplicate_order_recipe' });
    });
  });

  it('QT-313 R5: con la linea de esa receta cancelada, o quitada en la misma escritura, la receta se vuelve a anadir', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await seedFixture(tx);
      const scope = { companyId: fixture.companyId };
      const orderId = await insertOrder(tx, fixture);
      const cancelada = await insertLine(tx, fixture, orderId, 0);
      const repository = createOrderWriteRepository(tx);
      expect(await repository.cancelLine(orderId, cancelada, 'ya no', fixture.actorId, AHORA, scope)).toBe('ok');

      const [readded] =
        (await repository.writeLines(
          orderId,
          { ...EMPTY, added: [newLine(fixture, fixture.recipeId)] },
          fixture.actorId,
          AHORA,
          scope,
        )) ?? [];
      expect(readded?.position).toBe(1);

      const otraVez = await repository.writeLines(
        orderId,
        { ...EMPTY, removedIds: [readded?.id ?? ''], added: [newLine(fixture, fixture.recipeId)] },
        fixture.actorId,
        AHORA,
        scope,
      );
      expect(otraVez?.map((line) => line.position)).toEqual([2]);
      expect((await findAliveOrderLines(orderId, scope, tx)).map((line) => [line.position, line.status])).toEqual([
        [0, 'CANCELADO'],
        [2, 'PENDIENTE'],
      ]);
    });
  });

  it('QT-313 R5: dos altas a la vez de la misma receta en el mismo pedido: una entra y la otra es duplicate_order_recipe', async () => {
    const fixture = await seedFixture(prisma);
    try {
      const scope = { companyId: fixture.companyId };
      const orderId = await insertOrder(prisma, fixture);
      const receta = await seedRecipe(prisma, fixture.companyId);

      // `writeLines` no compara recetas: el rechazo lo da el unico de la base.
      const alta = (): Promise<unknown> =>
        withOrderTransaction((tx) =>
          createOrderWriteRepository(tx).writeLines(
            orderId,
            { ...EMPTY, added: [newLine(fixture, receta)] },
            fixture.actorId,
            AHORA,
            scope,
          ),
        );
      const resultados = await Promise.allSettled([alta(), alta()]);

      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rechazos = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(rechazos).toHaveLength(1);
      expect(rechazos[0]?.reason).toBeInstanceOf(DuplicateOrderRecipeError);
      expect(await prisma.orderLine.count({ where: { orderId, originalRecipeId: receta } })).toBe(1);
    } finally {
      await cleanUpCompany(fixture);
    }
  });
});

describe('QT-313 escrituras de una linea y estado derivado', () => {
  it('QT-313 R34: el estado del pedido se deriva de sus lineas; todas canceladas dan CANCELADO con el motivo de la ultima', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const scope = { companyId: base.companyId };
      const actorId = await seedUser(tx, base.companyId);
      const orderId = await insertOrder(tx, base);
      const primera = await insertLine(tx, base, orderId, 0);
      const segunda = await insertLine(tx, base, orderId, 1);
      const repository = createOrderWriteRepository(tx);

      expect(await repository.setLineStatus(orderId, primera, 'PENDIENTE', 'EN_CURSO', actorId, AHORA, scope)).toBe('ok');
      expect(await repository.setLineStatus(orderId, primera, 'PENDIENTE', 'EN_CURSO', actorId, AHORA, scope)).toBe(
        'stale',
      );
      expect(await repository.refreshStatus(orderId, actorId, AHORA, scope)).toBe('PARCIAL');
      expect(await tx.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({
        status: 'PARCIAL',
        cancellationReason: null,
        updatedBy: actorId,
      });

      await repository.setLineStatus(orderId, primera, 'EN_CURSO', 'PENDIENTE', actorId, AHORA, scope);
      await repository.cancelLine(orderId, segunda, 'primero', actorId, AHORA, scope);
      expect(await repository.refreshStatus(orderId, actorId, AHORA, scope)).toBe('PENDIENTE');

      await repository.cancelLine(orderId, primera, 'ultimo', actorId, new Date(AHORA.getTime() + 1000), scope);
      expect(await repository.refreshStatus(orderId, actorId, AHORA, scope)).toBe('CANCELADO');
      expect(await tx.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({
        status: 'CANCELADO',
        cancellationReason: 'ultimo',
      });
      expect(await repository.refreshStatus(orderId, actorId, AHORA, { companyId: await seedCompany(tx) })).toBeNull();
    });
  });

  it('QT-313 R41: el plazo de una linea se escribe sin mover su updated_at ni tocar la otra', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const scope = { companyId: base.companyId };
      const orderId = await insertOrder(tx, base);
      const primera = await insertLine(tx, base, orderId, 0);
      const segunda = await insertLine(tx, base, orderId, 1);
      const antes = await tx.orderLine.findUniqueOrThrow({ where: { id: primera } });

      await createOrderWriteRepository(tx).setLineReservedAt(orderId, primera, AHORA, scope);

      const despues = await tx.orderLine.findUniqueOrThrow({ where: { id: primera } });
      expect(despues.reservedAt).toEqual(AHORA);
      expect(despues.updatedAt).toEqual(antes.updatedAt);
      expect((await tx.orderLine.findUniqueOrThrow({ where: { id: segunda } })).reservedAt).toBeNull();
    });
  });
});

/** Borra la empresa efimera de la carrera en el orden de las FK. */
async function cleanUpCompany(fixture: Fixture): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: fixture.actorId },
    select: { roleId: true, documentTypeCode: true },
  });
  await prisma.orderPresentationLine.deleteMany({ where: { companyId: fixture.companyId } });
  await prisma.orderLine.deleteMany({ where: { companyId: fixture.companyId } });
  await prisma.order.deleteMany({ where: { companyId: fixture.companyId } });
  await prisma.recipe.deleteMany({ where: { companyId: fixture.companyId } });
  await prisma.unit.deleteMany({ where: { companyId: fixture.companyId } });
  await prisma.user.delete({ where: { id: fixture.actorId } });
  await prisma.role.delete({ where: { id: user.roleId } });
  await prisma.documentType.delete({ where: { code: user.documentTypeCode } });
  await prisma.company.delete({ where: { id: fixture.companyId } });
}
