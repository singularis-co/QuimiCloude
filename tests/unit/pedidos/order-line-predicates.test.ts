// QT-314 T2 — los predicados que el contrato publica para la pantalla son las mismas funciones
// que aplican los casos de uso, y se prueban con todos los estados.

import { describe, expect, it, vi } from 'vitest';

import * as contrato from '@/lib/modules/pedidos';
import { isDeletableOrder as isDeletableDelCaso, createDeleteOrder } from '@/lib/modules/pedidos/domain/delete-order';
import { InvalidTransitionError, NotDeletableError } from '@/lib/modules/pedidos/domain/errors';
import { isCancellableStatus as isCancellableDelDominio } from '@/lib/modules/pedidos/domain/order-cancellation';
import { ORDER_STATUS_VALUES } from '@/lib/modules/pedidos/domain/order-classification';
import { orderLineInputSchema as esquemaDelDominio } from '@/lib/modules/pedidos/domain/order-input';
import { isRemovableOrderLineStatus as isRemovableDelDominio } from '@/lib/modules/pedidos/domain/order-line-removal';
import { sumDecimal4 as sumDelDominio } from '@/lib/modules/pedidos/domain/order-totals';
import { isEditableOrderLineStatus as isEditableDelDominio } from '@/lib/modules/pedidos/domain/order-transitions';
import { createUpdateOrder } from '@/lib/modules/pedidos/domain/update-order';
import { fakeCustomerCatalog } from '@/tests/helpers/customer-catalog-double';
import { fakeOrderRow, fakeUnitOfWork, orderLineOf } from '@/tests/helpers/order-unit-of-work-double';
import { fakePackagingCatalog } from '@/tests/helpers/packaging-catalog-double';

import type { Actor } from '@/lib/modules/pedidos/domain/actor';
import type { OrderLineStatus, OrderStatus } from '@/lib/modules/pedidos/domain/order-classification';
import type { OrderLineRow } from '@/lib/modules/pedidos/domain/order-view';
import type { OrderRepository } from '@/lib/modules/pedidos/ports/order-repository';
import type { PresentationCatalog, ProductCatalog } from '@/lib/modules/inventario';
import type { RecipeCatalog } from '@/lib/modules/recetas';
import type { UnitCatalog } from '@/lib/modules/unidades';

const LINE_STATUSES = ORDER_STATUS_VALUES.filter(
  (status): status is OrderLineStatus => status !== 'PARCIAL',
);

const EMPRESA = '33333333-3333-4333-8333-333333333333';
const ACTOR: Actor = { id: 'admin-a', companyId: EMPRESA, permissions: ['pedidos.consultar', 'pedidos.modificar'] };
const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const RECETA = '22222222-2222-4222-8222-222222222222';
const LINEA = 'a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0';
const UNIT_ID = '77777777-7777-4777-8777-777777777777';

function tabla(predicado: (status: OrderLineStatus) => boolean): Record<OrderLineStatus, boolean> {
  return Object.fromEntries(LINE_STATUSES.map((status) => [status, predicado(status)])) as Record<
    OrderLineStatus,
    boolean
  >;
}

describe('QT-314 T2 — el contrato publica los predicados del servidor, sin copias', () => {
  it('R10, R11, R13, R36, R37: lo publicado es la misma funcion que usa el dominio', () => {
    expect(contrato.isEditableOrderLineStatus).toBe(isEditableDelDominio);
    expect(contrato.isCancellableStatus).toBe(isCancellableDelDominio);
    expect(contrato.isRemovableOrderLineStatus).toBe(isRemovableDelDominio);
    expect(contrato.isDeletableOrder).toBe(isDeletableDelCaso);
    expect(contrato.sumDecimal4).toBe(sumDelDominio);
    expect(contrato.orderLineInputSchema).toBe(esquemaDelDominio);
  });

  it('los estados de receta probados son los diez de OrderLineStatus', () => {
    expect(LINE_STATUSES).toHaveLength(10);
  });
});

describe('QT-314 T2 — isEditableOrderLineStatus', () => {
  it('R10: editables solo PENDIENTE, EN_CURSO y BLOQUEADO; el resto, solo lectura', () => {
    expect(tabla(contrato.isEditableOrderLineStatus)).toEqual({
      PENDIENTE: true,
      EN_CURSO: true,
      BLOQUEADO: true,
      POR_EMPACAR: false,
      EN_EMPAQUE: false,
      POR_ACONDICIONAR: false,
      EN_ACONDICIONAMIENTO: false,
      TERMINADO: false,
      ENTREGADO: false,
      CANCELADO: false,
    });
  });
});

describe('QT-314 T2 — isRemovableOrderLineStatus', () => {
  it('R11: se quitan solo PENDIENTE y BLOQUEADO; EN_CURSO no', () => {
    expect(tabla(contrato.isRemovableOrderLineStatus)).toEqual({
      PENDIENTE: true,
      BLOQUEADO: true,
      EN_CURSO: false,
      POR_EMPACAR: false,
      EN_EMPAQUE: false,
      POR_ACONDICIONAR: false,
      EN_ACONDICIONAMIENTO: false,
      TERMINADO: false,
      ENTREGADO: false,
      CANCELADO: false,
    });
  });
});

describe('QT-314 T2 — isCancellableStatus', () => {
  it('R36: se cancelan PENDIENTE, EN_CURSO y BLOQUEADO; el resto no', () => {
    expect(tabla(contrato.isCancellableStatus)).toEqual({
      PENDIENTE: true,
      EN_CURSO: true,
      BLOQUEADO: true,
      POR_EMPACAR: false,
      EN_EMPAQUE: false,
      POR_ACONDICIONAR: false,
      EN_ACONDICIONAMIENTO: false,
      TERMINADO: false,
      ENTREGADO: false,
      CANCELADO: false,
    });
  });

  it('R36: PARCIAL no es cancelable como estado: se decide por sus recetas', () => {
    expect(contrato.isCancellableStatus('PARCIAL')).toBe(false);
  });
});

describe('QT-314 T2 — isDeletableOrder', () => {
  const BORRABLES: readonly OrderStatus[] = ['PENDIENTE', 'EN_CURSO', 'BLOQUEADO'];

  it('R37: con una receta en cada estado, se borra solo si pedido y receta estan en PENDIENTE, EN_CURSO o BLOQUEADO', () => {
    for (const status of LINE_STATUSES) {
      expect(contrato.isDeletableOrder(status, [{ status }]), status).toBe(BORRABLES.includes(status));
    }
  });

  it('R37: un pedido PARCIAL se borra si todas sus recetas vivas son borrables, y no si una no lo es', () => {
    expect(contrato.isDeletableOrder('PARCIAL', [{ status: 'PENDIENTE' }, { status: 'EN_CURSO' }])).toBe(true);
    for (const status of LINE_STATUSES) {
      expect(
        contrato.isDeletableOrder('PARCIAL', [{ status: 'PENDIENTE' }, { status }]),
        status,
      ).toBe(BORRABLES.includes(status));
    }
  });
});

describe('QT-314 T2 — sumDecimal4 y orderLineInputSchema', () => {
  it('R13: la suma es exacta, a cuatro decimales, con 0 incluido y sin valores', () => {
    expect(contrato.sumDecimal4(['0.1', '0.2'])).toBe('0.3000');
    expect(contrato.sumDecimal4(['0', '12.5', '0.0001'])).toBe('12.5001');
    expect(contrato.sumDecimal4([])).toBe('0.0000');
  });

  it('R13: el precio de una receta vacio es sin precio, 0 vale, y negativo o mal formado no', () => {
    const receta = { recipeId: RECETA, quantity: '10', unitId: UNIT_ID, presentationLines: [] };
    const precio = (salePrice: string) => contrato.orderLineInputSchema.safeParse({ ...receta, salePrice });

    const vacio = precio('');
    expect(vacio.success && vacio.data.salePrice).toBeNull();
    const cero = precio('0');
    expect(cero.success && cero.data.salePrice).toBe('0');
    expect(precio('-1').success).toBe(false);
    expect(precio('1.23456').success).toBe(false);
    expect(precio('abc').success).toBe(false);
  });
});

// Los casos de uso siguen rechazando exactamente lo que dicen los predicados publicados.

function deleteConUnaLinea(status: OrderLineStatus) {
  const pedido = fakeOrderRow({ id: ORDER_ID, recipeId: RECETA, status });
  const linea = orderLineOf(pedido, { status });
  const softDeleteAlive = vi.fn(async () => 'ok' as const);
  const { unitOfWork } = fakeUnitOfWork({
    orders: {
      lockAliveLines: vi.fn(async () => ({ order: { ...pedido, reservedAt: null }, lines: [linea] })),
      softDeleteAlive,
      setLineReservedAt: vi.fn(async () => undefined),
    },
    reservations: { releaseForLine: vi.fn(async () => undefined) },
  });
  const orders = {
    findAliveById: vi.fn(async () => pedido),
    findAliveLines: vi.fn(async () => [linea]),
  } as unknown as OrderRepository;
  return { remove: createDeleteOrder({ orders, unitOfWork, now: () => new Date() }), softDeleteAlive };
}

function updateConUnaLinea(status: OrderLineStatus) {
  const pedido = fakeOrderRow({ id: ORDER_ID, recipeId: RECETA, unitId: UNIT_ID, status });
  const linea: OrderLineRow = orderLineOf(pedido, {
    id: LINEA,
    recipeId: RECETA,
    originalRecipeId: RECETA,
    status,
    unitId: UNIT_ID,
    quantity: '10.0000',
    cancellationReason: status === 'CANCELADO' ? 'ya no' : null,
  });
  const orders = {
    findAliveById: vi.fn(async () => pedido),
    findAliveLines: vi.fn(async () => [linea]),
  } as unknown as OrderRepository;
  const { unitOfWork: base } = fakeUnitOfWork({});
  const unitOfWork = { ...base, run: vi.fn(base.run) } as typeof base;
  const recipes = {
    findRefsIncludingDeleted: vi.fn(async () => [
      { id: RECETA, name: 'r', ownName: 'r', isUnderReview: false, original: null, isDeleted: false, imageUrl: null },
    ]),
  } as unknown as RecipeCatalog;
  const update = createUpdateOrder({
    orders,
    recipes,
    products: {} as ProductCatalog,
    units: {} as UnitCatalog,
    presentations: {} as PresentationCatalog,
    packaging: fakePackagingCatalog(),
    customerCatalog: fakeCustomerCatalog(),
    unitOfWork,
    now: () => new Date(),
  });
  return { update, run: unitOfWork.run };
}

describe('QT-314 T2 — deleteOrder y updateOrder rechazan lo mismo que los predicados', () => {
  it('R37: deleteOrder responde not_deletable justo en los estados que isDeletableOrder rechaza', async () => {
    for (const status of LINE_STATUSES) {
      const d = deleteConUnaLinea(status);
      const result = await d.remove(ORDER_ID, ACTOR).then(
        () => 'ok',
        (error: unknown) => error,
      );
      if (contrato.isDeletableOrder(status, [{ status }])) {
        expect(result, status).toBe('ok');
      } else {
        expect(result, status).toBeInstanceOf(NotDeletableError);
        expect(d.softDeleteAlive, status).not.toHaveBeenCalled();
      }
    }
  });

  it('R10: updateOrder sin recetas nuevas rechaza con invalid_transition en cada estado que isEditableOrderLineStatus da por no editable', async () => {
    const noEditables = LINE_STATUSES.filter((status) => !contrato.isEditableOrderLineStatus(status));
    expect(noEditables).toHaveLength(7);
    for (const status of noEditables) {
      const e = updateConUnaLinea(status);
      const lines = [{ id: LINEA, recipeId: RECETA, quantity: '10', unitId: UNIT_ID }];
      const result = await e.update(ORDER_ID, { lines }, ACTOR).then(
        () => 'ok',
        (error: unknown) => error,
      );
      expect(result, status).toBeInstanceOf(InvalidTransitionError);
      expect(e.run, status).not.toHaveBeenCalled();
    }
  });
});
