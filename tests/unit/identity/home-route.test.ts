import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { GET } from '@/lib/modules/identity/adapters/driving/home-route';
import { PERMISSIONS, type SessionUser } from '@/lib/modules/identity';
import {
  PRIVATE_NAV_ITEMS,
  filterNavItemsByPermissions,
  firstVisibleNavHref,
  homeHrefFor,
} from '@/lib/shared/navigation/private-nav';
import { DASHBOARD_ROUTE, HOME_ROUTE, LOGIN_ROUTE_SESSION_ENDED } from '@/lib/shared/routes';

const { getSessionUserMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn<() => Promise<SessionUser | null>>(),
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock },
}));

// Envoltura espía sobre la regla real: se comprueba con qué permisos se calculó el destino.
vi.mock('@/lib/shared/navigation/private-nav', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/shared/navigation/private-nav')>();
  return { ...real, homeHrefFor: vi.fn(real.homeHrefFor) };
});

const ORIGEN = 'https://quimicloude.test';
const TODOS_LOS_PERMISOS: readonly string[] = PERMISSIONS.map((permiso) => permiso.code);

function usuarioCon(permissions: readonly string[]): SessionUser {
  return {
    id: 'usuario-1',
    username: 'ana.perez',
    displayName: 'Ana Perez',
    roleName: 'Operador',
    permissions,
  };
}

async function pedirInicio(): Promise<Response> {
  return GET(new Request(`${ORIGEN}${HOME_ROUTE}`));
}

function destino(response: Response): string {
  const location = response.headers.get('location');
  if (location === null) throw new Error('la respuesta no redirige');
  const url = new URL(location);
  expect(url.origin).toBe(ORIGEN);
  return `${url.pathname}${url.search}`;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ruta de inicio', () => {
  it('R18, R19: con sesion redirige con 307 al primer enlace del menu efectivo', async () => {
    const efectivos = TODOS_LOS_PERMISOS.filter(
      (permiso) => !permiso.startsWith('dashboard.') && !permiso.startsWith('proveedores.'),
    );
    getSessionUserMock.mockResolvedValue(usuarioCon(efectivos));

    const response = await pedirInicio();

    expect(response.status).toBe(307);
    expect(homeHrefFor).toHaveBeenCalledTimes(1);
    expect(homeHrefFor).toHaveBeenCalledWith(efectivos);
    const esperado = firstVisibleNavHref(filterNavItemsByPermissions(PRIVATE_NAV_ITEMS, efectivos));
    expect(esperado).not.toBeNull();
    expect(destino(response)).toBe(esperado);
  });

  it('R18, R19: con un solo permiso aterriza en esa pantalla', async () => {
    getSessionUserMock.mockResolvedValue(usuarioCon(['inventario.consultar']));

    const response = await pedirInicio();

    expect(response.status).toBe(307);
    expect(destino(response)).toBe(homeHrefFor(['inventario.consultar']));
  });

  it('R18, R19: con el menu vacio cae al dashboard, el mismo respaldo que el login', async () => {
    getSessionUserMock.mockResolvedValue(usuarioCon([]));

    const response = await pedirInicio();

    expect(response.status).toBe(307);
    expect(destino(response)).toBe(DASHBOARD_ROUTE);
  });

  it('R21: sin sesion valida va al login con la marca de sesion terminada', async () => {
    getSessionUserMock.mockResolvedValue(null);

    const response = await pedirInicio();

    expect(response.status).toBe(307);
    expect(destino(response)).toBe(LOGIN_ROUTE_SESSION_ENDED);
    expect(homeHrefFor).not.toHaveBeenCalled();
  });

  it('R18: app/inicio/route.ts solo reexporta GET del adaptador y declara el runtime nodejs', () => {
    const fuente = readFileSync(resolve(process.cwd(), 'app/inicio/route.ts'), 'utf8');

    expect(fuente).toMatch(
      /export \{ GET \} from '@\/lib\/modules\/identity\/adapters\/driving\/home-route';/,
    );
    expect(fuente).toMatch(/export const runtime = 'nodejs';/);
  });
});
