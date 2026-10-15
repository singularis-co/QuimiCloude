// El detalle del recorrido. La pagina se ejecuta como funcion `async`: el permiso, la accion y
// `notFound` estan simulados, son los bordes de la ruta.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ExecutionTracePage from '@/app/(private)/dashboard/recorrido/[id]/page';
import { BACK_TO_LIST_TEXT, ExecutionTraceDetail } from '@/app/(private)/dashboard/recorrido/[id]/components';
import {
  ACTIVE_ORDER_MARK,
  DELETED_ORDER_MARK,
  GO_BACK_MARK,
  createDefaultExecutionTraceListParams,
  executionTraceListHref,
  formatElapsed,
} from '@/app/(private)/dashboard/components';
import type { ExecutionTraceDetail as ExecutionTraceDetailData } from '@/lib/modules/asignaciones';
import { DASHBOARD_ROUTE } from '@/lib/shared/routes';
import {
  CONDITIONING_DURATION_MS,
  FINISHED_CONDITIONING_TRACE,
  IN_PROGRESS_CONDITIONING_TRACE,
  PREVIOUS_CONDITIONING_TRACE,
  UNCLOSED_CONDITIONING_TRACE,
} from '../../fixtures/execution-trace-conditioning';

const { requirePagePermissionMock, getExecutionTraceActionMock, notFoundMock } = vi.hoisted(() => ({
  requirePagePermissionMock: vi.fn<(code: string) => Promise<void>>(),
  getExecutionTraceActionMock: vi.fn<(orderId: string) => Promise<unknown>>(),
  notFoundMock: vi.fn<() => never>(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: notFoundMock,
}));

vi.mock('@/lib/modules/identity/adapters/driving/require-page-permission', () => ({
  requirePagePermission: requirePagePermissionMock,
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/execution-trace-actions', () => ({
  getExecutionTraceAction: getExecutionTraceActionMock,
  listExecutionTracesAction: vi.fn(),
}));

const ORDER_ID = '0b1c2d3e-4f50-4a61-8b72-c3d4e5f60718';
const MIN = 60 * 1000;

// Ajustado el 2026-10-14 (QC-283): el detalle trae `active` y `durations` por fase en vez de
// `duration`, y los pasos de produccion ya no llevan `batchLines`.
const TRACE: ExecutionTraceDetailData = {
  orderId: ORDER_ID,
  numberText: '2026-0000042',
  status: 'CANCELADO',
  deleted: false,
  firstAt: new Date('2026-10-07T08:00:00.000Z'),
  lastAt: new Date('2026-10-07T08:20:00.000Z'),
  active: false,
  durations: { production: { kind: 'closed', ms: 20 * MIN }, packing: null, conditioning: null },
  goBackCount: 1,
  steps: [
    {
      id: 'e1',
      orderId: ORDER_ID,
      userId: 'u1',
      userDisplayName: 'Ana Ruiz',
      action: 'start',
      stepPosition: 1,
      reason: null,
      occurredAt: new Date('2026-10-07T08:00:00.000Z'),
      gapToNextMs: 5 * MIN,
      isGoBack: false,
    },
    {
      id: 'e2',
      orderId: ORDER_ID,
      userId: 'u1',
      userDisplayName: 'Ana Ruiz',
      action: 'advance',
      stepPosition: 2,
      reason: null,
      occurredAt: new Date('2026-10-07T08:05:00.000Z'),
      gapToNextMs: 5 * MIN,
      isGoBack: false,
    },
    {
      id: 'e3',
      orderId: ORDER_ID,
      userId: 'u2',
      userDisplayName: null,
      action: 'go_back',
      stepPosition: 1,
      reason: null,
      occurredAt: new Date('2026-10-07T08:10:00.000Z'),
      gapToNextMs: 10 * MIN,
      isGoBack: true,
    },
    {
      id: 'e4',
      orderId: ORDER_ID,
      userId: 'u1',
      userDisplayName: 'Ana Ruiz',
      action: 'cancel',
      stepPosition: 1,
      reason: 'Falta materia prima',
      occurredAt: new Date('2026-10-07T08:20:00.000Z'),
      gapToNextMs: null,
      isGoBack: false,
    },
  ],
};

async function abrir(searchParams: Record<string, string> = {}, id = ORDER_ID) {
  return ExecutionTracePage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(searchParams),
  });
}

function pasos(): HTMLElement[] {
  return screen.getAllByTestId('execution-trace-step');
}

beforeEach(() => {
  vi.clearAllMocks();
  requirePagePermissionMock.mockResolvedValue(undefined);
  getExecutionTraceActionMock.mockResolvedValue({ status: 'success', data: TRACE });
});

afterEach(() => {
  cleanup();
});

describe('R12 - R18 - R20 - la pagina del recorrido', () => {
  it('R20 - exige dashboard.consultar antes de leer el recorrido', async () => {
    await abrir();
    expect(requirePagePermissionMock).toHaveBeenCalledWith('dashboard.consultar');
    expect(requirePagePermissionMock.mock.invocationCallOrder[0]).toBeLessThan(
      getExecutionTraceActionMock.mock.invocationCallOrder[0],
    );
  });

  it('R20 - sin permiso no llega a leer nada', async () => {
    requirePagePermissionMock.mockRejectedValue(new Error('NEXT_NOT_FOUND'));
    await expect(abrir()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(getExecutionTraceActionMock).not.toHaveBeenCalled();
  });

  it('R12 - pide el recorrido del id de la ruta, sin depender de la consulta', async () => {
    await abrir({ page: '2', q: '42' });
    expect(getExecutionTraceActionMock).toHaveBeenCalledWith(ORDER_ID);
  });

  it('R20 - la primera linea de la pagina es el corte por permiso', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/(private)/dashboard/recorrido/[id]/page.tsx'),
      'utf8',
    );
    const body = source.slice(source.indexOf('export default async function'));
    const firstStatement = body.slice(body.indexOf('{\n', body.indexOf(') {')) + 2).trim().split('\n')[0];
    expect(firstStatement).toBe("await requirePagePermission('dashboard.consultar');");
  });

  it('R18 - order_not_found responde 404', async () => {
    getExecutionTraceActionMock.mockResolvedValue({
      status: 'error',
      code: 'order_not_found',
      message: 'El pedido solicitado no existe.',
    });
    await expect(abrir()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('R18 - un pedido dado de baja con anotaciones abre su recorrido marcado', async () => {
    getExecutionTraceActionMock.mockResolvedValue({ status: 'success', data: { ...TRACE, deleted: true } });
    render(await abrir());
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('execution-trace-deleted')).toHaveTextContent(DELETED_ORDER_MARK);
  });
});

describe('R3 - la marca de actividad del resumen', () => {
  it('R3 - un pedido activo en EN_EMPAQUE lleva la marca «En curso» aparte del estado', async () => {
    getExecutionTraceActionMock.mockResolvedValue({
      status: 'success',
      data: { ...TRACE, status: 'EN_EMPAQUE', active: true },
    });
    render(await abrir());
    expect(screen.getByTestId('execution-trace-active')).toHaveTextContent(ACTIVE_ORDER_MARK);
    expect(screen.getByTestId('execution-trace-status')).toHaveTextContent('En empaque');
  });

  it('R3 - un pedido dado de baja en EN_CURSO o uno cerrado no lleva la marca de actividad', async () => {
    getExecutionTraceActionMock.mockResolvedValue({
      status: 'success',
      data: { ...TRACE, status: 'EN_CURSO', deleted: true, active: false },
    });
    render(await abrir());
    expect(screen.queryByTestId('execution-trace-active')).toBeNull();
    expect(screen.getByTestId('execution-trace-status')).toHaveTextContent('En curso');
    cleanup();
    getExecutionTraceActionMock.mockResolvedValue({ status: 'success', data: TRACE });
    render(await abrir());
    expect(screen.queryByTestId('execution-trace-active')).toBeNull();
  });
});

describe('R13 - R14 - R15 - R16 - lo que muestra el detalle', () => {
  it('R13 - resumen con numero, estado y un unico h1', async () => {
    render(await abrir());
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('2026-0000042');
    expect(screen.getByTestId('execution-trace-status')).toHaveTextContent('Cancelado');
    expect(screen.queryByTestId('execution-trace-deleted')).toBeNull();
  });

  it('R13 - todas las anotaciones en orden, en una lista ordenada, con accion, instante, persona, posicion y motivo', async () => {
    render(await abrir());
    const lista = screen.getByRole('list', { name: 'Anotaciones' });
    expect(lista.tagName).toBe('OL');
    expect(pasos().map((li) => li.getAttribute('data-action'))).toEqual(['start', 'advance', 'go_back', 'cancel']);

    const [primero, , tercero, ultimo] = pasos();
    expect(within(primero).getByTestId('execution-trace-step-action')).toHaveTextContent('Arrancar');
    expect(within(primero).getByTestId('execution-trace-step-instant')).toHaveTextContent('2026-10-07 08:00:00');
    expect(within(primero).getByTestId('execution-trace-step-person')).toHaveTextContent('Ana Ruiz');
    expect(within(primero).getByTestId('execution-trace-step-position')).toHaveTextContent('1');
    expect(within(primero).queryByTestId('execution-trace-step-reason')).toBeNull();
    expect(within(tercero).getByTestId('execution-trace-step-person')).toHaveAccessibleName('Sin dato');
    expect(within(ultimo).getByTestId('execution-trace-step-action')).toHaveTextContent('Cancelar');
    // ENMIENDA QC-261 (2026-10-12): el tablero `Recorrido` cambia «Motivo: {m}» por «Motivo · {m}»
    // (QC-261 R14, design.md > 10).
    expect(within(ultimo).getByTestId('execution-trace-step-reason')).toHaveTextContent('Motivo · Falta materia prima');
  });

  it('R14 - cada anotacion salvo la ultima muestra el tramo hasta la siguiente', async () => {
    render(await abrir());
    const tramos = pasos().map((li) => within(li).queryByTestId('execution-trace-step-gap')?.textContent ?? null);
    expect(tramos.slice(0, 3).every((texto) => texto !== null)).toBe(true);
    expect(tramos[0]).toContain('5 min 00 s');
    expect(tramos[2]).toContain('10 min 00 s');
    expect(tramos[3]).toBeNull();
  });

  // Ajustado el 2026-10-14 (QC-283): «una sola duracion» pasa a una tarjeta por fase con cifra;
  // aqui solo hay produccion.
  it('R15 - solo la fase con duracion se pinta, con su cifra sin sufijo', async () => {
    render(await abrir());
    const duraciones = screen.getAllByTestId('execution-trace-duration');
    expect(duraciones).toHaveLength(1);
    expect(duraciones[0]).toHaveAttribute('data-phase', 'production');
    expect(duraciones[0]).toHaveTextContent(formatElapsed(20 * MIN));
  });

  // ENMIENDA QC-261 (2026-10-12): la marca visual de cada retroceder pasa a ser su tono, su icono y
  // «Retroceder»; «Vuelta atrás» queda como texto `sr-only` y el retroceder se reconoce por
  // `data-go-back` (QC-261 R15, P4, design.md > 10).
  it('R16 - cada retroceder lleva data-go-back y el texto «Vuelta atrás» para lectores, y el total coincide', async () => {
    render(await abrir());
    const marcadas = pasos().filter((li) => li.getAttribute('data-go-back') === 'true');
    expect(marcadas).toHaveLength(1);
    const marca = within(marcadas[0]).getByTestId('execution-trace-step-go-back');
    expect(marca).toHaveTextContent(GO_BACK_MARK);
    expect(marca).toHaveClass('sr-only');
    expect(screen.getAllByText(GO_BACK_MARK)).toHaveLength(1);
    expect(screen.getByTestId('execution-trace-go-backs')).toHaveTextContent(String(TRACE.goBackCount));
  });
});

describe('R17 - volver a la lista', () => {
  it('R17 - con la consulta del detalle, vuelve a la misma lista', async () => {
    const consulta = { page: '2', pageSize: '25', q: '42', cancelados: '1' };
    render(await abrir(consulta));
    expect(screen.getByRole('link', { name: BACK_TO_LIST_TEXT })).toHaveAttribute(
      'href',
      executionTraceListHref({
        ...createDefaultExecutionTraceListParams(),
        page: 2,
        pageSize: 25,
        orderNumber: '42',
        cancelledOnly: true,
      }),
    );
  });

  it('R17 - sin parametros vuelve a la lista por defecto', async () => {
    render(await abrir());
    expect(screen.getByRole('link', { name: BACK_TO_LIST_TEXT })).toHaveAttribute(
      'href',
      `${DASHBOARD_ROUTE}?page=1&pageSize=10`,
    );
  });

  it('R26 - «Volver» mide 44x44 y es enfocable', () => {
    render(<ExecutionTraceDetail trace={TRACE} backHref={DASHBOARD_ROUTE} />);
    const volver = screen.getByRole('link', { name: BACK_TO_LIST_TEXT });
    expect(volver).toHaveClass('min-h-11', 'min-w-11');
    volver.focus();
    expect(volver).toHaveFocus();
  });
});

describe('R25 - R28 - duraciones por fase y marca «En curso» con acondicionamiento', () => {
  function tarjetas(): HTMLElement[] {
    return screen.getAllByTestId('execution-trace-duration');
  }

  function datos(): HTMLElement[] {
    return Array.from(screen.getByTestId('execution-trace-detail').querySelectorAll<HTMLElement>('dl > div'));
  }

  it('R25 - tarjetas por fase con insignias; fase null no se pinta', () => {
    render(<ExecutionTraceDetail trace={IN_PROGRESS_CONDITIONING_TRACE} backHref={DASHBOARD_ROUTE} />);
    expect(tarjetas().map((t) => t.getAttribute('data-phase'))).toEqual(['production', 'packing', 'conditioning']);
    expect(tarjetas().map((t) => t.getAttribute('data-kind'))).toEqual(['closed', 'closed', 'open']);
    const [produccion, empaque, acondicionamiento] = tarjetas();
    expect(within(produccion).getByText('Duración de producción')).toBeInTheDocument();
    expect(within(empaque).getByText('Duración de empaque')).toBeInTheDocument();
    expect(within(acondicionamiento).getByText('Duración de acondicionamiento')).toBeInTheDocument();
    expect(within(produccion).getByText(formatElapsed(CONDITIONING_DURATION_MS.production))).toHaveClass('font-mono');
    expect(within(empaque).getByText('28 min 12 s')).toBeInTheDocument();
    expect(within(acondicionamiento).getByText('1 h 12 min')).toBeInTheDocument();
    expect(within(acondicionamiento).getByTestId('execution-trace-phase-open')).toHaveTextContent('En curso');
    expect(within(produccion).queryByTestId('execution-trace-phase-open')).toBeNull();
    expect(screen.queryByTestId('execution-trace-phase-unclosed')).toBeNull();
    expect(screen.queryByText(/\(en curso\)|\(sin cierre anotado\)/)).toBeNull();
  });

  it('R25 - una fase sin cierre lleva la insignia «Sin cierre anotado»', () => {
    render(<ExecutionTraceDetail trace={UNCLOSED_CONDITIONING_TRACE} backHref={DASHBOARD_ROUTE} />);
    const acondicionamiento = tarjetas()[2];
    expect(acondicionamiento).toHaveAttribute('data-kind', 'unclosed');
    expect(within(acondicionamiento).getByTestId('execution-trace-phase-unclosed')).toHaveTextContent(
      'Sin cierre anotado',
    );
    expect(within(acondicionamiento).queryByTestId('execution-trace-phase-open')).toBeNull();
  });

  it('R25 - estado, tres fases y vueltas atras: cinco datos en orden', () => {
    render(<ExecutionTraceDetail trace={FINISHED_CONDITIONING_TRACE} backHref={DASHBOARD_ROUTE} />);
    expect(datos().map((d) => d.querySelector('dt')?.textContent)).toEqual([
      'Estado',
      'Duración de producción',
      'Duración de empaque',
      'Duración de acondicionamiento',
      'Vueltas atrás',
    ]);
    expect(screen.queryByTestId('execution-trace-phase-open')).toBeNull();
    expect(screen.queryByTestId('execution-trace-phase-unclosed')).toBeNull();
  });

  it('R25 - un pedido anterior a la feature no pinta la tarjeta de acondicionamiento', () => {
    render(<ExecutionTraceDetail trace={PREVIOUS_CONDITIONING_TRACE} backHref={DASHBOARD_ROUTE} />);
    expect(datos()).toHaveLength(4);
    expect(tarjetas().map((t) => t.getAttribute('data-phase'))).toEqual(['production', 'packing']);
    expect(screen.queryByText('Duración de acondicionamiento')).toBeNull();
  });

  it('R25 - la rejilla reparte 5 en una fila, 3 + 2 o 2 columnas segun el ancho', () => {
    render(<ExecutionTraceDetail trace={FINISHED_CONDITIONING_TRACE} backHref={DASHBOARD_ROUTE} />);
    const rejilla = screen.getByTestId('execution-trace-detail').querySelector('dl');
    expect(rejilla).toHaveClass('grid', 'grid-cols-[repeat(auto-fit,minmax(min(170px,calc(50%_-_6px)),1fr))]');
  });

  it('R28 - En curso segun active; nunca en dado de baja', () => {
    render(<ExecutionTraceDetail trace={IN_PROGRESS_CONDITIONING_TRACE} backHref={DASHBOARD_ROUTE} />);
    expect(screen.getByTestId('execution-trace-active')).toHaveTextContent(ACTIVE_ORDER_MARK);
    cleanup();

    render(
      <ExecutionTraceDetail
        trace={{ ...FINISHED_CONDITIONING_TRACE, status: 'POR_EMPACAR', active: true }}
        backHref={DASHBOARD_ROUTE}
      />,
    );
    expect(screen.getByTestId('execution-trace-active')).toHaveTextContent(ACTIVE_ORDER_MARK);
    expect(screen.queryByTestId('execution-trace-phase-open')).toBeNull();
    cleanup();

    render(<ExecutionTraceDetail trace={FINISHED_CONDITIONING_TRACE} backHref={DASHBOARD_ROUTE} />);
    expect(screen.queryByTestId('execution-trace-active')).toBeNull();
    cleanup();

    render(
      <ExecutionTraceDetail trace={{ ...UNCLOSED_CONDITIONING_TRACE, active: true }} backHref={DASHBOARD_ROUTE} />,
    );
    expect(screen.getByTestId('execution-trace-deleted')).toHaveTextContent(DELETED_ORDER_MARK);
    expect(screen.queryByTestId('execution-trace-active')).toBeNull();
  });
});
