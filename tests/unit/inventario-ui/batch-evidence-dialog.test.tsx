import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BATCH_EVIDENCE_DIALOG_CLASS,
  BATCH_EVIDENCE_DIALOG_TESTID,
  BatchEvidenceButton,
  BatchEvidenceDialog,
} from '@/app/(private)/inventario/producto-terminado/[id]/components';
import type { OrderEvidence } from '@/lib/modules/asignaciones';
import type { OrderEvidenceResult } from '@/lib/modules/asignaciones/adapters/driving/order-evidence-actions';
import {
  FINISHED_ORDER_ID,
  FINISHED_ORDER_LINE_ID,
  FINISHED_ORDER_NUMBER,
} from '../../fixtures/finished-product-detail';
import {
  LINE_EVIDENCE_COUNTS,
  ORDER_EVIDENCE,
  ORDER_EVIDENCE_ERROR_STATES,
  ORDER_EVIDENCE_MANUFACTURING_ONLY,
  ORDER_EVIDENCE_PHOTO_TOTAL,
  ORDER_EVIDENCE_UNSIGNED,
  orderEvidenceGroup,
} from '../../fixtures/order-evidence';
import { setupUser } from '../../helpers/user-event';

const { getEvidenceMock } = vi.hoisted(() => ({
  getEvidenceMock: vi.fn<(orderId: string, lineId: string) => Promise<OrderEvidenceResult>>(),
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-evidence-actions', () => ({
  getLineEvidenceAction: getEvidenceMock,
  countLineEvidenceAction: vi.fn(),
}));

const LOT = 'L-2026-0225';
const RECIPE_NAME = LINE_EVIDENCE_COUNTS[0].recipeName as string;
const OTHER_LINE_ID = 'a1000000-0000-4000-8000-000000000226';
const TODAY_TITLE = `Evidencia · Lote ${LOT} · Pedido ${FINISHED_ORDER_NUMBER}`;
const TODAY_DESCRIPTION = 'Fotos tomadas durante la ejecución del pedido. Solo consulta.';
const RECIPE_DESCRIPTION = 'Fotos tomadas durante la ejecución de esta receta del pedido. Solo consulta.';

/** La receta con las tres fases: acondicionamiento en los pasos 2 (2 fotos) y 3 (1). */
const LINE_EVIDENCE_WITH_CONDITIONING: OrderEvidence = {
  ...ORDER_EVIDENCE,
  conditioning: [orderEvidenceGroup('p', 2, 2), orderEvidenceGroup('p', 3, 1)],
};

/** El conteo que la celda recibe de `countLineEvidence`: la suma de las tres fases. */
function cellPhotoCount(evidence: OrderEvidence): number {
  return [...evidence.manufacturing, ...evidence.packing, ...evidence.conditioning].reduce(
    (sum, group) => sum + group.photoCount,
    0,
  );
}

function OpenDialog({
  photoCount = ORDER_EVIDENCE_PHOTO_TOTAL,
  lineId = FINISHED_ORDER_LINE_ID,
  recipeName = null,
}: {
  readonly photoCount?: number;
  readonly lineId?: string;
  readonly recipeName?: string | null;
}) {
  const [open, setOpen] = useState(true);
  return (
    <BatchEvidenceDialog
      open={open}
      onOpenChange={setOpen}
      lot={LOT}
      orderId={FINISHED_ORDER_ID}
      lineId={lineId}
      recipeName={recipeName}
      orderNumberText={FINISHED_ORDER_NUMBER}
      photoCount={photoCount}
    />
  );
}

function sectionCount(el: HTMLElement, testId: string): number {
  const badge = within(el).queryByTestId(`${testId}-count`);
  return badge === null ? 0 : Number(badge.textContent);
}

function success(evidence = ORDER_EVIDENCE): OrderEvidenceResult {
  return { status: 'success', data: evidence };
}

function dialog(): HTMLElement {
  return screen.getByTestId(BATCH_EVIDENCE_DIALOG_TESTID);
}

async function ready(): Promise<HTMLElement> {
  await waitFor(() => expect(dialog()).toHaveAttribute('data-status', 'ready'));
  return dialog();
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('BatchEvidenceDialog', () => {
  it('R17 — título con lote y pedido, línea de solo consulta y grupos «Fabricación» y «Envasado»', async () => {
    getEvidenceMock.mockResolvedValue(success());
    render(<OpenDialog />);

    const el = await ready();
    expect(getEvidenceMock).toHaveBeenCalledWith(FINISHED_ORDER_ID, FINISHED_ORDER_LINE_ID);
    expect(screen.getByRole('dialog', { name: TODAY_TITLE })).toBeInTheDocument();
    expect(el).toHaveTextContent('Fotos tomadas durante la ejecución del pedido. Solo consulta.');

    const fabricacion = within(el).getByRole('region', { name: /Fabricación/ });
    expect(within(fabricacion).getByRole('heading', { level: 3 })).toHaveTextContent('Fabricación');
    expect(within(fabricacion).getByTestId('batch-evidence-manufacturing-count')).toHaveTextContent('6');
    expect(
      within(fabricacion).getAllByTestId('evidence-step-row').map((row) => row.getAttribute('data-step')),
    ).toEqual(['1', '2', '4']);
    expect(within(fabricacion).getByRole('group', { name: 'Evidencia de fabricación, paso 2' })).toHaveTextContent(
      'Paso 2',
    );

    const envasado = within(el).getByRole('region', { name: /Envasado/ });
    expect(within(envasado).getByTestId('batch-evidence-packing-count')).toHaveTextContent('2');
    expect(within(envasado).getByRole('group', { name: 'Evidencia de envasado, paso 1' })).toHaveTextContent(
      'Paso 1',
    );
  });

  it('R17 — un grupo sin fotos no se pinta', async () => {
    getEvidenceMock.mockResolvedValue(success(ORDER_EVIDENCE_MANUFACTURING_ONLY));
    render(<OpenDialog />);

    const el = await ready();
    expect(within(el).getByRole('region', { name: /Fabricación/ })).toBeInTheDocument();
    expect(within(el).queryByRole('region', { name: /Envasado/ })).toBeNull();
    expect(within(el).queryByText('Envasado')).toBeNull();
  });

  it('R17, R20 — solo consulta: sin añadir, cambiar ni quitar fotos, y con «Cerrar» de 44 px', async () => {
    getEvidenceMock.mockResolvedValue(success());
    render(<OpenDialog />);

    const el = await ready();
    expect(within(el).queryByTestId('step-evidence-add')).toBeNull();
    expect(within(el).queryByTestId('step-evidence-input')).toBeNull();
    expect(within(el).queryByRole('button', { name: /Cambiar|Quitar/ })).toBeNull();
    expect(within(el).getByRole('button', { name: 'Cerrar' }).className).toContain('min-h-11');
  });

  it('R18 — en teléfono el diálogo ocupa la pantalla y desde 768 px vuelve a centrarse', async () => {
    getEvidenceMock.mockResolvedValue(success());
    render(<OpenDialog />);

    const el = await ready();
    for (const clase of ['h-dvh', 'w-full', 'max-w-none', 'top-0', 'left-0', 'rounded-none']) {
      expect(el.className.split(/\s+/), clase).toContain(clase);
    }
    for (const clase of ['md:max-w-3xl', 'md:top-1/2', 'md:h-auto', 'md:rounded-xl']) {
      expect(BATCH_EVIDENCE_DIALOG_CLASS.split(/\s+/), clase).toContain(clase);
    }
    expect(el.className).toContain('overflow-y-auto');
  });

  it('R22 — mientras la lectura está en vuelo, casillas esqueleto y «Cargando fotos…»', async () => {
    getEvidenceMock.mockReturnValue(new Promise(() => {}));
    render(<OpenDialog />);

    const el = dialog();
    expect(el).toHaveAttribute('data-status', 'loading');
    const casillas = within(el).getAllByTestId(/^step-evidence-tile-/);
    expect(casillas).toHaveLength(3);
    for (const casilla of casillas) expect(casilla).toHaveAttribute('data-status', 'loading');
    expect(within(el).getAllByTestId('step-evidence-skeleton')).toHaveLength(3);
    expect(within(el).getByTestId('step-evidence-loading')).toHaveTextContent('Cargando fotos…');
    expect(within(el).queryByRole('region')).toBeNull();
  });

  it('R22 — con menos de 3 fotos, tantas casillas esqueleto como fotos', () => {
    getEvidenceMock.mockReturnValue(new Promise(() => {}));
    render(<OpenDialog photoCount={2} />);

    expect(within(dialog()).getAllByTestId(/^step-evidence-tile-/)).toHaveLength(2);
  });

  it('R23 — la lectura falla: aviso con «Reintentar», que vuelve a leer', async () => {
    getEvidenceMock.mockResolvedValueOnce(ORDER_EVIDENCE_ERROR_STATES.orderNotFound);
    getEvidenceMock.mockResolvedValueOnce(success());
    const user = setupUser();
    render(<OpenDialog />);

    await waitFor(() => expect(dialog()).toHaveAttribute('data-status', 'error'));
    const aviso = within(dialog()).getByTestId('batch-evidence-error');
    expect(aviso).toHaveTextContent('No se pudieron cargar las fotos.');
    expect(within(dialog()).queryByRole('region')).toBeNull();

    await user.click(within(aviso).getByRole('button', { name: 'Reintentar' }));

    const el = await ready();
    expect(getEvidenceMock).toHaveBeenCalledTimes(2);
    expect(within(el).queryByTestId('batch-evidence-error')).toBeNull();
    expect(within(el).getByRole('region', { name: /Fabricación/ })).toBeInTheDocument();
  });

  it('R23 — una action que lanza también acaba en el aviso, no en un diálogo colgado', async () => {
    getEvidenceMock.mockRejectedValue(new Error('red caida'));
    render(<OpenDialog />);

    await waitFor(() => expect(dialog()).toHaveAttribute('data-status', 'error'));
    expect(within(dialog()).getByTestId('batch-evidence-error')).toBeInTheDocument();
  });

  it('R23 — grupos sin firma: cada uno con su aviso, y «Reintentar» vuelve a leer', async () => {
    getEvidenceMock.mockResolvedValue(success(ORDER_EVIDENCE_UNSIGNED));
    const user = setupUser();
    render(<OpenDialog />);

    const el = await ready();
    const reintentar = within(el).getAllByRole('button', { name: 'Reintentar' });
    expect(reintentar).toHaveLength(4);
    expect(within(el).getByTestId('batch-evidence-manufacturing-count')).toHaveTextContent('6');

    await user.click(reintentar[0]);

    await waitFor(() => expect(getEvidenceMock).toHaveBeenCalledTimes(2));
  });

  it('R24 — una miniatura vencida muestra «Vista vencida» y «Recargar» vuelve a leer', async () => {
    getEvidenceMock.mockResolvedValue(success());
    const user = setupUser();
    render(<OpenDialog />);

    const el = await ready();
    const grupo = within(el).getByRole('group', { name: 'Evidencia de fabricación, paso 1' });
    const imagen = within(grupo).getByTestId('step-evidence-tile-1').querySelector('img');
    expect(imagen).not.toBeNull();
    fireEvent.error(imagen as HTMLImageElement);

    expect(within(grupo).getByTestId('step-evidence-tile-1')).toHaveTextContent('Vista vencida');
    await user.click(within(grupo).getByRole('button', { name: 'Recargar la foto 1 del paso 1' }));

    await waitFor(() => expect(getEvidenceMock).toHaveBeenCalledTimes(2));
    await ready();
  });

  it('R19, R24 — cerrar y volver a abrir pide lecturas firmadas nuevas', async () => {
    getEvidenceMock.mockResolvedValue(success());
    const user = setupUser();
    render(
      <BatchEvidenceButton
        lot={LOT}
        orderId={FINISHED_ORDER_ID}
        lineId={FINISHED_ORDER_LINE_ID}
        recipeName={null}
        orderNumberText={FINISHED_ORDER_NUMBER}
        photoCount={ORDER_EVIDENCE_PHOTO_TOTAL}
      />,
    );

    await user.click(screen.getByRole('button', { name: `Ver evidencia del lote ${LOT}: 9 fotos` }));
    await ready();
    await user.click(within(dialog()).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByTestId(BATCH_EVIDENCE_DIALOG_TESTID)).toBeNull());

    await user.click(screen.getByRole('button', { name: `Ver evidencia del lote ${LOT}: 9 fotos` }));
    await ready();
    expect(getEvidenceMock).toHaveBeenCalledTimes(2);
    expect(
      getEvidenceMock.mock.calls.every(
        ([orderId, lineId]) => orderId === FINISHED_ORDER_ID && lineId === FINISHED_ORDER_LINE_ID,
      ),
    ).toBe(true);
  });
});

// 2026-11-11 (QT-316): el diálogo es el de la receta del lote.
describe('BatchEvidenceDialog, por receta', () => {
  it('QT-316 R6 — lee con el pedido y la línea del lote, y vuelve a leer si cambia la línea', async () => {
    getEvidenceMock.mockResolvedValue(success());
    const { rerender } = render(<OpenDialog />);

    await ready();
    expect(getEvidenceMock).toHaveBeenCalledTimes(1);
    expect(getEvidenceMock).toHaveBeenCalledWith(FINISHED_ORDER_ID, FINISHED_ORDER_LINE_ID);

    rerender(<OpenDialog lineId={OTHER_LINE_ID} />);
    await waitFor(() => expect(getEvidenceMock).toHaveBeenCalledWith(FINISHED_ORDER_ID, OTHER_LINE_ID));
  });

  it('QT-316 R7 — con varias recetas, el título nombra la receta y la descripción es la de la receta', async () => {
    getEvidenceMock.mockResolvedValue(success());
    render(<OpenDialog recipeName={RECIPE_NAME} />);

    const el = await ready();
    expect(screen.getByRole('dialog', { name: `${TODAY_TITLE} · ${RECIPE_NAME}` })).toBeInTheDocument();
    expect(el).toHaveTextContent(RECIPE_DESCRIPTION);
    expect(el).not.toHaveTextContent(TODAY_DESCRIPTION);
  });

  it('QT-316 R8, R9 — sin nombre de receta, título y descripción de hoy, y las fotos salen igual', async () => {
    getEvidenceMock.mockResolvedValue(success());
    render(<OpenDialog recipeName={null} />);

    const el = await ready();
    expect(screen.getByRole('dialog', { name: TODAY_TITLE })).toBeInTheDocument();
    expect(el).toHaveTextContent(TODAY_DESCRIPTION);
    expect(el).not.toHaveTextContent(RECIPE_DESCRIPTION);
    expect(within(el).getByTestId('batch-evidence-manufacturing-count')).toHaveTextContent('6');
    expect(within(el).getByTestId('batch-evidence-packing-count')).toHaveTextContent('2');
  });

  it('QT-316 R10 — esqueleto con el conteo de la receta, y el error con «Reintentar»', async () => {
    getEvidenceMock.mockReturnValueOnce(new Promise(() => {}));
    render(<OpenDialog photoCount={1} recipeName={RECIPE_NAME} />);
    expect(dialog()).toHaveAttribute('data-status', 'loading');
    expect(within(dialog()).getAllByTestId(/^step-evidence-tile-/)).toHaveLength(1);
    cleanup();

    getEvidenceMock.mockResolvedValueOnce(ORDER_EVIDENCE_ERROR_STATES.orderNotFound);
    getEvidenceMock.mockResolvedValueOnce(success());
    const user = setupUser();
    render(<OpenDialog recipeName={RECIPE_NAME} />);

    await waitFor(() => expect(dialog()).toHaveAttribute('data-status', 'error'));
    const aviso = within(dialog()).getByTestId('batch-evidence-error');
    await user.click(within(aviso).getByRole('button', { name: 'Reintentar' }));
    await ready();
    expect(getEvidenceMock).toHaveBeenLastCalledWith(FINISHED_ORDER_ID, FINISHED_ORDER_LINE_ID);
  });

  it('QT-316 R10 — firma caída: los grupos de la receta con su cantidad y sin fotos', async () => {
    getEvidenceMock.mockResolvedValue(success(ORDER_EVIDENCE_UNSIGNED));
    render(<OpenDialog recipeName={RECIPE_NAME} />);

    const el = await ready();
    expect(within(el).getByTestId('batch-evidence-manufacturing-count')).toHaveTextContent('6');
    expect(within(el).queryAllByRole('img')).toHaveLength(0);
    expect(within(el).getAllByRole('button', { name: 'Reintentar' }).length).toBeGreaterThan(0);
  });

  it('QT-316 R11 — el título parte palabras largas y el diálogo sigue a pantalla completa en teléfono', async () => {
    getEvidenceMock.mockResolvedValue(success());
    render(<OpenDialog recipeName="Supercalifragilisticoespialidosoextralargo" />);

    const el = await ready();
    const titleId = screen.getByRole('dialog').getAttribute('aria-labelledby');
    expect(titleId).not.toBeNull();
    const title = document.getElementById(titleId as string) as HTMLElement;
    expect(title.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['break-words', '[overflow-wrap:anywhere]']),
    );
    for (const clase of ['h-dvh', 'w-full', 'max-w-none']) {
      expect(el.className.split(/\s+/), clase).toContain(clase);
    }
  });

  it('QT-316 R20 — grupo «Acondicionamiento» tras Envasado, con sus pasos y su total; la suma da el conteo', async () => {
    getEvidenceMock.mockResolvedValue(success(LINE_EVIDENCE_WITH_CONDITIONING));
    render(<OpenDialog photoCount={cellPhotoCount(LINE_EVIDENCE_WITH_CONDITIONING)} recipeName={RECIPE_NAME} />);

    const el = await ready();
    const regiones = within(el).getAllByRole('region');
    expect(regiones.map((region) => region.getAttribute('data-testid'))).toEqual([
      'batch-evidence-manufacturing',
      'batch-evidence-packing',
      'batch-evidence-conditioning',
    ]);

    const acondicionamiento = within(el).getByRole('region', { name: /Acondicionamiento/ });
    expect(within(acondicionamiento).getByRole('heading', { level: 3 })).toHaveTextContent('Acondicionamiento');
    expect(within(acondicionamiento).getByTestId('batch-evidence-conditioning-count')).toHaveTextContent('3');
    expect(
      within(acondicionamiento).getAllByTestId('evidence-step-row').map((row) => row.getAttribute('data-step')),
    ).toEqual(['2', '3']);
    expect(
      within(acondicionamiento).getByRole('group', { name: 'Evidencia de acondicionamiento, paso 2' }),
    ).toHaveTextContent('Paso 2');

    const suma = ['batch-evidence-manufacturing', 'batch-evidence-packing', 'batch-evidence-conditioning']
      .map((testId) => sectionCount(el, testId))
      .reduce((a, b) => a + b, 0);
    expect(suma).toBe(cellPhotoCount(LINE_EVIDENCE_WITH_CONDITIONING));
  });

  it('QT-316 R20 — sin fotos de acondicionamiento no hay sección, y la suma sigue dando el conteo', async () => {
    getEvidenceMock.mockResolvedValue(success());
    render(<OpenDialog recipeName={RECIPE_NAME} />);

    const el = await ready();
    expect(within(el).queryByTestId('batch-evidence-conditioning')).toBeNull();
    expect(within(el).queryByText('Acondicionamiento')).toBeNull();
    const suma = ['batch-evidence-manufacturing', 'batch-evidence-packing', 'batch-evidence-conditioning']
      .map((testId) => sectionCount(el, testId))
      .reduce((a, b) => a + b, 0);
    expect(suma).toBe(cellPhotoCount(ORDER_EVIDENCE));
  });
});
