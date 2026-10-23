/**
 * Catalogo cerrado de subtipos de empaque, espejo del enum Postgres `PackagingSubtype`.
 * `proveedores` tiene su propia copia porque no puede importar este modulo; un test compara las
 * dos con `db/schema.prisma`.
 */
export const PACKAGING_SUBTYPES = Object.freeze({
  CONTAINER: 'CONTAINER',
  CAP: 'CAP',
  MEASURER: 'MEASURER',
  OTHER: 'OTHER',
} as const);

export type PackagingSubtype = (typeof PACKAGING_SUBTYPES)[keyof typeof PACKAGING_SUBTYPES];

export const PACKAGING_SUBTYPE_VALUES = [
  PACKAGING_SUBTYPES.CONTAINER,
  PACKAGING_SUBTYPES.CAP,
  PACKAGING_SUBTYPES.MEASURER,
  PACKAGING_SUBTYPES.OTHER,
] as const satisfies readonly PackagingSubtype[];

/** Solo el envase lleva presentacion. */
export function requiresPresentation(subtype: PackagingSubtype): boolean {
  return subtype === PACKAGING_SUBTYPES.CONTAINER;
}
