import type { RecipeId } from './recipe-catalog';
import type { ConditioningStepView } from './recipe-view';

/**
 * Contrato aparte de `RecipeCatalog` y de `RecipePackingStepsReader` para el acondicionamiento:
 * por su forma no puede devolver los pasos del operador ni los de envasado.
 */
export interface RecipeConditioningStepsReader {
  /** Incluida una receta dada de baja. Una version devuelve los de su original. `null` = no
   *  existe o es de otra empresa. */
  findConditioningStepsById(id: RecipeId, companyId: string): Promise<readonly ConditioningStepView[] | null>;
}
