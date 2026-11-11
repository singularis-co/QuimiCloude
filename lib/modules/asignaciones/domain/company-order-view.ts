// lib/modules/asignaciones/domain/company-order-view.ts
import type { RecipePosition } from './recipe-of-order';
import type { OrderPriority, OrderStatus } from '@/lib/modules/pedidos';

import type { OrderResponsible } from './assignment-view';
import type { OrderDistributionLineView } from './order-distribution-view';

export type CompanyOrderView = {
  /** El pedido. */
  readonly id: string;
  /** La receta del pedido que pinta la fila. */
  readonly lineId: string;
  readonly numberText: string;
  /** `null` significa «no se pudo resolver»: la pantalla pinta el marcador de ausencia. */
  readonly recipeName: string | null;
  /** Su lugar entre las recetas del pedido; con `count` 1 la fila no lo muestra. */
  readonly recipe: RecipePosition;
  /** Cadena decimal, nunca `number` (`docs/architecture.md > Anti-patrones`). */
  readonly quantity: string;
  /** El reparto en orden de alta; vacio = «Sin presentacion». Solo lectura. */
  readonly presentationLines: readonly OrderDistributionLineView[];
  /** La unidad de `quantity`; los dos `null` = pedido sin unidad, la cifra va sola. */
  readonly unitId: string | null;
  readonly unitLabel: string | null;
  readonly priority: OrderPriority;
  readonly status: OrderStatus;
  /** Todos los responsables del pedido, incluido el propio actor si lo es. */
  readonly responsibles: readonly OrderResponsible[];
  /** Siempre viaja; la columna solo se pinta con el filtro exactamente ENTREGADO. */
  readonly finishedAt: Date | null;
};
