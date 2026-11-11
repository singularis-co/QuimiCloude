import Link from 'next/link';
import { useId, type ReactNode } from 'react';

import { StatusBadge } from '@/components/shared/status-badge';
import { buttonVariants } from '@/components/ui/button';
import type { OtherRecipeView, RecipePosition } from '@/lib/modules/asignaciones';
import { assignedOrderRoute, conditioningOrderRoute, packingOrderRoute } from '@/lib/shared/routes';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from '@/lib/shared/ui/order-status';
import { cn } from '@/lib/utils';

import { RecipeOfOrderLabel, hasSeveralRecipes } from './recipe-of-order-label';

export const RECIPE_HEADER_EYEBROW_TESTID = 'recipe-header-eyebrow';
export const OTHER_RECIPES_TESTID = 'other-recipes';
export const OTHER_RECIPE_TESTID = 'other-recipe';
export const OTHER_RECIPE_GO_TESTID = 'other-recipe-go';

export const RECIPE_HEADER_TEXTS = {
  order: 'Pedido',
  otherRecipes: 'Otras recetas del pedido',
  otherRecipe: 'Otra receta de este pedido',
  goToRecipe: 'Ir a esta receta',
  recipeMissing: 'Receta dada de baja',
} as const;

/** Lo que la sesion puede abrir; la pantalla de destino vuelve a exigir su permiso. */
export type RecipeAccess = {
  readonly execute: boolean;
  readonly pack: boolean;
  readonly condition: boolean;
};

export const NO_RECIPE_ACCESS: RecipeAccess = { execute: false, pack: false, condition: false };

/**
 * A que pantalla lleva «Ir a esta receta», o `null` si no se ofrece: sin el permiso de esa pantalla,
 * o con la receta cancelada, terminada, bloqueada o entregada.
 */
export function otherRecipeHref(
  orderId: string,
  other: Pick<OtherRecipeView, 'lineId' | 'status'>,
  access: RecipeAccess,
): string | null {
  switch (other.status) {
    case 'PENDIENTE':
    case 'EN_CURSO':
      return access.execute ? assignedOrderRoute(orderId, other.lineId) : null;
    case 'POR_EMPACAR':
    case 'EN_EMPAQUE':
      return access.pack ? packingOrderRoute(orderId, other.lineId) : null;
    case 'POR_ACONDICIONAR':
    case 'EN_ACONDICIONAMIENTO':
      return access.condition ? conditioningOrderRoute(orderId, other.lineId) : null;
    default:
      return null;
  }
}

export type RecipeHeaderProps = {
  /** «Fabricación», «Empaque» o «Acondicionamiento». */
  readonly phase: string;
  readonly orderId: string;
  readonly numberText: string;
  readonly numberTestId?: string;
  readonly recipeName: string | null;
  /** Lo que se pinta en el `h1` si la receta está dada de baja. */
  readonly recipeMissingText: string;
  readonly titleTestId?: string;
  readonly recipe: RecipePosition;
  /** Cantidad y reparto, tal como cada pantalla los pinta hoy. */
  readonly details?: ReactNode;
  readonly status: ReactNode;
  readonly otherRecipes: readonly OtherRecipeView[];
  readonly access: RecipeAccess;
};

/** Cabecera de la pantalla de una receta: donde esta en su pedido y a que otras recetas se puede ir. */
export function RecipeHeader({
  phase,
  orderId,
  numberText,
  numberTestId,
  recipeName,
  recipeMissingText,
  titleTestId,
  recipe,
  details,
  status,
  otherRecipes,
  access,
}: RecipeHeaderProps) {
  const several = hasSeveralRecipes(recipe);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-muted-foreground" data-testid={RECIPE_HEADER_EYEBROW_TESTID}>
            {phase}
            <span aria-hidden="true">{' · '}</span>
            {RECIPE_HEADER_TEXTS.order}{' '}
            <span className="font-mono tabular-nums" data-testid={numberTestId}>
              {numberText}
            </span>
            {several ? (
              <>
                <span aria-hidden="true">{' · '}</span>
                <RecipeOfOrderLabel recipe={recipe} />
              </>
            ) : null}
          </span>
          <h1 className="m-0 text-[22px] leading-tight font-semibold" data-testid={titleTestId}>
            {recipeName ?? recipeMissingText}
          </h1>
          {details ? <div className="text-sm text-muted-foreground">{details}</div> : null}
        </div>
        <div className="flex-none">{status}</div>
      </div>
      {several && otherRecipes.length > 0 ? (
        <ul
          aria-label={RECIPE_HEADER_TEXTS.otherRecipes}
          className="m-0 flex list-none flex-col divide-y divide-border rounded-lg border border-border p-0"
          data-testid={OTHER_RECIPES_TESTID}
        >
          {otherRecipes.map((other) => (
            <OtherRecipeRow key={other.lineId} orderId={orderId} other={other} access={access} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function OtherRecipeRow({
  orderId,
  other,
  access,
}: {
  readonly orderId: string;
  readonly other: OtherRecipeView;
  readonly access: RecipeAccess;
}) {
  const nameId = useId();
  const href = otherRecipeHref(orderId, other, access);
  return (
    <li
      className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
      data-testid={OTHER_RECIPE_TESTID}
      data-status={other.status}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{RECIPE_HEADER_TEXTS.otherRecipe}</span>
        <span id={nameId} className="font-medium">
          {other.recipeName ?? RECIPE_HEADER_TEXTS.recipeMissing}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2.5">
        <StatusBadge tone={ORDER_STATUS_TONES[other.status]} label={ORDER_STATUS_LABELS[other.status]} />
        {href === null ? null : (
          <Link
            href={href}
            data-slot="button"
            aria-describedby={nameId}
            data-testid={OTHER_RECIPE_GO_TESTID}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm', touch: true }))}
          >
            {RECIPE_HEADER_TEXTS.goToRecipe}
          </Link>
        )}
      </span>
    </li>
  );
}
