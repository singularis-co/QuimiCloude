'use client';

import { PencilIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useId, type ReactNode } from 'react';

import { StatusBadge } from '@/components/shared/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { RecipeVersionSummary } from '@/lib/modules/recetas';
import { newRecipeVersionRoute, recipeVersionRoute } from '@/lib/shared/routes';
import { cn } from '@/lib/utils';

import { DeleteRecipeDialog } from './delete-recipe-dialog';
import {
  RECIPE_VERSION_UNDER_REVIEW_LABEL,
  RECIPE_VERSION_UNDER_REVIEW_TONE,
} from './recipe-version-tones';

export type RecipeVersionListProps = {
  /** `null` en el alta: la receta aún no existe y no puede tener versiones. */
  readonly originalId: string | null;
  readonly versions: readonly RecipeVersionSummary[];
};

export type NewRecipeVersionButtonProps = {
  /** `null` en el alta: sin receta guardada no hay de qué sacar una versión. */
  readonly originalId: string | null;
};

const NEW_VERSION_LABEL = 'Nueva versión';
const EDIT_LABEL = 'Editar';
const DELETE_LABEL = 'Eliminar';

// El disparador es el envoltorio: el diálogo de borrado ya monta su propio disparador dentro.
function ActionTooltip({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function NewRecipeVersionButton({ originalId }: NewRecipeVersionButtonProps) {
  if (originalId === null) {
    return (
      <Button type="button" variant="outline" touch disabled data-testid="recipe-version-new">
        <PlusIcon aria-hidden />
        {NEW_VERSION_LABEL}
      </Button>
    );
  }
  return (
    <Link
      href={newRecipeVersionRoute(originalId)}
      data-slot="button"
      className={cn(buttonVariants({ variant: 'outline', touch: true }))}
      data-testid="recipe-version-new"
    >
      <PlusIcon aria-hidden />
      {NEW_VERSION_LABEL}
    </Link>
  );
}

export function RecipeVersionList({ originalId, versions }: RecipeVersionListProps) {
  const headingId = useId();

  return (
    <Card
      role="region"
      aria-labelledby={headingId}
      className="gap-1 rounded-[14px] px-5 py-5"
      data-testid="recipe-versions"
    >
      <h2 id={headingId} className="pb-2 text-lg font-semibold">
        Versiones
      </h2>

      {originalId === null || versions.length === 0 ? (
        <p
          className="border-t py-2.5 text-sm text-muted-foreground"
          data-testid="recipe-versions-empty"
        >
          Esta receta todavía no tiene versiones.
        </p>
      ) : (
        <ul
          className="flex flex-col rounded-[10px] border bg-card px-3 py-1"
          data-testid="recipe-versions-list"
        >
          {versions.map((version) => (
            <li
              key={version.id}
              className="flex min-h-12 items-center gap-3 border-b py-1.5 last:border-b-0"
              data-testid="recipe-version-row"
            >
              <span className="min-w-0 flex-1 truncate text-sm" title={version.name}>
                {version.name}
              </span>
              {version.isUnderReview ? (
                <StatusBadge
                  tone={RECIPE_VERSION_UNDER_REVIEW_TONE}
                  label={RECIPE_VERSION_UNDER_REVIEW_LABEL}
                  data-testid="recipe-version-under-review"
                />
              ) : null}
              <div className="flex items-center">
                <ActionTooltip label={EDIT_LABEL}>
                  <Link
                    href={recipeVersionRoute(originalId, version.id)}
                    data-slot="button"
                    aria-label={`${EDIT_LABEL} la versión ${version.name}`}
                    className={cn(buttonVariants({ variant: 'ghost', size: 'icon', touch: true }))}
                    data-testid="recipe-version-link"
                  >
                    <PencilIcon aria-hidden />
                  </Link>
                </ActionTooltip>
                <ActionTooltip label={DELETE_LABEL}>
                  <DeleteRecipeDialog
                    recipe={{ id: version.id, name: version.name }}
                    kind="version"
                    triggerLabel={`${DELETE_LABEL} la versión ${version.name}`}
                  />
                </ActionTooltip>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
