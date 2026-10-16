// Autorizacion de las seis operaciones de Administradores: el permiso es la primera linea y, si
// falta, ningun puerto se toca. Los dobles lanzan si se les llama.
import { describe, expect, it, vi } from 'vitest';

import {
  createCreateAdministrator,
  createDeleteAdministrator,
  createGetAdministrator,
  createListAdministrators,
  createResendAdministratorLink,
  createUpdateAdministrator,
  type PlatformActor,
} from '@/lib/modules/identity';

import type { AdministratorRepository } from '@/lib/modules/identity/ports/administrator-repository';

import {
  ADMIN_ID,
  COMPANY_ID,
  FICHA,
  MAESTRO,
  NOW,
  OCHO_DATOS,
  envio,
  envioIntocable,
  llamadasA,
  logIntocable,
  repositorio,
} from './administrator-doubles';

type Operacion = (actor: PlatformActor | null | undefined, input: unknown) => Promise<unknown>;

type Permiso = 'empresas.consultar' | 'empresas.modificar';

type Caso = {
  readonly nombre: string;
  readonly permiso: Permiso;
  readonly entrada: unknown;
  readonly intocable: () => { operacion: Operacion; llamadas: () => number };
  readonly autorizada: () => { operacion: Operacion; tocado: () => number };
};

const PAGINA = { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 };

function sinTocar(construir: (deps: {
  administrators: AdministratorRepository;
  log: ReturnType<typeof logIntocable>;
  envio: ReturnType<typeof envioIntocable>;
}) => Operacion) {
  const administrators = repositorio();
  const log = logIntocable();
  const intocable = envioIntocable();
  const operacion = construir({ administrators, log, envio: intocable });
  const llamadas = () =>
    llamadasA(administrators, log, intocable.secrets, intocable.links, intocable.mailer);
  return { operacion, llamadas };
}

const CASOS: readonly Caso[] = [
  {
    nombre: 'lista',
    permiso: 'empresas.consultar',
    entrada: {},
    intocable: () =>
      sinTocar(({ administrators, log }) => createListAdministrators({ administrators, log })),
    autorizada: () => {
      const list = vi.fn<AdministratorRepository['list']>(async () => PAGINA);
      const operacion = createListAdministrators({
        administrators: repositorio({ list }),
        log: { ignoredFields: vi.fn() },
      });
      return { operacion, tocado: () => list.mock.calls.length };
    },
  },
  {
    nombre: 'ficha',
    permiso: 'empresas.consultar',
    entrada: { id: ADMIN_ID },
    intocable: () => sinTocar(({ administrators }) => createGetAdministrator({ administrators })),
    autorizada: () => {
      const findManageable = vi.fn<AdministratorRepository['findManageable']>(async () => FICHA);
      const operacion = createGetAdministrator({ administrators: repositorio({ findManageable }) });
      return { operacion, tocado: () => findManageable.mock.calls.length };
    },
  },
  {
    nombre: 'alta',
    permiso: 'empresas.modificar',
    entrada: { companyId: COMPANY_ID, ...OCHO_DATOS },
    intocable: () =>
      sinTocar(({ administrators, envio: e }) =>
        createCreateAdministrator({ administrators, ...e, now: () => NOW }),
      ),
    autorizada: () => {
      const create = vi.fn<AdministratorRepository['create']>(async () => ({ administratorId: ADMIN_ID }));
      const operacion = createCreateAdministrator({
        administrators: repositorio({ create }),
        ...envio(),
        now: () => NOW,
      });
      return { operacion, tocado: () => create.mock.calls.length };
    },
  },
  {
    nombre: 'edicion',
    permiso: 'empresas.modificar',
    entrada: { id: ADMIN_ID, ...OCHO_DATOS },
    intocable: () =>
      sinTocar(({ administrators }) => createUpdateAdministrator({ administrators, now: () => NOW })),
    autorizada: () => {
      const update = vi.fn<AdministratorRepository['update']>(async () => 'ok');
      const operacion = createUpdateAdministrator({ administrators: repositorio({ update }), now: () => NOW });
      return { operacion, tocado: () => update.mock.calls.length };
    },
  },
  {
    nombre: 'baja',
    permiso: 'empresas.modificar',
    entrada: { id: ADMIN_ID },
    intocable: () =>
      sinTocar(({ administrators }) => createDeleteAdministrator({ administrators, now: () => NOW })),
    autorizada: () => {
      const softDelete = vi.fn<AdministratorRepository['softDelete']>(async () => 'ok');
      const operacion = createDeleteAdministrator({
        administrators: repositorio({ softDelete }),
        now: () => NOW,
      });
      return { operacion, tocado: () => softDelete.mock.calls.length };
    },
  },
  {
    nombre: 'reenvio del enlace',
    permiso: 'empresas.modificar',
    entrada: { id: ADMIN_ID },
    intocable: () =>
      sinTocar(({ administrators, envio: e }) =>
        createResendAdministratorLink({ administrators, ...e, now: () => NOW }),
      ),
    autorizada: () => {
      const findManageable = vi.fn<AdministratorRepository['findManageable']>(async () => FICHA);
      const dobles = envio();
      const operacion = createResendAdministratorLink({
        administrators: repositorio({ findManageable }),
        ...dobles,
        now: () => NOW,
      });
      return {
        operacion,
        tocado: () => findManageable.mock.calls.length + dobles.issueForPendingUser.mock.calls.length,
      };
    },
  },
];

function otroPermiso(permiso: Permiso): Permiso {
  return permiso === 'empresas.consultar' ? 'empresas.modificar' : 'empresas.consultar';
}

function actoresSinPermiso(permiso: Permiso): ReadonlyArray<{ caso: string; actor: unknown }> {
  return [
    { caso: 'actor null', actor: null },
    { caso: 'actor undefined', actor: undefined },
    { caso: 'sin conjunto de permisos', actor: { id: MAESTRO.id } },
    { caso: 'conjunto vacio', actor: { id: MAESTRO.id, permissions: [] } },
    { caso: `solo ${otroPermiso(permiso)}`, actor: { id: MAESTRO.id, permissions: [otroPermiso(permiso)] } },
    {
      caso: 'Administrador de empresa con usuarios.consultar y usuarios.modificar',
      actor: {
        id: MAESTRO.id,
        companyId: COMPANY_ID,
        permissions: ['usuarios.consultar', 'usuarios.modificar'],
      },
    },
  ];
}

describe.each(CASOS)('autorizacion de la $nombre', (caso) => {
  for (const { caso: descripcion, actor } of actoresSinPermiso(caso.permiso)) {
    it(`R1: ${descripcion} → unauthorized, antes de validar y sin tocar ningun puerto`, async () => {
      const { operacion, llamadas } = caso.intocable();

      await expect(operacion(actor as PlatformActor | null, caso.entrada)).rejects.toMatchObject({
        code: 'unauthorized',
      });
      expect(llamadas()).toBe(0);
    });
  }

  it('R1: sin permiso, una entrada rota tambien responde unauthorized y no invalid_input', async () => {
    const { operacion, llamadas } = caso.intocable();

    await expect(operacion({ id: MAESTRO.id, permissions: [] }, { roto: true })).rejects.toMatchObject({
      code: 'unauthorized',
    });
    expect(llamadas()).toBe(0);
  });

  it(`R2: un actor sin empresa con ${caso.permiso} queda autorizado`, async () => {
    const { operacion, tocado } = caso.autorizada();
    const sinEmpresa: PlatformActor = { id: MAESTRO.id, permissions: [caso.permiso] };

    await operacion(sinEmpresa, caso.entrada);
    expect('companyId' in sinEmpresa).toBe(false);
    expect(tocado()).toBeGreaterThan(0);
  });
});
