// El detalle del acondicionador: la misma fila de «Por acondicionar» para un pedido, y el mismo
// `order_not_found` en todos los casos que no debe abrir.
import { describe, expect, it, vi } from 'vitest';

import { createGetConditioningOrder } from '@/lib/modules/asignaciones/domain/get-conditioning-order';
import { createListConditioningOrders } from '@/lib/modules/asignaciones/domain/list-conditioning-orders';
import {
  AsignacionesError,
  OrderNotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/modules/asignaciones/domain/errors';
import { ROLE_ADMINISTRADOR, ROLE_EMPACADOR, ROLE_OPERADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity';

import type { FinishedBatchLabels, FinishedBatchOfOrderLine } from '@/lib/modules/inventario';
import type { AssignedOrderSummary } from '@/lib/modules/pedidos';
import type { ConditioningTeamMemberRow } from '@/lib/modules/asignaciones/ports/conditioning-team-repository';
import type { ConditioningStepView } from '@/lib/modules/recetas';
import type { ExecutionEntryRecord } from '@/lib/modules/asignaciones/domain/execution-entry';

import {
  ACONDICIONADOR,
  ANA,
  BETO,
  EMPRESA,
  PEDIDO_1,
  RECETA,
  UNIDAD,
  actoresSinElPermiso,
  anotacionDePaso,
  fotoDeAcondicionamiento,
  loteDeLinea,
  montar,
  persona,
  receta,
  resumen,
  uuid,
} from './conditioning-doubles';

const LINEAS = [
  { id: 'linea-1', presentationId: 'pres-500', packages: 12, packedPackages: null, presentationContent: null, packagingProductId: null, packagingName: '500 g' },
  { id: 'linea-2', presentationId: 'pres-1k', packages: 4, packedPackages: null, presentationContent: null, packagingProductId: null, packagingName: '1 kg' },
];

function montarCon(item: AssignedOrderSummary | null, batches?: readonly FinishedBatchOfOrderLine[]) {
  return montar({
    batches,
    items: item === null ? [] : [item],
    refs: [receta()],
    people: [persona(ANA, 'Ana Lopez'), persona(BETO, 'Beto Ruiz')],
    presentations: [
      { id: 'pres-500', name: 'Bolsa 500 g' },
      { id: 'pres-1k', name: 'Bolsa 1 kg' },
    ] as never,
    units: [{ id: UNIDAD, name: 'Kilogramo', symbol: 'kg', baseUnitId: null, factor: null }],
  });
}

describe('R19 — getConditioningOrder exige el permiso antes de validar y sin tocar ningun puerto', () => {
  it.each(actoresSinElPermiso(SEED_ROLE_PERMISSIONS, [ROLE_ADMINISTRADOR, ROLE_OPERADOR, ROLE_EMPACADOR]))(
    'R19: rechaza con `unauthorized` a %s, aun con un id que no es uuid',
    async (_nombre, actor) => {
      const { deps, todos } = montar();

      const resultado = createGetConditioningOrder(deps)(actor, { orderId: 'no-es-uuid' });

      await expect(resultado).rejects.toBeInstanceOf(UnauthorizedError);
      await expect(resultado).rejects.toBeInstanceOf(AsignacionesError);
      for (const doble of todos) expect(doble).not.toHaveBeenCalled();
    },
  );
});

describe('R20 — la entrada es exactamente `{ orderId: <uuid> }`', () => {
  it.each([
    ['id que no es uuid', { orderId: 'pedido-1' }],
    ['sin orderId', {}],
    ['una clave de mas', { orderId: PEDIDO_1, extra: 1 }],
    ['orderId numerico', { orderId: 7 }],
    ['no es un objeto', PEDIDO_1],
  ])('R20: %s se rechaza con `invalid_input` sin tocar ningun puerto', async (_nombre, entrada) => {
    const { deps, todos } = montar();

    const resultado = createGetConditioningOrder(deps)(ACONDICIONADOR, entrada);

    await expect(resultado).rejects.toBeInstanceOf(ValidationError);
    await expect(resultado).rejects.toMatchObject({ code: 'invalid_input' });
    for (const doble of todos) expect(doble).not.toHaveBeenCalled();
  });
});

describe('R15 — el detalle muestra la misma fila que la lista', () => {
  it('R15, D13 (QC-219): consulta ese pedido de la empresa del actor con los cuatro estados que abre el detalle', async () => {
    const { deps, listAliveSummariesByIds } = montarCon(resumen(PEDIDO_1));

    await createGetConditioningOrder(deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    expect(listAliveSummariesByIds).toHaveBeenCalledWith(
      EMPRESA,
      [PEDIDO_1],
      ['POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO'],
      1,
      1,
    );
  });

  it.each([
    ['POR_ACONDICIONAR sin quien acondiciona', resumen(PEDIDO_1, { presentationLines: LINEAS })],
    [
      'EN_ACONDICIONAMIENTO de otra persona',
      resumen(PEDIDO_1, { status: 'EN_ACONDICIONAMIENTO', conditionedBy: BETO, presentationLines: LINEAS }),
    ],
    [
      'EN_ACONDICIONAMIENTO del propio actor',
      resumen(PEDIDO_1, { status: 'EN_ACONDICIONAMIENTO', conditionedBy: ANA, presentationLines: LINEAS }),
    ],
    [
      'TERMINADO que acondiciono el propio actor',
      resumen(PEDIDO_1, {
        status: 'TERMINADO',
        conditionedBy: ANA,
        finishedAt: new Date('2026-10-02T00:00:00.000Z'),
        presentationLines: LINEAS,
      }),
    ],
  ])('R15: %s abre con los mismos valores que su fila de la lista', async (_nombre, item) => {
    const detalle = montarCon(item);
    const lista = montarCon(item);

    const { team, batchData, conditioningSteps, ...fila } = await createGetConditioningOrder(detalle.deps)(ACONDICIONADOR, {
      orderId: PEDIDO_1,
    });
    const [deLaLista] = (await createListConditioningOrders(lista.deps)(ACONDICIONADOR, { page: 1 })).items;

    expect(fila).toEqual(deLaLista);
    expect(team).toEqual([]);
    // La receta de estos dobles no tiene pasos de acondicionamiento.
    expect(conditioningSteps).toBeNull();
    // QC-219 R3: los datos de lote solo viajan a quien acondiciona, desde que comenzo.
    expect(batchData === null).toBe(item.status === 'POR_ACONDICIONAR' || item.conditionedBy !== ANA);
    expect(fila.status).toBe(item.status);
    expect(fila.numberText).toBe('2026-0000007');
    expect(fila.recipeName).toBe('Jabon liquido');
    expect(fila.quantity).toBe('10.0000');
    expect(fila.unitLabel).toBe('kg');
    expect(fila.presentationLines.map((linea) => [linea.packages, linea.packagingName])).toEqual([
      [12, '500 g'],
      [4, '1 kg'],
    ]);
    const nombres: Record<string, string> = { [ANA]: 'Ana Lopez', [BETO]: 'Beto Ruiz' };
    expect(fila.conditionedByName).toBe(item.conditionedBy === null ? null : nombres[item.conditionedBy]);
  });
});

describe('R17 — el mismo `order_not_found` en todos los casos que el detalle no abre', () => {
  it('R17: un pedido que no existe, esta de baja o es de otra empresa (la consulta no lo devuelve)', async () => {
    const { deps } = montarCon(null);

    const resultado = createGetConditioningOrder(deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    await expect(resultado).rejects.toBeInstanceOf(OrderNotFoundError);
    await expect(resultado).rejects.toMatchObject({ code: 'order_not_found' });
  });

  it('R17: los estados de antes del acondicionamiento y CANCELADO no estan entre los consultados', async () => {
    const { deps, listAliveSummariesByIds } = montarCon(null);

    await expect(createGetConditioningOrder(deps)(ACONDICIONADOR, { orderId: PEDIDO_1 })).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
    const estados = listAliveSummariesByIds.mock.calls[0]?.[2];
    for (const fuera of ['PENDIENTE', 'EN_CURSO', 'POR_EMPACAR', 'EN_EMPAQUE', 'CANCELADO', 'BLOQUEADO']) {
      expect(estados).not.toContain(fuera);
    }
  });

  it.each([
    ['TERMINADO que acondiciono otra persona', 'TERMINADO', BETO],
    ['TERMINADO sin quien acondiciona', 'TERMINADO', null],
    ['ENTREGADO que acondiciono otra persona (D13, QC-219 R21)', 'ENTREGADO', BETO],
    ['ENTREGADO sin quien acondiciona (D13, QC-219 R21)', 'ENTREGADO', null],
  ] as const)('R17: %s es `order_not_found`, sin componer la fila', async (_nombre, status, conditionedBy) => {
    const { deps, findRefsIncludingDeleted, findRefsIncludingDeletedInCompany, listOfOrder } = montarCon(
      resumen(PEDIDO_1, { status, conditionedBy, finishedAt: new Date('2026-10-02T00:00:00.000Z') }),
    );

    const resultado = createGetConditioningOrder(deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    await expect(resultado).rejects.toBeInstanceOf(OrderNotFoundError);
    await expect(resultado).rejects.toMatchObject({ code: 'order_not_found' });
    expect(findRefsIncludingDeleted).not.toHaveBeenCalled();
    expect(findRefsIncludingDeletedInCompany).not.toHaveBeenCalled();
    expect(listOfOrder).not.toHaveBeenCalled();
  });

  it('R17: todos los casos lanzan el mismo error, con el mismo codigo y mensaje', async () => {
    const casos = [
      montarCon(null),
      montarCon(resumen(PEDIDO_1, { status: 'TERMINADO', conditionedBy: BETO, finishedAt: new Date() })),
      montarCon(resumen(PEDIDO_1, { status: 'TERMINADO', conditionedBy: null, finishedAt: new Date() })),
    ];
    const errores = await Promise.all(
      casos.map(({ deps }) =>
        createGetConditioningOrder(deps)(ACONDICIONADOR, { orderId: PEDIDO_1 }).catch((error: unknown) => error),
      ),
    );

    const firmas = errores.map((error) => {
      const e = error as OrderNotFoundError;
      return [e.constructor.name, e.code, e.message];
    });
    expect(new Set(firmas.map((firma) => JSON.stringify(firma))).size).toBe(1);
    expect(firmas[0]?.[1]).toBe('order_not_found');
  });
});

describe('R25 — el detalle trae el equipo guardado (D12)', () => {
  const CARLA = uuid('c');
  const DIEGO = uuid('d');
  const GRUPO = uuid('e');
  const EQUIPO: readonly ConditioningTeamMemberRow[] = [
    { userId: BETO, workGroupId: null, workGroupName: null },
    { userId: CARLA, workGroupId: GRUPO, workGroupName: 'Turno manana' },
    { userId: DIEGO, workGroupId: GRUPO, workGroupName: 'Turno manana' },
  ];

  function montarConEquipo(item: AssignedOrderSummary, nombres: ReturnType<typeof persona>[]) {
    return montar({
      items: [item],
      refs: [receta()],
      people: nombres,
      units: [{ id: UNIDAD, name: 'Kilogramo', symbol: 'kg', baseUnitId: null, factor: null }],
      team: EQUIPO,
    });
  }

  it.each([
    ['EN_ACONDICIONAMIENTO', resumen(PEDIDO_1, { status: 'EN_ACONDICIONAMIENTO', conditionedBy: ANA })],
    [
      'TERMINADO',
      resumen(PEDIDO_1, { status: 'TERMINADO', conditionedBy: ANA, finishedAt: new Date('2026-10-02T00:00:00.000Z') }),
    ],
  ])('R25: en %s devuelve las sueltas y cada miembro con el grupo y su nombre congelado, en orden', async (_n, item) => {
    const dobles = montarConEquipo(item, [
      persona(ANA, 'Ana Lopez'),
      persona(BETO, 'Beto Ruiz'),
      persona(CARLA, 'Carla Diaz'),
      persona(DIEGO, 'Diego Mora'),
    ]);

    const detalle = await createGetConditioningOrder(dobles.deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    expect(dobles.listTeamByOrderInCompany).toHaveBeenCalledWith(EMPRESA, PEDIDO_1);
    expect(detalle.team).toEqual([
      { userId: BETO, displayName: 'Beto Ruiz', origin: { kind: 'direct' } },
      {
        userId: CARLA,
        displayName: 'Carla Diaz',
        origin: { kind: 'workGroup', workGroupId: GRUPO, workGroupName: 'Turno manana' },
      },
      {
        userId: DIEGO,
        displayName: 'Diego Mora',
        origin: { kind: 'workGroup', workGroupId: GRUPO, workGroupName: 'Turno manana' },
      },
    ]);
    expect(detalle.conditionedByName).toBe('Ana Lopez');
  });

  it('R25: los nombres salen de la lectura que incluye a las personas dadas de baja, la misma de quien acondiciona', async () => {
    // La lectura incluye a las dadas de baja: Diego ya no esta vivo y sigue teniendo nombre.
    const dobles = montarConEquipo(resumen(PEDIDO_1, { status: 'EN_ACONDICIONAMIENTO', conditionedBy: ANA }), [
      persona(ANA, 'Ana Lopez'),
      persona(BETO, 'Beto Ruiz'),
      persona(CARLA, 'Carla Diaz'),
      persona(DIEGO, 'Diego Mora (de baja)'),
    ]);

    const detalle = await createGetConditioningOrder(dobles.deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    expect(dobles.findRefsIncludingDeletedInCompany).toHaveBeenCalledTimes(1);
    const [empresa, ids] = dobles.findRefsIncludingDeletedInCompany.mock.calls[0] as unknown as [string, string[]];
    expect(empresa).toBe(EMPRESA);
    expect([...ids].sort()).toEqual([ANA, BETO, CARLA, DIEGO].sort());
    expect(detalle.team.find((miembro) => miembro.userId === DIEGO)?.displayName).toBe('Diego Mora (de baja)');
  });

  it('R25: en POR_ACONDICIONAR no lee el equipo y lo devuelve vacio', async () => {
    const dobles = montarConEquipo(resumen(PEDIDO_1), [persona(ANA, 'Ana Lopez')]);

    const detalle = await createGetConditioningOrder(dobles.deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    expect(dobles.listTeamByOrderInCompany).not.toHaveBeenCalled();
    expect(detalle.team).toEqual([]);
  });
});

describe('QC-219 — los datos de lote del detalle', () => {
  const LOTE_500 = uuid('7');
  const LOTE_1K = uuid('8');
  const DATOS = { lot: 'CR-2610-A', expiryDate: '2027-04-30', productionDate: '2026-10-01' };

  it.each([
    ['POR_ACONDICIONAR', resumen(PEDIDO_1, { presentationLines: LINEAS })],
    [
      'EN_ACONDICIONAMIENTO de otra persona',
      resumen(PEDIDO_1, { status: 'EN_ACONDICIONAMIENTO', conditionedBy: BETO, presentationLines: LINEAS }),
    ],
  ])('R3: en %s `batchData` es null y no se leen los lotes', async (_nombre, item) => {
    const { deps, listOfOrder } = montarCon(item, [loteDeLinea('pres-500', LOTE_500, DATOS)]);

    const detalle = await createGetConditioningOrder(deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    expect(detalle.batchData).toBeNull();
    expect(listOfOrder).not.toHaveBeenCalled();
  });

  it.each([
    ['EN_ACONDICIONAMIENTO', resumen(PEDIDO_1, { status: 'EN_ACONDICIONAMIENTO', conditionedBy: ANA, presentationLines: LINEAS })],
    [
      'TERMINADO',
      resumen(PEDIDO_1, { status: 'TERMINADO', conditionedBy: ANA, finishedAt: new Date(), presentationLines: LINEAS }),
    ],
    [
      'ENTREGADO (D13)',
      resumen(PEDIDO_1, { status: 'ENTREGADO', conditionedBy: ANA, finishedAt: new Date(), presentationLines: LINEAS }),
    ],
  ])('R1, R2, R4, R18, R21: en %s propio trae una linea por linea del reparto, en orden, y cuenta las que faltan', async (_n, item) => {
    const { deps, listOfOrder } = montarCon(item, [
      loteDeLinea('pres-1k', LOTE_1K),
      loteDeLinea('pres-500', LOTE_500, DATOS),
    ]);

    const detalle = await createGetConditioningOrder(deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    expect(listOfOrder).toHaveBeenCalledWith(EMPRESA, PEDIDO_1);
    expect(detalle.batchData).toEqual({
      lines: [
        {
          batchId: LOTE_500,
          presentationId: 'pres-500',
          presentationName: 'Bolsa 500 g',
          packagingName: '500 g',
          packages: 12,
          provisionalLot: null,
          lot: 'CR-2610-A',
          expiryDate: '2027-04-30',
          productionDate: '2026-10-01',
        },
        {
          batchId: LOTE_1K,
          presentationId: 'pres-1k',
          presentationName: 'Bolsa 1 kg',
          packagingName: '1 kg',
          packages: 4,
          provisionalLot: 'AUTO-pres-1k',
          lot: null,
          expiryDate: null,
          productionDate: null,
        },
      ],
      missingCount: 1,
      // QC-284 R15: una linea con datos y otra sin ellos = lotes distintos, con el codigo actual.
      form: {
        kind: 'divergent',
        lines: [
          { presentationId: 'pres-500', lot: 'CR-2610-A' },
          { presentationId: 'pres-1k', lot: 'AUTO-pres-1k' },
        ],
      },
    });
  });

  it('R17: una linea sin lote de produccion va sin `batchId` ni lote provisional y cuenta como sin datos', async () => {
    const { deps } = montarCon(
      resumen(PEDIDO_1, { status: 'EN_ACONDICIONAMIENTO', conditionedBy: ANA, presentationLines: LINEAS }),
      [loteDeLinea('pres-500', LOTE_500, DATOS)],
    );

    const detalle = await createGetConditioningOrder(deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    expect(detalle.batchData?.lines[1]).toMatchObject({ batchId: null, provisionalLot: null, lot: null });
    expect(detalle.batchData?.missingCount).toBe(1);
  });

  it('R17: un pedido sin reparto trae la seccion vacia y nada que falte', async () => {
    const { deps } = montarCon(resumen(PEDIDO_1, { status: 'EN_ACONDICIONAMIENTO', conditionedBy: ANA }));

    const detalle = await createGetConditioningOrder(deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    expect(detalle.batchData).toEqual({ lines: [], missingCount: 0, form: { kind: 'no_batches' } });
  });

  it('QC-284 R14: con las dos lineas con los mismos datos, el formulario abre relleno', async () => {
    const { deps } = montarCon(
      resumen(PEDIDO_1, { status: 'TERMINADO', conditionedBy: ANA, finishedAt: new Date(), presentationLines: LINEAS }),
      [loteDeLinea('pres-500', LOTE_500, DATOS), loteDeLinea('pres-1k', LOTE_1K, DATOS)],
    );

    const detalle = await createGetConditioningOrder(deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    expect(detalle.batchData?.form).toEqual({ kind: 'shared', ...DATOS });
  });

  it('QC-284 R16: abrir el detalle solo lee los lotes, nunca escribe', async () => {
    const { deps, listOfOrder } = montarCon(
      resumen(PEDIDO_1, { status: 'EN_ACONDICIONAMIENTO', conditionedBy: ANA, presentationLines: LINEAS }),
      [loteDeLinea('pres-500', LOTE_500, DATOS), loteDeLinea('pres-1k', LOTE_1K)],
    );
    const writeForOrder = vi.fn<FinishedBatchLabels['writeForOrder']>();

    const detalle = await createGetConditioningOrder({ ...deps, batches: { listOfOrder, writeForOrder } as never })(
      ACONDICIONADOR,
      { orderId: PEDIDO_1 },
    );

    expect(detalle.batchData?.form.kind).toBe('divergent');
    expect(listOfOrder).toHaveBeenCalledTimes(1);
    expect(writeForOrder).not.toHaveBeenCalled();
  });

  it('D13 (QC-219 R21): un ENTREGADO propio abre con su equipo', async () => {
    const { deps, listTeamByOrderInCompany } = montarCon(
      resumen(PEDIDO_1, { status: 'ENTREGADO', conditionedBy: ANA, finishedAt: new Date() }),
    );

    const detalle = await createGetConditioningOrder(deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    expect(detalle.status).toBe('ENTREGADO');
    expect(listTeamByOrderInCompany).toHaveBeenCalledWith(EMPRESA, PEDIDO_1);
  });
});

describe('QC-281 — acondicionamiento con los envases reales', () => {
  const LOTE_500 = uuid('7');
  const DATOS = { lot: 'CR-2610-A', expiryDate: '2027-04-30', productionDate: '2026-10-01' };
  const CONTADAS = [
    { ...LINEAS[0], packedPackages: 10 },
    { ...LINEAS[1], packedPackages: 0 },
  ];

  it('R23: la fila y los datos de lote muestran los envases reales, y la linea en 0 no cuenta como sin datos', async () => {
    const item = resumen(PEDIDO_1, { status: 'EN_ACONDICIONAMIENTO', conditionedBy: ANA, presentationLines: CONTADAS });
    const detalle = montarCon(item, [loteDeLinea('pres-500', LOTE_500, DATOS)]);
    const lista = montarCon(item);

    const order = await createGetConditioningOrder(detalle.deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });
    const [deLaLista] = (await createListConditioningOrders(lista.deps)(ACONDICIONADOR, { page: 1 })).items;

    expect(order.presentationLines.map((line) => [line.lineId, line.packages, line.packedPackages])).toEqual([
      ['linea-1', 10, 10],
      ['linea-2', 0, 0],
    ]);
    expect(deLaLista?.presentationLines.map((line) => line.packages)).toEqual([10, 0]);
    expect(order.batchData?.lines.map((line) => line.packages)).toEqual([10, 0]);
    expect(order.batchData?.missingCount).toBe(0);
  });

  it('R25: un pedido empacado sin conteo guardado sigue mostrando el plan y contando como hoy', async () => {
    const { deps } = montarCon(
      resumen(PEDIDO_1, { status: 'EN_ACONDICIONAMIENTO', conditionedBy: ANA, presentationLines: LINEAS }),
      [loteDeLinea('pres-500', LOTE_500, DATOS)],
    );

    const order = await createGetConditioningOrder(deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    expect(order.presentationLines.map((line) => [line.packages, line.packedPackages])).toEqual([
      [12, null],
      [4, null],
    ]);
    expect(order.batchData?.missingCount).toBe(1);
  });
});

describe('QC-299 — los pasos de acondicionamiento del detalle', () => {
  const CARLA = uuid('c');
  const PASOS: readonly ConditioningStepView[] = [
    { blocks: [] },
    { blocks: [], requiresAssignment: true },
    { blocks: [], requiresEvidence: true },
  ];
  const EQUIPO: readonly ConditioningTeamMemberRow[] = [
    { userId: CARLA, workGroupId: null, workGroupName: null },
    { userId: BETO, workGroupId: null, workGroupName: null },
  ];
  const MIO = resumen(PEDIDO_1, { status: 'EN_ACONDICIONAMIENTO', conditionedBy: ANA });

  function montarPasos(
    item: AssignedOrderSummary,
    options?: {
      readonly pasos?: readonly ConditioningStepView[] | null;
      readonly anotaciones?: readonly ExecutionEntryRecord[];
      readonly fotos?: ReturnType<typeof fotoDeAcondicionamiento>[];
      readonly equipo?: readonly ConditioningTeamMemberRow[];
    },
  ) {
    return montar({
      items: [item],
      refs: [receta()],
      people: [persona(ANA, 'Ana Lopez'), persona(BETO, 'Beto Ruiz'), persona(CARLA, 'Carla Diaz')],
      units: [{ id: UNIDAD, name: 'Kilogramo', symbol: 'kg', baseUnitId: null, factor: null }],
      team: options?.equipo ?? EQUIPO,
      pasos: options?.pasos === undefined ? PASOS : options.pasos,
      anotaciones: options?.anotaciones,
      fotos: options?.fotos,
    });
  }

  it.each([
    ['POR_ACONDICIONAR', resumen(PEDIDO_1)],
    ['EN_ACONDICIONAMIENTO de otra persona', resumen(PEDIDO_1, { status: 'EN_ACONDICIONAMIENTO', conditionedBy: BETO })],
    ['TERMINADO propio', resumen(PEDIDO_1, { status: 'TERMINADO', conditionedBy: ANA, finishedAt: new Date() })],
    ['ENTREGADO propio', resumen(PEDIDO_1, { status: 'ENTREGADO', conditionedBy: ANA, finishedAt: new Date() })],
  ])('R17: en %s no entrega pasos ni avance, y no llama al lector, al registro ni a las fotos', async (_n, item) => {
    const dobles = montarPasos(item);

    const detalle = await createGetConditioningOrder(dobles.deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    expect(detalle.conditioningSteps).toBeNull();
    expect(dobles.findConditioningStepsById).not.toHaveBeenCalled();
    expect(dobles.listEntriesForOrders).not.toHaveBeenCalled();
    expect(dobles.listEvidenceByOrder).not.toHaveBeenCalled();
    expect(dobles.createSignedReadUrl).not.toHaveBeenCalled();
  });

  it.each([
    ['sin pasos de acondicionamiento', []],
    ['que ya no se encuentra', null],
  ] as const)('R19: con una receta %s, `conditioningSteps` es null y no se lee el registro', async (_n, pasos) => {
    const dobles = montarPasos(MIO, { pasos });

    const detalle = await createGetConditioningOrder(dobles.deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    expect(detalle.conditioningSteps).toBeNull();
    expect(dobles.findConditioningStepsById).toHaveBeenCalledWith(RECETA, EMPRESA);
    expect(dobles.listEntriesForOrders).not.toHaveBeenCalled();
    expect(dobles.listEvidenceByOrder).not.toHaveBeenCalled();
  });

  it('R19: sin pasos, el resto del detalle es el mismo que sin la ficha', async () => {
    const sinPasos = montarPasos(MIO, { pasos: [] });
    const conPasos = montarPasos(MIO);

    const { conditioningSteps: nulo, ...uno } = await createGetConditioningOrder(sinPasos.deps)(ACONDICIONADOR, {
      orderId: PEDIDO_1,
    });
    const { conditioningSteps: vista, ...otro } = await createGetConditioningOrder(conPasos.deps)(ACONDICIONADOR, {
      orderId: PEDIDO_1,
    });

    expect(nulo).toBeNull();
    expect(vista).not.toBeNull();
    expect(uno).toEqual(otro);
  });

  it('R31, R18: EN_ACONDICIONAMIENTO propio entrega los pasos en su orden, el avance y los responsables vigentes', async () => {
    const dobles = montarPasos(MIO, {
      anotaciones: [
        anotacionDePaso('conditioning_step_advance', 1, null),
        anotacionDePaso('conditioning_step_advance', 2, [BETO]),
        anotacionDePaso('conditioning_responsibles_change', 2, [CARLA, ANA], 10),
      ],
    });

    const detalle = await createGetConditioningOrder(dobles.deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    expect(dobles.findConditioningStepsById).toHaveBeenCalledWith(RECETA, EMPRESA);
    expect(dobles.listEntriesForOrders).toHaveBeenCalledWith(EMPRESA, [PEDIDO_1]);
    expect(detalle.conditioningSteps).toMatchObject({
      steps: PASOS,
      completedCount: 2,
      responsibles: [{ stepPosition: 2, userIds: [CARLA, ANA] }],
    });
  });

  it('R28, R26: si la formula perdio pasos, la vista ignora los responsables de posiciones que ya no existen', async () => {
    const dobles = montarPasos(MIO, {
      pasos: PASOS.slice(0, 2),
      anotaciones: [
        anotacionDePaso('conditioning_step_advance', 1, [BETO]),
        anotacionDePaso('conditioning_step_advance', 2, [CARLA]),
        anotacionDePaso('conditioning_step_advance', 3, [ANA]),
        anotacionDePaso('conditioning_responsibles_change', 3, [BETO, CARLA], 10),
      ],
    });

    const detalle = await createGetConditioningOrder(dobles.deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    expect(detalle.conditioningSteps).toMatchObject({
      completedCount: 2,
      responsibles: [
        { stepPosition: 1, userIds: [BETO] },
        { stepPosition: 2, userIds: [CARLA] },
      ],
    });
  });

  it('R31: un acondicionador sin recetas.consultar recibe los pasos', async () => {
    const actor = { ...ACONDICIONADOR, permissions: ['acondicionamiento.modificar'] };
    const dobles = montarPasos(MIO);

    const detalle = await createGetConditioningOrder(dobles.deps)(actor, { orderId: PEDIDO_1 });

    expect(detalle.conditioningSteps?.steps).toEqual(PASOS);
    expect(detalle.conditioningSteps?.completedCount).toBe(0);
  });

  it('R22: los candidatos son el propio acondicionador primero, marcado, y despues el equipo en su orden', async () => {
    const dobles = montarPasos(MIO);

    const detalle = await createGetConditioningOrder(dobles.deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    expect(detalle.conditioningSteps?.candidates).toEqual([
      { userId: ANA, displayName: 'Ana Lopez', isSelf: true },
      { userId: CARLA, displayName: 'Carla Diaz', isSelf: false },
      { userId: BETO, displayName: 'Beto Ruiz', isSelf: false },
    ]);
  });

  it('R22: si el acondicionador tambien esta en el equipo, aparece una sola vez, como el mismo', async () => {
    const dobles = montarPasos(MIO, {
      equipo: [...EQUIPO, { userId: ANA, workGroupId: null, workGroupName: null }],
    });

    const detalle = await createGetConditioningOrder(dobles.deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    expect(detalle.conditioningSteps?.candidates.map((c) => [c.userId, c.isSelf])).toEqual([
      [ANA, true],
      [CARLA, false],
      [BETO, false],
    ]);
  });

  it('R21, R26: las fotos guardadas de acondicionamiento viajan firmadas, por paso', async () => {
    const dobles = montarPasos(MIO, { fotos: [fotoDeAcondicionamiento(3, 1)] });

    const detalle = await createGetConditioningOrder(dobles.deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    expect(dobles.listEvidenceByOrder).toHaveBeenCalledWith(EMPRESA, PEDIDO_1, 'conditioning');
    expect(detalle.conditioningSteps?.evidence).toEqual([
      {
        stepPosition: 3,
        photos: [{ id: 'foto-3-1', slot: 1, url: `firmada:${EMPRESA}/${PEDIDO_1}/foto-3-1` }],
      },
    ]);
  });

  it('R30: el detalle no lee los pasos del operador ni los de envasado', async () => {
    const dobles = montarPasos(MIO);
    const findExecutionContentById = vi.fn();
    const findPackingStepsById = vi.fn();
    const deps = {
      ...dobles.deps,
      recipes: { ...dobles.deps.recipes, findExecutionContentById },
      packingSteps: { findPackingStepsById },
    };

    const detalle = await createGetConditioningOrder(deps)(ACONDICIONADOR, { orderId: PEDIDO_1 });

    expect(detalle.conditioningSteps?.steps).toEqual(PASOS);
    expect(findExecutionContentById).not.toHaveBeenCalled();
    expect(findPackingStepsById).not.toHaveBeenCalled();
  });

  it('R32: pasos, registro y fotos se leen con la empresa del actor', async () => {
    const otra = uuid('4');
    const dobles = montarPasos(MIO);

    await createGetConditioningOrder(dobles.deps)({ ...ACONDICIONADOR, companyId: otra }, { orderId: PEDIDO_1 });

    expect(dobles.findConditioningStepsById).toHaveBeenCalledWith(RECETA, otra);
    expect(dobles.listEntriesForOrders).toHaveBeenCalledWith(otra, [PEDIDO_1]);
    expect(dobles.listEvidenceByOrder).toHaveBeenCalledWith(otra, PEDIDO_1, 'conditioning');
  });
});
