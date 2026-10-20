// El conteo de fotos por pedido para la columna de Lotes, con el repositorio en memoria:
// pedidos.consultar antes de todo, hasta 25 uuid, sin duplicados y solo los pedidos con fotos.
import { describe, expect, it } from 'vitest';

import { createCountOrderEvidence } from '@/lib/modules/asignaciones/domain/count-order-evidence';
import { UnauthorizedError, ValidationError } from '@/lib/modules/asignaciones/domain/errors';
import { PERMISSIONS, ROLE_ADMINISTRADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity';

import { ANA, EMPRESA, OTRA_EMPRESA, PEDIDO, filaFoto, repositorioEnMemoria, uuid } from './evidence-doubles';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';

const PERMISO = 'pedidos.consultar';
const LECTOR: Actor = { id: ANA, companyId: EMPRESA, permissions: [PERMISO] };
const PEDIDO_SIN_FOTOS = uuid('5');
const PEDIDO_AJENO = uuid('6');

/** PEDIDO: 2 de fabricacion y 1 de envasado. PEDIDO_AJENO: 2 fotos, pero de otra empresa. */
function montar() {
  const { repo } = repositorioEnMemoria([
    filaFoto({ id: 'm1', slot: 1, stepPosition: 1 }),
    filaFoto({ id: 'm2', slot: 2, stepPosition: 1 }),
    filaFoto({ id: 'p1', slot: 1, stepPosition: 1, phase: 'packing' }),
    filaFoto({ id: 'x1', slot: 1, orderId: PEDIDO_AJENO }, OTRA_EMPRESA),
    filaFoto({ id: 'x2', slot: 2, orderId: PEDIDO_AJENO }, OTRA_EMPRESA),
  ]);
  return { repo, contar: createCountOrderEvidence({ evidence: repo }) };
}

function idsDistintos(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
}

describe('countOrderEvidence — autorizacion antes de todo', () => {
  const sinElPermiso = PERMISSIONS.map((p) => p.code).filter((code) => code !== PERMISO);

  it('R2: con inventario.consultar y sin pedidos.consultar se rechaza sin tocar el repositorio', async () => {
    const m = montar();
    const deInventario = { id: ANA, companyId: EMPRESA, permissions: ['inventario.consultar'] };

    await expect(m.contar(deInventario, { orderIds: [PEDIDO] })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(m.repo.countByOrders).not.toHaveBeenCalled();
  });

  it.each([
    ['ausente (null)', null],
    ['ausente (undefined)', undefined],
    ['sin conjunto de permisos', { id: ANA, companyId: EMPRESA } as unknown as Actor],
    ['con el conjunto vacio', { id: ANA, companyId: EMPRESA, permissions: [] }],
    ['con todo el catalogo menos pedidos.consultar', { id: ANA, companyId: EMPRESA, permissions: sinElPermiso }],
  ])('R2: un actor %s se rechaza sin tocar el repositorio', async (_caso, actor) => {
    const m = montar();
    await expect(m.contar(actor as Actor | null | undefined, { orderIds: [PEDIDO] })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(m.repo.countByOrders).not.toHaveBeenCalled();
  });

  it('R2: la autorizacion va antes de validar: 26 ids sin permiso es unauthorized', async () => {
    const m = montar();
    await expect(m.contar({ ...LECTOR, permissions: [] }, { orderIds: idsDistintos(26) })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});

describe('countOrderEvidence — por permiso, nunca por rol', () => {
  it('R3: un rol cualquiera con pedidos.consultar es aceptado', async () => {
    const m = montar();
    const deOtroRol = { id: ANA, companyId: EMPRESA, permissions: ['clientes.consultar', PERMISO], roleName: 'Auditor' };
    await expect(m.contar(deOtroRol, { orderIds: [PEDIDO] })).resolves.toEqual([{ orderId: PEDIDO, photoCount: 3 }]);
  });

  it('R3: un Administrador sin pedidos.consultar en su conjunto es rechazado', async () => {
    const m = montar();
    const admin = {
      id: ANA,
      companyId: EMPRESA,
      roleName: ROLE_ADMINISTRADOR,
      permissions: [...SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]].filter((p) => p !== PERMISO),
    };
    await expect(m.contar(admin, { orderIds: [PEDIDO] })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(m.repo.countByOrders).not.toHaveBeenCalled();
  });
});

describe('countOrderEvidence — la entrada', () => {
  it('R6: hasta 25 ids se aceptan', async () => {
    const m = montar();
    await expect(m.contar(LECTOR, { orderIds: idsDistintos(25) })).resolves.toEqual([]);
    expect(m.repo.countByOrders).toHaveBeenCalledTimes(1);
  });

  it('R6: 26 ids responden invalid_input sin tocar el repositorio', async () => {
    const m = montar();
    const error = await m.contar(LECTOR, { orderIds: idsDistintos(26) }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).code).toBe('invalid_input');
    expect(m.repo.countByOrders).not.toHaveBeenCalled();
  });

  it.each([
    ['un id que no es uuid', { orderIds: [PEDIDO, 'no-es-un-uuid'] }],
    ['sin lista', {}],
    ['una lista que no es lista', { orderIds: PEDIDO }],
    ['una clave de mas', { orderIds: [PEDIDO], extra: true }],
    ['null', null],
  ])('R6: %s responde invalid_input sin tocar el repositorio', async (_caso, entrada) => {
    const m = montar();
    await expect(m.contar(LECTOR, entrada)).rejects.toBeInstanceOf(ValidationError);
    expect(m.repo.countByOrders).not.toHaveBeenCalled();
  });

  it('R6: los ids duplicados se cuentan una sola vez', async () => {
    const m = montar();

    const conteo = await m.contar(LECTOR, { orderIds: [PEDIDO, PEDIDO, PEDIDO] });

    expect(conteo).toEqual([{ orderId: PEDIDO, photoCount: 3 }]);
    expect(m.repo.countByOrders).toHaveBeenCalledWith(EMPRESA, [PEDIDO]);
  });

  it('R6: la lista vacia devuelve [] sin llamar al repositorio', async () => {
    const m = montar();
    await expect(m.contar(LECTOR, { orderIds: [] })).resolves.toEqual([]);
    expect(m.repo.countByOrders).not.toHaveBeenCalled();
  });
});

describe('countOrderEvidence — que pedidos salen', () => {
  it('solo salen los pedidos con alguna foto, contando las dos fases', async () => {
    const m = montar();

    const conteo = await m.contar(LECTOR, { orderIds: [PEDIDO_SIN_FOTOS, PEDIDO] });

    expect(conteo).toEqual([{ orderId: PEDIDO, photoCount: 3 }]);
  });

  it('R6: un pedido de otra empresa no aporta ninguna foto al conteo', async () => {
    const m = montar();

    const conteo = await m.contar(LECTOR, { orderIds: [PEDIDO_AJENO, PEDIDO] });

    expect(conteo).toEqual([{ orderId: PEDIDO, photoCount: 3 }]);
    expect(m.repo.countByOrders).toHaveBeenCalledWith(EMPRESA, [PEDIDO_AJENO, PEDIDO]);
  });

  it('R29: cuenta con la empresa del actor', async () => {
    const m = montar();

    const conteo = await m.contar({ ...LECTOR, companyId: OTRA_EMPRESA }, { orderIds: [PEDIDO_AJENO, PEDIDO] });

    expect(conteo).toEqual([{ orderId: PEDIDO_AJENO, photoCount: 2 }]);
  });
});
