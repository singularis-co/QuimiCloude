import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import EditarRecetaPage from '@/app/(private)/produccion/formulas/[id]/page';
import NuevaRecetaPage from '@/app/(private)/produccion/formulas/nueva/page';
import { RecipeForm } from '@/app/(private)/produccion/formulas/components';
import { PERMISSIONS } from '@/lib/modules/identity';
import type { RecipeDetail, RecipeStepView, RecipeVersionSummary } from '@/lib/modules/recetas';
import type {
  CreateRecipeFormState,
  DeleteRecipeFormState,
  RecipeQueryResult,
  RecipeVersionListResult,
  UpdateRecipeFormState,
} from '@/lib/modules/recetas/adapters/driving/recipe-actions';
import { FORMULAS_ROUTE } from '@/lib/shared/routes';

import { setupUser } from '../../helpers/user-event';

/**
 * Estructura del formulario de receta tras el rediseño (QC-264 T3a): cabecera con «Volver a la
 * lista», tarjetas, versiones dentro del `<form>` antes de los ingredientes y pie fijo con «Guardar» asociado por
 * `form=`. En jsdom el Enter con el botón fuera del `<form>` no envía (límite del simulador,
 * T0c): aquí se prueba el clic y `requestSubmit()`; «Enter guarda» va en el E2E.
 */

const {
  getSessionUserMock,
  routerMock,
  createRecipeActionMock,
  updateRecipeActionMock,
  getRecipeActionMock,
  listRecipeVersionsActionMock,
  deleteRecipeActionMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn<() => Promise<unknown>>(),
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
  getRecipeActionMock: vi.fn<(id: string) => Promise<RecipeQueryResult>>(),
  listRecipeVersionsActionMock: vi.fn<(originalId: string) => Promise<RecipeVersionListResult>>(),
  deleteRecipeActionMock: vi.fn<(id: string) => Promise<DeleteRecipeFormState>>(),
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock, endSession: vi.fn<() => Promise<void>>() },
  observabilidad: { readRequestIdHeader: vi.fn(async (): Promise<string | null> => null) },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/recetas/adapters/driving/recipe-actions', () => ({
  createRecipeAction: createRecipeActionMock,
  updateRecipeAction: updateRecipeActionMock,
  getRecipeAction: getRecipeActionMock,
  getRecipeStepLockAction: vi.fn(async () => ({
    status: 'success' as const,
    data: { lockingOrders: 0 },
  })),
  listRecipeVersionsAction: listRecipeVersionsActionMock,
  deleteRecipeAction: deleteRecipeActionMock,
}));

vi.mock('@/lib/modules/inventario/adapters/driving/product-actions', () => ({
  listProductsAction: vi.fn(async () => ({
    status: 'success' as const,
    data: { items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 },
  })),
}));

vi.mock('@/lib/modules/unidades/adapters/driving/unit-actions', () => ({
  listUnitsAction: vi.fn(async () => ({ status: 'success' as const, data: [] })),
}));

vi.setConfig({ testTimeout: 30_000 });

const RECIPE_ID = '66666666-6666-4666-8666-666666666666';
const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const EMPTY_PAGE = { items: [], totalPages: 1 };
const AREA_TACTIL = ['min-h-11', 'min-w-11'];

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

const VERSION: RecipeVersionSummary = {
  id: 'version-1',
  name: 'Sin perfume',
  displayName: 'Detergente industrial · Sin perfume',
  isUnderReview: false,
  updatedAt: new Date('2026-01-03T00:00:00.000Z'),
};

function renderEdit(options: { lockingOrders?: number; versionSlots?: boolean } = {}) {
  return render(
    <RecipeForm
      mode="edit"
      recipe={recipeDetail()}
      versions={[]}
      lockingOrders={options.lockingOrders}
      units={[]}
      initialProductPage={EMPTY_PAGE}
      initialMachinePage={EMPTY_PAGE}
      versionList={
        options.versionSlots === false ? undefined : <p data-testid="version-list-probe">Versiones</p>
      }
      newVersionAction={
        options.versionSlots === false ? undefined : (
          <button type="button" data-testid="new-version-probe">
            Nueva versión
          </button>
        )
      }
    />,
  );
}

function follows(earlier: Element, later: Element): boolean {
  return (earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

function cardsOf(form: HTMLElement): HTMLElement[] {
  return Array.from(form.querySelectorAll<HTMLElement>(':scope > [data-slot="card"]'));
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
  getSessionUserMock.mockResolvedValue({
    id: 'u-test-42',
    username: 'carla.duarte',
    displayName: 'Carla Duarte Salas',
    roleName: 'Administrador',
    permissions: PERMISSIONS.map((permiso) => permiso.code),
  });
  createRecipeActionMock.mockResolvedValue({ status: 'success', id: RECIPE_ID });
  updateRecipeActionMock.mockResolvedValue({ status: 'success', propagated: [] });
  getRecipeActionMock.mockResolvedValue({ status: 'success', data: recipeDetail() });
  listRecipeVersionsActionMock.mockResolvedValue({ status: 'success', data: [VERSION] });
  deleteRecipeActionMock.mockResolvedValue({ status: 'success' });
});

afterEach(() => {
  cleanup();
});

describe('formulario de receta — cabecera (R10)', () => {
  it('R10: el alta pinta «Volver a la lista» con flecha hacia el listado y debajo el h1 de hoy, dentro de PageShell', async () => {
    render(await NuevaRecetaPage());

    const volver = screen.getByRole('link', { name: 'Volver a la lista' });
    expect(volver).toHaveAttribute('data-testid', 'recipe-form-back-link');
    expect(volver).toHaveAttribute('href', FORMULAS_ROUTE);
    expect(volver).toHaveAttribute('data-direction', 'back');
    expect(volver.querySelector('svg[aria-hidden]')).not.toBeNull();
    expect(volver).toHaveClass(...AREA_TACTIL);

    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveAttribute('data-testid', 'recipe-form-title');
    expect(titulos[0]).toHaveTextContent('Nueva fórmula');
    expect(follows(volver, titulos[0])).toBe(true);
    expect(volver.closest('[data-slot="page-shell"]')).not.toBeNull();
    expect(screen.getByTestId('recipe-form').closest('[data-slot="page-shell"]')).not.toBeNull();
  });

  it('R10: la edición pinta el mismo botón y el h1 con el nombre de la fórmula', async () => {
    render(await EditarRecetaPage({ params: Promise.resolve({ id: RECIPE_ID }) }));

    expect(screen.getByRole('link', { name: 'Volver a la lista' })).toHaveAttribute(
      'href',
      FORMULAS_ROUTE,
    );
    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveAttribute('data-testid', 'recipe-form-title');
    expect(titulos[0]).toHaveTextContent('Editar fórmula · Detergente industrial');
  });
});

describe('formulario de receta — tarjetas (R11, R51)', () => {
  // QC-299 (merge 2026-10-21): la sección «Acondicionamiento» añade una quinta tarjeta, tras
  // la de envasado.
  it('R11: cinco tarjetas en orden: datos, ingredientes y herramientas, pasos, pasos de envasado y acondicionamiento', () => {
    renderEdit();

    const form = screen.getByTestId('recipe-form');
    const tarjetas = cardsOf(form);
    expect(tarjetas).toHaveLength(5);

    const [datos, lineas, pasos, envasado, acondicionamiento] = tarjetas;
    expect(within(datos).getByTestId('recipe-image-field')).toBeInTheDocument();
    expect(within(datos).getByTestId('recipe-field-name')).toBeInTheDocument();
    expect(within(datos).getByTestId('recipe-field-description')).toBeInTheDocument();
    expect(within(datos).queryByRole('heading')).toBeNull();
    expect(within(lineas).getByTestId('recipe-lines-field')).toBeInTheDocument();
    expect(within(pasos).getByTestId('recipe-steps-field')).toBeInTheDocument();
    expect(within(envasado).getByTestId('recipe-packing-steps-field')).toBeInTheDocument();
    expect(
      within(acondicionamiento).getByTestId('recipe-conditioning-steps-field'),
    ).toBeInTheDocument();
  });

  it('R51: el aviso de bloqueo queda dentro del <form>, encima de las tarjetas', () => {
    renderEdit({ lockingOrders: 2 });

    const form = screen.getByTestId('recipe-form');
    const aviso = screen.getByTestId('recipe-form-steps-locked');
    expect(form.contains(aviso)).toBe(true);
    expect(follows(aviso, cardsOf(form)[0])).toBe(true);
  });
});

describe('formulario de receta — versiones dentro del formulario (R13, R14)', () => {
  it('R13: no hay columna lateral: el <form> ocupa todo el ancho', () => {
    renderEdit();

    const form = screen.getByTestId('recipe-form');
    expect(document.querySelector('aside')).toBeNull();
    expect(form).not.toHaveClass('flex-[3_1_560px]');
    expect(form.parentElement).toHaveAttribute('data-slot', 'recipe-form-layout');
  });

  it('R13: la lista de versiones va dentro del <form>, tras los datos y justo antes de los ingredientes', () => {
    renderEdit();

    const form = screen.getByTestId('recipe-form');
    const lista = screen.getByTestId('version-list-probe');
    const [datos, lineas] = cardsOf(form);
    expect(form.contains(lista)).toBe(true);
    expect(follows(datos, lista)).toBe(true);
    expect(follows(lista, lineas)).toBe(true);
    expect(lista.parentElement?.nextElementSibling).toBe(lineas);
  });

  it('R13: sin lista de versiones no se pinta su hueco', () => {
    renderEdit({ versionSlots: false });

    expect(document.querySelector('[data-slot="recipe-form-versions"]')).toBeNull();
  });

  it('R13: la edición pone la sección «Versiones» antes de los ingredientes con sus filas', async () => {
    render(await EditarRecetaPage({ params: Promise.resolve({ id: RECIPE_ID }) }));

    const versiones = screen.getByTestId('recipe-versions');
    const form = screen.getByTestId('recipe-form');
    expect(form.contains(versiones)).toBe(true);
    expect(follows(versiones, screen.getByTestId('recipe-lines-field'))).toBe(true);
    expect(within(versiones).getAllByTestId('recipe-version-row')).toHaveLength(1);
  });

  it('R13: «Nueva versión» va en el pie, junto a «Vista previa», y enlaza al alta de versión', async () => {
    render(await EditarRecetaPage({ params: Promise.resolve({ id: RECIPE_ID }) }));

    const footer = screen.getByTestId('recipe-form-footer');
    const nueva = within(footer).getByTestId('recipe-version-new');
    const vistaPrevia = within(footer).getByTestId('recipe-form-preview-open');
    expect(nueva).toHaveAttribute('href', `${FORMULAS_ROUTE}/${RECIPE_ID}/versiones/nueva`);
    expect(nueva.parentElement).toBe(vistaPrevia.parentElement);
    expect(follows(vistaPrevia, nueva)).toBe(true);
    expect(within(screen.getByTestId('recipe-versions')).queryByTestId('recipe-version-new')).toBeNull();
  });

  it('R13: borrar una versión desde la lista no envía el formulario de la receta', async () => {
    const user = setupUser();
    render(await EditarRecetaPage({ params: Promise.resolve({ id: RECIPE_ID }) }));

    const borrar = screen.getByRole('button', { name: 'Eliminar la versión Sin perfume' });
    expect(borrar).toHaveAttribute('type', 'button');
    await user.click(borrar);
    const dialogo = await screen.findByTestId('delete-recipe-dialog');
    await user.click(within(dialogo).getByTestId('delete-recipe-confirm'));

    await waitFor(() => expect(deleteRecipeActionMock).toHaveBeenCalledWith('version-1'));
    expect(updateRecipeActionMock).not.toHaveBeenCalled();
    expect(createRecipeActionMock).not.toHaveBeenCalled();
  });

  it('R14: el alta pinta «Versiones» con el texto de vacío y «Nueva versión» deshabilitado en el pie', async () => {
    render(await NuevaRecetaPage());

    const versiones = screen.getByTestId('recipe-versions');
    expect(screen.getByTestId('recipe-form').contains(versiones)).toBe(true);
    expect(within(versiones).getByTestId('recipe-versions-empty')).toHaveTextContent(
      'Esta fórmula todavía no tiene versiones.',
    );
    expect(
      within(screen.getByTestId('recipe-form-footer')).getByTestId('recipe-version-new'),
    ).toBeDisabled();
  });
});

describe('formulario de receta — descripción', () => {
  it('la descripción deja ver al menos tres líneas y sigue creciendo y redimensionable', () => {
    renderEdit();

    const descripcion = screen.getByTestId('recipe-field-description');
    expect(descripcion).toHaveClass('min-h-24', 'field-sizing-content', 'resize-y');
    expect(descripcion).not.toHaveClass('min-h-11');
  });
});

describe('formulario de receta — pie fijo (R15)', () => {
  function pie(): HTMLElement {
    return screen.getByTestId('recipe-form-footer');
  }

  it('R15: el pie va fuera del <form>, pegado abajo con el margen seguro, y con «Vista previa» a la izquierda y «Cancelar» y «Guardar» a la derecha', () => {
    renderEdit();

    const footer = pie();
    expect(footer.tagName).toBe('FOOTER');
    expect(screen.getByTestId('recipe-form').contains(footer)).toBe(false);
    expect(footer).toHaveClass(
      'sticky',
      'bottom-0',
      'border-t',
      'pb-[calc(14px+env(safe-area-inset-bottom))]',
      '-mx-4',
      '-mb-6',
      'md:-mx-7',
      'md:-mb-8',
    );

    const vistaPrevia = within(footer).getByTestId('recipe-form-preview-open');
    const cancelar = within(footer).getByTestId('recipe-form-cancel');
    const guardar = within(footer).getByTestId('recipe-form-submit');
    expect(vistaPrevia).toHaveAccessibleName('Vista previa');
    expect(vistaPrevia.parentElement).toHaveClass('mr-auto');
    expect(cancelar).toHaveAttribute('href', FORMULAS_ROUTE);
    expect(follows(vistaPrevia, cancelar)).toBe(true);
    expect(follows(cancelar, guardar)).toBe(true);
    for (const boton of [vistaPrevia, cancelar, guardar]) {
      expect(boton).toHaveClass(...AREA_TACTIL);
    }
  });

  it('R15: «Guardar» es el submit del formulario por su atributo form', () => {
    renderEdit();

    const form = screen.getByTestId('recipe-form');
    const guardar = screen.getByTestId('recipe-form-submit');
    expect(form.id).not.toBe('');
    expect(guardar).toHaveAttribute('type', 'submit');
    expect(guardar).toHaveAttribute('form', form.id);
    expect((guardar as HTMLButtonElement).form).toBe(form);
  });

  it('R15: el clic en «Guardar» envía una sola vez', async () => {
    const user = setupUser();
    renderEdit();

    await user.click(screen.getByTestId('recipe-form-submit'));

    await waitFor(() => expect(updateRecipeActionMock).toHaveBeenCalledTimes(1));
    expect(updateRecipeActionMock.mock.calls[0]?.[0]).toBe(RECIPE_ID);
  });

  it('R15: requestSubmit() del formulario también guarda, sin el botón dentro', async () => {
    renderEdit();

    (screen.getByTestId('recipe-form') as HTMLFormElement).requestSubmit();

    await waitFor(() => expect(updateRecipeActionMock).toHaveBeenCalledTimes(1));
  });

  it('R15: sin suma completa «Guardar» sigue deshabilitado, como hoy', () => {
    render(
      <RecipeForm
        mode="create"
        units={[]}
        initialProductPage={EMPTY_PAGE}
        initialMachinePage={EMPTY_PAGE}
      />,
    );

    expect(screen.getByTestId('recipe-form-submit')).toBeDisabled();
  });

  it('R15: mientras guarda dice «Guardando…», se deshabilita y se marca ocupado', async () => {
    const user = setupUser();
    let terminar: (value: UpdateRecipeFormState) => void = () => undefined;
    updateRecipeActionMock.mockImplementation(
      () =>
        new Promise<UpdateRecipeFormState>((resolve) => {
          terminar = resolve;
        }),
    );
    renderEdit();

    await user.click(screen.getByTestId('recipe-form-submit'));

    const guardar = screen.getByTestId('recipe-form-submit');
    await waitFor(() => expect(guardar).toHaveTextContent('Guardando…'));
    expect(guardar).toBeDisabled();
    expect(guardar).toHaveAttribute('aria-busy', 'true');

    terminar({ status: 'success', propagated: [] });
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith(FORMULAS_ROUTE));
  });
});
