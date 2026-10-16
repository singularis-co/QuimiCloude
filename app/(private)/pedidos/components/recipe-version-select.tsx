'use client';

import { useEffect, useId, useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge';
import type { RecipeVersionSummary } from '@/lib/modules/recetas';
import { listRecipeVersionsAction } from '@/lib/modules/recetas/adapters/driving/recipe-actions';
import { touchTarget } from '@/lib/shared/ui/touch-target';

/** Nombre del campo del `FormData` que lee el adaptador driving de `pedidos`. */
export const RECIPE_VERSION_FIELD = 'recipeVersionId';

/** Prefijo de los `data-testid` del selector. */
export const RECIPE_VERSION_SELECT_TESTID = 'recipe-version-select';

/** Valor de «Original»: el campo viaja vacio y el servidor lo lee como «sin version». */
export const ORIGINAL_VERSION_VALUE = '';

/** 16 px en todos los anchos: por debajo, Safari en iOS hace zoom al enfocar el control. */
const FIELD_TEXT = 'text-base md:text-base';

const DEFAULT_TEXTS = {
  label: 'Versión',
  original: 'Original',
  underReview: 'por revisar',
  deleted: 'dada de baja',
} as const;

export type RecipeVersionSelectTexts = { readonly [K in keyof typeof DEFAULT_TEXTS]: string };

export type RecipeVersionChoice = {
  readonly id: string;
  readonly name: string;
  /** Si falta, se deduce del listado: «por revisar» si sale marcada, «dada de baja» si no sale. */
  readonly note?: string;
};

export type RecipeVersionSelectProps = {
  /** La receta original elegida; `null` sin receta. */
  readonly recipeId: string | null;
  /** La version que ya tiene el pedido que se edita; `null` en el alta o sin version. */
  readonly initialVersion: RecipeVersionChoice | null;
  /** `null` = «Original». */
  readonly onChange: (versionId: string | null) => void;
  readonly error?: string;
  readonly texts?: RecipeVersionSelectTexts;
};

type VersionMark = { readonly text: string; readonly tone: StatusTone };

type Option = { readonly value: string; readonly label: string; readonly mark?: VersionMark };

type Loaded = { readonly recipeId: string; readonly versions: readonly RecipeVersionSummary[] };

export function RecipeVersionSelect({
  recipeId,
  initialVersion,
  onChange,
  error,
  texts = DEFAULT_TEXTS,
}: RecipeVersionSelectProps) {
  const labelId = useId();
  const errorId = useId();

  const [value, setValue] = useState(initialVersion?.id ?? ORIGINAL_VERSION_VALUE);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [trackedRecipeId, setTrackedRecipeId] = useState(recipeId);
  const [initialRecipeId] = useState(recipeId);

  if (recipeId !== trackedRecipeId) {
    setTrackedRecipeId(recipeId);
    setValue(ORIGINAL_VERSION_VALUE);
  }

  // `current` descarta la respuesta de una receta ya superada si llega despues que la nueva.
  useEffect(() => {
    if (recipeId === null) return;
    let current = true;
    void listRecipeVersionsAction(recipeId).then((result) => {
      if (!current) return;
      setLoaded({ recipeId, versions: result.status === 'success' ? result.data : [] });
    });
    return () => {
      current = false;
    };
  }, [recipeId]);

  const versions = loaded !== null && loaded.recipeId === recipeId ? loaded.versions : null;
  const offerable = (versions ?? []).filter((version) => !version.isUnderReview);

  // La version que el pedido ya tiene se conserva como opcion aunque no sea ofrecible.
  const keepsInitial =
    recipeId !== null &&
    recipeId === initialRecipeId &&
    initialVersion !== null &&
    !offerable.some((version) => version.id === initialVersion.id);

  const options: Option[] = [
    { value: ORIGINAL_VERSION_VALUE, label: texts.original },
    ...offerable.map((version) => ({ value: version.id, label: version.name })),
  ];
  if (keepsInitial) {
    options.push({
      value: initialVersion.id,
      label: initialVersion.name,
      mark: initialMark(initialVersion, versions, texts),
    });
  }

  const disabled = recipeId === null || options.length === 1;

  function handleValueChange(next: string | null) {
    const chosen = next ?? ORIGINAL_VERSION_VALUE;
    setValue(chosen);
    onChange(chosen === ORIGINAL_VERSION_VALUE ? null : chosen);
  }

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-sm font-medium">
        {texts.label}
      </span>

      {/* Un `select` deshabilitado no entra en el `FormData`; este campo viaja siempre. */}
      <input
        type="hidden"
        name={RECIPE_VERSION_FIELD}
        value={value}
        data-testid={`${RECIPE_VERSION_SELECT_TESTID}-value`}
      />

      <Select<string>
        value={value}
        onValueChange={handleValueChange}
        items={options}
        disabled={disabled}
      >
        <SelectTrigger
          aria-labelledby={labelId}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={error === undefined ? undefined : errorId}
          className={`w-full ${touchTarget} ${FIELD_TEXT}`}
          data-testid={RECIPE_VERSION_SELECT_TESTID}
        >
          <SelectValue>
            {(selected: string) => {
              const option = options.find((candidate) => candidate.value === selected);
              return option === undefined ? null : <OptionContent option={option} />;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className={`${touchTarget} ${FIELD_TEXT}`}
              data-testid={`${RECIPE_VERSION_SELECT_TESTID}-option`}
              data-value={option.value}
            >
              <OptionContent option={option} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {error === undefined ? null : (
        <p
          id={errorId}
          className="text-sm text-destructive"
          data-testid={`${RECIPE_VERSION_SELECT_TESTID}-error`}
        >
          {error}
        </p>
      )}
    </div>
  );
}

function OptionContent({ option }: { readonly option: Option }) {
  if (option.mark === undefined) return <>{option.label}</>;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="truncate">{option.label}</span>
      <StatusBadge
        tone={option.mark.tone}
        label={option.mark.text}
        data-testid={`${RECIPE_VERSION_SELECT_TESTID}-mark`}
      />
    </span>
  );
}

// Mientras el listado no llega no se sabe si la version sigue viva: una nota dada por quien
// llama sale en el tono neutro de «dada de baja» hasta entonces.
function initialMark(
  initial: RecipeVersionChoice,
  versions: readonly RecipeVersionSummary[] | null,
  texts: RecipeVersionSelectTexts,
): VersionMark | undefined {
  if (versions === null) {
    return initial.note === undefined ? undefined : { text: initial.note, tone: 'muted' };
  }
  const listed = versions.some((version) => version.id === initial.id);
  const tone: StatusTone = listed ? 'waiting' : 'muted';
  return { text: initial.note ?? (listed ? texts.underReview : texts.deleted), tone };
}
