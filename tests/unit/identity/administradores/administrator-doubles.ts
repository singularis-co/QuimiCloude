// Dobles compartidos por los tests de los casos de uso de Administradores. Todo metodo no previsto
// lanza al llamarse, asi que un caso que no deberia tocar un puerto falla si lo toca.
import { vi } from 'vitest';

import type { AdministratorDetail, PlatformActor } from '@/lib/modules/identity';
import type { AdministratorRepository } from '@/lib/modules/identity/ports/administrator-repository';
import type { CredentialSetupLinkRepository } from '@/lib/modules/identity/ports/credential-setup-link-repository';
import type { CredentialSetupMailer } from '@/lib/modules/identity/ports/credential-setup-mailer';
import type { CredentialSetupSecretFactory } from '@/lib/modules/identity/ports/credential-setup-secret-factory';
import type { ListQueryLog } from '@/lib/modules/identity/ports/list-query-log';

export const ADMIN_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
export const COMPANY_ID = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';
export const OTRA_EMPRESA_ID = '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a';
export const NOW = new Date('2026-10-16T12:00:00.000Z');
export const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
export const SECRETO = 'secreto-del-enlace';
export const CORREO_GUARDADO = 'ana@quimi.co';

export const MAESTRO: PlatformActor = {
  id: '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40',
  permissions: ['empresas.consultar', 'empresas.modificar'],
};

export const OCHO_DATOS = {
  firstNames: 'Ana',
  lastNames: 'Perez',
  birthDate: '1990-05-01',
  email: 'ana@quimi.co',
  phone: '3000000000',
  documentTypeCode: 'CC',
  documentNumber: '123456',
  username: 'ana.perez',
} as const;

export const OCHO_DATOS_ESCRITOS = {
  ...OCHO_DATOS,
  birthDate: new Date('1990-05-01T00:00:00.000Z'),
};

export const FICHA: AdministratorDetail = {
  id: ADMIN_ID,
  firstNames: 'Ana',
  lastNames: 'Perez',
  birthDate: new Date('1990-05-01T00:00:00.000Z'),
  email: CORREO_GUARDADO,
  phone: '3000000000',
  documentTypeCode: 'CC',
  documentNumber: '123456',
  username: 'ana.perez',
  company: { id: COMPANY_ID, name: 'QuimiCloud' },
  accountStatus: 'pending',
  accountStatusChangedAt: new Date('2026-10-01T00:00:00.000Z'),
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  updatedAt: new Date('2026-10-02T00:00:00.000Z'),
  isLastAdministrator: true,
};

export function noDebeLlamarse(nombre: string) {
  return vi.fn(async () => {
    throw new Error(`no debe llamarse: ${nombre}`);
  });
}

export function repositorio(overrides: Partial<AdministratorRepository> = {}): AdministratorRepository {
  return {
    list: noDebeLlamarse('list'),
    findManageable: noDebeLlamarse('findManageable'),
    create: noDebeLlamarse('create'),
    update: noDebeLlamarse('update'),
    softDelete: noDebeLlamarse('softDelete'),
    ...overrides,
  };
}

type Emision = Awaited<ReturnType<CredentialSetupLinkRepository['issueForPendingUser']>>;

/** Secretos, enlaces y correo que responden lo pedido y registran sus llamadas. */
export function envio(opciones: { emision?: Emision; correo?: 'sent' | 'failed' } = {}) {
  const create = vi.fn<CredentialSetupSecretFactory['create']>(() => ({ secret: SECRETO, digest: 'huella' }));
  const issueForPendingUser = vi.fn<CredentialSetupLinkRepository['issueForPendingUser']>(
    async () => opciones.emision ?? { email: CORREO_GUARDADO },
  );
  const sendCredentialSetupLink = vi.fn<CredentialSetupMailer['sendCredentialSetupLink']>(
    async () => opciones.correo ?? 'sent',
  );
  return {
    secrets: { create, digestOf: vi.fn() } satisfies CredentialSetupSecretFactory,
    links: {
      issueForPendingUser,
      applyCredentialAndActivate: noDebeLlamarse('applyCredentialAndActivate'),
    } satisfies CredentialSetupLinkRepository,
    mailer: { sendCredentialSetupLink } satisfies CredentialSetupMailer,
    create,
    issueForPendingUser,
    sendCredentialSetupLink,
  };
}

/** El mismo envio, pero cada llamada lanza. */
export function envioIntocable() {
  const create = vi.fn(() => {
    throw new Error('no debe llamarse: secrets.create');
  });
  const digestOf = vi.fn(() => {
    throw new Error('no debe llamarse: secrets.digestOf');
  });
  return {
    secrets: { create, digestOf } as unknown as CredentialSetupSecretFactory,
    links: {
      issueForPendingUser: noDebeLlamarse('issueForPendingUser'),
      applyCredentialAndActivate: noDebeLlamarse('applyCredentialAndActivate'),
    },
    mailer: { sendCredentialSetupLink: noDebeLlamarse('sendCredentialSetupLink') },
  };
}

export function logIntocable(): ListQueryLog {
  return {
    ignoredFields: vi.fn(() => {
      throw new Error('no debe llamarse: log');
    }),
  };
}

/** Total de llamadas registradas en cualquier doble de los objetos dados. */
export function llamadasA(...objetos: readonly object[]): number {
  return objetos
    .flatMap((objeto) => Object.values(objeto))
    .filter((valor): valor is ReturnType<typeof vi.fn> => vi.isMockFunction(valor))
    .reduce((total, fn) => total + fn.mock.calls.length, 0);
}
