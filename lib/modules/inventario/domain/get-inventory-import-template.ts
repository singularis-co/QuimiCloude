import { requireAddon, requirePermission, type Actor } from './actor';
import {
  buildInventoryImportTemplateSheets,
  IMPORT_TEMPLATE_FILE_NAME,
  IMPORT_TEMPLATE_MIME_TYPE,
  type ImportTemplateValues,
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

export type GetInventoryImportValues = (actor: Actor | null | undefined) => Promise<ImportTemplateValues>;

export type GetInventoryImportValuesDeps = Pick<GetInventoryImportTemplateDeps, 'values'>;

async function readValues(reader: ImportTemplateValuesReader, companyId: string): Promise<ImportTemplateValues> {
  const [units, presentations, formulas] = await Promise.all([
    reader.listUnitNames(companyId),
    reader.listPresentationNames(companyId),
    reader.listFormulaNames(companyId),
  ]);
  return { units, presentations, formulas };
}

/** Los mismos valores que la segunda hoja de la plantilla, para mostrarlos en la pantalla. */
export function createGetInventoryImportValues(deps: GetInventoryImportValuesDeps): GetInventoryImportValues {
  return async function getInventoryImportValues(actor) {
    requirePermission(actor, 'inventario.modificar');
    requireAddon(actor, 'importacion_excel');
    return readValues(deps.values, actor.companyId);
  };
}

/** La plantilla con los valores de la empresa de ahora: el mismo permiso que importar. */
export function createGetInventoryImportTemplate(deps: GetInventoryImportTemplateDeps): GetInventoryImportTemplate {
  return async function getInventoryImportTemplate(actor) {
    requirePermission(actor, 'inventario.modificar');
    requireAddon(actor, 'importacion_excel');

    const values = await readValues(deps.values, actor.companyId);
    const bytes = await deps.writer.write(buildInventoryImportTemplateSheets(values));
    return { fileName: IMPORT_TEMPLATE_FILE_NAME, mimeType: IMPORT_TEMPLATE_MIME_TYPE, bytes };
  };
}
