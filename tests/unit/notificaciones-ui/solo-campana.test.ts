import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ROLE_ACONDICIONAMIENTO,
  ROLE_ADMINISTRADOR,
  ROLE_EMPACADOR,
  ROLE_MAESTRO,
  ROLE_OPERADOR,
  SEED_ROLE_PERMISSIONS,
} from '@/lib/modules/identity';
import {
  filterNavItemsByPermissions,
  firstVisibleNavHref,
  PRIVATE_NAV_ITEMS,
  type NavLink,
} from '@/lib/shared/navigation/private-nav';
import {
  ASSIGNED_ORDERS_ROUTE,
  DASHBOARD_ROUTE,
  INVENTORY_ROUTE,
  PRIVATE_ROUTE_PREFIXES,
} from '@/lib/shared/routes';

const RAIZ = join(__dirname, '..', '..', '..');
const RUTA_DESCARTADA = '/notificaciones';

function enlaces(): NavLink[] {
  return PRIVATE_NAV_ITEMS.flatMap((item) => (item.kind === 'link' ? [item] : item.items));
}

function permisosDe(rol: string): readonly string[] {
  const permisos = SEED_ROLE_PERMISSIONS[rol];
  if (permisos === undefined) throw new Error(`el seed no tiene el rol "${rol}"`);
  return permisos;
}

const aterrizaje = (permisos: readonly string[]) =>
  firstVisibleNavHref(filterNavItemsByPermissions(PRIVATE_NAV_ITEMS, permisos));

describe('la campana es el único sitio de los avisos', () => {
  it('R24: no existe la carpeta de la ruta /notificaciones', () => {
    expect(existsSync(join(RAIZ, 'app', '(private)', 'notificaciones'))).toBe(false);
  });

  it('R24: ningún enlace del menú apunta a /notificaciones ni lleva conteo', () => {
    const todos = enlaces();
    expect(todos.length).toBeGreaterThan(0);
    expect(todos.filter((link) => link.href.startsWith(RUTA_DESCARTADA))).toEqual([]);
    expect(todos.filter((link) => link.badge !== undefined).map((link) => link.href)).toEqual([]);
  });

  it('R24: /notificaciones no es un prefijo de ruta privada', () => {
    expect(PRIVATE_ROUTE_PREFIXES.length).toBeGreaterThan(0);
    expect(PRIVATE_ROUTE_PREFIXES.filter((prefijo) => prefijo.startsWith(RUTA_DESCARTADA))).toEqual([]);
  });

  it.each([
    ['Administrador', ROLE_ADMINISTRADOR, DASHBOARD_ROUTE],
    ['Operador', ROLE_OPERADOR, INVENTORY_ROUTE],
    ['Empacador', ROLE_EMPACADOR, ASSIGNED_ORDERS_ROUTE],
    ['Acondicionamiento', ROLE_ACONDICIONAMIENTO, ASSIGNED_ORDERS_ROUTE],
    ['Maestro', ROLE_MAESTRO, null],
  ])('R24: %s aterriza donde antes, tenga o no permisos de notificaciones', (_nombre, rol, esperado) => {
    const permisos = permisosDe(rol);
    const sinNotificaciones = permisos.filter((permiso) => !permiso.startsWith('notificaciones.'));

    expect(aterrizaje(permisos)).toBe(esperado);
    expect(aterrizaje(sinNotificaciones)).toBe(esperado);
  });
});
