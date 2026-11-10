import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  NO_RECIPE_ACCESS,
  OTHER_RECIPES_TESTID,
  OTHER_RECIPE_GO_TESTID,
  OTHER_RECIPE_TESTID,
  RECIPE_HEADER_TEXTS,
  RecipeHeader,
  otherRecipeHref,
  recipeAccessOf,
  type RecipeAccess,
  type RecipeHeaderProps,
} from '@/app/(private)/asignacion/components';
import type { OtherRecipeView } from '@/lib/modules/asignaciones';
import { assignedOrderRoute, conditioningOrderRoute, packingOrderRoute } from '@/lib/shared/routes';

const ORDER_ID = '33333333-3333-4333-8333-333333333333';
const LINE_B = '66666666-6666-4666-8666-666666666666';
const LINE_C = '77777777-7777-4777-8777-777777777777';

const FULL_ACCESS: RecipeAccess = { execute: true, pack: true, condition: true };

function otra(status: OtherRecipeView['status'], overrides: Partial<OtherRecipeView> = {}): OtherRecipeView {
  return { lineId: LINE_B, recipeName: 'Desengrasante alcalino', status, ...overrides };
}

function cabecera(overrides: Partial<RecipeHeaderProps> = {}) {
  return render(
    <RecipeHeader
      phase="Fabricación"
      orderId={ORDER_ID}
      numberText="2026-0001042"
      recipeName="Hipoclorito 5 %"
      recipeMissingText="Esta fórmula está dada de baja."
      recipe={{ position: 1, count: 2 }}
      details={<span>200,00 L · Bidón 20 L</span>}
      status={<span data-testid="estado">En fabricación</span>}
      otherRecipes={[otra('PENDIENTE')]}
      access={FULL_ACCESS}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe('RecipeHeader — la cabecera de una receta', () => {
  it('R7: nombra la fase, el pedido, «Receta N de M», la receta en el h1, cantidad · reparto y el estado', () => {
    cabecera();

    expect(screen.getByText(/Fabricación/)).toHaveTextContent('Fabricación · Pedido 2026-0001042 · Receta 1 de 2');
    expect(screen.getByRole('heading', { level: 1, name: 'Hipoclorito 5 %' })).toBeInTheDocument();
    expect(screen.getByText('200,00 L · Bidón 20 L')).toBeInTheDocument();
    expect(screen.getByTestId('estado')).toHaveTextContent('En fabricación');
  });

  it('R7: con la receta dada de baja, el h1 dice que lo esta', () => {
    cabecera({ recipeName: null });

    expect(
      screen.getByRole('heading', { level: 1, name: 'Esta fórmula está dada de baja.' }),
    ).toBeInTheDocument();
  });

  it('R8: lista las otras recetas en el orden recibido, con su nombre y su estado', () => {
    cabecera({
      recipe: { position: 2, count: 3 },
      otherRecipes: [
        otra('POR_EMPACAR', { lineId: LINE_B, recipeName: 'Jabón líquido' }),
        otra('CANCELADO', { lineId: LINE_C, recipeName: 'Desengrasante alcalino' }),
      ],
    });

    const lista = screen.getByRole('list', { name: RECIPE_HEADER_TEXTS.otherRecipes });
    const filas = within(lista).getAllByRole('listitem');
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent('Jabón líquido');
    expect(filas[0]).toHaveTextContent('Por empacar');
    expect(filas[1]).toHaveTextContent('Desengrasante alcalino');
    expect(filas[1]).toHaveTextContent('Cancelado');
    expect(screen.getByText(/Fabricación/)).toHaveTextContent('Receta 2 de 3');
  });

  it('R8: «Ir a esta receta» lleva a la pantalla de esa receta y nombra la receta en su descripcion', () => {
    cabecera();

    const ir = screen.getByRole('link', { name: RECIPE_HEADER_TEXTS.goToRecipe });
    expect(ir).toHaveAttribute('href', assignedOrderRoute(ORDER_ID, LINE_B));
    expect(ir).toHaveAccessibleDescription('Desengrasante alcalino');
  });

  it('R8: con una receta que el catalogo no resuelve, la fila la nombra igual', () => {
    cabecera({ otherRecipes: [otra('PENDIENTE', { recipeName: null })] });

    expect(screen.getByTestId(OTHER_RECIPE_TESTID)).toHaveTextContent(RECIPE_HEADER_TEXTS.recipeMissing);
  });

  it('R29: con una sola receta no hay «Receta 1 de 1» ni «Otras recetas»', () => {
    cabecera({ recipe: { position: 1, count: 1 }, otherRecipes: [] });

    expect(screen.queryByText(/Receta 1 de 1/)).toBeNull();
    expect(screen.queryByTestId(OTHER_RECIPES_TESTID)).toBeNull();
    expect(screen.getByText(/Fabricación/)).toHaveTextContent('Fabricación · Pedido 2026-0001042');
  });

  it('R30: el «Ir a esta receta» tiene 44 × 44 px y la fila se apila en el telefono', () => {
    cabecera();

    expect(screen.getByTestId(OTHER_RECIPE_GO_TESTID)).toHaveClass('min-h-11', 'min-w-11');
    const fila = screen.getByTestId(OTHER_RECIPE_TESTID);
    expect(fila).toHaveClass('flex-col', 'sm:flex-row');
  });
});

describe('otherRecipeHref — a donde lleva «Ir a esta receta»', () => {
  const DESTINOS = [
    { status: 'PENDIENTE', href: assignedOrderRoute(ORDER_ID, LINE_B), sinPermiso: { ...FULL_ACCESS, execute: false } },
    { status: 'EN_CURSO', href: assignedOrderRoute(ORDER_ID, LINE_B), sinPermiso: { ...FULL_ACCESS, execute: false } },
    { status: 'POR_EMPACAR', href: packingOrderRoute(ORDER_ID, LINE_B), sinPermiso: { ...FULL_ACCESS, pack: false } },
    { status: 'EN_EMPAQUE', href: packingOrderRoute(ORDER_ID, LINE_B), sinPermiso: { ...FULL_ACCESS, pack: false } },
    {
      status: 'POR_ACONDICIONAR',
      href: conditioningOrderRoute(ORDER_ID, LINE_B),
      sinPermiso: { ...FULL_ACCESS, condition: false },
    },
    {
      status: 'EN_ACONDICIONAMIENTO',
      href: conditioningOrderRoute(ORDER_ID, LINE_B),
      sinPermiso: { ...FULL_ACCESS, condition: false },
    },
  ] as const;

  it.each(DESTINOS)('R8: $status lleva a su pantalla', ({ status, href }) => {
    expect(otherRecipeHref(ORDER_ID, { lineId: LINE_B, status }, FULL_ACCESS)).toBe(href);
  });

  it.each(DESTINOS)('R8: $status sin el permiso de su pantalla no ofrece enlace', ({ status, sinPermiso }) => {
    expect(otherRecipeHref(ORDER_ID, { lineId: LINE_B, status }, sinPermiso)).toBeNull();
    expect(otherRecipeHref(ORDER_ID, { lineId: LINE_B, status }, NO_RECIPE_ACCESS)).toBeNull();
  });

  it.each(['CANCELADO', 'TERMINADO', 'BLOQUEADO', 'ENTREGADO'] as const)(
    'R8: %s no ofrece enlace ni con todos los permisos',
    (status) => {
      expect(otherRecipeHref(ORDER_ID, { lineId: LINE_B, status }, FULL_ACCESS)).toBeNull();
    },
  );

  it.each(['CANCELADO', 'TERMINADO', 'BLOQUEADO', 'ENTREGADO'] as const)(
    'R8: la fila %s sale con su nombre y su estado, sin «Ir a esta receta»',
    (status) => {
      cabecera({ otherRecipes: [otra(status)] });

      expect(screen.getByTestId(OTHER_RECIPE_TESTID)).toHaveTextContent('Desengrasante alcalino');
      expect(screen.queryByRole('link', { name: RECIPE_HEADER_TEXTS.goToRecipe })).toBeNull();
    },
  );

  it('R8: sin el permiso de la pantalla, la fila sale con su nombre y su estado, sin enlace', () => {
    cabecera({ otherRecipes: [otra('POR_EMPACAR')], access: { ...FULL_ACCESS, pack: false } });

    expect(screen.getByTestId(OTHER_RECIPE_TESTID)).toHaveTextContent('Por empacar');
    expect(screen.queryByTestId(OTHER_RECIPE_GO_TESTID)).toBeNull();
  });
});

describe('recipeAccessOf — que pantallas puede abrir la sesion', () => {
  it('R8: cada permiso abre solo su pantalla', () => {
    expect(recipeAccessOf({ permissions: ['asignaciones.ejecutar'] })).toEqual({
      execute: true,
      pack: false,
      condition: false,
    });
    expect(recipeAccessOf({ permissions: ['empaque.modificar'] })).toEqual({
      execute: false,
      pack: true,
      condition: false,
    });
    expect(recipeAccessOf({ permissions: ['acondicionamiento.modificar'] })).toEqual({
      execute: false,
      pack: false,
      condition: true,
    });
  });

  it('R8: sin sesion no abre ninguna', () => {
    expect(recipeAccessOf(null)).toEqual(NO_RECIPE_ACCESS);
  });
});
