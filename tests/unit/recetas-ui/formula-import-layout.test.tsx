// El aspecto de la revision de importacion: cabecera con vuelta al listado, tarjetas, filas
// numeradas, pie con «Confirmar», aviso de choque, resumen y error. La conducta (lo que se lee,
// se valida y se envia) la cubren `formula-import-review.test.tsx` y `formula-import-page.test.tsx`.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FormulaImportPreview, FormulaImportPreviewIngredient } from '@/lib/modules/documentos';
import type {
  ConfirmFormulaImportResult,
  PreviewFormulaImportResult,
} from '@/lib/modules/documentos/adapters/driving/formula-import-actions';
import { PERMISSIONS } from '@/lib/modules/identity';
import type { ProductListResult } from '@/lib/modules/inventario/adapters/driving/product-actions';
import type { UnitListResult } from '@/lib/modules/unidades/adapters/driving/unit-actions';
import { FORMULAS_ROUTE, recipeEditRoute } from '@/lib/shared/routes';

import { setupUser } from '../../helpers/user-event';

const {
  getSessionUserMock,
  listUnitsActionMock,
  listProductsActionMock,
  previewFormulaImportActionMock,
  confirmFormulaImportActionMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn<() => Promise<unknown>>(),
  listUnitsActionMock: vi.fn<() => Promise<UnitListResult>>(),
  listProductsActionMock: vi.fn<(query: unknown) => Promise<ProductListResult>>(),
  previewFormulaImportActionMock: vi.fn<(input: unknown) => Promise<PreviewFormulaImportResult>>(),
  confirmFormulaImportActionMock: vi.fn<(input: unknown) => Promise<ConfirmFormulaImportResult>>(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock, endSession: vi.fn<() => Promise<void>>() },
  observabilidad: { readRequestIdHeader: vi.fn(async (): Promise<string | null> => null) },
}));

vi.mock('@/lib/modules/unidades/adapters/driving/unit-actions', () => ({
  listUnitsAction: listUnitsActionMock,
}));

vi.mock('@/lib/modules/inventario/adapters/driving/product-actions', () => ({
  listProductsAction: listProductsActionMock,
}));

vi.mock('@/lib/modules/documentos/adapters/driving/formula-import-actions', () => ({
  previewFormulaImportAction: previewFormulaImportActionMock,
  confirmFormulaImportAction: confirmFormulaImportActionMock,
}));

const { default: FormulaImportPage } = await import('@/app/(private)/produccion/formulas/importar/[documentoId]/page');
const { FormulaImportReview } = await import('@/app/(private)/produccion/formulas/importar/[documentoId]/components');

beforeAll(() => {
  // ProseMirror pide geometria que jsdom no implementa; mismo relleno vacio que el test de la revision.
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

const DOCUMENT_FILE_ID = 'ARCHIVO-ID-NO-VISIBLE';
const PRODUCT = { id: 'producto-existente', name: 'Sosa cáustica', unitId: null };

function ingrediente(overrides: Partial<FormulaImportPreviewIngredient> = {}): FormulaImportPreviewIngredient {
  return {
    readName: 'Sodium hydroxide',
    percentage: '60.00',
    percentageRead: '60',
    quantityRead: '600',
    unitRead: 'kg',
    match: { kind: 'one', productId: PRODUCT.id, productName: PRODUCT.name, unitId: null },
    ...overrides,
  };
}

function preview(overrides: Partial<FormulaImportPreview> = {}): FormulaImportPreview {
  return {
    name: 'Desengrasante alcalino',
    description: 'Para superficies de cocina industrial.',
    ingredients: [],
    steps: [],
    packingSteps: [],
    nameClash: null,
    ...overrides,
  };
}

function renderReview(overrides: Partial<FormulaImportPreview> = {}) {
  return render(
    <FormulaImportReview
      documentFileId={DOCUMENT_FILE_ID}
      units={[]}
      initialProductPage={{ items: [PRODUCT], totalPages: 1 }}
      preview={preview(overrides)}
    />,
  );
}

async function resolverServerComponents(nodo: ReactNode): Promise<ReactNode> {
  if (Array.isArray(nodo)) return Promise.all((nodo as ReactNode[]).map((hijo) => resolverServerComponents(hijo)));
  if (!isValidElement(nodo)) return nodo;
  const elemento = nodo as ReactElement<{ children?: ReactNode }>;
  const tipo = elemento.type;
  if (typeof tipo === 'function' && tipo.constructor.name === 'AsyncFunction') {
    return resolverServerComponents(await (tipo as (props: unknown) => Promise<ReactNode>)(elemento.props));
  }
  const hijos = elemento.props.children;
  if (hijos === undefined) return elemento;
  const resueltos = await resolverServerComponents(hijos);
  return Array.isArray(resueltos)
    ? cloneElement(elemento, undefined, ...(resueltos as ReactNode[]))
    : cloneElement(elemento, undefined, resueltos);
}

async function renderPantalla() {
  return render(
    await resolverServerComponents(
      await FormulaImportPage({ params: Promise.resolve({ documentoId: DOCUMENT_FILE_ID }) }),
    ),
  );
}

beforeEach(() => {
  getSessionUserMock.mockResolvedValue({
    id: '99999999-9999-4999-8999-999999999999',
    username: 'admin.prueba',
    displayName: 'Admin De Prueba',
    roleName: 'Administrador',
    permissions: PERMISSIONS.map((permiso) => permiso.code),
    addons: ['lectura_pdf', 'integraciones'],
  });
  listUnitsActionMock.mockResolvedValue({ status: 'success', data: [] });
  listProductsActionMock.mockResolvedValue({
    status: 'success',
    data: { items: [], total: 0, page: 1, pageSize: 200, totalPages: 1 },
  });
  previewFormulaImportActionMock.mockResolvedValue({ status: 'success', data: preview() });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('la cabecera de la revision', () => {
  it('R37 pinta «Volver al listado» con flecha hacia el listado y «Revisar fórmula» como unico h1, dentro de PageShell', async () => {
    const { container } = await renderPantalla();

    const back = screen.getByTestId('formula-import-back-link');
    expect(back).toHaveTextContent('Volver al listado');
    expect(back).toHaveAttribute('href', FORMULAS_ROUTE);
    expect(back).toHaveAttribute('data-direction', 'back');
    expect(back.querySelector('svg')).not.toBeNull();
    expect(back).toHaveClass('min-h-11');

    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent('Revisar fórmula');
    expect(titulos[0]).toHaveAttribute('data-testid', 'formula-import-title');

    const shell = container.querySelector('[data-slot="page-shell"]');
    expect(shell).not.toBeNull();
    expect(shell?.contains(back)).toBe(true);
    expect(shell?.contains(screen.getByTestId('formula-import-review'))).toBe(true);
    expect(back.compareDocumentPosition(titulos[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('las tarjetas de la revision', () => {
  it('R38 nombre y descripcion van en una tarjeta y los ingredientes en otra con «N · S %» y la suma de hoy', () => {
    renderReview({
      ingredients: [ingrediente(), ingrediente({ readName: 'Aqua', percentage: '15.50', quantityRead: null, unitRead: null })],
    });

    const tarjetaDatos = screen.getByTestId('formula-import-name').closest('[data-slot="card"]');
    expect(tarjetaDatos).not.toBeNull();
    expect(tarjetaDatos?.contains(screen.getByTestId('formula-import-description'))).toBe(true);

    const encabezado = screen.getByRole('heading', { level: 2, name: 'Ingredientes' });
    const tarjetaIngredientes = encabezado.closest('[data-slot="card"]');
    expect(tarjetaIngredientes).not.toBeNull();
    expect(tarjetaIngredientes).not.toBe(tarjetaDatos);

    const resumen = screen.getByTestId('formula-import-ingredients-summary');
    expect(resumen).toHaveTextContent('2 · 75,50 %');
    expect(tarjetaIngredientes?.contains(resumen)).toBe(true);
    expect(tarjetaIngredientes?.contains(screen.getByTestId('formula-import-row-0'))).toBe(true);

    const suma = screen.getByTestId('formula-import-sum');
    expect(suma).toHaveTextContent('75,50');
    expect(screen.getByTestId('formula-import-row-1').compareDocumentPosition(suma) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('R38 la cabecera de ingredientes sigue la lista al quitar una fila', async () => {
    const user = setupUser();
    renderReview({ ingredients: [ingrediente(), ingrediente({ readName: 'Aqua', percentage: '40.00' })] });

    expect(screen.getByTestId('formula-import-ingredients-summary')).toHaveTextContent('2 · 100,00 %');
    await user.click(screen.getByRole('button', { name: 'Quitar el ingrediente 2' }));
    expect(screen.getByTestId('formula-import-ingredients-summary')).toHaveTextContent('1 · 60,00 %');
  });
});

describe('cada ingrediente como tarjeta', () => {
  it('R39 lleva su numero, «Referencia del PDF» con lo leido, porcentaje y producto', () => {
    renderReview({ ingredients: [ingrediente(), ingrediente({ readName: null, match: { kind: 'none' } })] });

    const fila = screen.getByTestId('formula-import-row-0');
    expect(fila).toHaveAttribute('data-slot', 'card');
    expect(within(fila).getByTestId('formula-import-row-number-0')).toHaveTextContent('1');
    expect(within(fila).getByText('Referencia del PDF')).toBeInTheDocument();
    expect(within(fila).getByTestId('formula-import-row-name-0')).toHaveTextContent('Sodium hydroxide');
    expect(within(fila).getByTestId('formula-import-row-reference-0')).toHaveTextContent('600 kg');
    expect(within(fila).getByTestId('formula-import-row-percentage-0')).toHaveValue('60,00');
    expect(within(fila).getByTestId('formula-import-row-preselected-product-0')).toHaveTextContent('Sosa cáustica');

    expect(screen.getByTestId('formula-import-row-number-1')).toHaveTextContent('2');
    expect(screen.getByTestId('formula-import-row-new-name-1')).toBeInTheDocument();
    expect(screen.getByTestId('formula-import-row-choose-button-1')).toBeInTheDocument();
  });

  it('R39 quitar es un icono de 44 × 44 con nombre «Quitar el ingrediente N» y el texto se oculta bajo 640 px', () => {
    renderReview({ ingredients: [ingrediente(), ingrediente({ readName: 'Aqua' })] });

    const quitar = screen.getByRole('button', { name: 'Quitar el ingrediente 2' });
    expect(quitar).toHaveAttribute('data-testid', 'formula-import-row-remove-1');
    expect(quitar).toHaveClass('min-h-11', 'min-w-11');
    expect(quitar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    const texto = screen.getByTestId('formula-import-row-remove-text-1');
    expect(texto).toHaveTextContent('Quitar');
    expect(texto).toHaveClass('hidden', 'sm:inline');
    expect(screen.getByRole('button', { name: 'Quitar el ingrediente 1' })).toBeInTheDocument();
  });
});

describe('«Añadir ingrediente» y el pie', () => {
  it('R40 «Añadir ingrediente» va a todo el ancho con borde discontinuo', () => {
    renderReview();

    const anadir = screen.getByTestId('formula-import-add-ingredient');
    expect(anadir).toHaveTextContent('Añadir ingrediente');
    expect(anadir).toHaveClass('w-full', 'border-dashed', 'min-h-11');
  });

  it('R40 «Confirmar» va en el pie fijo con margen seguro, deshabilitado con motivos', () => {
    renderReview();

    const pie = screen.getByTestId('formula-import-footer');
    expect(pie).toHaveAttribute('data-slot', 'form-footer-bar');
    expect(pie.className).toContain('sticky');
    expect(pie.className).toContain('safe-area-inset-bottom');

    const confirmar = within(pie).getByTestId('formula-import-confirm');
    expect(confirmar).toHaveTextContent('Confirmar');
    expect(confirmar).toBeDisabled();
    expect(screen.getByTestId('formula-import-reasons')).toHaveTextContent('Añade al menos un ingrediente.');
    expect(pie.contains(screen.getByTestId('formula-import-reasons'))).toBe(false);
  });

  it('R40 confirmando, el boton del pie dice «Confirmando…» y queda deshabilitado', async () => {
    const user = setupUser();
    confirmFormulaImportActionMock.mockReturnValue(new Promise<ConfirmFormulaImportResult>(() => {}));
    renderReview({ ingredients: [ingrediente({ percentage: '100.00' })] });

    await user.click(screen.getByTestId('formula-import-confirm'));

    const confirmar = within(screen.getByTestId('formula-import-footer')).getByTestId('formula-import-confirm');
    expect(confirmar).toHaveTextContent('Confirmando…');
    expect(confirmar).toBeDisabled();
  });
});

describe('el choque de nombre', () => {
  it('R41 avisa con Notice warning, el texto de hoy y «Cambiar el nombre» y «Reemplazar» (destructivo)', () => {
    renderReview({
      ingredients: [ingrediente({ percentage: '100.00' })],
      nameClash: { recipeId: 'receta-existente', recipeName: 'Desengrasante alcalino' },
    });

    const choque = screen.getByTestId('formula-import-clash');
    expect(choque).toHaveAttribute('role', 'status');
    expect(choque).toHaveAttribute('data-tone', 'warning');
    expect(within(choque).getByTestId('formula-import-clash-message')).toHaveTextContent(
      'Ya existe la fórmula «Desengrasante alcalino». Reemplazarla cambia sus ingredientes, pasos y descripción; los pedidos que la usan no cambian su coste guardado.',
    );

    const cambiar = within(choque).getByRole('button', { name: 'Cambiar el nombre' });
    const reemplazar = within(choque).getByRole('button', { name: 'Reemplazar' });
    expect(cambiar).toHaveAttribute('data-testid', 'formula-import-clash-rename');
    expect(reemplazar).toHaveAttribute('data-testid', 'formula-import-clash-replace');
    expect(cambiar).toHaveClass('border-border', 'min-h-11');
    expect(reemplazar).toHaveClass('bg-destructive', 'min-h-11');
    expect(cambiar.compareDocumentPosition(reemplazar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // En la pantalla, antes de confirmar: no es un dialogo.
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(choque.compareDocumentPosition(screen.getByTestId('formula-import-footer')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('el resumen', () => {
  it('R42 pinta una tarjeta con icono de exito, el resultado como titulo, las dos cifras y los dos botones', async () => {
    const user = setupUser();
    confirmFormulaImportActionMock.mockResolvedValue({
      status: 'success',
      data: { recipeId: 'receta-nueva-id', outcome: 'replaced', rawMaterialsCreated: 2, rawMaterialsReused: 3 },
    });
    renderReview({ ingredients: [ingrediente({ percentage: '100.00' })] });

    await user.click(screen.getByTestId('formula-import-confirm'));
    await waitFor(() => expect(screen.getByTestId('formula-import-summary')).toBeInTheDocument());

    const resumen = screen.getByTestId('formula-import-summary');
    expect(resumen).toHaveAttribute('role', 'status');
    expect(resumen).toHaveAttribute('data-slot', 'card');
    expect(within(resumen).getByTestId('formula-import-summary-icon').querySelector('svg')).not.toBeNull();
    expect(within(resumen).getByTestId('formula-import-summary-icon')).toHaveClass('text-success-text');

    const titulo = within(resumen).getByRole('heading', { level: 2 });
    expect(titulo).toHaveTextContent('Se reemplazó la fórmula existente.');
    expect(titulo).toHaveAttribute('data-testid', 'formula-import-summary-outcome');

    expect(within(resumen).getByText('Materias primas creadas')).toBeInTheDocument();
    expect(within(resumen).getByText('Materias primas reutilizadas')).toBeInTheDocument();
    expect(screen.getByTestId('formula-import-summary-raw-materials-created')).toHaveTextContent('2');
    expect(screen.getByTestId('formula-import-summary-raw-materials-created')).toHaveClass('font-mono', 'text-2xl');
    expect(screen.getByTestId('formula-import-summary-raw-materials-reused')).toHaveTextContent('3');

    const volver = within(resumen).getByTestId('formula-import-summary-back-link');
    expect(volver).toHaveTextContent('Volver al listado');
    expect(volver).toHaveAttribute('href', FORMULAS_ROUTE);
    expect(volver).toHaveAttribute('data-direction', 'back');

    const ver = within(resumen).getByTestId('formula-import-summary-link');
    expect(ver).toHaveTextContent('Ver la fórmula');
    expect(ver).toHaveAttribute('href', recipeEditRoute('receta-nueva-id'));
    expect(ver).toHaveAttribute('data-direction', 'forward');
    expect(ver.querySelector('svg')).not.toBeNull();

    expect(screen.queryByTestId('formula-import-footer')).toBeNull();
  });

  it('R42 con una formula nueva el titulo dice «Se creó una fórmula nueva.»', async () => {
    const user = setupUser();
    confirmFormulaImportActionMock.mockResolvedValue({
      status: 'success',
      data: { recipeId: 'receta-nueva-id', outcome: 'created', rawMaterialsCreated: 0, rawMaterialsReused: 1 },
    });
    renderReview({ ingredients: [ingrediente({ percentage: '100.00' })] });

    await user.click(screen.getByTestId('formula-import-confirm'));

    expect(await screen.findByRole('heading', { level: 2, name: 'Se creó una fórmula nueva.' })).toBeInTheDocument();
  });
});

describe('la revision que no se puede abrir', () => {
  it('R43 pinta «No se pudo abrir esta revisión.» con «Volver al listado» con flecha y los testids de hoy', async () => {
    previewFormulaImportActionMock.mockResolvedValue({
      status: 'error',
      code: 'invalid_input',
      message: 'La entrada recibida no es válida.',
    });

    await renderPantalla();

    const error = screen.getByTestId('formula-import-error');
    expect(within(error).getByTestId('formula-import-error-message')).toHaveTextContent('No se pudo abrir esta revisión.');
    const volver = within(error).getByTestId('formula-import-error-back-link');
    expect(volver).toHaveTextContent('Volver al listado');
    expect(volver).toHaveAttribute('href', FORMULAS_ROUTE);
    expect(volver).toHaveAttribute('data-direction', 'back');
    expect(volver.querySelector('svg')).not.toBeNull();
    expect(volver).toHaveClass('min-h-11');
    expect(screen.queryByTestId('formula-import-review')).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
