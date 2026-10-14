// Historial de una empresa con el puerto simulado; los metodos no previstos fallan si se les llama.
import { describe, expect, it, vi } from 'vitest';

import {
  CompanyNotFoundError,
  createListCompanyEvents,
  type CompanyEventView,
  type PlatformActor,
} from '@/lib/modules/identity';

import type { Page } from '@/lib/modules/identity/domain/page';
import type { CompanyRepository } from '@/lib/modules/identity/ports/company-repository';

const COMPANY_ID = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';

const MAESTRO: PlatformActor = {
  id: '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40',
  permissions: ['empresas.consultar', 'empresas.modificar'],
};

const PAGINA: Page<CompanyEventView> = {
  items: [
    {
      id: 'e1',
      kind: 'module.enabled',
      occurredAt: new Date('2026-10-14T12:00:00.000Z'),
      actor: { id: MAESTRO.id, firstNames: 'Maestro', lastNames: 'Plataforma' },
      fields: [],
    },
    {
      id: 'e0',
      kind: 'company.updated',
      occurredAt: new Date('2026-10-13T12:00:00.000Z'),
      actor: { id: MAESTRO.id, firstNames: 'Maestro', lastNames: 'Plataforma' },
      fields: ['name', 'taxId'],
    },
  ],
  total: 2,
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

function totalDeLlamadas(companies: CompanyRepository): number {
  return Object.values(companies).reduce(
    (total, fn) => total + (fn as ReturnType<typeof vi.fn>).mock.calls.length,
    0,
  );
}

function setup(resultado: Page<CompanyEventView> | 'not_found' = PAGINA) {
  const listEvents = vi.fn<CompanyRepository['listEvents']>(async () => resultado);
  const companies = repositorio({ listEvents });
  return { listCompanyEvents: createListCompanyEvents({ companies }), listEvents, companies };
}

describe('listCompanyEvents', () => {
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
      const listCompanyEvents = createListCompanyEvents({ companies });

      await expect(listCompanyEvents(actor as PlatformActor | null, { companyId: 'x' })).rejects.toMatchObject({
        code: 'unauthorized',
      });
      expect(totalDeLlamadas(companies)).toBe(0);
    });
  }

  it('R2: un actor sin empresa con empresas.consultar queda autorizado', async () => {
    const { listCompanyEvents, listEvents } = setup();
    const sinEmpresa: PlatformActor = { id: MAESTRO.id, permissions: ['empresas.consultar'] };

    await expect(listCompanyEvents(sinEmpresa, { companyId: COMPANY_ID })).resolves.toBe(PAGINA);
    expect(listEvents).toHaveBeenCalledTimes(1);
  });

  it('R37: sin pagina pedida, el puerto recibe la pagina sin fijar (el defecto es del adaptador)', async () => {
    const { listCompanyEvents, listEvents } = setup();

    await listCompanyEvents(MAESTRO, { companyId: COMPANY_ID });

    expect(listEvents).toHaveBeenCalledWith(COMPANY_ID, { page: undefined, pageSize: undefined });
  });

  it('R37: la pagina y el tamano pedidos llegan al puerto', async () => {
    const { listCompanyEvents, listEvents } = setup();

    await listCompanyEvents(MAESTRO, { companyId: COMPANY_ID, page: 3, pageSize: 25 });

    expect(listEvents).toHaveBeenCalledWith(COMPANY_ID, { page: 3, pageSize: 25 });
  });

  it('R37: devuelve los eventos tal como los ordena el puerto, con tipos que esta lista no conoce', async () => {
    const { listCompanyEvents } = setup();

    const pagina = await listCompanyEvents(MAESTRO, { companyId: COMPANY_ID });
    expect(pagina.items.map((evento) => evento.kind)).toEqual(['module.enabled', 'company.updated']);
    expect(pagina.items[1]?.fields).toEqual(['name', 'taxId']);
  });

  it('R37: inexistente → company_not_found', async () => {
    const { listCompanyEvents } = setup('not_found');

    await expect(listCompanyEvents(MAESTRO, { companyId: COMPANY_ID })).rejects.toBeInstanceOf(
      CompanyNotFoundError,
    );
  });

  it('R37: entrada invalida (pagina 0, clave extra) → invalid_input sin tocar el puerto', async () => {
    const { listCompanyEvents, companies } = setup();

    await expect(listCompanyEvents(MAESTRO, { companyId: COMPANY_ID, page: 0 })).rejects.toMatchObject({
      code: 'invalid_input',
    });
    await expect(listCompanyEvents(MAESTRO, { companyId: COMPANY_ID, kind: 'x' })).rejects.toMatchObject({
      code: 'invalid_input',
    });
    expect(totalDeLlamadas(companies)).toBe(0);
  });
});
