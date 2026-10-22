// Impacto de la baja con los dos puertos simulados; los metodos no previstos fallan si se les llama.
import { describe, expect, it, vi } from 'vitest';

import {
  CompanyNotFoundError,
  createGetCompanyDeletionImpact,
  type PlatformActor,
} from '@/lib/modules/identity';

import type { CompanyOpenOrdersCounter } from '@/lib/modules/identity/ports/company-open-orders-counter';
import type { CompanyRepository } from '@/lib/modules/identity/ports/company-repository';

const COMPANY_ID = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';

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

function totalDeLlamadas(...puertos: object[]): number {
  return puertos
    .flatMap((puerto) => Object.values(puerto))
    .reduce((total, fn) => total + (fn as ReturnType<typeof vi.fn>).mock.calls.length, 0);
}

function setup(usuarios: number | 'not_found' = 4, pedidos = 7) {
  const countLiveUsersOfAlive = vi.fn<CompanyRepository['countLiveUsersOfAlive']>(async () => usuarios);
  const countOpenOrders = vi.fn<CompanyOpenOrdersCounter['countOpenOrders']>(async () => pedidos);
  const companies = repositorio({ countLiveUsersOfAlive });
  const openOrders = { countOpenOrders };
  const getCompanyDeletionImpact = createGetCompanyDeletionImpact({ companies, openOrders });
  return { getCompanyDeletionImpact, countLiveUsersOfAlive, countOpenOrders, companies, openOrders };
}

describe('getCompanyDeletionImpact', () => {
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
      const openOrders = { countOpenOrders: noDebeLlamarse('countOpenOrders') };
      const getCompanyDeletionImpact = createGetCompanyDeletionImpact({ companies, openOrders });

      await expect(
        getCompanyDeletionImpact(actor as PlatformActor | null, { companyId: 'x' }),
      ).rejects.toMatchObject({ code: 'unauthorized' });
      expect(totalDeLlamadas(companies, openOrders)).toBe(0);
    });
  }

  it('R2: un actor sin empresa con empresas.consultar queda autorizado', async () => {
    const { getCompanyDeletionImpact } = setup();
    const sinEmpresa: PlatformActor = { id: MAESTRO.id, permissions: ['empresas.consultar'] };

    await expect(getCompanyDeletionImpact(sinEmpresa, { companyId: COMPANY_ID })).resolves.toEqual({
      liveUsers: 4,
      openOrders: 7,
    });
  });

  it('R20: devuelve los usuarios vivos y los pedidos en curso, contados sobre esa empresa', async () => {
    const { getCompanyDeletionImpact, countLiveUsersOfAlive, countOpenOrders } = setup(2, 0);

    await expect(getCompanyDeletionImpact(MAESTRO, { companyId: COMPANY_ID })).resolves.toEqual({
      liveUsers: 2,
      openOrders: 0,
    });
    expect(countLiveUsersOfAlive).toHaveBeenCalledWith(COMPANY_ID);
    expect(countOpenOrders).toHaveBeenCalledWith(COMPANY_ID);
  });

  it('R20: inexistente o de baja → company_not_found, sin contar pedidos', async () => {
    const { getCompanyDeletionImpact, countOpenOrders } = setup('not_found');

    await expect(getCompanyDeletionImpact(MAESTRO, { companyId: COMPANY_ID })).rejects.toBeInstanceOf(
      CompanyNotFoundError,
    );
    expect(countOpenOrders).not.toHaveBeenCalled();
  });

  it('R20: id que no es UUID → invalid_input sin tocar ningun puerto', async () => {
    const { getCompanyDeletionImpact, companies, openOrders } = setup();

    await expect(getCompanyDeletionImpact(MAESTRO, { companyId: 'empresa-1' })).rejects.toMatchObject({
      code: 'invalid_input',
    });
    expect(totalDeLlamadas(companies, openOrders)).toBe(0);
  });
});
