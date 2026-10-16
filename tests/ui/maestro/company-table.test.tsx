// La lista de empresas del Maestro. `useRouter` está simulado: lo que se afirma es la dirección
// que recibe `router.replace`.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COMPANY_EMPTY_TEXTS,
  CompanyTable,
  parseCompanyListParams,
} from '@/app/(private)/maestro/empresas/components';
import type { DataTableParams } from '@/components/shared/data-table';
import type { ErrorState } from '@/lib/modules/errores';
import type { CompanyRow } from '@/lib/modules/identity';
import { maestroCompanyRoute } from '@/lib/shared/routes';

import { openRowActionsMenu } from '../../helpers/row-actions-menu';
import { esperarInteractiva, setupUser } from '../../helpers/user-event';

const { routerMock } = vi.hoisted(() => ({
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

const QUIMICLOUD: CompanyRow = {
  id: '0b6c7d8e-1f20-4a3b-8c4d-5e6f7a8b9c0d',
  name: 'QuimiCloud',
  taxId: null,
  country: 'CO',
  liveUserCount: 3,
  createdAt: new Date('2026-09-02T12:00:00.000Z'),
  status: 'active',
};

const VALLE: CompanyRow = {
  id: '1c7d8e9f-2031-4b4c-9d5e-6f7a8b9c0d1e',
  name: 'Químicos del Valle S.A.S.',
  taxId: '900.481.227-3',
  country: null,
  liveUserCount: 14,
  // A las 23:30 UTC sigue siendo el 14 en UTC, aunque en otro huso ya fuera el 15.
  createdAt: new Date('2026-09-14T23:30:00.000Z'),
  status: 'active',
};

const LA_CEJA: CompanyRow = {
  id: '2d8e9f0a-3142-4c5d-8e6f-7a8b9c0d1e2f',
  name: 'Detergentes La Ceja',
  taxId: '900.778.310-2',
  country: 'EC',
  liveUserCount: 0,
  createdAt: new Date('2026-10-03T09:00:00.000Z'),
  status: 'deleted',
};

const ROWS = [QUIMICLOUD, VALLE, LA_CEJA] as const;

function params(raw: Record<string, string> = {}): DataTableParams {
  return parseCompanyListParams(raw);
}

type Montaje = {
  readonly companies?: readonly CompanyRow[];
  readonly params?: DataTableParams;
  readonly total?: number;
  readonly totalPages?: number;
  readonly canModify?: boolean;
  readonly status?: 'idle' | 'loading';
};

function montar(opts: Montaje = {}): ReturnType<typeof render> {
  return render(
    <CompanyTable
      companies={opts.companies ?? ROWS}
      params={opts.params ?? params()}
      total={opts.total ?? ROWS.length}
      totalPages={opts.totalPages ?? 1}
      canModify={opts.canModify ?? true}
      status={opts.status}
    />,
  );
}

function montarError(error: ErrorState): ReturnType<typeof render> {
  return render(
    <CompanyTable
      status="error"
      error={error}
      companies={[]}
      params={params()}
      total={0}
      totalPages={0}
      canModify
    />,
  );
}

function fila(id: string): HTMLElement {
  return screen.getByTestId(`data-table-row-${id}`);
}

function tarjeta(id: string): HTMLElement {
  return screen.getByTestId(`data-table-card-${id}`);
}

function ultimaDireccion(): URLSearchParams {
  const href = routerMock.replace.mock.calls.at(-1)?.[0];
  if (href === undefined) throw new Error('no se navego');
  return new URL(href, 'http://localhost').searchParams;
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
});

afterEach(() => {
  cleanup();
});

describe('columnas y celdas', () => {
  it('R8: las columnas son Nombre, Identificación fiscal, País, Usuarios, Creada y Estado', () => {
    montar();
    const cabeceras = screen
      .getAllByRole('columnheader')
      .map((th) => th.textContent?.trim() ?? '');
    expect(cabeceras.slice(0, 6)).toEqual([
      'Nombre',
      'Identificación fiscal',
      'País',
      'Usuarios',
      'Creada',
      'Estado',
    ]);
  });

  it('R8: el pais va como «Nombre (+prefijo)» o «Sin país»; la identificacion vacia con la marca', () => {
    montar();
    expect(within(fila(QUIMICLOUD.id)).getByTestId('company-country')).toHaveTextContent(
      'Colombia (+57)',
    );
    expect(within(fila(VALLE.id)).getByTestId('company-country')).toHaveTextContent('Sin país');
    expect(within(fila(LA_CEJA.id)).getByTestId('company-country')).toHaveTextContent(
      'Ecuador (+593)',
    );
    const vacia = within(fila(QUIMICLOUD.id)).getByTestId('company-tax-id');
    expect(vacia).toHaveTextContent('—');
    expect(vacia).toHaveAttribute('data-empty', 'true');
    expect(within(fila(VALLE.id)).getByTestId('company-tax-id')).toHaveTextContent('900.481.227-3');
  });

  it('R8: el estado se pinta como «Activa» o «De baja», con usuarios y fecha dd/mm/aaaa en UTC', () => {
    montar();
    expect(within(fila(VALLE.id)).getByTestId('company-status')).toHaveTextContent('Activa');
    expect(within(fila(LA_CEJA.id)).getByTestId('company-status')).toHaveTextContent('De baja');
    expect(within(fila(VALLE.id)).getByTestId('company-users')).toHaveTextContent('14');
    expect(within(fila(VALLE.id)).getByTestId('company-created-at')).toHaveTextContent('14/09/2026');
  });

  it('R12: QuimiCloud se lista como cualquier otra empresa', () => {
    montar();
    const fq = fila(QUIMICLOUD.id);
    expect(within(fq).getByTestId('company-name-link')).toHaveAttribute(
      'href',
      maestroCompanyRoute(QUIMICLOUD.id),
    );
    expect(within(fq).getByTestId('company-status')).toHaveTextContent('Activa');
    expect(within(fq).getByTestId('company-actions')).toBeInTheDocument();
  });

  it('R13: el nombre de cada fila enlaza al detalle de esa empresa', () => {
    montar();
    for (const company of ROWS) {
      const enlace = within(fila(company.id)).getByRole('link', { name: company.name });
      expect(enlace).toHaveAttribute('href', maestroCompanyRoute(company.id));
    }
  });
});

describe('filtro, busqueda, orden y paginacion', () => {
  it('R9: el filtro «Estado» ofrece «Activa» y «De baja», y elegir una va a la direccion', async () => {
    const user = setupUser();
    montar({ params: params({ page: '2' }) });
    await user.click(screen.getByTestId('data-table-filter-status'));
    const deBaja = await esperarInteractiva(
      await screen.findByTestId('data-table-filter-option-status-deleted'),
    );
    expect(screen.getByTestId('data-table-filter-option-status-active')).toHaveTextContent('Activa');
    expect(deBaja).toHaveTextContent('De baja');
    await user.click(deBaja);
    const query = ultimaDireccion();
    expect(query.get('estado')).toBe('de-baja');
    expect(query.get('page')).toBe('1');
  });

  it('R9: con un estado ya elegido, elegir el otro deja los dos en la direccion', async () => {
    const user = setupUser();
    montar({ params: params({ estado: 'activa' }) });
    await user.click(screen.getByTestId('data-table-filter-status'));
    await user.click(
      await esperarInteractiva(await screen.findByTestId('data-table-filter-option-status-deleted')),
    );
    expect(ultimaDireccion().get('estado')).toBe('activa,de-baja');
  });

  it('R10: escribir en la busqueda navega con q y vuelve a la primera pagina', async () => {
    montar({ params: params({ page: '3' }), totalPages: 3 });
    const caja = screen.getByTestId('data-table-search');
    expect(caja).toHaveAttribute('placeholder', 'Buscar empresas por nombre o identificación fiscal');
    fireEvent.change(caja, { target: { value: '900.481' } });
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalled());
    const query = ultimaDireccion();
    expect(query.get('q')).toBe('900.481');
    expect(query.get('page')).toBe('1');
  });

  it('R11: Nombre y Creada se ordenan y el orden va a la direccion; las demas no ordenan', async () => {
    const user = setupUser();
    montar();
    expect(screen.getByTestId('data-table-head-name')).toHaveAttribute('aria-sort', 'none');
    expect(screen.getByTestId('data-table-head-createdAt')).toHaveAttribute('aria-sort', 'none');
    expect(screen.getByTestId('data-table-head-taxId')).not.toHaveAttribute('aria-sort');
    await user.click(within(screen.getByTestId('data-table-head-createdAt')).getAllByRole('button')[0]!);
    const query = ultimaDireccion();
    expect(query.get('sort')).toBe('createdAt');
    expect(query.get('dir')).not.toBeNull();
  });

  it('R11: la paginacion dice «Página N de M · T en total» y pasar de pagina va a la direccion', async () => {
    const user = setupUser();
    montar({ params: params({ q: 'a', estado: 'de-baja' }), total: 23, totalPages: 3 });
    expect(screen.getByTestId('data-table-page-indicator')).toHaveTextContent(
      'Página 1 de 3 · 23 en total',
    );
    await user.click(screen.getByTestId('data-table-next'));
    const query = ultimaDireccion();
    expect(query.get('page')).toBe('2');
    expect(query.get('q')).toBe('a');
    expect(query.get('estado')).toBe('de-baja');
  });
});

describe('menu de acciones', () => {
  it('R14: una empresa activa ofrece Abrir, Editar, Módulos y Dar de baja', async () => {
    montar();
    const trigger = within(fila(VALLE.id)).getByTestId('company-actions');
    expect(trigger).toHaveAccessibleName(`Acciones de ${VALLE.name}`);
    expect(await etiquetasDelMenu(trigger)).toEqual(['Abrir', 'Editar', 'Módulos', 'Dar de baja']);
    expect(screen.getByTestId('company-action-open')).toHaveAttribute(
      'href',
      maestroCompanyRoute(VALLE.id),
    );
    expect(screen.getByTestId('company-action-modules')).toHaveAttribute(
      'href',
      maestroCompanyRoute(VALLE.id, 'modulos'),
    );
  });

  it('R14: una empresa de baja ofrece Abrir, Editar y Reactivar', async () => {
    montar();
    const trigger = within(fila(LA_CEJA.id)).getByTestId('company-actions');
    expect(await etiquetasDelMenu(trigger)).toEqual(['Abrir', 'Editar', 'Reactivar']);
  });

  it('R6: sin empresas.modificar el menu no trae ningun disparador de escritura', async () => {
    montar({ canModify: false });
    expect(await etiquetasDelMenu(within(fila(VALLE.id)).getByTestId('company-actions'))).toEqual([
      'Abrir',
      'Módulos',
    ]);
    cleanup();
    montar({ canModify: false });
    expect(await etiquetasDelMenu(within(fila(LA_CEJA.id)).getByTestId('company-actions'))).toEqual([
      'Abrir',
    ]);
    expect(screen.queryByText('Nueva empresa')).toBeNull();
  });
});

describe('estados', () => {
  it('R15: mientras carga pinta el esqueleto de tabla', () => {
    montar({ status: 'loading', companies: [] });
    expect(screen.getByTestId('company-list-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('data-table')).toBeNull();
  });

  it('R15: si la consulta falla pinta el error con «Reintentar», que vuelve a pedir la lista', async () => {
    const user = setupUser();
    const error: ErrorState = {
      status: 'error',
      code: 'unexpected',
      message: 'Ocurrio un error inesperado.',
      reference: 'req-123',
    };
    montarError(error);
    const recuadro = screen.getByTestId('company-list-error');
    expect(recuadro).toHaveTextContent('No se pudo cargar la lista de empresas.');
    expect(recuadro).toHaveTextContent('req-123');
    await user.click(screen.getByTestId('company-list-retry'));
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it('R15: con el filtro solo «De baja» y sin filas pinta su vacio con «Quitar el filtro»', () => {
    montar({ companies: [], total: 0, params: params({ estado: 'de-baja', sort: 'name' }) });
    const vacio = screen.getByTestId('company-list-empty');
    expect(within(vacio).getByRole('heading', { level: 2 })).toHaveTextContent(
      COMPANY_EMPTY_TEXTS.deletedHeading,
    );
    expect(vacio).toHaveTextContent(
      'Cuando des de baja una empresa, aparecerá aquí para reactivarla.',
    );
    const quitar = within(vacio).getByRole('link', { name: 'Quitar el filtro' });
    const destino = new URL(quitar.getAttribute('href') ?? '', 'http://localhost');
    expect(destino.pathname).toBe('/maestro/empresas');
    expect(destino.searchParams.get('estado')).toBeNull();
    expect(destino.searchParams.get('sort')).toBe('name');
  });

  it('R15: si la busqueda no trae filas pinta el vacio con el enlace para limpiarla', () => {
    montar({ companies: [], total: 0, params: params({ q: 'zzz', estado: 'activa' }) });
    const vacio = screen.getByTestId('company-list-empty');
    expect(vacio).toHaveTextContent(COMPANY_EMPTY_TEXTS.noMatches);
    const limpiar = screen.getByTestId('company-list-clear-search');
    const destino = new URL(limpiar.getAttribute('href') ?? '', 'http://localhost');
    expect(destino.searchParams.get('q')).toBeNull();
    expect(destino.searchParams.get('estado')).toBe('activa');
  });
});

describe('tarjetas en contenedor estrecho', () => {
  it('R16: cada empresa tiene su tarjeta con nombre, estado, identificacion, pais, usuarios y fecha', () => {
    montar();
    const card = tarjeta(VALLE.id);
    expect(within(card).getByRole('link', { name: VALLE.name })).toBeInTheDocument();
    expect(within(card).getByTestId('company-status')).toHaveTextContent('Activa');
    expect(within(card).getByTestId('company-tax-id')).toHaveTextContent('900.481.227-3');
    expect(within(card).getByTestId('company-country')).toHaveTextContent('Sin país');
    expect(within(card).getByTestId('company-users')).toHaveTextContent('14 usuarios');
    expect(within(card).getByTestId('company-created-at')).toHaveTextContent('creada 14/09/2026');
  });

  it('R16: el boton «Acciones» de la tarjeta mide al menos 44 px y abre el menu centrado', async () => {
    const user = setupUser();
    montar();
    const acciones = within(tarjeta(LA_CEJA.id)).getByTestId('company-actions');
    expect(acciones).toHaveTextContent('Acciones');
    expect(acciones).toHaveClass('min-h-11', 'min-w-11');
    await user.click(acciones);
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText(LA_CEJA.name)).toBeInTheDocument();
    expect(within(dialogo).getByTestId('company-action-reactivate')).toHaveTextContent('Reactivar');
  });
});
