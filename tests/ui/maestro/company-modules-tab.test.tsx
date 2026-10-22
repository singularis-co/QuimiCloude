// La pestaña Módulos del detalle de empresa: su Suspense, la única lectura de la vista de añadidos,
// el error de carga y lo que pinta con éxito. Las acciones de QC-277 y `sonner` están simulados.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen, within } from '@testing-library/react';
import { Suspense, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Addon, CompanyAddonsView } from '@/lib/modules/identity';

import { setupUser } from '../../helpers/user-event';

const { getCompanyAddonsActionMock, routerMock } = vi.hoisted(() => ({
  getCompanyAddonsActionMock: vi.fn<(id: string) => Promise<unknown>>(),
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

vi.mock('@/lib/modules/identity/adapters/driving/company-actions', () => ({
  getCompanyAction: vi.fn(),
  getCompanyAddonsAction: getCompanyAddonsActionMock,
  listCompanyEventsAction: vi.fn(),
  listCompaniesAction: vi.fn(),
  getCompanyDeletionImpactAction: vi.fn(),
  createCompanyAction: vi.fn(),
  updateCompanyAction: vi.fn(),
  setCompanyCountryAction: vi.fn(),
  deleteCompanyAction: vi.fn(),
  reactivateCompanyAction: vi.fn(),
  setCompanyAddonAction: vi.fn(),
  setAllCompanyAddonsAction: vi.fn(),
}));

import { CompanyModulesTab } from '@/app/(private)/maestro/empresas/[id]/components/modulos';
import { ModulesSection } from '@/app/(private)/maestro/empresas/[id]/components/modulos/modules-section';
import { ModulesSkeleton } from '@/app/(private)/maestro/empresas/[id]/components/modulos/modules-skeleton';

const MODULOS = join(
  __dirname,
  '..',
  '..',
  '..',
  'app',
  '(private)',
  'maestro',
  'empresas',
  '[id]',
  'components',
  'modulos',
);

const ID = '2d8e9f0a-3142-4c5d-8e6f-7a8b9c0d1e2f';
const EMPRESA = 'Químicos del Valle S.A.S.';
const ORDEN: readonly Addon[] = ['dashboard', 'proveedores', 'lectura_pdf', 'importacion_excel', 'integraciones'];

const VISTA: CompanyAddonsView = {
  companyId: ID,
  addons: ORDEN.map((addon) => ({
    addon,
    enabled: addon !== 'integraciones',
    active: addon !== 'integraciones' && addon !== 'lectura_pdf',
    requires: addon === 'lectura_pdf' ? ['integraciones'] : [],
  })),
};

const PROPS = { companyId: ID, companyName: EMPRESA, isDeleted: false, canModify: true } as const;

function hijosDe(nodo: ReactNode): ReactNode[] {
  if (Array.isArray(nodo)) return nodo.flatMap(hijosDe);
  if (!isValidElement(nodo)) return [];
  const props = nodo.props as { children?: ReactNode };
  return [nodo, ...hijosDe(props.children)];
}

function buscar(arbol: ReactNode, tipo: unknown): ReactElement<Record<string, unknown>> {
  const encontrado = hijosDe(arbol).find((nodo) => isValidElement(nodo) && nodo.type === tipo);
  if (!isValidElement(encontrado)) throw new Error('no esta en el arbol');
  return encontrado as ReactElement<Record<string, unknown>>;
}

function archivosDe(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivosDe(ruta) : [ruta];
  });
}

async function pintarSeccion(props: Parameters<typeof ModulesSection>[0] = PROPS) {
  render(await ModulesSection(props));
}

beforeEach(() => {
  vi.clearAllMocks();
  getCompanyAddonsActionMock.mockResolvedValue({ status: 'success', data: VISTA });
});

afterEach(() => {
  cleanup();
});

describe('CompanyModulesTab', () => {
  it('R1: recibe empresa, baja y canModify por props y no lee la sesión', () => {
    const arbol = CompanyModulesTab({ ...PROPS, isDeleted: true, canModify: false });
    expect(buscar(arbol, ModulesSection).props).toEqual({
      companyId: ID,
      companyName: EMPRESA,
      isDeleted: true,
      canModify: false,
    });

    const archivos = archivosDe(MODULOS);
    expect(archivos.length).toBeGreaterThan(0);
    for (const ruta of archivos) {
      const fuente = readFileSync(ruta, 'utf8');
      expect(fuente, ruta).not.toMatch(/['"]@\/lib\/composition['"]/);
      expect(fuente, ruta).not.toMatch(/['"]next\/headers['"]/);
      expect(fuente, ruta).not.toMatch(/\bassertPermission\b/);
      expect(fuente, ruta).not.toMatch(/\brequirePagePermission\b/);
    }

    const barrel = readFileSync(join(MODULOS, 'index.ts'), 'utf8');
    expect(barrel).not.toMatch(/use client/);
    expect(barrel.trim()).toBe(
      "export { CompanyModulesTab, type CompanyModulesTabProps } from './company-modules-tab';",
    );
  });

  it('R2: pide la vista de añadidos una sola vez con el id de la empresa', async () => {
    await pintarSeccion();
    expect(getCompanyAddonsActionMock).toHaveBeenCalledTimes(1);
    expect(getCompanyAddonsActionMock).toHaveBeenCalledWith(ID);
    expect(screen.getAllByRole('switch')).toHaveLength(ORDEN.length);
    expect(screen.getByRole('heading', { name: 'Núcleo' })).toBeInTheDocument();
  });

  it('R3: mientras carga muestra Cargando los módulos… en una región status', () => {
    const arbol = CompanyModulesTab(PROPS);
    const limite = buscar(arbol, Suspense);
    expect(isValidElement(limite.props.fallback) && limite.props.fallback.type).toBe(ModulesSkeleton);
    expect(getCompanyAddonsActionMock).not.toHaveBeenCalled();

    render(<ModulesSkeleton />);
    const region = screen.getByRole('status', { name: 'Cargando los módulos…' });
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region).toHaveTextContent('Cargando los módulos…');
  });

  it('R4: si la lectura falla muestra No pudimos cargar los módulos con Reintentar y ningún interruptor', async () => {
    getCompanyAddonsActionMock.mockResolvedValue({
      status: 'error',
      code: 'unexpected',
      message: 'Ocurrio un error inesperado.',
      reference: 'req-modulos-1',
    });
    await pintarSeccion();

    const error = screen.getByTestId('company-modules-error');
    expect(error).toHaveTextContent('No pudimos cargar los módulos');
    expect(error).toHaveTextContent('Ocurrio un error inesperado.');
    expect(error).toHaveTextContent('req-modulos-1');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByTestId('company-addons')).not.toBeInTheDocument();
    expect(screen.queryByTestId('company-core-modules')).not.toBeInTheDocument();

    const reintentar = screen.getByTestId('company-modules-retry');
    expect(reintentar).toHaveTextContent('Reintentar');
    await setupUser().click(reintentar);
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it('R20: de baja también muestra añadidos y Núcleo', async () => {
    await pintarSeccion({ ...PROPS, isDeleted: true });

    expect(screen.getByTestId('company-addons-deleted-notice')).toHaveTextContent(
      'Esta empresa está de baja',
    );
    const interruptores = screen.getAllByRole('switch');
    expect(interruptores).toHaveLength(ORDEN.length);
    for (const interruptor of interruptores) expect(interruptor).toHaveAttribute('aria-disabled', 'true');
    const nucleo = screen.getByTestId('company-core-modules');
    expect(within(nucleo).getAllByRole('listitem')).toHaveLength(11);
  });
});
