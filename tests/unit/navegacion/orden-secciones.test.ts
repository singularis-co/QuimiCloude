// Orden de las secciones del menu privado y su efecto sobre el aterrizaje tras el login.
//
// Se afirma sobre las constantes (`NAV_SECTION_*`, rutas y conjuntos del seed IMPORTADOS), nunca
// sobre el literal del copy. El aterrizaje se calcula con la misma composicion que usa el login:
// `firstVisibleNavHref(filterNavItemsByPermissions(PRIVATE_NAV_ITEMS, permisos))`.

import { describe, expect, it } from 'vitest';

import {
  PERMISSIONS,
  ROLE_ACONDICIONAMIENTO,
  ROLE_ADMINISTRADOR,
  ROLE_EMPACADOR,
  ROLE_MAESTRO,
  ROLE_OPERADOR,
  SEED_ROLE_PERMISSIONS,
} from '@/lib/modules/identity';
import {
  NAV_SECTION_CONFIGURATION,
  NAV_SECTION_DIRECTORY,
  NAV_SECTION_OPERATION,
  NAV_SECTION_PLATFORM,
  NAV_SECTION_PRODUCTION,
  NAV_SECTION_TRACKING,
  PRIVATE_NAV_ITEMS,
  filterNavItemsByPermissions,
  firstVisibleNavHref,
  groupNavItemsBySection,
  type NavItem,
} from '@/lib/shared/navigation/private-nav';
import {
  ASSIGNED_ORDERS_ROUTE,
  CUSTOMERS_ROUTE,
  DASHBOARD_ROUTE,
  FORMULAS_ROUTE,
  INVENTORY_ROUTE,
  MAESTRO_ADMINISTRATORS_ROUTE,
  MAESTRO_COMPANIES_ROUTE,
  ORDERS_ROUTE,
  PRESENTATIONS_ROUTE,
  SUPPLIERS_ROUTE,
  UNITS_ROUTE,
  USERS_ROUTE,
} from '@/lib/shared/routes';

const TODOS_LOS_PERMISOS: readonly string[] = PERMISSIONS.map((permiso) => permiso.code);

function permisosDe(rol: string): readonly string[] {
  const permisos = SEED_ROLE_PERMISSIONS[rol];
  if (permisos === undefined) throw new Error(`el seed no tiene el rol "${rol}"`);
  return permisos;
}

/** Un enlace se identifica por su `href`; un grupo, por su `testId` (no tiene destino propio). */
function claveDe(item: NavItem): string {
  return item.kind === 'link' ? item.href : item.testId;
}

function menuPorSecciones(permisos: readonly string[]) {
  return groupNavItemsBySection(filterNavItemsByPermissions(PRIVATE_NAV_ITEMS, permisos)).map(
    (seccion) => ({ label: seccion.label, items: seccion.items.map(claveDe) }),
  );
}

function aterrizaje(permisos: readonly string[]): string | null {
  return firstVisibleNavHref(filterNavItemsByPermissions(PRIVATE_NAV_ITEMS, permisos));
}

describe('orden de secciones y entradas del menu', () => {
  it('R2: con todos los permisos: Seguimiento, Operación, Producción, Directorio, Configuración y Plataforma, cada una con sus entradas en orden', () => {
    expect(menuPorSecciones(TODOS_LOS_PERMISOS)).toEqual([
      { label: NAV_SECTION_TRACKING, items: [DASHBOARD_ROUTE] },
      { label: NAV_SECTION_OPERATION, items: [INVENTORY_ROUTE, ORDERS_ROUTE, ASSIGNED_ORDERS_ROUTE] },
      { label: NAV_SECTION_PRODUCTION, items: [FORMULAS_ROUTE] },
      { label: NAV_SECTION_DIRECTORY, items: [SUPPLIERS_ROUTE, CUSTOMERS_ROUTE] },
      {
        label: NAV_SECTION_CONFIGURATION,
        items: [USERS_ROUTE, PRESENTATIONS_ROUTE, UNITS_ROUTE, 'nav-integraciones'],
      },
      {
        label: NAV_SECTION_PLATFORM,
        items: [MAESTRO_COMPANIES_ROUTE, MAESTRO_ADMINISTRATORS_ROUTE],
      },
    ]);
  });

  it('Fórmulas es una entrada directa de Producción, no un grupo', () => {
    const produccion = groupNavItemsBySection(PRIVATE_NAV_ITEMS).find(
      (seccion) => seccion.label === NAV_SECTION_PRODUCTION,
    );

    expect(produccion?.items).toHaveLength(1);
    expect(produccion?.items[0]?.kind).toBe('link');
  });

  it('cada seccion aparece una sola vez: sus items son contiguos en el array', () => {
    const etiquetas = groupNavItemsBySection(PRIVATE_NAV_ITEMS).map((seccion) => seccion.label);
    const enOrdenCrudo = PRIVATE_NAV_ITEMS.map((item) => item.section ?? null).filter(
      (seccion, i, todas) => i === 0 || todas[i - 1] !== seccion,
    );

    expect(enOrdenCrudo).toEqual(etiquetas);
  });
});

describe('las secciones sin entradas visibles no salen', () => {
  it('ancla: el Operador del seed tiene permisos y no tiene dashboard, recetas, proveedores, clientes ni configuracion', () => {
    const permisos = permisosDe(ROLE_OPERADOR);

    expect(permisos.length).toBeGreaterThan(0);
    for (const ajeno of [
      'dashboard.consultar',
      'recetas.consultar',
      'proveedores.consultar',
      'clientes.consultar',
      'usuarios.consultar',
      'inventario.modificar',
      'unidades.consultar',
      'integraciones.modificar',
    ]) {
      expect(permisos).not.toContain(ajeno);
    }
  });

  it('R2: con los permisos del Operador solo queda Operación, sin encabezados de las demas', () => {
    expect(menuPorSecciones(permisosDe(ROLE_OPERADOR))).toEqual([
      { label: NAV_SECTION_OPERATION, items: [INVENTORY_ROUTE, ASSIGNED_ORDERS_ROUTE] },
    ]);
  });

  it('ninguna seccion de ningun rol del seed queda vacia', () => {
    for (const rol of Object.keys(SEED_ROLE_PERMISSIONS)) {
      for (const seccion of menuPorSecciones(permisosDe(rol))) {
        expect(seccion.items.length, `${rol} / ${seccion.label}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('destino tras el login de cada rol del seed (primer enlace visible)', () => {
  it.each([
    ['Administrador', ROLE_ADMINISTRADOR, DASHBOARD_ROUTE],
    ['Operador', ROLE_OPERADOR, INVENTORY_ROUTE],
    ['Empacador', ROLE_EMPACADOR, ASSIGNED_ORDERS_ROUTE],
    ['Acondicionamiento', ROLE_ACONDICIONAMIENTO, ASSIGNED_ORDERS_ROUTE],
  ])('R5: %s aterriza en su ruta', (_nombre, rol, esperado) => {
    expect(aterrizaje(permisosDe(rol))).toBe(esperado);
  });

  it('R4: Maestro aterriza en Empresas, el primer enlace de «Plataforma»', () => {
    expect(aterrizaje(permisosDe(ROLE_MAESTRO))).toBe(MAESTRO_COMPANIES_ROUTE);
  });

  it('con todos los permisos aterriza en el dashboard', () => {
    expect(aterrizaje(TODOS_LOS_PERMISOS)).toBe(DASHBOARD_ROUTE);
  });

  it('la tabla cubre todos los roles del seed', () => {
    expect(Object.keys(SEED_ROLE_PERMISSIONS).sort()).toEqual(
      [
        ROLE_ADMINISTRADOR,
        ROLE_OPERADOR,
        ROLE_EMPACADOR,
        ROLE_ACONDICIONAMIENTO,
        ROLE_MAESTRO,
      ].sort(),
    );
  });
});
