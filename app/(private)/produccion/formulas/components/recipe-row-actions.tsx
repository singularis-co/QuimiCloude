'use client';

import { PencilIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

import type { RowActionsSpec } from '@/components/shared/data-table';
import {
  RowActionsMenu,
  type RowActionMenuItem,
  type RowActionsMenuProps,
} from '@/components/shared/row-actions-menu';
import type { RecipeSummary } from '@/lib/modules/recetas';
import { recipeEditRoute } from '@/lib/shared/routes';

import { DeleteRecipeDialog } from './delete-recipe-dialog';

export const RECIPE_ROW_ACTIONS_TESTID = 'recipe-row-actions';
export const RECIPE_ACTION_EDIT_TESTID = 'recipe-edit-open';
export const RECIPE_ACTION_DELETE_TESTID = 'recipe-delete-open';

export const RECIPE_ROW_ACTION_LABELS = {
  edit: 'Editar',
  delete: 'Borrar',
} as const;

/** Nombre accesible del disparador del menu de la fila. */
export function recipeRowActionsLabel(name: string): string {
  return `Acciones de ${name}`;
}

/** Editar es un enlace: la única acción que abre algo en la pantalla es borrar. */
export type RecipeRowAction = 'delete';

// La especificación llega a `RowActionsMenu` por propagación: `data-recipe-id` sale en el
// disparador de la fila y en el de la tarjeta.
export type RecipeRowActionsSpec = RowActionsSpec & Pick<RowActionsMenuProps, 'triggerDataAttributes'>;

export type RecipeRowActionsSpecInput = {
  readonly recipe: RecipeSummary;
  readonly onAction: (action: RecipeRowAction, recipe: RecipeSummary) => void;
};

export function recipeRowActionsSpec({
  recipe,
  onAction: notify,
}: RecipeRowActionsSpecInput): RecipeRowActionsSpec {
  const items: RowActionMenuItem[] = [
    {
      key: 'edit',
      label: RECIPE_ROW_ACTION_LABELS.edit,
      icon: PencilIcon,
      href: recipeEditRoute(recipe.id),
      testId: RECIPE_ACTION_EDIT_TESTID,
    },
    {
      key: 'delete',
      label: RECIPE_ROW_ACTION_LABELS.delete,
      icon: Trash2Icon,
      onSelect: () => notify('delete', recipe),
      destructive: true,
      separatorBefore: true,
      testId: RECIPE_ACTION_DELETE_TESTID,
    },
  ];

  return {
    items,
    triggerLabel: recipeRowActionsLabel(recipe.name),
    triggerTestId: RECIPE_ROW_ACTIONS_TESTID,
    triggerDataAttributes: { 'data-recipe-id': recipe.id },
    title: recipe.name,
  };
}

export type RecipeRowActionsProps = {
  readonly recipe: RecipeSummary;
} & Pick<RowActionsMenuProps, 'presentation' | 'texts'>;

/** El menú de una receta suelta, con su propio diálogo de borrado. */
export function RecipeRowActions({ recipe, presentation, texts }: RecipeRowActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <RowActionsMenu
        {...recipeRowActionsSpec({ recipe, onAction: () => setDeleteOpen(true) })}
        presentation={presentation}
        texts={texts}
      />
      <DeleteRecipeDialog recipe={recipe} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
