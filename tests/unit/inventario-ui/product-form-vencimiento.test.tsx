// El rechazo del servidor por vencimiento no posterior a hoy (`batch_expiry_not_future`) se pinta
// en el campo de la fecha de expiracion, con el mensaje que manda el servidor, y no en la region
// general del formulario. El resto de rechazos del alta siguen yendo a esa region.

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductForm } from '@/app/(private)/inventario/components';
import { PRESENTATION_UNIT_SELECT_TESTID } from '@/components/shared/presentation-unit-select';
import { Sheet } from '@/components/ui/sheet';
import type { ProductFormUnits } from '@/lib/modules/inventario';
import type { UnitRef } from '@/lib/modules/unidades';
import { esperarInteractiva, setupUser } from '../../helpers/user-event';

const { createProductActionMock, listProductsActionMock } = vi.hoisted(() => ({
  createProductActionMock: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  listProductsActionMock: vi.fn<(query: unknown) => Promise<unknown>>(),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/product-actions', () => ({
  createProductAction: createProductActionMock,
  updateProductAction: vi.fn(),
  listProductsAction: listProductsActionMock,
  listProductFormUnitsAction: vi.fn(),
  deleteProductAction: vi.fn(),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/presentation-actions', () => ({
  listPresentationsAction: vi.fn(),
  createPresentationAction: vi.fn(),
}));

const MENSAJE_SERVIDOR = 'La fecha de vencimiento debe ser posterior a hoy.';

const KILOGRAMO: UnitRef = { id: crypto.randomUUID(), name: 'Kilogramo', symbol: 'kg', baseUnitId: null, factor: null };
const UNIDADES: ProductFormUnits = [KILOGRAMO];

function montar() {
  render(
    <Sheet open>
      <ProductForm units={UNIDADES} formUnits={UNIDADES} onSaved={vi.fn()} />
    </Sheet>,
  );
}

async function rellenarYEnviar(user: ReturnType<typeof setupUser>) {
  await user.type(screen.getByTestId('product-field-name'), 'Sosa');
  await user.click(screen.getByTestId(PRESENTATION_UNIT_SELECT_TESTID));
  await user.click(await esperarInteractiva(await screen.findByRole('option', { name: 'kg' })));
  await user.type(screen.getByTestId('product-field-stock'), '12');
  await user.type(screen.getByTestId('product-field-qtyAlert'), '1');
  await user.type(screen.getByLabelText('Costo unitario'), '2.50');
  await user.click(screen.getByTestId('product-form-submit'));
}

beforeEach(() => {
  vi.clearAllMocks();
  listProductsActionMock.mockResolvedValue({
    status: 'success',
    data: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 },
  });
});

afterEach(() => {
  cleanup();
});

describe('rechazo del alta por vencimiento no posterior a hoy', () => {
  it('pinta el mensaje del servidor en el campo de expiracion y no en la region general', async () => {
    createProductActionMock.mockResolvedValue({
      status: 'error',
      code: 'batch_expiry_not_future',
      message: MENSAJE_SERVIDOR,
    });
    const user = setupUser();
    montar();

    await rellenarYEnviar(user);

    await waitFor(() => expect(createProductActionMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('product-error-expiryDate')).toHaveTextContent(MENSAJE_SERVIDOR);
    expect(screen.queryByTestId('product-form-error')).toBeNull();
  });

  it('cualquier otro rechazo del servidor sigue en la region general del formulario', async () => {
    createProductActionMock.mockResolvedValue({
      status: 'error',
      code: 'unauthorized',
      message: 'No tienes permiso para esta acción.',
    });
    const user = setupUser();
    montar();

    await rellenarYEnviar(user);

    expect(await screen.findByTestId('product-form-error')).toBeInTheDocument();
    expect(screen.queryByTestId('product-error-expiryDate')).toBeNull();
  });
});
