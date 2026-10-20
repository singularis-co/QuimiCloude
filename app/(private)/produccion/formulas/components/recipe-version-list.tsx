'use client';

import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useId } from 'react';

import { ArrowLink } from '@/components/shared/arrow-link';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

const NEW_VERSION_LABEL = 'Nueva versión';
const OPEN_LABEL = 'Abrir';

export function RecipeVersionList({ originalId, versions }: RecipeVersionListProps) {
  const headingId = useId();

  return (
    <Card
      role="region"
      aria-labelledby={headingId}
      className="gap-1 rounded-[14px] px-5 py-5"
      data-testid="recipe-versions"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <h2 id={headingId} className="text-lg font-semibold">
          Versiones
        </h2>
        {originalId === null ? (
          <Button type="button" variant="outline" size="sm" touch disabled data-testid="recipe-version-new">
            <PlusIcon aria-hidden />
            {NEW_VERSION_LABEL}
          </Button>
        ) : (
          <Link
            href={newRecipeVersionRoute(originalId)}
            data-slot="button"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm', touch: true }))}
            data-testid="recipe-version-new"
          >
            <PlusIcon aria-hidden />
            {NEW_VERSION_LABEL}
          </Link>
        )}
      </div>

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
              <ArrowLink
                href={recipeVersionRoute(originalId, version.id)}
                direction="forward"
                variant="outline"
                size="sm"
                touch
                testId="recipe-version-link"
              >
                {/* Nombre entero en el texto oculto: hay cálculos del nombre accesible que recortan su espacio inicial y pegarían «Abrirla». */}
                <span aria-hidden="true">{OPEN_LABEL}</span>
                <span className="sr-only">{`${OPEN_LABEL} la versión ${version.name}`}</span>
              </ArrowLink>
              <DeleteRecipeDialog recipe={{ id: version.id, name: version.name }} kind="version" />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
