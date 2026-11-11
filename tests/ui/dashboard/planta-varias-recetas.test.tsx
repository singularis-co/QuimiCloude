// El Dashboard y el Recorrido de un pedido de varias recetas: una fila por pedido con «+N más», su
// avance y las presentaciones agrupadas por receta; y un Recorrido con resumen y una seccion por
// receta con anotaciones. El router es el unico borde simulado.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ExecutionTraceTable,
  createDefaultExecutionTraceListParams,
} from '@/app/(private)/dashboard/components';
import {
  EXECUTION_TRACE_RECIPE_SECTION_TESTID,
  ExecutionTraceDetail,
} from '@/app/(private)/dashboard/recorrido/[id]/components';
import { ORDER_PROGRESS_BAR_TESTID, ORDER_PROGRESS_TESTID } from '@/components/shared/order-progress';
import type {
  ConditioningAction,
  ExecutionAction,
  ExecutionTraceDetail as ExecutionTraceDetailData,
  ExecutionTraceDetailStep,
  ExecutionTraceRecipe,
  ExecutionTraceRow,
} from '@/lib/modules/asignaciones';
import type { ExecutionEvidenceResult } from '@/lib/modules/asignaciones/adapters/driving/execution-trace-actions';
import { DASHBOARD_ROUTE } from '@/lib/shared/routes';
import { ORDER_STATUS_TONES } from '@/lib/shared/ui/order-status';

import { oneRecipeRowFields } from '../../fixtures/execution-trace-recipes';
import { orderEvidenceGroup } from '../../fixtures/order-evidence';
import { NARROW_VIEWPORT, WIDE_VIEWPORT, resetViewport, setViewportWidth } from '../../helpers/viewport';

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

vi.mock('@/lib/modules/asignaciones/adapters/driving/execution-trace-actions', () => ({
  listExecutionTracesAction: vi.fn(),
  getExecutionTraceAction: vi.fn(),
  getExecutionEvidenceAction: vi.fn(),
}));

const MIN = 60 * 1000;
const START = new Date('2026-11-02T08:00:00.000Z').getTime();
const ORDER_ID = 'a1000000-0000-4000-8000-000000001042';
const PERSONA = { userId: 'u-laura', displayName: 'Laura Gómez' };

// Dashboard
// ---------------------------------------------------------------------------------------------

const PARCIAL: ExecutionTraceRow = {
  orderId: ORDER_ID,
  numberText: '2026-0001042',
  status: 'PARCIAL',
  deleted: false,
  active: true,
  people: [PERSONA],
  firstAt: new Date(START),
  lastAt: new Date(START + 302 * MIN),
  totalDuration: { kind: 'open', ms: 302 * MIN },
  goBackCount: 1,
  formulaName: 'Hipoclorito 5 %',
  formulaImageUrl: null,
  moreRecipes: 1,
  progress: { finished: 1, total: 2 },
  recipes: [
    { recipeName: 'Hipoclorito 5 %', presentations: [{ label: 'bidón 20 L', quantity: 10 }] },
    {
      recipeName: 'Desengrasante alcalino',
      presentations: [
        { label: 'garrafa 5 L', quantity: 10 },
        { label: 'galón 3,78 L', quantity: 2 },
      ],
    },
  ],
};

const UNA_RECETA: ExecutionTraceRow = {
  ...PARCIAL,
  orderId: 'a1000000-0000-4000-8000-000000001046',
  numberText: '2026-0001046',
  status: 'POR_EMPACAR',
  formulaName: 'Limpiador multiusos limón',
  ...oneRecipeRowFields([{ label: 'galón 3,78 L', quantity: 12 }], 'POR_EMPACAR', 'Limpiador multiusos limón'),
};

function montarTabla() {
  render(
    <ExecutionTraceTable
      rows={[PARCIAL, UNA_RECETA]}
      personOptions={[PERSONA]}
      params={createDefaultExecutionTraceListParams()}
      totalPages={1}
    />,
  );
}

function filaDe(numberText: string): HTMLElement {
  const numero = screen
    .getAllByTestId('execution-trace-number')
    .find((el) => el.textContent === numberText && el.closest('tr') !== null);
  const fila = numero?.closest('tr');
  if (!(fila instanceof HTMLElement)) throw new Error(`sin fila para ${numberText}`);
  return fila;
}

describe('Dashboard de un pedido de varias recetas', () => {
  beforeEach(() => setViewportWidth(WIDE_VIEWPORT));
  afterEach(() => {
    cleanup();
    resetViewport();
  });

  it('R21: una fila por pedido, con «Parcial» en tono progress, la primera receta, «+1 más» y el avance «1 de 2» con su barra', () => {
    montarTabla();

    const filas = screen.getAllByTestId('execution-trace-number').filter((el) => el.closest('tr') !== null);
    expect(filas.map((el) => el.textContent)).toEqual(['2026-0001042', '2026-0001046']);
    const fila = filaDe('2026-0001042');
    const estado = within(fila).getByTestId('execution-trace-status');
    expect(estado).toHaveTextContent('Parcial');
    expect(estado).toHaveAttribute('data-tone', ORDER_STATUS_TONES.PARCIAL);
    expect(ORDER_STATUS_TONES.PARCIAL).toBe('progress');
    expect(within(fila).getByTestId('execution-trace-formula')).toHaveTextContent('Hipoclorito 5 %');
    expect(within(fila).getByTestId('execution-trace-more-recipes')).toHaveTextContent(/^\+1 más$/);
    const avance = within(fila).getByTestId(ORDER_PROGRESS_TESTID);
    expect(avance).toHaveTextContent(/^1 de 2$/);
    expect(avance).toHaveAttribute('data-finished', '1');
    expect(avance).toHaveAttribute('data-total', '2');
    expect(within(avance).getByTestId(ORDER_PROGRESS_BAR_TESTID)).toHaveStyle({ width: '50%' });
  });

  it('R21: la cabecera de la tabla tiene la columna «Avance» después de «Fórmula»', () => {
    montarTabla();
    const cabeceras = screen.getAllByRole('columnheader').map((th) => th.textContent ?? '');
    const formula = cabeceras.findIndex((texto) => texto.includes('Fórmula'));
    const avance = cabeceras.findIndex((texto) => texto.includes('Avance'));
    expect(formula).toBeGreaterThanOrEqual(0);
    expect(avance).toBe(formula + 1);
  });

  it('R21: un pedido de una receta no lleva «+N más» y su avance es «0 de 1»', () => {
    montarTabla();
    const fila = filaDe('2026-0001046');
    expect(within(fila).getByTestId('execution-trace-formula')).toHaveTextContent('Limpiador multiusos limón');
    expect(within(fila).queryByTestId('execution-trace-more-recipes')).toBeNull();
    expect(within(fila).getByTestId(ORDER_PROGRESS_TESTID)).toHaveTextContent(/^0 de 1$/);
  });

  it('R22: las presentaciones salen agrupadas por receta en orden de alta, unidas con « · » y sin sumar', () => {
    montarTabla();
    expect(within(filaDe('2026-0001042')).getByTestId('execution-trace-presentations')).toHaveTextContent(
      /^10 bidón 20 L · 10 garrafa 5 L, 2 galón 3,78 L$/,
    );
    expect(within(filaDe('2026-0001046')).getByTestId('execution-trace-presentations')).toHaveTextContent(
      /^12 galón 3,78 L$/,
    );
  });

  it('R21: en el teléfono la tarjeta lleva el avance con su barra', () => {
    setViewportWidth(NARROW_VIEWPORT);
    montarTabla();
    const tarjeta = screen.getByTestId(`data-table-card-${ORDER_ID}`);
    const avance = within(tarjeta).getByTestId(ORDER_PROGRESS_TESTID);
    expect(avance).toHaveTextContent(/^1 de 2$/);
    expect(within(avance).getByTestId(ORDER_PROGRESS_BAR_TESTID)).toBeInTheDocument();
  });
});

// Recorrido
// ---------------------------------------------------------------------------------------------

type ProductionAction = Exclude<ExecutionAction, ConditioningAction>;

function anotacion(
  id: string,
  action: ProductionAction,
  minute: number,
  stepPosition: number | null,
  reason: string | null = null,
): ExecutionTraceDetailStep {
  return {
    id,
    orderId: ORDER_ID,
    userId: PERSONA.userId,
    userDisplayName: PERSONA.displayName,
    action,
    stepPosition,
    reason,
    occurredAt: new Date(START + minute * MIN),
    gapToNextMs: null,
    isGoBack: action === 'go_back',
  };
}

const LINEA_A = 'line-hipoclorito';
const LINEA_B = 'line-desengrasante';

const HIPOCLORITO: ExecutionTraceRecipe = {
  lineId: LINEA_A,
  recipeName: 'Hipoclorito 5 %',
  status: 'TERMINADO',
  quantity: '200.000',
  unitLabel: 'L',
  presentations: [{ label: 'bidón 20 L', quantity: 10 }],
  steps: [
    anotacion('a1', 'start', 0, 1),
    anotacion('a2', 'finish', 150, 2),
    anotacion('a3', 'pack_start', 160, null),
    anotacion('a4', 'pack_finish', 208, null),
  ],
  durations: {
    production: { kind: 'closed', ms: 150 * MIN },
    packing: { kind: 'closed', ms: 48 * MIN },
    conditioning: null,
  },
  totalDuration: { kind: 'closed', ms: 198 * MIN },
  goBackCount: 0,
};

const DESENGRASANTE: ExecutionTraceRecipe = {
  lineId: LINEA_B,
  recipeName: 'Desengrasante alcalino',
  status: 'CANCELADO',
  quantity: '50',
  unitLabel: 'L',
  presentations: [{ label: 'garrafa 5 L', quantity: 10 }],
  steps: [
    anotacion('b1', 'start', 190, 1),
    anotacion('b2', 'advance', 232, 2),
    anotacion('b3', 'go_back', 240, 1),
    anotacion('b4', 'cancel', 284, 1, 'Falta materia prima'),
  ],
  durations: { production: { kind: 'closed', ms: 94 * MIN }, packing: null, conditioning: null },
  totalDuration: { kind: 'closed', ms: 94 * MIN },
  goBackCount: 1,
};

// La tercera receta del pedido no tiene anotaciones: no tiene seccion, pero cuenta en el avance.
const RECORRIDO: ExecutionTraceDetailData = {
  orderId: ORDER_ID,
  numberText: '2026-0001042',
  status: 'PARCIAL',
  deleted: false,
  active: true,
  progress: { finished: 1, total: 2 },
  totalDuration: { kind: 'closed', ms: 292 * MIN },
  firstAt: new Date(START),
  lastAt: new Date(START + 284 * MIN),
  recipes: [HIPOCLORITO, DESENGRASANTE],
};

const FOTOS: ExecutionEvidenceResult = {
  status: 'success',
  data: {
    recipes: [
      {
        lineId: LINEA_B,
        evidence: { manufacturing: [orderEvidenceGroup('m', 2, 1)], packing: [], conditioning: [] },
      },
      {
        lineId: LINEA_A,
        evidence: {
          manufacturing: [orderEvidenceGroup('m', 1, 2)],
          packing: [orderEvidenceGroup('p', 1, 3)],
          conditioning: [],
        },
      },
    ],
  },
};

function montarRecorrido(trace: ExecutionTraceDetailData = RECORRIDO, evidence: ExecutionEvidenceResult = FOTOS) {
  return render(<ExecutionTraceDetail trace={trace} evidence={evidence} backHref={DASHBOARD_ROUTE} />);
}

function secciones(): HTMLElement[] {
  return screen.getAllByTestId(EXECUTION_TRACE_RECIPE_SECTION_TESTID);
}

function seccion(lineId: string): HTMLElement {
  const encontrada = secciones().find((el) => el.getAttribute('data-line-id') === lineId);
  if (encontrada === undefined) throw new Error(`sin seccion para ${lineId}`);
  return encontrada;
}

function idsDeAnotaciones(contenedor: HTMLElement): string[] {
  return within(contenedor)
    .getAllByTestId('execution-trace-step')
    .map((li) => within(li).getByTestId('execution-trace-step-instant').getAttribute('dateTime') ?? '');
}

function instantes(recipe: ExecutionTraceRecipe): string[] {
  return recipe.steps.map((step) => step.occurredAt.toISOString());
}

describe('Recorrido de un pedido de varias recetas', () => {
  afterEach(cleanup);

  it('R25: el resumen lleva el estado, el avance «F de T terminadas» y la duración total', () => {
    montarRecorrido();
    const resumen = screen.getByTestId('execution-trace-summary');
    expect(Array.from(resumen.querySelectorAll('dt')).map((dt) => dt.textContent)).toEqual([
      'Estado',
      'Avance',
      'Duración',
    ]);
    expect(within(resumen).getByTestId('execution-trace-status')).toHaveTextContent('Parcial');
    expect(within(resumen).getByTestId(ORDER_PROGRESS_TESTID)).toHaveTextContent('1 de 2 terminadas');
    expect(within(resumen).getByTestId('execution-trace-total-duration')).toHaveTextContent('4 h 52 min');
  });

  it('R25: una sección por receta, en orden de alta, con su nombre como h2, su estado, cantidad, reparto, duración y vueltas atrás', () => {
    montarRecorrido();
    expect(secciones().map((el) => el.getAttribute('data-line-id'))).toEqual([LINEA_A, LINEA_B]);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Hipoclorito 5 %',
      'Desengrasante alcalino',
    ]);
    const a = seccion(LINEA_A);
    expect(a).toHaveAccessibleName('Hipoclorito 5 %');
    expect(within(a).getByTestId('execution-trace-recipe-status')).toHaveTextContent('Terminado');
    const resumenA = within(a).getByTestId('execution-trace-recipe-summary');
    expect(resumenA).toHaveTextContent('200 L · 10 bidón 20 L · 3 h 18 min · vueltas atrás 0');
    expect(within(seccion(LINEA_B)).getByTestId('execution-trace-recipe-summary')).toHaveTextContent(
      '50 L · 10 garrafa 5 L · 1 h 34 min · vueltas atrás 1',
    );
  });

  it('R25: una receta sin anotaciones no tiene sección pero cuenta en el avance', () => {
    montarRecorrido({ ...RECORRIDO, progress: { finished: 1, total: 3 } });
    expect(secciones()).toHaveLength(2);
    expect(screen.getByTestId('execution-trace-summary')).toHaveTextContent('1 de 3 terminadas');
    expect(within(screen.getByTestId('execution-trace-summary')).getByTestId(ORDER_PROGRESS_TESTID)).toHaveAttribute(
      'data-total',
      '3',
    );
  });

  it('R25: cada sección lleva su propia línea de tiempo, con un encabezado «Anotaciones» que la nombra', () => {
    montarRecorrido();
    for (const [lineId, recipe] of [
      [LINEA_A, HIPOCLORITO],
      [LINEA_B, DESENGRASANTE],
    ] as const) {
      const lista = within(seccion(lineId)).getByRole('list', { name: 'Anotaciones' });
      expect(within(lista).getAllByTestId('execution-trace-step')).toHaveLength(recipe.steps.length);
    }
    const ids = screen.getAllByRole('heading', { level: 3, name: 'Anotaciones' }).map((h) => h.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('R26: ninguna sección muestra anotaciones, fotos ni presentaciones de otra receta', () => {
    montarRecorrido();
    const a = seccion(LINEA_A);
    const b = seccion(LINEA_B);
    expect(idsDeAnotaciones(a)).toEqual(instantes(HIPOCLORITO));
    expect(idsDeAnotaciones(b)).toEqual(instantes(DESENGRASANTE));
    expect(within(a).getByTestId('execution-trace-recipe-presentations')).toHaveTextContent(/^10 bidón 20 L$/);
    expect(within(b).getByTestId('execution-trace-recipe-presentations')).toHaveTextContent(/^10 garrafa 5 L$/);

    // Fabricacion: el paso 1 de A tiene 2 fotos y el paso 2 de B tiene 1; nada cruza de seccion.
    const fotosA = within(a).getAllByTestId('trace-step-evidence');
    const fotosB = within(b).getAllByTestId('trace-step-evidence');
    expect(fotosA).toHaveLength(1);
    expect(fotosB).toHaveLength(1);
    expect(within(a).getAllByTestId('execution-trace-step')[0]).toContainElement(fotosA[0]!);
    expect(within(b).getAllByTestId('execution-trace-step')[1]).toContainElement(fotosB[0]!);

    // El envasado solo lo tiene A.
    expect(within(a).getByTestId('trace-packing-evidence')).toBeInTheDocument();
    expect(within(b).queryByTestId('trace-packing-evidence')).toBeNull();
  });

  it('R26: una receta sin fotos en la lectura no hereda las de otra', () => {
    const soloB: ExecutionEvidenceResult = {
      status: 'success',
      data: {
        recipes: [{ lineId: LINEA_B, evidence: { manufacturing: [orderEvidenceGroup('m', 2, 1)], packing: [], conditioning: [] } }],
      },
    };
    montarRecorrido(RECORRIDO, soloB);
    expect(within(seccion(LINEA_A)).queryByTestId('trace-step-evidence')).toBeNull();
    expect(within(seccion(LINEA_A)).queryByTestId('trace-packing-evidence')).toBeNull();
    expect(within(seccion(LINEA_B)).getAllByTestId('trace-step-evidence')).toHaveLength(1);
  });

  it('R28: la receta cancelada se muestra «Cancelado» con su línea de tiempo hasta la cancelación', () => {
    montarRecorrido();
    const b = seccion(LINEA_B);
    expect(b).toHaveAttribute('data-status', 'CANCELADO');
    const estado = within(b).getByTestId('execution-trace-recipe-status');
    expect(estado).toHaveTextContent('Cancelado');
    expect(estado).toHaveAttribute('data-tone', ORDER_STATUS_TONES.CANCELADO);
    const pasos = within(b).getAllByTestId('execution-trace-step');
    expect(pasos.map((li) => li.getAttribute('data-action'))).toEqual(['start', 'advance', 'go_back', 'cancel']);
    expect(within(pasos[3]!).getByTestId('execution-trace-step-reason')).toHaveTextContent(
      'Motivo · Falta materia prima',
    );
    // La otra receta sigue con su estado.
    expect(within(seccion(LINEA_A)).getByTestId('execution-trace-recipe-status')).toHaveTextContent('Terminado');
  });
});
