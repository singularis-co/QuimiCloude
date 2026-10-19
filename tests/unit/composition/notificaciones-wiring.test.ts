// El CABLEADO de `notificaciones` en `lib/composition`: qué canales registra, con qué se comprueba que
// la empresa vive y que el destinatario es de ella, y qué lista de empresas recorre el cron. El motor
// ya está probado aparte; aquí se observan las dependencias con las que se construye.
//
// Mismo criterio que `documentos-facade.test.ts`: se sustituye el cliente Prisma entero y no hace
// falta ni Postgres ni `DATABASE_URL`.
import { describe, expect, it, vi } from 'vitest';

import type { ChannelRegistry, NotifyDeps } from '@/lib/modules/notificaciones';

const { wired, directory } = vi.hoisted(() => ({
  wired: {
    registries: [] as ChannelRegistry[],
    notifyDeps: null as NotifyDeps | null,
  },
  directory: {
    listActiveCompanyIds: async (): Promise<readonly string[]> => ['activa'],
    listAllCompanyIds: async (): Promise<readonly string[]> => ['activa', 'de-baja'],
  },
}));

vi.mock('@/lib/shared/db/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/modules/identity/adapters/driven/persistence/company-directory-prisma', () => directory);
vi.mock('@/lib/modules/notificaciones', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/modules/notificaciones')>();
  return {
    ...real,
    createChannelFactory: (registry: ChannelRegistry) => {
      wired.registries.push(registry);
      return real.createChannelFactory(registry);
    },
    createNotify: (deps: NotifyDeps) => {
      wired.notifyDeps = deps;
      return real.createNotify(deps);
    },
  };
});

const { identity, notificaciones } = await import('@/lib/composition');

describe('notificaciones — cableado en composición', () => {
  it('R9: el único canal registrado en la factory es el de la aplicación', () => {
    expect(wired.registries).toHaveLength(1);
    expect(Object.keys(wired.registries[0]!)).toEqual(['in_app']);
    expect(wired.registries[0]!.in_app?.key).toBe('in_app');
    expect(wired.notifyDeps?.channels.channelsFor(['in_app']).map((c) => c.key)).toEqual(['in_app']);
  });

  it('R57: el motor pregunta a identity.isCompanyActive', async () => {
    const deps = wired.notifyDeps;
    expect(deps).not.toBeNull();
    const query = vi.spyOn(identity, 'isCompanyActive');
    const addon = vi.spyOn(identity, 'isCompanyAddonActive');
    try {
      query.mockResolvedValueOnce(false);
      expect(await deps!.companies.isActive('empresa-a')).toBe(false);
      query.mockResolvedValueOnce(true);
      expect(await deps!.companies.isActive('empresa-b')).toBe(true);
      expect(query.mock.calls).toEqual([['empresa-a'], ['empresa-b']]);
      expect(addon).not.toHaveBeenCalled();
      expect(Object.keys(deps!).sort()).toEqual(['catalog', 'channels', 'companies', 'inbox', 'log', 'recipients']);
    } finally {
      query.mockRestore();
      addon.mockRestore();
    }
  });

  it('R17: la lista de empresas del cron es la de todas, no la de activas', async () => {
    expect(notificaciones.listCompanyIds).toBe(directory.listAllCompanyIds);
    expect(notificaciones.listCompanyIds).not.toBe(directory.listActiveCompanyIds);
    expect(await notificaciones.listCompanyIds()).toEqual(['activa', 'de-baja']);
  });

  it('R12: el directorio de destinatarios es identity.isUserInCompany', async () => {
    const deps = wired.notifyDeps;
    const query = vi.spyOn(identity, 'isUserInCompany');
    try {
      query.mockResolvedValueOnce(false);
      expect(await deps!.recipients.belongsToCompany('usuario-1', 'empresa-a')).toBe(false);
      expect(query).toHaveBeenCalledWith('usuario-1', 'empresa-a');
    } finally {
      query.mockRestore();
    }
  });

  it('la fachada expone el motor, los casos de uso de la bandeja y lo que usa la tarea de borrado', () => {
    expect(Object.keys(notificaciones).sort()).toEqual(
      [
        'getNotificationSummary',
        'listCompanyIds',
        'listNotifications',
        'markAllNotificationsRead',
        'markNotificationRead',
        'notify',
        'purgeExpiredNotifications',
        'verifyCronSecret',
      ].sort(),
    );
  });
});
