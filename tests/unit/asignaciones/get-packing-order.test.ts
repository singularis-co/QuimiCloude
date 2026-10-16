// tests/unit/asignaciones/get-packing-order.test.ts
import { describe, expect, it, vi } from 'vitest';

import { createGetPackingOrder, type GetPackingOrderDeps } from '@/lib/modules/asignaciones/domain/get-packing-order';
import { AsignacionesError, OrderNotFoundError, UnauthorizedError } from '@/lib/modules/asignaciones/domain/errors';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';

function uuid(seed: string): string {
  return `${seed.repeat(8)}-${seed.repeat(4)}-4${seed.repeat(3)}-8${seed.repeat(3)}-${seed.repeat(12)}`;
}

const EMPRESA = uuid('3');
const ANA = uuid('1');
const BETO = uuid('2');
const PEDIDO = uuid('7');

const ACTOR: Actor = { id: ANA, companyId: EMPRESA, permissions: ['empaque.modificar'] };

const RESUMEN = {
  id: PEDIDO,
  number: { year: 2026, sequence: 7 },
  recipeId: 'receta-1',
  quantity: '10.0000',
  priority: 'ALTA',
  status: 'POR_EMPACAR',
  presentationLines: [{ presentationId: 'presentacion-1', packages: 1, packagingName: null }],
  unitId: 'unidad-1',
  finishedAt: null,
  packedBy: null,
  conditionedBy: null,
};

const RESUMEN_EN_EMPAQUE = { ...RESUMEN, status: 'EN_EMPAQUE', packedBy: BETO };

type Dobles = {
  readonly deps: GetPackingOrderDeps;
  readonly listAliveSummariesByIds: ReturnType<typeof vi.fn>;
  readonly findPackagingRefs: ReturnType<typeof vi.fn>;
  readonly findPresentationRefs: ReturnType<typeof vi.fn>;
  readonly findUnitRefs: ReturnType<typeof vi.fn>;
  readonly findPackingStepsById: ReturnType<typeof vi.fn>;
  readonly listEvidenceByOrder: ReturnType<typeof vi.fn>;
  readonly createSignedReadUrl: ReturnType<typeof vi.fn>;
  readonly todos: readonly ReturnType<typeof vi.fn>[];
};

function paso(text: string) {
  return { blocks: [{ kind: 'paragraph' as const, spans: [{ text }] }] };
}

const ENVASAR = paso('Envasar en garrafas de 5 L');
const ETIQUETAR = paso('Etiquetar con el lote');
const MEZCLAR_OPERADOR = 'Mezclar en frio 10 minutos';

function montar(options?: {
  readonly items?: readonly unknown[];
  readonly packingSteps?: readonly unknown[] | null;
  readonly fotos?: readonly unknown[];
  readonly presentaciones?: readonly unknown[];
  readonly unidades?: readonly unknown[];
  readonly envases?: readonly unknown[];
}): Dobles {
  const listAliveSummariesByIds = vi.fn(async () => ({
    items: options?.items ?? [RESUMEN],
    total: (options?.items ?? [RESUMEN]).length,
    page: 1,
    pageSize: 1,
    totalPages: 1,
  }));
  const findPackagingRefs = vi.fn(async () => options?.envases ?? []);
  const findPackingStepsById = vi.fn(async () =>
    options?.packingSteps === undefined ? [ENVASAR, ETIQUETAR] : options.packingSteps,
  );
  const listByOrdersInCompany = vi.fn(async () => []);
  const findRefsIncludingDeleted = vi.fn(async () => [{ id: 'receta-1', name: 'Desengrasante', ownName: 'Desengrasante', isUnderReview: false, original: null, isDeleted: false }]);
  const findRefsIncludingDeletedInCompany = vi.fn(async () => []);
  const findPresentationRefs = vi.fn(
    async () =>
      options?.presentaciones ?? [
        { id: 'presentacion-1', name: 'Botella 1L' },
        { id: 'presentacion-2', name: 'Botella 200 ml' },
      ],
  );
  const findUnitRefs = vi.fn(
    async () => options?.unidades ?? [{ id: 'unidad-1', name: 'Litro', symbol: 'L', baseUnitId: null, factor: null }],
  );

  const listEvidenceByOrder = vi.fn(async () => options?.fotos ?? []);
  const createSignedReadUrl = vi.fn(async (path: string, ttl: number) => `https://bucket.test/${path}?ttl=${String(ttl)}`);

  const deps = {
    orders: { listAliveSummariesByIds },
    assignments: { listByOrdersInCompany },
    recipes: { findRefsIncludingDeleted },
    people: { findRefsIncludingDeletedInCompany },
    presentations: { findRefs: findPresentationRefs },
    units: { findRefs: findUnitRefs },
    packaging: { findRefs: findPackagingRefs },
    packingSteps: { findPackingStepsById },
    now: () => new Date('2026-09-25T12:00:00.000Z'),
    evidence: { listByOrder: listEvidenceByOrder },
    storage: { createSignedReadUrl },
  } as unknown as GetPackingOrderDeps;

  return {
    deps,
    listAliveSummariesByIds,
    findPackagingRefs,
    findPresentationRefs,
    findUnitRefs,
    findPackingStepsById,
    listEvidenceByOrder,
    createSignedReadUrl,
    todos: [
      listAliveSummariesByIds,
      listByOrdersInCompany,
      findRefsIncludingDeleted,
      findRefsIncludingDeletedInCompany,
      findPresentationRefs,
      findUnitRefs,
      findPackagingRefs,
      findPackingStepsById,
      listEvidenceByOrder,
      createSignedReadUrl,
    ],
  };
}

describe('getPackingOrder — autorizacion (R13)', () => {
  it('actor ausente rechaza sin tocar ningun puerto', async () => {
    const { deps, listAliveSummariesByIds } = montar();
    const getPackingOrder = createGetPackingOrder(deps);

    await expect(getPackingOrder(null, { orderId: PEDIDO })).rejects.toBeInstanceOf(AsignacionesError);
    expect(listAliveSummariesByIds).not.toHaveBeenCalled();
  });

  it('actor sin `empaque.modificar` rechaza con `unauthorized` sin tocar ningun puerto', async () => {
    const { deps, listAliveSummariesByIds } = montar();
    const getPackingOrder = createGetPackingOrder(deps);
    const actor: Actor = { id: ANA, companyId: EMPRESA, permissions: [] };

    await expect(getPackingOrder(actor, { orderId: PEDIDO })).rejects.toThrow(UnauthorizedError);
    expect(listAliveSummariesByIds).not.toHaveBeenCalled();
  });
});

describe('getPackingOrder — la misma fila que `listPackingOrders`', () => {
  it('devuelve numero, receta, presentacion, estado y quien empaca, sin envases (QC-281 R12)', async () => {
    const { deps, listAliveSummariesByIds } = montar();
    const getPackingOrder = createGetPackingOrder(deps);

    const row = await getPackingOrder(ACTOR, { orderId: PEDIDO });

    expect(listAliveSummariesByIds).toHaveBeenCalledWith(EMPRESA, [PEDIDO], ['POR_EMPACAR', 'EN_EMPAQUE'], 1, 1);
    expect(row).toEqual({
      id: PEDIDO,
      numberText: expect.any(String),
      recipeName: 'Desengrasante',
      quantity: '10.0000',
      presentationLines: [{ presentationId: 'presentacion-1', presentationName: 'Botella 1L', packages: 1, packagingName: null }],
      unitId: 'unidad-1',
      unitLabel: 'L',
      status: 'POR_EMPACAR',
      packedByName: null,
      packedById: null,
      packingSteps: [],
      packingEvidence: [],
      finish: null,
    });
  });

  it('R17: en `EN_EMPAQUE`, `packedById` trae el id de quien empaca', async () => {
    const { deps } = montar({ items: [RESUMEN_EN_EMPAQUE] });
    const getPackingOrder = createGetPackingOrder(deps);

    const row = await getPackingOrder(ACTOR, { orderId: PEDIDO });

    expect(row.packedById).toBe(BETO);
  });
});

describe('getPackingOrder — R24: no existe, esta de baja, es de otra empresa o esta en otro estado', () => {
  it('sin filas rechaza con `order_not_found`', async () => {
    const { deps } = montar({ items: [] });
    const getPackingOrder = createGetPackingOrder(deps);

    await expect(getPackingOrder(ACTOR, { orderId: PEDIDO })).rejects.toBeInstanceOf(OrderNotFoundError);
  });
});

describe('QC-170 — getPackingOrder: el reparto y la unidad para la pantalla del Empacador', () => {
  it('R47: trae TODAS las lineas del reparto en orden de alta y la cantidad con la etiqueta de su unidad', async () => {
    const conDosLineas = {
      ...RESUMEN,
      presentationLines: [
        { presentationId: 'presentacion-2', packages: 5, packagingName: null },
        { presentationId: 'presentacion-1', packages: 1, packagingName: null },
      ],
    };
    const { deps } = montar({ items: [conDosLineas] });
    const getPackingOrder = createGetPackingOrder(deps);

    const row = await getPackingOrder(ACTOR, { orderId: PEDIDO });

    expect(row.presentationLines).toEqual([
      { presentationId: 'presentacion-2', presentationName: 'Botella 200 ml', packages: 5, packagingName: null },
      { presentationId: 'presentacion-1', presentationName: 'Botella 1L', packages: 1, packagingName: null },
    ]);
    expect(row.quantity).toBe('10.0000');
    expect(row.unitLabel).toBe('L');
  });

  it('R47: un `POR_EMPACAR` sin lineas sale con `presentationLines: []` y su estado, para que la pantalla avise que falta el reparto', async () => {
    const { deps } = montar({ items: [{ ...RESUMEN, presentationLines: [] }] });
    const getPackingOrder = createGetPackingOrder(deps);

    const row = await getPackingOrder(ACTOR, { orderId: PEDIDO });

    expect(row.status).toBe('POR_EMPACAR');
    expect(row.presentationLines).toEqual([]);
  });

  it('R44: la linea con envase llega a la pantalla de empaque con su nombre y la antigua con `packagingName: null` (R33)', async () => {
    const conEnvase = {
      ...RESUMEN,
      presentationLines: [
        { presentationId: 'presentacion-1', packages: 3, packagingName: 'Envase PET 1L' },
        { presentationId: 'presentacion-2', packages: 2, packagingName: null },
      ],
    };
    const { deps } = montar({ items: [conEnvase] });
    const getPackingOrder = createGetPackingOrder(deps);

    const row = await getPackingOrder(ACTOR, { orderId: PEDIDO });

    expect(row.presentationLines).toEqual([
      { presentationId: 'presentacion-1', presentationName: 'Botella 1L', packages: 3, packagingName: 'Envase PET 1L' },
      { presentationId: 'presentacion-2', presentationName: 'Botella 200 ml', packages: 2, packagingName: null },
    ]);
  });

  it('R42: un pedido sin unidad sale con `unitId` y `unitLabel` a null', async () => {
    const { deps } = montar({ items: [{ ...RESUMEN, unitId: null }] });
    const getPackingOrder = createGetPackingOrder(deps);

    const row = await getPackingOrder(ACTOR, { orderId: PEDIDO });

    expect(row.unitId).toBeNull();
    expect(row.unitLabel).toBeNull();
  });
});

describe('QC-211 — getPackingOrder: los pasos de envasado', () => {
  const RESUMEN_DEL_ACTOR = { ...RESUMEN, status: 'EN_EMPAQUE', packedBy: ANA };

  it('R19: en `POR_EMPACAR` devuelve `packingSteps: []` sin llamar al lector', async () => {
    const { deps, findPackingStepsById } = montar();
    const getPackingOrder = createGetPackingOrder(deps);

    const row = await getPackingOrder(ACTOR, { orderId: PEDIDO });

    expect(row.packingSteps).toEqual([]);
    expect(findPackingStepsById).not.toHaveBeenCalled();
  });

  it('R22: en `EN_EMPAQUE` a nombre de otro devuelve `packingSteps: []` sin llamar al lector', async () => {
    const { deps, findPackingStepsById } = montar({ items: [RESUMEN_EN_EMPAQUE] });
    const getPackingOrder = createGetPackingOrder(deps);

    const row = await getPackingOrder(ACTOR, { orderId: PEDIDO });

    expect(row.packingSteps).toEqual([]);
    expect(findPackingStepsById).not.toHaveBeenCalled();
  });

  it('R20: en `EN_EMPAQUE` del actor devuelve los pasos del lector, en orden', async () => {
    const { deps, findPackingStepsById } = montar({ items: [RESUMEN_DEL_ACTOR] });
    const getPackingOrder = createGetPackingOrder(deps);

    const row = await getPackingOrder(ACTOR, { orderId: PEDIDO });

    expect(row.packingSteps).toEqual([ENVASAR, ETIQUETAR]);
    expect(findPackingStepsById).toHaveBeenCalledTimes(1);
  });

  it('R20, R29: si el lector devuelve `null` (otra empresa o inexistente) la salida trae `[]`', async () => {
    const { deps } = montar({ items: [RESUMEN_DEL_ACTOR], packingSteps: null });
    const getPackingOrder = createGetPackingOrder(deps);

    const row = await getPackingOrder(ACTOR, { orderId: PEDIDO });

    expect(row.packingSteps).toEqual([]);
  });

  it('R29: el lector recibe la receta del pedido y la empresa del actor', async () => {
    const { deps, findPackingStepsById } = montar({ items: [RESUMEN_DEL_ACTOR] });
    const getPackingOrder = createGetPackingOrder(deps);

    await getPackingOrder(ACTOR, { orderId: PEDIDO });

    expect(findPackingStepsById).toHaveBeenCalledWith('receta-1', EMPRESA);
  });

  it('R27: la salida no tiene ninguna clave con los pasos del operador', async () => {
    const { deps } = montar({ items: [RESUMEN_DEL_ACTOR] });
    const getPackingOrder = createGetPackingOrder(deps);

    const row = await getPackingOrder(ACTOR, { orderId: PEDIDO });

    expect(Object.keys(row).filter((key) => /steps/i.test(key))).toEqual(['packingSteps']);
    expect(JSON.stringify(row)).not.toContain(MEZCLAR_OPERADOR);
  });

  it('R28: un actor con solo `empaque.modificar` recibe los pasos', async () => {
    const { deps } = montar({ items: [RESUMEN_DEL_ACTOR] });
    const getPackingOrder = createGetPackingOrder(deps);
    const soloEmpaque: Actor = { id: ANA, companyId: EMPRESA, permissions: ['empaque.modificar'] };

    const row = await getPackingOrder(soloEmpaque, { orderId: PEDIDO });

    expect(row.packingSteps).toEqual([ENVASAR, ETIQUETAR]);
  });

  it('R28: sin `empaque.modificar` rechaza antes de validar y sin llamar a ningun puerto, lector incluido', async () => {
    const { deps, todos } = montar({ items: [RESUMEN_DEL_ACTOR] });
    const getPackingOrder = createGetPackingOrder(deps);
    const sinPermiso: Actor = {
      id: ANA,
      companyId: EMPRESA,
      permissions: ['recetas.consultar', 'asignaciones.ejecutar'],
    };

    await expect(getPackingOrder(sinPermiso, { orderId: 'no-es-uuid' })).rejects.toThrow(UnauthorizedError);
    for (const doble of todos) expect(doble).not.toHaveBeenCalled();
  });
});

describe('getPackingOrder — un pedido en un estado de acondicionamiento no tiene detalle de empaque', () => {
  it.each(['POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO'] as const)(
    'R23: un pedido %s responde `order_not_found` sin leer envases ni pasos',
    async (status) => {
      const { deps, listAliveSummariesByIds, findPackagingRefs, findPackingStepsById } = montar();
      // El catalogo filtra por los estados que recibe, como el adaptador real.
      listAliveSummariesByIds.mockImplementation(async (...args: unknown[]) => {
        const statuses = args[2] as readonly string[];
        const items = statuses.includes(status) ? [{ ...RESUMEN, status, packedBy: ANA }] : [];
        return { items, total: items.length, page: 1, pageSize: 1, totalPages: items.length };
      });
      const getPackingOrder = createGetPackingOrder(deps);

      await expect(getPackingOrder(ACTOR, { orderId: PEDIDO })).rejects.toBeInstanceOf(OrderNotFoundError);
      expect(findPackagingRefs).not.toHaveBeenCalled();
      expect(findPackingStepsById).not.toHaveBeenCalled();
    },
  );
});

describe('getPackingOrder — evidencia (R14, R27, R33)', () => {
  const PASOS_CON_EVIDENCIA = [{ ...ENVASAR, requiresEvidence: true }, ETIQUETAR];
  const EN_EMPAQUE_DE_ANA = { ...RESUMEN_EN_EMPAQUE, recipeId: 'receta-1', packedBy: ANA };

  function fila(id: string, stepPosition: number, slot: number) {
    return { id, orderId: PEDIDO, phase: 'packing', stepPosition, slot, path: `${EMPRESA}/${PEDIDO}/${id}` };
  }

  it('R14, R33: quien empaca recibe las fotos de envasado por paso, cada una con URL firmada de 15 minutos', async () => {
    const d = montar({
      items: [EN_EMPAQUE_DE_ANA],
      packingSteps: PASOS_CON_EVIDENCIA,
      fotos: [fila('f2', 1, 2), fila('f1', 1, 1)],
    });
    const order = await createGetPackingOrder(d.deps)(ACTOR, { orderId: PEDIDO });
    expect(order.packingEvidence).toEqual([
      {
        stepPosition: 1,
        photos: [
          { id: 'f1', slot: 1, url: `https://bucket.test/${EMPRESA}/${PEDIDO}/f1?ttl=900` },
          { id: 'f2', slot: 2, url: `https://bucket.test/${EMPRESA}/${PEDIDO}/f2?ttl=900` },
        ],
      },
    ]);
    expect(d.listEvidenceByOrder).toHaveBeenCalledWith(EMPRESA, PEDIDO, 'packing');
    for (const call of d.createSignedReadUrl.mock.calls) expect(call[1]).toBe(15 * 60);
  });

  it('R27, R33: si empaca otro, ni pasos ni fotos: no consulta ni firma nada', async () => {
    const d = montar({ items: [RESUMEN_EN_EMPAQUE], packingSteps: PASOS_CON_EVIDENCIA, fotos: [fila('f1', 1, 1)] });
    const order = await createGetPackingOrder(d.deps)(ACTOR, { orderId: PEDIDO });
    expect(order.packingSteps).toEqual([]);
    expect(order.packingEvidence).toEqual([]);
    expect(d.listEvidenceByOrder).not.toHaveBeenCalled();
    expect(d.createSignedReadUrl).not.toHaveBeenCalled();
  });

  it('R14: antes de Comenzar (POR_EMPACAR) no hay fotos que leer', async () => {
    const d = montar({ packingSteps: PASOS_CON_EVIDENCIA });
    const order = await createGetPackingOrder(d.deps)(ACTOR, { orderId: PEDIDO });
    expect(order.packingEvidence).toEqual([]);
    expect(d.listEvidenceByOrder).not.toHaveBeenCalled();
  });

  it('R14: sin pasos de envasado que pidan evidencia no consulta fotos', async () => {
    const d = montar({ items: [EN_EMPAQUE_DE_ANA] });
    const order = await createGetPackingOrder(d.deps)(ACTOR, { orderId: PEDIDO });
    expect(order.packingEvidence).toEqual([]);
    expect(d.listEvidenceByOrder).not.toHaveBeenCalled();
  });
});

describe('QC-281 — getPackingOrder: lo que necesita el dialogo de Terminar', () => {
  const LINEA_GALON = uuid('a');
  const LINEA_BOTELLA = uuid('b');
  const GALON = uuid('c');
  const BOTELLA = uuid('d');

  const PRESENTACIONES = [
    { id: 'presentacion-1', name: 'Galon 3,78 L', content: '3.7800', unitId: 'unidad-1' },
    { id: 'presentacion-2', name: 'Botella 1 L', content: '1000.0000', unitId: 'unidad-ml' },
  ];
  const UNIDADES = [
    { id: 'unidad-1', name: 'Litro', symbol: 'L', baseUnitId: null, factor: null },
    { id: 'unidad-ml', name: 'Mililitro', symbol: 'ml', baseUnitId: 'unidad-1', factor: '0.001' },
  ];
  const ENVASE_GALON = {
    id: GALON,
    name: 'Envase galon',
    presentationId: 'presentacion-1',
    presentationName: 'Galon 3,78 L',
    content: '3.7800',
    unitId: 'unidad-1',
    available: '6.0000',
  };
  const ENVASE_BOTELLA = {
    id: BOTELLA,
    name: 'Envase botella',
    presentationId: 'presentacion-2',
    presentationName: 'Botella 1 L',
    content: '1000.0000',
    unitId: 'unidad-ml',
    available: '2.5000',
  };

  const LINEA_GALON_PLAN = {
    id: LINEA_GALON,
    presentationId: 'presentacion-1',
    packages: 14,
    packedPackages: null,
    presentationContent: '3.7800',
    packagingProductId: GALON,
    packagingName: 'Envase galon',
  };
  const LINEA_BOTELLA_PLAN = {
    id: LINEA_BOTELLA,
    presentationId: 'presentacion-2',
    packages: 15,
    packedPackages: null,
    presentationContent: null,
    packagingProductId: BOTELLA,
    packagingName: 'Envase botella',
  };

  const EN_EMPAQUE_DE_ANA = {
    ...RESUMEN,
    quantity: '80.0000',
    status: 'EN_EMPAQUE',
    packedBy: ANA,
    presentationLines: [LINEA_GALON_PLAN, LINEA_BOTELLA_PLAN],
  };

  function montarConteo(items: readonly unknown[], envases: readonly unknown[] = [ENVASE_GALON, ENVASE_BOTELLA]) {
    return montar({ items, presentaciones: PRESENTACIONES, unidades: UNIDADES, envases });
  }

  it('R1: al empacador en `EN_EMPAQUE` le llega cada linea con su plan, contenido, unidad y envase', async () => {
    const d = montarConteo([EN_EMPAQUE_DE_ANA]);

    const order = await createGetPackingOrder(d.deps)(ACTOR, { orderId: PEDIDO });

    expect(order.finish).toEqual({
      orderQuantity: '80.0000',
      orderUnit: { id: 'unidad-1', baseUnitId: null, factor: null },
      orderUnitLabel: 'L',
      lines: [
        {
          lineId: LINEA_GALON,
          label: 'Envase galon',
          plan: 14,
          content: '3.7800',
          unit: { id: 'unidad-1', baseUnitId: null, factor: null },
          packaging: { productId: GALON, name: 'Envase galon', freePackages: 6, imageUrl: null },
        },
        {
          lineId: LINEA_BOTELLA,
          label: 'Envase botella',
          plan: 15,
          content: '1000.0000',
          unit: { id: 'unidad-ml', baseUnitId: 'unidad-1', factor: '0.001' },
          packaging: { productId: BOTELLA, name: 'Envase botella', freePackages: 2, imageUrl: null },
        },
      ],
    });
  });

  it('R1: el contenido copiado en la linea manda sobre el vigente de la presentacion', async () => {
    const d = montarConteo([
      { ...EN_EMPAQUE_DE_ANA, presentationLines: [{ ...LINEA_GALON_PLAN, presentationContent: '4.0000' }] },
    ]);

    const order = await createGetPackingOrder(d.deps)(ACTOR, { orderId: PEDIDO });

    expect(order.finish?.lines[0]?.content).toBe('4.0000');
  });

  it('R9: `freePackages` es la parte entera del disponible libre, leido sin excluir ningun pedido', async () => {
    const d = montarConteo([EN_EMPAQUE_DE_ANA]);

    const order = await createGetPackingOrder(d.deps)(ACTOR, { orderId: PEDIDO });

    expect(d.findPackagingRefs).toHaveBeenCalledTimes(1);
    expect(d.findPackagingRefs).toHaveBeenCalledWith([GALON, BOTELLA], EMPRESA);
    expect(order.finish?.lines.map((line) => line.packaging?.freePackages)).toEqual([6, 2]);
  });

  it('R9: un disponible negativo o un envase que no vuelve del catalogo dan 0 libres', async () => {
    const d = montarConteo([EN_EMPAQUE_DE_ANA], [{ ...ENVASE_GALON, available: '-3.0000' }]);

    const order = await createGetPackingOrder(d.deps)(ACTOR, { orderId: PEDIDO });

    expect(order.finish?.lines.map((line) => line.packaging)).toEqual([
      { productId: GALON, name: 'Envase galon', freePackages: 0, imageUrl: null },
      { productId: BOTELLA, name: 'Envase botella', freePackages: 0, imageUrl: null },
    ]);
  });

  it('imagen del envase: cada linea lleva la URL que devuelve el catalogo, y `null` si el envase no tiene imagen', async () => {
    const d = montarConteo(
      [EN_EMPAQUE_DE_ANA],
      [{ ...ENVASE_GALON, imageUrl: 'https://cdn.test/productos/galon.png' }, { ...ENVASE_BOTELLA, imageUrl: null }],
    );

    const order = await createGetPackingOrder(d.deps)(ACTOR, { orderId: PEDIDO });

    expect(order.finish?.lines.map((line) => line.packaging?.imageUrl)).toEqual([
      'https://cdn.test/productos/galon.png',
      null,
    ]);
  });

  it('imagen del envase: si el envase no vuelve del catalogo cae a la de la linea y, sin ella, a `null`', async () => {
    const d = montarConteo(
      [
        {
          ...EN_EMPAQUE_DE_ANA,
          presentationLines: [
            { ...LINEA_GALON_PLAN, packagingImageUrl: 'https://cdn.test/productos/galon-linea.png' },
            LINEA_BOTELLA_PLAN,
          ],
        },
      ],
      [],
    );

    const order = await createGetPackingOrder(d.deps)(ACTOR, { orderId: PEDIDO });

    expect(order.finish?.lines.map((line) => line.packaging?.imageUrl)).toEqual([
      'https://cdn.test/productos/galon-linea.png',
      null,
    ]);
  });

  it('R25: una linea antigua sin envase sale con `packaging: null` y la presentacion como etiqueta', async () => {
    const antigua = {
      ...LINEA_GALON_PLAN,
      packages: 3,
      presentationContent: null,
      packagingProductId: null,
      packagingName: null,
    };
    const d = montarConteo([{ ...EN_EMPAQUE_DE_ANA, presentationLines: [antigua] }]);

    const order = await createGetPackingOrder(d.deps)(ACTOR, { orderId: PEDIDO });

    expect(order.finish?.lines).toEqual([
      {
        lineId: LINEA_GALON,
        label: 'Galon 3,78 L',
        plan: 3,
        content: '3.7800',
        unit: { id: 'unidad-1', baseUnitId: null, factor: null },
        packaging: null,
      },
    ]);
    expect(d.findPackagingRefs).not.toHaveBeenCalled();
  });

  it('R1: en `POR_EMPACAR` no hay conteo y no se lee ningun envase', async () => {
    const d = montarConteo([{ ...EN_EMPAQUE_DE_ANA, status: 'POR_EMPACAR', packedBy: null }]);

    const order = await createGetPackingOrder(d.deps)(ACTOR, { orderId: PEDIDO });

    expect(order.finish).toBeNull();
    expect(d.findPackagingRefs).not.toHaveBeenCalled();
  });

  it('R1, R14: en `EN_EMPAQUE` de otro empacador no hay conteo y no se lee ningun envase', async () => {
    const d = montarConteo([{ ...EN_EMPAQUE_DE_ANA, packedBy: BETO }]);

    const order = await createGetPackingOrder(d.deps)(ACTOR, { orderId: PEDIDO });

    expect(order.finish).toBeNull();
    expect(d.findPackagingRefs).not.toHaveBeenCalled();
  });

  it('un pedido sin unidad no tiene con que validar el conteo: `finish` es null', async () => {
    const d = montarConteo([{ ...EN_EMPAQUE_DE_ANA, unitId: null }]);

    const order = await createGetPackingOrder(d.deps)(ACTOR, { orderId: PEDIDO });

    expect(order.finish).toBeNull();
  });

  // Hallazgo m5 de la revision. Un `EN_EMPAQUE` sin reparto no se puede producir hoy: Comenzar
  // devuelve `without_distribution` sin lineas (QC-170), el reparto deja de ser editable al
  // Comenzar (`REPARTO_EDITABLE_STATUSES`) y el backfill 20260927120200 aborto si quedaba alguno.
  // Si apareciera a mano en la base, la vista NO lo frena: `finish` sale con cero lineas, el
  // dialogo envia `[]` y `finishPacking` lo rechaza con `validation_error` (finish-packing.test).
  it('m5: un `EN_EMPAQUE` legado sin reparto (imposible por Comenzar y el backfill) sale con `finish` de cero lineas, no null', async () => {
    const d = montarConteo([{ ...EN_EMPAQUE_DE_ANA, presentationLines: [] }]);

    const order = await createGetPackingOrder(d.deps)(ACTOR, { orderId: PEDIDO });

    expect(order.finish).toEqual({
      orderQuantity: '80.0000',
      orderUnit: { id: 'unidad-1', baseUnitId: null, factor: null },
      orderUnitLabel: 'L',
      lines: [],
    });
    expect(d.findPackagingRefs).not.toHaveBeenCalled();
  });

  it('R29: todas las lecturas del conteo van con la empresa del actor', async () => {
    const d = montarConteo([EN_EMPAQUE_DE_ANA]);

    await createGetPackingOrder(d.deps)(ACTOR, { orderId: PEDIDO });

    for (const call of d.findPresentationRefs.mock.calls) expect(call[1]).toBe(EMPRESA);
    for (const call of d.findUnitRefs.mock.calls) expect(call[1]).toBe(EMPRESA);
    for (const call of d.findPackagingRefs.mock.calls) expect(call[1]).toBe(EMPRESA);
  });
});
