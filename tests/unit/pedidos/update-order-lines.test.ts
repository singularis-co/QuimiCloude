// QT-313 T10 — edicion de un pedido con varias lineas, con dobles de los puertos.

import { describe, expect, it, vi } from 'vitest';

import {
  InvalidTransitionError,
  OrderLineNotRemovableError,
  OrderNotFoundError,
  OrderWouldBlockError,
  UnauthorizedError,
} from '@/lib/modules/pedidos/domain/errors';
import { createUpdateOrder } from '@/lib/modules/pedidos/domain/update-order';
import { createUpdateOrderPresentationLines } from '@/lib/modules/pedidos/domain/update-order-presentation-lines';
import {
  fakeOrderRow,
  fakeScopeProducts,
  fakeScopeUnits,
  fakeUnitOfWork,
  lineWritingOrders,
  orderLineOf,
} from '@/tests/helpers/order-unit-of-work-double';
import { fakePackagingCatalog } from '@/tests/helpers/packaging-catalog-double';
import { fakeCustomerCatalog } from '@/tests/helpers/customer-catalog-double';

import type { Actor } from '@/lib/modules/pedidos/domain/actor';
import type { OrderLineStatus } from '@/lib/modules/pedidos/domain/order-classification';
import type { OrderLineRow } from '@/lib/modules/pedidos/domain/order-view';
import type { OrderRepository } from '@/lib/modules/pedidos/ports/order-repository';
import type { OrderUnitOfWork } from '@/lib/modules/pedidos/ports/order-unit-of-work';
import type { OrderLineChanges } from '@/lib/modules/pedidos/ports/order-write-repository';
import type { CostingBatch, PresentationCatalog, ProductCatalog, ReservationOutcome } from '@/lib/modules/inventario';
import type { RecipeCatalog, RecipeExecutionLine, RecipeRef } from '@/lib/modules/recetas';
import type { UnitCatalog, UnitConversion } from '@/lib/modules/unidades';

const EMPRESA = '33333333-3333-4333-8333-333333333333';
const ACTOR: Actor = { id: 'admin-a', companyId: EMPRESA, permissions: ['pedidos.consultar', 'pedidos.modificar'] };
const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const RECETA_A = '22222222-2222-4222-8222-222222222222';
const RECETA_B = '55555555-5555-4555-8555-555555555555';
const RECETA_C = '66666666-6666-4666-8666-666666666666';
const LINEA_A = 'a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0';
const LINEA_B = 'b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0';
const LINEA_AJENA = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0';
const UNIT_ID = '77777777-7777-4777-8777-777777777777';
const PRODUCTO = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const LITRO: UnitConversion = { id: 'l', baseUnitId: UNIT_ID, factor: '1' };
const AHORA = new Date('2026-11-04T10:00:00.000Z');
const ANTES = new Date('2026-11-01T10:00:00.000Z');
const SCOPE = { companyId: EMPRESA };

const LINEA_DE_RECETA: RecipeExecutionLine = { productId: PRODUCTO, productName: null, percentage: '100.00' };

function ref(id: string): RecipeRef {
  return { id, name: id, ownName: id, isUnderReview: false, original: null, isDeleted: false, imageUrl: null };
}

function recetas(): RecipeCatalog {
  const refs = new Map([RECETA_A, RECETA_B, RECETA_C].map((id) => [id, ref(id)]));
  return {
    findRefsIncludingDeleted: vi.fn(async (ids: readonly string[]) =>
      ids.flatMap((id) => {
        const found = refs.get(id);
        return found === undefined ? [] : [found];
      }),
    ),
    findExecutionContentById: vi.fn(async (id: string) => ({ id, name: id, isDeleted: false, steps: [], lines: [LINEA_DE_RECETA] })),
  } as unknown as RecipeCatalog;
}

function lote(): CostingBatch {
  return { productId: PRODUCTO, lot: '1', stock: '100', unitCost: '3.0000', unitId: LITRO.id, purchaseDate: '2026-01-01', available: '100' };
}

function catalogos() {
  const findCostingBatches = vi.fn(async () => [lote()]);
  const products = {
    findCostingBatches,
    findRefs: vi.fn(async () => [{ id: PRODUCTO, name: 'p', unitId: LITRO.id, stockByUnit: [], type: 'PRODUCT' }]),
  } as unknown as ProductCatalog;
  const unidades = new Map<string, UnitConversion>([
    [UNIT_ID, { id: UNIT_ID, baseUnitId: null, factor: null }],
    [LITRO.id, LITRO],
  ]);
  const units = {
    findRefs: vi.fn(async (ids: readonly string[]) => ids.flatMap((id) => (unidades.has(id) ? [unidades.get(id)] : []))),
    findRefsSharingBaseInCompany: vi.fn(async () => []),
    findMassVolumeBridge: vi.fn(async () => null),
  } as unknown as UnitCatalog;
  const presentations = { findRefs: vi.fn(async () => []) } as unknown as PresentationCatalog;
  return { products, units, presentations, findCostingBatches };
}

const PEDIDO = fakeOrderRow({ id: ORDER_ID, recipeId: RECETA_A, unitId: UNIT_ID });

function guardada(id: string, recipeId: string, position: number, status: OrderLineStatus, extra: Partial<OrderLineRow> = {}): OrderLineRow {
  return orderLineOf(PEDIDO, {
    id,
    recipeId,
    originalRecipeId: recipeId,
    position,
    status,
    quantity: '10.0000',
    unitId: UNIT_ID,
    ingredientsCost: '30.0000',
    packagingCost: '0.0000',
    reservedAt: ANTES,
    cancellationReason: status === 'CANCELADO' ? 'ya no' : null,
    ...extra,
  });
}

/** Un pedido con estas lineas guardadas; `insuficientes` son los ids de linea que no alcanzan. */
function escenario(
  lineas: readonly OrderLineRow[],
  insuficientes: readonly string[] = [],
  customerCatalog: ReturnType<typeof fakeCustomerCatalog> = fakeCustomerCatalog(),
) {
  const orders = {
    findAliveById: vi.fn(async () => PEDIDO),
    findAliveLines: vi.fn(async () => lineas),
  } as unknown as OrderRepository;
  const escrituras = lineWritingOrders();
  const lockAliveLines = vi.fn(async () => ({ order: PEDIDO, lines: lineas }));
  const syncForLine = vi.fn(
    async (input: { readonly orderLineId: string | null }): Promise<ReservationOutcome> =>
      insuficientes.includes(input.orderLineId ?? '') ? { kind: 'insufficient', productIds: [PRODUCTO] } : { kind: 'reserved' },
  );
  const releaseForLine = vi.fn(async () => undefined);
  const setCustomerAlive = vi.fn(async () => 'ok' as const);
  const uow = fakeUnitOfWork({
    orders: { lockAliveLines, setCustomerAlive, ...escrituras },
    reservations: { syncForLine, releaseForLine },
    products: fakeScopeProducts([{ id: PRODUCTO, name: 'p', unitId: LITRO.id, stockByUnit: [], type: 'PRODUCT' }]),
    units: fakeScopeUnits(),
  });
  const cat = catalogos();
  const update = createUpdateOrder({
    orders,
    recipes: recetas(),
    products: cat.products,
    units: cat.units,
    presentations: cat.presentations,
    packaging: fakePackagingCatalog(),
    customerCatalog,
    unitOfWork: uow.unitOfWork,
    now: () => AHORA,
  });
  return {
    update,
    escrituras,
    syncForLine,
    releaseForLine,
    lockAliveLines,
    setCustomerAlive,
    findCostingBatches: cat.findCostingBatches,
    unitOfWork: uow.unitOfWork,
  };
}

function entrada(id: string | undefined, recipeId: string, quantity = '10', extra: Record<string, unknown> = {}) {
  return { ...(id === undefined ? {} : { id }), recipeId, quantity, unitId: UNIT_ID, ...extra };
}

function cambios(writeLines: ReturnType<typeof vi.fn>): OrderLineChanges {
  return writeLines.mock.calls[0]?.[1] as OrderLineChanges;
}

function sincronizadas(syncForLine: ReturnType<typeof vi.fn>): readonly string[] {
  return syncForLine.mock.calls.map((call) => ((call as unknown[])[0] as { orderLineId: string }).orderLineId);
}

/** Una linea guardada en `BLOQUEADO`: sin coste ni plazo y sin material apartado (QC-138 R5). */
function bloqueada(id: string, recipeId: string, position: number): OrderLineRow {
  return guardada(id, recipeId, position, 'BLOQUEADO', { ingredientsCost: null, packagingCost: null, reservedAt: null });
}

describe('QT-313 T10 — edicion con lineas', () => {
  it('R20: con id edita esa linea, sin id anade una nueva y la que falta se quita', async () => {
    const e = escenario([guardada(LINEA_A, RECETA_A, 0, 'PENDIENTE'), guardada(LINEA_B, RECETA_B, 1, 'PENDIENTE')]);

    await e.update(ORDER_ID, { lines: [entrada(LINEA_A, RECETA_A, '12'), entrada(undefined, RECETA_C)] }, ACTOR);

    const written = cambios(e.escrituras.writeLines);
    expect(written.removedIds).toEqual([LINEA_B]);
    expect(written.edited.map((edit) => [edit.lineId, edit.line.quantity])).toEqual([[LINEA_A, '12']]);
    expect(written.added.map((line) => [line.recipeId, line.status])).toEqual([[RECETA_C, 'PENDIENTE']]);
  });

  it('R21: anadir una linea a un pedido con otra en EN_EMPAQUE la crea PENDIENTE con su material, sin tocar la otra', async () => {
    const e = escenario([guardada(LINEA_A, RECETA_A, 0, 'EN_EMPAQUE')]);

    await e.update(ORDER_ID, { lines: [entrada(LINEA_A, RECETA_A), entrada(undefined, RECETA_B)] }, ACTOR);

    const written = cambios(e.escrituras.writeLines);
    expect(written.edited).toEqual([]);
    expect(written.added).toHaveLength(1);
    expect(e.syncForLine.mock.calls.map((call) => ((call as unknown[])[0] as { orderLineId: string }).orderLineId)).toEqual(['linea-0']);
    expect(e.escrituras.setLineStatus).not.toHaveBeenCalled();
  });

  it('R22: quitar una linea PENDIENTE y otra BLOQUEADO las da de baja y libera su material con quien edita como autor', async () => {
    const e = escenario([
      guardada(LINEA_A, RECETA_A, 0, 'PENDIENTE'),
      guardada(LINEA_B, RECETA_B, 1, 'BLOQUEADO'),
      guardada('c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0', RECETA_C, 2, 'PENDIENTE'),
    ]);

    await e.update(ORDER_ID, { lines: [entrada('c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0', RECETA_C)] }, ACTOR);

    expect(cambios(e.escrituras.writeLines).removedIds).toEqual([LINEA_A, LINEA_B]);
    expect(e.releaseForLine.mock.calls.map((call) => (call as unknown[])[0])).toEqual([
      { orderId: ORDER_ID, orderLineId: LINEA_A, companyId: EMPRESA, reason: 'release', actorId: ACTOR.id, now: AHORA },
      { orderId: ORDER_ID, orderLineId: LINEA_B, companyId: EMPRESA, reason: 'release', actorId: ACTOR.id, now: AHORA },
    ]);
  });

  it('R23: quitar una linea EN_CURSO rechaza con order_line_not_removable sin abrir la transaccion', async () => {
    const e = escenario([guardada(LINEA_A, RECETA_A, 0, 'EN_CURSO'), guardada(LINEA_B, RECETA_B, 1, 'PENDIENTE')]);

    await expect(e.update(ORDER_ID, { lines: [entrada(LINEA_B, RECETA_B)] }, ACTOR)).rejects.toBeInstanceOf(
      OrderLineNotRemovableError,
    );
    expect(e.lockAliveLines).not.toHaveBeenCalled();
  });

  it('R24: cambiar una linea POR_EMPACAR rechaza con invalid_transition; si llega igual, no impide editar la otra', async () => {
    const lineas = [guardada(LINEA_A, RECETA_A, 0, 'POR_EMPACAR'), guardada(LINEA_B, RECETA_B, 1, 'PENDIENTE')];
    const rechazo = escenario(lineas);
    await expect(
      rechazo.update(ORDER_ID, { lines: [entrada(LINEA_A, RECETA_A, '11'), entrada(LINEA_B, RECETA_B)] }, ACTOR),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
    expect(rechazo.lockAliveLines).not.toHaveBeenCalled();

    const sinCambios = escenario(lineas);
    await sinCambios.update(ORDER_ID, { lines: [entrada(LINEA_A, RECETA_A), entrada(LINEA_B, RECETA_B, '15')] }, ACTOR);
    expect(cambios(sinCambios.escrituras.writeLines).edited.map((edit) => edit.lineId)).toEqual([LINEA_B]);
  });

  it('R17, R25, R41: solo la linea cambiada recalcula coste, aparta y estrena plazo; la otra no se toca', async () => {
    const e = escenario([guardada(LINEA_A, RECETA_A, 0, 'PENDIENTE'), guardada(LINEA_B, RECETA_B, 1, 'PENDIENTE')]);

    await e.update(ORDER_ID, { lines: [entrada(LINEA_A, RECETA_A), entrada(LINEA_B, RECETA_B, '20')] }, ACTOR);

    const written = cambios(e.escrituras.writeLines);
    expect(written.edited.map((edit) => [edit.lineId, edit.cost])).toEqual([[LINEA_B, { total: '60.0000', packaging: '0.0000' }]]);
    expect(e.syncForLine.mock.calls.map((call) => ((call as unknown[])[0] as { orderLineId: string }).orderLineId)).toEqual([LINEA_B]);
    expect(e.escrituras.setLineReservedAt.mock.calls).toEqual([[ORDER_ID, LINEA_B, AHORA, SCOPE]]);
    // Lo apartado por esa linea cuenta como suyo al costearla.
    expect(e.findCostingBatches).toHaveBeenCalledWith([PRODUCTO], EMPRESA, { excludeOrderLineId: LINEA_B });
  });

  it('R25: la linea cambiada que no alcanza pasa a BLOQUEADO sin coste ni plazo con confirmacion; la otra sigue igual', async () => {
    const e = escenario([guardada(LINEA_A, RECETA_A, 0, 'PENDIENTE'), guardada(LINEA_B, RECETA_B, 1, 'PENDIENTE')], [LINEA_B]);

    await e.update(
      ORDER_ID,
      { lines: [entrada(LINEA_A, RECETA_A), entrada(LINEA_B, RECETA_B, '99')], confirmBlocked: true },
      ACTOR,
    );

    expect(e.escrituras.setLineStatus.mock.calls).toEqual([[ORDER_ID, LINEA_B, 'PENDIENTE', 'BLOQUEADO', ACTOR.id, AHORA, SCOPE]]);
    expect(e.escrituras.setLineIngredientsCost.mock.calls).toEqual([[ORDER_ID, LINEA_B, null, ACTOR.id, AHORA, SCOPE]]);
    expect(e.escrituras.setLineReservedAt.mock.calls).toEqual([[ORDER_ID, LINEA_B, null, SCOPE]]);
  });

  it('R4: volver a anadir la receta de una linea cancelada se admite', async () => {
    const e = escenario([guardada(LINEA_A, RECETA_A, 0, 'CANCELADO'), guardada(LINEA_B, RECETA_B, 1, 'PENDIENTE')]);

    await e.update(ORDER_ID, { lines: [entrada(LINEA_B, RECETA_B), entrada(undefined, RECETA_A)] }, ACTOR);

    expect(cambios(e.escrituras.writeLines).added.map((line) => line.originalRecipeId)).toEqual([RECETA_A]);
  });

  it('R43: una linea de otro pedido, de otra empresa o quitada responde order_not_found sin escribir', async () => {
    const e = escenario([guardada(LINEA_A, RECETA_A, 0, 'PENDIENTE')]);

    await expect(e.update(ORDER_ID, { lines: [entrada(LINEA_AJENA, RECETA_A)] }, ACTOR)).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
    expect(e.lockAliveLines).not.toHaveBeenCalled();
  });

  it('R30: sin pedidos.modificar responde unauthorized sin leer el pedido', async () => {
    const e = escenario([guardada(LINEA_A, RECETA_A, 0, 'PENDIENTE')]);
    const sinPermiso: Actor = { ...ACTOR, permissions: ['pedidos.consultar'] };

    await expect(e.update(ORDER_ID, { lines: [] }, sinPermiso)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(e.lockAliveLines).not.toHaveBeenCalled();
  });

  it('R34: la edicion vuelve a derivar el estado del pedido y copia en el la linea de menor posicion', async () => {
    const e = escenario([guardada(LINEA_A, RECETA_A, 0, 'PENDIENTE')]);

    await e.update(ORDER_ID, { lines: [entrada(LINEA_A, RECETA_A, '12')], priority: 'ALTA' }, ACTOR);

    expect(e.escrituras.updateAlive).toHaveBeenCalledWith(ORDER_ID, { priority: 'ALTA', customerId: null }, ACTOR.id, AHORA, SCOPE);
    expect(e.escrituras.refreshStatus).toHaveBeenCalledWith(ORDER_ID, ACTOR.id, AHORA, SCOPE);
  });
});

describe('QT-313 T10 — reparto de una linea', () => {
  function repartoDe(lineas: readonly OrderLineRow[]) {
    const escrituras = lineWritingOrders();
    const lockAliveLine = vi.fn(async (_orderId: string, lineId: string) => {
      const line = lineas.find((item) => item.id === lineId);
      return line === undefined ? null : { order: PEDIDO, line };
    });
    const syncForLine = vi.fn(async (): Promise<ReservationOutcome> => ({ kind: 'reserved' }));
    const uow = fakeUnitOfWork({ orders: { lockAliveLine, ...escrituras }, reservations: { syncForLine } });
    const cat = catalogos();
    const run = createUpdateOrderPresentationLines({
      recipes: recetas(),
      products: cat.products,
      packaging: fakePackagingCatalog(),
      presentations: cat.presentations,
      units: cat.units,
      unitOfWork: uow.unitOfWork as OrderUnitOfWork,
      now: () => AHORA,
    });
    return { run, escrituras, syncForLine };
  }

  it('R26: editar el reparto y la unidad de una linea POR_EMPACAR escribe solo esa linea y aparta solo lo suyo', async () => {
    const e = repartoDe([guardada(LINEA_A, RECETA_A, 0, 'POR_EMPACAR'), guardada(LINEA_B, RECETA_B, 1, 'PENDIENTE')]);

    const result = await e.run(ORDER_ID, ACTOR, { lineId: LINEA_A, unitId: UNIT_ID, lines: [] });

    expect(result).toBe('ok');
    const written = cambios(e.escrituras.writeLines);
    expect(written.edited.map((edit) => [edit.lineId, edit.cost])).toEqual([[LINEA_A, 'keep']]);
    expect(written.added).toEqual([]);
    expect(written.removedIds).toEqual([]);
    expect(e.syncForLine.mock.calls.map((call) => ((call as unknown[])[0] as { orderLineId: string }).orderLineId)).toEqual([LINEA_A]);
  });

  it('R26, R43: una linea que no es del pedido responde not_found sin escribir', async () => {
    const e = repartoDe([guardada(LINEA_A, RECETA_A, 0, 'POR_EMPACAR')]);

    expect(await e.run(ORDER_ID, ACTOR, { lineId: LINEA_AJENA, unitId: UNIT_ID, lines: [] })).toBe('not_found');
    expect(e.escrituras.writeLines).not.toHaveBeenCalled();
  });
});

describe('QT-313 T16b — reintento de reserva de las lineas BLOQUEADO al editar', () => {
  const CLIENTE = '88888888-8888-4888-8888-888888888888';

  function clienteVivo(): ReturnType<typeof fakeCustomerCatalog> {
    const clientes = fakeCustomerCatalog();
    clientes.findAliveRefById.mockResolvedValue({ id: CLIENTE, firstNames: 'Ana', lastNames: 'Diaz', isDeleted: false });
    return clientes;
  }

  it('R56, R41: una linea BLOQUEADO que llega igual y ya alcanza pasa a PENDIENTE con su coste y el plazo de ahora', async () => {
    const e = escenario([bloqueada(LINEA_A, RECETA_A, 0)]);

    await e.update(ORDER_ID, { lines: [entrada(LINEA_A, RECETA_A)] }, ACTOR);

    expect(sincronizadas(e.syncForLine)).toEqual([LINEA_A]);
    // Sus datos no cambian: no se reescribe.
    expect(cambios(e.escrituras.writeLines).edited).toEqual([]);
    expect(e.escrituras.setLineStatus.mock.calls).toEqual([[ORDER_ID, LINEA_A, 'BLOQUEADO', 'PENDIENTE', ACTOR.id, AHORA, SCOPE]]);
    expect(e.escrituras.setLineIngredientsCost.mock.calls).toEqual([
      [ORDER_ID, LINEA_A, { total: '30.0000', packaging: '0.0000' }, ACTOR.id, AHORA, SCOPE],
    ]);
    expect(e.escrituras.setLineReservedAt.mock.calls).toEqual([[ORDER_ID, LINEA_A, AHORA, SCOPE]]);
    expect(e.escrituras.refreshStatus).toHaveBeenCalledWith(ORDER_ID, ACTOR.id, AHORA, SCOPE);
  });

  it('R56: una linea BLOQUEADO que sigue sin alcanzar rechaza con order_would_block sin escribir; con confirmacion sigue BLOQUEADO sin plazo', async () => {
    const sinConfirmar = escenario([bloqueada(LINEA_A, RECETA_A, 0)], [LINEA_A]);
    await expect(sinConfirmar.update(ORDER_ID, { lines: [entrada(LINEA_A, RECETA_A)] }, ACTOR)).rejects.toBeInstanceOf(
      OrderWouldBlockError,
    );
    expect(sincronizadas(sinConfirmar.syncForLine)).toEqual([LINEA_A]);
    expect(sinConfirmar.escrituras.setLineStatus).not.toHaveBeenCalled();
    expect(sinConfirmar.escrituras.setLineIngredientsCost).not.toHaveBeenCalled();
    expect(sinConfirmar.escrituras.setLineReservedAt).not.toHaveBeenCalled();
    expect(sinConfirmar.escrituras.updateAlive).not.toHaveBeenCalled();
    expect(sinConfirmar.escrituras.refreshStatus).not.toHaveBeenCalled();

    const confirmado = escenario([bloqueada(LINEA_A, RECETA_A, 0)], [LINEA_A]);
    await confirmado.update(ORDER_ID, { lines: [entrada(LINEA_A, RECETA_A)], confirmBlocked: true }, ACTOR);
    // El estado guardado ya es BLOQUEADO: no se mueve.
    expect(confirmado.escrituras.setLineStatus).not.toHaveBeenCalled();
    expect(confirmado.escrituras.setLineIngredientsCost.mock.calls).toEqual([[ORDER_ID, LINEA_A, null, ACTOR.id, AHORA, SCOPE]]);
    expect(confirmado.escrituras.setLineReservedAt.mock.calls).toEqual([[ORDER_ID, LINEA_A, null, SCOPE]]);
    expect(confirmado.escrituras.refreshStatus).toHaveBeenCalledWith(ORDER_ID, ACTOR.id, AHORA, SCOPE);
  });

  it('R56, R25: con una linea PENDIENTE y otra BLOQUEADO sin cambios, solo la bloqueada reintenta; la PENDIENTE no cambia de material ni de plazo', async () => {
    const e = escenario([guardada(LINEA_A, RECETA_A, 0, 'PENDIENTE'), bloqueada(LINEA_B, RECETA_B, 1)]);

    await e.update(ORDER_ID, { lines: [entrada(LINEA_A, RECETA_A), entrada(LINEA_B, RECETA_B)] }, ACTOR);

    expect(sincronizadas(e.syncForLine)).toEqual([LINEA_B]);
    expect(cambios(e.escrituras.writeLines).edited).toEqual([]);
    expect(e.escrituras.setLineStatus.mock.calls).toEqual([[ORDER_ID, LINEA_B, 'BLOQUEADO', 'PENDIENTE', ACTOR.id, AHORA, SCOPE]]);
    expect(e.escrituras.setLineIngredientsCost.mock.calls.map((call) => (call as unknown[])[1])).toEqual([LINEA_B]);
    expect(e.escrituras.setLineReservedAt.mock.calls).toEqual([[ORDER_ID, LINEA_B, AHORA, SCOPE]]);
  });

  it('R56: la que reintenta aparta por su posicion, entre las editadas y delante de las nuevas', async () => {
    const e = escenario([guardada(LINEA_A, RECETA_A, 0, 'PENDIENTE'), bloqueada(LINEA_B, RECETA_B, 1)]);

    await e.update(
      ORDER_ID,
      { lines: [entrada(undefined, RECETA_C), entrada(LINEA_B, RECETA_B), entrada(LINEA_A, RECETA_A, '12')] },
      ACTOR,
    );

    expect(sincronizadas(e.syncForLine)).toEqual([LINEA_A, LINEA_B, 'linea-0']);
    expect(cambios(e.escrituras.writeLines).edited.map((edit) => edit.lineId)).toEqual([LINEA_A]);
  });

  it('R56: cambiar solo el cliente con una linea BLOQUEADO va por el camino completo y reintenta su reserva', async () => {
    const e = escenario([bloqueada(LINEA_A, RECETA_A, 0)], [], clienteVivo());

    await e.update(ORDER_ID, { lines: [entrada(LINEA_A, RECETA_A)], customerId: CLIENTE }, ACTOR);

    expect(e.setCustomerAlive).not.toHaveBeenCalled();
    expect(sincronizadas(e.syncForLine)).toEqual([LINEA_A]);
    expect(e.escrituras.setLineStatus.mock.calls).toEqual([[ORDER_ID, LINEA_A, 'BLOQUEADO', 'PENDIENTE', ACTOR.id, AHORA, SCOPE]]);
    expect(e.escrituras.updateAlive).toHaveBeenCalledWith(
      ORDER_ID,
      { priority: PEDIDO.priority, customerId: CLIENTE },
      ACTOR.id,
      AHORA,
      SCOPE,
    );
  });

  it('R56: cambiar solo el cliente sin lineas BLOQUEADO sigue escribiendo solo el cliente', async () => {
    const e = escenario([guardada(LINEA_A, RECETA_A, 0, 'PENDIENTE')], [], clienteVivo());

    await e.update(ORDER_ID, { lines: [entrada(LINEA_A, RECETA_A)], customerId: CLIENTE }, ACTOR);

    expect(e.setCustomerAlive).toHaveBeenCalledTimes(1);
    expect(e.lockAliveLines).not.toHaveBeenCalled();
    expect(e.syncForLine).not.toHaveBeenCalled();
  });
});
