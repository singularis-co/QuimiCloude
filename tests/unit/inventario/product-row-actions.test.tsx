// El menú de la fila de un producto como datos (`productRowActionsSpec`) y su envoltorio
// `ProductRowActions`: orden de los ítems, separador delante de «Borrar», permiso de ajuste,
// testids y nombres del disparador, y el título del menú centrado.

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PRODUCT_ROW_ACTION_LABELS,
  ProductRowActions,
  productRowActionsSpec,
  type ProductRowAction,
} from '@/app/(private)/inventario/components';
import { PRODUCT_TYPES, type ProductView } from '@/lib/modules/inventario';
import type { UnitRef } from '@/lib/modules/unidades';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';

const KILO: UnitRef = { id: 'unit-kg', name: 'Kilogramo', symbol: 'kg', baseUnitId: null, factor: null };

function producto(overrides: Partial<ProductView> = {}): ProductView {
  return {
    id: 'product-1',
    name: 'Jabon · Botella 500 ml',
    imagePath: null,
    stock: '12',
    unitId: 'unit-kg',
    qtyAlert: null,
    type: PRODUCT_TYPES.PRODUCT,
    presentationId: 'presentation-1',
    presentationName: 'Botella 500 ml',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

const CON_AJUSTE = [
  'product-batches-open',
  'product-history-open',
  'product-adjust-open',
  'product-edit-open',
  'product-delete-open',
];

afterEach(cleanup);

describe('productRowActionsSpec', () => {
  it('R9 — ofrece Lotes, Historial, Ajustar existencia, Editar y Borrar, en ese orden', () => {
    const spec = productRowActionsSpec({ product: producto(), units: [KILO], canAdjust: true, onAction: vi.fn() });

    expect(spec.items.map((item) => item.label)).toEqual([
      'Lotes',
      'Historial',
      'Ajustar existencia',
      'Editar',
      'Borrar',
    ]);
    expect(spec.items.map((item) => item.testId)).toEqual(CON_AJUSTE);
  });

  it('R9, R14 — solo «Borrar» lleva separador delante y es destructivo', () => {
    const spec = productRowActionsSpec({ product: producto(), canAdjust: true, onAction: vi.fn() });

    expect(spec.items.filter((item) => item.separatorBefore === true).map((item) => item.key)).toEqual(['delete']);
    expect(spec.items.filter((item) => item.destructive === true).map((item) => item.key)).toEqual(['delete']);
  });

  it('R10 — sin permiso de ajuste no ofrece «Ajustar existencia»; el resto sigue igual', () => {
    const spec = productRowActionsSpec({ product: producto(), canAdjust: false, onAction: vi.fn() });

    expect(spec.items.map((item) => item.testId)).toEqual(CON_AJUSTE.filter((id) => id !== 'product-adjust-open'));
    expect(spec.items.map((item) => item.label)).not.toContain(PRODUCT_ROW_ACTION_LABELS.adjust);
  });

  it('R9 — el disparador se llama «Acciones de <nombre · unidad>», con su testid y data-product-id', () => {
    const spec = productRowActionsSpec({ product: producto(), units: [KILO], canAdjust: true, onAction: vi.fn() });

    expect(spec.triggerLabel).toBe('Acciones de Jabon · Botella 500 ml · kg');
    expect(spec.triggerTestId).toBe('product-row-actions');
    expect(spec.triggerDataAttributes).toEqual({ 'data-product-id': 'product-1' });
  });

  it('R13 — el titulo del menu centrado es el nombre del producto, sin la presentacion', () => {
    const spec = productRowActionsSpec({ product: producto(), units: [KILO], canAdjust: true, onAction: vi.fn() });

    expect(spec.title).toBe('Jabon');
  });

  it('R9 — cada item avisa de su accion con el producto de la fila', () => {
    const onAction = vi.fn<(action: ProductRowAction, product: ProductView) => void>();
    const product = producto();
    const spec = productRowActionsSpec({ product, canAdjust: true, onAction });

    for (const item of spec.items) item.onSelect?.();

    expect(onAction.mock.calls).toEqual([
      ['batches', product],
      ['history', product],
      ['adjust', product],
      ['edit', product],
      ['delete', product],
    ]);
  });
});

describe('ProductRowActions', () => {
  it('R9, R14 — el desplegable pinta los cinco items con una linea antes de «Borrar»', async () => {
    const user = setupUser();
    render(<ProductRowActions product={producto()} units={[KILO]} canAdjust onAction={vi.fn()} />);

    const disparador = screen.getByRole('button', { name: 'Acciones de Jabon · Botella 500 ml · kg' });
    expect(disparador).toHaveAttribute('data-testid', 'product-row-actions');
    expect(disparador).toHaveAttribute('data-product-id', 'product-1');
    await user.click(disparador);
    const menu = await screen.findByRole('menu');

    expect(within(menu).getAllByRole('menuitem').map((item) => item.getAttribute('data-testid'))).toEqual(CON_AJUSTE);
    const separadores = within(menu).queryAllByRole('separator', { hidden: true });
    expect(separadores).toHaveLength(1);
    expect(separadores[0]?.nextElementSibling).toBe(within(menu).getByTestId('product-delete-open'));
  });

  it('R9 — elegir un item avisa con su accion', async () => {
    const user = setupUser();
    const onAction = vi.fn();
    const product = producto();
    render(<ProductRowActions product={product} canAdjust onAction={onAction} />);

    await user.click(screen.getByTestId('product-row-actions'));
    const menu = await screen.findByRole('menu');
    await user.click(await esperarInteractiva(within(menu).getByTestId('product-history-open')));

    expect(onAction).toHaveBeenCalledWith('history', product);
  });

  it('R13, R14 — centrado: titulo con el nombre, items de 48 px y el mismo separador', async () => {
    const user = setupUser();
    render(
      <ProductRowActions
        product={producto()}
        canAdjust
        onAction={vi.fn()}
        presentation="centered"
        texts={{ actions: 'Acciones', close: 'Cerrar' }}
      />,
    );

    await user.click(screen.getByTestId('product-row-actions'));
    const dialogo = await screen.findByRole('dialog', { name: 'Jabon' });

    for (const testId of CON_AJUSTE) {
      expect(within(dialogo).getByTestId(testId).className).toContain('min-h-12');
    }
    const separadores = within(dialogo).queryAllByRole('separator', { hidden: true });
    expect(separadores).toHaveLength(1);
    expect(separadores[0]?.nextElementSibling).toBe(within(dialogo).getByTestId('product-delete-open'));
  });
});
