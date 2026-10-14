import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_EXECUTION_FINISH_CONFIRM_TEXTS,
  ORDER_EXECUTION_FINISH_DIALOG_TESTID,
  OrderExecutionScreen,
} from '@/app/(private)/asignacion/[id]/components';
import {
  EVIDENCE_MISSING_TEXTS,
  STEP_EVIDENCE_TEXTS,
  type UploadEvidenceOptions,
  type UploadEvidenceResult,
} from '@/components/shared/step-evidence';
import type { StartedOrderExecution } from '@/lib/modules/asignaciones';

import { setupUser } from '../../helpers/user-event';

const mocks = vi.hoisted(() => ({
  uploadEvidence: vi.fn(),
  requestEvidenceUploadAction: vi.fn(),
  registerEvidenceAction: vi.fn(),
  removeEvidenceAction: vi.fn(),
  recordStepMoveAction: vi.fn(() => Promise.resolve({ status: 'success' })),
}));

vi.mock('@/components/shared/step-evidence', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/shared/step-evidence')>()),
  uploadEvidence: mocks.uploadEvidence,
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/step-evidence-actions', () => ({
  requestEvidenceUploadAction: mocks.requestEvidenceUploadAction,
  registerEvidenceAction: mocks.registerEvidenceAction,
  removeEvidenceAction: mocks.removeEvidenceAction,
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-execution-actions', () => ({
  finishAssignedOrderAction: vi.fn(),
  recordStepMoveAction: mocks.recordStepMoveAction,
  cancelAssignedOrderAction: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

const PHOTO = { id: 'ev-1', slot: 1, url: 'https://bucket.test/ev-1.jpg' } as const;

function paso(text: string, requiresEvidence?: boolean) {
  return {
    blocks: [{ kind: 'paragraph' as const, spans: [{ text }] }],
    ...(requiresEvidence === undefined ? {} : { requiresEvidence }),
  };
}

function ejecucion(overrides: Partial<StartedOrderExecution> = {}): StartedOrderExecution {
  return {
    orderId: 'order-1',
    numberText: 'PED-0007',
    status: 'EN_CURSO',
    recipeName: 'Desengrasante alcalino',
    orderQuantity: '250',
    steps: [paso('Carga el reactor', true), paso('Mezcla 10 minutos')],
    lines: [],
    tools: [],
    presentationLines: [],
    unitId: null,
    unitLabel: null,
    evidence: [],
    resumeStepPosition: null,
    ...overrides,
  };
}

async function esperarPaso() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
}

function motivo(): string {
  return screen.getByTestId('step-reader-blocked-reason').textContent ?? '';
}

function archivo(): File {
  return new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
}

describe('ejecucion — el bloque de evidencia', () => {
  it('R13: el paso que exige evidencia pinta «Evidencia», 0/3, el texto de obligatoria y «Añadir foto»', () => {
    render(<OrderExecutionScreen execution={ejecucion()} />);

    const bloque = screen.getByRole('region', { name: STEP_EVIDENCE_TEXTS.heading });
    expect(within(bloque).getByTestId('step-evidence-count')).toHaveTextContent('0/3');
    expect(within(bloque).getByText(STEP_EVIDENCE_TEXTS.required)).toBeVisible();
    expect(within(bloque).getByRole('button', { name: /Añadir foto/ })).toBeVisible();
  });

  it('R13: el paso que no exige evidencia no pinta el bloque', async () => {
    render(
      <OrderExecutionScreen
        execution={ejecucion({ evidence: [{ stepPosition: 1, photos: [PHOTO] }] })}
      />,
    );
    const user = setupUser();

    await esperarPaso();
    await user.click(screen.getByTestId('step-reader-next'));

    expect(screen.getByText('Mezcla 10 minutos')).toBeVisible();
    expect(screen.queryByTestId('step-evidence')).toBeNull();
  });

  it('R14: al retomar, el paso muestra las fotos que ya tiene', () => {
    render(
      <OrderExecutionScreen
        execution={ejecucion({
          evidence: [
            {
              stepPosition: 1,
              photos: [{ id: 'ev-2', slot: 2, url: 'https://bucket.test/ev-2.jpg' }, PHOTO],
            },
          ],
        })}
      />,
    );

    expect(screen.getByTestId('step-evidence-count')).toHaveTextContent('2/3');
    expect(screen.getByRole('button', { name: 'Foto 1 del paso 1' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Foto 2 del paso 1' })).toBeVisible();
    const imagenes = screen.getByTestId('step-evidence-grid').querySelectorAll('img');
    expect([...imagenes].map((img) => img.getAttribute('src'))).toEqual([
      PHOTO.url,
      'https://bucket.test/ev-2.jpg',
    ]);
    expect(screen.getByRole('button', { name: /Añadir otra foto/ })).toBeVisible();
  });

  it('R15: sin fotos, «Siguiente» queda deshabilitado con su motivo', async () => {
    render(<OrderExecutionScreen execution={ejecucion()} />);

    await esperarPaso();

    expect(screen.getByTestId('step-reader-next')).toBeDisabled();
    expect(motivo()).toBe(STEP_EVIDENCE_TEXTS.missingReason);
  });

  it('R15: en el ultimo paso sin fotos, el boton de terminar queda deshabilitado con su motivo', async () => {
    render(<OrderExecutionScreen execution={ejecucion({ steps: [paso('Unico', true)] })} />);

    await esperarPaso();

    expect(screen.getByTestId('step-reader-finish')).toBeDisabled();
    expect(motivo()).toBe(STEP_EVIDENCE_TEXTS.missingReason);
  });

  it('R16: mientras sube, la casilla da el porcentaje y «Siguiente» se bloquea; al registrarse cuenta', async () => {
    let terminar: (result: UploadEvidenceResult) => void = () => undefined;
    let progreso: ((percent: number) => void) | undefined;
    mocks.uploadEvidence.mockImplementation(
      (_file: File, _target: unknown, options: UploadEvidenceOptions) => {
        progreso = options.onProgress;
        return new Promise<UploadEvidenceResult>((resolve) => {
          terminar = resolve;
        });
      },
    );
    render(<OrderExecutionScreen execution={ejecucion()} />);
    const user = setupUser();
    await esperarPaso();

    await user.upload(screen.getByTestId('step-evidence-input'), archivo());
    act(() => progreso?.(40));

    expect(screen.getByText(STEP_EVIDENCE_TEXTS.uploading(40))).toBeVisible();
    expect(screen.getByTestId('step-reader-next')).toBeDisabled();
    expect(motivo()).toBe(STEP_EVIDENCE_TEXTS.uploadingReason);
    expect(mocks.uploadEvidence).toHaveBeenCalledWith(
      expect.any(File),
      { orderId: 'order-1', phase: 'manufacturing', stepPosition: 1 },
      expect.objectContaining({
        requestUpload: mocks.requestEvidenceUploadAction,
        register: mocks.registerEvidenceAction,
      }),
    );

    await act(async () => {
      terminar({ status: 'success', photos: [PHOTO] });
    });

    expect(screen.getByTestId('step-evidence-count')).toHaveTextContent('1/3');
    expect(screen.getByTestId('step-reader-next')).toBeEnabled();
  });

  it('R17: si la subida falla, la casilla queda en error con «Quitar», que la descarta', async () => {
    mocks.uploadEvidence.mockResolvedValue({
      status: 'error',
      stage: 'file',
      message: 'No se pudo subir: pesa más de 4.4 MB. Elige otra foto.',
    });
    render(<OrderExecutionScreen execution={ejecucion()} />);
    const user = setupUser();

    await user.upload(screen.getByTestId('step-evidence-input'), archivo());

    const error = await screen.findByText('No se pudo subir: pesa más de 4.4 MB. Elige otra foto.');
    expect(screen.getByTestId('step-evidence-count')).toHaveTextContent('0/3');
    await user.click(within(error.closest('li')!).getByRole('button', { name: 'Quitar' }));
    expect(screen.queryByText('No se pudo subir: pesa más de 4.4 MB. Elige otra foto.')).toBeNull();
    expect(mocks.removeEvidenceAction).not.toHaveBeenCalled();
  });

  it('R19: «Cambiar» sube con la foto que sustituye y deja la nueva en su sitio', async () => {
    const nueva = { id: 'ev-9', slot: 1, url: 'https://bucket.test/ev-9.jpg' };
    mocks.uploadEvidence.mockResolvedValue({ status: 'success', photos: [nueva] });
    render(
      <OrderExecutionScreen
        execution={ejecucion({ evidence: [{ stepPosition: 1, photos: [PHOTO] }] })}
      />,
    );
    const user = setupUser();

    await user.click(screen.getByRole('button', { name: 'Cambiar la foto 1 del paso 1' }));
    await user.upload(screen.getByTestId('step-evidence-input'), archivo());

    expect(mocks.uploadEvidence).toHaveBeenCalledWith(
      expect.any(File),
      { orderId: 'order-1', phase: 'manufacturing', stepPosition: 1, replacesEvidenceId: 'ev-1' },
      expect.anything(),
    );
    expect(await screen.findByRole('button', { name: 'Foto 1 del paso 1' })).toBeVisible();
    expect(screen.getByTestId('step-evidence-grid').querySelector('img')).toHaveAttribute(
      'src',
      nueva.url,
    );
  });

  it('R19/R15: «Quitar» una foto contada la retira en el servidor y el paso vuelve a bloquearse', async () => {
    mocks.removeEvidenceAction.mockResolvedValue({ status: 'success', data: { photos: [] } });
    render(
      <OrderExecutionScreen
        execution={ejecucion({ evidence: [{ stepPosition: 1, photos: [PHOTO] }] })}
      />,
    );
    const user = setupUser();
    await esperarPaso();
    expect(screen.getByTestId('step-reader-next')).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Quitar la foto 1 del paso 1' }));

    expect(mocks.removeEvidenceAction).toHaveBeenCalledWith({
      orderId: 'order-1',
      phase: 'manufacturing',
      evidenceId: 'ev-1',
    });
    expect(await screen.findByText(STEP_EVIDENCE_TEXTS.missingReason)).toBeInTheDocument();
    expect(screen.getByTestId('step-evidence-count')).toHaveTextContent('0/3');
    expect(screen.getByTestId('step-reader-next')).toBeDisabled();
  });
});

describe('ejecucion — terminar con evidencia', () => {
  const SIN_FOTOS_ATRAS = ejecucion({
    steps: [paso('Carga el reactor', true), paso('Pesa la resina', true), paso('Envasa')],
    evidence: [{ stepPosition: 2, photos: [PHOTO] }],
    resumeStepPosition: 3,
  });

  it('R22: con un paso sin fotos, «Finalizar» abre «Falta evidencia» y no la confirmacion', async () => {
    render(<OrderExecutionScreen execution={SIN_FOTOS_ATRAS} />);
    const user = setupUser();
    await esperarPaso();

    await user.click(screen.getByTestId('step-reader-finish'));

    const dialogo = await screen.findByRole('alertdialog', { name: EVIDENCE_MISSING_TEXTS.title });
    expect(within(dialogo).getAllByRole('button', { name: /^Paso \d+$/ })).toHaveLength(1);
    expect(within(dialogo).getByRole('button', { name: 'Paso 1' })).toBeVisible();
    expect(screen.queryByTestId(ORDER_EXECUTION_FINISH_DIALOG_TESTID)).toBeNull();
  });

  it('R22: el boton «Paso n» lleva a ese paso y anota la vuelta', async () => {
    render(<OrderExecutionScreen execution={SIN_FOTOS_ATRAS} />);
    const user = setupUser();
    await esperarPaso();
    await user.click(screen.getByTestId('step-reader-finish'));

    await user.click(await screen.findByRole('button', { name: 'Paso 1' }));

    expect(await screen.findByText('Carga el reactor')).toBeVisible();
    expect(screen.getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 3');
    expect(screen.getByRole('region', { name: STEP_EVIDENCE_TEXTS.heading })).toBeVisible();
    expect(mocks.recordStepMoveAction).toHaveBeenCalledWith({
      orderId: 'order-1',
      direction: 'go_back',
      stepPosition: 1,
    });
  });

  it('R23: sin pasos pendientes y con evidencia en la lista, la confirmacion avisa de que las fotos quedan fijas', async () => {
    render(
      <OrderExecutionScreen
        execution={ejecucion({
          steps: [paso('Unico', true)],
          evidence: [{ stepPosition: 1, photos: [PHOTO] }],
        })}
      />,
    );
    const user = setupUser();
    await esperarPaso();

    await user.click(screen.getByTestId('step-reader-finish'));

    const dialogo = await screen.findByTestId(ORDER_EXECUTION_FINISH_DIALOG_TESTID);
    expect(within(dialogo).getByText(STEP_EVIDENCE_TEXTS.finishWarning)).toBeVisible();
    expect(STEP_EVIDENCE_TEXTS.finishWarning).toBe(
      'Al terminar, las fotos de evidencia quedan fijas. No se puede deshacer.',
    );
    expect(screen.queryByRole('alertdialog', { name: EVIDENCE_MISSING_TEXTS.title })).toBeNull();
  });

  it('R23: sin ningun paso con evidencia, la confirmacion conserva su texto de siempre', async () => {
    render(<OrderExecutionScreen execution={ejecucion({ steps: [paso('Unico')] })} />);
    const user = setupUser();
    await esperarPaso();

    await user.click(screen.getByTestId('step-reader-finish'));

    const dialogo = await screen.findByTestId(ORDER_EXECUTION_FINISH_DIALOG_TESTID);
    expect(within(dialogo).getByText(ORDER_EXECUTION_FINISH_CONFIRM_TEXTS.description)).toBeVisible();
    expect(within(dialogo).queryByText(STEP_EVIDENCE_TEXTS.finishWarning)).toBeNull();
  });
});
