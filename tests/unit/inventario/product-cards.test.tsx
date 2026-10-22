// Las listas de inventario en tarjetas. jsdom no evalua las consultas de contenedor, asi que la
// tabla y las tarjetas estan las dos en el arbol: aqui se mira la tarjeta, su menu centrado y las
// tarjetas de las sub-filas de lote.

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BELOW_ALERT_LABEL,
  FINISHED_STOCK_TABLE_TEXTS,
  FinishedStockTable,
  PRODUCT_CARD_LABELS,
  PRODUCT_TABLE_SCOPE_CLASS,
  PRODUCT_TABLE_TEXTS,
  ProductTable,
} from '@/app/(private)/inventario/components';
import { cardFieldLabel } from '@/components/shared/card-field-label';
import type { DataTableParams } from '@/components/shared/data-table';
import {
  PRODUCT_TYPES,
  type FinishedStockRow,
  type ProductBatchView,
  type ProductView,
} from '@/lib/modules/inventario';
import type { UnitRef } from '@/lib/modules/unidades';
import { finishedProductDetailRoute } from '@/lib/shared/routes';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';
import { WIDE_VIEWPORT, resetViewport, setViewportWidth } from '../../helpers/viewport';

const { routerMock, listProductBatchesActionMock, listAliveProductBatchesActionMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  },
  listProductBatchesActionMock: vi.fn(),
  listAliveProductBatchesActionMock: vi.fn(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/inventario/adapters/driving/batch-actions', () => ({
  listProductBatchesAction: listProductBatchesActionMock,
  listAliveProductBatchesAction: listAliveProductBatchesActionMock,
  listOrderBatchesAction: vi.fn(async () => ({ status: 'success', data: [] })),
  listBatchMovementsAction: vi.fn(),
  adjustBatchStockAction: vi.fn(),
}));

const TODOS: DataTableParams = { page: 1, pageSize: 20, sort: null, filters: {}, search: '' };
const SOLO_PRODUCTO: DataTableParams = {
  ...TODOS,
  filters: { type: { kind: 'select', values: [PRODUCT_TYPES.PRODUCT] } },
};
const TERMINADO: DataTableParams = {
  ...TODOS,
  filters: { type: { kind: 'select', values: [PRODUCT_TYPES.FINISHED_PRODUCT] } },
};
const KILO: UnitRef = { id: 'unit-kg', name: 'Kilogramo', symbol: 'kg', baseUnitId: null, factor: null };

function producto(overrides: Partial<ProductView> = {}): ProductView {
  return {
    id: 'product-1',
    name: 'Acido citrico · Saco 25 kg',
    imagePath: null,
    stock: '12',
    unitId: 'unit-kg',
    qtyAlert: '20',
    type: PRODUCT_TYPES.PRODUCT,
    presentationId: 'presentation-1',
    presentationName: 'Saco 25 kg',
    averageUnitCost: '3.2500',
    reserved: '2',
    available: '10',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function lote(overrides: Partial<ProductBatchView> = {}): ProductBatchView {
  return {
    id: 'batch-1',
    lot: 'L-001',
    stock: '12.0000',
    unitId: 'unit-kg',
    purchaseDate: '2026-03-05',
    expiryDate: null,
    packageContent: null,
    unitCost: '3.0000',
    reserved: '2.0000',
    available: '10.0000',
    ...overrides,
  };
}

const ACIDO = producto();

function montar(
  params: DataTableParams = TODOS,
  products: readonly ProductView[] = [ACIDO],
  canSeeCost = true,
) {
  // Por defecto como el Administrador: con `canSeeCost` la tarjeta lleva tambien el costo.
  return render(
    <ProductTable
      products={products}
      params={params}
      totalPages={1}
      units={[KILO]}
      canAdjust
      canSeeCost={canSeeCost}
    />,
  );
}

/** Ids de los campos de la tarjeta, en el orden en que se pintan. */
function camposDe(card: HTMLElement): string[] {
  return Array.from(card.querySelectorAll('[data-testid^="data-table-card-field-"]')).map((el) =>
    (el.getAttribute('data-testid') ?? '').replace('data-table-card-field-', ''),
  );
}

function rotulo(field: HTMLElement): HTMLElement | null {
  return field.querySelector<HTMLElement>('[data-card-label]');
}

function tarjetas(): HTMLElement[] {
  return within(screen.getByTestId('data-table-cards')).getAllByRole('listitem');
}

function tarjeta(id: string): HTMLElement {
  return screen.getByTestId(`data-table-card-${id}`);
}

function campo(card: HTMLElement, columnId: string): HTMLElement {
  return within(card).getByTestId(`data-table-card-field-${columnId}`);
}

async function desplegarEnTarjeta(user: ReturnType<typeof setupUser>, id = ACIDO.id) {
  await user.click(within(tarjeta(id)).getByTestId('product-batches-card-toggle'));
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  setViewportWidth(WIDE_VIEWPORT);
  listProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [] });
  listAliveProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [] });
});

afterEach(() => {
  cleanup();
  resetViewport();
});

describe('cada producto en su tarjeta', () => {
  it('R13 — una tarjeta por producto, con la imagen arriba y el nombre como titulo', () => {
    montar(TODOS, [ACIDO, producto({ id: 'product-2', name: 'Sosa', presentationName: null })]);

    expect(tarjetas().map((card) => card.getAttribute('data-testid'))).toEqual([
      'data-table-card-product-1',
      'data-table-card-product-2',
    ]);
    const card = tarjeta(ACIDO.id);
    expect(within(campo(card, 'image')).getByTestId('product-image')).toBeInTheDocument();
    expect(within(campo(card, 'name')).getByTestId('product-name')).toHaveTextContent(/^Acido citrico$/);
    expect(campo(card, 'name')).toHaveClass('font-semibold');
  });

  it('R58 — el chevron del titulo lo oculta en la tarjeta la clase de ambito del envoltorio', () => {
    montar();

    // jsdom no aplica Tailwind: se afirma que el chevron esta donde lo alcanza la regla.
    const chevron = within(campo(tarjeta(ACIDO.id), 'name')).getByTestId('product-batches-toggle');
    expect(chevron.closest('[data-testid="data-table-cards"]')).not.toBeNull();
    expect(PRODUCT_TABLE_SCOPE_CLASS.split(' ')).toContain(
      '[&_[data-testid=data-table-cards]_[data-testid=product-batches-toggle]]:hidden',
    );
    expect(screen.getByTestId('data-table').parentElement?.className).toBe(PRODUCT_TABLE_SCOPE_CLASS);
  });

  it('R13, R53 — en «Todos», «Tipo» va como estado de la tarjeta', () => {
    montar(TODOS);

    expect(within(campo(tarjeta(ACIDO.id), 'type')).getByTestId('product-type')).toHaveAttribute(
      'data-type',
      PRODUCT_TYPES.PRODUCT,
    );
  });

  it('R13, R53 — con un tipo filtrado la tarjeta no pinta «Tipo»', () => {
    montar(SOLO_PRODUCTO);

    expect(within(tarjeta(ACIDO.id)).queryByTestId('data-table-card-field-type')).toBeNull();
    expect(within(tarjeta(ACIDO.id)).queryByTestId('product-type')).toBeNull();
  });

  it('R13, R53 — las cifras son Presentacion, Existencia, Alerta, Disponible y Costo, iguales que en la fila, y el pie lleva el conmutador', () => {
    montar();
    const card = tarjeta(ACIDO.id);
    const fila = screen.getByTestId(`data-table-row-${ACIDO.id}`);

    expect(camposDe(card)).toEqual([
      'image',
      'type',
      'name',
      'presentationName',
      'stock',
      'qtyAlert',
      'available',
      'averageUnitCost',
      'batchesToggle',
    ]);
    for (const columnId of ['presentationName', 'stock', 'averageUnitCost', 'qtyAlert', 'available']) {
      const celda = within(fila).getByTestId(`data-table-cell-${columnId}`);
      expect(campo(card, columnId).textContent).toBe(celda.textContent);
    }
    expect(campo(card, 'presentationName')).toHaveTextContent('Saco 25 kg');
    expect(within(campo(card, 'averageUnitCost')).getByTestId('product-cost')).toHaveTextContent(
      /^\$3\.25 \/ kg$/,
    );
    expect(campo(card, 'stock')).toHaveClass('font-mono', 'tabular-nums');
  });

  it('R13, R53 — en «Producto» la tarjeta no pinta «Presentación», tambien al cambiar de pestana', () => {
    const { rerender } = montar(TODOS);
    expect(camposDe(tarjeta(ACIDO.id))).toContain('presentationName');

    rerender(
      <ProductTable
        products={[ACIDO]}
        params={SOLO_PRODUCTO}
        totalPages={1}
        units={[KILO]}
        canAdjust
        canSeeCost
      />,
    );

    expect(camposDe(tarjeta(ACIDO.id))).toEqual([
      'image',
      'name',
      'stock',
      'qtyAlert',
      'available',
      'averageUnitCost',
      'batchesToggle',
    ]);
    expect(within(tarjeta(ACIDO.id)).queryByText('Saco 25 kg')).toBeNull();
  });

  it('R13, R54 — la cifra «Costo» de la tarjeta sale solo con `canSeeCost`', () => {
    const { rerender } = montar(TODOS, [ACIDO], false);
    expect(within(tarjeta(ACIDO.id)).queryByTestId('data-table-card-field-averageUnitCost')).toBeNull();
    expect(within(tarjeta(ACIDO.id)).queryByTestId('product-cost')).toBeNull();

    rerender(
      <ProductTable products={[ACIDO]} params={TODOS} totalPages={1} units={[KILO]} canAdjust canSeeCost />,
    );

    expect(
      within(campo(tarjeta(ACIDO.id), 'averageUnitCost')).getByTestId('product-cost'),
    ).toBeInTheDocument();
  });

  it('R55 — cada cifra lleva delante su rotulo, fuera del elemento de la cifra, cuyo texto no cambia', () => {
    montar();
    const card = tarjeta(ACIDO.id);
    const fila = screen.getByTestId(`data-table-row-${ACIDO.id}`);

    const esperados = [
      ['stock', 'product-stock', 'Existencia'],
      ['qtyAlert', 'product-qty-alert', 'Alerta'],
      ['available', 'product-available', 'Disponible'],
      ['averageUnitCost', 'product-cost', 'Costo'],
    ] as const;
    for (const [columnId, testId, texto] of esperados) {
      const label = rotulo(campo(card, columnId));
      const cifra = within(campo(card, columnId)).getByTestId(testId);
      expect(label, columnId).not.toBeNull();
      expect(label?.textContent?.trim(), columnId).toBe(texto);
      expect(cifra.contains(label), columnId).toBe(false);
      expect(label?.compareDocumentPosition(cifra), columnId).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(cifra.textContent, columnId).toBe(within(fila).getByTestId(testId).textContent);
    }
    expect(within(campo(card, 'available')).getByTestId('product-available').textContent).toBe('10 kg');
    expect(within(campo(card, 'averageUnitCost')).getByTestId('product-cost').textContent).toBe(
      '$3.25 / kg',
    );
    expect(PRODUCT_CARD_LABELS).toMatchObject({
      stock: 'Existencia',
      qtyAlert: 'Alerta',
      available: 'Disponible',
      unitCost: 'Costo',
    });
    expect(PRODUCT_CARD_LABELS).not.toHaveProperty('reserved');
    expect(rotulo(campo(card, 'presentationName'))).toBeNull();
  });

  it('R55 — el rotulo lleva `[table_&]:hidden`: dentro de la tabla no se ve', () => {
    montar();

    const enLaTabla = screen.getByRole('table').querySelectorAll('[data-card-label]');
    expect(enLaTabla.length).toBeGreaterThan(0);
    for (const label of enLaTabla) expect(label).toHaveClass('[table_&]:hidden');
    cleanup();

    const { container } = render(<>{cardFieldLabel('Existencia')}</>);
    expect(container.querySelector('[data-card-label]')).toHaveClass(
      '[table_&]:hidden',
      'text-muted-foreground',
    );
  });

  it('R58 — el pie pinta «Mostrar lotes» a la izquierda de «Acciones», de 44 px, que despliega los lotes y pasa a «Ocultar lotes»', async () => {
    listAliveProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [lote()] });
    const user = setupUser();
    montar();
    const card = tarjeta(ACIDO.id);

    const boton = within(campo(card, 'batchesToggle')).getByTestId('product-batches-card-toggle');
    const acciones = within(card).getByTestId('product-row-actions');
    expect(boton).toHaveAccessibleName('Mostrar lotes');
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(boton.className).toContain('min-h-11');
    expect(boton.querySelector('svg.lucide-chevron-right')).not.toBeNull();
    expect(boton.compareDocumentPosition(acciones) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(campo(card, 'batchesToggle').parentElement?.contains(acciones)).toBe(true);

    await user.click(boton);

    expect(await screen.findByTestId(`data-table-card-${ACIDO.id}--batch-batch-1`)).toBeInTheDocument();
    const desplegado = within(tarjeta(ACIDO.id)).getByTestId('product-batches-card-toggle');
    expect(desplegado).toHaveAccessibleName('Ocultar lotes');
    expect(desplegado).toHaveAttribute('aria-expanded', 'true');
    expect(listAliveProductBatchesActionMock).toHaveBeenCalledWith(ACIDO.id);

    await user.click(desplegado);
    expect(screen.queryByTestId(`data-table-card-${ACIDO.id}--batch-batch-1`)).toBeNull();
  });

  it('R13, R58 — la clase de ambito va en el envoltorio y alcanza la cabecera y las celdas del conmutador del pie', () => {
    montar();

    const envoltorio = screen.getByTestId('data-table').parentElement as HTMLElement;
    expect(envoltorio.className).toBe(PRODUCT_TABLE_SCOPE_CLASS);
    const clases = PRODUCT_TABLE_SCOPE_CLASS.split(' ');
    expect(clases).toContain('[&_[data-testid=data-table-head-batchesToggle]]:hidden');
    expect(clases).toContain('[&_[data-testid=data-table-cell-batchesToggle]]:hidden');
    expect(within(screen.getByRole('table')).getByTestId('data-table-head-batchesToggle').tagName).toBe(
      'TH',
    );
    const celda = within(screen.getByTestId(`data-table-row-${ACIDO.id}`)).getByTestId(
      'data-table-cell-batchesToggle',
    );
    expect(celda.tagName).toBe('TD');
    expect(envoltorio.contains(celda)).toBe(true);
  });

  it('R13 — la tarjeta no repite «Reservado»', () => {
    montar();

    expect(within(tarjeta(ACIDO.id)).queryByTestId('data-table-card-field-reserved')).toBeNull();
  });

  it('R8, R13 — por debajo de la alerta, la existencia de la tarjeta lleva el aviso en ambar', () => {
    montar();

    const existencia = within(campo(tarjeta(ACIDO.id), 'stock')).getByTestId('product-stock');
    expect(existencia).toHaveAttribute('data-alert', 'true');
    expect(existencia).toHaveClass('text-warning-text');
    expect(existencia).not.toHaveClass('text-destructive');
    expect(within(existencia).getByText(BELOW_ALERT_LABEL)).toHaveClass('sr-only');
    expect(within(existencia).getByTitle(BELOW_ALERT_LABEL)).toBeInTheDocument();
  });
});

describe('«Acciones» abre el menu en un dialogo centrado', () => {
  it('R13 — el boton dice «Acciones», mide al menos 44 px y nombra el producto', () => {
    montar();

    const acciones = within(tarjeta(ACIDO.id)).getByTestId('product-row-actions');
    expect(acciones).toHaveTextContent(PRODUCT_TABLE_TEXTS.cardActions ?? '');
    expect(acciones).toHaveAccessibleName('Acciones de Acido citrico · Saco 25 kg · kg');
    expect(acciones).toHaveAttribute('data-product-id', ACIDO.id);
    expect(acciones.className).toContain('min-h-11');
  });

  it('R13 — los textos de la tarjeta son «Acciones» y «Cerrar»', () => {
    expect(PRODUCT_TABLE_TEXTS.cardActions).toBe('Acciones');
    expect(PRODUCT_TABLE_TEXTS.closeMenu).toBe('Cerrar');
    expect(FINISHED_STOCK_TABLE_TEXTS.cardActions).toBe('Acciones');
    expect(FINISHED_STOCK_TABLE_TEXTS.closeMenu).toBe('Cerrar');
  });

  it('R13, R14 — el dialogo se titula con el nombre y ofrece los cinco items de al menos 48 px', async () => {
    const user = setupUser();
    montar();

    await user.click(within(tarjeta(ACIDO.id)).getByTestId('product-row-actions'));

    const dialogo = await screen.findByRole('dialog', { name: 'Acido citrico' });
    const items = [
      'product-batches-open',
      'product-history-open',
      'product-adjust-open',
      'product-edit-open',
      'product-delete-open',
    ].map((testId) => within(dialogo).getByTestId(testId));
    for (const item of items) expect(item.className).toContain('min-h-12');
    expect(within(dialogo).queryAllByRole('separator', { hidden: true })).toHaveLength(1);
    expect(within(dialogo).getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  });

  it('R12, R13 — elegir «Lotes» en el dialogo abre el panel de lotes de ese producto', async () => {
    const user = setupUser();
    montar();

    await user.click(within(tarjeta(ACIDO.id)).getByTestId('product-row-actions'));
    const dialogo = await screen.findByRole('dialog', { name: 'Acido citrico' });
    await user.click(await esperarInteractiva(within(dialogo).getByTestId('product-batches-open')));

    expect(await screen.findByTestId('product-batches-sheet')).toBeInTheDocument();
    expect(listProductBatchesActionMock).toHaveBeenCalledWith(ACIDO.id);
  });
});

describe('las sub-filas de lote salen como tarjetas justo detras de la del producto', () => {
  it('R47 — cada lote es una tarjeta tras la del producto, sin imagen ni «Acciones», con sus cifras', async () => {
    listAliveProductBatchesActionMock.mockResolvedValue({
      status: 'success',
      data: [lote(), lote({ id: 'batch-2', lot: 'L-002' })],
    });
    const user = setupUser();
    montar(TODOS, [ACIDO, producto({ id: 'product-2', name: 'Sosa', presentationName: null })]);

    await desplegarEnTarjeta(user);
    await screen.findByTestId(`data-table-card-${ACIDO.id}--batch-batch-2`);

    expect(tarjetas().map((card) => card.getAttribute('data-testid'))).toEqual([
      'data-table-card-product-1',
      'data-table-card-product-1--batch-batch-1',
      'data-table-card-product-1--batch-batch-2',
      'data-table-card-product-2',
    ]);
    const card = tarjeta(`${ACIDO.id}--batch-batch-1`);
    expect(within(card).queryByTestId('product-image')).toBeNull();
    expect(within(card).queryByTestId('product-row-actions')).toBeNull();
    expect(within(card).queryByRole('button', { name: /Acciones/ })).toBeNull();
    expect(within(campo(card, 'name')).getByTestId('product-batch-row-lot')).toHaveTextContent('L-001');
    expect(within(campo(card, 'stock')).getByTestId('batch-stock')).toHaveTextContent('12 kg');
    expect(within(campo(card, 'averageUnitCost')).getByTestId('product-batch-row-cost')).toHaveTextContent('3');
    expect(within(campo(card, 'available')).getByTestId('product-batch-row-available')).toHaveTextContent('10 kg');
  });

  it('R55 — la tarjeta del lote rotula existencia, disponible y costo, y no rotula donde no hay cifra', async () => {
    listAliveProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [lote()] });
    const user = setupUser();
    montar();

    await desplegarEnTarjeta(user);
    const card = await screen.findByTestId(`data-table-card-${ACIDO.id}--batch-batch-1`);

    const esperados = [
      ['stock', 'batch-stock', 'Existencia', '12 kg'],
      ['available', 'product-batch-row-available', 'Disponible', '10 kg'],
      ['averageUnitCost', 'product-batch-row-cost', 'Costo', '$3.00 / kg'],
    ] as const;
    for (const [columnId, testId, texto, cifra] of esperados) {
      expect(rotulo(campo(card, columnId))?.textContent?.trim(), columnId).toBe(texto);
      expect(within(campo(card, columnId)).getByTestId(testId).textContent, columnId).toBe(cifra);
    }
    expect(campo(card, 'qtyAlert')).toBeEmptyDOMElement();
    expect(rotulo(campo(card, 'qtyAlert'))).toBeNull();
    expect(within(card).queryByTestId('data-table-card-field-reserved')).toBeNull();
    expect(within(card).queryByTestId('product-batches-card-toggle')).toBeNull();
  });

  it('R55 — la tarjeta del lote no pinta «Reservado», ni rotulo ni cifra', async () => {
    listAliveProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [lote()] });
    const user = setupUser();
    montar();

    await desplegarEnTarjeta(user);
    const card = await screen.findByTestId(`data-table-card-${ACIDO.id}--batch-batch-1`);

    expect(within(card).queryByText(/Reservado/)).toBeNull();
    expect(within(card).queryByTestId('product-batch-row-reserved')).toBeNull();
    const rotulos = Array.from(card.querySelectorAll('[data-card-label]')).map((el) => el.textContent?.trim());
    expect(rotulos).toEqual(['Existencia', 'Disponible', 'Costo']);
  });

  it('R55 — una cifra vacia pintada como «—» lleva su rotulo en la tarjeta del lote y en la del producto', async () => {
    listAliveProductBatchesActionMock.mockResolvedValue({ status: 'success', data: [lote({ unitCost: null })] });
    const user = setupUser();
    montar(TODOS, [producto({ averageUnitCost: null })]);

    const card = tarjeta(ACIDO.id);
    expect(rotulo(campo(card, 'averageUnitCost'))?.textContent?.trim()).toBe('Costo');
    expect(campo(card, 'averageUnitCost')).toHaveTextContent(/^Costo —$/);
    expect(within(card).queryByTestId('product-cost')).toBeNull();

    await desplegarEnTarjeta(user);
    const sub = await screen.findByTestId(`data-table-card-${ACIDO.id}--batch-batch-1`);
    expect(rotulo(campo(sub, 'averageUnitCost'))?.textContent?.trim()).toBe('Costo');
    expect(campo(sub, 'averageUnitCost')).toHaveTextContent(/^Costo —$/);
    expect(within(sub).queryByTestId('product-batch-row-cost')).toBeNull();
  });

  it('R55 — la tarjeta de estado de lotes no lleva ningun rotulo', async () => {
    listAliveProductBatchesActionMock.mockReturnValue(new Promise(() => undefined));
    const user = setupUser();
    montar();

    await desplegarEnTarjeta(user);

    expect(tarjeta(`${ACIDO.id}--batches`).querySelector('[data-card-label]')).toBeNull();
  });

  it('R47 — mientras carga, la tarjeta de estado dice «Cargando lotes…» y no tiene «Acciones»', async () => {
    listAliveProductBatchesActionMock.mockReturnValue(new Promise(() => undefined));
    const user = setupUser();
    montar();

    await desplegarEnTarjeta(user);

    const card = tarjeta(`${ACIDO.id}--batches`);
    expect(within(card).getByTestId('product-batches-row-loading')).toHaveTextContent('Cargando lotes…');
    expect(within(card).queryByTestId('product-row-actions')).toBeNull();
    expect(within(card).queryByTestId('product-image')).toBeNull();
    expect(tarjetas()[1]).toBe(card);
  });

  it('R47 — sin lotes vivos, la tarjeta de estado dice «Sin lotes con existencia.»', async () => {
    const user = setupUser();
    montar();

    await desplegarEnTarjeta(user);

    const card = await screen.findByTestId(`data-table-card-${ACIDO.id}--batches`);
    expect(await within(card).findByTestId('product-batches-row-empty')).toHaveTextContent(
      'Sin lotes con existencia.',
    );
    expect(within(card).queryByTestId('product-row-actions')).toBeNull();
  });

  it('R47 — con error, la tarjeta de estado pinta el mensaje y «Reintentar» vuelve a pedir', async () => {
    listAliveProductBatchesActionMock.mockResolvedValueOnce({
      status: 'error',
      code: 'unexpected',
      message: 'No se pudieron cargar los lotes.',
    });
    const user = setupUser();
    montar();

    await desplegarEnTarjeta(user);

    const card = tarjeta(`${ACIDO.id}--batches`);
    expect(await within(card).findByTestId('product-batches-row-error-message')).toHaveTextContent(
      'No se pudieron cargar los lotes.',
    );
    expect(within(card).queryByTestId('product-row-actions')).toBeNull();
    await user.click(within(card).getByTestId('product-batches-row-retry'));
    expect(listAliveProductBatchesActionMock).toHaveBeenCalledTimes(2);
  });
});

describe('producto terminado en tarjetas', () => {
  function pedido(): FinishedStockRow {
    const product = producto({
      id: 'product-9',
      name: 'Desengrasante · Botella 250 ml',
      type: PRODUCT_TYPES.FINISHED_PRODUCT,
      presentationName: 'Botella 250 ml',
      stock: '1.5',
      qtyAlert: '3',
    });
    return {
      kind: 'order',
      key: 'order-1',
      orderId: 'order-1',
      orderNumber: { year: 2026, sequence: 7 },
      numberText: '2026-0007',
      recipeName: 'Desengrasante',
      packagedStock: null,
      products: [{ product, stock: '1.5', packagedStock: null }],
    };
  }

  function montarTerminado() {
    render(<FinishedStockTable rows={[pedido()]} params={TERMINADO} totalPages={1} units={[KILO]} canAdjust />);
  }

  it('R13 — la tarjeta del pedido lleva el numero de pedido y el conmutador, sin «Acciones»', () => {
    montarTerminado();
    const card = tarjeta('order-1');

    expect(within(campo(card, 'orderNumber')).getByTestId('finished-stock-order-number')).toHaveTextContent(
      '2026-0007',
    );
    expect(within(campo(card, 'name')).getByTestId('finished-stock-toggle')).toBeInTheDocument();
    expect(within(card).queryByTestId('product-row-actions')).toBeNull();
  });

  it('R13, R53 — la linea es una tarjeta con el enlace a la ficha, «Presentación», existencia y alerta, sin «Disponible» ni «Costo»', async () => {
    const user = setupUser();
    montarTerminado();

    await user.click(within(tarjeta('order-1')).getByTestId('finished-stock-toggle'));

    const card = tarjeta('order-1--product-9');
    const enlace = within(campo(card, 'name')).getByTestId('finished-stock-line-link');
    expect(enlace).toHaveAttribute('href', finishedProductDetailRoute('product-9'));
    expect(enlace).toHaveAccessibleName('Desengrasante');
    expect(campo(card, 'presentationName')).toHaveTextContent('Botella 250 ml');
    expect(within(campo(card, 'stock')).getByTestId('product-stock')).toHaveTextContent('1.5 kg');
    expect(within(campo(card, 'qtyAlert')).getByTestId('product-qty-alert')).toHaveTextContent('3 kg');
    expect(within(card).queryByTestId('data-table-card-field-available')).toBeNull();
    expect(within(card).queryByTestId('data-table-card-field-averageUnitCost')).toBeNull();
  });

  it('R12, R13 — la linea tiene su «Acciones» con el menu del producto', async () => {
    const user = setupUser();
    montarTerminado();

    await user.click(within(tarjeta('order-1')).getByTestId('finished-stock-toggle'));
    await user.click(within(tarjeta('order-1--product-9')).getByTestId('product-row-actions'));

    const dialogo = await screen.findByRole('dialog', { name: 'Desengrasante' });
    expect(within(dialogo).getByTestId('product-history-open')).toBeInTheDocument();
    expect(within(dialogo).getByTestId('product-adjust-open')).toBeInTheDocument();
  });

  it('R8, R13 — la linea por debajo de la alerta lleva el aviso tambien en la tarjeta', async () => {
    const user = setupUser();
    montarTerminado();

    await user.click(within(tarjeta('order-1')).getByTestId('finished-stock-toggle'));

    const existencia = within(campo(tarjeta('order-1--product-9'), 'stock')).getByTestId('product-stock');
    expect(existencia).toHaveAttribute('data-alert', 'true');
    expect(existencia).toHaveClass('text-warning-text');
  });
});
