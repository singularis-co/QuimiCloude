// QC-261 T7 — R21: los textos visibles y nombres accesibles de las tres pantallas (Dashboard,
// recorrido y página no encontrada), con su ortografía exacta.
//
// Los textos esperados van ESCRITOS AQUÍ, literales, y no se importan de las constantes de los
// componentes: si alguien cambia una constante (una tilde, un voseo), este archivo debe ponerse rojo.
// Los montajes copian los de `dashboard-rediseno.test.tsx`, `recorrido-rediseno.test.tsx` y
// `no-encontrada-rediseno.test.tsx`: `useRouter`, la acción de lista y el corte por permiso están
// simulados porque son el borde de la pantalla.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardPage from '@/app/(private)/dashboard/page';
import {
  DashboardContent,
  ExecutionTraceListSection,
  ExecutionTraceTable,
  createDefaultExecutionTraceListParams,
} from '@/app/(private)/dashboard/components';
import {
  ExecutionTraceDetail,
  ExecutionTraceDetailError,
} from '@/app/(private)/dashboard/recorrido/[id]/components';
import PrivateNotFound from '@/app/(private)/not-found';
import type {
  ExecutionAction,
  ExecutionTraceDetail as ExecutionTraceDetailData,
  ExecutionTraceDetailStep,
  ExecutionTracePerson,
  ExecutionTraceRow,
} from '@/lib/modules/asignaciones';
import { UNEXPECTED_ERROR_CODE } from '@/lib/modules/errores';
import { DASHBOARD_ROUTE } from '@/lib/shared/routes';

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

// ---------------------------------------------------------------------------------------------
// La tabla de R21, literal
// ---------------------------------------------------------------------------------------------

const TEXTOS = {
  dashboard: {
    titulo: 'Dashboard',
    seccion: 'Recorridos de ejecución',
    buscar: 'Buscar por número de pedido',
    soloCancelados: 'Solo cancelados',
  },
  columnas: [
    'Nº de pedido',
    'Estado',
    'Personas',
    'Primera anotación',
    'Última anotación',
    'Duración',
    'Vueltas atrás',
  ],
  menu: {
    disparador: (numero: string) => `Acciones del pedido ${numero}`,
    verRecorrido: 'Ver recorrido',
    acciones: 'Acciones',
    titulo: (numero: string) => `Pedido ${numero}`,
    cerrar: 'Cerrar',
  },
  estadosLista: {
    vacio: 'No hay pedidos ejecutados que mostrar.',
    error: 'No se pudo cargar la lista de pedidos ejecutados.',
    reintentar: 'Reintentar',
  },
  marcas: { baja: 'Dado de baja', enCurso: 'En curso', vueltaAtras: 'Vuelta atrás' },
  recorrido: {
    volver: 'Volver a la lista',
    titulo: (numero: string) => `Recorrido del pedido ${numero}`,
    datos: ['Estado', 'Duración', 'Vueltas atrás'],
    anotaciones: 'Anotaciones',
    paso: (n: number) => `Paso ${n}`,
    motivo: 'Motivo',
    hastaLaSiguiente: 'Hasta la siguiente:',
    sinDato: 'Sin dato',
    error: 'No se pudo cargar el recorrido.',
  },
  acciones: {
    start: 'Arrancar',
    resume: 'Retomar',
    advance: 'Avanzar',
    go_back: 'Retroceder',
    cancel: 'Cancelar',
    finish: 'Finalizar',
    pack_start: 'Comenzar empaque',
    pack_finish: 'Terminar empaque',
    conditioning_start: 'Comenzar acondicionamiento',
    conditioning_batch_save: 'Guardado de datos de lote',
    conditioning_finish: 'Terminar acondicionamiento',
  } satisfies Record<ExecutionAction, string>,
  noEncontrada: {
    etiqueta: '404',
    titulo: 'No encontramos esta página',
    mensaje: 'Revisa la dirección e inténtalo de nuevo, o continúa desde el menú lateral.',
  },
} as const;

// ---------------------------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------------------------

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

const ROWS = [ACTIVO, DE_BAJA];

function exito(items: readonly ExecutionTraceRow[]) {
  return {
    status: 'success',
    data: {
      page: { items, total: items.length, page: 1, pageSize: 10, totalPages: 1 },
      personOptions: [ANA],
    },
  };
}

function montarTabla(rows: readonly ExecutionTraceRow[] = ROWS) {
  render(
    <ExecutionTraceTable
      rows={rows}
      personOptions={[ANA]}
      params={createDefaultExecutionTraceListParams()}
      totalPages={1}
    />,
  );
}

/** Como en `dashboard-rediseno.test.tsx`: `DashboardContent` es síncrono y envuelve la sección `async`. */
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

const ORDER_ID = '0b1c2d3e-4f50-4a61-8b72-c3d4e5f60718';
const MIN = 60 * 1000;

function step(
  overrides: Partial<ExecutionTraceDetailStep> & Pick<ExecutionTraceDetailStep, 'id' | 'action'>,
): ExecutionTraceDetailStep {
  return {
    orderId: ORDER_ID,
    userId: 'u1',
    userDisplayName: 'Ana Ruiz',
    stepPosition: 1,
    reason: null,
    batchLines: null,
    occurredAt: new Date('2026-10-07T08:00:00.000Z'),
    gapToNextMs: 5 * MIN,
    isGoBack: false,
    ...overrides,
  };
}

/** Una anotación por cada acción del dominio, en el orden de la tabla de R21. */
const STEPS: readonly ExecutionTraceDetailStep[] = [
  step({ id: 'e1', action: 'start', stepPosition: 1 }),
  step({ id: 'e2', action: 'resume', stepPosition: 1 }),
  step({ id: 'e3', action: 'advance', stepPosition: 2 }),
  step({ id: 'e4', action: 'go_back', stepPosition: 1, userId: 'u2', userDisplayName: null, isGoBack: true }),
  step({ id: 'e5', action: 'cancel', stepPosition: null, reason: 'Falta materia prima' }),
  step({ id: 'e6', action: 'finish', stepPosition: 3 }),
  step({ id: 'e7', action: 'pack_start', stepPosition: null }),
  step({ id: 'e8', action: 'pack_finish', stepPosition: null, gapToNextMs: null }),
];

const TRACE: ExecutionTraceDetailData = {
  orderId: ORDER_ID,
  numberText: '2026-0000042',
  status: 'EN_CURSO',
  deleted: false,
  firstAt: new Date('2026-10-07T08:00:00.000Z'),
  lastAt: new Date('2026-10-07T08:20:00.000Z'),
  duration: { kind: 'open', ms: 20 * MIN },
  goBackCount: 1,
  steps: STEPS,
};

const BACK_HREF = `${DASHBOARD_ROUTE}?page=2&pageSize=25`;

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

// ---------------------------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------------------------

describe('R21 - textos del Dashboard', () => {
  it('R21 - la página dice «Dashboard», «Recorridos de ejecución», «Buscar por número de pedido» y «Solo cancelados»', async () => {
    listExecutionTracesActionMock.mockResolvedValue(exito(ROWS));
    const arbol = await DashboardPage({ searchParams: Promise.resolve({}) });
    render(<>{await resolverPagina(await resolverServerComponents(arbol))}</>);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(TEXTOS.dashboard.titulo);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(TEXTOS.dashboard.seccion);
    const buscador = screen.getByRole('searchbox', { name: TEXTOS.dashboard.buscar });
    expect(buscador).toHaveAttribute('placeholder', TEXTOS.dashboard.buscar);
    expect(screen.getByTestId('execution-trace-cancelled-only')).toHaveAccessibleName(
      TEXTOS.dashboard.soloCancelados,
    );
    expect(screen.getByText(TEXTOS.dashboard.soloCancelados)).toBeVisible();
  });

  it('R21 - las columnas se llaman «Nº de pedido», «Estado», «Personas», «Primera anotación», «Última anotación», «Duración», «Vueltas atrás»', () => {
    montarTabla();
    const cabeceras = screen.getAllByRole('columnheader').map((th) => th.textContent ?? '');
    TEXTOS.columnas.forEach((etiqueta, indice) => {
      expect(cabeceras[indice]).toContain(etiqueta);
    });
  });

  it('R21 - el menú de fila: «Acciones del pedido {n}» abre «Ver recorrido»', async () => {
    const user = setupUser();
    montarTabla();
    const fila = screen.getByTestId(`data-table-row-${ACTIVO.orderId}`);
    const disparador = within(fila).getByRole('button', {
      name: TEXTOS.menu.disparador(ACTIVO.numberText),
    });
    await user.click(disparador);

    const menu = await screen.findByRole('menu');
    const item = within(menu).getByRole('menuitem');
    expect(item.textContent).toBe(TEXTOS.menu.verRecorrido);
  });

  it('R21 - en tarjeta: «Acciones» abre «Pedido {n}» con «Ver recorrido» y «Cerrar»', async () => {
    const user = setupUser();
    montarTabla();
    const tarjeta = screen.getByTestId(`data-table-card-${ACTIVO.orderId}`);
    const acciones = within(tarjeta).getByTestId('execution-trace-actions');
    expect(acciones.textContent).toBe(TEXTOS.menu.acciones);
    await user.click(acciones);

    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveAccessibleName(TEXTOS.menu.titulo(ACTIVO.numberText));
    expect(within(dialogo).getByTestId('execution-trace-link').textContent).toBe(TEXTOS.menu.verRecorrido);
    const cerrar = await esperarInteractiva(
      within(dialogo).getByRole('button', { name: TEXTOS.menu.cerrar }),
    );
    await user.click(cerrar);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('R21 - la lista vacía dice «No hay pedidos ejecutados que mostrar.»', () => {
    montarTabla([]);
    expect(screen.getByTestId('data-table-empty')).toHaveTextContent(TEXTOS.estadosLista.vacio);
  });

  it('R21 - el error de la lista dice «No se pudo cargar la lista de pedidos ejecutados.» con «Reintentar»', async () => {
    listExecutionTracesActionMock.mockResolvedValue({
      status: 'error',
      code: 'unauthorized',
      message: 'No tienes permiso.',
    });
    render(await ExecutionTraceListSection({ params: createDefaultExecutionTraceListParams() }));
    expect(screen.getByTestId('execution-trace-error')).toHaveTextContent(TEXTOS.estadosLista.error);
    expect(screen.getByTestId('execution-trace-retry')).toHaveAccessibleName(
      TEXTOS.estadosLista.reintentar,
    );
  });

  it('R21 - las marcas de la lista dicen «Dado de baja» y «En curso»', () => {
    montarTabla();
    const filaBaja = screen.getByTestId(`data-table-row-${DE_BAJA.orderId}`);
    expect(within(filaBaja).getByTestId('execution-trace-deleted').textContent).toBe(TEXTOS.marcas.baja);
    const filaActiva = screen.getByTestId(`data-table-row-${ACTIVO.orderId}`);
    expect(within(filaActiva).getByTestId('execution-trace-active').textContent).toBe(
      TEXTOS.marcas.enCurso,
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Recorrido
// ---------------------------------------------------------------------------------------------

describe('R21 - textos del recorrido', () => {
  it('R21 - «Volver a la lista», «Recorrido del pedido {n}», «Estado», «Duración», «Vueltas atrás» y «Anotaciones»', () => {
    const { container } = render(<ExecutionTraceDetail trace={TRACE} backHref={BACK_HREF} />);

    expect(screen.getByRole('link', { name: TEXTOS.recorrido.volver })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      TEXTOS.recorrido.titulo(TRACE.numberText),
    );
    expect(Array.from(container.querySelectorAll('dt')).map((dt) => dt.textContent)).toEqual(
      TEXTOS.recorrido.datos,
    );
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(TEXTOS.recorrido.anotaciones);
    expect(screen.getByRole('list', { name: TEXTOS.recorrido.anotaciones })).toBeInTheDocument();
  });

  it('R21 - cada anotación: su acción, «Paso {n}», «Motivo», «Hasta la siguiente:» y «Sin dato»', () => {
    render(<ExecutionTraceDetail trace={TRACE} backHref={BACK_HREF} />);
    const items = screen.getAllByTestId('execution-trace-step');

    expect(items.map((li) => within(li).getByTestId('execution-trace-step-action').textContent)).toEqual(
      STEPS.map((s) => TEXTOS.acciones[s.action]),
    );
    expect(within(items[0]!).getByTestId('execution-trace-step-position').textContent).toBe(
      TEXTOS.recorrido.paso(1),
    );
    expect(within(items[4]!).getByTestId('execution-trace-step-reason').textContent).toMatch(
      new RegExp(`^${TEXTOS.recorrido.motivo} · Falta materia prima$`),
    );
    expect(within(items[0]!).getByTestId('execution-trace-step-gap').textContent).toMatch(
      new RegExp(`^${TEXTOS.recorrido.hastaLaSiguiente} `),
    );
    expect(within(items[3]!).getByTestId('execution-trace-step-person')).toHaveAttribute(
      'aria-label',
      TEXTOS.recorrido.sinDato,
    );
  });

  // Enmendado el 2026-10-14 (QC-283): `TEXTOS.acciones` gana las tres del acondicionamiento, que
  // este recorrido no anota; se comparan las ocho que si pinta.
  it('R21 - las ocho acciones dicen «Arrancar», «Retomar», «Avanzar», «Retroceder», «Cancelar», «Finalizar», «Comenzar empaque», «Terminar empaque»', () => {
    render(<ExecutionTraceDetail trace={TRACE} backHref={BACK_HREF} />);
    const vistas = screen
      .getAllByTestId('execution-trace-step-action')
      .map((nodo) => nodo.textContent)
      .sort();
    const ocho = (['start', 'resume', 'advance', 'go_back', 'cancel', 'finish', 'pack_start', 'pack_finish'] as const).map(
      (accion) => TEXTOS.acciones[accion],
    );
    expect(vistas).toEqual(ocho.sort());
  });

  it('R21 - las marcas del recorrido dicen «En curso», «Dado de baja» y «Vuelta atrás»', () => {
    render(<ExecutionTraceDetail trace={TRACE} backHref={BACK_HREF} />);
    expect(screen.getByTestId('execution-trace-active').textContent).toBe(TEXTOS.marcas.enCurso);
    expect(screen.getByTestId('execution-trace-step-go-back').textContent).toBe(TEXTOS.marcas.vueltaAtras);
    cleanup();

    render(<ExecutionTraceDetail trace={{ ...TRACE, deleted: true }} backHref={BACK_HREF} />);
    expect(screen.getByTestId('execution-trace-deleted').textContent).toBe(TEXTOS.marcas.baja);
  });

  it('R21 - el error dice «No se pudo cargar el recorrido.» con «Volver a la lista»', () => {
    render(
      <ExecutionTraceDetailError
        error={{ status: 'error', code: UNEXPECTED_ERROR_CODE, message: 'Fallo', reference: 'ref-1' }}
        backHref={BACK_HREF}
      />,
    );
    expect(screen.getByTestId('execution-trace-detail-error')).toHaveTextContent(TEXTOS.recorrido.error);
    expect(screen.getByRole('link', { name: TEXTOS.recorrido.volver })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------------------------
// Página no encontrada
// ---------------------------------------------------------------------------------------------

describe('R21 - textos de la página no encontrada', () => {
  it('R21 - dice «404», «No encontramos esta página» y el mensaje exacto', () => {
    render(<PrivateNotFound />);
    const pantalla = screen.getByTestId('private-not-found');

    expect(within(pantalla).getByText(TEXTOS.noEncontrada.etiqueta).textContent).toBe(
      TEXTOS.noEncontrada.etiqueta,
    );
    expect(within(pantalla).getByRole('heading', { level: 1 }).textContent).toBe(
      TEXTOS.noEncontrada.titulo,
    );
    expect(within(pantalla).getByText(TEXTOS.noEncontrada.mensaje)).toBeInTheDocument();
  });
});
