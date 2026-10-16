// Baja de empresa con el puerto simulado; los metodos no previstos fallan si se les llama.
import { describe, expect, it, vi } from 'vitest';

import {
  CompanyNameMismatchError,
  CompanyNotFoundError,
  createDeleteCompany,
  type PlatformActor,
} from '@/lib/modules/identity';

import type { CompanyRepository } from '@/lib/modules/identity/ports/company-repository';

const COMPANY_ID = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';
const NOW = new Date('2026-10-14T12:00:00.000Z');

const MAESTRO: PlatformActor = {
  id: '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40',
  permissions: ['empresas.consultar', 'empresas.modificar'],
};

const ENTRADA = { companyId: COMPANY_ID, confirmationName: ' Quími cloud ' };

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

function setup(resultado: Awaited<ReturnType<CompanyRepository['softDelete']>> = 'ok') {
  const softDelete = vi.fn<CompanyRepository['softDelete']>(async () => resultado);
  const companies = repositorio({ softDelete });
  const deleteCompany = createDeleteCompany({ companies, now: () => NOW });
  return { deleteCompany, softDelete, companies };
}

describe('deleteCompany', () => {
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
      const deleteCompany = createDeleteCompany({ companies, now: () => NOW });

      await expect(deleteCompany(actor as PlatformActor | null, {})).rejects.toMatchObject({
        code: 'unauthorized',
      });
      expect(totalDeLlamadas(companies)).toBe(0);
    });
  }

  it('R2: un actor sin empresa con empresas.modificar queda autorizado', async () => {
    const { deleteCompany, softDelete } = setup();
    const sinEmpresa: PlatformActor = { id: MAESTRO.id, permissions: ['empresas.modificar'] };

    await expect(deleteCompany(sinEmpresa, ENTRADA)).resolves.toBeUndefined();
    expect(softDelete).toHaveBeenCalledTimes(1);
  });

  it('R21: el puerto recibe la confirmacion en forma normalizada, el actor y el instante', async () => {
    const { deleteCompany, softDelete } = setup();

    await deleteCompany(MAESTRO, ENTRADA);

    expect(softDelete).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      confirmationNormalized: 'quimicloud',
      actorId: MAESTRO.id,
      now: NOW,
    });
  });

  it('R22: el puerto responde name_mismatch → company_name_mismatch', async () => {
    const { deleteCompany } = setup('name_mismatch');

    const error = await deleteCompany(MAESTRO, ENTRADA).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CompanyNameMismatchError);
    expect(error).toMatchObject({ code: 'company_name_mismatch' });
  });

  for (const { caso, input } of [
    { caso: 'falta la confirmacion', input: { companyId: COMPANY_ID } },
    { caso: 'confirmacion vacia', input: { companyId: COMPANY_ID, confirmationName: '' } },
    { caso: 'confirmacion solo con espacios', input: { companyId: COMPANY_ID, confirmationName: '   ' } },
  ]) {
    it(`R22: ${caso} → invalid_input sin tocar el puerto`, async () => {
      const { deleteCompany, companies } = setup();

      await expect(deleteCompany(MAESTRO, input)).rejects.toMatchObject({ code: 'invalid_input' });
      expect(totalDeLlamadas(companies)).toBe(0);
    });
  }

  it('R23: el puerto responde not_found (inexistente o ya de baja) → company_not_found', async () => {
    const { deleteCompany } = setup('not_found');

    await expect(deleteCompany(MAESTRO, ENTRADA)).rejects.toBeInstanceOf(CompanyNotFoundError);
  });
});
