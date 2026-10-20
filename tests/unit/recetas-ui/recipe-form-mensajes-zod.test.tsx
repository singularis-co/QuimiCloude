import { cleanup, render, screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import type { ZodIssue } from 'zod';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';

import {
  RECIPE_LINE_ERROR_MESSAGES,
  RECIPE_LINES_GENERAL_ERROR_MESSAGE,
  RECIPE_STEP_ERROR_MESSAGES,
  RECIPE_TOOLS_GENERAL_ERROR_MESSAGE,
  RecipeForm,
  extractFieldError,
  extractGeneralLinesError,
  extractGeneralToolsError,
  extractLineErrors,
  extractStepErrors,
} from '@/app/(private)/produccion/formulas/components';
import { createRecipeSchema } from '@/lib/modules/recetas';
import type { UnitView } from '@/lib/modules/unidades';

/**
 * Ningún mensaje genérico de zod (en inglés) llega a la pantalla de fórmulas. El esquema del
 * contrato es la regla; el formulario traduce: sus `refine` en español pasan tal cual y los issues
 * de forma (`too_small`, `too_big`, `invalid_format`, …) se sustituyen por el texto propio.
 *
 * Las funciones se ejercitan contra el esquema REAL (`createRecipeSchema`), no contra issues
 * escritos a mano: lo que se afirma es lo que de verdad saldría al enviar.
 */

const { routerMock, createRecipeActionMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  createRecipeActionMock: vi.fn<(input: unknown) => Promise<unknown>>(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/recetas/adapters/driving/recipe-actions', () => ({
  createRecipeAction: createRecipeActionMock,
  updateRecipeAction: vi.fn(),
  getRecipeAction: vi.fn(),
  getRecipeStepLockAction: vi.fn(async () => ({ status: 'success' as const, data: { lockingOrders: 0 } })),
  listRecipeVersionsAction: vi.fn(),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/product-actions', () => ({
  listProductsAction: vi.fn(),
}));

vi.mock('@/lib/modules/unidades/adapters/driving/unit-actions', () => ({
  listUnitsAction: vi.fn(),
}));

vi.setConfig({ testTimeout: 30_000 });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const NAME_MESSAGES = { invalid: 'Escribe el nombre de la fórmula.', tooLong: 'El nombre admite como máximo 120 caracteres.' };
const DESCRIPTION_MESSAGES = { invalid: 'Revisa la descripción.', tooLong: 'La descripción admite como máximo 500 caracteres.' };

const PRODUCT_1 = '11111111-1111-4111-8111-111111111111';
const PRODUCT_2 = '22222222-2222-4222-8222-222222222222';

/** Cualquier rastro del genérico de zod en inglés. */
const ZOD_ENGLISH = /Too small|Too big|Invalid|expected|Unrecognized/;

function line(productId = PRODUCT_1, percentage = '100') {
  return { productId, percentage };
}

function paragraph(text: string) {
  return { kind: 'paragraph' as const, spans: [{ text }] };
}

function issuesOf(overrides: Record<string, unknown>): readonly ZodIssue[] {
  const parsed = createRecipeSchema.safeParse({
    name: 'Jabón',
    description: null,
    steps: [],
    packingSteps: [],
    lines: [line()],
    tools: [],
    ...overrides,
  });
  if (parsed.success) throw new Error('se esperaba un rechazo');
  return parsed.error.issues;
}

describe('nombre y descripción: el issue de forma sale en español', () => {
  it('nombre vacío: «Escribe el nombre de la fórmula.»', () => {
    expect(extractFieldError(issuesOf({ name: '' }), 'name', NAME_MESSAGES)).toBe(
      'Escribe el nombre de la fórmula.',
    );
  });

  it('nombre de solo espacios: el mismo texto (el esquema recorta antes del mínimo)', () => {
    expect(extractFieldError(issuesOf({ name: '   ' }), 'name', NAME_MESSAGES)).toBe(
      'Escribe el nombre de la fórmula.',
    );
  });

  it('nombre de más de 120 caracteres: el tope, en español', () => {
    expect(extractFieldError(issuesOf({ name: 'a'.repeat(121) }), 'name', NAME_MESSAGES)).toBe(
      'El nombre admite como máximo 120 caracteres.',
    );
  });

  it('el `refine` del esquema pasa tal cual', () => {
    expect(extractFieldError(issuesOf({ name: '---' }), 'name', NAME_MESSAGES)).toBe(
      'El nombre de la receta no contiene ningun caracter valido.',
    );
  });

  it('descripción de más de 500 caracteres: el tope, en español', () => {
    expect(
      extractFieldError(issuesOf({ description: 'x'.repeat(501) }), 'description', DESCRIPTION_MESSAGES),
    ).toBe('La descripción admite como máximo 500 caracteres.');
  });
});

describe('líneas: forma traducida, reglas del esquema tal cual', () => {
  it('producto que no es un uuid: «Elige un ingrediente.»', () => {
    const errors = extractLineErrors(issuesOf({ lines: [line('no-es-uuid')] }), RECIPE_LINE_ERROR_MESSAGES);
    expect(errors).toEqual({ 0: { productId: 'Elige un ingrediente.' } });
  });

  it('porcentaje con formato inválido: el mensaje del `regex` del esquema', () => {
    // Solo el issue del `regex`: los `refine` del porcentaje también saltan con 'abc' y, como
    // siempre, el último de la fila es el que se pinta.
    const formatIssues = issuesOf({ lines: [line(PRODUCT_1, 'abc')] }).filter(
      (issue) => issue.code === 'invalid_format',
    );
    expect(formatIssues).toHaveLength(1);
    const errors = extractLineErrors(formatIssues, RECIPE_LINE_ERROR_MESSAGES);
    expect(errors[0]?.percentage).toBe('El porcentaje admite hasta 3 enteros y 2 decimales.');
  });

  it('porcentaje cero: el `refine` del esquema', () => {
    const errors = extractLineErrors(issuesOf({ lines: [line(PRODUCT_1, '0')] }), RECIPE_LINE_ERROR_MESSAGES);
    expect(errors[0]?.percentage).toBe('El porcentaje debe ser mayor que cero.');
  });

  it('producto repetido: el mensaje general del esquema', () => {
    const issues = issuesOf({ lines: [line(PRODUCT_1, '50'), line(PRODUCT_1, '50')] });
    expect(extractGeneralLinesError(issues, RECIPE_LINES_GENERAL_ERROR_MESSAGE)).toBe(
      'No puede haber dos lineas con el mismo producto.',
    );
  });

  it('lista que no es un array: el texto general propio', () => {
    expect(extractGeneralLinesError(issuesOf({ lines: 'x' }), RECIPE_LINES_GENERAL_ERROR_MESSAGE)).toBe(
      RECIPE_LINES_GENERAL_ERROR_MESSAGE,
    );
  });
});

describe('herramientas: el error general', () => {
  it('lista que no es un array: el texto general propio', () => {
    expect(extractGeneralToolsError(issuesOf({ tools: 'x' }), RECIPE_TOOLS_GENERAL_ERROR_MESSAGE)).toBe(
      RECIPE_TOOLS_GENERAL_ERROR_MESSAGE,
    );
  });

  it('producto repetido: el mensaje del esquema', () => {
    const tools = [
      { productId: PRODUCT_2, quantity: 1 },
      { productId: PRODUCT_2, quantity: 2 },
    ];
    expect(extractGeneralToolsError(issuesOf({ tools }), RECIPE_TOOLS_GENERAL_ERROR_MESSAGE)).toBe(
      'No puede haber dos herramientas con el mismo producto.',
    );
  });
});

describe('pasos y pasos de envasado', () => {
  it('lista de verificación sin ítems: texto propio', () => {
    const steps = [{ blocks: [paragraph('Mezclar'), { kind: 'checklist', items: [] }] }];
    expect(extractStepErrors(issuesOf({ steps }), RECIPE_STEP_ERROR_MESSAGES)).toEqual({
      0: 'Una lista de verificación necesita al menos un ítem.',
    });
  });

  it('fragmento sin caracteres: el genérico propio del paso', () => {
    const steps = [{ blocks: [paragraph('Mezclar'), paragraph('')] }];
    expect(extractStepErrors(issuesOf({ steps }), RECIPE_STEP_ERROR_MESSAGES)).toEqual({
      0: 'Revisa el contenido de este paso.',
    });
  });

  it('paso vacío: el `superRefine` del esquema, también en envasado', () => {
    const issues = issuesOf({ packingSteps: [{ blocks: [paragraph('Tapar')] }, { blocks: [] }] });
    expect(extractStepErrors(issues, RECIPE_STEP_ERROR_MESSAGES, 'packingSteps')).toEqual({
      1: 'Un paso no puede quedar vacio.',
    });
    expect(extractStepErrors(issues, RECIPE_STEP_ERROR_MESSAGES)).toEqual({});
  });

  it('ítem de lista en blanco: el mensaje del esquema', () => {
    const steps = [
      {
        blocks: [paragraph('Mezclar'), { kind: 'checklist', items: [{ spans: [{ text: '  ' }] }] }],
      },
    ];
    expect(extractStepErrors(issuesOf({ steps }), RECIPE_STEP_ERROR_MESSAGES)).toEqual({
      0: 'Un item de la lista de verificacion no puede quedar vacio.',
    });
  });
});

it('ningún campo pinta el genérico de zod en inglés', () => {
  const issues = issuesOf({
    name: '',
    description: 'x'.repeat(501),
    lines: [line('no-es-uuid', '100')],
    steps: [{ blocks: [paragraph('Mezclar'), { kind: 'checklist', items: [] }] }],
    packingSteps: [{ blocks: [paragraph('Tapar'), paragraph('')] }],
  });
  const rendered = [
    extractFieldError(issues, 'name', NAME_MESSAGES),
    extractFieldError(issues, 'description', DESCRIPTION_MESSAGES),
    extractLineErrors(issues, RECIPE_LINE_ERROR_MESSAGES),
    extractGeneralLinesError(issues, RECIPE_LINES_GENERAL_ERROR_MESSAGE),
    extractStepErrors(issues, RECIPE_STEP_ERROR_MESSAGES),
    extractStepErrors(issues, RECIPE_STEP_ERROR_MESSAGES, 'packingSteps'),
  ];
  expect(JSON.stringify(rendered)).not.toMatch(ZOD_ENGLISH);
});

// ----- El formulario montado -----

const UNITS: readonly UnitView[] = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Litro',
    symbol: 'L',
    baseUnitId: null,
    factor: null,
    isSystem: true,
  },
];

const PRODUCT_NAME = 'Ácido cítrico';

function renderCreateForm() {
  return render(
    <RecipeForm
      mode="create"
      units={UNITS}
      initialProductPage={{ items: [{ id: PRODUCT_1, name: PRODUCT_NAME, unitId: null }], totalPages: 1 }}
      initialMachinePage={{ items: [], totalPages: 1 }}
    />,
  );
}

async function addValidLine(user: UserEvent) {
  await user.click(screen.getByTestId('recipe-line-product-0'));
  await user.click(await esperarInteractiva(await screen.findByRole('option', { name: PRODUCT_NAME })));
  await user.type(screen.getByTestId('recipe-line-percentage-0'), '100');
}

describe('alta sin nombre', () => {
  it('pinta el error del nombre en español, el resumen y nunca el código ni el inglés de zod', async () => {
    const user = setupUser();
    renderCreateForm();
    await addValidLine(user);

    await user.click(screen.getByTestId('recipe-form-submit'));

    expect(await screen.findByTestId('recipe-error-name')).toHaveTextContent(
      'Escribe el nombre de la fórmula.',
    );
    const region = screen.getByTestId('recipe-form-error');
    expect(region).toHaveAttribute('role', 'alert');
    expect(screen.getByTestId('recipe-form-error-message')).toHaveTextContent('Revisa los campos marcados.');
    expect(screen.queryByTestId('recipe-form-error-code')).toBeNull();
    expect(region).not.toHaveTextContent('invalid_input');
    expect(screen.getByTestId('recipe-form')).not.toHaveTextContent(ZOD_ENGLISH);
    expect(createRecipeActionMock).not.toHaveBeenCalled();
  });
});
