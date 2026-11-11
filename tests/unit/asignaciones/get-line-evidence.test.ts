// Las fotos de UNA receta del pedido vistas desde la ficha de producto terminado, con los puertos
// simulados: exige pedidos.consultar, reutiliza la lectura por linea del recorrido, y una linea
// ajena, inexistente o quitada sin fotos da el mismo error que un pedido ajeno.
import { describe, expect, it, vi } from 'vitest';

import { OrderNotFoundError, UnauthorizedError } from '@/lib/modules/asignaciones/domain/errors';
import { createGetLineEvidence } from '@/lib/modules/asignaciones/domain/get-line-evidence';
import { PERMISSIONS, ROLE_ADMINISTRADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity';

import { ANA, EMPRESA, LINEA, OTRA_EMPRESA, OTRA_LINEA, PEDIDO, filaFoto, uuid } from './evidence-doubles';
import { montarLectura, pedido } from './order-evidence-doubles';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';
import type { OrderRecipesOutline } from '@/lib/modules/pedidos';

const PERMISO = 'pedidos.consultar';
const LECTOR: Actor = { id: ANA, companyId: EMPRESA, permissions: [PERMISO] };
const LINEA_SIN_FOTOS = uuid('b');
const LINEA_DE_OTRO_PEDIDO = uuid('a');
const LINEA_INEXISTENTE = uuid('c');
const LINEA_QUITADA = uuid('d');

/** LINEA: fabricacion en los pasos 1 (2 fotos) y 3 (1), envasado en el 1 y acondicionamiento en el
 *  2. OTRA_LINEA: 2 de fabricacion en el paso 1. */
const FILAS_DE_DOS_RECETAS = [
  filaFoto({ id: 'm1-2', slot: 2, stepPosition: 1 }),
  filaFoto({ id: 'm3-1', slot: 1, stepPosition: 3 }),
  filaFoto({ id: 'm1-1', slot: 1, stepPosition: 1 }),
  filaFoto({ id: 'p1-1', slot: 1, stepPosition: 1, phase: 'packing' }),
  filaFoto({ id: 'c2-1', slot: 1, stepPosition: 2, phase: 'conditioning' }),
  filaFoto({ id: 'o1-1', slot: 1, stepPosition: 1, orderLineId: OTRA_LINEA }),
  filaFoto({ id: 'o1-2', slot: 2, stepPosition: 1, orderLineId: OTRA_LINEA }),
];

/** El pedido tiene hoy `LINEA`, `OTRA_LINEA` y `LINEA_SIN_FOTOS`; `LINEA_QUITADA` ya no esta. */
function outlineDelPedido(): OrderRecipesOutline {
  return {
    id: PEDIDO,
    deleted: false,
    recipes: [LINEA, OTRA_LINEA, LINEA_SIN_FOTOS].map((lineId, i) => ({
      lineId,
      position: i + 1,
      recipeId: `receta-${String(i + 1)}`,
      status: 'ENTREGADO' as const,
      quantity: '10.0000',
      unitId: null,
      presentationLines: [],
    })),
    progress: { total: 3, finished: 3 },
  };
}

function montar(options?: Parameters<typeof montarLectura>[0]) {
  const m = montarLectura({ filas: FILAS_DE_DOS_RECETAS, ...options });
  const listRecipeOutlinesByIdsIncludingDeleted = vi.fn(async (companyId: string, ids: readonly string[]) =>
    companyId === EMPRESA && ids.includes(PEDIDO) ? [outlineDelPedido()] : [],
  );
  const orders = { ...m.deps.orders, listRecipeOutlinesByIdsIncludingDeleted };
  return {
    ...m,
    listRecipeOutlinesByIdsIncludingDeleted,
    leer: createGetLineEvidence({ ...m.deps, orders }),
    ningunPuertoLlamado: () =>
      m.ningunPuertoLlamado() && listRecipeOutlinesByIdsIncludingDeleted.mock.calls.length === 0,
  };
}

async function errorDe(promesa: Promise<unknown>): Promise<unknown> {
  try {
    await promesa;
  } catch (error) {
    return error;
  }
  throw new Error('se esperaba un error');
}

function idsDeFotos(grupos: readonly { readonly photos: readonly { readonly id: string }[] | null }[]): string[] {
  return grupos.flatMap((grupo) => (grupo.photos ?? []).map((foto) => foto.id));
}

describe('getLineEvidence — autorizacion antes de todo', () => {
  const sinElPermiso = PERMISSIONS.map((p) => p.code).filter((code) => code !== PERMISO);

  it('R13: con inventario.consultar y sin pedidos.consultar no ve ninguna foto ni toca ningun puerto', async () => {
    const m = montar();
    const deInventario = { id: ANA, companyId: EMPRESA, permissions: ['inventario.consultar'] };

    await expect(m.leer(deInventario, { orderId: PEDIDO, lineId: LINEA })).rejects.toBeInstanceOf(UnauthorizedError);
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
      m.leer(actor as Actor | null | undefined, { orderId: PEDIDO, lineId: LINEA }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(m.ningunPuertoLlamado()).toBe(true);
  });

  it('R13: la autorizacion va antes de validar: una entrada malformada sin permiso es unauthorized', async () => {
    const m = montar();
    await expect(
      m.leer({ ...LECTOR, permissions: ['inventario.consultar'] }, { orderId: PEDIDO, lineId: 'no-es-un-uuid' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(m.ningunPuertoLlamado()).toBe(true);
  });
});

describe('getLineEvidence — por permiso, nunca por rol', () => {
  it('R13: un rol cualquiera con pedidos.consultar es aceptado', async () => {
    const m = montar();
    const deOtroRol = { id: ANA, companyId: EMPRESA, permissions: ['clientes.consultar', PERMISO], roleName: 'Auditor' };
    await expect(m.leer(deOtroRol, { orderId: PEDIDO, lineId: LINEA })).resolves.toMatchObject({
      signingFailure: null,
    });
  });

  it('R13: un Administrador sin pedidos.consultar en su conjunto es rechazado', async () => {
    const m = montar();
    const admin = {
      id: ANA,
      companyId: EMPRESA,
      roleName: ROLE_ADMINISTRADOR,
      permissions: [...SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]].filter((p) => p !== PERMISO),
    };
    await expect(m.leer(admin, { orderId: PEDIDO, lineId: LINEA })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(m.ningunPuertoLlamado()).toBe(true);
  });
});

describe('getLineEvidence — las fotos de la receta', () => {
  it('R6 R20: en un pedido de dos recetas solo salen las de la linea nombrada, en sus tres fases', async () => {
    const m = montar();

    const { evidence, signingFailure } = await m.leer(LECTOR, { orderId: PEDIDO, lineId: LINEA });

    expect(signingFailure).toBeNull();
    expect(evidence.manufacturing.map((g) => [g.stepPosition, g.photoCount])).toEqual([
      [1, 2],
      [3, 1],
    ]);
    expect(idsDeFotos(evidence.manufacturing)).toEqual(['m1-1', 'm1-2', 'm3-1']);
    expect(idsDeFotos(evidence.packing)).toEqual(['p1-1']);
    expect(evidence.conditioning.map((g) => [g.stepPosition, g.photoCount])).toEqual([[2, 1]]);
    expect(idsDeFotos(evidence.conditioning)).toEqual(['c2-1']);
  });

  it('R6: la otra receta del pedido lee solo las suyas', async () => {
    const m = montar();

    const { evidence } = await m.leer(LECTOR, { orderId: PEDIDO, lineId: OTRA_LINEA });

    expect(idsDeFotos(evidence.manufacturing)).toEqual(['o1-1', 'o1-2']);
    expect(evidence.packing).toEqual([]);
    expect(evidence.conditioning).toEqual([]);
  });

  it('R16: reutiliza la lectura del pedido por linea: lista por pedido, una sola firma, sin lectura por linea', async () => {
    const m = montar();

    await m.leer(LECTOR, { orderId: PEDIDO, lineId: LINEA });

    expect(m.repo.listByOrder).toHaveBeenCalledTimes(3);
    expect(m.repo.listByLine).not.toHaveBeenCalled();
    expect(m.storage.createSignedReadUrls).toHaveBeenCalledTimes(1);
    expect(m.listRecipeOutlinesByIdsIncludingDeleted).not.toHaveBeenCalled();
  });

  it('R6: una receta viva del pedido sin fotos devuelve la evidencia vacia', async () => {
    const m = montar();

    await expect(m.leer(LECTOR, { orderId: PEDIDO, lineId: LINEA_SIN_FOTOS })).resolves.toEqual({
      evidence: { manufacturing: [], packing: [], conditioning: [] },
      signingFailure: null,
    });
  });

  it('R12: un pedido dado de baja sigue mostrando las fotos de su receta', async () => {
    const m = montar({ pedido: pedido({ deleted: true }) });

    const { evidence } = await m.leer(LECTOR, { orderId: PEDIDO, lineId: LINEA });

    expect(idsDeFotos(evidence.manufacturing)).toEqual(['m1-1', 'm1-2', 'm3-1']);
  });

  it('R12: una linea quitada del pedido que tiene fotos las sigue mostrando', async () => {
    const m = montar({
      filas: [...FILAS_DE_DOS_RECETAS, filaFoto({ id: 'q1-1', slot: 1, stepPosition: 1, orderLineId: LINEA_QUITADA })],
    });

    const { evidence } = await m.leer(LECTOR, { orderId: PEDIDO, lineId: LINEA_QUITADA });

    expect(idsDeFotos(evidence.manufacturing)).toEqual(['q1-1']);
  });

  it('R10: con la firma caida los grupos salen con su cantidad, sin fotos, y la causa en signingFailure', async () => {
    const m = montar({ firmaFalla: new Error('storage caido') });

    const { evidence, signingFailure } = await m.leer(LECTOR, { orderId: PEDIDO, lineId: LINEA });

    expect(signingFailure).toBe('storage caido');
    expect(evidence.manufacturing).toEqual([
      { stepPosition: 1, photoCount: 2, photos: null },
      { stepPosition: 3, photoCount: 1, photos: null },
    ]);
    expect(evidence.packing).toEqual([{ stepPosition: 1, photoCount: 1, photos: null }]);
    expect(evidence.conditioning).toEqual([{ stepPosition: 2, photoCount: 1, photos: null }]);
  });
});

describe('getLineEvidence — sin receta, el mismo order_not_found', () => {
  it('R14: pedido ajeno, linea de otro pedido, linea inexistente y linea quitada sin fotos dan el mismo error', async () => {
    const casos = [
      { actor: { ...LECTOR, companyId: OTRA_EMPRESA }, lineId: LINEA },
      { actor: LECTOR, lineId: LINEA_DE_OTRO_PEDIDO },
      { actor: LECTOR, lineId: LINEA_INEXISTENTE },
      { actor: LECTOR, lineId: LINEA_QUITADA },
    ];

    for (const caso of casos) {
      const error = await errorDe(montar().leer(caso.actor, { orderId: PEDIDO, lineId: caso.lineId }));
      expect(error).toBeInstanceOf(OrderNotFoundError);
      expect((error as OrderNotFoundError).code).toBe('order_not_found');
    }
  });

  it.each([
    ['una linea de otro pedido', LINEA_DE_OTRO_PEDIDO],
    ['una linea inexistente', LINEA_INEXISTENTE],
    ['una linea quitada sin fotos', LINEA_QUITADA],
  ])('R14: %s en un pedido de la empresa con fotos de otra receta es order_not_found sin firmar', async (_caso, lineId) => {
    const m = montar();

    const error = await errorDe(m.leer(LECTOR, { orderId: PEDIDO, lineId }));

    expect(error).toBeInstanceOf(OrderNotFoundError);
    expect((error as OrderNotFoundError).code).toBe('order_not_found');
    expect(m.storage.createSignedReadUrls).not.toHaveBeenCalled();
    expect(m.storage.createSignedReadUrl).not.toHaveBeenCalled();
    expect(m.repo.listByOrder).not.toHaveBeenCalled();
    expect(m.repo.countByLines).toHaveBeenCalledWith(EMPRESA, [{ orderId: PEDIDO, lineId }]);
  });

  it('R14: el pedido de otra empresa no firma ninguna lectura', async () => {
    const m = montar();

    await expect(
      m.leer({ ...LECTOR, companyId: OTRA_EMPRESA }, { orderId: PEDIDO, lineId: LINEA }),
    ).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(m.repo.countByLines.mock.calls[0]![0]).toBe(OTRA_EMPRESA);
    expect(m.listRecipeOutlinesByIdsIncludingDeleted.mock.calls[0]![0]).toBe(OTRA_EMPRESA);
    expect(m.repo.listByOrder).not.toHaveBeenCalled();
    expect(m.storage.createSignedReadUrls).not.toHaveBeenCalled();
  });

  it('R14: un pedido inexistente es order_not_found sin firmar', async () => {
    const m = montar({ pedido: null });

    await expect(m.leer(LECTOR, { orderId: PEDIDO, lineId: LINEA })).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(m.storage.createSignedReadUrls).not.toHaveBeenCalled();
  });

  it.each([
    [null],
    [{}],
    ['texto'],
    [{ orderId: PEDIDO }],
    [{ orderId: PEDIDO, lineId: 'no-es-un-uuid' }],
    [{ orderId: 'no-es-un-uuid', lineId: LINEA }],
    [{ orderId: PEDIDO, lineId: LINEA, extra: true }],
  ])('R14: la entrada %j es order_not_found sin tocar ningun puerto', async (entrada) => {
    const m = montar();
    await expect(m.leer(LECTOR, entrada)).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(m.ningunPuertoLlamado()).toBe(true);
  });
});

describe('getLineEvidence — la empresa del actor y solo lectura', () => {
  it('R14: lista las fotos y el pedido con la empresa del actor', async () => {
    const m = montar();

    await m.leer(LECTOR, { orderId: PEDIDO, lineId: LINEA_SIN_FOTOS });

    await m.leer(LECTOR, { orderId: PEDIDO, lineId: LINEA });

    for (const llamada of m.repo.countByLines.mock.calls) expect(llamada[0]).toBe(EMPRESA);
    for (const llamada of m.repo.listByOrder.mock.calls) expect(llamada[0]).toBe(EMPRESA);
    expect(m.listSummariesByIdsIncludingDeleted.mock.calls[0]![0]).toBe(EMPRESA);
    expect(m.listRecipeOutlinesByIdsIncludingDeleted).toHaveBeenCalledWith(EMPRESA, [PEDIDO]);
  });

  it('R17: no llama a ningun metodo de escritura ni borra del bucket', async () => {
    const m = montar();

    await m.leer(LECTOR, { orderId: PEDIDO, lineId: LINEA });
    await m.leer(LECTOR, { orderId: PEDIDO, lineId: LINEA_SIN_FOTOS });

    expect(m.repo.insert).not.toHaveBeenCalled();
    expect(m.repo.replace).not.toHaveBeenCalled();
    expect(m.repo.delete).not.toHaveBeenCalled();
    expect(m.storage.remove).not.toHaveBeenCalled();
    expect(m.storage.createSignedUpload).not.toHaveBeenCalled();
  });
});
