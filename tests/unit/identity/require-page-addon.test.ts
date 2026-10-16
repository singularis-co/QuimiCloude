import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ADDONS } from '@/lib/modules/identity';
import { requirePageAddon } from '@/lib/modules/identity/adapters/driving/require-page-addon';
import { LOGIN_ROUTE_SESSION_ENDED } from '@/lib/shared/routes';

const { getSessionUserMock, redirectMock, notFoundMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn<() => Promise<unknown>>(),
  redirectMock: vi.fn<(ruta: string) => void>(),
  notFoundMock: vi.fn<() => void>(),
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock },
}));

// Los interruptores de Next cortan lanzando; los dobles hacen lo mismo para que un `try` en el
// helper que se tragara el corte se note aquí.
vi.mock('next/navigation', () => ({
  redirect: (ruta: string): never => {
    redirectMock(ruta);
    throw new Error('NEXT_REDIRECT');
  },
  notFound: (): never => {
    notFoundMock();
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const FUENTE = 'lib/modules/identity/adapters/driving/require-page-addon.ts';

function usuario(addons?: readonly string[]) {
  return {
    id: 'u-1',
    permissions: ['inventario.consultar', 'inventario.modificar', 'recetas.modificar'],
    ...(addons === undefined ? {} : { addons }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requirePageAddon', () => {
  it('R13: sin sesión redirige al login con la marca de sesión terminada y no responde 404', async () => {
    getSessionUserMock.mockResolvedValue(null);

    await expect(requirePageAddon('importacion_excel')).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith(LOGIN_ROUTE_SESSION_ENDED);
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('R13: con sesión y el añadido apagado responde 404, y la llamada lanza', async () => {
    getSessionUserMock.mockResolvedValue(usuario(['lectura_pdf', 'integraciones']));

    await expect(requirePageAddon('importacion_excel')).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('R13: una sesión sin `addons` falla cerrado: 404 en cualquier añadido', async () => {
    getSessionUserMock.mockResolvedValue(usuario());

    for (const addon of ADDONS) {
      notFoundMock.mockClear();
      await expect(requirePageAddon(addon)).rejects.toThrow('NEXT_NOT_FOUND');
      expect(notFoundMock).toHaveBeenCalledTimes(1);
    }
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('R13: con el añadido activo resuelve sin cortar', async () => {
    getSessionUserMock.mockResolvedValue(usuario(['importacion_excel']));

    await expect(requirePageAddon('importacion_excel')).resolves.toBeUndefined();

    expect(redirectMock).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('R13: el fuente delega en assertAddon y no compara los añadidos a mano', () => {
    const fuente = readFileSync(resolve(process.cwd(), FUENTE), 'utf8');

    expect(fuente.trim().length).toBeGreaterThan(0);
    expect(fuente).toContain('assertAddon(');
    expect(fuente).not.toContain('.includes(');
    expect(fuente).not.toContain('hasAddon');
  });
});
