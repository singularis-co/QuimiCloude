// QT-314 T3 — las posiciones de las recetas que hacen fallar un alta o una edicion, como dato.
//
// Cada regla de receta se prueba con un pedido de tres recetas en el que falla la segunda, o la
// segunda y la tercera. La posicion es el indice en `lines` de la entrada enviada.

import { describe, expect, it, vi } from 'vitest';

import { createCreateOrder } from '@/lib/modules/pedidos/domain/create-order';
import {
  DuplicateOrderRecipeError,
  InsufficientMaterialError,
  InvalidTransitionError,
  OrderNotFoundError,
  OrderWouldBlockError,
  PedidosError,
  RecipeNotFoundError,
  linePositionsOf,
} from '@/lib/modules/pedidos/domain/errors';
import { assertNoDuplicateOrderRecipe, atLinePosition } from '@/lib/modules/pedidos/domain/order-line-diff';
import { createUpdateOrder } from '@/lib/modules/pedidos/domain/update-order';
import { linePositionsOf as linePositionsOfDelContrato } from '@/lib/modules/pedidos';
import { createErrorStateTranslator, errorMessage, type ErrorCode } from '@/lib/modules/errores';
import {
  fakeOrderRow,
  fakeScopeProducts,
  fakeScopeUnits,
  fakeUnitOfWork,
  lineWritingOrders,
  orderLineOf,
  type SingleRecipeOrderRow,
} from '@/tests/helpers/order-unit-of-work-double';
import { fakePackagingCatalog } from '@/tests/helpers/packaging-catalog-double';
import { fakeCustomerCatalog } from '@/tests/helpers/customer-catalog-double';

import type { Actor } from '@/lib/modules/pedidos/domain/actor';
import type { OrderLineStatus } from '@/lib/modules/pedidos/domain/order-classification';
import type { OrderLineRow } from '@/lib/modules/pedidos/domain/order-view';
import type { OrderRepository } from '@/lib/modules/pedidos/ports/order-repository';
import type { CostingBatch, PresentationCatalog, ProductCatalog, ReservationOutcome } from '@/lib/modules/inventario';
import type { RecipeCatalog, RecipeExecutionLine, RecipeRef } from '@/lib/modules/recetas';
import type { UnitCatalog, UnitConversion } from '@/lib/modules/unidades';

const EMPRESA = '33333333-3333-4333-8333-333333333333';
const ACTOR: Actor = { id: 'admin-a', companyId: EMPRESA, permissions: ['pedidos.consultar', 'pedidos.modificar'] };
const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const RECETA_A = '22222222-2222-4222-8222-222222222222';
const RECETA_B = '55555555-5555-4555-8555-555555555555';
const RECETA_C = '66666666-6666-4666-8666-666666666666';
const VERSION_DE_B = 'b5b5b5b5-b5b5-4b5b-8b5b-b5b5b5b5b5b5';
const RECETA_AJENA = '99999999-9999-4999-8999-999999999999';
const LINEA_A = 'a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0';
const LINEA_B = 'b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0';
const LINEA_C = 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0';
const UNIT_ID = '77777777-7777-4777-8777-777777777777';
const PRODUCTO = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const LITRO: UnitConversion = { id: 'l', baseUnitId: UNIT_ID, factor: '1' };
const AHORA = new Date('2026-11-04T10:00:00.000Z');
const ANTES = new Date('2026-11-01T10:00:00.000Z');

const LINEA_DE_RECETA: RecipeExecutionLine = { productId: PRODUCTO, productName: null, percentage: '100.00' };

function ref(id: string, original: RecipeRef['original'] = null): RecipeRef {
  return { id, name: id, ownName: id, isUnderReview: false, original, isDeleted: false, imageUrl: null };
}

function recetas(): RecipeCatalog {
  const refs = new Map<string, RecipeRef>([
    [RECETA_A, ref(RECETA_A)],
    [RECETA_B, ref(RECETA_B)],
    [RECETA_C, ref(RECETA_C)],
    [VERSION_DE_B, ref(VERSION_DE_B, { id: RECETA_B, name: RECETA_B })],
  ]);
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
  const products = {
    findCostingBatches: vi.fn(async () => [lote()]),
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
  return { products, units, presentations };
}

/** El traductor de las acciones, con un registro mudo. */
const toErrorState = createErrorStateTranslator(PedidosError, async () => null, () => undefined);

/** Lo que ve el borde: el estado traducido de hoy, y las posiciones que la accion le anadira. */
async function respuesta(error: unknown, code: ErrorCode) {
  const state = await toErrorState(error);
  expect(state).toEqual({ status: 'error', code, message: errorMessage(code) });
  // Ni el diagnostico ni las posiciones se cuelan en el estado traducido.
  expect(JSON.stringify(state)).not.toContain('posicion');
  return linePositionsOf(error);
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

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

/** Un alta; `insuficientes` son las posiciones de la entrada a las que no les alcanza. */
function alta(insuficientes: readonly number[] = []) {
  let llamada = 0;
  const syncForLine = vi.fn(async (): Promise<ReservationOutcome> => {
    const position = llamada;
    llamada += 1;
    return insuficientes.includes(position) ? { kind: 'insufficient', productIds: [PRODUCTO] } : { kind: 'reserved' };
  });
  const uow = fakeUnitOfWork({
    orders: { create: vi.fn(async () => filaCreada()), ...lineWritingOrders() },
    reservations: { syncForLine },
    products: fakeScopeProducts([{ id: PRODUCTO, name: 'p', unitId: LITRO.id, stockByUnit: [], type: 'PRODUCT' }]),
    units: fakeScopeUnits([
      { id: UNIT_ID, name: 'kg', symbol: 'kg', baseUnitId: null, factor: null, companyId: null },
      { id: LITRO.id, name: 'l', symbol: 'l', baseUnitId: UNIT_ID, factor: '1', companyId: null },
    ] as never),
  });
  const cat = catalogos();
  return createCreateOrder({
    recipes: recetas(),
    products: cat.products,
    units: cat.units,
    presentations: cat.presentations,
    packaging: fakePackagingCatalog(),
    customerCatalog: fakeCustomerCatalog(),
    unitOfWork: uow.unitOfWork,
    now: () => AHORA,
  });
}

function linea(recipeId: string, quantity = '10', extra: Record<string, unknown> = {}) {
  return { recipeId, quantity, unitId: UNIT_ID, ...extra };
}

// ---------------------------------------------------------------------------
// Edicion
// ---------------------------------------------------------------------------

const PEDIDO = fakeOrderRow({ id: ORDER_ID, recipeId: RECETA_A, unitId: UNIT_ID });

function guardada(id: string, recipeId: string, position: number, status: OrderLineStatus): OrderLineRow {
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
    cancellationReason: null,
  });
}

/** Una edicion de un pedido con estas lineas; `insuficientes` son los ids de linea que no alcanzan
 *  (`linea-0` es la primera nueva). */
function edicion(lineas: readonly OrderLineRow[], insuficientes: readonly string[] = []) {
  const orders = {
    findAliveById: vi.fn(async () => PEDIDO),
    findAliveLines: vi.fn(async () => lineas),
  } as unknown as OrderRepository;
  const uow = fakeUnitOfWork({
    orders: {
      lockAliveLines: vi.fn(async () => ({ order: PEDIDO, lines: lineas })),
      setCustomerAlive: vi.fn(async () => 'ok' as const),
      ...lineWritingOrders(),
    },
    reservations: {
      syncForLine: vi.fn(
        async (input: { readonly orderLineId: string | null }): Promise<ReservationOutcome> =>
          insuficientes.includes(input.orderLineId ?? '') ? { kind: 'insufficient', productIds: [PRODUCTO] } : { kind: 'reserved' },
      ),
      releaseForLine: vi.fn(async () => undefined),
    },
    products: fakeScopeProducts([{ id: PRODUCTO, name: 'p', unitId: LITRO.id, stockByUnit: [], type: 'PRODUCT' }]),
    units: fakeScopeUnits(),
  });
  const cat = catalogos();
  return createUpdateOrder({
    orders,
    recipes: recetas(),
    products: cat.products,
    units: cat.units,
    presentations: cat.presentations,
    packaging: fakePackagingCatalog(),
    customerCatalog: fakeCustomerCatalog(),
    unitOfWork: uow.unitOfWork,
    now: () => AHORA,
  });
}

function entrada(id: string | undefined, recipeId: string, quantity = '10', extra: Record<string, unknown> = {}) {
  return { ...(id === undefined ? {} : { id }), recipeId, quantity, unitId: UNIT_ID, ...extra };
}

const TRES_PENDIENTES = [
  guardada(LINEA_A, RECETA_A, 0, 'PENDIENTE'),
  guardada(LINEA_B, RECETA_B, 1, 'PENDIENTE'),
  guardada(LINEA_C, RECETA_C, 2, 'PENDIENTE'),
];

// ---------------------------------------------------------------------------

describe('QT-314 T3 — posiciones de las recetas que fallan (R15)', () => {
  it('R15: alta de tres recetas con la segunda invalida responde recipe_not_found con la posicion [1]', async () => {
    const error = await alta()({ lines: [linea(RECETA_A), linea(RECETA_AJENA), linea(RECETA_C)] }, ACTOR).catch(
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(RecipeNotFoundError);
    expect(await respuesta(error, 'recipe_not_found')).toEqual([1]);
  });

  it('R15: edicion de tres recetas que cambia la segunda a una receta invalida responde recipe_not_found con [1]', async () => {
    const error = await edicion(TRES_PENDIENTES)(
      ORDER_ID,
      { lines: [entrada(LINEA_A, RECETA_A), entrada(LINEA_B, RECETA_AJENA), entrada(LINEA_C, RECETA_C)] },
      ACTOR,
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(RecipeNotFoundError);
    expect(await respuesta(error, 'recipe_not_found')).toEqual([1]);
  });

  it('R15: alta de tres recetas sin material para la segunda y la tercera, sin confirmar, responde order_would_block con [1, 2]', async () => {
    const error = await alta([1, 2])({ lines: [linea(RECETA_A), linea(RECETA_B), linea(RECETA_C)] }, ACTOR).catch(
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(OrderWouldBlockError);
    expect(await respuesta(error, 'order_would_block')).toEqual([1, 2]);
  });

  it('R15: edicion que aparta las guardadas antes que la nueva devuelve order_would_block con las posiciones de la entrada, ordenadas', async () => {
    // La nueva va en la posicion 1 de la entrada pero aparta la ultima: el orden de apartado no es
    // el de la entrada, y la respuesta va por la entrada.
    const error = await edicion(
      [guardada(LINEA_A, RECETA_A, 0, 'PENDIENTE'), guardada(LINEA_B, RECETA_B, 1, 'PENDIENTE')],
      [LINEA_B, 'linea-0'],
    )(
      ORDER_ID,
      { lines: [entrada(LINEA_A, RECETA_A, '12'), entrada(undefined, RECETA_C), entrada(LINEA_B, RECETA_B, '12')] },
      ACTOR,
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(OrderWouldBlockError);
    expect(await respuesta(error, 'order_would_block')).toEqual([1, 2]);
  });

  it('R15: edicion en la que a la segunda receta, EN_CURSO, deja de alcanzarle el material responde insufficient_material con [1]', async () => {
    const error = await edicion(
      [
        guardada(LINEA_A, RECETA_A, 0, 'PENDIENTE'),
        guardada(LINEA_B, RECETA_B, 1, 'EN_CURSO'),
        guardada(LINEA_C, RECETA_C, 2, 'PENDIENTE'),
      ],
      [LINEA_B, LINEA_C],
    )(
      ORDER_ID,
      { lines: [entrada(LINEA_A, RECETA_A), entrada(LINEA_B, RECETA_B, '20'), entrada(LINEA_C, RECETA_C, '20')] },
      ACTOR,
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(InsufficientMaterialError);
    expect(await respuesta(error, 'insufficient_material')).toEqual([1]);
  });

  it('R15: edicion que cambia la segunda receta, POR_EMPACAR, responde invalid_transition con [1]', async () => {
    const error = await edicion([
      guardada(LINEA_A, RECETA_A, 0, 'PENDIENTE'),
      guardada(LINEA_B, RECETA_B, 1, 'POR_EMPACAR'),
      guardada(LINEA_C, RECETA_C, 2, 'PENDIENTE'),
    ])(
      ORDER_ID,
      { lines: [entrada(LINEA_A, RECETA_A), entrada(LINEA_B, RECETA_B, '11'), entrada(LINEA_C, RECETA_C)] },
      ACTOR,
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(InvalidTransitionError);
    expect(await respuesta(error, 'invalid_transition')).toEqual([1]);
  });

  it('R15: alta de tres recetas con la segunda y la tercera repetidas (una es version de la otra) responde duplicate_order_recipe con [1, 2]', async () => {
    const error = await alta()(
      { lines: [linea(RECETA_A), linea(RECETA_B), linea(RECETA_B, '5', { recipeVersionId: VERSION_DE_B })] },
      ACTOR,
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(DuplicateOrderRecipeError);
    expect(await respuesta(error, 'duplicate_order_recipe')).toEqual([1, 2]);
  });

  it('R15: edicion de tres recetas en la que la nueva tercera repite la segunda responde duplicate_order_recipe con [1, 2]', async () => {
    const error = await edicion([guardada(LINEA_A, RECETA_A, 0, 'PENDIENTE'), guardada(LINEA_B, RECETA_B, 1, 'PENDIENTE')])(
      ORDER_ID,
      { lines: [entrada(LINEA_A, RECETA_A), entrada(LINEA_B, RECETA_B), entrada(undefined, RECETA_B)] },
      ACTOR,
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(DuplicateOrderRecipeError);
    expect(await respuesta(error, 'duplicate_order_recipe')).toEqual([1, 2]);
  });
});

describe('QT-314 T3 — linePositionsOf y atLinePosition (R15, R16)', () => {
  it('R15: linePositionsOf ordena de menor a mayor y quita las repetidas', () => {
    expect(linePositionsOf(new OrderWouldBlockError().withLinePositions([2, 0, 2, 1]))).toEqual([0, 1, 2]);
  });

  it('R15: atLinePosition rehace el error con la misma clase, el mismo codigo, su posicion y el diagnostico ampliado', async () => {
    const error = await atLinePosition(2, () => {
      throw new RecipeNotFoundError('version retirada');
    }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(RecipeNotFoundError);
    expect((error as RecipeNotFoundError).code).toBe('recipe_not_found');
    expect((error as RecipeNotFoundError).diagnostic).toBe('linea en la posicion 2: version retirada');
    expect(linePositionsOf(error)).toEqual([2]);
  });

  it('R15: assertNoDuplicateOrderRecipe lleva las posiciones de las dos recetas repetidas', () => {
    let error: unknown;
    try {
      assertNoDuplicateOrderRecipe([{ originalRecipeId: RECETA_A }, { originalRecipeId: RECETA_B }, { originalRecipeId: RECETA_B }]);
    } catch (caught) {
      error = caught;
    }
    expect(linePositionsOf(error)).toEqual([1, 2]);
  });

  it('R16: linePositionsOf de un error ajeno al modulo, o de algo que no es un error, es []', () => {
    expect(linePositionsOf(new Error('caida'))).toEqual([]);
    expect(linePositionsOf({ linePositions: [1] })).toEqual([]);
    expect(linePositionsOf(undefined)).toEqual([]);
    expect(linePositionsOf('order_would_block')).toEqual([]);
  });

  it('R16: un error del modulo que no es de receta no trae posiciones y su estado traducido no cambia', async () => {
    const error = new OrderNotFoundError('pedido ajeno');

    expect(error.linePositions).toEqual([]);
    expect(linePositionsOf(error)).toEqual([]);
    expect(await toErrorState(error)).toEqual({ status: 'error', code: 'order_not_found', message: errorMessage('order_not_found') });
  });

  it('R16: atLinePosition deja pasar sin tocar un error que no es del modulo', async () => {
    const ajeno = new Error('caida');

    await expect(atLinePosition(1, () => Promise.reject(ajeno))).rejects.toBe(ajeno);
  });

  it('R15: el contrato del modulo publica linePositionsOf', () => {
    expect(linePositionsOfDelContrato).toBe(linePositionsOf);
  });
});
