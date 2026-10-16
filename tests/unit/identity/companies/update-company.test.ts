// Edicion de empresa con el puerto simulado; los metodos no previstos fallan si se les llama.
import { describe, expect, it, vi } from 'vitest';

import {
  CompanyDuplicateNameError,
  CompanyDuplicateTaxIdError,
  CompanyNotFoundError,
  createUpdateCompany,
  type PlatformActor,
} from '@/lib/modules/identity';

import type { CompanyRepository } from '@/lib/modules/identity/ports/company-repository';

const COMPANY_ID = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';
const NOW = new Date('2026-10-14T12:00:00.000Z');

const MAESTRO: PlatformActor = {
  id: '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40',
  permissions: ['empresas.consultar', 'empresas.modificar'],
};

const ENTRADA = {
  companyId: COMPANY_ID,
  name: ' Otra Empresa ',
  taxId: ' ',
  contactEmail: 'otra@x.co',
  contactPhone: '300',
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

type Resultado = Awaited<ReturnType<CompanyRepository['update']>>;

function setup(resultado: Resultado = 'ok') {
  const update = vi.fn<CompanyRepository['update']>(async () => resultado);
  const companies = repositorio({ update });
  const updateCompany = createUpdateCompany({ companies, now: () => NOW });
  return { updateCompany, update, companies };
}

describe('updateCompany', () => {
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
      const updateCompany = createUpdateCompany({ companies, now: () => NOW });

      await expect(updateCompany(actor as PlatformActor | null, { companyId: 'x' })).rejects.toMatchObject({
        code: 'unauthorized',
      });
      expect(totalDeLlamadas(companies)).toBe(0);
    });
  }

  it('R2: un actor sin empresa con empresas.modificar queda autorizado', async () => {
    const { updateCompany, update } = setup();
    const sinEmpresa: PlatformActor = { id: MAESTRO.id, permissions: ['empresas.modificar'] };

    await expect(updateCompany(sinEmpresa, ENTRADA)).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('R16: el puerto recibe exactamente los cuatro datos, normalizados, con el actor y el instante', async () => {
    const { updateCompany, update } = setup();

    await updateCompany(MAESTRO, ENTRADA);

    expect(update).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      data: {
        name: 'Otra Empresa',
        nameNormalized: 'otraempresa',
        taxId: null,
        taxIdNormalized: null,
        contactEmail: 'otra@x.co',
        contactPhone: '300',
      },
      actorId: MAESTRO.id,
      now: NOW,
    });
  });

  for (const clave of ['country', 'deletedAt', 'createdAt']) {
    it(`R16: la entrada con ${clave} → invalid_input sin tocar el puerto`, async () => {
      const { updateCompany, companies } = setup();

      await expect(updateCompany(MAESTRO, { ...ENTRADA, [clave]: 'x' })).rejects.toMatchObject({
        code: 'invalid_input',
      });
      expect(totalDeLlamadas(companies)).toBe(0);
    });
  }

  it('R5: falta un dato → invalid_input sin tocar el puerto', async () => {
    const { updateCompany, companies } = setup();
    const incompleta: Record<string, unknown> = { ...ENTRADA };
    delete incompleta.contactPhone;

    await expect(updateCompany(MAESTRO, incompleta)).rejects.toMatchObject({ code: 'invalid_input' });
    expect(totalDeLlamadas(companies)).toBe(0);
  });

  it('R7: «---» como identificacion → invalid_input sin tocar el puerto', async () => {
    const { updateCompany, companies } = setup();

    await expect(updateCompany(MAESTRO, { ...ENTRADA, taxId: '---' })).rejects.toMatchObject({
      code: 'invalid_input',
    });
    expect(totalDeLlamadas(companies)).toBe(0);
  });

  it('R45: «!!!» como nombre → invalid_input sin tocar el puerto', async () => {
    const { updateCompany, companies } = setup();

    await expect(updateCompany(MAESTRO, { ...ENTRADA, name: '!!!' })).rejects.toMatchObject({
      code: 'invalid_input',
    });
    expect(totalDeLlamadas(companies)).toBe(0);
  });

  it('R17: la edicion se pide igual para una empresa de baja; el caso de uso no distingue', async () => {
    const { updateCompany, update } = setup('ok');

    await expect(updateCompany(MAESTRO, ENTRADA)).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('R18: sin cambios (unchanged) → exito', async () => {
    const { updateCompany } = setup('unchanged');

    await expect(updateCompany(MAESTRO, ENTRADA)).resolves.toBeUndefined();
  });

  it('R19: el puerto responde not_found → company_not_found', async () => {
    const { updateCompany } = setup('not_found');

    const error = await updateCompany(MAESTRO, ENTRADA).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CompanyNotFoundError);
    expect(error).toMatchObject({ code: 'company_not_found' });
  });

  it('R8: el puerto responde duplicate_name → company_duplicate_name', async () => {
    const { updateCompany } = setup('duplicate_name');

    await expect(updateCompany(MAESTRO, ENTRADA)).rejects.toBeInstanceOf(CompanyDuplicateNameError);
  });

  it('R9: el puerto responde duplicate_tax_id → company_duplicate_tax_id', async () => {
    const { updateCompany } = setup('duplicate_tax_id');

    await expect(updateCompany(MAESTRO, ENTRADA)).rejects.toBeInstanceOf(CompanyDuplicateTaxIdError);
  });
});
