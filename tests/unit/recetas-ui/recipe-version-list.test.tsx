import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupUser } from '../../helpers/user-event';

import {
  NewRecipeVersionButton,
  RecipeVersionList,
} from '@/app/(private)/produccion/formulas/components/recipe-version-list';
import type {
  DeleteRecipeFormState,
  RecipeVersionListResult,
} from '@/lib/modules/recetas/adapters/driving/recipe-actions';
import type { RecipeVersionSummary } from '@/lib/modules/recetas';

const { routerMock, listRecipeVersionsActionMock, deleteRecipeActionMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  listRecipeVersionsActionMock: vi.fn<(originalId: string) => Promise<RecipeVersionListResult>>(),
  deleteRecipeActionMock: vi.fn<(id: string) => Promise<DeleteRecipeFormState>>(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/recetas/adapters/driving/recipe-actions', () => ({
  listRecipeVersionsAction: listRecipeVersionsActionMock,
  deleteRecipeAction: deleteRecipeActionMock,
}));

const ORIGINAL_ID = 'rec-original-1';
const AREA_TACTIL = ['min-h-11', 'min-w-11'];

function version(id: string, name: string, isUnderReview = false): RecipeVersionSummary {
  return {
    id,
    name,
    displayName: `Desengrasante base · ${name}`,
    isUnderReview,
    updatedAt: new Date('2026-09-01T10:00:00Z'),
  };
}

// Orden deliberadamente no alfabético: el componente no debe reordenar.
const VERSIONES: readonly RecipeVersionSummary[] = [
  version('v-zeta', 'Zeta concentrada'),
  version('v-alfa', 'Alfa diluida', true),
  version('v-medio', 'Media carga'),
];

function filas() {
  return screen.getAllByTestId('recipe-version-row');
}

function tooltipsAbiertos(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-slot="tooltip-content"]'));
}

async function esperarTooltip(texto: string): Promise<void> {
  await waitFor(() =>
    expect(tooltipsAbiertos().map((popup) => popup.textContent)).toContain(texto),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deleteRecipeActionMock.mockResolvedValue({ status: 'success' });
  listRecipeVersionsActionMock.mockResolvedValue({ status: 'success', data: [] });
  vi.spyOn(toast, 'success');
});

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.restoreAllMocks();
});

describe('RecipeVersionList', () => {
  it('R1: pinta una fila por versión en el orden recibido con enlace a su página', () => {
    render(<RecipeVersionList originalId={ORIGINAL_ID} versions={VERSIONES} />);

    const seccion = screen.getByRole('region', { name: 'Versiones' });
    expect(within(seccion).getByRole('heading', { name: 'Versiones' })).toBeInTheDocument();

    expect(filas().map((fila) => within(fila).getByTitle(/.+/).textContent)).toEqual([
      'Zeta concentrada',
      'Alfa diluida',
      'Media carga',
    ]);
    const enlaces = filas().map((fila) => within(fila).getByTestId('recipe-version-link'));
    expect(enlaces.map((e) => e.getAttribute('href'))).toEqual([
      `/produccion/formulas/${ORIGINAL_ID}/versiones/v-zeta`,
      `/produccion/formulas/${ORIGINAL_ID}/versiones/v-alfa`,
      `/produccion/formulas/${ORIGINAL_ID}/versiones/v-medio`,
    ]);
    expect(screen.queryByTestId('recipe-versions-empty')).toBeNull();
  });

  it('R2: «Por revisar» aparece solo en las versiones que lo están', () => {
    render(<RecipeVersionList originalId={ORIGINAL_ID} versions={VERSIONES} />);

    const [zeta, alfa, medio] = filas();
    expect(within(zeta).queryByTestId('recipe-version-under-review')).toBeNull();
    expect(within(alfa).getByTestId('recipe-version-under-review')).toHaveTextContent(
      'Por revisar',
    );
    expect(within(medio).queryByTestId('recipe-version-under-review')).toBeNull();
    expect(screen.getAllByTestId('recipe-version-under-review')).toHaveLength(1);
  });

  it('R3: sin versiones muestra el texto de vacío y ninguna lista', () => {
    render(<RecipeVersionList originalId={ORIGINAL_ID} versions={[]} />);

    expect(screen.getByTestId('recipe-versions-empty')).toHaveTextContent(
      'Esta receta todavía no tiene versiones.',
    );
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryAllByTestId('recipe-version-row')).toHaveLength(0);
    expect(screen.getByRole('region', { name: 'Versiones' })).toBeInTheDocument();
  });

  it.each([
    ['con versiones', VERSIONES],
    ['sin versiones', []],
  ] as const)('R4: «Nueva versión» enlaza a la página de alta y no va en la lista (%s)', (_, versions) => {
    render(<RecipeVersionList originalId={ORIGINAL_ID} versions={versions} />);
    expect(screen.queryByTestId('recipe-version-new')).toBeNull();
    cleanup();

    render(<NewRecipeVersionButton originalId={ORIGINAL_ID} />);
    const nueva = screen.getByRole('link', { name: 'Nueva versión' });
    expect(nueva).toHaveAttribute('href', `/produccion/formulas/${ORIGINAL_ID}/versiones/nueva`);
  });

  it('R32: borrar una versión pasa por el diálogo en modo versión y confirma con su id', async () => {
    const user = setupUser();
    render(<RecipeVersionList originalId={ORIGINAL_ID} versions={VERSIONES} />);

    const alfa = filas()[1];
    await user.click(within(alfa).getByRole('button', { name: 'Eliminar la versión Alfa diluida' }));

    const dialogo = await screen.findByTestId('delete-recipe-dialog');
    expect(within(dialogo).getByRole('heading', { name: 'Borrar versión' })).toBeInTheDocument();
    expect(within(dialogo).getByTestId('delete-recipe-message')).toHaveTextContent(
      'Se va a borrar la versión «Alfa diluida». Esta acción no se puede deshacer.',
    );
    expect(deleteRecipeActionMock).not.toHaveBeenCalled();

    await user.click(within(dialogo).getByTestId('delete-recipe-confirm'));

    await waitFor(() => expect(screen.queryByTestId('delete-recipe-dialog')).toBeNull());
    expect(deleteRecipeActionMock).toHaveBeenCalledTimes(1);
    expect(deleteRecipeActionMock).toHaveBeenCalledWith('v-alfa');
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    expect(listRecipeVersionsActionMock).not.toHaveBeenCalled();
  });

  it('R37: enlaces y botones nuevos tienen objetivo táctil de al menos 44x44', () => {
    render(<RecipeVersionList originalId={ORIGINAL_ID} versions={VERSIONES} />);

    const controles = [
      ...screen.getAllByTestId('recipe-version-link'),
      ...screen.getAllByTestId('recipe-delete-open'),
    ];
    expect(controles).toHaveLength(VERSIONES.length * 2);
    for (const control of controles) {
      expect(control).toHaveClass(...AREA_TACTIL);
    }
  });
});

describe('RecipeVersionList — rediseño (QC-264)', () => {
  it('R30: el nombre va en una línea, cortado con elipsis y con el nombre completo como title, y deja de ser enlace', () => {
    render(<RecipeVersionList originalId={ORIGINAL_ID} versions={VERSIONES} />);

    for (const [fila, esperada] of filas().map((f, i) => [f, VERSIONES[i]] as const)) {
      const nombre = within(fila).getByTitle(esperada.name);
      expect(nombre).toHaveTextContent(esperada.name);
      expect(nombre).toHaveClass('truncate', 'min-w-0');
      expect(nombre.closest('a')).toBeNull();
      expect(fila).toHaveClass('min-h-12');
    }
  });

  it('R30: «Por revisar» es un StatusBadge en tono waiting, en una sola línea', () => {
    render(<RecipeVersionList originalId={ORIGINAL_ID} versions={VERSIONES} />);

    const marca = screen.getByTestId('recipe-version-under-review');
    expect(marca).toHaveAttribute('data-slot', 'badge');
    expect(marca).toHaveAttribute('data-tone', 'waiting');
    expect(marca).toHaveClass('whitespace-nowrap');
    expect(marca).toHaveTextContent('Por revisar');
  });

  it('R30: «Editar» es un icono de lápiz sin texto, con nombre accesible «Editar la versión X» y la dirección de la versión', () => {
    render(<RecipeVersionList originalId={ORIGINAL_ID} versions={VERSIONES} />);

    for (const [fila, esperada] of filas().map((f, i) => [f, VERSIONES[i]] as const)) {
      const editar = within(fila).getByRole('link', { name: `Editar la versión ${esperada.name}` });
      expect(editar).toHaveAttribute('data-testid', 'recipe-version-link');
      expect(editar).toHaveAttribute(
        'href',
        `/produccion/formulas/${ORIGINAL_ID}/versiones/${esperada.id}`,
      );
      expect(editar).toHaveTextContent('');
      expect(editar.querySelector('svg[aria-hidden]')).not.toBeNull();
      expect(editar).toHaveClass(...AREA_TACTIL);
    }
    expect(screen.queryByText('Abrir')).toBeNull();
  });

  it('R30: cada fila conserva el borrado de versión, como icono con nombre «Eliminar la versión X»', () => {
    render(<RecipeVersionList originalId={ORIGINAL_ID} versions={VERSIONES} />);

    for (const [fila, esperada] of filas().map((f, i) => [f, VERSIONES[i]] as const)) {
      const borrar = within(fila).getByRole('button', {
        name: `Eliminar la versión ${esperada.name}`,
      });
      expect(borrar).toHaveAttribute('data-testid', 'recipe-delete-open');
      expect(borrar).toHaveTextContent('');
    }
  });

  it('R30: el puntero sobre el lápiz muestra «Editar» y sobre la papelera «Eliminar»', async () => {
    const user = setupUser();
    render(<RecipeVersionList originalId={ORIGINAL_ID} versions={VERSIONES} />);

    const [zeta] = filas();
    await user.hover(within(zeta).getByTestId('recipe-version-link'));
    await esperarTooltip('Editar');
    await user.unhover(within(zeta).getByTestId('recipe-version-link'));

    await user.hover(within(zeta).getByTestId('recipe-delete-open'));
    await esperarTooltip('Eliminar');
  });

  it('R30: con el teclado el tooltip sale al enfocar la acción', async () => {
    const user = setupUser();
    render(<RecipeVersionList originalId={ORIGINAL_ID} versions={VERSIONES} />);

    await user.tab();
    expect(within(filas()[0]).getByTestId('recipe-version-link')).toHaveFocus();
    await esperarTooltip('Editar');
  });

  it('R31: «Nueva versión» es un enlace con icono de más hacia el alta de versión', () => {
    render(<NewRecipeVersionButton originalId={ORIGINAL_ID} />);

    const nueva = screen.getByTestId('recipe-version-new');
    expect(nueva.tagName).toBe('A');
    expect(nueva).toHaveAccessibleName('Nueva versión');
    expect(nueva).toHaveAttribute('href', `/produccion/formulas/${ORIGINAL_ID}/versiones/nueva`);
    expect(nueva).toHaveAttribute('data-slot', 'button');
    expect(nueva.querySelector('svg[aria-hidden]')).not.toBeNull();
    expect(nueva).toHaveClass(...AREA_TACTIL);
  });

  it('R14: en el alta (originalId null) «Nueva versión» está deshabilitado y se pinta el vacío', () => {
    render(
      <>
        <NewRecipeVersionButton originalId={null} />
        <RecipeVersionList originalId={null} versions={[]} />
      </>,
    );

    const nueva = screen.getByTestId('recipe-version-new');
    expect(nueva.tagName).toBe('BUTTON');
    expect(nueva).toBeDisabled();
    expect(nueva).toHaveAccessibleName('Nueva versión');
    expect(nueva.querySelector('svg[aria-hidden]')).not.toBeNull();
    expect(nueva).toHaveClass(...AREA_TACTIL);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByTestId('recipe-versions-empty')).toHaveTextContent(
      'Esta receta todavía no tiene versiones.',
    );
    expect(screen.queryAllByTestId('recipe-version-row')).toHaveLength(0);
    expect(screen.getByRole('region', { name: 'Versiones' })).toBeInTheDocument();
  });
});
