// El conteo de fotos por receta del pedido para la columna de Lotes, con los puertos simulados:
// pedidos.consultar antes de todo, hasta 25 pares uuid, sin duplicados, solo las recetas con fotos
// y el nombre de la receta solo cuando el pedido tiene mas de una.
import { describe, expect, it, vi } from 'vitest';

import { createCountLineEvidence } from '@/lib/modules/asignaciones/domain/count-line-evidence';
import { UnauthorizedError, ValidationError } from '@/lib/modules/asignaciones/domain/errors';
import { PERMISSIONS, ROLE_ADMINISTRADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity';

import {
  ANA,
  EMPRESA,
  LINEA,
  OTRA_EMPRESA,
  OTRA_LINEA,
  PEDIDO,
  filaFoto,
  funcionesDe,
  repositorioEnMemoria,
  uuid,
} from './evidence-doubles';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';
import type { OrderLineStatus, OrderRecipesOutline } from '@/lib/modules/pedidos';
import type { RecipeRef } from '@/lib/modules/recetas';

const PERMISO = 'pedidos.consultar';
const LECTOR: Actor = { id: ANA, companyId: EMPRESA, permissions: [PERMISO] };
const OTRO_PEDIDO = uuid('5');
const LINEA_DEL_OTRO = uuid('a');
const LINEA_SIN_FOTOS = uuid('b');
const LINEA_AJENA = uuid('c');
const LINEA_QUITADA = uuid('d');

type RecetaDelPedido = { readonly lineId: string; readonly recipeId: string; readonly status?: OrderLineStatus };

function outline(id: string, recetas: readonly RecetaDelPedido[]): OrderRecipesOutline {
  return {
    id,
    deleted: false,
    recipes: recetas.map((receta, i) => ({
      lineId: receta.lineId,
      position: i + 1,
      recipeId: receta.recipeId,
      status: receta.status ?? 'ENTREGADO',
      quantity: '10.0000',
      unitId: null,
      presentationLines: [],
    })),
    progress: { total: recetas.length, finished: recetas.length },
  };
}

function ref(id: string, name: string, isDeleted = false): RecipeRef {
  return { id, name, ownName: name, isUnderReview: false, original: null, isDeleted, imageUrl: null };
}

/**
 * PEDIDO: dos recetas, `LINEA` (Lavanda, 2 de fabricacion y 1 de acondicionamiento) y `OTRA_LINEA`
 * (Romero, cancelada, 1 de envasado); `LINEA_SIN_FOTOS` tambien es suya pero sin fotos.
 * OTRO_PEDIDO: una sola receta, `LINEA_DEL_OTRO` (1 foto). `LINEA_AJENA`: 2 fotos de otra empresa.
 */
function montar(options?: {
  readonly outlines?: readonly OrderRecipesOutline[];
  readonly refs?: readonly RecipeRef[];
  readonly filas?: Parameters<typeof repositorioEnMemoria>[0];
}) {
  const { repo } = repositorioEnMemoria(
    options?.filas ?? [
      filaFoto({ id: 'm1', slot: 1, stepPosition: 1 }),
      filaFoto({ id: 'm2', slot: 2, stepPosition: 1 }),
      filaFoto({ id: 'c1', slot: 1, stepPosition: 1, phase: 'conditioning' }),
      filaFoto({ id: 'p1', slot: 1, stepPosition: 1, phase: 'packing', orderLineId: OTRA_LINEA }),
      filaFoto({ id: 'o1', slot: 1, orderId: OTRO_PEDIDO, orderLineId: LINEA_DEL_OTRO }),
      filaFoto({ id: 'x1', slot: 1, orderLineId: LINEA_AJENA }, OTRA_EMPRESA),
      filaFoto({ id: 'x2', slot: 2, orderLineId: LINEA_AJENA }, OTRA_EMPRESA),
    ],
  );
  const outlines = options?.outlines ?? [
    outline(PEDIDO, [
      { lineId: LINEA, recipeId: 'receta-lavanda' },
      { lineId: OTRA_LINEA, recipeId: 'receta-romero', status: 'CANCELADO' },
      { lineId: LINEA_SIN_FOTOS, recipeId: 'receta-salvia' },
    ]),
    outline(OTRO_PEDIDO, [{ lineId: LINEA_DEL_OTRO, recipeId: 'receta-menta' }]),
  ];
  const refs = options?.refs ?? [
    ref('receta-lavanda', 'Crema · Lavanda'),
    ref('receta-romero', 'Crema · Romero'),
    ref('receta-salvia', 'Crema · Salvia'),
    ref('receta-menta', 'Crema · Menta'),
  ];
  const orders = {
    listRecipeOutlinesByIdsIncludingDeleted: vi.fn(async (companyId: string, ids: readonly string[]) =>
      companyId === EMPRESA ? outlines.filter((o) => ids.includes(o.id)) : [],
    ),
  };
  const recipes = {
    findRefsIncludingDeleted: vi.fn(async (ids: readonly string[]) =>
      refs.filter((r) => ids.includes(r.id)),
    ),
  };
  const puertos = [...funcionesDe(repo), ...funcionesDe(orders), ...funcionesDe(recipes)];
  return {
    repo,
    orders,
    recipes,
    contar: createCountLineEvidence({ evidence: repo, orders, recipes }),
    ningunPuertoLlamado: () => puertos.every((fn) => fn.mock.calls.length === 0),
  };
}

function paresDistintos(n: number, pedidos = n): { orderId: string; lineId: string }[] {
  return Array.from({ length: n }, (_, i) => ({
    orderId: `10000000-0000-4000-8000-${String(i % pedidos).padStart(12, '0')}`,
    lineId: `20000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  }));
}

describe('countLineEvidence — autorizacion antes de todo', () => {
  const sinElPermiso = PERMISSIONS.map((p) => p.code).filter((code) => code !== PERMISO);

  it('R13: con inventario.consultar y sin pedidos.consultar se rechaza sin llamar a ningun puerto', async () => {
    const m = montar();
    const deInventario = { id: ANA, companyId: EMPRESA, permissions: ['inventario.consultar'] };

    await expect(m.contar(deInventario, { lines: [{ orderId: PEDIDO, lineId: LINEA }] })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(m.ningunPuertoLlamado()).toBe(true);
  });

  it.each([
    ['ausente (null)', null],
    ['ausente (undefined)', undefined],
    ['sin conjunto de permisos', { id: ANA, companyId: EMPRESA } as unknown as Actor],
    ['con el conjunto vacio', { id: ANA, companyId: EMPRESA, permissions: [] }],
    ['con todo el catalogo menos pedidos.consultar', { id: ANA, companyId: EMPRESA, permissions: sinElPermiso }],
  ])('R13: un actor %s se rechaza sin llamar a ningun puerto', async (_caso, actor) => {
    const m = montar();
    await expect(
      m.contar(actor as Actor | null | undefined, { lines: [{ orderId: PEDIDO, lineId: LINEA }] }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(m.ningunPuertoLlamado()).toBe(true);
  });

  it('R13: la autorizacion va antes de validar: 26 lineas sin permiso es unauthorized', async () => {
    const m = montar();
    await expect(m.contar({ ...LECTOR, permissions: [] }, { lines: paresDistintos(26) })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(m.ningunPuertoLlamado()).toBe(true);
  });
});

describe('countLineEvidence — por permiso, nunca por rol', () => {
  it('R13: un rol cualquiera con pedidos.consultar es aceptado', async () => {
    const m = montar();
    const deOtroRol = { id: ANA, companyId: EMPRESA, permissions: ['clientes.consultar', PERMISO], roleName: 'Auditor' };
    await expect(m.contar(deOtroRol, { lines: [{ orderId: PEDIDO, lineId: LINEA }] })).resolves.toEqual([
      { orderId: PEDIDO, lineId: LINEA, photoCount: 3, recipeName: 'Crema · Lavanda' },
    ]);
  });

  it('R13: un Administrador sin pedidos.consultar en su conjunto es rechazado', async () => {
    const m = montar();
    const admin = {
      id: ANA,
      companyId: EMPRESA,
      roleName: ROLE_ADMINISTRADOR,
      permissions: [...SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]].filter((p) => p !== PERMISO),
    };
    await expect(m.contar(admin, { lines: [{ orderId: PEDIDO, lineId: LINEA }] })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(m.ningunPuertoLlamado()).toBe(true);
  });
});

describe('countLineEvidence — la entrada', () => {
  it('R15: 26 lineas responden invalid_input sin llamar a ningun puerto', async () => {
    const m = montar();
    const error = await m.contar(LECTOR, { lines: paresDistintos(26) }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).code).toBe('invalid_input');
    expect(m.ningunPuertoLlamado()).toBe(true);
  });

  it.each([
    ['un lineId que no es uuid', { lines: [{ orderId: PEDIDO, lineId: 'no-es-un-uuid' }] }],
    ['un orderId que no es uuid', { lines: [{ orderId: 'no-es-un-uuid', lineId: LINEA }] }],
    ['un par sin lineId', { lines: [{ orderId: PEDIDO }] }],
    ['un par con una clave de mas', { lines: [{ orderId: PEDIDO, lineId: LINEA, extra: true }] }],
    ['sin lista', {}],
    ['una lista que no es lista', { lines: PEDIDO }],
    ['una clave de mas', { lines: [], extra: true }],
    ['null', null],
  ])('R15: %s responde invalid_input sin llamar a ningun puerto', async (_caso, entrada) => {
    const m = montar();
    await expect(m.contar(LECTOR, entrada)).rejects.toBeInstanceOf(ValidationError);
    expect(m.ningunPuertoLlamado()).toBe(true);
  });

  it('R4: la lista vacia devuelve [] sin llamar a ningun puerto', async () => {
    const m = montar();
    await expect(m.contar(LECTOR, { lines: [] })).resolves.toEqual([]);
    expect(m.ningunPuertoLlamado()).toBe(true);
  });

  it('R4: los pares repetidos se cuentan una sola vez', async () => {
    const m = montar();
    const par = { orderId: PEDIDO, lineId: LINEA };

    const conteo = await m.contar(LECTOR, { lines: [par, par, par] });

    expect(conteo).toEqual([{ ...par, photoCount: 3, recipeName: 'Crema · Lavanda' }]);
    expect(m.repo.countByLines).toHaveBeenCalledWith(EMPRESA, [par]);
  });

  it('R4: 25 lineas de 10 pedidos se cuentan con una llamada a cada puerto', async () => {
    const pares = paresDistintos(25, 10);
    const m = montar({
      filas: pares.map((par, i) =>
        filaFoto({ id: `f${String(i)}`, slot: 1, orderId: par.orderId, orderLineId: par.lineId }),
      ),
      outlines: [...new Set(pares.map((par) => par.orderId))].map((orderId) =>
        outline(
          orderId,
          pares.filter((par) => par.orderId === orderId).map((par) => ({ lineId: par.lineId, recipeId: `r-${par.lineId}` })),
        ),
      ),
      refs: pares.map((par) => ref(`r-${par.lineId}`, `Receta ${par.lineId}`)),
    });

    const conteo = await m.contar(LECTOR, { lines: pares });

    expect(conteo).toHaveLength(25);
    expect(m.repo.countByLines).toHaveBeenCalledTimes(1);
    expect(m.orders.listRecipeOutlinesByIdsIncludingDeleted).toHaveBeenCalledTimes(1);
    expect(m.orders.listRecipeOutlinesByIdsIncludingDeleted.mock.calls[0]![1]).toHaveLength(10);
    expect(m.recipes.findRefsIncludingDeleted).toHaveBeenCalledTimes(1);
  });
});

describe('countLineEvidence — que recetas salen', () => {
  it('R1: dos recetas del mismo pedido se cuentan por separado, cada una con sus fotos', async () => {
    const m = montar();

    const conteo = await m.contar(LECTOR, {
      lines: [
        { orderId: PEDIDO, lineId: LINEA },
        { orderId: PEDIDO, lineId: OTRA_LINEA },
      ],
    });

    expect(conteo).toEqual([
      { orderId: PEDIDO, lineId: LINEA, photoCount: 3, recipeName: 'Crema · Lavanda' },
      { orderId: PEDIDO, lineId: OTRA_LINEA, photoCount: 1, recipeName: 'Crema · Romero' },
    ]);
  });

  it('R2: una receta sin fotos no sale aunque otra del mismo pedido tenga, y el orden es el de la entrada', async () => {
    const m = montar();

    const conteo = await m.contar(LECTOR, {
      lines: [
        { orderId: OTRO_PEDIDO, lineId: LINEA_DEL_OTRO },
        { orderId: PEDIDO, lineId: LINEA_SIN_FOTOS },
        { orderId: PEDIDO, lineId: LINEA },
      ],
    });

    expect(conteo.map((c) => c.lineId)).toEqual([LINEA_DEL_OTRO, LINEA]);
  });

  it('R2: sin ninguna receta con fotos devuelve [] sin leer pedidos ni recetas', async () => {
    const m = montar();

    await expect(m.contar(LECTOR, { lines: [{ orderId: PEDIDO, lineId: LINEA_SIN_FOTOS }] })).resolves.toEqual([]);
    expect(m.orders.listRecipeOutlinesByIdsIncludingDeleted).not.toHaveBeenCalled();
    expect(m.recipes.findRefsIncludingDeleted).not.toHaveBeenCalled();
  });

  it('R15: una linea de otra empresa no cuenta ni sale', async () => {
    const m = montar();

    const conteo = await m.contar(LECTOR, {
      lines: [
        { orderId: PEDIDO, lineId: LINEA_AJENA },
        { orderId: PEDIDO, lineId: LINEA },
      ],
    });

    expect(conteo.map((c) => c.lineId)).toEqual([LINEA]);
    expect(m.repo.countByLines.mock.calls[0]![0]).toBe(EMPRESA);
  });

  it('R15: una linea pedida con otro pedido no cuenta ni sale', async () => {
    const m = montar();

    await expect(m.contar(LECTOR, { lines: [{ orderId: OTRO_PEDIDO, lineId: LINEA }] })).resolves.toEqual([]);
  });

  it('R15: cuenta con la empresa del actor y lee pedidos y recetas con ella', async () => {
    const m = montar();

    const conteo = await m.contar({ ...LECTOR, companyId: OTRA_EMPRESA }, { lines: [{ orderId: PEDIDO, lineId: LINEA_AJENA }] });

    expect(conteo).toEqual([{ orderId: PEDIDO, lineId: LINEA_AJENA, photoCount: 2, recipeName: null }]);
    expect(m.orders.listRecipeOutlinesByIdsIncludingDeleted.mock.calls[0]![0]).toBe(OTRA_EMPRESA);
  });
});

describe('countLineEvidence — el nombre de la receta', () => {
  it('R7: con dos recetas en el pedido, una cancelada, la receta se nombra', async () => {
    const m = montar({
      outlines: [
        outline(PEDIDO, [
          { lineId: LINEA, recipeId: 'receta-lavanda' },
          { lineId: OTRA_LINEA, recipeId: 'receta-romero', status: 'CANCELADO' },
        ]),
      ],
    });

    const conteo = await m.contar(LECTOR, { lines: [{ orderId: PEDIDO, lineId: LINEA }] });

    expect(conteo).toEqual([{ orderId: PEDIDO, lineId: LINEA, photoCount: 3, recipeName: 'Crema · Lavanda' }]);
    expect(m.recipes.findRefsIncludingDeleted).toHaveBeenCalledWith(['receta-lavanda'], EMPRESA);
  });

  it('R8: con una sola receta en el pedido, recipeName es null y el catalogo de recetas no se lee', async () => {
    const m = montar();

    const conteo = await m.contar(LECTOR, { lines: [{ orderId: OTRO_PEDIDO, lineId: LINEA_DEL_OTRO }] });

    expect(conteo).toEqual([{ orderId: OTRO_PEDIDO, lineId: LINEA_DEL_OTRO, photoCount: 1, recipeName: null }]);
    expect(m.recipes.findRefsIncludingDeleted).not.toHaveBeenCalled();
  });

  it('R9: si la receta no vuelve del catalogo, recipeName es null y la linea cuenta igual', async () => {
    const m = montar({ refs: [] });

    const conteo = await m.contar(LECTOR, { lines: [{ orderId: PEDIDO, lineId: LINEA }] });

    expect(conteo).toEqual([{ orderId: PEDIDO, lineId: LINEA, photoCount: 3, recipeName: null }]);
  });

  it('R9: si el pedido no vuelve del catalogo de pedidos, recipeName es null y la linea cuenta igual', async () => {
    const m = montar({ outlines: [] });

    const conteo = await m.contar(LECTOR, { lines: [{ orderId: PEDIDO, lineId: LINEA }] });

    expect(conteo).toEqual([{ orderId: PEDIDO, lineId: LINEA, photoCount: 3, recipeName: null }]);
    expect(m.recipes.findRefsIncludingDeleted).not.toHaveBeenCalled();
  });

  it('R9 R12: una linea quitada del pedido con fotos cuenta, sin nombre de receta', async () => {
    const m = montar({
      filas: [
        filaFoto({ id: 'q1', slot: 1, orderLineId: LINEA_QUITADA }),
        filaFoto({ id: 'q2', slot: 1, orderLineId: LINEA_QUITADA, phase: 'packing' }),
      ],
    });

    const conteo = await m.contar(LECTOR, { lines: [{ orderId: PEDIDO, lineId: LINEA_QUITADA }] });

    expect(conteo).toEqual([{ orderId: PEDIDO, lineId: LINEA_QUITADA, photoCount: 2, recipeName: null }]);
  });

  it('R12: una receta borrada del catalogo sigue con su nombre', async () => {
    const m = montar({
      refs: [ref('receta-lavanda', 'Crema · Lavanda', true), ref('receta-romero', 'Crema · Romero')],
    });

    const conteo = await m.contar(LECTOR, { lines: [{ orderId: PEDIDO, lineId: LINEA }] });

    expect(conteo[0]!.recipeName).toBe('Crema · Lavanda');
  });
});

describe('countLineEvidence — solo lectura', () => {
  it('R17: no llama a ningun metodo de escritura del repositorio', async () => {
    const m = montar();

    await m.contar(LECTOR, {
      lines: [
        { orderId: PEDIDO, lineId: LINEA },
        { orderId: PEDIDO, lineId: OTRA_LINEA },
      ],
    });

    expect(m.repo.insert).not.toHaveBeenCalled();
    expect(m.repo.replace).not.toHaveBeenCalled();
    expect(m.repo.delete).not.toHaveBeenCalled();
  });
});
