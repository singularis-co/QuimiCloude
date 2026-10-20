// La sección «Plataforma» del menú privado: sus dos enlaces, el menú exacto del Maestro y el
// aterrizaje de cada rol del seed. Se afirma sobre las constantes importadas, nunca sobre el copy.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PERMISSIONS,
  ROLE_MAESTRO,
  SEED_ROLE_PERMISSIONS,
} from '@/lib/modules/identity';
import { NAV_ICONS } from '@/lib/shared/navigation/nav-icons';
import {
  ADMINISTRATORS_LABEL,
  COMPANIES_LABEL,
  NAV_SECTION_PLATFORM,
  PRIVATE_NAV_ITEMS,
  filterNavItemsByPermissions,
  firstVisibleNavHref,
  groupNavItemsBySection,
  homeHrefFor,
  type NavItem,
  type NavLink,
} from '@/lib/shared/navigation/private-nav';
import {
  MAESTRO_ADMINISTRATORS_ROUTE,
  MAESTRO_COMPANIES_ROUTE,
  PRIVATE_ROUTE_PREFIXES,
  maestroCompanyRoute,
} from '@/lib/shared/routes';

const RAIZ = join(__dirname, '..', '..', '..');

const RUTAS_DE_PLATAFORMA: readonly string[] = [MAESTRO_COMPANIES_ROUTE, MAESTRO_ADMINISTRATORS_ROUTE];

const TODOS_LOS_PERMISOS: readonly string[] = PERMISSIONS.map((permiso) => permiso.code);

function permisosDe(rol: string): readonly string[] {
  const permisos = SEED_ROLE_PERMISSIONS[rol];
  if (permisos === undefined) throw new Error(`el seed no tiene el rol "${rol}"`);
  return permisos;
}

function claveDe(item: NavItem): string {
  return item.kind === 'link' ? item.href : item.testId;
}

function menuPorSecciones(permisos: readonly string[]) {
  return groupNavItemsBySection(filterNavItemsByPermissions(PRIVATE_NAV_ITEMS, permisos)).map(
    (seccion) => ({ label: seccion.label, items: seccion.items.map(claveDe) }),
  );
}

function enlacesDePlataforma(): readonly NavLink[] {
  return PRIVATE_NAV_ITEMS.filter(
    (item): item is NavLink => item.kind === 'link' && RUTAS_DE_PLATAFORMA.includes(item.href),
  );
}

/** El menú tal como era antes de la sección «Plataforma»: sirve de referencia para R5. */
const MENU_SIN_PLATAFORMA: readonly NavItem[] = PRIVATE_NAV_ITEMS.filter(
  (item) => item.section !== NAV_SECTION_PLATFORM,
);

/** El permiso que exige cada página, leído de su fuente sin comentarios. */
function permisosDeLaPagina(ruta: string): readonly string[] {
  const fuente = readFileSync(
    join(RAIZ, 'app', '(private)', ...ruta.split('/').filter(Boolean), 'page.tsx'),
    'utf8',
  )
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  return [...fuente.matchAll(/requirePagePermission\('([^']+)'\)/g)].map(
    (coincidencia) => coincidencia[1] as string,
  );
}

const ROLES_SIN_EMPRESAS = Object.keys(SEED_ROLE_PERMISSIONS).filter(
  (rol) => !permisosDe(rol).some((codigo) => codigo.startsWith('empresas.')),
);

describe('sección «Plataforma» del menú', () => {
  it('R2: «Empresas» y «Administradores», en ese orden, al final del menú y con empresas.consultar', () => {
    const enlaces = enlacesDePlataforma();

    expect(enlaces.map((enlace) => [enlace.href, enlace.label, enlace.testId])).toEqual([
      [MAESTRO_COMPANIES_ROUTE, COMPANIES_LABEL, 'nav-empresas'],
      [MAESTRO_ADMINISTRATORS_ROUTE, ADMINISTRATORS_LABEL, 'nav-administradores'],
    ]);
    for (const enlace of enlaces) {
      expect(enlace.permission).toBe('empresas.consultar');
      expect(enlace.section).toBe(NAV_SECTION_PLATFORM);
      expect(enlace.icon === undefined ? undefined : NAV_ICONS[enlace.icon], enlace.testId).toBeDefined();
    }
    expect(PRIVATE_NAV_ITEMS.slice(-2)).toEqual(enlaces);
  });

  it('R2: el permiso del enlace es el mismo que exige su página', () => {
    for (const enlace of enlacesDePlataforma()) {
      expect(permisosDeLaPagina(enlace.href), enlace.href).toEqual([enlace.permission]);
    }
  });

  it('R2: sin empresas.consultar, el menú filtrado no trae la sección ni sus enlaces', () => {
    const sinEmpresas = TODOS_LOS_PERMISOS.filter((codigo) => codigo !== 'empresas.consultar');
    const filtrado = filterNavItemsByPermissions(PRIVATE_NAV_ITEMS, sinEmpresas);

    expect(filtrado.some((item) => item.section === NAV_SECTION_PLATFORM)).toBe(false);
    expect(filtrado.map(claveDe)).not.toEqual(expect.arrayContaining([MAESTRO_COMPANIES_ROUTE]));
    expect(filtrado.map(claveDe)).not.toEqual(
      expect.arrayContaining([MAESTRO_ADMINISTRATORS_ROUTE]),
    );
  });

  it('R2: las dos pantallas exigen sesión (prefijo privado) y el detalle cuelga de la lista', () => {
    expect(PRIVATE_ROUTE_PREFIXES).toEqual(
      expect.arrayContaining([MAESTRO_COMPANIES_ROUTE, MAESTRO_ADMINISTRATORS_ROUTE]),
    );
    expect(maestroCompanyRoute('abc')).toBe(`${MAESTRO_COMPANIES_ROUTE}/abc`);
    expect(maestroCompanyRoute('abc', 'modulos')).toBe(`${MAESTRO_COMPANIES_ROUTE}/abc?tab=modulos`);
  });
});

describe('menú del Maestro', () => {
  it('R3: con los permisos del Maestro del seed, el menú es exactamente «Plataforma» con sus dos enlaces', () => {
    expect(menuPorSecciones(permisosDe(ROLE_MAESTRO))).toEqual([
      { label: NAV_SECTION_PLATFORM, items: [MAESTRO_COMPANIES_ROUTE, MAESTRO_ADMINISTRATORS_ROUTE] },
    ]);
  });
});

describe('aterrizaje', () => {
  it('R4: el Maestro aterriza en /maestro/empresas', () => {
    expect(homeHrefFor(permisosDe(ROLE_MAESTRO))).toBe(MAESTRO_COMPANIES_ROUTE);
  });

  it('R5: ancla: hay roles del seed sin ningún permiso empresas.*', () => {
    expect(ROLES_SIN_EMPRESAS.length).toBeGreaterThan(0);
    expect(ROLES_SIN_EMPRESAS).not.toContain(ROLE_MAESTRO);
  });

  it.each(ROLES_SIN_EMPRESAS)(
    'R5: %s aterriza donde aterrizaba sin la sección «Plataforma»',
    (rol) => {
      const antes = firstVisibleNavHref(
        filterNavItemsByPermissions(MENU_SIN_PLATAFORMA, permisosDe(rol)),
      );

      expect(antes).not.toBeNull();
      expect(homeHrefFor(permisosDe(rol))).toBe(antes);
      expect(menuPorSecciones(permisosDe(rol)).map((seccion) => seccion.label)).not.toContain(
        NAV_SECTION_PLATFORM,
      );
    },
  );
});
