/** Espejo del enum Postgres `CatalogLineType`: que vende el proveedor en una linea de catalogo. */
export const CATALOG_LINE_TYPES = Object.freeze({
  RAW_MATERIAL: 'RAW_MATERIAL',
  TOOL: 'TOOL',
  PACKAGING_MATERIAL: 'PACKAGING_MATERIAL',
} as const);

export type CatalogLineType = (typeof CATALOG_LINE_TYPES)[keyof typeof CATALOG_LINE_TYPES];

export const CATALOG_LINE_TYPE_VALUES = [
  CATALOG_LINE_TYPES.RAW_MATERIAL,
  CATALOG_LINE_TYPES.TOOL,
  CATALOG_LINE_TYPES.PACKAGING_MATERIAL,
] as const satisfies readonly CatalogLineType[];

/**
 * Espejo del enum Postgres `PackagingSubtype`. Duplicado a proposito del de `inventario`: de otro
 * modulo solo se importa su contrato, y este modulo no puede importar `inventario`.
 */
export const CATALOG_LINE_PACKAGING_SUBTYPES = Object.freeze({
  CONTAINER: 'CONTAINER',
  CAP: 'CAP',
  MEASURER: 'MEASURER',
  OTHER: 'OTHER',
} as const);

export type CatalogLinePackagingSubtype =
  (typeof CATALOG_LINE_PACKAGING_SUBTYPES)[keyof typeof CATALOG_LINE_PACKAGING_SUBTYPES];

export const CATALOG_LINE_PACKAGING_SUBTYPES_VALUES = [
  CATALOG_LINE_PACKAGING_SUBTYPES.CONTAINER,
  CATALOG_LINE_PACKAGING_SUBTYPES.CAP,
  CATALOG_LINE_PACKAGING_SUBTYPES.MEASURER,
  CATALOG_LINE_PACKAGING_SUBTYPES.OTHER,
] as const satisfies readonly CatalogLinePackagingSubtype[];
