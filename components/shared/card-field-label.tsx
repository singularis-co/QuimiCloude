import type { ReactNode } from 'react';

/**
 * Rótulo de una cifra que solo se ve en la tarjeta: dentro de una `<table>` se oculta. Va delante
 * y fuera del elemento con el `data-testid` de la cifra, así que el texto de este no cambia.
 */
export function cardFieldLabel(text: string): ReactNode {
  return (
    <span data-card-label className="text-muted-foreground [table_&]:hidden">
      {text}{' '}
    </span>
  );
}

/** La celda con su rótulo delante; una celda vacía (`null`) se queda sin rótulo. */
export function withCardFieldLabel(text: string, value: ReactNode): ReactNode {
  if (value === null || value === undefined) return null;
  return (
    <>
      {cardFieldLabel(text)}
      {value}
    </>
  );
}
