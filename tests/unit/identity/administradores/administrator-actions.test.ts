// Server Actions de Administradores con la accion y el caso de uso de verdad. El unico doble es la
// composicion: cablea los casos de uso reales con puertos espia, como `company-actions.test.ts`.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createCreateAdministrator,
  createDeleteAdministrator,
  createGetAdministrator,
  createListAdministrators,
  createResendAdministratorLink,
  createUpdateAdministrator,
  type AdministratorRow,
  type Page,
} from '@/lib/modules/identity';
import {
  createAdministratorAction,
  deleteAdministratorAction,
  getAdministratorAction,
  listAdministratorsAction,
  resendAdministratorLinkAction,
  updateAdministratorAction,
} from '@/lib/modules/identity/adapters/driving/administrator-actions';

import {
  ADMIN_ID,
  COMPANY_ID,
  CORREO_GUARDADO,
  FICHA,
  OCHO_DATOS,
  OCHO_DATOS_ESCRITOS,
  OTRA_EMPRESA_ID,
  SECRETO,
  envio,
} from './administrator-doubles';

import type { AdministratorRepository } from '@/lib/modules/identity/ports/administrator-repository';

type CasoDeUso = (actor: unknown, input: unknown) => Promise<unknown>;

const CLAVES = [
  'listAdministrators',
  'getAdministrator',
  'createAdministrator',
  'updateAdministrator',
  'deleteAdministrator',
  'resendAdministratorLink',
] as const;

type Clave = (typeof CLAVES)[number];

const { getSessionUserMock, getSessionContextMock, readRequestIdHeaderMock, revalidatePathMock, cableado } =
  vi.hoisted(() => ({
    getSessionUserMock: vi.fn(),
    getSessionContextMock: vi.fn(),
    readRequestIdHeaderMock: vi.fn(async () => '7c9e6679-7425-40de-944b-e07fc1f90ae7'),
    revalidatePathMock: vi.fn(),
    cableado: {} as Record<string, (actor: unknown, input: unknown) => Promise<unknown>>,
  }));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

vi.mock('@/lib/composition', () => {
  const porClave = (clave: string) =>
    vi.fn((actor: unknown, input: unknown) => cableado[clave]!(actor, input));
  return {
    observabilidad: { readRequestIdHeader: readRequestIdHeaderMock },
    identity: {
      getSessionUser: getSessionUserMock,
      getSessionContext: getSessionContextMock,
      listAdministrators: porClave('listAdministrators'),
      getAdministrator: porClave('getAdministrator'),
      createAdministrator: porClave('createAdministrator'),
      updateAdministrator: porClave('updateAdministrator'),
      deleteAdministrator: porClave('deleteAdministrator'),
      resendAdministratorLink: porClave('resendAdministratorLink'),
    },
  };
});

const OTRO_ID = 'b9d0e3a1-0000-4000-8000-000000000000';

const MAESTRO_DE_SESION = {
  id: '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40',
  username: 'plataforma.inicial',
  displayName: 'Plataforma Inicial',
  roleName: 'Maestro',
  permissions: ['empresas.consultar', 'empresas.modificar'],
};

const ACTOR_DE_SESION = { id: MAESTRO_DE_SESION.id, permissions: MAESTRO_DE_SESION.permissions };

const IDLE = { status: 'idle' } as const;

// Lo que el cliente intenta colar por la entrada; nunca debe llegar al caso de uso.
const CAMPOS_COLADOS = { actorId: OTRO_ID, permissions: 'empresas.modificar', roleId: OTRO_ID };

const FILA: AdministratorRow = {
  id: ADMIN_ID,
  firstNames: 'Ana',
  lastNames: 'Perez',
  username: 'ana.perez',
  email: CORREO_GUARDADO,
  company: { id: COMPANY_ID, name: 'QuimiCloud' },
  accountStatus: 'pending',
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  isLastAdministrator: true,
};

const PAGINA: Page<AdministratorRow> = { items: [FILA], total: 1, page: 1, pageSize: 10, totalPages: 1 };

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

type Repo = { [K in keyof AdministratorRepository]: ReturnType<typeof vi.fn<AdministratorRepository[K]>> };

let repo: Repo;
let correo: ReturnType<typeof envio>;
let ignoredFields: ReturnType<typeof vi.fn<(listName: string, fields: readonly string[]) => void>>;
let casos: Record<Clave, ReturnType<typeof vi.fn<CasoDeUso>>>;

function espiar(real: CasoDeUso): ReturnType<typeof vi.fn<CasoDeUso>> {
  return vi.fn<CasoDeUso>((actor, input) => real(actor, input));
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUserMock.mockResolvedValue(MAESTRO_DE_SESION);
  getSessionContextMock.mockResolvedValue(null);

  repo = {
    list: vi.fn<AdministratorRepository['list']>(async () => PAGINA),
    findManageable: vi.fn<AdministratorRepository['findManageable']>(async () => FICHA),
    create: vi.fn<AdministratorRepository['create']>(async () => ({ administratorId: ADMIN_ID })),
    update: vi.fn<AdministratorRepository['update']>(async () => 'ok'),
    softDelete: vi.fn<AdministratorRepository['softDelete']>(async () => 'ok'),
  };
  correo = envio();
  ignoredFields = vi.fn();

  const administrators = repo as AdministratorRepository;
  const mail = { secrets: correo.secrets, links: correo.links, mailer: correo.mailer };
  casos = {
    listAdministrators: espiar(
      createListAdministrators({ administrators, log: { ignoredFields } }) as CasoDeUso,
    ),
    getAdministrator: espiar(createGetAdministrator({ administrators }) as CasoDeUso),
    createAdministrator: espiar(createCreateAdministrator({ administrators, ...mail }) as CasoDeUso),
    updateAdministrator: espiar(createUpdateAdministrator({ administrators }) as CasoDeUso),
    deleteAdministrator: espiar(createDeleteAdministrator({ administrators }) as CasoDeUso),
    resendAdministratorLink: espiar(
      createResendAdministratorLink({ administrators, ...mail }) as CasoDeUso,
    ),
  };
  for (const clave of CLAVES) cableado[clave] = casos[clave];
});

/** Las seis acciones, invocadas con una entrada valida y lo que se intenta colar. */
const INVOCACIONES: readonly { clave: Clave; invocar: () => Promise<unknown> }[] = [
  { clave: 'listAdministrators', invocar: () => listAdministratorsAction({ page: 1 }) },
  { clave: 'getAdministrator', invocar: () => getAdministratorAction(ADMIN_ID) },
  {
    clave: 'createAdministrator',
    invocar: () =>
      createAdministratorAction(
        IDLE,
        formData({ companyId: COMPANY_ID, ...OCHO_DATOS, ...CAMPOS_COLADOS }),
      ),
  },
  {
    clave: 'updateAdministrator',
    invocar: () =>
      updateAdministratorAction(IDLE, formData({ id: ADMIN_ID, ...OCHO_DATOS, ...CAMPOS_COLADOS })),
  },
  {
    clave: 'deleteAdministrator',
    invocar: () => deleteAdministratorAction(IDLE, formData({ id: ADMIN_ID, ...CAMPOS_COLADOS })),
  },
  {
    clave: 'resendAdministratorLink',
    invocar: () =>
      resendAdministratorLinkAction(IDLE, formData({ id: ADMIN_ID, ...CAMPOS_COLADOS })),
  },
];

describe.each(INVOCACIONES)('$clave: actor de la sesion', ({ clave, invocar }) => {
  it('R3: el actor sale de la sesion, una sola lectura, sin contexto de empresa ni revalidar', async () => {
    const resultado = await invocar();

    expect(resultado).toMatchObject({ status: 'success' });
    expect(casos[clave]).toHaveBeenCalledTimes(1);
    expect(casos[clave].mock.calls[0]![0]).toEqual(ACTOR_DE_SESION);
    expect(getSessionUserMock).toHaveBeenCalledTimes(1);
    expect(getSessionContextMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('R3: lo colado en la entrada no llega al caso de uso', async () => {
    await invocar();

    const entrada = casos[clave].mock.calls[0]![1];
    if (typeof entrada === 'object' && entrada !== null) {
      for (const colado of Object.keys(CAMPOS_COLADOS)) expect(entrada).not.toHaveProperty(colado);
    }
  });

  it('R3: sin sesion el actor es null y responde unauthorized sin tocar ningun puerto', async () => {
    getSessionUserMock.mockResolvedValue(null);

    const resultado = await invocar();

    expect(resultado).toMatchObject({ status: 'error', code: 'unauthorized' });
    expect(casos[clave].mock.calls[0]![0]).toBeNull();
    for (const metodo of Object.values(repo)) expect(metodo).not.toHaveBeenCalled();
    expect(correo.issueForPendingUser).not.toHaveBeenCalled();
  });

  it('R3: unos permisos de la entrada no autorizan a un usuario de sesion sin ellos', async () => {
    getSessionUserMock.mockResolvedValue({ ...MAESTRO_DE_SESION, permissions: [] });

    const resultado = await invocar();

    expect(resultado).toMatchObject({ status: 'error', code: 'unauthorized' });
    for (const metodo of Object.values(repo)) expect(metodo).not.toHaveBeenCalled();
  });
});

describe('listAdministratorsAction', () => {
  it('R3: devuelve la pagina del caso de uso con la consulta tal cual', async () => {
    const resultado = await listAdministratorsAction({ page: 2, pageSize: 25 });

    expect(resultado).toEqual({ status: 'success', data: PAGINA });
    expect(casos.listAdministrators).toHaveBeenCalledWith(ACTOR_DE_SESION, { page: 2, pageSize: 25 });
    expect(repo.list).toHaveBeenCalledTimes(1);
  });

  it('R3: una consulta mal formada vuelve como estado de error con su code', async () => {
    const resultado = await listAdministratorsAction({ page: 'uno' });

    expect(resultado).toMatchObject({ status: 'error', code: 'invalid_input' });
    expect(repo.list).not.toHaveBeenCalled();
  });
});

describe('getAdministratorAction', () => {
  it('R3: devuelve la ficha; el caso de uso recibe solo el id', async () => {
    const resultado = await getAdministratorAction(ADMIN_ID);

    expect(resultado).toEqual({ status: 'success', data: FICHA });
    expect(casos.getAdministrator).toHaveBeenCalledWith(ACTOR_DE_SESION, { id: ADMIN_ID });
  });

  it('R3: un Administrador no gestionable vuelve como user_not_found', async () => {
    repo.findManageable.mockResolvedValue(null);

    const resultado = await getAdministratorAction(ADMIN_ID);

    expect(resultado).toMatchObject({ status: 'error', code: 'user_not_found' });
  });
});

describe('createAdministratorAction', () => {
  it('R3: pasa la empresa y los ocho datos crudos; responde con el id y el estado del correo', async () => {
    const resultado = await createAdministratorAction(
      IDLE,
      formData({ companyId: COMPANY_ID, ...OCHO_DATOS }),
    );

    expect(resultado).toEqual({ status: 'success', administratorId: ADMIN_ID, mail: 'sent' });
    expect(casos.createAdministrator).toHaveBeenCalledWith(ACTOR_DE_SESION, {
      companyId: COMPANY_ID,
      ...OCHO_DATOS,
    });
    expect(repo.create).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      administrator: OCHO_DATOS_ESCRITOS,
      now: expect.any(Date),
    });
    expect(JSON.stringify(resultado)).not.toContain(SECRETO);
  });

  it('R3: un campo ausente llega crudo y responde invalid_input sin tocar el puerto', async () => {
    const sinUsuario = Object.fromEntries(
      Object.entries(OCHO_DATOS).filter(([clave]) => clave !== 'username'),
    );

    const resultado = await createAdministratorAction(
      IDLE,
      formData({ companyId: COMPANY_ID, ...sinUsuario }),
    );

    expect(resultado).toMatchObject({ status: 'error', code: 'invalid_input' });
    expect(casos.createAdministrator.mock.calls[0]![1]).toMatchObject({ username: null });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('R3: un duplicado del puerto vuelve como estado de error con su code', async () => {
    repo.create.mockResolvedValue('email');

    const resultado = await createAdministratorAction(
      IDLE,
      formData({ companyId: COMPANY_ID, ...OCHO_DATOS }),
    );

    expect(resultado).toMatchObject({ status: 'error', code: 'duplicate_email' });
  });

  it('R3: el correo que falla no hace fallar el alta', async () => {
    correo.sendCredentialSetupLink.mockResolvedValue('failed');

    const resultado = await createAdministratorAction(
      IDLE,
      formData({ companyId: COMPANY_ID, ...OCHO_DATOS }),
    );

    expect(resultado).toEqual({ status: 'success', administratorId: ADMIN_ID, mail: 'failed' });
  });
});

describe('updateAdministratorAction', () => {
  it('R19: la accion no lee companyId; el caso de uso recibe solo el id y los ocho datos', async () => {
    const resultado = await updateAdministratorAction(
      IDLE,
      formData({ id: ADMIN_ID, companyId: OTRA_EMPRESA_ID, ...OCHO_DATOS }),
    );

    expect(resultado).toEqual({ status: 'success' });
    const entrada = casos.updateAdministrator.mock.calls[0]![1];
    expect(entrada).toEqual({ id: ADMIN_ID, ...OCHO_DATOS });
    expect(entrada).not.toHaveProperty('companyId');
    expect(repo.update).toHaveBeenCalledWith({
      id: ADMIN_ID,
      data: OCHO_DATOS_ESCRITOS,
      now: expect.any(Date),
    });
    expect(JSON.stringify(repo.update.mock.calls)).not.toContain(OTRA_EMPRESA_ID);
  });

  it('R3: un Administrador no gestionable vuelve como user_not_found', async () => {
    repo.update.mockResolvedValue('not_found');

    const resultado = await updateAdministratorAction(IDLE, formData({ id: ADMIN_ID, ...OCHO_DATOS }));

    expect(resultado).toMatchObject({ status: 'error', code: 'user_not_found' });
  });
});

describe('deleteAdministratorAction', () => {
  it('R3: el caso de uso recibe solo el id', async () => {
    const resultado = await deleteAdministratorAction(IDLE, formData({ id: ADMIN_ID }));

    expect(resultado).toEqual({ status: 'success' });
    expect(casos.deleteAdministrator).toHaveBeenCalledWith(ACTOR_DE_SESION, { id: ADMIN_ID });
    expect(repo.softDelete).toHaveBeenCalledWith({ id: ADMIN_ID, now: expect.any(Date) });
  });

  it('R3: el ultimo Administrador vuelve como company_last_administrator', async () => {
    repo.softDelete.mockResolvedValue('last_administrator');

    const resultado = await deleteAdministratorAction(IDLE, formData({ id: ADMIN_ID }));

    expect(resultado).toMatchObject({ status: 'error', code: 'company_last_administrator' });
  });
});

describe('resendAdministratorLinkAction', () => {
  it('R29: la accion solo lee id; correo y empresa de la entrada no llegan al caso de uso', async () => {
    const resultado = await resendAdministratorLinkAction(
      IDLE,
      formData({ id: ADMIN_ID, email: 'otro@fuera.co', companyId: OTRA_EMPRESA_ID, to: 'x@y.co' }),
    );

    expect(resultado).toEqual({ status: 'success', mail: 'sent' });
    expect(casos.resendAdministratorLink).toHaveBeenCalledWith(ACTOR_DE_SESION, { id: ADMIN_ID });
    expect(correo.issueForPendingUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ADMIN_ID, companyId: FICHA.company.id }),
    );
    const enviado = JSON.stringify([
      correo.issueForPendingUser.mock.calls,
      correo.sendCredentialSetupLink.mock.calls,
    ]);
    expect(enviado).not.toContain('otro@fuera.co');
    expect(enviado).not.toContain(OTRA_EMPRESA_ID);
    expect(JSON.stringify(resultado)).not.toContain(SECRETO);
  });

  it('R3: un Administrador ya activo vuelve como user_not_pending sin correo', async () => {
    correo.issueForPendingUser.mockResolvedValue('user_not_pending');

    const resultado = await resendAdministratorLinkAction(IDLE, formData({ id: ADMIN_ID }));

    expect(resultado).toMatchObject({ status: 'error', code: 'user_not_pending' });
    expect(correo.sendCredentialSetupLink).not.toHaveBeenCalled();
  });

  it('R3: el correo que falla responde success con mail failed', async () => {
    correo.sendCredentialSetupLink.mockResolvedValue('failed');

    const resultado = await resendAdministratorLinkAction(IDLE, formData({ id: ADMIN_ID }));

    expect(resultado).toEqual({ status: 'success', mail: 'failed' });
  });
});
