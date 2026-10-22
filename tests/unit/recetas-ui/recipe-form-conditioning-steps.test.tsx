import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecipeForm } from '@/app/(private)/produccion/formulas/components';
import type { ConditioningStepView, RecipeDetail, RecipeStepView } from '@/lib/modules/recetas';
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
const ROW_HEIGHT = 60;

const CONDITIONING_HELP =
  'Opcional. Pasos que sigue el acondicionador uno a uno al acondicionar el pedido. «Asignación requerida» le pide elegir quién del equipo hizo el paso.';

function paragraph(text: string): RecipeStepView {
  return { blocks: [{ kind: 'paragraph', spans: [{ text }] }] };
}

const EMPTY_STEP: RecipeStepView = { blocks: [{ kind: 'paragraph', spans: [] }] };

const RICH_CONDITIONING_STEP: ConditioningStepView = {
  blocks: [
    {
      kind: 'paragraph',
      spans: [{ text: 'Etiquetar', bold: true }, { text: ' con el ' }, { text: 'lote', italic: true }],
    },
    {
      kind: 'checklist',
      items: [{ spans: [{ text: 'Fecha de vencimiento' }] }, { spans: [{ text: 'Lote', bold: true }] }],
    },
  ],
  requiresEvidence: true,
  requiresAssignment: true,
};

function recipeDetail(overrides: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    id: RECIPE_ID,
    name: 'Desengrasante alcalino',
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
    displayName: 'Desengrasante alcalino',
    ...overrides,
  };
}

function renderCreate() {
  return render(
    <RecipeForm mode="create" units={[]} initialProductPage={EMPTY_PAGE} initialMachinePage={EMPTY_PAGE} />,
  );
}

function renderEdit(recipe: RecipeDetail) {
  return render(
    <RecipeForm
      mode="edit"
      recipe={recipe}
      versions={[]}
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
  createRecipeActionMock.mockResolvedValue({ status: 'success', id: RECIPE_ID });
  updateRecipeActionMock.mockResolvedValue({ status: 'success', propagated: [] });
});

afterEach(() => {
  cleanup();
});

/** dnd-kit decide arriba/abajo por rectangulos y jsdom los da vacios: cada fila mide su posicion. */
function installRowRectStub(): () => void {
  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
    const row = this.closest('li[data-testid$="-row"]');
    if (row !== null) {
      const rows = row.parentElement === null ? [row] : Array.from(row.parentElement.children);
      const top = Math.max(0, rows.indexOf(row)) * ROW_HEIGHT;
      const rect = { x: 0, y: top, top, left: 0, right: 320, bottom: top + ROW_HEIGHT, width: 320, height: ROW_HEIGHT };
      return { ...rect, toJSON: () => rect } as DOMRect;
    }
    return original.call(this);
  };
  return () => {
    Element.prototype.getBoundingClientRect = original;
  };
}

/** Pegado real: el documento que sale lo decide el esquema cerrado del editor. */
function paste(target: Element, { html, text }: { html?: string; text: string }): void {
  const clipboardData = {
    types: html === undefined ? ['text/plain'] : ['text/html', 'text/plain'],
    getData: (type: string) => (type === 'text/html' ? (html ?? '') : text),
    files: [] as unknown as FileList,
  };
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });
  target.dispatchEvent(event);
}

async function writeConditioningStep(
  index: number,
  text: string,
  { html, visible = text }: { html?: string; visible?: string } = {},
): Promise<void> {
  const editable = screen.getByTestId(`recipe-conditioning-step-text-${index}`);
  editable.focus();
  paste(editable, { html, text });
  await waitFor(() => expect(editable).toHaveTextContent(visible));
}

function plainTexts(steps: readonly RecipeStepView[]): string[] {
  return steps.map((step) =>
    step.blocks
      .map((block) =>
        block.kind === 'paragraph'
          ? block.spans.map((span) => span.text).join('')
          : block.items.map((item) => item.spans.map((span) => span.text).join('')).join(' '),
      )
      .join('\n'),
  );
}

type SentPayload = {
  readonly steps: RecipeStepView[];
  readonly packingSteps: RecipeStepView[];
  readonly conditioningSteps: ConditioningStepView[];
};

async function submitAndReadUpdate(user: UserEvent): Promise<SentPayload> {
  await user.click(screen.getByTestId('recipe-form-submit'));
  await waitFor(() => expect(updateRecipeActionMock).toHaveBeenCalledTimes(1));
  const [, payload] = updateRecipeActionMock.mock.calls[0] as [string, SentPayload];
  return payload;
}

function follows(earlier: Element, later: Element): boolean {
  return (earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

function conditioningSwitch(kind: 'evidence' | 'assignment', position: number): HTMLElement {
  const name =
    kind === 'evidence'
      ? `Requiere evidencia en el paso ${position} de Acondicionamiento`
      : `Asignación requerida en el paso ${position} de Acondicionamiento`;
  return within(screen.getByTestId('recipe-conditioning-steps-field')).getByRole('switch', { name });
}

describe('QC-299 R8 — sección «Acondicionamiento» en el formulario de fórmula', () => {
  // QC-264 (R11) sustituye los divisores por tarjetas (merge 2026-10-21): la sección va en su
  // propia tarjeta, tras la de «Envasado», como dev comprueba «Envasado» tras «Pasos».
  it('R8: el alta la muestra tras «Envasado», en su propia tarjeta, marcada «(opcional)», con su ayuda y una fila vacía', () => {
    renderCreate();

    const packing = screen.getByTestId('recipe-packing-steps-field');
    const conditioning = screen.getByTestId('recipe-conditioning-steps-field');
    const packingCard = packing.closest('[data-slot="card"]');
    const conditioningCard = conditioning.closest('[data-slot="card"]');

    expect(packingCard).not.toBeNull();
    expect(conditioningCard).not.toBeNull();
    expect(conditioningCard).not.toBe(packingCard);
    expect(follows(packingCard as Element, conditioningCard as Element)).toBe(true);
    expect(follows(conditioning, screen.getByTestId('recipe-form-submit'))).toBe(true);
    expect(packing.contains(conditioning)).toBe(false);

    expect(
      within(conditioning).getByRole('heading', { name: /^Acondicionamiento/ }),
    ).toBeInTheDocument();
    expect(within(conditioning).getByTestId('recipe-conditioning-steps-optional')).toHaveTextContent(
      '(opcional)',
    );
    expect(within(conditioning).getByTestId('recipe-conditioning-steps-description')).toHaveTextContent(
      CONDITIONING_HELP,
    );
    expect(within(conditioning).getAllByTestId('recipe-conditioning-step-row')).toHaveLength(1);
  });

  it('R8: la edición la muestra con el mismo editor y formato de filas que «Pasos» y «Envasado»', () => {
    renderEdit(recipeDetail({ conditioningSteps: [paragraph('Sellar garrafas')] }));

    const conditioning = screen.getByTestId('recipe-conditioning-steps-field');
    const toolbar = within(conditioning).getByRole('toolbar');
    expect(within(toolbar).getByRole('button', { name: 'Negrilla' })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: 'Cursiva' })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: /Lista de verificaci/ })).toBeInTheDocument();
    expect(within(conditioning).getByTestId('recipe-conditioning-step-handle-0')).toBeInTheDocument();
    expect(within(conditioning).getByTestId('recipe-conditioning-step-remove-0')).toBeInTheDocument();
    expect(within(conditioning).getByTestId('recipe-conditioning-step-add-0')).toBeInTheDocument();
  });

  it('R8: una fila vacía que el usuario no tocó no se envía, ni en el alta ni en la edición', async () => {
    const user = setupUser();
    renderEdit(recipeDetail());

    const payload = await submitAndReadUpdate(user);
    expect(payload.conditioningSteps).toEqual([]);
    expect(screen.queryByTestId('recipe-conditioning-step-field-error-0')).toBeNull();
  });

  it('R8: añadir, escribir con formato y quitar llegan al payload en orden y sin tocar las otras secciones', async () => {
    const user = setupUser();
    renderEdit(recipeDetail({ packingSteps: [paragraph('Etiquetar')] }));

    await writeConditioningStep(0, 'Descartar');
    await user.click(screen.getByTestId('recipe-conditioning-step-add-0'));
    await writeConditioningStep(1, 'Sellar y revisar Sin fugas', {
      html: '<p><strong>Sellar</strong> y <em>revisar</em></p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Sin fugas</p></li></ul>',
      visible: 'Sin fugas',
    });
    await user.click(screen.getByTestId('recipe-conditioning-step-add-1'));
    await writeConditioningStep(2, 'Contar');
    await user.click(screen.getByTestId('recipe-conditioning-step-remove-0'));

    const payload = await submitAndReadUpdate(user);
    expect(plainTexts(payload.conditioningSteps)).toEqual(['Sellar y revisar\nSin fugas', 'Contar']);
    expect(plainTexts(payload.packingSteps)).toEqual(['Etiquetar']);
    expect(plainTexts(payload.steps)).toEqual(['Mezclar']);

    const first = payload.conditioningSteps[0]?.blocks[0];
    const spans = first?.kind === 'paragraph' ? first.spans : [];
    expect(spans.find((span) => span.text === 'Sellar')?.bold).toBe(true);
    expect(spans.find((span) => span.text === 'revisar')?.italic).toBe(true);
    expect(payload.conditioningSteps[0]?.blocks[1]?.kind).toBe('checklist');
  });

  it('R8, R12: reordenar por teclado cambia el orden enviado y no el de las otras secciones', async () => {
    const uninstall = installRowRectStub();
    try {
      const user = setupUser();
      renderEdit(
        recipeDetail({
          steps: [paragraph('Pesar'), paragraph('Mezclar')],
          packingSteps: [paragraph('Etiquetar'), paragraph('Sellar')],
          conditioningSteps: [paragraph('Revisar'), paragraph('Etiquetar caja'), paragraph('Contar')],
        }),
      );

      screen.getByTestId('recipe-conditioning-step-handle-0').focus();
      await user.keyboard(' ');
      await user.keyboard('{ArrowDown}');
      await user.keyboard(' ');

      const payload = await submitAndReadUpdate(user);
      expect(plainTexts(payload.conditioningSteps)).toEqual(['Etiquetar caja', 'Revisar', 'Contar']);
      expect(plainTexts(payload.packingSteps)).toEqual(['Etiquetar', 'Sellar']);
      expect(plainTexts(payload.steps)).toEqual(['Pesar', 'Mezclar']);
    } finally {
      uninstall();
    }
  });

  it('R8, R12: reordenar por arrastre con el ratón cambia el orden enviado', async () => {
    const uninstall = installRowRectStub();
    try {
      const user = setupUser();
      renderEdit(
        recipeDetail({
          conditioningSteps: [paragraph('Revisar'), paragraph('Etiquetar caja'), paragraph('Contar')],
        }),
      );

      const handle = screen.getByTestId('recipe-conditioning-step-handle-0');
      await user.pointer([
        { keys: '[MouseLeft>]', target: handle, coords: { clientX: 10, clientY: ROW_HEIGHT / 2 } },
        { target: handle, coords: { clientX: 10, clientY: ROW_HEIGHT + 20 } },
        { target: handle, coords: { clientX: 10, clientY: ROW_HEIGHT * 2 + ROW_HEIGHT / 2 } },
        { keys: '[/MouseLeft]' },
      ]);

      const payload = await submitAndReadUpdate(user);
      expect(plainTexts(payload.conditioningSteps)).toEqual(['Etiquetar caja', 'Contar', 'Revisar']);
    } finally {
      uninstall();
    }
  });
});

describe('QC-299 R9 — switches por sección en el formulario', () => {
  it('R9: solo «Acondicionamiento» ofrece «Asignación requerida»; las tres ofrecen «Requiere evidencia»', () => {
    renderEdit(
      recipeDetail({
        steps: [paragraph('Pesar')],
        packingSteps: [paragraph('Etiquetar')],
        conditioningSteps: [paragraph('Revisar')],
      }),
    );

    const operator = screen.getByTestId('recipe-steps-field');
    const packing = screen.getByTestId('recipe-packing-steps-field');
    const conditioning = screen.getByTestId('recipe-conditioning-steps-field');

    expect(within(operator).getAllByRole('switch')).toHaveLength(1);
    expect(within(packing).getAllByRole('switch')).toHaveLength(1);
    expect(within(conditioning).getAllByRole('switch')).toHaveLength(2);
    expect(within(operator).queryByRole('switch', { name: /Asignación requerida/ })).toBeNull();
    expect(within(packing).queryByRole('switch', { name: /Asignación requerida/ })).toBeNull();
    expect(conditioningSwitch('evidence', 1)).toHaveAttribute('aria-checked', 'false');
    expect(conditioningSwitch('assignment', 1)).toHaveAttribute('aria-checked', 'false');
  });

  it('R10: en las tres secciones el nombre accesible del switch lleva el paso y la sección', () => {
    renderEdit(
      recipeDetail({
        steps: [paragraph('Pesar')],
        packingSteps: [paragraph('Etiquetar')],
        conditioningSteps: [paragraph('Revisar')],
      }),
    );

    expect(
      screen.getByRole('switch', { name: 'Requiere evidencia en el paso 1 de Pasos de producción' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'Requiere evidencia en el paso 1 de Envasado' }),
    ).toBeInTheDocument();
    expect(conditioningSwitch('evidence', 1)).toBeInTheDocument();
    expect(conditioningSwitch('assignment', 1)).toBeInTheDocument();
    for (const control of screen.getAllByRole('switch')) expect(control.textContent).toBe('');
  });

  it('R11: la cabecera de la sección resume los pasos, evidencias y responsables de lo cargado', () => {
    renderEdit(
      recipeDetail({
        conditioningSteps: [
          paragraph('Revisar'),
          { ...paragraph('Etiquetar'), requiresEvidence: true, requiresAssignment: true },
          { ...paragraph('Armar cajas'), requiresAssignment: true },
          paragraph('Contar'),
        ],
      }),
    );
    expect(screen.getByTestId('recipe-conditioning-step-evidence-summary').textContent).toBe(
      '4 pasos · 1 pide evidencia · 2 piden responsables',
    );
  });
});

describe('QC-299 R12 — lo que se envía y los errores por sección', () => {
  it('R12: la edición envía los pasos en el orden visible y con sus dos marcas', async () => {
    const user = setupUser();
    renderEdit(
      recipeDetail({ conditioningSteps: [paragraph('Revisar'), paragraph('Etiquetar'), paragraph('Contar')] }),
    );

    await user.click(conditioningSwitch('assignment', 2));
    await user.click(conditioningSwitch('evidence', 2));
    await user.click(conditioningSwitch('evidence', 3));

    const payload = await submitAndReadUpdate(user);
    expect(payload.conditioningSteps).toStrictEqual([
      paragraph('Revisar'),
      { ...paragraph('Etiquetar'), requiresEvidence: true, requiresAssignment: true },
      { ...paragraph('Contar'), requiresEvidence: true },
    ]);
  });

  it('R12: un paso de acondicionamiento vacío pinta su error en ese paso y en ninguno de otra sección', async () => {
    const user = setupUser();
    renderEdit(
      recipeDetail({
        steps: [paragraph('Pesar'), paragraph('Mezclar')],
        packingSteps: [paragraph('Etiquetar'), paragraph('Sellar')],
        conditioningSteps: [paragraph('Revisar'), EMPTY_STEP],
      }),
    );

    await user.click(screen.getByTestId('recipe-form-submit'));

    expect(updateRecipeActionMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('recipe-conditioning-step-field-error-1')).toBeInTheDocument();
    expect(screen.queryByTestId('recipe-conditioning-step-field-error-0')).toBeNull();
    for (const index of [0, 1]) {
      expect(screen.queryByTestId(`recipe-step-field-error-${index}`)).toBeNull();
      expect(screen.queryByTestId(`recipe-packing-step-field-error-${index}`)).toBeNull();
    }
  });

  it('R12: el error de un paso de otra sección no se atribuye a ningún paso de acondicionamiento', async () => {
    const user = setupUser();
    renderEdit(
      recipeDetail({
        steps: [paragraph('Pesar'), EMPTY_STEP],
        packingSteps: [paragraph('Etiquetar'), EMPTY_STEP],
        conditioningSteps: [paragraph('Revisar'), paragraph('Contar')],
      }),
    );

    await user.click(screen.getByTestId('recipe-form-submit'));

    expect(updateRecipeActionMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('recipe-step-field-error-1')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-packing-step-field-error-1')).toBeInTheDocument();
    expect(screen.queryByTestId('recipe-conditioning-step-field-error-0')).toBeNull();
    expect(screen.queryByTestId('recipe-conditioning-step-field-error-1')).toBeNull();
  });
});

describe('QC-299 R13 — la edición carga los pasos de acondicionamiento intactos', () => {
  it('R13: formato, lista de verificación y las dos marcas se precargan en orden y guardar sin tocarlos los deja idénticos', async () => {
    const user = setupUser();
    const conditioningSteps: ConditioningStepView[] = [
      RICH_CONDITIONING_STEP,
      { ...paragraph('Armar cajas'), requiresAssignment: true },
      paragraph('Contar'),
    ];
    renderEdit(recipeDetail({ conditioningSteps }));

    const first = screen.getByTestId('recipe-conditioning-step-text-0');
    expect(first).toHaveTextContent('Etiquetar con el lote');
    expect(first.querySelector('strong')).toHaveTextContent('Etiquetar');
    expect(first.querySelector('em')).toHaveTextContent('lote');
    expect(first.querySelector('ul[data-type="taskList"]')).not.toBeNull();
    expect(screen.getByTestId('recipe-conditioning-step-text-1')).toHaveTextContent('Armar cajas');
    expect(screen.getByTestId('recipe-conditioning-step-text-2')).toHaveTextContent('Contar');

    expect(conditioningSwitch('evidence', 1)).toHaveAttribute('aria-checked', 'true');
    expect(conditioningSwitch('assignment', 1)).toHaveAttribute('aria-checked', 'true');
    expect(conditioningSwitch('evidence', 2)).toHaveAttribute('aria-checked', 'false');
    expect(conditioningSwitch('assignment', 2)).toHaveAttribute('aria-checked', 'true');
    expect(conditioningSwitch('assignment', 3)).toHaveAttribute('aria-checked', 'false');

    const payload = await submitAndReadUpdate(user);
    expect(payload.conditioningSteps).toStrictEqual(conditioningSteps);
    expect(plainTexts(payload.steps)).toEqual(['Mezclar']);
  });

  it('R13: una lectura sin la clave abre la sección con su fila en blanco', () => {
    const legacy = Object.fromEntries(
      Object.entries(recipeDetail()).filter(([key]) => key !== 'conditioningSteps'),
    ) as unknown as RecipeDetail;
    renderEdit(legacy);

    expect(screen.getAllByTestId('recipe-conditioning-step-row')).toHaveLength(1);
    expect(screen.getByTestId('recipe-conditioning-step-text-0')).toHaveTextContent('');
  });
});
