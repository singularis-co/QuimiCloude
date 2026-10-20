/**
 * Los telefonos de cliente contra Postgres REAL: `customer-phone-prisma.ts` sobre las tablas
 * `phone_numbers` y `customer_phone_numbers`, sus dos indices unicos parciales y el ambito de
 * empresa de cada metodo. El invariante del espejo (R8) se comprueba tras cada escritor, con el alta
 * y la edicion de `lib/composition` y con `withCustomerTransaction` real.
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
import { withCustomerTransaction } from '@/lib/modules/clientes/adapters/driven/persistence/customer-unit-of-work-prisma';
import { createCustomerPhoneLinks, describeCustomerPhone, formatPhoneInternational } from '@/lib/modules/clientes';
import { clientes } from '@/lib/composition';
import { normalizeCustomerText } from '@/lib/modules/clientes/domain/customer-text';
import { normalizeCompanyName } from '@/lib/modules/identity';
import { prisma } from '@/lib/shared/db/prisma';

import type { CustomerScope } from '@/lib/modules/clientes/domain/customer-scope';
import type {
  CustomerPhoneColumns,
  CustomerView,
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

const actor = () => ({
  id: empresaA.actorId,
  companyId: empresaA.companyId,
  permissions: ['clientes.consultar', 'clientes.modificar'],
});

function formulario(e164: string | null) {
  return {
    firstNames: `Nombre ${token()}`,
    lastNames: `Apellido ${token()}`,
    city: 'Bogota',
    phoneCountry: 'CO',
    phoneNumber: e164 === null ? '' : e164.slice(2),
    email: null,
    address: null,
  };
}

/** El servicio de telefonos de `clientes` sobre una transaccion real, como lo cablea la composicion. */
function enTransaccion<T>(work: (links: ReturnType<typeof createCustomerPhoneLinks>) => Promise<T>): Promise<T> {
  return withCustomerTransaction((tx) => work(createCustomerPhoneLinks({ phones: createCustomerPhoneRepository(tx) })));
}

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

describe('R8 — el espejo y la tabla puente no divergen tras ningun escritor', () => {
  /** El invariante de R8 sobre la base: con `phone_e164`, exactamente un principal vivo con ese
   *  numero; sin el, ningun principal vivo. Devuelve la violacion en texto, o `null`. */
  async function violacionDeR8(customerId: string): Promise<string | null> {
    const { phoneE164 } = await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { phoneE164: true } });
    const principales = await prisma.customerPhoneNumber.findMany({
      where: { customerId, main: true, deletedAt: null },
      select: { phoneNumberId: true },
    });
    if (phoneE164 === null) {
      return principales.length === 0 ? null : `sin phone_e164 y con ${String(principales.length)} principal(es) vivo(s)`;
    }
    if (principales.length !== 1) return `con phone_e164 ${phoneE164} y ${String(principales.length)} principales vivos`;
    const numero = await prisma.phoneNumber.findUniqueOrThrow({
      where: { id: principales[0]?.phoneNumberId ?? '' },
      select: { e164: true },
    });
    return numero.e164 === phoneE164 ? null : `el principal es ${numero.e164} y phone_e164 es ${phoneE164}`;
  }

  it('R8, R9 — alta con numero y alta sin numero', async () => {
    const conNumero = await clientes.createCustomer(formulario(numeroColombiano()), actor());
    const sinNumero = await clientes.createCustomer(formulario(null), actor());

    expect(await violacionDeR8(conNumero.id)).toBeNull();
    expect(await violacionDeR8(sinNumero.id)).toBeNull();
    expect(await vinculosDe(sinNumero.id)).toEqual([]);
  });

  it('R8, R10, R12 — edicion que cambia el numero, que lo repite y que vuelve a un secundario', async () => {
    const primero = numeroColombiano();
    const segundo = numeroColombiano();
    const { id } = await clientes.createCustomer(formulario(primero), actor());

    await clientes.updateCustomer(id, formulario(segundo), actor());
    expect(await violacionDeR8(id)).toBeNull();
    expect((await phones.listAliveLinks(id, empresaA.scope)).map(({ e164, main }) => ({ e164, main }))).toEqual(
      expect.arrayContaining([
        { e164: primero, main: false },
        { e164: segundo, main: true },
      ]),
    );

    await clientes.updateCustomer(id, formulario(segundo), actor());
    expect(await violacionDeR8(id)).toBeNull();
    expect(await phones.listAliveLinks(id, empresaA.scope)).toHaveLength(2);

    await clientes.updateCustomer(id, formulario(primero), actor());
    expect(await violacionDeR8(id)).toBeNull();
    expect(await phones.listAliveLinks(id, empresaA.scope)).toHaveLength(2);
  });

  it('R8, R11 — edicion que vacia el numero: quita el principal de quien tenia phone_e164 y no toca al migrado con aviso', async () => {
    const { id } = await clientes.createCustomer(formulario(numeroColombiano()), actor());
    await clientes.updateCustomer(id, formulario(null), actor());
    expect(await violacionDeR8(id)).toBeNull();
    expect((await prisma.customer.findUniqueOrThrow({ where: { id }, select: { phoneE164: true } })).phoneE164).toBeNull();

    const migrado = await alta(empresaA);
    await prisma.customer.update({
      where: { id: migrado },
      data: { phone: 'tel. viejo 300-12', phoneCountry: 'CO', phoneIssue: 'invalid_format' },
    });
    await clientes.updateCustomer(migrado, formulario(null), actor());
    expect(await violacionDeR8(migrado)).toBeNull();
    expect(await vinculosDe(migrado)).toEqual([]);
    expect(
      await prisma.customer.findUniqueOrThrow({ where: { id: migrado }, select: { phone: true, phoneIssue: true } }),
    ).toEqual({ phone: 'tel. viejo 300-12', phoneIssue: 'invalid_format' });
  });

  it('R8, R27, R28 — vincular sin principal escribe el espejo; vincular con principal no lo toca', async () => {
    const sinPrincipal = await alta(empresaA);
    const waId = numeroColombiano();
    await enTransaccion((links) => links.addWaId(sinPrincipal, waId, empresaA.actorId, LUEGO, empresaA.companyId));
    expect(await violacionDeR8(sinPrincipal)).toBeNull();
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: sinPrincipal }, select: { phoneE164: true } })).phoneE164).toBe(waId);

    const conPrincipal = await clientes.createCustomer(formulario(numeroColombiano()), actor());
    await enTransaccion((links) => links.addWaId(conPrincipal.id, numeroColombiano(), empresaA.actorId, LUEGO, empresaA.companyId));
    expect(await violacionDeR8(conPrincipal.id)).toBeNull();
    expect(await phones.listAliveLinks(conPrincipal.id, empresaA.scope)).toHaveLength(2);
  });

  it('R8, R35 — desvincular el principal deja el espejo a nulo; desvincular un secundario no lo toca', async () => {
    const principal = numeroColombiano();
    const secundario = numeroColombiano();
    const { id } = await clientes.createCustomer(formulario(principal), actor());
    await enTransaccion((links) => links.addWaId(id, secundario, empresaA.actorId, LUEGO, empresaA.companyId));

    await enTransaccion((links) => links.removeWaId(id, secundario, empresaA.actorId, LUEGO, empresaA.companyId));
    expect(await violacionDeR8(id)).toBeNull();
    expect((await prisma.customer.findUniqueOrThrow({ where: { id }, select: { phoneE164: true } })).phoneE164).toBe(principal);

    await enTransaccion((links) => links.removeWaId(id, principal, empresaA.actorId, LUEGO, empresaA.companyId));
    expect(await violacionDeR8(id)).toBeNull();
    expect((await prisma.customer.findUniqueOrThrow({ where: { id }, select: { phoneE164: true } })).phoneE164).toBeNull();
  });

  it('R8 — anti-placebo: un principal que no coincide con phone_e164 se detecta', async () => {
    const id = await alta(empresaA, columnas(numeroColombiano()));
    await phones.addLink(id, numeroColombiano(), true, AHORA, empresaA.scope);
    expect(await violacionDeR8(id)).toMatch(/el principal es/);

    const sinEspejo = await alta(empresaA);
    await phones.addLink(sinEspejo, numeroColombiano(), true, AHORA, empresaA.scope);
    expect(await violacionDeR8(sinEspejo)).toMatch(/sin phone_e164/);
  });
});

describe('R14 — la lista y el formulario muestran el principal o, sin principal, el telefono antiguo con su aviso', () => {
  type LoMostrado = ReturnType<typeof describeCustomerPhone>;

  /** Las columnas que lee el campo de telefono del formulario y la columna de la lista. */
  function columnasMostradas(customer: CustomerView) {
    const { phone, phoneCountry, phoneE164, phoneIssue } = customer;
    return { phone, phoneCountry, phoneE164, phoneIssue };
  }

  /**
   * Lo que pintan la lista (`listCustomers`) y el formulario (`getCustomer`), con la misma
   * descripcion que usan sus componentes. Falla si las dos lecturas no coinciden.
   */
  async function loQueSeMuestra(id: string): Promise<LoMostrado> {
    const ficha = await clientes.getCustomer(id, actor());
    const pagina = await clientes.listCustomers({ search: ficha.firstNames }, actor());
    const fila = pagina.items.find((customer) => customer.id === id);
    if (fila === undefined) throw new Error(`el cliente ${id} no sale en la lista`);
    expect(columnasMostradas(fila)).toEqual(columnasMostradas(ficha));
    expect(describeCustomerPhone(fila)).toEqual(describeCustomerPhone(ficha));
    return describeCustomerPhone(ficha);
  }

  async function principalDe(id: string): Promise<string | null> {
    return (await phones.listAliveLinks(id, empresaA.scope)).find((link) => link.main)?.e164 ?? null;
  }

  const internacional = (e164: string): LoMostrado => ({ kind: 'international', text: formatPhoneInternational(e164) });

  it('R14 — tras alta, edicion que cambia y que vacia, vincular y desvincular, lista y formulario muestran el principal', async () => {
    const primero = numeroColombiano();
    const segundo = numeroColombiano();
    const secundario = numeroColombiano();
    const { id } = await clientes.createCustomer(formulario(primero), actor());
    expect(await principalDe(id)).toBe(primero);
    expect(await loQueSeMuestra(id)).toEqual(internacional(primero));

    await clientes.updateCustomer(id, formulario(segundo), actor());
    expect(await principalDe(id)).toBe(segundo);
    expect(await loQueSeMuestra(id)).toEqual(internacional(segundo));

    await enTransaccion((links) => links.addWaId(id, secundario, empresaA.actorId, LUEGO, empresaA.companyId));
    expect(await principalDe(id)).toBe(segundo);
    expect(await loQueSeMuestra(id)).toEqual(internacional(segundo));

    await enTransaccion((links) => links.removeWaId(id, segundo, empresaA.actorId, LUEGO, empresaA.companyId));
    expect(await principalDe(id)).toBeNull();
    expect(await loQueSeMuestra(id)).toEqual({ kind: 'none' });

    await clientes.updateCustomer(id, formulario(primero), actor());
    expect(await principalDe(id)).toBe(primero);
    expect(await loQueSeMuestra(id)).toEqual(internacional(primero));

    await clientes.updateCustomer(id, formulario(null), actor());
    expect(await principalDe(id)).toBeNull();
    expect(await loQueSeMuestra(id)).toEqual({ kind: 'none' });
  });

  it('R14 — sin principal, el migrado con aviso y el pendiente de relleno muestran su telefono antiguo; vincular lo sustituye por el principal', async () => {
    const migrado = await alta(empresaA);
    await prisma.customer.update({
      where: { id: migrado },
      data: { phone: 'tel. viejo 300-12', phoneCountry: 'CO', phoneIssue: 'invalid_format' },
    });
    const conAviso: LoMostrado = {
      kind: 'issue',
      legacyPhone: 'tel. viejo 300-12',
      issue: 'invalid_format',
      label: 'Sin formato válido',
    };
    expect(await principalDe(migrado)).toBeNull();
    expect(await loQueSeMuestra(migrado)).toEqual(conAviso);

    await clientes.updateCustomer(migrado, formulario(null), actor());
    expect(await principalDe(migrado)).toBeNull();
    expect(await loQueSeMuestra(migrado)).toEqual(conAviso);

    const pendiente = await alta(empresaA);
    await prisma.customer.update({ where: { id: pendiente }, data: { phone: '300 12 34' } });
    expect(await loQueSeMuestra(pendiente)).toEqual({ kind: 'legacy', legacyPhone: '300 12 34' });

    const vinculado = numeroColombiano();
    await enTransaccion((links) => links.addWaId(migrado, vinculado, empresaA.actorId, LUEGO, empresaA.companyId));
    expect(await principalDe(migrado)).toBe(vinculado);
    expect(await loQueSeMuestra(migrado)).toEqual(internacional(vinculado));

    await enTransaccion((links) => links.removeWaId(migrado, vinculado, empresaA.actorId, LUEGO, empresaA.companyId));
    expect(await principalDe(migrado)).toBeNull();
    expect(await loQueSeMuestra(migrado)).toEqual({ kind: 'none' });
  });
});

describe('R9 — withCustomerTransaction confirma o deshace el cliente y sus telefonos juntos, y reintenta UNA vez un choque de vinculos', () => {
  it('R9 — un fallo dentro de la unidad, despues de escribir cliente y principal, no deja ni el cliente ni el vinculo', async () => {
    const numero = numeroColombiano();
    const marca = `Rollback ${token()}`;

    await expect(
      withCustomerTransaction(async (tx) => {
        const { id } = await createCustomer(tx, entrada(columnas(numero)), empresaA.actorId, AHORA, empresaA.scope);
        await createCustomerPhoneRepository(tx).addLink(id, numero, true, AHORA, empresaA.scope);
        await tx.customer.update({ where: { id }, data: { city: marca } });
        throw new Error('fallo forzado');
      }),
    ).rejects.toThrow('fallo forzado');

    expect(await prisma.customer.count({ where: { companyId: empresaA.companyId, city: marca } })).toBe(0);
    expect(await phones.findAliveOwners(numero, empresaA.scope)).toEqual([]);
  });

  it('R3, R9 — un choque contra un unico parcial de los vinculos se reintenta una vez en una transaccion nueva', async () => {
    const id = await alta(empresaA);
    await phones.addLink(id, numeroColombiano(), true, AHORA, empresaA.scope);
    let intentos = 0;

    const resultado = await withCustomerTransaction(async (tx) => {
      intentos += 1;
      if (intentos === 1) await createCustomerPhoneRepository(tx).addLink(id, numeroColombiano(), true, AHORA, empresaA.scope);
      return 'confirmado';
    });

    expect(resultado).toBe('confirmado');
    expect(intentos).toBe(2);
    expect((await phones.listAliveLinks(id, empresaA.scope)).filter((l) => l.main)).toHaveLength(1);
  });

  it('R3 — si el reintento vuelve a chocar, el error sube y no queda nada escrito', async () => {
    const id = await alta(empresaA);
    await phones.addLink(id, numeroColombiano(), true, AHORA, empresaA.scope);
    let intentos = 0;

    const fallo = await withCustomerTransaction(async (tx) => {
      intentos += 1;
      await createCustomerPhoneRepository(tx).addLink(id, numeroColombiano(), true, AHORA, empresaA.scope);
    }).then(
      () => null,
      (error: unknown) => error,
    );

    expect(intentos).toBe(2);
    expect(sqlStateOf(fallo)).toBe('P2002');
    expect(await phones.listAliveLinks(id, empresaA.scope)).toHaveLength(1);
  });

  it('R3 — cualquier otro error sube sin reintentar', async () => {
    let intentos = 0;
    await expect(
      withCustomerTransaction(async () => {
        intentos += 1;
        throw new Error('otro fallo');
      }),
    ).rejects.toThrow('otro fallo');
    expect(intentos).toBe(1);
  });
});

describe('R2, R9 — dos altas simultaneas de clientes distintos con el mismo numero nuevo', () => {
  /** Espera a que alguna sesion de esta base quede bloqueada esperando a otra transaccion. */
  async function esperarUnaSesionBloqueada(): Promise<void> {
    for (let vuelta = 0; vuelta < 200; vuelta += 1) {
      const [fila] = await prisma.$queryRaw<{ esperando: number }[]>`
        SELECT count(*)::int AS esperando FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      if ((fila?.esperando ?? 0) > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error('la segunda transaccion nunca quedo esperando a la primera');
  }

  it('R2, R9 — la segunda espera a la primera, choca en phone_numbers_company_id_e164_key y su unico reintento reutiliza el numero', async () => {
    const numero = numeroColombiano();
    const uno = await alta(empresaA);
    const otro = await alta(empresaA);
    let soltarLaPrimera = (): void => undefined;
    const puerta = new Promise<void>((resolve) => {
      soltarLaPrimera = resolve;
    });
    let avisarEscrito = (): void => undefined;
    const escrito = new Promise<void>((resolve) => {
      avisarEscrito = resolve;
    });
    let intentosDeLaSegunda = 0;

    const primera = withCustomerTransaction(async (tx) => {
      await createCustomerPhoneRepository(tx).addLink(uno, numero, true, AHORA, empresaA.scope);
      avisarEscrito();
      await puerta;
    });
    await escrito;
    const segunda = withCustomerTransaction(async (tx) => {
      intentosDeLaSegunda += 1;
      await createCustomerPhoneRepository(tx).addLink(otro, numero, true, AHORA, empresaA.scope);
    });
    try {
      await esperarUnaSesionBloqueada();
    } finally {
      soltarLaPrimera();
    }
    await Promise.all([primera, segunda]);

    expect(intentosDeLaSegunda).toBe(2);
    expect(await prisma.phoneNumber.count({ where: { companyId: empresaA.companyId, e164: numero } })).toBe(1);
    expect(await phones.findAliveOwners(numero, empresaA.scope)).toEqual([uno, otro].sort());
  });
});
