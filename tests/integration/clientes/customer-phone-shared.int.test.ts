/**
 * El telefono internacional del cliente contra una base Postgres REAL: un mismo numero puede ser de
 * varios clientes de la empresa (QC-239 R7, antes `customer-phone-uniqueness.int.test.ts`, que
 * afirmaba el indice unico retirado), y la edicion con el numero vacio, que conserva el telefono
 * antiguo de un cliente con aviso y borra el de uno sin aviso.
 *
 * Los casos de R7 van por los casos de uso ya cableados en `lib/composition`, con su unidad de
 * trabajo real: el alta y la edicion escriben el cliente y su vinculo principal juntos.
 *
 * AISLAMIENTO: `customer-prisma.ts` usa el cliente Prisma GLOBAL, asi que una transaccion del test
 * con ROLLBACK no lo envolveria (mismo criterio que `customer-repository.int.test.ts`). Las
 * empresas efimeras nacen en `beforeAll`; `afterAll` borra por `company_id`, en el orden de las FK,
 * vinculos, numeros y clientes, cuenta que no quedo ninguno y despues borra usuario, rol, tipo de
 * documento y empresa.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createCustomer,
  updateAliveCustomer,
} from '@/lib/modules/clientes/adapters/driven/persistence/customer-prisma';
import { normalizeCustomerText } from '@/lib/modules/clientes/domain/customer-text';
import { clientes } from '@/lib/composition';
import { normalizeCompanyName } from '@/lib/modules/identity';
import { prisma } from '@/lib/shared/db/prisma';

import type { CustomerScope } from '@/lib/modules/clientes/domain/customer-scope';
import type {
  CustomerPhoneColumns,
  NewCustomer,
  NewCustomerPhone,
} from '@/lib/modules/clientes/domain/customer-view';

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

const AHORA = new Date('2026-10-19T12:00:00Z');
const LUEGO = new Date('2026-10-19T13:00:00Z');

/** Un numero colombiano valido e irrepetible entre corridas: 300 + siete digitos al azar. */
function numeroColombiano(): CustomerPhoneColumns {
  const siete = String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0');
  return {
    phone: `+57 300 ${siete}`,
    phoneCountry: 'CO',
    phoneE164: `57300${siete}`,
    phoneIssue: null,
  };
}

const SIN_TELEFONO: CustomerPhoneColumns = { phone: null, phoneCountry: null, phoneE164: null, phoneIssue: null };
const VACIO_AL_EDITAR: NewCustomerPhone = { kind: 'keep_legacy_or_clear' };

function entrada<P extends NewCustomerPhone>(phone: P, city = `Ciudad ${token()}`): NewCustomer & { readonly phone: P } {
  const firstNames = `Nombre ${token()}`;
  const lastNames = `Apellido ${token()}`;
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
  const companyName = `Empresa telefonos ${marker}`;
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

async function alta(empresa: Empresa, phone: CustomerPhoneColumns): Promise<string> {
  const creado = await createCustomer(prisma, entrada(phone), empresa.actorId, AHORA, empresa.scope);
  return creado.id;
}

/** Un cliente migrado: texto antiguo con su aviso, escrito como lo dejaria el relleno. */
async function migradoConAviso(empresa: Empresa, issue: 'invalid_format' | 'duplicate'): Promise<string> {
  const id = await alta(empresa, SIN_TELEFONO);
  await prisma.customer.update({
    where: { id },
    data: { phone: 'tel. viejo 300-12', phoneCountry: 'CO', phoneE164: null, phoneIssue: issue },
  });
  return id;
}

function telefonoDe(id: string) {
  return prisma.customer.findUniqueOrThrow({
    where: { id },
    select: { phone: true, phoneCountry: true, phoneE164: true, phoneIssue: true, city: true },
  });
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

/** El actor con el que el caso de uso escribe: solo el permiso de modificar clientes. */
function actorDe(empresa: Empresa) {
  return { id: empresa.actorId, companyId: empresa.companyId, permissions: ['clientes.modificar'] };
}

/** La entrada del formulario de cliente, con un movil colombiano escrito en nacional. */
function formulario(numero: CustomerPhoneColumns) {
  return {
    firstNames: `Nombre ${token()}`,
    lastNames: `Apellido ${token()}`,
    city: 'Bogota',
    phoneCountry: 'CO',
    phoneNumber: (numero.phoneE164 ?? '').slice(2),
    email: null,
    address: null,
  };
}

/** Vinculos vivos del cliente con su numero, leidos de la base. */
async function vinculosVivos(customerId: string) {
  const links = await prisma.customerPhoneNumber.findMany({
    where: { customerId, deletedAt: null },
    select: { phoneNumberId: true, main: true },
  });
  const numeros = await prisma.phoneNumber.findMany({
    where: { id: { in: links.map((l) => l.phoneNumberId) } },
    select: { id: true, e164: true },
  });
  return links.map((l) => ({ e164: numeros.find((n) => n.id === l.phoneNumberId)?.e164, main: l.main, phoneNumberId: l.phoneNumberId }));
}

describe('R7 (QC-239) — un mismo numero puede ser de varios clientes de la empresa', () => {
  it('R7 (QC-239) — dos altas de la misma empresa con el mismo numero se guardan las dos, cada una con su principal sobre UNA sola fila de phone_numbers', async () => {
    const numero = numeroColombiano();

    const uno = await clientes.createCustomer(formulario(numero), actorDe(empresaA));
    const otro = await clientes.createCustomer(formulario(numero), actorDe(empresaA));

    expect(uno.id).not.toBe(otro.id);
    expect(await telefonoDe(uno.id)).toMatchObject({ phoneE164: numero.phoneE164, phoneIssue: null });
    expect(await telefonoDe(otro.id)).toMatchObject({ phoneE164: numero.phoneE164, phoneIssue: null });
    const [vUno] = await vinculosVivos(uno.id);
    const [vOtro] = await vinculosVivos(otro.id);
    expect(vUno).toMatchObject({ e164: numero.phoneE164, main: true });
    expect(vOtro).toMatchObject({ e164: numero.phoneE164, main: true });
    expect(vUno?.phoneNumberId).toBe(vOtro?.phoneNumberId);
    expect(await prisma.phoneNumber.count({ where: { companyId: empresaA.companyId, e164: numero.phoneE164 ?? '' } })).toBe(1);
  });

  it('R7 (QC-239) — editar un cliente al numero que ya tiene otro de la misma empresa se guarda', async () => {
    const numero = numeroColombiano();
    await clientes.createCustomer(formulario(numero), actorDe(empresaA));
    const { id } = await clientes.createCustomer(formulario(numeroColombiano()), actorDe(empresaA));

    await expect(clientes.updateCustomer(id, formulario(numero), actorDe(empresaA))).resolves.toBeUndefined();

    expect(await telefonoDe(id)).toMatchObject({ phoneE164: numero.phoneE164 });
    expect((await vinculosVivos(id)).filter((v) => v.main)).toEqual([
      expect.objectContaining({ e164: numero.phoneE164, main: true }),
    ]);
  });

  it('R13 (QC-236) — el mismo numero en otra empresa se acepta', async () => {
    const numero = numeroColombiano();
    await alta(empresaA, numero);
    const enB = await createCustomer(prisma, entrada(numero), empresaB.actorId, AHORA, empresaB.scope);
    expect(await telefonoDe(enB.id)).toMatchObject({ phoneE164: numero.phoneE164 });
  });

  it('R13 (QC-236) — editar un cliente conservando su propio numero se guarda', async () => {
    const numero = numeroColombiano();
    const id = await alta(empresaA, numero);

    const resultado = await updateAliveCustomer(prisma, id, entrada(numero, 'Cali'), empresaA.actorId, LUEGO, empresaA.scope);

    expect(resultado).toMatchObject({ kind: 'ok' });
    expect(await telefonoDe(id)).toMatchObject({ phoneE164: numero.phoneE164, city: 'Cali' });
  });
});

describe('R10, R32, R34 — editar el telefono de un cliente con y sin aviso', () => {
  it.each(['invalid_format', 'duplicate'] as const)(
    'R34 — con %s y el numero vacio se conservan phone, phone_country, phone_e164 y phone_issue y se guarda la ciudad',
    async (issue) => {
      const id = await migradoConAviso(empresaA, issue);

      const resultado = await updateAliveCustomer(
        prisma,
        id,
        entrada(VACIO_AL_EDITAR, 'Medellin'),
        empresaA.actorId,
        LUEGO,
        empresaA.scope,
      );

      expect(resultado).toMatchObject({ kind: 'ok' });
      expect(await telefonoDe(id)).toEqual({
        phone: 'tel. viejo 300-12',
        phoneCountry: 'CO',
        phoneE164: null,
        phoneIssue: issue,
        city: 'Medellin',
      });
    },
  );

  it('R32 — con aviso y un numero valido se reemplaza el phone antiguo y phone_issue queda nulo', async () => {
    const id = await migradoConAviso(empresaA, 'invalid_format');
    const numero = numeroColombiano();

    const resultado = await updateAliveCustomer(prisma, id, entrada(numero), empresaA.actorId, LUEGO, empresaA.scope);

    expect(resultado).toMatchObject({ kind: 'ok' });
    expect(await telefonoDe(id)).toMatchObject({
      phone: numero.phone,
      phoneCountry: 'CO',
      phoneE164: numero.phoneE164,
      phoneIssue: null,
    });
  });

  it('R10 — sin aviso y con el numero vacio el cliente queda sin telefono', async () => {
    const id = await alta(empresaA, numeroColombiano());

    const resultado = await updateAliveCustomer(
      prisma,
      id,
      entrada(VACIO_AL_EDITAR, 'Pasto'),
      empresaA.actorId,
      LUEGO,
      empresaA.scope,
    );

    expect(resultado).toMatchObject({ kind: 'ok' });
    expect(await telefonoDe(id)).toEqual({
      phone: null,
      phoneCountry: null,
      phoneE164: null,
      phoneIssue: null,
      city: 'Pasto',
    });
  });

  it('R36 — editar una fila pendiente de relleno con el numero vacio conserva phone y deja phone_country, phone_e164 y phone_issue nulos', async () => {
    // Pendiente: el texto antiguo, sin phone_e164 ni phone_issue, como antes de pasar el relleno.
    const id = await alta(empresaA, SIN_TELEFONO);
    await prisma.customer.update({
      where: { id },
      data: { phone: 'tel. pendiente 300 123 4567', phoneCountry: null, phoneE164: null, phoneIssue: null },
    });

    const resultado = await updateAliveCustomer(
      prisma,
      id,
      entrada(VACIO_AL_EDITAR, 'Tunja'),
      empresaA.actorId,
      LUEGO,
      empresaA.scope,
    );

    expect(resultado).toMatchObject({ kind: 'ok' });
    expect(await telefonoDe(id)).toEqual({
      phone: 'tel. pendiente 300 123 4567',
      phoneCountry: null,
      phoneE164: null,
      phoneIssue: null,
      city: 'Tunja',
    });
  });

  it('R10 — con el numero vacio, un cliente de otra empresa sigue siendo not_found y no se toca', async () => {
    const id = await migradoConAviso(empresaA, 'duplicate');

    const resultado = await updateAliveCustomer(prisma, id, entrada(VACIO_AL_EDITAR), empresaB.actorId, LUEGO, empresaB.scope);

    expect(resultado).toBe('not_found');
    expect((await telefonoDe(id)).phoneIssue).toBe('duplicate');
  });
});
