// Reenvio del enlace a un Administrador por el Maestro, con los puertos simulados: la emision usa
// la empresa del Administrador y el correo guardado, y la entrada no puede elegir ninguno de los dos.
import { describe, expect, it, vi } from 'vitest';

import {
  createResendAdministratorLink,
  UserNotFoundError,
  UserNotPendingError,
  type PlatformActor,
} from '@/lib/modules/identity';

import type { AdministratorDetail } from '@/lib/modules/identity';
import type { AdministratorRepository } from '@/lib/modules/identity/ports/administrator-repository';

import {
  ADMIN_ID,
  COMPANY_ID,
  CORREO_GUARDADO,
  FICHA,
  MAESTRO,
  NOW,
  OTRA_EMPRESA_ID,
  SECRETO,
  SIETE_DIAS_MS,
  envio,
  envioIntocable,
  llamadasA,
  repositorio,
} from './administrator-doubles';

type OpcionesDeEnvio = NonNullable<Parameters<typeof envio>[0]>;

function setup(opciones: { ficha?: AdministratorDetail | null } & OpcionesDeEnvio = {}) {
  const findManageable = vi.fn<AdministratorRepository['findManageable']>(async () =>
    opciones.ficha === undefined ? FICHA : opciones.ficha,
  );
  const dobles = envio(opciones);
  const resend = createResendAdministratorLink({
    administrators: repositorio({ findManageable }),
    secrets: dobles.secrets,
    links: dobles.links,
    mailer: dobles.mailer,
    now: () => NOW,
  });
  return { resend, findManageable, ...dobles };
}

function setupSinTocarNada() {
  const administrators = repositorio();
  const intocable = envioIntocable();
  const resend = createResendAdministratorLink({ administrators, ...intocable, now: () => NOW });
  const llamadas = () => llamadasA(administrators, intocable.secrets, intocable.links, intocable.mailer);
  return { resend, llamadas };
}

describe('resendAdministratorLink', () => {
  it('R26: emite el enlace para la empresa del Administrador, con siete dias desde el reenvio', async () => {
    const { resend, findManageable, issueForPendingUser } = setup();

    await resend(MAESTRO, { id: ADMIN_ID });

    expect(findManageable).toHaveBeenCalledWith(ADMIN_ID);
    expect(issueForPendingUser).toHaveBeenCalledTimes(1);
    expect(issueForPendingUser).toHaveBeenCalledWith({
      userId: ADMIN_ID,
      companyId: COMPANY_ID,
      digest: 'huella',
      expiresAt: new Date(NOW.getTime() + SIETE_DIAS_MS),
      now: NOW,
    });
  });

  it('R26: la empresa de la emision es la del Administrador aunque sea otra cualquiera', async () => {
    const { resend, issueForPendingUser } = setup({
      ficha: { ...FICHA, company: { id: OTRA_EMPRESA_ID, name: 'Otra' } },
    });

    await resend(MAESTRO, { id: ADMIN_ID });

    expect(issueForPendingUser).toHaveBeenCalledWith(expect.objectContaining({ companyId: OTRA_EMPRESA_ID }));
  });

  it('R26: un actor sin empresa con empresas.modificar reenvia', async () => {
    const { resend, issueForPendingUser } = setup();
    const sinEmpresa: PlatformActor = { id: MAESTRO.id, permissions: ['empresas.modificar'] };

    await expect(resend(sinEmpresa, { id: ADMIN_ID })).resolves.toEqual({ mail: 'sent' });
    expect('companyId' in sinEmpresa).toBe(false);
    expect(issueForPendingUser).toHaveBeenCalledWith(expect.objectContaining({ companyId: COMPANY_ID }));
  });

  it('R26: el correo va a la direccion que resuelve la emision, no a una de la entrada', async () => {
    const { resend, sendCredentialSetupLink } = setup();

    await resend(MAESTRO, { id: ADMIN_ID });

    expect(sendCredentialSetupLink).toHaveBeenCalledWith({ to: CORREO_GUARDADO, secret: SECRETO });
  });

  it('R27: devuelve sent cuando el correo sale', async () => {
    const { resend } = setup();

    await expect(resend(MAESTRO, { id: ADMIN_ID })).resolves.toEqual({ mail: 'sent' });
  });

  it('R27: el correo que no sale se informa como failed y la operacion no lanza', async () => {
    const { resend, issueForPendingUser } = setup({ correo: 'failed' });

    await expect(resend(MAESTRO, { id: ADMIN_ID })).resolves.toEqual({ mail: 'failed' });
    expect(issueForPendingUser).toHaveBeenCalledTimes(1);
  });

  it('R27: si otra emision simultanea gano (superseded) responde sent sin mandar un segundo correo', async () => {
    const { resend, sendCredentialSetupLink } = setup({ emision: 'superseded' });

    await expect(resend(MAESTRO, { id: ADMIN_ID })).resolves.toEqual({ mail: 'sent' });
    expect(sendCredentialSetupLink).not.toHaveBeenCalled();
  });

  it('R27: ni el secreto ni el correo del destinatario salen en el resultado', async () => {
    const { resend } = setup();

    const resultado = await resend(MAESTRO, { id: ADMIN_ID });
    expect(Object.keys(resultado)).toEqual(['mail']);
    expect(JSON.stringify(resultado)).not.toContain(SECRETO);
    expect(JSON.stringify(resultado)).not.toContain(CORREO_GUARDADO);
  });

  it('R28: el Administrador no es gestionable → user_not_found sin emitir ni enviar', async () => {
    const { resend, create, issueForPendingUser, sendCredentialSetupLink } = setup({ ficha: null });

    const error = await resend(MAESTRO, { id: ADMIN_ID }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(UserNotFoundError);
    expect(error).toMatchObject({ code: 'user_not_found' });
    expect(create).not.toHaveBeenCalled();
    expect(issueForPendingUser).not.toHaveBeenCalled();
    expect(sendCredentialSetupLink).not.toHaveBeenCalled();
  });

  it('R28: la emision responde not_found → user_not_found sin correo', async () => {
    const { resend, sendCredentialSetupLink } = setup({ emision: 'not_found' });

    await expect(resend(MAESTRO, { id: ADMIN_ID })).rejects.toBeInstanceOf(UserNotFoundError);
    expect(sendCredentialSetupLink).not.toHaveBeenCalled();
  });

  it('R28: el Administrador ya no esta en pending → user_not_pending sin correo', async () => {
    const { resend, sendCredentialSetupLink } = setup({ emision: 'user_not_pending' });

    const error = await resend(MAESTRO, { id: ADMIN_ID }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(UserNotPendingError);
    expect(error).toMatchObject({ code: 'user_not_pending' });
    expect(sendCredentialSetupLink).not.toHaveBeenCalled();
  });

  it('R27, R28: ningun error lleva el secreto ni el correo del destinatario', async () => {
    for (const emision of ['not_found', 'user_not_pending'] as const) {
      const { resend } = setup({ emision });
      const error = await resend(MAESTRO, { id: ADMIN_ID }).catch((caught: unknown) => caught);
      const texto = `${JSON.stringify(error)} ${(error as Error).message}`;
      expect(texto).not.toContain(SECRETO);
      expect(texto).not.toContain(CORREO_GUARDADO);
    }
  });

  for (const id of ['no-es-un-uuid', '']) {
    it(`R28: un id que no es identificador valido («${id}») → user_not_found sin tocar ningun puerto`, async () => {
      const { resend, llamadas } = setupSinTocarNada();

      await expect(resend(MAESTRO, { id })).rejects.toMatchObject({ code: 'user_not_found' });
      expect(llamadas()).toBe(0);
    });
  }

  const CLAVES_DE_MAS: ReadonlyArray<{ caso: string; entrada: unknown }> = [
    { caso: 'un correo de destino', entrada: { id: ADMIN_ID, email: 'otro@ajeno.co' } },
    { caso: 'una empresa', entrada: { id: ADMIN_ID, companyId: OTRA_EMPRESA_ID } },
    { caso: 'un correo y un id mal formado', entrada: { id: 'x', to: 'otro@ajeno.co' } },
  ];

  for (const { caso, entrada } of CLAVES_DE_MAS) {
    it(`R29: la entrada con ${caso} → invalid_input sin emitir ni enviar`, async () => {
      const { resend, llamadas } = setupSinTocarNada();

      await expect(resend(MAESTRO, entrada)).rejects.toMatchObject({ code: 'invalid_input' });
      expect(llamadas()).toBe(0);
    });
  }

  for (const { caso, entrada } of [
    { caso: 'sin id', entrada: {} },
    { caso: 'un id que no es texto', entrada: { id: 42 } },
    { caso: 'una entrada que no es un objeto', entrada: ADMIN_ID },
  ]) {
    it(`R29: ${caso} → invalid_input sin emitir ni enviar`, async () => {
      const { resend, llamadas } = setupSinTocarNada();

      await expect(resend(MAESTRO, entrada)).rejects.toMatchObject({ code: 'invalid_input' });
      expect(llamadas()).toBe(0);
    });
  }
});
