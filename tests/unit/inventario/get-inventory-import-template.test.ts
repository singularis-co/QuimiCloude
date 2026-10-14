import { describe, expect, it, vi } from 'vitest';

import { UnauthorizedError, createGetInventoryImportTemplate, type ImportTemplateSheet } from '@/lib/modules/inventario';

const ACTOR = { id: 'user-1', companyId: 'company-1', permissions: ['inventario.modificar'] };
const BYTES = new Uint8Array([0x50, 0x4b]);

function build() {
  const values = {
    listUnitNames: vi.fn(async () => ['gramo']),
    listPresentationNames: vi.fn(async () => ['Bidón 20 L']),
    listFormulaNames: vi.fn(async () => ['Desengrasante']),
  };
  const writer = { write: vi.fn<(sheets: readonly ImportTemplateSheet[]) => Promise<Uint8Array>>(async () => BYTES) };
  return { values, writer, getTemplate: createGetInventoryImportTemplate({ values, writer }) };
}

describe('getInventoryImportTemplate', () => {
  it('R3 arma el .xlsx con los valores de la empresa del actor en la segunda hoja', async () => {
    const { values, writer, getTemplate } = build();

    const template = await getTemplate(ACTOR);

    expect(values.listUnitNames).toHaveBeenCalledWith('company-1');
    expect(values.listPresentationNames).toHaveBeenCalledWith('company-1');
    expect(values.listFormulaNames).toHaveBeenCalledWith('company-1');
    const [sheets] = writer.write.mock.calls[0] ?? [];
    expect(sheets?.[1]?.rows[1]).toEqual(['Insumo', 'gramo', 'Bidón 20 L', 'Desengrasante']);
    expect(template).toEqual({
      fileName: 'plantilla-inventario.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      bytes: BYTES,
    });
  });

  it('R3 sin permiso de inventario no lee nada', async () => {
    const { values, writer, getTemplate } = build();

    await expect(getTemplate({ ...ACTOR, permissions: [] })).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(getTemplate(null)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(values.listUnitNames).not.toHaveBeenCalled();
    expect(writer.write).not.toHaveBeenCalled();
  });
});
