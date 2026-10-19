/**
 * El adaptador `administrator-prisma.ts` y los casos de uso de Administradores del Maestro contra
 * Postgres real.
 *
 * AISLAMIENTO — `transaccion`: cada `it` corre en una `prisma.$transaction` interactiva que termina
 * lanzando `RollbackSignal`, y el repositorio se construye sobre esa `tx`. Las escrituras del
 * adaptador abren su propio `SAVEPOINT`, asi que un duplicado deja la transaccion usable y el caso
 * puede comprobar que no quedo nada.
 *
 * El enlace para fijar la contrasena: `credential-setup-link-prisma.ts` habla con el cliente
 * global y abre su propio `prisma.$transaction`. Para que su codigo de produccion corra dentro de la
 * transaccion del test, se importa una copia con `@/lib/shared/db/prisma` doblado a un puente cuyo
 * `$transaction` abre un `SAVEPOINT` sobre la `tx` en curso (`atomically`). El primer caso del
 * bloque de reenvio comprueba que lo escrito no se ve desde fuera de la transaccion.
 *
 * La lista cruza empresas: la base trae la empresa inicial y su Administrador, y otros archivos
 * pueden haber dejado filas confirmadas. Cada caso acota lo que mira a sus propias empresas (filtro)
 * o a su propia marca aleatoria (busqueda).
 */
import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { normalizeCompanyName } from '@/lib/modules/identity';
import { atomically } from '@/lib/modules/identity/adapters/driven/persistence/company-prisma';
import { createAdministratorRepository } from '@/lib/modules/identity/adapters/driven/persistence/administrator-prisma';
import { credentialSetupSecretCrypto } from '@/lib/modules/identity/adapters/driven/security/credential-setup-secret-crypto';
import { createCreateAdministrator } from '@/lib/modules/identity/domain/create-administrator';
import {
  credentialSetupLinkExpiresAt,
  NO_CREDENTIAL_SENTINEL,
} from '@/lib/modules/identity/domain/credential-setup-link';
import { createDeleteAdministrator } from '@/lib/modules/identity/domain/delete-administrator';
import { DOCUMENT_TYPE_CC } from '@/lib/modules/identity/domain/document-type';
import { createGetAdministrator } from '@/lib/modules/identity/domain/get-administrator';
import { createListAdministrators } from '@/lib/modules/identity/domain/list-administrators';
import { createResendAdministratorLink } from '@/lib/modules/identity/domain/resend-administrator-link';
import {
  ROLE_ADMINISTRADOR,
  ROLE_EMPACADOR,
  ROLE_MAESTRO,
  ROLE_OPERADOR,
} from '@/lib/modules/identity/domain/roles';
import { floorToSecond } from '@/lib/modules/identity/domain/session-revocation';
import { createUpdateAdministrator } from '@/lib/modules/identity/domain/update-administrator';
import { prisma } from '@/lib/shared/db/prisma';

import type { UserAccountStatus } from '@/lib/modules/identity/domain/account-status';
import type { AdministratorRow } from '@/lib/modules/identity/domain/administrator-view';
import type { PlatformActor } from '@/lib/modules/identity/domain/platform-actor';
import type { CredentialSetupLinkRepository } from '@/lib/modules/identity/ports/credential-setup-link-repository';

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Transaccion del test y puente del adaptador del enlace
// ---------------------------------------------------------------------------

class RollbackSignal extends Error {
  constructor() {
    super('rollback de aislamiento del test');
    this.name = 'RollbackSignal';
  }
}

let currentTx: Tx | null = null;

const txBridge = {
  $transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    if (currentTx === null) {
      throw new Error('el adaptador del enlace se llamo fuera de la transaccion del test');
    }
    return atomically(currentTx, fn);
  },
};

const LINK_ADAPTER_PATH =
  '@/lib/modules/identity/adapters/driven/persistence/credential-setup-link-prisma';

let links: CredentialSetupLinkRepository;

beforeAll(async () => {
  vi.resetModules();
  vi.doMock('@/lib/shared/db/prisma', () => ({ prisma: txBridge }));
  const bound = await import('@/lib/shared/db/prisma');
  if ((bound.prisma as unknown) !== txBridge) {
    throw new Error('el doble de `@/lib/shared/db/prisma` no quedo en vigor');
  }
  const adapter = (await import(
    LINK_ADAPTER_PATH
  )) as typeof import('@/lib/modules/identity/adapters/driven/persistence/credential-setup-link-prisma');
  links = {
    issueForPendingUser: adapter.issueForPendingUser,
    applyCredentialAndActivate: adapter.applyCredentialAndActivate,
  };
  vi.doUnmock('@/lib/shared/db/prisma');
});

afterAll(() => {
  vi.resetModules();
});

async function inRolledBackTransaction(body: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        currentTx = tx;
        try {
          await body(tx);
        } finally {
          currentTx = null;
        }
        throw new RollbackSignal();
      },
      { maxWait: 10_000, timeout: 60_000 },
    );
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error;
  }
}

// ---------------------------------------------------------------------------
// Casos de uso cableados sobre la transaccion
// ---------------------------------------------------------------------------

const ACTOR: PlatformActor = {
  id: randomUUID(),
  permissions: ['empresas.consultar', 'empresas.modificar'],
};

type SentMail = { readonly to: string; readonly secret: string };

function wire(tx: Tx, clock: () => Date = () => NOW) {
  const administrators = createAdministratorRepository(tx);
  const sent: SentMail[] = [];
  const ignored: Array<{ listName: string; fields: readonly string[] }> = [];
  const mailer = {
    sendCredentialSetupLink(input: { readonly to: string; readonly secret: string }) {
      sent.push({ to: input.to, secret: input.secret });
      return Promise.resolve('sent' as const);
    },
  };
  const mailDeps = { secrets: credentialSetupSecretCrypto, links, mailer };
  return {
    administrators,
    sent,
    ignored,
    list: createListAdministrators({
      administrators,
      log: {
        ignoredFields(listName, fields) {
          ignored.push({ listName, fields });
        },
      },
    }),
    get: createGetAdministrator({ administrators }),
    create: createCreateAdministrator({ administrators, ...mailDeps, now: clock }),
    update: createUpdateAdministrator({ administrators, now: clock }),
    remove: createDeleteAdministrator({ administrators, now: clock }),
    resend: createResendAdministratorLink({ administrators, ...mailDeps, now: clock }),
  };
}

async function codeOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
      return error.code;
    }
    throw error;
  }
  throw new Error('se esperaba un error con codigo y la operacion paso');
}

// ---------------------------------------------------------------------------
// Fixture propio de cada transaccion
// ---------------------------------------------------------------------------

const NOW = new Date('2026-10-16T12:00:00.000Z');

function at(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * 60_000);
}

function tag(): string {
  return randomUUID().replaceAll('-', '');
}

async function roleId(tx: Tx, name: string): Promise<string> {
  const role = await tx.role.findUniqueOrThrow({ where: { name }, select: { id: true } });
  return role.id;
}

async function seedCompany(
  tx: Tx,
  fields: { readonly name?: string; readonly deleted?: boolean } = {},
): Promise<string> {
  const name = fields.name ?? `QC165 ${tag()}`;
  const company = await tx.company.create({
    data: {
      name,
      nameNormalized: normalizeCompanyName(name),
      deletedAt: fields.deleted === true ? NOW : null,
    },
    select: { id: true },
  });
  return company.id;
}

type SeedUser = {
  readonly role?: string;
  readonly accountStatus?: UserAccountStatus;
  readonly deleted?: boolean;
  readonly firstNames?: string;
  readonly lastNames?: string;
  readonly email?: string;
  readonly username?: string;
  readonly documentNumber?: string;
  readonly createdAt?: Date;
  readonly failedLoginAttempts?: number;
  readonly lockLevel?: number;
  readonly lockedUntil?: Date | null;
  readonly passwordHash?: string;
  readonly mustChangeCredential?: boolean;
  readonly sessionsValidFrom?: Date;
};

async function seedUser(tx: Tx, companyId: string | null, fields: SeedUser = {}): Promise<string> {
  const marca = tag();
  const user = await tx.user.create({
    data: {
      firstNames: fields.firstNames ?? 'Ana',
      lastNames: fields.lastNames ?? 'Admin',
      birthDate: new Date('1990-01-01T00:00:00.000Z'),
      email: fields.email ?? `qc165.${marca}@example.test`,
      phone: '3001112233',
      documentTypeCode: DOCUMENT_TYPE_CC,
      documentNumber: fields.documentNumber ?? marca.slice(0, 20),
      username: fields.username ?? `qc165.${marca}`,
      passwordHash: fields.passwordHash ?? NO_CREDENTIAL_SENTINEL,
      roleId: await roleId(tx, fields.role ?? ROLE_ADMINISTRADOR),
      companyId,
      accountStatus: fields.accountStatus ?? 'active',
      deletedAt: fields.deleted === true ? NOW : null,
      createdAt: fields.createdAt ?? NOW,
      failedLoginAttempts: fields.failedLoginAttempts ?? 0,
      lockLevel: fields.lockLevel ?? 0,
      lockedUntil: fields.lockedUntil ?? null,
      mustChangeCredential: fields.mustChangeCredential ?? false,
      sessionsValidFrom: fields.sessionsValidFrom ?? at(-600),
    },
    select: { id: true },
  });
  return user.id;
}

function createInput(companyId: string, overrides: Record<string, unknown> = {}) {
  const marca = tag();
  return {
    companyId,
    firstNames: 'Berta',
    lastNames: 'Nueva',
    birthDate: '1991-03-04',
    email: `qc165.alta.${marca}@example.test`,
    phone: '3009998877',
    documentTypeCode: DOCUMENT_TYPE_CC,
    documentNumber: marca.slice(0, 20),
    username: `qc165.alta.${marca}`,
    ...overrides,
  };
}

async function snapshot(tx: Tx, id: string) {
  return tx.user.findUniqueOrThrow({
    where: { id },
    select: {
      firstNames: true,
      lastNames: true,
      birthDate: true,
      email: true,
      phone: true,
      documentTypeCode: true,
      documentNumber: true,
      username: true,
      passwordHash: true,
      roleId: true,
      companyId: true,
      accountStatus: true,
      accountStatusChangedAt: true,
      accountStatusChangedBy: true,
      mustChangeCredential: true,
      failedLoginAttempts: true,
      lockLevel: true,
      lockedUntil: true,
      sessionsValidFrom: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
    },
  });
}

async function tokensOf(tx: Tx, userId: string) {
  return tx.credentialSetupToken.findMany({
    where: { userId },
    select: { tokenDigest: true, expiresAt: true, consumedAt: true, supersededAt: true },
    orderBy: { createdAt: 'asc' },
  });
}

function ids(rows: readonly AdministratorRow[]): string[] {
  return rows.map((row) => row.id);
}

function byCompany(...companyIds: string[]) {
  return { companyId: { kind: 'select' as const, values: companyIds } };
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

describe('Lista de Administradores', () => {
  it('R4: devuelve Administradores de varias empresas, 10 por defecto, acota a 25 y el total es el del conjunto filtrado', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await seedCompany(tx);
      const b = await seedCompany(tx);
      const enA: string[] = [];
      for (let index = 0; index < 20; index += 1) {
        enA.push(await seedUser(tx, a, { createdAt: at(index) }));
      }
      const enB: string[] = [];
      for (let index = 0; index < 7; index += 1) {
        enB.push(await seedUser(tx, b, { createdAt: at(100 + index) }));
      }
      const { list } = wire(tx);

      const porDefecto = await list(ACTOR, { filters: byCompany(a, b) });
      expect(porDefecto.items).toHaveLength(10);
      expect(porDefecto.pageSize).toBe(10);
      expect(porDefecto.total).toBe(27);
      expect(porDefecto.totalPages).toBe(3);

      const acotada = await list(ACTOR, { filters: byCompany(a, b), pageSize: 100 });
      expect(acotada.items).toHaveLength(25);
      expect(acotada.pageSize).toBe(25);
      expect(acotada.total).toBe(27);

      const segunda = await list(ACTOR, { filters: byCompany(a, b), pageSize: 25, page: 2 });
      expect(segunda.items).toHaveLength(2);
      expect(new Set([...ids(acotada.items), ...ids(segunda.items)])).toEqual(
        new Set([...enA, ...enB]),
      );
      const companias = new Set([...acotada.items, ...segunda.items].map((row) => row.company.id));
      expect(companias).toEqual(new Set([a, b]));

      const soloB = await list(ACTOR, { filters: byCompany(b) });
      expect(soloB.total).toBe(7);
    });
  });

  it('R4: una consulta sin la forma del contrato responde invalid_input', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { list } = wire(tx);
      expect(await codeOf(() => list(ACTOR, { page: 0 }))).toBe('invalid_input');
      expect(await codeOf(() => list(ACTOR, { filters: { companyId: { kind: 'otro' } } }))).toBe(
        'invalid_input',
      );
      expect(await codeOf(() => list(ACTOR, 'no es un objeto'))).toBe('invalid_input');
    });
  });

  it('R5: cada fila lleva exactamente sus claves, sin credencial, contadores ni marca de baja, y marca al ultimo Administrador', async () => {
    await inRolledBackTransaction(async (tx) => {
      const nombre = `QC165 Uno ${tag()}`;
      const unica = await seedCompany(tx, { name: nombre });
      const doble = await seedCompany(tx);
      const conBaja = await seedCompany(tx);
      const solo = await seedUser(tx, unica, { accountStatus: 'pending', failedLoginAttempts: 3 });
      const d1 = await seedUser(tx, doble);
      const d2 = await seedUser(tx, doble, { accountStatus: 'pending' });
      const vivo = await seedUser(tx, conBaja);
      await seedUser(tx, conBaja, { deleted: true });
      const { list } = wire(tx);

      const page = await list(ACTOR, { filters: byCompany(unica, doble, conBaja), pageSize: 25 });
      expect(page.total).toBe(4);
      for (const row of page.items) {
        expect(Object.keys(row).sort()).toEqual(
          [
            'accountStatus',
            'company',
            'createdAt',
            'email',
            'firstNames',
            'id',
            'isLastAdministrator',
            'lastNames',
            'username',
          ].sort(),
        );
        expect(Object.keys(row.company).sort()).toEqual(['id', 'name']);
      }
      const fila = (id: string) => page.items.find((row) => row.id === id);
      expect(fila(solo)).toMatchObject({
        company: { id: unica, name: nombre },
        accountStatus: 'pending',
        createdAt: NOW,
        isLastAdministrator: true,
      });
      expect(fila(d1)?.isLastAdministrator).toBe(false);
      expect(fila(d2)?.isLastAdministrator).toBe(false);
      // El de baja no cuenta: el que queda vivo es el ultimo.
      expect(fila(vivo)?.isLastAdministrator).toBe(true);
    });
  });

  it('R6: el filtro por empresa con una o varias empresas; un valor que no es uuid se descarta y si no queda ninguno el filtro se omite', async () => {
    await inRolledBackTransaction(async (tx) => {
      const marca = tag();
      const a = await seedCompany(tx);
      const b = await seedCompany(tx);
      const c = await seedCompany(tx);
      const enA = await seedUser(tx, a, { lastNames: `Filtro ${marca}` });
      const enB = await seedUser(tx, b, { lastNames: `Filtro ${marca}` });
      const enC = await seedUser(tx, c, { lastNames: `Filtro ${marca}` });
      const { list } = wire(tx);

      expect(ids((await list(ACTOR, { filters: byCompany(a) })).items)).toEqual([enA]);
      expect(new Set(ids((await list(ACTOR, { filters: byCompany(a, c) })).items))).toEqual(
        new Set([enA, enC]),
      );
      expect(
        ids((await list(ACTOR, { filters: byCompany('no-es-uuid', b) })).items),
      ).toEqual([enB]);

      const omitido = await list(ACTOR, { filters: byCompany('no-es-uuid'), search: marca });
      expect(new Set(ids(omitido.items))).toEqual(new Set([enA, enB, enC]));
      expect(omitido.total).toBe(3);
    });
  });

  it('R7: la busqueda encuentra por nombres, apellidos, correo y nombre de usuario, sin distinguir mayusculas', async () => {
    await inRolledBackTransaction(async (tx) => {
      const marca = tag();
      const empresa = await seedCompany(tx);
      const porNombre = await seedUser(tx, empresa, { firstNames: `Nom${marca}` });
      const porApellido = await seedUser(tx, empresa, { lastNames: `Ape${marca}` });
      const porCorreo = await seedUser(tx, empresa, { email: `cor${marca}@example.test` });
      const porUsuario = await seedUser(tx, empresa, { username: `usu${marca}` });
      await seedUser(tx, empresa);
      const { list } = wire(tx);

      const buscar = async (search: string) =>
        ids((await list(ACTOR, { filters: byCompany(empresa), search })).items);

      expect(await buscar(`NOM${marca.toUpperCase()}`)).toEqual([porNombre]);
      expect(await buscar(`ape${marca}`)).toEqual([porApellido]);
      expect(await buscar(`COR${marca.toUpperCase()}`)).toEqual([porCorreo]);
      expect(await buscar(`Usu${marca}`)).toEqual([porUsuario]);
      expect(new Set(await buscar(marca.toUpperCase()))).toEqual(
        new Set([porNombre, porApellido, porCorreo, porUsuario]),
      );
      const conTotal = await list(ACTOR, { filters: byCompany(empresa), search: marca });
      expect(conTotal.total).toBe(4);
    });
  });

  describe('R8: orden', () => {
    async function fixture(tx: Tx) {
      const marca = tag();
      const alfa = await seedCompany(tx, { name: `A QC165 ${marca}` });
      const beta = await seedCompany(tx, { name: `B QC165 ${marca}` });
      const uno = await seedUser(tx, beta, {
        firstNames: 'aaa',
        lastNames: 'ccc',
        username: `qc165.bbb.${marca}`,
        email: `qc165.ccc.${marca}@example.test`,
        accountStatus: 'active',
        createdAt: at(1),
      });
      const dos = await seedUser(tx, alfa, {
        firstNames: 'bbb',
        lastNames: 'aaa',
        username: `qc165.ccc.${marca}`,
        email: `qc165.aaa.${marca}@example.test`,
        accountStatus: 'pending',
        createdAt: at(3),
      });
      const tres = await seedUser(tx, beta, {
        firstNames: 'ccc',
        lastNames: 'bbb',
        username: `qc165.aaa.${marca}`,
        email: `qc165.bbb.${marca}@example.test`,
        accountStatus: 'blocked',
        createdAt: at(2),
      });
      return { companies: [alfa, beta], uno, dos, tres };
    }

    it.each([
      ['firstNames', ['uno', 'dos', 'tres']],
      ['lastNames', ['dos', 'tres', 'uno']],
      ['username', ['tres', 'uno', 'dos']],
      ['email', ['dos', 'tres', 'uno']],
      // El enum se ordena por su declaracion: active, pending, inactive, blocked.
      ['accountStatus', ['uno', 'dos', 'tres']],
      ['createdAt', ['uno', 'tres', 'dos']],
    ] as const)('R8: ordena por %s en las dos direcciones', async (columnId, asc) => {
      await inRolledBackTransaction(async (tx) => {
        const f = await fixture(tx);
        const { list } = wire(tx);
        const esperado = asc.map((name) => f[name]);

        const subida = await list(ACTOR, {
          filters: byCompany(...f.companies),
          sort: { columnId, direction: 'asc' },
        });
        expect(ids(subida.items)).toEqual(esperado);

        const bajada = await list(ACTOR, {
          filters: byCompany(...f.companies),
          sort: { columnId, direction: 'desc' },
        });
        expect(ids(bajada.items)).toEqual([...esperado].reverse());
      });
    });

    it('R8: ordena por el nombre de la empresa en las dos direcciones, desempatando por identificador', async () => {
      await inRolledBackTransaction(async (tx) => {
        const f = await fixture(tx);
        const { list } = wire(tx);
        const deBeta = [f.uno, f.tres].sort();

        const subida = await list(ACTOR, {
          filters: byCompany(...f.companies),
          sort: { columnId: 'companyName', direction: 'asc' },
        });
        expect(ids(subida.items)).toEqual([f.dos, ...deBeta]);

        const bajada = await list(ACTOR, {
          filters: byCompany(...f.companies),
          sort: { columnId: 'companyName', direction: 'desc' },
        });
        expect(ids(bajada.items)).toEqual([...deBeta, f.dos]);
      });
    });

    it('R8: sin orden pedido salen primero los mas recientes', async () => {
      await inRolledBackTransaction(async (tx) => {
        const f = await fixture(tx);
        const { list } = wire(tx);
        const page = await list(ACTOR, { filters: byCompany(...f.companies) });
        expect(ids(page.items)).toEqual([f.dos, f.tres, f.uno]);
      });
    });

    it('R8: con valores empatados desempata por identificador y ninguna fila sale en dos paginas ni en ninguna', async () => {
      await inRolledBackTransaction(async (tx) => {
        const empresa = await seedCompany(tx);
        const empatados: string[] = [];
        for (let index = 0; index < 5; index += 1) {
          empatados.push(await seedUser(tx, empresa, { lastNames: 'Igual', createdAt: NOW }));
        }
        const { list } = wire(tx);
        const ordenados = [...empatados].sort();

        for (const sort of [null, { columnId: 'lastNames', direction: 'asc' as const }]) {
          const vistos: string[] = [];
          for (let page = 1; page <= 3; page += 1) {
            const pagina = await list(ACTOR, { filters: byCompany(empresa), sort, page, pageSize: 2 });
            vistos.push(...ids(pagina.items));
          }
          expect(vistos).toEqual(ordenados);
        }
      });
    });

    it('R8: un campo de orden o de filtro no declarado se omite sin romper la consulta y se registra por su nombre', async () => {
      await inRolledBackTransaction(async (tx) => {
        const f = await fixture(tx);
        const { list, ignored } = wire(tx);
        const page = await list(ACTOR, {
          filters: { ...byCompany(...f.companies), passwordHash: { kind: 'text', value: 'secreto' } },
          sort: { columnId: 'failedLoginAttempts', direction: 'asc' },
        });
        expect(ids(page.items)).toEqual([f.dos, f.tres, f.uno]);
        const campos = ignored.flatMap((entry) => entry.fields);
        expect(campos).toEqual(expect.arrayContaining(['passwordHash', 'failedLoginAttempts']));
        expect(JSON.stringify(ignored)).not.toContain('secreto');
      });
    });
  });

  it('R9: no salen Operadores, Empacadores, el Maestro, Administradores de baja ni Administradores de empresas de baja', async () => {
    await inRolledBackTransaction(async (tx) => {
      const marca = tag();
      const viva = await seedCompany(tx);
      const deBaja = await seedCompany(tx, { deleted: true });
      const marcado = { lastNames: `Excluido ${marca}` };
      const admin = await seedUser(tx, viva, marcado);
      await seedUser(tx, viva, { ...marcado, role: ROLE_OPERADOR });
      await seedUser(tx, viva, { ...marcado, role: ROLE_EMPACADOR });
      await seedUser(tx, null, { ...marcado, role: ROLE_MAESTRO });
      await seedUser(tx, viva, { ...marcado, deleted: true });
      await seedUser(tx, deBaja, marcado);
      const { list } = wire(tx);

      const page = await list(ACTOR, { search: marca, pageSize: 25 });
      expect(ids(page.items)).toEqual([admin]);
      expect(page.total).toBe(1);

      const filtrada = await list(ACTOR, { filters: byCompany(viva, deBaja), pageSize: 25 });
      expect(ids(filtrada.items)).toEqual([admin]);
    });
  });
});

// ---------------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------------

describe('Ficha de un Administrador', () => {
  it('R10: devuelve exactamente sus claves con los ocho datos, empresa, estado y fechas, y si es el ultimo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const nombre = `QC165 Ficha ${tag()}`;
      const empresa = await seedCompany(tx, { name: nombre });
      const id = await seedUser(tx, empresa, {
        firstNames: 'Carla',
        lastNames: 'Ficha',
        accountStatus: 'pending',
        failedLoginAttempts: 2,
        passwordHash: '$2b$10$marcador.de.prueba.qc165.no.es.un.hash.real',
      });
      const { get } = wire(tx);
      const fila = await snapshot(tx, id);

      const ficha = await get(ACTOR, { id });
      expect(Object.keys(ficha).sort()).toEqual(
        [
          'accountStatus',
          'accountStatusChangedAt',
          'birthDate',
          'company',
          'createdAt',
          'documentNumber',
          'documentTypeCode',
          'email',
          'firstNames',
          'id',
          'isLastAdministrator',
          'lastNames',
          'phone',
          'updatedAt',
          'username',
        ].sort(),
      );
      expect(ficha).toEqual({
        id,
        firstNames: 'Carla',
        lastNames: 'Ficha',
        birthDate: fila.birthDate,
        email: fila.email,
        phone: fila.phone,
        documentTypeCode: DOCUMENT_TYPE_CC,
        documentNumber: fila.documentNumber,
        username: fila.username,
        company: { id: empresa, name: nombre },
        accountStatus: 'pending',
        accountStatusChangedAt: fila.accountStatusChangedAt,
        createdAt: fila.createdAt,
        updatedAt: fila.updatedAt,
        isLastAdministrator: true,
      });

      await seedUser(tx, empresa, { accountStatus: 'pending' });
      expect((await get(ACTOR, { id })).isLastAdministrator).toBe(false);
    });
  });

  it('R11: inexistente, no uuid, de baja, de otro rol, el Maestro o de empresa de baja responden todos user_not_found', async () => {
    await inRolledBackTransaction(async (tx) => {
      const viva = await seedCompany(tx);
      const deBaja = await seedCompany(tx, { deleted: true });
      const objetivos = [
        randomUUID(),
        'no-es-uuid',
        await seedUser(tx, viva, { deleted: true }),
        await seedUser(tx, viva, { role: ROLE_OPERADOR }),
        await seedUser(tx, viva, { role: ROLE_EMPACADOR }),
        await seedUser(tx, null, { role: ROLE_MAESTRO }),
        await seedUser(tx, deBaja),
      ];
      const { get } = wire(tx);
      for (const id of objetivos) {
        expect(await codeOf(() => get(ACTOR, { id }))).toBe('user_not_found');
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

describe('Alta de un Administrador', () => {
  it('R13: un alta con el roleId de Operador responde invalid_input, no escribe ninguna fila ni emite enlace ni correo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx);
      const operador = await roleId(tx, ROLE_OPERADOR);
      const { create, sent } = wire(tx);
      const input = createInput(empresa, { roleId: operador });

      expect(await codeOf(() => create(ACTOR, input))).toBe('invalid_input');
      expect(await tx.user.count({ where: { companyId: empresa } })).toBe(0);
      expect(await tx.user.count({ where: { username: input.username } })).toBe(0);
      expect(sent).toEqual([]);
    });
  });

  it('R13: contrasena, estado de cuenta, campo faltante, texto sobre el tope o empresa no uuid responden invalid_input sin escribir', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx);
      const { create, sent } = wire(tx);
      const sinUsuario: Record<string, unknown> = { ...createInput(empresa) };
      delete sinUsuario.username;
      const entradas: unknown[] = [
        createInput(empresa, { credential: 'Secreta#2026' }),
        createInput(empresa, { accountStatus: 'active' }),
        sinUsuario,
        createInput(empresa, { firstNames: 'x'.repeat(81) }),
        createInput('no-es-uuid'),
      ];
      for (const entrada of entradas) {
        expect(await codeOf(() => create(ACTOR, entrada))).toBe('invalid_input');
      }
      expect(await tx.user.count({ where: { companyId: empresa } })).toBe(0);
      expect(sent).toEqual([]);
    });
  });

  it('R14: el creado es Administrador, nace en pending, sin credencial con la que entrar, con cambio obligatorio y sin autor del estado', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx);
      const { create, sent } = wire(tx);
      const input = createInput(empresa);

      const { administratorId, mail } = await create(ACTOR, input);
      expect(mail).toBe('sent');

      const fila = await tx.user.findUniqueOrThrow({
        where: { id: administratorId },
        select: {
          companyId: true,
          role: { select: { name: true } },
          accountStatus: true,
          accountStatusChangedAt: true,
          accountStatusChangedBy: true,
          passwordHash: true,
          mustChangeCredential: true,
          firstNames: true,
          birthDate: true,
          email: true,
          username: true,
          deletedAt: true,
        },
      });
      expect(fila).toEqual({
        companyId: empresa,
        role: { name: ROLE_ADMINISTRADOR },
        accountStatus: 'pending',
        accountStatusChangedAt: NOW,
        accountStatusChangedBy: null,
        passwordHash: NO_CREDENTIAL_SENTINEL,
        mustChangeCredential: true,
        firstNames: 'Berta',
        birthDate: new Date('1991-03-04T00:00:00.000Z'),
        email: input.email,
        username: input.username,
        deletedAt: null,
      });
      // El enlace emitido es uno, vivo, y el correo fue al del creado.
      const tokens = await tokensOf(tx, administratorId);
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ consumedAt: null, supersededAt: null });
      expect(sent.map((entry) => entry.to)).toEqual([input.email]);
    });
  });

  it('R15: empresa inexistente o de baja responde company_not_found sin escribir, sin enlace y sin correo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const deBaja = await seedCompany(tx, { deleted: true });
      const { create, sent } = wire(tx);
      for (const companyId of [randomUUID(), deBaja]) {
        const input = createInput(companyId);
        expect(await codeOf(() => create(ACTOR, input))).toBe('company_not_found');
        expect(await tx.user.count({ where: { username: input.username } })).toBe(0);
      }
      expect(await tx.user.count({ where: { companyId: deBaja } })).toBe(0);
      expect(sent).toEqual([]);
    });
  });

  it('R16: correo o documento repetidos en la misma empresa y usuario repetido en cualquier empresa se rechazan sin escribir', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx);
      const otra = await seedCompany(tx);
      const marca = tag();
      await seedUser(tx, empresa, {
        role: ROLE_OPERADOR,
        email: `Repetido.${marca}@example.test`,
        documentNumber: `D${marca.slice(0, 15)}`,
      });
      await seedUser(tx, otra, { username: `qc165.repetido.${marca}` });
      const { create, sent } = wire(tx);
      const antes = await tx.user.count({ where: { companyId: { in: [empresa, otra] } } });

      expect(
        await codeOf(() =>
          create(ACTOR, createInput(empresa, { email: `repetido.${marca}@EXAMPLE.test` })),
        ),
      ).toBe('duplicate_email');
      expect(
        await codeOf(() =>
          create(ACTOR, createInput(empresa, { documentNumber: `D${marca.slice(0, 15)}` })),
        ),
      ).toBe('duplicate_document');
      expect(
        await codeOf(() =>
          create(ACTOR, createInput(empresa, { username: `QC165.repetido.${marca}` })),
        ),
      ).toBe('duplicate_username');

      expect(await tx.user.count({ where: { companyId: { in: [empresa, otra] } } })).toBe(antes);
      expect(sent).toEqual([]);
    });
  });

  it('R16: el mismo correo y el mismo documento en una empresa distinta se admiten', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx);
      const otra = await seedCompany(tx);
      const marca = tag();
      const email = `compartido.${marca}@example.test`;
      const documentNumber = `D${marca.slice(0, 15)}`;
      await seedUser(tx, otra, { email, documentNumber });
      const { create } = wire(tx);

      const { administratorId } = await create(ACTOR, createInput(empresa, { email, documentNumber }));
      const fila = await snapshot(tx, administratorId);
      expect(fila).toMatchObject({ companyId: empresa, email, documentNumber });
    });
  });
});

// ---------------------------------------------------------------------------
// Edicion
// ---------------------------------------------------------------------------

function editInput(id: string, overrides: Record<string, unknown> = {}) {
  const marca = tag();
  return {
    id,
    firstNames: 'Dora',
    lastNames: 'Editada',
    birthDate: '1985-12-31',
    email: `qc165.edit.${marca}@example.test`,
    phone: '3015554433',
    documentTypeCode: DOCUMENT_TYPE_CC,
    documentNumber: `E${marca.slice(0, 15)}`,
    username: `qc165.edit.${marca}`,
    ...overrides,
  };
}

describe('Edicion de un Administrador', () => {
  it('R18: reemplaza los ocho datos y no cambia empresa, rol, estado, credencial ni contadores de acceso', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx);
      const id = await seedUser(tx, empresa, {
        accountStatus: 'blocked',
        passwordHash: '$2b$10$marcador.de.prueba.qc165.no.es.un.hash.real',
        failedLoginAttempts: 4,
        lockLevel: 2,
        lockedUntil: at(30),
        mustChangeCredential: true,
      });
      const antes = await snapshot(tx, id);
      const { update } = wire(tx, () => at(5));
      const input = editInput(id, { firstNames: '  Dora  ' });

      await update(ACTOR, input);

      const despues = await snapshot(tx, id);
      expect(despues).toEqual({
        ...antes,
        firstNames: 'Dora',
        lastNames: 'Editada',
        birthDate: new Date('1985-12-31T00:00:00.000Z'),
        email: input.email,
        phone: '3015554433',
        documentTypeCode: DOCUMENT_TYPE_CC,
        documentNumber: input.documentNumber,
        username: input.username,
        updatedAt: at(5),
      });
    });
  });

  it('R20: un objetivo que no es un Administrador gestionable responde user_not_found sin escribir', async () => {
    await inRolledBackTransaction(async (tx) => {
      const viva = await seedCompany(tx);
      const deBaja = await seedCompany(tx, { deleted: true });
      await seedUser(tx, viva);
      const objetivos = [
        await seedUser(tx, viva, { deleted: true }),
        await seedUser(tx, viva, { role: ROLE_OPERADOR }),
        await seedUser(tx, viva, { role: ROLE_EMPACADOR }),
        await seedUser(tx, null, { role: ROLE_MAESTRO }),
        await seedUser(tx, deBaja),
      ];
      const { update } = wire(tx, () => at(5));
      for (const id of objetivos) {
        const antes = await snapshot(tx, id);
        expect(await codeOf(() => update(ACTOR, editInput(id)))).toBe('user_not_found');
        expect(await snapshot(tx, id)).toEqual(antes);
      }
      expect(await codeOf(() => update(ACTOR, editInput(randomUUID())))).toBe('user_not_found');
    });
  });

  it('R21: correo o documento de otro usuario vivo de su empresa, o usuario de cualquier otro, se rechazan sin escribir', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx);
      const otra = await seedCompany(tx);
      const marca = tag();
      const id = await seedUser(tx, empresa);
      await seedUser(tx, empresa, {
        role: ROLE_OPERADOR,
        email: `ocupado.${marca}@example.test`,
        documentNumber: `O${marca.slice(0, 15)}`,
      });
      await seedUser(tx, otra, { username: `qc165.ocupado.${marca}` });
      const antes = await snapshot(tx, id);
      const { update } = wire(tx, () => at(5));

      expect(
        await codeOf(() => update(ACTOR, editInput(id, { email: `OCUPADO.${marca}@example.test` }))),
      ).toBe('duplicate_email');
      expect(
        await codeOf(() => update(ACTOR, editInput(id, { documentNumber: `O${marca.slice(0, 15)}` }))),
      ).toBe('duplicate_document');
      expect(
        await codeOf(() => update(ACTOR, editInput(id, { username: `qc165.ocupado.${marca}` }))),
      ).toBe('duplicate_username');
      expect(await snapshot(tx, id)).toEqual(antes);
    });
  });

  it('R21: el correo y el documento de un usuario de otra empresa se admiten', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx);
      const otra = await seedCompany(tx);
      const marca = tag();
      const email = `ajeno.${marca}@example.test`;
      const documentNumber = `A${marca.slice(0, 15)}`;
      const id = await seedUser(tx, empresa);
      await seedUser(tx, otra, { email, documentNumber });
      const { update } = wire(tx, () => at(5));

      await update(ACTOR, editInput(id, { email, documentNumber }));
      expect(await snapshot(tx, id)).toMatchObject({ email, documentNumber, companyId: empresa });
    });
  });
});

// ---------------------------------------------------------------------------
// Baja
// ---------------------------------------------------------------------------

describe('Baja de un Administrador', () => {
  it('R22: marca la baja conservando la fila, sube el sello de sesiones y libera correo, usuario y documento', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx);
      const id = await seedUser(tx, empresa);
      await seedUser(tx, empresa);
      const antes = await snapshot(tx, id);
      const instante = new Date(at(7).getTime() + 456);
      const { remove, create, list } = wire(tx, () => instante);

      await remove(ACTOR, { id });

      const despues = await snapshot(tx, id);
      expect(despues).toEqual({
        ...antes,
        deletedAt: instante,
        updatedAt: instante,
        sessionsValidFrom: floorToSecond(instante),
      });
      expect(despues.sessionsValidFrom.getTime()).toBeGreaterThan(antes.sessionsValidFrom.getTime());
      expect(ids((await list(ACTOR, { filters: byCompany(empresa) })).items)).not.toContain(id);

      const reutiliza = await create(
        ACTOR,
        createInput(empresa, {
          email: antes.email,
          username: antes.username,
          documentNumber: antes.documentNumber,
        }),
      );
      expect(reutiliza.administratorId).not.toBe(id);
    });
  });

  it('R23: el unico Administrador vivo se rechaza con company_last_administrator sin escribir, aunque haya otro de baja', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx);
      const id = await seedUser(tx, empresa);
      await seedUser(tx, empresa, { deleted: true });
      await seedUser(tx, empresa, { role: ROLE_OPERADOR });
      const antes = await snapshot(tx, id);
      const { remove } = wire(tx, () => at(7));

      const code = await codeOf(() => remove(ACTOR, { id }));
      expect(code).toBe('company_last_administrator');
      expect(code).not.toBe('last_administrator');
      expect(await snapshot(tx, id)).toEqual(antes);
    });
  });

  it('R23: con otro Administrador vivo en pending, la baja se admite', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx);
      const id = await seedUser(tx, empresa, { accountStatus: 'active' });
      const pendiente = await seedUser(tx, empresa, { accountStatus: 'pending' });
      const { remove } = wire(tx, () => at(7));

      await remove(ACTOR, { id });
      expect((await snapshot(tx, id)).deletedAt).toEqual(at(7));
      expect((await snapshot(tx, pendiente)).deletedAt).toBeNull();
    });
  });

  it('R25: un objetivo que no es un Administrador gestionable responde user_not_found sin escribir', async () => {
    await inRolledBackTransaction(async (tx) => {
      const viva = await seedCompany(tx);
      const deBaja = await seedCompany(tx, { deleted: true });
      await seedUser(tx, viva);
      await seedUser(tx, deBaja);
      const objetivos = [
        await seedUser(tx, viva, { deleted: true }),
        await seedUser(tx, viva, { role: ROLE_OPERADOR }),
        await seedUser(tx, viva, { role: ROLE_EMPACADOR }),
        await seedUser(tx, null, { role: ROLE_MAESTRO }),
        await seedUser(tx, deBaja),
      ];
      const { remove } = wire(tx, () => at(7));
      for (const id of objetivos) {
        const antes = await snapshot(tx, id);
        expect(await codeOf(() => remove(ACTOR, { id }))).toBe('user_not_found');
        expect(await snapshot(tx, id)).toEqual(antes);
      }
      for (const id of [randomUUID(), 'no-es-uuid']) {
        expect(await codeOf(() => remove(ACTOR, { id }))).toBe('user_not_found');
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Reenvio del enlace
// ---------------------------------------------------------------------------

describe('Reenvio del enlace para fijar la contrasena', () => {
  it('R26: el adaptador del enlace escribe dentro de la transaccion del test, no en la base confirmada', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx);
      const id = await seedUser(tx, empresa, { accountStatus: 'pending' });
      const { resend } = wire(tx);

      await resend(ACTOR, { id });
      expect(await tx.credentialSetupToken.count({ where: { userId: id } })).toBe(1);
      expect(await prisma.credentialSetupToken.count({ where: { userId: id } })).toBe(0);
    });
  });

  it('R26: emite un enlace nuevo vivo con plazo desde el reenvio, sustituye el anterior y lo envia al correo guardado', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx);
      const alta = wire(tx, () => NOW);
      const input = createInput(empresa);
      const { administratorId } = await alta.create(ACTOR, input);
      const [anterior] = await tokensOf(tx, administratorId);
      expect(anterior?.expiresAt).toEqual(credentialSetupLinkExpiresAt(NOW));

      const reenvio = at(90);
      const maestro = wire(tx, () => reenvio);
      // El actor del Maestro no trae empresa.
      expect('companyId' in ACTOR).toBe(false);
      expect(await maestro.resend(ACTOR, { id: administratorId })).toEqual({ mail: 'sent' });

      const tokens = await tokensOf(tx, administratorId);
      expect(tokens).toHaveLength(2);
      const [viejo, nuevo] = tokens;
      expect(viejo).toMatchObject({ tokenDigest: anterior?.tokenDigest, supersededAt: reenvio, consumedAt: null });
      expect(nuevo).toMatchObject({
        supersededAt: null,
        consumedAt: null,
        expiresAt: credentialSetupLinkExpiresAt(reenvio),
      });
      expect(nuevo?.expiresAt.getTime()).toBeGreaterThan(anterior?.expiresAt.getTime() ?? 0);

      expect(maestro.sent).toHaveLength(1);
      const [correo] = maestro.sent;
      expect(correo?.to).toBe(input.email);
      expect(credentialSetupSecretCrypto.digestOf(correo?.secret ?? '')).toBe(nuevo?.tokenDigest);
    });
  });

  it('R26: sin enlace anterior emite uno vivo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx);
      const id = await seedUser(tx, empresa, { accountStatus: 'pending' });
      const { resend, sent } = wire(tx);

      expect(await resend(ACTOR, { id })).toEqual({ mail: 'sent' });
      const tokens = await tokensOf(tx, id);
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({
        supersededAt: null,
        consumedAt: null,
        expiresAt: credentialSetupLinkExpiresAt(NOW),
      });
      expect(sent).toHaveLength(1);
    });
  });

  it('R28: a un objetivo no gestionable responde user_not_found sin emitir enlace ni enviar correo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const viva = await seedCompany(tx);
      const deBaja = await seedCompany(tx, { deleted: true });
      const objetivos = [
        await seedUser(tx, viva, { role: ROLE_OPERADOR, accountStatus: 'pending' }),
        await seedUser(tx, viva, { role: ROLE_EMPACADOR, accountStatus: 'pending' }),
        await seedUser(tx, viva, { deleted: true, accountStatus: 'pending' }),
        await seedUser(tx, null, { role: ROLE_MAESTRO, accountStatus: 'pending' }),
        await seedUser(tx, deBaja, { accountStatus: 'pending' }),
      ];
      const { resend, sent } = wire(tx);
      for (const id of objetivos) {
        expect(await codeOf(() => resend(ACTOR, { id }))).toBe('user_not_found');
        expect(await tx.credentialSetupToken.count({ where: { userId: id } })).toBe(0);
      }
      expect(await codeOf(() => resend(ACTOR, { id: randomUUID() }))).toBe('user_not_found');
      expect(sent).toEqual([]);
    });
  });

  it('R28: a un Administrador gestionable que ya no esta en pending responde user_not_pending sin emitir enlace ni enviar correo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx);
      const { resend, sent } = wire(tx);
      for (const accountStatus of ['active', 'inactive', 'blocked'] as const) {
        const id = await seedUser(tx, empresa, { accountStatus });
        expect(await codeOf(() => resend(ACTOR, { id }))).toBe('user_not_pending');
        expect(await tx.credentialSetupToken.count({ where: { userId: id } })).toBe(0);
      }
      expect(sent).toEqual([]);
    });
  });

  it('R28: el rechazo no toca el enlace vivo que ya tenia', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx);
      const { create, resend } = wire(tx);
      const { administratorId } = await create(ACTOR, createInput(empresa));
      const antes = await tokensOf(tx, administratorId);
      await tx.user.update({ where: { id: administratorId }, data: { accountStatus: 'active' } });

      expect(await codeOf(() => resend(ACTOR, { id: administratorId }))).toBe('user_not_pending');
      expect(await tokensOf(tx, administratorId)).toEqual(antes);
    });
  });
});
