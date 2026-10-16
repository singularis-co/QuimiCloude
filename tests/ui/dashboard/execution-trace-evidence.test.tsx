// Las fotos de evidencia dentro del detalle del recorrido. Se monta el detalle con la lectura de
// fotos ya resuelta (como la entrega la pagina); el router es el unico borde simulado.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ExecutionTraceDetail,
  OTHER_STEPS_EVIDENCE_TEXTS,
  PACKING_EVIDENCE_TEXTS,
} from '@/app/(private)/dashboard/recorrido/[id]/components';
import { STEP_EVIDENCE_TEXTS } from '@/components/shared/step-evidence';
import type {
  ConditioningAction,
  ExecutionAction,
  ExecutionTraceDetail as ExecutionTraceDetailData,
  ExecutionTraceDetailStep,
} from '@/lib/modules/asignaciones';
import type { ExecutionEvidenceResult } from '@/lib/modules/asignaciones/adapters/driving/execution-trace-actions';
import { errorMessage } from '@/lib/modules/errores';
import {
  ORDER_EVIDENCE,
  ORDER_EVIDENCE_EMPTY,
  ORDER_EVIDENCE_MANUFACTURING_ONLY,
  ORDER_EVIDENCE_UNSIGNED,
  orderEvidenceGroup,
} from '@/tests/fixtures/order-evidence';

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

const ORDER_ID = '0b1c2d3e-4f50-4a61-8b72-c3d4e5f60718';
const BACK_HREF = '/dashboard?page=1&pageSize=10';
const MIN = 60 * 1000;
const START = new Date('2026-10-07T08:00:00.000Z').getTime();

function step(
  id: string,
  action: Exclude<ExecutionAction, ConditioningAction>,
  stepPosition: number | null,
  minute: number,
): ExecutionTraceDetailStep {
  return {
    id,
    orderId: ORDER_ID,
    userId: 'u1',
    userDisplayName: 'Ana Ruiz',
    action,
    stepPosition,
    reason: null,
    occurredAt: new Date(START + minute * MIN),
    gapToNextMs: 5 * MIN,
    isGoBack: action === 'go_back',
  };
}

// Paso 1, 2, vuelta a 1, otra vez 2 y 3, termina y empaca. El paso 4 de la fixture no tiene anotacion.
const TRACE: ExecutionTraceDetailData = {
  orderId: ORDER_ID,
  numberText: '2026-0000042',
  status: 'TERMINADO',
  deleted: false,
  active: false,
  firstAt: new Date(START),
  lastAt: new Date(START + 35 * MIN),
  durations: {
    production: { kind: 'closed', ms: 25 * MIN },
    packing: { kind: 'closed', ms: 5 * MIN },
    conditioning: null,
  },
  goBackCount: 1,
  steps: [
    step('e1', 'start', 1, 0),
    step('e2', 'advance', 2, 5),
    step('e3', 'go_back', 1, 10),
    step('e4', 'advance', 2, 15),
    step('e5', 'advance', 3, 20),
    step('e6', 'finish', 3, 25),
    step('e7', 'pack_start', null, 30),
    step('e8', 'pack_finish', null, 35),
  ],
};

const success = (data: typeof ORDER_EVIDENCE): ExecutionEvidenceResult => ({ status: 'success', data });
const READ_FAILED: ExecutionEvidenceResult = {
  status: 'error',
  code: 'unexpected',
  message: errorMessage('unexpected'),
  reference: 'REF-DEL-FIXTURE',
};

function montar(evidence?: ExecutionEvidenceResult) {
  return render(<ExecutionTraceDetail trace={TRACE} evidence={evidence} backHref={BACK_HREF} />);
}

function anotacion(index: number): HTMLElement {
  return screen.getAllByTestId('execution-trace-step')[index];
}

function grupo(phase: string, stepPosition: number): HTMLElement {
  return screen.getByRole('group', { name: STEP_EVIDENCE_TEXTS.groupLabel(phase, stepPosition) });
}

/** Lo que el recorrido pinta sin contar las fotos: anotaciones, su numero, estado, duracion y vueltas. */
function recorridoSinFotos(): string[] {
  return [
    screen.getByTestId('execution-trace-step-count').textContent ?? '',
    ...screen.getAllByTestId('execution-trace-stat').map((stat) => stat.textContent ?? ''),
    ...screen.getAllByTestId('execution-trace-step').map((li) =>
      [
        li.getAttribute('data-action'),
        li.getAttribute('data-go-back'),
        within(li).getByTestId('execution-trace-step-action').textContent,
        within(li).getByTestId('execution-trace-step-instant').textContent,
        within(li).queryByTestId('execution-trace-step-position')?.textContent ?? '',
        within(li).queryByTestId('execution-trace-step-gap')?.textContent ?? '',
      ].join('|'),
    ),
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('R12 - R13 - R14 - donde se pintan las fotos', () => {
  it('R12 - las fotos de un paso repetido salen solo bajo su ultima anotacion', () => {
    montar(success(ORDER_EVIDENCE));
    const paso1 = within(anotacion(2)).getByRole('group', {
      name: STEP_EVIDENCE_TEXTS.groupLabel('fabricación', 1),
    });
    expect(within(paso1).getAllByTestId(/^step-evidence-tile-/)).toHaveLength(2);
    expect(within(paso1).getByTestId('step-evidence-count')).toHaveTextContent('2/3');
    expect(within(anotacion(3)).getAllByTestId(/^step-evidence-tile-/)).toHaveLength(3);

    for (const index of [0, 1, 4, 5, 6, 7]) {
      expect(within(anotacion(index)).queryByTestId('step-evidence')).toBeNull();
    }
  });

  it('R12 - la evidencia bajo una anotacion es de solo consulta: sin añadir, cambiar ni quitar', () => {
    montar(success(ORDER_EVIDENCE));
    const paso2 = within(anotacion(3)).getByTestId('step-evidence');
    expect(paso2).toHaveAttribute('data-consult');
    expect(within(paso2).queryByRole('button', { name: /Añadir|Cambiar|Quitar/ })).toBeNull();
    expect(within(paso2).queryByText(STEP_EVIDENCE_TEXTS.fixed)).toBeNull();
  });

  it('R13 - el paso sin anotacion sale en «Otros pasos con fotos» al final de Anotaciones, rotulado «Paso N»', () => {
    montar(success(ORDER_EVIDENCE));
    const timeline = screen.getByTestId('execution-trace-timeline');
    const otros = within(timeline).getByRole('region', { name: OTHER_STEPS_EVIDENCE_TEXTS.title });
    expect(otros).toHaveTextContent(OTHER_STEPS_EVIDENCE_TEXTS.caption);
    const paso4 = within(otros).getByRole('group', { name: STEP_EVIDENCE_TEXTS.groupLabel('fabricación', 4) });
    expect(paso4).toHaveTextContent('Paso 4');
    expect(within(otros).getAllByTestId('evidence-step-row')).toHaveLength(1);
    // Va despues de la lista de anotaciones, no dentro de ella.
    const lista = within(timeline).getByRole('list', { name: 'Anotaciones' });
    expect(lista.compareDocumentPosition(otros) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(lista).not.toContainElement(otros);
  });

  it('R13 - si todos los pasos con fotos tienen anotacion, no hay bloque «Otros pasos con fotos»', () => {
    montar(success({ ...ORDER_EVIDENCE, manufacturing: ORDER_EVIDENCE.manufacturing.slice(0, 2) }));
    expect(screen.queryByText(OTHER_STEPS_EVIDENCE_TEXTS.title)).toBeNull();
    expect(screen.queryByTestId('trace-other-steps-evidence')).toBeNull();
  });

  it('R14 - tarjeta «Envasado» despues de Anotaciones, con el total y una fila «Paso N»', () => {
    const packing = [orderEvidenceGroup('p', 1, 2), orderEvidenceGroup('p', 2, 1)];
    montar(success({ ...ORDER_EVIDENCE, packing }));
    const tarjeta = screen.getByRole('region', { name: PACKING_EVIDENCE_TEXTS.title });
    expect(within(tarjeta).getByRole('heading', { level: 2, name: PACKING_EVIDENCE_TEXTS.title })).toBeVisible();
    expect(within(tarjeta).getByTestId('trace-packing-evidence-count')).toHaveTextContent('3');
    expect(within(tarjeta).getByTestId('trace-packing-evidence-count')).toHaveAccessibleName('3 fotos de envasado');
    const filas = within(tarjeta).getAllByTestId('evidence-step-row');
    expect(filas.map((fila) => fila.getAttribute('data-step'))).toEqual(['1', '2']);
    expect(grupo('envasado', 1)).toHaveTextContent('Paso 1');
    expect(grupo('envasado', 2)).toHaveTextContent('Paso 2');

    const timeline = screen.getByTestId('execution-trace-timeline');
    expect(timeline.compareDocumentPosition(tarjeta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(timeline).not.toContainElement(tarjeta);
  });

  it('R14 - una sola foto de envasado se nombra en singular', () => {
    montar(success({ ...ORDER_EVIDENCE, packing: [orderEvidenceGroup('p', 1, 1)] }));
    expect(screen.getByTestId('trace-packing-evidence-count')).toHaveAccessibleName('1 foto de envasado');
  });

  it('R14 - ninguna foto de envasado sale bajo una anotacion, ni en las de empaque', () => {
    montar(success(ORDER_EVIDENCE));
    for (const li of screen.getAllByTestId('execution-trace-step')) {
      expect(
        within(li).queryByRole('group', { name: /Evidencia de envasado/ }),
        `anotacion ${li.getAttribute('data-action')}`,
      ).toBeNull();
    }
    expect(within(anotacion(6)).queryByTestId('step-evidence')).toBeNull();
    expect(within(anotacion(7)).queryByTestId('step-evidence')).toBeNull();
  });

  it('R14 - sin fotos de envasado no hay tarjeta «Envasado»', () => {
    montar(success(ORDER_EVIDENCE_MANUFACTURING_ONLY));
    expect(screen.queryByRole('region', { name: PACKING_EVIDENCE_TEXTS.title })).toBeNull();
    expect(screen.queryByTestId('trace-packing-evidence')).toBeNull();
  });
});

describe('R15 - la lectura de fotos no cambia el recorrido', () => {
  it('R15 - con la lectura en error, anotaciones y stats iguales y un unico aviso al final de Anotaciones', () => {
    montar();
    const sinLectura = recorridoSinFotos();
    cleanup();

    montar(READ_FAILED);
    expect(recorridoSinFotos()).toEqual(sinLectura);
    expect(screen.getAllByText(STEP_EVIDENCE_TEXTS.readError)).toHaveLength(1);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    const aviso = screen.getByTestId('trace-evidence-read-error');
    expect(screen.getByTestId('execution-trace-timeline')).toContainElement(aviso);
    expect(within(aviso).getByRole('button', { name: STEP_EVIDENCE_TEXTS.retry })).toBeVisible();
    expect(screen.queryByTestId('step-evidence')).toBeNull();
    expect(screen.queryByTestId('trace-packing-evidence')).toBeNull();
    expect(screen.queryByTestId('trace-other-steps-evidence')).toBeNull();
  });

  it('R15 - con fotos, anotaciones y stats son las mismas que sin ellas', () => {
    montar();
    const sinLectura = recorridoSinFotos();
    cleanup();

    montar(success(ORDER_EVIDENCE));
    expect(recorridoSinFotos()).toEqual(sinLectura);
  });
});

describe('R25 - sin fotos no queda hueco', () => {
  it('R25 - un pedido sin fotos no pinta bloque, tarjeta, encabezado ni aviso', () => {
    montar();
    const sinLectura = screen.getByTestId('execution-trace-detail').innerHTML;
    cleanup();

    montar(success(ORDER_EVIDENCE_EMPTY));
    expect(screen.queryByTestId('step-evidence')).toBeNull();
    expect(screen.queryByTestId('trace-step-evidence')).toBeNull();
    expect(screen.queryByText(OTHER_STEPS_EVIDENCE_TEXTS.title)).toBeNull();
    expect(screen.queryByText(PACKING_EVIDENCE_TEXTS.title)).toBeNull();
    expect(screen.queryByText(STEP_EVIDENCE_TEXTS.readError)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('execution-trace-detail').innerHTML).toBe(sinLectura);
  });

  it('R25 - una anotacion sin fotos se pinta como hoy aunque otras las tengan', () => {
    montar();
    const sinLectura = anotacion(0).innerHTML;
    cleanup();

    montar(success(ORDER_EVIDENCE));
    expect(anotacion(0).innerHTML).toBe(sinLectura);
  });
});

describe('R23 - R24 - reintentar y recargar', () => {
  it('R23 - un grupo sin firma bajo su anotacion muestra el aviso y «Reintentar» llama a router.refresh', () => {
    montar(success(ORDER_EVIDENCE_UNSIGNED));
    const paso1 = within(anotacion(2)).getByRole('group', {
      name: STEP_EVIDENCE_TEXTS.groupLabel('fabricación', 1),
    });
    expect(paso1).toHaveTextContent(STEP_EVIDENCE_TEXTS.readError);
    expect(within(paso1).getByTestId('step-evidence-count')).toHaveTextContent('2/3');
    fireEvent.click(within(paso1).getByRole('button', { name: STEP_EVIDENCE_TEXTS.retry }));
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it('R23 — el grupo ilegible bajo su anotacion se rotula «Evidencia», no «Paso N», con su contador y «Reintentar»', () => {
    montar(success(ORDER_EVIDENCE_UNSIGNED));
    const paso1 = within(anotacion(2)).getByRole('group', {
      name: STEP_EVIDENCE_TEXTS.groupLabel('fabricación', 1),
    });
    expect(within(paso1).getByText(STEP_EVIDENCE_TEXTS.heading)).toBeVisible();
    expect(paso1).not.toHaveTextContent(STEP_EVIDENCE_TEXTS.stepHeading(1));
    expect(within(anotacion(2)).queryByTestId('evidence-step-row')).toBeNull();
    expect(within(paso1).getByTestId('step-evidence-count')).toHaveTextContent('2/3');
    expect(within(paso1).getByRole('alert')).toHaveTextContent(STEP_EVIDENCE_TEXTS.readError);
    fireEvent.click(within(paso1).getByRole('button', { name: STEP_EVIDENCE_TEXTS.retry }));
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it('R23 - «Reintentar» en «Otros pasos con fotos» y en «Envasado» llama a router.refresh', () => {
    montar(success(ORDER_EVIDENCE_UNSIGNED));
    fireEvent.click(within(grupo('fabricación', 4)).getByRole('button', { name: STEP_EVIDENCE_TEXTS.retry }));
    fireEvent.click(within(grupo('envasado', 1)).getByRole('button', { name: STEP_EVIDENCE_TEXTS.retry }));
    expect(routerMock.refresh).toHaveBeenCalledTimes(2);
  });

  it('R23 - «Reintentar» del aviso unico llama a router.refresh', () => {
    montar(READ_FAILED);
    fireEvent.click(screen.getByRole('button', { name: STEP_EVIDENCE_TEXTS.retry }));
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it('R24 - una miniatura vencida bajo una anotacion muestra «Vista vencida» y «Recargar» llama a router.refresh', () => {
    montar(success(ORDER_EVIDENCE));
    const paso1 = within(anotacion(2)).getByTestId('step-evidence');
    fireEvent.error(within(paso1).getByTestId('step-evidence-tile-1').querySelector('img')!);
    expect(within(paso1).getByText(STEP_EVIDENCE_TEXTS.expired)).toBeVisible();
    fireEvent.click(within(paso1).getByRole('button', { name: STEP_EVIDENCE_TEXTS.reloadPhoto(1, 1) }));
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it('R24 - «Recargar» en «Otros pasos con fotos» y en «Envasado» llama a router.refresh', () => {
    montar(success(ORDER_EVIDENCE));
    const casos = [
      { contenedor: grupo('fabricación', 4), paso: 4 },
      { contenedor: grupo('envasado', 1), paso: 1 },
    ];
    for (const { contenedor, paso } of casos) {
      fireEvent.error(within(contenedor).getByTestId('step-evidence-tile-1').querySelector('img')!);
      fireEvent.click(within(contenedor).getByRole('button', { name: STEP_EVIDENCE_TEXTS.reloadPhoto(1, paso) }));
    }
    expect(routerMock.refresh).toHaveBeenCalledTimes(2);
  });
});
