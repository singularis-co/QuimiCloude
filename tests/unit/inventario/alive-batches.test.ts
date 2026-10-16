import { aliveBatches, type ProductBatchView } from '@/lib/modules/inventario';

function lote(id: string, stock: string): ProductBatchView {
  return {
    id,
    lot: `L-${id}`,
    stock,
    unitId: null,
    purchaseDate: '2026-10-01',
    expiryDate: null,
    packageContent: null,
  };
}

describe('aliveBatches', () => {
  it('excluye los lotes con existencia cero, en cualquier escala', () => {
    expect(aliveBatches([lote('a', '0'), lote('b', '0.0000'), lote('c', '0.00')])).toEqual([]);
  });

  it('incluye los lotes con existencia mayor que cero, conservando el orden', () => {
    const lotes = [lote('a', '5'), lote('b', '0'), lote('c', '0.0001'), lote('d', '12.5000')];

    expect(aliveBatches(lotes).map((batch) => batch.id)).toEqual(['a', 'c', 'd']);
  });

  it('excluye una existencia negativa', () => {
    expect(aliveBatches([lote('a', '-1.0000')])).toEqual([]);
  });

  it('una lista vacia da una lista vacia', () => {
    expect(aliveBatches([])).toEqual([]);
  });
});
