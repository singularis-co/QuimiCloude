import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecipeForm } from '@/app/(private)/produccion/formulas/components';
import type { RecipeDetail, RecipeStepView } from '@/lib/modules/recetas';
import type {
  CreateRecipeFormState,
  UpdateRecipeFormState,
} from '@/lib/modules/recetas/adapters/driving/recipe-actions';

import { setupUser } from '../../helpers/user-event';

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

// El barrel de formulas arrastra la subida de PDF, que carga `observabilidad`.
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

function paragraph(text: string): RecipeStepView {
  return { blocks: [{ kind: 'paragraph', spans: [{ text }] }] };
}

function recipeDetail(overrides: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    id: RECIPE_ID,
    name: 'Detergente industrial',
    description: null,
    imageUrl: null,
    stepCount: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    createdBy: null,
    updatedBy: null,
    steps: [paragraph('Mezclar')],
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
    ...overrides,
  };
}

function renderEdit(recipe: RecipeDetail, lockingOrders?: number) {
  return render(
    <RecipeForm
      mode="edit"
      recipe={recipe}
      versions={[]}
      lockingOrders={lockingOrders}
      units={[]}
      initialProductPage={EMPTY_PAGE}
      initialMachinePage={EMPTY_PAGE}
    />,
  );
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

const LOCK_BODY =
  'Mientras sigan en curso no puedes mover ni quitar pasos. Sí puedes cambiar el texto, encender o apagar «Requiere evidencia» y añadir pasos al final.';

function withEvidence(step: RecipeStepView): RecipeStepView {
  return { ...step, requiresEvidence: true };
}

function evidenceSwitch(field: HTMLElement, position: number): HTMLElement {
  const section =
    field.getAttribute('data-testid') === 'recipe-packing-steps-field' ? 'Envasado' : 'Pasos de producción';
  return within(field).getByRole('switch', {
    name: `Requiere evidencia en el paso ${position} de ${section}`,
  });
}

/** Pegado real en el editor: así cambia el texto del paso como lo haría quien escribe. */
function paste(target: Element, text: string): void {
  const clipboardData = {
    types: ['text/plain'],
    getData: () => text,
    files: [] as unknown as FileList,
  };
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });
  target.dispatchEvent(event);
}

type SentPayload = { readonly steps: RecipeStepView[]; readonly packingSteps: RecipeStepView[] };

const LOCKED_RECIPE = recipeDetail({
  steps: [paragraph('Pesar'), withEvidence(paragraph('Mezclar'))],
  packingSteps: [paragraph('Etiquetar'), paragraph('Sellar')],
});

describe('QC-214 — el switch en el formulario de fórmula', () => {
  it('R1, R5: las dos listas tienen un interruptor por paso y su resumen', () => {
    renderEdit(LOCKED_RECIPE);

    const operator = screen.getByTestId('recipe-steps-field');
    const packing = screen.getByTestId('recipe-packing-steps-field');
    expect(within(operator).getAllByRole('switch')).toHaveLength(2);
    expect(within(packing).getAllByRole('switch')).toHaveLength(2);
    expect(screen.getByTestId('recipe-step-evidence-summary')).toHaveTextContent(
      '1 paso pide evidencia',
    );
    expect(screen.getByTestId('recipe-packing-step-evidence-summary')).toHaveTextContent(
      'Ningún paso pide evidencia',
    );
  });

  it('R1, R2: lo que se guarda lleva la marca solo en los pasos encendidos, y escribir no la apaga', async () => {
    const user = setupUser();
    renderEdit(recipeDetail({ steps: [paragraph('Pesar')], packingSteps: [paragraph('Etiquetar')] }));
    const packing = screen.getByTestId('recipe-packing-steps-field');

    await user.click(evidenceSwitch(packing, 1));
    const editable = await screen.findByTestId('recipe-packing-step-text-0');
    editable.focus();
    paste(editable, ' y rotular');
    await waitFor(() => expect(editable).toHaveTextContent('rotular'));
    expect(evidenceSwitch(packing, 1)).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByTestId('recipe-form-submit'));
    await waitFor(() => expect(updateRecipeActionMock).toHaveBeenCalledTimes(1));
    const [, payload] = updateRecipeActionMock.mock.calls[0] as [string, SentPayload];
    expect(payload.steps[0]).not.toHaveProperty('requiresEvidence');
    expect(payload.packingSteps[0]).toMatchObject({ requiresEvidence: true });
  });
});

describe('QC-214 R8 — bloqueo de mover y quitar con pedidos en curso con fotos', () => {
  it('R8: sin pedidos que bloqueen no hay aviso y mover y quitar están activos', () => {
    renderEdit(LOCKED_RECIPE, 0);

    expect(screen.queryByTestId('recipe-form-steps-locked')).toBeNull();
    expect(screen.getByTestId('recipe-step-handle-0')).toBeEnabled();
    expect(screen.getByTestId('recipe-step-remove-0')).toBeEnabled();
    expect(screen.getByTestId('recipe-packing-step-remove-1')).toBeEnabled();
  });

  it('R8: con varios pedidos, el aviso da el número y el texto del tablero', () => {
    renderEdit(LOCKED_RECIPE, 2);

    const notice = screen.getByTestId('recipe-form-steps-locked');
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveTextContent('2 pedidos en curso ya tienen fotos de evidencia');
    expect(notice).toHaveTextContent(LOCK_BODY);
  });

  it('R8: con un pedido, el aviso va en singular', () => {
    renderEdit(LOCKED_RECIPE, 1);

    expect(screen.getByTestId('recipe-form-steps-locked')).toHaveTextContent(
      '1 pedido en curso ya tiene fotos de evidencia',
    );
  });

  it('R8: mover y quitar quedan deshabilitados en las dos listas', () => {
    renderEdit(LOCKED_RECIPE, 2);

    for (const prefix of ['recipe-step', 'recipe-packing-step']) {
      for (const index of [0, 1]) {
        expect(screen.getByTestId(`${prefix}-handle-${index}`)).toBeDisabled();
        expect(screen.getByTestId(`${prefix}-remove-${index}`)).toBeDisabled();
      }
    }
  });

  it('R8: el texto, el interruptor y el «+» del último paso siguen activos; el de los demás no', async () => {
    const user = setupUser();
    renderEdit(LOCKED_RECIPE, 2);
    const operator = screen.getByTestId('recipe-steps-field');
    const packing = screen.getByTestId('recipe-packing-steps-field');

    const editable = await screen.findByTestId('recipe-step-text-0');
    expect(editable).toHaveAttribute('contenteditable', 'true');
    editable.focus();
    paste(editable, ' en frío');
    await waitFor(() => expect(editable).toHaveTextContent('en frío'));

    await user.click(evidenceSwitch(operator, 2));
    expect(evidenceSwitch(operator, 2)).toHaveAttribute('aria-checked', 'false');
    await user.click(evidenceSwitch(packing, 1));
    expect(evidenceSwitch(packing, 1)).toHaveAttribute('aria-checked', 'true');

    // Insertar en medio movería los pasos siguientes: bloqueado solo se añade al final.
    expect(screen.getByTestId('recipe-step-add-0')).toBeDisabled();
    expect(screen.getByTestId('recipe-packing-step-add-0')).toBeDisabled();
    await user.click(screen.getByTestId('recipe-step-add-1'));
    await user.click(screen.getByTestId('recipe-packing-step-add-1'));
    expect(within(operator).getAllByTestId('recipe-step-row')).toHaveLength(3);
    expect(within(packing).getAllByTestId('recipe-packing-step-row')).toHaveLength(3);
  });

  it('R8: si el servidor rechaza con recipe_steps_locked, el formulario muestra su mensaje', async () => {
    const user = setupUser();
    updateRecipeActionMock.mockResolvedValue({
      status: 'error',
      code: 'recipe_steps_locked',
      message:
        'Hay pedidos en curso con fotos de evidencia: mientras sigan en curso no puedes mover ni quitar pasos.',
    });
    renderEdit(LOCKED_RECIPE, 0);

    await user.click(screen.getByTestId('recipe-form-submit'));

    expect(await screen.findByTestId('recipe-form-error-message')).toHaveTextContent(
      'Hay pedidos en curso con fotos de evidencia',
    );
    expect(screen.getByTestId('recipe-form-error-code')).toHaveTextContent('recipe_steps_locked');
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});
