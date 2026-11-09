// QT-314 T14 — El panel del pedido con varias recetas: tabla de recetas, sub-panel y guardado.
//
// El panel se monta dentro de un `<Sheet>` abierto, que es su entorno real. Lo que se afirma del
// guardado es el candidato que llega a la acción, no el estado de React. El pedido de la edición
// tiene dos recetas y unos campos planos que no son de ninguna de ellas.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_CREATE_OPEN_TESTID,
  ORDER_FORM_ADD_LINE_TESTID,
  ORDER_FORM_CANCEL_TESTID,
  ORDER_FORM_ERROR_TESTID,
  ORDER_FORM_LINES_COUNT_TESTID,
  ORDER_FORM_LINES_ERROR_TESTID,
  ORDER_FORM_SUBMIT_TESTID,
  ORDER_FORM_TESTID,
  ORDER_FORM_TITLE_TESTID,
  ORDER_LINE_SHEET_BACK_TESTID,
  ORDER_LINE_SHEET_DISCARD_TESTID,
  ORDER_LINE_SHEET_REMOVE_TESTID,
  ORDER_LINE_SHEET_TITLE_TESTID,
  ORDER_LINES_COST_TESTID,
  ORDER_LINES_EDIT_TESTID,
  ORDER_LINES_EMPTY_TESTID,
  ORDER_LINES_READ_ONLY_TESTID,
  ORDER_LINES_ROW_TESTID,
  ORDER_LINES_TABLE_TESTID,
  ORDER_LINES_TOTAL_TESTID,
  ORDER_LINES_WITHOUT_PRICE_TESTID,
  ORDER_PRIORITY_OPTION_TESTID,
  ORDER_PRIORITY_SELECT_TESTID,
  ORDER_RECIPE_IMAGE_TESTID,
  OrderForm,
  OrderSheet,
  RECIPE_PICKER_TESTID,
} from '@/app/(private)/pedidos/components';
import { Sheet } from '@/components/ui/sheet';
import {
  DEFAULT_ORDER_PRIORITY,
  ORDER_PRIORITY_VALUES,
  formatOrderNumber,
  type OrderSummary,
} from '@/lib/modules/pedidos';
import type {
  CreateOrderFormState,
  UpdateOrderFormState,
} from '@/lib/modules/pedidos/adapters/driving/order-actions';
import type {
  RecipeQueryResult,
  RecipeVersionListResult,
} from '@/lib/modules/recetas/adapters/driving/recipe-actions';
import {
  ENVASE,
  LINEA_A_ID,
  LINEA_B_ID,
  PEDIDO_ID,
  RECETA_A,
  RECETA_B,
  RECETA_C,
  RECETAS,
  UNIDAD,
  UNIDADES,
  VERSION_B,
  abrirAnadirReceta,
  anadirReceta,
  aplicar,
  elegirReceta,
  escribirCantidad,
  lineaB,
  lineaPedido,
  pedidoDeDosRecetas,
  recetaDetalle,
  subPanel,
} from '../../helpers/order-form-ui';
import { setupUser } from '../../helpers/user-event';

const {
  createOrderActionMock,
  updateOrderActionMock,
  getRecipeActionMock,
  listRecipeVersionsActionMock,
  toastSuccessMock,
  refreshMock,
  prohibida,
} = vi.hoisted(() => ({
  createOrderActionMock: vi.fn<(input: unknown) => Promise<CreateOrderFormState>>(),
  updateOrderActionMock: vi.fn<(id: string, input: unknown) => Promise<UpdateOrderFormState>>(),
  getRecipeActionMock: vi.fn<(id: string) => Promise<RecipeQueryResult>>(),
  listRecipeVersionsActionMock: vi.fn<(id: string) => Promise<RecipeVersionListResult>>(),
  toastSuccessMock: vi.fn(),
  refreshMock: vi.fn(),
  prohibida: (nombre: string) => () => {
    throw new Error(`${nombre} no debe invocarse desde el panel del pedido`);
  },
}));

vi.mock('sonner', () => ({ toast: { success: toastSuccessMock, error: vi.fn() } }));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: refreshMock,
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('@/lib/modules/pedidos/adapters/driving/order-actions', () => ({
  createOrderAction: createOrderActionMock,
  updateOrderAction: updateOrderActionMock,
  searchOrderCustomersAction: vi.fn(async () => ({
    status: 'success',
    data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 },
  })),
  cancelOrderAction: vi.fn(prohibida('cancelOrderAction')),
  cancelOrderLineAction: vi.fn(prohibida('cancelOrderLineAction')),
  deleteOrderAction: vi.fn(prohibida('deleteOrderAction')),
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
  listProductsAction: vi.fn(async () => ({
    status: 'success',
    data: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 },
  })),
}));

const onSaved = vi.fn();

function renderPanel(order?: OrderSummary) {
  return render(
    <Sheet open>
      <OrderForm order={order} recipes={RECETAS} units={UNIDADES} bridge={null} onSaved={onSaved} />
    </Sheet>,
  );
}

function filas(): HTMLElement[] {
  return screen.queryAllByTestId(ORDER_LINES_ROW_TESTID);
}

function nombresDeLasFilas(): string[] {
  return filas().map((fila) => within(fila).getAllByText(/./)[0]?.textContent ?? '');
}

function guardar(): HTMLElement {
  return screen.getByTestId(ORDER_FORM_SUBMIT_TESTID);
}

function editarFila(indice: number): HTMLElement {
  const fila = filas()[indice];
  if (fila === undefined) throw new Error(`no hay fila ${indice}`);
  return within(fila).getByTestId(ORDER_LINES_EDIT_TESTID);
}

type Candidato = {
  lines: { id?: string; recipeId: string; recipeVersionId: string | null; quantity: string; unitId: string; presentationLines: unknown[]; salePrice: string }[];
  priority: string;
  customerId: string;
  confirmBlocked: boolean;
};

function candidatoDelAlta(llamada = 0): Candidato {
  return createOrderActionMock.mock.calls[llamada]?.[0] as Candidato;
}

function candidatoDeLaEdicion(llamada = 0): Candidato {
  return updateOrderActionMock.mock.calls[llamada]?.[1] as Candidato;
}

beforeEach(() => {
  vi.clearAllMocks();
  createOrderActionMock.mockResolvedValue({
    status: 'success',
    id: crypto.randomUUID(),
    numberText: formatOrderNumber({ year: 2026, sequence: 43 }),
  });
  updateOrderActionMock.mockResolvedValue({ status: 'success' });
  getRecipeActionMock.mockImplementation(async (id) => ({ status: 'success', data: recetaDetalle(id) }));
  listRecipeVersionsActionMock.mockResolvedValue({ status: 'success', data: [] });
});

afterEach(() => {
  cleanup();
});

describe('alta vacía (R1)', () => {
  it('R1: cliente, prioridad, tabla vacía con su aviso, «Añadir receta» y «Guardar pedido» deshabilitado', () => {
    renderPanel();

    expect(screen.getByTestId(ORDER_FORM_TITLE_TESTID)).toHaveTextContent('Nuevo pedido');
    expect(screen.getByRole('combobox', { name: 'Cliente (opcional)' })).toBeInTheDocument();
    expect(screen.getByTestId(ORDER_PRIORITY_SELECT_TESTID)).toBeInTheDocument();
    expect(screen.getByTestId(ORDER_LINES_EMPTY_TESTID)).toHaveTextContent(
      'El pedido aún no tiene recetas. Añade al menos una.',
    );
    expect(screen.queryByTestId(ORDER_LINES_TABLE_TESTID)).toBeNull();
    expect(screen.getByTestId(ORDER_FORM_LINES_COUNT_TESTID)).toHaveTextContent('0');
    expect(screen.getByTestId(ORDER_FORM_ADD_LINE_TESTID)).toHaveTextContent('Añadir receta');
    expect(guardar()).toHaveTextContent('Guardar pedido');
    expect(guardar()).toBeDisabled();
  });

  it('R1: el panel no tiene campos de receta: la receta se elige en el sub-panel', () => {
    renderPanel();
    expect(screen.queryByTestId(RECIPE_PICKER_TESTID)).toBeNull();
    expect(screen.queryByTestId('order-field-quantity')).toBeNull();
  });

  it('R1: la prioridad ofrece las cuatro del contrato y arranca en la de defecto', async () => {
    const user = setupUser();
    renderPanel();

    await user.click(screen.getByTestId(ORDER_PRIORITY_SELECT_TESTID));

    const opciones = await screen.findAllByTestId(ORDER_PRIORITY_OPTION_TESTID);
    expect(opciones.map((opcion) => opcion.getAttribute('data-value'))).toEqual([...ORDER_PRIORITY_VALUES]);
    expect(
      (screen.getByTestId(ORDER_FORM_TESTID) as HTMLFormElement).querySelector('input[name="priority"]'),
    ).toHaveValue(DEFAULT_ORDER_PRIORITY);
  });
});

describe('tabla de recetas (R2)', () => {
  it('R2: una fila por receta, en el orden del pedido, con fórmula, reparto, cantidad y unidad, precio y estado', () => {
    renderPanel(pedidoDeDosRecetas([lineaB({ position: 1 }), lineaPedido({ position: 0 })]));

    expect(screen.getByTestId(ORDER_FORM_TITLE_TESTID)).toHaveTextContent('Editar pedido 2026-');
    const [primera, segunda] = filas();
    expect(filas()).toHaveLength(2);
    expect(primera).toHaveTextContent(RECETA_A.name);
    expect(primera).toHaveTextContent('3 × Envase 5 L');
    expect(primera).toHaveTextContent('15 L');
    expect(primera).toHaveTextContent('120.50');
    expect(primera).toHaveTextContent('Pendiente');
    expect(segunda).toHaveTextContent(RECETA_B.name);
    expect(segunda).toHaveTextContent('Sin presentación');
    expect(segunda).toHaveTextContent('30 L');
    expect(segunda).toHaveTextContent('Sin precio');
    expect(segunda).toHaveTextContent('En fabricación');
    expect(within(primera as HTMLElement).getByTestId(ORDER_LINES_EDIT_TESTID)).toHaveAccessibleName(
      `Editar ${RECETA_A.name}`,
    );
    expect(within(segunda as HTMLElement).getByTestId(ORDER_LINES_EDIT_TESTID)).toBeInTheDocument();
  });

  it('R2: debajo, el total del precio con cuántas no lo tienen y el coste estimado', () => {
    renderPanel(pedidoDeDosRecetas());

    expect(screen.getByTestId(ORDER_LINES_TOTAL_TESTID)).toHaveTextContent('120.50');
    expect(screen.getByTestId(ORDER_LINES_WITHOUT_PRICE_TESTID)).toHaveTextContent('1 sin precio');
    expect(screen.getByTestId(ORDER_LINES_COST_TESTID)).toHaveTextContent('65.00');
  });

  it('R2: ningún dato de receta sale de los campos planos del pedido', () => {
    renderPanel(pedidoDeDosRecetas());
    const panel = screen.getByTestId(ORDER_FORM_TESTID);
    expect(panel).not.toHaveTextContent('PLANO NO USAR');
    expect(panel).not.toHaveTextContent('999');
  });
});

describe('sub-panel de una receta (R3)', () => {
  it('R3: «Añadir receta» abre el sub-panel vacío encima del panel, con «Descartar» y «Aplicar»', async () => {
    const user = setupUser();
    renderPanel();

    await abrirAnadirReceta(user);

    const sub = subPanel() as HTMLElement;
    expect(within(sub).getByTestId(ORDER_LINE_SHEET_TITLE_TESTID)).toHaveTextContent('Añadir receta');
    expect(within(sub).getByText('Los cambios se guardan con «Guardar pedido».')).toBeInTheDocument();
    expect(within(sub).getByTestId(RECIPE_PICKER_TESTID)).toHaveValue('');
    expect(within(sub).getByTestId('order-field-quantity')).toHaveValue(null);
    expect(within(sub).getByTestId(ORDER_RECIPE_IMAGE_TESTID)).toBeInTheDocument();
    expect(within(sub).getByTestId(ORDER_LINE_SHEET_DISCARD_TESTID)).toHaveTextContent('Descartar');
    expect(within(sub).getByRole('button', { name: 'Aplicar' })).toBeInTheDocument();
    expect(within(sub).queryByTestId(ORDER_LINE_SHEET_REMOVE_TESTID)).toBeNull();
  });

  it('R3: el «Editar» de una receta abre el sub-panel con los valores de esa receta', async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas());

    await user.click(editarFila(1));

    const sub = (await screen.findByTestId('order-line-sheet')) as HTMLElement;
    expect(within(sub).getByTestId(ORDER_LINE_SHEET_TITLE_TESTID)).toHaveTextContent('Editar receta');
    expect(within(sub).getByTestId(RECIPE_PICKER_TESTID)).toHaveValue(RECETA_B.name);
    expect(within(sub).getByTestId('recipe-version-select-value')).toHaveValue(VERSION_B);
    expect(within(sub).getByTestId('order-field-quantity')).toHaveValue(30);
    expect(within(sub).getByTestId('order-field-salePrice')).toHaveValue(null);
    expect(within(sub).getByTestId('presentation-unit-select')).toHaveTextContent('L');
    expect(within(sub).getByTestId(ORDER_RECIPE_IMAGE_TESTID)).toHaveAttribute('src', RECETA_B.imageUrl);
    await waitFor(() => expect(getRecipeActionMock).toHaveBeenCalledWith(VERSION_B));
  });
});

describe('aplicar y descartar (R4, R5)', () => {
  it('R4: una receta nueva aplicada queda al final de la tabla y el sub-panel se cierra', async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas());

    await anadirReceta(user, { recetaId: RECETA_C.id, cantidad: '7' });

    expect(filas()).toHaveLength(3);
    expect(filas()[2]).toHaveTextContent(RECETA_C.name);
    expect(filas()[2]).toHaveTextContent('7 L');
    expect(screen.getByTestId(ORDER_FORM_LINES_COUNT_TESTID)).toHaveTextContent('3');
  });

  it('R4: una receta editada se queda en su sitio con los valores nuevos', async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas());

    await user.click(editarFila(0));
    await screen.findByTestId('order-line-sheet');
    await escribirCantidad(user, '22');
    await aplicar(user);
    await waitFor(() => expect(subPanel()).toBeNull());

    expect(filas()[0]).toHaveTextContent(RECETA_A.name);
    expect(filas()[0]).toHaveTextContent('22 L');
    expect(filas()[1]).toHaveTextContent(RECETA_B.name);
  });

  it('R4: si un campo no pasa el esquema de una receta, se marca y el sub-panel sigue abierto con lo escrito', async () => {
    const user = setupUser();
    renderPanel();

    await abrirAnadirReceta(user);
    await escribirCantidad(user, '5');
    await aplicar(user);

    expect(await screen.findByTestId(`${RECIPE_PICKER_TESTID}-error`)).toBeInTheDocument();
    expect(screen.getByTestId('presentation-error-unit')).toBeInTheDocument();
    expect(subPanel()).not.toBeNull();
    expect(screen.getByTestId('order-field-quantity')).toHaveValue(5);
    expect(filas()).toHaveLength(0);
  });

  it('R5: «Descartar» cierra el sub-panel y deja la tabla como estaba', async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas());

    await user.click(editarFila(0));
    await screen.findByTestId('order-line-sheet');
    await escribirCantidad(user, '99');
    await user.click(screen.getByTestId(ORDER_LINE_SHEET_DISCARD_TESTID));
    await waitFor(() => expect(subPanel()).toBeNull());

    expect(filas()[0]).toHaveTextContent('15 L');
    expect(filas()).toHaveLength(2);
  });

  it('R5: «Volver al pedido» tampoco añade la receta nueva', async () => {
    const user = setupUser();
    renderPanel();

    await abrirAnadirReceta(user);
    await elegirReceta(user, RECETA_A.id);
    await user.click(screen.getByTestId(ORDER_LINE_SHEET_BACK_TESTID));
    await waitFor(() => expect(subPanel()).toBeNull());

    expect(screen.getByTestId(ORDER_FORM_TESTID)).toBeInTheDocument();
    expect(filas()).toHaveLength(0);
    expect(screen.getByTestId(ORDER_LINES_EMPTY_TESTID)).toBeInTheDocument();
  });
});

describe('nada se escribe hasta guardar (R6)', () => {
  it('R6: añadir, editar y quitar recetas no llama a ninguna acción de guardado', async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas());

    await anadirReceta(user, { recetaId: RECETA_C.id });
    await user.click(editarFila(0));
    await screen.findByTestId('order-line-sheet');
    await escribirCantidad(user, '11');
    await aplicar(user);
    await waitFor(() => expect(subPanel()).toBeNull());
    await user.click(editarFila(2));
    await user.click(await screen.findByTestId(ORDER_LINE_SHEET_REMOVE_TESTID));
    await waitFor(() => expect(subPanel()).toBeNull());

    expect(createOrderActionMock).not.toHaveBeenCalled();
    expect(updateOrderActionMock).not.toHaveBeenCalled();
  });

  it('R6: cerrar el panel sin guardar pierde el borrador; al volver a abrirlo arranca vacío', async () => {
    const user = setupUser();
    render(<OrderSheet recipes={RECETAS} units={UNIDADES} bridge={null} />);

    await user.click(screen.getByTestId(ORDER_CREATE_OPEN_TESTID));
    await screen.findByTestId(ORDER_FORM_TESTID);
    await anadirReceta(user);
    expect(filas()).toHaveLength(1);

    await user.click(screen.getByTestId(ORDER_FORM_CANCEL_TESTID));
    await waitFor(() => expect(screen.queryByTestId(ORDER_FORM_TESTID)).toBeNull());
    await user.click(screen.getByTestId(ORDER_CREATE_OPEN_TESTID));
    await screen.findByTestId(ORDER_FORM_TESTID);

    expect(filas()).toHaveLength(0);
    expect(createOrderActionMock).not.toHaveBeenCalled();
  });
});

describe('el candidato que se envía (R7)', () => {
  it('R7: el alta envía en una sola operación la prioridad, el cliente y las recetas nuevas en su orden, sin id', async () => {
    const user = setupUser();
    renderPanel();

    await anadirReceta(user, { recetaId: RECETA_A.id, cantidad: '10', precio: '50' });
    await anadirReceta(user, { recetaId: RECETA_C.id, cantidad: '4' });
    await user.click(guardar());

    await waitFor(() => expect(createOrderActionMock).toHaveBeenCalledTimes(1));
    expect(candidatoDelAlta()).toEqual({
      lines: [
        {
          recipeId: RECETA_A.id,
          recipeVersionId: null,
          quantity: '10',
          unitId: UNIDAD.id,
          presentationLines: [],
          salePrice: '50',
        },
        {
          recipeId: RECETA_C.id,
          recipeVersionId: null,
          quantity: '4',
          unitId: UNIDAD.id,
          presentationLines: [],
          salePrice: '',
        },
      ],
      priority: DEFAULT_ORDER_PRIORITY,
      customerId: '',
      confirmBlocked: false,
    });
    expect(updateOrderActionMock).not.toHaveBeenCalled();
  });

  it('R7: la edición envía las guardadas con su id, las nuevas sin él, y no envía las canceladas', async () => {
    const user = setupUser();
    const cancelada = lineaPedido({
      id: '50000000-0000-4000-8000-00000000000c',
      position: 2,
      recipeId: RECETA_C.id,
      originalRecipeId: RECETA_C.id,
      recipeName: RECETA_C.name,
      status: 'CANCELADO',
      cancellationReason: 'No hace falta',
    });
    renderPanel(pedidoDeDosRecetas([lineaPedido(), lineaB(), cancelada]));

    await anadirReceta(user, { recetaId: RECETA_C.id, cantidad: '8' });
    await user.click(guardar());

    await waitFor(() => expect(updateOrderActionMock).toHaveBeenCalledTimes(1));
    expect(updateOrderActionMock.mock.calls[0]?.[0]).toBe(PEDIDO_ID);
    const candidato = candidatoDeLaEdicion();
    expect(candidato.lines.map((line) => line.id)).toEqual([LINEA_A_ID, LINEA_B_ID, undefined]);
    expect(candidato.lines[0]).toEqual({
      id: LINEA_A_ID,
      recipeId: RECETA_A.id,
      recipeVersionId: null,
      quantity: '15',
      unitId: UNIDAD.id,
      presentationLines: [{ packagingProductId: ENVASE, packages: 3 }],
      salePrice: '120.5',
    });
    expect(candidato.lines[1]).toMatchObject({ recipeId: RECETA_B.id, recipeVersionId: VERSION_B });
    expect(candidato.lines[2]).toMatchObject({ recipeId: RECETA_C.id, quantity: '8' });
    // La prioridad viaja desde su campo: el pedido la tiene en ALTA y no es la de defecto.
    expect(candidato.priority).toBe('ALTA');
    expect(createOrderActionMock).not.toHaveBeenCalled();
  });

  it('R7: con éxito, el panel avisa a quien lo abrió para cerrar, avisar y refrescar', async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas());

    await user.click(guardar());

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('R7: dentro de `OrderSheet`, guardar cierra el panel, avisa con un toast y refresca el listado', async () => {
    const user = setupUser();
    render(<OrderSheet recipes={RECETAS} units={UNIDADES} bridge={null} />);

    await user.click(screen.getByTestId(ORDER_CREATE_OPEN_TESTID));
    await anadirReceta(user);
    await user.click(guardar());

    await waitFor(() => expect(screen.queryByTestId(ORDER_FORM_TESTID)).toBeNull());
    expect(toastSuccessMock).toHaveBeenCalledWith('Pedido creado.');
    expect(refreshMock).toHaveBeenCalled();
  });
});

describe('solo lectura y añadir en la edición (R10)', () => {
  const terminada = () =>
    lineaPedido({ status: 'TERMINADO', salePrice: '10.0000', quantity: '12.5000' });

  it('R10: una receta guardada en un estado no editable sale con «Solo lectura» y sin «Editar»', () => {
    renderPanel(pedidoDeDosRecetas([terminada(), lineaB()], { status: 'PARCIAL' }));

    const [primera, segunda] = filas();
    expect(within(primera as HTMLElement).getByTestId(ORDER_LINES_READ_ONLY_TESTID)).toHaveTextContent(
      'Solo lectura',
    );
    expect(within(primera as HTMLElement).queryByTestId(ORDER_LINES_EDIT_TESTID)).toBeNull();
    expect(within(segunda as HTMLElement).getByTestId(ORDER_LINES_EDIT_TESTID)).toBeInTheDocument();
  });

  it('R10: «Añadir receta» está disponible en PARCIAL y la de solo lectura viaja sin cambios', async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas([terminada(), lineaB()], { status: 'PARCIAL' }));

    await anadirReceta(user, { recetaId: RECETA_C.id });
    await user.click(guardar());

    await waitFor(() => expect(updateOrderActionMock).toHaveBeenCalledTimes(1));
    expect(candidatoDeLaEdicion().lines[0]).toEqual({
      id: LINEA_A_ID,
      recipeId: RECETA_A.id,
      recipeVersionId: null,
      quantity: '12.5000',
      unitId: UNIDAD.id,
      presentationLines: [{ packagingProductId: ENVASE, packages: 3 }],
      salePrice: '10.0000',
    });
    expect(candidatoDeLaEdicion().lines).toHaveLength(3);
  });
});

describe('quitar una receta (R11)', () => {
  it('R11: «Quitar receta» de una guardada en PENDIENTE la saca de la tabla', async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas());

    await user.click(editarFila(0));
    await user.click(await screen.findByTestId(ORDER_LINE_SHEET_REMOVE_TESTID));
    await waitFor(() => expect(subPanel()).toBeNull());

    expect(filas()).toHaveLength(1);
    expect(filas()[0]).toHaveTextContent(RECETA_B.name);
  });

  it('R11: una guardada EN_CURSO no ofrece «Quitar receta»', async () => {
    const user = setupUser();
    renderPanel(pedidoDeDosRecetas());

    await user.click(editarFila(1));
    await screen.findByTestId('order-line-sheet');

    expect(screen.queryByTestId(ORDER_LINE_SHEET_REMOVE_TESTID)).toBeNull();
  });

  it('R11: una receta nueva del borrador también se puede quitar', async () => {
    const user = setupUser();
    renderPanel();

    await anadirReceta(user);
    await user.click(editarFila(0));
    await user.click(await screen.findByTestId(ORDER_LINE_SHEET_REMOVE_TESTID));
    await waitFor(() => expect(subPanel()).toBeNull());

    expect(filas()).toHaveLength(0);
    expect(guardar()).toBeDisabled();
  });
});

describe('canceladas (R12)', () => {
  const cancelada = (overrides = {}) =>
    lineaPedido({ status: 'CANCELADO', cancellationReason: 'Sin stock', ...overrides });

  it('R12: una cancelada sale en solo lectura y no suma al total ni al coste', () => {
    renderPanel(pedidoDeDosRecetas([cancelada(), lineaB({ salePrice: '30.0000' })], { status: 'PARCIAL' }));

    const [primera] = filas();
    expect(primera).toHaveTextContent('Cancelado');
    expect(within(primera as HTMLElement).getByTestId(ORDER_LINES_READ_ONLY_TESTID)).toBeInTheDocument();
    expect(screen.getByTestId(ORDER_LINES_TOTAL_TESTID)).toHaveTextContent('30.00');
    expect(screen.queryByTestId(ORDER_LINES_WITHOUT_PRICE_TESTID)).toBeNull();
    expect(screen.getByTestId(ORDER_LINES_COST_TESTID)).toHaveTextContent('25.00');
  });

  it('R12: con solo canceladas sale el aviso de R1 y «Guardar pedido» sigue deshabilitado', () => {
    renderPanel(pedidoDeDosRecetas([cancelada()], { status: 'CANCELADO' }));

    expect(filas()).toHaveLength(1);
    expect(screen.getByTestId(ORDER_LINES_EMPTY_TESTID)).toBeInTheDocument();
    expect(guardar()).toBeDisabled();
  });
});

describe('precio y total (R13)', () => {
  it('R13: el total es la suma exacta de los precios, el 0 cuenta como precio y dice cuántas no lo tienen', async () => {
    const user = setupUser();
    renderPanel();

    await anadirReceta(user, { recetaId: RECETA_A.id, precio: '0.1' });
    await anadirReceta(user, { recetaId: RECETA_B.id, precio: '0.2' });
    await anadirReceta(user, { recetaId: RECETA_C.id, precio: '0' });

    expect(screen.getByTestId(ORDER_LINES_TOTAL_TESTID)).toHaveTextContent('0.30');
    expect(screen.queryByTestId(ORDER_LINES_WITHOUT_PRICE_TESTID)).toBeNull();
  });

  it('R13: sin ningún precio el total es el marcador de ausencia y cuenta las que no lo tienen', async () => {
    const user = setupUser();
    renderPanel();

    await anadirReceta(user, { recetaId: RECETA_A.id });

    expect(screen.getByTestId(ORDER_LINES_TOTAL_TESTID)).toHaveAccessibleName('Sin dato');
    expect(screen.getByTestId(ORDER_LINES_WITHOUT_PRICE_TESTID)).toHaveTextContent('1 sin precio');
  });
});

describe('rechazo sin posiciones de receta (R50)', () => {
  const sinCambios = {
    status: 'error',
    code: 'invalid_transition',
    message: 'El pedido no admite ese cambio de estado.',
    linePositions: [],
  } as const;

  it('R50: muestra el mensaje del catálogo, el panel sigue abierto y el borrador intacto', async () => {
    const user = setupUser();
    updateOrderActionMock.mockResolvedValue(sinCambios);
    renderPanel(pedidoDeDosRecetas());

    await user.click(guardar());

    const region = await screen.findByTestId(ORDER_FORM_ERROR_TESTID);
    expect(region).toHaveTextContent('El pedido no admite ese cambio de estado.');
    expect(screen.queryByTestId(ORDER_FORM_LINES_ERROR_TESTID)).toBeNull();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByTestId(ORDER_FORM_TESTID)).toBeInTheDocument();
    expect(nombresDeLasFilas()).toHaveLength(2);
    expect(filas()[0]).toHaveTextContent('15 L');
  });

  it('R50: no hay regla propia de «sin cambios»: «Guardar pedido» sigue habilitado y vuelve a enviar', async () => {
    const user = setupUser();
    updateOrderActionMock.mockResolvedValue(sinCambios);
    renderPanel(pedidoDeDosRecetas([lineaB({ status: 'TERMINADO' })], { status: 'PARCIAL' }));

    expect(guardar()).toBeEnabled();
    await user.click(guardar());
    await screen.findByTestId(ORDER_FORM_ERROR_TESTID);
    expect(guardar()).toBeEnabled();
    await user.click(guardar());

    await waitFor(() => expect(updateOrderActionMock).toHaveBeenCalledTimes(2));
  });

  it('R50: un fallo inesperado enseña su identificador en la misma región', async () => {
    const user = setupUser();
    createOrderActionMock.mockResolvedValue({
      status: 'error',
      code: 'unexpected',
      message: 'Algo falló.',
      reference: 'ref-123',
      linePositions: [],
    });
    renderPanel();

    await anadirReceta(user);
    await user.click(guardar());

    expect(await screen.findByTestId(ORDER_FORM_ERROR_TESTID)).toHaveTextContent('ref-123');
  });
});
