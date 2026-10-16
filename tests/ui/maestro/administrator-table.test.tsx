// La lista de Administradores del Maestro. `useRouter` está simulado: lo que se afirma es la
// dirección que recibe `router.replace`.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ADMINISTRATOR_EMPTY_TEXTS,
  AdministratorTable,
  parseAdministratorListParams,
  type ActiveCompany,
} from '@/app/(private)/maestro/administradores/components';
import type { DataTableParams } from '@/components/shared/data-table';
import type { ErrorState } from '@/lib/modules/errores';
import type { AdministratorRow } from '@/lib/modules/identity';
import { maestroCompanyRoute } from '@/lib/shared/routes';

import { getRowActionItem, openRowActionsMenu } from '../../helpers/row-actions-menu';
import { esperarInteractiva, setupUser } from '../../helpers/user-event';
import { WIDE_VIEWPORT, resetViewport, setViewportWidth } from '../../helpers/viewport';

const { routerMock, getAdministratorActionMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  getAdministratorActionMock: vi.fn<(id: string) => Promise<unknown>>(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/identity/adapters/driving/administrator-actions', () => ({
  listAdministratorsAction: vi.fn(),
  getAdministratorAction: getAdministratorActionMock,
  createAdministratorAction: vi.fn(),
  updateAdministratorAction: vi.fn(),
  deleteAdministratorAction: vi.fn(),
  resendAdministratorLinkAction: vi.fn(),
}));

vi.mock('@/lib/modules/identity/adapters/driving/company-actions', () => ({
  listCompaniesAction: vi.fn(),
}));

const VALLE: ActiveCompany = { id: '1c7d8e9f-2031-4b4c-9d5e-6f7a8b9c0d1e', name: 'Químicos del Valle S.A.S.' };
const ANDINOS: ActiveCompany = { id: '3e9f0a1b-4253-4d6e-9f70-8b9c0d1e2f30', name: 'Laboratorios Andinos' };
const COMPANIES = [VALLE, ANDINOS] as const;

const DIANA: AdministratorRow = {
  id: 'a1b2c3d4-0001-4a00-8000-000000000001',
  firstNames: 'Diana',
  lastNames: 'Mejía',
  username: 'dmejia',
  email: 'dmejia@quimicosvalle.co',
  company: VALLE,
  accountStatus: 'active',
  createdAt: new Date('2026-09-02T12:00:00.000Z'),
  isLastAdministrator: false,
};

const JULIAN: AdministratorRow = {
  id: 'a1b2c3d4-0002-4a00-8000-000000000002',
  firstNames: 'Julián',
  lastNames: 'Castro',
  username: 'jcastro',
  email: 'jcastro@quimicosvalle.co',
  company: VALLE,
  accountStatus: 'pending',
  createdAt: new Date('2026-09-03T12:00:00.000Z'),
  isLastAdministrator: false,
};

const NATALIA: AdministratorRow = {
  id: 'a1b2c3d4-0003-4a00-8000-000000000003',
  firstNames: 'Natalia',
  lastNames: 'Ríos',
  username: 'nrios',
  email: 'admin@labandinos.co',
  company: ANDINOS,
  accountStatus: 'blocked',
  createdAt: new Date('2026-09-04T12:00:00.000Z'),
  isLastAdministrator: true,
};

const ROWS = [DIANA, JULIAN, NATALIA] as const;

function params(raw: Record<string, string> = {}): DataTableParams {
  return parseAdministratorListParams(raw);
}

type Montaje = {
  readonly administrators?: readonly AdministratorRow[];
  readonly params?: DataTableParams;
  readonly total?: number;
  readonly totalPages?: number;
  readonly canModify?: boolean;
  readonly status?: 'idle' | 'loading';
};

function montar(opts: Montaje = {}): ReturnType<typeof render> {
  return render(
    <AdministratorTable
      administrators={opts.administrators ?? ROWS}
      companies={COMPANIES}
      params={opts.params ?? params()}
      total={opts.total ?? ROWS.length}
      totalPages={opts.totalPages ?? 1}
      canModify={opts.canModify ?? true}
      status={opts.status}
    />,
  );
}

function fila(id: string): HTMLElement {
  return screen.getByTestId(`data-table-row-${id}`);
}

function tarjeta(id: string): HTMLElement {
  return screen.getByTestId(`data-table-card-${id}`);
}

function ultimaDireccion(): URL {
  const href = routerMock.replace.mock.calls.at(-1)?.[0];
  if (href === undefined) throw new Error('no se navego');
  return new URL(href, 'http://localhost');
}

async function etiquetasDelMenu(trigger: HTMLElement): Promise<string[]> {
  const user = setupUser();
  const menu = await openRowActionsMenu(user, trigger);
  return within(menu)
    .getAllByRole('menuitem')
    .map((item) => item.textContent ?? '');
}

beforeEach(() => {
  vi.clearAllMocks();
  setViewportWidth(WIDE_VIEWPORT);
});

afterEach(() => {
  cleanup();
  resetViewport();
});

describe('columnas y celdas', () => {
  it('R35: las columnas son Nombre, Usuario, Correo, Empresa y Estado', () => {
    montar();
    const cabeceras = screen
      .getAllByRole('columnheader')
      .map((th) => th.textContent?.trim() ?? '');
    expect(cabeceras.slice(0, 5)).toEqual(['Nombre', 'Usuario', 'Correo', 'Empresa', 'Estado']);
  });

  it('R35: una sola lista con los Administradores de todas las empresas', () => {
    montar();
    expect(within(fila(DIANA.id)).getByTestId('administrator-name')).toHaveTextContent('Diana Mejía');
    expect(within(fila(DIANA.id)).getByTestId('administrator-username')).toHaveTextContent('dmejia');
    expect(within(fila(DIANA.id)).getByTestId('administrator-email')).toHaveTextContent(
      'dmejia@quimicosvalle.co',
    );
    expect(within(fila(NATALIA.id)).getByTestId('administrator-company-link')).toHaveTextContent(
      ANDINOS.name,
    );
  });

  it('R35: la empresa de cada fila enlaza al detalle de esa empresa', () => {
    montar();
    for (const administrator of ROWS) {
      const enlace = within(fila(administrator.id)).getByRole('link', {
        name: administrator.company.name,
      });
      expect(enlace).toHaveAttribute('href', maestroCompanyRoute(administrator.company.id));
    }
  });

  it('R35: el estado se pinta «Activo» o «Pendiente»; uno sin etiqueta, con su codigo', () => {
    montar();
    expect(within(fila(DIANA.id)).getByTestId('administrator-status')).toHaveTextContent('Activo');
    expect(within(fila(JULIAN.id)).getByTestId('administrator-status')).toHaveTextContent('Pendiente');
    expect(within(fila(NATALIA.id)).getByTestId('administrator-status')).toHaveTextContent('blocked');
  });

  it('R35: no hay caja de busqueda ni columnas ordenables', () => {
    montar();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByTestId('data-table-search')).toBeNull();
    for (const th of screen.getAllByRole('columnheader')) {
      expect(th).not.toHaveAttribute('aria-sort');
    }
  });
});

describe('filtro «Empresa» y paginacion en la direccion', () => {
  it('R35: el filtro «Empresa» ofrece las empresas activas y elegir una va a la direccion', async () => {
    const user = setupUser();
    montar({ params: params({ page: '3' }) });
    await user.click(screen.getByTestId('data-table-filter-companyId'));
    const andinos = await esperarInteractiva(
      await screen.findByTestId(`data-table-filter-option-companyId-${ANDINOS.id}`),
    );
    expect(
      screen.getByTestId(`data-table-filter-option-companyId-${VALLE.id}`),
    ).toHaveTextContent(VALLE.name);
    expect(andinos).toHaveTextContent(ANDINOS.name);
    await user.click(andinos);
    const destino = ultimaDireccion();
    expect(destino.pathname).toBe('/maestro/administradores');
    expect(destino.searchParams.get('empresa')).toBe(ANDINOS.id);
    expect(destino.searchParams.get('page')).toBe('1');
  });

  it('R35: la direccion con empresa se lee como filtro; lo que no es uuid se ignora', () => {
    expect(params({ empresa: `${VALLE.id},nope`, page: '2', pageSize: '25' })).toEqual({
      page: 2,
      pageSize: 25,
      sort: null,
      filters: { companyId: { kind: 'select', values: [VALLE.id] } },
      search: '',
    });
    expect(params({ empresa: 'nope', page: '0', pageSize: '7' })).toEqual({
      page: 1,
      pageSize: 10,
      sort: null,
      filters: {},
      search: '',
    });
  });

  it('R35: la paginacion dice «Página N de M · T en total» y pasar de pagina va a la direccion', async () => {
    const user = setupUser();
    montar({ params: params({ empresa: VALLE.id }), total: 23, totalPages: 3 });
    expect(screen.getByTestId('data-table-page-indicator')).toHaveTextContent(
      'Página 1 de 3 · 23 en total',
    );
    await user.click(screen.getByTestId('data-table-next'));
    const query = ultimaDireccion().searchParams;
    expect(query.get('page')).toBe('2');
    expect(query.get('empresa')).toBe(VALLE.id);
  });
});

describe('menu de acciones', () => {
  it('R36: el menu de un Administrador activo ofrece Editar y Dar de baja', async () => {
    montar();
    const trigger = within(fila(DIANA.id)).getByTestId('administrator-actions');
    expect(await etiquetasDelMenu(trigger)).toEqual(['Editar', 'Dar de baja']);
  });

  it('R36: el menu de un Administrador «Pendiente» ofrece Reenviar enlace entre Editar y Dar de baja', async () => {
    montar();
    const trigger = within(fila(JULIAN.id)).getByTestId('administrator-actions');
    expect(await etiquetasDelMenu(trigger)).toEqual(['Editar', 'Reenviar enlace', 'Dar de baja']);
  });

  it('R36: en cualquier otro estado el menu no ofrece Reenviar enlace', async () => {
    montar();
    expect(
      await etiquetasDelMenu(within(fila(NATALIA.id)).getByTestId('administrator-actions')),
    ).toEqual(['Editar', 'Dar de baja']);
  });

  it('R36: el menu centrado de la tarjeta de un «Pendiente» tambien ofrece Reenviar enlace', async () => {
    const user = setupUser();
    montar();
    await user.click(within(tarjeta(JULIAN.id)).getByTestId('administrator-actions'));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByTestId('administrator-action-resend')).toHaveTextContent(
      'Reenviar enlace',
    );
  });

  it('R36: el menu centrado de la tarjeta de un activo no ofrece Reenviar enlace', async () => {
    const user = setupUser();
    montar();
    await user.click(within(tarjeta(DIANA.id)).getByTestId('administrator-actions'));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByTestId('administrator-action-edit')).toBeInTheDocument();
    expect(within(dialogo).queryByTestId('administrator-action-resend')).toBeNull();
  });

  it('R6: sin empresas.modificar no hay menu de acciones en ninguna fila', () => {
    montar({ canModify: false });
    expect(screen.queryAllByTestId('administrator-actions')).toHaveLength(0);
    expect(screen.queryByText('Nuevo administrador')).toBeNull();
  });
});

describe('lo que abre cada accion del menu', () => {
  it('R38: «Editar» abre el panel de edicion de ese Administrador', async () => {
    getAdministratorActionMock.mockReturnValue(new Promise(() => {}));
    const user = setupUser();
    montar();
    const trigger = within(fila(JULIAN.id)).getByTestId('administrator-actions');
    await user.click(await getRowActionItem(user, trigger, 'administrator-action-edit'));
    expect(await screen.findByTestId('administrator-sheet')).toBeInTheDocument();
    expect(getAdministratorActionMock).toHaveBeenCalledWith(JULIAN.id);
  });

  it('R46: «Reenviar enlace» abre el dialogo de reenvio de ese Administrador', async () => {
    const user = setupUser();
    montar();
    const trigger = within(fila(JULIAN.id)).getByTestId('administrator-actions');
    await user.click(await getRowActionItem(user, trigger, 'administrator-action-resend'));
    const dialogo = await screen.findByTestId('administrator-resend-dialog');
    expect(
      within(dialogo).getByRole('heading', { name: '¿Reenviar el enlace a Julián Castro?' }),
    ).toBeInTheDocument();
  });

  it('R39: «Dar de baja» abre el dialogo de baja de ese Administrador', async () => {
    const user = setupUser();
    montar();
    const trigger = within(fila(DIANA.id)).getByTestId('administrator-actions');
    await user.click(await getRowActionItem(user, trigger, 'administrator-action-delete'));
    const dialogo = await screen.findByTestId('administrator-delete-dialog');
    expect(within(dialogo).getByRole('heading', { name: 'Dar de baja a Diana Mejía' })).toBeInTheDocument();
  });

  it('R40: «Dar de baja» sobre el ultimo de su empresa abre el dialogo sin poder confirmar', async () => {
    const user = setupUser();
    montar();
    const trigger = within(fila(NATALIA.id)).getByTestId('administrator-actions');
    await user.click(await getRowActionItem(user, trigger, 'administrator-action-delete'));
    await screen.findByTestId('administrator-delete-dialog');
    expect(screen.getByTestId('administrator-delete-confirm')).toBeDisabled();
  });
});

describe('estados', () => {
  it('R42: mientras carga pinta el esqueleto de tabla', () => {
    montar({ status: 'loading', administrators: [] });
    expect(screen.getByTestId('administrator-list-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('data-table')).toBeNull();
  });

  it('R42: si la consulta falla pinta el error con «Reintentar», que vuelve a pedir la lista', async () => {
    const user = setupUser();
    const error: ErrorState = {
      status: 'error',
      code: 'unexpected',
      message: 'Ocurrio un error inesperado.',
      reference: 'req-123',
    };
    render(
      <AdministratorTable
        status="error"
        error={error}
        administrators={[]}
        companies={COMPANIES}
        params={params()}
        total={0}
        totalPages={0}
        canModify
      />,
    );
    const recuadro = screen.getByTestId('administrator-list-error');
    expect(recuadro).toHaveTextContent('No se pudo cargar la lista de Administradores.');
    expect(recuadro).toHaveTextContent('req-123');
    await user.click(screen.getByTestId('administrator-list-retry'));
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it('R42: sin filas pinta el vacio del catalogo', () => {
    montar({ administrators: [], total: 0 });
    expect(screen.getByTestId('administrator-list-empty')).toHaveTextContent(
      ADMINISTRATOR_EMPTY_TEXTS.empty,
    );
  });

  it('R42: con el filtro «Empresa» y sin filas, el vacio ofrece quitar el filtro', () => {
    montar({ administrators: [], total: 0, params: params({ empresa: ANDINOS.id }) });
    const vacio = screen.getByTestId('administrator-list-empty');
    expect(vacio).toHaveTextContent(ADMINISTRATOR_EMPTY_TEXTS.noMatches);
    const quitar = within(vacio).getByRole('link', { name: 'Quitar el filtro' });
    const destino = new URL(quitar.getAttribute('href') ?? '', 'http://localhost');
    expect(destino.pathname).toBe('/maestro/administradores');
    expect(destino.searchParams.get('empresa')).toBeNull();
  });
});

describe('tarjetas en contenedor estrecho', () => {
  it('R42: cada Administrador tiene su tarjeta con nombre, estado, usuario, correo y empresa', () => {
    montar();
    const card = tarjeta(JULIAN.id);
    expect(within(card).getByTestId('administrator-name')).toHaveTextContent('Julián Castro');
    expect(within(card).getByTestId('administrator-status')).toHaveTextContent('Pendiente');
    expect(within(card).getByTestId('administrator-username')).toHaveTextContent('jcastro');
    expect(within(card).getByTestId('administrator-email')).toHaveTextContent(
      'jcastro@quimicosvalle.co',
    );
    expect(within(card).getByRole('link', { name: VALLE.name })).toBeInTheDocument();
  });

  it('R42: el boton «Acciones» de la tarjeta mide al menos 44 px y abre el menu centrado', async () => {
    const user = setupUser();
    montar();
    const acciones = within(tarjeta(DIANA.id)).getByTestId('administrator-actions');
    expect(acciones).toHaveTextContent('Acciones');
    expect(acciones).toHaveClass('min-h-11', 'min-w-11');
    await user.click(acciones);
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Diana Mejía')).toBeInTheDocument();
    expect(within(dialogo).getByTestId('administrator-action-edit')).toHaveTextContent('Editar');
    expect(within(dialogo).getByTestId('administrator-action-delete')).toHaveTextContent(
      'Dar de baja',
    );
  });
});
