// El grupo «Clientes» del menu privado y sus dos hijos.
//
// Se ITERA `PRIVATE_NAV_ITEMS` y se afirma sobre las constantes de ruta y de etiqueta y sobre los
// `testId`, nunca sobre el literal del copy. El permiso de cada hijo se compara con el que exige
// la `page.tsx` de su destino, leido de su fuente.
//
// Los `R<n>` sin prefijo son de QC-244 (el grupo y su cascaron). Los marcados `QC-246 R2` son de
// QC-246: el hijo «Contactos» pasa a exigir `whatsapp.consultar` y desaparece del menu de quien no
// lo trae, aunque tenga `clientes.consultar`.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROLE_ADMINISTRADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity';
import { NAV_ICONS } from '@/lib/shared/navigation/nav-icons';
import {
  CUSTOMER_CONTACTS_LABEL,
  CUSTOMERS_LABEL,
  NAV_SECTION_DIRECTORY,
  PRIVATE_NAV_ITEMS,
  filterNavItemsByPermissions,
  firstVisibleNavHref,
  groupNavItemsBySection,
  type NavGroup,
  type NavItem,
  type NavLink,
} from '@/lib/shared/navigation/private-nav';
import { CUSTOMER_CONTACTS_ROUTE, CUSTOMERS_ROUTE, SUPPLIERS_ROUTE } from '@/lib/shared/routes';

const RAIZ = join(__dirname, '..', '..', '..');

const PERMISO = 'clientes.consultar';
/** QC-246 D1: Contactos se ve con `whatsapp.consultar`, no con el permiso de la lista. */
const PERMISO_CONTACTOS = 'whatsapp.consultar';
const TESTID_GRUPO = 'nav-clientes';
const TESTID_LISTA = 'nav-clientes-lista';
const TESTID_CONTACTOS = 'nav-clientes-contactos';

/** La `page.tsx` de un destino, DERIVADA de su `href`: el route group no aporta segmento. */
function paginaDe(href: string): string {
  return join(RAIZ, 'app', '(private)', ...href.split('/').filter(Boolean), 'page.tsx');
}

/** Los codigos que exige una pantalla, LEIDOS DE SU FUENTE y sin comentarios. */
function permisosDeLaPantalla(href: string): readonly string[] {
  return [
    ...readFileSync(paginaDe(href), 'utf8')
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .matchAll(/requirePagePermission\(([^)]*)\)/g),
  ].map((coincidencia) => (coincidencia[1] as string).replace(/^'([^']*)'$/, '$1'));
}

const NAV_APLANADO: readonly NavLink[] = PRIVATE_NAV_ITEMS.flatMap((item) =>
  item.kind === 'group' ? item.items : [item],
);

const GRUPOS_DE_CLIENTES = PRIVATE_NAV_ITEMS.filter(
  (item): item is NavGroup => item.kind === 'group' && item.testId === TESTID_GRUPO,
);
const GRUPO = GRUPOS_DE_CLIENTES[0];

/** El menu tal como era antes del grupo: un enlace de nivel superior en su misma posicion. */
const MENU_DE_ANTES: readonly NavItem[] = PRIVATE_NAV_ITEMS.map(
  (item): NavItem =>
    item.kind === 'group' && item === GRUPO
      ? {
          kind: 'link',
          href: CUSTOMERS_ROUTE,
          label: CUSTOMERS_LABEL,
          testId: TESTID_GRUPO,
          permission: PERMISO,
          icon: item.icon,
          section: item.section,
        }
      : item,
);

const ROLES_DEL_SEED = Object.keys(SEED_ROLE_PERMISSIONS);
const ROLES_SIN_PERMISO = ROLES_DEL_SEED.filter(
  (rol) => !(SEED_ROLE_PERMISSIONS[rol] ?? []).includes(PERMISO),
);

function permisosDe(rol: string): readonly string[] {
  const permisos = SEED_ROLE_PERMISSIONS[rol];
  if (permisos === undefined) throw new Error(`el seed no tiene el rol "${rol}"`);
  return permisos;
}

describe('el grupo «Clientes» del menu', () => {
  it('R1: hay un solo NavGroup con testId nav-clientes, con su etiqueta, icono y seccion', () => {
    expect(GRUPOS_DE_CLIENTES).toHaveLength(1);
    expect(PRIVATE_NAV_ITEMS.filter((item) => item.testId === TESTID_GRUPO)).toHaveLength(1);
    expect(GRUPO?.kind).toBe('group');
    expect(GRUPO?.label).toBe(CUSTOMERS_LABEL);
    expect(GRUPO?.icon).toBe('square-user');
    expect(GRUPO?.section).toBe(NAV_SECTION_DIRECTORY);
    if (GRUPO?.icon) expect(NAV_ICONS[GRUPO.icon]).toBeDefined();
  });

  it('R1: va justo detras del enlace de proveedores y es el ultimo de «Directorio»', () => {
    const indiceProveedores = PRIVATE_NAV_ITEMS.findIndex(
      (item) => item.kind === 'link' && item.href === SUPPLIERS_ROUTE,
    );
    expect(indiceProveedores).toBeGreaterThanOrEqual(0);
    expect(PRIVATE_NAV_ITEMS[indiceProveedores + 1]).toBe(GRUPO);

    const directorio =
      groupNavItemsBySection(PRIVATE_NAV_ITEMS).find(
        (seccion) => seccion.label === NAV_SECTION_DIRECTORY,
      )?.items ?? [];
    expect(directorio[directorio.length - 1]).toBe(GRUPO);
  });

  it('R1: ningun enlace de nivel superior apunta ya a CUSTOMERS_ROUTE', () => {
    expect(
      PRIVATE_NAV_ITEMS.filter((item) => item.kind === 'link' && item.href === CUSTOMERS_ROUTE),
    ).toEqual([]);
  });

  it('R2: el grupo tiene exactamente dos hijos, en orden, sin icono ni seccion', () => {
    expect(GRUPO?.items).toEqual([
      {
        kind: 'link',
        href: CUSTOMERS_ROUTE,
        label: CUSTOMERS_LABEL,
        testId: TESTID_LISTA,
        permission: PERMISO,
      },
      {
        kind: 'link',
        href: CUSTOMER_CONTACTS_ROUTE,
        label: CUSTOMER_CONTACTS_LABEL,
        testId: TESTID_CONTACTOS,
        permission: PERMISO_CONTACTOS,
      },
    ]);
    for (const hijo of GRUPO?.items ?? []) {
      expect(hijo.icon, hijo.testId).toBeUndefined();
      expect(hijo.section, hijo.testId).toBeUndefined();
    }
  });

  it('R2: cada destino y cada testId del grupo aparece una sola vez en el menu aplanado', () => {
    expect(NAV_APLANADO.filter((enlace) => enlace.href === CUSTOMERS_ROUTE)).toHaveLength(1);
    expect(NAV_APLANADO.filter((enlace) => enlace.href === CUSTOMER_CONTACTS_ROUTE)).toHaveLength(1);
    expect(NAV_APLANADO.filter((enlace) => enlace.testId === TESTID_LISTA)).toHaveLength(1);
    expect(NAV_APLANADO.filter((enlace) => enlace.testId === TESTID_CONTACTOS)).toHaveLength(1);
  });
});

describe('el permiso de cada hijo es EL MISMO que exige su pantalla', () => {
  it('R3: el grupo tiene hijos que comparar', () => {
    expect(GRUPO?.items.length).toBe(2);
  });

  it.each(GRUPO?.items.map((hijo) => [hijo.testId, hijo] as const) ?? [])(
    'R3, R12, R14: %s declara el mismo y unico codigo que exige la page.tsx de su destino',
    (_testId, hijo) => {
      const permisos = permisosDeLaPantalla(hijo.href);

      expect(permisos).toEqual([hijo.permission]);
      expect(hijo.permission).toBe(hijo.testId === TESTID_CONTACTOS ? PERMISO_CONTACTOS : PERMISO);
    },
  );
});

describe('el grupo se ve con el permiso y desaparece sin el', () => {
  it('R4: con los permisos del Administrador el menu filtrado tiene el grupo con sus dos hijos', () => {
    const visible = filterNavItemsByPermissions(
      PRIVATE_NAV_ITEMS,
      permisosDe(ROLE_ADMINISTRADOR),
    );
    const grupo = visible.find(
      (item): item is NavGroup => item.kind === 'group' && item.testId === TESTID_GRUPO,
    );

    expect(grupo?.items.map((hijo) => hijo.testId)).toEqual([TESTID_LISTA, TESTID_CONTACTOS]);
  });

  it('R5: ancla: el Administrador tiene el permiso y al menos un rol del seed no lo tiene', () => {
    expect(permisosDe(ROLE_ADMINISTRADOR)).toContain(PERMISO);
    expect(ROLES_SIN_PERMISO.length).toBeGreaterThan(0);
    for (const rol of ROLES_SIN_PERMISO) {
      expect(permisosDe(rol).length, rol).toBeGreaterThan(0);
    }
  });

  it.each(ROLES_SIN_PERMISO)(
    'R5: %s, sin el permiso, no recibe el grupo ni nada suyo en lo serializado',
    (rol) => {
      const visible = filterNavItemsByPermissions(PRIVATE_NAV_ITEMS, permisosDe(rol));
      const serializado = JSON.stringify(visible);

      expect(visible.map((item) => item.testId)).not.toContain(TESTID_GRUPO);
      for (const prohibido of [
        CUSTOMERS_LABEL,
        CUSTOMER_CONTACTS_LABEL,
        CUSTOMERS_ROUTE,
        CUSTOMER_CONTACTS_ROUTE,
        TESTID_GRUPO,
        TESTID_LISTA,
        TESTID_CONTACTOS,
      ]) {
        expect(serializado, prohibido).not.toContain(prohibido);
      }
    },
  );
});

describe('QC-246: el hijo «Contactos» exige whatsapp.consultar', () => {
  const ROLES_SIN_WHATSAPP = ROLES_DEL_SEED.filter(
    (rol) => !permisosDe(rol).includes(PERMISO_CONTACTOS),
  );

  /** Los `testId` de los hijos del grupo que sobreviven al filtrado, o `[]` si el grupo cae. */
  function hijosVisibles(permisos: readonly string[]): readonly string[] {
    const grupo = filterNavItemsByPermissions(PRIVATE_NAV_ITEMS, permisos).find(
      (item): item is NavGroup => item.kind === 'group' && item.testId === TESTID_GRUPO,
    );
    return grupo?.items.map((hijo) => hijo.testId) ?? [];
  }

  it('QC-246 R2: el hijo declara whatsapp.consultar, el mismo y unico que exige su page.tsx', () => {
    const contactos = GRUPO?.items.find((hijo) => hijo.testId === TESTID_CONTACTOS);

    expect(contactos?.permission).toBe(PERMISO_CONTACTOS);
    // Anti-vacuidad: el codigo se leyo de la fuente de la pagina (T15) y no de una copia aqui.
    expect(permisosDeLaPantalla(CUSTOMER_CONTACTS_ROUTE)).toEqual([PERMISO_CONTACTOS]);
  });

  it('QC-246 R2: con clientes.consultar y sin whatsapp.consultar se ve la lista y NO Contactos', () => {
    const permisos = [PERMISO];

    expect(hijosVisibles(permisos)).toEqual([TESTID_LISTA]);
    const serializado = JSON.stringify(filterNavItemsByPermissions(PRIVATE_NAV_ITEMS, permisos));
    for (const prohibido of [CUSTOMER_CONTACTS_ROUTE, CUSTOMER_CONTACTS_LABEL, TESTID_CONTACTOS]) {
      expect(serializado, prohibido).not.toContain(prohibido);
    }
  });

  it('QC-246 R2: con whatsapp.consultar el hijo aparece (Administrador del seed)', () => {
    expect(permisosDe(ROLE_ADMINISTRADOR)).toContain(PERMISO_CONTACTOS);
    expect(hijosVisibles(permisosDe(ROLE_ADMINISTRADOR))).toContain(TESTID_CONTACTOS);
  });

  it('QC-246 R2: ancla: hay roles del seed sin whatsapp.consultar', () => {
    expect(ROLES_SIN_WHATSAPP.length).toBeGreaterThan(0);
  });

  it.each(ROLES_SIN_WHATSAPP)('QC-246 R2: %s, sin whatsapp.consultar, no recibe el hijo Contactos', (rol) => {
    expect(hijosVisibles(permisosDe(rol))).not.toContain(TESTID_CONTACTOS);
    expect(JSON.stringify(filterNavItemsByPermissions(PRIVATE_NAV_ITEMS, permisosDe(rol)))).not.toContain(
      CUSTOMER_CONTACTS_ROUTE,
    );
  });
});

describe('lo que no cambia', () => {
  it.each(ROLES_DEL_SEED)('R13: %s aterriza igual con el grupo, sin el y con el enlace de antes', (rol) => {
    const permisos = permisosDe(rol);
    const conGrupo = firstVisibleNavHref(filterNavItemsByPermissions(PRIVATE_NAV_ITEMS, permisos));
    const sinGrupo = firstVisibleNavHref(
      filterNavItemsByPermissions(
        PRIVATE_NAV_ITEMS.filter((item) => item !== GRUPO),
        permisos,
      ),
    );
    const antes = firstVisibleNavHref(filterNavItemsByPermissions(MENU_DE_ANTES, permisos));

    expect(conGrupo).toBe(sinGrupo);
    expect(conGrupo).toBe(antes);
  });

  it('R13: el orden y los testId de los items de nivel superior son los de antes', () => {
    expect(PRIVATE_NAV_ITEMS.map((item) => item.testId)).toEqual([
      'nav-dashboard',
      'nav-inventario',
      'nav-pedidos',
      'nav-asignacion',
      'nav-produccion-recetas',
      'nav-proveedores',
      'nav-clientes',
      'nav-usuarios',
      'nav-presentaciones',
      'nav-unidades',
      'nav-integraciones',
      'nav-empresas',
      'nav-administradores',
    ]);
    expect(PRIVATE_NAV_ITEMS.map((item) => item.testId)).toEqual(
      MENU_DE_ANTES.map((item) => item.testId),
    );
  });

  it('R13: el orden de las secciones es el de antes', () => {
    expect(groupNavItemsBySection(PRIVATE_NAV_ITEMS).map((seccion) => seccion.label)).toEqual(
      groupNavItemsBySection(MENU_DE_ANTES).map((seccion) => seccion.label),
    );
  });
});
