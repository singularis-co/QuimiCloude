import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  RecipeVersionForm,
  type RecipeVersionFormProps,
} from '@/app/(private)/produccion/formulas/components';
import type { RecipeDetail, RecipeLineView, RecipeStepView } from '@/lib/modules/recetas';

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('@/lib/modules/recetas/adapters/driving/recipe-actions', () => ({
  createRecipeVersionAction: vi.fn(),
  updateRecipeVersionAction: vi.fn(),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/product-actions', () => ({
  listProductsAction: vi.fn(),
}));

afterEach(cleanup);

const ORIGINAL_ID = '11111111-1111-4111-8111-111111111111';
const VERSION_ID = '22222222-2222-4222-8222-222222222222';
const PRODUCT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPTY_PAGE = { items: [], totalPages: 1 };

const LINES: readonly RecipeLineView[] = [
  {
    id: 'l-a',
    productId: PRODUCT_A,
    productName: 'Agua',
    percentage: '100.00',
    productUnitId: null,
    productStock: null,
  },
];

function paragraph(text: string, requiresEvidence?: true): RecipeStepView {
  const step: RecipeStepView = { blocks: [{ kind: 'paragraph', spans: [{ text }] }] };
  return requiresEvidence === undefined ? step : { ...step, requiresEvidence };
}

function versionDetail(overrides: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    id: VERSION_ID,
    name: 'Sin sal',
    description: null,
    imageUrl: null,
    stepCount: 2,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-02T00:00:00Z'),
    createdBy: null,
    updatedBy: null,
    steps: [paragraph('Pesar'), paragraph('Mezclar', true)],
    packingSteps: [paragraph('Etiquetar', true), paragraph('Sellar')],
    lines: LINES,
    tools: [],
    original: { id: ORIGINAL_ID, name: 'Jabón' },
    isUnderReview: false,
    displayName: 'Jabón · Sin sal',
    ...overrides,
  };
}

function renderEdit(version: RecipeDetail) {
  const props: RecipeVersionFormProps = {
    mode: 'edit',
    original: { id: ORIGINAL_ID, name: 'Jabón', lines: LINES, tools: [] },
    version,
    units: [],
    initialProductPage: EMPTY_PAGE,
    initialMachinePage: EMPTY_PAGE,
  };
  return render(<RecipeVersionForm {...props} />);
}

describe('QC-214 R6 — la versión enseña la marca heredada de su original', () => {
  it('R6: marca «Requiere evidencia» solo en los pasos heredados que la tienen, en las dos listas', () => {
    renderEdit(versionDetail());

    expect(screen.queryByTestId('recipe-version-step-0-evidence')).toBeNull();
    expect(screen.getByTestId('recipe-version-step-1-evidence')).toHaveTextContent(
      'Requiere evidencia',
    );
    expect(screen.getByTestId('recipe-version-packing-step-0-evidence')).toHaveTextContent(
      'Requiere evidencia',
    );
    expect(screen.queryByTestId('recipe-version-packing-step-1-evidence')).toBeNull();
  });

  it('R6: la marca va en la lectura inerte y la versión no ofrece ningún interruptor para cambiarla', () => {
    renderEdit(versionDetail());

    const inherited = screen.getByTestId('recipe-version-inherited-steps');
    expect(inherited).toHaveAttribute('inert');
    expect(within(inherited).getByTestId('recipe-version-step-1-evidence')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('recipe-version-inherited-packing-steps')).getByTestId(
        'recipe-version-packing-step-0-evidence',
      ),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole('switch', { hidden: true })).toHaveLength(0);
  });

  it('R6: sin ningún paso marcado, no sale ninguna marca', () => {
    renderEdit(
      versionDetail({ steps: [paragraph('Pesar')], packingSteps: [paragraph('Etiquetar')] }),
    );

    expect(screen.queryByText('Requiere evidencia')).toBeNull();
  });
});
