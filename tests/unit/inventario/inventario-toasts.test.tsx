import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdjustBatchDialog, DeleteProductDialog, ProductSheet } from '@/app/(private)/inventario/components';
import {
  DIALOG_SUBMIT_TESTID,
  InventoryImportScreen,
  MISSING_CREATE_TESTID,
  MISSING_PRESENTATION_TESTID,
  MISSING_UNIT_TESTID,
  PRESENTATION_CREATED_TOAST,
  PRESENTATION_DIALOG_TESTID,
  REJECTION_TITLE,
  REVIEW_BUTTON_TESTID,
  UNIT_CREATED_TOAST,
  UNIT_DIALOG_TESTID,
  UPLOAD_INPUT_TESTID,
} from '@/app/(private)/inventario/importar/components';
import { PRODUCT_TYPES, type ProductBatchView, type ProductView } from '@/lib/modules/inventario';
import type { AdjustBatchStockFormState } from '@/lib/modules/inventario/adapters/driving/batch-actions';
import type { PreviewInventoryImportResult } from '@/lib/modules/inventario/adapters/driving/inventory-import-actions';
import type { CreatePresentationFormState } from '@/lib/modules/inventario/adapters/driving/presentation-actions';
import type { ProductMutationFormState } from '@/lib/modules/inventario/adapters/driving/product-actions';
import type { CreateUnitFormState } from '@/lib/modules/unidades/adapters/driving/unit-actions';

import { ADJUST_FORM_STATES } from '../../fixtures/adjust-batch-stock';
import { esperarInteractiva, setupUser } from '../../helpers/user-event';
import { vistaPrevia } from './importar/import-preview-fixtures';

/**
 * Un único aviso de éxito por cada éxito de la ruta y ninguno de error. Las Server Actions son el
 * borde del módulo y van simuladas; el formulario de producto se sustituye por un botón que llama a
 * `onSaved`, porque el aviso del alta y de la edición lo lanza el panel, no el formulario.
 */

const {
  routerMock,
  adjustMock,
  deleteMock,
  previewMock,
  createUnitMock,
  createPresentationMock,
} = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  adjustMock: vi.fn<(prev: AdjustBatchStockFormState, data: FormData) => Promise<AdjustBatchStockFormState>>(),
  deleteMock: vi.fn<(prev: ProductMutationFormState, data: FormData) => Promise<ProductMutationFormState>>(),
  previewMock: vi.fn<(formData: FormData) => Promise<PreviewInventoryImportResult>>(),
  createUnitMock: vi.fn<(prev: CreateUnitFormState, formData: FormData) => Promise<CreateUnitFormState>>(),
  createPresentationMock:
    vi.fn<(prev: CreatePresentationFormState, formData: FormData) => Promise<CreatePresentationFormState>>(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() },
}));

vi.mock('@/lib/modules/inventario/adapters/driving/batch-actions', () => ({
  adjustBatchStockAction: adjustMock,
}));

vi.mock('@/lib/modules/inventario/adapters/driving/product-actions', () => ({
  createProductAction: vi.fn(),
  updateProductAction: vi.fn(),
  deleteProductAction: deleteMock,
}));

vi.mock('@/lib/modules/inventario/adapters/driving/inventory-import-actions', () => ({
  previewInventoryImportAction: previewMock,
  confirmInventoryImportAction: vi.fn(),
}));

vi.mock('@/lib/modules/unidades/adapters/driving/unit-actions', () => ({
  createUnitAction: createUnitMock,
}));

vi.mock('@/lib/modules/inventario/adapters/driving/presentation-actions', () => ({
  createPresentationAction: createPresentationMock,
}));

const LOTE = 'L-2026-07';

vi.mock('@/app/(private)/inventario/components/product-form', () => ({
  ProductForm: ({ product, onSaved }: { product?: ProductView; onSaved: (lot?: string) => void }) => (
    <button type="button" data-testid="product-form-saved" onClick={() => onSaved(product ? undefined : LOTE)}>
      Guardar
    </button>
  ),
}));

function producto(): ProductView {
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
  };
}

function lote(): ProductBatchView {
  return {
    id: 'batch-42',
    lot: 'L-001',
    stock: '10',
    unitId: 'unit-kg',
    purchaseDate: '2026-03-05',
    expiryDate: null,
    packageContent: null,
  };
}

const ARCHIVO = new File(['Tipo;Nombre'], 'inventario.csv', { type: 'text/csv' });

const RECHAZO = { kind: 'file_rejected', rejection: { code: 'unreadable' } } as const;

beforeEach(() => {
  vi.clearAllMocks();
  adjustMock.mockResolvedValue(ADJUST_FORM_STATES.success);
  deleteMock.mockResolvedValue({ status: 'success' });
  previewMock.mockResolvedValue({ status: 'success', data: vistaPrevia() });
  createUnitMock.mockResolvedValue({ status: 'success', id: 'unidad-nueva' });
  createPresentationMock.mockResolvedValue({ status: 'success', id: 'presentacion-nueva' });
});

afterEach(cleanup);

function unSoloExito(texto: string) {
  expect(toast.success).toHaveBeenCalledTimes(1);
  expect(toast.success).toHaveBeenCalledWith(texto);
}

async function crearFaltante(seccion: string, dialogo: string) {
  const user = setupUser();
  render(<InventoryImportScreen units={[]} />);
  await user.upload(screen.getByTestId(UPLOAD_INPUT_TESTID), ARCHIVO);
  await user.click(screen.getByTestId(REVIEW_BUTTON_TESTID));
  await user.click(within(await screen.findByTestId(seccion)).getByTestId(MISSING_CREATE_TESTID));
  await screen.findByTestId(dialogo);
  await user.click(screen.getByTestId(DIALOG_SUBMIT_TESTID));
  await waitFor(() => expect(previewMock).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByTestId(dialogo)).toBeNull());
}

describe('avisos de éxito de inventario', () => {
  it('R27 — crear un producto avisa una sola vez «Producto creado. Lote <lote>.»', async () => {
    const user = setupUser();
    render(<ProductSheet />);

    await user.click(screen.getByTestId('product-create-open'));
    await user.click(await screen.findByTestId('product-form-saved'));

    unSoloExito(`Producto creado. Lote ${LOTE}.`);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('R27 — editar un producto avisa una sola vez «Producto actualizado.»', async () => {
    const user = setupUser();
    render(<ProductSheet product={producto()} />);

    await user.click(screen.getByTestId('product-edit-open'));
    await user.click(await screen.findByTestId('product-form-saved'));

    unSoloExito('Producto actualizado.');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('R27 — ajustar una existencia avisa una sola vez «Existencia ajustada.»', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await user.click(screen.getByTestId('adjust-batch-open'));
    const campo = screen.getByTestId('adjust-batch-counted');
    await user.clear(campo);
    await user.type(campo, '7');
    await user.click(screen.getByTestId('adjust-batch-reason'));
    await user.click(await esperarInteractiva(await screen.findByRole('option', { name: 'Merma' })));
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Merma' })).toBeNull());
    await user.click(screen.getByTestId('adjust-batch-confirm'));

    await waitFor(() => expect(screen.queryByTestId('adjust-batch-dialog')).toBeNull());
    unSoloExito('Existencia ajustada.');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('R27 — borrar un producto avisa una sola vez «Producto borrado.»', async () => {
    const user = setupUser();
    render(<DeleteProductDialog product={producto()} />);

    await user.click(screen.getByTestId('product-delete-open'));
    await user.click(await screen.findByTestId('delete-product-confirm'));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    unSoloExito('Producto borrado.');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('R28, R51 — crear una unidad avisa una sola vez «Unidad creada.» y la nueva revisión no avisa', async () => {
    await crearFaltante(MISSING_UNIT_TESTID, UNIT_DIALOG_TESTID);

    unSoloExito(UNIT_CREATED_TOAST);
    expect(UNIT_CREATED_TOAST).toBe('Unidad creada.');
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('R28, R51 — crear una presentación avisa una sola vez «Presentación creada.» y la nueva revisión no avisa', async () => {
    await crearFaltante(MISSING_PRESENTATION_TESTID, PRESENTATION_DIALOG_TESTID);

    unSoloExito(PRESENTATION_CREATED_TOAST);
    expect(PRESENTATION_CREATED_TOAST).toBe('Presentación creada.');
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('R28, R51 — si la revisión que sigue al alta se rechaza, avisa el alta y además el rechazo', async () => {
    previewMock
      .mockResolvedValueOnce({ status: 'success', data: vistaPrevia() })
      .mockResolvedValueOnce({ status: 'success', data: RECHAZO });

    await crearFaltante(MISSING_UNIT_TESTID, UNIT_DIALOG_TESTID);

    unSoloExito(UNIT_CREATED_TOAST);
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(vi.mocked(toast.error).mock.calls[0]?.[0]).toBe(REJECTION_TITLE);
  });

  it('R28 — un alta de unidad con error no avisa de éxito', async () => {
    createUnitMock.mockResolvedValue({ status: 'error', code: 'unit_duplicate_name', message: 'Ya existe.' });
    const user = setupUser();
    render(<InventoryImportScreen units={[]} />);
    await user.upload(screen.getByTestId(UPLOAD_INPUT_TESTID), ARCHIVO);
    await user.click(screen.getByTestId(REVIEW_BUTTON_TESTID));
    await user.click(within(await screen.findByTestId(MISSING_UNIT_TESTID)).getByTestId(MISSING_CREATE_TESTID));
    await screen.findByTestId(UNIT_DIALOG_TESTID);
    await user.click(screen.getByTestId(DIALOG_SUBMIT_TESTID));

    await waitFor(() => expect(createUnitMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId(UNIT_DIALOG_TESTID)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
    expect(previewMock).toHaveBeenCalledTimes(1);
  });
});
