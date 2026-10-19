// Lista de empresas con el puerto simulado: permiso, saneado contra la lista blanca y log.
import { describe, expect, it, vi } from 'vitest';

import { createListCompanies, type CompanyRow, type PlatformActor } from '@/lib/modules/identity';

import type { Page } from '@/lib/modules/identity/domain/page';
import type { CompanyRepository } from '@/lib/modules/identity/ports/company-repository';
import type { ListQueryLog } from '@/lib/modules/identity/ports/list-query-log';

const MAESTRO: PlatformActor = {
  id: '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40',
  permissions: ['empresas.consultar', 'empresas.modificar'],
};

const PAGINA: Page<CompanyRow> = {
  items: [
    {
      id: '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13',
      name: 'QuimiCloud',
      taxId: '900',
      country: 'CO',
      liveUserCount: 3,
      createdAt: new Date('2026-09-04T00:00:00.000Z'),
      status: 'active',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 10,
  totalPages: 1,
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

function setup() {
  const list = vi.fn<CompanyRepository['list']>(async () => PAGINA);
  const ignoredFields = vi.fn<ListQueryLog['ignoredFields']>();
  const companies = repositorio({ list });
  const listCompanies = createListCompanies({ companies, log: { ignoredFields } });
  return { listCompanies, list, ignoredFields, companies };
}

function setupSinTocarNada() {
  const companies = repositorio();
  const ignoredFields = vi.fn(() => {
    throw new Error('no debe llamarse: log');
  });
  const listCompanies = createListCompanies({ companies, log: { ignoredFields } });
  const llamadas = () =>
    [...Object.values(companies), ignoredFields].reduce(
      (total, fn) => total + (fn as ReturnType<typeof vi.fn>).mock.calls.length,
      0,
    );
  return { listCompanies, llamadas };
}

describe('listCompanies', () => {
  const SIN_PERMISO: ReadonlyArray<{ caso: string; actor: unknown }> = [
    { caso: 'actor null', actor: null },
    { caso: 'actor undefined', actor: undefined },
    { caso: 'sin conjunto de permisos', actor: { id: MAESTRO.id } },
    { caso: 'conjunto vacio', actor: { id: MAESTRO.id, permissions: [] } },
    { caso: 'solo empresas.modificar', actor: { id: MAESTRO.id, permissions: ['empresas.modificar'] } },
  ];

  for (const { caso, actor } of SIN_PERMISO) {
    it(`R1: ${caso} → unauthorized, antes de validar y sin tocar ningun puerto`, async () => {
      const { listCompanies, llamadas } = setupSinTocarNada();

      await expect(listCompanies(actor as PlatformActor | null, { page: 0 })).rejects.toMatchObject({
        code: 'unauthorized',
      });
      expect(llamadas()).toBe(0);
    });
  }

  it('R2: un actor sin empresa con empresas.consultar queda autorizado', async () => {
    const { listCompanies, list } = setup();
    const sinEmpresa: PlatformActor = { id: MAESTRO.id, permissions: ['empresas.consultar'] };

    await expect(listCompanies(sinEmpresa, {})).resolves.toBe(PAGINA);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('R29: devuelve la pagina del puerto tal cual', async () => {
    const { listCompanies } = setup();

    await expect(listCompanies(MAESTRO, {})).resolves.toEqual(PAGINA);
  });

  it('R30, R32: una consulta vacia llega al puerto con los defectos y sin filtros', async () => {
    const { listCompanies, list, ignoredFields } = setup();

    await listCompanies(MAESTRO, {});

    expect(list).toHaveBeenCalledWith({ page: 1, sort: null, filters: {}, search: '' });
    expect(ignoredFields).toHaveBeenCalledWith('companies', []);
  });

  it('R30, R31: el filtro de estado y la busqueda llegan al puerto', async () => {
    const { listCompanies, list } = setup();

    await listCompanies(MAESTRO, {
      filters: { status: { kind: 'select', values: ['active', 'deleted'] } },
      search: ' quimi ',
    });

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { status: { kind: 'select', values: ['active', 'deleted'] } },
        search: 'quimi',
      }),
    );
  });

  it('R32: orden y filtros no declarados se ignoran sin fallar y se registran con el nombre companies', async () => {
    const { listCompanies, list, ignoredFields } = setup();

    await listCompanies(MAESTRO, {
      page: 2,
      pageSize: 25,
      sort: { columnId: 'deletedAt', direction: 'asc' },
      filters: { country: { kind: 'select', values: ['CO'] } },
    });

    expect(list).toHaveBeenCalledWith({ page: 2, pageSize: 25, sort: null, filters: {}, search: '' });
    expect(ignoredFields).toHaveBeenCalledTimes(1);
    const [nombre, campos] = ignoredFields.mock.calls[0] as [string, readonly string[]];
    expect(nombre).toBe('companies');
    expect([...campos].sort()).toEqual(['country', 'deletedAt']);
  });

  it('R32: el orden por nombre o por fecha de alta llega al puerto', async () => {
    const { listCompanies, list } = setup();

    await listCompanies(MAESTRO, { sort: { columnId: 'createdAt', direction: 'desc' } });

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ sort: { columnId: 'createdAt', direction: 'desc' } }),
    );
  });

  it('R32: una consulta con forma invalida → invalid_input sin tocar el puerto', async () => {
    const { listCompanies, list } = setup();

    await expect(listCompanies(MAESTRO, { page: 0 })).rejects.toMatchObject({ code: 'invalid_input' });
    expect(list).not.toHaveBeenCalled();
  });
});
