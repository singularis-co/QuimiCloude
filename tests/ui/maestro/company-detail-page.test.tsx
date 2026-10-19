// El detalle de empresa del Maestro. La página se invoca como lo hace el App Router y su árbol
// se pinta entero: la cabecera, las pestañas y el panel vigente. Las acciones están simuladas.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen, within } from '@testing-library/react';
import { Suspense, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CompanyDetail, SessionUser } from '@/lib/modules/identity';

import { setupUser } from '../../helpers/user-event';

const {
  getSessionUserMock,
  notFoundMock,
  redirectMock,
  getCompanyActionMock,
  getCompanyAddonsActionMock,
  listCompanyEventsActionMock,
  routerMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn<() => Promise<unknown>>(),
  notFoundMock: vi.fn<() => never>(),
  redirectMock: vi.fn<(ruta: string) => never>(),
  getCompanyActionMock: vi.fn<(id: string) => Promise<unknown>>(),
  getCompanyAddonsActionMock: vi.fn<(id: string) => Promise<unknown>>(),
  listCompanyEventsActionMock: vi.fn<(input: unknown) => Promise<unknown>>(),
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
  getCompanyAction: getCompanyActionMock,
  getCompanyAddonsAction: getCompanyAddonsActionMock,
  listCompanyEventsAction: listCompanyEventsActionMock,
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

import {
  CompanyHistoryPanel,
  CompanyHistorySkeleton,
  CompanyModulesTab,
} from '@/app/(private)/maestro/empresas/[id]/components';
import MaestroEmpresaPage from '@/app/(private)/maestro/empresas/[id]/page';

const RAIZ = join(__dirname, '..', '..', '..');
const DETALLE = join(RAIZ, 'app', '(private)', 'maestro', 'empresas', '[id]');

const ID = '2d8e9f0a-3142-4c5d-8e6f-7a8b9c0d1e2f';

const ACTIVA: CompanyDetail = {
  id: ID,
  name: 'Químicos del Valle',
  taxId: '900.481.227-3',
  contactEmail: 'contacto@quimicosvalle.co',
  contactPhone: '602 488 1200',
  country: 'CO',
  createdAt: new Date('2026-09-14T11:02:00.000Z'),
  status: 'active',
  deletedAt: null,
};

const DE_BAJA: CompanyDetail = {
  ...ACTIVA,
  status: 'deleted',
  deletedAt: new Date('2026-10-15T08:00:00.000Z'),
};

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

async function invocar(id: string, query: Record<string, string> = {}): Promise<ReactNode> {
  return MaestroEmpresaPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve(query) });
}

async function pintar(query: Record<string, string> = {}) {
  render(<>{await invocar(ID, query)}</>);
}

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

beforeEach(() => {
  vi.clearAllMocks();
  notFoundMock.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
  redirectMock.mockImplementation(() => {
    throw new Error('NEXT_REDIRECT');
  });
  getSessionUserMock.mockResolvedValue(MAESTRO);
  getCompanyActionMock.mockResolvedValue({ status: 'success', data: ACTIVA });
  listCompanyEventsActionMock.mockResolvedValue({
    status: 'success',
    data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 },
  });
});

afterEach(() => {
  cleanup();
});

describe('/maestro/empresas/[id]', () => {
  it('R27: pinta la miga «Empresas» que enlaza a la lista, el nombre como titulo y su estado', async () => {
    await pintar();
    const miga = screen.getByRole('navigation', { name: 'Ruta de navegación' });
    expect(within(miga).getByRole('link', { name: 'Empresas' })).toHaveAttribute(
      'href',
      '/maestro/empresas',
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Químicos del Valle');
    expect(screen.getByTestId('company-detail-status')).toHaveTextContent('Activa');
    expect(getCompanyActionMock).toHaveBeenCalledWith(ID);
  });

  it('R27: las pestañas Datos, Módulos e Historial son enlaces a ?tab=datos|modulos|historial', async () => {
    await pintar();
    const pestanas = within(screen.getByTestId('company-detail-tabs')).getAllByRole('tab');
    expect(pestanas.map((pestana) => pestana.textContent)).toEqual(['Datos', 'Módulos', 'Historial']);
    expect(pestanas.map((pestana) => pestana.getAttribute('href'))).toEqual([
      `/maestro/empresas/${ID}?tab=datos`,
      `/maestro/empresas/${ID}?tab=modulos`,
      `/maestro/empresas/${ID}?tab=historial`,
    ]);
  });

  it.each([
    ['sin tab', {}],
    ['con un tab desconocido', { tab: 'facturas' }],
  ])('R27: %s abre la pestaña por defecto, «Datos», con su panel', async (_caso, query) => {
    await pintar(query);
    expect(screen.getByRole('tab', { name: 'Datos' })).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel', { name: 'Datos' });
    expect(within(panel).getByTestId('company-data-panel')).toBeInTheDocument();
  });

  it('R27: con tab=historial queda seleccionada «Historial» y no se pinta el panel de Datos', async () => {
    await pintar({ tab: 'historial' });
    expect(screen.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Historial' })).toBeInTheDocument();
    expect(screen.queryByTestId('company-data-panel')).not.toBeInTheDocument();
  });

  it('R27: tambien abre una empresa de baja, con su estado «De baja»', async () => {
    getCompanyActionMock.mockResolvedValue({ status: 'success', data: DE_BAJA });
    await pintar();
    expect(screen.getByTestId('company-detail-status')).toHaveTextContent('De baja');
    expect(screen.getByTestId('company-data-deletedAt')).toHaveTextContent('15/10/2026');
  });

  it.each(['no-es-un-uuid', '123', `${ID}x`])(
    'R27: con el identificador «%s» responde el 404 sin pedir la empresa',
    async (id) => {
      await expect(invocar(id)).rejects.toThrow('NEXT_NOT_FOUND');
      expect(notFoundMock).toHaveBeenCalledTimes(1);
      expect(getCompanyActionMock).not.toHaveBeenCalled();
    },
  );

  it('R27: si la empresa no existe responde el 404 de la zona privada', async () => {
    getCompanyActionMock.mockResolvedValue({
      status: 'error',
      code: 'company_not_found',
      message: 'La empresa solicitada no existe.',
    });
    await expect(invocar(ID)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('R34: si la consulta del detalle falla pinta el recuadro de error con su referencia y «Reintentar»', async () => {
    getCompanyActionMock.mockResolvedValue({
      status: 'error',
      code: 'unexpected',
      message: 'Ocurrio un error inesperado.',
      reference: 'req-detalle-1',
    });
    await pintar();
    const error = screen.getByTestId('company-detail-error');
    expect(error).toHaveTextContent('No se pudo cargar la empresa.');
    expect(error).toHaveTextContent('req-detalle-1');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    await setupUser().click(screen.getByTestId('company-detail-retry'));
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('R1 (QC-278): con tab=modulos el panel Módulos monta la pestaña con las cuatro props', async () => {
    const arbol = await invocar(ID, { tab: 'modulos' });
    const panel = hijosDe(arbol).find(
      (nodo) => isValidElement(nodo) && (nodo.props as { role?: string }).role === 'tabpanel',
    ) as ReactElement<Record<string, unknown>>;
    expect(panel.props['aria-label']).toBe('Módulos');
    expect(panel.props['data-testid']).toBe('company-detail-panel-modulos');
    expect(buscar(panel, CompanyModulesTab).props).toEqual({
      companyId: ID,
      companyName: 'Químicos del Valle',
      isDeleted: false,
      canModify: true,
    });

    getCompanyActionMock.mockResolvedValue({ status: 'success', data: DE_BAJA });
    getSessionUserMock.mockResolvedValue(SOLO_CONSULTA);
    expect(buscar(await invocar(ID, { tab: 'modulos' }), CompanyModulesTab).props).toMatchObject({
      isDeleted: true,
      canModify: false,
    });
  });

  it('R1 (QC-278): la página no importa ni llama a getCompanyAddonsAction; la pide la pestaña', async () => {
    await invocar(ID, { tab: 'modulos' });
    expect(getCompanyAddonsActionMock).not.toHaveBeenCalled();
    expect(readFileSync(join(DETALLE, 'page.tsx'), 'utf8')).not.toMatch(/getCompanyAddonsAction/);
  });

  it('R6: con solo empresas.consultar la cabecera no ofrece ninguna escritura', async () => {
    getSessionUserMock.mockResolvedValue(SOLO_CONSULTA);
    await pintar();
    expect(screen.queryByTestId('company-detail-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('company-detail-delete')).not.toBeInTheDocument();
    expect(screen.queryByTestId('company-detail-reactivate')).not.toBeInTheDocument();
  });

  it('R28: con empresas.modificar la cabecera de una empresa activa ofrece «Editar» y «Dar de baja»', async () => {
    await pintar();
    expect(screen.getByTestId('company-detail-edit')).toHaveTextContent('Editar');
    expect(screen.getByTestId('company-detail-delete')).toHaveTextContent('Dar de baja');
  });

  it('R31, R34: con tab=historial y page=2 monta el historial de esa pagina con su esqueleto mientras carga', async () => {
    const arbol = await invocar(ID, { tab: 'historial', page: '2' });
    const limite = buscar(arbol, Suspense);
    expect(isValidElement(limite.props.fallback) && limite.props.fallback.type).toBe(
      CompanyHistorySkeleton,
    );
    expect(buscar(arbol, CompanyHistoryPanel).props).toEqual({ companyId: ID, page: 2 });
  });

  it('R31: fuera de la pestaña Historial no se pide el historial', async () => {
    await pintar({ tab: 'datos', page: '2' });
    expect(listCompanyEventsActionMock).not.toHaveBeenCalled();
  });
});
