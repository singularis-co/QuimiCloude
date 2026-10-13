// Rediseño del Dashboard (tableros Dashboard, DashboardTablet, DashboardMovil y Tabla). `useRouter`
// está simulado; la acción de lista y el corte por permiso también: son el borde de la pantalla.
// Con `card`, `DataTable` pinta tabla y tarjetas a la vez: cada caso acota a uno de los dos cuerpos.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardPage from '@/app/(private)/dashboard/page';
import {
  ACTIVE_ORDER_MARK,
  DELETED_ORDER_MARK,
  DashboardContent,
  EXECUTION_TRACE_SECTION_TESTID,
  EXECUTION_TRACE_SECTION_TITLE,
  EXECUTION_TRACE_TABLE_TEXTS,
  ExecutionTraceListSection,
  ExecutionTraceTable,
  LAST_AT_COLUMN_ID,
  PERSON_COLUMN_ID,
  TRACE_ACTIONS_LABEL_PREFIX,
  TRACE_LINK_TEXT,
  TRACE_MENU_TITLE_PREFIX,
  TRACE_ORDER_STATUS_LABELS,
  createDefaultExecutionTraceListParams,
  executionTraceDetailHref,
  type ExecutionTraceListParams,
} from '@/app/(private)/dashboard/components';
import type { ExecutionTracePerson, ExecutionTraceRow } from '@/lib/modules/asignaciones';
import { ORDER_STATUS_TONES } from '@/lib/shared/ui/order-status';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';
import { WIDE_VIEWPORT, resetViewport, setViewportWidth } from '../../helpers/viewport';
import { resolverServerComponents } from '../../unit/paridad/arbol-accesible';

const { routerMock, listExecutionTracesActionMock, requirePagePermissionMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  listExecutionTracesActionMock: vi.fn<(input: unknown) => Promise<unknown>>(),
  requirePagePermissionMock: vi.fn<(code: string) => Promise<void>>(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/execution-trace-actions', () => ({
  listExecutionTracesAction: listExecutionTracesActionMock,
  getExecutionTraceAction: vi.fn(),
}));

vi.mock('@/lib/modules/identity/adapters/driving/require-page-permission', () => ({
  requirePagePermission: requirePagePermissionMock,
}));

const ANA: ExecutionTracePerson = { userId: '3f2b8c1e-5d4a-4b7e-9c2f-1a2b3c4d5e6f', displayName: 'Ana Ruiz' };

const ACTIVO: ExecutionTraceRow = {
  orderId: 'o-activo',
  numberText: '2026-0000042',
  status: 'EN_CURSO',
  deleted: false,
  people: [ANA],
  firstAt: new Date('2026-10-07T08:00:00.000Z'),
  lastAt: new Date('2026-10-07T08:30:00.000Z'),
  duration: { kind: 'open', ms: 45 * 60 * 1000 },
  goBackCount: 2,
};

const DE_BAJA: ExecutionTraceRow = {
  orderId: 'o-baja',
  numberText: '2026-0000041',
  status: 'CANCELADO',
  deleted: true,
  people: [ANA],
  firstAt: new Date('2026-10-06T08:00:00.000Z'),
  lastAt: new Date('2026-10-06T09:00:00.000Z'),
  duration: { kind: 'open', ms: 60 * 60 * 1000 },
  goBackCount: 0,
};

const ENTREGADO: ExecutionTraceRow = {
  orderId: 'o-entregado',
  numberText: '2026-0000040',
  status: 'ENTREGADO',
  deleted: false,
  people: [ANA],
  firstAt: new Date('2026-10-05T08:00:00.000Z'),
  lastAt: new Date('2026-10-05T09:05:00.000Z'),
  duration: { kind: 'closed', ms: 65 * 60 * 1000 },
  goBackCount: 0,
};

const ROWS = [ACTIVO, DE_BAJA, ENTREGADO];

function params(overrides: Partial<ExecutionTraceListParams> = {}): ExecutionTraceListParams {
  return { ...createDefaultExecutionTraceListParams(), ...overrides };
}

function montar(p: ExecutionTraceListParams = params(), rows: readonly ExecutionTraceRow[] = ROWS) {
  render(<ExecutionTraceTable rows={rows} personOptions={[ANA]} params={p} totalPages={1} />);
  return p;
}

function fila(row: ExecutionTraceRow): HTMLElement {
  return screen.getByTestId(`data-table-row-${row.orderId}`);
}

function celda(row: ExecutionTraceRow, columnId: string): HTMLElement {
  return within(fila(row)).getByTestId(`data-table-cell-${columnId}`);
}

function tarjeta(row: ExecutionTraceRow): HTMLElement {
  return screen.getByTestId(`data-table-card-${row.orderId}`);
}

/**
 * `resolverServerComponents` no entra en componentes síncronos, y `DashboardContent` envuelve la
 * sección `async`: se expande a mano para que el árbol de la página llegue hasta la lista.
 */
async function resolverPagina(nodo: ReactNode): Promise<ReactNode> {
  if (Array.isArray(nodo)) {
    return Promise.all((nodo as ReactNode[]).map((hijo) => resolverPagina(hijo)));
  }
  if (!isValidElement(nodo)) return nodo;
  const elemento = nodo as ReactElement<{ children?: ReactNode }>;
  if (elemento.type === DashboardContent) {
    return resolverServerComponents(
      DashboardContent(elemento.props as Parameters<typeof DashboardContent>[0]),
    );
  }
  const hijos = elemento.props.children;
  if (hijos === undefined) return resolverServerComponents(elemento);
  const resueltos = await resolverPagina(hijos);
  return Array.isArray(resueltos)
    ? cloneElement(elemento, undefined, ...(resueltos as ReactNode[]))
    : cloneElement(elemento, undefined, resueltos);
}

function exito(items: readonly ExecutionTraceRow[]) {
  return {
    status: 'success',
    data: {
      page: { items, total: items.length, page: 1, pageSize: 10, totalPages: 1 },
      personOptions: [ANA],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  setViewportWidth(WIDE_VIEWPORT);
  requirePagePermissionMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  resetViewport();
});

describe('R1 - contenedor de página y cabecera', () => {
  it('R1 - la página va en PageShell con un único h1 «Dashboard» y un bloque con el h2, sin landmarks', async () => {
    listExecutionTracesActionMock.mockResolvedValue(exito(ROWS));
    const arbol = await DashboardPage({ searchParams: Promise.resolve({}) });
    const { container } = render(<>{await resolverPagina(await resolverServerComponents(arbol))}</>);

    expect(requirePagePermissionMock).toHaveBeenCalledWith('dashboard.consultar');
    const shell = container.querySelector('[data-slot="page-shell"]');
    expect(shell).not.toBeNull();
    const cabecera = (shell as HTMLElement).querySelector('[data-slot="page-header"]');
    expect(cabecera).not.toBeNull();

    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toBe(screen.getByTestId('dashboard-title'));
    expect(titulos[0]).toHaveTextContent('Dashboard');
    expect(cabecera).toContainElement(titulos[0] as HTMLElement);

    const area = screen.getByTestId('dashboard-content');
    expect(shell).toContainElement(area);
    const bloque = within(area).getByTestId(EXECUTION_TRACE_SECTION_TESTID);
    expect(bloque.tagName).toBe('DIV');
    expect(within(bloque).getByRole('heading', { level: 2 })).toHaveTextContent(
      EXECUTION_TRACE_SECTION_TITLE,
    );
    expect(screen.queryAllByRole('region')).toHaveLength(0);
    expect(container.querySelector('section')).toBeNull();
    expect(screen.queryAllByRole('main')).toHaveLength(0);
  });
});

describe('R3 - columnas', () => {
  it('R3 - las columnas salen en orden y con su nombre, con la de acciones al final', () => {
    montar();
    const cabeceras = screen.getAllByRole('columnheader').map((th) => th.textContent ?? '');
    const esperadas = [
      'Nº de pedido',
      'Estado',
      'Personas',
      'Primera anotación',
      'Última anotación',
      'Duración',
      'Vueltas atrás',
      'Acciones',
    ];
    expect(cabeceras).toHaveLength(esperadas.length);
    esperadas.forEach((etiqueta, indice) => expect(cabeceras[indice]).toContain(etiqueta));
  });

  it('R3 - primera, última anotación y duración van en Mono tabular y al final; vueltas atrás al final', () => {
    montar();
    for (const columnId of ['firstAt', LAST_AT_COLUMN_ID, 'duration']) {
      expect(celda(ACTIVO, columnId)).toHaveClass('font-mono', 'tabular-nums', 'text-right');
    }
    expect(celda(ACTIVO, 'goBackCount')).toHaveClass('text-right');
    expect(celda(ACTIVO, 'goBackCount')).not.toHaveClass('font-mono');
  });
});

describe('R4 - estado', () => {
  it('R4 - el estado es un StatusBadge con la etiqueta y el tono del estado, y conserva testid y data-status', () => {
    montar();
    for (const row of ROWS) {
      const estado = within(fila(row)).getByTestId('execution-trace-status');
      expect(estado).toHaveTextContent(TRACE_ORDER_STATUS_LABELS[row.status]);
      expect(estado).toHaveAttribute('data-status', row.status);
      expect(estado).toHaveAttribute('data-tone', ORDER_STATUS_TONES[row.status]);
      expect(estado.querySelector('[data-slot="status-dot"]')).toHaveAttribute('aria-hidden', 'true');
    }
  });
});

describe('R5 - vueltas atrás', () => {
  it('R5 - con una o más vueltas atrás la cifra va en un StatusBadge de tono waiting', () => {
    montar();
    const vueltas = within(fila(ACTIVO)).getByTestId('execution-trace-go-backs');
    expect(vueltas).toHaveTextContent('2');
    expect(vueltas).toHaveAttribute('data-tone', 'waiting');
  });

  it('R5 - con cero vueltas atrás pinta «0» sin insignia y atenuado', () => {
    montar();
    const vueltas = within(fila(ENTREGADO)).getByTestId('execution-trace-go-backs');
    expect(vueltas).toHaveTextContent(/^0$/);
    expect(vueltas).not.toHaveAttribute('data-tone');
    expect(vueltas.querySelector('[data-slot="status-dot"]')).toBeNull();
    expect(vueltas).toHaveClass('text-muted-foreground');
  });
});

describe('R6 - marcas de baja y en curso', () => {
  it('R6 - un pedido dado de baja lleva «Dado de baja» en tono muted junto al número y nunca «En curso»', () => {
    montar();
    const numero = celda(DE_BAJA, 'orderNumber');
    const baja = within(numero).getByTestId('execution-trace-deleted');
    expect(baja).toHaveTextContent(DELETED_ORDER_MARK);
    expect(baja).toHaveAttribute('data-tone', 'muted');
    expect(within(numero).queryByTestId('execution-trace-active')).toBeNull();
  });

  it('R6 - un pedido activo lleva «En curso» en tono progress junto al número', () => {
    montar();
    const numero = celda(ACTIVO, 'orderNumber');
    const activa = within(numero).getByTestId('execution-trace-active');
    expect(activa).toHaveTextContent(ACTIVE_ORDER_MARK);
    expect(activa).toHaveAttribute('data-tone', 'progress');
    expect(within(numero).queryByTestId('execution-trace-deleted')).toBeNull();
  });
});

describe('R7 - menú de acciones de la fila', () => {
  it('R7 - ninguna celda tiene el enlace «Ver recorrido» y el disparador se llama «Acciones del pedido {n}» y mide 44x44', () => {
    montar();
    expect(screen.queryAllByRole('link', { name: new RegExp(TRACE_LINK_TEXT) })).toHaveLength(0);
    expect(screen.queryAllByTestId('execution-trace-link')).toHaveLength(0);
    const disparador = within(fila(ACTIVO)).getByTestId('execution-trace-actions');
    expect(disparador).toHaveAccessibleName(`${TRACE_ACTIONS_LABEL_PREFIX}${ACTIVO.numberText}`);
    expect(disparador).toHaveClass('min-h-11', 'min-w-11');
  });

  it('R7 - al abrirlo ofrece un único ítem «Ver recorrido» que enlaza a la dirección de hoy con la consulta de la lista', async () => {
    const user = setupUser();
    const p = montar(params({ page: 2, orderNumber: '42' }));
    await user.click(within(fila(ACTIVO)).getByTestId('execution-trace-actions'));

    const menu = await screen.findByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    expect(items).toHaveLength(1);
    const enlace = within(menu).getByTestId('execution-trace-link');
    expect(enlace).toHaveTextContent(TRACE_LINK_TEXT);
    expect(enlace.tagName).toBe('A');
    expect(enlace).toHaveAttribute('href', executionTraceDetailHref(ACTIVO.orderId, p));
  });
});

describe('R8 - tarjetas', () => {
  it('R8 - la tarjeta pinta número y estado arriba, primera anotación, duración y vueltas como datos y personas al pie', () => {
    montar();
    const card = tarjeta(DE_BAJA);
    const campo = (columnId: string) => within(card).queryByTestId(`data-table-card-field-${columnId}`);
    expect(campo('orderNumber')).toHaveTextContent(DE_BAJA.numberText);
    expect(within(campo('orderNumber') as HTMLElement).getByTestId('execution-trace-deleted')).toBeInTheDocument();
    expect(campo('status')).toHaveTextContent(TRACE_ORDER_STATUS_LABELS[DE_BAJA.status]);
    expect(campo('firstAt')).toHaveTextContent('2026-10-06 08:00:00');
    expect(campo('duration')).not.toBeNull();
    expect(campo('goBackCount')).toHaveTextContent('0');
    expect(campo(PERSON_COLUMN_ID)).not.toBeNull();
    expect(campo(LAST_AT_COLUMN_ID)).toBeNull();
    const acciones = within(card).getByTestId('execution-trace-actions');
    expect(acciones).toHaveTextContent('Acciones');
    expect(acciones).toHaveClass('min-h-11');
  });

  it('R8 - «Acciones» abre el menú centrado con «Pedido {n}», «Cerrar» y el ítem de 48 px, y al cerrar devuelve el foco', async () => {
    const user = setupUser();
    const p = montar();
    const acciones = within(tarjeta(ACTIVO)).getByTestId('execution-trace-actions');
    await user.click(acciones);

    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveAccessibleName(`${TRACE_MENU_TITLE_PREFIX}${ACTIVO.numberText}`);
    const enlace = within(dialogo).getByTestId('execution-trace-link');
    expect(enlace).toHaveTextContent(TRACE_LINK_TEXT);
    expect(enlace).toHaveClass('min-h-12');
    expect(enlace).toHaveAttribute('href', executionTraceDetailHref(ACTIVO.orderId, p));

    await user.click(await esperarInteractiva(within(dialogo).getByRole('button', { name: 'Cerrar' })));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(acciones).toHaveFocus());
  });
});

describe('R9 - vacío y error', () => {
  it('R9 - sin filas muestra «No hay pedidos ejecutados que mostrar.»', () => {
    montar(params(), []);
    expect(screen.getByTestId('data-table-empty')).toHaveTextContent(EXECUTION_TRACE_TABLE_TEXTS.empty);
  });

  it('R9 - si la lectura falla muestra el error dentro del área y «Reintentar» pide la página sin navegar', async () => {
    const user = setupUser();
    listExecutionTracesActionMock.mockResolvedValue({
      status: 'error',
      code: 'unauthorized',
      message: 'No tienes permiso.',
    });
    render(await ExecutionTraceListSection({ params: params() }));
    const seccion = screen.getByTestId(EXECUTION_TRACE_SECTION_TESTID);
    const error = within(seccion).getByTestId('execution-trace-error');
    expect(error).toHaveTextContent(EXECUTION_TRACE_TABLE_TEXTS.error);

    const reintentar = within(seccion).getByTestId('execution-trace-retry');
    expect(reintentar).toHaveAccessibleName('Reintentar');
    await user.click(reintentar);
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});
