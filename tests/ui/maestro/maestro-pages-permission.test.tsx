// El corte por permiso de las pantallas del Maestro. Las páginas se invocan como lo hace el App
// Router y su árbol se inspecciona sin pintarlo entero: la sección de lista es un Server
// Component asíncrono y se pinta aparte.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionUser } from '@/lib/modules/identity';

const {
  getSessionUserMock,
  notFoundMock,
  redirectMock,
  listCompaniesActionMock,
  getCompanyActionMock,
  routerMock,
} = vi.hoisted(() => ({
    getSessionUserMock: vi.fn<() => Promise<unknown>>(),
    notFoundMock: vi.fn<() => never>(),
    redirectMock: vi.fn<(ruta: string) => never>(),
    listCompaniesActionMock: vi.fn<(query: unknown) => Promise<unknown>>(),
    getCompanyActionMock: vi.fn<(id: string) => Promise<unknown>>(),
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
  notFound: notFoundMock,
  redirect: redirectMock,
  useRouter: () => routerMock,
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock },
  observabilidad: { readRequestIdHeader: vi.fn(async (): Promise<string | null> => null) },
}));

vi.mock('@/lib/modules/identity/adapters/driving/company-actions', () => ({
  listCompaniesAction: listCompaniesActionMock,
  getCompanyAction: getCompanyActionMock,
  getCompanyDeletionImpactAction: vi.fn(),
  listCompanyEventsAction: vi.fn(),
  createCompanyAction: vi.fn(),
  updateCompanyAction: vi.fn(),
  setCompanyCountryAction: vi.fn(),
  deleteCompanyAction: vi.fn(),
  reactivateCompanyAction: vi.fn(),
}));

import { CompanyListSection } from '@/app/(private)/maestro/empresas/components';
import MaestroEmpresaPage from '@/app/(private)/maestro/empresas/[id]/page';
import MaestroEmpresasPage from '@/app/(private)/maestro/empresas/page';
import { PageHeader } from '@/components/shared/page-header';
import { LOGIN_ROUTE_SESSION_ENDED } from '@/lib/shared/routes';

const RAIZ = join(__dirname, '..', '..', '..');

function sesionCon(permissions: readonly string[]): SessionUser {
  return {
    id: 'u-maestro',
    username: 'maestro',
    displayName: 'Marta Maestro',
    roleName: 'Maestro',
    permissions,
  };
}

const MAESTRO = sesionCon(['empresas.consultar', 'empresas.modificar']);
const SOLO_CONSULTA = sesionCon(['empresas.consultar']);
const DE_EMPRESA = sesionCon(['pedidos.consultar', 'usuarios.consultar', 'usuarios.modificar']);

function hijosDe(nodo: ReactNode): ReactNode[] {
  if (Array.isArray(nodo)) return nodo.flatMap(hijosDe);
  if (!isValidElement(nodo)) return [];
  const props = nodo.props as { children?: ReactNode; fallback?: ReactNode };
  return [nodo, ...hijosDe(props.children), ...hijosDe(props.fallback)];
}

function buscar(arbol: ReactNode, tipo: unknown): ReactElement<Record<string, unknown>> {
  const encontrado = hijosDe(arbol).find((nodo) => isValidElement(nodo) && nodo.type === tipo);
  if (!isValidElement(encontrado)) throw new Error('no esta en el arbol');
  return encontrado as ReactElement<Record<string, unknown>>;
}

async function invocarEmpresas(raw: Record<string, string> = {}): Promise<ReactNode> {
  return MaestroEmpresasPage({ searchParams: Promise.resolve(raw) });
}

beforeEach(() => {
  vi.clearAllMocks();
  notFoundMock.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
  redirectMock.mockImplementation(() => {
    throw new Error('NEXT_REDIRECT');
  });
  listCompaniesActionMock.mockResolvedValue({
    status: 'success',
    data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 },
  });
});

afterEach(() => {
  cleanup();
});

describe('/maestro/empresas', () => {
  it('R1: sin sesion lleva al login y no pide la lista', async () => {
    getSessionUserMock.mockResolvedValue(null);
    await expect(invocarEmpresas()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith(LOGIN_ROUTE_SESSION_ENDED);
    expect(listCompaniesActionMock).not.toHaveBeenCalled();
  });

  it('R1: una sesion sin empresas.consultar recibe el 404 sin ningun dato de empresas', async () => {
    getSessionUserMock.mockResolvedValue(DE_EMPRESA);
    await expect(invocarEmpresas()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(listCompaniesActionMock).not.toHaveBeenCalled();
  });

  it('R1: el corte por empresas.consultar es la primera linea del cuerpo de la pagina', () => {
    const fuente = readFileSync(
      join(RAIZ, 'app', '(private)', 'maestro', 'empresas', 'page.tsx'),
      'utf8',
    );
    const cuerpo = fuente.slice(fuente.indexOf('export default async function'));
    const primera = cuerpo.slice(cuerpo.indexOf('{', cuerpo.indexOf(')')) + 1).trim().split('\n')[0];
    expect(primera).toBe("await requirePagePermission('empresas.consultar');");
  });

  it('R8: con el permiso pinta la miga «Plataforma» y el titulo «Empresas»', async () => {
    getSessionUserMock.mockResolvedValue(MAESTRO);
    const arbol = await invocarEmpresas();
    render(buscar(arbol, PageHeader));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Empresas');
    expect(screen.getByRole('navigation', { name: 'Plataforma' })).toHaveTextContent('Plataforma');
  });

  it('R1, R11: la seccion pide la lista con los parametros de la direccion', async () => {
    getSessionUserMock.mockResolvedValue(MAESTRO);
    const arbol = await invocarEmpresas({ q: 'valle', estado: 'de-baja', sort: 'name', dir: 'desc' });
    const seccion = buscar(arbol, CompanyListSection);
    render(await CompanyListSection(seccion.props as Parameters<typeof CompanyListSection>[0]));
    expect(listCompaniesActionMock).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      sort: { columnId: 'name', direction: 'desc' },
      filters: { status: { kind: 'select', values: ['deleted'] } },
      search: 'valle',
    });
  });

  it('R6: con empresas.consultar y sin empresas.modificar la seccion recibe canModify falso', async () => {
    getSessionUserMock.mockResolvedValue(SOLO_CONSULTA);
    const arbol = await invocarEmpresas();
    expect(buscar(arbol, CompanyListSection).props.canModify).toBe(false);
    render(buscar(arbol, PageHeader));
    expect(screen.queryByText('Nueva empresa')).toBeNull();
  });

  it('R6: con empresas.modificar la seccion recibe canModify verdadero', async () => {
    getSessionUserMock.mockResolvedValue(MAESTRO);
    const arbol = await invocarEmpresas();
    expect(buscar(arbol, CompanyListSection).props.canModify).toBe(true);
    render(buscar(arbol, PageHeader));
    expect(screen.getByTestId('company-create-open')).toHaveTextContent('Nueva empresa');
  });
});

const ID_EMPRESA = '2d8e9f0a-3142-4c5d-8e6f-7a8b9c0d1e2f';

async function invocarDetalle(): Promise<ReactNode> {
  return MaestroEmpresaPage({
    params: Promise.resolve({ id: ID_EMPRESA }),
    searchParams: Promise.resolve({}),
  });
}

describe('/maestro/empresas/[id]', () => {
  it('R1: sin sesion lleva al login y no pide la empresa', async () => {
    getSessionUserMock.mockResolvedValue(null);
    await expect(invocarDetalle()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith(LOGIN_ROUTE_SESSION_ENDED);
    expect(getCompanyActionMock).not.toHaveBeenCalled();
  });

  it('R1: una sesion sin empresas.consultar recibe el 404 sin ningun dato de la empresa', async () => {
    getSessionUserMock.mockResolvedValue(DE_EMPRESA);
    await expect(invocarDetalle()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(getCompanyActionMock).not.toHaveBeenCalled();
  });

  it('R1: el corte por empresas.consultar es la primera linea del cuerpo de la pagina', () => {
    const fuente = readFileSync(
      join(RAIZ, 'app', '(private)', 'maestro', 'empresas', '[id]', 'page.tsx'),
      'utf8',
    );
    const cuerpo = fuente.slice(fuente.indexOf('export default async function'));
    const primera = cuerpo.slice(cuerpo.indexOf('{', cuerpo.indexOf(')')) + 1).trim().split('\n')[0];
    expect(primera).toBe("await requirePagePermission('empresas.consultar');");
  });
});
