// Alta de empresa con su primer Administrador, con puertos simulados que fallan si se les llama
// sin estar previstos. La escritura atomica real la cubre `company.int.test.ts`.
import { describe, expect, it, vi } from 'vitest';

import {
  CompanyDuplicateNameError,
  CompanyDuplicateTaxIdError,
  createCreateCompany,
  type PlatformActor,
} from '@/lib/modules/identity';

import type { CompanyRepository } from '@/lib/modules/identity/ports/company-repository';
import type { CredentialSetupLinkRepository } from '@/lib/modules/identity/ports/credential-setup-link-repository';
import type { CredentialSetupMailer } from '@/lib/modules/identity/ports/credential-setup-mailer';
import type { CredentialSetupSecretFactory } from '@/lib/modules/identity/ports/credential-setup-secret-factory';

const COMPANY_ID = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';
const ADMIN_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const NOW = new Date('2026-10-14T12:00:00.000Z');
const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
const SECRETO = 'secreto-del-enlace';

const MAESTRO: PlatformActor = {
  id: '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40',
  permissions: ['empresas.consultar', 'empresas.modificar'],
};

const EMPRESA = {
  name: '  Quími Cloud ',
  taxId: '900.123.456-7',
  contactEmail: 'Contacto@Quimi.co',
  contactPhone: '',
};

const ADMINISTRADOR = {
  firstNames: 'Ana',
  lastNames: 'Perez',
  birthDate: '1990-05-01',
  email: 'ana@quimi.co',
  phone: '3000000000',
  documentTypeCode: 'CC',
  documentNumber: '123456',
  username: 'ana.perez',
};

const ENTRADA = { company: EMPRESA, administrator: ADMINISTRADOR };

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

type Resultado = Awaited<ReturnType<CompanyRepository['createWithAdministrator']>>;
type Emision = Awaited<ReturnType<CredentialSetupLinkRepository['issueForPendingUser']>>;

function setup(
  opciones: {
    creado?: Resultado;
    emision?: Emision;
    correo?: 'sent' | 'failed';
  } = {},
) {
  const createWithAdministrator = vi.fn<CompanyRepository['createWithAdministrator']>(
    async () => opciones.creado ?? { companyId: COMPANY_ID, administratorId: ADMIN_ID },
  );
  const create = vi.fn<CredentialSetupSecretFactory['create']>(() => ({ secret: SECRETO, digest: 'huella' }));
  const issueForPendingUser = vi.fn<CredentialSetupLinkRepository['issueForPendingUser']>(
    async () => opciones.emision ?? { email: 'ana@quimi.co' },
  );
  const sendCredentialSetupLink = vi.fn<CredentialSetupMailer['sendCredentialSetupLink']>(
    async () => opciones.correo ?? 'sent',
  );
  const createCompany = createCreateCompany({
    companies: repositorio({ createWithAdministrator }),
    secrets: { create, digestOf: vi.fn() },
    links: {
      issueForPendingUser,
      applyCredentialAndActivate: noDebeLlamarse('applyCredentialAndActivate'),
    },
    mailer: { sendCredentialSetupLink },
    now: () => NOW,
  });
  return { createCompany, createWithAdministrator, create, issueForPendingUser, sendCredentialSetupLink };
}

function setupSinTocarNada() {
  const companies = repositorio();
  const create = vi.fn(() => {
    throw new Error('no debe llamarse: secrets.create');
  });
  const links = {
    issueForPendingUser: noDebeLlamarse('issueForPendingUser'),
    applyCredentialAndActivate: noDebeLlamarse('applyCredentialAndActivate'),
  };
  const mailer = { sendCredentialSetupLink: noDebeLlamarse('sendCredentialSetupLink') };
  const createCompany = createCreateCompany({
    companies,
    secrets: { create, digestOf: vi.fn() },
    links,
    mailer,
    now: () => NOW,
  });
  const llamadas = () =>
    [
      ...Object.values(companies),
      create,
      links.issueForPendingUser,
      links.applyCredentialAndActivate,
      mailer.sendCredentialSetupLink,
    ].reduce((total, fn) => total + (fn as ReturnType<typeof vi.fn>).mock.calls.length, 0);
  return { createCompany, llamadas };
}

describe('createCompany', () => {
  const SIN_PERMISO: ReadonlyArray<{ caso: string; actor: unknown }> = [
    { caso: 'actor null', actor: null },
    { caso: 'actor undefined', actor: undefined },
    { caso: 'sin conjunto de permisos', actor: { id: MAESTRO.id } },
    { caso: 'conjunto vacio', actor: { id: MAESTRO.id, permissions: [] } },
    { caso: 'solo empresas.consultar', actor: { id: MAESTRO.id, permissions: ['empresas.consultar'] } },
  ];

  for (const { caso, actor } of SIN_PERMISO) {
    it(`R1: ${caso} → unauthorized, antes de validar y sin tocar ningun puerto`, async () => {
      const { createCompany, llamadas } = setupSinTocarNada();

      await expect(createCompany(actor as PlatformActor | null, { roto: true })).rejects.toMatchObject({
        code: 'unauthorized',
      });
      expect(llamadas()).toBe(0);
    });
  }

  it('R2: un actor sin empresa con empresas.modificar queda autorizado', async () => {
    const { createCompany, createWithAdministrator } = setup();
    const sinEmpresa: PlatformActor = { id: MAESTRO.id, permissions: ['empresas.modificar'] };

    await expect(createCompany(sinEmpresa, ENTRADA)).resolves.toMatchObject({ companyId: COMPANY_ID });
    expect('companyId' in sinEmpresa).toBe(false);
    expect(createWithAdministrator).toHaveBeenCalledTimes(1);
  });

  it('R11: el puerto recibe la empresa normalizada, el Administrador sin rol, el actor y el instante', async () => {
    const { createCompany, createWithAdministrator } = setup();

    await createCompany(MAESTRO, ENTRADA);

    expect(createWithAdministrator).toHaveBeenCalledWith({
      company: {
        name: 'Quími Cloud',
        nameNormalized: 'quimicloud',
        taxId: '900.123.456-7',
        taxIdNormalized: '9001234567',
        contactEmail: 'Contacto@Quimi.co',
        contactPhone: null,
      },
      administrator: { ...ADMINISTRADOR, birthDate: new Date('1990-05-01T00:00:00.000Z') },
      actorId: MAESTRO.id,
      now: NOW,
    });
  });

  it('R11: devuelve el id de la empresa y el del Administrador', async () => {
    const { createCompany } = setup();

    await expect(createCompany(MAESTRO, ENTRADA)).resolves.toEqual({
      companyId: COMPANY_ID,
      administratorId: ADMIN_ID,
      mail: 'sent',
    });
  });

  for (const clave of ['roleId', 'credential', 'companyId']) {
    it(`R12: el Administrador con ${clave} → invalid_input sin tocar ningun puerto`, async () => {
      const { createCompany, llamadas } = setupSinTocarNada();
      const sinEmpresa: PlatformActor = { id: MAESTRO.id, permissions: ['empresas.modificar'] };

      await expect(
        createCompany(sinEmpresa, { company: EMPRESA, administrator: { ...ADMINISTRADOR, [clave]: 'x' } }),
      ).rejects.toMatchObject({ code: 'invalid_input' });
      expect(llamadas()).toBe(0);
    });
  }

  it('R5: la empresa con country → invalid_input sin tocar ningun puerto', async () => {
    const { createCompany, llamadas } = setupSinTocarNada();
    const sinEmpresa: PlatformActor = { id: MAESTRO.id, permissions: ['empresas.modificar'] };

    await expect(
      createCompany(sinEmpresa, { company: { ...EMPRESA, country: 'CO' }, administrator: ADMINISTRADOR }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(llamadas()).toBe(0);
  });

  it('R7: «---» como identificacion → invalid_input sin tocar ningun puerto', async () => {
    const { createCompany, llamadas } = setupSinTocarNada();
    const sinEmpresa: PlatformActor = { id: MAESTRO.id, permissions: ['empresas.modificar'] };

    await expect(
      createCompany(sinEmpresa, { company: { ...EMPRESA, taxId: '---' }, administrator: ADMINISTRADOR }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(llamadas()).toBe(0);
  });

  it('R45: «!!!» como nombre → invalid_input sin tocar ningun puerto', async () => {
    const { createCompany, llamadas } = setupSinTocarNada();
    const sinEmpresa: PlatformActor = { id: MAESTRO.id, permissions: ['empresas.modificar'] };

    await expect(
      createCompany(sinEmpresa, { company: { ...EMPRESA, name: '!!!' }, administrator: ADMINISTRADOR }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(llamadas()).toBe(0);
  });

  it('R8: el puerto responde duplicate_name → company_duplicate_name, sin enlace ni correo', async () => {
    const { createCompany, create, sendCredentialSetupLink } = setup({ creado: 'duplicate_name' });

    const error = await createCompany(MAESTRO, ENTRADA).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CompanyDuplicateNameError);
    expect(error).toMatchObject({ code: 'company_duplicate_name' });
    expect(create).not.toHaveBeenCalled();
    expect(sendCredentialSetupLink).not.toHaveBeenCalled();
  });

  it('R9: el puerto responde duplicate_tax_id → company_duplicate_tax_id, sin enlace', async () => {
    const { createCompany, issueForPendingUser } = setup({ creado: 'duplicate_tax_id' });

    const error = await createCompany(MAESTRO, ENTRADA).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CompanyDuplicateTaxIdError);
    expect(error).toMatchObject({ code: 'company_duplicate_tax_id' });
    expect(issueForPendingUser).not.toHaveBeenCalled();
  });

  it('R13: el puerto responde username → duplicate_username, sin enlace', async () => {
    const { createCompany, issueForPendingUser } = setup({ creado: 'username' });

    await expect(createCompany(MAESTRO, ENTRADA)).rejects.toMatchObject({ code: 'duplicate_username' });
    expect(issueForPendingUser).not.toHaveBeenCalled();
  });

  it('R13: el puerto responde invalid_document_type → invalid_input, sin enlace', async () => {
    const { createCompany, issueForPendingUser } = setup({ creado: 'invalid_document_type' });

    await expect(createCompany(MAESTRO, ENTRADA)).rejects.toMatchObject({ code: 'invalid_input' });
    expect(issueForPendingUser).not.toHaveBeenCalled();
  });

  it('R15: emite el enlace al Administrador nuevo con siete dias de vigencia desde el alta', async () => {
    const { createCompany, issueForPendingUser, sendCredentialSetupLink } = setup();

    await createCompany(MAESTRO, ENTRADA);

    expect(issueForPendingUser).toHaveBeenCalledWith({
      userId: ADMIN_ID,
      companyId: COMPANY_ID,
      digest: 'huella',
      expiresAt: new Date(NOW.getTime() + SIETE_DIAS_MS),
      now: NOW,
    });
    expect(sendCredentialSetupLink).toHaveBeenCalledWith({ to: 'ana@quimi.co', secret: SECRETO });
  });

  it('R15: el correo que no sale se informa como failed y el alta no lanza', async () => {
    const { createCompany } = setup({ correo: 'failed' });

    await expect(createCompany(MAESTRO, ENTRADA)).resolves.toEqual({
      companyId: COMPANY_ID,
      administratorId: ADMIN_ID,
      mail: 'failed',
    });
  });

  it('R15: si otra emision gano (superseded) el correo cuenta como sent y no se reenvia', async () => {
    const { createCompany, sendCredentialSetupLink } = setup({ emision: 'superseded' });

    await expect(createCompany(MAESTRO, ENTRADA)).resolves.toMatchObject({ mail: 'sent' });
    expect(sendCredentialSetupLink).not.toHaveBeenCalled();
  });

  for (const emision of ['not_found', 'user_not_pending', 'issued'] as const) {
    it(`R15: una emision ${emision} deja el alta hecha con el correo failed`, async () => {
      const { createCompany, sendCredentialSetupLink } = setup({ emision });

      await expect(createCompany(MAESTRO, ENTRADA)).resolves.toMatchObject({
        companyId: COMPANY_ID,
        mail: 'failed',
      });
      expect(sendCredentialSetupLink).not.toHaveBeenCalled();
    });
  }

  it('R15: el secreto del enlace no sale en el resultado', async () => {
    const { createCompany } = setup();

    const resultado = await createCompany(MAESTRO, ENTRADA);
    expect(JSON.stringify(resultado)).not.toContain(SECRETO);
    expect(Object.keys(resultado).sort()).toEqual(['administratorId', 'companyId', 'mail']);
  });
});
