// Reactivacion de empresa con el puerto simulado; los metodos no previstos fallan si se les llama.
import { describe, expect, it, vi } from 'vitest';

import {
  CompanyDuplicateNameError,
  CompanyDuplicateTaxIdError,
  CompanyNotDeletedError,
  CompanyNotFoundError,
  createReactivateCompany,
  type PlatformActor,
} from '@/lib/modules/identity';

import type { CompanyRepository } from '@/lib/modules/identity/ports/company-repository';

const COMPANY_ID = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';
const NOW = new Date('2026-10-14T12:00:00.000Z');

const MAESTRO: PlatformActor = {
  id: '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40',
  permissions: ['empresas.consultar', 'empresas.modificar'],
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

function setup(resultado: Awaited<ReturnType<CompanyRepository['reactivate']>> = 'ok') {
  const reactivate = vi.fn<CompanyRepository['reactivate']>(async () => resultado);
  const companies = repositorio({ reactivate });
  const reactivateCompany = createReactivateCompany({ companies, now: () => NOW });
  return { reactivateCompany, reactivate, companies };
}

describe('reactivateCompany', () => {
  const SIN_PERMISO: ReadonlyArray<{ caso: string; actor: unknown }> = [
    { caso: 'actor null', actor: null },
    { caso: 'actor undefined', actor: undefined },
    { caso: 'sin conjunto de permisos', actor: { id: MAESTRO.id } },
    { caso: 'conjunto vacio', actor: { id: MAESTRO.id, permissions: [] } },
    { caso: 'solo empresas.consultar', actor: { id: MAESTRO.id, permissions: ['empresas.consultar'] } },
  ];

  for (const { caso, actor } of SIN_PERMISO) {
    it(`R1: ${caso} → unauthorized, antes de validar y sin tocar ningun puerto`, async () => {
      const companies = repositorio();
      const reactivateCompany = createReactivateCompany({ companies, now: () => NOW });

      await expect(reactivateCompany(actor as PlatformActor | null, {})).rejects.toMatchObject({
        code: 'unauthorized',
      });
      expect(totalDeLlamadas(companies)).toBe(0);
    });
  }

  it('R2: un actor sin empresa con empresas.modificar queda autorizado', async () => {
    const { reactivateCompany, reactivate } = setup();
    const sinEmpresa: PlatformActor = { id: MAESTRO.id, permissions: ['empresas.modificar'] };

    await expect(reactivateCompany(sinEmpresa, { companyId: COMPANY_ID })).resolves.toBeUndefined();
    expect(reactivate).toHaveBeenCalledTimes(1);
  });

  it('R26: el puerto recibe solo el id, el actor y el instante', async () => {
    const { reactivateCompany, reactivate } = setup();

    await reactivateCompany(MAESTRO, { companyId: COMPANY_ID });

    expect(reactivate).toHaveBeenCalledWith({ companyId: COMPANY_ID, actorId: MAESTRO.id, now: NOW });
  });

  it('R26: la entrada no admite datos nuevos ni estado de cuenta', async () => {
    const { reactivateCompany, companies } = setup();

    await expect(
      reactivateCompany(MAESTRO, { companyId: COMPANY_ID, name: 'Otra' }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(
      reactivateCompany(MAESTRO, { companyId: COMPANY_ID, accountStatus: 'active' }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(totalDeLlamadas(companies)).toBe(0);
  });

  it('R27: nombre tomado por otra viva → company_duplicate_name', async () => {
    const { reactivateCompany } = setup('duplicate_name');

    await expect(reactivateCompany(MAESTRO, { companyId: COMPANY_ID })).rejects.toBeInstanceOf(
      CompanyDuplicateNameError,
    );
  });

  it('R27: identificacion tomada por otra viva → company_duplicate_tax_id', async () => {
    const { reactivateCompany } = setup('duplicate_tax_id');

    await expect(reactivateCompany(MAESTRO, { companyId: COMPANY_ID })).rejects.toBeInstanceOf(
      CompanyDuplicateTaxIdError,
    );
  });

  it('R28: inexistente → company_not_found', async () => {
    const { reactivateCompany } = setup('not_found');

    await expect(reactivateCompany(MAESTRO, { companyId: COMPANY_ID })).rejects.toMatchObject({
      code: 'company_not_found',
    });
    await expect(reactivateCompany(MAESTRO, { companyId: COMPANY_ID })).rejects.toBeInstanceOf(
      CompanyNotFoundError,
    );
  });

  it('R28: viva → company_not_deleted', async () => {
    const { reactivateCompany } = setup('not_deleted');

    const error = await reactivateCompany(MAESTRO, { companyId: COMPANY_ID }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CompanyNotDeletedError);
    expect(error).toMatchObject({ code: 'company_not_deleted' });
  });

  it('R28: id que no es UUID → invalid_input sin tocar el puerto', async () => {
    const { reactivateCompany, companies } = setup();

    await expect(reactivateCompany(MAESTRO, { companyId: 'empresa-1' })).rejects.toMatchObject({
      code: 'invalid_input',
    });
    expect(totalDeLlamadas(companies)).toBe(0);
  });
});
