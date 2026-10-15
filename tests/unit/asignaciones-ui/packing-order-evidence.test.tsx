import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PACKING_FINISH_DIALOG_TEXTS,
  PACKING_ORDER_FINISH_DIALOG_TESTID,
  PackingOrderScreen,
} from '@/app/(private)/asignacion/empaque/[id]/components';
import {
  EVIDENCE_MISSING_TEXTS,
  STEP_EVIDENCE_TEXTS,
  type UploadEvidenceOptions,
  type UploadEvidenceResult,
} from '@/components/shared/step-evidence';
import type { PackingOrderDetail } from '@/lib/modules/asignaciones';

import { setupUser } from '../../helpers/user-event';

const mocks = vi.hoisted(() => ({
  uploadEvidence: vi.fn(),
  requestEvidenceUploadAction: vi.fn(),
  registerEvidenceAction: vi.fn(),
  removeEvidenceAction: vi.fn(),
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

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-packing-actions', () => ({
  startPackingAction: vi.fn(),
  finishPackingAction: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const PHOTO = { id: 'ev-1', slot: 1, url: 'https://bucket.test/ev-1.jpg' } as const;

function paso(text: string, requiresEvidence?: boolean) {
  return {
    blocks: [{ kind: 'paragraph' as const, spans: [{ text }] }],
    ...(requiresEvidence === undefined ? {} : { requiresEvidence }),
  };
}

function pedido(overrides: Partial<PackingOrderDetail> = {}): PackingOrderDetail {
  return {
    id: 'order-1',
    numberText: '2026-0000030',
    recipeName: 'Desengrasante alcalino',
    quantity: '12.5',
    presentationLines: [],
    unitId: null,
    unitLabel: null,
    status: 'EN_EMPAQUE',
    packedByName: 'Empacador de Prueba',
    packedById: ACTOR_ID,
    packingSteps: [paso('Etiqueta los envases', true), paso('Sella las cajas')],
    packingEvidence: [],
    finish: null,
    ...overrides,
  };
}

function pintar(order: PackingOrderDetail) {
  render(<PackingOrderScreen order={order} actorId={ACTOR_ID} backHref="/asignacion" />);
}

async function esperarPaso() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
}

function motivo(): string {
  return screen.getByTestId('step-reader-blocked-reason').textContent ?? '';
}

describe('empaque — el bloque de evidencia', () => {
  it('R13: el paso de envasado que exige evidencia pinta el bloque con 0/3 y «Añadir foto»', () => {
    pintar(pedido());

    const bloque = screen.getByRole('region', { name: STEP_EVIDENCE_TEXTS.heading });
    expect(within(bloque).getByTestId('step-evidence-count')).toHaveTextContent('0/3');
    expect(within(bloque).getByText(STEP_EVIDENCE_TEXTS.required)).toBeVisible();
    expect(within(bloque).getByRole('button', { name: /Añadir foto/ })).toBeVisible();
  });

  it('R13: el paso que no exige evidencia no pinta el bloque', async () => {
    pintar(pedido({ packingEvidence: [{ stepPosition: 1, photos: [PHOTO] }] }));
    const user = setupUser();

    await esperarPaso();
    await user.click(screen.getByTestId('step-reader-next'));

    expect(screen.getByText('Sella las cajas')).toBeVisible();
    expect(screen.queryByTestId('step-evidence')).toBeNull();
  });

  it('R14: al abrir el empaque en curso, el paso muestra las fotos que ya tiene', () => {
    pintar(pedido({ packingEvidence: [{ stepPosition: 1, photos: [PHOTO] }] }));

    expect(screen.getByTestId('step-evidence-count')).toHaveTextContent('1/3');
    expect(screen.getByRole('button', { name: 'Foto 1 del paso 1' })).toBeVisible();
    expect(screen.getByTestId('step-evidence-grid').querySelector('img')).toHaveAttribute(
      'src',
      PHOTO.url,
    );
  });

  it('R15: sin fotos, «Siguiente» queda deshabilitado con su motivo', async () => {
    pintar(pedido());

    await esperarPaso();

    expect(screen.getByTestId('step-reader-next')).toBeDisabled();
    expect(motivo()).toBe(STEP_EVIDENCE_TEXTS.missingReason);
  });

  it('R16: mientras sube, «Siguiente» se bloquea con su motivo; la subida va a la fase de envasado', async () => {
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
    pintar(pedido());
    const user = setupUser();
    await esperarPaso();

    await user.upload(
      screen.getByTestId('step-evidence-input'),
      new File(['x'], 'foto.png', { type: 'image/png' }),
    );
    act(() => progreso?.(75));

    expect(screen.getByText(STEP_EVIDENCE_TEXTS.uploading(75))).toBeVisible();
    expect(screen.getByTestId('step-reader-next')).toBeDisabled();
    expect(motivo()).toBe(STEP_EVIDENCE_TEXTS.uploadingReason);
    expect(mocks.uploadEvidence).toHaveBeenCalledWith(
      expect.any(File),
      { orderId: 'order-1', phase: 'packing', stepPosition: 1 },
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

  it('R19: «Quitar» una foto contada la retira con la fase de envasado', async () => {
    mocks.removeEvidenceAction.mockResolvedValue({ status: 'success', data: { photos: [] } });
    pintar(pedido({ packingEvidence: [{ stepPosition: 1, photos: [PHOTO] }] }));
    const user = setupUser();

    await user.click(screen.getByRole('button', { name: 'Quitar la foto 1 del paso 1' }));

    expect(mocks.removeEvidenceAction).toHaveBeenCalledWith({
      orderId: 'order-1',
      phase: 'packing',
      evidenceId: 'ev-1',
    });
    expect(await screen.findByRole('button', { name: /Añadir foto/ })).toBeVisible();
    expect(screen.getByTestId('step-evidence-count')).toHaveTextContent('0/3');
  });
});

describe('empaque — terminar con evidencia', () => {
  /**
   * El Empaque siempre abre en el paso 1, así que para llegar al último con un paso anterior sin
   * fotos se quita la única foto del paso 1 y se avanza antes de que el servidor responda.
   */
  async function ultimoPasoConElPrimeroSinFotos() {
    let responder: (value: unknown) => void = () => undefined;
    mocks.removeEvidenceAction.mockReturnValue(
      new Promise((resolve) => {
        responder = resolve;
      }),
    );
    pintar(
      pedido({
        packingSteps: [paso('Etiqueta los envases', true), paso('Sella las cajas')],
        packingEvidence: [{ stepPosition: 1, photos: [PHOTO] }],
      }),
    );
    const user = setupUser();
    await esperarPaso();
    await user.click(screen.getByRole('button', { name: 'Quitar la foto 1 del paso 1' }));
    await user.click(screen.getByTestId('step-reader-next'));
    await act(async () => {
      responder({ status: 'success', data: { photos: [] } });
    });
    await esperarPaso();
    return user;
  }

  it('R22: con un paso sin fotos, «Terminar» abre «Falta evidencia» y no la confirmacion', async () => {
    const user = await ultimoPasoConElPrimeroSinFotos();

    await user.click(screen.getByTestId('step-reader-finish'));

    const dialogo = await screen.findByRole('alertdialog', { name: EVIDENCE_MISSING_TEXTS.title });
    expect(within(dialogo).getAllByRole('button', { name: /^Paso \d+$/ })).toHaveLength(1);
    expect(within(dialogo).getByRole('button', { name: 'Paso 1' })).toBeVisible();
    expect(screen.queryByTestId(PACKING_ORDER_FINISH_DIALOG_TESTID)).toBeNull();
  });

  it('R22: el boton «Paso n» lleva a ese paso, con su bloque de evidencia', async () => {
    const user = await ultimoPasoConElPrimeroSinFotos();
    await user.click(screen.getByTestId('step-reader-finish'));

    await user.click(await screen.findByRole('button', { name: 'Paso 1' }));

    expect(await screen.findByText('Etiqueta los envases')).toBeVisible();
    expect(screen.getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 2');
    expect(screen.getByTestId('step-evidence-count')).toHaveTextContent('0/3');
  });
});

describe('empaque — confirmacion', () => {
  it('R23, R33: con evidencia en la lista y todas cubiertas, la descripción del conteo acaba en el aviso de que las fotos quedan fijas', async () => {
    pintar(
      pedido({
        packingSteps: [paso('Unico', true)],
        packingEvidence: [{ stepPosition: 1, photos: [PHOTO] }],
      }),
    );
    const user = setupUser();
    await esperarPaso();

    await user.click(screen.getByTestId('step-reader-finish'));

    const dialogo = await screen.findByTestId(PACKING_ORDER_FINISH_DIALOG_TESTID);
    expect(dialogo).toHaveAccessibleDescription(
      `${PACKING_FINISH_DIALOG_TEXTS.descriptionLead} ${STEP_EVIDENCE_TEXTS.finishWarning}`,
    );
    expect(dialogo.textContent).not.toContain(PACKING_FINISH_DIALOG_TEXTS.descriptionEnd);
    expect(screen.queryByRole('alertdialog', { name: EVIDENCE_MISSING_TEXTS.title })).toBeNull();
  });

  it('R23, R33: sin pasos con evidencia, la descripción del conteo es la del tablero tal cual', async () => {
    pintar(pedido({ packingSteps: [paso('Unico')] }));
    const user = setupUser();
    await esperarPaso();

    await user.click(screen.getByTestId('step-reader-finish'));

    const dialogo = await screen.findByTestId(PACKING_ORDER_FINISH_DIALOG_TESTID);
    expect(dialogo).toHaveAccessibleDescription(
      `${PACKING_FINISH_DIALOG_TEXTS.descriptionLead} ${PACKING_FINISH_DIALOG_TEXTS.descriptionEnd}`,
    );
  });
});
