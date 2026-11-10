import { describe, expect, it, vi } from 'vitest';

import { composeOrderRows, type ComposeOrderRowsDeps } from '@/lib/modules/asignaciones/domain/compose-order-rows';
import {
  readOutcomeRecipe,
  readRecipeOfOrder,
  recipePositionOf,
} from '@/lib/modules/asignaciones/domain/recipe-of-order';

import type { AssignedOrderSummary, OrderLineStatus, OrderRecipesOutline } from '@/lib/modules/pedidos';
import type { RecipeRef } from '@/lib/modules/recetas';

function uuid(seed: string): string {
  return `${seed.repeat(8)}-${seed.repeat(4)}-4${seed.repeat(3)}-8${seed.repeat(3)}-${seed.repeat(12)}`;
}

const EMPRESA = uuid('3');

function pedidoId(i: number): string {
  const sufijo = i.toString(16).padStart(2, '0');
  return `444444${sufijo}-4444-4444-8444-4444444444${sufijo}`;
}

function lineaId(pedido: number, posicion: number): string {
  const p = pedido.toString(16).padStart(2, '0');
  return `5555${p}0${String(posicion)}-5555-4555-8555-555555555555`;
}

function recetaId(posicion: number): string {
  return uuid(String.fromCharCode('a'.charCodeAt(0) + posicion - 1));
}

function receta(posicion: number): RecipeRef {
  return {
    id: recetaId(posicion),
    name: `Receta ${String(posicion)}`,
    ownName: `Receta ${String(posicion)}`,
    isUnderReview: false,
    original: null,
    isDeleted: false,
    imageUrl: null,
  } as RecipeRef;
}

/** Un pedido con sus recetas en orden de alta; `estados[i]` es el de la receta `i + 1`. */
function outline(pedido: number, estados: readonly OrderLineStatus[]): OrderRecipesOutline {
  return {
    id: pedidoId(pedido),
    deleted: false,
    recipes: estados.map((status, i) => ({
      lineId: lineaId(pedido, i + 1),
      position: i + 1,
      recipeId: recetaId(i + 1),
      status,
      quantity: '10.0000',
      unitId: null,
      presentationLines: [],
    })),
    progress: { finished: 0, total: estados.filter((s) => s !== 'CANCELADO').length } as OrderRecipesOutline['progress'],
  };
}

function resumen(pedido: number, posicion: number, status: OrderLineStatus = 'PENDIENTE'): AssignedOrderSummary {
  return {
    id: pedidoId(pedido),
    lineId: lineaId(pedido, posicion),
    number: { year: 2026, sequence: pedido + 1 },
    recipeId: recetaId(posicion),
    quantity: '10.0000',
    priority: 'MEDIA',
    status,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    presentationLines: [],
    unitId: null,
    finishedAt: null,
    packedBy: null,
    conditionedBy: null,
  } as AssignedOrderSummary;
}

function montar(outlines: readonly OrderRecipesOutline[]) {
  const listRecipeOutlinesByIdsIncludingDeleted = vi.fn(async (_companyId: string, ids: readonly string[]) =>
    outlines.filter((o) => ids.includes(o.id)),
  );
  const findRefsIncludingDeleted = vi.fn(async (ids: readonly string[]) =>
    [1, 2, 3, 4].map(receta).filter((r) => ids.includes(r.id)),
  );
  const listByOrdersInCompany = vi.fn(async () => []);
  const findRefsIncludingDeletedInCompany = vi.fn(async () => []);
  const findRefsPresentations = vi.fn(async () => []);
  const findRefsUnits = vi.fn(async () => []);
  const deps = {
    orders: { listRecipeOutlinesByIdsIncludingDeleted },
    recipes: { findRefsIncludingDeleted },
    assignments: { listByOrdersInCompany },
    people: { findRefsIncludingDeletedInCompany },
    presentations: { findRefs: findRefsPresentations },
    units: { findRefs: findRefsUnits },
    now: () => new Date('2026-11-10T10:00:00.000Z'),
  } as unknown as ComposeOrderRowsDeps;
  return {
    deps,
    listRecipeOutlinesByIdsIncludingDeleted,
    findRefsIncludingDeleted,
    todos: [
      listRecipeOutlinesByIdsIncludingDeleted,
      findRefsIncludingDeleted,
      listByOrdersInCompany,
      findRefsIncludingDeletedInCompany,
      findRefsPresentations,
      findRefsUnits,
    ],
  };
}

describe('QT-315 — posicion de una receta en su pedido', () => {
  it('R3, R7: una receta cancelada cuenta en M y las demas conservan su posicion', async () => {
    const { deps } = montar([outline(0, ['EN_CURSO', 'CANCELADO', 'PENDIENTE'])]);

    const filas = await composeOrderRows(deps, EMPRESA, [resumen(0, 1, 'EN_CURSO'), resumen(0, 3, 'PENDIENTE')]);

    expect(filas.get(lineaId(0, 1))?.recipe).toEqual({ position: 1, count: 3 });
    expect(filas.get(lineaId(0, 3))?.recipe).toEqual({ position: 3, count: 3 });
  });

  it('R3, R29: un pedido de una sola receta da 1 de 1 y ninguna otra receta', async () => {
    const { deps } = montar([outline(0, ['PENDIENTE'])]);

    const filas = await composeOrderRows(deps, EMPRESA, [resumen(0, 1)]);

    expect(filas.get(lineaId(0, 1))?.recipe).toEqual({ position: 1, count: 1 });
    expect(filas.get(lineaId(0, 1))?.otherRecipes).toEqual([]);
  });

  it('R3: una linea que el outline ya no trae se pinta como receta unica', () => {
    expect(recipePositionOf(undefined, lineaId(0, 1))).toEqual({ position: 1, count: 1 });
    expect(recipePositionOf(outline(0, ['PENDIENTE', 'PENDIENTE']), lineaId(9, 1))).toEqual({
      position: 1,
      count: 1,
    });
  });

  it('R2, R3: el numero de llamadas por pagina no crece con las filas y los outlines van en UNA llamada', async () => {
    const llamadas: number[] = [];
    for (const cantidad of [1, 20]) {
      const outlines = Array.from({ length: cantidad }, (_, i) => outline(i, ['PENDIENTE', 'PENDIENTE', 'CANCELADO']));
      const filas = Array.from({ length: cantidad }, (_, i) => [resumen(i, 1), resumen(i, 2)]).flat();
      const { deps, todos, listRecipeOutlinesByIdsIncludingDeleted } = montar(outlines);

      await composeOrderRows(deps, EMPRESA, filas);

      expect(listRecipeOutlinesByIdsIncludingDeleted).toHaveBeenCalledTimes(1);
      expect(listRecipeOutlinesByIdsIncludingDeleted.mock.calls[0]?.[1]).toHaveLength(cantidad);
      llamadas.push(todos.reduce((total, fn) => total + fn.mock.calls.length, 0));
    }
    expect(llamadas[0]).toBe(llamadas[1]);
  });

  it('R3: sin filas no lee outlines', async () => {
    const { deps, listRecipeOutlinesByIdsIncludingDeleted } = montar([]);

    await composeOrderRows(deps, EMPRESA, []);

    expect(listRecipeOutlinesByIdsIncludingDeleted).not.toHaveBeenCalled();
  });
});

describe('QT-315 — otras recetas del pedido', () => {
  it('R8: las otras recetas salen en orden de alta, con su nombre y su estado, canceladas incluidas', async () => {
    const desordenado: OrderRecipesOutline = (() => {
      const base = outline(0, ['POR_EMPACAR', 'EN_CURSO', 'CANCELADO', 'PENDIENTE']);
      return { ...base, recipes: [...base.recipes].reverse() };
    })();
    const { deps } = montar([desordenado]);

    const vista = await readRecipeOfOrder(deps, EMPRESA, pedidoId(0), lineaId(0, 2));

    expect(vista).toEqual({
      lineId: lineaId(0, 2),
      recipe: { position: 2, count: 4 },
      otherRecipes: [
        { lineId: lineaId(0, 1), recipeName: 'Receta 1', status: 'POR_EMPACAR' },
        { lineId: lineaId(0, 3), recipeName: 'Receta 3', status: 'CANCELADO' },
        { lineId: lineaId(0, 4), recipeName: 'Receta 4', status: 'PENDIENTE' },
      ],
    });
  });

  it('R8: composeOrderRows da las otras recetas de cada fila en orden de alta', async () => {
    const { deps, findRefsIncludingDeleted } = montar([outline(0, ['PENDIENTE', 'EN_CURSO', 'POR_EMPACAR'])]);

    const filas = await composeOrderRows(deps, EMPRESA, [resumen(0, 3, 'POR_EMPACAR')]);

    expect(filas.get(lineaId(0, 3))?.otherRecipes).toEqual([
      { lineId: lineaId(0, 1), recipeName: 'Receta 1', status: 'PENDIENTE' },
      { lineId: lineaId(0, 2), recipeName: 'Receta 2', status: 'EN_CURSO' },
    ]);
    expect(findRefsIncludingDeleted).toHaveBeenCalledTimes(1);
  });

  it('R8, R29: con una sola receta no hay otras y no se piden nombres', async () => {
    const { deps, findRefsIncludingDeleted } = montar([outline(0, ['EN_CURSO'])]);

    const vista = await readRecipeOfOrder(deps, EMPRESA, pedidoId(0), lineaId(0, 1));

    expect(vista).toEqual({ lineId: lineaId(0, 1), recipe: { position: 1, count: 1 }, otherRecipes: [] });
    expect(findRefsIncludingDeleted).not.toHaveBeenCalled();
  });

  it('R8: una receta que el catalogo no resuelve sale con nombre null', async () => {
    const { deps, findRefsIncludingDeleted } = montar([outline(0, ['EN_CURSO', 'PENDIENTE'])]);
    findRefsIncludingDeleted.mockResolvedValueOnce([]);

    const vista = await readRecipeOfOrder(deps, EMPRESA, pedidoId(0), lineaId(0, 1));

    expect(vista.otherRecipes).toEqual([{ lineId: lineaId(0, 2), recipeName: null, status: 'PENDIENTE' }]);
  });
});

describe('QT-315 — la receta del aviso', () => {
  it('R20: da el nombre de la receta y el total de recetas, canceladas incluidas', async () => {
    const { deps } = montar([outline(0, ['TERMINADO', 'CANCELADO', 'EN_CURSO'])]);

    await expect(readOutcomeRecipe(deps, EMPRESA, pedidoId(0), recetaId(3))).resolves.toEqual({
      recipeName: 'Receta 3',
      recipeCount: 3,
    });
  });

  it('R20, R29: un pedido de una sola receta da recipeCount 1', async () => {
    const { deps } = montar([outline(0, ['EN_CURSO'])]);

    await expect(readOutcomeRecipe(deps, EMPRESA, pedidoId(0), recetaId(1))).resolves.toEqual({
      recipeName: 'Receta 1',
      recipeCount: 1,
    });
  });
});
