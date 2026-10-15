import { describe, expect, it, vi } from 'vitest';

import { ROLE_ADMINISTRADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity';
import { createListProducedProducts } from '@/lib/modules/inventario/domain/list-produced-products';
import { UnauthorizedError, ValidationError } from '@/lib/modules/inventario/domain/errors';
import {
  FINISHED_ORDER_ID,
  FINISHED_PRESENTATION_ID,
  FINISHED_PRODUCT_ID,
  PRODUCED_PRODUCT_LINK,
} from '@/tests/fixtures/finished-product-detail';

import type { Actor } from '@/lib/modules/inventario/domain/actor';
import type { ProducedProductLink } from '@/lib/modules/inventario/domain/finished-product-detail';
import type { FinishedProductDetailRepository } from '@/lib/modules/inventario/ports/finished-product-detail-repository';

const EMPRESA = 'company-a';
const LECTOR: Actor = { id: 'u-lector', companyId: EMPRESA, permissions: ['inventario.consultar'] };
const OTRO_PEDIDO = 'a0000000-0000-4000-8000-000000000226';
const OTRA_PRESENTACION = 'c1000000-0000-4000-8000-000000000226';
const OTRO_PRODUCTO = 'f0000000-0000-4000-8000-000000000226';

function idDePedido(n: number): string {
  return `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function montar(links: readonly ProducedProductLink[] = [PRODUCED_PRODUCT_LINK]) {
  const products: FinishedProductDetailRepository = {
    findAliveFinished: vi.fn<FinishedProductDetailRepository['findAliveFinished']>(),
    listBatches: vi.fn<FinishedProductDetailRepository['listBatches']>(),
    listMovements: vi.fn<FinishedProductDetailRepository['listMovements']>(),
    // 2026-10-15 (QC-282): el puerto pierde `listDeliveryMovements`; el tab Entregas lee las lineas de `pedidos`.
    listProductionCosts: vi.fn<FinishedProductDetailRepository['listProductionCosts']>(),
    findProducedProducts: vi.fn<FinishedProductDetailRepository['findProducedProducts']>(async () => links),
  };
  return { products, listar: createListProducedProducts({ products }) };
}

function ningunPuerto(m: ReturnType<typeof montar>): void {
  for (const fn of Object.values(m.products)) {
    expect(fn).not.toHaveBeenCalled();
  }
}

describe('listProducedProducts', () => {
  it('R2: sin inventario.consultar responde unauthorized antes de validar y no llama a ningun puerto', async () => {
    const m = montar();
    const sinPermiso: Actor = { id: 'u-sin', companyId: EMPRESA, permissions: ['pedidos.consultar'] };

    await expect(m.listar([FINISHED_ORDER_ID], sinPermiso)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(m.listar('no-es-lista', sinPermiso)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(m.listar([FINISHED_ORDER_ID], null)).rejects.toBeInstanceOf(UnauthorizedError);
    ningunPuerto(m);
  });

  it('R3: un actor de otro rol con el permiso es aceptado', async () => {
    const m = montar();
    const deOtroRol: Actor = {
      id: 'u-operador',
      companyId: EMPRESA,
      permissions: ['pedidos.consultar', 'inventario.consultar'],
    };

    await expect(m.listar([FINISHED_ORDER_ID], deOtroRol)).resolves.toEqual([PRODUCED_PRODUCT_LINK]);
  });

  it('R3: un Administrador sin inventario.consultar en su conjunto es rechazado', async () => {
    const m = montar();
    const adminSinPermiso: Actor = {
      id: 'u-admin',
      companyId: EMPRESA,
      permissions: [...SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]].filter((p) => p !== 'inventario.consultar'),
    };

    await expect(m.listar([FINISHED_ORDER_ID], adminSinPermiso)).rejects.toBeInstanceOf(UnauthorizedError);
    ningunPuerto(m);
  });

  it('R27: devuelve el enlace de cada presentacion producida por cada pedido, con los ids de la empresa del actor', async () => {
    const otro: ProducedProductLink = { orderId: OTRO_PEDIDO, presentationId: OTRA_PRESENTACION, productId: OTRO_PRODUCTO };
    const m = montar([PRODUCED_PRODUCT_LINK, otro]);

    const enlaces = await m.listar([FINISHED_ORDER_ID, OTRO_PEDIDO, FINISHED_ORDER_ID], LECTOR);

    expect(enlaces).toEqual([PRODUCED_PRODUCT_LINK, otro]);
    expect(m.products.findProducedProducts).toHaveBeenCalledTimes(1);
    expect(m.products.findProducedProducts).toHaveBeenCalledWith([FINISHED_ORDER_ID, OTRO_PEDIDO], { companyId: EMPRESA });
  });

  it('R27: una lista vacia no consulta y no devuelve enlaces', async () => {
    const m = montar();

    await expect(m.listar([], LECTOR)).resolves.toEqual([]);
    expect(m.products.findProducedProducts).not.toHaveBeenCalled();
  });

  it('R28: un par pedido-presentacion con dos productos se omite y los demas siguen', async () => {
    const ambiguo: ProducedProductLink = { orderId: FINISHED_ORDER_ID, presentationId: FINISHED_PRESENTATION_ID, productId: OTRO_PRODUCTO };
    const otro: ProducedProductLink = { orderId: FINISHED_ORDER_ID, presentationId: OTRA_PRESENTACION, productId: FINISHED_PRODUCT_ID };
    const m = montar([PRODUCED_PRODUCT_LINK, ambiguo, otro]);

    const enlaces = await m.listar([FINISHED_ORDER_ID], LECTOR);

    expect(enlaces).toEqual([otro]);
  });

  it('R28: un enlace repetido del mismo producto cuenta como uno solo', async () => {
    const m = montar([PRODUCED_PRODUCT_LINK, { ...PRODUCED_PRODUCT_LINK }]);

    await expect(m.listar([FINISHED_ORDER_ID], LECTOR)).resolves.toEqual([PRODUCED_PRODUCT_LINK]);
  });

  it('R27: mas de 25 ids, un id sin uuid o algo que no es lista responde invalid_input sin consultar', async () => {
    const veinticinco = Array.from({ length: 25 }, (_, i) => idDePedido(i + 1));
    const ok = montar([]);
    await expect(ok.listar(veinticinco, LECTOR)).resolves.toEqual([]);

    for (const entrada of [[...veinticinco, idDePedido(26)], ['no-es-uuid'], 'pedido', null, [42]]) {
      const m = montar();
      await expect(m.listar(entrada, LECTOR)).rejects.toBeInstanceOf(ValidationError);
      expect(m.products.findProducedProducts).not.toHaveBeenCalled();
    }
  });
});
