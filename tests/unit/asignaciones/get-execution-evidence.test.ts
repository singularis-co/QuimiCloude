// Las fotos del pedido vistas desde el recorrido, con los puertos simulados: el permiso del
// recorrido antes de todo, un solo error para los tres casos de «no hay pedido» y la empresa
// del actor como unica frontera.
import { describe, expect, it } from 'vitest';

import { OrderNotFoundError, UnauthorizedError } from '@/lib/modules/asignaciones/domain/errors';
import { createGetExecutionEvidence } from '@/lib/modules/asignaciones/domain/get-execution-evidence';
import { PERMISSIONS, ROLE_ADMINISTRADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity';

import { ANA, EMPRESA, filaFoto, LINEA, OTRA_EMPRESA, OTRA_LINEA, PEDIDO } from './evidence-doubles';
import { FILAS_DEL_PEDIDO, montarLectura } from './order-evidence-doubles';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';

const PERMISO = 'dashboard.consultar';
const LECTOR: Actor = { id: ANA, companyId: EMPRESA, permissions: [PERMISO] };

function montar(options?: Parameters<typeof montarLectura>[0]) {
  const m = montarLectura({ filas: FILAS_DEL_PEDIDO, ...options });
  return { ...m, leer: createGetExecutionEvidence(m.deps) };
}

async function errorDe(promesa: Promise<unknown>): Promise<unknown> {
  try {
    await promesa;
  } catch (error) {
    return error;
  }
  throw new Error('se esperaba un error');
}

describe('getExecutionEvidence — autorizacion antes de todo', () => {
  const sinElPermiso = PERMISSIONS.map((p) => p.code).filter((code) => code !== PERMISO);

  it.each([
    ['ausente (null)', null],
    ['ausente (undefined)', undefined],
    ['sin conjunto de permisos', { id: ANA, companyId: EMPRESA } as unknown as Actor],
    ['con el conjunto vacio', { id: ANA, companyId: EMPRESA, permissions: [] }],
    ['con todo el catalogo menos dashboard.consultar', { id: ANA, companyId: EMPRESA, permissions: sinElPermiso }],
  ])('R1: un actor %s se rechaza sin llamar a ningun puerto', async (_caso, actor) => {
    const m = montar();
    await expect(m.leer(actor as Actor | null | undefined, { orderId: PEDIDO })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(m.ningunPuertoLlamado()).toBe(true);
  });

  it('R1: la autorizacion va antes de validar: una entrada malformada sin permiso es unauthorized', async () => {
    const m = montar();
    await expect(m.leer({ ...LECTOR, permissions: [] }, { orderId: 'no-es-un-uuid' })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(m.ningunPuertoLlamado()).toBe(true);
  });

  it('R1: con dashboard.consultar solo, las fotos se leen', async () => {
    const m = montar();
    const lectura = await m.leer(LECTOR, { orderId: PEDIDO });
    expect(lectura.evidence.recipes[0]!.evidence.manufacturing.length).toBeGreaterThan(0);
  });
});

describe('getExecutionEvidence — por permiso, nunca por rol', () => {
  it('R3: un rol cualquiera con dashboard.consultar es aceptado', async () => {
    const m = montar();
    const deOtroRol = { id: ANA, companyId: EMPRESA, permissions: ['clientes.consultar', PERMISO], roleName: 'Auditor' };
    await expect(m.leer(deOtroRol, { orderId: PEDIDO })).resolves.toMatchObject({ signingFailure: null });
  });

  it('R3: un Administrador sin dashboard.consultar en su conjunto es rechazado', async () => {
    const m = montar();
    const admin = {
      id: ANA,
      companyId: EMPRESA,
      roleName: ROLE_ADMINISTRADOR,
      permissions: [...SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]].filter((p) => p !== PERMISO),
    };
    await expect(m.leer(admin, { orderId: PEDIDO })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(m.ningunPuertoLlamado()).toBe(true);
  });
});

describe('getExecutionEvidence — sin pedido, el mismo order_not_found', () => {
  it('R5: id malformado, pedido inexistente y pedido de otra empresa dan el mismo error sin firmar', async () => {
    const malformado = montar();
    const inexistente = montar({ pedido: null });
    const ajeno = montar();

    const errores = [
      await errorDe(malformado.leer(LECTOR, { orderId: 'no-es-un-uuid' })),
      await errorDe(inexistente.leer(LECTOR, { orderId: PEDIDO })),
      await errorDe(ajeno.leer({ ...LECTOR, companyId: OTRA_EMPRESA }, { orderId: PEDIDO })),
    ];
    for (const error of errores) {
      expect(error).toBeInstanceOf(OrderNotFoundError);
      expect((error as OrderNotFoundError).code).toBe('order_not_found');
      expect((error as Error).message).toBe((errores[0] as Error).message);
    }
    expect(malformado.ningunPuertoLlamado()).toBe(true);
    for (const m of [inexistente, ajeno]) {
      expect(m.repo.listByOrder).not.toHaveBeenCalled();
      expect(m.storage.createSignedReadUrls).not.toHaveBeenCalled();
    }
  });

  it.each([[null], [{}], ['texto'], [{ orderId: PEDIDO, extra: true }]])(
    'R5: la entrada %j tambien es order_not_found sin tocar ningun puerto',
    async (entrada) => {
      const m = montar();
      await expect(m.leer(LECTOR, entrada)).rejects.toBeInstanceOf(OrderNotFoundError);
      expect(m.ningunPuertoLlamado()).toBe(true);
    },
  );
});

describe('getExecutionEvidence — la empresa del actor', () => {
  it('R29: la empresa A pide un pedido de la B: order_not_found y createSignedReadUrls sin llamar', async () => {
    const m = montar();

    await expect(m.leer({ ...LECTOR, companyId: OTRA_EMPRESA }, { orderId: PEDIDO })).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
    expect(m.listSummariesByIdsIncludingDeleted.mock.calls[0]![0]).toBe(OTRA_EMPRESA);
    expect(m.storage.createSignedReadUrls).not.toHaveBeenCalled();
  });

  it('R29: lista las fotos con la empresa del actor, nunca con una de la entrada', async () => {
    const m = montar();

    await m.leer(LECTOR, { orderId: PEDIDO });

    for (const llamada of m.repo.listByOrder.mock.calls) expect(llamada[0]).toBe(EMPRESA);
  });
});

describe('getExecutionEvidence — las fotos por receta', () => {
  const DE_DOS_RECETAS = [
    filaFoto({ id: 'a-m1', slot: 1, stepPosition: 1 }),
    filaFoto({ id: 'b-m1', slot: 1, stepPosition: 1, orderLineId: OTRA_LINEA }),
    filaFoto({ id: 'b-p2', slot: 1, stepPosition: 2, phase: 'packing', orderLineId: OTRA_LINEA }),
    filaFoto({ id: 'a-c1', slot: 1, stepPosition: 1, phase: 'conditioning' }),
  ];

  it('R26: cada receta trae solo sus fotos, y una sola firma para todas', async () => {
    const m = montar({ filas: DE_DOS_RECETAS });
    const { evidence, signingFailure } = await m.leer(LECTOR, { orderId: PEDIDO });

    expect(signingFailure).toBeNull();
    const fotos = (lineId: string) => {
      const receta = evidence.recipes.find((item) => item.lineId === lineId)!;
      return [receta.evidence.manufacturing, receta.evidence.packing, receta.evidence.conditioning].map((grupos) =>
        grupos.flatMap((grupo) => (grupo.photos ?? []).map((foto) => foto.id)),
      );
    };
    expect(evidence.recipes.map((item) => item.lineId).sort()).toEqual([LINEA, OTRA_LINEA].sort());
    expect(fotos(LINEA)).toEqual([['a-m1'], [], ['a-c1']]);
    expect(fotos(OTRA_LINEA)).toEqual([['b-m1'], ['b-p2'], []]);
    expect(m.storage.createSignedReadUrls).toHaveBeenCalledTimes(1);
  });

  it('R26: con la firma caida cada receta conserva sus grupos y su cifra, sin fotos', async () => {
    const m = montar({ filas: DE_DOS_RECETAS, firmaFalla: new Error('storage caido') });
    const { evidence, signingFailure } = await m.leer(LECTOR, { orderId: PEDIDO });

    expect(signingFailure).toBe('storage caido');
    const otra = evidence.recipes.find((item) => item.lineId === OTRA_LINEA)!;
    expect(otra.evidence.packing).toEqual([{ stepPosition: 2, photoCount: 1, photos: null }]);
  });

  it('R29: un pedido de una receta da una sola entrada con las mismas fotos de siempre', async () => {
    const m = montar();
    const { evidence } = await m.leer(LECTOR, { orderId: PEDIDO });
    expect(evidence.recipes.map((item) => item.lineId)).toEqual([LINEA]);
    expect(evidence.recipes[0]!.evidence.manufacturing.map((grupo) => [grupo.stepPosition, grupo.photoCount])).toEqual([
      [1, 2],
      [3, 1],
    ]);
  });

  it('R25: un pedido sin fotos da la lista de recetas vacia y no firma', async () => {
    const m = montar({ filas: [] });
    const { evidence } = await m.leer(LECTOR, { orderId: PEDIDO });
    expect(evidence.recipes).toEqual([]);
    expect(m.storage.createSignedReadUrls).not.toHaveBeenCalled();
  });
});
