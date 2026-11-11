// Avanzar desde un paso que pide evidencia sin ninguna foto se rechaza sin anotar; volver atras no.
import { describe, expect, it, vi } from 'vitest';

import { EvidenceRequiredError } from '@/lib/modules/asignaciones/domain/errors';
import { createRecordStepMove, type RecordStepMoveDeps } from '@/lib/modules/asignaciones/domain/record-step-move';

import type { ExecutionLogRepository } from '@/lib/modules/asignaciones/ports/execution-log-repository';
import type { OrderAssignmentRepository } from '@/lib/modules/asignaciones/ports/order-assignment-repository';
import type { OrderCatalog } from '@/lib/modules/pedidos';
import type { RecipeCatalog, RecipeStepView } from '@/lib/modules/recetas';

import {
  EMPRESA,
  OPERADOR,
  OTRA_EMPRESA,
  PASOS_FABRICACION,
  LINEA,
  PEDIDO,
  RECETA,
  filaFoto,
  repositorioEnMemoria,
  uuid,
} from './evidence-doubles';

function montar(options?: {
  readonly pasos?: readonly RecipeStepView[];
  readonly filas?: Parameters<typeof repositorioEnMemoria>[0];
}) {
  const append = vi.fn<ExecutionLogRepository['append']>(async () => 'ok' as const);
  const findExecutionContentById = vi.fn(async () => ({ steps: options?.pasos ?? PASOS_FABRICACION }));
  const { repo } = repositorioEnMemoria(options?.filas);
  const findAliveLineSummary = vi.fn(async () => ({ id: PEDIDO, lineId: LINEA, recipeId: RECETA, status: 'EN_CURSO' }));
  const deps: RecordStepMoveDeps = {
    assignments: { listOrderIdsByUserInCompany: vi.fn(async () => [PEDIDO]) } as unknown as OrderAssignmentRepository,
    orders: {
      findAliveLineSummary,
    } as unknown as OrderCatalog,
    log: { append } as unknown as ExecutionLogRepository,
    recipes: { findExecutionContentById } as unknown as RecipeCatalog,
    evidence: repo,
    now: () => new Date('2026-10-13T12:00:00.000Z'),
  };
  return { move: createRecordStepMove(deps), append, repo, findExecutionContentById, findAliveLineSummary };
}

describe('recordStepMove — evidencia (R34, R37)', () => {
  it('R34: avanzar al paso 3 dejando el paso 2 (pide evidencia) sin fotos: evidence_required sin anotar', async () => {
    const d = montar();
    const error = await d
      .move(OPERADOR, { orderId: PEDIDO, lineId: LINEA, direction: 'advance', stepPosition: 3 })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EvidenceRequiredError);
    expect((error as EvidenceRequiredError).code).toBe('evidence_required');
    expect(d.append).not.toHaveBeenCalled();
    expect(d.repo.listByLine).toHaveBeenCalledWith(EMPRESA, PEDIDO, LINEA, 'manufacturing');
    expect(d.findExecutionContentById).toHaveBeenCalledWith(RECETA, EMPRESA);
  });

  it('R34: con al menos una foto en el paso que deja, anota', async () => {
    const d = montar({ filas: [filaFoto({ id: uuid('1'), slot: 1, stepPosition: 2 })] });
    await d.move(OPERADOR, { orderId: PEDIDO, lineId: LINEA, direction: 'advance', stepPosition: 3 });
    expect(d.append).toHaveBeenCalledTimes(1);
  });

  it('R34: una foto de otro paso, de envasado o de otra empresa no cubre el paso que deja', async () => {
    for (const fila of [
      filaFoto({ id: uuid('1'), slot: 1, stepPosition: 3 }),
      filaFoto({ id: uuid('1'), slot: 1, stepPosition: 2, phase: 'packing' }),
      filaFoto({ id: uuid('1'), slot: 1, stepPosition: 2 }, OTRA_EMPRESA),
    ]) {
      const d = montar({ filas: [fila] });
      await expect(
        d.move(OPERADOR, { orderId: PEDIDO, lineId: LINEA, direction: 'advance', stepPosition: 3 }),
      ).rejects.toBeInstanceOf(EvidenceRequiredError);
      expect(d.append).not.toHaveBeenCalled();
    }
  });

  it('R34: dejar un paso que no pide evidencia anota sin consultar fotos', async () => {
    const d = montar();
    await d.move(OPERADOR, { orderId: PEDIDO, lineId: LINEA, direction: 'advance', stepPosition: 2 });
    expect(d.append).toHaveBeenCalledTimes(1);
    expect(d.repo.listByLine).not.toHaveBeenCalled();
  });

  it('R34: llegar al paso 1 o sin posicion (receta sin pasos) no deja ningun paso atras: anota sin leer la receta', async () => {
    for (const stepPosition of [1, null]) {
      const d = montar();
      await d.move(OPERADOR, { orderId: PEDIDO, lineId: LINEA, direction: 'advance', stepPosition });
      expect(d.append).toHaveBeenCalledTimes(1);
      expect(d.findExecutionContentById).not.toHaveBeenCalled();
    }
  });

  it('R21, R34: volver atras nunca se rechaza, aunque los pasos que pidan evidencia no tengan fotos', async () => {
    for (const stepPosition of [1, 2, 3]) {
      const d = montar();
      await d.move(OPERADOR, { orderId: PEDIDO, lineId: LINEA, direction: 'go_back', stepPosition });
      expect(d.append).toHaveBeenCalledTimes(1);
      expect(d.findExecutionContentById).not.toHaveBeenCalled();
      expect(d.repo.listByLine).not.toHaveBeenCalled();
    }
  });

  it('R37: rige la formula actual: un paso que se encendio despues de empezar tambien se exige', async () => {
    const antes = montar({ pasos: [{ blocks: [] }, { blocks: [] }] });
    await antes.move(OPERADOR, { orderId: PEDIDO, lineId: LINEA, direction: 'advance', stepPosition: 2 });
    expect(antes.append).toHaveBeenCalledTimes(1);

    const despues = montar({ pasos: [{ blocks: [], requiresEvidence: true }, { blocks: [] }] });
    await expect(
      despues.move(OPERADOR, { orderId: PEDIDO, lineId: LINEA, direction: 'advance', stepPosition: 2 }),
    ).rejects.toBeInstanceOf(EvidenceRequiredError);
    expect(despues.append).not.toHaveBeenCalled();
  });

  it('R39: la receta y las fotos se leen con la empresa del actor', async () => {
    const d = montar({ filas: [filaFoto({ id: uuid('1'), slot: 1, stepPosition: 2 })] });
    await d.move(OPERADOR, { orderId: PEDIDO, lineId: LINEA, direction: 'advance', stepPosition: 3 });
    expect(d.findAliveLineSummary).toHaveBeenCalledWith(EMPRESA, PEDIDO, LINEA);
  });
});
