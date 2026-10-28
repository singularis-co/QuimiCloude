import { describe, expect, it } from 'vitest';

import { planInventoryImport } from '@/lib/modules/inventario/domain/plan-inventory-import';

import { KG, LITRO, ML, productRef, ROW_INSUMO, sheet, snapshot, TODAY } from './inventory-import-kit';

import type { ImportPreviewRow, ImportRowIssueCode } from '@/lib/modules/inventario';
import type { ImportCatalogSnapshot } from '@/lib/modules/inventario/domain/plan-inventory-import';
import type { ParsedImportSheet } from '@/lib/modules/inventario/domain/import-sheet';

function plan(parsed: ParsedImportSheet, catalog: ImportCatalogSnapshot = snapshot()) {
  return planInventoryImport(parsed, catalog, TODAY);
}

function issues(previewRow: ImportPreviewRow | undefined): [ImportRowIssueCode, string | null, string][] {
  if (previewRow?.status !== 'error') return [];
  return previewRow.issues.map((issue) => [issue.code, issue.column, issue.message]);
}

const GLICERINA = { ...ROW_INSUMO, name: 'Glicerina', unitCost: '' };

describe('planInventoryImport — insumo por nombre + familia de unidad', () => {
  it('R18 fila en ml con homónimo en l queda en sumar lote sobre ese producto', () => {
    const enLitros = productRef({ id: 'p-l', nameNormalized: 'glicerina', unitId: LITRO.id, stock: '2.0000' });
    // 1000 ml = 1 l: menos existencia que el de litros, aunque el número sea mayor.
    const enMililitros = productRef({ id: 'p-ml', nameNormalized: 'glicerina', unitId: ML.id, stock: '1000.0000' });

    const result = plan(
      sheet({ ...GLICERINA, unit: 'ml', stock: '500', unitCost: '0,004' }),
      snapshot({ products: [enMililitros, enLitros] }),
    );

    expect(result.rows[0]).toMatchObject({ status: 'add_batch', target: { kind: 'existing', productId: 'p-l' } });
    const write = result.writes.get(2);
    expect(write?.kind === 'product' && write.candidate).toMatchObject({ unitId: ML.id, stock: '500', unitCost: '0.004' });
  });

  it('R18 segunda fila del archivo en otra unidad de la familia suma sobre la primera', () => {
    const result = plan(
      sheet(
        { ...GLICERINA, unit: 'Litro', stock: '2', unitCost: '4' },
        { ...GLICERINA, unit: 'ml', stock: '500', unitCost: '0,004' },
        { ...GLICERINA, unit: 'kg', stock: '1', unitCost: '4' },
      ),
    );

    expect(result.rows.map((r) => (r.status === 'add_batch' ? [r.status, r.target] : [r.status]))).toEqual([
      ['create'],
      ['add_batch', { kind: 'file_row', rowNumber: 2 }],
      ['create'],
    ]);
  });

  it('R18 otra familia queda en crear', () => {
    const enKg = productRef({ id: 'p-kg', nameNormalized: 'glicerina', unitId: KG.id, stock: '10.0000' });
    const sinUnidad = productRef({ id: 'p-sin-unidad', nameNormalized: 'glicerina', stock: '5.0000' });

    const result = plan(
      sheet({ ...GLICERINA, unit: 'ml', stock: '500', unitCost: '0,004' }),
      snapshot({ products: [enKg, sinUnidad] }),
    );

    expect(result.rows[0]?.status).toBe('create');
    expect(result.writes.has(2)).toBe(true);
  });

  it('R20 existencia convertida que no cabe deja la fila en error en Existencia', () => {
    const enLitros = productRef({ id: 'p-l', nameNormalized: 'glicerina', unitId: LITRO.id, stock: '2.0000' });

    // 0,05 ml = 0,00005 l: cinco decimales.
    const result = plan(
      sheet({ ...GLICERINA, unit: 'ml', stock: '0,05', unitCost: '1' }),
      snapshot({ products: [enLitros] }),
    );

    expect(issues(result.rows[0])).toEqual([
      [
        'converted_stock_out_of_range',
        'stock',
        'Cantidad: convertida a la unidad del producto no cabe en 4 decimales; escríbela en esa unidad.',
      ],
    ]);
    expect(result.writes.has(2)).toBe(false);
  });

  it('R20 costo convertido que no cabe deja la fila en error en Costo unitario', () => {
    const enMililitros = productRef({ id: 'p-ml', nameNormalized: 'glicerina', unitId: ML.id, stock: '10.0000' });

    // 0,0001 por l = 0,0000001 por ml.
    const result = plan(
      sheet({ ...GLICERINA, unit: 'Litro', stock: '1', unitCost: '0,0001' }),
      snapshot({ products: [enMililitros] }),
    );

    expect(issues(result.rows[0])).toEqual([
      [
        'converted_cost_out_of_range',
        'unitCost',
        'Costo unitario: convertido a la unidad del producto no cabe en 4 decimales; escribe el lote en esa unidad.',
      ],
    ]);
    expect(result.writes.has(2)).toBe(false);
  });
});
