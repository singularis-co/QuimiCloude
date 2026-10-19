/**
 * El relleno de los telefonos antiguos contra una base Postgres REAL: el caso de uso
 * `createBackfillLegacyPhones` con el adaptador `legacy-phone-prisma.ts` y la lectura real del pais
 * de la empresa de `identity`. Tambien confirma que el `UPDATE` funciona con la RLS forzada de
 * `customers`, porque corre por el mismo cliente Prisma que el resto de la app.
 *
 * El caso de uso recorre solo las empresas efimeras de este archivo (`listCompanyIds` inyectado):
 * nunca toca filas de otros archivos.
 *
 * AISLAMIENTO: el adaptador abre su propia transaccion sobre el cliente Prisma GLOBAL, asi que una
 * transaccion del test con ROLLBACK no lo envolveria. `afterAll` borra los clientes por
 * `company_id`, cuenta que no quedo ninguno y despues borra usuario, rol, tipo de documento y
 * empresa.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createBackfillLegacyPhones } from '@/lib/modules/clientes';
import { processLegacyPhonesOfCompany } from '@/lib/modules/clientes/adapters/driven/persistence/legacy-phone-prisma';
import { createGetCompanyCountry, normalizeCompanyName } from '@/lib/modules/identity';
import { createCompanyCountryRepository } from '@/lib/modules/identity/adapters/driven/persistence/company-country-prisma';
import { prisma } from '@/lib/shared/db/prisma';

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

type Empresa = {
  readonly companyId: string;
  readonly actorId: string;
  readonly roleId: string;
  readonly documentTypeCode: string;
};

const empresas: Empresa[] = [];

async function crearEmpresa(country: string | null): Promise<Empresa> {
  const marker = token();
  const documentType = await prisma.documentType.create({
    data: { code: `DOC${marker.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  });
  const role = await prisma.role.create({
    data: { name: `rol-${marker}`, description: 'Rol de prueba' },
    select: { id: true },
  });
  const companyName = `Empresa relleno ${marker}`;
  const company = await prisma.company.create({
    data: { name: companyName, nameNormalized: normalizeCompanyName(companyName), country },
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
  const empresa = { companyId: company.id, actorId: user.id, roleId: role.id, documentTypeCode: documentType.code };
  empresas.push(empresa);
  return empresa;
}

/** Un cliente como estaba antes de la migracion: texto libre y las tres columnas nuevas nulas. */
async function clienteAntiguo(
  empresa: Empresa,
  phone: string | null,
  createdAt: Date,
  extra: { deletedAt?: Date } = {},
): Promise<string> {
  const row = await prisma.customer.create({
    data: {
      companyId: empresa.companyId,
      firstNames: 'Cliente',
      firstNamesNormalized: 'cliente',
      lastNames: 'Antiguo',
      lastNamesNormalized: 'antiguo',
      city: 'Bogota',
      cityNormalized: 'bogota',
      phone,
      createdAt,
      updatedAt: createdAt,
      createdBy: empresa.actorId,
      updatedBy: empresa.actorId,
      deletedAt: extra.deletedAt ?? null,
    },
    select: { id: true },
  });
  return row.id;
}

function backfillDe(...companyIds: string[]) {
  return createBackfillLegacyPhones({
    listCompanyIds: async () => companyIds,
    legacyPhones: { processCompany: processLegacyPhonesOfCompany },
    companyCountryOf: createGetCompanyCountry({ companies: createCompanyCountryRepository() }),
  });
}

function filasDe(empresa: Empresa) {
  return prisma.customer.findMany({
    where: { companyId: empresa.companyId },
    orderBy: { id: 'asc' },
  });
}

const ENERO = new Date('2026-01-10T10:00:00Z');
const FEBRERO = new Date('2026-02-10T10:00:00Z');
const MARZO = new Date('2026-03-10T10:00:00Z');

let colombia: Empresa;
let sinPais: Empresa;
let mexico: Empresa;
let vacia: Empresa;

beforeAll(async () => {
  colombia = await crearEmpresa('CO');
  sinPais = await crearEmpresa(null);
  mexico = await crearEmpresa('MX');
  vacia = await crearEmpresa('CO');
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

describe('R24–R27 — el relleno sobre filas sembradas con texto libre', () => {
  it('R24, R25, R26 — convierte las validas y marca invalid_format y duplicate (con un numero ya tomado)', async () => {
    const valido = await clienteAntiguo(colombia, '300 123 4567', ENERO);
    const invalido = await clienteAntiguo(colombia, 'llamar despues', ENERO);
    const dupViejo = await clienteAntiguo(colombia, '310 765 4321', ENERO);
    const dupNuevo = await clienteAntiguo(colombia, '+57 310 765 4321', MARZO);
    const extranjero = await clienteAntiguo(colombia, '+593 99 123 4567', FEBRERO);
    const sinTelefono = await clienteAntiguo(colombia, null, ENERO);
    const dadoDeBaja = await clienteAntiguo(colombia, '315 222 3333', ENERO, { deletedAt: FEBRERO });

    // Un cliente vivo guardado ya con el numero nuevo: el texto antiguo que da el mismo numero
    // sale duplicado entero.
    const tomado = await clienteAntiguo(colombia, '+57 320 000 1111', MARZO);
    await prisma.customer.update({
      where: { id: tomado },
      data: { phoneCountry: 'CO', phoneE164: '573200001111' },
    });
    const contraTomado = await clienteAntiguo(colombia, '320 000 1111', FEBRERO);

    const resumen = await backfillDe(colombia.companyId)();

    expect(resumen).toEqual({ companies: 1, converted: 3, invalid: 1, duplicate: 2 });
    const porId = new Map((await filasDe(colombia)).map((f) => [f.id, f]));
    expect(porId.get(valido)).toMatchObject({ phoneCountry: 'CO', phoneE164: '573001234567', phoneIssue: null });
    expect(porId.get(invalido)).toMatchObject({ phoneCountry: 'CO', phoneE164: null, phoneIssue: 'invalid_format' });
    expect(porId.get(dupNuevo)).toMatchObject({ phoneCountry: 'CO', phoneE164: '573107654321', phoneIssue: null });
    expect(porId.get(dupViejo)).toMatchObject({ phoneCountry: 'CO', phoneE164: null, phoneIssue: 'duplicate' });
    expect(porId.get(extranjero)).toMatchObject({ phoneCountry: 'EC', phoneE164: '593991234567', phoneIssue: null });
    expect(porId.get(contraTomado)).toMatchObject({ phoneE164: null, phoneIssue: 'duplicate' });
    expect(porId.get(tomado)).toMatchObject({ phoneE164: '573200001111', phoneIssue: null });
    expect(porId.get(sinTelefono)).toMatchObject({ phone: null, phoneCountry: null, phoneE164: null, phoneIssue: null });
    expect(porId.get(dadoDeBaja)).toMatchObject({ phoneCountry: null, phoneE164: null, phoneIssue: null });
  });

  it('R24 — usa CO cuando la empresa no tiene pais, y el pais de la empresa cuando lo tiene', async () => {
    const enSinPais = await clienteAntiguo(sinPais, '300 765 1234', ENERO);
    const invalidoSinPais = await clienteAntiguo(sinPais, '12', ENERO);
    const enMexico = await clienteAntiguo(mexico, '55 1234 5678', ENERO);

    await backfillDe(sinPais.companyId, mexico.companyId)();

    expect(await prisma.customer.findUniqueOrThrow({ where: { id: enSinPais } })).toMatchObject({
      phoneCountry: 'CO',
      phoneE164: '573007651234',
      phoneIssue: null,
    });
    expect(await prisma.customer.findUniqueOrThrow({ where: { id: invalidoSinPais } })).toMatchObject({
      phoneCountry: 'CO',
      phoneIssue: 'invalid_format',
    });
    expect(await prisma.customer.findUniqueOrThrow({ where: { id: enMexico } })).toMatchObject({
      phoneCountry: 'MX',
      phoneIssue: null,
    });
  });

  it('R27 — deja phone, updated_at y updated_by byte a byte iguales y no toca ninguna otra columna', async () => {
    await clienteAntiguo(colombia, ' 301 999 8888 ', ENERO);
    await clienteAntiguo(colombia, 'sin numero', FEBRERO);
    const antes = await filasDe(colombia);

    await backfillDe(colombia.companyId)();

    const despues = await filasDe(colombia);
    expect(despues.map((f) => f.id)).toEqual(antes.map((f) => f.id));
    const sinTelefonoNuevo = (fila: (typeof antes)[number]) => {
      const { phoneCountry, phoneE164, phoneIssue, ...resto } = fila;
      void phoneCountry;
      void phoneE164;
      void phoneIssue;
      return resto;
    };
    expect(despues.map(sinTelefonoNuevo)).toEqual(antes.map(sinTelefonoNuevo));
  });

  it('R27 — una segunda pasada no cambia ninguna fila y no cuenta nada', async () => {
    await clienteAntiguo(colombia, '302 111 2222', ENERO);
    await backfillDe(colombia.companyId)();
    const antes = await filasDe(colombia);

    const segunda = await backfillDe(colombia.companyId)();

    expect(segunda).toEqual({ companies: 1, converted: 0, invalid: 0, duplicate: 0 });
    expect(await filasDe(colombia)).toEqual(antes);
  });

  it('R27 — con cero clientes termina sin error', async () => {
    await expect(backfillDe(vacia.companyId)()).resolves.toEqual({
      companies: 1,
      converted: 0,
      invalid: 0,
      duplicate: 0,
    });
    expect(await prisma.customer.count({ where: { companyId: vacia.companyId } })).toBe(0);
  });
});
