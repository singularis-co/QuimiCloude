import { requirePermission, type Actor } from './actor';
import {
  buildInventoryImportTemplateSheets,
  IMPORT_TEMPLATE_FILE_NAME,
  IMPORT_TEMPLATE_MIME_TYPE,
} from './inventory-import-downloads';

import type { ImportTemplateValuesReader } from '../ports/import-template-values';
import type { SpreadsheetWriter } from '../ports/spreadsheet-writer';

export type InventoryImportTemplate = {
  readonly fileName: string;
  readonly mimeType: typeof IMPORT_TEMPLATE_MIME_TYPE;
  readonly bytes: Uint8Array;
};

export type GetInventoryImportTemplate = (actor: Actor | null | undefined) => Promise<InventoryImportTemplate>;

export type GetInventoryImportTemplateDeps = {
  readonly values: ImportTemplateValuesReader;
  readonly writer: SpreadsheetWriter;
};

/** La plantilla con los valores de la empresa de ahora: el mismo permiso que importar. */
export function createGetInventoryImportTemplate(deps: GetInventoryImportTemplateDeps): GetInventoryImportTemplate {
  return async function getInventoryImportTemplate(actor) {
    requirePermission(actor, 'inventario.modificar');
    const { companyId } = actor;

    const [units, presentations, formulas] = await Promise.all([
      deps.values.listUnitNames(companyId),
      deps.values.listPresentationNames(companyId),
      deps.values.listFormulaNames(companyId),
    ]);

    const bytes = await deps.writer.write(buildInventoryImportTemplateSheets({ units, presentations, formulas }));
    return { fileName: IMPORT_TEMPLATE_FILE_NAME, mimeType: IMPORT_TEMPLATE_MIME_TYPE, bytes };
  };
}
