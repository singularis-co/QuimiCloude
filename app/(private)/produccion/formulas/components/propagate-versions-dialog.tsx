'use client';

import { useId, useState } from 'react';

import { StatusBadge } from '@/components/shared/status-badge';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { RecipeVersionSummary } from '@/lib/modules/recetas';
import { touchTarget } from '@/lib/shared/ui/touch-target';

import {
  RECIPE_VERSION_UNDER_REVIEW_LABEL,
  RECIPE_VERSION_UNDER_REVIEW_TONE,
} from './recipe-version-tones';

const DESCRIPTION = 'Marca las versiones que deben recibir este cambio en sus líneas.';
const PROPAGATE_LABEL = 'Guardar y propagar';
const SAVE_WITHOUT_LABEL = 'Guardar sin propagar';
const CANCEL_LABEL = 'Cancelar';

// Solo el texto tras la cifra: la cifra se pinta aparte, en monoespaciada.
function dialogTitle(count: number): string {
  return count === 1 ? 'versión parte de esta fórmula' : 'versiones parten de esta fórmula';
}

export type PropagateVersionsDialogProps = {
  readonly open: boolean;
  readonly versions: readonly Pick<RecipeVersionSummary, 'id' | 'name' | 'isUnderReview'>[];
  readonly onOpenChange: (open: boolean) => void;
  readonly onSave: (propagateToVersionIds: readonly string[]) => void;
};

export function PropagateVersionsDialog({
  open,
  versions,
  onOpenChange,
  onSave,
}: PropagateVersionsDialogProps) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(
    () => new Set(versions.map((version) => version.id)),
  );
  const [wasOpen, setWasOpen] = useState(open);
  const idPrefix = useId();

  // Cada apertura arranca con todas marcadas, aunque la anterior se cerrase con alguna desmarcada.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setChecked(new Set(versions.map((version) => version.id)));
  }

  const toggle = (id: string, isChecked: boolean) => {
    setChecked((previous) => {
      const next = new Set(previous);
      if (isChecked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  // Se envian en el orden de la lista, no en el de los clics.
  const selectedIds = versions.filter((version) => checked.has(version.id)).map((version) => version.id);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        data-testid="propagate-versions-dialog"
        className="flex max-h-[85dvh] flex-col"
      >
        <AlertDialogHeader>
          <AlertDialogTitle data-testid="propagate-versions-title">
            <span className="font-mono" data-testid="propagate-versions-count">
              {versions.length}
            </span>{' '}
            {dialogTitle(versions.length)}
          </AlertDialogTitle>
          <AlertDialogDescription>{DESCRIPTION}</AlertDialogDescription>
        </AlertDialogHeader>

        <ul
          className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[10px] border bg-card px-3 py-1"
          data-testid="propagate-versions-list"
        >
          {versions.map((version) => {
            const labelId = `${idPrefix}-${version.id}`;
            return (
              <li key={version.id}>
                <label
                  className={`flex min-h-12 ${touchTarget} w-full cursor-pointer items-center gap-3 text-sm`}
                  data-testid="propagate-version-row"
                >
                  <Checkbox
                    className={`${touchTarget} shrink-0`}
                    aria-labelledby={labelId}
                    checked={checked.has(version.id)}
                    onCheckedChange={(isChecked: boolean) => toggle(version.id, isChecked)}
                    data-testid="propagate-version-checkbox"
                    data-version-id={version.id}
                  />
                  <span id={labelId} className="min-w-0 flex-1">
                    {version.name}
                  </span>
                  {version.isUnderReview ? (
                    <StatusBadge
                      tone={RECIPE_VERSION_UNDER_REVIEW_TONE}
                      label={RECIPE_VERSION_UNDER_REVIEW_LABEL}
                      data-testid="propagate-version-under-review"
                    />
                  ) : null}
                </label>
              </li>
            );
          })}
        </ul>

        <AlertDialogFooter>
          <AlertDialogCancel className={touchTarget} data-testid="propagate-versions-cancel">
            {CANCEL_LABEL}
          </AlertDialogCancel>
          <Button
            type="button"
            variant="outline"
            touch
            onClick={() => onSave([])}
            data-testid="propagate-versions-skip"
          >
            {SAVE_WITHOUT_LABEL}
          </Button>
          <Button
            type="button"
            touch
            disabled={selectedIds.length === 0}
            onClick={() => onSave(selectedIds)}
            data-testid="propagate-versions-confirm"
          >
            {PROPAGATE_LABEL}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
