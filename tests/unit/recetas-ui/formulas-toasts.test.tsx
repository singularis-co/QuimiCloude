import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorInesperado } from '../../helpers/identificador-de-request';
import { esperarInteractiva, setupUser } from '../../helpers/user-event';

import { RecipeForm, RecipeVersionForm } from '@/app/(private)/produccion/formulas/components';
import { DeleteRecipeDialog } from '@/app/(private)/produccion/formulas/components/delete-recipe-dialog';
import type { RecipeDetail, RecipeLineView, RecipeVersionSummary } from '@/lib/modules/recetas';
import type {
  CreateRecipeFormState,
  CreateRecipeVersionFormState,
  DeleteRecipeFormState,
  RecipeVersionListResult,
  UpdateRecipeFormState,
  UpdateRecipeVersionFormState,
} from '@/lib/modules/recetas/adapters/driving/recipe-actions';

/**
 * Toasts de la ruta de fórmulas (QC-264 R46, D11). Sin cambio de producción: este test fija que
 * cada uno de los seis éxitos -y la edición que deja alguna versión por revisar- lanza
 * exactamente UN `toast.success` con su texto, y que ningún error lanza toast alguno. `sonner`
 * está simulado entero: aquí no se pinta nada, solo se cuenta qué se pidió.
 */

const {
  toastMock,
  routerMock,
  createRecipeActionMock,
  updateRecipeActionMock,
  deleteRecipeActionMock,
  listRecipeVersionsActionMock,
  createVersionMock,
  updateVersionMock,
  listProductsActionMock,
} = vi.hoisted(() => ({
  toastMock: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
    loading: vi.fn(),
    promise: vi.fn(),
    dismiss: vi.fn(),
  }),
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
  deleteRecipeActionMock: vi.fn<(id: string) => Promise<DeleteRecipeFormState>>(),
  listRecipeVersionsActionMock: vi.fn<(originalId: string) => Promise<RecipeVersionListResult>>(),
  createVersionMock:
    vi.fn<(originalId: string, input: unknown) => Promise<CreateRecipeVersionFormState>>(),
  updateVersionMock:
    vi.fn<(versionId: string, input: unknown) => Promise<UpdateRecipeVersionFormState>>(),
  listProductsActionMock: vi.fn(),
}));

vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast: toastMock,
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/recetas/adapters/driving/recipe-actions', () => ({
  createRecipeAction: createRecipeActionMock,
  updateRecipeAction: updateRecipeActionMock,
  deleteRecipeAction: deleteRecipeActionMock,
  listRecipeVersionsAction: listRecipeVersionsActionMock,
  getRecipeStepLockAction: vi.fn(async () => ({ status: 'success' as const, data: { lockingOrders: 0 } })),
  createRecipeVersionAction: createVersionMock,
  updateRecipeVersionAction: updateVersionMock,
}));

vi.mock('@/lib/modules/inventario/adapters/driving/product-actions', () => ({
  listProductsAction: listProductsActionMock,
}));

vi.setConfig({ testTimeout: 30_000 });

const RECIPE_ID = '11111111-1111-4111-8111-111111111111';
const VERSION_ID = '22222222-2222-4222-8222-222222222222';
const PRODUCT_ID = '33333333-3333-4333-8333-333333333333';
const PRODUCT_NAME = 'Agua';
const V1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const V2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const EMPTY_PAGE = { items: [], totalPages: 1 };
const PRODUCT_PAGE = { items: [{ id: PRODUCT_ID, name: PRODUCT_NAME, unitId: null }], totalPages: 1 };

function lineView(id: string, percentage: string): RecipeLineView {
  return {
    id,
    productId: PRODUCT_ID,
    productName: PRODUCT_NAME,
    percentage,
    productUnitId: null,
    productStock: null,
  };
}

function recipeDetail(overrides: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    id: RECIPE_ID,
    name: 'Jabón',
    description: null,
    imageUrl: null,
    stepCount: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    createdBy: null,
    updatedBy: null,
    steps: [],
    packingSteps: [],
    conditioningSteps: [],
    lines: [lineView('line-1', '100.00')],
    tools: [],
    original: null,
    isUnderReview: false,
    displayName: 'Jabón',
    ...overrides,
  };
}

function versionSummary(id: string, name: string): RecipeVersionSummary {
  return {
    id,
    name,
    displayName: `Jabón · ${name}`,
    isUnderReview: false,
    updatedAt: new Date('2026-01-03T00:00:00.000Z'),
  };
}

const ORIGINAL = { id: RECIPE_ID, name: 'Jabón', lines: [lineView('line-1', '100.00')], tools: [] };

function renderCreateRecipe() {
  return render(
    <RecipeForm
      mode="create"
      units={[]}
      initialProductPage={PRODUCT_PAGE}
      initialMachinePage={EMPTY_PAGE}
    />,
  );
}

function renderEditRecipe(versions: readonly RecipeVersionSummary[] = []) {
  return render(
    <RecipeForm
      mode="edit"
      recipe={recipeDetail()}
      versions={versions}
      units={[]}
      initialProductPage={EMPTY_PAGE}
      initialMachinePage={EMPTY_PAGE}
    />,
  );
}

function renderCreateVersion() {
  return render(
    <RecipeVersionForm
      mode="create"
      original={ORIGINAL}
      units={[]}
      initialProductPage={EMPTY_PAGE}
      initialMachinePage={EMPTY_PAGE}
    />,
  );
}

function renderEditVersion() {
  return render(
    <RecipeVersionForm
      mode="edit"
      original={ORIGINAL}
      version={recipeDetail({
        id: VERSION_ID,
        name: 'Sin sal',
        original: { id: RECIPE_ID, name: 'Jabón' },
        displayName: 'Jabón · Sin sal',
      })}
      units={[]}
      initialProductPage={EMPTY_PAGE}
      initialMachinePage={EMPTY_PAGE}
    />,
  );
}

async function fillNewRecipe(user: ReturnType<typeof setupUser>) {
  await user.type(screen.getByTestId('recipe-field-name'), 'Receta nueva');
  await user.click(screen.getByTestId('recipe-line-product-0'));
  await user.click(await esperarInteractiva(await screen.findByRole('option', { name: PRODUCT_NAME })));
  await user.type(screen.getByTestId('recipe-line-percentage-0'), '100');
}

async function confirmDelete(user: ReturnType<typeof setupUser>) {
  await user.click(screen.getByTestId('recipe-delete-open'));
  await screen.findByTestId('delete-recipe-dialog');
  await waitFor(() => expect(screen.getByTestId('delete-recipe-confirm')).toBeEnabled());
  await user.click(screen.getByTestId('delete-recipe-confirm'));
}

/** Exactamente un toast, de éxito y con ese texto; ningún otro tipo de toast. */
function expectOnlySuccessToast(text: string) {
  expect(toastMock.success).toHaveBeenCalledTimes(1);
  expect(toastMock.success).toHaveBeenCalledWith(text);
  expectNoOtherToast();
}

function expectNoOtherToast() {
  expect(toastMock).not.toHaveBeenCalled();
  for (const kind of ['error', 'warning', 'info', 'message', 'loading', 'promise'] as const) {
    expect(toastMock[kind]).not.toHaveBeenCalled();
  }
}

function expectNoToast() {
  expect(toastMock.success).not.toHaveBeenCalled();
  expectNoOtherToast();
}

beforeEach(() => {
  vi.clearAllMocks();
  createRecipeActionMock.mockResolvedValue({ status: 'success', id: RECIPE_ID });
  updateRecipeActionMock.mockResolvedValue({ status: 'success', propagated: [] });
  deleteRecipeActionMock.mockResolvedValue({ status: 'success' });
  listRecipeVersionsActionMock.mockResolvedValue({ status: 'success', data: [] });
  createVersionMock.mockResolvedValue({ status: 'success', id: VERSION_ID });
  updateVersionMock.mockResolvedValue({ status: 'success' });
  listProductsActionMock.mockResolvedValue({
    status: 'success',
    data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 },
  });
});

afterEach(() => {
  cleanup();
});

describe('R46 — un único toast de éxito por cada guardado o borrado que termina bien', () => {
  it('R46: guardar una receta nueva avisa «Receta creada.»', async () => {
    const user = setupUser();
    renderCreateRecipe();
    await fillNewRecipe(user);

    await user.click(screen.getByTestId('recipe-form-submit'));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledTimes(1));
    expect(createRecipeActionMock).toHaveBeenCalledTimes(1);
    expectOnlySuccessToast('Receta creada.');
  });

  it('R46: guardar una receta editada avisa «Receta actualizada.»', async () => {
    const user = setupUser();
    renderEditRecipe();

    await user.click(screen.getByTestId('recipe-form-submit'));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledTimes(1));
    expect(updateRecipeActionMock).toHaveBeenCalledTimes(1);
    expectOnlySuccessToast('Receta actualizada.');
  });

  it('R46: guardar una receta editada que deja una versión por revisar avisa «Receta actualizada.» una sola vez', async () => {
    const user = setupUser();
    updateRecipeActionMock.mockResolvedValue({
      status: 'success',
      propagated: [
        { versionId: V1, isUnderReview: false },
        { versionId: V2, isUnderReview: true },
      ],
    });
    renderEditRecipe([versionSummary(V1, 'Copia'), versionSummary(V2, 'Ligera')]);

    await user.click(screen.getByTestId('recipe-form-submit'));
    await screen.findByTestId('propagate-versions-dialog');
    await user.click(screen.getByTestId('propagate-versions-confirm'));

    await screen.findByTestId('recipe-form-under-review');
    expect(routerMock.push).not.toHaveBeenCalled();
    expectOnlySuccessToast('Receta actualizada.');
  });

  it('R46: borrar una receta avisa «Receta borrada.»', async () => {
    const user = setupUser();
    render(<DeleteRecipeDialog recipe={{ id: RECIPE_ID, name: 'Jabón' }} />);

    await confirmDelete(user);

    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));
    expect(deleteRecipeActionMock).toHaveBeenCalledTimes(1);
    expectOnlySuccessToast('Receta borrada.');
  });

  it('R46: crear una versión avisa «Versión creada.»', async () => {
    const user = setupUser();
    renderCreateVersion();
    await user.type(screen.getByTestId('recipe-version-field-name'), 'Sin sal');

    await user.click(screen.getByTestId('recipe-version-form-submit'));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledTimes(1));
    expect(createVersionMock).toHaveBeenCalledTimes(1);
    expectOnlySuccessToast('Versión creada.');
  });

  it('R46: editar una versión avisa «Versión actualizada.»', async () => {
    const user = setupUser();
    renderEditVersion();

    await user.click(screen.getByTestId('recipe-version-form-submit'));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledTimes(1));
    expect(updateVersionMock).toHaveBeenCalledTimes(1);
    expectOnlySuccessToast('Versión actualizada.');
  });

  it('R46: borrar una versión avisa «Versión borrada.»', async () => {
    const user = setupUser();
    render(<DeleteRecipeDialog recipe={{ id: VERSION_ID, name: 'Sin sal' }} kind="version" />);

    await confirmDelete(user);

    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));
    expect(deleteRecipeActionMock).toHaveBeenCalledTimes(1);
    expectOnlySuccessToast('Versión borrada.');
  });
});

describe('R46 — un error no lanza ningún toast', () => {
  it('R46: si falla guardar una receta nueva no hay toast', async () => {
    const user = setupUser();
    createRecipeActionMock.mockResolvedValue(errorInesperado());
    renderCreateRecipe();
    await fillNewRecipe(user);

    await user.click(screen.getByTestId('recipe-form-submit'));

    await screen.findByTestId('recipe-form-error');
    expect(createRecipeActionMock).toHaveBeenCalledTimes(1);
    expect(routerMock.push).not.toHaveBeenCalled();
    expectNoToast();
  });

  it('R46: si falla guardar una receta editada no hay toast', async () => {
    const user = setupUser();
    updateRecipeActionMock.mockResolvedValue(errorInesperado());
    renderEditRecipe();

    await user.click(screen.getByTestId('recipe-form-submit'));

    await screen.findByTestId('recipe-form-error');
    expect(updateRecipeActionMock).toHaveBeenCalledTimes(1);
    expect(routerMock.push).not.toHaveBeenCalled();
    expectNoToast();
  });

  it.each([
    ['una receta', undefined],
    ['una versión', 'version' as const],
  ])('R46: si falla borrar %s no hay toast', async (_name, kind) => {
    const user = setupUser();
    deleteRecipeActionMock.mockResolvedValue(errorInesperado());
    render(<DeleteRecipeDialog recipe={{ id: RECIPE_ID, name: 'Jabón' }} kind={kind} />);

    await confirmDelete(user);

    await screen.findByTestId('delete-recipe-error');
    expect(deleteRecipeActionMock).toHaveBeenCalledTimes(1);
    expect(routerMock.refresh).not.toHaveBeenCalled();
    expectNoToast();
  });

  it('R46: si falla crear una versión no hay toast', async () => {
    const user = setupUser();
    createVersionMock.mockResolvedValue(errorInesperado());
    renderCreateVersion();
    await user.type(screen.getByTestId('recipe-version-field-name'), 'Sin sal');

    await user.click(screen.getByTestId('recipe-version-form-submit'));

    await waitFor(() => expect(createVersionMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('recipe-version-form-submit')).toBeEnabled());
    expect(routerMock.push).not.toHaveBeenCalled();
    expectNoToast();
  });

  it('R46: si falla editar una versión no hay toast', async () => {
    const user = setupUser();
    updateVersionMock.mockResolvedValue(errorInesperado());
    renderEditVersion();

    await user.click(screen.getByTestId('recipe-version-form-submit'));

    await waitFor(() => expect(updateVersionMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('recipe-version-form-submit')).toBeEnabled());
    expect(routerMock.push).not.toHaveBeenCalled();
    expectNoToast();
  });
});
