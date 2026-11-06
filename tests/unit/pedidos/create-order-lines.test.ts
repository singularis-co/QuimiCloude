// QT-313 T9 — alta de un pedido con varias lineas, con dobles de los puertos.

import { describe, expect, it, vi } from 'vitest';

import { createCreateOrder } from '@/lib/modules/pedidos/domain/create-order';
import {
  DuplicateOrderRecipeError,
  OrderWouldBlockError,
  PedidosError,
  RecipeNotFoundError,
  UnauthorizedError,
} from '@/lib/modules/pedidos/domain/errors';
import { createErrorStateTranslator } from '@/lib/modules/errores';
import { fakeScopeProducts, fakeScopeUnits, fakeUnitOfWork, lineWritingOrders, type SingleRecipeOrderRow } from '@/tests/helpers/order-unit-of-work-double';
import { fakePackagingCatalog } from '@/tests/helpers/packaging-catalog-double';
import { fakeCustomerCatalog } from '@/tests/helpers/customer-catalog-double';

import type { Actor } from '@/lib/modules/pedidos/domain/actor';
import type { OrderLineChanges } from '@/lib/modules/pedidos/ports/order-write-repository';
import type { OrderUnitOfWork } from '@/lib/modules/pedidos/ports/order-unit-of-work';
import type { CostingBatch, PresentationCatalog, ProductCatalog, ReservationOutcome } from '@/lib/modules/inventario';
import type { RecipeCatalog, RecipeExecutionLine, RecipeRef } from '@/lib/modules/recetas';
import type { UnitCatalog, UnitConversion } from '@/lib/modules/unidades';

const EMPRESA = '33333333-3333-4333-8333-333333333333';
const ACTOR: Actor = { id: 'admin-a', companyId: EMPRESA, permissions: ['pedidos.consultar', 'pedidos.modificar'] };
const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const RECETA_A = '22222222-2222-4222-8222-222222222222';
const RECETA_B = '55555555-5555-4555-8555-555555555555';
const VERSION_DE_A = 'a5a5a5a5-a5a5-4a5a-8a5a-a5a5a5a5a5a5';
const RECETA_AJENA = '99999999-9999-4999-8999-999999999999';
const UNIT_ID = '77777777-7777-4777-8777-777777777777';
const PRODUCTO = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const LITRO: UnitConversion = { id: 'l', baseUnitId: UNIT_ID, factor: '1' };
const AHORA = new Date('2026-11-04T10:00:00.000Z');

function ref(id: string, original: RecipeRef['original'] = null): RecipeRef {
  return { id, name: id, ownName: id, isUnderReview: false, original, isDeleted: false, imageUrl: null };
}

const LINEA_DE_RECETA: RecipeExecutionLine = { productId: PRODUCTO, productName: null, percentage: '100.00' };

function recetas(): { recipes: RecipeCatalog; findRefsIncludingDeleted: ReturnType<typeof vi.fn> } {
  const refs = new Map<string, RecipeRef>([
    [RECETA_A, ref(RECETA_A)],
    [RECETA_B, ref(RECETA_B)],
    [VERSION_DE_A, ref(VERSION_DE_A, { id: RECETA_A, name: RECETA_A })],
  ]);
  const findRefsIncludingDeleted = vi.fn(async (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const found = refs.get(id);
      return found === undefined ? [] : [found];
    }),
  );
  const findExecutionContentById = vi.fn(async (id: string) => ({
    id,
    name: id,
    isDeleted: false,
    steps: [],
    lines: [LINEA_DE_RECETA],
  }));
  return {
    recipes: { findRefsIncludingDeleted, findExecutionContentById } as unknown as RecipeCatalog,
    findRefsIncludingDeleted,
  };
}

function lote(overrides: Partial<CostingBatch> = {}): CostingBatch {
  return {
    productId: PRODUCTO,
    lot: '1',
    stock: '100',
    unitCost: '3.0000',
    unitId: LITRO.id,
    purchaseDate: '2026-01-01',
    available: '100',
    ...overrides,
  };
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

function filaCreada(): SingleRecipeOrderRow {
  return {
    id: ORDER_ID,
    number: { year: 2026, sequence: 1 },
    recipeId: RECETA_A,
    quantity: '10.0000',
    priority: 'BAJA',
    status: 'PENDIENTE',
    cancellationReason: null,
    ingredientsCost: null,
    packagingCost: null,
    actualCost: null,
    salePrice: null,
    createdAt: AHORA,
    updatedAt: AHORA,
    createdBy: ACTOR.id,
    updatedBy: ACTOR.id,
    presentationLines: [],
    unitId: UNIT_ID,
    customerId: null,
  };
}

/** Escenario: las lineas que no alcanzan se dan por su posicion en la entrada. */
function escenario(insuficientes: readonly number[] = []) {
  const orden: string[] = [];
  const lineas = lineWritingOrders();
  const create = vi.fn(async () => {
    orden.push('create');
    return filaCreada();
  });
  let llamada = 0;
  const syncForLine = vi.fn(async (input: { readonly orderLineId: string | null }): Promise<ReservationOutcome> => {
    const position = llamada;
    llamada += 1;
    orden.push(`sync:${String(input.orderLineId)}`);
    return insuficientes.includes(position)
      ? { kind: 'insufficient', productIds: [PRODUCTO] }
      : { kind: 'reserved' };
  });
  const uow = fakeUnitOfWork({
    orders: { create, ...lineas },
    reservations: { syncForLine },
    products: fakeScopeProducts([{ id: PRODUCTO, name: 'p', unitId: LITRO.id, stockByUnit: [], type: 'PRODUCT' }]),
    units: fakeScopeUnits([
      { id: UNIT_ID, name: 'kg', symbol: 'kg', baseUnitId: null, factor: null, companyId: null },
      { id: LITRO.id, name: 'l', symbol: 'l', baseUnitId: UNIT_ID, factor: '1', companyId: null },
    ] as never),
  });
  return { ...uow, create, syncForLine, lineas, orden };
}

function alta(unitOfWork: OrderUnitOfWork, cat = recetas(), otros = catalogos()) {
  return createCreateOrder({
    recipes: cat.recipes,
    products: otros.products,
    units: otros.units,
    presentations: otros.presentations,
    packaging: fakePackagingCatalog(),
    customerCatalog: fakeCustomerCatalog(),
    unitOfWork,
    now: () => AHORA,
  });
}

function linea(recipeId: string, quantity = '10', extra: Record<string, unknown> = {}) {
  return { recipeId, quantity, unitId: UNIT_ID, ...extra };
}

function anadidas(writeLines: ReturnType<typeof vi.fn>): OrderLineChanges['added'] {
  return (writeLines.mock.calls[0]?.[1] as OrderLineChanges).added;
}

/** El traductor de las acciones, con un registro mudo: el diagnostico va ahi y no a la respuesta. */
const toErrorState = createErrorStateTranslator(PedidosError, async () => null, () => undefined);

describe('QT-313 T9 — alta con lineas', () => {
  it('R10, R17: un alta de dos lineas crea el pedido y sus dos lineas, cada una con su coste, en una sola transaccion', async () => {
    const e = escenario();
    const run = vi.fn((work: Parameters<OrderUnitOfWork['run']>[0]) => e.unitOfWork.run(work));

    await alta({ run } as unknown as OrderUnitOfWork)({ lines: [linea(RECETA_A, '10'), linea(RECETA_B, '20')] }, ACTOR);

    expect(run).toHaveBeenCalledTimes(1);
    expect(e.create).toHaveBeenCalledTimes(1);
    const added = anadidas(e.lineas.writeLines);
    expect(added.map((line) => [line.recipeId, line.quantity, line.status])).toEqual([
      [RECETA_A, '10', 'PENDIENTE'],
      [RECETA_B, '20', 'PENDIENTE'],
    ]);
    // 10 y 20 de un insumo a 3.0000: cada linea con lo suyo.
    expect(added.map((line) => line.cost?.total)).toEqual(['30.0000', '60.0000']);
  });

  it('R12, R41: aparta linea a linea en su orden y fija reserved_at de cada linea que aparto', async () => {
    const e = escenario();

    await alta(e.unitOfWork)({ lines: [linea(RECETA_A), linea(RECETA_B)] }, ACTOR);

    expect(e.orden).toEqual(['create', 'sync:linea-0', 'sync:linea-1']);
    expect(e.lineas.setLineReservedAt.mock.calls).toEqual([
      [ORDER_ID, 'linea-0', AHORA, { companyId: EMPRESA }],
      [ORDER_ID, 'linea-1', AHORA, { companyId: EMPRESA }],
    ]);
  });

  it('R34, R1: deriva el estado del pedido de sus lineas y el pedido solo lleva su cabecera', async () => {
    const e = escenario();

    await alta(e.unitOfWork)({ lines: [linea(RECETA_A), linea(RECETA_B)] }, ACTOR);

    expect(e.lineas.refreshStatus).toHaveBeenCalledWith(ORDER_ID, ACTOR.id, AHORA, { companyId: EMPRESA });
    // Receta, cantidad, reparto, precio y coste van solo en las lineas.
    expect((e.create.mock.calls[0] as unknown as readonly [unknown])[0]).toEqual({ priority: 'BAJA', status: 'PENDIENTE', customerId: null });
  });

  it('R13: si una linea no alcanza y no se confirma, rechaza con order_would_block, sin campos nuevos y con la posicion en el diagnostico', async () => {
    const e = escenario([1]);

    const error = await alta(e.unitOfWork)({ lines: [linea(RECETA_A), linea(RECETA_B)] }, ACTOR).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(OrderWouldBlockError);
    expect((error as OrderWouldBlockError).diagnostic).toContain('posiciones 1');
    const state = await toErrorState(error);
    expect(Object.keys(state).sort()).toEqual(Object.keys(await toErrorState(new OrderWouldBlockError())).sort());
    expect(JSON.stringify(state)).not.toContain('posicion');
    // Lanzar deshace la transaccion: no se llega a bloquear ni a derivar nada.
    expect(e.lineas.setLineStatus).not.toHaveBeenCalled();
    expect(e.lineas.refreshStatus).not.toHaveBeenCalled();
  });

  it('R14: con confirmacion, solo la linea que no alcanza queda BLOQUEADO, sin apartado ni coste; la otra PENDIENTE con su plazo', async () => {
    const e = escenario([0]);

    await alta(e.unitOfWork)({ lines: [linea(RECETA_A), linea(RECETA_B)], confirmBlocked: true }, ACTOR);

    expect(e.lineas.setLineStatus.mock.calls).toEqual([
      [ORDER_ID, 'linea-0', 'PENDIENTE', 'BLOQUEADO', ACTOR.id, AHORA, { companyId: EMPRESA }],
    ]);
    expect(e.lineas.setLineIngredientsCost.mock.calls).toEqual([
      [ORDER_ID, 'linea-0', null, ACTOR.id, AHORA, { companyId: EMPRESA }],
    ]);
    expect(e.lineas.setLineReservedAt.mock.calls).toEqual([
      [ORDER_ID, 'linea-0', null, { companyId: EMPRESA }],
      [ORDER_ID, 'linea-1', AHORA, { companyId: EMPRESA }],
    ]);
  });

  it('R4: la original y una version suya en la misma alta rechazan con duplicate_order_recipe sin abrir la transaccion', async () => {
    const e = escenario();
    const run = vi.fn();

    await expect(
      alta({ run } as unknown as OrderUnitOfWork)(
        { lines: [linea(RECETA_A), linea(RECETA_A, '5', { recipeVersionId: VERSION_DE_A })] },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(DuplicateOrderRecipeError);
    expect(run).not.toHaveBeenCalled();
    expect(e.create).not.toHaveBeenCalled();
  });

  it('R11: una segunda linea invalida rechaza el alta entera con el codigo de hoy y su posicion en el diagnostico, sin escribir', async () => {
    const e = escenario();

    const error = await alta(e.unitOfWork)({ lines: [linea(RECETA_A), linea(RECETA_AJENA)] }, ACTOR).catch(
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(RecipeNotFoundError);
    expect((error as RecipeNotFoundError).code).toBe('recipe_not_found');
    expect((error as RecipeNotFoundError).diagnostic).toContain('posicion 1');
    expect(Object.keys(await toErrorState(error)).sort()).toEqual(
      Object.keys(await toErrorState(new RecipeNotFoundError())).sort(),
    );
    expect(e.create).not.toHaveBeenCalled();
  });

  it('R10: si falla la segunda linea dentro de la transaccion, el error sube y la unidad de trabajo no confirma nada', async () => {
    const e = escenario();
    e.lineas.setLineReservedAt.mockImplementationOnce(async () => undefined).mockRejectedValueOnce(new Error('caida'));
    let committed = false;
    const unitOfWork: OrderUnitOfWork = {
      run: async (work) => {
        const result = await e.unitOfWork.run(work);
        committed = true;
        return result;
      },
    };

    await expect(alta(unitOfWork)({ lines: [linea(RECETA_A), linea(RECETA_B)] }, ACTOR)).rejects.toThrow('caida');
    expect(committed).toBe(false);
  });

  it('R30: sin pedidos.modificar responde unauthorized sin validar la entrada ni tocar ningun puerto', async () => {
    const explota = vi.fn(() => {
      throw new Error('no deberia llamarse');
    });
    const create = createCreateOrder({
      recipes: { findRefsIncludingDeleted: explota, findExecutionContentById: explota } as unknown as RecipeCatalog,
      products: { findCostingBatches: explota, findRefs: explota } as unknown as ProductCatalog,
      units: { findRefs: explota, findMassVolumeBridge: explota } as unknown as UnitCatalog,
      presentations: { findRefs: explota } as unknown as PresentationCatalog,
      packaging: fakePackagingCatalog(),
      customerCatalog: { findAliveRefById: explota },
      unitOfWork: { run: explota } as unknown as OrderUnitOfWork,
    });

    await expect(create({ lines: 'no es una lista' }, { ...ACTOR, permissions: ['pedidos.consultar'] })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(explota).not.toHaveBeenCalled();
  });

  it('R42: la prioridad y el cliente son del pedido; si llegan en una linea se descartan', async () => {
    const e = escenario();

    await alta(e.unitOfWork)(
      { lines: [linea(RECETA_A, '10', { priority: 'ALTA', customerId: 'otro' })], priority: 'MEDIA' },
      ACTOR,
    );

    const data = (e.create.mock.calls[0] as unknown as readonly [{ priority: string; customerId: string | null }])[0];
    expect(data.priority).toBe('MEDIA');
    expect(data.customerId).toBeNull();
    expect(anadidas(e.lineas.writeLines)[0]).not.toHaveProperty('priority');
  });
});
