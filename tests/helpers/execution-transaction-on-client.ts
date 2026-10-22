// La transaccion de ejecucion de `asignaciones` para tests de integracion, sobre un cliente dado.
//
// `run` NO abre nada: llama a `work` con los escritores atados al cliente que recibe. En los archivos
// que corren dentro de la transaccion del test, ese cliente es su `tx` y todo sigue dentro del
// `ROLLBACK`; `withExecutionTransaction` abriria su propia `$transaction`, que el proxy de
// `prisma-tx-holder.ts` ejecutaria sobre la `tx` sin deshacer nada al lanzar. Lo que estos archivos
// miden no es la atomicidad del registro, sino que los casos de uso sigan haciendo lo de siempre
// ahora que anotan.
import { createConditioningTeamRepository } from '@/lib/modules/asignaciones/adapters/driven/persistence/conditioning-team-prisma';
import { createExecutionLogRepository } from '@/lib/modules/asignaciones/adapters/driven/persistence/execution-log-prisma';
import type { ExecutionLogRepository } from '@/lib/modules/asignaciones/ports/execution-log-repository';
import type { ExecutionTransaction, ExecutionWriters } from '@/lib/modules/asignaciones/ports/execution-transaction';
import type { OrderCancellation, OrderCatalog } from '@/lib/modules/pedidos';

type ExecutionClient = Parameters<typeof createExecutionLogRepository>[0];

type OrderWrites = Pick<OrderCatalog, 'transitionAliveById' | 'startPackingAliveById' | 'finishPackingAliveById'> &
  Partial<Pick<OrderCatalog, 'startConditioningAliveById' | 'finishConditioningAliveById'>>;

export type ExecutionDeps = {
  readonly log: ExecutionLogRepository;
  readonly transaction: ExecutionTransaction;
};

function unused(what: string): () => Promise<never> {
  return async () => {
    throw new Error(`este archivo no ${what}`);
  };
}

/** `log` y `transaction` sobre `db`, con las escrituras de `pedidos` e `inventario` que el propio test ya cablea. */
export function executionOnClient(
  db: ExecutionClient,
  orders: OrderWrites,
  cancelAliveById: OrderCancellation['cancelAliveById'] = unused('cancela pedidos desde la ejecucion'),
  batches: ExecutionWriters['batches'] = { writeForOrder: unused('guarda datos de lote') },
): ExecutionDeps {
  const log = createExecutionLogRepository(db);
  return {
    log,
    transaction: {
      run: (work) =>
        work({
          orders: { transitionAliveById: orders.transitionAliveById, cancelAliveById },
          packing: {
            startPackingAliveById: orders.startPackingAliveById,
            finishPackingAliveById: orders.finishPackingAliveById,
          },
          log,
          conditioning: {
            startConditioningAliveById:
              orders.startConditioningAliveById ?? unused('comienza el acondicionamiento'),
            finishConditioningAliveById: orders.finishConditioningAliveById ?? unused('termina el acondicionamiento'),
          },
          team: createConditioningTeamRepository(db),
          batches,
        }),
    },
  };
}
