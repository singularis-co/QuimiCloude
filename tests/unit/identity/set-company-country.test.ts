// Caso de uso `setCompanyCountry` con el puerto simulado: autorizacion, validacion y traduccion del
// resultado del puerto. La escritura real la cubre `company-country.int.test.ts`.
import { describe, expect, it, vi } from 'vitest';

import {
  CompanyNotFoundError,
  createSetCompanyCountry,
  type PlatformActor,
} from '@/lib/modules/identity';

import type { CompanyCountryRepository } from '@/lib/modules/identity/ports/company-country-repository';

const COMPANY_ID = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';

const MAESTRO: PlatformActor = {
  id: '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40',
  permissions: ['empresas.consultar', 'empresas.modificar'],
};

const NOW = new Date('2026-10-14T12:00:00.000Z');

function setup(outcome: 'ok' | 'not_found' = 'ok') {
  const setCountryOfAlive = vi.fn<CompanyCountryRepository['setCountryOfAlive']>(
    async () => outcome,
  );
  const setCompanyCountry = createSetCompanyCountry({
    companies: { setCountryOfAlive },
    now: () => NOW,
  });
  return { setCompanyCountry, setCountryOfAlive };
}

describe('setCompanyCountry', () => {
  it('R2: un codigo de la lista llega tal cual al puerto', async () => {
    const { setCompanyCountry, setCountryOfAlive } = setup();

    await expect(
      setCompanyCountry(MAESTRO, { companyId: COMPANY_ID, country: 'CO' }),
    ).resolves.toBeUndefined();

    expect(setCountryOfAlive).toHaveBeenCalledTimes(1);
    expect(setCountryOfAlive).toHaveBeenCalledWith(COMPANY_ID, 'CO', MAESTRO.id, NOW);
  });

  it('R3: el valor vacio llega al puerto como null', async () => {
    const { setCompanyCountry, setCountryOfAlive } = setup();

    await setCompanyCountry(MAESTRO, { companyId: COMPANY_ID, country: '' });

    expect(setCountryOfAlive).toHaveBeenCalledWith(COMPANY_ID, null, MAESTRO.id, NOW);
  });

  const SIN_PERMISO: ReadonlyArray<{ caso: string; actor: unknown }> = [
    { caso: 'actor null', actor: null },
    { caso: 'actor undefined', actor: undefined },
    { caso: 'sin conjunto de permisos', actor: { id: MAESTRO.id } },
    { caso: 'conjunto vacio', actor: { id: MAESTRO.id, permissions: [] } },
    { caso: 'solo empresas.consultar', actor: { id: MAESTRO.id, permissions: ['empresas.consultar'] } },
  ];

  for (const { caso, actor } of SIN_PERMISO) {
    it(`R4: ${caso} → unauthorized, antes de validar y sin llamar al puerto`, async () => {
      const { setCompanyCountry, setCountryOfAlive } = setup();

      // La entrada es invalida a proposito: si se validara antes, el codigo seria `invalid_input`.
      await expect(
        setCompanyCountry(actor as PlatformActor | null, { companyId: 'no-uuid', country: 'zz' }),
      ).rejects.toMatchObject({ code: 'unauthorized' });

      expect(setCountryOfAlive).not.toHaveBeenCalled();
    });
  }

  it('R5: un actor sin empresa con empresas.modificar queda autorizado', async () => {
    const { setCompanyCountry, setCountryOfAlive } = setup();
    const sinEmpresa: PlatformActor = { id: MAESTRO.id, permissions: ['empresas.modificar'] };

    await expect(
      setCompanyCountry(sinEmpresa, { companyId: COMPANY_ID, country: 'MX' }),
    ).resolves.toBeUndefined();

    expect('companyId' in sinEmpresa).toBe(false);
    expect(setCountryOfAlive).toHaveBeenCalledWith(COMPANY_ID, 'MX', sinEmpresa.id, NOW);
  });

  for (const country of ['co', ' CO', 'CO ', 'COL', 'ZZ']) {
    it(`R6: el pais ${JSON.stringify(country)} → invalid_input sin llamar al puerto`, async () => {
      const { setCompanyCountry, setCountryOfAlive } = setup();

      await expect(
        setCompanyCountry(MAESTRO, { companyId: COMPANY_ID, country }),
      ).rejects.toMatchObject({ code: 'invalid_input' });

      expect(setCountryOfAlive).not.toHaveBeenCalled();
    });
  }

  const ENTRADAS_INCOMPLETAS: ReadonlyArray<{ caso: string; input: unknown }> = [
    { caso: 'pais null', input: { companyId: COMPANY_ID, country: null } },
    { caso: 'pais ausente', input: { companyId: COMPANY_ID } },
    { caso: 'companyId ausente', input: { country: 'CO' } },
    { caso: 'companyId null', input: { companyId: null, country: 'CO' } },
    { caso: 'companyId no UUID', input: { companyId: 'empresa-1', country: 'CO' } },
  ];

  for (const { caso, input } of ENTRADAS_INCOMPLETAS) {
    it(`R7: ${caso} → invalid_input sin llamar al puerto`, async () => {
      const { setCompanyCountry, setCountryOfAlive } = setup();

      await expect(setCompanyCountry(MAESTRO, input)).rejects.toMatchObject({
        code: 'invalid_input',
      });

      expect(setCountryOfAlive).not.toHaveBeenCalled();
    });
  }

  it('R8: si el puerto responde not_found → company_not_found', async () => {
    const { setCompanyCountry } = setup('not_found');

    const error = await setCompanyCountry(MAESTRO, { companyId: COMPANY_ID, country: 'CO' }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(CompanyNotFoundError);
    expect(error).toMatchObject({ code: 'company_not_found' });
  });

  it('R36 (QC-162): el puerto recibe el id del actor y el instante, para el evento del historial', async () => {
    const { setCompanyCountry, setCountryOfAlive } = setup();
    const otro: PlatformActor = {
      id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
      permissions: ['empresas.modificar'],
    };

    await setCompanyCountry(otro, { companyId: COMPANY_ID, country: 'PE' });

    expect(setCountryOfAlive).toHaveBeenCalledTimes(1);
    expect(setCountryOfAlive.mock.calls[0]?.[2]).toBe(otro.id);
    expect(setCountryOfAlive.mock.calls[0]?.[3]).toBe(NOW);
  });
});
