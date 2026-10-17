// Baja de un Administrador con el puerto simulado: lo que llega al puerto y la traduccion de lo que
// responde. La guarda del ultimo con bloqueo y el sello de sesiones los cubre la integracion.
import { describe, expect, it, vi } from 'vitest';

import {
  CompanyLastAdministratorError,
  createDeleteAdministrator,
  LastAdministratorError,
  UserNotFoundError,
} from '@/lib/modules/identity';

import type { AdministratorRepository } from '@/lib/modules/identity/ports/administrator-repository';

import { ADMIN_ID, MAESTRO, NOW, repositorio } from './administrator-doubles';

type Resultado = Awaited<ReturnType<AdministratorRepository['softDelete']>>;

function setup(resultado: Resultado = 'ok') {
  const softDelete = vi.fn<AdministratorRepository['softDelete']>(async () => resultado);
  const deleteAdministrator = createDeleteAdministrator({
    administrators: repositorio({ softDelete }),
    now: () => NOW,
  });
  return { deleteAdministrator, softDelete };
}

describe('deleteAdministrator', () => {
  it('R22: pide la baja logica del Administrador con el instante y no devuelve nada', async () => {
    const { deleteAdministrator, softDelete } = setup();

    await expect(deleteAdministrator(MAESTRO, { id: ADMIN_ID })).resolves.toBeUndefined();
    expect(softDelete).toHaveBeenCalledTimes(1);
    expect(softDelete).toHaveBeenCalledWith({ id: ADMIN_ID, now: NOW });
  });

  it('R23: el puerto responde last_administrator → company_last_administrator', async () => {
    const { deleteAdministrator } = setup('last_administrator');

    const error = await deleteAdministrator(MAESTRO, { id: ADMIN_ID }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CompanyLastAdministratorError);
    expect(error).toMatchObject({ code: 'company_last_administrator' });
  });

  it('R23: el codigo es propio y distinto de last_administrator', async () => {
    const { deleteAdministrator } = setup('last_administrator');

    const error = await deleteAdministrator(MAESTRO, { id: ADMIN_ID }).catch((caught: unknown) => caught);
    expect(error).not.toBeInstanceOf(LastAdministratorError);
    expect(error).not.toMatchObject({ code: 'last_administrator' });
  });

  it('R25: el objetivo no es gestionable (el puerto responde not_found) → user_not_found', async () => {
    const { deleteAdministrator } = setup('not_found');

    const error = await deleteAdministrator(MAESTRO, { id: ADMIN_ID }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(UserNotFoundError);
    expect(error).toMatchObject({ code: 'user_not_found' });
  });

  for (const entrada of [{ id: 'no-es-un-uuid' }, { id: '' }, {}]) {
    it(`R25: un identificador invalido (${JSON.stringify(entrada)}) → user_not_found sin tocar el puerto`, async () => {
      const { deleteAdministrator, softDelete } = setup();

      await expect(deleteAdministrator(MAESTRO, entrada)).rejects.toMatchObject({ code: 'user_not_found' });
      expect(softDelete).not.toHaveBeenCalled();
    });
  }
});
