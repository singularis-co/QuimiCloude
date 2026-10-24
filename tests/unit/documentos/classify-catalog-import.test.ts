// Clasificacion de una importacion de catalogo. Dominio puro: sin dobles, sin red.

import { describe, expect, it } from 'vitest';

import {
  classifyCatalogImportRows,
  type AliveCatalogLine,
  type ClassifyRowInput,
} from '@/lib/modules/documentos/domain/classify-catalog-import';

const PRESENTACION_BIDON = { id: 'p-1', nameNormalized: 'bidon20l' };

function fila(overrides: Partial<ClassifyRowInput> = {}): ClassifyRowInput {
  return {
    name: 'Acido Citrico',
    presentation: 'Bidon 20L',
    cost: '100.00',
    minPurchase: null,
    deliveryTime: null,
    material: null,
    measurements: null,
    type: null,
    packagingSubtype: null,
    ...overrides,
  };
}

describe('classifyCatalogImportRows — R9, las cinco clases', () => {
  it('R9 — «nueva» cuando no hay linea viva con esa identidad', () => {
    const [linea] = classifyCatalogImportRows([fila()], [PRESENTACION_BIDON], []);
    expect(linea?.kind).toBe('nueva');
    expect(linea?.presentationId).toBe('p-1');
  });

  it('R9 — «nueva» cuando la presentacion no existe en la empresa', () => {
    const [linea] = classifyCatalogImportRows([fila({ presentation: 'Tambor 200L' })], [PRESENTACION_BIDON], []);
    expect(linea?.kind).toBe('nueva');
    expect(linea?.presentationId).toBeNull();
  });

  it('R9 — «cambia» cuando hay linea viva con otro costo, mostrando el actual y el nuevo', () => {
    const [linea] = classifyCatalogImportRows(
      [fila({ cost: '120.00' })],
      [PRESENTACION_BIDON],
      [{ nameNormalized: 'acidocitrico', presentationId: 'p-1', cost: '100.0000', type: null, packagingSubtype: null }],
    );
    expect(linea?.kind).toBe('cambia');
    expect(linea?.currentCost).toBe('100.0000');
    expect(linea?.newCost).toBe('120.00');
  });

  it('R9 — «sin cambios» cuando el costo es el mismo, «12.5» igual a «12.5000»', () => {
    const [linea] = classifyCatalogImportRows(
      [fila({ cost: '12.5' })],
      [PRESENTACION_BIDON],
      [{ nameNormalized: 'acidocitrico', presentationId: 'p-1', cost: '12.5000', type: null, packagingSubtype: null }],
    );
    expect(linea?.kind).toBe('sin cambios');
  });

  it('R9 — «incompleta» dice que campo falta o no es valido: nombre ausente', () => {
    const [linea] = classifyCatalogImportRows([fila({ name: null })], [PRESENTACION_BIDON], []);
    expect(linea?.kind).toBe('incompleta');
    expect(linea?.invalidFields).toContain('name');
  });

  it('R9 — «incompleta» por presentacion invalida', () => {
    const [linea] = classifyCatalogImportRows([fila({ presentation: '   ' })], [PRESENTACION_BIDON], []);
    expect(linea?.kind).toBe('incompleta');
    expect(linea?.invalidFields).toContain('presentation');
  });

  it('R9 — «incompleta» por costo invalido: cero se rechaza como el alta', () => {
    const [linea] = classifyCatalogImportRows([fila({ cost: '0' })], [PRESENTACION_BIDON], []);
    expect(linea?.kind).toBe('incompleta');
    expect(linea?.invalidFields).toContain('cost');
  });

  it('R9 — «incompleta» por medidas con unidad fuera de la lista cerrada', () => {
    const [linea] = classifyCatalogImportRows(
      [fila({ measurements: { diameter: { value: '5', unit: 'in' }, height: null, mouth: null } })],
      [PRESENTACION_BIDON],
      [],
    );
    expect(linea?.kind).toBe('incompleta');
    expect(linea?.invalidFields).toContain('measurements');
  });

  it('R9 — «duplicada» repite la identidad de una fila anterior del mismo documento', () => {
    const filas = classifyCatalogImportRows([fila(), fila()], [PRESENTACION_BIDON], []);
    expect(filas[0]?.kind).toBe('nueva');
    expect(filas[1]?.kind).toBe('duplicada');
  });

  it('R9 — «duplicada» tambien cuando la presentacion repetida no resuelve', () => {
    const filaSinPresentacion = fila({ presentation: 'Tambor 200L' });
    const filas = classifyCatalogImportRows([filaSinPresentacion, filaSinPresentacion], [PRESENTACION_BIDON], []);
    expect(filas[0]?.kind).toBe('nueva');
    expect(filas[1]?.kind).toBe('duplicada');
  });

  it('distintas presentaciones para el mismo nombre no son duplicadas', () => {
    const filas = classifyCatalogImportRows(
      [fila(), fila({ presentation: 'Tambor 200L' })],
      [PRESENTACION_BIDON],
      [],
    );
    expect(filas[0]?.kind).toBe('nueva');
    expect(filas[1]?.kind).toBe('nueva');
  });
});

describe('classifyCatalogImportRows — QT-296, tipo y subtipo', () => {
  function viva(overrides: Partial<AliveCatalogLine> = {}): AliveCatalogLine {
    return {
      nameNormalized: 'acidocitrico',
      presentationId: 'p-1',
      cost: '100.0000',
      type: null,
      packagingSubtype: null,
      ...overrides,
    };
  }

  it('R32 — un subtipo con tipo TOOL sale «incompleta» con packagingSubtype en invalidFields', () => {
    const [linea] = classifyCatalogImportRows(
      [fila({ type: 'TOOL', packagingSubtype: 'CAP' })],
      [PRESENTACION_BIDON],
      [],
    );
    expect(linea?.kind).toBe('incompleta');
    expect(linea?.invalidFields).toEqual(['packagingSubtype']);
  });

  it('R32 — un subtipo sin tipo tambien sale «incompleta» por packagingSubtype', () => {
    const [linea] = classifyCatalogImportRows([fila({ type: null, packagingSubtype: 'CAP' })], [PRESENTACION_BIDON], []);
    expect(linea?.kind).toBe('incompleta');
    expect(linea?.invalidFields).toEqual(['packagingSubtype']);
  });

  it('R32 — empaque con subtipo, o un tipo sin subtipo, no invalida la fila', () => {
    const filas = classifyCatalogImportRows(
      [
        fila({ type: 'PACKAGING_MATERIAL', packagingSubtype: 'CAP' }),
        fila({ name: 'Glicerina', type: 'RAW_MATERIAL', packagingSubtype: null }),
      ],
      [PRESENTACION_BIDON],
      [],
    );
    expect(filas.map((linea) => linea.kind)).toEqual(['nueva', 'nueva']);
  });

  it('R35 — con el mismo costo y un tipo nuevo sale «cambia»', () => {
    const [linea] = classifyCatalogImportRows(
      [fila({ cost: '100.00', type: 'RAW_MATERIAL' })],
      [PRESENTACION_BIDON],
      [viva()],
    );
    expect(linea?.kind).toBe('cambia');
    expect(linea?.currentCost).toBe('100.0000');
    expect(linea?.newCost).toBe('100.00');
  });

  it('R35 — con el mismo costo y solo un subtipo nuevo sale «cambia»', () => {
    const [linea] = classifyCatalogImportRows(
      [fila({ cost: '100.00', type: 'PACKAGING_MATERIAL', packagingSubtype: 'CONTAINER' })],
      [PRESENTACION_BIDON],
      [viva({ type: 'PACKAGING_MATERIAL', packagingSubtype: 'CAP' })],
    );
    expect(linea?.kind).toBe('cambia');
  });

  it('R35 — un tipo null frente a uno guardado sale «sin cambios»: no se borra lo guardado', () => {
    const [linea] = classifyCatalogImportRows(
      [fila({ cost: '100.00', type: null, packagingSubtype: null })],
      [PRESENTACION_BIDON],
      [viva({ type: 'PACKAGING_MATERIAL', packagingSubtype: 'CAP' })],
    );
    expect(linea?.kind).toBe('sin cambios');
  });

  it('R35 — empaque sin subtipo frente a una tapa guardada sale «sin cambios»', () => {
    const [linea] = classifyCatalogImportRows(
      [fila({ cost: '100.00', type: 'PACKAGING_MATERIAL', packagingSubtype: null })],
      [PRESENTACION_BIDON],
      [viva({ type: 'PACKAGING_MATERIAL', packagingSubtype: 'CAP' })],
    );
    expect(linea?.kind).toBe('sin cambios');
  });

  it('R35 — el mismo tipo y subtipo con el mismo costo sale «sin cambios»', () => {
    const [linea] = classifyCatalogImportRows(
      [fila({ cost: '100.00', type: 'TOOL' })],
      [PRESENTACION_BIDON],
      [viva({ type: 'TOOL' })],
    );
    expect(linea?.kind).toBe('sin cambios');
  });
});
