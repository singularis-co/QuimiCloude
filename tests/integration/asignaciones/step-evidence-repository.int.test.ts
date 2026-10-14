/**
 * `createStepEvidenceRepository` contra una base Postgres REAL, con el cliente Prisma global: la
 * sustitucion abre su propia transaccion y la carrera de dos registros necesita dos conexiones de
 * verdad, asi que una transaccion del test no las envolveria. Dos empresas efimeras nacen en
 * `beforeAll` y mueren en `afterAll` en el orden de las FK.
 */
import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createStepEvidenceRepository } from '@/lib/modules/asignaciones/adapters/driven/persistence/step-evidence-prisma';
import { normalizeCompanyName } from '@/lib/modules/identity';
import { prisma } from '@/lib/shared/db/prisma';

import type { EvidencePhase } from '@/lib/modules/asignaciones';
import type { NewStepEvidence, StepEvidenceRow } from '@/lib/modules/asignaciones/ports/step-evidence-repository';

const repo = createStepEvidenceRepository();

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

type Company = {
  readonly companyId: string;
  readonly userId: string;
  readonly roleId: string;
  readonly documentTypeCode: string;
};

const companies: Company[] = [];
let nextSequence = 870_000 + Math.floor(Math.random() * 10_000);

async function createCompany(label: string): Promise<Company> {
  const name = `Empresa repositorio evidencia ${label} ${token()}`;
  const company = await prisma.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  });
  const marca = token();
  const documentType = await prisma.documentType.create({
    data: { code: `DOC${marca.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  });
  const role = await prisma.role.create({
    data: { name: `rol-${marca}`, description: 'Rol de prueba' },
    select: { id: true },
  });
  const user = await prisma.user.create({
    data: {
      firstNames: 'Ana Maria',
      lastNames: 'Perez Gomez',
      birthDate: new Date('1990-05-17T00:00:00.000Z'),
      email: `ana.${marca}@quimicloude.test`,
      phone: '+57 300 111 2233',
      documentTypeCode: documentType.code,
      documentNumber: marca.slice(0, 12),
      username: `ana.${marca}`,
      passwordHash: 'hash-de-prueba-no-es-un-algoritmo-real',
      roleId: role.id,
      companyId: company.id,
    },
    select: { id: true },
  });
  const created = { companyId: company.id, userId: user.id, roleId: role.id, documentTypeCode: documentType.code };
  companies.push(created);
  return created;
}

async function createOrder(companyId: string): Promise<string> {
  const marca = token();
  const recipe = await prisma.recipe.create({
    data: { name: `Receta ${marca}`, nameNormalized: `receta${marca}`, companyId },
    select: { id: true },
  });
  nextSequence += 1;
  const order = await prisma.order.create({
    data: {
      companyId,
      orderYear: new Date().getUTCFullYear(),
      orderSequence: nextSequence,
      recipeId: recipe.id,
      quantity: new Prisma.Decimal('10'),
      status: 'EN_CURSO',
    },
    select: { id: true },
  });
  return order.id;
}

function evidence(
  company: Company,
  orderId: string,
  overrides: Partial<Omit<NewStepEvidence, 'companyId' | 'orderId' | 'uploadedBy'>> = {},
): NewStepEvidence {
  return {
    companyId: company.companyId,
    orderId,
    phase: 'manufacturing',
    stepPosition: 1,
    path: `${company.companyId}/${orderId}/${randomUUID()}`,
    contentType: 'image/jpeg',
    sizeBytes: 2048,
    uploadedBy: company.userId,
    ...overrides,
  };
}

function inserted(result: StepEvidenceRow | 'limit' | 'not_found' | 'path_taken'): StepEvidenceRow {
  if (typeof result === 'string') throw new Error(`se esperaba una fila y llego ${result}`);
  return result;
}

let a: Company;
let b: Company;

beforeAll(async () => {
  a = await createCompany('A');
  b = await createCompany('B');
});

afterAll(async () => {
  const ids = companies.map((company) => company.companyId);
  await prisma.orderStepEvidence.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.order.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.recipe.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.user.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.role.deleteMany({ where: { id: { in: companies.map((company) => company.roleId) } } });
  await prisma.documentType.deleteMany({
    where: { code: { in: companies.map((company) => company.documentTypeCode) } },
  });
  await prisma.company.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe('insert: primer slot libre y tope de 3 (R29)', () => {
  it('R29: rellena los slots 1, 2 y 3 en orden y con 3 devuelve limit sin escribir', async () => {
    const orderId = await createOrder(a.companyId);
    const slots: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      slots.push(inserted(await repo.insert(evidence(a, orderId))).slot);
    }
    expect(slots).toEqual([1, 2, 3]);

    expect(await repo.insert(evidence(a, orderId))).toBe('limit');
    expect(await repo.listByOrder(a.companyId, orderId, 'manufacturing')).toHaveLength(3);
  });

  it('R29: reutiliza el hueco que deja una foto quitada', async () => {
    const orderId = await createOrder(a.companyId);
    const rows = [];
    for (let i = 0; i < 3; i += 1) rows.push(inserted(await repo.insert(evidence(a, orderId))));
    expect(await repo.delete(a.companyId, orderId, 'manufacturing', rows[1]!.id)).toEqual(rows[1]);

    expect(inserted(await repo.insert(evidence(a, orderId))).slot).toBe(2);
  });

  it('R29: el tope es por paso y por fase', async () => {
    const orderId = await createOrder(a.companyId);
    for (let i = 0; i < 3; i += 1) inserted(await repo.insert(evidence(a, orderId)));

    expect(inserted(await repo.insert(evidence(a, orderId, { stepPosition: 2 }))).slot).toBe(1);
    expect(inserted(await repo.insert(evidence(a, orderId, { phase: 'packing' }))).slot).toBe(1);
  });

  it('R29: cuatro registros simultaneos en un paso vacio dejan 3 fotos y un limit', async () => {
    const orderId = await createOrder(a.companyId);
    const results = await Promise.all(Array.from({ length: 4 }, () => repo.insert(evidence(a, orderId))));

    expect(results.filter((result) => result === 'limit')).toHaveLength(1);
    const rows = await repo.listByOrder(a.companyId, orderId, 'manufacturing');
    expect(rows.map((row) => row.slot)).toEqual([1, 2, 3]);
  });

  it('R29: si el slot leido como libre ya esta ocupado al escribir (23505), prueba el siguiente', async () => {
    const orderId = await createOrder(a.companyId);
    const first = inserted(await repo.insert(evidence(a, orderId)));

    // Primera lectura vieja: ve el paso vacio, como si la otra foto aun no estuviera escrita.
    let staleReads = 1;
    const delegate = prisma.orderStepEvidence;
    const racing = new Proxy(prisma, {
      get(target, property, receiver) {
        if (property !== 'orderStepEvidence') return Reflect.get(target, property, receiver) as unknown;
        return new Proxy(delegate, {
          get(innerTarget, innerProperty, innerReceiver) {
            if (innerProperty === 'findMany' && staleReads > 0) {
              staleReads -= 1;
              return () => Promise.resolve([]);
            }
            return Reflect.get(innerTarget, innerProperty, innerReceiver) as unknown;
          },
        });
      },
    });

    const second = inserted(await createStepEvidenceRepository(racing).insert(evidence(a, orderId)));

    expect(staleReads).toBe(0);
    expect(second.slot).toBe(2);
    expect((await repo.listByOrder(a.companyId, orderId, 'manufacturing')).map((row) => row.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it('R31: una ruta ya registrada en la empresa devuelve path_taken sin escribir', async () => {
    const orderId = await createOrder(a.companyId);
    const photo = inserted(await repo.insert(evidence(a, orderId)));

    expect(await repo.insert(evidence(a, orderId, { stepPosition: 2, path: photo.path }))).toBe('path_taken');

    expect(await repo.listByOrder(a.companyId, orderId, 'manufacturing')).toEqual([photo]);
  });

  it('R29: dos registros simultaneos sobre el ultimo slot libre dejan 3 fotos y un limit', async () => {
    const orderId = await createOrder(a.companyId);
    for (let i = 0; i < 2; i += 1) inserted(await repo.insert(evidence(a, orderId)));

    const results = await Promise.all([repo.insert(evidence(a, orderId)), repo.insert(evidence(a, orderId))]);

    expect(results.filter((result) => result === 'limit')).toHaveLength(1);
    expect((await repo.listByOrder(a.companyId, orderId, 'manufacturing')).map((row) => row.slot)).toEqual([1, 2, 3]);
  });
});

describe('replace: sustituir en el mismo slot, todo o nada (R19, R29)', () => {
  it('R19: borra la vieja e inserta la nueva en su mismo slot', async () => {
    const orderId = await createOrder(a.companyId);
    const first = inserted(await repo.insert(evidence(a, orderId)));
    const second = inserted(await repo.insert(evidence(a, orderId)));

    const nueva = evidence(a, orderId);
    const replaced = inserted(await repo.replace(first.id, nueva));

    expect(replaced.slot).toBe(first.slot);
    expect(replaced.path).toBe(nueva.path);
    expect(replaced.id).not.toBe(first.id);
    const rows = await repo.listByOrder(a.companyId, orderId, 'manufacturing');
    expect(rows.map((row) => row.id)).toEqual([replaced.id, second.id]);
  });

  it('R19: con 3 fotos sustituye sin chocar con el tope', async () => {
    const orderId = await createOrder(a.companyId);
    const rows = [];
    for (let i = 0; i < 3; i += 1) rows.push(inserted(await repo.insert(evidence(a, orderId))));

    const replaced = inserted(await repo.replace(rows[2]!.id, evidence(a, orderId)));
    expect(replaced.slot).toBe(3);
    expect(await repo.listByOrder(a.companyId, orderId, 'manufacturing')).toHaveLength(3);
  });

  it('R19: not_found si la foto es de otro paso, otra fase u otro pedido, sin tocar nada', async () => {
    const orderId = await createOrder(a.companyId);
    const otherOrderId = await createOrder(a.companyId);
    const photo = inserted(await repo.insert(evidence(a, orderId)));

    expect(await repo.replace(photo.id, evidence(a, orderId, { stepPosition: 2 }))).toBe('not_found');
    expect(await repo.replace(photo.id, evidence(a, orderId, { phase: 'packing' }))).toBe('not_found');
    expect(await repo.replace(photo.id, evidence(a, otherOrderId))).toBe('not_found');
    expect(await repo.replace(randomUUID(), evidence(a, orderId))).toBe('not_found');

    expect(await repo.listByOrder(a.companyId, orderId, 'manufacturing')).toEqual([photo]);
    expect(await repo.listByOrder(a.companyId, otherOrderId, 'manufacturing')).toEqual([]);
  });

  it('R19, R31: si la ruta nueva ya es de otra foto: path_taken y la vieja sigue en su sitio (atomico)', async () => {
    const orderId = await createOrder(a.companyId);
    const keep = inserted(await repo.insert(evidence(a, orderId)));
    const photo = inserted(await repo.insert(evidence(a, orderId)));

    // La ruta repetida choca con el indice unico de la ruta despues de borrar la vieja.
    expect(await repo.replace(photo.id, evidence(a, orderId, { path: keep.path }))).toBe('path_taken');

    expect(await repo.listByOrder(a.companyId, orderId, 'manufacturing')).toEqual([keep, photo]);
  });
});

describe('toda lectura y escritura filtra por empresa (R39)', () => {
  it('R39: la empresa B no lee, no sustituye ni borra fotos de la A', async () => {
    const orderId = await createOrder(a.companyId);
    const photo = inserted(await repo.insert(evidence(a, orderId)));

    expect(await repo.listByOrder(b.companyId, orderId, 'manufacturing')).toEqual([]);
    expect(await repo.findById(b.companyId, orderId, 'manufacturing', photo.id)).toBeNull();
    expect(await repo.delete(b.companyId, orderId, 'manufacturing', photo.id)).toBeNull();
    expect(await repo.listOrderIdsWithEvidence(b.companyId, [{ orderId, phase: 'manufacturing' }])).toEqual([]);

    const fromB: NewStepEvidence = { ...evidence(b, orderId), path: `${b.companyId}/${orderId}/${randomUUID()}` };
    expect(await repo.replace(photo.id, fromB)).toBe('not_found');

    expect(await repo.findById(a.companyId, orderId, 'manufacturing', photo.id)).toEqual(photo);
  });

  it('R39: findById y delete exigen el pedido y la fase de la foto', async () => {
    const orderId = await createOrder(a.companyId);
    const otherOrderId = await createOrder(a.companyId);
    const photo = inserted(await repo.insert(evidence(a, orderId)));

    expect(await repo.findById(a.companyId, otherOrderId, 'manufacturing', photo.id)).toBeNull();
    expect(await repo.findById(a.companyId, orderId, 'packing', photo.id)).toBeNull();
    expect(await repo.delete(a.companyId, orderId, 'packing', photo.id)).toBeNull();
    expect(await repo.delete(a.companyId, otherOrderId, 'manufacturing', photo.id)).toBeNull();
    expect(await repo.delete(a.companyId, orderId, 'manufacturing', photo.id)).toEqual(photo);
    expect(await repo.delete(a.companyId, orderId, 'manufacturing', photo.id)).toBeNull();
  });
});

describe('listOrderIdsWithEvidence (R8, R39)', () => {
  it('R8: devuelve solo los pedidos con fotos en la fase pedida para cada uno', async () => {
    const withManufacturing = await createOrder(a.companyId);
    const withPacking = await createOrder(a.companyId);
    const empty = await createOrder(a.companyId);
    inserted(await repo.insert(evidence(a, withManufacturing)));
    inserted(await repo.insert(evidence(a, withManufacturing, { stepPosition: 2 })));
    inserted(await repo.insert(evidence(a, withPacking, { phase: 'packing' })));

    const ask = (pairs: readonly [string, EvidencePhase][]) =>
      repo.listOrderIdsWithEvidence(
        a.companyId,
        pairs.map(([orderId, phase]) => ({ orderId, phase })),
      );

    expect(
      [
        ...(await ask([
          [withManufacturing, 'manufacturing'],
          [withPacking, 'packing'],
          [empty, 'manufacturing'],
        ])),
      ].sort(),
    ).toEqual([withManufacturing, withPacking].sort());
    expect(await ask([[withManufacturing, 'packing']])).toEqual([]);
    expect(await ask([[withPacking, 'manufacturing']])).toEqual([]);
    expect(await ask([])).toEqual([]);
  });
});

describe('cancelar o dar de baja el pedido no borra sus fotos (R38)', () => {
  it('R38: las filas siguen tras pasar el pedido a CANCELADO', async () => {
    const orderId = await createOrder(a.companyId);
    const photo = inserted(await repo.insert(evidence(a, orderId)));

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELADO', cancellationReason: 'Prueba de conservacion de fotos' },
    });

    expect(await repo.listByOrder(a.companyId, orderId, 'manufacturing')).toEqual([photo]);
  });

  it('R38: las filas siguen tras dar de baja el pedido', async () => {
    const orderId = await createOrder(a.companyId);
    const photo = inserted(await repo.insert(evidence(a, orderId, { phase: 'packing' })));

    await prisma.order.update({ where: { id: orderId }, data: { deletedAt: new Date() } });

    expect(await repo.listByOrder(a.companyId, orderId, 'packing')).toEqual([photo]);
  });
});
