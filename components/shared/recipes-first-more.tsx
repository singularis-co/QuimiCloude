import type { ReactNode } from 'react';

export type RecipesFirstMoreTexts = {
  readonly more: (count: number) => string;
};

export const RECIPES_FIRST_MORE_TEXTS: RecipesFirstMoreTexts = {
  more: (count) => `+${count} más`,
};

export type RecipesFirstMoreProps = {
  /** Lo que se pinta de la primera receta: su nombre o la marca de vacío. */
  readonly first: ReactNode;
  /** Recetas que quedan aparte de la primera; con 0 no se pinta «+N más». */
  readonly moreCount: number;
  readonly firstTestId?: string;
  readonly moreTestId?: string;
  readonly texts?: RecipesFirstMoreTexts;
  readonly className?: string;
};

/** «Primera receta +N más» de un pedido con varias recetas. */
export function RecipesFirstMore({
  first,
  moreCount,
  firstTestId,
  moreTestId,
  texts = RECIPES_FIRST_MORE_TEXTS,
  className,
}: RecipesFirstMoreProps) {
  return (
    <span className={className}>
      <span data-testid={firstTestId}>{first}</span>
      {moreCount > 0 ? (
        <>
          {' '}
          <span data-testid={moreTestId} className="text-muted-foreground">
            {texts.more(moreCount)}
          </span>
        </>
      ) : null}
    </span>
  );
}
