// El menú de la fila de una receta como datos (`recipeRowActionsSpec`), su envoltorio
// `RecipeRowActions` y el único diálogo de borrado que monta la tabla.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecipeTable } from '@/app/(private)/produccion/formulas/components';
import {
  RecipeRowActions,
  recipeRowActionsSpec,
  type RecipeRowAction,
} from '@/app/(private)/produccion/formulas/components/recipe-row-actions';
import type { DataTableParams } from '@/components/shared/data-table';
import type { RecipeSummary } from '@/lib/modules/recetas';
import { DEFAULT_PAGE_SIZE } from '@/lib/shared/pagination';
import { FORMULAS_ROUTE } from '@/lib/shared/routes';

import { clickRowAction } from '../../helpers/row-actions-menu';
import { esperarInteractiva, setupUser } from '../../helpers/user-event';
import { WIDE_VIEWPORT, resetViewport, setViewportWidth } from '../../helpers/viewport';

const { routerMock, listRecipeVersionsActionMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  listRecipeVersionsActionMock: vi.fn(async () => ({ status: 'success' as const, data: [] })),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/recetas/adapters/driving/recipe-actions', () => ({
  listRecipeVersionsAction: listRecipeVersionsActionMock,
  deleteRecipeAction: vi.fn(async () => ({ status: 'success' as const })),
}));

function receta(overrides: Partial<RecipeSummary> = {}): RecipeSummary {
  return {
    id: 'receta-1',
    name: 'Detergente industrial',
    description: null,
    imageUrl: null,
    stepCount: 3,
    createdAt: new Date('2026-01-15T10:20:30.000Z'),
    updatedAt: new Date('2026-02-20T08:00:00.000Z'),
    createdBy: 'autor',
    updatedBy: 'editor',
    ...overrides,
  };
}

function parametros(): DataTableParams {
  return { page: 1, pageSize: DEFAULT_PAGE_SIZE, sort: null, filters: {}, search: '' };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  setViewportWidth(WIDE_VIEWPORT);
});

afterEach(() => {
  cleanup();
  resetViewport();
});

describe('recipeRowActionsSpec', () => {
  it('R3: ofrece «Editar» y «Borrar», en ese orden y con sus testids', () => {
    const spec = recipeRowActionsSpec({ recipe: receta(), onAction: vi.fn() });

    expect(spec.items.map((item) => item.label)).toEqual(['Editar', 'Borrar']);
    expect(spec.items.map((item) => item.testId)).toEqual(['recipe-edit-open', 'recipe-delete-open']);
  });

  it('R3: «Editar» enlaza a la ficha de la receta y no avisa de ninguna acción', () => {
    const onAction = vi.fn();
    const spec = recipeRowActionsSpec({ recipe: receta(), onAction });

    const editar = spec.items[0];
    expect(editar?.href).toBe(`${FORMULAS_ROUTE}/receta-1`);
    expect(editar?.onSelect).toBeUndefined();
  });

  it('R3: solo «Borrar» lleva separador delante y es destructivo', () => {
    const spec = recipeRowActionsSpec({ recipe: receta(), onAction: vi.fn() });

    expect(spec.items.filter((item) => item.separatorBefore === true).map((item) => item.key)).toEqual([
      'delete',
    ]);
    expect(spec.items.filter((item) => item.destructive === true).map((item) => item.key)).toEqual([
      'delete',
    ]);
  });

  it('R3: el disparador se llama «Acciones de <nombre>», con su testid, data-recipe-id y el nombre como título', () => {
    const spec = recipeRowActionsSpec({ recipe: receta(), onAction: vi.fn() });

    expect(spec.triggerLabel).toBe('Acciones de Detergente industrial');
    expect(spec.triggerTestId).toBe('recipe-row-actions');
    expect(spec.triggerDataAttributes).toEqual({ 'data-recipe-id': 'receta-1' });
    expect(spec.title).toBe('Detergente industrial');
  });

  it('R4: «Borrar» avisa de la acción con la receta de la fila', () => {
    const onAction = vi.fn<(action: RecipeRowAction, recipe: RecipeSummary) => void>();
    const laReceta = receta();
    const spec = recipeRowActionsSpec({ recipe: laReceta, onAction });

    spec.items[1]?.onSelect?.();

    expect(onAction.mock.calls).toEqual([['delete', laReceta]]);
  });
});

describe('RecipeRowActions', () => {
  it('R3: el desplegable pinta los dos ítems con una línea antes de «Borrar» y el disparador conserva su testid y data-recipe-id', async () => {
    const user = setupUser();
    render(<RecipeRowActions recipe={receta()} />);

    const disparador = screen.getByRole('button', { name: 'Acciones de Detergente industrial' });
    expect(disparador).toHaveAttribute('data-testid', 'recipe-row-actions');
    expect(disparador).toHaveAttribute('data-recipe-id', 'receta-1');
    await user.click(disparador);
    const menu = await screen.findByRole('menu');

    expect(within(menu).getAllByRole('menuitem').map((item) => item.getAttribute('data-testid'))).toEqual([
      'recipe-edit-open',
      'recipe-delete-open',
    ]);
    const separadores = within(menu).queryAllByRole('separator', { hidden: true });
    expect(separadores).toHaveLength(1);
    expect(separadores[0]?.nextElementSibling).toBe(within(menu).getByTestId('recipe-delete-open'));
  });

  it('R4: «Borrar» abre su diálogo de borrado de hoy', async () => {
    const user = setupUser();
    render(<RecipeRowActions recipe={receta()} />);

    await clickRowAction(user, screen.getByTestId('recipe-row-actions'), 'recipe-delete-open');

    const dialogo = await screen.findByTestId('delete-recipe-dialog');
    expect(within(dialogo).getByTestId('delete-recipe-message')).toHaveTextContent(
      'Se va a borrar «Detergente industrial». Esta acción no se puede deshacer.',
    );
  });
});

describe('RecipeTable — un diálogo de borrado por tabla', () => {
  const RECETAS = [
    receta({ id: 'receta-a', name: 'Amoniaco' }),
    receta({ id: 'receta-b', name: 'Borax' }),
    receta({ id: 'receta-c', name: 'Cloro' }),
  ];

  function disparadorDe(id: string): HTMLElement {
    return within(screen.getByTestId(`data-table-row-${id}`)).getByTestId('recipe-row-actions');
  }

  it('R4: con varias filas no hay ningún diálogo de borrado montado hasta elegir «Borrar»', () => {
    render(<RecipeTable recipes={RECETAS} params={parametros()} totalPages={1} />);

    expect(screen.queryAllByTestId('delete-recipe-dialog')).toHaveLength(0);
    expect(listRecipeVersionsActionMock).not.toHaveBeenCalled();
  });

  it('R4: «Borrar» abre un único diálogo con la receta de esa fila y cuenta sus versiones', async () => {
    const user = setupUser();
    render(<RecipeTable recipes={RECETAS} params={parametros()} totalPages={1} />);

    await clickRowAction(user, disparadorDe('receta-b'), 'recipe-delete-open');

    const dialogos = await screen.findAllByTestId('delete-recipe-dialog');
    expect(dialogos).toHaveLength(1);
    expect(within(dialogos[0] as HTMLElement).getByTestId('delete-recipe-message')).toHaveTextContent('«Borax»');
    await waitFor(() => expect(listRecipeVersionsActionMock).toHaveBeenCalledWith('receta-b'));
  });

  it('R4: cerrar y borrar otra fila reutiliza el mismo diálogo, ahora con la otra receta', async () => {
    const user = setupUser();
    render(<RecipeTable recipes={RECETAS} params={parametros()} totalPages={1} />);

    await clickRowAction(user, disparadorDe('receta-a'), 'recipe-delete-open');
    await screen.findByTestId('delete-recipe-dialog');
    await user.click(screen.getByTestId('delete-recipe-cancel'));
    await waitFor(() => expect(screen.queryByTestId('delete-recipe-dialog')).toBeNull());

    await clickRowAction(user, disparadorDe('receta-c'), 'recipe-delete-open');

    const dialogos = await screen.findAllByTestId('delete-recipe-dialog');
    expect(dialogos).toHaveLength(1);
    expect(within(dialogos[0] as HTMLElement).getByTestId('delete-recipe-message')).toHaveTextContent('«Cloro»');
  });

  it('R4: el «Borrar» de la tarjeta abre el mismo diálogo para esa receta', async () => {
    const user = setupUser();
    render(<RecipeTable recipes={RECETAS} params={parametros()} totalPages={1} />);

    const tarjeta = screen.getByTestId('data-table-card-receta-a');
    await user.click(within(tarjeta).getByTestId('recipe-row-actions'));
    const menu = await screen.findByRole('dialog', { name: 'Amoniaco' });
    await user.click(await esperarInteractiva(within(menu).getByTestId('recipe-delete-open')));

    const dialogos = await screen.findAllByTestId('delete-recipe-dialog');
    expect(dialogos).toHaveLength(1);
    expect(within(dialogos[0] as HTMLElement).getByTestId('delete-recipe-message')).toHaveTextContent('«Amoniaco»');
  });
});
