// tests/unit/asignaciones/get-assigned-order-execution.test.ts
import { describe, expect, it, vi } from 'vitest';

import {
  createGetAssignedOrderExecution,
  type GetAssignedOrderExecutionDeps,
} from '@/lib/modules/asignaciones/domain/get-assigned-order-execution';
import {
  AsignacionesError,
  OrderBlockedError,
  OrderNotFoundError,
  UnauthorizedError,
} from '@/lib/modules/asignaciones/domain/errors';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';
import type { AssignedOrderExecutionView } from '@/lib/modules/asignaciones/domain/assigned-order-execution-view';
import type { OrderAssignmentRepository } from '@/lib/modules/asignaciones/ports/order-assignment-repository';
import type { EvidenceStorage } from '@/lib/modules/asignaciones/ports/evidence-storage';
import type {
  StepEvidenceRepository,
  StepEvidenceRow,
} from '@/lib/modules/asignaciones/ports/step-evidence-repository';
import type { AssignedOrderSummary, OrderCatalog, OrderStatus } from '@/lib/modules/pedidos';
import type { RecipeCatalog, RecipeExecutionContent } from '@/lib/modules/recetas';
import type { PresentationCatalog, PresentationRef, ProductCatalog, ProductRef } from '@/lib/modules/inventario';
import type { MassVolumeBridge, UnitCatalog, UnitRef } from '@/lib/modules/unidades';

function uuid(seed: string): string {
  return `${seed.repeat(8)}-${seed.repeat(4)}-4${seed.repeat(3)}-8${seed.repeat(3)}-${seed.repeat(12)}`;
}

const EMPRESA = uuid('3');
const ANA = uuid('1');
const PEDIDO = uuid('7');
const RECETA = uuid('a');
const PRODUCTO = uuid('c');
const LITRO = uuid('d');
const MILILITRO = uuid('e');
const KILOGRAMO = uuid('f');

const ACTOR: Actor = {
  id: ANA,
  companyId: EMPRESA,
  permissions: ['asignaciones.consultar', 'asignaciones.ejecutar'],
};

function resumen(overrides?: Partial<AssignedOrderSummary>): AssignedOrderSummary {
  return {
    id: PEDIDO,
    number: { year: 2026, sequence: 1 },
    recipeId: RECETA,
    quantity: '200',
    priority: 'MEDIA',
    status: 'PENDIENTE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    presentationLines: [],
    unitId: null,
    finishedAt: null,
    packedBy: null,
    conditionedBy: null,
    ...overrides,
  };
}

function contenido(overrides?: Partial<RecipeExecutionContent>): RecipeExecutionContent {
  return {
    id: RECETA,
    name: 'Jabon liquido',
    isDeleted: false,
    steps: [],
    lines: [{ productId: PRODUCTO, productName: null, percentage: '10.00' }],
    tools: [],
    ...overrides,
  };
}

function producto(overrides?: Partial<ProductRef>): ProductRef {
  return { id: PRODUCTO, name: 'Hipoclorito', unitId: LITRO, stockByUnit: [], type: 'PRODUCT', ...overrides };
}

function unidad(overrides?: Partial<UnitRef>): UnitRef {
  return { id: LITRO, name: 'Litro', symbol: 'L', baseUnitId: null, factor: null, ...overrides };
}

const PRESENTACION = uuid('b');

function presentacion(overrides?: Partial<PresentationRef>): PresentationRef {
  return { id: PRESENTACION, name: 'Bidon 20L', content: null, unitId: LITRO, ...overrides };
}

type Dobles = {
  readonly deps: GetAssignedOrderExecutionDeps;
  readonly listOrderIdsByUserInCompany: ReturnType<typeof vi.fn>;
  readonly findAliveById: ReturnType<typeof vi.fn>;
  readonly listAliveSummariesByIds: ReturnType<typeof vi.fn>;
  readonly findExecutionContentById: ReturnType<typeof vi.fn>;
  readonly findRefs: ReturnType<typeof vi.fn>;
  readonly findRefsSharingBaseInCompany: ReturnType<typeof vi.fn>;
  readonly findMassVolumeBridge: ReturnType<typeof vi.fn>;
  readonly productFindRefs: ReturnType<typeof vi.fn>;
  readonly findRefsPresentations: ReturnType<typeof vi.fn>;
  readonly listEvidenceByOrder: ReturnType<typeof vi.fn>;
  readonly createSignedReadUrl: ReturnType<typeof vi.fn>;
  readonly todos: readonly ReturnType<typeof vi.fn>[];
};

function montar(options?: {
  readonly ids?: readonly string[];
  readonly order?: { id: string; status: OrderStatus } | null;
  readonly summary?: AssignedOrderSummary;
  readonly content?: RecipeExecutionContent | null;
  readonly products?: readonly ProductRef[];
  readonly ownUnits?: readonly UnitRef[];
  readonly sisterUnits?: readonly UnitRef[];
  readonly presentations?: readonly PresentationRef[];
  readonly bridge?: MassVolumeBridge | null;
  readonly fotos?: readonly StepEvidenceRow[];
}): Dobles {
  const listOrderIdsByUserInCompany = vi.fn(async () => options?.ids ?? [PEDIDO]);
  const listByOrderInCompany = vi.fn(async () => {
    throw new Error('no se necesita para leer la ejecucion');
  });
  const listByOrdersInCompany = vi.fn(async () => {
    throw new Error('no se necesita para leer la ejecucion');
  });
  const insertMissing = vi.fn(async () => 0);
  const deleteOne = vi.fn(async () => 'ok' as const);
  const deleteByWorkGroup = vi.fn(async () => 0);

  const findAliveById = vi.fn(async () =>
    options?.order === undefined ? { id: PEDIDO, status: 'PENDIENTE' as const } : options.order,
  );
  const summary = options?.summary ?? resumen();
  const listAliveSummariesByIds = vi.fn(async () => ({
    items: [summary],
    total: 1,
    page: 1,
    pageSize: 1,
    totalPages: 1,
  }));
  const transitionAliveById = vi.fn(async () => {
    throw new Error('la lectura no transiciona nada');
  });

  const findRefsIncludingDeleted = vi.fn(async () => {
    throw new Error('no se necesita para leer la ejecucion');
  });
  const findExecutionContentById = vi.fn(async () =>
    options?.content === undefined ? contenido() : options.content,
  );

  const findRefs = vi.fn(async () => options?.ownUnits ?? [unidad()]);
  const findRefsSharingBaseInCompany = vi.fn(async () => options?.sisterUnits ?? []);
  const findMassVolumeBridge = vi.fn(async () => options?.bridge ?? null);

  const productFindRefs = vi.fn(async () => options?.products ?? [producto()]);

  const findRefsPresentations = vi.fn(async () => options?.presentations ?? []);

  const listEvidenceByOrder = vi.fn(async () => options?.fotos ?? []);
  const createSignedReadUrl = vi.fn(async (path: string, ttl: number) => `https://bucket.test/${path}?ttl=${String(ttl)}`);

  const deps: GetAssignedOrderExecutionDeps = {
    assignments: {
      insertMissing,
      listByOrderInCompany,
      listByOrdersInCompany,
      deleteOne,
      deleteByWorkGroup,
      listOrderIdsByUserInCompany,
    } as OrderAssignmentRepository,
    orders: { findAliveById, listAliveSummariesByIds, transitionAliveById } as unknown as OrderCatalog,
    recipes: { findRefsIncludingDeleted, findExecutionContentById } as unknown as RecipeCatalog,
    units: { findRefs, findRefsSharingBaseInCompany, listVisibleRefs: () => Promise.reject(new Error('no se usa')), findMassVolumeBridge } as UnitCatalog,
    products: {
      findRefs: productFindRefs,
      findCostingBatches: vi.fn(async () => {
        throw new Error('la ejecucion de un pedido asignado no costea nada');
      }),
      findFinishedGoodsReceipts: vi.fn(async () => []),
    } as ProductCatalog,
    presentations: { findRefs: findRefsPresentations } as unknown as PresentationCatalog,
    evidence: { listByOrder: listEvidenceByOrder } as unknown as StepEvidenceRepository,
    storage: { createSignedReadUrl } as unknown as EvidenceStorage,
  };

  return {
    deps,
    listOrderIdsByUserInCompany,
    findAliveById,
    listAliveSummariesByIds,
    findExecutionContentById,
    findRefs,
    findRefsSharingBaseInCompany,
    findMassVolumeBridge,
    productFindRefs,
    findRefsPresentations,
    listEvidenceByOrder,
    createSignedReadUrl,
    todos: [
      listOrderIdsByUserInCompany,
      listByOrderInCompany,
      listByOrdersInCompany,
      insertMissing,
      deleteOne,
      deleteByWorkGroup,
      findAliveById,
      listAliveSummariesByIds,
      transitionAliveById,
      findRefsIncludingDeleted,
      findExecutionContentById,
      findRefs,
      findRefsSharingBaseInCompany,
      findMassVolumeBridge,
      productFindRefs,
      findRefsPresentations,
      listEvidenceByOrder,
      createSignedReadUrl,
    ],
  };
}

describe('getAssignedOrderExecution — autorizacion', () => {
  it('R5: exige `asignaciones.ejecutar` ANTES de tocar ningun puerto', async () => {
    const { deps, todos } = montar();
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    await expect(
      getAssignedOrderExecution({ id: ANA, companyId: EMPRESA, permissions: [] }, { orderId: PEDIDO }),
    ).rejects.toThrow(UnauthorizedError);
    for (const doble of todos) expect(doble).not.toHaveBeenCalled();
  });

  it('R5: un actor ausente rechaza sin tocar ningun puerto', async () => {
    const { deps, todos } = montar();
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    await expect(getAssignedOrderExecution(null, { orderId: PEDIDO })).rejects.toBeInstanceOf(AsignacionesError);
    for (const doble of todos) expect(doble).not.toHaveBeenCalled();
  });
});

describe('getAssignedOrderExecution — R6: no es tuyo', () => {
  it('pedido existente pero no asignado a quien lo pide devuelve `order_not_found`', async () => {
    const { deps, findAliveById } = montar({ ids: [] });
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const error = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OrderNotFoundError);
    expect((error as OrderNotFoundError).code).toBe('order_not_found');
    expect(findAliveById).not.toHaveBeenCalled();
  });
});

describe('getAssignedOrderExecution — R7: la empresa', () => {
  it('pedido de otra empresa (no vivo para el actor) devuelve el mismo `order_not_found`', async () => {
    const { deps } = montar({ order: null });
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const error = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OrderNotFoundError);
    expect((error as OrderNotFoundError).code).toBe('order_not_found');
  });

  it('lee el pedido con la empresa del ACTOR, nunca de la entrada', async () => {
    const { deps, findAliveById } = montar();
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    expect(findAliveById).toHaveBeenCalledWith(PEDIDO, EMPRESA);
  });
});

describe('QC-138 — getAssignedOrderExecution: un BLOQUEADO no se abre', () => {
  it('R32 — abrir la ejecucion de un BLOQUEADO, tambien por la URL directa, rechaza con `order_blocked`', async () => {
    const { deps, listAliveSummariesByIds, findExecutionContentById } = montar({
      order: { id: PEDIDO, status: 'BLOQUEADO' },
    });
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const error = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OrderBlockedError);
    expect((error as OrderBlockedError).code).toBe('order_blocked');
    expect(listAliveSummariesByIds).not.toHaveBeenCalled();
    expect(findExecutionContentById).not.toHaveBeenCalled();
  });
});

describe('QC-215 — getAssignedOrderExecution: acondicionamiento y TERMINADO no se abren', () => {
  for (const estado of ['POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO'] as const) {
    it(`R21, R30: leer la ejecucion de un ${estado} rechaza con el mismo error que EN_EMPAQUE`, async () => {
      const empaque = montar({ order: { id: PEDIDO, status: 'EN_EMPAQUE' } });
      const errorEmpaque = await createGetAssignedOrderExecution(empaque.deps)(ACTOR, { orderId: PEDIDO }).catch(
        (e: unknown) => e,
      );
      const { deps, listAliveSummariesByIds, findExecutionContentById } = montar({
        order: { id: PEDIDO, status: estado },
      });

      const error = await createGetAssignedOrderExecution(deps)(ACTOR, { orderId: PEDIDO }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(OrderNotFoundError);
      expect((error as OrderNotFoundError).code).toBe((errorEmpaque as OrderNotFoundError).code);
      expect(listAliveSummariesByIds).not.toHaveBeenCalled();
      expect(findExecutionContentById).not.toHaveBeenCalled();
    });
  }
});

describe('getAssignedOrderExecution — la vista', () => {
  it('compone `recipeName`, `orderQuantity` y `numberText` desde el resumen y el contenido', async () => {
    const { deps } = montar();
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    expect(view.orderId).toBe(PEDIDO);
    expect(view.numberText).toBe('2026-0000001');
    expect(view.recipeName).toBe('Jabon liquido');
    expect(view.orderQuantity).toBe('200');
  });

  it('una receta dada de baja pinta `recipeName: null`, sin bloquear la lectura', async () => {
    const { deps } = montar({ content: contenido({ isDeleted: true }) });
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    expect(view.recipeName).toBeNull();
    expect(view.lines).toHaveLength(1);
  });

  it('resuelve el nombre del producto con `products.findRefs`, nunca con la receta', async () => {
    const { deps, productFindRefs } = montar();
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    expect(productFindRefs).toHaveBeenCalledWith([PRODUCTO], EMPRESA);
    expect(view.lines[0]?.productName).toBe('Hipoclorito');
  });
});

describe('getAssignedOrderExecution — R18: porcentaje y cantidad de la linea', () => {
  it('pedido 200 y linea al 10 % en L muestra porcentaje "10.00" y cantidad "20..." en L', async () => {
    const { deps } = montar({ summary: resumen({ quantity: '200' }) });
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    const [line] = view.lines;
    expect(line?.productName).toBe('Hipoclorito');
    expect(line?.percentage).toBe('10.00');
    expect(line?.quantity).toBe('20');
    expect(line?.unit?.id).toBe(LITRO);
    expect(line?.unit?.symbol).toBe('L');
  });
});

describe('getAssignedOrderExecution — R19: sin factor de escala', () => {
  it('la vista no tiene las claves `recipeBaseQuantity` ni `scaleFactorText`', async () => {
    const { deps } = montar();
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    const claves = Object.keys(view);
    expect(claves).not.toContain('recipeBaseQuantity');
    expect(claves).not.toContain('scaleFactorText');
    expect(claves.sort()).toEqual(
      [
        'orderId',
        'numberText',
        'status',
        'recipeName',
        'orderQuantity',
        'steps',
        'lines',
        'tools',
        'presentationLines',
        'unitId',
        'unitLabel',
        // QC-214 R14: las fotos de evidencia por paso.
        'evidence',
      ].sort(),
    );
    for (const line of view.lines) {
      expect(Object.keys(line).sort()).toEqual(
        ['productName', 'percentage', 'quantity', 'need', 'unit', 'alternativeUnits'].sort(),
      );
    }
  });
});

describe('getAssignedOrderExecution — la presentacion del pedido asignado', () => {
  it('R25: la vista lleva el nombre de la presentacion cuando el pedido tiene una', async () => {
    const { deps, findRefsPresentations } = montar({
      summary: resumen({ presentationLines: [{ id: 'linea-1', presentationId: PRESENTACION, packages: 1, packedPackages: null, presentationContent: null, packagingProductId: null, packagingName: null }] }),
      presentations: [presentacion()],
    });
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    expect(findRefsPresentations).toHaveBeenCalledWith([PRESENTACION], EMPRESA);
    expect(view.presentationLines[0]?.presentationName).toBe('Bidon 20L');
  });

  it('R25: un pedido sin presentacion devuelve `presentationName: null`, sin consultar el catalogo', async () => {
    const { deps, findRefsPresentations } = montar({ summary: resumen({ presentationLines: [] }) });
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    expect(findRefsPresentations).not.toHaveBeenCalled();
    expect(view.presentationLines).toEqual([]);
  });
});

describe('QC-170 — getAssignedOrderExecution: el reparto entero y la unidad del pedido', () => {
  const SEGUNDA_PRESENTACION = uuid('9');

  it('R26: la vista lleva TODAS las lineas del reparto en orden de alta, con nombre y envases, en una sola llamada', async () => {
    const { deps, findRefsPresentations } = montar({
      summary: resumen({
        presentationLines: [
          { id: 'linea-2', presentationId: SEGUNDA_PRESENTACION, packages: 5, packedPackages: null, presentationContent: null, packagingProductId: null, packagingName: null },
          { id: 'linea-3', presentationId: PRESENTACION, packages: 1, packedPackages: null, presentationContent: null, packagingProductId: null, packagingName: null },
        ],
      }),
      presentations: [presentacion(), presentacion({ id: SEGUNDA_PRESENTACION, name: 'Botella 200 ml' })],
    });
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    expect(findRefsPresentations).toHaveBeenCalledTimes(1);
    expect(findRefsPresentations).toHaveBeenCalledWith([SEGUNDA_PRESENTACION, PRESENTACION], EMPRESA);
    expect(view.presentationLines).toEqual([
      { lineId: 'linea-2', presentationId: SEGUNDA_PRESENTACION, presentationName: 'Botella 200 ml', packages: 5, packedPackages: null, packagingName: null, presentationContent: null, presentationUnitLabel: 'L' },
      { lineId: 'linea-3', presentationId: PRESENTACION, presentationName: 'Bidon 20L', packages: 1, packedPackages: null, packagingName: null, presentationContent: null, presentationUnitLabel: 'L' },
    ]);
  });

  it('R44: la pantalla de ejecucion recibe el nombre del envase en la linea con envase y `null` en la antigua (R33)', async () => {
    const { deps } = montar({
      summary: resumen({
        presentationLines: [
          { id: 'linea-4', presentationId: SEGUNDA_PRESENTACION, packages: 5, packedPackages: null, presentationContent: null, packagingProductId: null, packagingName: 'Envase PET 200 ml' },
          { id: 'linea-5', presentationId: PRESENTACION, packages: 1, packedPackages: null, presentationContent: null, packagingProductId: null, packagingName: null },
        ],
      }),
      presentations: [presentacion(), presentacion({ id: SEGUNDA_PRESENTACION, name: 'Botella 200 ml' })],
    });
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    expect(view.presentationLines).toEqual([
      { lineId: 'linea-4', presentationId: SEGUNDA_PRESENTACION, presentationName: 'Botella 200 ml', packages: 5, packedPackages: null, packagingName: 'Envase PET 200 ml', presentationContent: null, presentationUnitLabel: 'L' },
      { lineId: 'linea-5', presentationId: PRESENTACION, presentationName: 'Bidon 20L', packages: 1, packedPackages: null, packagingName: null, presentationContent: null, presentationUnitLabel: 'L' },
    ]);
  });

  it('cada linea lleva el contenido (copiado o vigente) y la etiqueta de la unidad de su presentacion', async () => {
    const { deps, findRefs } = montar({
      summary: resumen({
        presentationLines: [
          { id: 'linea-6', presentationId: SEGUNDA_PRESENTACION, packages: 9, packedPackages: null, presentationContent: '300.0000', packagingProductId: null, packagingName: 'Embase pequeño 2' },
          { id: 'linea-7', presentationId: PRESENTACION, packages: 1, packedPackages: null, presentationContent: null, packagingProductId: null, packagingName: null },
        ],
      }),
      presentations: [
        presentacion({ content: '20.0000' }),
        presentacion({ id: SEGUNDA_PRESENTACION, name: 'Botella 300', content: '250.0000', unitId: MILILITRO }),
      ],
      ownUnits: [unidad(), unidad({ id: MILILITRO, name: 'Mililitro', symbol: 'ml' })],
    });
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    expect(findRefs).toHaveBeenCalledWith(expect.arrayContaining([LITRO, MILILITRO]), EMPRESA);
    expect(view.presentationLines.map(({ presentationContent, presentationUnitLabel }) => ({ presentationContent, presentationUnitLabel }))).toEqual([
      { presentationContent: '300.0000', presentationUnitLabel: 'ml' },
      { presentationContent: '20.0000', presentationUnitLabel: 'L' },
    ]);
  });

  it('R27: sin reparto, `presentationLines` es `[]` y la vista sale igual, sin error', async () => {
    const { deps } = montar({ summary: resumen({ presentationLines: [] }) });
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    expect(view.presentationLines).toEqual([]);
    expect(view.orderId).toBe(PEDIDO);
  });

  it('R26: la cantidad del pedido viaja con la etiqueta de su unidad (simbolo, o nombre si no lo tiene)', async () => {
    const GARRAFA = uuid('8');
    const conSimbolo = montar({ summary: resumen({ unitId: LITRO }), ownUnits: [unidad()] });
    const vistaConSimbolo = await createGetAssignedOrderExecution(conSimbolo.deps)(ACTOR, { orderId: PEDIDO });
    expect(conSimbolo.findRefs).toHaveBeenCalledWith([LITRO], EMPRESA);
    expect(vistaConSimbolo.unitId).toBe(LITRO);
    expect(vistaConSimbolo.unitLabel).toBe('L');

    const sinSimbolo = montar({
      summary: resumen({ unitId: GARRAFA }),
      ownUnits: [unidad(), unidad({ id: GARRAFA, name: 'Garrafa', symbol: null })],
    });
    const vistaSinSimbolo = await createGetAssignedOrderExecution(sinSimbolo.deps)(ACTOR, { orderId: PEDIDO });
    expect(vistaSinSimbolo.unitId).toBe(GARRAFA);
    expect(vistaSinSimbolo.unitLabel).toBe('Garrafa');
  });

  it('R42: un pedido sin unidad sale con `unitId` y `unitLabel` a null', async () => {
    const { deps, findRefs } = montar({ summary: resumen({ unitId: null }), products: [] });
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    expect(findRefs).not.toHaveBeenCalled();
    expect(view.unitId).toBeNull();
    expect(view.unitLabel).toBeNull();
  });
});

describe('getAssignedOrderExecution — la necesidad de la linea en la unidad del insumo', () => {
  const GRAMO = uuid('6');
  const GARRAFA = uuid('8');
  const kilogramo = unidad({ id: KILOGRAMO, name: 'Kilogramo', symbol: 'kg' });
  const gramo = unidad({ id: GRAMO, name: 'Gramo', symbol: 'g', baseUnitId: KILOGRAMO, factor: '0.001' });
  const litro = unidad();
  const puente: MassVolumeBridge = { volumeBaseId: LITRO, massBaseId: KILOGRAMO };

  it('R16 la cantidad de la linea sale convertida a la unidad del insumo', async () => {
    const { deps, findRefs } = montar({
      summary: resumen({ quantity: '2000', unitId: GRAMO }),
      products: [producto({ unitId: KILOGRAMO })],
      ownUnits: [kilogramo, gramo],
    });

    const view = await createGetAssignedOrderExecution(deps)(ACTOR, { orderId: PEDIDO });

    expect(findRefs).toHaveBeenCalledTimes(1);
    expect([...(findRefs.mock.calls[0]?.[0] as readonly string[])].sort()).toEqual([KILOGRAMO, GRAMO].sort());
    const [line] = view.lines;
    expect(line?.need).toBe('exact');
    expect(Number(line?.quantity)).toBe(0.2);
    expect(line?.unit?.id).toBe(KILOGRAMO);
    expect(view.unitLabel).toBe('g');
  });

  it('R17 una linea aproximada sale con need approximate', async () => {
    const { deps, findMassVolumeBridge } = montar({
      summary: resumen({ quantity: '200', unitId: LITRO }),
      products: [producto({ unitId: KILOGRAMO })],
      ownUnits: [kilogramo, litro],
      bridge: puente,
    });

    const view = await createGetAssignedOrderExecution(deps)(ACTOR, { orderId: PEDIDO });

    expect(findMassVolumeBridge).toHaveBeenCalledTimes(1);
    const [line] = view.lines;
    expect(line?.need).toBe('approximate');
    expect(Number(line?.quantity)).toBe(20);
    expect(line?.unit?.id).toBe(KILOGRAMO);
  });

  it('R17 una linea no convertible sale sin cantidad', async () => {
    const { deps } = montar({
      summary: resumen({ quantity: '200', unitId: GARRAFA }),
      products: [producto({ unitId: LITRO })],
      ownUnits: [litro, unidad({ id: GARRAFA, name: 'Garrafa', symbol: null })],
      bridge: puente,
    });

    const view = await createGetAssignedOrderExecution(deps)(ACTOR, { orderId: PEDIDO });

    const [line] = view.lines;
    expect(line?.need).toBe('not_convertible');
    expect(line?.quantity).toBeNull();
    expect(line?.percentage).toBe('10.00');
    expect(line?.productName).toBe('Hipoclorito');
  });

  it('R20 un pedido sin unidad sale como antes', async () => {
    const { deps, findRefs, findMassVolumeBridge } = montar({ summary: resumen({ quantity: '200', unitId: null }) });

    const view = await createGetAssignedOrderExecution(deps)(ACTOR, { orderId: PEDIDO });

    expect(findMassVolumeBridge).not.toHaveBeenCalled();
    expect(findRefs).toHaveBeenCalledWith([LITRO], EMPRESA);
    const [line] = view.lines;
    expect(line?.need).toBe('unconverted');
    expect(line?.quantity).toBe('20');
    expect(line?.unit?.id).toBe(LITRO);
    expect(view.unitId).toBeNull();
    expect(view.unitLabel).toBeNull();
  });
});

describe('getAssignedOrderExecution — R20: unidades hermanas', () => {
  it('solo vuelven unidades de la misma base efectiva, sin la propia, y el porcentaje no cambia', async () => {
    const litro = unidad({ id: LITRO, baseUnitId: null, factor: null });
    const mililitro = unidad({ id: MILILITRO, name: 'Mililitro', symbol: 'mL', baseUnitId: LITRO, factor: '0.001' });
    const kilogramo = unidad({ id: KILOGRAMO, name: 'Kilogramo', symbol: 'kg', baseUnitId: null, factor: null });

    const { deps, findRefsSharingBaseInCompany } = montar({
      ownUnits: [litro],
      sisterUnits: [litro, mililitro, kilogramo],
    });
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    expect(findRefsSharingBaseInCompany).toHaveBeenCalledWith(EMPRESA, [LITRO]);
    const alternativas = view.lines[0]?.alternativeUnits ?? [];
    expect(alternativas.map((u) => u.id)).toEqual([MILILITRO]);
    expect(alternativas.some((u) => u.id === LITRO)).toBe(false);
    expect(alternativas.some((u) => u.id === KILOGRAMO)).toBe(false);
    expect(view.lines[0]?.percentage).toBe('10.00');
  });
});

describe('getAssignedOrderExecution — R21: proporcionalidad entre pedidos', () => {
  it('dos pedidos de 200 y 300 con los mismos porcentajes dan cantidades en proporcion 2:3', async () => {
    const { deps: deps200 } = montar({ summary: resumen({ quantity: '200' }) });
    const { deps: deps300 } = montar({ summary: resumen({ quantity: '300' }) });

    const vista200 = await createGetAssignedOrderExecution(deps200)(ACTOR, { orderId: PEDIDO });
    const vista300 = await createGetAssignedOrderExecution(deps300)(ACTOR, { orderId: PEDIDO });

    expect(vista200.lines[0]?.quantity).toBe('20');
    expect(vista300.lines[0]?.quantity).toBe('30');
  });
});

describe('getAssignedOrderExecution — R24: insumo sin unidad resoluble', () => {
  it('un insumo sin lotes viene con `unit: null` y sin alternativas, con porcentaje y cantidad', async () => {
    const { deps } = montar({ products: [producto({ unitId: null })] });
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    const [line] = view.lines;
    expect(line?.unit).toBeNull();
    expect(line?.alternativeUnits).toEqual([]);
    expect(line?.percentage).toBe('10.00');
    expect(line?.quantity).toBe('20');
  });

  it('un insumo dado de baja (no vuelve en `findRefs`) viene con `unit: null` y `productName: null`', async () => {
    const { deps } = montar({ products: [] });
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    const [line] = view.lines;
    expect(line?.productName).toBeNull();
    expect(line?.unit).toBeNull();
    expect(line?.alternativeUnits).toEqual([]);
  });
});

describe('getAssignedOrderExecution — R26: la cantidad del pedido sigue en la vista', () => {
  it('`orderQuantity` viaja en la vista, fuera de las lineas', async () => {
    const { deps } = montar({ summary: resumen({ quantity: '200' }) });
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    expect(view.orderQuantity).toBe('200');
  });
});

// R15 — comprobacion de TIPO: un literal con `ingredientsCost` de mas sobre
// `AssignedOrderExecutionView` tiene que dejar de compilar. Si la vista de ejecucion ganara el
// campo, el `@ts-expect-error` se quedaria sin usar y `tsc` se pondria rojo aqui mismo.
const _r15TipoSinImporte: AssignedOrderExecutionView = {
  orderId: PEDIDO,
  numberText: '2026-0000001',
  status: 'PENDIENTE',
  recipeName: null,
  orderQuantity: '200',
  steps: [],
  lines: [],
  // @ts-expect-error `AssignedOrderExecutionView` no declara `ingredientsCost` (R15): si esto
  // compila, la pantalla de ejecucion gano el importe.
  ingredientsCost: '10.0000',
};
void _r15TipoSinImporte;

describe('la pantalla de ejecucion no lleva importe (R15)', () => {
  it('la pantalla de ejecucion no lleva importe (R15)', async () => {
    const { deps } = montar();
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    expect(Object.keys(view)).not.toContain('ingredientsCost');
  });
});

describe('getAssignedOrderExecution — pedido con version de receta', () => {
  it('R8, R11: la ejecucion de un pedido con version muestra el nombre compuesto, los pasos de la original y las lineas de la version', async () => {
    const VERSION = uuid('9');
    const pasosDeLaOriginal = [{ blocks: [{ kind: 'paragraph' as const, spans: [{ text: 'Mezclar en frio' }] }] }];
    const { deps, findExecutionContentById } = montar({
      summary: resumen({ recipeId: VERSION }),
      content: contenido({
        id: VERSION,
        name: 'Jabon liquido · Sin perfume',
        steps: pasosDeLaOriginal,
        lines: [{ productId: PRODUCTO, productName: null, percentage: '25.00' }],
      }),
    });
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    expect(findExecutionContentById).toHaveBeenCalledWith(VERSION, EMPRESA);
    expect(view.recipeName).toBe('Jabon liquido · Sin perfume');
    expect(view.steps).toEqual(pasosDeLaOriginal);
    expect(view.lines.map((line) => line.percentage)).toEqual(['25.00']);
  });
});

describe('getAssignedOrderExecution — herramientas de la receta', () => {
  const BATIDORA = uuid('4');
  const BALANZA = uuid('5');

  function conHerramientas(): RecipeExecutionContent {
    return contenido({
      tools: [
        { productId: BATIDORA, productName: null, quantity: 2 },
        { productId: BALANZA, productName: null, quantity: 1 },
      ],
    });
  }

  const vivos = [
    producto(),
    producto({ id: BATIDORA, name: 'Batidora', unitId: null, type: 'MACHINE' }),
    producto({ id: BALANZA, name: 'Balanza', unitId: KILOGRAMO, type: 'MACHINE' }),
  ];

  it('R28: trae nombre y cantidad de cada herramienta de la receta del pedido, en su orden', async () => {
    const { deps, findExecutionContentById } = montar({ content: conHerramientas(), products: vivos });

    const vista = await createGetAssignedOrderExecution(deps)(ACTOR, { orderId: PEDIDO });

    expect(findExecutionContentById).toHaveBeenCalledWith(RECETA, EMPRESA);
    expect(vista.tools).toEqual([
      { productName: 'Batidora', quantity: 2 },
      { productName: 'Balanza', quantity: 1 },
    ]);
  });

  it('R28: si el pedido es de una version, son las herramientas de esa receta (la que lee el catalogo por recipeId)', async () => {
    const VERSION = uuid('9');
    const { deps, findExecutionContentById } = montar({
      summary: resumen({ recipeId: VERSION }),
      content: contenido({ id: VERSION, tools: [{ productId: BALANZA, productName: null, quantity: 4 }] }),
      products: vivos,
    });

    const vista = await createGetAssignedOrderExecution(deps)(ACTOR, { orderId: PEDIDO });

    expect(findExecutionContentById).toHaveBeenCalledWith(VERSION, EMPRESA);
    expect(vista.tools).toEqual([{ productName: 'Balanza', quantity: 4 }]);
  });

  it('R29: la cantidad no cambia con la cantidad del pedido', async () => {
    const vistas = await Promise.all(
      ['1', '200', '99999.5'].map((quantity) =>
        createGetAssignedOrderExecution(
          montar({ summary: resumen({ quantity }), content: conHerramientas(), products: vivos }).deps,
        )(ACTOR, { orderId: PEDIDO }),
      ),
    );

    for (const vista of vistas) expect(vista.tools.map((t) => t.quantity)).toEqual([2, 1]);
  });

  it('R30: una herramienta de baja sale con productName null y su cantidad', async () => {
    const { deps } = montar({ content: conHerramientas(), products: [producto(), vivos[1] as ProductRef] });

    const vista = await createGetAssignedOrderExecution(deps)(ACTOR, { orderId: PEDIDO });

    expect(vista.tools).toEqual([
      { productName: 'Batidora', quantity: 2 },
      { productName: null, quantity: 1 },
    ]);
  });

  it('R31: sin herramientas, tools es []', async () => {
    const { deps } = montar();
    const vista = await createGetAssignedOrderExecution(deps)(ACTOR, { orderId: PEDIDO });
    expect(vista.tools).toEqual([]);
  });

  it('R28: un solo findRefs de productos para lineas y herramientas, y las unidades solo de las lineas', async () => {
    const { deps, productFindRefs, findRefs } = montar({ content: conHerramientas(), products: vivos });

    await createGetAssignedOrderExecution(deps)(ACTOR, { orderId: PEDIDO });

    expect(productFindRefs).toHaveBeenCalledTimes(1);
    expect([...(productFindRefs.mock.calls[0]?.[0] as readonly string[])].sort()).toEqual(
      [PRODUCTO, BATIDORA, BALANZA].sort(),
    );
    const unidadesPedidas = findRefs.mock.calls.flatMap((call) => [...(call[0] as readonly string[])]);
    expect(unidadesPedidas).not.toContain(KILOGRAMO);
  });

  it('R32: sin asignaciones.ejecutar no toca ningun puerto, aunque la receta tenga herramientas', async () => {
    const { deps, todos } = montar({ content: conHerramientas(), products: vivos });

    await expect(
      createGetAssignedOrderExecution(deps)(
        { id: ANA, companyId: EMPRESA, permissions: ['recetas.consultar', 'recetas.modificar'] },
        { orderId: PEDIDO },
      ),
    ).rejects.toThrow(UnauthorizedError);
    for (const doble of todos) expect(doble).not.toHaveBeenCalled();
  });
});

function doblesDe(deps: object): unknown[] {
  return Object.values(deps as Record<string, unknown>).flatMap((value) =>
    vi.isMockFunction(value) ? [value] : value !== null && typeof value === 'object' ? doblesDe(value) : [],
  );
}

const SIN_EJECUTAR: readonly (readonly [string, readonly string[]])[] = [
  ['solo asignaciones.consultar', ['asignaciones.consultar']],
  ['solo empaque.modificar', ['empaque.modificar']],
  ['asignaciones.consultar + empaque.modificar', ['asignaciones.consultar', 'empaque.modificar']],
  ['el conjunto vacio', []],
];

describe('getAssignedOrderExecution — exige `asignaciones.ejecutar`', () => {
  it.each(SIN_EJECUTAR)('R5, R7a: con %s rechaza con `unauthorized` sin invocar ningun puerto', async (_caso, permissions) => {
    const { deps } = montar();

    await expect(
      createGetAssignedOrderExecution(deps)({ id: ANA, companyId: EMPRESA, permissions }, { orderId: PEDIDO }),
    ).rejects.toThrow(UnauthorizedError);
    for (const doble of doblesDe(deps)) expect(doble).not.toHaveBeenCalled();
  });

  it('R5: sin el permiso rechaza antes de validar la entrada', async () => {
    const { deps } = montar();

    await expect(
      createGetAssignedOrderExecution(deps)(
        { id: ANA, companyId: EMPRESA, permissions: ['asignaciones.consultar'] },
        { orderId: 'no-es-un-uuid' },
      ),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('R7b: con solo `asignaciones.ejecutar` leer la ejecucion resuelve igual que con el conjunto del Operador', async () => {
    const soloEjecutar: Actor = { id: ANA, companyId: EMPRESA, permissions: ['asignaciones.ejecutar'] };
    const conEjecutar = montar();
    const deReferencia = montar();

    const resultado = await createGetAssignedOrderExecution(conEjecutar.deps)(soloEjecutar, { orderId: PEDIDO });
    const referencia = await createGetAssignedOrderExecution(deReferencia.deps)(ACTOR, { orderId: PEDIDO });

    expect(resultado).toEqual(referencia);
  });
});

describe('QC-211 — la ejecucion del operador no lleva pasos de envasado', () => {
  const MEZCLAR = { blocks: [{ kind: 'paragraph' as const, spans: [{ text: 'Mezclar en frio' }] }] };
  const ENVASAR = 'Envasar en garrafas de 5 L';

  it('R26: la vista construida desde un contenido de receta no tiene `packingSteps` y solo trae los pasos del operador', async () => {
    const { deps } = montar({ content: contenido({ steps: [MEZCLAR] }) });
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    expect(view).not.toHaveProperty('packingSteps');
    expect(view.steps).toEqual([MEZCLAR]);
  });

  it('R26: aunque el contenido trajera pasos de envasado, la vista no los copia', async () => {
    const conEnvasado = {
      ...contenido({ steps: [MEZCLAR] }),
      packingSteps: [{ blocks: [{ kind: 'paragraph', spans: [{ text: ENVASAR }] }] }],
    } as RecipeExecutionContent;
    const { deps } = montar({ content: conEnvasado });
    const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

    const view = await getAssignedOrderExecution(ACTOR, { orderId: PEDIDO });

    expect(view).not.toHaveProperty('packingSteps');
    expect(JSON.stringify(view)).not.toContain(ENVASAR);
  });
});

describe('getAssignedOrderExecution — evidencia (R14, R33)', () => {
  const PASOS_CON_EVIDENCIA = [{ blocks: [] }, { blocks: [], requiresEvidence: true }, { blocks: [], requiresEvidence: true }];
  const EN_CURSO = { order: { id: PEDIDO, status: 'EN_CURSO' as const }, summary: resumen({ status: 'EN_CURSO' }) };

  function fila(id: string, stepPosition: number, slot: number): StepEvidenceRow {
    return { id, orderId: PEDIDO, phase: 'manufacturing', stepPosition, slot, path: `${EMPRESA}/${PEDIDO}/${id}` };
  }

  it('R14, R33: un pedido EN_CURSO trae sus fotos por paso, cada una con URL firmada de 15 minutos', async () => {
    const d = montar({
      ...EN_CURSO,
      content: contenido({ steps: PASOS_CON_EVIDENCIA }),
      fotos: [fila('f3', 3, 1), fila('f2b', 2, 2), fila('f2a', 2, 1)],
    });
    const view = await createGetAssignedOrderExecution(d.deps)(ACTOR, { orderId: PEDIDO });
    expect(view.evidence).toEqual([
      {
        stepPosition: 2,
        photos: [
          { id: 'f2a', slot: 1, url: `https://bucket.test/${EMPRESA}/${PEDIDO}/f2a?ttl=900` },
          { id: 'f2b', slot: 2, url: `https://bucket.test/${EMPRESA}/${PEDIDO}/f2b?ttl=900` },
        ],
      },
      { stepPosition: 3, photos: [{ id: 'f3', slot: 1, url: `https://bucket.test/${EMPRESA}/${PEDIDO}/f3?ttl=900` }] },
    ]);
    expect(d.listEvidenceByOrder).toHaveBeenCalledWith(EMPRESA, PEDIDO, 'manufacturing');
    expect(d.createSignedReadUrl).toHaveBeenCalledTimes(3);
    for (const call of d.createSignedReadUrl.mock.calls) expect(call[1]).toBe(15 * 60);
  });

  it('R14: un pedido PENDIENTE todavia no tiene fotos: no consulta ni firma', async () => {
    const d = montar({ content: contenido({ steps: PASOS_CON_EVIDENCIA }) });
    const view = await createGetAssignedOrderExecution(d.deps)(ACTOR, { orderId: PEDIDO });
    expect(view.evidence).toEqual([]);
    expect(d.listEvidenceByOrder).not.toHaveBeenCalled();
    expect(d.createSignedReadUrl).not.toHaveBeenCalled();
  });

  it('R14: sin pasos que pidan evidencia no consulta ni firma nada', async () => {
    const d = montar({ ...EN_CURSO, content: contenido({ steps: [{ blocks: [] }] }) });
    const view = await createGetAssignedOrderExecution(d.deps)(ACTOR, { orderId: PEDIDO });
    expect(view.evidence).toEqual([]);
    expect(d.listEvidenceByOrder).not.toHaveBeenCalled();
  });

  it('R33: quien no es responsable asignado no recibe ninguna URL firmada', async () => {
    const d = montar({ ...EN_CURSO, ids: [], content: contenido({ steps: PASOS_CON_EVIDENCIA }) });
    await expect(createGetAssignedOrderExecution(d.deps)(ACTOR, { orderId: PEDIDO })).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
    expect(d.listEvidenceByOrder).not.toHaveBeenCalled();
    expect(d.createSignedReadUrl).not.toHaveBeenCalled();
  });
});

// La pantalla de ejecucion no lleva NINGUN importe, ni el real ni el estimado.
// Se recorre la vista ENTERA (pasos, lineas, reparto, evidencia) buscando claves de importe, y el
// resumen del doble trae a proposito esos campos colados -como si el catalogo de `pedidos` los
// filtrara por error-: la vista no puede copiarlos.
const CLAVE_DE_IMPORTE = /cost|coste|importe|price|precio|amount/i;

function clavesDeImporte(valor: unknown, ruta = ''): string[] {
  if (Array.isArray(valor)) return valor.flatMap((item, i) => clavesDeImporte(item, `${ruta}[${String(i)}]`));
  if (valor === null || typeof valor !== 'object' || valor instanceof Date) return [];
  return Object.entries(valor).flatMap(([clave, hijo]) => [
    ...(CLAVE_DE_IMPORTE.test(clave) ? [`${ruta}.${clave}`] : []),
    ...clavesDeImporte(hijo, `${ruta}.${clave}`),
  ]);
}

describe('QC-305 — la pantalla de ejecucion no lleva el coste real (R24)', () => {
  it('R24: ninguna clave de importe (actualCost, ingredientsCost, packagingCost...) en toda la vista, aunque el resumen las traiga', async () => {
    const conImportes = {
      ...resumen({ status: 'EN_CURSO', presentationLines: [{ id: uuid('5'), presentationId: PRESENTACION, packages: 2, packedPackages: null, presentationContent: null, packagingProductId: null, packagingName: null }] }),
      actualCost: '27.1250',
      ingredientsCost: '30.0000',
      packagingCost: '4.5000',
    } as unknown as AssignedOrderSummary;
    const { deps } = montar({
      order: { id: PEDIDO, status: 'EN_CURSO' },
      summary: conImportes,
      presentations: [presentacion()],
    });

    const view = await createGetAssignedOrderExecution(deps)(ACTOR, { orderId: PEDIDO });

    expect(view.orderId).toBe(PEDIDO);
    expect(view.lines.length).toBeGreaterThan(0);
    expect(clavesDeImporte(view)).toEqual([]);
  });

  it('R24: el contrato de la vista no declara actualCost (comprobacion de tipo)', () => {
    const sinReal: 'actualCost' extends keyof AssignedOrderExecutionView ? false : true = true;
    const sinEstimado: 'ingredientsCost' extends keyof AssignedOrderExecutionView ? false : true = true;
    const resumenSinReal: 'actualCost' extends keyof AssignedOrderSummary ? false : true = true;
    expect([sinReal, sinEstimado, resumenSinReal]).toEqual([true, true, true]);
  });
});
