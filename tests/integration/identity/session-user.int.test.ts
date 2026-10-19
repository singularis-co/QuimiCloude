/**
 * T6 — Integracion de `findActiveSessionUserById` contra Postgres real (`design.md > 4.2`,
 * `design.md > 7` nivel 3).
 *
 * QUE SE EJERCITA AQUI Y NO EN LOS UNITARIOS: el adaptador Prisma de verdad —hoy un unico
 * `$queryRaw` por clave primaria, con `u.deleted_at IS NULL` en el `WHERE` y el `SELECT` minimo
 * con el `JOIN` a `roles`—. Mismo patron que `login.int.test.ts`: fixture propio con prefijo y `uuid`,
 * limpieza en `afterAll` dentro de `try`/`finally`, sin seed (R21 de QC-7).
 *
 * QC-47 (T17, T19) — `users.company_id` es obligatoria, asi que este fixture crea tambien su
 * PROPIA empresa efimera (`qc8-session-<uuid>`) en el `beforeAll` y mete al usuario dentro;
 * nunca la de instalacion, porque `companies_name_unique` es global. El `afterAll` barre en
 * orden `users -> companies` (`users_company_id_fkey` es `ON DELETE RESTRICT`).
 *
 * QC-48 (T6, R13) — el mismo `select` trae ahora `companyId` y `company.deletedAt`. Se afirma
 * aqui, contra Postgres, que los dos campos salen de verdad y que salen en UNA SOLA llamada a
 * `findFirst`: la condicion de `design.md > 4.1` era «cero consultas nuevas por peticion», no
 * «un JOIN mas y ya veremos».
 *
 * QC-74 (T8, R7, R11) — el mismo `select` trae ademas los permisos del rol, por la relacion
 * `Role.permissions`. Se afirma aqui, contra Postgres, que salen de verdad y que salen en UNA
 * SOLA llamada a `findFirst`: la condicion de `design.md > 4` era «ni una consulta adicional por
 * peticion». El fixture crea su PROPIO catalogo efimero (`qc74-<uuid>`) y no toca el catalogo
 * real: `permissions.code` es clave primaria global, igual que `companies_name_unique`.
 *
 * QC-23 (T9, R11, R14) — el mismo `select` trae ahora el sello `sessions_valid_from` y, por la
 * relacion `User.revokedSessions` acotada al `sid` de la sesion en curso, el `revoked_at` de la
 * fila del registro de sesiones cerradas. Se afirma aqui, contra Postgres, que los dos salen de
 * verdad y que siguen saliendo en UNA SOLA llamada a `findFirst`: la condicion de R14 era «ni una
 * invocacion nueva del puerto por peticion». El `sid` del caso corriente es uno que nadie cerro.
 *
 * UNA SOLA SENTENCIA SQL — el adaptador paso de un `findFirst` con relaciones anidadas (que,
 * medido con el log de Prisma, eran CINCO sentencias en serie: `users`, `roles`,
 * `role_permissions`, `companies`, `revoked_sessions`) a un unico `$queryRaw` con `JOIN`s. Los
 * contadores de invocaciones de `findFirst` de las fichas anteriores contaban LLAMADAS a Prisma,
 * no idas a la base, y por eso no veian las cinco. Ahora se cuenta lo que importa: las sentencias
 * que el motor emite, con un cliente propio con `log: query` (`clienteConLog`) al que se ata una
 * copia del adaptador de produccion (`vi.doMock` + import dinamico, mismo patron que
 * `credential-setup.int.test.ts`). No se copia ni una linea de SQL: el codigo que corre es el de
 * produccion. Los datos los escribe el cliente global y se confirman, asi que la segunda conexion
 * los ve.
 *
 * EL ROL NO SE MUEVE (R13, R14): sigue saliendo de `users.role_id`, en el mismo `select` y sin
 * ninguna consulta adicional. El caso «el rol cambiado entre dos lecturas devuelve el nuevo»
 * ya lo demuestra, y esta ficha lo deja intacto a proposito.
 */
import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { findActiveSessionUserById } from '@/lib/modules/identity/adapters/driven/persistence/session-user-prisma';
import {
  ADDONS,
  CORE_PERMISSIONS,
  DOCUMENT_TYPE_CC,
  normalizeCompanyName,
  ROLE_ACONDICIONAMIENTO,
  ROLE_ADMINISTRADOR,
  ROLE_EMPACADOR,
  ROLE_MAESTRO,
  ROLE_OPERADOR,
  SEED_ROLE_PERMISSIONS,
} from '@/lib/modules/identity';
import { createResolveSession } from '@/lib/modules/identity/domain/resolve-session';
import { prisma } from '@/lib/shared/db/prisma';

const sufijo = randomUUID();
const nombreDeUsuario = `qc8_session_${sufijo}`;
/** QC-47: nombre irrepetible de la empresa efimera de este fixture. */
const nombreDeEmpresa = `qc8-session-${sufijo}`;

let usuarioId = '';
let rolId = '';
let rolAlternativoId = '';
let empresaId = '';
/** QC-74: catalogo efimero de este fixture. `module` es irrepetible por el `@@unique`. */
const moduloDePrueba = `qc74-${sufijo}`;
/** QC-23 T9: el `sid` de la sesion en curso del caso corriente. Nadie lo cerro, asi que el
 *  registro de sesiones cerradas no tiene fila para el y `sessionRevokedAt` sale `null`. */
const SID_SIN_CERRAR = randomUUID();
const CODIGO_CONSULTAR = `${moduloDePrueba}.consultar`;
const CODIGO_MODIFICAR = `${moduloDePrueba}.modificar`;

const ADAPTER_PATH = '@/lib/modules/identity/adapters/driven/persistence/session-user-prisma';

type LecturaDeSesion = typeof findActiveSessionUserById;

/**
 * Cliente propio que emite un evento por cada sentencia SQL que manda el motor. Es el contador de
 * «una sola ida a la base»: cuenta sentencias, no llamadas a Prisma.
 */
const clienteConLog = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
let sentenciasEmitidas: string[] = [];
clienteConLog.$on('query', (evento) => {
  sentenciasEmitidas.push(evento.query);
});
let adaptadorConLog: LecturaDeSesion = async () => {
  throw new Error('el adaptador atado a `clienteConLog` no se cargo en el beforeAll');
};

/** El adaptador de produccion atado a `clienteConLog`, no al cliente global. */
async function atarAdaptadorAlClienteConLog(): Promise<LecturaDeSesion> {
  vi.resetModules();
  vi.doMock('@/lib/shared/db/prisma', () => ({ prisma: clienteConLog }));
  try {
    const atado = await import('@/lib/shared/db/prisma');
    if (atado.prisma !== clienteConLog) {
      throw new Error('el doble de `@/lib/shared/db/prisma` no quedo en vigor');
    }
    const modulo = (await import(ADAPTER_PATH)) as { findActiveSessionUserById: LecturaDeSesion };
    return modulo.findActiveSessionUserById;
  } finally {
    vi.doUnmock('@/lib/shared/db/prisma');
  }
}

/**
 * Corre el adaptador real y devuelve su resultado junto con las sentencias SQL que emitio. El
 * `SELECT 1` previo deja la conexion abierta, para que nada de su arranque entre en la cuenta.
 */
async function medir(
  id: string,
  sid: string,
): Promise<{ resultado: Awaited<ReturnType<LecturaDeSesion>>; sentencias: string[] }> {
  await clienteConLog.$queryRaw`SELECT 1`;
  sentenciasEmitidas = [];
  const resultado = await adaptadorConLog(id, sid);
  const sentencias = [...sentenciasEmitidas];
  sentenciasEmitidas = [];
  return { resultado, sentencias };
}

beforeAll(async () => {
  adaptadorConLog = await atarAdaptadorAlClienteConLog();

  const rol = await prisma.role.create({
    data: { name: `qc8-session-${sufijo}`, description: 'Rol de prueba de QC-8' },
    select: { id: true },
  });
  rolId = rol.id;

  const rolAlternativo = await prisma.role.create({
    data: { name: `qc8-session-alt-${sufijo}`, description: 'Rol alternativo de prueba de QC-8' },
    select: { id: true },
  });
  rolAlternativoId = rolAlternativo.id;

  // QC-47: empresa PROPIA del fixture, nunca la de instalacion.
  const empresa = await prisma.company.create({
    // Con todos los añadidos, como toda empresa que ya existía al llegar los interruptores: así
    // los permisos de la sesión siguen siendo los del rol, que es lo que miden los casos de abajo.
    // Las excepciones caen con la empresa por `ON DELETE CASCADE`: el `afterAll` no las conoce.
    data: {
      name: nombreDeEmpresa,
      nameNormalized: normalizeCompanyName(nombreDeEmpresa),
      addonOverrides: { create: ADDONS.map((addonKey) => ({ addonKey, enabled: true })) },
    },
    select: { id: true },
  });
  empresaId = empresa.id;

  const usuario = await prisma.user.create({
    data: {
      firstNames: 'Ana Maria',
      lastNames: 'Perez Gomez',
      birthDate: new Date('1990-05-17T00:00:00.000Z'),
      email: `qc8.session.${sufijo}@example.test`,
      phone: '+57 300 111 2233',
      documentTypeCode: DOCUMENT_TYPE_CC,
      documentNumber: sufijo.replaceAll('-', '').slice(0, 20),
      username: nombreDeUsuario,
      passwordHash: 'no-se-usa-en-este-test',
      roleId: rolId,
      companyId: empresaId,
      // QC-78 (T12): el estado se escribe EXPLICITO y no se deja al `@default(pending)` de la
      // columna. Este fixture representa la cuenta corriente que si tiene sesion, y dejarla
      // `pending` haria que los casos heredados dependieran de un valor que nadie eligio.
      accountStatus: 'active',
    },
    select: { id: true },
  });
  usuarioId = usuario.id;

  // QC-74 T8: dos permisos propios del fixture, asignados SOLO al rol principal. El rol
  // alternativo se queda sin ninguno a proposito: es el caso «rol sin asignaciones» -> `[]`.
  await prisma.permission.createMany({
    data: [
      {
        code: CODIGO_CONSULTAR,
        module: moduloDePrueba,
        action: 'consultar',
        description: 'Permiso de prueba de QC-74',
      },
      {
        code: CODIGO_MODIFICAR,
        module: moduloDePrueba,
        action: 'modificar',
        description: 'Permiso de prueba de QC-74',
      },
    ],
  });
  await prisma.rolePermission.createMany({
    data: [
      { roleId: rolId, permissionCode: CODIGO_CONSULTAR },
      { roleId: rolId, permissionCode: CODIGO_MODIFICAR },
    ],
  });
}, 30_000);

afterAll(async () => {
  try {
    await prisma.user.deleteMany({ where: { id: usuarioId } });
  } finally {
    // QC-74: primero las asignaciones y luego el catalogo; las dos FKs son `ON DELETE RESTRICT`,
    // asi que borrar el rol antes que su `role_permissions` reventaria.
    await prisma.rolePermission.deleteMany({
      where: { permissionCode: { in: [CODIGO_CONSULTAR, CODIGO_MODIFICAR] } },
    });
    await prisma.permission.deleteMany({
      where: { code: { in: [CODIGO_CONSULTAR, CODIGO_MODIFICAR] } },
    });
    // QC-47: el orden es `users -> companies`; la FK hacia la empresa es `ON DELETE RESTRICT`.
    await prisma.role.deleteMany({ where: { id: { in: [rolId, rolAlternativoId] } } });
    await prisma.company.deleteMany({ where: { id: empresaId } });
    await clienteConLog.$disconnect();
    await prisma.$disconnect();
  }
});

// Reescribe las excepciones de la empresa del fixture: `on` prendidas y `off` apagadas.
async function fijarAnadidos(on: readonly string[], off: readonly string[] = []): Promise<void> {
  await prisma.$transaction([
    prisma.companyAddonOverride.deleteMany({ where: { companyId: empresaId } }),
    prisma.companyAddonOverride.createMany({
      data: [
        ...on.map((addonKey) => ({ companyId: empresaId, addonKey, enabled: true })),
        ...off.map((addonKey) => ({ companyId: empresaId, addonKey, enabled: false })),
      ],
    }),
  ]);
}

describe('findActiveSessionUserById contra Postgres real', () => {
  it('un usuario activo devuelve nombres, username y el rol actual', async () => {
    // R10 — consulta por sub (id de la fila real).
    const resultado = await findActiveSessionUserById(usuarioId, SID_SIN_CERRAR);

    expect(resultado).toEqual({
      id: usuarioId,
      username: nombreDeUsuario,
      firstNames: 'Ana Maria',
      lastNames: 'Perez Gomez',
      roleName: `qc8-session-${sufijo}`,
      // QC-48 R13: la empresa de la ficha y su estado, en la misma fila.
      companyId: empresaId,
      companyDeletedAt: null,
      // Sin `orderBy`, como los permisos: el orden lo decide Postgres y el `toHaveLength` de abajo
      // cierra la puerta a que sobre alguno.
      companyAddons: expect.arrayContaining([...ADDONS]),
      // QC-74 R7: los permisos del rol, en la misma fila. `arrayContaining` porque la consulta
      // no lleva `orderBy` —el adaptador no ordena a proposito— y el orden de `role_permissions`
      // lo decide Postgres; el `toHaveLength` de abajo cierra la puerta a que sobre alguno.
      permissions: expect.arrayContaining([CODIGO_CONSULTAR, CODIGO_MODIFICAR]),
      // QC-78 R20: el estado de cuenta y el plazo de bloqueo, en la misma fila.
      accountStatus: 'active',
      lockedUntil: null,
      // QC-23 R7, R11: el sello —que toda fila tiene, por el `DEFAULT now()` de la migracion— y
      // el instante de cierre de ESTA sesion, que nadie cerro.
      sessionsValidFrom: expect.any(Date),
      sessionRevokedAt: null,
    });
    expect(resultado?.permissions).toHaveLength(2);
    expect(resultado?.companyAddons).toHaveLength(ADDONS.length);
  });

  // QC-74 R7 — los permisos salen de la ASIGNACION, no del nombre del rol: el rol alternativo
  // existe, tiene nombre, y no tiene ninguna fila en `role_permissions`.
  it('un rol sin asignaciones devuelve permissions vacio', async () => {
    await prisma.user.update({ where: { id: usuarioId }, data: { roleId: rolAlternativoId } });

    try {
      const resultado = await findActiveSessionUserById(usuarioId, SID_SIN_CERRAR);

      expect(resultado?.roleName).toBe(`qc8-session-alt-${sufijo}`);
      expect(resultado?.permissions).toEqual([]);
    } finally {
      await prisma.user.update({ where: { id: usuarioId }, data: { roleId: rolId } });
    }
  });

  // QC-74 R11 — la condicion dura de `design.md > 4`: los permisos salen de la MISMA ida a la
  // base. Se cuentan sentencias SQL emitidas, no llamadas a Prisma: si alguien resolviera los
  // permisos aparte —por la API tipada o por otro raw— la cuenta pasaria de 1.
  it('trae los permisos del rol sin una segunda consulta', async () => {
    const { resultado, sentencias } = await medir(usuarioId, SID_SIN_CERRAR);

    expect(resultado?.permissions).toHaveLength(2);
    expect(sentencias).toHaveLength(1);
  });

  it('un usuario con deleted_at con valor devuelve null', async () => {
    // R11 — dado de baja aunque el id sea correcto.
    await prisma.user.update({ where: { id: usuarioId }, data: { deletedAt: new Date() } });

    try {
      expect(await findActiveSessionUserById(usuarioId, SID_SIN_CERRAR)).toBeNull();
    } finally {
      await prisma.user.update({ where: { id: usuarioId }, data: { deletedAt: null } });
    }
  });

  it('un id inexistente devuelve null', async () => {
    // R11 — sin fila, sin excepcion.
    expect(await findActiveSessionUserById(randomUUID(), SID_SIN_CERRAR)).toBeNull();
  });

  it('el rol cambiado entre dos lecturas devuelve el nuevo', async () => {
    // R12 — el rol es siempre el actual, nunca el que tenia al iniciar sesion.
    const primeraLectura = await findActiveSessionUserById(usuarioId, SID_SIN_CERRAR);
    expect(primeraLectura?.roleName).toBe(`qc8-session-${sufijo}`);

    await prisma.user.update({ where: { id: usuarioId }, data: { roleId: rolAlternativoId } });

    try {
      const segundaLectura = await findActiveSessionUserById(usuarioId, SID_SIN_CERRAR);
      expect(segundaLectura?.roleName).toBe(`qc8-session-alt-${sufijo}`);
    } finally {
      await prisma.user.update({ where: { id: usuarioId }, data: { roleId: rolId } });
    }
  });

  // QC-48 R13 — la empresa dada de baja SI devuelve fila, con su marca de tiempo: el corte es
  // del dominio (`resolve-session.ts`), no de este adaptador.
  it('un usuario de una empresa dada de baja devuelve companyDeletedAt no nulo', async () => {
    const bajada = new Date();
    await prisma.company.update({ where: { id: empresaId }, data: { deletedAt: bajada } });

    try {
      const resultado = await findActiveSessionUserById(usuarioId, SID_SIN_CERRAR);

      expect(resultado?.companyId).toBe(empresaId);
      expect(resultado?.companyDeletedAt).toEqual(bajada);
    } finally {
      await prisma.company.update({ where: { id: empresaId }, data: { deletedAt: null } });
    }
  });

  // QC-78 (T12, R20, R21) — el estado de cuenta y el plazo salen de la FILA REAL, crudos, y salen
  // en la MISMA unica consulta: las dos son columnas de `users`, asi que ni un `JOIN` mas ni una
  // segunda ida a la base. La fila se pone `blocked` con plazo a proposito: el adaptador la
  // devuelve igualmente —no filtra por estado, el corte es del dominio— y devuelve los dos valores
  // tal y como estan escritos, sin traducir nada.
  it('trae accountStatus y lockedUntil de la fila real en la misma unica consulta', async () => {
    const plazo = new Date('2026-09-01T10:30:00.000Z');
    await prisma.user.update({
      where: { id: usuarioId },
      data: { accountStatus: 'blocked', lockedUntil: plazo },
    });

    try {
      const { resultado, sentencias } = await medir(usuarioId, SID_SIN_CERRAR);

      expect(resultado?.accountStatus).toBe('blocked');
      expect(resultado?.lockedUntil).toEqual(plazo);
      expect(sentencias).toHaveLength(1);
    } finally {
      await prisma.user.update({
        where: { id: usuarioId },
        data: { accountStatus: 'active', lockedUntil: null },
      });
    }
  });

  // QC-23 (T9, R11, R14) — el caso que importa: ESTA sesion esta en el registro de cerradas, asi
  // que `sessionRevokedAt` sale con su instante; y sale en la MISMA unica consulta, por
  // `revoked_sessions_session_id_key`. La fila se devuelve igualmente —el adaptador no filtra por
  // revocacion, el corte 8 es del dominio— igual que no filtra por empresa muerta ni por estado.
  it('trae sessionRevokedAt de la fila del registro en la misma unica consulta', async () => {
    const sidCerrado = randomUUID();
    const cerradaEn = new Date('2026-09-01T09:00:00.000Z');
    await prisma.revokedSession.create({
      data: {
        sessionId: sidCerrado,
        userId: usuarioId,
        // Caducidad NATURAL en el futuro: una fila ya caducada seria carne de la purga de R39.
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        revokedAt: cerradaEn,
      },
    });

    try {
      const cerrada = await medir(usuarioId, sidCerrado);
      const otra = await medir(usuarioId, SID_SIN_CERRAR);

      expect(cerrada.resultado?.sessionRevokedAt).toEqual(cerradaEn);
      // R20: cerrar UNA sesion no toca las demas de la misma persona.
      expect(otra.resultado?.sessionRevokedAt).toBeNull();
      expect(cerrada.sentencias).toHaveLength(1);
      expect(otra.sentencias).toHaveLength(1);
    } finally {
      await prisma.revokedSession.deleteMany({ where: { sessionId: sidCerrado } });
    }
  });

  // QC-48 R13 — la condicion dura de `design.md > 4.1`: empresa y estado salen de la MISMA ida
  // a la base. Si alguien anadiera una segunda sentencia, este contador lo delata.
  it('trae empresa y estado sin una segunda consulta', async () => {
    const { resultado, sentencias } = await medir(usuarioId, SID_SIN_CERRAR);

    expect(resultado?.companyId).toBe(empresaId);
    expect(resultado?.companyDeletedAt).toBeNull();
    expect(sentencias).toHaveLength(1);
  });

  // UNA SOLA SENTENCIA en cada forma de la fila, y el MISMO dato que lee el cliente global:
  // empresa viva, sesion abierta, sesion cerrada, empresa de baja, rol sin permisos, usuario de
  // baja e id inexistente. El caso sin empresa vive en el bloque del Maestro, mas abajo.
  it('emite exactamente una sentencia SQL en cada forma de la fila y devuelve el mismo dato', async () => {
    const sidCerrado = randomUUID();
    const cerradaEn = new Date('2026-09-02T08:00:00.000Z');
    const bajada = new Date('2026-09-03T08:00:00.000Z');

    async function comprobar(caso: string, id: string, sid: string) {
      const { resultado, sentencias } = await medir(id, sid);
      expect(sentencias, caso).toHaveLength(1);
      expect(sentencias[0], caso).toMatch(/\bFROM users u\b/);
      // Mismo dato por las dos conexiones: la medida no cambia lo que se lee.
      expect(resultado, caso).toEqual(await findActiveSessionUserById(id, sid));
      return resultado;
    }

    await prisma.revokedSession.create({
      data: {
        sessionId: sidCerrado,
        userId: usuarioId,
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        revokedAt: cerradaEn,
      },
    });

    try {
      expect(await comprobar('empresa viva, sesion abierta', usuarioId, SID_SIN_CERRAR)).toMatchObject({
        companyId: empresaId,
        companyDeletedAt: null,
        sessionRevokedAt: null,
      });

      expect((await comprobar('sesion cerrada', usuarioId, sidCerrado))?.sessionRevokedAt).toEqual(
        cerradaEn,
      );

      await prisma.company.update({ where: { id: empresaId }, data: { deletedAt: bajada } });
      try {
        expect(
          (await comprobar('empresa de baja', usuarioId, SID_SIN_CERRAR))?.companyDeletedAt,
        ).toEqual(bajada);
      } finally {
        await prisma.company.update({ where: { id: empresaId }, data: { deletedAt: null } });
      }

      await prisma.user.update({ where: { id: usuarioId }, data: { roleId: rolAlternativoId } });
      try {
        expect((await comprobar('rol sin permisos', usuarioId, SID_SIN_CERRAR))?.permissions).toEqual(
          [],
        );
      } finally {
        await prisma.user.update({ where: { id: usuarioId }, data: { roleId: rolId } });
      }

      await prisma.user.update({ where: { id: usuarioId }, data: { deletedAt: new Date() } });
      try {
        expect(await comprobar('usuario de baja', usuarioId, SID_SIN_CERRAR)).toBeNull();
      } finally {
        await prisma.user.update({ where: { id: usuarioId }, data: { deletedAt: null } });
      }

      expect(await comprobar('id inexistente', randomUUID(), SID_SIN_CERRAR)).toBeNull();
    } finally {
      await prisma.revokedSession.deleteMany({ where: { sessionId: sidCerrado } });
    }
  });

  it('QC-277 R8, R9: trae solo las excepciones prendidas de la empresa, en la misma llamada al lector', async () => {
    await fijarAnadidos(['lectura_pdf', 'dashboard'], ['proveedores']);

    try {
      // Una sola invocacion del lector real, medida por el cliente con log.
      const { resultado, sentencias } = await medir(usuarioId, SID_SIN_CERRAR);

      // La excepcion apagada no sale; el orden no lo fija el adaptador.
      expect([...(resultado?.companyAddons ?? [])].sort()).toEqual(['dashboard', 'lectura_pdf']);
      // Los añadidos salen de la MISMA sentencia que el usuario: ni una consulta aparte a
      // `companies` ni a `company_addon_overrides`.
      expect(sentencias).toHaveLength(1);
      expect(sentencias[0]).toMatch(/\bFROM users u\b/);
      expect(sentencias[0]).toMatch(/\bcompany_addon_overrides\b/);
      // Mismo dato por el cliente global: la medida no cambia lo que se lee.
      expect(resultado).toEqual(await findActiveSessionUserById(usuarioId, SID_SIN_CERRAR));
    } finally {
      await fijarAnadidos([...ADDONS]);
    }
  });

  it('QC-277 R9: con todas las excepciones apagadas la empresa no trae ningun añadido', async () => {
    await fijarAnadidos([], [...ADDONS]);
    try {
      const resultado = await findActiveSessionUserById(usuarioId, SID_SIN_CERRAR);

      expect(resultado?.companyAddons).toEqual([]);
    } finally {
      await fijarAnadidos([...ADDONS]);
    }
  });

  // Dos empresas en la misma base: los añadidos de cada usuario salen SOLO de las excepciones de su
  // empresa. La segunda empresa y su usuario son propios del caso y se borran en `finally`, en
  // orden `users -> companies`; sus excepciones caen con la empresa por `ON DELETE CASCADE`.
  it('QC-277 R8: con dos empresas, cada usuario trae solo los añadidos prendidos de la suya', async () => {
    const marca = randomUUID();
    const nombreEmpresaB = `qc277-session-b-${marca}`;
    const { id: empresaBId } = await prisma.company.create({
      data: { name: nombreEmpresaB, nameNormalized: normalizeCompanyName(nombreEmpresaB) },
      select: { id: true },
    });
    let usuarioBId = '';

    async function fijarAnadidosDeB(on: readonly string[], off: readonly string[] = []) {
      await prisma.$transaction([
        prisma.companyAddonOverride.deleteMany({ where: { companyId: empresaBId } }),
        prisma.companyAddonOverride.createMany({
          data: [
            ...on.map((addonKey) => ({ companyId: empresaBId, addonKey, enabled: true })),
            ...off.map((addonKey) => ({ companyId: empresaBId, addonKey, enabled: false })),
          ],
        }),
      ]);
    }

    async function anadidosDe(id: string): Promise<string[]> {
      const resultado = await findActiveSessionUserById(id, SID_SIN_CERRAR);
      return [...(resultado?.companyAddons ?? [])].sort();
    }

    try {
      ({ id: usuarioBId } = await prisma.user.create({
        data: {
          firstNames: 'Empresa',
          lastNames: 'Segunda',
          birthDate: new Date('1990-01-01T00:00:00.000Z'),
          email: `qc277.session.${marca}@example.test`,
          phone: '+57 300 000 0000',
          documentTypeCode: DOCUMENT_TYPE_CC,
          documentNumber: `67${marca.replaceAll('-', '').slice(0, 18)}`,
          username: `qc277_session_${marca}`,
          passwordHash: 'no-se-usa-en-este-test',
          roleId: rolId,
          companyId: empresaBId,
          accountStatus: 'active',
        },
        select: { id: true },
      }));

      // A con uno solo prendido y el resto apagado; B con los cinco prendidos.
      await fijarAnadidos(
        ['lectura_pdf'],
        ADDONS.filter((addon) => addon !== 'lectura_pdf'),
      );
      await fijarAnadidosDeB([...ADDONS]);

      expect(await anadidosDe(usuarioId)).toEqual(['lectura_pdf']);
      expect(await anadidosDe(usuarioBId)).toEqual([...ADDONS].sort());

      // Al reves: B sin ningun añadido (todas sus excepciones apagadas) y A con dos prendidos.
      await fijarAnadidos(['dashboard', 'proveedores']);
      await fijarAnadidosDeB([], [...ADDONS]);

      expect(await anadidosDe(usuarioId)).toEqual(['dashboard', 'proveedores']);
      expect(await anadidosDe(usuarioBId)).toEqual([]);

      // Cada ficha sigue apuntando a su propia empresa.
      expect((await findActiveSessionUserById(usuarioId, SID_SIN_CERRAR))?.companyId).toBe(empresaId);
      expect((await findActiveSessionUserById(usuarioBId, SID_SIN_CERRAR))?.companyId).toBe(
        empresaBId,
      );
    } finally {
      try {
        if (usuarioBId) await prisma.user.deleteMany({ where: { id: usuarioBId } });
      } finally {
        await prisma.company.deleteMany({ where: { id: empresaBId } });
        await fijarAnadidos([...ADDONS]);
      }
    }
  });
});

// La ficha de quien no tiene empresa (el Maestro). Fixture propio, creado y borrado en el
// propio caso: nunca el Maestro del seed. Se confirma y se limpia en `finally` porque el adaptador
// lee con el cliente global, igual que el resto de este archivo.
describe('findActiveSessionUserById sin empresa (QC-161)', () => {
  async function crearMaestro(): Promise<{ id: string; username: string }> {
    const marca = randomUUID();
    const { id: rolMaestroId } = await prisma.role.findUniqueOrThrow({
      where: { name: ROLE_MAESTRO },
      select: { id: true },
    });
    const username = `qc161_session_${marca}`;
    const { id } = await prisma.user.create({
      data: {
        firstNames: 'Plataforma',
        lastNames: 'Inicial',
        birthDate: new Date('1990-01-01T00:00:00.000Z'),
        email: `qc161.session.${marca}@example.test`,
        phone: '+57 300 000 0000',
        documentTypeCode: DOCUMENT_TYPE_CC,
        documentNumber: `64${marca.replaceAll('-', '').slice(0, 18)}`,
        username,
        passwordHash: 'no-se-usa-en-este-test',
        roleId: rolMaestroId,
        companyId: null,
        accountStatus: 'active',
      },
      select: { id: true },
    });
    return { id, username };
  }

  it('QC-161 R31: resuelve la ficha del Maestro sin empresa, con sus permisos, en una sola consulta', async () => {
    const maestro = await crearMaestro();

    try {
      const { resultado, sentencias } = await medir(maestro.id, SID_SIN_CERRAR);

      expect(resultado).toEqual({
        id: maestro.id,
        username: maestro.username,
        firstNames: 'Plataforma',
        lastNames: 'Inicial',
        roleName: ROLE_MAESTRO,
        companyId: null,
        companyDeletedAt: null,
        companyAddons: [],
        permissions: expect.arrayContaining([...(SEED_ROLE_PERMISSIONS[ROLE_MAESTRO] ?? [])]),
        accountStatus: 'active',
        lockedUntil: null,
        sessionsValidFrom: expect.any(Date),
        sessionRevokedAt: null,
      });
      expect(resultado?.permissions).toHaveLength(
        (SEED_ROLE_PERMISSIONS[ROLE_MAESTRO] ?? []).length,
      );
      // Sin empresa tambien es UNA sentencia: el `LEFT JOIN companies` no encuentra fila.
      expect(sentencias).toHaveLength(1);
    } finally {
      await prisma.user.deleteMany({ where: { id: maestro.id } });
    }
  });

  it('QC-161 R31: la cadena real de resolucion da usuario con permisos y ningun contexto de empresa', async () => {
    const maestro = await crearMaestro();

    try {
      const ahora = new Date();
      const resolveSession = createResolveSession({
        session: {
          readClaims: async () => ({
            sub: maestro.id,
            roleName: ROLE_MAESTRO,
            companyId: null,
            sessionId: SID_SIN_CERRAR,
            // Emitida un minuto en el futuro respecto del sello `DEFAULT now()` de la fila.
            issuedAt: new Date(ahora.getTime() + 60_000),
            expiresAt: new Date(ahora.getTime() + 3_600_000),
          }),
        },
        users: { findActiveById: findActiveSessionUserById },
        log: { log: () => undefined },
      });

      const resuelta = await resolveSession(new Date(ahora.getTime() + 120_000));

      expect(resuelta?.user.id).toBe(maestro.id);
      expect(resuelta?.user.roleName).toBe(ROLE_MAESTRO);
      expect([...(resuelta?.user.permissions ?? [])].sort()).toEqual(
        [...(SEED_ROLE_PERMISSIONS[ROLE_MAESTRO] ?? [])].sort(),
      );
      expect(resuelta?.context).toBeNull();
    } finally {
      await prisma.user.deleteMany({ where: { id: maestro.id } });
    }
  });
});

describe('findActiveSessionUserById con el rol de acondicionamiento', () => {
  async function crearAcondicionador(): Promise<{ id: string; username: string }> {
    const marca = randomUUID();
    const { id: rolAcondicionamientoId } = await prisma.role.findUniqueOrThrow({
      where: { name: ROLE_ACONDICIONAMIENTO },
      select: { id: true },
    });
    const username = `qc216_session_${marca}`;
    const { id } = await prisma.user.create({
      data: {
        firstNames: 'Acondicionador',
        lastNames: 'De Prueba',
        birthDate: new Date('1990-01-01T00:00:00.000Z'),
        email: `qc216.session.${marca}@example.test`,
        phone: '+57 300 000 0000',
        documentTypeCode: DOCUMENT_TYPE_CC,
        documentNumber: `65${marca.replaceAll('-', '').slice(0, 18)}`,
        username,
        passwordHash: 'no-se-usa-en-este-test',
        roleId: rolAcondicionamientoId,
        companyId: empresaId,
        accountStatus: 'active',
      },
      select: { id: true },
    });
    return { id, username };
  }

  it('QC-216 R20: la sesion de un usuario con el rol trae exactamente sus permisos (QC-137 R21 suma notificaciones.consultar), ni uno mas', async () => {
    const usuario = await crearAcondicionador();

    try {
      const ahora = new Date();
      const resolveSession = createResolveSession({
        session: {
          readClaims: async () => ({
            sub: usuario.id,
            roleName: ROLE_ACONDICIONAMIENTO,
            companyId: empresaId,
            sessionId: SID_SIN_CERRAR,
            issuedAt: new Date(ahora.getTime() + 60_000),
            expiresAt: new Date(ahora.getTime() + 3_600_000),
          }),
        },
        users: { findActiveById: findActiveSessionUserById },
        log: { log: () => undefined },
      });

      const resuelta = await resolveSession(new Date(ahora.getTime() + 120_000));

      expect(resuelta?.user.id).toBe(usuario.id);
      expect(resuelta?.user.roleName).toBe(ROLE_ACONDICIONAMIENTO);
      expect([...(resuelta?.user.permissions ?? [])].sort()).toEqual([
        'acondicionamiento.modificar',
        'asignaciones.consultar',
        'notificaciones.consultar',
      ]);
      expect([...(resuelta?.user.permissions ?? [])].sort()).toEqual(
        [...(SEED_ROLE_PERMISSIONS[ROLE_ACONDICIONAMIENTO] ?? [])].sort(),
      );
    } finally {
      await prisma.user.deleteMany({ where: { id: usuario.id } });
    }
  });
});

describe('findActiveSessionUserById y el permiso integraciones.modificar', () => {
  const CODIGO = 'integraciones.modificar';

  async function permisosDeLaSesionDe(roleName: string): Promise<readonly string[]> {
    const marca = randomUUID();
    const { id: roleId } = await prisma.role.findUniqueOrThrow({
      where: { name: roleName },
      select: { id: true },
    });
    const { id } = await prisma.user.create({
      data: {
        firstNames: 'Integraciones',
        lastNames: 'De Prueba',
        birthDate: new Date('1990-01-01T00:00:00.000Z'),
        email: `qc221.session.${marca}@example.test`,
        phone: '+57 300 000 0000',
        documentTypeCode: DOCUMENT_TYPE_CC,
        documentNumber: `66${marca.replaceAll('-', '').slice(0, 18)}`,
        username: `qc221_session_${marca}`,
        passwordHash: 'no-se-usa-en-este-test',
        roleId,
        companyId: empresaId,
        accountStatus: 'active',
      },
      select: { id: true },
    });

    try {
      const ahora = new Date();
      const resolveSession = createResolveSession({
        session: {
          readClaims: async () => ({
            sub: id,
            roleName,
            companyId: empresaId,
            sessionId: SID_SIN_CERRAR,
            issuedAt: new Date(ahora.getTime() + 60_000),
            expiresAt: new Date(ahora.getTime() + 3_600_000),
          }),
        },
        users: { findActiveById: findActiveSessionUserById },
        log: { log: () => undefined },
      });

      const resuelta = await resolveSession(new Date(ahora.getTime() + 120_000));
      expect(resuelta?.user.id).toBe(id);
      expect(resuelta?.user.roleName).toBe(roleName);
      return [...(resuelta?.user.permissions ?? [])].sort();
    } finally {
      await prisma.user.deleteMany({ where: { id } });
    }
  }

  it('R7: la sesion de un Administrador incluye integraciones.modificar y es exactamente su conjunto sembrado', async () => {
    const permisos = await permisosDeLaSesionDe(ROLE_ADMINISTRADOR);

    expect(permisos).toContain(CODIGO);
    expect(permisos).toEqual([...(SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR] ?? [])].sort());
  });

  it('QC-277 R8: con la empresa sin añadidos, la sesión real del Administrador queda en su parte del núcleo', async () => {
    await fijarAnadidos([]);
    try {
      const permisos = await permisosDeLaSesionDe(ROLE_ADMINISTRADOR);

      expect(permisos.length).toBeGreaterThan(0);
      expect(permisos).not.toContain(CODIGO);
      expect(permisos).toEqual(
        [...(SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR] ?? [])]
          .filter((codigo) => (CORE_PERMISSIONS as readonly string[]).includes(codigo))
          .sort(),
      );
    } finally {
      await fijarAnadidos([...ADDONS]);
    }
  });

  it('R7: la sesion de un Operador, un Empacador o un Administrador de acondicionamiento no incluye integraciones.modificar', async () => {
    for (const roleName of [ROLE_OPERADOR, ROLE_EMPACADOR, ROLE_ACONDICIONAMIENTO]) {
      const permisos = await permisosDeLaSesionDe(roleName);

      expect(permisos.length, roleName).toBeGreaterThan(0);
      expect(permisos, roleName).not.toContain(CODIGO);
      expect(permisos, roleName).toEqual([...(SEED_ROLE_PERMISSIONS[roleName] ?? [])].sort());
    }
  });
});
