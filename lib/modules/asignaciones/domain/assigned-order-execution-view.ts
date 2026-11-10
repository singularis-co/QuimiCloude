// lib/modules/asignaciones/domain/assigned-order-execution-view.ts
import type { RecipeStepView } from '@/lib/modules/recetas';
import type { UnitRef } from '@/lib/modules/unidades';

import type { OrderDistributionLineView } from './order-distribution-view';
import type { OtherRecipeView, RecipePosition } from './recipe-of-order';
import type { StepEvidenceView } from './step-evidence';

/**
 * Proyeccion cerrada de la pantalla de ejecucion. Sin autoria, sin marcas de tiempo y sin
 * existencia de producto: lo que no esta en el tipo no se puede filtrar por descuido.
 */
export type AssignedOrderExecutionView = {
  readonly orderId: string;
  /** La receta que se ejecuta. */
  readonly lineId: string;
  /** Su lugar entre las recetas del pedido; con `count` 1 la pantalla no lo muestra. */
  readonly recipe: RecipePosition;
  /** Las demas recetas del pedido en orden de alta, canceladas incluidas; vacio con una sola. */
  readonly otherRecipes: readonly OtherRecipeView[];
  readonly numberText: string;
  readonly status: 'PENDIENTE' | 'EN_CURSO';
  /** `null` = receta dada de baja o no resuelta. */
  readonly recipeName: string | null;
  /** Cadena decimal, nunca `number`. */
  readonly orderQuantity: string;
  readonly steps: readonly RecipeStepView[];
  readonly lines: readonly ExecutionLineView[];
  /** Solo lectura; la cantidad es la de la receta, no se escala con el pedido. */
  readonly tools: readonly ExecutionToolView[];
  /** El reparto en orden de alta; vacio = «Sin presentacion». Solo lectura. */
  readonly presentationLines: readonly OrderDistributionLineView[];
  /** La unidad de `orderQuantity`; los dos `null` = pedido sin unidad, la cifra va sola. */
  readonly unitId: string | null;
  readonly unitLabel: string | null;
  /** Las fotos de fabricacion por paso, con URL de lectura firmada. Vacio antes de comenzar. */
  readonly evidence: readonly StepEvidenceView[];
};

/** La vista al abrir, con el paso por el que retoma; `null` si la receta no tiene pasos. */
export type StartedOrderExecution = AssignedOrderExecutionView & {
  readonly resumeStepPosition: number | null;
};

export type ExecutionLineView = {
  readonly productName: string | null;
  /** "10.00" */
  readonly percentage: string;
  /** En la unidad del insumo salvo `need: 'unconverted'`; `null` solo con `not_convertible`. */
  readonly quantity: string | null;
  /** `unconverted`: pedido o insumo sin unidad, la cifra va tal cual. `approximate`: cruzo de
   *  masa a volumen o al reves a densidad 1. */
  readonly need: 'unconverted' | 'exact' | 'approximate' | 'not_convertible';
  /** La del insumo; `null` = sin lotes o dado de baja. */
  readonly unit: UnitRef | null;
  /** Misma base efectiva que `unit`, sin ella misma; vacio si `unit` es `null`. */
  readonly alternativeUnits: readonly UnitRef[];
};

export type ExecutionToolView = {
  /** `null` = producto dado de baja. */
  readonly productName: string | null;
  readonly quantity: number;
};
