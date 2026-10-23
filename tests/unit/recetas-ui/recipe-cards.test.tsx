// El listado de recetas en tarjetas. jsdom no evalúa las consultas de contenedor, así que la tabla
// y las tarjetas están las dos en el árbol: aquí se mira la tarjeta, su menú centrado, los estados
// y la alineación de las columnas de cifras.

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RECIPE_TABLE_TEXTS, RecipeTable } from '@/app/(private)/produccion/formulas/components';
import type { DataTableParams } from '@/components/shared/data-table';
import type { RecipeSummary } from '@/lib/modules/recetas';
import { DEFAULT_PAGE_SIZE } from '@/lib/shared/pagination';
import { formatCivilDate } from '@/lib/shared/ui/date-civil';

import { setupUser } from '../../helpers/user-event';
import { WIDE_VIEWPORT, resetViewport, setViewportWidth } from '../../helpers/viewport';

const { routerMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/recetas/adapters/driving/recipe-actions', () => ({
  listRecipeVersionsAction: vi.fn(async () => ({ status: 'success' as const, data: [] })),
  deleteRecipeAction: vi.fn(async () => ({ status: 'success' as const })),
}));

const PARAMS: DataTableParams = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sort: null,
  filters: {},
  search: '',
};

function receta(overrides: Partial<RecipeSummary> = {}): RecipeSummary {
  return {
    id: 'receta-1',
    name: 'Detergente industrial',
    description: null,
    imageUrl: 'https://storage.example.com/recetas/detergente.png',
    stepCount: 7,
    createdAt: new Date('2026-01-15T10:20:30.000Z'),
    updatedAt: new Date('2026-02-20T08:00:00.000Z'),
    createdBy: 'autor',
    updatedBy: 'editor',
    ...overrides,
  };
}

const DETERGENTE = receta();

function tarjeta(id: string): HTMLElement {
  return screen.getByTestId(`data-table-card-${id}`);
}

function campo(card: HTMLElement, columnId: string): HTMLElement {
  return within(card).getByTestId(`data-table-card-field-${columnId}`);
}

function camposDe(card: HTMLElement): string[] {
  return Array.from(card.querySelectorAll('[data-testid^="data-table-card-field-"]')).map((el) =>
    (el.getAttribute('data-testid') ?? '').replace('data-table-card-field-', ''),
  );
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

describe('cada receta en su tarjeta', () => {
  it('R5: una tarjeta por receta, con la miniatura arriba y el nombre como título', () => {
    render(
      <RecipeTable
        recipes={[DETERGENTE, receta({ id: 'receta-2', name: 'Cloro', imageUrl: null })]}
        params={PARAMS}
        totalPages={1}
      />,
    );

    expect(
      within(screen.getByTestId('data-table-cards'))
        .getAllByRole('listitem')
        .map((card) => card.getAttribute('data-testid')),
    ).toEqual(['data-table-card-receta-1', 'data-table-card-receta-2']);

    const card = tarjeta(DETERGENTE.id);
    expect(within(campo(card, 'image')).getByTestId('recipe-image')).toHaveAttribute(
      'src',
      DETERGENTE.imageUrl as string,
    );
    expect(campo(card, 'name')).toHaveTextContent(/^Detergente industrial$/);
    expect(campo(card, 'name')).toHaveClass('font-semibold');
    expect(
      within(campo(tarjeta('receta-2'), 'image')).getByTestId('recipe-image-placeholder'),
    ).toBeInTheDocument();
  });

  it('R5: los datos secundarios son Pasos, Creado y Actualizado, en ese orden y con cifras tabulares', () => {
    render(<RecipeTable recipes={[DETERGENTE]} params={PARAMS} totalPages={1} />);

    const card = tarjeta(DETERGENTE.id);
    expect(camposDe(card)).toEqual(['image', 'name', 'stepCount', 'createdAt', 'updatedAt']);
    expect(campo(card, 'stepCount')).toHaveTextContent('7');
    expect(campo(card, 'createdAt')).toHaveTextContent(formatCivilDate(DETERGENTE.createdAt));
    expect(campo(card, 'updatedAt')).toHaveTextContent(formatCivilDate(DETERGENTE.updatedAt));
    for (const id of ['stepCount', 'createdAt', 'updatedAt']) {
      expect(campo(card, id), id).toHaveClass('tabular-nums');
    }
  });

  it('R5: cada dato secundario lleva su rótulo «Pasos», «Creado» y «Actualizado» delante de la cifra en mono', () => {
    render(<RecipeTable recipes={[DETERGENTE]} params={PARAMS} totalPages={1} />);

    const card = tarjeta(DETERGENTE.id);
    const esperados = [
      ['stepCount', 'Pasos', '7'],
      ['createdAt', 'Creado', formatCivilDate(DETERGENTE.createdAt)],
      ['updatedAt', 'Actualizado', formatCivilDate(DETERGENTE.updatedAt)],
    ] as const;
    for (const [id, rotulo, cifra] of esperados) {
      const field = campo(card, id);
      const label = field.querySelector('[data-card-label]');
      expect(label, id).not.toBeNull();
      expect(label?.textContent?.trim(), id).toBe(rotulo);
      expect(field.firstChild, `${id}: el rótulo va delante`).toBe(label);
      expect(field.textContent?.replace(label?.textContent ?? '', ''), id).toBe(cifra);
      expect(field, id).toHaveClass('font-mono');
    }
  });

  it('R5: en la fila de la tabla el rótulo de tarjeta se oculta', () => {
    render(<RecipeTable recipes={[DETERGENTE]} params={PARAMS} totalPages={1} />);

    const fila = screen.getByTestId(`data-table-row-${DETERGENTE.id}`);
    for (const id of ['stepCount', 'createdAt', 'updatedAt']) {
      const label = within(fila).getByTestId(`data-table-cell-${id}`).querySelector('[data-card-label]');
      expect(label?.className, id).toContain('[table_&]:hidden');
    }
  });

  it('R5: el botón «Acciones» de la tarjeta mide al menos 44 px y nombra la receta', () => {
    render(<RecipeTable recipes={[DETERGENTE]} params={PARAMS} totalPages={1} />);

    const acciones = within(tarjeta(DETERGENTE.id)).getByTestId('recipe-row-actions');
    expect(acciones).toHaveTextContent('Acciones');
    expect(acciones).toHaveAccessibleName('Acciones de Detergente industrial');
    expect(acciones).toHaveAttribute('data-recipe-id', DETERGENTE.id);
    expect(acciones.className).toContain('min-h-11');
    expect(RECIPE_TABLE_TEXTS.cardActions).toBe('Acciones');
    expect(RECIPE_TABLE_TEXTS.closeMenu).toBe('Cerrar');
  });

  it('R5: «Acciones» abre el menú centrado con el nombre como título e ítems de 48 px', async () => {
    const user = setupUser();
    render(<RecipeTable recipes={[DETERGENTE]} params={PARAMS} totalPages={1} />);

    await user.click(within(tarjeta(DETERGENTE.id)).getByTestId('recipe-row-actions'));

    const dialogo = await screen.findByRole('dialog', { name: 'Detergente industrial' });
    for (const testId of ['recipe-edit-open', 'recipe-delete-open']) {
      expect(within(dialogo).getByTestId(testId).className, testId).toContain('min-h-12');
    }
    expect(within(dialogo).queryAllByRole('separator', { hidden: true })).toHaveLength(1);
    expect(within(dialogo).getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  });
});

describe('estados del listado con tarjetas', () => {
  it('R6: el vacío de hoy, con «Nueva fórmula», sale una sola vez y sin tarjetas', () => {
    render(<RecipeTable recipes={[]} params={PARAMS} totalPages={1} empty={{}} />);

    const vacio = screen.getByTestId('recipe-list-empty');
    expect(vacio).toHaveTextContent('Todavía no hay fórmulas en el catálogo.');
    expect(within(vacio).getByTestId('recipe-create-open')).toHaveTextContent('Nueva fórmula');
    expect(screen.getAllByTestId('recipe-list-empty')).toHaveLength(1);
    expect(screen.queryByTestId('data-table-cards')).toBeNull();
  });

  it('R6: sin coincidencias sale el texto y «Limpiar búsqueda y filtros» de hoy, una sola vez y sin tarjetas', () => {
    render(
      <RecipeTable
        recipes={[]}
        params={{ ...PARAMS, search: 'nada' }}
        totalPages={1}
        noResults={{ clearHref: '/produccion/formulas' }}
      />,
    );

    expect(screen.getByText('Ninguna fórmula coincide con la búsqueda o los filtros.')).toBeInTheDocument();
    expect(screen.getAllByTestId('recipe-list-no-results')).toHaveLength(1);
    expect(screen.getByTestId('recipe-list-clear-search')).toHaveTextContent('Limpiar búsqueda y filtros');
    expect(screen.queryByTestId('data-table-cards')).toBeNull();
  });

  it('R6: el error de hoy sale una sola vez, con su reintento, y sin tarjetas', () => {
    render(
      <RecipeTable
        recipes={[]}
        params={PARAMS}
        totalPages={0}
        status="error"
        error={{ status: 'error', code: 'invalid_input', message: 'La consulta no es valida.' }}
      />,
    );

    expect(screen.getAllByTestId('recipe-list-error')).toHaveLength(1);
    expect(screen.getByTestId('recipe-list-retry')).toBeInTheDocument();
    expect(screen.queryByTestId('data-table-cards')).toBeNull();
  });

  it('R6: la carga pinta el esqueleto de hoy y ninguna tarjeta', () => {
    render(<RecipeTable recipes={[]} params={PARAMS} totalPages={0} status="loading" />);

    expect(screen.getByTestId('recipe-table-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('data-table-cards')).toBeNull();
  });
});

describe('columnas de cifras alineadas al final', () => {
  it('R2: Pasos, Creado y Actualizado alinean celda y cabecera al final; Nombre sigue al principio', () => {
    render(<RecipeTable recipes={[DETERGENTE]} params={PARAMS} totalPages={1} />);

    const fila = screen.getByTestId(`data-table-row-${DETERGENTE.id}`);
    for (const id of ['stepCount', 'createdAt', 'updatedAt']) {
      expect(within(fila).getByTestId(`data-table-cell-${id}`), id).toHaveClass('text-right');
      expect(
        screen.getByTestId(`data-table-head-${id}`).querySelector('.justify-end'),
        `cabecera de ${id}`,
      ).not.toBeNull();
    }
    expect(within(fila).getByTestId('data-table-cell-name')).not.toHaveClass('text-right');
  });
});
