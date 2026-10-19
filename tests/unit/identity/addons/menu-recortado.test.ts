// El menú y «Ver recorrido» se apagan con el permiso efectivo de la sesión, sin código propio:
// se filtra con los permisos del Administrador sembrado recortados por los añadidos.
import { describe, expect, it } from 'vitest';

import {
  ADDONS,
  ROLE_ADMINISTRADOR,
  SEED_ROLE_PERMISSIONS,
  assertPermission,
  effectivePermissions,
} from '@/lib/modules/identity';
import {
  PRIVATE_NAV_ITEMS,
  filterNavItemsByPermissions,
  type NavItem,
} from '@/lib/shared/navigation/private-nav';
import { DASHBOARD_ROUTE, SUPPLIERS_ROUTE } from '@/lib/shared/routes';

const PERMISOS_ADMINISTRADOR = SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR] ?? [];

function testIds(items: readonly NavItem[]): string[] {
  return items.flatMap((item) =>
    item.kind === 'group' ? [item.testId, ...item.items.map((hijo) => hijo.testId)] : [item.testId],
  );
}

function hrefs(items: readonly NavItem[]): string[] {
  return items.flatMap((item) => (item.kind === 'group' ? item.items.map((hijo) => hijo.href) : [item.href]));
}

const GRUPO_INTEGRACIONES = PRIVATE_NAV_ITEMS.find((item) => item.kind === 'group' && item.testId === 'nav-integraciones');

describe('menú con el permiso efectivo de la empresa', () => {
  it('la fuente del menú y la del rol tienen lo que se va a recortar', () => {
    expect(PERMISOS_ADMINISTRADOR).toEqual(
      expect.arrayContaining(['dashboard.consultar', 'proveedores.consultar', 'integraciones.modificar']),
    );
    expect(GRUPO_INTEGRACIONES).toBeDefined();
  });

  it('R12 sin añadidos no hay dashboard, proveedores ni grupo «Integraciones»', () => {
    const menu = filterNavItemsByPermissions(PRIVATE_NAV_ITEMS, effectivePermissions(PERMISOS_ADMINISTRADOR, []));

    expect(testIds(menu)).not.toContain('nav-dashboard');
    expect(testIds(menu)).not.toContain('nav-proveedores');
    expect(testIds(menu)).not.toContain('nav-integraciones');
    expect(menu.some((item) => item.kind === 'group' && item.testId === 'nav-integraciones')).toBe(false);
    expect(hrefs(menu)).not.toContain(DASHBOARD_ROUTE);
    expect(hrefs(menu)).not.toContain(SUPPLIERS_ROUTE);
  });

  it('R12 sin añadidos el núcleo sigue en el menú', () => {
    const menu = filterNavItemsByPermissions(PRIVATE_NAV_ITEMS, effectivePermissions(PERMISOS_ADMINISTRADOR, []));

    expect(testIds(menu)).toEqual(expect.arrayContaining(['nav-inventario', 'nav-pedidos', 'nav-produccion-recetas']));
  });

  it('R12 con los cinco añadidos aparecen dashboard, proveedores y el grupo «Integraciones»', () => {
    const menu = filterNavItemsByPermissions(PRIVATE_NAV_ITEMS, effectivePermissions(PERMISOS_ADMINISTRADOR, ADDONS));

    expect(testIds(menu)).toEqual(expect.arrayContaining(['nav-dashboard', 'nav-proveedores', 'nav-integraciones']));
    expect(hrefs(menu)).toEqual(expect.arrayContaining([DASHBOARD_ROUTE, SUPPLIERS_ROUTE]));
  });
});

describe('«Ver recorrido» con el permiso efectivo', () => {
  // `canViewExecutionTrace` de `/asignacion` no se exporta: delega en `assertPermission` con
  // `dashboard.consultar`, que es lo que se prueba aquí. La página se ejercita en
  // `assigned-orders-route-contract.test.ts`.
  const denegado = new Error('denegado');

  function puedeVerRecorrido(permissions: readonly string[]): boolean {
    try {
      assertPermission({ permissions }, 'dashboard.consultar', () => denegado);
      return true;
    } catch (error) {
      if (error !== denegado) throw error;
      return false;
    }
  }

  it('R17 sin el añadido `dashboard` el permiso efectivo no tiene dashboard.consultar', () => {
    const efectivos = effectivePermissions(
      PERMISOS_ADMINISTRADOR,
      ADDONS.filter((addon) => addon !== 'dashboard'),
    );

    expect(efectivos).not.toContain('dashboard.consultar');
    expect(puedeVerRecorrido(efectivos)).toBe(false);
  });

  it('R17 con el añadido `dashboard` el recorrido se ofrece', () => {
    expect(puedeVerRecorrido(effectivePermissions(PERMISOS_ADMINISTRADOR, ADDONS))).toBe(true);
  });
});
