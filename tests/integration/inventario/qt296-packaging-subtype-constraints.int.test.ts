/**
 * Lo que la base garantiza del subtipo de empaque en `products`: el enum cerrado y los dos CHECK.
 *
 * AISLAMIENTO: cada `it` corre en una transaccion interactiva que termina en `RollbackSignal`. Lo
 * que se espera que falle va dentro de un SAVEPOINT.
 */
import { randomUUID } from 'node:crypto';

import { Prisma, type PackagingSubtype, type ProductType } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { normalizeCompanyName } from '@/lib/modules/identity';
import { normalizePresentationName } from '@/lib/modules/inventario';
import { prisma } from '@/lib/shared/db/prisma';

class RollbackSignal extends Error {
  constructor() {
    super('rollback de aislamiento del test');
    this.name = 'RollbackSignal';
  }
}

async function inRolledBackTransaction(body: (tx: Prisma.TransactionClient) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await body(tx);
        throw new RollbackSignal();
      },
      { maxWait: 20_000, timeout: 60_000 },
    );
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error;
  }
}

let savepointSeq = 0;

/** El SQLSTATE y el mensaje del rechazo, para afirmar tambien el nombre de la restriccion. */
async function expectRejected(tx: Prisma.TransactionClient, run: () => Promise<unknown>): Promise<string> {
  savepointSeq += 1;
  const savepoint = `qt296_sp_${String(savepointSeq)}`;
  await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
  try {
    await run();
  } catch (error) {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    const meta: unknown = error instanceof Prisma.PrismaClientKnownRequestError ? error.meta : undefined;
    const code =
      typeof meta === 'object' && meta !== null && 'code' in meta ? String((meta as { code: unknown }).code) : '';
    return `${code}\n${error instanceof Error ? error.message : String(error)}`;
  }
  throw new Error('se esperaba un rechazo de la base y no lo hubo');
}

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

type Fixture = { readonly companyId: string; readonly presentationId: string };

async function seed(tx: Prisma.TransactionClient): Promise<Fixture> {
  const name = `Empresa subtipo ${token()}`;
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  });
  const ml = await tx.unit.findFirstOrThrow({ where: { companyId: null, nameNormalized: 'mililitro' }, select: { id: true } });
  const presentationName = `Botella ${token()}`;
  const presentation = await tx.presentation.create({
    data: {
      name: presentationName,
      nameNormalized: normalizePresentationName(presentationName),
      unitId: ml.id,
      companyId: company.id,
      content: '500',
    },
    select: { id: true },
  });
  return { companyId: company.id, presentationId: presentation.id };
}

async function insertProduct(
  tx: Prisma.TransactionClient,
  f: Fixture,
  type: ProductType,
  packagingSubtype: PackagingSubtype | null,
  presentationId: string | null,
): Promise<string> {
  const name = `Producto ${token()}`;
  const product = await tx.product.create({
    data: { name, nameNormalized: name.toLowerCase(), type, companyId: f.companyId, packagingSubtype, presentationId },
    select: { id: true },
  });
  return product.id;
}

const CHECK_VIOLATION = '23514';
const INVALID_ENUM_VALUE = '22P02';
const MATCHES_TYPE = 'products_packaging_subtype_matches_type';
const ONLY_IN_CONTAINER = 'products_presentation_only_in_container';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('QT-296 — subtipo de empaque en products, contra Postgres real', () => {
  it('R1: un valor fuera del enum PackagingSubtype se rechaza, tambien en minusculas o en espanol', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seed(tx);
      const id = await insertProduct(tx, f, 'PACKAGING', 'CONTAINER', null);
      for (const ajeno of ['GATILLO', 'tapa', 'container', 'FINISHED_PRODUCT']) {
        const rechazo = await expectRejected(
          tx,
          () => tx.$executeRaw`
            UPDATE "products" SET "packaging_subtype" = CAST(${ajeno} AS "PackagingSubtype")
             WHERE "id" = CAST(${id} AS uuid)`,
        );
        expect(rechazo, ajeno).toContain(INVALID_ENUM_VALUE);
      }
    });
  });

  it('R2: un empaque sin subtipo se rechaza, y un producto de otro tipo con subtipo tambien', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seed(tx);
      const sinSubtipo = await expectRejected(tx, () => insertProduct(tx, f, 'PACKAGING', null, null));
      expect(sinSubtipo).toContain(CHECK_VIOLATION);
      expect(sinSubtipo).toContain(MATCHES_TYPE);
      for (const type of ['PRODUCT', 'MACHINE'] as const) {
        const conSubtipo = await expectRejected(tx, () => insertProduct(tx, f, type, 'CAP', null));
        expect(conSubtipo, type).toContain(CHECK_VIOLATION);
        expect(conSubtipo, type).toContain(MATCHES_TYPE);
      }
      const materia = await insertProduct(tx, f, 'PRODUCT', null, null);
      const quitar = await expectRejected(
        tx,
        () => tx.$executeRaw`
          UPDATE "products" SET "packaging_subtype" = 'OTHER' WHERE "id" = CAST(${materia} AS uuid)`,
      );
      expect(quitar).toContain(MATCHES_TYPE);
    });
  });

  it('R3: tapa, medidor u otro con presentacion se rechazan; el envase con ella entra y los demas sin ella tambien', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seed(tx);
      for (const subtype of ['CAP', 'MEASURER', 'OTHER'] as const) {
        const rechazo = await expectRejected(tx, () => insertProduct(tx, f, 'PACKAGING', subtype, f.presentationId));
        expect(rechazo, subtype).toContain(CHECK_VIOLATION);
        expect(rechazo, subtype).toContain(ONLY_IN_CONTAINER);
      }
      const envase = await insertProduct(tx, f, 'PACKAGING', 'CONTAINER', f.presentationId);
      const tapa = await insertProduct(tx, f, 'PACKAGING', 'CAP', null);
      const medidor = await insertProduct(tx, f, 'PACKAGING', 'MEASURER', null);
      const otro = await insertProduct(tx, f, 'PACKAGING', 'OTHER', null);
      const filas = await tx.product.findMany({
        where: { id: { in: [envase, tapa, medidor, otro] } },
        select: { id: true, packagingSubtype: true, presentationId: true },
      });
      expect(filas.find((row) => row.id === envase)).toMatchObject({
        packagingSubtype: 'CONTAINER',
        presentationId: f.presentationId,
      });
      for (const id of [tapa, medidor, otro]) {
        expect(filas.find((row) => row.id === id)?.presentationId).toBeNull();
      }

      const ponerPresentacion = await expectRejected(
        tx,
        () => tx.$executeRaw`
          UPDATE "products" SET "presentation_id" = CAST(${f.presentationId} AS uuid) WHERE "id" = CAST(${tapa} AS uuid)`,
      );
      expect(ponerPresentacion).toContain(ONLY_IN_CONTAINER);
    });
  });
});
