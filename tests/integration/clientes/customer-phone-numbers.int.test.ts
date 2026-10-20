/**
 * Los telefonos de cliente contra Postgres REAL: `customer-phone-prisma.ts` sobre las tablas
 * `phone_numbers` y `customer_phone_numbers`, sus dos indices unicos parciales y el ambito de
 * empresa de cada metodo.
 *
 * AISLAMIENTO: el repositorio se construye sobre el cliente Prisma GLOBAL, como en produccion fuera
 * de una transaccion, asi que un ROLLBACK del test no lo envolveria. Cada caso siembra sus propios
 * clientes y numeros, irrepetibles entre corridas. `afterAll` borra, por `company_id` y en el orden
 * que exigen las FK, vinculos, numeros, clientes, usuario, rol, tipo de documento y empresa, y
 * cuenta que no quedo ninguno.
 */
import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createCustomer,
  updateAliveCustomer,
} from '@/lib/modules/clientes/adapters/driven/persistence/customer-prisma';
import { createCustomerPhoneRepository } from '@/lib/modules/clientes/adapters/driven/persistence/customer-phone-prisma';
import { normalizeCustomerText } from '@/lib/modules/clientes/domain/customer-text';
import { normalizeCompanyName } from '@/lib/modules/identity';
import { prisma } from '@/lib/shared/db/prisma';

import type { CustomerScope } from '@/lib/modules/clientes/domain/customer-scope';
import type {
  CustomerPhoneColumns,
  NewCustomer,
  NewCustomerPhone,
} from '@/lib/modules/clientes/domain/customer-view';

const phones = createCustomerPhoneRepository(prisma);

const AHORA = new Date('2026-10-20T12:00:00Z');
const LUEGO = new Date('2026-10-20T13:00:00Z');

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

function digitos(n: number): string {
  return String(Math.floor(Math.random() * 10 ** n)).padStart(n, '0');
}

/** Un movil colombiano irrepetible entre corridas. */
function numeroColombiano(): string {
  return `57300${digitos(7)}`;
}

const SIN_TELEFONO: CustomerPhoneColumns = { phone: null, phoneCountry: null, phoneE164: null, phoneIssue: null };

function columnas(e164: string): CustomerPhoneColumns {
  return { phone: `+${e164}`, phoneCountry: 'CO', phoneE164: e164, phoneIssue: null };
}

function entrada<P extends NewCustomerPhone>(phone: P): NewCustomer & { readonly phone: P } {
  const firstNames = `Nombre ${token()}`;
  const lastNames = `Apellido ${token()}`;
  const city = `Ciudad ${token()}`;
  return {
    firstNames,
    firstNamesNormalized: normalizeCustomerText(firstNames),
    lastNames,
    lastNamesNormalized: normalizeCustomerText(lastNames),
    city,
    cityNormalized: normalizeCustomerText(city),
    phone,
    email: null,
    address: null,
  };
}

type Empresa = {
  readonly companyId: string;
  readonly actorId: string;
  readonly scope: CustomerScope;
  readonly roleId: string;
  readonly documentTypeCode: string;
};

const empresas: Empresa[] = [];

async function crearEmpresaConActor(): Promise<Empresa> {
  const marker = token();
  const documentType = await prisma.documentType.create({
    data: { code: `DOC${marker.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  });
  const role = await prisma.role.create({
    data: { name: `rol-${marker}`, description: 'Rol de prueba' },
    select: { id: true },
  });
  const companyName = `Empresa numeros ${marker}`;
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
  const empresa = {
    companyId: company.id,
    actorId: user.id,
    scope: { companyId: company.id },
    roleId: role.id,
    documentTypeCode: documentType.code,
  };
  empresas.push(empresa);
  return empresa;
}

async function alta(empresa: Empresa, phone: CustomerPhoneColumns = SIN_TELEFONO): Promise<string> {
  const { id } = await createCustomer(prisma, entrada(phone), empresa.actorId, AHORA, empresa.scope);
  return id;
}

function vinculosDe(customerId: string) {
  return prisma.customerPhoneNumber.findMany({
    where: { customerId },
    select: { id: true, phoneNumberId: true, main: true, deletedAt: true, companyId: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

function sqlStateOf(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code;
  return error instanceof Error ? error.message : String(error);
}

async function rechazoDeLaBase(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    return sqlStateOf(error);
  }
  return 'aceptada';
}

let empresaA: Empresa;
let empresaB: Empresa;

beforeAll(async () => {
  empresaA = await crearEmpresaConActor();
  empresaB = await crearEmpresaConActor();
});

afterAll(async () => {
  for (const empresa of empresas) {
    await prisma.customerPhoneNumber.deleteMany({ where: { companyId: empresa.companyId } });
    await prisma.phoneNumber.deleteMany({ where: { companyId: empresa.companyId } });
    await prisma.customer.deleteMany({ where: { companyId: empresa.companyId } });
    expect(await prisma.customerPhoneNumber.count({ where: { companyId: empresa.companyId } })).toBe(0);
    expect(await prisma.phoneNumber.count({ where: { companyId: empresa.companyId } })).toBe(0);
    expect(await prisma.customer.count({ where: { companyId: empresa.companyId } })).toBe(0);
  }
  for (const empresa of empresas) {
    await prisma.user.deleteMany({ where: { companyId: empresa.companyId } });
    await prisma.role.delete({ where: { id: empresa.roleId } });
    await prisma.documentType.delete({ where: { code: empresa.documentTypeCode } });
    await prisma.company.delete({ where: { id: empresa.companyId } });
  }
  await prisma.$disconnect();
});

describe('R2 — varios telefonos por cliente y un numero de varios clientes', () => {
  it('R2 — un cliente guarda un principal y un secundario, y los lee como vinculos vivos', async () => {
    const id = await alta(empresaA);
    const principal = numeroColombiano();
    const secundario = numeroColombiano();

    await phones.addLink(id, principal, true, AHORA, empresaA.scope);
    await phones.addLink(id, secundario, false, AHORA, empresaA.scope);

    const links = await phones.listAliveLinks(id, empresaA.scope);
    expect(links.map(({ e164, main }) => ({ e164, main }))).toHaveLength(2);
    expect(links.map(({ e164, main }) => ({ e164, main }))).toEqual(
      expect.arrayContaining([
        { e164: principal, main: true },
        { e164: secundario, main: false },
      ]),
    );
  });

  it('R2 — dos clientes vivos de la misma empresa comparten el numero a traves de UNA sola fila de phone_numbers', async () => {
    const numero = numeroColombiano();
    const uno = await alta(empresaA);
    const otro = await alta(empresaA);

    await phones.addLink(uno, numero, true, AHORA, empresaA.scope);
    await phones.addLink(otro, numero, true, AHORA, empresaA.scope);

    expect(await prisma.phoneNumber.count({ where: { companyId: empresaA.companyId, e164: numero } })).toBe(1);
    const [vUno] = await vinculosDe(uno);
    const [vOtro] = await vinculosDe(otro);
    expect(vUno?.phoneNumberId).toBe(vOtro?.phoneNumberId);
    expect(await phones.findAliveOwners(numero, empresaA.scope)).toEqual([uno, otro].sort());
  });
});

describe('R3 — la base rechaza dos principales vivos y el mismo numero vivo dos veces', () => {
  it('R3 — un segundo principal vivo para el mismo cliente se rechaza por customer_phone_numbers_customer_main_key', async () => {
    const id = await alta(empresaA);
    await phones.addLink(id, numeroColombiano(), true, AHORA, empresaA.scope);

    expect(await rechazoDeLaBase(() => phones.addLink(id, numeroColombiano(), true, AHORA, empresaA.scope))).toBe('P2002');
    expect((await phones.listAliveLinks(id, empresaA.scope)).filter((l) => l.main)).toHaveLength(1);
  });

  it('R3 — el mismo numero vivo dos veces en el mismo cliente se rechaza por customer_phone_numbers_customer_phone_key', async () => {
    const id = await alta(empresaA);
    const numero = numeroColombiano();
    await phones.addLink(id, numero, true, AHORA, empresaA.scope);

    expect(await rechazoDeLaBase(() => phones.addLink(id, numero, false, AHORA, empresaA.scope))).toBe('P2002');
    expect(await phones.listAliveLinks(id, empresaA.scope)).toHaveLength(1);
  });

  it('R3 — promover un secundario sin degradar antes el principal se rechaza', async () => {
    const id = await alta(empresaA);
    await phones.addLink(id, numeroColombiano(), true, AHORA, empresaA.scope);
    await phones.addLink(id, numeroColombiano(), false, AHORA, empresaA.scope);
    const secundario = (await phones.listAliveLinks(id, empresaA.scope)).find((l) => !l.main);

    expect(await rechazoDeLaBase(() => phones.setMain(secundario?.linkId ?? '', true, LUEGO, empresaA.scope))).toBe('P2002');
  });

  it('R3 — los indices son parciales: un vinculo quitado no impide volver a anadir el numero ni otro principal', async () => {
    const id = await alta(empresaA);
    const numero = numeroColombiano();
    await phones.addLink(id, numero, true, AHORA, empresaA.scope);
    const [quitado] = await phones.listAliveLinks(id, empresaA.scope);
    await phones.removeLinks([quitado?.linkId ?? ''], LUEGO, empresaA.scope);

    await phones.addLink(id, numero, true, LUEGO, empresaA.scope);

    expect(await phones.listAliveLinks(id, empresaA.scope)).toEqual([
      expect.objectContaining({ e164: numero, main: true }),
    ]);
  });
});

describe('R4 — quitar un telefono es borrado logico', () => {
  it('R4 — removeLinks marca deleted_at en el vinculo y no borra ninguna fila de vinculos ni de numeros', async () => {
    const id = await alta(empresaA);
    const numero = numeroColombiano();
    await phones.addLink(id, numero, true, AHORA, empresaA.scope);
    await phones.addLink(id, numeroColombiano(), false, AHORA, empresaA.scope);
    const numerosAntes = await prisma.phoneNumber.count({ where: { companyId: empresaA.companyId } });
    const principal = (await phones.listAliveLinks(id, empresaA.scope)).find((l) => l.main);

    await phones.removeLinks([principal?.linkId ?? ''], LUEGO, empresaA.scope);

    const filas = await vinculosDe(id);
    expect(filas).toHaveLength(2);
    expect(filas.find((f) => f.id === principal?.linkId)?.deletedAt).toEqual(LUEGO);
    expect(filas.filter((f) => f.deletedAt === null)).toHaveLength(1);
    expect(await prisma.phoneNumber.count({ where: { companyId: empresaA.companyId } })).toBe(numerosAntes);
    expect(await phones.listAliveLinks(id, empresaA.scope)).toHaveLength(1);
    expect(await phones.findAliveOwners(numero, empresaA.scope)).toEqual([]);
  });
});

describe('R17 — solo cuentan como duenos los clientes vivos de la empresa con un telefono vivo', () => {
  it('R17 — excluye al cliente dado de baja, al vinculo quitado y al cliente de otra empresa', async () => {
    const numero = numeroColombiano();
    const dueno = await alta(empresaA);
    const deBaja = await alta(empresaA);
    const quitado = await alta(empresaA);
    const deOtraEmpresa = await alta(empresaB);
    for (const id of [dueno, deBaja, quitado]) await phones.addLink(id, numero, true, AHORA, empresaA.scope);
    await phones.addLink(deOtraEmpresa, numero, true, AHORA, empresaB.scope);
    await prisma.customer.update({ where: { id: deBaja }, data: { deletedAt: LUEGO } });
    const [vinculo] = await phones.listAliveLinks(quitado, empresaA.scope);
    await phones.removeLinks([vinculo?.linkId ?? ''], LUEGO, empresaA.scope);

    expect(await phones.findAliveOwners(numero, empresaA.scope)).toEqual([dueno]);
    expect(await phones.findAliveOwners(numero, empresaB.scope)).toEqual([deOtraEmpresa]);
  });

  it('R17, R19 — reconoce la variante de Mexico con y sin el 1 tras el 52', async () => {
    const ocho = digitos(8);
    const corto = `5255${ocho}`;
    const id = await alta(empresaA);
    await phones.addLink(id, corto, true, AHORA, empresaA.scope);

    expect(await phones.findAliveOwners(`52155${ocho}`, empresaA.scope)).toEqual([id]);
    expect(await phones.findAliveOwners(corto, empresaA.scope)).toEqual([id]);
  });

  it('R17 — un numero sin ningun cliente, o un wa_id que no es de digitos, no tiene duenos', async () => {
    expect(await phones.findAliveOwners(numeroColombiano(), empresaA.scope)).toEqual([]);
    expect(await phones.findAliveOwners('no-es-un-numero', empresaA.scope)).toEqual([]);
  });
});

describe('R45 — cada metodo trata un identificador de otra empresa como inexistente', () => {
  it('R45 — con el ambito de otra empresa el cliente no esta vivo y no tiene telefonos', async () => {
    const id = await alta(empresaA);
    await phones.addLink(id, numeroColombiano(), true, AHORA, empresaA.scope);

    expect(await phones.isAlive(id, empresaA.scope)).toBe(true);
    expect(await phones.isAlive(id, empresaB.scope)).toBe(false);
    expect(await phones.listAliveLinks(id, empresaB.scope)).toEqual([]);
  });

  it('R45 — quitar, cambiar el principal y escribir el espejo con el ambito de otra empresa no tocan nada', async () => {
    const numero = numeroColombiano();
    const id = await alta(empresaA, columnas(numero));
    await phones.addLink(id, numero, true, AHORA, empresaA.scope);
    const [link] = await phones.listAliveLinks(id, empresaA.scope);
    const antes = await vinculosDe(id);

    await phones.removeLinks([link?.linkId ?? ''], LUEGO, empresaB.scope);
    await phones.setMain(link?.linkId ?? '', false, LUEGO, empresaB.scope);
    await phones.writeMainMirror(id, null, empresaB.actorId, LUEGO, empresaB.scope);

    expect(await vinculosDe(id)).toEqual(antes);
    expect(
      await prisma.customer.findUniqueOrThrow({ where: { id }, select: { phoneE164: true, updatedBy: true } }),
    ).toEqual({ phoneE164: numero, updatedBy: empresaA.actorId });
  });

  it('R45, R47 — anadir un telefono con el ambito de otra empresa lo rechaza la FK compuesta y no deja vinculo', async () => {
    const id = await alta(empresaA);

    expect(await rechazoDeLaBase(() => phones.addLink(id, numeroColombiano(), true, AHORA, empresaB.scope))).not.toBe(
      'aceptada',
    );
    expect(await vinculosDe(id)).toEqual([]);
  });
});

describe('el espejo del principal y la edicion que lo reporta', () => {
  it('R28 — writeMainMirror escribe las cuatro columnas del cliente vivo con updated_at y updated_by; con null las deja a nulo', async () => {
    const numero = numeroColombiano();
    const id = await alta(empresaA);
    const espejo = { phone: '+57 300 0000000', phoneCountry: 'CO', phoneE164: numero, phoneIssue: null } as const;

    await phones.writeMainMirror(id, espejo, empresaA.actorId, LUEGO, empresaA.scope);
    const select = { phone: true, phoneCountry: true, phoneE164: true, phoneIssue: true, updatedAt: true, updatedBy: true };
    expect(await prisma.customer.findUniqueOrThrow({ where: { id }, select })).toEqual({
      ...espejo,
      updatedAt: LUEGO,
      updatedBy: empresaA.actorId,
    });

    await phones.writeMainMirror(id, null, empresaA.actorId, LUEGO, empresaA.scope);
    expect(await prisma.customer.findUniqueOrThrow({ where: { id }, select })).toMatchObject({
      phone: null,
      phoneCountry: null,
      phoneE164: null,
      phoneIssue: null,
    });
  });

  it('R10, R11 — updateAlive devuelve el phone_e164 de antes y el que quedo, y con el numero vacio el de un migrado con aviso no cambia', async () => {
    const anterior = numeroColombiano();
    const nuevo = numeroColombiano();
    const id = await alta(empresaA, columnas(anterior));

    expect(await updateAliveCustomer(prisma, id, entrada(columnas(nuevo)), empresaA.actorId, LUEGO, empresaA.scope)).toEqual({
      kind: 'ok',
      before: anterior,
      after: nuevo,
    });

    const migrado = await alta(empresaA);
    await prisma.customer.update({
      where: { id: migrado },
      data: { phone: 'tel. viejo 300-12', phoneCountry: 'CO', phoneIssue: 'invalid_format' },
    });
    const vacio: NewCustomerPhone = { kind: 'keep_legacy_or_clear' };
    expect(await updateAliveCustomer(prisma, migrado, entrada(vacio), empresaA.actorId, LUEGO, empresaA.scope)).toEqual({
      kind: 'ok',
      before: null,
      after: null,
    });
    expect(await updateAliveCustomer(prisma, id, entrada(vacio), empresaA.actorId, LUEGO, empresaA.scope)).toEqual({
      kind: 'ok',
      before: nuevo,
      after: null,
    });
    expect(await updateAliveCustomer(prisma, id, entrada(vacio), empresaB.actorId, LUEGO, empresaB.scope)).toBe('not_found');
  });
});
