// lib/modules/asignaciones/domain/open-assigned-order.ts
import { type Actor } from './actor';
import { createGetAssignedOrderExecution } from './get-assigned-order-execution';
import { createStartAssignedOrder, type StartAssignedOrderDeps } from './start-assigned-order';

import type { StartedOrderExecution } from './assigned-order-execution-view';

export type OpenAssignedOrderDeps = StartAssignedOrderDeps;

/**
 * Abrir la pantalla de ejecucion. Entrar es libre: un `PENDIENTE` se lee sin transicionar ni
 * anotar nada y vuelve sin paso de entrada -lo comienza el boton «Comenzar» de la pantalla, con
 * `startAssignedOrder`-. Un `EN_CURSO` sigue por `startAssignedOrder`, que anota el retomar en la
 * ultima posicion. `BLOQUEADO` y los demas estados rechazan como en la lectura.
 */
export function createOpenAssignedOrder(
  deps: OpenAssignedOrderDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<StartedOrderExecution> {
  const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);
  const startAssignedOrder = createStartAssignedOrder(deps);

  return async function openAssignedOrder(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<StartedOrderExecution> {
    const view = await getAssignedOrderExecution(actor, input);
    if (view.status === 'PENDIENTE') return { ...view, resumeStepPosition: null };
    return startAssignedOrder(actor, input);
  };
}
