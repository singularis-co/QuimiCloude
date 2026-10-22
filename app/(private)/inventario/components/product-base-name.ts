import type { ProductView } from '@/lib/modules/inventario';

const PRESENTATION_SEPARATOR = ' · ';

/**
 * El nombre de un producto terminado se guarda con su presentacion detras («Jabon · Botella
 * 500 ml»). Solo se recorta ese sufijo exacto: si la presentacion se renombro despues, el nombre
 * se deja entero en vez de cortar por el ultimo separador.
 */
export function productNameWithoutPresentation(
  product: Pick<ProductView, 'name' | 'presentationName'>,
): string {
  const { name, presentationName } = product;
  if (!presentationName) return name;

  const suffix = `${PRESENTATION_SEPARATOR}${presentationName}`;
  if (name.length <= suffix.length || !name.endsWith(suffix)) return name;
  return name.slice(0, -suffix.length);
}
