import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BATCH_EVIDENCE_DIALOG_CLASS,
  BATCH_EVIDENCE_DIALOG_TESTID,
  BatchEvidenceButton,
  BatchEvidenceDialog,
} from '@/app/(private)/inventario/producto-terminado/[id]/components';
import type { OrderEvidenceResult } from '@/lib/modules/asignaciones/adapters/driving/order-evidence-actions';
import { FINISHED_ORDER_ID, FINISHED_ORDER_NUMBER } from '../../fixtures/finished-product-detail';
import {
  ORDER_EVIDENCE,
  ORDER_EVIDENCE_ERROR_STATES,
  ORDER_EVIDENCE_MANUFACTURING_ONLY,
  ORDER_EVIDENCE_PHOTO_TOTAL,
  ORDER_EVIDENCE_UNSIGNED,
} from '../../fixtures/order-evidence';
import { setupUser } from '../../helpers/user-event';

const { getEvidenceMock } = vi.hoisted(() => ({
  getEvidenceMock: vi.fn<(orderId: string) => Promise<OrderEvidenceResult>>(),
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-evidence-actions', () => ({
  getOrderEvidenceAction: getEvidenceMock,
  countOrderEvidenceAction: vi.fn(),
}));

const LOT = 'L-2026-0225';

function OpenDialog({ photoCount = ORDER_EVIDENCE_PHOTO_TOTAL }: { readonly photoCount?: number }) {
  const [open, setOpen] = useState(true);
  return (
    <BatchEvidenceDialog
      open={open}
      onOpenChange={setOpen}
      lot={LOT}
      orderId={FINISHED_ORDER_ID}
      orderNumberText={FINISHED_ORDER_NUMBER}
      photoCount={photoCount}
    />
  );
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
    expect(getEvidenceMock).toHaveBeenCalledWith(FINISHED_ORDER_ID);
    expect(
      screen.getByRole('dialog', { name: `Evidencia · Lote ${LOT} · Pedido ${FINISHED_ORDER_NUMBER}` }),
    ).toBeInTheDocument();
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
    expect(getEvidenceMock.mock.calls.every(([orderId]) => orderId === FINISHED_ORDER_ID)).toBe(true);
  });
});
