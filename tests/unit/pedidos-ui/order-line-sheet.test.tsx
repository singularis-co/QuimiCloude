// QT-314 T14 — El sub-panel de una receta, montado solo: lo que devuelve «Aplicar», lo que
// rechaza, «Descartar», «Quitar receta» y la receta repetida.

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_LINE_SHEET_APPLY_TESTID,
  ORDER_LINE_SHEET_BACK_TESTID,
  ORDER_LINE_SHEET_DISCARD_TESTID,
  ORDER_LINE_SHEET_REMOVE_TESTID,
  ORDER_LINE_SHEET_TESTID,
  ORDER_LINE_SHEET_TITLE_TESTID,
  ORDER_DISTRIBUTION_ADD_TESTID,
  ORDER_RECIPE_IMAGE_TESTID,
  OrderLineSheet,
  PACKAGING_OPTION_TESTID,
  PACKAGING_SELECT_TESTID,
  RECIPE_PICKER_TESTID,
  RECIPE_VERSION_SELECT_TESTID,
  draftFromOrder,
  type OrderLineDraft,
} from '@/app/(private)/pedidos/components';
import { MISSING_IMAGE_SRC } from '@/components/shared/entity-image';
import type { OrderLineView } from '@/lib/modules/pedidos';
import {
  LINEA_A_ID,
  RECETA_A,
  RECETA_B,
  RECETA_C,
  RECETAS,
  UNIDAD,
  UNIDADES,
  VERSION_B,
  aplicar,
  elegirReceta,
  elegirUnidad,
  escribirCantidad,
  escribirPrecio,
  lineaB,
  lineaPedido,
  recetaDetalle,
} from '../../helpers/order-form-ui';
import { esperarInteractiva, setupUser } from '../../helpers/user-event';

const { getRecipeActionMock, listRecipeVersionsActionMock, listProductsActionMock, prohibida } = vi.hoisted(() => ({
  getRecipeActionMock: vi.fn(),
  listRecipeVersionsActionMock: vi.fn(),
  listProductsActionMock: vi.fn(),
  prohibida: (nombre: string) => () => {
    throw new Error(`${nombre} no debe invocarse desde el sub-panel`);
  },
}));

vi.mock('@/lib/modules/pedidos/adapters/driving/order-actions', () => ({
  createOrderAction: vi.fn(prohibida('createOrderAction')),
  updateOrderAction: vi.fn(prohibida('updateOrderAction')),
  quoteOrderCostAction: vi.fn(async () => ({ status: 'success', data: { ingredientsCost: null } })),
  quoteOrderPresentationAvailabilityAction: vi.fn(async () => ({
    status: 'success',
    data: { kind: 'ok', available: '0' },
  })),
}));

vi.mock('@/lib/modules/recetas/adapters/driving/recipe-actions', () => ({
  listRecipeVersionsAction: listRecipeVersionsActionMock,
  listRecipesAction: vi.fn(prohibida('listRecipesAction')),
  getRecipeAction: getRecipeActionMock,
}));

vi.mock('@/lib/modules/inventario/adapters/driving/presentation-actions', () => ({
  listPresentationsAction: vi.fn(async () => ({
    status: 'success',
    data: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 },
  })),
  createPresentationAction: vi.fn(prohibida('createPresentationAction')),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/product-actions', () => ({
  listProductsAction: listProductsActionMock,
}));

const ENVASE_DEL_CATALOGO = {
  id: '30000000-0000-4000-8000-0000000000e1',
  name: 'Bidón PET 20 L',
  imagePath: null,
  stock: '10.0000',
  unitId: UNIDAD.id,
  qtyAlert: null,
  type: 'PACKAGING',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  available: '10.0000',
  presentationId: '40000000-0000-4000-8000-0000000000e1',
  presentationName: 'Bidón 20L',
  presentationContent: '20.0000',
  presentationUnitId: UNIDAD.id,
};

const VERSION_C = {
  id: '10000000-0000-4000-8000-0000000000c2',
  name: 'Sin colorante',
  displayName: 'Desinfectante · Sin colorante',
  isUnderReview: false,
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const onApply = vi.fn<(line: OrderLineDraft) => void>();
const onRemove = vi.fn<(key: string) => void>();
const onOpenChange = vi.fn<(open: boolean) => void>();

function borradorDe(...lines: OrderLineView[]): OrderLineDraft[] {
  return draftFromOrder({ lines });
}

function renderSubPanel(line: OrderLineDraft | null, lines: readonly OrderLineDraft[] = line === null ? [] : [line]) {
  return render(
    <OrderLineSheet
      open
      onOpenChange={onOpenChange}
      line={line}
      lines={lines}
      recipes={RECETAS}
      units={UNIDADES}
      bridge={null}
      onApply={onApply}
      onRemove={onRemove}
    />,
  );
}

function aplicado(): OrderLineDraft {
  expect(onApply).toHaveBeenCalledTimes(1);
  return onApply.mock.calls[0]?.[0] as OrderLineDraft;
}

beforeEach(() => {
  vi.clearAllMocks();
  getRecipeActionMock.mockImplementation(async (id: string) => ({ status: 'success', data: recetaDetalle(id) }));
  listRecipeVersionsActionMock.mockResolvedValue({ status: 'success', data: [] });
  listProductsActionMock.mockResolvedValue({
    status: 'success',
    data: { items: [ENVASE_DEL_CATALOGO], page: 1, pageSize: 25, total: 1, totalPages: 1 },
  });
});

afterEach(() => {
  cleanup();
});

describe('precarga (R3)', () => {
  it('R3: al editar, cada campo viene con el valor de esa receta y pide sus insumos', async () => {
    const [linea] = borradorDe(lineaPedido());
    renderSubPanel(linea as OrderLineDraft);

    expect(screen.getByTestId(ORDER_LINE_SHEET_TITLE_TESTID)).toHaveTextContent('Editar receta');
    expect(screen.getByTestId(RECIPE_PICKER_TESTID)).toHaveValue(RECETA_A.name);
    expect(screen.getByTestId('recipe-version-select-value')).toHaveValue('');
    expect(screen.getByTestId('order-field-quantity')).toHaveValue(15);
    expect(screen.getByTestId('order-field-salePrice')).toHaveValue(120.5);
    expect(screen.getByTestId('presentation-unit-select')).toHaveTextContent('L');
    expect(screen.getAllByTestId('order-distribution-line')).toHaveLength(1);
    expect(screen.getByTestId(ORDER_RECIPE_IMAGE_TESTID)).toHaveAttribute('src', MISSING_IMAGE_SRC);
    expect(screen.getByTestId('order-cost-quote')).toBeInTheDocument();
    await waitFor(() => expect(getRecipeActionMock).toHaveBeenCalledWith(RECETA_A.id));
    expect(await screen.findByTestId('order-ingredients')).toBeInTheDocument();
  });

  it('R3: con una versión, el selector de receta enseña la original y el de versión la versión', () => {
    const [linea] = borradorDe(lineaB());
    renderSubPanel(linea as OrderLineDraft);

    expect(screen.getByTestId(RECIPE_PICKER_TESTID)).toHaveValue(RECETA_B.name);
    expect(screen.getByTestId('recipe-version-select-value')).toHaveValue(VERSION_B);
    expect(screen.getByTestId(ORDER_RECIPE_IMAGE_TESTID)).toHaveAttribute('src', RECETA_B.imageUrl);
  });
});

describe('aplicar (R4)', () => {
  it('R4: con los campos válidos devuelve la receta del borrador, sin guardar nada', async () => {
    const user = setupUser();
    renderSubPanel(null);

    await elegirReceta(user, RECETA_C.id);
    await elegirUnidad(user);
    await escribirCantidad(user, '12.5');
    await escribirPrecio(user, '40');
    await aplicar(user);

    const linea = aplicado();
    expect(linea).toMatchObject({
      saved: null,
      recipe: { id: RECETA_C.id, name: RECETA_C.name, imageUrl: null },
      recipeVersionId: null,
      quantity: '12.5',
      unitId: UNIDAD.id,
      unitLabel: 'L',
      presentationLines: [],
      salePrice: '40',
    });
    expect(linea.key).not.toBe('');
  });

  it('R4: al soltar el foco la cantidad se coloca a dos decimales, y así se aplica', async () => {
    const user = setupUser();
    const [linea] = borradorDe(lineaPedido());
    renderSubPanel(linea as OrderLineDraft);

    await escribirCantidad(user, '0.1005');
    await user.tab();
    expect(screen.getByTestId('order-field-quantity')).toHaveValue(0.1);
    await aplicar(user);

    expect(aplicado().quantity).toBe('0.1');
  });

  it('R4: al editar, conserva la clave y lo guardado de la receta', async () => {
    const user = setupUser();
    const [linea] = borradorDe(lineaPedido());
    renderSubPanel(linea as OrderLineDraft);

    await escribirCantidad(user, '18');
    await aplicar(user);

    expect(aplicado()).toMatchObject({ key: LINEA_A_ID, quantity: '18', saved: { id: LINEA_A_ID } });
  });

  it('R4: una cantidad que el esquema rechaza se marca, no se aplica y lo escrito se queda', async () => {
    const user = setupUser();
    const [linea] = borradorDe(lineaPedido());
    renderSubPanel(linea as OrderLineDraft);

    await escribirCantidad(user, '0');
    await aplicar(user);

    expect(await screen.findByTestId('order-error-quantity')).toHaveTextContent('Ingresa un número mayor a 0.');
    expect(onApply).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('order-field-quantity')).toHaveValue(0);
  });

  it('R4: sin receta ni unidad se marcan los dos campos', async () => {
    const user = setupUser();
    renderSubPanel(null);

    await escribirCantidad(user, '3');
    await aplicar(user);

    expect(await screen.findByTestId(`${RECIPE_PICKER_TESTID}-error`)).toHaveTextContent('Elige una fórmula');
    expect(screen.getByTestId('presentation-error-unit')).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe('versión, reparto e imagen de la receta (R3, R4)', () => {
  it('R4: elegir una versión pide sus insumos y la receta aplicada la lleva', async () => {
    const user = setupUser();
    listRecipeVersionsActionMock.mockResolvedValue({ status: 'success', data: [VERSION_C] });
    renderSubPanel(null);

    await elegirReceta(user, RECETA_C.id);
    const selector = screen.getByTestId(RECIPE_VERSION_SELECT_TESTID);
    await waitFor(() => expect(selector).toBeEnabled());
    await user.click(selector);
    const opciones = await screen.findAllByTestId(`${RECIPE_VERSION_SELECT_TESTID}-option`);
    await user.click(await esperarInteractiva(opciones[1] as HTMLElement));
    await waitFor(() => expect(getRecipeActionMock).toHaveBeenLastCalledWith(VERSION_C.id));
    await elegirUnidad(user);
    await escribirCantidad(user, '2');
    await aplicar(user);

    expect(aplicado()).toMatchObject({ recipe: { id: RECETA_C.id }, recipeVersionId: VERSION_C.id });
  });

  it('R4: una línea de reparto añadida viaja con la receta, por su envase', async () => {
    const user = setupUser();
    renderSubPanel(null);

    await elegirReceta(user, RECETA_A.id);
    await elegirUnidad(user);
    await escribirCantidad(user, '40');
    await user.click(screen.getByTestId(PACKAGING_SELECT_TESTID));
    await user.click(await esperarInteractiva(await screen.findByTestId(PACKAGING_OPTION_TESTID)));
    await user.click(screen.getByTestId(ORDER_DISTRIBUTION_ADD_TESTID));
    await aplicar(user);

    const linea = aplicado();
    expect(linea.presentationLines).toHaveLength(1);
    expect(linea.presentationLines[0]).toMatchObject({
      packagingProductId: ENVASE_DEL_CATALOGO.id,
      packages: '1',
    });
  });

  it('R3: elegir una receta con imagen la enseña en el hueco de la imagen', async () => {
    const user = setupUser();
    renderSubPanel(null);

    expect(screen.getByTestId(ORDER_RECIPE_IMAGE_TESTID)).toHaveAttribute('src', MISSING_IMAGE_SRC);
    await elegirReceta(user, RECETA_B.id);

    expect(screen.getByTestId(ORDER_RECIPE_IMAGE_TESTID)).toHaveAttribute('src', RECETA_B.imageUrl);
    await waitFor(() => expect(getRecipeActionMock).toHaveBeenCalledWith(RECETA_B.id));
  });
});

describe('descartar (R5)', () => {
  it('R5: «Descartar» y «Volver al pedido» cierran sin devolver la receta', async () => {
    const user = setupUser();
    const [linea] = borradorDe(lineaPedido());
    renderSubPanel(linea as OrderLineDraft);

    await escribirCantidad(user, '99');
    await user.click(screen.getByTestId(ORDER_LINE_SHEET_DISCARD_TESTID));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    await user.click(screen.getByTestId(ORDER_LINE_SHEET_BACK_TESTID));
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId(ORDER_LINE_SHEET_BACK_TESTID)).toHaveAccessibleName('Volver al pedido');
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe('receta repetida (R8)', () => {
  it('R8: no deja aplicar la misma original que otra receta activa y dice por qué', async () => {
    const user = setupUser();
    const lineas = borradorDe(lineaPedido(), lineaB());
    renderSubPanel(null, lineas);

    await elegirReceta(user, RECETA_B.id);
    await elegirUnidad(user);
    await escribirCantidad(user, '5');
    await aplicar(user);

    expect(await screen.findByTestId(`${RECIPE_PICKER_TESTID}-error`)).toHaveTextContent(
      'Esta receta, o una de sus versiones, ya está en el pedido.',
    );
    expect(onApply).not.toHaveBeenCalled();
  });

  it('R8: sí deja aplicarla si su única otra aparición está cancelada', async () => {
    const user = setupUser();
    const lineas = borradorDe(lineaPedido(), lineaB({ status: 'CANCELADO', cancellationReason: 'x' }));
    renderSubPanel(null, lineas);

    await elegirReceta(user, RECETA_B.id);
    await elegirUnidad(user);
    await escribirCantidad(user, '5');
    await aplicar(user);

    expect(aplicado().recipe.id).toBe(RECETA_B.id);
  });

  it('R8: editar una receta no choca consigo misma', async () => {
    const user = setupUser();
    const lineas = borradorDe(lineaPedido(), lineaB());
    renderSubPanel(lineas[1] as OrderLineDraft, lineas);

    await escribirCantidad(user, '31');
    await aplicar(user);

    expect(aplicado()).toMatchObject({ recipe: { id: RECETA_B.id }, recipeVersionId: VERSION_B });
  });
});

describe('quitar receta (R11)', () => {
  it('R11: una guardada en PENDIENTE o BLOQUEADO ofrece «Quitar receta» y la quita', async () => {
    const user = setupUser();
    for (const status of ['PENDIENTE', 'BLOQUEADO'] as const) {
      const [linea] = borradorDe(lineaPedido({ status }));
      const { unmount } = renderSubPanel(linea as OrderLineDraft);
      const quitar = screen.getByTestId(ORDER_LINE_SHEET_REMOVE_TESTID);
      expect(quitar).toHaveTextContent('Quitar receta');
      await user.click(quitar);
      expect(onRemove).toHaveBeenLastCalledWith(LINEA_A_ID);
      unmount();
    }
  });

  it('R11: una guardada EN_CURSO no lo ofrece, ni una receta que aún se está añadiendo', () => {
    const [linea] = borradorDe(lineaPedido({ status: 'EN_CURSO' }));
    const { unmount } = renderSubPanel(linea as OrderLineDraft);
    expect(screen.queryByTestId(ORDER_LINE_SHEET_REMOVE_TESTID)).toBeNull();
    unmount();

    renderSubPanel(null);
    expect(screen.queryByTestId(ORDER_LINE_SHEET_REMOVE_TESTID)).toBeNull();
  });
});

describe('precio de venta (R13)', () => {
  async function aplicarConPrecio(precio: string) {
    const user = setupUser();
    const [linea] = borradorDe(lineaPedido());
    renderSubPanel(linea as OrderLineDraft);
    await escribirPrecio(user, precio);
    await aplicar(user);
  }

  it('R13: vacío es «sin precio»', async () => {
    await aplicarConPrecio('');
    expect(aplicado().salePrice).toBe('');
  });

  it('R13: 0 es un precio válido', async () => {
    await aplicarConPrecio('0');
    expect(aplicado().salePrice).toBe('0');
  });

  it('R13: un negativo se marca sin aplicar', async () => {
    await aplicarConPrecio('-1');
    expect(await screen.findByTestId('order-error-salePrice')).toHaveTextContent(
      'Ingresa un número mayor o igual a 0, con hasta 4 decimales.',
    );
    expect(onApply).not.toHaveBeenCalled();
  });

  it('R13: un decimal mal formado (cinco decimales) se marca sin aplicar', async () => {
    await aplicarConPrecio('1.12345');
    expect(await screen.findByTestId('order-error-salePrice')).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe('plataformas y animación (R44, R46)', () => {
  it('R44: en el teléfono el sub-panel ocupa todo el ancho; en tablet y escritorio se apila a la derecha', () => {
    renderSubPanel(null);
    const sub = screen.getByTestId(ORDER_LINE_SHEET_TESTID);
    expect(sub).toHaveAttribute('data-side', 'right');
    expect(sub).toHaveClass('w-full', 'data-[side=right]:w-full');
  });

  it('R46: el sub-panel entra con la misma curva y duración que el panel', () => {
    renderSubPanel(null);
    expect(screen.getByTestId(ORDER_LINE_SHEET_TESTID)).toHaveClass(
      'duration-(--dur-slow)',
      'ease-(--ease-enter)',
    );
  });

  it('R44: los botones del pie tienen objetivo táctil de 44 px', () => {
    const [linea] = borradorDe(lineaPedido());
    renderSubPanel(linea as OrderLineDraft);
    for (const testId of [
      ORDER_LINE_SHEET_REMOVE_TESTID,
      ORDER_LINE_SHEET_DISCARD_TESTID,
      ORDER_LINE_SHEET_APPLY_TESTID,
      ORDER_LINE_SHEET_BACK_TESTID,
    ]) {
      expect(screen.getByTestId(testId)).toHaveClass('min-h-11', 'min-w-11');
    }
  });
});
