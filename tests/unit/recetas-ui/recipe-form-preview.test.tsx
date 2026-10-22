import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecipeForm } from '@/app/(private)/produccion/formulas/components';
import type { RecipeDetail, RecipeStepView } from '@/lib/modules/recetas';
import type {
  CreateRecipeFormState,
  UpdateRecipeFormState,
} from '@/lib/modules/recetas/adapters/driving/recipe-actions';

import { setupUser } from '../../helpers/user-event';

/**
 * Vista previa del formulario de receta tras el rediseño (QC-264 T5a). Monta `RecipeForm` y lee el
 * lector solo por sus `data-testid`: este archivo no importa `step-reader`
 * (`recipe-route-contract`).
 */

const { routerMock, createRecipeActionMock, updateRecipeActionMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  createRecipeActionMock: vi.fn<(input: unknown) => Promise<CreateRecipeFormState>>(),
  updateRecipeActionMock: vi.fn<(id: string, input: unknown) => Promise<UpdateRecipeFormState>>(),
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: vi.fn(), endSession: vi.fn() },
  observabilidad: { readRequestIdHeader: vi.fn(async (): Promise<string | null> => null) },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/recetas/adapters/driving/recipe-actions', () => ({
  createRecipeAction: createRecipeActionMock,
  updateRecipeAction: updateRecipeActionMock,
}));

vi.mock('@/lib/modules/inventario/adapters/driving/product-actions', () => ({
  listProductsAction: vi.fn(),
}));

vi.mock('@/lib/modules/unidades/adapters/driving/unit-actions', () => ({
  listUnitsAction: vi.fn(),
}));

vi.setConfig({ testTimeout: 30_000 });

const RECIPE_ID = '66666666-6666-4666-8666-666666666666';
const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const EMPTY_PAGE = { items: [], totalPages: 1 };
const DESCRIPTION =
  'Así se leerá esta receta, paso a paso. Nada de lo que hagas aquí se guarda.';

function paragraph(text: string): RecipeStepView {
  return { blocks: [{ kind: 'paragraph', spans: [{ text }] }] };
}

function recipeDetail(steps: readonly RecipeStepView[]): RecipeDetail {
  return {
    id: RECIPE_ID,
    name: 'Detergente industrial',
    description: null,
    imageUrl: null,
    stepCount: steps.length,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    createdBy: null,
    updatedBy: null,
    steps: [...steps],
    packingSteps: [],
    conditioningSteps: [],
    lines: [
      {
        id: 'line-1',
        productId: PRODUCT_ID,
        productName: 'Ácido cítrico',
        percentage: '100.00',
        productUnitId: null,
        productStock: null,
      },
    ],
    tools: [],
    original: null,
    isUnderReview: false,
    displayName: 'Detergente industrial',
  };
}

function renderEdit(steps: readonly RecipeStepView[]) {
  return render(
    <RecipeForm
      mode="edit"
      recipe={recipeDetail(steps)}
      versions={[]}
      units={[]}
      initialProductPage={EMPTY_PAGE}
      initialMachinePage={EMPTY_PAGE}
    />,
  );
}

async function abrir(user: ReturnType<typeof setupUser>): Promise<HTMLElement> {
  await user.click(screen.getByTestId('recipe-form-preview-open'));
  return await screen.findByTestId('recipe-form-preview');
}

function esperarQueNadaSeGuardaNiNavega() {
  expect(createRecipeActionMock).not.toHaveBeenCalled();
  expect(updateRecipeActionMock).not.toHaveBeenCalled();
  expect(routerMock.push).not.toHaveBeenCalled();
  expect(routerMock.replace).not.toHaveBeenCalled();
  expect(routerMock.refresh).not.toHaveBeenCalled();
}

beforeAll(() => {
  if (typeof Range.prototype.getClientRects !== 'function') {
    Range.prototype.getClientRects = () => {
      const rects: DOMRect[] = [];
      return Object.assign(rects, {
        item: (index: number) => rects[index] ?? null,
      }) as unknown as DOMRectList;
    };
  }
  if (typeof Range.prototype.getBoundingClientRect !== 'function') {
    Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
  }
  if (typeof document.elementFromPoint !== 'function') {
    (document as unknown as { elementFromPoint: () => Element | null }).elementFromPoint = () =>
      null;
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  updateRecipeActionMock.mockResolvedValue({ status: 'success', propagated: [] });
});

afterEach(() => {
  cleanup();
});

describe('vista previa del formulario de receta (QC-264)', () => {
  it('R21: se titula «Vista previa», se describe con tildes y ofrece «Cerrar» de 44 × 44', async () => {
    const user = setupUser();
    renderEdit([paragraph('Mezclar')]);

    const dialogo = await abrir(user);

    expect(screen.getByRole('dialog', { name: 'Vista previa' })).toBe(dialogo);
    expect(dialogo).toHaveAccessibleDescription(DESCRIPTION);
    expect(within(dialogo).getByRole('heading', { name: 'Vista previa' })).toBeInTheDocument();
    const cerrar = within(dialogo).getByRole('button', { name: 'Cerrar' });
    expect(cerrar).toHaveAttribute('data-testid', 'recipe-form-preview-close');
    expect(cerrar).toHaveClass('min-h-11', 'min-w-11');
    expect(cerrar.querySelector('svg[aria-hidden]')).not.toBeNull();
    expect(within(dialogo).queryByText('Close')).toBeNull();
  });

  it('R22: el lector va en layout panel con los pasos del estado actual del formulario', async () => {
    const user = setupUser();
    renderEdit([paragraph('Pesar'), paragraph('Mezclar'), paragraph('Envasar')]);

    const dialogo = await abrir(user);

    const lector = within(dialogo).getByTestId('step-reader');
    expect(lector).toHaveAttribute('data-layout', 'panel');
    expect(within(lector).getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 3');
    expect(within(lector).getAllByTestId(/^step-reader-progress-segment-/)).toHaveLength(3);
    expect(within(lector).getByText('Pesar')).toBeInTheDocument();

    await user.click(within(lector).getByTestId('step-reader-next'));
    expect(within(lector).getByTestId('step-reader-position')).toHaveTextContent('Paso 2 de 3');
    expect(within(lector).getByText('Mezclar')).toBeInTheDocument();
    expect(within(lector).getByTestId('step-reader-step')).toHaveAttribute(
      'data-direction',
      'advance',
    );
    esperarQueNadaSeGuardaNiNavega();
  });

  it('R25: proyecta lo escrito y no lo guardado; ni guarda ni navega', async () => {
    const user = setupUser();
    renderEdit([paragraph('Pesar')]);

    await user.click(screen.getByTestId('recipe-step-add-0'));
    const dialogo = await abrir(user);

    expect(within(dialogo).getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 2');
    esperarQueNadaSeGuardaNiNavega();
  });

  it('R25: «Cerrar» desmonta el lector, devuelve el foco a «Vista previa» y no guarda', async () => {
    const user = setupUser();
    renderEdit([paragraph('Pesar'), paragraph('Mezclar')]);

    const dialogo = await abrir(user);
    await user.click(within(dialogo).getByTestId('step-reader-next'));
    await user.click(within(dialogo).getByRole('button', { name: 'Cerrar' }));

    await waitFor(() => expect(screen.queryByTestId('recipe-form-preview')).toBeNull());
    expect(screen.queryByTestId('step-reader')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('recipe-form-preview-open')).toHaveFocus());

    const otraVez = await abrir(user);
    expect(within(otraVez).getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 2');
    esperarQueNadaSeGuardaNiNavega();
  });

  it('R23: por debajo de 768 px ocupa la pantalla visible entera, sin margen ni radio', async () => {
    const user = setupUser();
    renderEdit([paragraph('Pesar')]);

    const dialogo = await abrir(user);

    expect(dialogo).toHaveClass(
      'top-0',
      'left-0',
      'h-dvh',
      'max-h-dvh',
      'w-full',
      'max-w-none',
      'sm:max-w-none',
      'translate-x-0',
      'translate-y-0',
      'rounded-none',
      'p-0',
      'flex',
      'flex-col',
      'overflow-hidden',
    );
    expect(dialogo.className).not.toMatch(/85dvh|100vh/);
  });

  it('R23: desde 768 px se centra con hasta 920 × 900 y sin pasar de la ventana menos 64 px', async () => {
    const user = setupUser();
    renderEdit([paragraph('Pesar')]);

    const dialogo = await abrir(user);

    expect(dialogo).toHaveClass(
      'md:top-1/2',
      'md:left-1/2',
      'md:-translate-x-1/2',
      'md:-translate-y-1/2',
      'md:w-[min(920px,calc(100vw-48px))]',
      'md:h-[min(900px,calc(100dvh-64px))]',
      'md:rounded-xl',
    );
  });

  it('R23: el pie del lector respeta el margen inferior seguro y sus botones miden 44 px', async () => {
    const user = setupUser();
    renderEdit([paragraph('Pesar'), paragraph('Mezclar')]);

    const dialogo = await abrir(user);

    const pie = within(dialogo).getByTestId('step-reader-actions');
    expect(pie).toHaveClass('pb-[calc(14px+env(safe-area-inset-bottom))]');
    expect(within(pie).getByTestId('step-reader-previous')).toHaveClass('min-h-11');
    expect(within(pie).getByTestId('step-reader-next')).toHaveClass('min-h-11');
  });
});
