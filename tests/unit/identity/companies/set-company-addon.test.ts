// Prender o apagar un añadido con el puerto simulado; los dobles no previstos fallan si se les
// llama.
import { describe, expect, it, vi } from 'vitest';

import {
  ADDONS,
  CORE_PERMISSIONS,
  CompanyNotFoundError,
  createSetCompanyAddon,
  type PlatformActor,
} from '@/lib/modules/identity';

import type { CompanyAddonRepository } from '@/lib/modules/identity/ports/company-addon-repository';

const COMPANY_ID = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';
const NOW = new Date('2026-10-15T12:00:00.000Z');

const MAESTRO: PlatformActor = {
  id: '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40',
  permissions: ['empresas.consultar', 'empresas.modificar'],
};

type Resultado = Awaited<ReturnType<CompanyAddonRepository['apply']>>;

function noDebeLlamarse(nombre: string) {
  return vi.fn(async () => {
    throw new Error(`no debe llamarse: ${nombre}`);
  });
}

function repositorioQueFalla(): CompanyAddonRepository {
  return { findByCompany: noDebeLlamarse('findByCompany'), apply: noDebeLlamarse('apply') };
}

function setup(resultado: Resultado = { stored: ['proveedores'], changed: [{ addon: 'proveedores', enabled: true }] }) {
  const apply = vi.fn<CompanyAddonRepository['apply']>(async () => resultado);
  const addons: CompanyAddonRepository = { findByCompany: noDebeLlamarse('findByCompany'), apply };
  return { setCompanyAddon: createSetCompanyAddon({ addons, now: () => NOW }), apply, addons };
}

describe('setCompanyAddon', () => {
  const SIN_PERMISO: ReadonlyArray<{ caso: string; actor: unknown }> = [
    { caso: 'sin sesion (null)', actor: null },
    { caso: 'actor undefined', actor: undefined },
    { caso: 'sin conjunto de permisos', actor: { id: MAESTRO.id } },
    { caso: 'conjunto vacio', actor: { id: MAESTRO.id, permissions: [] } },
    { caso: 'solo empresas.consultar', actor: { id: MAESTRO.id, permissions: ['empresas.consultar'] } },
    {
      caso: 'rol de empresa (Administrador)',
      actor: { id: MAESTRO.id, permissions: ['usuarios.modificar', 'integraciones.modificar'] },
    },
  ];

  const ENTRADAS_PARA_PERMISO: ReadonlyArray<{ como: string; entrada: unknown }> = [
    { como: 'entrada valida', entrada: { companyId: COMPANY_ID, addon: 'dashboard', enabled: true } },
    { como: 'entrada invalida', entrada: { companyId: 'x', addon: 'pedidos', enabled: 'si' } },
  ];

  for (const { caso, actor } of SIN_PERMISO) for (const { como, entrada } of ENTRADAS_PARA_PERMISO) {
    it(`R28, R30: ${caso}, ${como} → unauthorized, antes de validar y sin tocar el puerto`, async () => {
      const addons = repositorioQueFalla();
      const setCompanyAddon = createSetCompanyAddon({ addons, now: () => NOW });

      await expect(
        setCompanyAddon(actor as PlatformActor | null, entrada),
      ).rejects.toMatchObject({ code: 'unauthorized' });
      expect(addons.apply).not.toHaveBeenCalled();
      expect(addons.findByCompany).not.toHaveBeenCalled();
    });
  }

  it('R28: prender pide al puerto enable con la clave, el actor y el instante', async () => {
    const { setCompanyAddon, apply } = setup();

    await setCompanyAddon(MAESTRO, { companyId: COMPANY_ID, addon: 'proveedores', enabled: true });

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      enable: ['proveedores'],
      actorId: MAESTRO.id,
      now: NOW,
    });
  });

  it('R28: apagar pide al puerto disable con la clave', async () => {
    const { setCompanyAddon, apply } = setup({ stored: [], changed: [{ addon: 'integraciones', enabled: false }] });

    await setCompanyAddon(MAESTRO, { companyId: COMPANY_ID, addon: 'integraciones', enabled: false });

    expect(apply).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      disable: ['integraciones'],
      actorId: MAESTRO.id,
      now: NOW,
    });
  });

  it('R28: devuelve la vista ya actualizada con lo que guardo el puerto', async () => {
    const { setCompanyAddon } = setup({
      stored: ['lectura_pdf', 'integraciones'],
      changed: [{ addon: 'integraciones', enabled: true }],
    });

    const vista = await setCompanyAddon(MAESTRO, { companyId: COMPANY_ID, addon: 'integraciones', enabled: true });

    expect(vista.companyId).toBe(COMPANY_ID);
    expect(vista.addons.map((a) => a.addon)).toEqual([...ADDONS]);
    expect(vista.addons.find((a) => a.addon === 'lectura_pdf')).toEqual({
      addon: 'lectura_pdf',
      enabled: true,
      active: true,
      requires: ['integraciones'],
    });
    expect(vista.addons.find((a) => a.addon === 'dashboard')).toMatchObject({ enabled: false, active: false });
  });

  it('R28: sin cambios en el puerto tambien es exito', async () => {
    const { setCompanyAddon } = setup({ stored: ['dashboard'], changed: [] });

    await expect(
      setCompanyAddon(MAESTRO, { companyId: COMPANY_ID, addon: 'dashboard', enabled: true }),
    ).resolves.toMatchObject({ companyId: COMPANY_ID });
  });

  it('R28: basta empresas.modificar', async () => {
    const { setCompanyAddon, apply } = setup();
    const soloModificar: PlatformActor = { id: MAESTRO.id, permissions: ['empresas.modificar'] };

    await setCompanyAddon(soloModificar, { companyId: COMPANY_ID, addon: 'proveedores', enabled: true });

    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('R31: el puerto responde not_found (inexistente o de baja) → company_not_found', async () => {
    const { setCompanyAddon } = setup('not_found');

    const error = await setCompanyAddon(MAESTRO, { companyId: COMPANY_ID, addon: 'dashboard', enabled: true }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(CompanyNotFoundError);
    expect(error).toMatchObject({ code: 'company_not_found' });
  });

  // Claves del nucleo (por modulo y por permiso) e inventadas.
  const CLAVES_INVALIDAS = ['pedidos', 'inventario', 'usuarios', 'x', '', 'DASHBOARD', ' dashboard', ...CORE_PERMISSIONS];

  for (const addon of CLAVES_INVALIDAS) {
    it(`R32: la clave ${JSON.stringify(addon)} → invalid_input sin tocar el puerto`, async () => {
      const addons = repositorioQueFalla();
      const setCompanyAddon = createSetCompanyAddon({ addons, now: () => NOW });

      await expect(setCompanyAddon(MAESTRO, { companyId: COMPANY_ID, addon, enabled: false })).rejects.toMatchObject({
        code: 'invalid_input',
      });
      expect(addons.apply).not.toHaveBeenCalled();
    });
  }

  const ENTRADAS_INVALIDAS: ReadonlyArray<{ caso: string; entrada: unknown }> = [
    { caso: 'companyId que no es UUID', entrada: { companyId: 'empresa-1', addon: 'dashboard', enabled: true } },
    { caso: 'enabled como texto', entrada: { companyId: COMPANY_ID, addon: 'dashboard', enabled: 'true' } },
    { caso: 'sin enabled', entrada: { companyId: COMPANY_ID, addon: 'dashboard' } },
    { caso: 'sin addon', entrada: { companyId: COMPANY_ID, enabled: true } },
    { caso: 'campo extra', entrada: { companyId: COMPANY_ID, addon: 'dashboard', enabled: true, actorId: 'x' } },
    { caso: 'null', entrada: null },
  ];

  for (const { caso, entrada } of ENTRADAS_INVALIDAS) {
    it(`R32: ${caso} → invalid_input sin tocar el puerto`, async () => {
      const addons = repositorioQueFalla();
      const setCompanyAddon = createSetCompanyAddon({ addons, now: () => NOW });

      await expect(setCompanyAddon(MAESTRO, entrada)).rejects.toMatchObject({ code: 'invalid_input' });
      expect(addons.apply).not.toHaveBeenCalled();
    });
  }
});
