import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FinishedProductBatchesTable,
  FinishedProductListSection,
} from '@/app/(private)/inventario/producto-terminado/[id]/components';
import type { SessionUser } from '@/lib/modules/identity';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import {
  FINISHED_ORDER_ID,
  FINISHED_ORDER_LINE_ID,
  FINISHED_PRODUCT_ID,
  GALLON_BATCH_ID,
  UNPACKAGED_BATCH_ROW,
  finishedProductBatchRow,
  finishedProductDetail,
  finishedProductPage,
} from '../../fixtures/finished-product-detail';
import {
  LINE_EVIDENCE_COUNTS,
  ORDER_EVIDENCE,
  ORDER_EVIDENCE_ERROR_STATES,
  ORDER_EVIDENCE_PHOTO_TOTAL,
} from '../../fixtures/order-evidence';
import { setupUser } from '../../helpers/user-event';

const { routerMock, listBatchesMock, countMock, getEvidenceMock, getSessionUserMock } = vi.hoisted(
  () => ({
    routerMock: {
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    },
    listBatchesMock: vi.fn(),
    countMock: vi.fn(),
    getEvidenceMock: vi.fn(),
    getSessionUserMock: vi.fn<() => Promise<SessionUser | null>>(),
  }),
);

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock },
  observabilidad: { readRequestIdHeader: vi.fn(async () => 'req-1') },
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-evidence-actions', () => ({
  getLineEvidenceAction: getEvidenceMock,
  countLineEvidenceAction: countMock,
}));

vi.mock('@/lib/modules/inventario/adapters/driving/finished-product-actions', () => ({
  getFinishedProductAction: vi.fn(),
  listFinishedProductBatchesAction: listBatchesMock,
  listFinishedProductMovementsAction: vi.fn(),
  listFinishedProductDeliveriesAction: vi.fn(),
  listFinishedProductCostsAction: vi.fn(),
  listProducedProductsAction: vi.fn(),
}));

const UNIT = 'L';
const OTHER_ORDER_ID = 'a0000000-0000-4000-8000-000000000999';
const OTHER_LINE_ID = 'a1000000-0000-4000-8000-000000000999';
const NO_PHOTOS_ORDER_ID = 'a0000000-0000-4000-8000-000000000998';
const NO_PHOTOS_LINE_ID = 'a1000000-0000-4000-8000-000000000998';
/** La segunda receta del pedido de `WITH_ORDER`. */
const SECOND_LINE_ID = 'a1000000-0000-4000-8000-000000000226';
const RECIPE_NAME = LINE_EVIDENCE_COUNTS[0].recipeName;

function sessionUser(permissions: readonly string[]): SessionUser {
  return { id: 'u-1', username: 'admin', displayName: 'Admin', roleName: null, permissions };
}

const WITH_PERMISSION = sessionUser(['inventario.consultar', 'pedidos.consultar']);
const WITHOUT_PERMISSION = sessionUser(['inventario.consultar']);

const WITH_ORDER = finishedProductBatchRow();
/** Mismo pedido, otra receta. */
const SAME_ORDER = finishedProductBatchRow({ id: GALLON_BATCH_ID, lot: 'L-2026-0226', orderLineId: SECOND_LINE_ID });

function counts(
  entries: readonly (readonly [string, number, string | null])[],
): ReadonlyMap<string, { photoCount: number; recipeName: string | null }> {
  return new Map(entries.map(([lineId, photoCount, recipeName]) => [lineId, { photoCount, recipeName }]));
}

function evidenceCell(batchId: string): HTMLElement {
  return within(screen.getByTestId(`data-table-row-${batchId}`)).getByTestId(
    'finished-product-batch-evidence',
  );
}

function headers(): string[] {
  return screen.getAllByRole('columnheader').map((th) => th.textContent ?? '');
}

async function renderLotes(rows = [WITH_ORDER, UNPACKAGED_BATCH_ROW]) {
  listBatchesMock.mockResolvedValue({ status: 'success', data: finishedProductPage(rows) });
  const tree = await FinishedProductListSection({
    productId: FINISHED_PRODUCT_ID,
    tab: 'lotes',
    paging: { page: 1, pageSize: 10 },
    unitLabel: UNIT,
    presentation: finishedProductDetail().presentation,
  });
  return render(<>{tree}</>);
}

beforeEach(() => {
  vi.clearAllMocks();
  countMock.mockResolvedValue({ status: 'success', data: LINE_EVIDENCE_COUNTS });
});

afterEach(cleanup);

describe('Lotes, columna «Evidencia»', () => {
  it('R4 — sin pedidos.consultar no hay columna, ni fotos, ni se pide el conteo', async () => {
    getSessionUserMock.mockResolvedValue(WITHOUT_PERMISSION);
    await renderLotes();

    expect(countMock).not.toHaveBeenCalled();
    expect(headers().some((text) => text.includes('Evidencia'))).toBe(false);
    expect(screen.queryByTestId('finished-product-batch-evidence')).toBeNull();
    expect(screen.queryByRole('button', { name: /evidencia|foto/i })).toBeNull();
    expect(screen.getByTestId(`data-table-row-${WITH_ORDER.id}`)).toBeInTheDocument();
  });

  it('R4 — sin sesion tampoco se pide el conteo', async () => {
    getSessionUserMock.mockResolvedValue(null);
    await renderLotes();

    expect(countMock).not.toHaveBeenCalled();
    expect(headers().some((text) => text.includes('Evidencia'))).toBe(false);
  });

  it('R4 — si el conteo falla, Lotes se pinta como hoy, sin la columna y sin «—»', async () => {
    getSessionUserMock.mockResolvedValue(WITH_PERMISSION);
    countMock.mockResolvedValue(ORDER_EVIDENCE_ERROR_STATES.unauthorized);
    await renderLotes();

    expect(countMock).toHaveBeenCalledTimes(1);
    expect(headers().some((text) => text.includes('Evidencia'))).toBe(false);
    expect(screen.queryByTestId('finished-product-batch-evidence')).toBeNull();
    expect(screen.getByTestId(`data-table-row-${WITH_ORDER.id}`)).toBeInTheDocument();
    expect(headers()).toHaveLength(8);
  });

  // 2026-11-11 (QT-316): el conteo pasa a ser por receta; una sola lectura con un par por línea.
  it('R16, QT-316 R4 — con el permiso, «Evidencia» es la ultima columna y se cuenta una vez por página', async () => {
    getSessionUserMock.mockResolvedValue(WITH_PERMISSION);
    await renderLotes([WITH_ORDER, SAME_ORDER, UNPACKAGED_BATCH_ROW]);

    expect(countMock).toHaveBeenCalledTimes(1);
    expect(countMock).toHaveBeenCalledWith([
      { orderId: FINISHED_ORDER_ID, lineId: FINISHED_ORDER_LINE_ID },
      { orderId: FINISHED_ORDER_ID, lineId: SECOND_LINE_ID },
    ]);
    const todas = headers();
    expect(todas.at(-1)).toContain('Evidencia');
  });

  it('R16 — botón con cámara, «N fotos» y aria-label; «—» sin pedido y sin fotos', async () => {
    getSessionUserMock.mockResolvedValue(WITH_PERMISSION);
    const sinFotos = finishedProductBatchRow({
      id: 'sin-fotos',
      lot: 'L-2026-0300',
      orderId: NO_PHOTOS_ORDER_ID,
      orderLineId: NO_PHOTOS_LINE_ID,
    });
    await renderLotes([WITH_ORDER, sinFotos, UNPACKAGED_BATCH_ROW]);

    expect(countMock).toHaveBeenCalledWith([
      { orderId: FINISHED_ORDER_ID, lineId: FINISHED_ORDER_LINE_ID },
      { orderId: NO_PHOTOS_ORDER_ID, lineId: NO_PHOTOS_LINE_ID },
    ]);

    const boton = within(evidenceCell(WITH_ORDER.id)).getByRole('button', {
      name: `Ver evidencia del lote ${WITH_ORDER.lot}: ${ORDER_EVIDENCE_PHOTO_TOTAL} fotos`,
    });
    expect(boton).toHaveTextContent(`${ORDER_EVIDENCE_PHOTO_TOTAL} fotos`);
    expect(boton.querySelector('svg')).not.toBeNull();
    expect(boton.querySelector('.font-mono')).toHaveTextContent(`${ORDER_EVIDENCE_PHOTO_TOTAL} fotos`);

    expect(evidenceCell('sin-fotos')).toHaveTextContent(EMPTY_MARK);
    expect(within(evidenceCell('sin-fotos')).queryByRole('button')).toBeNull();
    expect(evidenceCell(UNPACKAGED_BATCH_ROW.id)).toHaveTextContent(EMPTY_MARK);
    expect(within(evidenceCell(UNPACKAGED_BATCH_ROW.id)).queryByRole('button')).toBeNull();
  });

  it('R16 — una sola foto se lee «1 foto»', () => {
    render(
      <FinishedProductBatchesTable
        productId={FINISHED_PRODUCT_ID}
        page={finishedProductPage([WITH_ORDER])}
        unitLabel={UNIT}
        evidenceCounts={counts([[FINISHED_ORDER_LINE_ID, 1, null]])}
      />,
    );

    expect(
      within(evidenceCell(WITH_ORDER.id)).getByRole('button', {
        name: `Ver evidencia del lote ${WITH_ORDER.lot}: 1 foto`,
      }),
    ).toHaveTextContent(/^1 foto$/);
  });

  it('R16 — con el permiso y ningun lote con pedido, la columna sale con «—» sin pedir el conteo', async () => {
    getSessionUserMock.mockResolvedValue(WITH_PERMISSION);
    await renderLotes([UNPACKAGED_BATCH_ROW]);

    expect(countMock).not.toHaveBeenCalled();
    expect(headers().at(-1)).toContain('Evidencia');
    expect(evidenceCell(UNPACKAGED_BATCH_ROW.id)).toHaveTextContent(EMPTY_MARK);
  });

  it('R18 — la tabla de Lotes sigue sin tarjetas: en teléfono se desplaza en horizontal', async () => {
    getSessionUserMock.mockResolvedValue(WITH_PERMISSION);
    await renderLotes();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByTestId('data-table-cards')).toBeNull();
    expect(screen.getAllByTestId('finished-product-batch-evidence')).toHaveLength(2);
  });

  // 2026-11-11 (QT-316 R1): sustituye a «R19 — dos lotes del mismo pedido muestran el mismo total» de
  // QC-271. Cada lote cuenta solo las fotos de su receta.
  it('QT-316 R1 — dos lotes del mismo pedido, cada uno con las fotos de su receta', async () => {
    getSessionUserMock.mockResolvedValue(WITH_PERMISSION);
    const otro = finishedProductBatchRow({
      id: 'otro-pedido',
      lot: 'L-2026-0400',
      orderId: OTHER_ORDER_ID,
      orderLineId: OTHER_LINE_ID,
    });
    countMock.mockResolvedValue({
      status: 'success',
      data: [
        { orderId: FINISHED_ORDER_ID, lineId: FINISHED_ORDER_LINE_ID, photoCount: 6, recipeName: 'Crema A' },
        { orderId: FINISHED_ORDER_ID, lineId: SECOND_LINE_ID, photoCount: 3, recipeName: 'Crema B' },
        { orderId: OTHER_ORDER_ID, lineId: OTHER_LINE_ID, photoCount: 2, recipeName: null },
      ],
    });
    await renderLotes([WITH_ORDER, SAME_ORDER, otro]);

    expect(countMock).toHaveBeenCalledTimes(1);
    expect(within(evidenceCell(WITH_ORDER.id)).getByRole('button')).toHaveTextContent('6 fotos');
    expect(within(evidenceCell(SAME_ORDER.id)).getByRole('button')).toHaveTextContent('3 fotos');
    expect(within(evidenceCell('otro-pedido')).getByRole('button')).toHaveTextContent('2 fotos');
  });

  it('QT-316 R2 — una receta sin fotos muestra «—» sin botón, aunque la otra receta del pedido tenga', () => {
    render(
      <FinishedProductBatchesTable
        productId={FINISHED_PRODUCT_ID}
        page={finishedProductPage([WITH_ORDER, SAME_ORDER])}
        unitLabel={UNIT}
        evidenceCounts={counts([[FINISHED_ORDER_LINE_ID, 6, 'Crema A']])}
      />,
    );

    expect(within(evidenceCell(WITH_ORDER.id)).getByRole('button')).toHaveTextContent('6 fotos');
    expect(evidenceCell(SAME_ORDER.id)).toHaveTextContent(EMPTY_MARK);
    expect(within(evidenceCell(SAME_ORDER.id)).queryByRole('button')).toBeNull();
  });

  it('QT-316 R3 — un lote sin pedido de origen sigue con «—», aunque el mapa tenga conteos', () => {
    render(
      <FinishedProductBatchesTable
        productId={FINISHED_PRODUCT_ID}
        page={finishedProductPage([UNPACKAGED_BATCH_ROW, WITH_ORDER])}
        unitLabel={UNIT}
        evidenceCounts={counts([[FINISHED_ORDER_LINE_ID, 6, null]])}
      />,
    );

    expect(evidenceCell(UNPACKAGED_BATCH_ROW.id)).toHaveTextContent(EMPTY_MARK);
    expect(within(evidenceCell(UNPACKAGED_BATCH_ROW.id)).queryByRole('button')).toBeNull();
  });

  it('QT-316 R6, R7 — el botón abre el diálogo de su receta: lee por línea y nombra la receta', async () => {
    getSessionUserMock.mockResolvedValue(WITH_PERMISSION);
    getEvidenceMock.mockResolvedValue({ status: 'success', data: ORDER_EVIDENCE });
    const user = setupUser();
    await renderLotes([WITH_ORDER, UNPACKAGED_BATCH_ROW]);

    await user.click(within(evidenceCell(WITH_ORDER.id)).getByRole('button'));

    await waitFor(() =>
      expect(screen.getByTestId('batch-evidence-dialog')).toHaveAttribute('data-status', 'ready'),
    );
    expect(getEvidenceMock).toHaveBeenCalledWith(FINISHED_ORDER_ID, FINISHED_ORDER_LINE_ID);
    expect(screen.getByRole('dialog')).toHaveAccessibleName(
      `Evidencia · Lote ${WITH_ORDER.lot} · Pedido ${WITH_ORDER.orderNumberText} · ${RECIPE_NAME}`,
    );
  });
});
