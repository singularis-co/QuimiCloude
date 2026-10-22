// La pantalla de importación y el enlace que lleva a ella. Se dobla el proveedor de sesión, no
// `requirePagePermission`, así que el corte se ejecuta de verdad y `notFound()`/`redirect()`
// lanzan como en producción.

import { cleanup, render, screen } from '@testing-library/react';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import InventarioPage from '@/app/(private)/inventario/page';
import InventoryImportPage, { maxDuration } from '@/app/(private)/inventario/importar/page';
import {
  GUIDE_TESTID,
  GUIDE_VALUES_TESTID,
  GUIDE_VALUES_UNAVAILABLE,
  IMPORT_BACK_LABEL,
  IMPORT_BACK_LINK_TESTID,
  IMPORT_PAGE_DESCRIPTION,
  IMPORT_PAGE_TITLE,
  IMPORT_SCREEN_TESTID,
  IMPORT_STEPS_TESTID,
  IMPORT_TITLE_TESTID,
  TEMPLATE_BUTTON_LABEL,
  TEMPLATE_BUTTON_TESTID,
} from '@/app/(private)/inventario/importar/components';
import { PERMISSIONS } from '@/lib/modules/identity';
import type { ProductFormUnitsResult } from '@/lib/modules/inventario/adapters/driving/product-actions';
import type { UnitListResult } from '@/lib/modules/unidades/adapters/driving/unit-actions';
import { INVENTORY_IMPORT_ROUTE, INVENTORY_ROUTE, LOGIN_ROUTE_SESSION_ENDED } from '@/lib/shared/routes';

import { setupUser } from '../../../helpers/user-event';

const {
  getSessionUserMock,
  notFoundMock,
  redirectMock,
  listUnitsActionMock,
  listProductFormUnitsActionMock,
  getValuesActionMock,
} = vi.hoisted(() => ({
    getSessionUserMock: vi.fn<() => Promise<unknown>>(),
    notFoundMock: vi.fn<() => never>(() => {
      throw new Error('NEXT_NOT_FOUND');
    }),
    redirectMock: vi.fn<(ruta: string) => never>(() => {
      throw new Error('NEXT_REDIRECT');
    }),
    listUnitsActionMock: vi.fn<() => Promise<UnitListResult>>(),
    listProductFormUnitsActionMock: vi.fn<() => Promise<ProductFormUnitsResult>>(),
    getValuesActionMock: vi.fn<() => Promise<unknown>>(),
  }));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: notFoundMock,
  redirect: redirectMock,
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock, endSession: vi.fn<() => Promise<void>>() },
  observabilidad: { readRequestIdHeader: vi.fn(async (): Promise<string | null> => null) },
}));

vi.mock('@/lib/modules/unidades/adapters/driving/unit-actions', () => ({
  listUnitsAction: listUnitsActionMock,
  createUnitAction: vi.fn(),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/product-actions', () => ({
  listProductFormUnitsAction: listProductFormUnitsActionMock,
}));

vi.mock('@/lib/modules/inventario/adapters/driving/presentation-actions', () => ({
  createPresentationAction: vi.fn(),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/inventory-import-actions', () => ({
  previewInventoryImportAction: vi.fn(),
  confirmInventoryImportAction: vi.fn(),
  getInventoryImportTemplateAction: vi.fn(),
  getInventoryImportValuesAction: getValuesActionMock,
}));

const VALORES = { units: ['kilogramo'], presentations: ['Bidón 20 L'], formulas: ['Desengrasante'] };

const TODOS_LOS_PERMISOS = PERMISSIONS.map((permiso) => permiso.code);

function sesionCon(permissions: readonly string[], addons: readonly string[] = ['importacion_excel']) {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    username: 'admin.prueba',
    displayName: 'Admin De Prueba',
    roleName: 'Administrador',
    permissions,
    addons,
  };
}

/** Busca en el árbol devuelto por un Server Component un elemento cuyo `href` sea `href`. */
function contieneEnlaceA(nodo: ReactNode, href: string): boolean {
  if (Array.isArray(nodo)) return nodo.some((hijo: ReactNode) => contieneEnlaceA(hijo, href));
  if (!isValidElement(nodo)) return false;
  const props = (nodo as ReactElement<{ href?: unknown; children?: ReactNode; actions?: ReactNode }>).props;
  if (props.href === href) return true;
  return contieneEnlaceA(props.children, href) || contieneEnlaceA(props.actions, href);
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUserMock.mockResolvedValue(sesionCon(TODOS_LOS_PERMISOS));
  listUnitsActionMock.mockResolvedValue({ status: 'success', data: [] });
  listProductFormUnitsActionMock.mockResolvedValue({ status: 'success', data: [] });
  getValuesActionMock.mockResolvedValue({ status: 'success', data: VALORES });
});

afterEach(() => {
  cleanup();
});

describe('pantalla /inventario/importar', () => {
  it('R2 sin inventario.modificar responde 404 y no pide nada', async () => {
    getSessionUserMock.mockResolvedValue(
      sesionCon(TODOS_LOS_PERMISOS.filter((codigo) => codigo !== 'inventario.modificar')),
    );

    await expect(InventoryImportPage()).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(listUnitsActionMock).not.toHaveBeenCalled();
  });

  it('R2 sin sesión redirige al login y no responde 404', async () => {
    getSessionUserMock.mockResolvedValue(null);

    await expect(InventoryImportPage()).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith(LOGIN_ROUTE_SESSION_ENDED);
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('R13 R14 sin el añadido importacion_excel responde 404 y no pide nada', async () => {
    getSessionUserMock.mockResolvedValue(sesionCon(TODOS_LOS_PERMISOS, []));

    await expect(InventoryImportPage()).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(listUnitsActionMock).not.toHaveBeenCalled();
  });

  it('R2 con inventario.modificar pinta la pantalla y pide las unidades una vez', async () => {
    getSessionUserMock.mockResolvedValue(sesionCon(['inventario.modificar']));

    render(await InventoryImportPage());

    expect(screen.getByTestId(IMPORT_TITLE_TESTID)).toBeInTheDocument();
    expect(screen.getByTestId(IMPORT_SCREEN_TESTID)).toBeInTheDocument();
    expect(listUnitsActionMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(GUIDE_TESTID)).toBeInTheDocument();
  });

  it('si las unidades no se pueden leer, la pantalla se pinta igual', async () => {
    listUnitsActionMock.mockResolvedValue({ status: 'error', code: 'unauthorized', message: 'x' });

    render(await InventoryImportPage());

    expect(screen.getByTestId(IMPORT_SCREEN_TESTID)).toBeInTheDocument();
  });

  it('R29 pinta «Volver a inventario» con flecha encima del título y lleva a /inventario', async () => {
    render(await InventoryImportPage());

    const volver = screen.getByTestId(IMPORT_BACK_LINK_TESTID);
    expect(volver.tagName).toBe('A');
    expect(volver).toHaveAttribute('href', INVENTORY_ROUTE);
    expect(volver).toHaveAttribute('data-direction', 'back');
    expect(volver).toHaveClass('group/button', 'border');
    expect(volver).toHaveClass('min-h-11');
    expect(volver).toHaveTextContent(IMPORT_BACK_LABEL);
    expect(volver.querySelector('svg')).not.toBeNull();
    const titulo = screen.getByTestId(IMPORT_TITLE_TESTID);
    expect(volver.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('R29 «Importar inventario» es el único h1, con PageHeader y la descripción de hoy', async () => {
    render(await InventoryImportPage());

    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveAttribute('data-testid', IMPORT_TITLE_TESTID);
    expect(titulos[0]).toHaveTextContent(IMPORT_PAGE_TITLE);
    expect(titulos[0]?.closest('[data-slot="page-header"]')).not.toBeNull();
    expect(screen.getByText(IMPORT_PAGE_DESCRIPTION)).toBeInTheDocument();
    expect(titulos[0]?.closest('[data-slot="page-shell"]')).not.toBeNull();
  });

  it('R29 R30 «Descargar plantilla» va en las acciones de la cabecera y en ningún otro sitio', async () => {
    render(await InventoryImportPage());

    const plantillas = screen.getAllByTestId(TEMPLATE_BUTTON_TESTID);
    expect(plantillas).toHaveLength(1);
    expect(plantillas[0]?.closest('[data-slot="page-header-actions"]')).not.toBeNull();
    expect(screen.getAllByText(TEMPLATE_BUTTON_LABEL)).toHaveLength(1);
    expect(screen.getByTestId(IMPORT_SCREEN_TESTID)).not.toContainElement(plantillas[0] ?? null);
  });

  it('R30 «Volver a inventario» no es un enlace de texto', async () => {
    render(await InventoryImportPage());

    const enlaces = screen.getAllByRole('link', { name: IMPORT_BACK_LABEL });
    expect(enlaces).toHaveLength(1);
    expect(enlaces[0]).toHaveClass('group/button', 'border');
    expect(enlaces[0]?.className).not.toMatch(/(^|\s)underline(\s|$)/);
  });

  it('R49 la guía va debajo de la pantalla de pasos, fuera de la barra, con los valores de la empresa', async () => {
    render(await InventoryImportPage());

    const pantalla = screen.getByTestId(IMPORT_SCREEN_TESTID);
    const guia = screen.getByTestId(GUIDE_TESTID);
    expect(pantalla.compareDocumentPosition(guia) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pantalla).not.toContainElement(guia);
    expect(screen.getByTestId(IMPORT_STEPS_TESTID)).not.toContainElement(guia);
    expect(guia.closest('[data-slot="page-shell"]')).not.toBeNull();
    expect(getValuesActionMock).toHaveBeenCalledTimes(1);
  });

  it('R49 la guía sigue con los valores de la empresa en su pestaña', async () => {
    const user = setupUser();
    render(await InventoryImportPage());

    await user.click(screen.getByRole('tab', { name: 'Valores disponibles' }));

    expect(await screen.findByTestId(GUIDE_VALUES_TESTID)).toHaveTextContent('kilogramo');
  });

  it('R49 si los valores no se pueden leer, la guía sale igual, sin ellos', async () => {
    getValuesActionMock.mockResolvedValue({ status: 'error', code: 'unexpected', message: 'x', reference: 'REF' });
    const user = setupUser();
    render(await InventoryImportPage());

    expect(screen.getByTestId(GUIDE_TESTID)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Valores disponibles' }));
    expect(await screen.findByTestId(GUIDE_VALUES_TESTID)).toHaveTextContent(GUIDE_VALUES_UNAVAILABLE);
  });

  it('declara el tiempo máximo de la petición para la confirmación', () => {
    expect(maxDuration).toBe(300);
  });
});

describe('enlace «Importar» en /inventario', () => {
  async function arbolDeInventario(): Promise<ReactNode> {
    return InventarioPage({ searchParams: Promise.resolve({}) });
  }

  it('R2 aparece con inventario.modificar y lleva a la ruta de importación', async () => {
    expect(contieneEnlaceA(await arbolDeInventario(), INVENTORY_IMPORT_ROUTE)).toBe(true);
  });

  it('R2 no aparece sin inventario.modificar', async () => {
    getSessionUserMock.mockResolvedValue(sesionCon(['inventario.consultar']));

    expect(contieneEnlaceA(await arbolDeInventario(), INVENTORY_IMPORT_ROUTE)).toBe(false);
  });

  it('R16 no aparece sin el añadido importacion_excel, aunque tenga inventario.modificar', async () => {
    getSessionUserMock.mockResolvedValue(sesionCon(TODOS_LOS_PERMISOS, []));

    expect(contieneEnlaceA(await arbolDeInventario(), INVENTORY_IMPORT_ROUTE)).toBe(false);
  });
});
