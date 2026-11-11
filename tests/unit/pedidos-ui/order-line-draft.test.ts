// QT-314 T9 — El borrador del pedido de varias recetas: funciones puras del panel.

import { describe, expect, it } from 'vitest';

import {
  candidateOf,
  canRemove,
  draftFromOrder,
  draftTotals,
  isReadOnly,
  isSameRecipe,
  type OrderLineDraft,
} from '@/app/(private)/pedidos/components';
import { orderLineInputSchema, type OrderLineStatus, type OrderLineView } from '@/lib/modules/pedidos';

const RECETA_A = '10000000-0000-4000-8000-00000000000a';
const VERSION_A = '10000000-0000-4000-8000-0000000000a2';
const RECETA_B = '10000000-0000-4000-8000-00000000000b';
const UNIDAD = '20000000-0000-4000-8000-000000000001';
const ENVASE = '30000000-0000-4000-8000-000000000001';
const PRESENTACION = '40000000-0000-4000-8000-000000000001';

const TODOS_LOS_ESTADOS: readonly OrderLineStatus[] = [
  'PENDIENTE',
  'EN_CURSO',
  'BLOQUEADO',
  'POR_EMPACAR',
  'EN_EMPAQUE',
  'POR_ACONDICIONAR',
  'EN_ACONDICIONAMIENTO',
  'TERMINADO',
  'ENTREGADO',
  'CANCELADO',
];

function linea(overrides: Partial<OrderLineView> = {}): OrderLineView {
  return {
    id: '50000000-0000-4000-8000-000000000001',
    position: 0,
    recipeId: RECETA_A,
    recipeName: 'Desengrasante',
    originalRecipeId: RECETA_A,
    recipeVersion: null,
    recipeImageUrl: null,
    quantity: '15.0000',
    unitId: UNIDAD,
    unitLabel: 'L',
    status: 'PENDIENTE',
    cancellationReason: null,
    presentationLines: [
      {
        presentationId: PRESENTACION,
        presentationName: 'Galón',
        packages: 3,
        packagingProductId: ENVASE,
        packagingName: 'Envase 5 L',
        presentationContent: '5.0000',
        presentationUnitLabel: 'L',
      },
    ],
    salePrice: '120.5000',
    ingredientsCost: '40.0000',
    packagingCost: '5.0000',
    actualCost: null,
    finishedAt: null,
    reservedAt: null,
    ...overrides,
  };
}

function lineaId(n: number): string {
  return `50000000-0000-4000-8000-00000000000${n}`;
}

function borrador(overrides: Partial<OrderLineDraft> = {}): OrderLineDraft {
  return {
    key: 'nueva-1',
    saved: null,
    recipe: { id: RECETA_B, name: 'Suavizante', imageUrl: null },
    recipeVersionId: null,
    quantity: '8',
    unitId: UNIDAD,
    unitLabel: 'L',
    presentationLines: [],
    salePrice: '',
    ingredientsCost: null,
    ...overrides,
  };
}

const CABECERA = { priority: 'ALTA', customerId: null, confirmBlocked: false } as const;

describe('draftFromOrder', () => {
  it('R7, R12: las recetas del pedido en su orden de position, canceladas incluidas', () => {
    const pedido = {
      lines: [
        linea({ id: lineaId(3), position: 2, recipeName: 'C' }),
        linea({ id: lineaId(1), position: 0, recipeName: 'A', status: 'CANCELADO' }),
        linea({ id: lineaId(2), position: 1, recipeName: 'B' }),
      ],
    };

    const filas = draftFromOrder(pedido);

    expect(filas.map((fila) => fila.key)).toEqual([lineaId(1), lineaId(2), lineaId(3)]);
    expect(filas[0]?.saved?.status).toBe('CANCELADO');
  });

  it('R7, R8, R13: precarga la original, la versión, la cantidad y el precio sin ceros de relleno', () => {
    const [fila] = draftFromOrder({
      lines: [
        linea({
          recipeId: VERSION_A,
          recipeName: 'Desengrasante · Concentrado',
          recipeVersion: { originalId: RECETA_A, originalName: 'Desengrasante', versionName: 'Concentrado' },
        }),
      ],
    });

    expect(fila?.recipe).toEqual({ id: RECETA_A, name: 'Desengrasante', imageUrl: null });
    expect(fila?.recipeVersionId).toBe(VERSION_A);
    expect(fila?.quantity).toBe('15');
    expect(fila?.salePrice).toBe('120.5');
    expect(fila?.unitId).toBe(UNIDAD);
    expect(fila?.presentationLines).toHaveLength(1);
  });

  it('R13: una receta sin precio arranca con el campo vacío y una de 0 conserva el 0', () => {
    const [sinPrecio, gratis] = draftFromOrder({
      lines: [linea({ id: lineaId(1), salePrice: null }), linea({ id: lineaId(2), position: 1, salePrice: '0.0000' })],
    });

    expect(sinPrecio?.salePrice).toBe('');
    expect(gratis?.salePrice).toBe('0');
  });
});

describe('isReadOnly y canRemove', () => {
  it('R10: solo lectura las guardadas en un estado no editable; las nuevas nunca', () => {
    const lectura = TODOS_LOS_ESTADOS.filter((status) =>
      isReadOnly(borrador({ saved: linea({ status }) })),
    );

    expect(lectura).toEqual([
      'POR_EMPACAR',
      'EN_EMPAQUE',
      'POR_ACONDICIONAR',
      'EN_ACONDICIONAMIENTO',
      'TERMINADO',
      'ENTREGADO',
      'CANCELADO',
    ]);
    expect(isReadOnly(borrador())).toBe(false);
  });

  it('R12: una cancelada es de solo lectura', () => {
    expect(isReadOnly(borrador({ saved: linea({ status: 'CANCELADO' }) }))).toBe(true);
  });

  it('R11: se quitan las nuevas y las guardadas en PENDIENTE o BLOQUEADO, no una EN_CURSO', () => {
    const quitables = TODOS_LOS_ESTADOS.filter((status) =>
      canRemove(borrador({ saved: linea({ status }) })),
    );

    expect(quitables).toEqual(['PENDIENTE', 'BLOQUEADO']);
    expect(canRemove(borrador({ saved: linea({ status: 'EN_CURSO' }) }))).toBe(false);
    expect(canRemove(borrador())).toBe(true);
  });
});

describe('isSameRecipe', () => {
  const original = borrador({ key: 'a', recipe: { id: RECETA_A, name: 'Desengrasante', imageUrl: null } });

  it('R8: una versión de la misma original es la misma receta', () => {
    const version = borrador({
      key: 'b',
      recipe: { id: RECETA_A, name: 'Desengrasante', imageUrl: null },
      recipeVersionId: VERSION_A,
    });

    expect(isSameRecipe(original, version)).toBe(true);
  });

  it('R8: dos originales distintas no son la misma receta', () => {
    expect(isSameRecipe(original, borrador({ key: 'b' }))).toBe(false);
  });

  it('R8: la otra aparición cancelada no cuenta', () => {
    const cancelada = borrador({
      key: 'b',
      saved: linea({ status: 'CANCELADO' }),
      recipe: { id: RECETA_A, name: 'Desengrasante', imageUrl: null },
    });

    expect(isSameRecipe(original, cancelada)).toBe(false);
    expect(isSameRecipe(cancelada, original)).toBe(false);
  });

  it('R8: una fila no choca consigo misma', () => {
    expect(isSameRecipe(original, { ...original, quantity: '99' })).toBe(false);
  });
});

describe('candidateOf', () => {
  const editable = borrador({
    key: lineaId(1),
    saved: linea({ id: lineaId(1), status: 'PENDIENTE' }),
    recipe: { id: RECETA_A, name: 'Desengrasante', imageUrl: null },
    recipeVersionId: VERSION_A,
    quantity: '20',
    salePrice: '0',
  });
  const cancelada = borrador({ key: lineaId(2), saved: linea({ id: lineaId(2), status: 'CANCELADO' }) });
  const terminada = borrador({
    key: lineaId(3),
    saved: linea({ id: lineaId(3), status: 'TERMINADO', salePrice: null }),
    // Lo que el borrador tenga en una receta no editable no se envía.
    quantity: '999',
    salePrice: '1',
  });
  const nueva = borrador({ key: 'nueva-1' });

  it('R7: envía las no canceladas en su orden, las guardadas con id y las nuevas sin él', () => {
    const { candidate } = candidateOf([editable, cancelada, terminada, nueva], CABECERA);

    expect(candidate.lines.map((line) => line.id)).toEqual([lineaId(1), lineaId(3), undefined]);
    expect('id' in (candidate.lines[2] ?? {})).toBe(false);
    expect(candidate.priority).toBe('ALTA');
    expect(candidate.customerId).toBe('');
    expect(candidate.confirmBlocked).toBe(false);
  });

  it('R7: la editable viaja con lo del borrador y la original como receta', () => {
    const { candidate } = candidateOf([editable], CABECERA);

    expect(candidate.lines[0]).toEqual({
      id: lineaId(1),
      recipeId: RECETA_A,
      recipeVersionId: VERSION_A,
      quantity: '20',
      unitId: UNIDAD,
      presentationLines: [],
      salePrice: '0',
    });
  });

  it('R10: la no editable viaja con sus valores guardados, sin tocar', () => {
    const { candidate } = candidateOf([terminada], CABECERA);

    expect(candidate.lines[0]).toEqual({
      id: lineaId(3),
      recipeId: RECETA_A,
      recipeVersionId: null,
      quantity: '15.0000',
      unitId: UNIDAD,
      presentationLines: [{ packagingProductId: ENVASE, packages: 3 }],
      salePrice: '',
    });
  });

  it('R7: cada receta enviada pasa el esquema de una receta del contrato', () => {
    const { candidate } = candidateOf([editable, terminada, nueva], CABECERA);

    for (const line of candidate.lines) {
      expect(orderLineInputSchema.safeParse(line).success).toBe(true);
    }
  });

  it('R7: rowOfPosition dice qué fila de la tabla es cada receta enviada', () => {
    const { rowOfPosition } = candidateOf([cancelada, editable, cancelada, nueva], CABECERA);

    expect(rowOfPosition).toEqual([1, 3]);
  });

  it('R7: lleva el cliente y la confirmación de guardar bloqueado de la cabecera', () => {
    const { candidate } = candidateOf([nueva], {
      priority: 'BAJA',
      customerId: 'c0000000-0000-4000-8000-000000000001',
      confirmBlocked: true,
    });

    expect(candidate.customerId).toBe('c0000000-0000-4000-8000-000000000001');
    expect(candidate.confirmBlocked).toBe(true);
  });
});

describe('draftTotals', () => {
  it('R13: suma exacta de los precios y cuenta las que no lo tienen; el 0 es un precio', () => {
    const totales = draftTotals([
      borrador({ key: '1', salePrice: '0.1' }),
      borrador({ key: '2', salePrice: '0.2' }),
      borrador({ key: '3', salePrice: '0' }),
      borrador({ key: '4', salePrice: '' }),
      borrador({ key: '5', salePrice: '   ' }),
    ]);

    expect(totales.salePriceTotal).toBe('0.3000');
    expect(totales.linesWithoutPrice).toBe(2);
    expect(totales.activeLines).toBe(5);
  });

  it('R13: sin ningún precio el total es null, no 0', () => {
    expect(draftTotals([borrador({ salePrice: '' })]).salePriceTotal).toBeNull();
  });

  it('R12: una cancelada no suma al total ni al coste estimado ni cuenta como sin precio', () => {
    const totales = draftTotals([
      borrador({ key: '1', salePrice: '10', ingredientsCost: '4.0000' }),
      borrador({
        key: '2',
        saved: linea({ status: 'CANCELADO' }),
        salePrice: '',
        ingredientsCost: null,
      }),
      borrador({
        key: '3',
        saved: linea({ status: 'CANCELADO' }),
        salePrice: '500',
        ingredientsCost: '100.0000',
      }),
    ]);

    expect(totales.salePriceTotal).toBe('10.0000');
    expect(totales.linesWithoutPrice).toBe(0);
    expect(totales.ingredientsCostTotal).toBe('4.0000');
    expect(totales.activeLines).toBe(1);
  });

  it('R12: el coste estimado es «sin coste» si a alguna activa le falta', () => {
    const totales = draftTotals([
      borrador({ key: '1', ingredientsCost: '4.0000' }),
      borrador({ key: '2', ingredientsCost: null }),
    ]);

    expect(totales.ingredientsCostTotal).toBeNull();
  });

  it('R12: con solo canceladas no hay recetas activas', () => {
    const totales = draftTotals([borrador({ saved: linea({ status: 'CANCELADO' }) })]);

    expect(totales.activeLines).toBe(0);
    expect(totales.salePriceTotal).toBeNull();
    expect(totales.ingredientsCostTotal).toBeNull();
  });
});
