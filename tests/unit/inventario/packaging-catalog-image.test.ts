// La imagen que `PackagingCatalog.findRefs` publica, contra un doble del cliente Prisma: que el
// select pida `imagePath`, que la URL la componga el almacenamiento y que sin el salga `null`.
// Que la base devuelva esa columna con el filtro de empresa lo cubre
// `tests/integration/inventario/qc195-packaging-catalog.int.test.ts`.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { productFindMany, presentationFindMany, batchFindMany, findReservedAndAvailableByBatch } = vi.hoisted(() => ({
  productFindMany: vi.fn(),
  presentationFindMany: vi.fn(),
  batchFindMany: vi.fn(),
  findReservedAndAvailableByBatch: vi.fn(),
}));

vi.mock('@/lib/shared/db/prisma', () => ({
  prisma: {
    product: { findMany: productFindMany },
    presentation: { findMany: presentationFindMany },
    productBatch: { findMany: batchFindMany },
  },
}));

vi.mock('@/lib/modules/inventario/adapters/driven/persistence/reservation-prisma', () => ({
  findReservedAndAvailableByBatch,
}));

const { createFindPackagingRefs, findPackagingCostingBatches, findPackagingRefs } = await import(
  '@/lib/modules/inventario/adapters/driven/persistence/packaging-catalog-prisma'
);

const EMPRESA = '11111111-1111-4111-8111-111111111111';
const GALON = '22222222-2222-4222-8222-222222222222';
const BOTELLA = '33333333-3333-4333-8333-333333333333';
const PRESENTACION = '44444444-4444-4444-8444-444444444444';

beforeEach(() => {
  productFindMany.mockReset().mockResolvedValue([
    { id: GALON, name: 'Galon', presentationId: PRESENTACION, imagePath: 'productos/galon.png' },
    { id: BOTELLA, name: 'Botella', presentationId: PRESENTACION, imagePath: null },
  ]);
  presentationFindMany
    .mockReset()
    .mockResolvedValue([{ id: PRESENTACION, name: 'Galon 4 L', unitId: 'unidad-l', content: { toFixed: () => '4.0000' } }]);
  batchFindMany.mockReset().mockResolvedValue([]);
  findReservedAndAvailableByBatch.mockReset().mockResolvedValue(new Map());
});

describe('PackagingCatalog.findRefs — imagen del envase', () => {
  it('el select de envases pide `imagePath`', async () => {
    await findPackagingRefs([GALON], EMPRESA);

    expect(productFindMany.mock.calls[0]?.[0]?.select).toEqual({
      id: true,
      name: true,
      presentationId: true,
      imagePath: true,
    });
  });

  it('sin almacenamiento cableado no se inventa ninguna URL: `imageUrl` es `null` siempre', async () => {
    const refs = await findPackagingRefs([GALON, BOTELLA], EMPRESA);

    expect(refs.map((ref) => ref.imageUrl)).toEqual([null, null]);
  });

  it('con almacenamiento compone la URL desde la ruta guardada y deja `null` el envase sin imagen', async () => {
    const publicUrl = vi.fn((path: string) => `https://cdn.test/${path}`);

    const refs = await createFindPackagingRefs({ publicUrl })([GALON, BOTELLA], EMPRESA);

    expect(refs.map((ref) => [ref.id, ref.imageUrl])).toEqual([
      [GALON, 'https://cdn.test/productos/galon.png'],
      [BOTELLA, null],
    ]);
    expect(publicUrl).toHaveBeenCalledTimes(1);
    expect(publicUrl).toHaveBeenCalledWith('productos/galon.png');
  });

  it('con almacenamiento y sin ids no consulta nada', async () => {
    const publicUrl = vi.fn();

    expect(await createFindPackagingRefs({ publicUrl })([], EMPRESA)).toEqual([]);
    expect(productFindMany).not.toHaveBeenCalled();
    expect(publicUrl).not.toHaveBeenCalled();
  });

  it('findCostingBatches sigue saliendo igual aunque la consulta de envases traiga la imagen', async () => {
    batchFindMany.mockResolvedValue([{ id: 'lote-1', productId: GALON, unitCost: { toFixed: () => '2.5000' } }]);
    findReservedAndAvailableByBatch.mockResolvedValue(new Map([['lote-1', { available: '7.0000' }]]));

    expect(await findPackagingCostingBatches([GALON], EMPRESA)).toEqual([
      { productId: GALON, unitCost: '2.5000', available: '7.0000' },
    ]);
  });
});
