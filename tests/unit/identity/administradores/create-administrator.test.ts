// Alta de un Administrador en una empresa con el puerto simulado: validacion antes de tocar nada,
// traduccion de los resultados del puerto y envio del enlace tras el alta.
import { describe, expect, it, vi } from 'vitest';

import {
  CompanyNotFoundError,
  createCreateAdministrator,
  DuplicateDocumentError,
  DuplicateEmailError,
  DuplicateUsernameError,
} from '@/lib/modules/identity';

import type { AdministratorRepository } from '@/lib/modules/identity/ports/administrator-repository';

import {
  ADMIN_ID,
  COMPANY_ID,
  CORREO_GUARDADO,
  MAESTRO,
  NOW,
  OCHO_DATOS,
  OCHO_DATOS_ESCRITOS,
  SECRETO,
  SIETE_DIAS_MS,
  envio,
  envioIntocable,
  llamadasA,
  repositorio,
} from './administrator-doubles';

const ENTRADA = { companyId: COMPANY_ID, ...OCHO_DATOS };

type Creado = Awaited<ReturnType<AdministratorRepository['create']>>;
type OpcionesDeEnvio = NonNullable<Parameters<typeof envio>[0]>;

function setup(opciones: { creado?: Creado } & OpcionesDeEnvio = {}) {
  const create = vi.fn<AdministratorRepository['create']>(
    async () => opciones.creado ?? { administratorId: ADMIN_ID },
  );
  const dobles = envio(opciones);
  const createAdministrator = createCreateAdministrator({
    administrators: repositorio({ create }),
    secrets: dobles.secrets,
    links: dobles.links,
    mailer: dobles.mailer,
    now: () => NOW,
  });
  return { createAdministrator, alta: create, ...dobles };
}

function setupSinTocarNada() {
  const administrators = repositorio();
  const intocable = envioIntocable();
  const createAdministrator = createCreateAdministrator({
    administrators,
    ...intocable,
    now: () => NOW,
  });
  const llamadas = () => llamadasA(administrators, intocable.secrets, intocable.links, intocable.mailer);
  return { createAdministrator, llamadas };
}

describe('createAdministrator', () => {
  const ENTRADAS_INVALIDAS: ReadonlyArray<{ caso: string; entrada: unknown }> = [
    { caso: 'un roleId de Operador', entrada: { ...ENTRADA, roleId: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b' } },
    { caso: 'una contrasena', entrada: { ...ENTRADA, credential: 'Secreta123!' } },
    { caso: 'un estado de cuenta', entrada: { ...ENTRADA, accountStatus: 'active' } },
    { caso: 'sin el correo', entrada: { ...ENTRADA, email: undefined } },
    { caso: 'sin la empresa', entrada: OCHO_DATOS },
    { caso: 'la empresa no es un uuid', entrada: { ...ENTRADA, companyId: 'empresa-1' } },
    { caso: 'nombres por encima del tope', entrada: { ...ENTRADA, firstNames: 'a'.repeat(500) } },
    { caso: 'una fecha de nacimiento imposible', entrada: { ...ENTRADA, birthDate: '1990-02-31' } },
    { caso: 'un tipo de documento fuera del catalogo', entrada: { ...ENTRADA, documentTypeCode: 'ZZ' } },
  ];

  for (const { caso, entrada } of ENTRADAS_INVALIDAS) {
    it(`R13: ${caso} → invalid_input sin escribir, sin emitir enlace y sin correo`, async () => {
      const { createAdministrator, llamadas } = setupSinTocarNada();

      await expect(createAdministrator(MAESTRO, entrada)).rejects.toMatchObject({ code: 'invalid_input' });
      expect(llamadas()).toBe(0);
    });
  }

  it('R12, R14: el puerto recibe la empresa, los ocho datos con la fecha civil y el instante, sin rol', async () => {
    const { createAdministrator, alta } = setup();

    await createAdministrator(MAESTRO, ENTRADA);

    expect(alta).toHaveBeenCalledWith({ companyId: COMPANY_ID, administrator: OCHO_DATOS_ESCRITOS, now: NOW });
    const [{ administrator }] = alta.mock.calls[0]!;
    expect('roleId' in administrator).toBe(false);
  });

  it('R15: la empresa no existe o esta de baja → company_not_found sin enlace ni correo', async () => {
    const { createAdministrator, create: crearSecreto, issueForPendingUser, sendCredentialSetupLink } = setup({
      creado: 'company_not_found',
    });

    const error = await createAdministrator(MAESTRO, ENTRADA).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CompanyNotFoundError);
    expect(error).toMatchObject({ code: 'company_not_found' });
    expect(crearSecreto).toHaveBeenCalledTimes(0);
    expect(issueForPendingUser).not.toHaveBeenCalled();
    expect(sendCredentialSetupLink).not.toHaveBeenCalled();
  });

  const DUPLICADOS = [
    { clave: 'email', code: 'duplicate_email', clase: DuplicateEmailError },
    { clave: 'username', code: 'duplicate_username', clase: DuplicateUsernameError },
    { clave: 'document', code: 'duplicate_document', clase: DuplicateDocumentError },
  ] as const;

  for (const { clave, code, clase } of DUPLICADOS) {
    it(`R16: el puerto responde ${clave} → ${code} sin enlace ni correo`, async () => {
      const { createAdministrator, issueForPendingUser, sendCredentialSetupLink } = setup({ creado: clave });

      const error = await createAdministrator(MAESTRO, ENTRADA).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(clase);
      expect(error).toMatchObject({ code });
      expect(issueForPendingUser).not.toHaveBeenCalled();
      expect(sendCredentialSetupLink).not.toHaveBeenCalled();
    });
  }

  it('R13: el puerto responde invalid_document_type → invalid_input sin enlace', async () => {
    const { createAdministrator, issueForPendingUser } = setup({ creado: 'invalid_document_type' });

    await expect(createAdministrator(MAESTRO, ENTRADA)).rejects.toMatchObject({ code: 'invalid_input' });
    expect(issueForPendingUser).not.toHaveBeenCalled();
  });

  it('R17: emite el enlace para el Administrador nuevo en su empresa, con siete dias desde el alta', async () => {
    const { createAdministrator, issueForPendingUser, sendCredentialSetupLink } = setup();

    await createAdministrator(MAESTRO, ENTRADA);

    expect(issueForPendingUser).toHaveBeenCalledWith({
      userId: ADMIN_ID,
      companyId: COMPANY_ID,
      digest: 'huella',
      expiresAt: new Date(NOW.getTime() + SIETE_DIAS_MS),
      now: NOW,
    });
    expect(sendCredentialSetupLink).toHaveBeenCalledWith({ to: CORREO_GUARDADO, secret: SECRETO });
  });

  it('R17: devuelve el id del Administrador y el correo sent', async () => {
    const { createAdministrator } = setup();

    await expect(createAdministrator(MAESTRO, ENTRADA)).resolves.toEqual({
      administratorId: ADMIN_ID,
      mail: 'sent',
    });
  });

  it('R17: el correo que no sale se informa como failed y el alta no lanza', async () => {
    const { createAdministrator } = setup({ correo: 'failed' });

    await expect(createAdministrator(MAESTRO, ENTRADA)).resolves.toEqual({
      administratorId: ADMIN_ID,
      mail: 'failed',
    });
  });

  it('R17: si otra emision gano (superseded) el correo cuenta como sent y no se manda otro', async () => {
    const { createAdministrator, sendCredentialSetupLink } = setup({ emision: 'superseded' });

    await expect(createAdministrator(MAESTRO, ENTRADA)).resolves.toEqual({
      administratorId: ADMIN_ID,
      mail: 'sent',
    });
    expect(sendCredentialSetupLink).not.toHaveBeenCalled();
  });

  for (const emision of ['not_found', 'user_not_pending', 'issued'] as const) {
    it(`R17: una emision ${emision} deja el alta hecha con el correo failed`, async () => {
      const { createAdministrator, sendCredentialSetupLink } = setup({ emision });

      await expect(createAdministrator(MAESTRO, ENTRADA)).resolves.toEqual({
        administratorId: ADMIN_ID,
        mail: 'failed',
      });
      expect(sendCredentialSetupLink).not.toHaveBeenCalled();
    });
  }

  it('R17: el secreto del enlace no sale en el resultado', async () => {
    const { createAdministrator } = setup();

    const resultado = await createAdministrator(MAESTRO, ENTRADA);
    expect(JSON.stringify(resultado)).not.toContain(SECRETO);
    expect(Object.keys(resultado).sort()).toEqual(['administratorId', 'mail']);
  });

  it('R17: el secreto del enlace no sale en ningun error', async () => {
    const { createAdministrator } = setup({ creado: 'email' });

    const error = await createAdministrator(MAESTRO, ENTRADA).catch((caught: unknown) => caught);
    expect(JSON.stringify(error)).not.toContain(SECRETO);
    expect(String((error as Error).message)).not.toContain(SECRETO);
  });
});
