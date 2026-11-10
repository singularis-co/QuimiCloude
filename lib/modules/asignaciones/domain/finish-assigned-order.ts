// lib/modules/asignaciones/domain/finish-assigned-order.ts
import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import {
  InvalidTransitionError,
  MaterialShortageError,
  OrderNotFoundError,
  RecipeWithoutLinesError,
  ValidationError,
} from './errors';
import { assertEvidenceComplete } from './evidence-photos';
import { ExecutionAbortedError, isExecutionSuccess } from './execution-entry';
import { assertOrderAcceptsWrites } from './order-state';
import { findLine, lineAsTarget, orderLineInputSchema } from './order-line-target';

import type { ExecutionLogRepository } from '../ports/execution-log-repository';
import type { ExecutionTransaction } from '../ports/execution-transaction';
import type {
  NewAssignment,
  OrderAssignmentRepository,
} from '../ports/order-assignment-repository';
import type { StepEvidenceRepository } from '../ports/step-evidence-repository';
import type {
  PeopleDirectory,
  PermissionCode,
  WorkGroupDirectory,
} from '@/lib/modules/identity';

import { formatOrderNumber, type AssignedOrderSummary, type OrderCatalog } from '@/lib/modules/pedidos';
import type { RecipeCatalog } from '@/lib/modules/recetas';

const finishAssignedOrderSchema = orderLineInputSchema.extend({
  stepPosition: z.number().int().min(1).nullable(),
});

export type FinishAssignedOrderDeps = {
  readonly assignments: OrderAssignmentRepository;
  readonly orders: OrderCatalog;
  readonly people: PeopleDirectory;
  readonly groups: WorkGroupDirectory;
  readonly log: ExecutionLogRepository;
  readonly transaction: ExecutionTransaction;
  readonly recipes: RecipeCatalog;
  readonly evidence: StepEvidenceRepository;
  readonly now?: () => Date;
};

/**
 * Finalizar ya no da de alta ningun lote de producto terminado -eso se
 * traslada a Terminar el empaque-, asi que ya no hay envases ni producto que devolver aqui.
 */
export type FinishAssignedOrderResult = {
  readonly numberText: string;
};

/**
 * Solo una linea `EN_CURSO` puede finalizarse. `ENTREGADO`, `CANCELADO`, `POR_EMPACAR` y
 * `EN_EMPAQUE` los rechaza `assertOrderAcceptsWrites`, con el error propio de cada uno; los que esa
 * funcion admite sin ser `EN_CURSO` (`PENDIENTE`, `BLOQUEADO`) son un Finalizar disparado antes de
 * comenzar, y se rechazan con `invalid_transition` porque no tienen error propio.
 */
function assertFinishable(line: Pick<AssignedOrderSummary, 'id' | 'status'>): void {
  if (line.status === 'EN_CURSO') return;
  assertOrderAcceptsWrites(lineAsTarget(line));
  throw new InvalidTransitionError();
}

/** Lo que distingue a un empacador es este permiso, leido en cada persona: nunca el nombre de su rol. */
const EMPAQUE_MODIFICAR: PermissionCode = 'empaque.modificar';

/**
 * Asegura filas de responsable para los empacadores vinculados al pedido y devuelve los
 * identificadores de las que CREO. Lee los equipos vinculados EN VIVO —al finalizar es cuando
 * se sabe quien tiene que empacar— y nunca borra ni reescribe filas; el nombre que se congela
 * es el vivo a ese instante. Corre ANTES de la transicion, con el pedido aun `EN_CURSO`.
 */
async function ensurePackerAssignments(
  deps: FinishAssignedOrderDeps,
  companyId: string,
  orderId: string,
  now: Date,
): Promise<readonly string[]> {
  const rows = await deps.assignments.listByOrderInCompany(companyId, orderId);

  const assignedIds = new Set(rows.map((row) => row.userId));
  const groupIds: string[] = [];
  const seenGroups = new Set<string>();
  for (const row of rows) {
    if (row.workGroupId !== null && !seenGroups.has(row.workGroupId)) {
      seenGroups.add(row.workGroupId);
      groupIds.push(row.workGroupId);
    }
  }

  const snapshots = await Promise.all(
    groupIds.map((workGroupId) => deps.groups.findSnapshotAliveInCompany(companyId, workGroupId, now)),
  );

  const candidateIds = new Set<string>(assignedIds);
  const originByUser = new Map<string, { workGroupId: string; workGroupName: string }>();
  for (const snapshot of snapshots) {
    // Grupo dado de baja o ajeno: se salta sin distinguir los casos.
    if (snapshot === null) continue;
    for (const memberId of snapshot.activeMemberIds) {
      candidateIds.add(memberId);
      if (!originByUser.has(memberId)) {
        originByUser.set(memberId, { workGroupId: snapshot.id, workGroupName: snapshot.name });
      }
    }
  }
  if (candidateIds.size === 0) return [];

  const refs = await deps.people.findAliveRefsInCompany(companyId, [...candidateIds], now);

  const toInsert: NewAssignment[] = [];
  for (const ref of refs) {
    if (assignedIds.has(ref.id)) continue;
    if (!ref.isActive) continue;
    if (!ref.permissions.includes(EMPAQUE_MODIFICAR)) continue;
    const origin = originByUser.get(ref.id);
    toInsert.push({
      orderId,
      userId: ref.id,
      companyId,
      workGroupId: origin?.workGroupId ?? null,
      workGroupName: origin?.workGroupName ?? null,
    });
  }
  // Sin candidatos no se toca la base.
  if (toInsert.length === 0) return [];

  // Orden total por `userId` para que el lote sea determinista aunque el directorio no prometa orden.
  toInsert.sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
  await deps.assignments.insertMissing(toInsert, now);
  return toInsert.map((row) => row.userId);
}

/**
 * Deshace lo que `ensurePackerAssignments` creó, una fila por llamada (R6). Best-effort a
 * propósito: si la compensación falla, no oculta el error ORIGINAL de la transición, y la fila
 * huérfana es inocua (el empaque no exige asignación y el congelado impide reescribirla).
 */
async function compensatePackerAssignments(
  deps: FinishAssignedOrderDeps,
  companyId: string,
  orderId: string,
  createdIds: readonly string[],
): Promise<void> {
  for (const userId of createdIds) {
    try {
      await deps.assignments.deleteOne(companyId, orderId, userId);
    } catch {
      // Best-effort, ver arriba: un fallo aquí no sustituye al error de la transición.
    }
  }
}

/**
 * Deja la receta nombrada en `POR_EMPACAR`. No recibe ni admite ningun dato de lo marcado: la
 * entrada es la receta y la posicion del paso en que se finaliza, que se anota con la transicion en
 * la misma transaccion.
 *
 * Devuelve el numero visible del pedido para que la lista, al volver, pueda confirmar que la
 * receta queda por empacar.
 *
 * `transitionAliveById` consume el material por dentro: `'insufficient_material'` se traduce a
 * `MaterialShortageError` y `'recipe_without_lines'` a `RecipeWithoutLinesError`, las dos
 * propias de este modulo para que el adaptador driving las traduzca con su propio `instanceof`.
 *
 * Antes de transicionar asegura filas de responsable para los empacadores vinculados al pedido
 * (ver `ensurePackerAssignments`): si la transaccion falla despues -por la transicion o por la
 * anotacion-, compensa lo creado y propaga el error original.
 */
export function createFinishAssignedOrder(
  deps: FinishAssignedOrderDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<FinishAssignedOrderResult> {
  return async function finishAssignedOrder(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<FinishAssignedOrderResult> {
    requirePermission(actor, 'asignaciones.ejecutar');

    const parsed = finishAssignedOrderSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { orderId, lineId, stepPosition } = parsed.data;

    const ids = await deps.assignments.listOrderIdsByUserInCompany(actor.companyId, actor.id);
    if (!ids.includes(orderId)) throw new OrderNotFoundError();

    const summary = await findLine(deps.orders, actor.companyId, orderId, lineId);
    assertFinishable(summary);
    const numberText = formatOrderNumber(summary.number);

    // Fuera de la transaccion: quitar la ultima foto justo al finalizar lo provoca la misma
    // persona desde su pantalla, que ya bloquea el boton.
    const content = await deps.recipes.findExecutionContentById(summary.recipeId, actor.companyId);
    await assertEvidenceComplete(
      deps.evidence,
      actor.companyId,
      orderId,
      summary.lineId,
      'manufacturing',
      content?.steps ?? [],
    );

    const now = deps.now?.() ?? new Date();
    // El auto-asignado del empacador, ANTES de transicionar y UNA sola vez: el reintento
    // `stale` solo repite la transicion. Si esta falla despues, se compensa lo creado.
    const createdPackerIds = await ensurePackerAssignments(deps, actor.companyId, orderId, now);
    for (;;) {
      // `assertFinishable` solo deja pasar `EN_CURSO`.
      const from = 'EN_CURSO' as const;
      try {
        await deps.transaction.run(async ({ orders, log }) => {
          const outcome = await orders.transitionAliveById(
            orderId,
            summary.lineId,
            actor.companyId,
            from,
            'POR_EMPACAR',
            actor.id,
            now,
          );
          if (!isExecutionSuccess(outcome)) throw new ExecutionAbortedError(outcome);
          await log.append({
            action: 'finish',
            companyId: actor.companyId,
            orderId,
            orderLineId: summary.lineId,
            userId: actor.id,
            stepPosition,
            occurredAt: now,
          });
        });
        return { numberText };
      } catch (error) {
        await compensatePackerAssignments(deps, actor.companyId, orderId, createdPackerIds);
        if (!(error instanceof ExecutionAbortedError)) throw error;
        if (error.outcome === 'not_found') throw new OrderNotFoundError();
        if (error.outcome === 'insufficient_material') throw new MaterialShortageError();
        if (error.outcome === 'recipe_without_lines') throw new RecipeWithoutLinesError();
        if (error.outcome !== 'stale') throw error;
      }
      // 'stale': alguien lo movio entre la lectura y esta llamada. Se relee y se reintenta
      // contra el estado real.
      assertFinishable(await findLine(deps.orders, actor.companyId, orderId, lineId));
    }
  };
}
