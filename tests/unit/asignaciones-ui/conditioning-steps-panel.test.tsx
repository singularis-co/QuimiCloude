import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CONDITIONING_BATCH_DATA_LOCKED_TESTID,
  CONDITIONING_BATCH_DATA_SECTION_TESTID,
  CONDITIONING_FINISH_BUTTON_TESTID,
  CONDITIONING_STEP_RESPONSIBLE_TESTID,
  CONDITIONING_STEPS_BACK_TESTID,
  CONDITIONING_STEPS_DONE_TESTID,
  CONDITIONING_STEPS_ERROR_TESTID,
  CONDITIONING_STEPS_PANEL_TESTID,
  CONDITIONING_STEPS_RESUMED_TESTID,
  ConditioningOrderScreen,
} from '@/app/(private)/asignacion/acondicionamiento/[id]/components';
import type { ConditioningOrderDetail, ConditioningStepsView } from '@/lib/modules/asignaciones';
import type { RecordConditioningStepActionResult } from '@/lib/modules/asignaciones/adapters/driving/order-conditioning-actions';

const { recordMock } = vi.hoisted(() => ({
  recordMock: vi.fn<(input: unknown) => Promise<RecordConditioningStepActionResult>>(),
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-conditioning-actions', () => ({
  startConditioningAction: vi.fn(),
  finishConditioningAction: vi.fn(),
  saveConditioningBatchDataAction: vi.fn(),
  recordConditioningStepAction: recordMock,
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/step-evidence-actions', () => ({
  registerEvidenceAction: vi.fn(),
  removeEvidenceAction: vi.fn(),
  requestEvidenceUploadAction: vi.fn(),
}));

const ACTOR_ID = 'user-me';
const ORDER_ID = 'order-a';

const REVISAR = 'Revisa que cada garrafa esté sellada y sin fugas.';
const ETIQUETAR = 'Etiqueta cada garrafa con el lote y la fecha de vencimiento.';
const CAJAS = 'Arma las cajas de despacho: 4 garrafas por caja.';

function paso(text: string, checklist: readonly string[] = []) {
  return {
    blocks: [
      { kind: 'paragraph' as const, spans: [{ text }] },
      ...(checklist.length === 0
        ? []
        : [{ kind: 'checklist' as const, items: checklist.map((item) => ({ spans: [{ text: item }] })) }]),
    ],
  };
}

const STEPS: ConditioningStepsView['steps'] = [
  paso(REVISAR, ['Tapas selladas']),
  { ...paso(ETIQUETAR), requiresEvidence: true },
  { ...paso(CAJAS), requiresAssignment: true },
];

function pasos(overrides: Partial<ConditioningStepsView> = {}): ConditioningStepsView {
  return {
    steps: STEPS,
    completedCount: 0,
    responsibles: [],
    candidates: [
      { userId: ACTOR_ID, displayName: 'Santiago Vargas', isSelf: true },
      { userId: 'user-lg', displayName: 'Laura Gómez', isSelf: false },
    ],
    evidence: [],
    ...overrides,
  };
}

function pedido(conditioningSteps: ConditioningStepsView): ConditioningOrderDetail {
  return {
    id: ORDER_ID,
    numberText: '2026-0000006',
    recipeName: 'Limpiador multiusos limón',
    quantity: '72',
    unitId: null,
    unitLabel: null,
    presentationLines: [],
    status: 'EN_ACONDICIONAMIENTO',
    conditionedByName: 'Santiago Vargas',
    conditionedById: ACTOR_ID,
    team: [{ userId: 'user-lg', displayName: 'Laura Gómez', origin: { kind: 'direct' } }],
    batchData: { lines: [], missingCount: 0, form: { kind: 'empty' } },
    conditioningSteps,
  };
}

function pintar(conditioning: ConditioningStepsView = pasos()) {
  return render(<ConditioningOrderScreen order={pedido(conditioning)} canFinish />);
}

async function esperar(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function marcarTodo(): void {
  for (const casilla of screen.queryAllByRole('checkbox')) {
    if (casilla.getAttribute('aria-checked') !== 'true') fireEvent.click(casilla);
  }
}

function siguiente(): HTMLElement {
  return screen.getByTestId('step-reader-next');
}

function motivo(): HTMLElement {
  return screen.getByTestId('step-reader-blocked-reason');
}

function exito(completedCount: number, total = STEPS.length): RecordConditioningStepActionResult {
  return { status: 'success', data: { completedCount, allCompleted: completedCount >= total } };
}

let toastExito: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  toastExito = vi.spyOn(toast, 'success');
  recordMock.mockImplementation(async (input) => {
    const { stepPosition } = input as { stepPosition: number };
    return exito(stepPosition);
  });
});

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.useRealTimers();
  vi.restoreAllMocks();
  recordMock.mockReset();
});

describe('el paso a paso del acondicionador', () => {
  it('R18: un paso por pantalla, «Paso 1 de 3» y la barra de progreso, junto a «Equipo» y «Datos de lote»', () => {
    pintar();

    const panel = screen.getByTestId(CONDITIONING_STEPS_PANEL_TESTID);
    expect(within(panel).getByRole('heading', { name: 'Pasos de acondicionamiento' })).toBeInTheDocument();
    expect(within(panel).getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 3');
    expect(within(panel).getAllByRole('listitem').filter((item) => item.dataset.state !== undefined)).toHaveLength(3);
    expect(screen.getByText(REVISAR)).toBeInTheDocument();
    expect(screen.queryByText(ETIQUETAR)).toBeNull();
    expect(screen.queryByText(CAJAS)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Equipo' })).toBeInTheDocument();
    expect(screen.getByTestId(CONDITIONING_BATCH_DATA_SECTION_TESTID)).toBeInTheDocument();
  });

  it('R20: con la lista sin marcar no avanza y lo dice; marcada, espera 5 s antes de dejar avanzar', async () => {
    pintar();

    expect(siguiente()).toBeDisabled();
    expect(motivo()).toHaveTextContent('Marca los 1 elementos pendientes para continuar.');

    marcarTodo();
    expect(siguiente()).toBeDisabled();
    expect(screen.getByTestId('step-reader-wait-reason')).toHaveTextContent(
      'Espera a que termine la cuenta regresiva para continuar.',
    );

    await esperar(4000);
    expect(siguiente()).toBeDisabled();
    await esperar(1000);
    expect(siguiente()).toBeEnabled();
  });

  it('R20: al llegar a un paso nuevo vuelven a contar los 5 s', async () => {
    pintar();
    marcarTodo();
    await esperar(5000);
    fireEvent.click(siguiente());
    await esperar(0);

    expect(screen.getByTestId('step-reader-position')).toHaveTextContent('Paso 2 de 3');
    expect(screen.getByTestId('step-reader-wait-reason')).toBeInTheDocument();
  });

  it('R21: un paso con «Requiere evidencia» ofrece las fotos y sin ninguna no avanza: «Sube al menos una foto para avanzar.»', async () => {
    pintar(pasos({ completedCount: 1 }));
    await esperar(5000);

    expect(screen.getByTestId('step-evidence')).toBeInTheDocument();
    expect(screen.getByTestId('step-evidence-add')).toBeInTheDocument();
    expect(siguiente()).toBeDisabled();
    expect(motivo()).toHaveTextContent('Sube al menos una foto para avanzar.');
  });

  it('R21: con una foto ya guardada en ese paso, avanza', async () => {
    pintar(
      pasos({
        completedCount: 1,
        evidence: [{ stepPosition: 2, photos: [{ id: 'foto-1', slot: 1, url: 'https://cdn.example/f.jpg' }] }],
      }),
    );
    await esperar(5000);

    expect(siguiente()).toBeEnabled();
  });

  it('R22: un paso con «Asignación requerida» pide elegir y sin nadie no avanza: «Elige al menos un responsable para avanzar.»', async () => {
    pintar(pasos({ completedCount: 2 }));
    await esperar(5000);

    expect(screen.getByRole('group', { name: 'Responsables del paso' })).toBeInTheDocument();
    const completar = screen.getByTestId('step-reader-finish');
    expect(completar).toBeDisabled();
    expect(motivo()).toHaveTextContent('Elige al menos un responsable para avanzar.');

    fireEvent.click(screen.getAllByTestId(CONDITIONING_STEP_RESPONSIBLE_TESTID)[1]!);
    expect(completar).toBeEnabled();
  });

  it('R22: al dejar atrás un paso con responsables manda los elegidos; uno sin la marca, ninguno', async () => {
    pintar(
      pasos({
        steps: [{ ...paso(CAJAS), requiresAssignment: true }, paso(REVISAR), paso(ETIQUETAR)],
      }),
    );
    await esperar(5000);
    const [yo, laura] = screen.getAllByTestId(CONDITIONING_STEP_RESPONSIBLE_TESTID);
    fireEvent.click(laura!);
    fireEvent.click(yo!);
    fireEvent.click(siguiente());
    await esperar(5000);
    fireEvent.click(siguiente());
    await esperar(0);

    expect(recordMock.mock.calls.map(([input]) => input)).toEqual([
      { orderId: ORDER_ID, stepPosition: 1, responsibleUserIds: ['user-lg', ACTOR_ID] },
      { orderId: ORDER_ID, stepPosition: 2, responsibleUserIds: [] },
    ]);
  });

  it('R22: volver atrás no escribe nada en el servidor', async () => {
    pintar(pasos({ completedCount: 1 }));
    await esperar(0);

    fireEvent.click(screen.getByTestId('step-reader-previous'));
    await esperar(0);

    expect(screen.getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 3');
    expect(recordMock).not.toHaveBeenCalled();
  });

  it('R22: si el servidor rechaza el paso, la pantalla vuelve a él y pinta el error', async () => {
    recordMock.mockResolvedValueOnce({
      status: 'error',
      code: 'conditioning_step_out_of_order',
      message: 'La pantalla quedó desactualizada. Recárgala para seguir.',
    });
    pintar();
    marcarTodo();
    await esperar(5000);
    fireEvent.click(siguiente());
    await esperar(0);

    expect(screen.getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 3');
    expect(screen.getByTestId(CONDITIONING_STEPS_ERROR_TESTID)).toHaveTextContent(
      'La pantalla quedó desactualizada. Recárgala para seguir.',
    );
  });
});

describe('«Completar pasos» y «Terminar»', () => {
  async function hastaElUltimo(): Promise<void> {
    pintar(pasos({ completedCount: 2, responsibles: [{ stepPosition: 3, userIds: [ACTOR_ID] }] }));
    await esperar(5000);
  }

  it('R24: en el último paso el botón dice «Completar pasos» y no se ofrece «Terminar»', async () => {
    await hastaElUltimo();

    expect(screen.getByTestId('step-reader-finish')).toHaveTextContent('Completar pasos');
    expect(screen.queryByTestId(CONDITIONING_FINISH_BUTTON_TESTID)).toBeNull();
  });

  it('R24 R25: al completar registra el último paso, pinta «Pasos completos» y ofrece «Terminar» con «Datos de lote» abierta', async () => {
    await hastaElUltimo();

    fireEvent.click(screen.getByTestId('step-reader-finish'));
    await esperar(0);

    expect(recordMock).toHaveBeenCalledTimes(1);
    expect(recordMock).toHaveBeenCalledWith({ orderId: ORDER_ID, stepPosition: 3, responsibleUserIds: [ACTOR_ID] });
    const hecho = screen.getByTestId(CONDITIONING_STEPS_DONE_TESTID);
    expect(within(hecho).getByRole('heading', { name: 'Pasos completos' })).toBeInTheDocument();
    expect(within(hecho).getByText('Guarda los datos de lote y pulsa «Terminar».')).toBeInTheDocument();
    expect(within(hecho).getByRole('button', { name: 'Volver a los pasos' })).toBeInTheDocument();
    expect(screen.queryByTestId('step-reader')).toBeNull();
    expect(screen.getByTestId(CONDITIONING_FINISH_BUTTON_TESTID)).toBeEnabled();
    expect(screen.getByTestId(CONDITIONING_FINISH_BUTTON_TESTID)).toHaveTextContent('Terminar');
    expect(screen.queryByTestId(CONDITIONING_BATCH_DATA_LOCKED_TESTID)).toBeNull();
    expect(screen.getByRole('button', { name: 'Guardar datos de lote' })).toBeEnabled();
    expect(toastExito).toHaveBeenCalledWith('Pasos completos.');
  });

  it('R24: un segundo clic mientras se envía no manda el paso dos veces', async () => {
    let resolver: (value: RecordConditioningStepActionResult) => void = () => {};
    recordMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolver = resolve;
        }),
    );
    await hastaElUltimo();

    const completar = screen.getByTestId('step-reader-finish');
    fireEvent.click(completar);
    await esperar(0);
    expect(completar).toBeDisabled();
    fireEvent.click(completar);
    await act(async () => {
      resolver(exito(3));
    });

    expect(recordMock).toHaveBeenCalledTimes(1);
  });

  it('R24: si el servidor rechaza «Completar pasos», sigue en el paso con el error y sin «Terminar»', async () => {
    recordMock.mockResolvedValueOnce({
      status: 'error',
      code: 'conditioning_responsibles_required',
      message: 'Elige al menos un responsable para avanzar.',
    });
    await hastaElUltimo();

    fireEvent.click(screen.getByTestId('step-reader-finish'));
    await esperar(0);

    expect(screen.getByTestId('step-reader-position')).toHaveTextContent('Paso 3 de 3');
    expect(screen.getByTestId(CONDITIONING_STEPS_ERROR_TESTID)).toBeInTheDocument();
    expect(screen.queryByTestId(CONDITIONING_STEPS_DONE_TESTID)).toBeNull();
    expect(screen.queryByTestId(CONDITIONING_FINISH_BUTTON_TESTID)).toBeNull();
  });

  it('R24: «Volver a los pasos» lleva al último paso y quita «Terminar» del pie', async () => {
    pintar(pasos({ completedCount: 3 }));

    fireEvent.click(screen.getByTestId(CONDITIONING_STEPS_BACK_TESTID));

    expect(screen.getByTestId('step-reader-position')).toHaveTextContent('Paso 3 de 3');
    expect(screen.queryByTestId(CONDITIONING_FINISH_BUTTON_TESTID)).toBeNull();
    expect(screen.queryByTestId(CONDITIONING_STEPS_DONE_TESTID)).toBeNull();
  });

  it('R24: los botones del paso a paso y «Volver a los pasos» son objetivos táctiles ≥ 44 px', async () => {
    await hastaElUltimo();
    expect(screen.getByTestId('step-reader-finish').className).toContain('min-h-11');
    expect(screen.getByTestId('step-reader-previous').className).toContain('min-h-11');

    cleanup();
    pintar(pasos({ completedCount: 3 }));
    expect(screen.getByTestId(CONDITIONING_STEPS_BACK_TESTID).className).toContain('min-h-11');
  });
});

describe('retomar al volver a abrir', () => {
  it('R26: con pasos completados y alguno pendiente entra en el primero sin completar y avisa «Retomaste donde ibas»', () => {
    pintar(pasos({ completedCount: 1 }));

    expect(screen.getByTestId('step-reader-position')).toHaveTextContent('Paso 2 de 3');
    const aviso = screen.getByTestId(CONDITIONING_STEPS_RESUMED_TESTID);
    expect(aviso).toHaveTextContent('Retomaste donde ibas');
    expect(aviso).toHaveTextContent(
      'Paso 2 de 3. Los responsables y las fotos de los pasos anteriores siguen guardados.',
    );
  });

  it('R26: sin ningún paso completado entra en el primero y no avisa', () => {
    pintar();

    expect(screen.getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 3');
    expect(screen.queryByTestId(CONDITIONING_STEPS_RESUMED_TESTID)).toBeNull();
  });

  it('R26: con todos completados entra en «Pasos completos», sin aviso y con «Terminar»', () => {
    pintar(pasos({ completedCount: 3 }));

    expect(screen.getByTestId(CONDITIONING_STEPS_DONE_TESTID)).toBeInTheDocument();
    expect(screen.queryByTestId(CONDITIONING_STEPS_RESUMED_TESTID)).toBeNull();
    expect(screen.getByTestId(CONDITIONING_FINISH_BUTTON_TESTID)).toBeInTheDocument();
  });

  it('R26: conserva los responsables y las fotos guardados; las marcas de la lista no', async () => {
    pintar(
      pasos({
        completedCount: 3,
        responsibles: [{ stepPosition: 3, userIds: ['user-lg'] }],
        evidence: [{ stepPosition: 2, photos: [{ id: 'foto-1', slot: 1, url: 'https://cdn.example/f.jpg' }] }],
      }),
    );
    fireEvent.click(screen.getByTestId(CONDITIONING_STEPS_BACK_TESTID));

    const [yo, laura] = screen.getAllByTestId(CONDITIONING_STEP_RESPONSIBLE_TESTID);
    expect(yo).toHaveAttribute('aria-pressed', 'false');
    expect(laura).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('step-reader-previous'));
    expect(screen.getByTestId('step-evidence-count')).toHaveTextContent('1/3');

    fireEvent.click(screen.getByTestId('step-reader-previous'));
    expect(screen.getByRole('checkbox', { name: 'Tapas selladas' })).toHaveAttribute('aria-checked', 'false');
  });

  it('R26: la revalidación tras la acción no mueve el paso en curso, no repite el aviso ni reenvía nada', async () => {
    const { rerender } = pintar(pasos({ completedCount: 1, evidence: [] }));
    await esperar(0);
    fireEvent.click(screen.getByTestId('step-reader-previous'));
    expect(screen.queryByTestId(CONDITIONING_STEPS_RESUMED_TESTID)).toBeNull();
    marcarTodo();

    rerender(<ConditioningOrderScreen order={pedido(pasos({ completedCount: 2 }))} canFinish />);
    await esperar(0);

    expect(screen.getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 3');
    expect(screen.getByRole('checkbox', { name: 'Tapas selladas' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByTestId(CONDITIONING_STEPS_RESUMED_TESTID)).toBeNull();
    expect(recordMock).not.toHaveBeenCalled();
  });
});
