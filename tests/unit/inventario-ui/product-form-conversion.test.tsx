// Aviso de conversion en el alta de insumo: un homonimo en otra unidad de la misma familia recibe
// el lote convertido. Las Server Actions son dobles.

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductForm, ProductSheet } from '@/app/(private)/inventario/components';
import {
  SUPPLY_CONVERSION_COST_LINE_TESTID,
  SUPPLY_CONVERSION_NOTICE_TESTID,
  SUPPLY_CONVERSION_STOCK_LINE_TESTID,
} from '@/app/(private)/inventario/components/supply-conversion-notice';
import {
  PRESENTATION_UNIT_HINT_TESTID,
  PRESENTATION_UNIT_SELECT_TESTID,
} from '@/components/shared/presentation-unit-select';
import { Sheet } from '@/components/ui/sheet';
import { errorMessage } from '@/lib/modules/errores';
import { PRODUCT_TYPES, type ProductFormUnits, type SupplyHomonym } from '@/lib/modules/inventario';
import type { UnitRef } from '@/lib/modules/unidades';
import { esperarInteractiva, setupUser } from '../../helpers/user-event';

const {
  createProductActionMock,
  findSupplyHomonymsActionMock,
  listProductsActionMock,
  listPresentationsActionMock,
} = vi.hoisted(() => ({
  createProductActionMock: vi.fn<(prev: unknown, data: FormData) => Promise<unknown>>(),
  findSupplyHomonymsActionMock: vi.fn<(name: unknown) => Promise<unknown>>(),
  listProductsActionMock: vi.fn<(query: unknown) => Promise<unknown>>(),
  listPresentationsActionMock: vi.fn<(query: unknown) => Promise<unknown>>(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/product-actions', () => ({
  createProductAction: createProductActionMock,
  updateProductAction: vi.fn(),
  listProductsAction: listProductsActionMock,
  findSupplyHomonymsAction: findSupplyHomonymsActionMock,
  deleteProductAction: vi.fn(),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/presentation-actions', () => ({
  listPresentationsAction: listPresentationsActionMock,
  createPresentationAction: vi.fn(),
}));

const LITRO: UnitRef = { id: crypto.randomUUID(), name: 'Litro', symbol: 'l', baseUnitId: null, factor: null };
const MILILITRO: UnitRef = {
  id: crypto.randomUUID(),
  name: 'Mililitro',
  symbol: 'ml',
  baseUnitId: LITRO.id,
  factor: '0.001',
};
const KILOGRAMO: UnitRef = {
  id: crypto.randomUUID(),
  name: 'Kilogramo',
  symbol: 'kg',
  baseUnitId: null,
  factor: null,
};
const UNIDADES: ProductFormUnits = [LITRO, MILILITRO, KILOGRAMO];

const NOMBRE = 'Glicerina';
const ESPERA_DEL_REBOTE = { timeout: 3_000 };

function homonimo(unit: UnitRef, stock: string): SupplyHomonym {
  return { id: crypto.randomUUID(), name: NOMBRE, type: PRODUCT_TYPES.PRODUCT, unitId: unit.id, stock };
}

function homonimosDevueltos(homonimos: readonly SupplyHomonym[]) {
  findSupplyHomonymsActionMock.mockResolvedValue({ status: 'success', data: homonimos });
}

function montarAlta(onSaved = vi.fn()) {
  render(
    <Sheet open>
      <ProductForm units={UNIDADES} formUnits={UNIDADES} onSaved={onSaved} />
    </Sheet>,
  );
  return onSaved;
}

type Usuario = ReturnType<typeof setupUser>;

async function elegirUnidad(user: Usuario, etiqueta: string) {
  await user.click(screen.getByTestId(PRESENTATION_UNIT_SELECT_TESTID));
  await user.click(await esperarInteractiva(await screen.findByRole('option', { name: etiqueta })));
  await waitFor(() =>
    expect(screen.getByTestId(PRESENTATION_UNIT_SELECT_TESTID)).not.toHaveAttribute('aria-expanded', 'true'),
  );
}

async function escribirExistencia(user: Usuario, existencia: string) {
  const campo = screen.getByTestId('product-field-stock');
  await user.clear(campo);
  await user.type(campo, existencia);
}

async function rellenarAlta(
  user: Usuario,
  { unidad, existencia, costo }: { unidad: string; existencia: string; costo?: string },
) {
  await user.type(screen.getByTestId('product-field-name'), NOMBRE);
  await elegirUnidad(user, unidad);
  await escribirExistencia(user, existencia);
  await user.type(screen.getByTestId('product-field-qtyAlert'), '1');
  if (costo !== undefined) await user.type(screen.getByLabelText('Costo unitario'), costo);
}

/** Deja que la consulta de homonimos responda antes de afirmar que NO hay aviso. */
async function esperarConsultaDeHomonimos() {
  await waitFor(() => expect(findSupplyHomonymsActionMock).toHaveBeenCalled(), ESPERA_DEL_REBOTE);
  await act(async () => {
    await Promise.resolve();
  });
}

function aviso() {
  return screen.findByTestId(SUPPLY_CONVERSION_NOTICE_TESTID, {}, ESPERA_DEL_REBOTE);
}

beforeEach(() => {
  vi.clearAllMocks();
  listProductsActionMock.mockResolvedValue({
    status: 'success',
    data: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 },
  });
  listPresentationsActionMock.mockResolvedValue({
    status: 'success',
    data: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 },
  });
  homonimosDevueltos([]);
  createProductActionMock.mockResolvedValue({ status: 'success', id: crypto.randomUUID(), lot: '1' });
});

afterEach(() => {
  cleanup();
});

describe('aviso de conversion en el alta de insumo', () => {
  it('R13 con homónimo en l y alta en ml muestra aviso con cantidad y costo convertidos y la ayuda bajo Unidad', async () => {
    const user = setupUser();
    homonimosDevueltos([homonimo(LITRO, '2.0000')]);
    montarAlta();

    await rellenarAlta(user, { unidad: 'ml', existencia: '500', costo: '0.40' });

    const avisoPintado = await aviso();
    expect(avisoPintado).toHaveAttribute('role', 'status');
    expect(avisoPintado).toHaveTextContent('Ya existe Glicerina en l');
    expect(avisoPintado).toHaveTextContent('El lote se agregará a ese producto, convertido a l:');
    expect(screen.getByTestId(SUPPLY_CONVERSION_STOCK_LINE_TESTID)).toHaveTextContent('500 ml = 0,5 l');
    expect(screen.getByTestId(SUPPLY_CONVERSION_COST_LINE_TESTID)).toHaveTextContent(
      '0,4 por ml = 400 por l',
    );

    const ayuda = screen.getByTestId(PRESENTATION_UNIT_HINT_TESTID);
    expect(ayuda).toHaveTextContent('Misma familia que l: se convierte al guardar.');
    expect(screen.getByTestId(PRESENTATION_UNIT_SELECT_TESTID)).toHaveAccessibleDescription(
      'Misma familia que l: se convierte al guardar.',
    );
    expect(findSupplyHomonymsActionMock).toHaveBeenLastCalledWith(NOMBRE);
  });

  it('R13 se recalcula al cambiar la unidad o la existencia sin volver a pedir', async () => {
    const user = setupUser();
    homonimosDevueltos([homonimo(LITRO, '2.0000')]);
    montarAlta();

    await rellenarAlta(user, { unidad: 'ml', existencia: '500' });
    await aviso();
    expect(screen.getByTestId(SUPPLY_CONVERSION_STOCK_LINE_TESTID)).toHaveTextContent('500 ml = 0,5 l');

    await escribirExistencia(user, '250');
    expect(screen.getByTestId(SUPPLY_CONVERSION_STOCK_LINE_TESTID)).toHaveTextContent('250 ml = 0,25 l');

    await elegirUnidad(user, 'l');
    expect(screen.queryByTestId(SUPPLY_CONVERSION_NOTICE_TESTID)).toBeNull();
    expect(screen.queryByTestId(PRESENTATION_UNIT_HINT_TESTID)).toBeNull();

    await elegirUnidad(user, 'ml');
    expect(screen.getByTestId(SUPPLY_CONVERSION_STOCK_LINE_TESTID)).toHaveTextContent('250 ml = 0,25 l');

    expect(findSupplyHomonymsActionMock).toHaveBeenCalledTimes(1);
  });

  it('R13 sin costo unitario el aviso no trae la línea de costo', async () => {
    const user = setupUser();
    homonimosDevueltos([homonimo(LITRO, '2.0000')]);
    montarAlta();

    await rellenarAlta(user, { unidad: 'ml', existencia: '500' });

    await aviso();
    expect(screen.getByTestId(SUPPLY_CONVERSION_STOCK_LINE_TESTID)).toHaveTextContent('500 ml = 0,5 l');
    expect(screen.queryByTestId(SUPPLY_CONVERSION_COST_LINE_TESTID)).toBeNull();
  });

  it('R14 con varios homónimos nombra cada uno y el destino', async () => {
    const user = setupUser();
    homonimosDevueltos([homonimo(LITRO, '2.0000'), homonimo(MILILITRO, '500.0000')]);
    montarAlta();

    await rellenarAlta(user, { unidad: 'ml', existencia: '200' });

    const avisoPintado = await aviso();
    expect(avisoPintado).toHaveTextContent('Ya existen Glicerina en l (2 l) y en ml (500 ml)');
    expect(avisoPintado).toHaveTextContent(
      'El lote va a la que tiene más existencia, Glicerina · l, convertido:',
    );
    expect(screen.getByTestId(SUPPLY_CONVERSION_STOCK_LINE_TESTID)).toHaveTextContent('200 ml = 0,2 l');

    // Destino en la misma unidad del alta: el aviso sigue diciendo a cual va, sin convertir.
    await elegirUnidad(user, 'l');
    const mismaUnidad = screen.getByTestId(SUPPLY_CONVERSION_NOTICE_TESTID);
    expect(mismaUnidad).toHaveTextContent('Ya existen Glicerina en l (2 l) y en ml (500 ml)');
    expect(mismaUnidad).toHaveTextContent('El lote va a la que tiene más existencia, Glicerina · l.');
    expect(screen.queryByTestId(SUPPLY_CONVERSION_STOCK_LINE_TESTID)).toBeNull();
    expect(screen.queryByTestId(PRESENTATION_UNIT_HINT_TESTID)).toBeNull();
  });

  it('R15 sin homónimo o con uno en la misma unidad no hay aviso', async () => {
    const user = setupUser();
    montarAlta();
    await rellenarAlta(user, { unidad: 'ml', existencia: '500' });
    await esperarConsultaDeHomonimos();
    expect(screen.queryByTestId(SUPPLY_CONVERSION_NOTICE_TESTID)).toBeNull();
    expect(screen.queryByTestId(PRESENTATION_UNIT_HINT_TESTID)).toBeNull();
    cleanup();

    vi.clearAllMocks();
    homonimosDevueltos([homonimo(MILILITRO, '300.0000')]);
    montarAlta();
    await rellenarAlta(user, { unidad: 'ml', existencia: '500' });
    await esperarConsultaDeHomonimos();
    expect(screen.queryByTestId(SUPPLY_CONVERSION_NOTICE_TESTID)).toBeNull();
    expect(screen.queryByTestId(PRESENTATION_UNIT_HINT_TESTID)).toBeNull();
    cleanup();

    // Otra familia tampoco cuenta.
    vi.clearAllMocks();
    homonimosDevueltos([homonimo(KILOGRAMO, '3.0000')]);
    montarAlta();
    await rellenarAlta(user, { unidad: 'ml', existencia: '500' });
    await esperarConsultaDeHomonimos();
    expect(screen.queryByTestId(SUPPLY_CONVERSION_NOTICE_TESTID)).toBeNull();
    expect(screen.queryByTestId(PRESENTATION_UNIT_HINT_TESTID)).toBeNull();
  });

  it('R16 cantidad que no cabe: error bajo Existencia y no envía', async () => {
    const user = setupUser();
    homonimosDevueltos([homonimo(LITRO, '2.0000')]);
    const onSaved = montarAlta();

    await rellenarAlta(user, { unidad: 'ml', existencia: '0.25', costo: '0.40' });
    await aviso();
    await user.click(screen.getByTestId('product-form-submit'));

    expect(await screen.findByTestId('product-error-stock')).toHaveTextContent(
      '0,25 ml son 0,00025 l y no caben en 4 decimales. Ingresa la existencia en l.',
    );
    expect(screen.getByTestId('product-field-stock')).toHaveAttribute('aria-invalid', 'true');
    expect(createProductActionMock).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByTestId('product-field-name')).toHaveValue(NOMBRE);
    expect(screen.getByTestId('product-field-stock')).toHaveValue('0.25');
    expect(screen.getByLabelText('Costo unitario')).toHaveValue('0.40');
  });

  it('R16 costo que no cabe: error bajo Costo unitario', async () => {
    const user = setupUser();
    homonimosDevueltos([homonimo(MILILITRO, '500.0000')]);
    const onSaved = montarAlta();

    await rellenarAlta(user, { unidad: 'l', existencia: '2', costo: '0.25' });
    const avisoPintado = await aviso();
    expect(avisoPintado).toHaveTextContent('Ya existe Glicerina en ml');
    await user.click(screen.getByTestId('product-form-submit'));

    expect(await screen.findByTestId('product-error-unitCost')).toHaveTextContent(
      'El costo por ml quedaría en 0,00025 y no cabe en 4 decimales. Ingresa el lote en ml.',
    );
    expect(screen.getByLabelText('Costo unitario')).toHaveAttribute('aria-invalid', 'true');
    expect(createProductActionMock).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Costo unitario')).toHaveValue('0.25');
  });

  it('R16 el rechazo del servidor con converted_stock_out_of_range va a Existencia', async () => {
    const user = setupUser();
    // El aviso no vio el homonimo (p. ej. nacio despues); decide el servidor.
    createProductActionMock.mockResolvedValue({
      status: 'error',
      code: 'converted_stock_out_of_range',
      message: errorMessage('converted_stock_out_of_range'),
    });
    const onSaved = montarAlta();

    await rellenarAlta(user, { unidad: 'ml', existencia: '0.25', costo: '0.40' });
    await user.click(screen.getByTestId('product-form-submit'));

    expect(await screen.findByTestId('product-error-stock')).toHaveTextContent(
      errorMessage('converted_stock_out_of_range'),
    );
    expect(screen.getByTestId('product-field-stock')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByTestId('product-form-error')).toBeNull();
    expect(createProductActionMock).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByTestId('product-field-stock')).toHaveValue('0.25');
  });

  it('R17 el toast nombra la cantidad convertida y el destino', async () => {
    const user = setupUser();
    const toastExito = vi.spyOn(toast, 'success');
    homonimosDevueltos([homonimo(LITRO, '2.0000')]);
    createProductActionMock.mockResolvedValue({
      status: 'success',
      id: crypto.randomUUID(),
      lot: '7',
      conversion: { productName: NOMBRE, stock: '0.5000', unitId: LITRO.id },
    });
    render(<ProductSheet units={UNIDADES} formUnits={UNIDADES} open onOpenChange={vi.fn()} />);

    await rellenarAlta(user, { unidad: 'ml', existencia: '500', costo: '0.40' });
    await aviso();
    await user.click(screen.getByTestId('product-form-submit'));

    await waitFor(() => expect(toastExito).toHaveBeenCalledTimes(1));
    expect(toastExito).toHaveBeenCalledWith('Se agregó un lote de 0,5 l a Glicerina · l.');
  });
});
