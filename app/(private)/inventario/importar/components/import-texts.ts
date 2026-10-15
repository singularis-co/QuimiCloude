import type { ImportColumnKey } from '@/lib/modules/inventario';

export const IMPORT_PAGE_TITLE = 'Importar inventario';
export const IMPORT_PAGE_DESCRIPTION =
  'Sube un archivo .xlsx o .csv con las columnas de la plantilla. Antes de importar verás qué se crea, qué suma un lote y qué filas tienen error.';
export const IMPORT_BACK_LABEL = 'Volver a inventario';

export const IMPORT_SCREEN_TESTID = 'inventory-import-screen';
export const IMPORT_TITLE_TESTID = 'inventory-import-title';
export const IMPORT_BACK_LINK_TESTID = 'inventory-import-back-link';

export const UPLOAD_INPUT_LABEL = 'Archivo de inventario';
export const UPLOAD_TRIGGER_LABEL = 'Elegir archivo';
export const UPLOAD_CHANGE_LABEL = 'Elegir otro archivo';
export const UPLOAD_NO_FILE = 'Ningún archivo elegido.';

export const UPLOAD_FIELD_TESTID = 'inventory-import-upload';
export const UPLOAD_INPUT_TESTID = 'inventory-import-upload-input';
export const UPLOAD_TRIGGER_TESTID = 'inventory-import-upload-trigger';
export const UPLOAD_FILE_NAME_TESTID = 'inventory-import-upload-file-name';
export const UPLOAD_TOO_LARGE_TESTID = 'inventory-import-upload-too-large';

export const TEMPLATE_BUTTON_LABEL = 'Descargar plantilla';
export const TEMPLATE_BUTTON_TESTID = 'inventory-import-template';

export const REJECTION_TITLE = 'El archivo se rechazó entero: no se revisó ninguna fila.';
export const REJECTION_TESTID = 'inventory-import-rejection';
export const REJECTION_MESSAGE_TESTID = 'inventory-import-rejection-message';
export const REJECTION_COLUMN_TESTID = 'inventory-import-rejection-column';

const NUMBER_LOCALE = 'es';

export function formatCount(value: number): string {
  return new Intl.NumberFormat(NUMBER_LOCALE).format(value);
}

export function formatBytes(bytes: number): string {
  const megabytes = bytes / 1_000_000;
  if (megabytes >= 1) {
    return new Intl.NumberFormat(NUMBER_LOCALE, {
      style: 'unit',
      unit: 'megabyte',
      maximumFractionDigits: 1,
    }).format(megabytes);
  }
  return new Intl.NumberFormat(NUMBER_LOCALE, {
    style: 'unit',
    unit: 'kilobyte',
    maximumFractionDigits: 0,
  }).format(Math.max(1, bytes / 1_000));
}

export function uploadHint(maxBytes: number, maxRows: number): string {
  return `Formatos .xlsx o .csv, hasta ${formatBytes(maxBytes)} y ${formatCount(maxRows)} filas.`;
}

export function tooLargeWarning(bytes: number, maxBytes: number): string {
  return `El archivo pesa ${formatBytes(bytes)} y el máximo es ${formatBytes(maxBytes)}. Pártelo en varios archivos más pequeños.`;
}

export const REJECTION_MESSAGES = {
  unsupported_format: 'El archivo no es un .xlsx ni un .csv, o su contenido no corresponde a su extensión.',
  unreadable: 'No se pudo leer el contenido del archivo.',
  empty: 'El archivo no trae ninguna fila de datos.',
  missing_columns: 'Faltan estas columnas obligatorias de la plantilla:',
  unknown_columns: 'Estas columnas no son de la plantilla:',
  duplicate_columns: 'Estas columnas están repetidas:',
} as const;

export function tooManyRowsMessage(rows: number, maxRows: number): string {
  return `El archivo trae ${formatCount(rows)} filas y el máximo es ${formatCount(maxRows)}. Pártelo en varios archivos.`;
}

export const PREVIEW_STATUS_LABELS = {
  create: 'Crear',
  add_batch: 'Sumar lote',
  duplicate: 'Duplicado',
  error: 'Error',
} as const;

export const RESULT_STATUS_LABELS = {
  created: 'Creado',
  batch_added: 'Lote sumado',
  duplicate: 'Duplicado',
  error: 'Error',
} as const;

export const STATUS_FILTER_ALL_LABEL = 'Todas';
export const STATUS_FILTER_GROUP_LABEL = 'Filtrar filas por estado';

export const ROWS_COLUMN_LABELS = {
  row: 'Fila',
  status: 'Estado',
  product: 'Producto',
  detail: 'Detalle',
} as const;

export const PREVIEW_DETAIL_CREATE = 'Se crea como producto nuevo.';
export const PREVIEW_DETAIL_ADD_EXISTING = 'Suma un lote a un producto que ya existe.';

export function previewDetailAddFileRow(rowNumber: number): string {
  return `Suma un lote al producto que crea la fila ${formatCount(rowNumber)}.`;
}

export function duplicateLotDetail(lot: string): string {
  return `El lote ${lot} ya existe en este producto: no se importa.`;
}

export function createdLotDetail(lot: string): string {
  return `Producto creado con el lote ${lot}.`;
}

export function addedLotDetail(lot: string): string {
  return `Lote ${lot} sumado al producto.`;
}

export const PREVIEW_TOTAL_LABELS = {
  rows: 'Filas',
  create: 'Se crean',
  addBatch: 'Suman lote',
  duplicate: 'Duplicadas',
  error: 'Con error',
} as const;

export const RESULT_TOTAL_LABELS = {
  rows: 'Filas',
  created: 'Creadas',
  batchAdded: 'Lotes sumados',
  duplicate: 'Duplicadas',
  error: 'Con error',
} as const;

export const EXAMPLE_ROW_IGNORED_NOTICE =
  'Las filas de ejemplo de la plantilla venían en el archivo y se ignoraron: no se importan.';

export const IGNORED_COLUMNS_SUMMARY_TESTID = 'inventory-import-ignored-columns-summary';
export function ignoredColumnsSummary(rows: number): string {
  return rows === 1
    ? '1 fila trae valores en columnas que su tipo no usa: esos valores se ignoran y la fila se importa igual.'
    : `${formatCount(rows)} filas traen valores en columnas que su tipo no usa: esos valores se ignoran y las filas se importan igual.`;
}

export function confirmLabel(validRows: number): string {
  return validRows === 1 ? 'Importar 1 fila válida' : `Importar ${formatCount(validRows)} filas válidas`;
}
export const CONFIRMING_LABEL = 'Importando…';
export const NO_VALID_ROWS_NOTICE = 'No hay ninguna fila válida que importar.';
export const PARTIAL_IMPORT_NOTICE =
  'Las filas con error o duplicadas no se importan. Puedes importar ahora las válidas y corregir el resto después.';
export const ERROR_FILE_BUTTON_LABEL = 'Descargar filas con error';

export const PREVIEW_SUMMARY_TESTID = 'inventory-import-preview-summary';
export const PREVIEW_TABLE_TESTID = 'inventory-import-preview-table';
export const RESULT_TABLE_TESTID = 'inventory-import-result-table';
export const EXAMPLE_ROW_NOTICE_TESTID = 'inventory-import-example-ignored';
export const CONFIRM_BUTTON_TESTID = 'inventory-import-confirm';
export const NO_VALID_ROWS_TESTID = 'inventory-import-no-valid-rows';
export const ERROR_FILE_BUTTON_TESTID = 'inventory-import-error-file';
export const STATUS_FILTER_TESTID = 'inventory-import-status-filter';
export const ROW_STATUS_TESTID = 'inventory-import-row-status';
export const ROW_DETAIL_TESTID = 'inventory-import-row-detail';
export const ROW_IGNORED_COLUMNS_TESTID = 'inventory-import-row-ignored-columns';

export function ignoredColumnsNotice(headers: readonly string[]): string {
  const list = headers.map((header) => `«${header}»`).join(', ');
  return headers.length === 1
    ? `Se ignoró ${list}: no aplica a este tipo.`
    : `Se ignoraron ${list}: no aplican a este tipo.`;
}
export const ROW_ISSUE_TESTID = 'inventory-import-row-issue';

export function totalTestId(key: string): string {
  return `inventory-import-total-${key}`;
}

export function statusFilterTestId(value: string): string {
  return `inventory-import-status-filter-${value}`;
}

export const ROWS_TABLE_TEXTS = {
  empty: 'No hay filas con este estado.',
  loading: 'Cargando filas…',
  error: 'No se pudieron mostrar las filas.',
  search: 'Buscar',
  filters: 'Filtros',
  columnMenu: 'opciones de la columna',
  previousPage: 'Página anterior',
  nextPage: 'Página siguiente',
  pageIndicator: (page: number, totalPages: number) => `Página ${page} de ${totalPages}`,
  pageSize: 'Filas por página',
  sortAscending: 'Orden ascendente',
  sortDescending: 'Orden descendente',
  pinColumn: 'Fijar columna',
  unpinColumn: 'Soltar columna',
  filterColumn: 'Filtrar columna',
  clearFilter: 'Limpiar filtro',
  lastWeek: 'Última semana',
  lastMonth: 'Último mes',
  lastYear: 'Último año',
  scrollLeft: 'Desplazar la tabla a la izquierda',
  scrollRight: 'Desplazar la tabla a la derecha',
} as const;

export const MISSING_SECTION_TITLE = 'Faltan en el catálogo';
export const MISSING_SECTION_DESCRIPTION =
  'Estas unidades y presentaciones no existen en la empresa. Las filas que las nombran quedan en error hasta que las crees; al crearlas se vuelve a revisar el archivo.';
export const MISSING_UNITS_TITLE = 'Unidades';
export const MISSING_PRESENTATIONS_TITLE = 'Presentaciones';
export const MISSING_CREATE_LABEL = 'Crear';

export function missingRowsLabel(rowNumbers: readonly number[]): string {
  const list = rowNumbers.map(formatCount).join(', ');
  return rowNumbers.length === 1 ? `Fila ${list}` : `Filas ${list}`;
}

export function missingCreateAriaLabel(name: string): string {
  return `Crear «${name}»`;
}

export const MISSING_SECTION_TESTID = 'inventory-import-missing';
export const MISSING_UNIT_TESTID = 'inventory-import-missing-unit';
export const MISSING_PRESENTATION_TESTID = 'inventory-import-missing-presentation';
export const MISSING_NAME_TESTID = 'inventory-import-missing-name';
export const MISSING_ROWS_TESTID = 'inventory-import-missing-rows';
export const MISSING_CREATE_TESTID = 'inventory-import-missing-create';

export const DIALOG_CANCEL_LABEL = 'Cancelar';
export const DIALOG_SAVE_LABEL = 'Crear';
export const DIALOG_SAVING_LABEL = 'Creando…';

export const UNIT_DIALOG_TITLE = 'Nueva unidad';
export const UNIT_DIALOG_DESCRIPTION = 'Se crea igual que desde la pantalla de unidades.';
export const UNIT_FIELD_LABELS = {
  name: 'Nombre',
  symbol: 'Símbolo',
  baseUnitId: 'Deriva de',
  factor: 'Factor',
} as const;
export const NO_BASE_UNIT_LABEL = 'No deriva de ninguna';

export const PRESENTATION_DIALOG_TITLE = 'Nueva presentación';
export const PRESENTATION_DIALOG_DESCRIPTION = 'Se crea igual que desde la pantalla de presentaciones.';
export const PRESENTATION_FIELD_LABELS = {
  name: 'Nombre',
  content: 'Contenido',
} as const;

export const UNIT_DIALOG_TESTID = 'inventory-import-unit-dialog';
export const PRESENTATION_DIALOG_TESTID = 'inventory-import-presentation-dialog';
export const DIALOG_FORM_ERROR_TESTID = 'inventory-import-dialog-error';
export const DIALOG_SUBMIT_TESTID = 'inventory-import-dialog-submit';
export const DIALOG_CANCEL_TESTID = 'inventory-import-dialog-cancel';

export function dialogFieldTestId(field: string): string {
  return `inventory-import-dialog-field-${field}`;
}

export function dialogFieldErrorTestId(field: string): string {
  return `inventory-import-dialog-error-${field}`;
}

export const REVIEW_BUTTON_LABEL = 'Revisar archivo';
export const REVIEWING_NOTICE = 'Revisando el archivo…';
export const PREVIEW_TITLE = 'Vista previa';
export const PREVIEW_DESCRIPTION = 'Todavía no se ha importado nada. Revisa las filas y confirma.';
export const RESULT_TITLE = 'Importación terminada';
export const RESTART_LABEL = 'Importar otro archivo';

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('es', { dateStyle: 'long', timeStyle: 'short' });

export function formatImportedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_TIME_FORMAT.format(date);
}

export function resultDescription(fileName: string, importedAt: string): string {
  return `«${fileName}» se importó el ${formatImportedAt(importedAt)}. Las filas duplicadas o con error no se importaron.`;
}

export const NOTHING_IMPORTED_TITLE = 'No se importó nada';

export function nothingImportedMessage(fileName: string): string {
  return `Al confirmar, «${fileName}» no tenía ninguna fila válida, así que no se ha importado nada. Revisa el motivo de cada fila, corrígelas y vuelve a subir el archivo.`;
}

export function alreadyImportedMessage(importedAt: string): string {
  return `Esta importación ya se había confirmado el ${formatImportedAt(importedAt)}. No se ha vuelto a escribir nada.`;
}

export const REVIEW_BUTTON_TESTID = 'inventory-import-review';
export const REVIEWING_TESTID = 'inventory-import-reviewing';
export const SCREEN_ERROR_TESTID = 'inventory-import-error';
export const RESULT_TESTID = 'inventory-import-result';
export const ALREADY_IMPORTED_TESTID = 'inventory-import-already-imported';
export const NOTHING_IMPORTED_TESTID = 'inventory-import-nothing-imported';
export const NOTHING_IMPORTED_MESSAGE_TESTID = 'inventory-import-nothing-imported-message';
export const RESTART_TESTID = 'inventory-import-restart';

export const GUIDE_TESTID = 'inventory-import-guide';
export const GUIDE_TITLE = 'Cómo llenar la plantilla';
export const GUIDE_DESCRIPTION =
  'Las mismas reglas y valores que trae la hoja «Valores disponibles» de la plantilla descargada.';
export const GUIDE_TABS = {
  rules: 'Campos por tipo',
  values: 'Valores disponibles',
  examples: 'Ejemplos',
} as const;
export const GUIDE_RULES_TESTID = 'inventory-import-guide-rules';
export const GUIDE_VALUES_TESTID = 'inventory-import-guide-values';
export const GUIDE_EXAMPLES_TESTID = 'inventory-import-guide-examples';
export const GUIDE_COLUMN_HEADER = 'Columna';
export const GUIDE_DESCRIPTION_HEADER = 'Descripción';
/**
 * Texto de la descripción de cada columna. Las columnas de catálogo (unidad, presentación,
 * fórmula) suman además un enlace a su módulo: lo compone `GUIDE_COLUMN_DESCRIPTIONS`
 * (`import-guide-descriptions.tsx`), porque este archivo no lleva JSX.
 */
export const GUIDE_COLUMN_DESCRIPTION_TEXTS: Readonly<Record<ImportColumnKey, string>> = {
  type: 'Qué es el producto: Insumo, Envase, Instrumento o Producto terminado. Decide qué otras columnas se piden.',
  name: 'Nombre del producto. Si ya existe uno igual (mismo nombre y unidad; en envases, misma presentación), se agrega como lote nuevo del producto.',
  unit: 'Unidad en que se mide el insumo, por su nombre o su símbolo. Debe existir en la empresa.',
  presentation:
    'Presentación del envase o del producto terminado. Debe existir en la empresa; en Producto terminado, con contenido declarado.',
  formula: 'Fórmula original de la empresa con la que se fabrica el producto terminado.',
  stock:
    'Cantidad que entra con este lote. Envase y Producto terminado cuentan unidades (5 unidades(U) de X fórmula).',
  unitCost: 'Costo de una unidad del lote.',
  lot: 'Código del lote. Si va vacío, se genera automáticamente.',
  purchaseDate: 'Fecha en que entró el lote. Si va vacía, se usa la fecha de hoy automáticamente; no puede ser futura.',
  expiryDate: 'Fecha en que vence el lote.',
  qtyAlert:
    'Existencia mínima del producto: cuando la existencia queda por debajo de este valor, el inventario lo resalta y se notifica.',
};
/** Columnas de la guía cuya descripción enlaza al módulo donde se gestiona su catálogo. */
export type GuideCatalogColumn = 'unit' | 'presentation' | 'formula';
export const GUIDE_CATALOG_LINK_LABELS: Readonly<Record<GuideCatalogColumn, string>> = {
  unit: 'Mira tus unidades disponibles',
  presentation: 'Mira tus presentaciones disponibles',
  formula: 'Mira tus fórmulas disponibles',
};
export const GUIDE_CATALOG_LINK_TESTIDS: Readonly<Record<GuideCatalogColumn, string>> = {
  unit: 'guide-link-unit',
  presentation: 'guide-link-presentation',
  formula: 'guide-link-formula',
};
export const GUIDE_RULE_LABELS = {
  required: 'Obligatoria',
  optional: 'Opcional',
  forbidden: 'Se ignora',
} as const;
/** Celda «Opcional» de las columnas que la importación rellena sola si van vacías. */
export const GUIDE_RULE_OPTIONAL_AUTO_LABEL = 'Opcional · automático si va vacío';
export const GUIDE_RULES_NOTES: readonly string[] = [
  '«Se ignora»: si la columna trae un valor, no se importa y la fila sigue; la vista previa lo avisa.',
  'Producto terminado no lleva «Nombre»: se arma como «Fórmula · Presentación». La presentación debe tener contenido declarado.',
  'Envase y Producto terminado cuentan la existencia en envases enteros; en Producto terminado, mayor que 0.',
  '«Unidad» se reconoce por su nombre o por su símbolo.',
  'Si el producto ya existe (mismo nombre y unidad; en envases, misma presentación), la fila le suma un lote.',
  '«Lote» vacío: se genera solo. «Fecha de compra» vacía: hoy; no puede ser futura.',
  'Números con coma o punto decimal, sin separador de miles y hasta 4 decimales. Fechas AAAA-MM-DD o DD/MM/AAAA.',
];
export const GUIDE_VALUES_HEADERS = {
  types: 'Tipo',
  units: 'Unidad',
  presentations: 'Presentación',
  formulas: 'Fórmula',
} as const;
export const GUIDE_VALUES_EMPTY = 'Ninguna registrada.';
export const GUIDE_VALUES_UNAVAILABLE =
  'No se pudieron cargar los valores de la empresa; la plantilla descargada sí los trae.';
export const GUIDE_EXAMPLES_NOTE =
  'Una fila por tipo. Si las dejas en el archivo, se reconocen y se ignoran al importar.';
