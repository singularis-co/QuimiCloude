import type { Mock } from 'vitest';

import { PRODUCT_TYPES } from '@/lib/modules/inventario';
import type { Actor } from '@/lib/modules/inventario/domain/actor';
import { createCreateProduct } from '@/lib/modules/inventario/domain/create-product';
import {
  ActionNotAllowedError,
  ProductNotFoundError,
  ValidationError,
} from '@/lib/modules/inventario/domain/errors';
import { createGetProduct } from '@/lib/modules/inventario/domain/get-product';
import { createListProducts } from '@/lib/modules/inventario/domain/list-products';
import { MAX_PRODUCT_IMAGE_BYTES, validateProductImage } from '@/lib/modules/inventario/domain/product-image';
import { createProductSchema, updateProductSchema } from '@/lib/modules/inventario/domain/product-input';
import type { ProductView } from '@/lib/modules/inventario/domain/product-view';
import { createUpdateProduct } from '@/lib/modules/inventario/domain/update-product';
import type { ProductImageStorage } from '@/lib/modules/inventario/ports/product-image-storage';
import type { ProductRepository } from '@/lib/modules/inventario/ports/product-repository';
import type { UnitCatalog } from '@/lib/modules/unidades';

const ADMIN: Actor = {
  id: 'admin-1',
  companyId: 'company-a',
  permissions: ['inventario.consultar', 'inventario.modificar'],
};
const AHORA = new Date('2026-10-14T10:00:00.000Z');
const UNIDAD_KG = '33333333-3333-4333-8333-333333333333';
const PRESENTACION = '11111111-1111-4111-8111-111111111111';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const PDF = new TextEncoder().encode('%PDF-1.7');

const ALTA_INSUMO = { name: 'Acido citrico', stock: '4', qtyAlert: '1', unitId: UNIDAD_KG, unitCost: '12.5' };
const EDICION = { name: 'Acido citrico', type: PRODUCT_TYPES.PRODUCT, qtyAlert: '1' };

type DobleDelPuerto = { [K in keyof ProductRepository]: Mock<ProductRepository[K]> };
type DobleDelAlmacenamiento = { [K in keyof ProductImageStorage]: Mock<ProductImageStorage[K]> };

function vista(imagePath: string | null): ProductView {
  return {
    id: 'producto-1',
    name: 'Acido citrico',
    imagePath,
    stock: '4.0000',
    unitId: null,
    qtyAlert: '1',
    type: PRODUCT_TYPES.PRODUCT,
    createdAt: AHORA,
    updatedAt: AHORA,
  };
}

function montarRepositorio(overrides: Partial<DobleDelPuerto> = {}): DobleDelPuerto & ProductRepository {
  return {
    create: vi.fn<ProductRepository['create']>(async () => ({ id: 'producto-1' })),
    findAliveById: vi.fn<ProductRepository['findAliveById']>(async () => vista('productos/anterior.jpg')),
    updateAlive: vi.fn<ProductRepository['updateAlive']>(async () => true),
    softDeleteAlive: vi.fn<ProductRepository['softDeleteAlive']>(async () => true),
    listAlive: vi.fn<ProductRepository['listAlive']>(async () => ({
      items: [vista('productos/a.jpg'), vista(null)],
      total: 2,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    })),
    findAliveIdByNameInPresentationUnit: vi.fn<ProductRepository['findAliveIdByNameInPresentationUnit']>(
      async () => null,
    ),
    findAliveSupplyHomonyms: vi.fn<ProductRepository['findAliveSupplyHomonyms']>(async () => []),
    findAlivePackagingByName: vi.fn<ProductRepository['findAlivePackagingByName']>(async () => null),
    createWithFirstBatch: vi.fn<ProductRepository['createWithFirstBatch']>(async () => ({
      id: 'producto-nuevo',
      batchId: 'lote-1',
      lot: '1',
    })),
    addBatchToAlive: vi.fn<ProductRepository['addBatchToAlive']>(async () => ({ batchId: 'lote-2', lot: '2' })),
    adjustBatchStock: vi.fn<ProductRepository['adjustBatchStock']>(async () => ({ kind: 'batch_not_found' })),
    findBatchesOfAliveProduct: vi.fn<ProductRepository['findBatchesOfAliveProduct']>(async () => []),
    findBatchMovements: vi.fn<ProductRepository['findBatchMovements']>(async () => null),
    ...overrides,
  };
}

/** Doble en memoria: guarda lo subido y lo borrado para poder mirarlo despues. */
function montarAlmacenamiento(overrides: Partial<DobleDelAlmacenamiento> = {}) {
  const subidas: string[] = [];
  const borradas: string[] = [];
  let contador = 0;
  const storage: DobleDelAlmacenamiento = {
    upload: vi.fn<ProductImageStorage['upload']>(async (image) => {
      contador += 1;
      const path = `productos/nueva-${contador}.${image.extension}`;
      subidas.push(path);
      return path;
    }),
    remove: vi.fn<ProductImageStorage['remove']>(async (path) => {
      borradas.push(path);
    }),
    publicUrl: vi.fn<ProductImageStorage['publicUrl']>((path) => `https://bucket.example/${path}`),
    ...overrides,
  };
  return { storage, subidas, borradas };
}

function unidades() {
  return {
    findRefs: vi.fn<UnitCatalog['findRefs']>(async (ids) =>
      ids.map((id) => ({ id, name: 'kilogramo', symbol: 'kg', baseUnitId: null, factor: null })),
    ),
  };
}

describe('validateProductImage', () => {
  it.each([
    ['JPEG', JPEG, 'image/jpeg', 'jpg'],
    ['PNG', PNG, 'image/png', 'png'],
    ['WebP', WEBP, 'image/webp', 'webp'],
  ])('acepta %s y toma el tipo de su firma', (_nombre, bytes, contentType, extension) => {
    expect(validateProductImage(bytes)).toEqual({ ok: true, contentType, extension });
  });

  it('rechaza un formato que no es imagen aunque se llame .jpg', () => {
    expect(validateProductImage(PDF)).toEqual({ ok: false, reason: 'unsupported_format' });
  });

  it('rechaza mas de 4.4 MB', () => {
    const grande = new Uint8Array(MAX_PRODUCT_IMAGE_BYTES + 1);
    grande.set(JPEG);
    expect(validateProductImage(grande)).toEqual({ ok: false, reason: 'too_large' });
  });

  it('el corte es 4 400 000 bytes decimales: acepta 4_400_000 y rechaza 4_400_001', () => {
    expect(MAX_PRODUCT_IMAGE_BYTES).toBe(4_400_000);
    const justo = new Uint8Array(4_400_000);
    justo.set(JPEG);
    expect(validateProductImage(justo)).toEqual({ ok: true, contentType: 'image/jpeg', extension: 'jpg' });
    const unoMas = new Uint8Array(4_400_001);
    unoMas.set(JPEG);
    expect(validateProductImage(unoMas)).toEqual({ ok: false, reason: 'too_large' });
  });
});

describe('esquema de entrada de la imagen', () => {
  it('el alta no admite image: null', () => {
    expect(createProductSchema.safeParse({ ...ALTA_INSUMO, image: null }).success).toBe(false);
  });

  it('la edicion conserva la diferencia entre ausente y null', () => {
    const ausente = updateProductSchema.parse(EDICION);
    const nula = updateProductSchema.parse({ ...EDICION, image: null });
    expect('image' in ausente).toBe(false);
    expect(nula.image).toBeNull();
  });

  it('rechaza bytes que no son Uint8Array', () => {
    expect(updateProductSchema.safeParse({ ...EDICION, image: { bytes: [1, 2, 3] } }).success).toBe(false);
  });
});

describe('alta de producto con imagen', () => {
  it('sin imagen no toca el almacenamiento', async () => {
    const products = montarRepositorio();
    const { storage } = montarAlmacenamiento();
    const createProduct = createCreateProduct({ products, units: unidades(), images: storage, now: () => AHORA });

    await createProduct(ALTA_INSUMO, ADMIN);

    expect(storage.upload).not.toHaveBeenCalled();
    expect(products.createWithFirstBatch.mock.calls[0]![0]).not.toHaveProperty('imagePath');
  });

  it('sube la imagen con el tipo detectado y guarda la ruta en el producto nuevo', async () => {
    const products = montarRepositorio();
    const { storage } = montarAlmacenamiento();
    const createProduct = createCreateProduct({ products, units: unidades(), images: storage, now: () => AHORA });

    await createProduct({ ...ALTA_INSUMO, image: { bytes: PNG } }, ADMIN);

    expect(storage.upload).toHaveBeenCalledWith({ bytes: PNG, contentType: 'image/png', extension: 'png' });
    expect(products.createWithFirstBatch.mock.calls[0]![0]).toMatchObject({ imagePath: 'productos/nueva-1.png' });
  });

  it('el envase nuevo tambien guarda la ruta', async () => {
    const products = montarRepositorio();
    const { storage } = montarAlmacenamiento();
    const createProduct = createCreateProduct({
      products,
      images: storage,
      packageUnit: { findPackageUnitId: async () => UNIDAD_KG },
      now: () => AHORA,
    });

    await createProduct(
      {
        name: 'Bidon 20 L',
        type: PRODUCT_TYPES.PACKAGING,
        stock: '3',
        qtyAlert: '1',
        unitCost: '2',
        presentationId: PRESENTACION,
        image: { bytes: JPEG },
      },
      ADMIN,
    );

    expect(products.createWithFirstBatch.mock.calls[0]![0]).toMatchObject({ imagePath: 'productos/nueva-1.jpg' });
  });

  it('una imagen invalida se rechaza sin subir ni escribir nada', async () => {
    const products = montarRepositorio();
    const { storage } = montarAlmacenamiento();
    const createProduct = createCreateProduct({ products, units: unidades(), images: storage, now: () => AHORA });

    await expect(createProduct({ ...ALTA_INSUMO, image: { bytes: PDF } }, ADMIN)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(storage.upload).not.toHaveBeenCalled();
    expect(products.findAliveSupplyHomonyms).not.toHaveBeenCalled();
    expect(products.createWithFirstBatch).not.toHaveBeenCalled();
  });

  it('a un homonimo vivo solo se le agrega el lote: la imagen no se sube', async () => {
    const products = montarRepositorio({
      findAliveSupplyHomonyms: vi.fn<ProductRepository['findAliveSupplyHomonyms']>(async () => [
        { id: 'producto-existente', name: 'acido citrico', type: PRODUCT_TYPES.PRODUCT, unitId: UNIDAD_KG, stock: '1' },
      ]),
    });
    const { storage } = montarAlmacenamiento();
    const createProduct = createCreateProduct({ products, units: unidades(), images: storage, now: () => AHORA });

    await createProduct({ ...ALTA_INSUMO, image: { bytes: JPEG } }, ADMIN);

    expect(products.addBatchToAlive).toHaveBeenCalledTimes(1);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('con imagen y sin almacenamiento cableado falla antes de escribir', async () => {
    const products = montarRepositorio();
    const createProduct = createCreateProduct({ products, units: unidades(), now: () => AHORA });

    await expect(createProduct({ ...ALTA_INSUMO, image: { bytes: JPEG } }, ADMIN)).rejects.toThrow(/cableado/);
    expect(products.createWithFirstBatch).not.toHaveBeenCalled();
  });
});

describe('edicion de producto con imagen', () => {
  it('imagen ausente: no lee la fila ni toca el almacenamiento, y no escribe image_path', async () => {
    const products = montarRepositorio();
    const { storage } = montarAlmacenamiento();
    const updateProduct = createUpdateProduct({ products, images: storage, now: () => AHORA });

    await expect(updateProduct('producto-1', EDICION, ADMIN)).resolves.toEqual({ warnings: [] });

    expect(products.findAliveById).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
    expect(products.updateAlive.mock.calls[0]![1]).not.toHaveProperty('imagePath');
  });

  it('null: vacia image_path y borra el archivo anterior despues de guardar', async () => {
    const products = montarRepositorio();
    const { storage, borradas } = montarAlmacenamiento();
    const updateProduct = createUpdateProduct({ products, images: storage, now: () => AHORA });

    await updateProduct('producto-1', { ...EDICION, image: null }, ADMIN);

    expect(products.updateAlive.mock.calls[0]![1]).toMatchObject({ imagePath: null });
    expect(borradas).toEqual(['productos/anterior.jpg']);
    expect(products.updateAlive.mock.invocationCallOrder[0]).toBeLessThan(
      storage.remove.mock.invocationCallOrder[0]!,
    );
  });

  it('null sin imagen previa: no hay nada que borrar', async () => {
    const products = montarRepositorio({
      findAliveById: vi.fn<ProductRepository['findAliveById']>(async () => vista(null)),
    });
    const { storage } = montarAlmacenamiento();
    const updateProduct = createUpdateProduct({ products, images: storage, now: () => AHORA });

    await updateProduct('producto-1', { ...EDICION, image: null }, ADMIN);

    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('nueva: sube antes de guardar, guarda la ruta nueva y borra la anterior', async () => {
    const products = montarRepositorio();
    const { storage, borradas } = montarAlmacenamiento();
    const updateProduct = createUpdateProduct({ products, images: storage, now: () => AHORA });

    await updateProduct('producto-1', { ...EDICION, image: { bytes: WEBP } }, ADMIN);

    expect(products.updateAlive.mock.calls[0]![1]).toMatchObject({ imagePath: 'productos/nueva-1.webp' });
    expect(storage.upload.mock.invocationCallOrder[0]).toBeLessThan(products.updateAlive.mock.invocationCallOrder[0]!);
    expect(borradas).toEqual(['productos/anterior.jpg']);
  });

  it('un borrado que falla no deshace la edicion: vuelve como advertencia con la ruta', async () => {
    const products = montarRepositorio();
    const { storage } = montarAlmacenamiento({
      remove: vi.fn<ProductImageStorage['remove']>(async () => {
        throw new Error('sin red');
      }),
    });
    const updateProduct = createUpdateProduct({ products, images: storage, now: () => AHORA });

    const resultado = await updateProduct('producto-1', { ...EDICION, image: { bytes: JPEG } }, ADMIN);

    expect(resultado.warnings).toEqual([{ operation: 'remove', path: 'productos/anterior.jpg', message: 'sin red' }]);
    expect(products.updateAlive).toHaveBeenCalledTimes(1);
  });

  it('producto inexistente o de otra empresa: ProductNotFoundError sin subir nada', async () => {
    const products = montarRepositorio({
      findAliveById: vi.fn<ProductRepository['findAliveById']>(async () => null),
    });
    const { storage } = montarAlmacenamiento();
    const updateProduct = createUpdateProduct({ products, images: storage, now: () => AHORA });

    await expect(updateProduct('ajeno', { ...EDICION, image: { bytes: JPEG } }, ADMIN)).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
    expect(products.findAliveById).toHaveBeenCalledWith('ajeno', { companyId: ADMIN.companyId });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(products.updateAlive).not.toHaveBeenCalled();
  });

  it('una imagen invalida se rechaza antes de leer la fila', async () => {
    const products = montarRepositorio();
    const { storage } = montarAlmacenamiento();
    const updateProduct = createUpdateProduct({ products, images: storage, now: () => AHORA });

    await expect(updateProduct('producto-1', { ...EDICION, image: { bytes: PDF } }, ADMIN)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(products.findAliveById).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('si la edicion se rechaza por tipo, la imagen anterior no se borra', async () => {
    const products = montarRepositorio({
      updateAlive: vi.fn<ProductRepository['updateAlive']>(async () => 'type_locked'),
    });
    const { storage } = montarAlmacenamiento();
    const updateProduct = createUpdateProduct({ products, images: storage, now: () => AHORA });

    await expect(updateProduct('producto-1', { ...EDICION, image: null }, ADMIN)).rejects.toBeInstanceOf(
      ActionNotAllowedError,
    );
    expect(storage.remove).not.toHaveBeenCalled();
  });
});

describe('lectura: imageUrl', () => {
  it('getProduct compone la URL publica de la ruta, y null si no hay imagen', async () => {
    const { storage } = montarAlmacenamiento();

    const conImagen = await createGetProduct({ products: montarRepositorio(), images: storage })('producto-1', ADMIN);
    const sinImagen = await createGetProduct({
      products: montarRepositorio({
        findAliveById: vi.fn<ProductRepository['findAliveById']>(async () => vista(null)),
      }),
      images: storage,
    })('producto-1', ADMIN);

    expect(conImagen.imageUrl).toBe('https://bucket.example/productos/anterior.jpg');
    expect(sinImagen.imageUrl).toBeNull();
  });

  it('listProducts compone la URL de cada fila', async () => {
    const { storage } = montarAlmacenamiento();
    const listProducts = createListProducts({
      products: montarRepositorio(),
      log: { ignoredFields: () => undefined },
      images: storage,
    });

    const page = await listProducts({}, ADMIN);

    expect(page.items.map((item) => item.imageUrl)).toEqual(['https://bucket.example/productos/a.jpg', null]);
  });

  it('sin almacenamiento cableado la lectura sale sin imageUrl', async () => {
    const producto = await createGetProduct({ products: montarRepositorio() })('producto-1', ADMIN);
    expect(producto).not.toHaveProperty('imageUrl');
  });
});
