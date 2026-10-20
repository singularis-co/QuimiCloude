// Edicion de un Administrador con el puerto simulado: lo que llega al puerto y la traduccion de lo
// que responde. Que el UPDATE no toque otras columnas lo cubre la integracion.
import { describe, expect, it, vi } from 'vitest';

import {
  createUpdateAdministrator,
  DuplicateDocumentError,
  DuplicateEmailError,
  DuplicateUsernameError,
  UserNotFoundError,
} from '@/lib/modules/identity';

import type { AdministratorRepository } from '@/lib/modules/identity/ports/administrator-repository';

import { ADMIN_ID, MAESTRO, NOW, OCHO_DATOS, OCHO_DATOS_ESCRITOS, repositorio } from './administrator-doubles';

const ENTRADA = { id: ADMIN_ID, ...OCHO_DATOS };

type Resultado = Awaited<ReturnType<AdministratorRepository['update']>>;

function setup(resultado: Resultado = 'ok') {
  const update = vi.fn<AdministratorRepository['update']>(async () => resultado);
  const updateAdministrator = createUpdateAdministrator({
    administrators: repositorio({ update }),
    now: () => NOW,
  });
  return { updateAdministrator, update };
}

describe('updateAdministrator', () => {
  it('R18: el puerto recibe el id y exactamente los ocho datos, con la fecha civil, y el instante', async () => {
    const { updateAdministrator, update } = setup();

    await expect(updateAdministrator(MAESTRO, ENTRADA)).resolves.toBeUndefined();

    expect(update).toHaveBeenCalledWith({ id: ADMIN_ID, data: OCHO_DATOS_ESCRITOS, now: NOW });
    const [{ data }] = update.mock.calls[0]!;
    expect(Object.keys(data).sort()).toEqual(Object.keys(OCHO_DATOS).sort());
  });

  it('R18: los textos llegan recortados, con las mismas reglas del alta', async () => {
    const { updateAdministrator, update } = setup();

    await updateAdministrator(MAESTRO, { ...ENTRADA, firstNames: '  Ana  ', username: ' ana.perez ' });

    const [{ data }] = update.mock.calls[0]!;
    expect(data.firstNames).toBe('Ana');
    expect(data.username).toBe('ana.perez');
  });

  for (const clave of ['companyId', 'roleId', 'credential', 'accountStatus'] as const) {
    it(`R19: la edicion con ${clave} → invalid_input sin tocar el puerto`, async () => {
      const { updateAdministrator, update } = setup();

      await expect(updateAdministrator(MAESTRO, { ...ENTRADA, [clave]: 'x' })).rejects.toMatchObject({
        code: 'invalid_input',
      });
      expect(update).not.toHaveBeenCalled();
    });
  }

  it('R19: sin uno de los ocho datos → invalid_input sin tocar el puerto', async () => {
    const { updateAdministrator, update } = setup();
    const sinTelefono: Record<string, unknown> = { ...ENTRADA };
    delete sinTelefono.phone;

    await expect(updateAdministrator(MAESTRO, sinTelefono)).rejects.toMatchObject({ code: 'invalid_input' });
    expect(update).not.toHaveBeenCalled();
  });

  it('R18: el puerto responde invalid_document_type → invalid_input', async () => {
    const { updateAdministrator } = setup('invalid_document_type');

    await expect(updateAdministrator(MAESTRO, ENTRADA)).rejects.toMatchObject({ code: 'invalid_input' });
  });

  it('R20: el objetivo no es gestionable (el puerto responde not_found) → user_not_found', async () => {
    const { updateAdministrator } = setup('not_found');

    const error = await updateAdministrator(MAESTRO, ENTRADA).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(UserNotFoundError);
    expect(error).toMatchObject({ code: 'user_not_found' });
  });

  const DUPLICADOS = [
    { clave: 'email', code: 'duplicate_email', clase: DuplicateEmailError },
    { clave: 'username', code: 'duplicate_username', clase: DuplicateUsernameError },
    { clave: 'document', code: 'duplicate_document', clase: DuplicateDocumentError },
  ] as const;

  for (const { clave, code, clase } of DUPLICADOS) {
    it(`R21: el puerto responde ${clave} → ${code}`, async () => {
      const { updateAdministrator } = setup(clave);

      const error = await updateAdministrator(MAESTRO, ENTRADA).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(clase);
      expect(error).toMatchObject({ code });
    });
  }
});
