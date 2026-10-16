import { describe, expect, it } from 'vitest';

import { readXlsx } from '@/lib/modules/inventario/adapters/driven/spreadsheet/xlsx-reader';
import { writeXlsx } from '@/lib/modules/inventario/adapters/driven/spreadsheet/xlsx-writer';
import { parseImportSheet } from '@/lib/modules/inventario/domain/import-sheet';
import { buildInventoryImportTemplateSheets } from '@/lib/modules/inventario';

describe('writeXlsx', () => {
  it('R3 R8 la plantilla .xlsx sin tocar se lee como solo filas de ejemplo', async () => {
    const sheets = buildInventoryImportTemplateSheets({ units: ['gramo'], presentations: [], formulas: ['Jabón'] });
    const bytes = await writeXlsx(sheets);

    const read = await readXlsx(bytes);

    expect(read.kind).toBe('ok');
    expect(parseImportSheet(read)).toEqual({ ok: false, rejection: { code: 'empty' } });
  });
});
