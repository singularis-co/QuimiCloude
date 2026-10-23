// tests/unit/asignaciones/finish-packing.test.ts
import { describe, expect, it, vi } from 'vitest';

import { createFinishPacking, type FinishPackingDeps } from '@/lib/modules/asignaciones/domain/finish-packing';
import {
  AsignacionesError,
  IncompatibleUnitsError,
  MaterialShortageError,
  OrderNotFoundError,
  OrderNotPackableError,
  OrderPackingTakenError,
  OrderWithoutUnitError,
  PackagingStockInsufficientError,
  PresentationWithoutContentError,
  RecipeNotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/modules/asignaciones/domain/errors';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';
import type { NewExecutionEntry } from '@/lib/modules/asignaciones/domain/execution-entry';
import type { ExecutionWriters } from '@/lib/modules/asignaciones/ports/execution-transaction';

function uuid(seed: string): string {
  return `${seed.repeat(8)}-${seed.repeat(4)}-4${seed.repeat(3)}-8${seed.repeat(3)}-${seed.repeat(12)}`;
}

const EMPRESA = uuid('3');
const ANA = uuid('1');
const PEDIDO = uuid('7');
const OTRA_EMPRESA = uuid('9');
const AHORA = new Date('2026-09-25T12:00:00.000Z');

const ACTOR: Actor = { id: ANA, companyId: EMPRESA, permissions: ['empaque.modificar'] };

const LINEAS = [
  { lineId: uuid('4'), packedPackages: 3, reason: null, reasonOther: null },
  { lineId: uuid('5'), packedPackages: 0, reason: 'rotura', reasonOther: null },
];

const ENTRADA = { orderId: PEDIDO, lines: LINEAS };

type Resultado =
  | { readonly kind: 'ok'; readonly finishedGoods: readonly unknown[] }
  | 'not_packer'
  | 'not_packable'
  | 'not_found'
  | 'recipe_not_found'
  | 'presentation_without_content'
  | 'incompatible_units'
  | 'order_without_unit'
  | 'insufficient_material'
  | 'invalid_packing_count'
  | 'packaging_stock_insufficient';

type Estado = { dentroDeRun: boolean; appendDentroDeRun: boolean | null; confirmada: boolean | null };

// [2026-10-06] `finishPacking` escribe dentro de `transaction.run` con el `packing` atado a la
// transaccion; las lecturas siguen en el `orders` global, antes y fuera de `run`. Los dobles
// registran si `append` se llamo DENTRO de `run` y si `run` confirmo o deshizo: solo lo confirmado
// llega a `filas`.
function montar(options?: {
  readonly target?: { readonly id: string; readonly status: string } | null;
  readonly summaryItems?: readonly unknown[];
  readonly resultado?: Resultado;
  readonly appendFalla?: Error;
  readonly pasos?: readonly { readonly requiresEvidence?: boolean }[] | null;
  readonly fotos?: readonly { readonly stepPosition: number }[];
}): {
  readonly deps: FinishPackingDeps;
  readonly findAliveById: ReturnType<typeof vi.fn>;
  readonly listAliveSummariesByIds: ReturnType<typeof vi.fn>;
  readonly finishPackingAliveById: ReturnType<typeof vi.fn>;
  readonly globalFinishPackingAliveById: ReturnType<typeof vi.fn>;
  readonly run: ReturnType<typeof vi.fn>;
  readonly append: ReturnType<typeof vi.fn>;
  readonly depsAppend: ReturnType<typeof vi.fn>;
  readonly filas: NewExecutionEntry[];
  readonly estado: Estado;
  readonly findPackingStepsById: ReturnType<typeof vi.fn>;
  readonly listEvidenceByOrder: ReturnType<typeof vi.fn>;
} {
  const findAliveById = vi.fn(async () => (options?.target === undefined ? { id: PEDIDO, status: 'EN_EMPAQUE' } : options.target));
  const listAliveSummariesByIds = vi.fn(async () => ({
    items: options?.summaryItems ?? [{ id: PEDIDO, number: { year: 2026, sequence: 7 } }],
    total: 1,
    page: 1,
    pageSize: 1,
    totalPages: 1,
  }));
  const finishPackingAliveById = vi.fn(async () => options?.resultado ?? { kind: 'ok' as const, finishedGoods: [] });

  const estado: Estado = { dentroDeRun: false, appendDentroDeRun: null, confirmada: null };
  const pendientes: NewExecutionEntry[] = [];
  const filas: NewExecutionEntry[] = [];
  const append = vi.fn(async (entry: NewExecutionEntry) => {
    estado.appendDentroDeRun = estado.dentroDeRun;
    if (options?.appendFalla) throw options.appendFalla;
    pendientes.push(entry);
  });
  const writers = {
    orders: {},
    packing: { startPackingAliveById: vi.fn(), finishPackingAliveById },
    log: { append, findLastStepPosition: vi.fn(async () => null) },
  } as unknown as ExecutionWriters;
  const run = vi.fn(async (work: (w: ExecutionWriters) => Promise<unknown>) => {
    estado.dentroDeRun = true;
    try {
      const salida = await work(writers);
      filas.push(...pendientes);
      estado.confirmada = true;
      return salida;
    } catch (error) {
      estado.confirmada = false;
      throw error;
    } finally {
      estado.dentroDeRun = false;
    }
  });

  const globalFinishPackingAliveById = vi.fn(async () => options?.resultado ?? { kind: 'ok' as const, finishedGoods: [] });
  const depsAppend = vi.fn(async () => undefined);
  const findPackingStepsById = vi.fn(async () => (options?.pasos === undefined ? [{ blocks: [] }] : options.pasos));
  const listEvidenceByOrder = vi.fn(async () => options?.fotos ?? []);
  const deps = {
    orders: { findAliveById, listAliveSummariesByIds, finishPackingAliveById: globalFinishPackingAliveById },
    log: { append: depsAppend, findLastStepPosition: vi.fn(async () => null) },
    transaction: { run },
    now: () => AHORA,
    packingSteps: { findPackingStepsById },
    evidence: { listByOrder: listEvidenceByOrder },
  } as unknown as FinishPackingDeps;

  return {
    deps,
    findAliveById,
    listAliveSummariesByIds,
    finishPackingAliveById,
    globalFinishPackingAliveById,
    run,
    append,
    depsAppend,
    filas,
    estado,
    findPackingStepsById,
    listEvidenceByOrder,
  };
}

describe('finishPacking — autorizacion (R13)', () => {
  it('actor ausente rechaza sin tocar ningun puerto', async () => {
    const { deps, findAliveById, finishPackingAliveById } = montar();
    const finishPacking = createFinishPacking(deps);

    await expect(finishPacking(null, ENTRADA)).rejects.toBeInstanceOf(AsignacionesError);
    expect(findAliveById).not.toHaveBeenCalled();
    expect(finishPackingAliveById).not.toHaveBeenCalled();
  });

  it('actor sin `empaque.modificar` rechaza sin tocar ningun puerto', async () => {
    const { deps, findAliveById } = montar();
    const finishPacking = createFinishPacking(deps);
    const actor: Actor = { id: ANA, companyId: EMPRESA, permissions: [] };

    await expect(finishPacking(actor, ENTRADA)).rejects.toThrow(UnauthorizedError);
    expect(findAliveById).not.toHaveBeenCalled();
  });

  it('la autorizacion corre ANTES que zod', async () => {
    const { deps, findAliveById } = montar();
    const finishPacking = createFinishPacking(deps);

    await expect(finishPacking({ id: ANA, companyId: EMPRESA, permissions: [] }, { ...ENTRADA, orderId: 'x' })).rejects.toThrow(
      UnauthorizedError,
    );
    expect(findAliveById).not.toHaveBeenCalled();
  });
});

describe('finishPacking — R21, R26: exito devuelve el numero leido antes de escribir', () => {
  it('lee el numero antes de llamar a `finishPackingAliveById` y lo devuelve', async () => {
    const { deps, listAliveSummariesByIds, finishPackingAliveById } = montar();
    const finishPacking = createFinishPacking(deps);

    const result = await finishPacking(ACTOR, ENTRADA);

    expect(result).toEqual({ numberText: expect.any(String) });
    expect(listAliveSummariesByIds).toHaveBeenCalledWith(EMPRESA, [PEDIDO], ['EN_EMPAQUE'], 1, 1);
    expect(finishPackingAliveById).toHaveBeenCalledWith(PEDIDO, EMPRESA, ANA, expect.any(Date), LINEAS);

    const ordenDeLlamadas = listAliveSummariesByIds.mock.invocationCallOrder[0]!;
    const ordenDeEscritura = finishPackingAliveById.mock.invocationCallOrder[0]!;
    expect(ordenDeLlamadas).toBeLessThan(ordenDeEscritura);
  });
});

describe('finishPacking — R22: quien no empaca el pedido', () => {
  it('`not_packer` rechaza con `order_packing_taken`', async () => {
    const { deps } = montar({ resultado: 'not_packer' });
    const finishPacking = createFinishPacking(deps);

    await expect(finishPacking(ACTOR, ENTRADA)).rejects.toBeInstanceOf(OrderPackingTakenError);
  });
});

describe('finishPacking — R23: estado que no admite Terminar', () => {
  it('`not_packable` rechaza con `order_not_packable`', async () => {
    const { deps } = montar({ resultado: 'not_packable' });
    const finishPacking = createFinishPacking(deps);

    await expect(finishPacking(ACTOR, ENTRADA)).rejects.toBeInstanceOf(OrderNotPackableError);
  });
});

describe('finishPacking — QC-215: los estados de acondicionamiento y TERMINADO no admiten Terminar', () => {
  for (const status of ['POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO'] as const) {
    it(`R23, R30: un pedido ${status} que el catalogo clasifica not_packable -> order_not_packable, sin fila en el registro`, async () => {
      const { deps, filas, estado } = montar({ target: { id: PEDIDO, status }, resultado: 'not_packable' });

      const error = await createFinishPacking(deps)(ACTOR, ENTRADA).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(OrderNotPackableError);
      expect((error as OrderNotPackableError).code).toBe('order_not_packable');
      expect(filas).toEqual([]);
      expect(estado.confirmada).toBe(false);
    });
  }
});

describe('finishPacking — R17-R21: da de alta el lote por linea del reparto', () => {
  it('`recipe_not_found` rechaza con `RecipeNotFoundError`', async () => {
    const { deps } = montar({ resultado: 'recipe_not_found' });
    const finishPacking = createFinishPacking(deps);

    await expect(finishPacking(ACTOR, ENTRADA)).rejects.toBeInstanceOf(RecipeNotFoundError);
  });

  it('`presentation_without_content` rechaza con `PresentationWithoutContentError`', async () => {
    const { deps } = montar({ resultado: 'presentation_without_content' });
    const finishPacking = createFinishPacking(deps);

    await expect(finishPacking(ACTOR, ENTRADA)).rejects.toBeInstanceOf(PresentationWithoutContentError);
  });

  it('R7, R18: `incompatible_units` rechaza con `IncompatibleUnitsError`', async () => {
    const { deps } = montar({ resultado: 'incompatible_units' });
    const finishPacking = createFinishPacking(deps);

    await expect(finishPacking(ACTOR, ENTRADA)).rejects.toBeInstanceOf(IncompatibleUnitsError);
  });

  it('R18: `order_without_unit` rechaza con `OrderWithoutUnitError`', async () => {
    const { deps } = montar({ resultado: 'order_without_unit' });
    const finishPacking = createFinishPacking(deps);

    await expect(finishPacking(ACTOR, ENTRADA)).rejects.toBeInstanceOf(OrderWithoutUnitError);
  });

  it('QC-195 R25: `insufficient_material` (los envases no alcanzan) rechaza con `MaterialShortageError`, code insufficient_material', async () => {
    const { deps } = montar({ resultado: 'insufficient_material' });
    const finishPacking = createFinishPacking(deps);

    const fallo = finishPacking(ACTOR, ENTRADA);
    await expect(fallo).rejects.toBeInstanceOf(MaterialShortageError);
    await expect(fallo).rejects.toMatchObject({ code: 'insufficient_material' });
  });
});

describe('finishPacking — R24: no existe, esta de baja o es de otra empresa', () => {
  it('sin pedido vivo rechaza con `order_not_found` sin leer el numero ni escribir', async () => {
    const { deps, listAliveSummariesByIds, finishPackingAliveById } = montar({ target: null });
    const finishPacking = createFinishPacking(deps);

    await expect(finishPacking(ACTOR, ENTRADA)).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(listAliveSummariesByIds).not.toHaveBeenCalled();
    expect(finishPackingAliveById).not.toHaveBeenCalled();
  });

  it('`not_found` del puerto de escritura tambien rechaza con `order_not_found`', async () => {
    const { deps } = montar({ resultado: 'not_found' });
    const finishPacking = createFinishPacking(deps);

    await expect(finishPacking(ACTOR, ENTRADA)).rejects.toBeInstanceOf(OrderNotFoundError);
  });
});

describe('finishPacking — R25: ningun puerto de inventario', () => {
  // [2026-10-06] Ganan `log` y `transaction` y nada mas: la lista sigue siendo exacta.
  // [2026-10-13] QC-214 suma `packingSteps` y `evidence` para exigir las fotos (R36): ninguno es
  // de inventario.
  it('R25, R42: las dependencias declaradas son solo `orders`, `log`, `transaction` y las dos de la evidencia', () => {
    const { deps } = montar();
    expect(Object.keys(deps).sort()).toEqual(['evidence', 'log', 'now', 'orders', 'packingSteps', 'transaction']);
  });
});

describe('finishPacking — entrada', () => {
  it('un `orderId` que no es uuid rechaza con `invalid_input` sin tocar ningun puerto', async () => {
    const { deps, findAliveById } = montar();
    const finishPacking = createFinishPacking(deps);

    await expect(finishPacking(ACTOR, { ...ENTRADA, orderId: 'no-es-uuid' })).rejects.toThrow(ValidationError);
    expect(findAliveById).not.toHaveBeenCalled();
  });
});

describe('QC-211 — finishPacking no comprueba el recorrido de los pasos de envasado', () => {
  it('R24: termina un `EN_EMPAQUE` del actor con `{ orderId, lines }` solo, sin ninguna prueba de recorrido', async () => {
    const { deps, finishPackingAliveById } = montar();
    const finishPacking = createFinishPacking(deps);

    await expect(finishPacking(ACTOR, ENTRADA)).resolves.toEqual({ numberText: expect.any(String) });
    expect(finishPackingAliveById).toHaveBeenCalledWith(PEDIDO, EMPRESA, ANA, expect.any(Date), LINEAS);
  });

  it.each([
    ['packingStepsDone', 3],
    ['packingSteps', []],
    ['walkthrough', { completed: true }],
  ])('R13, R24: la entrada sigue siendo exactamente `{ orderId, lines }`: `%s` de mas rechaza sin tocar ningun puerto', async (clave, valor) => {
    const { deps, findAliveById, finishPackingAliveById } = montar();
    const finishPacking = createFinishPacking(deps);

    await expect(finishPacking(ACTOR, { ...ENTRADA, [clave]: valor })).rejects.toThrow(ValidationError);
    expect(findAliveById).not.toHaveBeenCalled();
    expect(finishPackingAliveById).not.toHaveBeenCalled();
  });

  // [2026-10-13] QC-214 R36 le da el lector de pasos de envasado, solo para saber que pasos piden
  // fotos: el recorrido sigue sin comprobarse.
  it('R24: el unico lector de pasos es el de envasado, y sin pasos que pidan evidencia no se consulta ninguna foto', async () => {
    const { deps, listEvidenceByOrder } = montar();
    expect(Object.keys(deps).filter((key) => /step/i.test(key))).toEqual(['packingSteps']);
    await createFinishPacking(deps)(ACTOR, ENTRADA);
    expect(listEvidenceByOrder).not.toHaveBeenCalled();
  });
});

// [2026-10-06] Terminar empaque anota `pack_finish` dentro de la transaccion de la ejecucion.
describe('finishPacking — R42: autorizacion antes de abrir la transaccion', () => {
  it('R42: sin `empaque.modificar` rechaza sin llamar a ningun doble y sin abrir la transaccion', async () => {
    const m = montar();
    const finishPacking = createFinishPacking(m.deps);

    await expect(finishPacking({ id: ANA, companyId: EMPRESA, permissions: [] }, ENTRADA)).rejects.toThrow(
      UnauthorizedError,
    );
    await expect(finishPacking(null, ENTRADA)).rejects.toBeInstanceOf(AsignacionesError);

    expect(m.run).not.toHaveBeenCalled();
    expect(m.findAliveById).not.toHaveBeenCalled();
    expect(m.listAliveSummariesByIds).not.toHaveBeenCalled();
    expect(m.finishPackingAliveById).not.toHaveBeenCalled();
    expect(m.globalFinishPackingAliveById).not.toHaveBeenCalled();
    expect(m.append).not.toHaveBeenCalled();
    expect(m.depsAppend).not.toHaveBeenCalled();
  });

  it.each([
    [['asignaciones.consultar']],
    [['asignaciones.ejecutar']],
    [['asignaciones.consultar', 'asignaciones.ejecutar']],
  ] as const)('R42: %j sin `empaque.modificar` no basta', async (permisos) => {
    const m = montar();
    const finishPacking = createFinishPacking(m.deps);

    await expect(
      finishPacking({ id: ANA, companyId: EMPRESA, permissions: [...permisos] }, ENTRADA),
    ).rejects.toThrow(UnauthorizedError);
    expect(m.run).not.toHaveBeenCalled();
    expect(m.findAliveById).not.toHaveBeenCalled();
    expect(m.finishPackingAliveById).not.toHaveBeenCalled();
    expect(m.append).not.toHaveBeenCalled();
  });
});

describe('finishPacking — R42: empresa del actor y sin comprobacion de responsable', () => {
  it('R42: otra empresa responde lo mismo que un pedido inexistente, sin abrir la transaccion ni dejar fila', async () => {
    const otra = montar({ target: null });
    const inexistente = montar({ target: null });
    const actorDeOtra: Actor = { id: ANA, companyId: OTRA_EMPRESA, permissions: ['empaque.modificar'] };

    const errorOtra: unknown = await createFinishPacking(otra.deps)(actorDeOtra, ENTRADA).catch(
      (e: unknown) => e,
    );
    const errorInexistente: unknown = await createFinishPacking(inexistente.deps)(ACTOR, { ...ENTRADA, orderId: uuid('8') }).catch(
      (e: unknown) => e,
    );

    expect(errorOtra).toBeInstanceOf(OrderNotFoundError);
    expect(errorInexistente).toBeInstanceOf(OrderNotFoundError);
    expect((errorOtra as OrderNotFoundError).code).toBe((errorInexistente as OrderNotFoundError).code);
    expect((errorOtra as Error).message).toBe((errorInexistente as Error).message);
    expect(otra.findAliveById).toHaveBeenCalledWith(PEDIDO, OTRA_EMPRESA);
    expect(otra.run).not.toHaveBeenCalled();
    expect(otra.filas).toEqual([]);
  });

  it('R42: `not_found` de la escritura (otra empresa bajo el candado) tambien es `order_not_found` sin fila', async () => {
    const m = montar({ resultado: 'not_found' });
    const actorDeOtra: Actor = { id: ANA, companyId: OTRA_EMPRESA, permissions: ['empaque.modificar'] };

    await expect(createFinishPacking(m.deps)(actorDeOtra, ENTRADA)).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
    expect(m.finishPackingAliveById).toHaveBeenCalledWith(PEDIDO, OTRA_EMPRESA, ANA, AHORA, LINEAS);
    expect(m.filas).toEqual([]);
  });

  it('R42: la empresa no se acepta en la entrada', async () => {
    const m = montar();

    await expect(createFinishPacking(m.deps)(ACTOR, { ...ENTRADA, companyId: OTRA_EMPRESA })).rejects.toThrow(
      ValidationError,
    );
    expect(m.run).not.toHaveBeenCalled();
  });

  it('R42: un actor con `empaque.modificar` NO asignado al pedido termina y anota', async () => {
    const m = montar();
    const listOrderIdsByUserInCompany = vi.fn(async () => [] as string[]);
    const conAsignaciones = {
      ...m.deps,
      assignments: { listOrderIdsByUserInCompany },
    } as unknown as FinishPackingDeps;

    await expect(createFinishPacking(conAsignaciones)(ACTOR, ENTRADA)).resolves.toEqual({
      numberText: expect.any(String),
    });

    expect(listOrderIdsByUserInCompany).not.toHaveBeenCalled();
    expect(m.finishPackingAliveById).toHaveBeenCalledTimes(1);
    expect(m.filas).toHaveLength(1);
    expect(m.filas[0]).toMatchObject({ action: 'pack_finish', userId: ANA });
  });
});

describe('finishPacking — R41, R5bis, R8, R24: el exito es el objeto y deja una fila `pack_finish`', () => {
  it('R41, R5bis, R8: `{ kind: ok }` deja UNA fila sin posicion ni motivo, con instante, pedido, persona y empresa', async () => {
    const m = montar({ resultado: { kind: 'ok', finishedGoods: [{ lote: 1 }] } });

    await expect(createFinishPacking(m.deps)(ACTOR, ENTRADA)).resolves.toEqual({
      numberText: expect.any(String),
    });

    expect(m.run).toHaveBeenCalledTimes(1);
    expect(m.estado.confirmada).toBe(true);
    expect(m.filas).toEqual([
      { companyId: EMPRESA, orderId: PEDIDO, userId: ANA, occurredAt: AHORA, action: 'pack_finish', stepPosition: null },
    ]);
    expect(m.filas[0]).not.toHaveProperty('reason');
  });

  it('R42: escribe con el `packing` y el `log` de la transaccion, nunca con los globales', async () => {
    const m = montar();

    await createFinishPacking(m.deps)(ACTOR, ENTRADA);

    expect(m.finishPackingAliveById).toHaveBeenCalledWith(PEDIDO, EMPRESA, ANA, AHORA, LINEAS);
    expect(m.globalFinishPackingAliveById).not.toHaveBeenCalled();
    expect(m.depsAppend).not.toHaveBeenCalled();
    expect(m.estado.appendDentroDeRun).toBe(true);
  });

  it('R41: el numero se lee antes y fuera de `run`', async () => {
    const m = montar();
    const dentroAlLeer: boolean[] = [];
    m.findAliveById.mockImplementation(async () => {
      dentroAlLeer.push(m.estado.dentroDeRun);
      return { id: PEDIDO, status: 'EN_EMPAQUE' };
    });
    m.listAliveSummariesByIds.mockImplementation(async () => {
      dentroAlLeer.push(m.estado.dentroDeRun);
      return { items: [{ id: PEDIDO, number: { year: 2026, sequence: 7 } }], total: 1, page: 1, pageSize: 1, totalPages: 1 };
    });

    await createFinishPacking(m.deps)(ACTOR, ENTRADA);

    expect(dentroAlLeer).toEqual([false, false]);
    expect(m.listAliveSummariesByIds.mock.invocationCallOrder[0]!).toBeLessThan(m.run.mock.invocationCallOrder[0]!);
  });
});

describe('finishPacking — R24: cualquier otro desenlace aborta sin fila y con el error de siempre', () => {
  it.each([
    ['not_packer', OrderPackingTakenError],
    ['not_packable', OrderNotPackableError],
    ['not_found', OrderNotFoundError],
    ['recipe_not_found', RecipeNotFoundError],
    ['presentation_without_content', PresentationWithoutContentError],
    ['incompatible_units', IncompatibleUnitsError],
    ['order_without_unit', OrderWithoutUnitError],
    ['insufficient_material', MaterialShortageError],
  ] as const)('R24: `%s` deshace la transaccion, no anota y rechaza con su error', async (resultado, Esperado) => {
    const m = montar({ resultado });

    await expect(createFinishPacking(m.deps)(ACTOR, ENTRADA)).rejects.toBeInstanceOf(Esperado);

    expect(m.estado.confirmada).toBe(false);
    expect(m.append).not.toHaveBeenCalled();
    expect(m.filas).toEqual([]);
  });

  it('R24: si `append` lanza, el error sale desde dentro de `run` y no queda ninguna fila', async () => {
    const fallo = new Error('append fallo');
    const m = montar({ appendFalla: fallo });

    await expect(createFinishPacking(m.deps)(ACTOR, ENTRADA)).rejects.toBe(fallo);

    expect(m.estado.appendDentroDeRun).toBe(true);
    expect(m.estado.confirmada).toBe(false);
    await expect(m.run.mock.results[0]!.value).rejects.toBe(fallo);
    expect(m.filas).toEqual([]);
  });
});

describe('finishPacking — evidencia (R36, R37)', () => {
  const RECETA = uuid('a');
  const EN_EMPAQUE_DE_ANA = [
    { id: PEDIDO, number: { year: 2026, sequence: 7 }, recipeId: RECETA, status: 'EN_EMPAQUE', packedBy: ANA },
  ];
  const CON_EVIDENCIA = [{ requiresEvidence: true }, { blocks: [] }, { requiresEvidence: true }];

  it('R36: un paso de envasado que pide evidencia sin fotos: evidence_required sin abrir la transaccion', async () => {
    const m = montar({ summaryItems: EN_EMPAQUE_DE_ANA, pasos: CON_EVIDENCIA, fotos: [{ stepPosition: 1 }] });
    const error = await createFinishPacking(m.deps)(ACTOR, ENTRADA).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AsignacionesError);
    expect((error as AsignacionesError).code).toBe('evidence_required');
    expect(m.run).not.toHaveBeenCalled();
    expect(m.finishPackingAliveById).not.toHaveBeenCalled();
    expect(m.findPackingStepsById).toHaveBeenCalledWith(RECETA, EMPRESA);
    expect(m.listEvidenceByOrder).toHaveBeenCalledWith(EMPRESA, PEDIDO, 'packing');
  });

  it('R36: con al menos una foto en cada paso que la pide, termina', async () => {
    const m = montar({
      summaryItems: EN_EMPAQUE_DE_ANA,
      pasos: CON_EVIDENCIA,
      fotos: [{ stepPosition: 1 }, { stepPosition: 3 }],
    });
    await expect(createFinishPacking(m.deps)(ACTOR, ENTRADA)).resolves.toEqual({
      numberText: expect.any(String),
    });
    expect(m.finishPackingAliveById).toHaveBeenCalledTimes(1);
  });

  it('R37: un paso de envasado que se encendio despues de comenzar tambien se exige', async () => {
    const m = montar({ summaryItems: EN_EMPAQUE_DE_ANA, pasos: [{}, { requiresEvidence: true }], fotos: [] });
    await expect(createFinishPacking(m.deps)(ACTOR, ENTRADA)).rejects.toMatchObject({
      code: 'evidence_required',
    });
    expect(m.run).not.toHaveBeenCalled();
  });

  it('R36: sin pasos que pidan evidencia (o sin pasos de envasado) termina como hoy, sin consultar fotos', async () => {
    for (const pasos of [[{}, {}], null]) {
      const m = montar({ summaryItems: EN_EMPAQUE_DE_ANA, pasos });
      await createFinishPacking(m.deps)(ACTOR, ENTRADA);
      expect(m.finishPackingAliveById).toHaveBeenCalledTimes(1);
      expect(m.listEvidenceByOrder).not.toHaveBeenCalled();
    }
  });

  it('R36: si empaca otro, no se miran las fotos: la transaccion da su error propio (order_packing_taken)', async () => {
    const m = montar({
      summaryItems: [{ ...EN_EMPAQUE_DE_ANA[0], packedBy: uuid('2') }],
      pasos: CON_EVIDENCIA,
      resultado: 'not_packer',
    });
    await expect(createFinishPacking(m.deps)(ACTOR, ENTRADA)).rejects.toMatchObject({
      code: 'order_packing_taken',
    });
    expect(m.findPackingStepsById).not.toHaveBeenCalled();
    expect(m.listEvidenceByOrder).not.toHaveBeenCalled();
  });
});

describe('QC-281 — finishPacking con el conteo real de envases', () => {
  it('R14: sin `empaque.modificar` rechaza antes de validar la entrada y sin leer nada', async () => {
    const m = montar();
    const sinPermiso: Actor = { id: ANA, companyId: EMPRESA, permissions: [] };

    await expect(createFinishPacking(m.deps)(sinPermiso, { orderId: PEDIDO, lines: 'roto' })).rejects.toThrow(
      UnauthorizedError,
    );
    expect(m.findAliveById).not.toHaveBeenCalled();
    expect(m.listAliveSummariesByIds).not.toHaveBeenCalled();
    expect(m.run).not.toHaveBeenCalled();
  });

  it('R14: si el pedido lo empaca otro, `not_packer` rechaza con `OrderPackingTakenError` sin anotar', async () => {
    const m = montar({ resultado: 'not_packer' });

    await expect(createFinishPacking(m.deps)(ACTOR, ENTRADA)).rejects.toBeInstanceOf(OrderPackingTakenError);
    expect(m.finishPackingAliveById).toHaveBeenCalledWith(PEDIDO, EMPRESA, ANA, AHORA, LINEAS);
    expect(m.filas).toEqual([]);
  });

  it('R13: pasa el conteo validado a `pedidos` y el texto de «Otro» recortado', async () => {
    const m = montar();
    const lines = [{ lineId: uuid('4'), packedPackages: 2, reason: 'otro', reasonOther: '  Se cayo  ' }];

    await createFinishPacking(m.deps)(ACTOR, { orderId: PEDIDO, lines });

    expect(m.finishPackingAliveById).toHaveBeenCalledWith(PEDIDO, EMPRESA, ANA, AHORA, [
      { lineId: uuid('4'), packedPackages: 2, reason: 'otro', reasonOther: 'Se cayo' },
    ]);
  });

  const linea = LINEAS[0]!;
  it.each([
    ['sin `lines`', { orderId: PEDIDO }],
    ['`lines` undefined (JSON roto en el borde)', { orderId: PEDIDO, lines: undefined }],
    ['`lines` vacio', { orderId: PEDIDO, lines: [] }],
    ['`lines` que no es lista', { orderId: PEDIDO, lines: 'x' }],
    ['`lineId` que no es uuid', { orderId: PEDIDO, lines: [{ ...linea, lineId: 'x' }] }],
    ['envases negativos', { orderId: PEDIDO, lines: [{ ...linea, packedPackages: -1 }] }],
    ['envases decimales', { orderId: PEDIDO, lines: [{ ...linea, packedPackages: 1.5 }] }],
    ['envases como texto', { orderId: PEDIDO, lines: [{ ...linea, packedPackages: '3' }] }],
    ['motivo fuera del catalogo', { orderId: PEDIDO, lines: [{ ...linea, reason: 'robo' }] }],
    ['«Otro» en blanco', { orderId: PEDIDO, lines: [{ ...linea, reason: 'otro', reasonOther: '   ' }] }],
    ['«Otro» de 201 caracteres', { orderId: PEDIDO, lines: [{ ...linea, reason: 'otro', reasonOther: 'a'.repeat(201) }] }],
    ['un campo de mas en la linea', { orderId: PEDIDO, lines: [{ ...linea, packages: 3 }] }],
    ['una linea sin `reasonOther`', { orderId: PEDIDO, lines: [{ lineId: linea.lineId, packedPackages: 3, reason: null }] }],
  ])('R13: %s rechaza con `invalid_input` sin tocar ningun puerto', async (_caso, entrada) => {
    const m = montar();

    await expect(createFinishPacking(m.deps)(ACTOR, entrada)).rejects.toThrow(ValidationError);
    expect(m.findAliveById).not.toHaveBeenCalled();
    expect(m.run).not.toHaveBeenCalled();
  });

  it('R13: «Otro» de 200 caracteres tras recortar se acepta', async () => {
    const m = montar();
    const texto = 'a'.repeat(200);

    await createFinishPacking(m.deps)(ACTOR, {
      orderId: PEDIDO,
      lines: [{ ...linea, reason: 'otro', reasonOther: ` ${texto} ` }],
    });

    expect(m.finishPackingAliveById).toHaveBeenCalledWith(PEDIDO, EMPRESA, ANA, AHORA, [
      { ...linea, reason: 'otro', reasonOther: texto },
    ]);
  });

  it.each([
    ['invalid_packing_count', ValidationError, 'invalid_input'],
    ['packaging_stock_insufficient', PackagingStockInsufficientError, 'packaging_stock_insufficient'],
  ] as const)('R13: `%s` de `pedidos` deshace la transaccion, no anota y rechaza con su codigo', async (resultado, Esperado, code) => {
    const m = montar({ resultado });

    const error = await createFinishPacking(m.deps)(ACTOR, ENTRADA).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Esperado);
    expect((error as AsignacionesError).code).toBe(code);
    expect(m.estado.confirmada).toBe(false);
    expect(m.append).not.toHaveBeenCalled();
    expect(m.filas).toEqual([]);
  });
});

describe('finishPacking con excedente: mismo permiso y mismo empacador que hoy', () => {
  // 12 envases de una linea planificada en 5: el excedente no cambia quien puede terminar.
  const CON_EXCEDENTE = { orderId: PEDIDO, lines: [{ lineId: uuid('4'), packedPackages: 12, reason: 'conteo_fisico', reasonOther: null }] };

  it('R27: el actor con `empaque.modificar` que empaca el pedido termina y el conteo llega a `pedidos` tal cual', async () => {
    const m = montar();

    await expect(createFinishPacking(m.deps)(ACTOR, CON_EXCEDENTE)).resolves.toMatchObject({ numberText: '2026-0000007' });

    expect(m.finishPackingAliveById).toHaveBeenCalledWith(PEDIDO, EMPRESA, ANA, AHORA, CON_EXCEDENTE.lines);
    expect(m.estado.confirmada).toBe(true);
  });

  it('R27: sin `empaque.modificar` rechaza antes de leer nada ni abrir la transaccion', async () => {
    const m = montar();
    const sinPermiso: Actor = { id: ANA, companyId: EMPRESA, permissions: [] };

    await expect(createFinishPacking(m.deps)(sinPermiso, CON_EXCEDENTE)).rejects.toThrow(UnauthorizedError);
    expect(m.findAliveById).not.toHaveBeenCalled();
    expect(m.run).not.toHaveBeenCalled();
  });

  it('R27: si el pedido lo empaca otro rechaza con `OrderPackingTakenError` sin anotar', async () => {
    const m = montar({ resultado: 'not_packer' });

    await expect(createFinishPacking(m.deps)(ACTOR, CON_EXCEDENTE)).rejects.toBeInstanceOf(OrderPackingTakenError);
    expect(m.filas).toEqual([]);
  });

  it('R27: si el pedido ya no esta EN_EMPAQUE rechaza con `OrderNotPackableError` sin anotar', async () => {
    const m = montar({ resultado: 'not_packable' });

    await expect(createFinishPacking(m.deps)(ACTOR, CON_EXCEDENTE)).rejects.toBeInstanceOf(OrderNotPackableError);
    expect(m.filas).toEqual([]);
  });
});
