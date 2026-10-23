// QC-203 R21, R22, R23, R27: la unidad de la materia prima nueva en la revision de formula.
// Se sugiere desde la unidad leida del PDF; sin sugerencia queda vacia con su ayuda; sin unidad
// no se confirma; y el resumen lista cada creada con su unidad.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  PRESENTATION_UNIT_ERROR_TESTID,
  PRESENTATION_UNIT_HINT_TESTID,
  PRESENTATION_UNIT_PLACEHOLDER,
  PRESENTATION_UNIT_SELECT_TESTID,
} from '@/components/shared/presentation-unit-select';
import type { FormulaImportPreview, FormulaImportPreviewIngredient } from '@/lib/modules/documentos';
import type {
  ConfirmFormulaImportResult,
  PreviewFormulaImportResult,
} from '@/lib/modules/documentos/adapters/driving/formula-import-actions';
import type { UnitRef } from '@/lib/modules/unidades';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';

const { previewFormulaImportActionMock, confirmFormulaImportActionMock } = vi.hoisted(() => ({
  previewFormulaImportActionMock: vi.fn<(input: unknown) => Promise<PreviewFormulaImportResult>>(),
  confirmFormulaImportActionMock: vi.fn<(input: unknown) => Promise<ConfirmFormulaImportResult>>(),
}));

vi.mock('@/lib/modules/documentos/adapters/driving/formula-import-actions', () => ({
  previewFormulaImportAction: previewFormulaImportActionMock,
  confirmFormulaImportAction: confirmFormulaImportActionMock,
}));

// Importado DESPUES del mock de sus Server Actions.
const { FormulaImportReview } = await import(
  '@/app/(private)/produccion/formulas/importar/[documentoId]/components'
);

beforeAll(() => {
  // ProseMirror (el editor de pasos) llama a geometria que jsdom no implementa: mismo stub que
  // `formula-import-review.test.tsx`.
  if (typeof Range.prototype.getClientRects !== 'function') {
    Range.prototype.getClientRects = () => {
      const rects: DOMRect[] = [];
      return Object.assign(rects, { item: (index: number) => rects[index] ?? null }) as unknown as DOMRectList;
    };
  }
  if (typeof Range.prototype.getBoundingClientRect !== 'function') {
    Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
  }
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const DOCUMENT_FILE_ID = 'ARCHIVO-ID-NO-VISIBLE';

const KG: UnitRef = { id: '11111111-1111-4111-8111-111111111111', name: 'Kilogramo', symbol: 'kg', baseUnitId: null, factor: null };
const LITRO: UnitRef = { id: '22222222-2222-4222-8222-222222222222', name: 'Litro', symbol: 'l', baseUnitId: null, factor: null };
// Dos unidades con el MISMO simbolo: una lectura «cda» coincide con las dos.
const CUCHARADA: UnitRef = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Cucharada',
  symbol: 'cda',
  baseUnitId: null,
  factor: null,
};
const CUCHARADA_DE_POSTRE: UnitRef = {
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Cucharada de postre',
  symbol: 'cda',
  baseUnitId: null,
  factor: null,
};
const UNITS: readonly UnitRef[] = [KG, LITRO, CUCHARADA, CUCHARADA_DE_POSTRE];

const INITIAL_PRODUCT_PAGE = { items: [], totalPages: 1 };

/** Un ingrediente sin coincidencia de producto: la fila arranca en «Crear materia prima». */
function nuevo(readName: string, unitRead: string | null, percentage = '100.00'): FormulaImportPreviewIngredient {
  return {
    readName,
    percentage,
    percentageRead: percentage,
    quantityRead: null,
    unitRead,
    match: { kind: 'none' },
  };
}

function renderReview(ingredients: readonly FormulaImportPreviewIngredient[]) {
  const preview: FormulaImportPreview = {
    name: 'Desengrasante alcalino',
    description: null,
    ingredients,
    steps: [],
    packingSteps: [],
    nameClash: null,
  };
  return render(
    <FormulaImportReview
      documentFileId={DOCUMENT_FILE_ID}
      units={UNITS}
      initialProductPage={INITIAL_PRODUCT_PAGE}
      preview={preview}
    />,
  );
}

function unidadDeFila(index: number) {
  return within(screen.getByTestId(`formula-import-row-new-unit-${index}`));
}

describe('la unidad se sugiere desde el PDF (R21)', () => {
  it('R21 con «kg» leído preselecciona kg y dice que se sugirió del PDF', () => {
    renderReview([nuevo('Tensoactivo LESS 70 %', 'kg')]);

    const fila = unidadDeFila(0);
    expect(fila.getByTestId(PRESENTATION_UNIT_SELECT_TESTID)).toHaveTextContent('kg');
    expect(fila.getByTestId(PRESENTATION_UNIT_HINT_TESTID)).toHaveTextContent('Sugerida del PDF: «kg».');
    expect(fila.queryByTestId(PRESENTATION_UNIT_ERROR_TESTID)).toBeNull();
  });
});

describe('sin sugerencia la unidad queda vacia con su ayuda (R22)', () => {
  it('R22 con «gotas» queda vacía con su ayuda', () => {
    renderReview([nuevo('Colorante amarillo', 'gotas')]);

    const fila = unidadDeFila(0);
    expect(fila.getByTestId(PRESENTATION_UNIT_SELECT_TESTID)).toHaveTextContent(PRESENTATION_UNIT_PLACEHOLDER);
    expect(fila.getByTestId(PRESENTATION_UNIT_HINT_TESTID)).toHaveTextContent(
      'El PDF dice «gotas»: no coincide con ninguna unidad. Elige una.',
    );
  });

  it('R22 sin unidad en el PDF queda vacía con su ayuda', () => {
    renderReview([nuevo('Perfume floral', null)]);

    const fila = unidadDeFila(0);
    expect(fila.getByTestId(PRESENTATION_UNIT_SELECT_TESTID)).toHaveTextContent(PRESENTATION_UNIT_PLACEHOLDER);
    expect(fila.getByTestId(PRESENTATION_UNIT_HINT_TESTID)).toHaveTextContent('El PDF no trae unidad. Elige una.');
  });

  it('R22 con dos coincidencias queda vacía con su ayuda', () => {
    renderReview([nuevo('Espesante', 'CDA')]);

    const fila = unidadDeFila(0);
    expect(fila.getByTestId(PRESENTATION_UNIT_SELECT_TESTID)).toHaveTextContent(PRESENTATION_UNIT_PLACEHOLDER);
    expect(fila.getByTestId(PRESENTATION_UNIT_HINT_TESTID)).toHaveTextContent(
      'El PDF dice «CDA»: coincide con más de una unidad. Elige una.',
    );
  });

  it('R22 al elegir a mano dice Elegida por ti', async () => {
    const user = setupUser();
    renderReview([nuevo('Colorante amarillo', 'gotas')]);

    await user.click(unidadDeFila(0).getByTestId(PRESENTATION_UNIT_SELECT_TESTID));
    await user.click(await esperarInteractiva(await screen.findByRole('option', { name: 'l' })));

    const fila = unidadDeFila(0);
    expect(fila.getByTestId(PRESENTATION_UNIT_SELECT_TESTID)).toHaveTextContent('l');
    expect(fila.getByTestId(PRESENTATION_UNIT_HINT_TESTID)).toHaveTextContent('Elegida por ti.');
  });
});

describe('sin unidad no se confirma (R23)', () => {
  it('R23 Confirmar con una vacía marca el error en esa fila y no llama a la action', async () => {
    const user = setupUser();
    renderReview([nuevo('Tensoactivo LESS 70 %', 'kg', '50.00'), nuevo('Colorante amarillo', 'gotas', '50.00')]);

    // Antes de pulsar, ninguna fila muestra el error.
    expect(screen.queryByTestId(PRESENTATION_UNIT_ERROR_TESTID)).toBeNull();

    await user.click(screen.getByTestId('formula-import-confirm'));

    expect(confirmFormulaImportActionMock).not.toHaveBeenCalled();

    // La fila con unidad sigue con su ayuda y sin error.
    expect(unidadDeFila(0).queryByTestId(PRESENTATION_UNIT_ERROR_TESTID)).toBeNull();
    expect(unidadDeFila(0).getByTestId(PRESENTATION_UNIT_HINT_TESTID)).toHaveTextContent('Sugerida del PDF');

    // La vacia marca el error en su campo, que queda invalido, y en los motivos de su fila.
    const vacia = unidadDeFila(1);
    expect(vacia.getByTestId(PRESENTATION_UNIT_ERROR_TESTID)).toHaveTextContent(
      'Elige la unidad de la materia prima.',
    );
    expect(vacia.getByTestId(PRESENTATION_UNIT_SELECT_TESTID)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('formula-import-row-problems-1')).toHaveTextContent('sin unidad');
    expect(screen.queryByTestId('formula-import-row-problems-0')).toBeNull();
    expect(screen.getByTestId('formula-import-reasons')).toHaveTextContent('Fila 2: sin unidad.');

    // Al elegirla, el error se va y ya se puede confirmar con la unidad elegida.
    confirmFormulaImportActionMock.mockReturnValue(new Promise<ConfirmFormulaImportResult>(() => {}));
    await user.click(vacia.getByTestId(PRESENTATION_UNIT_SELECT_TESTID));
    await user.click(await esperarInteractiva(await screen.findByRole('option', { name: 'l' })));
    expect(unidadDeFila(1).queryByTestId(PRESENTATION_UNIT_ERROR_TESTID)).toBeNull();

    await user.click(screen.getByTestId('formula-import-confirm'));
    expect(confirmFormulaImportActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          { kind: 'new', newProductName: 'Tensoactivo LESS 70 %', unitId: KG.id, percentage: '50.00' },
          { kind: 'new', newProductName: 'Colorante amarillo', unitId: LITRO.id, percentage: '50.00' },
        ],
      }),
    );
  });
});

describe('el resumen lista las materias primas (R27)', () => {
  it('R27 el resumen lista las creadas con su unidad', async () => {
    const user = setupUser();
    confirmFormulaImportActionMock.mockResolvedValue({
      status: 'success',
      data: {
        recipeId: 'receta-nueva-id',
        outcome: 'created',
        rawMaterialsCreated: 2,
        rawMaterialsReused: 1,
        created: [
          { name: 'Tensoactivo LESS 70 %', unitId: KG.id },
          { name: 'Colorante amarillo', unitId: LITRO.id },
        ],
        reused: [{ name: 'Agua desmineralizada' }],
      },
    });
    renderReview([nuevo('Tensoactivo LESS 70 %', 'kg')]);

    await user.click(screen.getByTestId('formula-import-confirm'));

    await waitFor(() => expect(screen.getByTestId('formula-import-summary')).toBeInTheDocument());
    expect(screen.getByTestId('formula-import-summary-raw-materials-created')).toHaveTextContent('2');
    expect(screen.getByTestId('formula-import-summary-created-list')).toHaveTextContent(
      'Tensoactivo LESS 70 % · kg, Colorante amarillo · l',
    );
    expect(screen.getByTestId('formula-import-summary-raw-materials-reused')).toHaveTextContent('1');
    expect(screen.getByTestId('formula-import-summary-reused-list')).toHaveTextContent('Agua desmineralizada');
  });

  it('R27 sin creadas ni reutilizadas el resumen pinta una raya', async () => {
    const user = setupUser();
    confirmFormulaImportActionMock.mockResolvedValue({
      status: 'success',
      data: {
        recipeId: 'receta-nueva-id',
        outcome: 'created',
        rawMaterialsCreated: 0,
        rawMaterialsReused: 0,
        created: [],
        reused: [],
      },
    });
    renderReview([nuevo('Tensoactivo LESS 70 %', 'kg')]);

    await user.click(screen.getByTestId('formula-import-confirm'));

    await waitFor(() => expect(screen.getByTestId('formula-import-summary')).toBeInTheDocument());
    expect(screen.getByTestId('formula-import-summary-created-list')).toHaveTextContent('—');
    expect(screen.getByTestId('formula-import-summary-reused-list')).toHaveTextContent('—');
  });
});
