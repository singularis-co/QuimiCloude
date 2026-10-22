// La imagen del producto en el formulario de alta y edicion. Las Server Actions son dobles: aqui
// se comprueba que argumento recibe cada una segun el estado del campo.

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductForm } from '@/app/(private)/inventario/components';
import { PRESENTATION_UNIT_SELECT_TESTID } from '@/components/shared/presentation-unit-select';
import { Sheet } from '@/components/ui/sheet';
import { PRODUCT_TYPES, type ProductFormUnits, type ProductView } from '@/lib/modules/inventario';
import type { UnitRef } from '@/lib/modules/unidades';
import { esperarInteractiva, setupUser } from '../../helpers/user-event';

const { createProductActionMock, updateProductActionMock, listProductsActionMock } = vi.hoisted(
  () => ({
    createProductActionMock: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    updateProductActionMock: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    listProductsActionMock: vi.fn<(query: unknown) => Promise<unknown>>(),
  }),
);

vi.mock('@/lib/modules/inventario/adapters/driving/product-actions', () => ({
  createProductAction: createProductActionMock,
  updateProductAction: updateProductActionMock,
  listProductsAction: listProductsActionMock,
  listProductFormUnitsAction: vi.fn(),
  deleteProductAction: vi.fn(),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/presentation-actions', () => ({
  listPresentationsAction: vi.fn(),
  createPresentationAction: vi.fn(),
}));

const PREFIX = 'product-form-image';
const IMAGEN_GUARDADA = 'https://storage.example/productos/acido.png';
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngValido(): File {
  const bytes = new Uint8Array([...PNG_SIGNATURE, ...new Array(16).fill(0)]);
  return new File([bytes], 'foto.png', { type: 'image/png' });
}

function textoDisfrazadoDePng(): File {
  // `user-event` filtra por `accept` y el navegador fija el tipo por la extension: el rechazo
  // tiene que salir de la firma de los bytes.
  return new File([new TextEncoder().encode('no es una imagen')], 'falso.png', { type: 'image/png' });
}

const KILOGRAMO: UnitRef = { id: crypto.randomUUID(), name: 'Kilogramo', symbol: 'kg', baseUnitId: null, factor: null };
const UNIDADES: ProductFormUnits = [KILOGRAMO];

function insumo(overrides: Partial<ProductView> = {}): ProductView {
  return {
    id: crypto.randomUUID(),
    name: 'Ácido cítrico',
    imagePath: 'productos/acido.png',
    imageUrl: IMAGEN_GUARDADA,
    stock: '10.0000',
    unitId: KILOGRAMO.id,
    qtyAlert: '3.0000',
    type: PRODUCT_TYPES.PRODUCT,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  };
}

function montar(product?: ProductView) {
  render(
    <Sheet open>
      <ProductForm product={product} units={UNIDADES} formUnits={UNIDADES} onSaved={vi.fn()} />
    </Sheet>,
  );
}

async function rellenarAlta(user: ReturnType<typeof setupUser>) {
  await user.type(screen.getByTestId('product-field-name'), 'Sosa');
  await user.click(screen.getByTestId(PRESENTATION_UNIT_SELECT_TESTID));
  await user.click(await esperarInteractiva(await screen.findByRole('option', { name: 'kg' })));
  await user.type(screen.getByTestId('product-field-stock'), '12');
  await user.type(screen.getByTestId('product-field-qtyAlert'), '1');
  await user.type(screen.getByLabelText('Costo unitario'), '2.50');
}

beforeEach(() => {
  vi.clearAllMocks();
  listProductsActionMock.mockResolvedValue({
    status: 'success',
    data: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 },
  });
  createProductActionMock.mockResolvedValue({ status: 'success', id: crypto.randomUUID(), lot: '1' });
  updateProductActionMock.mockResolvedValue({ status: 'success' });
  // jsdom no implementa `URL.createObjectURL`.
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:product-image-preview'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('imagen del producto en el alta', () => {
  it('sin imagen, la action del alta no recibe el argumento de imagen y no se ofrece quitar', async () => {
    const user = setupUser();
    montar();

    expect(screen.getByTestId(`${PREFIX}-empty-image`)).toBeInTheDocument();
    expect(screen.queryByTestId(`${PREFIX}-clear`)).toBeNull();

    await rellenarAlta(user);
    await user.click(screen.getByTestId('product-form-submit'));

    await waitFor(() => expect(createProductActionMock).toHaveBeenCalledTimes(1));
    expect(createProductActionMock.mock.calls[0]).toHaveLength(2);
  });

  it('con una imagen valida, la action del alta recibe sus bytes', async () => {
    const user = setupUser();
    montar();

    await user.upload(screen.getByTestId(`${PREFIX}-input`), pngValido());
    expect(await screen.findByTestId(`${PREFIX}-preview`)).toHaveAttribute(
      'src',
      'blob:product-image-preview',
    );

    await rellenarAlta(user);
    await user.click(screen.getByTestId('product-form-submit'));

    await waitFor(() => expect(createProductActionMock).toHaveBeenCalledTimes(1));
    const image = createProductActionMock.mock.calls[0]?.[2] as { bytes: Uint8Array };
    expect(Array.from(image.bytes.slice(0, PNG_SIGNATURE.length))).toEqual(PNG_SIGNATURE);
  });

  it('la vista previa llena la zona sin recortarse y no pinta el nombre ni el tamano del archivo', async () => {
    const user = setupUser();
    montar();

    await user.upload(screen.getByTestId(`${PREFIX}-input`), pngValido());

    const preview = await screen.findByTestId(`${PREFIX}-preview`);
    expect(preview).toHaveClass('h-full', 'w-full', 'object-contain');
    expect(preview).not.toHaveClass('object-cover');
    expect(screen.getByTestId(`${PREFIX}-change-hint`)).toHaveTextContent(
      'Haz clic o arrastra otro para cambiarla',
    );
    const dropzone = screen.getByTestId(`${PREFIX}-dropzone`);
    expect(dropzone).not.toHaveTextContent('foto.png');
    expect(dropzone).not.toHaveTextContent(/\d+(\.\d+)?\s?(B|KB|MB)\b/);
    expect(screen.queryByTestId(`${PREFIX}-file-name`)).toBeNull();
    expect(screen.queryByTestId(`${PREFIX}-file-meta`)).toBeNull();
  });

  it('el Tipo va antes que el Nombre en el formulario y en el orden de tabulacion', () => {
    montar();

    const tipo = screen.getByRole('combobox', { name: /Tipo/ });
    const nombre = screen.getByTestId('product-field-name');
    expect(tipo.compareDocumentPosition(nombre) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('un archivo que no es JPEG/PNG/WebP por contenido se rechaza junto al campo', async () => {
    const user = setupUser();
    montar();

    await user.upload(screen.getByTestId(`${PREFIX}-input`), textoDisfrazadoDePng());

    expect(await screen.findByTestId(`${PREFIX}-error`)).toHaveTextContent(
      'Formato no admitido: usa JPEG, PNG o WebP.',
    );
    expect(screen.queryByTestId(`${PREFIX}-preview`)).toBeNull();
  });
});

describe('imagen del producto en la edicion', () => {
  it('sin tocar el campo, ensena la imagen guardada y la action no recibe imagen', async () => {
    const user = setupUser();
    montar(insumo());

    expect(screen.getByTestId(`${PREFIX}-preview`)).toHaveAttribute('src', IMAGEN_GUARDADA);

    await user.click(screen.getByTestId('product-form-submit'));

    await waitFor(() => expect(updateProductActionMock).toHaveBeenCalledTimes(1));
    expect(updateProductActionMock.mock.calls[0]).toHaveLength(3);
  });

  it('al quitarla, la action recibe null', async () => {
    const user = setupUser();
    montar(insumo());

    await user.click(screen.getByTestId(`${PREFIX}-clear`));
    expect(screen.queryByTestId(`${PREFIX}-preview`)).toBeNull();
    expect(screen.queryByTestId(`${PREFIX}-clear`)).toBeNull();

    await user.click(screen.getByTestId('product-form-submit'));

    await waitFor(() => expect(updateProductActionMock).toHaveBeenCalledTimes(1));
    expect(updateProductActionMock.mock.calls[0]).toHaveLength(4);
    expect(updateProductActionMock.mock.calls[0]?.[3]).toBeNull();
  });

  it('al reemplazarla, la action recibe los bytes nuevos', async () => {
    const user = setupUser();
    montar(insumo());

    await user.upload(screen.getByTestId(`${PREFIX}-input`), pngValido());
    await screen.findByTestId(`${PREFIX}-change-hint`);
    await user.click(screen.getByTestId('product-form-submit'));

    await waitFor(() => expect(updateProductActionMock).toHaveBeenCalledTimes(1));
    const image = updateProductActionMock.mock.calls[0]?.[3] as { bytes: Uint8Array };
    expect(Array.from(image.bytes.slice(0, PNG_SIGNATURE.length))).toEqual(PNG_SIGNATURE);
  });
});

const IMAGEN_SOSA = 'https://storage.example/productos/sosa.png';

function existentes() {
  const base = { qtyAlert: '3.0000', type: PRODUCT_TYPES.PRODUCT, unitId: KILOGRAMO.id };
  return {
    acido: { ...base, id: crypto.randomUUID(), name: 'Ácido cítrico', imageUrl: IMAGEN_GUARDADA },
    sosa: { ...base, id: crypto.randomUUID(), name: 'Sosa cáustica', imageUrl: IMAGEN_SOSA },
    glicerina: { ...base, id: crypto.randomUUID(), name: 'Glicerina', imageUrl: null },
  };
}

async function elegirExistente(user: ReturnType<typeof setupUser>, nombre: string) {
  await user.click(screen.getByTestId('product-field-name'));
  await user.click(await esperarInteractiva(await screen.findByRole('option', { name: nombre })));
  await waitFor(() => expect(screen.getByTestId('product-name-value')).toHaveValue(nombre));
}

describe('imagen del producto existente elegido en el alta', () => {
  let productos: ReturnType<typeof existentes>;

  beforeEach(() => {
    productos = existentes();
    const items = Object.values(productos);
    listProductsActionMock.mockResolvedValue({
      status: 'success',
      data: { items, page: 1, pageSize: 25, total: items.length, totalPages: 1 },
    });
  });

  it('al elegir un producto con imagen se ve su imagen y, sin tocarla, el alta no reenvia imagen', async () => {
    const user = setupUser();
    montar();

    await elegirExistente(user, productos.acido.name);
    expect(await screen.findByTestId(`${PREFIX}-preview`)).toHaveAttribute('src', IMAGEN_GUARDADA);
    expect(screen.queryByTestId(`${PREFIX}-clear`)).toBeNull();

    await user.type(screen.getByTestId('product-field-stock'), '12');
    await user.type(screen.getByLabelText('Costo unitario'), '2.50');
    await user.click(screen.getByTestId('product-form-submit'));

    await waitFor(() => expect(createProductActionMock).toHaveBeenCalledTimes(1));
    expect(createProductActionMock.mock.calls[0]).toHaveLength(2);
  });

  it('al cambiar a otro producto se ve la imagen del nuevo, o ninguna si no tiene', async () => {
    const user = setupUser();
    montar();

    await elegirExistente(user, productos.acido.name);
    await elegirExistente(user, productos.sosa.name);
    expect(await screen.findByTestId(`${PREFIX}-preview`)).toHaveAttribute('src', IMAGEN_SOSA);

    await elegirExistente(user, productos.glicerina.name);
    await waitFor(() => expect(screen.queryByTestId(`${PREFIX}-preview`)).toBeNull());
    expect(screen.getByTestId(`${PREFIX}-empty-image`)).toBeInTheDocument();
  });

  it('al cambiar de producto, la imagen subida se sustituye por la del producto y no se envia', async () => {
    const user = setupUser();
    montar();

    await user.upload(screen.getByTestId(`${PREFIX}-input`), pngValido());
    await screen.findByTestId(`${PREFIX}-change-hint`);

    await elegirExistente(user, productos.sosa.name);
    expect(await screen.findByTestId(`${PREFIX}-preview`)).toHaveAttribute('src', IMAGEN_SOSA);
    expect(screen.queryByTestId(`${PREFIX}-change-hint`)).toBeNull();

    await user.type(screen.getByTestId('product-field-stock'), '12');
    await user.type(screen.getByLabelText('Costo unitario'), '2.50');
    await user.click(screen.getByTestId('product-form-submit'));

    await waitFor(() => expect(createProductActionMock).toHaveBeenCalledTimes(1));
    expect(createProductActionMock.mock.calls[0]).toHaveLength(2);
  });

  it('al escribir un nombre que ya no es el elegido, la imagen precargada desaparece', async () => {
    const user = setupUser();
    montar();

    await elegirExistente(user, productos.acido.name);
    await screen.findByTestId(`${PREFIX}-preview`);

    await user.type(screen.getByTestId('product-field-name'), ' nuevo');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByTestId(`${PREFIX}-preview`)).toBeNull());
    expect(screen.getByTestId(`${PREFIX}-empty-image`)).toBeInTheDocument();
  });

  it('al dejar el producto elegido, una imagen subida por el usuario se conserva y se envia', async () => {
    const user = setupUser();
    montar();

    await elegirExistente(user, productos.acido.name);
    await user.upload(screen.getByTestId(`${PREFIX}-input`), pngValido());
    expect(await screen.findByTestId(`${PREFIX}-preview`)).toHaveAttribute(
      'src',
      'blob:product-image-preview',
    );

    await user.type(screen.getByTestId('product-field-name'), ' nuevo');
    await user.keyboard('{Escape}');

    expect(screen.getByTestId(`${PREFIX}-preview`)).toHaveAttribute('src', 'blob:product-image-preview');

    await user.type(screen.getByTestId('product-field-stock'), '12');
    await user.type(screen.getByLabelText('Costo unitario'), '2.50');
    await user.click(screen.getByTestId('product-form-submit'));

    await waitFor(() => expect(createProductActionMock).toHaveBeenCalledTimes(1));
    const image = createProductActionMock.mock.calls[0]?.[2] as { bytes: Uint8Array };
    expect(Array.from(image.bytes.slice(0, PNG_SIGNATURE.length))).toEqual(PNG_SIGNATURE);
  });
});
