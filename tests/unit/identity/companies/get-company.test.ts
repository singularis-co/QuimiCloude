// Ficha de empresa con el puerto simulado; los metodos no previstos fallan si se les llama.
import { describe, expect, it, vi } from 'vitest';

import {
  CompanyNotFoundError,
  createGetCompany,
  type CompanyDetail,
  type PlatformActor,
} from '@/lib/modules/identity';

import type { CompanyRepository } from '@/lib/modules/identity/ports/company-repository';

const COMPANY_ID = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';

const MAESTRO: PlatformActor = {
  id: '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40',
  permissions: ['empresas.consultar', 'empresas.modificar'],
};

const VIVA: CompanyDetail = {
  id: COMPANY_ID,
  name: 'QuimiCloud',
  taxId: '900',
  contactEmail: 'a@b.co',
  contactPhone: null,
  country: 'CO',
  createdAt: new Date('2026-09-04T00:00:00.000Z'),
  status: 'active',
  deletedAt: null,
};

const DE_BAJA: CompanyDetail = {
  ...VIVA,
  status: 'deleted',
  deletedAt: new Date('2026-10-01T00:00:00.000Z'),
};

function noDebeLlamarse(nombre: string) {
  return vi.fn(async () => {
    throw new Error(`no debe llamarse: ${nombre}`);
  });
}

function repositorio(overrides: Partial<CompanyRepository> = {}): CompanyRepository {
  return {
    createWithAdministrator: noDebeLlamarse('createWithAdministrator'),
    update: noDebeLlamarse('update'),
    softDelete: noDebeLlamarse('softDelete'),
    reactivate: noDebeLlamarse('reactivate'),
    list: noDebeLlamarse('list'),
    findById: noDebeLlamarse('findById'),
    countLiveUsersOfAlive: noDebeLlamarse('countLiveUsersOfAlive'),
    listEvents: noDebeLlamarse('listEvents'),
    ...overrides,
  };
}

function totalDeLlamadas(companies: CompanyRepository): number {
  return Object.values(companies).reduce(
    (total, fn) => total + (fn as ReturnType<typeof vi.fn>).mock.calls.length,
    0,
  );
}

function setup(detalle: CompanyDetail | null = VIVA) {
  const findById = vi.fn<CompanyRepository['findById']>(async () => detalle);
  const companies = repositorio({ findById });
  return { getCompany: createGetCompany({ companies }), findById, companies };
}

describe('getCompany', () => {
  const SIN_PERMISO: ReadonlyArray<{ caso: string; actor: unknown }> = [
    { caso: 'actor null', actor: null },
    { caso: 'actor undefined', actor: undefined },
    { caso: 'sin conjunto de permisos', actor: { id: MAESTRO.id } },
    { caso: 'conjunto vacio', actor: { id: MAESTRO.id, permissions: [] } },
    { caso: 'solo empresas.modificar', actor: { id: MAESTRO.id, permissions: ['empresas.modificar'] } },
  ];

  for (const { caso, actor } of SIN_PERMISO) {
    it(`R1: ${caso} → unauthorized, antes de validar y sin tocar ningun puerto`, async () => {
      const companies = repositorio();
      const getCompany = createGetCompany({ companies });

      await expect(getCompany(actor as PlatformActor | null, { companyId: 'x' })).rejects.toMatchObject({
        code: 'unauthorized',
      });
      expect(totalDeLlamadas(companies)).toBe(0);
    });
  }

  it('R2: un actor sin empresa con empresas.consultar queda autorizado', async () => {
    const { getCompany, findById } = setup();
    const sinEmpresa: PlatformActor = { id: MAESTRO.id, permissions: ['empresas.consultar'] };

    await expect(getCompany(sinEmpresa, { companyId: COMPANY_ID })).resolves.toEqual(VIVA);
    expect(findById).toHaveBeenCalledWith(COMPANY_ID);
  });

  it('R33: devuelve la ficha de una empresa viva', async () => {
    const { getCompany } = setup(VIVA);

    await expect(getCompany(MAESTRO, { companyId: COMPANY_ID })).resolves.toEqual(VIVA);
  });

  it('R33: devuelve la ficha de una empresa de baja con su fecha de baja', async () => {
    const { getCompany } = setup(DE_BAJA);

    await expect(getCompany(MAESTRO, { companyId: COMPANY_ID })).resolves.toEqual(DE_BAJA);
  });

  it('R33: inexistente → company_not_found', async () => {
    const { getCompany } = setup(null);

    await expect(getCompany(MAESTRO, { companyId: COMPANY_ID })).rejects.toBeInstanceOf(CompanyNotFoundError);
  });

  it('R33: id que no es UUID → invalid_input sin tocar el puerto', async () => {
    const { getCompany, companies } = setup();

    await expect(getCompany(MAESTRO, { companyId: 'empresa-1' })).rejects.toMatchObject({
      code: 'invalid_input',
    });
    expect(totalDeLlamadas(companies)).toBe(0);
  });
});
