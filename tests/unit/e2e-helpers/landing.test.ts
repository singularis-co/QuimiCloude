// QC-93 T4 — el helper de aterrizaje de los E2E (R2, R3, R4, R5).
// QC-277 T18 — el helper usa el permiso efectivo (rol recortado por los añadidos) y `homeHrefFor`
// (R20); nace `enableAllAddons`.
// QC-277 T28 — los interruptores son excepciones en `company_addon_overrides` (D14, P7).
//
// La base se mockea: aqui se prueba la regla y la forma de la consulta. Que la consulta devuelva
// lo sembrado de verdad lo cierra la corrida E2E real.
const { findFirstMock, overrideUpsertMock, transactionMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  overrideUpsertMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock('@/lib/shared/db/prisma', () => ({
  prisma: {
    user: { findFirst: findFirstMock },
    companyAddonOverride: { upsert: overrideUpsertMock },
    $transaction: transactionMock,
  },
}));

/** La empresa como la devuelve el `select`: solo las excepciones prendidas, por su clave. */
function companyWith(addons: readonly string[]): { addonOverrides: { addonKey: string }[] } {
  return { addonOverrides: addons.map((addonKey) => ({ addonKey })) };
}

import { enableAllAddons } from '@/e2e/helpers/addons';
import {
  expectedLandingRoute,
  landingRouteForPermissions,
  permissionsForUsername,
} from '@/e2e/helpers/landing';
import {
  ADDONS,
  ROLE_ADMINISTRADOR,
  ROLE_OPERADOR,
  SEED_ROLE_PERMISSIONS,
} from '@/lib/modules/identity';
import { homeHrefFor } from '@/lib/shared/navigation/private-nav';
import { DASHBOARD_ROUTE, INVENTORY_ROUTE } from '@/lib/shared/routes';

function seedPermissionsOf(role: string): readonly string[] {
  const permissions = SEED_ROLE_PERMISSIONS[role];
  if (permissions === undefined) throw new Error(`el catalogo no tiene el rol "${role}"`);
  return permissions;
}

describe('QC-93 — landingRouteForPermissions deriva el destino con la regla del login', () => {
  it('lleva al dashboard a quien tiene los permisos sembrados del Administrador, que no consulta asignacion (R2)', () => {
    expect(landingRouteForPermissions(seedPermissionsOf(ROLE_ADMINISTRADOR))).toBe(DASHBOARD_ROUTE);
  });

  it('lleva a inventario a quien tiene los permisos sembrados del Operador (R2)', () => {
    expect(landingRouteForPermissions(seedPermissionsOf(ROLE_OPERADOR))).toBe(INVENTORY_ROUTE);
  });

  it('cae en el dashboard de respaldo cuando no hay ningun permiso (R3)', () => {
    expect(landingRouteForPermissions([])).toBe(DASHBOARD_ROUTE);
  });

  it('cae en el dashboard de respaldo cuando el unico permiso no abre ningun item del menu (R3)', () => {
    expect(landingRouteForPermissions(['modulo-inventado.consultar'])).toBe(DASHBOARD_ROUTE);
  });

  it('coincide con homeHrefFor, la regla de produccion, para cada rol del catalogo, sin regla propia (R2, QC-277 R20)', () => {
    const roles = Object.keys(SEED_ROLE_PERMISSIONS);
    expect(roles.length).toBeGreaterThan(0);

    for (const role of roles) {
      const permissions = seedPermissionsOf(role);
      expect(landingRouteForPermissions(permissions), role).toBe(homeHrefFor(permissions));
    }
  });
});

describe('QC-93 — permissionsForUsername lee los permisos del usuario vivo en la base', () => {
  beforeEach(() => {
    findFirstMock.mockReset();
  });

  it('devuelve los codigos de permiso del rol y consulta solo usuarios vivos con ese username (R4)', async () => {
    findFirstMock.mockResolvedValue({
      role: {
        permissions: [
          { permissionCode: 'inventario.consultar' },
          { permissionCode: 'asignaciones.consultar' },
        ],
      },
      company: companyWith([]),
    });

    await expect(permissionsForUsername('qc93_operador')).resolves.toEqual([
      'inventario.consultar',
      'asignaciones.consultar',
    ]);
    expect(findFirstMock).toHaveBeenCalledTimes(1);
    expect(findFirstMock.mock.calls[0]?.[0]).toMatchObject({
      where: { username: 'qc93_operador', deletedAt: null },
    });
  });

  it('rechaza nombrando el username cuando no hay usuario vivo, sin devolver ninguna ruta (R5)', async () => {
    findFirstMock.mockResolvedValue(null);

    await expect(permissionsForUsername('qc93_fantasma')).rejects.toThrow('qc93_fantasma');
    await expect(expectedLandingRoute('qc93_fantasma')).rejects.toThrow('qc93_fantasma');
  });

  it('deriva el destino esperado de los permisos que devuelve la base (R4)', async () => {
    findFirstMock.mockResolvedValue({
      role: { permissions: [{ permissionCode: 'inventario.consultar' }] },
      company: companyWith([]),
    });

    await expect(expectedLandingRoute('qc93_operador')).resolves.toBe(INVENTORY_ROUTE);
  });
});

function seedRoleRows(role: string): { permissionCode: string }[] {
  return seedPermissionsOf(role).map((permissionCode) => ({ permissionCode }));
}

describe('QC-277 — el aterrizaje E2E usa el permiso efectivo: rol recortado por los añadidos (R20)', () => {
  beforeEach(() => {
    findFirstMock.mockReset();
  });

  it('pide en la misma consulta solo las excepciones prendidas de la empresa del usuario (R20)', async () => {
    findFirstMock.mockResolvedValue({ role: { permissions: [] }, company: companyWith([]) });

    await permissionsForUsername('qc277_admin');

    expect(findFirstMock.mock.calls[0]?.[0]).toMatchObject({
      select: {
        company: {
          select: { addonOverrides: { where: { enabled: true }, select: { addonKey: true } } },
        },
      },
    });
  });

  it('aterriza en /inventario a un Administrador cuya empresa no tiene añadidos (R20, hecho de T18)', async () => {
    findFirstMock.mockResolvedValue({
      role: { permissions: seedRoleRows(ROLE_ADMINISTRADOR) },
      company: companyWith([]),
    });

    const permissions = await permissionsForUsername('qc277_admin');
    expect(permissions).not.toContain('dashboard.consultar');
    expect(permissions).not.toContain('proveedores.consultar');
    expect(permissions).not.toContain('integraciones.modificar');
    expect(permissions).toContain('inventario.consultar');
    await expect(expectedLandingRoute('qc277_admin')).resolves.toBe(INVENTORY_ROUTE);
  });

  it('aterriza en el dashboard a un Administrador cuya empresa tiene todos los añadidos (R20)', async () => {
    findFirstMock.mockResolvedValue({
      role: { permissions: seedRoleRows(ROLE_ADMINISTRADOR) },
      company: companyWith(ADDONS),
    });

    await expect(permissionsForUsername('qc277_admin')).resolves.toEqual(
      seedPermissionsOf(ROLE_ADMINISTRADOR),
    );
    await expect(expectedLandingRoute('qc277_admin')).resolves.toBe(DASHBOARD_ROUTE);
  });

  it('no cuenta un interruptor cuya dependencia esta apagada, igual que la sesion (R20)', async () => {
    findFirstMock.mockResolvedValue({
      role: {
        permissions: [
          { permissionCode: 'documentos.consultar' },
          { permissionCode: 'inventario.consultar' },
        ],
      },
      company: companyWith(['lectura_pdf']),
    });

    await expect(permissionsForUsername('qc277_admin')).resolves.toEqual(['inventario.consultar']);
  });

  it('deja enteros los permisos del rol de quien no tiene empresa, el Maestro (R20)', async () => {
    findFirstMock.mockResolvedValue({
      role: {
        permissions: [
          { permissionCode: 'empresas.consultar' },
          { permissionCode: 'dashboard.consultar' },
        ],
      },
      company: null,
    });

    await expect(permissionsForUsername('qc277_maestro')).resolves.toEqual([
      'empresas.consultar',
      'dashboard.consultar',
    ]);
  });
});

describe('QC-277 — enableAllAddons prende los seis añadidos a la empresa de fixture (R20, P7)', () => {
  beforeEach(() => {
    overrideUpsertMock.mockReset();
    overrideUpsertMock.mockImplementation((args: unknown) => args);
    transactionMock.mockReset();
    transactionMock.mockResolvedValue([]);
  });

  it('hace upsert de una excepcion prendida por añadido, sin autor, en la empresa indicada y en una transaccion', async () => {
    const companyId = '00000000-0000-0000-0000-000000000277';
    await enableAllAddons(companyId);

    expect(overrideUpsertMock).toHaveBeenCalledTimes(ADDONS.length);
    for (const addonKey of ADDONS) {
      expect(overrideUpsertMock).toHaveBeenCalledWith({
        where: { companyId_addonKey: { companyId, addonKey } },
        create: { companyId, addonKey, enabled: true },
        update: { enabled: true },
      });
    }
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(transactionMock.mock.calls[0]?.[0]).toHaveLength(ADDONS.length);
  });
});
