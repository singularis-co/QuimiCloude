import Papa from 'papaparse';

import {
  IMPORT_TYPE_ALIASES,
  IMPORT_TYPE_LABELS,
  INVENTORY_IMPORT_COLUMNS,
  type ImportCells,
  type ImportPreviewRow,
  type ImportResultRow,
} from './inventory-import-contract';

export type ImportDownload = {
  readonly fileName: string;
  readonly mimeType: 'text/csv;charset=utf-8';
  /** Con BOM UTF-8 al principio y separador ';': así lo abre en columnas Excel en español. */
  readonly content: string;
};

const BOM = '﻿';
const SEPARATOR = ';';
const LINE_BREAK = '\r\n';
const MIME_TYPE = 'text/csv;charset=utf-8';
const ERROR_ROW_HEADER = 'Fila';
const ERROR_REASON_HEADER = 'Motivo';
const REASON_SEPARATOR = ' | ';

export const IMPORT_TEMPLATE_FILE_NAME = 'plantilla-inventario.xlsx';
export const IMPORT_TEMPLATE_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const IMPORT_TEMPLATE_SHEET_NAME = 'Plantilla';
export const IMPORT_VALUES_SHEET_NAME = 'Valores disponibles';

const EXAMPLE_PURCHASE_DATE = '2026-01-15';
const EXAMPLE_EXPIRY_DATE = '2027-01-15';
const EXAMPLE_PRESENTATION = 'Ejemplo botella 1 litro';

/**
 * Una fila de ejemplo por tipo, porque cada tipo exige y prohíbe columnas distintas. Se comparan
 * celda a celda (recortadas) para ignorarlas al leer: una fila que casa con cualquiera se descarta.
 */
export const IMPORT_EXAMPLE_ROWS: readonly [ImportCells, ...ImportCells[]] = [
  {
    type: IMPORT_TYPE_LABELS.PRODUCT,
    subtype: '',
    name: 'Ejemplo ácido cítrico',
    unit: 'kilogramo',
    presentation: '',
    formula: '',
    stock: '25',
    unitCost: '3,50',
    lot: 'EJEMPLO-001',
    purchaseDate: EXAMPLE_PURCHASE_DATE,
    expiryDate: EXAMPLE_EXPIRY_DATE,
    qtyAlert: '5',
  },
  {
    type: IMPORT_TYPE_LABELS.PACKAGING,
    subtype: '',
    name: 'Ejemplo botella PET',
    unit: '',
    presentation: EXAMPLE_PRESENTATION,
    formula: '',
    stock: '100',
    unitCost: '0,80',
    lot: 'EJEMPLO-002',
    purchaseDate: EXAMPLE_PURCHASE_DATE,
    expiryDate: '',
    qtyAlert: '20',
  },
  {
    type: IMPORT_TYPE_LABELS.MACHINE,
    subtype: '',
    name: 'Ejemplo balanza',
    unit: '',
    presentation: '',
    formula: '',
    stock: '1',
    unitCost: '150',
    lot: 'EJEMPLO-003',
    purchaseDate: EXAMPLE_PURCHASE_DATE,
    expiryDate: '',
    qtyAlert: '',
  },
  {
    type: IMPORT_TYPE_LABELS.FINISHED_PRODUCT,
    subtype: '',
    name: '',
    unit: '',
    presentation: EXAMPLE_PRESENTATION,
    formula: 'Ejemplo limpiador multiuso',
    stock: '10',
    unitCost: '4,20',
    lot: 'EJEMPLO-004',
    purchaseDate: EXAMPLE_PURCHASE_DATE,
    expiryDate: EXAMPLE_EXPIRY_DATE,
    qtyAlert: '',
  },
];

/**
 * Las filas de ejemplo de las plantillas que ya se descargaron, con «Envase» en «Tipo» y sin
 * «Subtipo». Se siguen ignorando al leer para que esas plantillas no importen su ejemplo.
 */
export const LEGACY_IMPORT_EXAMPLE_ROWS: readonly ImportCells[] = IMPORT_EXAMPLE_ROWS.map((example) =>
  example.type === IMPORT_TYPE_LABELS.PACKAGING ? { ...example, type: IMPORT_TYPE_ALIASES.PACKAGING[0] } : example,
);

/** Los nombres tal como están guardados en la empresa: es lo que la importación reconoce. */
export type ImportTemplateValues = {
  readonly units: readonly string[];
  readonly presentations: readonly string[];
  readonly formulas: readonly string[];
};

export type ImportTemplateSheet = {
  readonly name: string;
  readonly rows: readonly (readonly string[])[];
};

function toCsv(lines: readonly (readonly string[])[]): string {
  const body = Papa.unparse(
    lines.map((cells) => [...cells]),
    { delimiter: SEPARATOR, newline: LINE_BREAK },
  );
  return BOM + body + LINE_BREAK;
}

function rowCells(cells: ImportCells): string[] {
  return INVENTORY_IMPORT_COLUMNS.map((column) => cells[column.key]);
}

/** Una columna por lista, cada una con su largo: las celdas que sobran van vacías. */
function valuesRows(values: ImportTemplateValues): string[][] {
  const columns = [Object.values(IMPORT_TYPE_LABELS), values.units, values.presentations, values.formulas];
  const length = Math.max(...columns.map((column) => column.length));
  const rows = Array.from({ length }, (_, index) => columns.map((column) => column[index] ?? ''));
  return [['Tipo', 'Unidad', 'Presentación', 'Fórmula'], ...rows];
}

/** La primera hoja es la que se importa; la segunda solo informa y la lectura no la mira. */
export function buildInventoryImportTemplateSheets(
  values: ImportTemplateValues,
): readonly [ImportTemplateSheet, ImportTemplateSheet] {
  const header = INVENTORY_IMPORT_COLUMNS.map((column) => column.header);
  return [
    { name: IMPORT_TEMPLATE_SHEET_NAME, rows: [header, ...IMPORT_EXAMPLE_ROWS.map(rowCells)] },
    { name: IMPORT_VALUES_SHEET_NAME, rows: valuesRows(values) },
  ];
}

function errorFileName(sourceFileName: string): string {
  const dot = sourceFileName.lastIndexOf('.');
  const base = dot > 0 ? sourceFileName.slice(0, dot) : sourceFileName;
  return `${base}-errores.csv`;
}

export function buildInventoryImportErrorFile(
  rows: readonly (ImportPreviewRow | ImportResultRow)[],
  sourceFileName: string,
): ImportDownload {
  const header = [ERROR_ROW_HEADER, ...INVENTORY_IMPORT_COLUMNS.map((column) => column.header), ERROR_REASON_HEADER];
  const lines = rows.flatMap((row) =>
    row.status === 'error'
      ? [
          [
            String(row.rowNumber),
            ...rowCells(row.cells),
            row.issues.map((issue) => issue.message).join(REASON_SEPARATOR),
          ],
        ]
      : [],
  );
  return {
    fileName: errorFileName(sourceFileName),
    mimeType: MIME_TYPE,
    content: toCsv([header, ...lines]),
  };
}
