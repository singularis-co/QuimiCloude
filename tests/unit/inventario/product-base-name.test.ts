import { describe, expect, it } from 'vitest';

import { productNameWithoutPresentation } from '@/app/(private)/inventario/components/product-base-name';

describe('productNameWithoutPresentation', () => {
  it('quita el sufijo « · <presentacion>» cuando el nombre termina exactamente en el', () => {
    expect(
      productNameWithoutPresentation({
        name: 'Jabón líquido de manos · Botella 500 ml',
        presentationName: 'Botella 500 ml',
      }),
    ).toBe('Jabón líquido de manos');
  });

  it('conserva la version de la receta: solo quita el ultimo tramo, el de la presentacion', () => {
    expect(
      productNameWithoutPresentation({
        name: 'Desengrasante · Versión 2 · Garrafa 5 L',
        presentationName: 'Garrafa 5 L',
      }),
    ).toBe('Desengrasante · Versión 2');
  });

  it('sin presentacion conocida no recorta, aunque el nombre tenga separador', () => {
    expect(productNameWithoutPresentation({ name: 'Jabón · Botella 500 ml', presentationName: null })).toBe(
      'Jabón · Botella 500 ml',
    );
    expect(productNameWithoutPresentation({ name: 'Jabón · Botella 500 ml' })).toBe('Jabón · Botella 500 ml');
  });

  it('no recorta a ciegas por el ultimo separador si el sufijo no es la presentacion', () => {
    expect(
      productNameWithoutPresentation({ name: 'Jabón · Botella 1 L', presentationName: 'Botella 500 ml' }),
    ).toBe('Jabón · Botella 1 L');
    expect(
      productNameWithoutPresentation({ name: 'Jabón Botella 500 ml', presentationName: 'Botella 500 ml' }),
    ).toBe('Jabón Botella 500 ml');
  });

  it('no deja el nombre vacio si es solo el sufijo', () => {
    expect(productNameWithoutPresentation({ name: ' · Botella', presentationName: 'Botella' })).toBe(' · Botella');
  });

  it('un insumo sin presentacion se pinta tal cual', () => {
    expect(productNameWithoutPresentation({ name: 'Glicerina', presentationName: null })).toBe('Glicerina');
  });
});
