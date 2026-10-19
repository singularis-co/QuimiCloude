// Lectura de los añadidos de una empresa con el puerto simulado; los dobles no previstos fallan si
// se les llama.
import { describe, expect, it, vi } from 'vitest';

import {
  ADDONS,
  CompanyNotFoundError,
  createGetCompanyAddons,
  type CompanyAddonsView,
  type PlatformActor,
} from '@/lib/modules/identity';

import type { CompanyAddonRepository } from '@/lib/modules/identity/ports/company-addon-repository';

const COMPANY_ID = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';

const MAESTRO: PlatformActor = {
  id: '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40',
  permissions: ['empresas.consultar', 'empresas.modificar'],
};

type Encontrado = Awaited<ReturnType<CompanyAddonRepository['findByCompany']>>;

function noDebeLlamarse(nombre: string) {
  return vi.fn(async () => {
    throw new Error(`no debe llamarse: ${nombre}`);
  });
}

function repositorioQueFalla(): CompanyAddonRepository {
  return { findByCompany: noDebeLlamarse('findByCompany'), apply: noDebeLlamarse('apply') };
}

function setup(encontrado: Encontrado) {
  const findByCompany = vi.fn<CompanyAddonRepository['findByCompany']>(async () => encontrado);
  const addons: CompanyAddonRepository = { findByCompany, apply: noDebeLlamarse('apply') };
  return { getCompanyAddons: createGetCompanyAddons({ addons }), findByCompany, addons };
}

describe('getCompanyAddons', () => {
  const SIN_PERMISO: ReadonlyArray<{ caso: string; actor: unknown }> = [
    { caso: 'sin sesion (null)', actor: null },
    { caso: 'actor undefined', actor: undefined },
    { caso: 'sin conjunto de permisos', actor: { id: MAESTRO.id } },
    { caso: 'conjunto vacio', actor: { id: MAESTRO.id, permissions: [] } },
    { caso: 'solo empresas.modificar', actor: { id: MAESTRO.id, permissions: ['empresas.modificar'] } },
    {
      caso: 'rol de empresa (Administrador)',
      actor: { id: MAESTRO.id, permissions: ['usuarios.consultar', 'usuarios.modificar', 'dashboard.consultar'] },
    },
  ];

  for (const { caso, actor } of SIN_PERMISO) {
    it(`R27, R30: ${caso} → unauthorized, antes de validar y sin tocar el puerto`, async () => {
      const addons = repositorioQueFalla();
      const getCompanyAddons = createGetCompanyAddons({ addons });

      await expect(getCompanyAddons(actor as PlatformActor | null, { companyId: 'x' })).rejects.toMatchObject({
        code: 'unauthorized',
      });
      expect(addons.findByCompany).not.toHaveBeenCalled();
      expect(addons.apply).not.toHaveBeenCalled();
    });
  }

  it('R27: devuelve por cada añadido, en el orden del catalogo, su interruptor, si esta activo y de que depende', async () => {
    const { getCompanyAddons, findByCompany } = setup({
      stored: ['lectura_pdf', 'dashboard', 'clave-vieja'],
      alive: true,
    });

    const vista = await getCompanyAddons(MAESTRO, { companyId: COMPANY_ID });

    expect(findByCompany).toHaveBeenCalledWith(COMPANY_ID);
    expect(vista).toEqual<CompanyAddonsView>({
      companyId: COMPANY_ID,
      addons: [
        { addon: 'dashboard', enabled: true, active: true, requires: [] },
        { addon: 'proveedores', enabled: false, active: false, requires: [] },
        // R4: el interruptor de la lectura esta prendido, pero sin integraciones no es activo.
        { addon: 'lectura_pdf', enabled: true, active: false, requires: ['integraciones'] },
        { addon: 'importacion_excel', enabled: false, active: false, requires: [] },
        { addon: 'integraciones', enabled: false, active: false, requires: [] },
        { addon: 'notificaciones', enabled: false, active: false, requires: [] },
      ],
    });
    expect(vista.addons.map((a) => a.addon)).toEqual([...ADDONS]);
  });

  it('R27: con los seis prendidos, los seis son activos', async () => {
    const { getCompanyAddons } = setup({ stored: [...ADDONS], alive: true });

    const vista = await getCompanyAddons(MAESTRO, { companyId: COMPANY_ID });

    expect(vista.addons.every((a) => a.enabled && a.active)).toBe(true);
  });

  it('R27: una empresa de baja tambien se lee', async () => {
    const { getCompanyAddons } = setup({ stored: ['proveedores'], alive: false });

    const vista = await getCompanyAddons(MAESTRO, { companyId: COMPANY_ID });

    expect(vista.addons.find((a) => a.addon === 'proveedores')).toMatchObject({ enabled: true, active: true });
  });

  it('R27: basta empresas.consultar', async () => {
    const { getCompanyAddons } = setup({ stored: [], alive: true });
    const soloConsultar: PlatformActor = { id: MAESTRO.id, permissions: ['empresas.consultar'] };

    await expect(getCompanyAddons(soloConsultar, { companyId: COMPANY_ID })).resolves.toMatchObject({
      companyId: COMPANY_ID,
    });
  });

  it('R31: empresa inexistente → company_not_found', async () => {
    const { getCompanyAddons } = setup(null);

    const error = await getCompanyAddons(MAESTRO, { companyId: COMPANY_ID }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CompanyNotFoundError);
    expect(error).toMatchObject({ code: 'company_not_found' });
  });

  for (const entrada of [{ companyId: 'empresa-1' }, {}, { companyId: COMPANY_ID, extra: 1 }, null]) {
    it(`R27: entrada ${JSON.stringify(entrada)} → invalid_input sin tocar el puerto`, async () => {
      const addons = repositorioQueFalla();
      const getCompanyAddons = createGetCompanyAddons({ addons });

      await expect(getCompanyAddons(MAESTRO, entrada)).rejects.toMatchObject({ code: 'invalid_input' });
      expect(addons.findByCompany).not.toHaveBeenCalled();
    });
  }
});
