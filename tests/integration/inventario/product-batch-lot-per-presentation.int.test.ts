/**
 * La clave del lote (empresa + producto + presentacion + codigo) contra Postgres real: que los dos
 * indices parciales rechazan, que Prisma devuelve su choque como un `P2002` que
 * `isDuplicateBatchLot` reconoce, y que el alta, la carrera y el correlativo se comportan con ella.
 *
 * Aislamiento por commit y no por transaccion: `createWithFirstBatch` y `addBatchToAlive` usan el
 * cliente Prisma global y abren su propia transaccion por intento, y las carreras necesitan que cada
 * escritura confirme. Cada caso usa su empresa efimera y la borra en `finally`.
 */
import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { Client } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { normalizeCompanyName } from '@/lib/modules/identity';
import { BatchDuplicateLotError } from '@/lib/modules/inventario';
import {
  addBatchToAlive,
  createWithFirstBatch,
  isDuplicateBatchLot,
} from '@/lib/modules/inventario/adapters/driven/persistence/product-prisma';
import { prisma } from '@/lib/shared/db/prisma';

import type { InventoryScope } from '@/lib/modules/inventario/domain/inventory-scope';
import type { NewProductBatch } from '@/lib/modules/inventario/domain/product-batch';

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

function connectionString(): string {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (url === undefined || url.trim() === '') {
    throw new Error('falta DATABASE_URL (o DIRECT_URL) en el entorno de la corrida de integracion');
  }
  return url;
}

type Fixture = {
  readonly companyId: string;
  readonly actorId: string;
  readonly roleId: string;
  readonly documentTypeCode: string;
  readonly unitId: string;
  readonly recipeId: string;
  /** Dos presentaciones de la misma unidad: «1 L» y «200 ml». */
  readonly litro: string;
  readonly mililitros: string;
};

async function createFixture(): Promise<Fixture> {
  const marker = token();
  const documentType = await prisma.documentType.create({
    data: { code: `DOC${marker.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  });
  const role = await prisma.role.create({
    data: { name: `rol-${marker}`, description: 'Rol de prueba' },
    select: { id: true },
  });
  const companyName = `Empresa lote por presentacion ${marker}`;
  const company = await prisma.company.create({
    data: { name: companyName, nameNormalized: normalizeCompanyName(companyName) },
    select: { id: true },
  });
  const user = await prisma.user.create({
    data: {
      firstNames: 'Ana Maria',
      lastNames: 'Perez Gomez',
      birthDate: new Date('1990-05-17T00:00:00.000Z'),
      email: `ana.${marker}@quimicloude.test`,
      phone: '+57 300 111 2233',
      documentTypeCode: documentType.code,
      documentNumber: marker.slice(0, 12),
      username: `ana.${marker}`,
      passwordHash: 'hash-de-prueba-no-es-un-algoritmo-real',
      roleId: role.id,
      companyId: company.id,
    },
    select: { id: true },
  });
  const unit = await prisma.unit.findFirstOrThrow({
    where: { nameNormalized: 'kilogramo', companyId: null },
    select: { id: true },
  });
  const litro = await prisma.presentation.create({
    data: { name: `1 L ${marker}`, nameNormalized: `1l${marker}`, unitId: unit.id, companyId: company.id },
    select: { id: true },
  });
  const mililitros = await prisma.presentation.create({
    data: { name: `200 ml ${marker}`, nameNormalized: `200ml${marker}`, unitId: unit.id, companyId: company.id },
    select: { id: true },
  });
  const recipe = await prisma.recipe.create({
    data: { name: `Crema ${marker}`, nameNormalized: `crema${marker}`, companyId: company.id },
    select: { id: true },
  });
  return {
    companyId: company.id,
    actorId: user.id,
    roleId: role.id,
    documentTypeCode: documentType.code,
    unitId: unit.id,
    recipeId: recipe.id,
    litro: litro.id,
    mililitros: mililitros.id,
  };
}

async function dropFixture(f: Fixture): Promise<void> {
  await prisma.inventoryMovement.deleteMany({ where: { companyId: f.companyId } });
  await prisma.productBatch.deleteMany({ where: { companyId: f.companyId } });
  await prisma.product.deleteMany({ where: { companyId: f.companyId } });
  await prisma.recipe.deleteMany({ where: { companyId: f.companyId } });
  await prisma.presentation.deleteMany({ where: { companyId: f.companyId } });
  await prisma.user.delete({ where: { id: f.actorId } });
  await prisma.role.delete({ where: { id: f.roleId } });
  await prisma.documentType.delete({ where: { code: f.documentTypeCode } });
  await prisma.company.delete({ where: { id: f.companyId } });
}

async function dropFixtures(fixtures: readonly Fixture[]): Promise<void> {
  for (const f of fixtures) await dropFixture(f);
}

function ambito(f: Fixture): InventoryScope {
  return { companyId: f.companyId };
}

type ProductKind = 'PRODUCT' | 'PACKAGING' | 'MACHINE' | 'FINISHED_PRODUCT';

/** Un producto escrito directo: lo que se mide aqui es la base, no el alta. */
async function product(f: Fixture, type: ProductKind, presentationId: string | null = null): Promise<string> {
  const name = `${type} ${token()}`;
  const created = await prisma.product.create({
    data: {
      name,
      nameNormalized: name.toLowerCase(),
      type,
      packagingSubtype: type === 'PACKAGING' ? 'CONTAINER' : null,
      companyId: f.companyId,
      unitId: type === 'MACHINE' ? null : f.unitId,
      recipeId: type === 'FINISHED_PRODUCT' ? f.recipeId : null,
      presentationId: type === 'FINISHED_PRODUCT' ? presentationId : null,
    },
    select: { id: true },
  });
  return created.id;
}

/** Un lote escrito con el cliente Prisma: el error que devuelva es el que ve el adaptador. */
async function batch(f: Fixture, productId: string, presentationId: string | null, lot: string): Promise<string> {
  const created = await prisma.productBatch.create({
    data: {
      productId,
      presentationId,
      stock: new Prisma.Decimal('1'),
      unitCost: new Prisma.Decimal('1'),
      lot,
      purchaseDate: new Date('2026-10-01T00:00:00.000Z'),
      companyId: f.companyId,
    },
    select: { id: true },
  });
  return created.id;
}

async function rejectionOf(run: () => Promise<unknown>, what: string): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error(`se esperaba un rechazo y no lo hubo: ${what}`);
}

function describeError(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return `${error.code} meta=${JSON.stringify(error.meta)}`;
  }
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function newBatch(f: Fixture, overrides: Partial<NewProductBatch> = {}): NewProductBatch {
  return {
    presentationId: f.litro,
    stock: '3',
    unitCost: '2.5000',
    lot: null,
    purchaseDate: '2026-09-01',
    expiryDate: null,
    createdBy: f.actorId,
    ...overrides,
  };
}

/** Un instrumento: sin presentacion ni coste. */
function machineBatch(f: Fixture, lot: string | null): NewProductBatch {
  return newBatch(f, { presentationId: null, unitCost: null, lot });
}

async function lotsOfProduct(productId: string): Promise<string[]> {
  const rows = await prisma.productBatch.findMany({ where: { productId }, select: { lot: true } });
  return rows.map((r) => r.lot).sort();
}

async function lotsOfCompany(f: Fixture): Promise<string[]> {
  const rows = await prisma.productBatch.findMany({ where: { companyId: f.companyId }, select: { lot: true } });
  return rows.map((r) => r.lot).sort();
}

async function movementsOfCompany(f: Fixture): Promise<number> {
  return prisma.inventoryMovement.count({ where: { companyId: f.companyId } });
}

function unwrap(result: { batchId: string; lot: string } | null | 'finished_product'): { batchId: string; lot: string } {
  if (result === null || result === 'finished_product') throw new Error(`addBatchToAlive devolvio ${String(result)}`);
  return result;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('R1, R2, R6: la base rechaza la misma clave y Prisma la entrega como un P2002 reconocible', () => {
  it('R1, R6: dos lotes con el mismo producto, presentacion y codigo dan P2002 y isDuplicateBatchLot lo reconoce', async () => {
    const f = await createFixture();
    try {
      const crema = await product(f, 'FINISHED_PRODUCT', f.litro);
      await batch(f, crema, f.litro, 'CR-2610');

      const error = await rejectionOf(() => batch(f, crema, f.litro, 'CR-2610'), 'misma clave con presentacion');

      expect(error, describeError(error)).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect((error as Prisma.PrismaClientKnownRequestError).code, describeError(error)).toBe('P2002');
      expect(isDuplicateBatchLot(error), describeError(error)).toBe(true);
      expect(await lotsOfProduct(crema)).toEqual(['CR-2610']);
    } finally {
      await dropFixture(f);
    }
  });

  it('R2, R6: dos lotes sin presentacion del mismo producto y codigo dan P2002 y isDuplicateBatchLot lo reconoce', async () => {
    const f = await createFixture();
    try {
      const glicerina = await product(f, 'PRODUCT');
      await batch(f, glicerina, null, '2401');

      const error = await rejectionOf(() => batch(f, glicerina, null, '2401'), 'misma clave sin presentacion');

      expect(error, describeError(error)).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect((error as Prisma.PrismaClientKnownRequestError).code, describeError(error)).toBe('P2002');
      expect(isDuplicateBatchLot(error), describeError(error)).toBe(true);
      expect(await lotsOfProduct(glicerina)).toEqual(['2401']);
    } finally {
      await dropFixture(f);
    }
  });
});

describe('R3, R4: el mismo codigo con otra clave se escribe', () => {
  it('R3: Crema 1 L y Crema 200 ml con CR-2610; Glicerina y Alcohol con 2401; insumo, envase e instrumento con el mismo codigo; un producto con y sin presentacion', async () => {
    const f = await createFixture();
    try {
      const cremaLitro = await product(f, 'FINISHED_PRODUCT', f.litro);
      const cremaMililitros = await product(f, 'FINISHED_PRODUCT', f.mililitros);
      await batch(f, cremaLitro, f.litro, 'CR-2610');
      await batch(f, cremaMililitros, f.mililitros, 'CR-2610');

      const glicerina = await product(f, 'PRODUCT');
      const alcohol = await product(f, 'PRODUCT');
      await batch(f, glicerina, null, '2401');
      await batch(f, alcohol, null, '2401');

      const envase = await product(f, 'PACKAGING');
      const instrumento = await product(f, 'MACHINE');
      await batch(f, envase, null, '2401');
      await batch(f, instrumento, null, '2401');

      // Con y sin presentacion caen en indices distintos.
      const mixto = await product(f, 'PRODUCT');
      await batch(f, mixto, f.litro, 'MX-1');
      await batch(f, mixto, null, 'MX-1');

      expect(await lotsOfCompany(f)).toEqual(['2401', '2401', '2401', '2401', 'CR-2610', 'CR-2610', 'MX-1', 'MX-1']);
    } finally {
      await dropFixture(f);
    }
  });

  it('R4: cr-2610 y CR-2610 en la misma clave no chocan, y otra empresa repite la misma clave analoga', async () => {
    const a = await createFixture();
    const b = await createFixture();
    try {
      const cremaA = await product(a, 'FINISHED_PRODUCT', a.litro);
      await batch(a, cremaA, a.litro, 'CR-2610');
      await batch(a, cremaA, a.litro, 'cr-2610');

      const glicerinaA = await product(a, 'PRODUCT');
      await batch(a, glicerinaA, null, '2401');

      const cremaB = await product(b, 'FINISHED_PRODUCT', b.litro);
      await batch(b, cremaB, b.litro, 'CR-2610');
      const glicerinaB = await product(b, 'PRODUCT');
      await batch(b, glicerinaB, null, '2401');

      expect(await lotsOfProduct(cremaA)).toEqual(['CR-2610', 'cr-2610']);
      expect(await lotsOfCompany(b)).toEqual(['2401', 'CR-2610']);
    } finally {
      await dropFixtures([a, b]);
    }
  });
});

describe('R7: el alta con un lote tecleado se decide por la clave', () => {
  it('R7: lote sobre producto existente con la clave ya escrita -> batch_duplicate_lot sin lote ni asiento nuevos, en los dos indices', async () => {
    const f = await createFixture();
    try {
      const insumo = await createWithFirstBatch({ name: `Insumo ${token()}` }, newBatch(f, { lot: 'T-1' }), new Date(), ambito(f));
      const instrumento = await createWithFirstBatch(
        { name: `Instrumento ${token()}`, type: 'MACHINE' },
        machineBatch(f, 'T-1'),
        new Date(),
        ambito(f),
      );
      const asientosAntes = await movementsOfCompany(f);

      const conPresentacion = await rejectionOf(
        () => addBatchToAlive(insumo.id, newBatch(f, { lot: 'T-1' }), new Date(), ambito(f)),
        'misma clave con presentacion',
      );
      expect(conPresentacion, describeError(conPresentacion)).toBeInstanceOf(BatchDuplicateLotError);
      expect((conPresentacion as BatchDuplicateLotError).code).toBe('batch_duplicate_lot');

      const sinPresentacion = await rejectionOf(
        () => addBatchToAlive(instrumento.id, machineBatch(f, 'T-1'), new Date(), ambito(f)),
        'misma clave sin presentacion',
      );
      expect(sinPresentacion, describeError(sinPresentacion)).toBeInstanceOf(BatchDuplicateLotError);

      expect(await lotsOfCompany(f)).toEqual(['T-1', 'T-1']);
      expect(await movementsOfCompany(f)).toBe(asientosAntes);
    } finally {
      await dropFixture(f);
    }
  });

  it('R7: el codigo que solo existe con otra clave se acepta y se guarda tal cual, por las dos altas', async () => {
    const f = await createFixture();
    try {
      const primero = await createWithFirstBatch({ name: `Insumo ${token()}` }, newBatch(f, { lot: 'L 07' }), new Date(), ambito(f));

      const otroProducto = await createWithFirstBatch({ name: `Insumo ${token()}` }, newBatch(f, { lot: 'L 07' }), new Date(), ambito(f));
      expect(otroProducto.lot).toBe('L 07');

      const otraPresentacion = unwrap(
        await addBatchToAlive(primero.id, newBatch(f, { presentationId: f.mililitros, lot: 'L 07' }), new Date(), ambito(f)),
      );
      expect(otraPresentacion.lot).toBe('L 07');

      expect(await prisma.product.count({ where: { companyId: f.companyId } })).toBe(2);
      expect(await lotsOfCompany(f)).toEqual(['L 07', 'L 07', 'L 07']);
    } finally {
      await dropFixture(f);
    }
  });
});

describe('R6: escrituras simultaneas con la misma clave', () => {
  it('R6: dos lotes tecleados simultaneos con la misma clave -> uno se confirma y el otro batch_duplicate_lot sin filas, en los dos indices', async () => {
    const f = await createFixture();
    try {
      const insumo = await createWithFirstBatch({ name: `Insumo ${token()}` }, newBatch(f, { lot: 'BASE' }), new Date(), ambito(f));
      const instrumento = await createWithFirstBatch(
        { name: `Instrumento ${token()}`, type: 'MACHINE' },
        machineBatch(f, 'BASE'),
        new Date(),
        ambito(f),
      );
      const asientosAntes = await movementsOfCompany(f);

      const conPresentacion = await Promise.allSettled([
        addBatchToAlive(insumo.id, newBatch(f, { lot: 'RACE' }), new Date(), ambito(f)),
        addBatchToAlive(insumo.id, newBatch(f, { lot: 'RACE' }), new Date(), ambito(f)),
      ]);
      const sinPresentacion = await Promise.allSettled([
        addBatchToAlive(instrumento.id, machineBatch(f, 'RACE'), new Date(), ambito(f)),
        addBatchToAlive(instrumento.id, machineBatch(f, 'RACE'), new Date(), ambito(f)),
      ]);

      for (const ronda of [conPresentacion, sinPresentacion]) {
        const ok = ronda.filter((r) => r.status === 'fulfilled');
        const ko = ronda.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
        expect(ok).toHaveLength(1);
        expect(ko).toHaveLength(1);
        expect(ko[0]?.reason, describeError(ko[0]?.reason)).toBeInstanceOf(BatchDuplicateLotError);
      }

      expect(await lotsOfProduct(insumo.id)).toEqual(['BASE', 'RACE']);
      expect(await lotsOfProduct(instrumento.id)).toEqual(['BASE', 'RACE']);
      // Un asiento por lote confirmado, ninguno del rechazado.
      expect(await movementsOfCompany(f)).toBe(asientosAntes + 2);
    } finally {
      await dropFixture(f);
    }
  });

  it('R6: un lote generado que choca en la base con la misma clave se reintenta y se escribe con el siguiente', async () => {
    const f = await createFixture();
    const otra = new Client({ connectionString: connectionString() });
    await otra.connect();
    const spy = vi.spyOn(prisma, '$transaction');
    try {
      const insumo = await createWithFirstBatch({ name: `Insumo ${token()}` }, newBatch(f, { lot: '1' }), new Date(), ambito(f));

      // Otra conexion escribe el '2' de la misma clave sin confirmar: el adaptador no lo ve al leer
      // el maximo, genera '2' y queda esperando en el indice.
      await otra.query('BEGIN');
      await otra.query(
        `INSERT INTO "product_batches"
           ("product_id", "presentation_id", "stock", "unit_cost", "lot", "purchase_date", "company_id", "updated_at")
         VALUES ($1::uuid, $2::uuid, 1, 1.0000, '2', DATE '2026-10-01', $3::uuid, now())`,
        [insumo.id, f.litro, f.companyId],
      );
      const pid = (await otra.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]?.pid;

      spy.mockClear();
      const alta = addBatchToAlive(insumo.id, newBatch(f), new Date(), ambito(f));

      const limite = Date.now() + 10_000;
      for (;;) {
        const bloqueados = await prisma.$queryRaw<{ n: bigint }[]>`
          SELECT count(*) AS n FROM pg_stat_activity WHERE ${pid}::int = ANY(pg_blocking_pids(pid))`;
        if (Number(bloqueados[0]?.n ?? 0) > 0) break;
        if (Date.now() > limite) throw new Error('el alta generada no llego a esperar en el indice');
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      await otra.query('COMMIT');

      const escrito = unwrap(await alta);
      expect(escrito.lot).toBe('3');
      expect(spy, 'el choque se reconoce y se reintenta en una transaccion nueva').toHaveBeenCalledTimes(2);
      expect(await lotsOfProduct(insumo.id)).toEqual(['1', '2', '3']);
    } finally {
      spy.mockRestore();
      await otra.query('ROLLBACK').catch(() => undefined);
      await otra.end();
      await dropFixture(f);
    }
  });
});

describe('R5: el correlativo sigue siendo de toda la empresa', () => {
  it('R5: con 7 en un producto y 50 en otro, el siguiente generado es 51 sea cual sea el producto', async () => {
    const f = await createFixture();
    try {
      const glicerina = await createWithFirstBatch({ name: `Glicerina ${token()}` }, newBatch(f, { lot: '7' }), new Date(), ambito(f));
      await createWithFirstBatch({ name: `Alcohol ${token()}`, type: 'MACHINE' }, machineBatch(f, '50'), new Date(), ambito(f));

      const nuevo = await createWithFirstBatch({ name: `Otro ${token()}` }, newBatch(f, { presentationId: f.mililitros }), new Date(), ambito(f));
      expect(nuevo.lot).toBe('51');

      const sobreGlicerina = unwrap(await addBatchToAlive(glicerina.id, newBatch(f), new Date(), ambito(f)));
      expect(sobreGlicerina.lot).toBe('52');

      expect(await lotsOfCompany(f)).toEqual(['50', '51', '52', '7']);
    } finally {
      await dropFixture(f);
    }
  });
});
