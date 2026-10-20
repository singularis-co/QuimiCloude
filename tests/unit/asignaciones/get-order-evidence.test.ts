// Las fotos del pedido vistas desde la ficha de producto terminado, con los puertos simulados:
// exige pedidos.consultar (no basta con ver el inventario), un solo error para los tres casos de
// «no hay pedido» y la empresa del actor como unica frontera.
import { describe, expect, it } from 'vitest';

import { OrderNotFoundError, UnauthorizedError } from '@/lib/modules/asignaciones/domain/errors';
import { createGetOrderEvidence } from '@/lib/modules/asignaciones/domain/get-order-evidence';
import { PERMISSIONS, ROLE_ADMINISTRADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity';

import { ANA, EMPRESA, OTRA_EMPRESA, PEDIDO } from './evidence-doubles';
import { FILAS_DEL_PEDIDO, montarLectura } from './order-evidence-doubles';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';

const PERMISO = 'pedidos.consultar';
const LECTOR: Actor = { id: ANA, companyId: EMPRESA, permissions: [PERMISO] };

function montar(options?: Parameters<typeof montarLectura>[0]) {
  const m = montarLectura({ filas: FILAS_DEL_PEDIDO, ...options });
  return { ...m, leer: createGetOrderEvidence(m.deps) };
}

async function errorDe(promesa: Promise<unknown>): Promise<unknown> {
  try {
    await promesa;
  } catch (error) {
    return error;
  }
  throw new Error('se esperaba un error');
}

describe('getOrderEvidence — autorizacion antes de todo', () => {
  const sinElPermiso = PERMISSIONS.map((p) => p.code).filter((code) => code !== PERMISO);

  it('R2: con inventario.consultar y sin pedidos.consultar no ve ninguna foto ni toca ningun puerto', async () => {
    const m = montar();
    const deInventario = { id: ANA, companyId: EMPRESA, permissions: ['inventario.consultar'] };

    await expect(m.leer(deInventario, { orderId: PEDIDO })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(m.ningunPuertoLlamado()).toBe(true);
  });

  it.each([
    ['ausente (null)', null],
    ['ausente (undefined)', undefined],
    ['sin conjunto de permisos', { id: ANA, companyId: EMPRESA } as unknown as Actor],
    ['con el conjunto vacio', { id: ANA, companyId: EMPRESA, permissions: [] }],
    ['con todo el catalogo menos pedidos.consultar', { id: ANA, companyId: EMPRESA, permissions: sinElPermiso }],
  ])('R2: un actor %s se rechaza sin llamar a ningun puerto', async (_caso, actor) => {
    const m = montar();
    await expect(m.leer(actor as Actor | null | undefined, { orderId: PEDIDO })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(m.ningunPuertoLlamado()).toBe(true);
  });

  it('R2: la autorizacion va antes de validar: una entrada malformada sin permiso es unauthorized', async () => {
    const m = montar();
    await expect(
      m.leer({ ...LECTOR, permissions: ['inventario.consultar'] }, { orderId: 'no-es-un-uuid' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(m.ningunPuertoLlamado()).toBe(true);
  });

  it('R2: con pedidos.consultar solo, las fotos se leen', async () => {
    const m = montar();
    const lectura = await m.leer(LECTOR, { orderId: PEDIDO });
    expect(lectura.evidence.manufacturing.length).toBeGreaterThan(0);
  });
});

describe('getOrderEvidence — por permiso, nunca por rol', () => {
  it('R3: un rol cualquiera con pedidos.consultar es aceptado', async () => {
    const m = montar();
    const deOtroRol = { id: ANA, companyId: EMPRESA, permissions: ['clientes.consultar', PERMISO], roleName: 'Auditor' };
    await expect(m.leer(deOtroRol, { orderId: PEDIDO })).resolves.toMatchObject({ signingFailure: null });
  });

  it('R3: un Administrador sin pedidos.consultar en su conjunto es rechazado', async () => {
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

describe('getOrderEvidence — sin pedido, el mismo order_not_found', () => {
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

describe('getOrderEvidence — la empresa del actor', () => {
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
