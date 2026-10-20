// `createStartPacking`: implementa `OrderCatalog['startPackingAliveById']` sobre
// `OrderPackingRepository`, un simple `UPDATE` condicional fuera de la unidad de trabajo.
//
// `createFinishPacking` (T14, R17-R21): implementa `OrderCatalog['finishPackingAliveById']`
// sobre la unidad de trabajo compartida con `inventario`. Doble de `OrderUnitOfWork` y de los
// catalogos globales, sin base de datos: lo que se prueba es el ORDEN de llamadas, el coste
// unitario UNICO derivado de la cantidad total producida (R18), el rollback entero si alguna
// linea da `presentation_without_content` (R19), y que el `'ok'` lleva un `FinishedGoodsReceipt`
// por linea.

import { describe, expect, it, vi } from 'vitest';

import { createFinishPacking, createStartPacking, type FinishPackingDeps } from '@/lib/modules/pedidos/domain/order-packing';
import * as transitions from '@/lib/modules/pedidos/domain/order-transitions';
import { fakeUnitOfWork } from '@/tests/helpers/order-unit-of-work-double';

import type { OrderPackingRepository } from '@/lib/modules/pedidos/ports/order-packing-repository';
import type { FinishPackingLine, FinishPackingUpdateOutcome } from '@/lib/modules/pedidos/ports/order-write-repository';
import type { OrderCatalog, PackedLineCount } from '@/lib/modules/pedidos';
import type { FinishedGoodsIntake, MaterialReservations, PresentationCatalog, ProductCatalog } from '@/lib/modules/inventario';
import type { RecipeCatalog } from '@/lib/modules/recetas';
import type { UnitCatalog } from '@/lib/modules/unidades';
import { fakePackagingCatalog } from '../../helpers/packaging-catalog-double';
import type { PackagingCatalog } from '@/lib/modules/inventario';

const EMPRESA = 'c-1';
const PEDIDO = 'o-1';
const EMPACADOR = 'u-1';
const RECETA = 'r-1';
const AHORA = new Date('2026-09-25T12:00:00Z');
const LITRO = 'unidad-litro';
const MILILITRO = 'unidad-mililitro';
const KILO = 'unidad-kilo';

/** Litro como base, mililitro derivado (1 ml = 0,001 L) y kilo, que no comparte base con ellos. */
const UNIDADES = [
  { id: LITRO, name: 'Litro', symbol: 'L', baseUnitId: null, factor: null },
  { id: MILILITRO, name: 'Mililitro', symbol: 'ml', baseUnitId: LITRO, factor: '0.0010' },
  { id: KILO, name: 'Kilo', symbol: 'kg', baseUnitId: null, factor: null },
] as const;

/** El conteo que coincide con el plan de cada linea: sin diferencia, sin motivo. */
function conteoDelPlan(lines: readonly FinishPackingLine[]): readonly PackedLineCount[] {
  return lines.map((line) => ({ lineId: line.id, packedPackages: line.packages, reason: null, reasonOther: null }));
}

function conteo(
  lineId: string,
  packedPackages: number,
  reason: PackedLineCount['reason'] = null,
  reasonOther: string | null = null,
): PackedLineCount {
  return { lineId, packedPackages, reason, reasonOther };
}

function packingDoble(overrides: Partial<OrderPackingRepository> = {}): OrderPackingRepository {
  return {
    startPackingAlive: vi.fn(async () => {
      throw new Error('startPackingAlive no configurado en este test');
    }),
    ...overrides,
  };
}

function lineaDe(overrides: Partial<FinishPackingLine> = {}): FinishPackingLine {
  return {
    id: 'linea-1',
    presentationId: 'p-1',
    packages: 10,
    presentationContent: '1.0000',
    packagingProductId: null,
    packedPackages: null,
    ...overrides,
  };
}

/** `RecipeCatalog`/`ProductCatalog`/`UnitCatalog`/`PresentationCatalog` globales: por defecto
 *  una receta viva sin lineas (asi `resolveLotIngredientsCost` da `'0.0000'` sin inventar
 *  ingredientes) y cada presentacion pedida en litros con contenido `1.0000`, salvo las que
 *  `presentationRefs` redefine. */
function catalogosGlobales(overrides: {
  readonly recipeName?: string;
  readonly recipeFound?: boolean;
  readonly presentationRefs?: readonly { readonly id: string; readonly content: string | null; readonly unitId?: string }[];
} = {}): {
  readonly recipes: RecipeCatalog;
  readonly products: ProductCatalog;
  readonly units: UnitCatalog;
  readonly presentations: Pick<PresentationCatalog, 'findRefs'>;
  readonly findRefsIncludingDeleted: ReturnType<typeof vi.fn>;
  readonly findPresentationRefs: ReturnType<typeof vi.fn>;
} {
  const findRefsIncludingDeleted = vi.fn(async () =>
    overrides.recipeFound === false ? [] : [{ id: RECETA, name: overrides.recipeName ?? 'Desengrasante', ownName: overrides.recipeName ?? 'Desengrasante', isUnderReview: false, original: null, isDeleted: false, imageUrl: null }],
  );
  const findExecutionContentById = vi.fn(async () => ({ id: RECETA, name: 'Desengrasante', isDeleted: false, steps: [], lines: [], tools: [] }));
  const findPresentationRefs = vi.fn(async (ids: readonly string[]) =>
    ids.map((id) => {
      const ref = overrides.presentationRefs?.find((candidate) => candidate.id === id);
      return { id, name: 'Presentacion', content: ref === undefined ? '1.0000' : ref.content, unitId: ref?.unitId ?? LITRO };
    }),
  );

  return {
    recipes: {
      findRefsIncludingDeleted,
      findExecutionContentById,
      findIdsMatchingName: async () => {
        throw new Error('sin uso en este test');
      },
      findAliveByNormalizedName: async () => {
        throw new Error('sin uso en este test');
      },
    },
    products: {
      findRefs: async () => [],
      findCostingBatches: async () => [],
      findFinishedGoodsReceipts: async () => {
        throw new Error('sin uso en este test');
      },
    } as unknown as ProductCatalog,
    units: {
      findRefs: async (ids: readonly string[]) => UNIDADES.filter((unit) => ids.includes(unit.id)),
      findRefsSharingBaseInCompany: async () => {
        throw new Error('sin uso en este test');
      },
      findMassVolumeBridge: async () => null,
    } as unknown as UnitCatalog,
    presentations: { findRefs: findPresentationRefs },
    findRefsIncludingDeleted,
    findPresentationRefs,
  };
}

describe('createStartPacking (R10, R18-R20, R23, R24)', () => {
  it('R18: ok delega en startPackingAlive con el companyId como scope, y devuelve ok', async () => {
    const startPackingAlive = vi.fn(async () => 'ok' as const);
    const packing = packingDoble({ startPackingAlive });
    const startPackingAliveById = createStartPacking({ packing });

    await expect(startPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toBe('ok');

    expect(startPackingAlive).toHaveBeenCalledWith(PEDIDO, EMPACADOR, AHORA, { companyId: EMPRESA });
    expect(startPackingAlive).toHaveBeenCalledTimes(1);
  });

  it('R20: already_mine (el mismo empacador repite Comenzar) se devuelve tal cual', async () => {
    const packing = packingDoble({ startPackingAlive: vi.fn(async () => 'already_mine' as const) });
    const startPackingAliveById = createStartPacking({ packing });

    await expect(startPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toBe('already_mine');
  });

  it('R19, R20: taken (EN_EMPAQUE a nombre de otro, o la carrera del segundo Comenzar) se devuelve tal cual', async () => {
    const packing = packingDoble({ startPackingAlive: vi.fn(async () => 'taken' as const) });
    const startPackingAliveById = createStartPacking({ packing });

    await expect(startPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toBe('taken');
  });

  it('R23: not_packable (el pedido no esta POR_EMPACAR) se devuelve tal cual', async () => {
    const packing = packingDoble({ startPackingAlive: vi.fn(async () => 'not_packable' as const) });
    const startPackingAliveById = createStartPacking({ packing });

    await expect(startPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toBe('not_packable');
  });

  it('R10: without_distribution (POR_EMPACAR sin ninguna linea de reparto) se devuelve tal cual', async () => {
    const packing = packingDoble({
      startPackingAlive: vi.fn(async () => 'without_distribution' as const),
    });
    const startPackingAliveById = createStartPacking({ packing });

    await expect(startPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toBe(
      'without_distribution',
    );
  });

  it('R24: not_found (no existe, esta de baja o es de otra empresa) se devuelve tal cual', async () => {
    const packing = packingDoble({ startPackingAlive: vi.fn(async () => 'not_found' as const) });
    const startPackingAliveById = createStartPacking({ packing });

    await expect(startPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toBe('not_found');
  });
});

describe('createFinishPacking (T14, R17-R21)', () => {
  function montar(options: {
    readonly finishPackingAlive?: FinishPackingUpdateOutcome;
    readonly lines?: readonly FinishPackingLine[];
    readonly receiveFromOrder?: ReturnType<typeof vi.fn>;
    readonly catalogos?: ReturnType<typeof catalogosGlobales>;
    readonly packaging?: PackagingCatalog;
    readonly consumeForOrder?: ReturnType<typeof vi.fn>;
    readonly settlePackagingForOrder?: ReturnType<typeof vi.fn>;
    /** Productos de la receta del pedido, como los lee la transaccion. */
    readonly ingredientes?: readonly string[];
  } = {}): {
    /** Sin `counts`, el conteo coincide con el plan de las lineas que devuelve la lectura. */
    readonly finishPackingAliveById: (
      id: string,
      companyId: string,
      packerId: string,
      now: Date,
      counts?: readonly PackedLineCount[],
    ) => ReturnType<OrderCatalog['finishPackingAliveById']>;
    readonly finishPackingAlive: ReturnType<typeof vi.fn>;
    readonly findPresentationLinesForFinish: ReturnType<typeof vi.fn>;
    readonly recordPackedCounts: ReturnType<typeof vi.fn>;
    readonly receiveFromOrder: ReturnType<typeof vi.fn>;
    readonly consumeForOrder: ReturnType<typeof vi.fn>;
    readonly settlePackagingForOrder: ReturnType<typeof vi.fn>;
    readonly catalogos: ReturnType<typeof catalogosGlobales>;
    /** `true` si el trabajo de la unidad de trabajo lanzo: la transaccion real se habria deshecho. */
    readonly deshecho: () => boolean;
  } {
    const catalogos = options.catalogos ?? catalogosGlobales();
    const finishPackingAlive = vi.fn(
      async (): Promise<FinishPackingUpdateOutcome> =>
        options.finishPackingAlive ?? { kind: 'ok', recipeId: RECETA, quantity: '10.0000', ingredientsCost: '20.0000', unitId: LITRO },
    );
    const lineas = options.lines ?? [lineaDe()];
    const findPresentationLinesForFinish = vi.fn(async () => lineas);
    const recordPackedCounts = vi.fn(async () => undefined);
    const receiveFromOrder =
      options.receiveFromOrder ??
      vi.fn(async (input: { readonly presentationId: string; readonly packages: number }) => ({
        kind: 'received' as const,
        productId: `producto-${input.presentationId}`,
        productName: `Desengrasante · Presentacion ${input.presentationId}`,
        packages: String(input.packages),
      }));

    const { unitOfWork, reservations } = fakeUnitOfWork({
      orders: { finishPackingAlive, findPresentationLinesForFinish, recordPackedCounts },
      reservations: {
        ...(options.consumeForOrder === undefined ? {} : { consumeForOrder: options.consumeForOrder as unknown as MaterialReservations['consumeForOrder'] }),
        ...(options.settlePackagingForOrder === undefined
          ? {}
          : { settlePackagingForOrder: options.settlePackagingForOrder as unknown as MaterialReservations['settlePackagingForOrder'] }),
      },
      finishedGoods: { receiveFromOrder: receiveFromOrder as unknown as FinishedGoodsIntake['receiveFromOrder'] },
      ...(options.ingredientes === undefined
        ? {}
        : {
            recipes: {
              findExecutionContentById: vi.fn(async (recipeId: string) => ({
                id: recipeId,
                name: 'Desengrasante',
                isDeleted: false,
                steps: [],
                lines: (options.ingredientes ?? []).map((productId) => ({ productId, productName: null, percentage: '50.00' })),
                tools: [],
              })),
            },
          }),
    });

    let deshecho = false;
    const deps: FinishPackingDeps = {
      packing: packingDoble(),
      unitOfWork: {
        run: async (work) => {
          try {
            return await unitOfWork.run(work);
          } catch (error) {
            deshecho = true;
            throw error;
          }
        },
      },
      recipes: catalogos.recipes,
      products: catalogos.products,
      units: catalogos.units,
      presentations: catalogos.presentations,
      packaging: options.packaging ?? fakePackagingCatalog(),
    };

    const finish = createFinishPacking(deps);
    return {
      finishPackingAliveById: (id, companyId, packerId, now, counts) =>
        finish(id, companyId, packerId, now, counts ?? conteoDelPlan(lineas)),
      finishPackingAlive,
      findPresentationLinesForFinish,
      recordPackedCounts,
      receiveFromOrder,
      consumeForOrder: reservations.consumeForOrder,
      settlePackagingForOrder: reservations.settlePackagingForOrder,
      catalogos,
      deshecho: () => deshecho,
    };
  }

  it('R5 (QC-215): Terminar comprueba EN_EMPAQUE -> POR_ACONDICIONAR, nunca hacia ENTREGADO ni TERMINADO', async () => {
    const assertSpy = vi.spyOn(transitions, 'assertTransition');
    try {
      const { finishPackingAliveById } = montar({ lines: [] });

      await finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA);

      expect(assertSpy).toHaveBeenCalledExactlyOnceWith('EN_EMPAQUE', 'POR_ACONDICIONAR');
    } finally {
      assertSpy.mockRestore();
    }
  });

  it('R6 (QC-215): si la matriz rechazara EN_EMPAQUE -> POR_ACONDICIONAR, Terminar falla sin abrir la unidad de trabajo', async () => {
    const assertSpy = vi.spyOn(transitions, 'assertTransition').mockImplementation(() => {
      throw new Error('transicion rechazada');
    });
    try {
      const { finishPackingAliveById, finishPackingAlive } = montar({ lines: [] });

      await expect(finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).rejects.toThrow('transicion rechazada');
      expect(finishPackingAlive).not.toHaveBeenCalled();
    } finally {
      assertSpy.mockRestore();
    }
  });

  it('R22, R23, R24: not_packer/not_packable/not_found se devuelven tal cual, sin leer lineas', async () => {
    for (const kind of ['not_packer', 'not_packable', 'not_found'] as const) {
      const { finishPackingAliveById, findPresentationLinesForFinish } = montar({
        finishPackingAlive: { kind },
      });

      await expect(finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toBe(kind);
      expect(findPresentationLinesForFinish).not.toHaveBeenCalled();
    }
  });

  it('sin ninguna linea de reparto, ok vuelve con finishedGoods vacio y no toca ningun catalogo', async () => {
    const catalogos = catalogosGlobales();
    const { finishPackingAliveById, receiveFromOrder } = montar({ lines: [], catalogos });

    await expect(finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toEqual({
      kind: 'ok',
      finishedGoods: [],
    });
    expect(receiveFromOrder).not.toHaveBeenCalled();
    expect(catalogos.findRefsIncludingDeleted).not.toHaveBeenCalled();
  });

  it('R17: da de alta un lote por cada linea del reparto, en el orden que las devuelve la lectura', async () => {
    const lineas = [lineaDe({ id: 'linea-1', presentationId: 'p-1', packages: 5 }), lineaDe({ id: 'linea-2', presentationId: 'p-2', packages: 3 })];
    const { finishPackingAliveById, receiveFromOrder } = montar({ lines: lineas });

    const resultado = await finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA);

    expect(resultado).toMatchObject({
      kind: 'ok',
      finishedGoods: [
        { productName: 'Desengrasante · Presentacion p-1', packages: '5' },
        { productName: 'Desengrasante · Presentacion p-2', packages: '3' },
      ],
    });
    expect(receiveFromOrder).toHaveBeenCalledTimes(2);
    expect(receiveFromOrder.mock.calls[0]![0]).toMatchObject({ presentationId: 'p-1', orderPresentationLineId: 'linea-1', packages: 5 });
    expect(receiveFromOrder.mock.calls[1]![0]).toMatchObject({ presentationId: 'p-2', orderPresentationLineId: 'linea-2', packages: 3 });
  });

  it('R18: deriva un unico coste unitario del importe guardado entre la cantidad TOTAL producida, y lo pasa igual a todas las lineas', async () => {
    const lineas = [lineaDe({ id: 'linea-1', packages: 5, presentationContent: '1.0000' }), lineaDe({ id: 'linea-2', presentationId: 'p-2', packages: 5, presentationContent: '1.0000' })];
    const { finishPackingAliveById, receiveFromOrder } = montar({
      lines: lineas,
      finishPackingAlive: { kind: 'ok', recipeId: RECETA, quantity: '10.0000', ingredientsCost: '20.0000', unitId: LITRO },
    });

    await finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA);

    // 20.0000 / (5 + 5) = 2.0000, el MISMO valor en las dos llamadas.
    expect(receiveFromOrder.mock.calls[0]![0]).toMatchObject({ unitCost: '2.0000' });
    expect(receiveFromOrder.mock.calls[1]![0]).toMatchObject({ unitCost: '2.0000' });
  });

  it('R18: con un reparto en L y en ml, suma el total convertido a la unidad del pedido y cada lote lleva ese coste en su unidad', async () => {
    // Pedido de 100 L con coste 1000: 5 x 200 ml (= 1 L) y 60 x 1 L -> total 61 L.
    const lineas = [
      lineaDe({ id: 'linea-ml', presentationId: 'p-ml', packages: 5, presentationContent: '200.0000' }),
      lineaDe({ id: 'linea-l', presentationId: 'p-l', packages: 60, presentationContent: '1.0000' }),
    ];
    const catalogos = catalogosGlobales({
      presentationRefs: [
        { id: 'p-ml', content: '200.0000', unitId: MILILITRO },
        { id: 'p-l', content: '1.0000', unitId: LITRO },
      ],
    });
    const { finishPackingAliveById, receiveFromOrder } = montar({
      lines: lineas,
      catalogos,
      finishPackingAlive: { kind: 'ok', recipeId: RECETA, quantity: '100.0000', ingredientsCost: '1000.0000', unitId: LITRO },
    });

    await expect(finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toMatchObject({ kind: 'ok' });

    // 1000 / 61 L = 16.3934 por L; en ml, 1000 / 61000 ml = 0.0164 por ml. Sin convertir, el
    // total habria sido 1000 + 60 = 1060 y el coste 0.9434 para los dos lotes.
    const porMl = receiveFromOrder.mock.calls[0]![0] as { readonly unitCost: string };
    const porLitro = receiveFromOrder.mock.calls[1]![0] as { readonly unitCost: string };
    expect(porLitro.unitCost).toBe('16.3934');
    expect(porMl.unitCost).toBe('0.0164');

    // El valor de cada lote (existencia en su unidad x coste unitario) reparte el coste del
    // pedido: 16.40 + 983.604 = 1000.004, el redondeo a cuatro decimales del coste unitario.
    expect(1000 * Number(porMl.unitCost)).toBeCloseTo(16.39, 1);
    expect(60 * Number(porLitro.unitCost)).toBeCloseTo(983.61, 1);
    expect(1000 * Number(porMl.unitCost) + 60 * Number(porLitro.unitCost)).toBeCloseTo(1000, 1);
  });

  it('R18: una presentacion en la misma unidad que el pedido no se convierte', async () => {
    const lineas = [
      lineaDe({ id: 'linea-1', presentationId: 'p-1', packages: 3, presentationContent: '200.0000' }),
      lineaDe({ id: 'linea-2', presentationId: 'p-2', packages: 2, presentationContent: '200.0000' }),
    ];
    const catalogos = catalogosGlobales({
      presentationRefs: [
        { id: 'p-1', content: '200.0000', unitId: MILILITRO },
        { id: 'p-2', content: '200.0000', unitId: MILILITRO },
      ],
    });
    const { finishPackingAliveById, receiveFromOrder } = montar({
      lines: lineas,
      catalogos,
      finishPackingAlive: { kind: 'ok', recipeId: RECETA, quantity: '1000.0000', ingredientsCost: '50.0000', unitId: MILILITRO },
    });

    await finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA);

    // 50 / (600 + 400) ml = 0.0500 por ml, el mismo en los dos lotes.
    expect(receiveFromOrder.mock.calls[0]![0]).toMatchObject({ unitCost: '0.0500' });
    expect(receiveFromOrder.mock.calls[1]![0]).toMatchObject({ unitCost: '0.0500' });
  });

  it('R7, R18: una linea cuya unidad no comparte base con la del pedido rechaza con incompatible_units y NO da de alta ningun lote', async () => {
    const lineas = [
      lineaDe({ id: 'linea-l', presentationId: 'p-l', packages: 5, presentationContent: '1.0000' }),
      lineaDe({ id: 'linea-kg', presentationId: 'p-kg', packages: 5, presentationContent: '1.0000' }),
    ];
    const catalogos = catalogosGlobales({
      presentationRefs: [
        { id: 'p-l', content: '1.0000', unitId: LITRO },
        { id: 'p-kg', content: '1.0000', unitId: KILO },
      ],
    });
    const { finishPackingAliveById, receiveFromOrder } = montar({ lines: lineas, catalogos });

    await expect(finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toBe('incompatible_units');
    expect(receiveFromOrder).not.toHaveBeenCalled();
  });

  it('R18: un pedido con reparto y sin unidad rechaza con order_without_unit y NO da de alta ningun lote', async () => {
    const { finishPackingAliveById, receiveFromOrder } = montar({
      finishPackingAlive: { kind: 'ok', recipeId: RECETA, quantity: '10.0000', ingredientsCost: '20.0000', unitId: null },
    });

    await expect(finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toBe('order_without_unit');
    expect(receiveFromOrder).not.toHaveBeenCalled();
  });

  it('R18: sin importe guardado, recalcula el coste del lote con la receta que el pedido tiene AHORA', async () => {
    const catalogos = catalogosGlobales();
    const { finishPackingAliveById } = montar({
      lines: [lineaDe({ packages: 10, presentationContent: '1.0000' })],
      finishPackingAlive: { kind: 'ok', recipeId: RECETA, quantity: '10.0000', ingredientsCost: null, unitId: LITRO },
      catalogos,
    });

    await finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA);

    expect(catalogos.findRefsIncludingDeleted).toHaveBeenCalledWith([RECETA], EMPRESA);
  });

  it('QC-195 R31: sin importe guardado, el lote se costea con sus envases (promedio de sus lotes, contando lo del propio pedido)', async () => {
    const packaging = fakePackagingCatalog(
      [],
      [
        { productId: 'envase-1', unitCost: '0.5000', available: '100.0000' },
        { productId: 'envase-1', unitCost: '0.7000', available: '50.0000' },
      ],
    );
    const { finishPackingAliveById, receiveFromOrder } = montar({
      lines: [lineaDe({ packages: 10, presentationContent: '1.0000', packagingProductId: 'envase-1' })],
      finishPackingAlive: { kind: 'ok', recipeId: RECETA, quantity: '10.0000', ingredientsCost: null, unitId: LITRO },
      packaging,
    });

    await finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA);

    expect(packaging.findCostingBatches).toHaveBeenCalledWith(['envase-1'], EMPRESA, { excludeOrderId: PEDIDO });
    // Receta sin lineas (0.0000) + 10 envases x 0.60 = 6.0000, entre las 10 unidades que entran.
    expect(receiveFromOrder).toHaveBeenCalledWith(expect.objectContaining({ unitCost: '0.6000' }));
  });

  it('QC-195 R31: con importe guardado el lote usa ese importe y no vuelve a costear los envases', async () => {
    const packaging = fakePackagingCatalog();
    const { finishPackingAliveById } = montar({
      lines: [lineaDe({ packages: 10, presentationContent: '1.0000', packagingProductId: 'envase-1' })],
      packaging,
    });

    await finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA);

    expect(packaging.findCostingBatches).not.toHaveBeenCalled();
  });

  it('QC-195 R25: liquida los envases del reparto (solo esos productos) ANTES de dar de alta el producto terminado', async () => {
    const orden: string[] = [];
    const settlePackagingForOrder = vi.fn(async () => {
      orden.push('settlePackagingForOrder');
      return { kind: 'consumed' as const };
    });
    const receiveFromOrder = vi.fn(async (input: { readonly presentationId: string; readonly packages: number }) => {
      orden.push('receiveFromOrder');
      return { kind: 'received' as const, productId: 'pt-1', productName: 'Desengrasante', packages: String(input.packages) };
    });
    const { finishPackingAliveById } = montar({
      lines: [
        lineaDe({ id: 'linea-1', packages: 6, packagingProductId: 'envase-1' }),
        lineaDe({ id: 'linea-2', presentationId: 'p-2', packages: 4, packagingProductId: 'envase-2' }),
        lineaDe({ id: 'linea-3', presentationId: 'p-3', packages: 2, packagingProductId: 'envase-1' }),
      ],
      settlePackagingForOrder,
      receiveFromOrder,
      finishPackingAlive: { kind: 'ok', recipeId: RECETA, quantity: '12.0000', ingredientsCost: '20.0000', unitId: LITRO },
    });

    await expect(finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toMatchObject({ kind: 'ok' });

    expect(settlePackagingForOrder).toHaveBeenCalledTimes(1);
    expect(settlePackagingForOrder).toHaveBeenCalledWith({
      orderId: PEDIDO,
      companyId: EMPRESA,
      requirement: [
        { productId: 'envase-1', quantity: '8' },
        { productId: 'envase-2', quantity: '4' },
      ],
      actorId: EMPACADOR,
      now: AHORA,
    });
    expect(orden).toEqual(['settlePackagingForOrder', 'receiveFromOrder', 'receiveFromOrder', 'receiveFromOrder']);
  });

  it('QC-195 R25, R18: si los envases no alcanzan, Terminar rechaza con packaging_stock_insufficient y NO da de alta ningun lote', async () => {
    const settlePackagingForOrder = vi.fn(async () => ({ kind: 'insufficient' as const, productIds: ['envase-1'] }));
    const { finishPackingAliveById, receiveFromOrder, deshecho } = montar({
      lines: [lineaDe({ packages: 10, packagingProductId: 'envase-1' })],
      settlePackagingForOrder,
    });

    await expect(finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toBe('packaging_stock_insufficient');
    expect(receiveFromOrder).not.toHaveBeenCalled();
    expect(deshecho()).toBe(true);
  });

  it('QC-195 R33: un reparto solo con lineas antiguas, sin envase, no consume nada y da de alta su producto terminado como hoy', async () => {
    const { finishPackingAliveById, receiveFromOrder, consumeForOrder, settlePackagingForOrder } = montar({
      lines: [lineaDe({ packages: 10, packagingProductId: null })],
    });

    await expect(finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toMatchObject({ kind: 'ok' });
    expect(consumeForOrder).not.toHaveBeenCalled();
    expect(settlePackagingForOrder).not.toHaveBeenCalled();
    expect(receiveFromOrder).toHaveBeenCalledWith(expect.objectContaining({ presentationId: 'p-1', packages: 10 }));
  });

  it('QC-195 R25, R33: con una linea antigua y una con envase, solo se consume el envase y se dan de alta las dos', async () => {
    const { finishPackingAliveById, receiveFromOrder, consumeForOrder, settlePackagingForOrder } = montar({
      lines: [
        lineaDe({ id: 'linea-antigua', packages: 3, packagingProductId: null }),
        lineaDe({ id: 'linea-nueva', presentationId: 'p-2', packages: 7, packagingProductId: 'envase-1' }),
      ],
    });

    await expect(finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toMatchObject({ kind: 'ok' });
    expect(settlePackagingForOrder).toHaveBeenCalledWith(
      expect.objectContaining({ requirement: [{ productId: 'envase-1', quantity: '7' }] }),
    );
    expect(consumeForOrder).not.toHaveBeenCalled();
    expect(receiveFromOrder).toHaveBeenCalledTimes(2);
  });

  it('QC-195 R43: un envase que es tambien ingrediente no se liquida con el conteo; solo se consume lo que siga apartado de el', async () => {
    const { finishPackingAliveById, consumeForOrder, settlePackagingForOrder, receiveFromOrder } = montar({
      lines: [
        lineaDe({ id: 'linea-1', packages: 6, packagingProductId: 'envase-ingrediente' }),
        lineaDe({ id: 'linea-2', presentationId: 'p-2', packages: 4, packagingProductId: 'envase-1' }),
      ],
      ingredientes: ['materia-1', 'envase-ingrediente'],
    });

    await expect(finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toMatchObject({ kind: 'ok' });
    expect(settlePackagingForOrder).toHaveBeenCalledWith(
      expect.objectContaining({ requirement: [{ productId: 'envase-1', quantity: '4' }] }),
    );
    expect(consumeForOrder).toHaveBeenCalledWith(
      expect.objectContaining({ productIds: ['envase-ingrediente'], fallbackRequirement: [] }),
    );
    expect(receiveFromOrder).toHaveBeenCalledTimes(2);
  });

  it('QC-195 R43: si todos los envases son ingredientes, no se liquida ninguno, el respaldo va vacio y Terminar no falla por ellos', async () => {
    const consumeForOrder = vi.fn(async () => ({ kind: 'nothing_to_consume' as const }));
    const { finishPackingAliveById, receiveFromOrder, settlePackagingForOrder } = montar({
      lines: [lineaDe({ packages: 10, packagingProductId: 'envase-ingrediente' })],
      ingredientes: ['envase-ingrediente'],
      consumeForOrder,
    });

    await expect(finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toMatchObject({ kind: 'ok' });
    expect(consumeForOrder).toHaveBeenCalledWith(
      expect.objectContaining({ productIds: ['envase-ingrediente'], fallbackRequirement: [] }),
    );
    expect(settlePackagingForOrder).not.toHaveBeenCalled();
    expect(receiveFromOrder).toHaveBeenCalledTimes(1);
  });

  it('R19: una linea sin contenido copiado ni vigente rechaza con presentation_without_content y NO da de alta ningun lote', async () => {
    const lineas = [lineaDe({ id: 'linea-1', packages: 5 }), lineaDe({ id: 'linea-2', presentationId: 'p-2', packages: 5, presentationContent: null })];
    const catalogos = catalogosGlobales({ presentationRefs: [{ id: 'p-2', content: null }] });
    const { finishPackingAliveById, receiveFromOrder } = montar({ lines: lineas, catalogos });

    await expect(finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toBe('presentation_without_content');
    expect(receiveFromOrder).not.toHaveBeenCalled();
  });

  it('R19: una linea sin contenido copiado se rescata con el contenido vigente de la presentacion', async () => {
    const lineas = [lineaDe({ id: 'linea-1', presentationId: 'p-2', packages: 4, presentationContent: null })];
    const catalogos = catalogosGlobales({ presentationRefs: [{ id: 'p-2', content: '2.0000' }] });
    const { finishPackingAliveById, receiveFromOrder } = montar({ lines: lineas, catalogos });

    await expect(finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toMatchObject({ kind: 'ok' });
    expect(receiveFromOrder).toHaveBeenCalledWith(expect.objectContaining({ orderContent: '2.0000' }));
  });

  it('R19: el `receiveFromOrder` de la primera linea rechazando (defensa de inventario) tambien deshace todo', async () => {
    const lineas = [lineaDe({ id: 'linea-1', packages: 5 }), lineaDe({ id: 'linea-2', presentationId: 'p-2', packages: 5 })];
    const receiveFromOrder = vi.fn(async () => ({ kind: 'presentation_without_content' as const }));
    const { finishPackingAliveById } = montar({ lines: lineas, receiveFromOrder });

    await expect(finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toBe('presentation_without_content');
    expect(receiveFromOrder).toHaveBeenCalledTimes(1);
  });

  it('recipe_not_found: la receta del pedido ya no existe para esa empresa, sin dar de alta nada', async () => {
    const catalogos = catalogosGlobales({ recipeFound: false });
    const { finishPackingAliveById, receiveFromOrder } = montar({ catalogos });

    await expect(finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toBe('recipe_not_found');
    expect(receiveFromOrder).not.toHaveBeenCalled();
  });

  // QC-172 R36, llevado aqui en el merge con QC-170: la entrada de producto terminado ya no la da
  // Finalizar sino Terminar el empaque, una por linea del reparto. El pedido guarda el id de la
  // version, y cada linea entra al producto de ESA version con el nombre compuesto del catalogo.
  it('QC-172 R36: un pedido con version da de alta cada linea con el id de la version y el nombre «Original · Version»', async () => {
    const VERSION = 'r-version';
    const base = catalogosGlobales();
    const findRefsIncludingDeleted = vi.fn(async (ids: readonly string[]) =>
      ids.map((id) => ({
        id,
        name: 'Crema base · Sin perfume',
        ownName: 'Sin perfume',
        isUnderReview: false,
        original: { id: 'r-original', name: 'Crema base' },
        isDeleted: false,
        imageUrl: null,
      })),
    );
    const catalogos = { ...base, recipes: { ...base.recipes, findRefsIncludingDeleted }, findRefsIncludingDeleted };
    const lineas = [lineaDe({ id: 'linea-1', presentationId: 'p-1', packages: 5 }), lineaDe({ id: 'linea-2', presentationId: 'p-2', packages: 3 })];
    const { finishPackingAliveById, receiveFromOrder } = montar({
      lines: lineas,
      catalogos,
      finishPackingAlive: { kind: 'ok', recipeId: VERSION, quantity: '10.0000', ingredientsCost: '20.0000', unitId: LITRO },
    });

    await expect(finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA)).resolves.toMatchObject({ kind: 'ok' });

    expect(findRefsIncludingDeleted).toHaveBeenCalledWith([VERSION], EMPRESA);
    expect(receiveFromOrder).toHaveBeenCalledTimes(2);
    for (const call of receiveFromOrder.mock.calls) {
      expect(call[0]).toMatchObject({ recipeId: VERSION, recipeName: 'Crema base · Sin perfume' });
    }
  });

  it('R7 terminar el empaque costea el lote con la necesidad convertida', async () => {
    const base = catalogosGlobales();
    const catalogos = {
      ...base,
      recipes: {
        ...base.recipes,
        findExecutionContentById: async () => ({
          id: RECETA,
          name: 'Desengrasante',
          isDeleted: false,
          steps: [],
          lines: [{ productId: 'materia', productName: null, percentage: '100.00' }],
          tools: [],
        }),
      } as unknown as RecipeCatalog,
      products: {
        findRefs: async () => [{ id: 'materia', name: 'materia', unitId: LITRO, stockByUnit: [], type: 'PRODUCT' }],
        findCostingBatches: async () => [
          { productId: 'materia', lot: '1', stock: '100', available: '100', unitCost: '2.0000', unitId: LITRO, purchaseDate: '2026-01-01' },
        ],
      } as unknown as ProductCatalog,
    };
    const { finishPackingAliveById, receiveFromOrder } = montar({
      lines: [lineaDe({ packages: 10, presentationContent: '0.1000' })],
      finishPackingAlive: { kind: 'ok', recipeId: RECETA, quantity: '1000.0000', ingredientsCost: null, unitId: MILILITRO },
      catalogos,
    });

    await finishPackingAliveById(PEDIDO, EMPRESA, EMPACADOR, AHORA);

    // 1000 ml son 1 L a 2.0000: el lote cuesta 2.0000 y sus 10 x 0,1 L salen a 2.0000 por litro.
    // Sin convertir, 1000 L costarian 2000.0000 por litro.
    expect(receiveFromOrder).toHaveBeenCalledWith(expect.objectContaining({ unitCost: '2.0000' }));
  });
});

describe('createFinishPacking con el conteo real de envases', () => {
  function montarConteo(options: {
    readonly lines: readonly FinishPackingLine[];
    readonly quantity?: string;
    readonly ingredientsCost?: string | null;
    readonly catalogos?: ReturnType<typeof catalogosGlobales>;
    readonly packaging?: PackagingCatalog;
    readonly settlePackagingForOrder?: ReturnType<typeof vi.fn>;
    readonly finishPackingAlive?: FinishPackingUpdateOutcome;
  }) {
    const orden: string[] = [];
    const finishPackingAlive = vi.fn(async (): Promise<FinishPackingUpdateOutcome> => {
      orden.push('finishPackingAlive');
      return (
        options.finishPackingAlive ?? {
          kind: 'ok',
          recipeId: RECETA,
          quantity: options.quantity ?? '10.0000',
          ingredientsCost: options.ingredientsCost === undefined ? '20.0000' : options.ingredientsCost,
          unitId: LITRO,
        }
      );
    });
    const findPresentationLinesForFinish = vi.fn(async () => options.lines);
    const recordPackedCounts = vi.fn(async () => {
      orden.push('recordPackedCounts');
    });
    const settlePackagingForOrder =
      options.settlePackagingForOrder ??
      vi.fn(async () => {
        orden.push('settlePackagingForOrder');
        return { kind: 'consumed' as const };
      });
    const receiveFromOrder = vi.fn(async (input: { readonly presentationId: string; readonly packages: number }) => {
      orden.push('receiveFromOrder');
      return {
        kind: 'received' as const,
        productId: `producto-${input.presentationId}`,
        productName: `PT ${input.presentationId}`,
        packages: String(input.packages),
      };
    });
    const { unitOfWork, reservations } = fakeUnitOfWork({
      orders: { finishPackingAlive, findPresentationLinesForFinish, recordPackedCounts },
      reservations: { settlePackagingForOrder: settlePackagingForOrder as unknown as MaterialReservations['settlePackagingForOrder'] },
      finishedGoods: { receiveFromOrder: receiveFromOrder as unknown as FinishedGoodsIntake['receiveFromOrder'] },
    });
    const catalogos = options.catalogos ?? catalogosGlobales();
    let deshecho = false;
    const finish = createFinishPacking({
      packing: packingDoble(),
      unitOfWork: {
        run: async (work) => {
          try {
            return await unitOfWork.run(work);
          } catch (error) {
            deshecho = true;
            throw error;
          }
        },
      },
      recipes: catalogos.recipes,
      products: catalogos.products,
      units: catalogos.units,
      presentations: catalogos.presentations,
      packaging: options.packaging ?? fakePackagingCatalog(),
    });
    return {
      terminar: (counts: readonly PackedLineCount[]) => finish(PEDIDO, EMPRESA, EMPACADOR, AHORA, counts),
      orden,
      findPresentationLinesForFinish,
      recordPackedCounts,
      settlePackagingForOrder,
      consumeForOrder: reservations.consumeForOrder,
      receiveFromOrder,
      deshecho: () => deshecho,
    };
  }

  const DOS_LINEAS = [
    lineaDe({ id: 'linea-1', presentationId: 'p-1', packages: 5, packagingProductId: 'envase-1' }),
    lineaDe({ id: 'linea-2', presentationId: 'p-2', packages: 5, packagingProductId: 'envase-2' }),
  ];

  /** Pedido de 1 L repartido en 200 ml y en 0,4 L. */
  function lineasMixtas() {
    return {
      lines: [
        lineaDe({ id: 'linea-ml', presentationId: 'p-ml', packages: 2, presentationContent: '200.0000', packagingProductId: 'envase-ml' }),
        lineaDe({ id: 'linea-l', presentationId: 'p-l', packages: 1, presentationContent: '0.4000', packagingProductId: 'envase-l' }),
      ],
      catalogos: catalogosGlobales({
        presentationRefs: [
          { id: 'p-ml', content: '200.0000', unitId: MILILITRO },
          { id: 'p-l', content: '0.4000', unitId: LITRO },
        ],
      }),
      quantity: '1.0000',
    };
  }

  describe('R13: un conteo que no casa con las lineas rechaza con invalid_packing_count y deshace todo', () => {
    const casos: ReadonlyArray<readonly [string, readonly PackedLineCount[]]> = [
      ['falta una linea', [conteo('linea-1', 5)]],
      ['sobra una linea', [conteo('linea-1', 5), conteo('linea-2', 5), conteo('linea-ajena', 1)]],
      ['una linea repetida', [conteo('linea-1', 5), conteo('linea-1', 5), conteo('linea-2', 5)]],
      ['envases negativos', [conteo('linea-1', -1, 'merma'), conteo('linea-2', 5)]],
      ['envases no enteros', [conteo('linea-1', 4.5, 'merma'), conteo('linea-2', 5)]],
      ['diferencia sin motivo', [conteo('linea-1', 4), conteo('linea-2', 5)]],
      ['motivo sin diferencia', [conteo('linea-1', 5, 'rotura'), conteo('linea-2', 5)]],
      ['merma para envases de mas', [conteo('linea-1', 4, 'rotura'), conteo('linea-2', 6, 'merma')]],
      ['otro sin texto', [conteo('linea-1', 4, 'otro', '   '), conteo('linea-2', 5)]],
      ['otro con 201 caracteres', [conteo('linea-1', 4, 'otro', 'x'.repeat(201)), conteo('linea-2', 5)]],
      ['texto sin otro', [conteo('linea-1', 4, 'rotura', 'se cayo'), conteo('linea-2', 5)]],
    ];

    for (const [nombre, counts] of casos) {
      it(`R13, R22: ${nombre}`, async () => {
        const m = montarConteo({ lines: DOS_LINEAS });

        await expect(m.terminar(counts)).resolves.toBe('invalid_packing_count');

        expect(m.deshecho()).toBe(true);
        expect(m.recordPackedCounts).not.toHaveBeenCalled();
        expect(m.settlePackagingForOrder).not.toHaveBeenCalled();
        expect(m.receiveFromOrder).not.toHaveBeenCalled();
      });
    }

    it('R13: «Otro» con 200 caracteres tras recortar se acepta', async () => {
      const m = montarConteo({ lines: DOS_LINEAS });

      await expect(
        m.terminar([conteo('linea-1', 4, 'otro', `  ${'x'.repeat(200)}  `), conteo('linea-2', 5)]),
      ).resolves.toMatchObject({ kind: 'ok' });
    });
  });

  it('R1: lo envasado por encima de la cantidad, sumado en la unidad del pedido, se acepta sin tope propio', async () => {
    const { lines, catalogos, quantity } = lineasMixtas();
    const m = montarConteo({ lines, catalogos, quantity });

    // 4 x 200 ml + 1 x 0,4 L = 1,2 L de un pedido de 1 L.
    await expect(m.terminar([conteo('linea-ml', 4, 'conteo_fisico'), conteo('linea-l', 1)])).resolves.toMatchObject({ kind: 'ok' });

    expect(m.deshecho()).toBe(false);
    expect(m.recordPackedCounts).toHaveBeenCalled();
    expect(m.settlePackagingForOrder).toHaveBeenCalled();
    expect(m.receiveFromOrder).toHaveBeenCalled();
  });

  it('R15: lo envasado igual a la cantidad del pedido, con unidades mixtas, se acepta', async () => {
    const { lines, catalogos, quantity } = lineasMixtas();
    const m = montarConteo({ lines, catalogos, quantity });

    // 3 x 200 ml + 1 x 0,4 L = 1 L justo.
    await expect(m.terminar([conteo('linea-ml', 3, 'conteo_fisico'), conteo('linea-l', 1)])).resolves.toMatchObject({ kind: 'ok' });
    expect(m.deshecho()).toBe(false);
  });

  it('R16: guarda el conteo de cada linea con el ambito de la empresa, tras mover el estado y antes de liquidar los envases', async () => {
    const m = montarConteo({ lines: DOS_LINEAS });
    const counts = [conteo('linea-1', 4, 'otro', 'se derramo'), conteo('linea-2', 6, 'conteo_fisico')];

    await expect(m.terminar(counts)).resolves.toMatchObject({ kind: 'ok' });

    expect(m.recordPackedCounts).toHaveBeenCalledExactlyOnceWith(PEDIDO, counts, { companyId: EMPRESA });
    expect(m.orden.slice(0, 3)).toEqual(['finishPackingAlive', 'recordPackedCounts', 'settlePackagingForOrder']);
  });

  it('R17, R18, R19: liquida cada envase con sus envases reales; una linea en 0 pide 0, no se omite', async () => {
    const lineas = [
      lineaDe({ id: 'linea-1', presentationId: 'p-1', packages: 4, packagingProductId: 'envase-1' }),
      lineaDe({ id: 'linea-2', presentationId: 'p-2', packages: 3, packagingProductId: 'envase-2' }),
      lineaDe({ id: 'linea-3', presentationId: 'p-3', packages: 2, packagingProductId: 'envase-3' }),
    ];
    const m = montarConteo({ lines: lineas });

    await m.terminar([conteo('linea-1', 3, 'rotura'), conteo('linea-2', 4, 'error_de_carga'), conteo('linea-3', 0, 'merma')]);

    expect(m.settlePackagingForOrder).toHaveBeenCalledExactlyOnceWith({
      orderId: PEDIDO,
      companyId: EMPRESA,
      requirement: [
        { productId: 'envase-1', quantity: '3' },
        { productId: 'envase-2', quantity: '4' },
        { productId: 'envase-3', quantity: '0' },
      ],
      actorId: EMPACADOR,
      now: AHORA,
    });
    expect(m.consumeForOrder).not.toHaveBeenCalled();
  });

  it('R18: dos lineas con el mismo envase se liquidan juntas, con la suma de sus envases reales', async () => {
    const lineas = [
      lineaDe({ id: 'linea-1', presentationId: 'p-1', packages: 4, packagingProductId: 'envase-1' }),
      lineaDe({ id: 'linea-2', presentationId: 'p-2', packages: 3, packagingProductId: 'envase-1' }),
    ];
    const m = montarConteo({ lines: lineas });

    await m.terminar([conteo('linea-1', 5, 'conteo_fisico'), conteo('linea-2', 2, 'rotura')]);

    expect(m.settlePackagingForOrder).toHaveBeenCalledWith(
      expect.objectContaining({ requirement: [{ productId: 'envase-1', quantity: '7' }] }),
    );
  });

  it('R18, R22: sin existencia libre para el exceso rechaza con packaging_stock_insufficient, deshace todo y ningun lote nace', async () => {
    const settlePackagingForOrder = vi.fn(async () => ({ kind: 'insufficient' as const, productIds: ['envase-2'] }));
    const m = montarConteo({ lines: DOS_LINEAS, settlePackagingForOrder, quantity: '11.0000' });

    await expect(m.terminar([conteo('linea-1', 5), conteo('linea-2', 6, 'conteo_fisico')])).resolves.toBe(
      'packaging_stock_insufficient',
    );

    expect(m.deshecho()).toBe(true);
    expect(m.receiveFromOrder).not.toHaveBeenCalled();
  });

  it('R19, R20: da de alta un lote por linea con envases reales y su contenido, y ninguno por la linea en 0', async () => {
    const lineas = [
      lineaDe({ id: 'linea-1', presentationId: 'p-1', packages: 4, packagingProductId: 'envase-1' }),
      lineaDe({ id: 'linea-2', presentationId: 'p-2', packages: 3, presentationContent: '2.0000', packagingProductId: 'envase-2' }),
    ];
    const catalogos = catalogosGlobales({ presentationRefs: [{ id: 'p-2', content: '2.0000' }] });
    const m = montarConteo({ lines: lineas, catalogos });

    const resultado = await m.terminar([conteo('linea-1', 0, 'merma'), conteo('linea-2', 2, 'rotura')]);

    expect(resultado).toEqual({ kind: 'ok', finishedGoods: [{ productName: 'PT p-2', packages: '2' }] });
    expect(m.receiveFromOrder).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ orderPresentationLineId: 'linea-2', packages: 2, orderContent: '2.0000' }),
    );
  });

  it('R32: con todas las lineas en 0 termina ok, sin ningun lote y liquidando todos los envases a 0', async () => {
    const m = montarConteo({ lines: DOS_LINEAS });

    await expect(
      m.terminar([conteo('linea-1', 0, 'merma'), conteo('linea-2', 0, 'otro', 'lote contaminado')]),
    ).resolves.toEqual({ kind: 'ok', finishedGoods: [] });

    expect(m.deshecho()).toBe(false);
    expect(m.receiveFromOrder).not.toHaveBeenCalled();
    expect(m.settlePackagingForOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        requirement: [
          { productId: 'envase-1', quantity: '0' },
          { productId: 'envase-2', quantity: '0' },
        ],
      }),
    );
  });

  it('R21: el coste guardado se reparte entre lo envasado de verdad y la suma de los lotes es el coste del pedido', async () => {
    const lineas = [
      lineaDe({ id: 'linea-ml', presentationId: 'p-ml', packages: 5, presentationContent: '200.0000', packagingProductId: 'envase-ml' }),
      lineaDe({ id: 'linea-l', presentationId: 'p-l', packages: 9, presentationContent: '1.0000', packagingProductId: 'envase-l' }),
    ];
    const catalogos = catalogosGlobales({
      presentationRefs: [
        { id: 'p-ml', content: '200.0000', unitId: MILILITRO },
        { id: 'p-l', content: '1.0000', unitId: LITRO },
      ],
    });
    const m = montarConteo({ lines: lineas, catalogos, ingredientsCost: '80.0000' });

    // Real: 5 x 200 ml (1 L) + 7 x 1 L = 8 L, frente a los 10 L del plan.
    await m.terminar([conteo('linea-ml', 5), conteo('linea-l', 7, 'rotura')]);

    const porMl = m.receiveFromOrder.mock.calls[0]![0] as unknown as { readonly unitCost: string };
    const porLitro = m.receiveFromOrder.mock.calls[1]![0] as unknown as { readonly unitCost: string };
    expect(porLitro.unitCost).toBe('10.0000');
    expect(porMl.unitCost).toBe('0.0100');
    expect(1000 * Number(porMl.unitCost) + 7 * Number(porLitro.unitCost)).toBeCloseTo(80, 4);
  });

  it('R21: sin importe guardado, el coste total sale del plan, envases del plan incluidos, y se reparte entre lo real', async () => {
    const packaging = fakePackagingCatalog([], [{ productId: 'envase-1', unitCost: '0.6000', available: '100.0000' }]);
    const m = montarConteo({
      lines: [lineaDe({ id: 'linea-1', packages: 10, packagingProductId: 'envase-1' })],
      ingredientsCost: null,
      packaging,
    });

    await m.terminar([conteo('linea-1', 8, 'merma')]);

    // Receta sin lineas + 10 envases del plan x 0,60 = 6,00, repartido entre los 8 L envasados.
    expect(m.receiveFromOrder).toHaveBeenCalledWith(expect.objectContaining({ packages: 8, unitCost: '0.7500' }));
  });

  it('R30: un segundo envio sobre un pedido que ya salio de EN_EMPAQUE devuelve not_packable sin leer, guardar ni consumir nada', async () => {
    const m = montarConteo({ lines: DOS_LINEAS, finishPackingAlive: { kind: 'not_packable' } });

    await expect(m.terminar([conteo('linea-1', 5), conteo('linea-2', 5)])).resolves.toBe('not_packable');

    expect(m.findPresentationLinesForFinish).not.toHaveBeenCalled();
    expect(m.recordPackedCounts).not.toHaveBeenCalled();
    expect(m.settlePackagingForOrder).not.toHaveBeenCalled();
    expect(m.receiveFromOrder).not.toHaveBeenCalled();
  });
});
