/**
 * El telefono internacional del cliente contra una base Postgres REAL: el indice unico parcial
 * `customers_company_phone_e164_key` traducido a `'duplicate_phone'` por `customer-prisma.ts`, y la
 * edicion con el numero vacio, que conserva el telefono antiguo de un cliente con aviso y borra el
 * de uno sin aviso.
 *
 * AISLAMIENTO: `customer-prisma.ts` usa el cliente Prisma GLOBAL, asi que una transaccion del test
 * con ROLLBACK no lo envolveria (mismo criterio que `customer-repository.int.test.ts`). Las
 * empresas efimeras nacen en `beforeAll`; `afterAll` borra sus clientes por `company_id`, cuenta que
 * no quedo ninguno y despues borra usuario, rol, tipo de documento y empresa.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createCustomer,
  updateAliveCustomer,
} from '@/lib/modules/clientes/adapters/driven/persistence/customer-prisma';
import { normalizeCustomerText } from '@/lib/modules/clientes/domain/customer-text';
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
    await prisma.customer.deleteMany({ where: { companyId: empresa.companyId } });
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

describe('R12, R13, R14 — el indice unico parcial del telefono', () => {
  it('R13 — el mismo numero en otra empresa se acepta', async () => {
    const numero = numeroColombiano();
    await alta(empresaA, numero);
    const enB = await createCustomer(prisma, entrada(numero), empresaB.actorId, AHORA, empresaB.scope);
    expect(enB).not.toBe('duplicate_phone');
  });

  it('R13 — el numero de un cliente dado de baja de la misma empresa se acepta', async () => {
    const numero = numeroColombiano();
    const baja = await alta(empresaA, numero);
    await prisma.customer.update({ where: { id: baja }, data: { deletedAt: AHORA } });

    const nuevo = await createCustomer(prisma, entrada(numero), empresaA.actorId, LUEGO, empresaA.scope);
    expect(nuevo).not.toBe('duplicate_phone');
  });

  it('R13 — editar un cliente conservando su propio numero no cuenta como duplicado', async () => {
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
