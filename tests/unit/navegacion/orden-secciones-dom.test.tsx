// Los encabezados de seccion que dibuja `AppSidebar`: en el orden del menu y sin encabezados
// huerfanos para un rol limitado. Se afirma sobre las constantes `NAV_SECTION_*`.

import { cleanup, render, screen } from '@testing-library/react';

import { AppSidebar } from '@/components/private/app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import {
  PERMISSIONS,
  ROLE_OPERADOR,
  SEED_ROLE_PERMISSIONS,
  type SessionUser,
} from '@/lib/modules/identity';
import {
  NAV_SECTION_CONFIGURATION,
  NAV_SECTION_DIRECTORY,
  NAV_SECTION_OPERATION,
  NAV_SECTION_PRODUCTION,
  NAV_SECTION_TRACKING,
  PRIVATE_NAV_ITEMS,
  filterNavItemsByPermissions,
} from '@/lib/shared/navigation/private-nav';

import { resetViewport, setViewportWidth, WIDE_VIEWPORT } from '../../helpers/viewport';

const { usePathnameMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn<() => string>(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: usePathnameMock,
}));

// El pie de usuario lleva el `<form>` del logout: sin este mock ejecutaria la Server Action real.
vi.mock('@/lib/modules/identity/adapters/driving/logout-action', () => ({
  logoutAction: vi.fn(async () => undefined),
}));

const TODOS_LOS_PERMISOS: readonly string[] = PERMISSIONS.map((permiso) => permiso.code);

function sessionUser(permissions: readonly string[]): SessionUser {
  return {
    id: 'u-orden',
    username: 'orden.prueba',
    displayName: 'Orden De Prueba',
    roleName: 'Prueba',
    permissions: [...permissions],
  };
}

function renderMenu(permissions: readonly string[]) {
  render(
    <SidebarProvider>
      <AppSidebar
        user={sessionUser(permissions)}
        navItems={filterNavItemsByPermissions(PRIVATE_NAV_ITEMS, permissions)}
      />
    </SidebarProvider>,
  );
}

function encabezados(): readonly (string | null)[] {
  return screen.queryAllByTestId('private-nav-section').map((nodo) => nodo.textContent);
}

beforeEach(() => {
  usePathnameMock.mockReturnValue('/ruta-que-no-esta-en-la-navegacion');
  setViewportWidth(WIDE_VIEWPORT);
});

afterEach(() => {
  cleanup();
  resetViewport();
});

describe('encabezados de seccion del sidebar', () => {
  it('con todos los permisos se dibujan las cinco secciones en orden', () => {
    renderMenu(TODOS_LOS_PERMISOS);

    expect(encabezados()).toEqual([
      NAV_SECTION_TRACKING,
      NAV_SECTION_OPERATION,
      NAV_SECTION_PRODUCTION,
      NAV_SECTION_DIRECTORY,
      NAV_SECTION_CONFIGURATION,
    ]);
  });

  it('con los permisos del Operador solo se dibuja el encabezado de Operación', () => {
    const permisos = SEED_ROLE_PERMISSIONS[ROLE_OPERADOR];
    expect(permisos?.length).toBeGreaterThan(0);

    renderMenu(permisos ?? []);

    expect(encabezados()).toEqual([NAV_SECTION_OPERATION]);
    expect(screen.getByTestId('nav-inventario')).toBeInTheDocument();
    expect(screen.getByTestId('nav-asignacion')).toBeInTheDocument();
  });
});
