/**
 * Los nombres que la importacion reconoce, para la hoja «Valores disponibles» de la plantilla.
 * Las formulas son de `recetas` y las unidades de `unidades`: `inventario` declara el hueco y
 * `lib/composition` lo ata.
 */
export interface ImportTemplateValuesReader {
  listUnitNames(companyId: string): Promise<readonly string[]>;
  listPresentationNames(companyId: string): Promise<readonly string[]>;
  /** Solo formulas ORIGINALES VIVAS: son las unicas que acepta la columna «Formula». */
  listFormulaNames(companyId: string): Promise<readonly string[]>;
}
