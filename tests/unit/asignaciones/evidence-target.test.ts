// Quien puede tocar las fotos de un pedido y con que pasos. Los casos completos, a traves de los
// casos de uso que lo usan, llegan con sus tests; aqui va la tabla de acceso.
import { describe, expect, it, vi } from 'vitest';

import { resolveEvidenceTarget, type EvidenceTargetDeps } from '@/lib/modules/asignaciones/domain/evidence-target';
import { OrderBlockedError, OrderNotFoundError, UnauthorizedError } from '@/lib/modules/asignaciones/domain/errors';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';
import type { OrderStatus } from '@/lib/modules/pedidos';

function uuid(seed: string): string {
  return `${seed.repeat(8)}-${seed.repeat(4)}-4${seed.repeat(3)}-8${seed.repeat(3)}-${seed.repeat(12)}`;
}

const EMPRESA = uuid('3');
const OTRA_EMPRESA = uuid('4');
const ANA = uuid('1');
const BETO = uuid('2');
const PEDIDO = uuid('7');
const RECETA = uuid('9');

const OPERADOR: Actor = { id: ANA, companyId: EMPRESA, permissions: ['asignaciones.ejecutar'] };
const EMPACADOR: Actor = { id: ANA, companyId: EMPRESA, permissions: ['empaque.modificar'] };

const PASOS_FABRICACION = [{ blocks: [] }, { blocks: [], requiresEvidence: true }];
const PASOS_ENVASADO = [{ blocks: [], requiresEvidence: true }];

function montar(options: {
  readonly asignados?: readonly string[];
  readonly status?: OrderStatus | null;
  readonly packedBy?: string | null;
}) {
  const status = options.status === undefined ? 'EN_CURSO' : options.status;
  const listOrderIdsByUserInCompany = vi.fn(async () => options.asignados ?? [PEDIDO]);
  const findAliveById = vi.fn(async (_id: string, companyId: string) =>
    status === null || companyId !== EMPRESA ? null : { id: PEDIDO, status },
  );
  const listAliveSummariesByIds = vi.fn(
    async (companyId: string, _ids: readonly string[], statuses: readonly OrderStatus[]) => {
      const visible = status !== null && companyId === EMPRESA && statuses.includes(status);
      const items = visible
        ? [{ id: PEDIDO, recipeId: RECETA, status, packedBy: options.packedBy ?? null }]
        : [];
      return { items, total: items.length, page: 1, pageSize: 1, totalPages: 1 };
    },
  );
  const findExecutionContentById = vi.fn(async () => ({ steps: PASOS_FABRICACION }));
  const findPackingStepsById = vi.fn(async () => PASOS_ENVASADO);

  const deps = {
    assignments: { listOrderIdsByUserInCompany },
    orders: { findAliveById, listAliveSummariesByIds },
    recipes: { findExecutionContentById },
    packingSteps: { findPackingStepsById },
  } as unknown as EvidenceTargetDeps;

  const puertos = [
    listOrderIdsByUserInCompany,
    findAliveById,
    listAliveSummariesByIds,
    findExecutionContentById,
    findPackingStepsById,
  ];
  return { deps, puertos, findExecutionContentById, findPackingStepsById };
}

describe('resolveEvidenceTarget — fabricacion (R26, R38, R39)', () => {
  it('R26: responsable asignado con el pedido EN_CURSO: la receta y sus pasos actuales', async () => {
    const { deps, findExecutionContentById } = montar({});
    await expect(resolveEvidenceTarget(deps, OPERADOR, PEDIDO, 'manufacturing')).resolves.toEqual({
      recipeId: RECETA,
      steps: PASOS_FABRICACION,
    });
    expect(findExecutionContentById).toHaveBeenCalledWith(RECETA, EMPRESA);
  });

  it('R26: sin asignaciones.ejecutar se rechaza sin tocar ningun puerto', async () => {
    const { deps, puertos } = montar({});
    for (const actor of [EMPACADOR, null, undefined, { ...OPERADOR, permissions: [] }]) {
      await expect(resolveEvidenceTarget(deps, actor, PEDIDO, 'manufacturing')).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
    }
    for (const puerto of puertos) expect(puerto).not.toHaveBeenCalled();
  });

  it('R26: quien no es responsable asignado recibe order_not_found', async () => {
    const { deps } = montar({ asignados: [] });
    await expect(resolveEvidenceTarget(deps, OPERADOR, PEDIDO, 'manufacturing')).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
  });

  it('R38: un pedido que no esta EN_CURSO (pendiente, en empaque, entregado, cancelado, dado de baja) se rechaza', async () => {
    for (const status of ['PENDIENTE', 'POR_EMPACAR', 'EN_EMPAQUE', 'ENTREGADO', 'CANCELADO', null] as const) {
      const { deps, findExecutionContentById } = montar({ status });
      await expect(
        resolveEvidenceTarget(deps, OPERADOR, PEDIDO, 'manufacturing'),
        String(status),
      ).rejects.toBeInstanceOf(OrderNotFoundError);
      expect(findExecutionContentById).not.toHaveBeenCalled();
    }
  });

  it('un pedido BLOQUEADO da order_blocked, como el resto de la ejecucion', async () => {
    const { deps } = montar({ status: 'BLOQUEADO' });
    await expect(resolveEvidenceTarget(deps, OPERADOR, PEDIDO, 'manufacturing')).rejects.toBeInstanceOf(
      OrderBlockedError,
    );
  });

  it('R39: el pedido de otra empresa no existe para el actor', async () => {
    const { deps } = montar({});
    const ajeno: Actor = { ...OPERADOR, companyId: OTRA_EMPRESA };
    await expect(resolveEvidenceTarget(deps, ajeno, PEDIDO, 'manufacturing')).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
  });
});

describe('resolveEvidenceTarget — envasado (R27, R38, R39)', () => {
  it('R27: quien empaca un pedido EN_EMPAQUE recibe la receta y los pasos de envasado', async () => {
    const { deps, findPackingStepsById } = montar({ status: 'EN_EMPAQUE', packedBy: ANA });
    await expect(resolveEvidenceTarget(deps, EMPACADOR, PEDIDO, 'packing')).resolves.toEqual({
      recipeId: RECETA,
      steps: PASOS_ENVASADO,
    });
    expect(findPackingStepsById).toHaveBeenCalledWith(RECETA, EMPRESA);
  });

  it('R27: sin empaque.modificar se rechaza sin tocar ningun puerto', async () => {
    const { deps, puertos } = montar({ status: 'EN_EMPAQUE', packedBy: ANA });
    await expect(resolveEvidenceTarget(deps, OPERADOR, PEDIDO, 'packing')).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    for (const puerto of puertos) expect(puerto).not.toHaveBeenCalled();
  });

  it('R27: si empaca otra persona se rechaza', async () => {
    const { deps, findPackingStepsById } = montar({ status: 'EN_EMPAQUE', packedBy: BETO });
    await expect(resolveEvidenceTarget(deps, EMPACADOR, PEDIDO, 'packing')).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
    expect(findPackingStepsById).not.toHaveBeenCalled();
  });

  it('R38: un pedido POR_EMPACAR, entregado, cancelado o dado de baja se rechaza', async () => {
    for (const status of ['POR_EMPACAR', 'EN_CURSO', 'ENTREGADO', 'CANCELADO', null] as const) {
      const { deps } = montar({ status, packedBy: ANA });
      await expect(resolveEvidenceTarget(deps, EMPACADOR, PEDIDO, 'packing'), String(status)).rejects.toBeInstanceOf(
        OrderNotFoundError,
      );
    }
  });

  it('R39: el pedido de otra empresa no existe para el actor', async () => {
    const { deps } = montar({ status: 'EN_EMPAQUE', packedBy: ANA });
    const ajeno: Actor = { ...EMPACADOR, companyId: OTRA_EMPRESA };
    await expect(resolveEvidenceTarget(deps, ajeno, PEDIDO, 'packing')).rejects.toBeInstanceOf(OrderNotFoundError);
  });
});
