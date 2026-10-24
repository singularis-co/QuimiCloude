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

/**
 * Si un empaque vivo cuenta como homonimo al dar de alta otro con el mismo nombre. El envase
 * sin presentacion es legado: se ignora para que un envase nuevo con ese nombre pueda nacer y,
 * si ya coexisten, los lotes vayan al que tiene presentacion. La consulta de Prisma de
 * `findAlivePackagingByName` aplica esta misma regla.
 */
export function countsAsPackagingHomonym(ref: {
  readonly packagingSubtype: PackagingSubtype | null;
  readonly presentationId: string | null;
}): boolean {
  return !(ref.packagingSubtype === PACKAGING_SUBTYPES.CONTAINER && ref.presentationId === null);
}
