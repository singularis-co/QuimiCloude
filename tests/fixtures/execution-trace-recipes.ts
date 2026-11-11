// Pedidos de una sola receta con la forma por receta del Dashboard y del Recorrido: los datos de
// siempre caben en la unica receta, como pasa con un pedido de una receta en produccion.
import type {
  ExecutionTraceDetail,
  ExecutionTracePresentation,
  ExecutionTraceRecipe,
  ExecutionTraceRow,
  TraceDuration,
  TraceDurations,
} from '@/lib/modules/asignaciones';
import type { OrderLineStatus, OrderStatus } from '@/lib/modules/pedidos';

const FINISHED: readonly OrderStatus[] = ['TERMINADO', 'ENTREGADO'];

/** Una receta viva cuenta en el total; terminada o entregada, tambien en lo terminado. */
export function progressOfOneRecipe(status: OrderStatus): ExecutionTraceDetail['progress'] {
  if (status === 'CANCELADO') return { finished: 0, total: 0 };
  return { finished: FINISHED.includes(status) ? 1 : 0, total: 1 };
}

export function lineStatusOf(status: OrderStatus): OrderLineStatus {
  if (status === 'PARCIAL') throw new Error('un pedido de una receta nunca esta PARCIAL');
  return status;
}

/** La misma regla del dominio: abierta gana a sin cerrar, y sin cerrar gana a cerrada. */
export function sumOfDurations(durations: TraceDurations): TraceDuration {
  const present = [durations.production, durations.packing, durations.conditioning].filter(
    (duration): duration is TraceDuration => duration !== null,
  );
  const ms = present.reduce((sum, duration) => sum + duration.ms, 0);
  if (present.some((duration) => duration.kind === 'open')) return { kind: 'open', ms };
  if (present.some((duration) => duration.kind === 'unclosed')) return { kind: 'unclosed', ms };
  return { kind: 'closed', ms };
}

export const ONE_RECIPE_DEFAULTS = {
  recipeName: 'Limpiador multiusos',
  quantity: '200',
  unitLabel: 'L',
} as const;

export type OneRecipeTraceInput = Omit<ExecutionTraceDetail, 'progress' | 'totalDuration' | 'recipes'> &
  Pick<ExecutionTraceRecipe, 'steps' | 'durations' | 'goBackCount'> &
  Partial<Pick<ExecutionTraceDetail, 'progress' | 'totalDuration'>> & {
    readonly recipe?: Partial<ExecutionTraceRecipe>;
  };

/** Recorrido de un pedido de una receta: los pasos, las duraciones y las vueltas atras van a su seccion. */
export function oneRecipeTrace(input: OneRecipeTraceInput): ExecutionTraceDetail {
  const { steps, durations, goBackCount, progress, totalDuration, recipe, ...order } = input;
  const total = totalDuration ?? sumOfDurations(durations);
  return {
    ...order,
    progress: progress ?? progressOfOneRecipe(order.status),
    totalDuration: total,
    recipes: [
      {
        lineId: `${order.orderId}-line-1`,
        recipeName: ONE_RECIPE_DEFAULTS.recipeName,
        status: lineStatusOf(order.status),
        quantity: ONE_RECIPE_DEFAULTS.quantity,
        unitLabel: ONE_RECIPE_DEFAULTS.unitLabel,
        presentations: [],
        steps,
        durations,
        totalDuration: total,
        goBackCount,
        ...recipe,
      },
    ],
  };
}

/** La seccion unica de un recorrido de una receta. */
export function onlyRecipe(trace: ExecutionTraceDetail): ExecutionTraceRecipe {
  const [recipe] = trace.recipes;
  if (recipe === undefined || trace.recipes.length !== 1) throw new Error('se esperaba una sola receta');
  return recipe;
}

/** Los campos por receta de una fila del Dashboard de un pedido de una receta. */
export function oneRecipeRowFields(
  presentations: readonly ExecutionTracePresentation[],
  status: OrderStatus = 'TERMINADO',
  recipeName: string | null = null,
): Pick<ExecutionTraceRow, 'moreRecipes' | 'progress' | 'recipes'> {
  return {
    moreRecipes: 0,
    progress: progressOfOneRecipe(status),
    recipes: [{ recipeName, presentations }],
  };
}

/** El mismo recorrido de una receta con otras anotaciones en su seccion. */
export function withSteps(
  trace: ExecutionTraceDetail,
  steps: ExecutionTraceRecipe['steps'],
): ExecutionTraceDetail {
  return { ...trace, recipes: [{ ...onlyRecipe(trace), steps }] };
}
