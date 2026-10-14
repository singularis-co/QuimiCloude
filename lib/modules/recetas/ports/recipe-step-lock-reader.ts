/** Lo que `recetas` necesita saber de los pedidos en curso, sin depender del modulo que los ejecuta. */
export interface RecipeStepLockReader {
  /** Pedidos en curso con fotos de evidencia cuya receta es alguna de `recipeIds`. */
  countOrdersWithEvidenceInProgress(recipeIds: readonly string[], companyId: string): Promise<number>;
}
