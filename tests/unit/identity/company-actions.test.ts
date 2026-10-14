// Server Action `setCompanyCountryAction` con la accion y el caso de uso de verdad. El unico doble
// es la composicion, como en `maestro-sin-empresa-actions.test.ts`: cablea el caso de uso real con
// un puerto espia.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSetCompanyCountry } from '@/lib/modules/identity';
import { setCompanyCountryAction } from '@/lib/modules/identity/adapters/driving/company-actions';

import type { CompanyCountryRepository } from '@/lib/modules/identity/ports/company-country-repository';

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
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

vi.mock('@/lib/composition', () => ({
  observabilidad: { readRequestIdHeader: readRequestIdHeaderMock },
  identity: {
    getSessionUser: getSessionUserMock,
    getSessionContext: getSessionContextMock,
    setCompanyCountry: vi.fn((actor: unknown, input: unknown) =>
      cableado.setCompanyCountry!(actor, input),
    ),
  },
}));

const COMPANY_ID = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';

const MAESTRO = {
  id: '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40',
  username: 'plataforma.inicial',
  displayName: 'Plataforma Inicial',
  roleName: 'Maestro',
  permissions: ['empresas.consultar', 'empresas.modificar'],
};

const IDLE = { status: 'idle' } as const;

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
