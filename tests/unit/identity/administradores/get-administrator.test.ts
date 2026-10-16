// Ficha de un Administrador con el puerto simulado. Que el puerto responda null para cada caso no
// gestionable (de baja, otro rol, Maestro, empresa de baja) lo cubre la integracion.
import { describe, expect, it, vi } from 'vitest';

import { createGetAdministrator, UserNotFoundError } from '@/lib/modules/identity';

import type { AdministratorRepository } from '@/lib/modules/identity/ports/administrator-repository';

import { ADMIN_ID, FICHA, MAESTRO, repositorio } from './administrator-doubles';

function setup(ficha: Awaited<ReturnType<AdministratorRepository['findManageable']>> = FICHA) {
  const findManageable = vi.fn<AdministratorRepository['findManageable']>(async () => ficha);
  const getAdministrator = createGetAdministrator({ administrators: repositorio({ findManageable }) });
  return { getAdministrator, findManageable };
}

const CLAVES_DE_LA_FICHA = [
  'accountStatus',
  'accountStatusChangedAt',
  'birthDate',
  'company',
  'createdAt',
  'documentNumber',
  'documentTypeCode',
  'email',
  'firstNames',
  'id',
  'isLastAdministrator',
  'lastNames',
  'phone',
  'updatedAt',
  'username',
];

describe('getAdministrator', () => {
  it('R10: pide al puerto el Administrador gestionable por su id y devuelve su ficha', async () => {
    const { getAdministrator, findManageable } = setup();

    await expect(getAdministrator(MAESTRO, { id: ADMIN_ID })).resolves.toEqual(FICHA);
    expect(findManageable).toHaveBeenCalledWith(ADMIN_ID);
  });

  it('R10: la ficha lleva los ocho datos, la empresa, el estado, las fechas y la marca de ultimo, y nada mas', async () => {
    const { getAdministrator } = setup();

    const ficha = await getAdministrator(MAESTRO, { id: ADMIN_ID });

    expect(Object.keys(ficha).sort()).toEqual(CLAVES_DE_LA_FICHA);
    expect(Object.keys(ficha.company).sort()).toEqual(['id', 'name']);
  });

  it('R11: el puerto no lo encuentra (no gestionable) → user_not_found', async () => {
    const { getAdministrator } = setup(null);

    const error = await getAdministrator(MAESTRO, { id: ADMIN_ID }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(UserNotFoundError);
    expect(error).toMatchObject({ code: 'user_not_found' });
  });

  for (const id of ['no-es-un-uuid', '', '1a2b3c4d']) {
    it(`R11: un id que no es identificador valido («${id}») → user_not_found, no invalid_input, sin tocar el puerto`, async () => {
      const { getAdministrator, findManageable } = setup();

      await expect(getAdministrator(MAESTRO, { id })).rejects.toMatchObject({ code: 'user_not_found' });
      expect(findManageable).not.toHaveBeenCalled();
    });
  }

  it('R11: la respuesta para un id mal formado es la misma que para uno inexistente', async () => {
    const mal = await setup().getAdministrator(MAESTRO, { id: 'x' }).catch((caught: unknown) => caught);
    const ausente = await setup(null)
      .getAdministrator(MAESTRO, { id: ADMIN_ID })
      .catch((caught: unknown) => caught);

    expect(mal).toBeInstanceOf(UserNotFoundError);
    expect(ausente).toBeInstanceOf(UserNotFoundError);
    expect((mal as Error).message).toBe((ausente as Error).message);
  });
});
