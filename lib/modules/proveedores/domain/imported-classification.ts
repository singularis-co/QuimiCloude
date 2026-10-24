import { CATALOG_LINE_TYPES } from './catalog-line-type';
import type { CatalogLineClassification } from './catalog-line-view';

/**
 * Tipo y subtipo con que queda una linea viva al reimportarla. `null` en lo importado es «no se
 * sabe» y no borra lo guardado, para que una pasada dudosa de la IA no deshaga una clasificacion
 * hecha a mano. El SQL de la escritura por identidad aplica la misma regla.
 */
export function resolveImportedClassification(
  stored: CatalogLineClassification,
  incoming: CatalogLineClassification,
): CatalogLineClassification {
  const type = incoming.type ?? stored.type;
  if (type !== CATALOG_LINE_TYPES.PACKAGING_MATERIAL) return { type, packagingSubtype: null };
  return { type, packagingSubtype: incoming.packagingSubtype ?? stored.packagingSubtype };
}
