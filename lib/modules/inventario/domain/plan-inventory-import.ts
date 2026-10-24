import { normalizeUnitName, type UnitRef } from '@/lib/modules/unidades';

import {
  parseImportDate,
  parseImportDecimal,
  parseImportPurchaseDate,
  parseImportSubtype,
  parseImportType,
} from './import-cell-parsing';
import {
  importFinishedGoodsRowSchema,
  packagesOf,
  type ImportFinishedGoodsInput,
} from './import-finished-goods';
import {
  INVENTORY_IMPORT_COLUMNS,
  type ImportBatchTarget,
  type ImportColumnKey,
  type ImportMissingEntry,
  type ImportPreviewRow,
  type ImportRowIssue,
  type ImportRowIssueCode,
  type ImportRowType,
} from './inventory-import-contract';
import {
  countsAsPackagingHomonym,
  PACKAGING_SUBTYPES,
  requiresPresentation,
  type PackagingSubtype,
} from './packaging-subtype';
import { normalizePresentationName } from './presentation-name';
import { typedLotSchema } from './product-batch-input';
import { createProductSchema, isWholeQuantity, PRODUCT_NAME_MAX_LENGTH } from './product-input';
import { normalizeProductName } from './product-name';
import { PRODUCT_TYPES } from './product-type';

import type { ParsedImportRow, ParsedImportSheet } from './import-sheet';
import type { ImportProductRef } from '../ports/inventory-import-repository';

export type ImportPresentationRef = {
  readonly id: string;
  readonly name: string;
  readonly nameNormalized: string;
  readonly unitId: string;
  readonly content: string | null;
};

export type ImportFormulaRef = { readonly id: string; readonly name: string };

/** Lo que se lee de la base, en lote, antes de planificar. */
export type ImportCatalogSnapshot = {
  /** Unidades visibles para la empresa: propias y de sistema. */
  readonly units: readonly UnitRef[];
  readonly presentations: readonly ImportPresentationRef[];
  /** Por `importFormulaKey` del texto de la columna. */
  readonly formulas: ReadonlyMap<string, ImportFormulaRef>;
  /** Vivos, de cualquier tipo, ordenados por antiguedad. */
  readonly products: readonly ImportProductRef[];
  readonly finishedProducts: readonly ImportProductRef[];
  readonly batches: readonly {
    readonly lot: string;
    readonly productId: string;
    readonly presentationId: string | null;
  }[];
};

/** Lo que la confirmacion escribe por una fila valida. */
export type ImportRowWrite =
  | { readonly kind: 'product'; readonly candidate: Readonly<Record<string, unknown>> }
  | { readonly kind: 'finished'; readonly input: ImportFinishedGoodsInput };

export type PlannedInventoryImport = {
  readonly rows: readonly ImportPreviewRow[];
  readonly missingUnits: readonly ImportMissingEntry[];
  readonly missingPresentations: readonly ImportMissingEntry[];
  /** Por numero de fila, solo las `create` y `add_batch`. */
  readonly writes: ReadonlyMap<number, ImportRowWrite>;
};

const HEADER_BY_KEY = new Map<ImportColumnKey, string>(
  INVENTORY_IMPORT_COLUMNS.map((column) => [column.key, column.header]),
);
const COLUMN_ORDER = new Map<ImportColumnKey, number>(
  INVENTORY_IMPORT_COLUMNS.map((column, index) => [column.key, index]),
);

const NUMBER_RULE = 'con hasta 10 enteros y 4 decimales';
const DATE_RULE = 'no es una fecha valida (AAAA-MM-DD o DD/MM/AAAA).';

const ISSUE_TEXT: Readonly<Record<ImportRowIssueCode, string>> = {
  type_invalid: 'debe ser Insumo, Envase, Instrumento o Producto terminado.',
  subtype_invalid: 'debe ser Envase, Tapa, Medidor u Otro.',
  subtype_mismatch: 'ya existe un empaque con ese nombre y otro subtipo.',
  value_required: 'este campo es obligatorio para este tipo.',
  name_too_long: `admite hasta ${PRODUCT_NAME_MAX_LENGTH} caracteres.`,
  unit_not_found: 'la unidad no existe en la empresa.',
  unit_ambiguous: 'coincide con mas de una unidad; escribe su nombre completo.',
  presentation_not_found: 'la presentacion no existe en la empresa.',
  presentation_without_content: 'la presentacion no tiene contenido declarado.',
  presentation_mismatch: 'ya existe un envase con ese nombre y otra presentacion.',
  formula_not_found: 'no es una formula original de la empresa.',
  finished_product_homonym: 'ya existe un producto terminado con ese nombre.',
  stock_invalid: `debe ser un numero mayor o igual que 0, ${NUMBER_RULE}.`,
  stock_not_whole: 'debe ser un numero entero de envases.',
  cost_invalid: `debe ser un importe mayor que 0, ${NUMBER_RULE}.`,
  total_cost_too_low: 'es demasiado bajo para esa existencia: el costo unitario quedaria en 0.',
  qty_alert_invalid: `debe ser un numero mayor o igual que 0, ${NUMBER_RULE}.`,
  number_format_invalid: 'usa un solo separador decimal (coma o punto), sin separador de miles y hasta 4 decimales.',
  lot_invalid: 'debe tener entre 1 y 60 caracteres; un lote de solo numeros, hasta 59.',
  purchase_date_invalid: DATE_RULE,
  purchase_date_future: 'no puede ser posterior a hoy.',
  expiry_date_invalid: DATE_RULE,
  write_failed: 'No se pudo guardar la fila.',
};

/** El motivo nombra siempre su columna, para pintarlo y para el archivo de errores. */
export function importRowIssue(
  code: ImportRowIssueCode,
  column: ImportColumnKey | null,
  text: string = ISSUE_TEXT[code],
): ImportRowIssue {
  const message = column === null ? text : `${HEADER_BY_KEY.get(column) ?? column}: ${text}`;
  return { code, column, message };
}

/** Misma clave que las demas normalizaciones de nombre del repo: solo `[a-z0-9]`, sin tildes. */
export function importFormulaKey(text: string): string {
  return normalizeProductName(text);
}

const DECIMAL_PATTERN = /^\d{1,10}(\.\d{1,4})?$/;
const ZERO_PATTERN = /^0+(\.0*)?$/;
/** Valido para el esquema mientras la referencia real se resuelve aparte. */
const PLACEHOLDER_ID = '00000000-0000-4000-8000-000000000000';

function isAcceptedAmount(value: string | null): boolean {
  return value !== null && DECIMAL_PATTERN.test(value) && !ZERO_PATTERN.test(value);
}

/** Un motivo por columna: el primero que se detecta es el que explica la fila. */
class RowIssues {
  private readonly byColumn = new Map<ImportColumnKey, ImportRowIssue>();

  add(code: ImportRowIssueCode, column: ImportColumnKey, text?: string): void {
    if (!this.byColumn.has(column)) this.byColumn.set(column, importRowIssue(code, column, text));
  }

  has(column: ImportColumnKey): boolean {
    return this.byColumn.has(column);
  }

  get size(): number {
    return this.byColumn.size;
  }

  list(): ImportRowIssue[] {
    return [...this.byColumn.values()].sort(
      (a, b) => (COLUMN_ORDER.get(a.column ?? 'type') ?? 0) - (COLUMN_ORDER.get(b.column ?? 'type') ?? 0),
    );
  }
}

type RowValues = {
  readonly name: string;
  readonly stock: string;
  readonly unitCost: string | null;
  readonly totalCost: string | null;
  readonly qtyAlert: string;
  readonly lot: string | null;
  readonly purchaseDate: string | null;
  readonly expiryDate: string | null;
};

function readDecimal(row: ParsedImportRow, key: ImportColumnKey, issues: RowIssues): string | null {
  const parsed = parseImportDecimal(row.cells[key], row.origins[key]);
  if (parsed.kind === 'empty') return null;
  if (parsed.kind === 'number_format_invalid') {
    issues.add('number_format_invalid', key);
    return row.cells[key].trim();
  }
  return parsed.value;
}

type ImportColumn = (typeof INVENTORY_IMPORT_COLUMNS)[number];
type ColumnRules = ImportColumn['rules'];

/**
 * La regla de la columna para el tipo. Sin tipo valido, solo la regla en la que coinciden todos los
 * tipos: lo demas depende de un tipo que la fila no dice.
 */
function ruleFor(rules: ColumnRules, type: ImportRowType | null): ColumnRules[ImportRowType] | null {
  if (type !== null) return rules[type];
  const [first, ...rest] = Object.values(rules);
  return first !== undefined && rest.every((rule) => rule === first) ? first : null;
}

/**
 * La tabla de reglas es por tipo; en un empaque, la presentacion depende ademas del subtipo. Un
 * empaque con «Subtipo» ilegible (`null`) deja la presentacion sin regla.
 */
function columnRule(
  column: ImportColumn,
  type: ImportRowType | null,
  subtype: PackagingSubtype | null,
): ColumnRules[ImportRowType] | null {
  if (type === PRODUCT_TYPES.PACKAGING && column.key === 'presentation') {
    if (subtype === null) return null;
    return requiresPresentation(subtype) ? 'required' : 'forbidden';
  }
  return ruleFor(column.rules, type);
}

function checkRequired(
  row: ParsedImportRow,
  type: ImportRowType | null,
  subtype: PackagingSubtype | null,
  issues: RowIssues,
): void {
  for (const column of INVENTORY_IMPORT_COLUMNS) {
    const filled = row.cells[column.key].trim() !== '';
    if (columnRule(column, type, subtype) === 'required' && !filled) issues.add('value_required', column.key);
  }
}

/**
 * Una columna que el tipo no usa no rompe la fila: se ignora y se avisa. La fila se planifica como
 * si esa celda viniera vacia; las celdas originales se conservan para mostrarlas y para el archivo
 * de errores.
 */
function withoutIgnoredColumns(
  row: ParsedImportRow,
  type: ImportRowType,
  subtype: PackagingSubtype | null,
): { readonly row: ParsedImportRow; readonly ignoredColumns: readonly ImportColumnKey[] } {
  const ignoredColumns = INVENTORY_IMPORT_COLUMNS.filter(
    (column) => columnRule(column, type, subtype) === 'forbidden' && row.cells[column.key].trim() !== '',
  ).map((column) => column.key);
  if (ignoredColumns.length === 0) return { row, ignoredColumns };
  const cells = { ...row.cells };
  for (const key of ignoredColumns) cells[key] = '';
  return { row: { ...row, cells }, ignoredColumns };
}

function readValues(
  row: ParsedImportRow,
  type: ImportRowType | null,
  subtype: PackagingSubtype | null,
  today: string,
  issues: RowIssues,
): RowValues {
  const applies = (key: ImportColumnKey): boolean => {
    const column = INVENTORY_IMPORT_COLUMNS.find((candidate) => candidate.key === key);
    if (column === undefined) return true;
    return type === null
      ? Object.values(column.rules).some((rule) => rule !== 'forbidden')
      : columnRule(column, type, subtype) !== 'forbidden';
  };

  let purchaseDate: string | null = null;
  const purchaseText = row.cells.purchaseDate;
  if (purchaseText.trim() !== '') {
    const parsed = parseImportPurchaseDate(purchaseText, today);
    if (parsed.kind === 'value') purchaseDate = parsed.value;
    else if (parsed.kind === 'future') {
      issues.add('purchase_date_future', 'purchaseDate');
      const canonical = parseImportDate(purchaseText);
      purchaseDate = canonical.kind === 'value' ? canonical.value : null;
    } else {
      issues.add('purchase_date_invalid', 'purchaseDate');
      purchaseDate = purchaseText.trim();
    }
  }

  let expiryDate: string | null = null;
  if (applies('expiryDate')) {
    const parsed = parseImportDate(row.cells.expiryDate);
    if (parsed.kind === 'value') expiryDate = parsed.value;
    else if (parsed.kind === 'invalid') {
      issues.add('expiry_date_invalid', 'expiryDate');
      expiryDate = row.cells.expiryDate.trim();
    }
  }

  const lotText = row.cells.lot.trim();
  return {
    name: row.cells.name,
    stock: readDecimal(row, 'stock', issues) ?? '',
    unitCost: readDecimal(row, 'unitCost', issues),
    totalCost: null,
    qtyAlert: applies('qtyAlert') ? (readDecimal(row, 'qtyAlert', issues) ?? '') : '',
    lot: lotText === '' ? null : row.cells.lot,
    purchaseDate,
    expiryDate,
  };
}

const STOCK_ZERO_FOR_TOTAL = 'debe ser mayor que 0 para derivar el costo unitario del costo total.';

function addSchemaIssue(field: string, type: ImportRowType, values: RowValues, issues: RowIssues): void {
  switch (field) {
    case 'name':
      issues.add(values.name.trim() === '' ? 'value_required' : 'name_too_long', 'name');
      return;
    case 'stock': {
      const stock = values.stock.trim();
      if (!DECIMAL_PATTERN.test(stock)) issues.add('stock_invalid', 'stock');
      else if (type === PRODUCT_TYPES.FINISHED_PRODUCT) {
        issues.add('stock_not_whole', 'stock', 'debe ser un numero entero de envases mayor que 0.');
      } else if (type === PRODUCT_TYPES.PACKAGING && !isWholeQuantity(stock)) issues.add('stock_not_whole', 'stock');
      else issues.add('stock_invalid', 'stock', STOCK_ZERO_FOR_TOTAL);
      return;
    }
    // Sin «Costo total» en el archivo, todo rechazo de costo cae en «Costo unitario». La celda
    // vacia ya la nombro `checkRequired` con `value_required` (el contrato la exige al tipo): el
    // esquema, que tambien la rechaza, no suma un segundo motivo para la misma columna.
    case 'unitCost':
    case 'totalCost':
      issues.add(values.unitCost === null ? 'value_required' : 'cost_invalid', 'unitCost');
      return;
    case 'qtyAlert':
      issues.add(values.qtyAlert.trim() === '' ? 'value_required' : 'qty_alert_invalid', 'qtyAlert');
      return;
    case 'lot':
      issues.add('lot_invalid', 'lot');
      return;
    case 'purchaseDate':
      issues.add('purchase_date_invalid', 'purchaseDate');
      return;
    case 'expiryDate':
      issues.add('expiry_date_invalid', 'expiryDate');
      return;
    default:
      throw new Error(`plan-inventory-import: el esquema rechazo un campo sin columna: ${field}`);
  }
}

function productCandidate(
  type: ImportRowType,
  values: RowValues,
  refs: { readonly unitId: string; readonly presentationId: string },
  subtype: PackagingSubtype,
): Record<string, unknown> {
  const batch = {
    stock: values.stock,
    unitCost: values.unitCost,
    totalCost: values.totalCost,
    lot: values.lot,
    purchaseDate: values.purchaseDate,
  };
  if (type === PRODUCT_TYPES.PRODUCT) {
    return { type, name: values.name, unitId: refs.unitId, qtyAlert: values.qtyAlert, ...batch, expiryDate: values.expiryDate };
  }
  if (type === PRODUCT_TYPES.PACKAGING) {
    return {
      type,
      name: values.name,
      qtyAlert: values.qtyAlert,
      packagingSubtype: subtype,
      ...(requiresPresentation(subtype) ? { presentationId: refs.presentationId } : {}),
      ...batch,
    };
  }
  return { type, name: values.name, ...batch, expiryDate: values.expiryDate };
}

/** Sin tipo no hay esquema que aplicar: solo las reglas de campo que valen para todos los tipos. */
function validateWithoutType(values: RowValues, issues: RowIssues): void {
  if (values.name.trim().length > PRODUCT_NAME_MAX_LENGTH) issues.add('name_too_long', 'name');
  const stock = values.stock.trim();
  if (stock !== '' && !DECIMAL_PATTERN.test(stock)) issues.add('stock_invalid', 'stock');
  if (values.unitCost !== null && !isAcceptedAmount(values.unitCost.trim())) issues.add('cost_invalid', 'unitCost');
  const qtyAlert = values.qtyAlert.trim();
  if (qtyAlert !== '' && !DECIMAL_PATTERN.test(qtyAlert)) issues.add('qty_alert_invalid', 'qtyAlert');
  if (values.lot !== null && !typedLotSchema.safeParse(values.lot).success) issues.add('lot_invalid', 'lot');
}

/** Un «Subtipo» ilegible ya tiene su motivo: el resto de la fila se valida como la de un envase. */
function validateWithSchema(
  type: ImportRowType,
  subtype: PackagingSubtype | null,
  values: RowValues,
  issues: RowIssues,
): void {
  const result =
    type === PRODUCT_TYPES.FINISHED_PRODUCT
      ? importFinishedGoodsRowSchema.safeParse({
          stock: values.stock,
          unitCost: values.unitCost,
          totalCost: values.totalCost,
          lot: values.lot,
          purchaseDate: values.purchaseDate,
          expiryDate: values.expiryDate,
        })
      : createProductSchema.safeParse(
          productCandidate(
            type,
            values,
            { unitId: PLACEHOLDER_ID, presentationId: PLACEHOLDER_ID },
            subtype ?? PACKAGING_SUBTYPES.CONTAINER,
          ),
        );
  if (result.success) return;
  for (const issue of result.error.issues) addSchemaIssue(String(issue.path[0] ?? ''), type, values, issues);
}

type UnitMatch = { readonly kind: 'found'; readonly id: string } | { readonly kind: 'not_found' } | { readonly kind: 'ambiguous' };

/** Por nombre normalizado y, si ninguna casa, por simbolo exacto. */
function matchUnit(text: string, units: readonly UnitRef[]): UnitMatch {
  const normalized = normalizeUnitName(text);
  const byName = units.filter((unit) => normalized !== '' && normalizeUnitName(unit.name) === normalized);
  const trimmed = text.trim();
  const candidates = byName.length > 0 ? byName : units.filter((unit) => unit.symbol?.trim() === trimmed);
  const ids = [...new Set(candidates.map((unit) => unit.id))];
  if (ids.length === 0) return { kind: 'not_found' };
  if (ids.length > 1) return { kind: 'ambiguous' };
  return { kind: 'found', id: ids[0] as string };
}

class MissingCatalog {
  private readonly entries = new Map<string, { name: string; rowNumbers: number[] }>();

  note(key: string, name: string, rowNumber: number): void {
    const entry = this.entries.get(key);
    if (entry === undefined) this.entries.set(key, { name: name.trim(), rowNumbers: [rowNumber] });
    else entry.rowNumbers.push(rowNumber);
  }

  list(): ImportMissingEntry[] {
    return [...this.entries.values()];
  }
}

type FileProduct = {
  readonly rowNumber: number;
  readonly presentationId: string | null;
  readonly packagingSubtype: PackagingSubtype | null;
  readonly finished: boolean;
};

type PlanState = {
  readonly snapshot: ImportCatalogSnapshot;
  readonly presentationsByName: ReadonlyMap<string, ImportPresentationRef>;
  readonly batchKeys: ReadonlySet<string>;
  readonly fileProducts: Map<string, FileProduct>;
  /** Por `fileLotKey`: el producto al que una fila anterior ya sumo ese lote. */
  readonly fileLots: Map<string, ImportBatchTarget>;
  readonly missingUnits: MissingCatalog;
  readonly missingPresentations: MissingCatalog;
};

type Identity = {
  readonly key: string;
  /** `null` = la fila crea el producto. */
  readonly target: ImportBatchTarget | null;
  /** Otra identidad que la creacion de esta fila ocupa: el nombre derivado de un terminado. */
  readonly alsoOccupies?: string;
};

type Resolved = {
  readonly unitId: string | null;
  readonly presentation: ImportPresentationRef | null;
  readonly formula: ImportFormulaRef | null;
};

function resolveReferences(row: ParsedImportRow, type: ImportRowType, state: PlanState, issues: RowIssues): Resolved {
  let unitId: string | null = null;
  let presentation: ImportPresentationRef | null = null;
  let formula: ImportFormulaRef | null = null;

  const unitText = row.cells.unit;
  if (type === PRODUCT_TYPES.PRODUCT && unitText.trim() !== '') {
    const match = matchUnit(unitText, state.snapshot.units);
    if (match.kind === 'found') unitId = match.id;
    else if (match.kind === 'ambiguous') issues.add('unit_ambiguous', 'unit');
    else {
      issues.add('unit_not_found', 'unit');
      state.missingUnits.note(normalizeUnitName(unitText) || unitText.trim(), unitText, row.rowNumber);
    }
  }

  const presentationText = row.cells.presentation;
  const usesPresentation = type === PRODUCT_TYPES.PACKAGING || type === PRODUCT_TYPES.FINISHED_PRODUCT;
  if (usesPresentation && presentationText.trim() !== '') {
    const key = normalizePresentationName(presentationText);
    presentation = state.presentationsByName.get(key) ?? null;
    if (presentation === null) {
      issues.add('presentation_not_found', 'presentation');
      state.missingPresentations.note(key || presentationText.trim(), presentationText, row.rowNumber);
    } else if (type === PRODUCT_TYPES.FINISHED_PRODUCT && presentation.content === null) {
      issues.add('presentation_without_content', 'presentation');
    }
  }

  if (type === PRODUCT_TYPES.FINISHED_PRODUCT && row.cells.formula.trim() !== '') {
    formula = state.snapshot.formulas.get(importFormulaKey(row.cells.formula)) ?? null;
    if (formula === null) issues.add('formula_not_found', 'formula');
  }

  return { unitId, presentation, formula };
}

function existingTarget(id: string): ImportBatchTarget {
  return { kind: 'existing', productId: id };
}

function fileTarget(product: FileProduct): ImportBatchTarget {
  return { kind: 'file_row', rowNumber: product.rowNumber };
}

/** La misma regla de identidad que el alta manual de cada tipo, contra la base y contra el archivo. */
function resolveIdentity(
  type: ImportRowType,
  subtype: PackagingSubtype | null,
  name: string,
  refs: Resolved,
  state: PlanState,
  issues: RowIssues,
): Identity | null {
  const { products, finishedProducts } = state.snapshot;
  const normalized = normalizeProductName(name);

  if (type === PRODUCT_TYPES.FINISHED_PRODUCT) {
    if (refs.formula === null || refs.presentation === null) return null;
    const key = `F|${refs.formula.id}|${refs.presentation.id}`;
    const derived = normalizeProductName(`${refs.formula.name} · ${refs.presentation.name}`);
    const alsoOccupies = `P|${derived}|${refs.presentation.unitId}`;
    const existing = finishedProducts.find(
      (product) => product.recipeId === refs.formula?.id && product.presentationId === refs.presentation?.id,
    );
    if (existing !== undefined) return { key, target: existingTarget(existing.id) };
    const inFile = state.fileProducts.get(key);
    return { key, target: inFile === undefined ? null : fileTarget(inFile), alsoOccupies };
  }

  if (type === PRODUCT_TYPES.PACKAGING) {
    if (subtype === null) return null;
    const presentation = refs.presentation;
    if (requiresPresentation(subtype) && presentation === null) return null;
    const key = `E|${normalized}`;
    const existing = products.find(
      (product) =>
        product.nameNormalized === normalized &&
        product.type === PRODUCT_TYPES.PACKAGING &&
        countsAsPackagingHomonym(product),
    );
    const inFile = state.fileProducts.get(key);
    const known = existing ?? inFile;
    if (known !== undefined && known.packagingSubtype !== subtype) {
      issues.add('subtype_mismatch', 'subtype');
      return null;
    }
    if (known !== undefined && presentation !== null && known.presentationId !== presentation.id) {
      issues.add('presentation_mismatch', 'presentation');
      return null;
    }
    if (existing !== undefined) return { key, target: existingTarget(existing.id) };
    return { key, target: inFile === undefined ? null : fileTarget(inFile) };
  }

  const unitId = type === PRODUCT_TYPES.PRODUCT ? refs.unitId : null;
  if (type === PRODUCT_TYPES.PRODUCT && unitId === null) return null;
  const key = type === PRODUCT_TYPES.PRODUCT ? `P|${normalized}|${unitId}` : `M|${normalized}`;
  const existing = products.find((product) => product.nameNormalized === normalized && product.unitId === unitId);
  const inFile = state.fileProducts.get(key);
  if (existing?.type === PRODUCT_TYPES.FINISHED_PRODUCT || (existing === undefined && inFile?.finished === true)) {
    issues.add('finished_product_homonym', 'name');
    return null;
  }
  if (existing !== undefined) return { key, target: existingTarget(existing.id) };
  return { key, target: inFile === undefined ? null : fileTarget(inFile) };
}

/** JSON y no un separador: un `null` no se confunde con un texto y el codigo puede llevar cualquier caracter. */
function batchKeyOf(productId: string, presentationId: string | null, lot: string): string {
  return JSON.stringify([productId, presentationId, lot]);
}

/** La identidad ya fija producto y presentacion del lote que escribiria la fila. */
function fileLotKey(identityKey: string, lot: string): string {
  return JSON.stringify([identityKey, lot]);
}

/** Solo los terminados guardan la presentacion en el lote; insumos, envases e instrumentos, no. */
function lotPresentationId(type: ImportRowType, refs: Resolved): string | null {
  return type === PRODUCT_TYPES.FINISHED_PRODUCT ? (refs.presentation?.id ?? null) : null;
}

/** Duplicado solo con la misma clave; el mismo codigo en otro producto o presentacion no cuenta. */
function checkLot(lot: string, lotPresentation: string | null, identity: Identity, state: PlanState): ImportBatchTarget | null {
  const target = identity.target;
  if (target?.kind === 'existing' && state.batchKeys.has(batchKeyOf(target.productId, lotPresentation, lot))) {
    return target;
  }
  const inFile = state.fileLots.get(fileLotKey(identity.key, lot));
  return inFile === undefined ? null : (target ?? inFile);
}

function finishedWrite(values: RowValues, refs: Resolved): ImportFinishedGoodsInput | null {
  if (refs.formula === null || refs.presentation === null || refs.presentation.content === null) return null;
  return {
    recipeId: refs.formula.id,
    recipeName: refs.formula.name,
    presentationId: refs.presentation.id,
    content: refs.presentation.content,
    packages: packagesOf(values.stock),
    unitCost: values.unitCost,
    totalCost: values.totalCost,
    lot: values.lot === null ? null : values.lot.trim(),
    purchaseDate: values.purchaseDate,
    expiryDate: values.expiryDate,
  };
}

type PlannedRow = { readonly preview: ImportPreviewRow; readonly write: ImportRowWrite | null };

function planRow(parsed: ParsedImportRow, state: PlanState, today: string): PlannedRow {
  const type = parseImportType(parsed.cells.type);
  if (type === null) {
    const base = { rowNumber: parsed.rowNumber, cells: parsed.cells, packagingSubtype: null };
    const issues = new RowIssues();
    issues.add('type_invalid', 'type');
    checkRequired(parsed, null, null, issues);
    validateWithoutType(readValues(parsed, null, null, today, issues), issues);
    const [first, ...rest] = issues.list();
    const all: [ImportRowIssue, ...ImportRowIssue[]] = [first ?? importRowIssue('type_invalid', 'type'), ...rest];
    return { preview: { ...base, type: null, productName: null, status: 'error', issues: all }, write: null };
  }

  const issues = new RowIssues();
  let subtype: PackagingSubtype | null = null;
  if (type === PRODUCT_TYPES.PACKAGING) {
    const parsedSubtype = parseImportSubtype(parsed.cells.subtype);
    if (parsedSubtype.kind === 'value') subtype = parsedSubtype.value;
    else issues.add('subtype_invalid', 'subtype');
  }

  const { row, ignoredColumns } = withoutIgnoredColumns(parsed, type, subtype);
  const base = {
    rowNumber: parsed.rowNumber,
    cells: parsed.cells,
    packagingSubtype: subtype,
    ...(ignoredColumns.length === 0 ? {} : { ignoredColumns }),
  };
  checkRequired(row, type, subtype, issues);
  const values = readValues(row, type, subtype, today, issues);
  validateWithSchema(type, subtype, values, issues);
  const refs = resolveReferences(row, type, state, issues);

  const productName =
    type === PRODUCT_TYPES.FINISHED_PRODUCT
      ? refs.formula !== null && refs.presentation !== null
        ? `${refs.formula.name} · ${refs.presentation.name}`
        : null
      : values.name.trim() || null;

  const identity = resolveIdentity(type, subtype, values.name, refs, state, issues);
  const lot = values.lot?.trim() ?? null;
  const duplicateOf =
    identity !== null && lot !== null && !issues.has('lot')
      ? checkLot(lot, lotPresentationId(type, refs), identity, state)
      : null;

  const withName = { ...base, type, productName };
  const [first, ...rest] = issues.list();
  if (first !== undefined || identity === null) {
    const all: [ImportRowIssue, ...ImportRowIssue[]] =
      first !== undefined ? [first, ...rest] : [importRowIssue('value_required', 'name')];
    return { preview: { ...withName, status: 'error', issues: all }, write: null };
  }
  if (duplicateOf !== null && lot !== null) {
    return { preview: { ...withName, status: 'duplicate', lot, target: duplicateOf }, write: null };
  }

  if (identity.target === null) {
    const created: FileProduct = {
      rowNumber: row.rowNumber,
      presentationId: refs.presentation?.id ?? null,
      packagingSubtype: subtype,
      finished: type === PRODUCT_TYPES.FINISHED_PRODUCT,
    };
    state.fileProducts.set(identity.key, created);
    if (identity.alsoOccupies !== undefined) state.fileProducts.set(identity.alsoOccupies, created);
  }
  if (lot !== null) {
    state.fileLots.set(
      fileLotKey(identity.key, lot),
      identity.target ?? { kind: 'file_row', rowNumber: row.rowNumber },
    );
  }

  const write: ImportRowWrite | null =
    type === PRODUCT_TYPES.FINISHED_PRODUCT
      ? (() => {
          const input = finishedWrite(values, refs);
          return input === null ? null : { kind: 'finished', input };
        })()
      : {
          kind: 'product',
          candidate: productCandidate(
            type,
            values,
            { unitId: refs.unitId ?? PLACEHOLDER_ID, presentationId: refs.presentation?.id ?? PLACEHOLDER_ID },
            subtype ?? PACKAGING_SUBTYPES.CONTAINER,
          ),
        };

  const preview: ImportPreviewRow =
    identity.target === null
      ? { ...withName, status: 'create' }
      : { ...withName, status: 'add_batch', target: identity.target };
  return { preview, write };
}

/**
 * Asigna a cada fila un estado con las reglas del alta manual. Pura: la usan igual la vista previa
 * y la confirmacion, para que las dos digan lo mismo del mismo archivo y la misma base.
 */
export function planInventoryImport(
  sheet: ParsedImportSheet,
  catalog: ImportCatalogSnapshot,
  today: string,
): PlannedInventoryImport {
  const state: PlanState = {
    snapshot: catalog,
    presentationsByName: new Map(catalog.presentations.map((presentation) => [presentation.nameNormalized, presentation])),
    batchKeys: new Set(catalog.batches.map((batch) => batchKeyOf(batch.productId, batch.presentationId, batch.lot))),
    fileProducts: new Map(),
    fileLots: new Map(),
    missingUnits: new MissingCatalog(),
    missingPresentations: new MissingCatalog(),
  };

  const rows: ImportPreviewRow[] = [];
  const writes = new Map<number, ImportRowWrite>();
  for (const row of sheet.rows) {
    const planned = planRow(row, state, today);
    rows.push(planned.preview);
    if (planned.write !== null) writes.set(row.rowNumber, planned.write);
  }

  return {
    rows,
    missingUnits: state.missingUnits.list(),
    missingPresentations: state.missingPresentations.list(),
    writes,
  };
}

/** Que hay que leer de la base para planificar este archivo. */
export type ImportLookups = {
  readonly productNames: readonly string[];
  readonly presentationNames: readonly string[];
  /** Clave -> texto tal cual de la primera fila que la nombra. */
  readonly formulaNames: ReadonlyMap<string, string>;
  readonly lots: readonly string[];
  readonly needsUnits: boolean;
};

export function collectImportLookups(sheet: ParsedImportSheet): ImportLookups {
  const productNames = new Set<string>();
  const presentationNames = new Set<string>();
  const formulaNames = new Map<string, string>();
  const lots = new Set<string>();
  let needsUnits = false;

  for (const { cells } of sheet.rows) {
    if (cells.name.trim() !== '') productNames.add(cells.name.trim());
    const presentation = normalizePresentationName(cells.presentation);
    if (presentation !== '') presentationNames.add(presentation);
    const formula = importFormulaKey(cells.formula);
    if (formula !== '' && !formulaNames.has(formula)) formulaNames.set(formula, cells.formula.trim());
    if (cells.lot.trim() !== '') lots.add(cells.lot.trim());
    if (cells.unit.trim() !== '') needsUnits = true;
  }

  return {
    productNames: [...productNames],
    presentationNames: [...presentationNames],
    formulaNames,
    lots: [...lots],
    needsUnits,
  };
}

/** Pares (formula, presentacion) de las filas de terminado que ya se pueden resolver. */
export function collectFinishedPairs(
  sheet: ParsedImportSheet,
  presentations: readonly ImportPresentationRef[],
  formulas: ReadonlyMap<string, ImportFormulaRef>,
): { recipeId: string; presentationId: string }[] {
  const byName = new Map(presentations.map((presentation) => [presentation.nameNormalized, presentation]));
  const pairs = new Map<string, { recipeId: string; presentationId: string }>();
  for (const { cells } of sheet.rows) {
    if (parseImportType(cells.type) !== PRODUCT_TYPES.FINISHED_PRODUCT) continue;
    const formula = formulas.get(importFormulaKey(cells.formula));
    const presentation = byName.get(normalizePresentationName(cells.presentation));
    if (formula === undefined || presentation === undefined) continue;
    pairs.set(`${formula.id}|${presentation.id}`, { recipeId: formula.id, presentationId: presentation.id });
  }
  return [...pairs.values()];
}
