// Prender o apagar los seis añadidos a la vez con el puerto simulado; los dobles no previstos
// fallan si se les llama.
import { describe, expect, it, vi } from 'vitest';

import {
  ADDONS,
  CompanyNotFoundError,
  createSetAllCompanyAddons,
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

function setup(resultado: Resultado = { stored: [...ADDONS], changed: [] }) {
  const apply = vi.fn<CompanyAddonRepository['apply']>(async () => resultado);
  const addons: CompanyAddonRepository = { findByCompany: noDebeLlamarse('findByCompany'), apply };
  return { setAllCompanyAddons: createSetAllCompanyAddons({ addons, now: () => NOW }), apply, addons };
}

describe('setAllCompanyAddons', () => {
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
    { como: 'entrada valida', entrada: { companyId: COMPANY_ID, enabled: true } },
    { como: 'entrada invalida', entrada: { companyId: 'x', enabled: 'si' } },
  ];

  for (const { caso, actor } of SIN_PERMISO) for (const { como, entrada } of ENTRADAS_PARA_PERMISO) {
    it(`R29, R30: ${caso}, ${como} → unauthorized, antes de validar y sin tocar el puerto`, async () => {
      const addons = repositorioQueFalla();
      const setAllCompanyAddons = createSetAllCompanyAddons({ addons, now: () => NOW });

      await expect(
        setAllCompanyAddons(actor as PlatformActor | null, entrada),
      ).rejects.toMatchObject({ code: 'unauthorized' });
      expect(addons.apply).not.toHaveBeenCalled();
      expect(addons.findByCompany).not.toHaveBeenCalled();
    });
  }

  it('R29: prender todos es UNA llamada al puerto con los seis en enable', async () => {
    const { setAllCompanyAddons, apply } = setup();

    await setAllCompanyAddons(MAESTRO, { companyId: COMPANY_ID, enabled: true });

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      enable: [...ADDONS],
      actorId: MAESTRO.id,
      now: NOW,
    });
  });

  it('R29: apagar todos es UNA llamada al puerto con los seis en disable', async () => {
    const { setAllCompanyAddons, apply } = setup({ stored: [], changed: [] });

    await setAllCompanyAddons(MAESTRO, { companyId: COMPANY_ID, enabled: false });

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      disable: [...ADDONS],
      actorId: MAESTRO.id,
      now: NOW,
    });
  });

  it('QC-137 R53: prender todos incluye notificaciones y, sin dependencias, también queda activo', async () => {
    const { setAllCompanyAddons, apply } = setup({
      stored: [...ADDONS],
      changed: ADDONS.map((addon) => ({ addon, enabled: true })),
    });

    const vista = await setAllCompanyAddons(MAESTRO, { companyId: COMPANY_ID, enabled: true });

    expect(apply.mock.calls[0]?.[0].enable).toContain('notificaciones');
    expect(vista.addons.find((a) => a.addon === 'notificaciones')).toEqual({
      addon: 'notificaciones',
      enabled: true,
      active: true,
      requires: [],
    });
  });

  it('R29: devuelve la vista actualizada: todos prendidos y activos', async () => {
    const { setAllCompanyAddons } = setup({
      stored: [...ADDONS],
      changed: ADDONS.map((addon) => ({ addon, enabled: true })),
    });

    const vista = await setAllCompanyAddons(MAESTRO, { companyId: COMPANY_ID, enabled: true });

    expect(vista.companyId).toBe(COMPANY_ID);
    expect(vista.addons.map((a) => a.addon)).toEqual([...ADDONS]);
    expect(vista.addons.every((a) => a.enabled && a.active)).toBe(true);
  });

  it('R29: devuelve la vista actualizada: todos apagados', async () => {
    const { setAllCompanyAddons } = setup({ stored: [], changed: [] });

    const vista = await setAllCompanyAddons(MAESTRO, { companyId: COMPANY_ID, enabled: false });

    expect(vista.addons.every((a) => !a.enabled && !a.active)).toBe(true);
  });

  it('R31: el puerto responde not_found (inexistente o de baja) → company_not_found', async () => {
    const { setAllCompanyAddons } = setup('not_found');

    const error = await setAllCompanyAddons(MAESTRO, { companyId: COMPANY_ID, enabled: true }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(CompanyNotFoundError);
    expect(error).toMatchObject({ code: 'company_not_found' });
  });

  const ENTRADAS_INVALIDAS: ReadonlyArray<{ caso: string; entrada: unknown }> = [
    { caso: 'companyId que no es UUID', entrada: { companyId: 'empresa-1', enabled: true } },
    { caso: 'enabled como texto', entrada: { companyId: COMPANY_ID, enabled: 'false' } },
    { caso: 'sin enabled', entrada: { companyId: COMPANY_ID } },
    { caso: 'con una clave de añadido', entrada: { companyId: COMPANY_ID, enabled: true, addon: 'pedidos' } },
    { caso: 'null', entrada: null },
  ];

  for (const { caso, entrada } of ENTRADAS_INVALIDAS) {
    it(`R32: ${caso} → invalid_input sin tocar el puerto`, async () => {
      const addons = repositorioQueFalla();
      const setAllCompanyAddons = createSetAllCompanyAddons({ addons, now: () => NOW });

      await expect(setAllCompanyAddons(MAESTRO, entrada)).rejects.toMatchObject({ code: 'invalid_input' });
      expect(addons.apply).not.toHaveBeenCalled();
    });
  }
});
