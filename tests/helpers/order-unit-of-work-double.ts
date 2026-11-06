// Doble compartido de `OrderUnitOfWork` para los tests unitarios de `pedidos`.
//
// `run` invoca el trabajo DIRECTAMENTE con el `scope` que se le da, sin abrir ninguna
// transaccion real: eso es lo que corresponde a un test UNITARIO, que dobla los dos puertos de
// la transaccion (`OrderWriteRepository` de `pedidos`, `MaterialReservations` de `inventario`) y
// no habla con Postgres. La transaccion de verdad la prueba
// `tests/integration/pedidos/order-unit-of-work.int.test.ts`.
import { vi } from 'vitest';

import type {
  OrderTransactionScope,
  OrderUnitOfWork,
} from '@/lib/modules/pedidos/ports/order-unit-of-work';
import type { StoredOrderCost } from '@/lib/modules/pedidos/domain/order-cost';
import type { OrderScope } from '@/lib/modules/pedidos/domain/order-scope';
import type { OrderLineRow, OrderRow } from '@/lib/modules/pedidos/domain/order-view';
import type {
  LockedOrderRow,
  OrderLineChanges,
  OrderWriteRepository,
} from '@/lib/modules/pedidos/ports/order-write-repository';
import type {
  ConsumedLot,
  ConsumptionOutcome,
  FinishedGoodsIntake,
  FinishedGoodsOutcome,
  MaterialReservations,
  OrderConsumptionLedger,
  ProductRef,
  ReservationOutcome,
} from '@/lib/modules/inventario';
import type { MassVolumeBridge, UnitRef } from '@/lib/modules/unidades';

/**
 * Escrituras del pedido que el puerto ya no tiene: el coste y el plazo de reserva son de la linea.
 * Los dobles escritos para pedidos de una receta las siguen ofreciendo, y `singleRecipeWrites` les
 * manda las de su unica linea.
 */
export type LegacyOrderWrites = {
  setIngredientsCost(
    id: string,
    cost: StoredOrderCost | null,
    actorId: string | null,
    now: Date,
    scope: OrderScope,
  ): Promise<'ok' | 'not_found'>;
  setReservedAt(id: string, reservedAt: Date | null, scope: OrderScope): Promise<void>;
};

type FakeOrderWrites = OrderWriteRepository &
  LegacyOrderWrites &
  Record<keyof OrderWriteRepository | keyof LegacyOrderWrites, ReturnType<typeof vi.fn>>;

/** Un `OrderWriteRepository` que explota si se le llama un metodo que el test no espera: el
 *  patron de `explota()` que ya usan `create-order.test.ts` y compania, aplicado al puerto de
 *  escritura de la unidad de trabajo. */
export function fakeOrderWriteRepository(
  overrides: Partial<OrderWriteRepository & LegacyOrderWrites> = {},
): FakeOrderWrites {
  const explota = (nombre: string) =>
    vi.fn(() => {
      throw new Error(`OrderWriteRepository.${nombre} no deberia llamarse en este caso`);
    });
  return {
    lockAliveById: vi.fn(explota('lockAliveById')),
    // Todos los pedidos de los tests unitarios son, por ahora, pedidos sin linea.
    lockAliveLines: vi.fn(explota('lockAliveLines')),
    lockAliveLine: vi.fn(explota('lockAliveLine')),
    writeLines: vi.fn(explota('writeLines')),
    cancelLine: vi.fn(explota('cancelLine')),
    setLineStatus: vi.fn(explota('setLineStatus')),
    setLineIngredientsCost: vi.fn(explota('setLineIngredientsCost')),
    setLineReservedAt: vi.fn(explota('setLineReservedAt')),
    refreshStatus: vi.fn(explota('refreshStatus')),
    create: vi.fn(explota('create')),
    updateAlive: vi.fn(explota('updateAlive')),
    cancelAlive: vi.fn(explota('cancelAlive')),
    softDeleteAlive: vi.fn(explota('softDeleteAlive')),
    setStatus: vi.fn(explota('setStatus')),
    setReservedAt: vi.fn(explota('setReservedAt')),
    setIngredientsCost: vi.fn(explota('setIngredientsCost')),
    stampLineStatus: vi.fn(explota('stampLineStatus')),
    setLineActualCost: vi.fn(explota('setLineActualCost')),
    findPresentationLinesForFinish: vi.fn(explota('findPresentationLinesForFinish')),
    recordPackedCounts: vi.fn(explota('recordPackedCounts')),
    ...overrides,
  } as unknown as FakeOrderWrites;
}

/** Un `MaterialReservations` que por defecto aparta todo lo que se le pida y no falla nunca:
 *  quien necesite `insufficient` o `nothing_to_consume` lo pasa por `overrides`. */
export function fakeMaterialReservations(
  overrides: Partial<MaterialReservations> = {},
): MaterialReservations & Record<keyof MaterialReservations, ReturnType<typeof vi.fn>> {
  const syncForLine = vi.fn(
    async (): Promise<ReservationOutcome> => ({ kind: 'reserved' }),
  );
  const releaseForLine = vi.fn(async (): Promise<void> => undefined);
  const consumeForLine = vi.fn(
    async (): Promise<ConsumptionOutcome> => ({ kind: 'consumed' }),
  );
  const settlePackagingForLine = vi.fn(
    async (): Promise<ConsumptionOutcome> => ({ kind: 'consumed' }),
  );
  return {
    syncForLine,
    releaseForLine,
    consumeForLine,
    settlePackagingForLine,
    ...overrides,
  } as unknown as MaterialReservations & Record<keyof MaterialReservations, ReturnType<typeof vi.fn>>;
}

/** El `OrderUnitOfWork` doble: `run` corre el trabajo con el `scope` dado, sin transaccion. */
export function fakeOrderUnitOfWork(scope: OrderTransactionScope): OrderUnitOfWork {
  return { run: (work) => work(scope) };
}

/** Un `FinishedGoodsIntake` que explota si se le llama: solo la transicion de Finalizar lo
 *  toca, y quien no espera esa llamada -crear, editar, cancelar, caducar- lo hereda sin
 *  personalizarlo.
 *  Quien SI la espera pasa su propio doble por `overrides`. */
export function fakeFinishedGoodsIntake(
  overrides: Partial<FinishedGoodsIntake> = {},
): FinishedGoodsIntake & Record<keyof FinishedGoodsIntake, ReturnType<typeof vi.fn>> {
  const receiveFromOrder = vi.fn(
    async (): Promise<FinishedGoodsOutcome> => {
      throw new Error('FinishedGoodsIntake.receiveFromOrder no deberia llamarse en este caso');
    },
  );
  return {
    receiveFromOrder,
    ...overrides,
  } as unknown as FinishedGoodsIntake & Record<keyof FinishedGoodsIntake, ReturnType<typeof vi.fn>>;
}

/** Lector de receta del `scope`, sobre el `tx`: por defecto una
 *  receta SIN lineas, para que quien no la personaliza obtenga una necesidad vacia y no un
 *  dato inventado. Quien necesite lineas concretas pasa su propio `RecipeCatalog` de dobles
 *  -el mismo que usa para `deps.recipes`- como `overrides`. */
export function fakeRecipeExecutionReader(
  overrides: Partial<OrderTransactionScope['recipes']> = {},
): OrderTransactionScope['recipes'] & Record<'findExecutionContentById', ReturnType<typeof vi.fn>> {
  const findExecutionContentById = vi.fn(async (id: string) => ({
    id,
    name: 'Receta',
    isDeleted: false,
    steps: [],
    lines: [],
  }));
  return {
    findExecutionContentById,
    ...overrides,
  } as OrderTransactionScope['recipes'] & Record<'findExecutionContentById', ReturnType<typeof vi.fn>>;
}

/** Productos del `scope`: por defecto ninguno resuelve, asi que cada linea de receta se trata
 *  como un insumo sin unidad y su necesidad no se convierte. */
export function fakeScopeProducts(
  refs: readonly ProductRef[] = [],
): OrderTransactionScope['products'] & Record<'findRefs', ReturnType<typeof vi.fn>> {
  const findRefs = vi.fn(async (ids: readonly string[]) => refs.filter((ref) => ids.includes(ref.id)));
  return { findRefs } as OrderTransactionScope['products'] & Record<'findRefs', ReturnType<typeof vi.fn>>;
}

/** Unidades del `scope`: por defecto un catalogo vacio y sin puente masa-volumen. */
export function fakeScopeUnits(
  refs: readonly UnitRef[] = [],
  bridge: MassVolumeBridge | null = null,
): OrderTransactionScope['units'] & Record<'findRefs' | 'findMassVolumeBridge', ReturnType<typeof vi.fn>> {
  const findRefs = vi.fn(async (ids: readonly string[]) => refs.filter((ref) => ids.includes(ref.id)));
  const findMassVolumeBridge = vi.fn(async () => bridge);
  return { findRefs, findMassVolumeBridge } as OrderTransactionScope['units'] &
    Record<'findRefs' | 'findMassVolumeBridge', ReturnType<typeof vi.fn>>;
}

/** Lectura de consumos del `scope`: por defecto el pedido no consumio nada, asi que el coste real
 *  queda sin importe. Quien necesite lotes concretos los pasa. */
export function fakeOrderConsumptionLedger(
  lots: readonly ConsumedLot[] = [],
): OrderConsumptionLedger & Record<'findConsumedLots', ReturnType<typeof vi.fn>> {
  const findConsumedLots = vi.fn(async () => lots);
  return { findConsumedLots } as OrderConsumptionLedger & Record<'findConsumedLots', ReturnType<typeof vi.fn>>;
}

/** Combina los puertos del `scope` y la unidad de trabajo que los expone, lista para
 *  inyectar en `CreateOrderDeps.unitOfWork`, etc. */
export function fakeUnitOfWork(overrides: {
  readonly orders?: Partial<OrderWriteRepository & LegacyOrderWrites>;
  readonly reservations?: Partial<MaterialReservations>;
  readonly recipes?: Partial<OrderTransactionScope['recipes']>;
  readonly finishedGoods?: Partial<FinishedGoodsIntake>;
  readonly products?: OrderTransactionScope['products'];
  readonly units?: OrderTransactionScope['units'];
  readonly consumption?: OrderConsumptionLedger;
} = {}): {
  readonly unitOfWork: OrderUnitOfWork;
  readonly orders: FakeOrderWrites;
  readonly reservations: MaterialReservations &
    Record<keyof MaterialReservations, ReturnType<typeof vi.fn>>;
  readonly recipes: OrderTransactionScope['recipes'] & Record<'findExecutionContentById', ReturnType<typeof vi.fn>>;
  readonly finishedGoods: FinishedGoodsIntake & Record<keyof FinishedGoodsIntake, ReturnType<typeof vi.fn>>;
  readonly products: OrderTransactionScope['products'];
  readonly units: OrderTransactionScope['units'];
  readonly consumption: OrderConsumptionLedger;
} {
  const orders = fakeOrderWriteRepository(overrides.orders);
  const reservations = fakeMaterialReservations(overrides.reservations);
  const recipes = fakeRecipeExecutionReader(overrides.recipes);
  const finishedGoods = fakeFinishedGoodsIntake(overrides.finishedGoods);
  const products = overrides.products ?? fakeScopeProducts();
  const units = overrides.units ?? fakeScopeUnits();
  const consumption = overrides.consumption ?? fakeOrderConsumptionLedger();
  return {
    unitOfWork: fakeOrderUnitOfWork({ orders, reservations, recipes, finishedGoods, products, units, consumption }),
    orders,
    reservations,
    recipes,
    finishedGoods,
    products,
    units,
    consumption,
  };
}

/** La cabecera del pedido con los datos de su unica receta: `orderLineOf` construye la linea con
 *  ellos. Es una `LockedOrderRow` valida; los campos de receta solo los lee `orderLineOf`. */
export type SingleRecipeOrderRow = LockedOrderRow & {
  readonly recipeId: string;
  readonly quantity: string;
  readonly unitId: string | null;
  readonly ingredientsCost: string | null;
  readonly packagingCost: string | null;
  readonly actualCost: string | null;
  readonly salePrice: string | null;
  readonly presentationLines: OrderLineRow['presentationLines'];
  readonly reservedAt?: Date | null;
};

/** Fila minima de `OrderWriteRepository.lockAliveById`: los tests que no la personalizan usan
 *  esta, para no repetir los campos en cada archivo. `reservedAt` por defecto queda DENTRO del
 *  plazo (anterior a `AHORA` de los tests), como un pedido con material apartado hace rato. */
export function fakeOrderRow(overrides: Partial<SingleRecipeOrderRow> = {}): SingleRecipeOrderRow {
  return {
    salePrice: null,
    id: '11111111-1111-4111-8111-111111111111',
    number: { year: 2026, sequence: 1 },
    recipeId: '22222222-2222-4222-8222-222222222222',
    quantity: '10.0000',
    priority: 'BAJA',
    status: 'PENDIENTE',
    cancellationReason: null,
    ingredientsCost: null,
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    updatedAt: new Date('2026-01-02T03:04:05.000Z'),
    createdBy: 'admin-0',
    updatedBy: 'admin-0',
    presentationLines: [],
    unitId: null,
    customerId: null,
    reservedAt: new Date('2026-01-02T03:04:05.000Z'),
    packagingCost: null,
    actualCost: null,
    ...overrides,
  };
}

/** La linea de un pedido de una receta, con los datos de su fila: lo que la migracion le dio a
 *  cada pedido existente. `id` fijo para que los tests la nombren. */
export const ONLY_LINE_ID = '0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e';

export function orderLineOf(
  row: OrderRow & Partial<Omit<SingleRecipeOrderRow, keyof OrderRow>>,
  overrides: Partial<OrderLineRow> = {},
): OrderLineRow {
  if (row.status === 'PARCIAL') throw new Error('una linea no puede estar en PARCIAL');
  // Lo que la fila no trae de su receta sale de la fila por defecto.
  const full = fakeOrderRow({ reservedAt: null, ...row });
  const reservedAt = full.reservedAt ?? null;
  return {
    id: ONLY_LINE_ID,
    orderId: row.id,
    position: 0,
    recipeId: full.recipeId,
    originalRecipeId: full.recipeId,
    quantity: full.quantity,
    unitId: full.unitId,
    status: row.status,
    cancellationReason: row.cancellationReason,
    ingredientsCost: full.ingredientsCost,
    packagingCost: full.packagingCost,
    actualCost: full.actualCost,
    salePrice: full.salePrice,
    reservedAt,
    finishedAt: null,
    packedBy: null,
    conditionedBy: null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    presentationLines: full.presentationLines,
    ...overrides,
  };
}

/** Las escrituras por linea que hacen el alta y la edicion, funcionando: `writeLines` devuelve las
 *  lineas anadidas con ids `linea-0`, `linea-1`..., y el resto resuelve sin hacer nada. Quien
 *  necesite otra cosa la pisa con su propio doble. */
export function lineWritingOrders(): Pick<
  OrderWriteRepository,
  'writeLines' | 'setLineStatus' | 'setLineIngredientsCost' | 'setLineReservedAt' | 'refreshStatus' | 'updateAlive'
> & Record<'writeLines' | 'setLineStatus' | 'setLineIngredientsCost' | 'setLineReservedAt' | 'refreshStatus' | 'updateAlive', ReturnType<typeof vi.fn>> {
  const writeLines = vi.fn(async (orderId: string, changes: OrderLineChanges): Promise<readonly OrderLineRow[]> =>
    changes.added.map((line, index) => ({
      id: `linea-${String(index)}`,
      orderId,
      position: index,
      recipeId: line.recipeId,
      originalRecipeId: line.originalRecipeId,
      quantity: line.quantity,
      unitId: line.unitId,
      status: line.status,
      cancellationReason: null,
      ingredientsCost: line.cost?.total ?? null,
      packagingCost: line.cost?.packaging ?? null,
      actualCost: null,
      salePrice: line.salePrice,
      reservedAt: null,
      finishedAt: null,
      packedBy: null,
      conditionedBy: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      createdBy: null,
      updatedBy: null,
      presentationLines: line.presentationLines.map((item) => ({
        presentationId: item.presentationId,
        packages: item.packages,
        presentationContent: item.content,
        packagingProductId: item.packagingProductId,
      })),
    })),
  );
  return {
    writeLines,
    setLineStatus: vi.fn(async () => 'ok' as const),
    setLineIngredientsCost: vi.fn(async () => 'ok' as const),
    setLineReservedAt: vi.fn(async () => undefined),
    refreshStatus: vi.fn(async () => 'PENDIENTE' as const),
    updateAlive: vi.fn(async () => 'ok' as const),
  };
}
