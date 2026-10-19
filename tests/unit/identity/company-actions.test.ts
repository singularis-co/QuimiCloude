// Server Actions de empresas con la accion y el caso de uso de verdad. El unico doble es la
// composicion, como en `maestro-sin-empresa-actions.test.ts`: cablea los casos de uso reales con
// puertos espia.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createCreateCompany,
  ADDONS,
  createDeleteCompany,
  createGetCompany,
  createGetCompanyAddons,
  createGetCompanyDeletionImpact,
  createListCompanies,
  createListCompanyEvents,
  createReactivateCompany,
  createSetAllCompanyAddons,
  createSetCompanyAddon,
  createSetCompanyCountry,
  createUpdateCompany,
  type CompanyDetail,
  type CompanyEventView,
  type CompanyRow,
  type Page,
} from '@/lib/modules/identity';
import {
  createCompanyAction,
  deleteCompanyAction,
  getCompanyAction,
  getCompanyAddonsAction,
  getCompanyDeletionImpactAction,
  listCompaniesAction,
  listCompanyEventsAction,
  reactivateCompanyAction,
  setAllCompanyAddonsAction,
  setCompanyAddonAction,
  setCompanyCountryAction,
  updateCompanyAction,
} from '@/lib/modules/identity/adapters/driving/company-actions';

import type { CompanyAddonRepository } from '@/lib/modules/identity/ports/company-addon-repository';
import type { CompanyCountryRepository } from '@/lib/modules/identity/ports/company-country-repository';
import type { CompanyRepository } from '@/lib/modules/identity/ports/company-repository';
import type { CredentialSetupLinkRepository } from '@/lib/modules/identity/ports/credential-setup-link-repository';
import type { CredentialSetupMailer } from '@/lib/modules/identity/ports/credential-setup-mailer';

type CasoDeUso = (actor: unknown, input: unknown) => Promise<unknown>;

const CLAVES_DE_EMPRESAS = [
  'createCompany',
  'updateCompany',
  'deleteCompany',
  'reactivateCompany',
  'listCompanies',
  'getCompany',
  'getCompanyDeletionImpact',
  'listCompanyEvents',
] as const;

type ClaveDeEmpresas = (typeof CLAVES_DE_EMPRESAS)[number];

const {
  getSessionUserMock,
  getSessionContextMock,
  readRequestIdHeaderMock,
  revalidatePathMock,
  cableado,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getSessionContextMock: vi.fn(),
  readRequestIdHeaderMock: vi.fn(async () => '7c9e6679-7425-40de-944b-e07fc1f90ae7'),
  revalidatePathMock: vi.fn(),
  cableado: {
    setCompanyCountry: null as null | ((actor: unknown, input: unknown) => Promise<void>),
    empresas: {} as Record<string, (actor: unknown, input: unknown) => Promise<unknown>>,
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

vi.mock('@/lib/composition', () => {
  const porClave = (clave: string) =>
    vi.fn((actor: unknown, input: unknown) => cableado.empresas[clave]!(actor, input));
  return {
    observabilidad: { readRequestIdHeader: readRequestIdHeaderMock },
    identity: {
      getSessionUser: getSessionUserMock,
      getSessionContext: getSessionContextMock,
      setCompanyCountry: vi.fn((actor: unknown, input: unknown) =>
        cableado.setCompanyCountry!(actor, input),
      ),
      createCompany: porClave('createCompany'),
      updateCompany: porClave('updateCompany'),
      deleteCompany: porClave('deleteCompany'),
      reactivateCompany: porClave('reactivateCompany'),
      listCompanies: porClave('listCompanies'),
      getCompany: porClave('getCompany'),
      getCompanyDeletionImpact: porClave('getCompanyDeletionImpact'),
      listCompanyEvents: porClave('listCompanyEvents'),
      getCompanyAddons: porClave('getCompanyAddons'),
      setCompanyAddon: porClave('setCompanyAddon'),
      setAllCompanyAddons: porClave('setAllCompanyAddons'),
    },
  };
});

const COMPANY_ID = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';
const ADMIN_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const OTRO_ID = 'b9d0e3a1-0000-4000-8000-000000000000';

const MAESTRO = {
  id: '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40',
  username: 'plataforma.inicial',
  displayName: 'Plataforma Inicial',
  roleName: 'Maestro',
  permissions: ['empresas.consultar', 'empresas.modificar'],
};

const ACTOR_DE_SESION = { id: MAESTRO.id, permissions: MAESTRO.permissions };

const IDLE = { status: 'idle' } as const;

function sinCampo(fields: Record<string, string>, omitido: string): Record<string, string> {
  return Object.fromEntries(Object.entries(fields).filter(([key]) => key !== omitido));
}

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

let setCountryOfAlive: ReturnType<typeof vi.fn<CompanyCountryRepository['setCountryOfAlive']>>;
let casoDeUso: ReturnType<typeof vi.fn<(actor: unknown, input: unknown) => Promise<void>>>;

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUserMock.mockResolvedValue(MAESTRO);
  getSessionContextMock.mockResolvedValue(null);
  setCountryOfAlive = vi.fn<CompanyCountryRepository['setCountryOfAlive']>(async () => 'ok');
  const real = createSetCompanyCountry({ companies: { setCountryOfAlive } });
  casoDeUso = vi.fn<(actor: unknown, input: unknown) => Promise<void>>((actor, input) =>
    real(actor as Parameters<typeof real>[0], input),
  );
  cableado.setCompanyCountry = casoDeUso;
});

describe('setCompanyCountryAction', () => {
  it('R9: el actor sale de la sesion y no de la entrada; responde success sin revalidar', async () => {
    const resultado = await setCompanyCountryAction(
      IDLE,
      formData({
        companyId: COMPANY_ID,
        country: 'CO',
        id: 'b9d0e3a1-0000-4000-8000-000000000000',
        permissions: 'empresas.modificar',
      }),
    );

    expect(resultado).toEqual({ status: 'success' });
    expect(casoDeUso).toHaveBeenCalledWith(
      { id: MAESTRO.id, permissions: MAESTRO.permissions },
      { companyId: COMPANY_ID, country: 'CO' },
    );
    expect(setCountryOfAlive).toHaveBeenCalledWith(COMPANY_ID, 'CO', MAESTRO.id, expect.any(Date));
    expect(getSessionUserMock).toHaveBeenCalled();
    expect(getSessionContextMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('R9: unos permisos mandados en la entrada no autorizan a un usuario de sesion sin ellos', async () => {
    getSessionUserMock.mockResolvedValue({ ...MAESTRO, permissions: ['empresas.consultar'] });

    const resultado = await setCompanyCountryAction(
      IDLE,
      formData({ companyId: COMPANY_ID, country: 'CO', permissions: 'empresas.modificar' }),
    );

    expect(resultado).toMatchObject({ status: 'error', code: 'unauthorized' });
    expect(setCountryOfAlive).not.toHaveBeenCalled();
  });

  it('R9: sin sesion el actor es null y responde unauthorized', async () => {
    getSessionUserMock.mockResolvedValue(null);

    const resultado = await setCompanyCountryAction(
      IDLE,
      formData({ companyId: COMPANY_ID, country: 'CO' }),
    );

    expect(resultado).toMatchObject({ status: 'error', code: 'unauthorized' });
    expect(casoDeUso).toHaveBeenCalledWith(null, expect.anything());
    expect(setCountryOfAlive).not.toHaveBeenCalled();
  });

  it('R9: un error del caso de uso vuelve como estado de error con su code', async () => {
    setCountryOfAlive.mockResolvedValue('not_found');

    const resultado = await setCompanyCountryAction(
      IDLE,
      formData({ companyId: COMPANY_ID, country: '' }),
    );

    expect(resultado).toMatchObject({ status: 'error', code: 'company_not_found' });
    expect(setCountryOfAlive).toHaveBeenCalledWith(COMPANY_ID, null, MAESTRO.id, expect.any(Date));
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('R9: un campo ausente llega crudo y responde invalid_input', async () => {
    const resultado = await setCompanyCountryAction(IDLE, formData({ companyId: COMPANY_ID }));

    expect(resultado).toMatchObject({ status: 'error', code: 'invalid_input' });
    expect(setCountryOfAlive).not.toHaveBeenCalled();
  });

  it('R5: un usuario de sesion sin empresa con empresas.modificar → success', async () => {
    getSessionUserMock.mockResolvedValue({ ...MAESTRO, permissions: ['empresas.modificar'] });
    getSessionContextMock.mockResolvedValue(null);

    const resultado = await setCompanyCountryAction(
      IDLE,
      formData({ companyId: COMPANY_ID, country: 'PE' }),
    );

    expect(resultado).toEqual({ status: 'success' });
    expect(setCountryOfAlive).toHaveBeenCalledWith(COMPANY_ID, 'PE', MAESTRO.id, expect.any(Date));
  });
});

// ---------------------------------------------------------------------------------------------
// Las ocho acciones de gestion de empresas.
// ---------------------------------------------------------------------------------------------

const CAMPOS_EMPRESA = {
  name: '  Quimi Cloud ',
  taxId: '900.123.456-7',
  contactEmail: 'contacto@quimi.co',
  contactPhone: '',
};

const CAMPOS_ADMINISTRADOR = {
  adminFirstNames: 'Ana',
  adminLastNames: 'Perez',
  adminBirthDate: '1990-05-01',
  adminEmail: 'ana@quimi.co',
  adminPhone: '3000000000',
  adminDocumentTypeCode: 'CC',
  adminDocumentNumber: '123456',
  adminUsername: 'ana.perez',
};

// Lo que el actor intenta colar por la entrada; nunca debe llegar al caso de uso.
const CAMPOS_COLADOS = { id: OTRO_ID, actorId: OTRO_ID, permissions: 'empresas.modificar' };

const FILA: CompanyRow = {
  id: COMPANY_ID,
  name: 'Quimi Cloud',
  taxId: '900.123.456-7',
  country: 'CO',
  liveUserCount: 3,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  status: 'active',
};

const PAGINA_DE_EMPRESAS: Page<CompanyRow> = {
  items: [FILA],
  total: 1,
  page: 1,
  pageSize: 10,
  totalPages: 1,
};

const FICHA: CompanyDetail = {
  id: COMPANY_ID,
  name: 'Quimi Cloud',
  taxId: '900.123.456-7',
  contactEmail: 'contacto@quimi.co',
  contactPhone: null,
  country: 'CO',
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  status: 'deleted',
  deletedAt: new Date('2026-10-10T00:00:00.000Z'),
};

const PAGINA_DE_EVENTOS: Page<CompanyEventView> = {
  items: [
    {
      id: 'e1f2a3b4-0000-4000-8000-000000000001',
      kind: 'company.updated',
      occurredAt: new Date('2026-10-12T00:00:00.000Z'),
      actor: { id: MAESTRO.id, firstNames: 'Plataforma', lastNames: 'Inicial' },
      fields: ['name'],
      addon: null,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 10,
  totalPages: 1,
};

type Puertos = {
  companies: { [K in keyof CompanyRepository]: ReturnType<typeof vi.fn<CompanyRepository[K]>> };
  issueForPendingUser: ReturnType<typeof vi.fn<CredentialSetupLinkRepository['issueForPendingUser']>>;
  sendCredentialSetupLink: ReturnType<typeof vi.fn<CredentialSetupMailer['sendCredentialSetupLink']>>;
  countOpenOrders: ReturnType<typeof vi.fn<(companyId: string) => Promise<number>>>;
  ignoredFields: ReturnType<typeof vi.fn<(listName: string, fields: readonly string[]) => void>>;
  casos: Record<ClaveDeEmpresas, ReturnType<typeof vi.fn<CasoDeUso>>>;
};

let puertos: Puertos;

function cablearEmpresas(): Puertos {
  const companies: Puertos['companies'] = {
    createWithAdministrator: vi.fn<CompanyRepository['createWithAdministrator']>(async () => ({
      companyId: COMPANY_ID,
      administratorId: ADMIN_ID,
    })),
    update: vi.fn<CompanyRepository['update']>(async () => 'ok'),
    softDelete: vi.fn<CompanyRepository['softDelete']>(async () => 'ok'),
    reactivate: vi.fn<CompanyRepository['reactivate']>(async () => 'ok'),
    list: vi.fn<CompanyRepository['list']>(async () => PAGINA_DE_EMPRESAS),
    findById: vi.fn<CompanyRepository['findById']>(async () => FICHA),
    countLiveUsersOfAlive: vi.fn<CompanyRepository['countLiveUsersOfAlive']>(async () => 4),
    listEvents: vi.fn<CompanyRepository['listEvents']>(async () => PAGINA_DE_EVENTOS),
  };
  const issueForPendingUser = vi.fn<CredentialSetupLinkRepository['issueForPendingUser']>(
    async () => ({ email: 'ana@quimi.co' }),
  );
  const sendCredentialSetupLink = vi.fn<CredentialSetupMailer['sendCredentialSetupLink']>(
    async () => 'sent',
  );
  const countOpenOrders = vi.fn<(companyId: string) => Promise<number>>(async () => 2);
  const ignoredFields = vi.fn<(listName: string, fields: readonly string[]) => void>();

  const reales: Record<ClaveDeEmpresas, CasoDeUso> = {
    createCompany: createCreateCompany({
      companies,
      secrets: { create: () => ({ secret: 'secreto', digest: 'huella' }), digestOf: vi.fn() },
      links: { issueForPendingUser, applyCredentialAndActivate: vi.fn() },
      mailer: { sendCredentialSetupLink },
    }) as CasoDeUso,
    updateCompany: createUpdateCompany({ companies }) as CasoDeUso,
    deleteCompany: createDeleteCompany({ companies }) as CasoDeUso,
    reactivateCompany: createReactivateCompany({ companies }) as CasoDeUso,
    listCompanies: createListCompanies({ companies, log: { ignoredFields } }) as CasoDeUso,
    getCompany: createGetCompany({ companies }) as CasoDeUso,
    getCompanyDeletionImpact: createGetCompanyDeletionImpact({
      companies,
      openOrders: { countOpenOrders },
    }) as CasoDeUso,
    listCompanyEvents: createListCompanyEvents({ companies }) as CasoDeUso,
  };

  const casos = {} as Record<ClaveDeEmpresas, ReturnType<typeof vi.fn<CasoDeUso>>>;
  for (const clave of CLAVES_DE_EMPRESAS) {
    casos[clave] = vi.fn<CasoDeUso>((actor, input) => reales[clave](actor, input));
    cableado.empresas[clave] = casos[clave];
  }

  return { companies, issueForPendingUser, sendCredentialSetupLink, countOpenOrders, ignoredFields, casos };
}

function ningunPuertoTocado(): void {
  for (const metodo of Object.values(puertos.companies)) expect(metodo).not.toHaveBeenCalled();
  expect(puertos.issueForPendingUser).not.toHaveBeenCalled();
  expect(puertos.countOpenOrders).not.toHaveBeenCalled();
}

function soloSesionSinRevalidar(): void {
  expect(getSessionUserMock).toHaveBeenCalled();
  expect(getSessionContextMock).not.toHaveBeenCalled();
  expect(revalidatePathMock).not.toHaveBeenCalled();
}

beforeEach(() => {
  puertos = cablearEmpresas();
});

/** Una invocacion valida de cada accion, con lo que el actor intenta colar por la entrada. */
const INVOCACIONES: ReadonlyArray<{
  readonly clave: ClaveDeEmpresas;
  readonly invocar: () => Promise<unknown>;
}> = [
  {
    clave: 'createCompany',
    invocar: () =>
      createCompanyAction(
        IDLE,
        formData({ ...CAMPOS_EMPRESA, ...CAMPOS_ADMINISTRADOR, ...CAMPOS_COLADOS }),
      ),
  },
  {
    clave: 'updateCompany',
    invocar: () =>
      updateCompanyAction(
        IDLE,
        formData({ companyId: COMPANY_ID, ...CAMPOS_EMPRESA, ...CAMPOS_COLADOS }),
      ),
  },
  {
    clave: 'deleteCompany',
    invocar: () =>
      deleteCompanyAction(
        IDLE,
        formData({ companyId: COMPANY_ID, confirmationName: 'quimi cloud', ...CAMPOS_COLADOS }),
      ),
  },
  {
    clave: 'reactivateCompany',
    invocar: () =>
      reactivateCompanyAction(IDLE, formData({ companyId: COMPANY_ID, ...CAMPOS_COLADOS })),
  },
  { clave: 'listCompanies', invocar: () => listCompaniesAction({}) },
  { clave: 'getCompany', invocar: () => getCompanyAction(COMPANY_ID) },
  { clave: 'getCompanyDeletionImpact', invocar: () => getCompanyDeletionImpactAction(COMPANY_ID) },
  { clave: 'listCompanyEvents', invocar: () => listCompanyEventsAction({ companyId: COMPANY_ID }) },
];

describe('acciones de empresas: el actor sale solo de la sesion', () => {
  it('R3: el censo cubre las ocho acciones', () => {
    expect(INVOCACIONES.map((i) => i.clave)).toEqual([...CLAVES_DE_EMPRESAS]);
  });

  it.each(INVOCACIONES)(
    'R3: $clave pasa al caso de uso el actor de getSessionUser, sin getSessionContext ni revalidatePath',
    async ({ clave, invocar }) => {
      const resultado = await invocar();

      expect(resultado).toMatchObject({ status: 'success' });
      expect(puertos.casos[clave]).toHaveBeenCalledTimes(1);
      expect(puertos.casos[clave]).toHaveBeenCalledWith(ACTOR_DE_SESION, expect.anything());
      const entrada = puertos.casos[clave].mock.calls[0]![1];
      expect(JSON.stringify(entrada)).not.toContain(OTRO_ID);
      soloSesionSinRevalidar();
    },
  );

  it.each(INVOCACIONES)(
    'R3: $clave sin sesion responde unauthorized sin tocar ningun puerto',
    async ({ clave, invocar }) => {
      getSessionUserMock.mockResolvedValue(null);

      const resultado = await invocar();

      expect(resultado).toMatchObject({ status: 'error', code: 'unauthorized' });
      expect(puertos.casos[clave]).toHaveBeenCalledWith(null, expect.anything());
      ningunPuertoTocado();
      soloSesionSinRevalidar();
    },
  );

  it.each(INVOCACIONES)(
    'R3: $clave con un usuario de sesion sin permisos responde unauthorized aunque la entrada traiga permissions',
    async ({ invocar }) => {
      getSessionUserMock.mockResolvedValue({ ...MAESTRO, permissions: [] });

      const resultado = await invocar();

      expect(resultado).toMatchObject({ status: 'error', code: 'unauthorized' });
      ningunPuertoTocado();
    },
  );
});

describe('createCompanyAction', () => {
  it('R3, R11: arma el FormData en { company, administrator } crudo y responde success con los ids y el correo', async () => {
    const resultado = await createCompanyAction(
      IDLE,
      formData({ ...CAMPOS_EMPRESA, ...CAMPOS_ADMINISTRADOR }),
    );

    expect(resultado).toEqual({
      status: 'success',
      companyId: COMPANY_ID,
      administratorId: ADMIN_ID,
      mail: 'sent',
    });
    expect(puertos.casos.createCompany).toHaveBeenCalledWith(ACTOR_DE_SESION, {
      company: {
        name: '  Quimi Cloud ',
        taxId: '900.123.456-7',
        contactEmail: 'contacto@quimi.co',
        contactPhone: '',
      },
      administrator: {
        firstNames: 'Ana',
        lastNames: 'Perez',
        birthDate: '1990-05-01',
        email: 'ana@quimi.co',
        phone: '3000000000',
        documentTypeCode: 'CC',
        documentNumber: '123456',
        username: 'ana.perez',
      },
    });
    expect(puertos.companies.createWithAdministrator).toHaveBeenCalledWith(
      expect.objectContaining({
        company: expect.objectContaining({ name: 'Quimi Cloud', contactPhone: null }),
        administrator: expect.objectContaining({ username: 'ana.perez' }),
        actorId: MAESTRO.id,
      }),
    );
    expect(puertos.issueForPendingUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ADMIN_ID, companyId: COMPANY_ID }),
    );
  });

  it('R3, R15: el correo fallido sale como mail failed dentro del exito', async () => {
    puertos.sendCredentialSetupLink.mockResolvedValue('failed');

    const resultado = await createCompanyAction(
      IDLE,
      formData({ ...CAMPOS_EMPRESA, ...CAMPOS_ADMINISTRADOR }),
    );

    expect(resultado).toMatchObject({ status: 'success', mail: 'failed' });
  });

  it('R3, R5: un campo ausente de la empresa llega como null y responde invalid_input', async () => {
    const sinIdentificacion = sinCampo(CAMPOS_EMPRESA, 'taxId');

    const resultado = await createCompanyAction(
      IDLE,
      formData({ ...sinIdentificacion, ...CAMPOS_ADMINISTRADOR }),
    );

    expect(resultado).toMatchObject({ status: 'error', code: 'invalid_input' });
    expect(puertos.casos.createCompany).toHaveBeenCalledWith(
      ACTOR_DE_SESION,
      expect.objectContaining({ company: expect.objectContaining({ taxId: null }) }),
    );
    ningunPuertoTocado();
  });

  it('R3, R12: un campo ausente del Administrador llega como null y responde invalid_input', async () => {
    const sinUsuario = sinCampo(CAMPOS_ADMINISTRADOR, 'adminUsername');

    const resultado = await createCompanyAction(IDLE, formData({ ...CAMPOS_EMPRESA, ...sinUsuario }));

    expect(resultado).toMatchObject({ status: 'error', code: 'invalid_input' });
    ningunPuertoTocado();
  });

  it('R3, R12: roleId, credential o companyId en el formulario no llegan al caso de uso', async () => {
    const resultado = await createCompanyAction(
      IDLE,
      formData({
        ...CAMPOS_EMPRESA,
        ...CAMPOS_ADMINISTRADOR,
        roleId: OTRO_ID,
        credential: 'otra-credencial',
        companyId: OTRO_ID,
        country: 'CO',
      }),
    );

    expect(resultado).toMatchObject({ status: 'success' });
    const entrada = puertos.casos.createCompany.mock.calls[0]![1] as {
      company: Record<string, unknown>;
      administrator: Record<string, unknown>;
    };
    expect(Object.keys(entrada).sort()).toEqual(['administrator', 'company']);
    expect(Object.keys(entrada.company).sort()).toEqual(
      ['contactEmail', 'contactPhone', 'name', 'taxId'].sort(),
    );
    expect(entrada.administrator).not.toHaveProperty('roleId');
    expect(entrada.administrator).not.toHaveProperty('credential');
    expect(entrada.administrator).not.toHaveProperty('companyId');
  });

  it('R3, R8: un error del caso de uso vuelve como estado de error con su code', async () => {
    puertos.companies.createWithAdministrator.mockResolvedValue('duplicate_name');

    const resultado = await createCompanyAction(
      IDLE,
      formData({ ...CAMPOS_EMPRESA, ...CAMPOS_ADMINISTRADOR }),
    );

    expect(resultado).toMatchObject({ status: 'error', code: 'company_duplicate_name' });
    expect(puertos.issueForPendingUser).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe('updateCompanyAction', () => {
  it('R3, R16: pasa companyId y los cuatro datos crudos y responde success', async () => {
    const resultado = await updateCompanyAction(
      IDLE,
      formData({ companyId: COMPANY_ID, ...CAMPOS_EMPRESA }),
    );

    expect(resultado).toEqual({ status: 'success' });
    expect(puertos.casos.updateCompany).toHaveBeenCalledWith(ACTOR_DE_SESION, {
      companyId: COMPANY_ID,
      ...CAMPOS_EMPRESA,
    });
    expect(puertos.companies.update).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_ID, actorId: MAESTRO.id }),
    );
  });

  it('R3, R5: un campo ausente responde invalid_input sin tocar el puerto', async () => {
    const sinTelefono = sinCampo(CAMPOS_EMPRESA, 'contactPhone');

    const resultado = await updateCompanyAction(
      IDLE,
      formData({ companyId: COMPANY_ID, ...sinTelefono }),
    );

    expect(resultado).toMatchObject({ status: 'error', code: 'invalid_input' });
    ningunPuertoTocado();
  });

  it('R3, R19: una empresa inexistente vuelve como company_not_found', async () => {
    puertos.companies.update.mockResolvedValue('not_found');

    const resultado = await updateCompanyAction(
      IDLE,
      formData({ companyId: COMPANY_ID, ...CAMPOS_EMPRESA }),
    );

    expect(resultado).toMatchObject({ status: 'error', code: 'company_not_found' });
  });
});

describe('deleteCompanyAction', () => {
  it('R3, R21: pasa companyId y la confirmacion y responde success', async () => {
    const resultado = await deleteCompanyAction(
      IDLE,
      formData({ companyId: COMPANY_ID, confirmationName: 'quimi cloud' }),
    );

    expect(resultado).toEqual({ status: 'success' });
    expect(puertos.casos.deleteCompany).toHaveBeenCalledWith(ACTOR_DE_SESION, {
      companyId: COMPANY_ID,
      confirmationName: 'quimi cloud',
    });
    expect(puertos.companies.softDelete).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_ID, actorId: MAESTRO.id }),
    );
  });

  it('R3, R22: una confirmacion que no coincide vuelve como company_name_mismatch', async () => {
    puertos.companies.softDelete.mockResolvedValue('name_mismatch');

    const resultado = await deleteCompanyAction(
      IDLE,
      formData({ companyId: COMPANY_ID, confirmationName: 'otra' }),
    );

    expect(resultado).toMatchObject({ status: 'error', code: 'company_name_mismatch' });
  });

  it('R3, R22: sin confirmacion responde invalid_input sin tocar el puerto', async () => {
    const resultado = await deleteCompanyAction(IDLE, formData({ companyId: COMPANY_ID }));

    expect(resultado).toMatchObject({ status: 'error', code: 'invalid_input' });
    ningunPuertoTocado();
  });
});

describe('reactivateCompanyAction', () => {
  it('R3, R26: envuelve el companyId y responde success', async () => {
    const resultado = await reactivateCompanyAction(IDLE, formData({ companyId: COMPANY_ID }));

    expect(resultado).toEqual({ status: 'success' });
    expect(puertos.casos.reactivateCompany).toHaveBeenCalledWith(ACTOR_DE_SESION, {
      companyId: COMPANY_ID,
    });
    expect(puertos.companies.reactivate).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_ID, actorId: MAESTRO.id }),
    );
  });

  it('R3, R28: una empresa viva vuelve como company_not_deleted', async () => {
    puertos.companies.reactivate.mockResolvedValue('not_deleted');

    const resultado = await reactivateCompanyAction(IDLE, formData({ companyId: COMPANY_ID }));

    expect(resultado).toMatchObject({ status: 'error', code: 'company_not_deleted' });
  });

  it('R3: sin companyId responde invalid_input sin tocar el puerto', async () => {
    const resultado = await reactivateCompanyAction(IDLE, formData({}));

    expect(resultado).toMatchObject({ status: 'error', code: 'invalid_input' });
    ningunPuertoTocado();
  });
});

describe('listCompaniesAction', () => {
  it('R3, R29: responde success con la pagina del puerto', async () => {
    const resultado = await listCompaniesAction({ search: 'quimi' });

    expect(resultado).toEqual({ status: 'success', data: PAGINA_DE_EMPRESAS });
    expect(puertos.casos.listCompanies).toHaveBeenCalledWith(ACTOR_DE_SESION, { search: 'quimi' });
    expect(puertos.companies.list).toHaveBeenCalledTimes(1);
  });

  it('R3: solo con empresas.modificar responde unauthorized', async () => {
    getSessionUserMock.mockResolvedValue({ ...MAESTRO, permissions: ['empresas.modificar'] });

    const resultado = await listCompaniesAction({});

    expect(resultado).toMatchObject({ status: 'error', code: 'unauthorized' });
    expect(puertos.companies.list).not.toHaveBeenCalled();
  });
});

describe('getCompanyAction', () => {
  it('R3, R33: envuelve el id y responde success con la ficha', async () => {
    const resultado = await getCompanyAction(COMPANY_ID);

    expect(resultado).toEqual({ status: 'success', data: FICHA });
    expect(puertos.casos.getCompany).toHaveBeenCalledWith(ACTOR_DE_SESION, { companyId: COMPANY_ID });
    expect(puertos.companies.findById).toHaveBeenCalledWith(COMPANY_ID);
  });

  it('R3, R33: una empresa inexistente vuelve como company_not_found', async () => {
    puertos.companies.findById.mockResolvedValue(null);

    const resultado = await getCompanyAction(COMPANY_ID);

    expect(resultado).toMatchObject({ status: 'error', code: 'company_not_found' });
  });
});

describe('getCompanyDeletionImpactAction', () => {
  it('R3, R20: envuelve el id y responde success con los dos contadores', async () => {
    const resultado = await getCompanyDeletionImpactAction(COMPANY_ID);

    expect(resultado).toEqual({ status: 'success', data: { liveUsers: 4, openOrders: 2 } });
    expect(puertos.casos.getCompanyDeletionImpact).toHaveBeenCalledWith(ACTOR_DE_SESION, {
      companyId: COMPANY_ID,
    });
    expect(puertos.countOpenOrders).toHaveBeenCalledWith(COMPANY_ID);
  });

  it('R3, R20: una empresa de baja o inexistente vuelve como company_not_found', async () => {
    puertos.companies.countLiveUsersOfAlive.mockResolvedValue('not_found');

    const resultado = await getCompanyDeletionImpactAction(COMPANY_ID);

    expect(resultado).toMatchObject({ status: 'error', code: 'company_not_found' });
    expect(puertos.countOpenOrders).not.toHaveBeenCalled();
  });
});

describe('listCompanyEventsAction', () => {
  it('R3, R37: responde success con la pagina del historial', async () => {
    const resultado = await listCompanyEventsAction({ companyId: COMPANY_ID, page: 2, pageSize: 5 });

    expect(resultado).toEqual({ status: 'success', data: PAGINA_DE_EVENTOS });
    expect(puertos.companies.listEvents).toHaveBeenCalledWith(COMPANY_ID, { page: 2, pageSize: 5 });
  });

  it('R3, R37: una empresa inexistente vuelve como company_not_found', async () => {
    puertos.companies.listEvents.mockResolvedValue('not_found');

    const resultado = await listCompanyEventsAction({ companyId: COMPANY_ID });

    expect(resultado).toMatchObject({ status: 'error', code: 'company_not_found' });
  });

  it('R3: una entrada sin companyId responde invalid_input sin tocar el puerto', async () => {
    const resultado = await listCompanyEventsAction({});

    expect(resultado).toMatchObject({ status: 'error', code: 'invalid_input' });
    ningunPuertoTocado();
  });
});

describe('listCompanyEventsAction: eventos de añadido', () => {
  it('R34: el evento de añadido llega al Maestro con su clave', async () => {
    const evento: CompanyEventView = {
      id: 'e1f2a3b4-0000-4000-8000-000000000002',
      kind: 'addon.disabled',
      occurredAt: new Date('2026-10-15T00:00:00.000Z'),
      actor: { id: MAESTRO.id, firstNames: 'Plataforma', lastNames: 'Inicial' },
      fields: [],
      addon: 'proveedores',
    };
    puertos.companies.listEvents.mockResolvedValue({ ...PAGINA_DE_EVENTOS, items: [evento] });

    const resultado = await listCompanyEventsAction({ companyId: COMPANY_ID });

    expect(resultado).toMatchObject({
      status: 'success',
      data: { items: [{ kind: 'addon.disabled', addon: 'proveedores', fields: [] }] },
    });
  });
});

// ---------------------------------------------------------------------------------------------
// Las tres acciones de añadidos: casos de uso reales sobre un puerto espia.
// ---------------------------------------------------------------------------------------------

const CLAVES_DE_ANADIDOS = ['getCompanyAddons', 'setCompanyAddon', 'setAllCompanyAddons'] as const;
type ClaveDeAnadidos = (typeof CLAVES_DE_ANADIDOS)[number];

type PuertosDeAnadidos = {
  findByCompany: ReturnType<typeof vi.fn<CompanyAddonRepository['findByCompany']>>;
  apply: ReturnType<typeof vi.fn<CompanyAddonRepository['apply']>>;
  casos: Record<ClaveDeAnadidos, ReturnType<typeof vi.fn<CasoDeUso>>>;
};

let anadidos: PuertosDeAnadidos;

function cablearAnadidos(): PuertosDeAnadidos {
  const findByCompany = vi.fn<CompanyAddonRepository['findByCompany']>(async () => ({
    stored: ['dashboard', 'lectura_pdf'],
    alive: true,
  }));
  const apply = vi.fn<CompanyAddonRepository['apply']>(async () => ({
    stored: ['dashboard', 'proveedores'],
    changed: [{ addon: 'proveedores', enabled: true }],
  }));
  const repo: CompanyAddonRepository = { findByCompany, apply };
  const reales: Record<ClaveDeAnadidos, CasoDeUso> = {
    getCompanyAddons: createGetCompanyAddons({ addons: repo }) as CasoDeUso,
    setCompanyAddon: createSetCompanyAddon({ addons: repo }) as CasoDeUso,
    setAllCompanyAddons: createSetAllCompanyAddons({ addons: repo }) as CasoDeUso,
  };
  const casos = {} as Record<ClaveDeAnadidos, ReturnType<typeof vi.fn<CasoDeUso>>>;
  for (const clave of CLAVES_DE_ANADIDOS) {
    casos[clave] = vi.fn<CasoDeUso>((actor, input) => reales[clave](actor, input));
    cableado.empresas[clave] = casos[clave];
  }
  return { findByCompany, apply, casos };
}

function ningunPuertoDeAnadidosTocado(): void {
  expect(anadidos.findByCompany).not.toHaveBeenCalled();
  expect(anadidos.apply).not.toHaveBeenCalled();
}

const INVOCACIONES_DE_ANADIDOS: ReadonlyArray<{
  readonly clave: ClaveDeAnadidos;
  readonly invocar: () => Promise<unknown>;
}> = [
  { clave: 'getCompanyAddons', invocar: () => getCompanyAddonsAction(COMPANY_ID) },
  {
    clave: 'setCompanyAddon',
    invocar: () =>
      setCompanyAddonAction(
        IDLE,
        formData({ companyId: COMPANY_ID, addon: 'proveedores', enabled: 'true', ...CAMPOS_COLADOS }),
      ),
  },
  {
    clave: 'setAllCompanyAddons',
    invocar: () =>
      setAllCompanyAddonsAction(IDLE, formData({ companyId: COMPANY_ID, enabled: 'true', ...CAMPOS_COLADOS })),
  },
];

describe('acciones de añadidos: el actor sale solo de la sesion', () => {
  beforeEach(() => {
    anadidos = cablearAnadidos();
  });

  it('R27, R28, R29: el censo cubre las tres acciones', () => {
    expect(INVOCACIONES_DE_ANADIDOS.map((i) => i.clave)).toEqual([...CLAVES_DE_ANADIDOS]);
  });

  it.each(INVOCACIONES_DE_ANADIDOS)(
    'R27, R28, R29: $clave pasa al caso de uso el actor de getSessionUser, sin getSessionContext ni revalidatePath',
    async ({ clave, invocar }) => {
      const resultado = await invocar();

      expect(resultado).toMatchObject({ status: 'success' });
      expect(anadidos.casos[clave]).toHaveBeenCalledTimes(1);
      expect(anadidos.casos[clave]).toHaveBeenCalledWith(ACTOR_DE_SESION, expect.anything());
      const entrada = anadidos.casos[clave].mock.calls[0]![1];
      expect(JSON.stringify(entrada)).not.toContain(OTRO_ID);
      soloSesionSinRevalidar();
    },
  );

  it.each(INVOCACIONES_DE_ANADIDOS)(
    'R30: $clave sin sesion responde unauthorized sin tocar ningun puerto',
    async ({ clave, invocar }) => {
      getSessionUserMock.mockResolvedValue(null);

      const resultado = await invocar();

      expect(resultado).toMatchObject({ status: 'error', code: 'unauthorized' });
      expect(anadidos.casos[clave]).toHaveBeenCalledWith(null, expect.anything());
      ningunPuertoDeAnadidosTocado();
      soloSesionSinRevalidar();
    },
  );

  it.each(INVOCACIONES_DE_ANADIDOS)(
    'R30: $clave con un rol de empresa (sin empresas.*) responde unauthorized sin tocar ningun puerto',
    async ({ invocar }) => {
      getSessionUserMock.mockResolvedValue({
        ...MAESTRO,
        roleName: 'Administrador',
        permissions: ['usuarios.consultar', 'usuarios.modificar', 'integraciones.modificar'],
      });

      const resultado = await invocar();

      expect(resultado).toMatchObject({ status: 'error', code: 'unauthorized' });
      ningunPuertoDeAnadidosTocado();
    },
  );
});

describe('getCompanyAddonsAction', () => {
  beforeEach(() => {
    anadidos = cablearAnadidos();
  });

  it('R27: envuelve el id y responde success con la vista de los cinco añadidos', async () => {
    const resultado = await getCompanyAddonsAction(COMPANY_ID);

    expect(resultado).toEqual({
      status: 'success',
      data: {
        companyId: COMPANY_ID,
        addons: [
          { addon: 'dashboard', enabled: true, active: true, requires: [] },
          { addon: 'proveedores', enabled: false, active: false, requires: [] },
          { addon: 'lectura_pdf', enabled: true, active: false, requires: ['integraciones'] },
          { addon: 'importacion_excel', enabled: false, active: false, requires: [] },
          { addon: 'integraciones', enabled: false, active: false, requires: [] },
        ],
      },
    });
    expect(anadidos.casos.getCompanyAddons).toHaveBeenCalledWith(ACTOR_DE_SESION, { companyId: COMPANY_ID });
    expect(anadidos.findByCompany).toHaveBeenCalledWith(COMPANY_ID);
  });

  it('R27: solo con empresas.modificar responde unauthorized', async () => {
    getSessionUserMock.mockResolvedValue({ ...MAESTRO, permissions: ['empresas.modificar'] });

    const resultado = await getCompanyAddonsAction(COMPANY_ID);

    expect(resultado).toMatchObject({ status: 'error', code: 'unauthorized' });
    ningunPuertoDeAnadidosTocado();
  });

  it('R31: una empresa inexistente vuelve como company_not_found', async () => {
    anadidos.findByCompany.mockResolvedValue(null);

    const resultado = await getCompanyAddonsAction(COMPANY_ID);

    expect(resultado).toMatchObject({ status: 'error', code: 'company_not_found' });
  });
});

describe('setCompanyAddonAction', () => {
  beforeEach(() => {
    anadidos = cablearAnadidos();
  });

  it("R28: enabled 'true' prende: pasa companyId, addon y true y responde success con la vista", async () => {
    const resultado = await setCompanyAddonAction(
      IDLE,
      formData({ companyId: COMPANY_ID, addon: 'proveedores', enabled: 'true' }),
    );

    expect(resultado).toMatchObject({ status: 'success', data: { companyId: COMPANY_ID } });
    expect(anadidos.casos.setCompanyAddon).toHaveBeenCalledWith(ACTOR_DE_SESION, {
      companyId: COMPANY_ID,
      addon: 'proveedores',
      enabled: true,
    });
    expect(anadidos.apply).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_ID, enable: ['proveedores'], actorId: MAESTRO.id }),
    );
  });

  it("R28: enabled 'false' apaga", async () => {
    const resultado = await setCompanyAddonAction(
      IDLE,
      formData({ companyId: COMPANY_ID, addon: 'dashboard', enabled: 'false' }),
    );

    expect(resultado).toMatchObject({ status: 'success' });
    expect(anadidos.apply).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_ID, disable: ['dashboard'], actorId: MAESTRO.id }),
    );
  });

  for (const enabled of ['1', '0', 'TRUE', 'on', 'si', ' true', '']) {
    it(`R28: enabled ${JSON.stringify(enabled)} responde invalid_input sin tocar el puerto`, async () => {
      const resultado = await setCompanyAddonAction(
        IDLE,
        formData({ companyId: COMPANY_ID, addon: 'dashboard', enabled }),
      );

      expect(resultado).toMatchObject({ status: 'error', code: 'invalid_input' });
      ningunPuertoDeAnadidosTocado();
    });
  }

  it('R28: sin enabled responde invalid_input sin tocar el puerto', async () => {
    const resultado = await setCompanyAddonAction(IDLE, formData({ companyId: COMPANY_ID, addon: 'dashboard' }));

    expect(resultado).toMatchObject({ status: 'error', code: 'invalid_input' });
    ningunPuertoDeAnadidosTocado();
  });

  for (const addon of ['pedidos', 'inventario', 'x']) {
    it(`R32: la clave ${addon} responde invalid_input sin tocar el puerto`, async () => {
      const resultado = await setCompanyAddonAction(
        IDLE,
        formData({ companyId: COMPANY_ID, addon, enabled: 'false' }),
      );

      expect(resultado).toMatchObject({ status: 'error', code: 'invalid_input' });
      ningunPuertoDeAnadidosTocado();
    });
  }

  it('R28: solo con empresas.consultar responde unauthorized', async () => {
    getSessionUserMock.mockResolvedValue({ ...MAESTRO, permissions: ['empresas.consultar'] });

    const resultado = await setCompanyAddonAction(
      IDLE,
      formData({ companyId: COMPANY_ID, addon: 'dashboard', enabled: 'true' }),
    );

    expect(resultado).toMatchObject({ status: 'error', code: 'unauthorized' });
    ningunPuertoDeAnadidosTocado();
  });

  it('R31: una empresa de baja o inexistente vuelve como company_not_found', async () => {
    anadidos.apply.mockResolvedValue('not_found');

    const resultado = await setCompanyAddonAction(
      IDLE,
      formData({ companyId: COMPANY_ID, addon: 'dashboard', enabled: 'true' }),
    );

    expect(resultado).toMatchObject({ status: 'error', code: 'company_not_found' });
  });
});

describe('setAllCompanyAddonsAction', () => {
  beforeEach(() => {
    anadidos = cablearAnadidos();
  });

  it("R29: enabled 'true' prende los cinco en una sola llamada al puerto", async () => {
    anadidos.apply.mockResolvedValue({ stored: [...ADDONS], changed: [] });

    const resultado = await setAllCompanyAddonsAction(
      IDLE,
      formData({ companyId: COMPANY_ID, enabled: 'true' }),
    );

    expect(resultado).toMatchObject({ status: 'success', data: { companyId: COMPANY_ID } });
    expect(anadidos.casos.setAllCompanyAddons).toHaveBeenCalledWith(ACTOR_DE_SESION, {
      companyId: COMPANY_ID,
      enabled: true,
    });
    expect(anadidos.apply).toHaveBeenCalledTimes(1);
    expect(anadidos.apply).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_ID, enable: [...ADDONS], actorId: MAESTRO.id }),
    );
  });

  it("R29: enabled 'false' apaga los cinco en una sola llamada al puerto", async () => {
    anadidos.apply.mockResolvedValue({ stored: [], changed: [] });

    const resultado = await setAllCompanyAddonsAction(
      IDLE,
      formData({ companyId: COMPANY_ID, enabled: 'false' }),
    );

    expect(resultado).toMatchObject({ status: 'success' });
    expect(anadidos.apply).toHaveBeenCalledTimes(1);
    expect(anadidos.apply).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_ID, disable: [...ADDONS], actorId: MAESTRO.id }),
    );
  });

  for (const enabled of ['1', 'yes', 'False', '']) {
    it(`R29: enabled ${JSON.stringify(enabled)} responde invalid_input sin tocar el puerto`, async () => {
      const resultado = await setAllCompanyAddonsAction(
        IDLE,
        formData({ companyId: COMPANY_ID, enabled }),
      );

      expect(resultado).toMatchObject({ status: 'error', code: 'invalid_input' });
      ningunPuertoDeAnadidosTocado();
    });
  }

  it('R31: una empresa de baja o inexistente vuelve como company_not_found', async () => {
    anadidos.apply.mockResolvedValue('not_found');

    const resultado = await setAllCompanyAddonsAction(
      IDLE,
      formData({ companyId: COMPANY_ID, enabled: 'false' }),
    );

    expect(resultado).toMatchObject({ status: 'error', code: 'company_not_found' });
  });
});
