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
 * transaccion del test con ROLLBACK no lo envolveria. `afterAll` borra, por `company_id` y en el
 * orden que exigen las FK, vinculos, numeros y clientes, cuenta que no quedo ninguno y despues
 * borra usuario, rol, tipo de documento y empresa.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createBackfillLegacyPhones, planLegacyPhoneBackfill } from '@/lib/modules/clientes';
import { createCustomerPhoneRepository } from '@/lib/modules/clientes/adapters/driven/persistence/customer-phone-prisma';
import { withCustomerTransaction } from '@/lib/modules/clientes/adapters/driven/persistence/customer-unit-of-work-prisma';
import { processLegacyPhonesOfCompany } from '@/lib/modules/clientes/adapters/driven/persistence/legacy-phone-prisma';
import { createGetCompanyCountry, normalizeCompanyName } from '@/lib/modules/identity';
import { createCompanyCountryRepository } from '@/lib/modules/identity/adapters/driven/persistence/company-country-prisma';
import { listActiveCompanyIds } from '@/lib/modules/identity/adapters/driven/persistence/company-directory-prisma';
import { prisma } from '@/lib/shared/db/prisma';

import type { LegacyPhonePlan } from '@/lib/modules/clientes';

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

/**
 * Un cliente como estaba antes de la migracion: texto libre y las tres columnas nuevas nulas. Con
 * `phoneIssue`, como lo dejo una pasada anterior del relleno.
 */
async function clienteAntiguo(
  empresa: Empresa,
  phone: string | null,
  createdAt: Date,
  extra: { deletedAt?: Date; phoneCountry?: string; phoneE164?: string; phoneIssue?: string } = {},
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
      phoneCountry: extra.phoneCountry ?? null,
      phoneE164: extra.phoneE164 ?? null,
      phoneIssue: extra.phoneIssue ?? null,
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

/** Los vinculos vivos de la empresa, con el numero de cada uno. */
async function vinculosDe(empresa: Empresa) {
  const links = await prisma.customerPhoneNumber.findMany({
    where: { companyId: empresa.companyId, deletedAt: null },
    orderBy: { id: 'asc' },
  });
  const numbers = await prisma.phoneNumber.findMany({ where: { companyId: empresa.companyId } });
  const e164ById = new Map(numbers.map((n) => [n.id, n.e164]));
  return links.map((l) => ({ ...l, e164: e164ById.get(l.phoneNumberId) }));
}

/**
 * El invariante del espejo sobre los clientes vivos indicados: con `phone_e164`, exactamente un
 * vinculo principal vivo con ese numero; sin el, ninguno.
 */
async function esperarInvariante(empresa: Empresa, ids: readonly string[]): Promise<void> {
  const vinculos = await vinculosDe(empresa);
  const filas = await filasDe(empresa);
  for (const id of ids) {
    const fila = filas.find((f) => f.id === id);
    const principales = vinculos.filter((v) => v.customerId === id && v.main);
    if (fila?.deletedAt === null && fila.phoneE164 !== null) {
      expect(principales.map((v) => v.e164), `cliente ${id}`).toEqual([fila.phoneE164]);
    } else {
      expect(principales, `cliente ${id}`).toEqual([]);
    }
  }
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

describe('R24–R27 — el relleno sobre filas sembradas con texto libre', () => {
  it('R13, R8 — convierte las validas aunque compartan numero, sin duplicate, cada una con su principal', async () => {
    const valido = await clienteAntiguo(colombia, '300 123 4567', ENERO);
    const invalido = await clienteAntiguo(colombia, 'llamar despues', ENERO);
    const mismoViejo = await clienteAntiguo(colombia, '310 765 4321', ENERO);
    const mismoNuevo = await clienteAntiguo(colombia, '+57 310 765 4321', MARZO);
    const extranjero = await clienteAntiguo(colombia, '+593 99 123 4567', FEBRERO);
    const sinTelefono = await clienteAntiguo(colombia, null, ENERO);
    const dadoDeBaja = await clienteAntiguo(colombia, '315 222 3333', ENERO, { deletedAt: FEBRERO });

    const resumen = await backfillDe(colombia.companyId)();

    expect(resumen).toEqual({ companies: 1, converted: 4, invalid: 1, reconverted: 0 });
    const porId = new Map((await filasDe(colombia)).map((f) => [f.id, f]));
    expect(porId.get(valido)).toMatchObject({ phoneCountry: 'CO', phoneE164: '573001234567', phoneIssue: null });
    expect(porId.get(invalido)).toMatchObject({ phoneCountry: 'CO', phoneE164: null, phoneIssue: 'invalid_format' });
    expect(porId.get(mismoNuevo)).toMatchObject({ phoneCountry: 'CO', phoneE164: '573107654321', phoneIssue: null });
    expect(porId.get(mismoViejo)).toMatchObject({ phoneCountry: 'CO', phoneE164: '573107654321', phoneIssue: null });
    expect(porId.get(extranjero)).toMatchObject({ phoneCountry: 'EC', phoneE164: '593991234567', phoneIssue: null });
    expect(porId.get(sinTelefono)).toMatchObject({ phone: null, phoneCountry: null, phoneE164: null, phoneIssue: null });
    expect(porId.get(dadoDeBaja)).toMatchObject({ phoneCountry: null, phoneE164: null, phoneIssue: null });

    // Los dos clientes del mismo numero comparten la fila de `phone_numbers`.
    const vinculos = await vinculosDe(colombia);
    const delMismo = vinculos.filter((v) => v.customerId === mismoViejo || v.customerId === mismoNuevo);
    expect(delMismo).toHaveLength(2);
    expect(new Set(delMismo.map((v) => v.phoneNumberId)).size).toBe(1);
    await esperarInvariante(colombia, [valido, invalido, mismoViejo, mismoNuevo, extranjero, sinTelefono, dadoDeBaja]);
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

    expect(segunda).toEqual({ companies: 1, converted: 0, invalid: 0, reconverted: 0 });
    expect(await filasDe(colombia)).toEqual(antes);
  });

  it('R24 — los clientes de una empresa desactivada quedan sin tocar', async () => {
    const activa = await crearEmpresa('CO');
    const desactivada = await crearEmpresa('CO');
    const enActiva = await clienteAntiguo(activa, '304 555 6677', ENERO);
    const enDesactivada = await clienteAntiguo(desactivada, '304 555 6677', ENERO);
    await prisma.company.update({ where: { id: desactivada.companyId }, data: { deletedAt: FEBRERO } });

    // La lista REAL de empresas activas de `identity`, recortada a las dos de este caso para no
    // tocar filas de otros archivos: el filtro de empresas activas es el de produccion.
    const deEsteCaso = new Set([activa.companyId, desactivada.companyId]);
    const resumen = await createBackfillLegacyPhones({
      listCompanyIds: async () => (await listActiveCompanyIds()).filter((id) => deEsteCaso.has(id)),
      legacyPhones: { processCompany: processLegacyPhonesOfCompany },
      companyCountryOf: createGetCompanyCountry({ companies: createCompanyCountryRepository() }),
    })();

    expect(resumen).toEqual({ companies: 1, converted: 1, invalid: 0, reconverted: 0 });
    expect(await prisma.customer.findUniqueOrThrow({ where: { id: enActiva } })).toMatchObject({
      phoneCountry: 'CO',
      phoneE164: '573045556677',
      phoneIssue: null,
    });
    expect(await prisma.customer.findUniqueOrThrow({ where: { id: enDesactivada } })).toMatchObject({
      phone: '304 555 6677',
      phoneCountry: null,
      phoneE164: null,
      phoneIssue: null,
    });
  });

  it('R27 — con cero clientes termina sin error', async () => {
    await expect(backfillDe(vacia.companyId)()).resolves.toEqual({
      companies: 1,
      converted: 0,
      invalid: 0,
      reconverted: 0,
    });
    expect(await prisma.customer.count({ where: { companyId: vacia.companyId } })).toBe(0);
  });
});

describe('R49 — la reconversion de los clientes que una pasada anterior dejo en duplicate', () => {
  it('R49, R8 — la duplicate valida queda con su numero y su principal; la que ya no lo es, invalid_format; las invalid_format no se tocan', async () => {
    const empresa = await crearEmpresa('CO');
    // Una pasada anterior la leyo con MX: se vuelve a leer con MX, no con el CO de la empresa.
    const dupMexico = await clienteAntiguo(empresa, '55 1234 5678', ENERO, { phoneCountry: 'MX', phoneIssue: 'duplicate' });
    const dupColombia = await clienteAntiguo(empresa, '300 123 4567', ENERO, { phoneCountry: 'CO', phoneIssue: 'duplicate' });
    const dupInvalida = await clienteAntiguo(empresa, '300 12', ENERO, { phoneCountry: 'CO', phoneIssue: 'duplicate' });
    const yaInvalida = await clienteAntiguo(empresa, '300 123 4567', ENERO, {
      phoneCountry: 'CO',
      phoneIssue: 'invalid_format',
    });
    const dupDeBaja = await clienteAntiguo(empresa, '300 123 4567', ENERO, {
      phoneCountry: 'CO',
      phoneIssue: 'duplicate',
      deletedAt: FEBRERO,
    });
    const pendiente = await clienteAntiguo(empresa, '300 123 4567', FEBRERO);
    const antes = new Map((await filasDe(empresa)).map((f) => [f.id, f]));

    const resumen = await backfillDe(empresa.companyId)();

    expect(resumen).toEqual({ companies: 1, converted: 1, invalid: 1, reconverted: 2 });
    const porId = new Map((await filasDe(empresa)).map((f) => [f.id, f]));
    expect(porId.get(dupMexico)).toMatchObject({ phoneCountry: 'MX', phoneIssue: null });
    expect(porId.get(dupMexico)?.phoneE164?.startsWith('52')).toBe(true);
    expect(porId.get(dupColombia)).toMatchObject({ phoneCountry: 'CO', phoneE164: '573001234567', phoneIssue: null });
    expect(porId.get(dupInvalida)).toMatchObject({ phoneCountry: 'CO', phoneE164: null, phoneIssue: 'invalid_format' });
    expect(porId.get(pendiente)).toMatchObject({ phoneCountry: 'CO', phoneE164: '573001234567', phoneIssue: null });
    expect(porId.get(yaInvalida)).toEqual(antes.get(yaInvalida));
    expect(porId.get(dupDeBaja)).toEqual(antes.get(dupDeBaja));
    // Ni `phone` ni `updated_at`/`updated_by` cambian en las reconvertidas.
    for (const id of [dupMexico, dupColombia, dupInvalida]) {
      expect(porId.get(id)).toMatchObject({
        phone: antes.get(id)?.phone,
        updatedAt: antes.get(id)?.updatedAt,
        updatedBy: antes.get(id)?.updatedBy,
      });
    }

    const vivasEnDuplicate = await prisma.customer.count({
      where: { companyId: empresa.companyId, deletedAt: null, phoneIssue: 'duplicate' },
    });
    expect(vivasEnDuplicate).toBe(0);
    await esperarInvariante(empresa, [dupMexico, dupColombia, dupInvalida, yaInvalida, dupDeBaja, pendiente]);
  });

  it('R49 — la segunda pasada no cambia ninguna fila ni ningun vinculo y no cuenta nada', async () => {
    const empresa = await crearEmpresa('CO');
    await clienteAntiguo(empresa, '300 123 4567', ENERO, { phoneCountry: 'CO', phoneIssue: 'duplicate' });
    await clienteAntiguo(empresa, 'nada', ENERO, { phoneCountry: 'CO', phoneIssue: 'duplicate' });
    await clienteAntiguo(empresa, '300 123 4567', FEBRERO);
    await backfillDe(empresa.companyId)();
    const filasAntes = await filasDe(empresa);
    const vinculosAntes = await vinculosDe(empresa);

    const segunda = await backfillDe(empresa.companyId)();

    expect(segunda).toEqual({ companies: 1, converted: 0, invalid: 0, reconverted: 0 });
    expect(await filasDe(empresa)).toEqual(filasAntes);
    expect(await vinculosDe(empresa)).toEqual(vinculosAntes);
  });
});

describe('R13, R49 — el relleno y un alta simultanea del mismo numero nuevo', () => {
  /** Espera a que alguna sesion de esta base quede bloqueada esperando a otra transaccion. */
  async function esperarUnaSesionBloqueada(): Promise<void> {
    for (let vuelta = 0; vuelta < 200; vuelta += 1) {
      const [fila] = await prisma.$queryRaw<{ esperando: number }[]>`
        SELECT count(*)::int AS esperando FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      if ((fila?.esperando ?? 0) > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error('el relleno nunca quedo esperando al alta');
  }

  it('R13, R49 — el relleno espera al alta, choca en phone_numbers_company_id_e164_key y su unico reintento reutiliza el numero', async () => {
    const empresa = await crearEmpresa('CO');
    const siete = String(Math.floor(Math.random() * 10 ** 7)).padStart(7, '0');
    const numero = `57300${siete}`;
    const antiguo = await clienteAntiguo(empresa, `300 ${siete.slice(0, 3)} ${siete.slice(3)}`, ENERO);
    // El cliente del alta ya trae su telefono normalizado: no es candidato del relleno.
    const delAlta = await clienteAntiguo(empresa, `+${numero}`, FEBRERO, { phoneCountry: 'CO', phoneE164: numero });
    const scope = { companyId: empresa.companyId };

    let soltarElAlta = (): void => undefined;
    const puerta = new Promise<void>((resolve) => {
      soltarElAlta = resolve;
    });
    let avisarEscrito = (): void => undefined;
    const escrito = new Promise<void>((resolve) => {
      avisarEscrito = resolve;
    });
    let intentosDelRelleno = 0;
    const plan: LegacyPhonePlan = (rows) => {
      intentosDelRelleno += 1;
      return planLegacyPhoneBackfill(rows, 'CO');
    };

    const alta = withCustomerTransaction(async (tx) => {
      await createCustomerPhoneRepository(tx).addLink(delAlta, numero, true, MARZO, scope);
      avisarEscrito();
      await puerta;
    });
    await escrito;
    const relleno = processLegacyPhonesOfCompany(plan, scope);
    try {
      await esperarUnaSesionBloqueada();
    } finally {
      soltarElAlta();
    }
    const [, resumen] = await Promise.all([alta, relleno]);

    expect(intentosDelRelleno).toBe(2);
    expect(resumen).toEqual({ converted: 1, invalid: 0, reconverted: 0 });
    expect(await prisma.phoneNumber.count({ where: { companyId: empresa.companyId, e164: numero } })).toBe(1);
    expect(await createCustomerPhoneRepository(prisma).findAliveOwners(numero, scope)).toEqual([antiguo, delAlta].sort());
    expect(await prisma.customer.findUniqueOrThrow({ where: { id: antiguo } })).toMatchObject({
      phoneCountry: 'CO',
      phoneE164: numero,
      phoneIssue: null,
      updatedAt: ENERO,
    });
    await esperarInvariante(empresa, [antiguo, delAlta]);
  });
});
