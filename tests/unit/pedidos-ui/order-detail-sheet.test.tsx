// El detalle de solo lectura de un pedido con varias recetas.
//
// El barrel de la ruta arrastra la sección, que importa las actions de `pedidos`; se sustituyen
// por dobles que fallan si se les llama: el detalle no lee ni escribe nada.

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_DETAIL_EDIT_TESTID,
  ORDER_DETAIL_LINE_TESTID,
  ORDER_DETAIL_SHEET_TESTID,
  ORDER_DETAIL_SUMMARY_TESTID,
  OrderDetailSheet,
} from '@/app/(private)/pedidos/components';
import { ORDER_PROGRESS_TESTID } from '@/components/shared/order-progress';
import type { OrderResponsible } from '@/lib/modules/asignaciones';
import type {
  OrderLineView,
  OrderPresentationLineView,
  OrderSummary,
} from '@/lib/modules/pedidos';
import { setupUser } from '../../helpers/user-event';

vi.mock('@/lib/modules/pedidos/adapters/driving/order-actions', () => {
  const noDebeInvocarse = (nombre: string) => () => {
    throw new Error(`${nombre} no debe invocarse desde el detalle`);
  };
  return {
    listOrdersAction: vi.fn(noDebeInvocarse('listOrdersAction')),
    getOrderAction: vi.fn(noDebeInvocarse('getOrderAction')),
    createOrderAction: vi.fn(noDebeInvocarse('createOrderAction')),
    updateOrderAction: vi.fn(noDebeInvocarse('updateOrderAction')),
    cancelOrderAction: vi.fn(noDebeInvocarse('cancelOrderAction')),
    deleteOrderAction: vi.fn(noDebeInvocarse('deleteOrderAction')),
  };
});

afterEach(cleanup);

const ORDER_ID = '11111111-1111-4111-8111-111111111111';

function reparto(packagingName: string, packages: number): OrderPresentationLineView {
  return {
    presentationId: `p-${packagingName}`,
    presentationName: packagingName,
    packages,
    packagingProductId: null,
    packagingName,
    presentationContent: '1.0000',
    presentationUnitLabel: 'L',
  };
}

function receta(overrides: Partial<OrderLineView> & Pick<OrderLineView, 'id' | 'position'>): OrderLineView {
  return {
    recipeId: `r-${overrides.id}`,
    recipeName: 'Receta',
    originalRecipeId: `r-${overrides.id}`,
    recipeVersion: null,
    recipeImageUrl: null,
    quantity: '10.0000',
    unitId: 'u-litro',
    unitLabel: 'L',
    status: 'PENDIENTE',
    cancellationReason: null,
    presentationLines: [],
    salePrice: null,
    ingredientsCost: null,
    packagingCost: null,
    actualCost: null,
    finishedAt: null,
    reservedAt: null,
    ...overrides,
  };
}

const CANCELADA = receta({
  id: 'l-suavizante',
  position: 0,
  recipeName: 'Suavizante lavanda',
  status: 'CANCELADO',
  cancellationReason: 'El cliente ya no lo necesita',
  quantity: '5.0000',
  salePrice: '999.0000',
  ingredientsCost: '500.0000',
  presentationLines: [reparto('Bidón 5 L', 1)],
});

const TERMINADA = receta({
  id: 'l-detergente',
  position: 1,
  recipeName: 'Detergente cítrico',
  status: 'TERMINADO',
  quantity: '20.0000',
  salePrice: '120.0000',
  ingredientsCost: '50.0000',
  actualCost: '48.2500',
  presentationLines: [reparto('Garrafa 4 L', 5)],
});

const SIN_PRECIO = receta({
  id: 'l-jabon',
  position: 2,
  recipeName: 'Jabón neutro',
  status: 'EN_CURSO',
  quantity: '12.5000',
  unitLabel: 'kg',
  salePrice: null,
  ingredientsCost: '30.5000',
  presentationLines: [reparto('Bolsa 1 L', 12)],
});

function pedido(overrides: Partial<OrderSummary> = {}): OrderSummary {
  return {
    id: ORDER_ID,
    number: { year: 2026, sequence: 12 },
    numberText: '2026-0012',
    priority: 'ALTA',
    status: 'PARCIAL',
    cancellationReason: null,
    createdAt: new Date('2026-11-02T15:00:00.000Z'),
    updatedAt: new Date('2026-11-03T15:00:00.000Z'),
    createdBy: null,
    updatedBy: null,
    customer: { id: 'c-1', name: 'Lavandería Sol', isDeleted: false },
    lines: [CANCELADA, TERMINADA, SIN_PRECIO],
    progress: { total: 2, finished: 1 },
    salePriceTotal: '120.0000',
    linesWithoutPrice: 1,
    ingredientsCostTotal: '80.5000',
    actualCostTotal: null,
    pendingDelivery: { kind: 'not_packed' },
    ...overrides,
  };
}

const RESPONSABLES: readonly OrderResponsible[] = [
  { userId: 'u-ana', displayName: 'Ana Torres', origin: { kind: 'direct' } },
  { userId: 'u-luis', displayName: 'Luis Gómez', origin: { kind: 'direct' } },
];

function pintar(order: OrderSummary, onEdit = vi.fn()) {
  render(
    <OrderDetailSheet
      order={order}
      open
      onOpenChange={() => {}}
      responsibles={RESPONSABLES}
      onEdit={onEdit}
    />,
  );
  return { panel: screen.getByTestId(ORDER_DETAIL_SHEET_TESTID), onEdit };
}

function tarjeta(nombre: string): HTMLElement {
  return screen.getByRole('region', { name: nombre });
}

function campo(contenedor: HTMLElement, termino: string): HTMLElement {
  const dt = within(contenedor).getByText(termino, { selector: 'dt' });
  const dd = dt.nextElementSibling;
  if (!(dd instanceof HTMLElement)) throw new Error(`sin valor para ${termino}`);
  return dd;
}

describe('OrderDetailSheet', () => {
  it('R18: la cabecera nombra el pedido, el cliente y la fecha de solicitud', () => {
    const { panel } = pintar(pedido());

    expect(within(panel).getByRole('heading', { name: 'Pedido 2026-0012' })).toBeInTheDocument();
    expect(panel).toHaveTextContent('Lavandería Sol · solicitado el 2026-11-02');
  });

  it('R18: el resumen lleva estado, prioridad, avance, totales con «N sin precio» y responsables', () => {
    pintar(pedido());
    const resumen = screen.getByTestId(ORDER_DETAIL_SUMMARY_TESTID);

    expect(within(resumen).getByTestId('order-status')).toHaveAttribute('data-status', 'PARCIAL');
    expect(within(resumen).getByTestId('order-priority')).toHaveAttribute('data-priority', 'ALTA');
    expect(within(resumen).getByTestId(ORDER_PROGRESS_TESTID)).toHaveTextContent('1 de 2 terminadas');
    expect(within(resumen).getByRole('img', { name: '1 de 2 terminadas' })).toBeInTheDocument();

    const precio = campo(resumen, 'Precio de venta');
    expect(precio).toHaveTextContent('$120.00');
    expect(precio).toHaveTextContent('1 sin precio');
    expect(campo(resumen, 'Costo estimado')).toHaveTextContent('$80.50');
    expect(within(campo(resumen, 'Costo real')).getByLabelText('Sin dato')).toBeInTheDocument();

    const responsables = campo(resumen, 'Responsables');
    expect(within(responsables).getByRole('img', { name: 'Ana Torres' })).toBeInTheDocument();
    expect(within(responsables).getByRole('img', { name: 'Luis Gómez' })).toBeInTheDocument();
  });

  it('R18: hay una tarjeta por receta, canceladas incluidas, en su orden', () => {
    pintar(pedido());

    const tarjetas = screen.getAllByTestId(ORDER_DETAIL_LINE_TESTID);
    expect(tarjetas.map((t) => t.getAttribute('data-line-id'))).toEqual([
      'l-suavizante',
      'l-detergente',
      'l-jabon',
    ]);
  });

  it('R18: cada tarjeta lleva nombre, estado, cantidad con unidad, reparto, precio y costes', () => {
    pintar(pedido());

    const terminada = tarjeta('Detergente cítrico');
    expect(within(terminada).getByTestId('order-status')).toHaveAttribute('data-status', 'TERMINADO');
    expect(campo(terminada, 'Cantidad')).toHaveTextContent(/^20 L$/);
    expect(campo(terminada, 'Reparto')).toHaveTextContent('5 × Garrafa 4 L · 1 L');
    expect(campo(terminada, 'Precio')).toHaveTextContent('$120.00');
    expect(campo(terminada, 'Costo estimado')).toHaveTextContent('$50.00');
    expect(campo(terminada, 'Costo real')).toHaveTextContent('$48.25');
    expect(terminada).not.toHaveTextContent('Motivo de cancelación');

    const sinPrecio = tarjeta('Jabón neutro');
    expect(within(sinPrecio).getByTestId('order-status')).toHaveAttribute('data-status', 'EN_CURSO');
    expect(campo(sinPrecio, 'Cantidad')).toHaveTextContent(/^12\.5 kg$/);
    expect(within(campo(sinPrecio, 'Precio')).getByLabelText('Sin dato')).toBeInTheDocument();
    expect(campo(sinPrecio, 'Costo estimado')).toHaveTextContent('$30.50');
    expect(within(campo(sinPrecio, 'Costo real')).getByLabelText('Sin dato')).toBeInTheDocument();
  });

  it('R18: la receta cancelada enseña su estado y su motivo', () => {
    pintar(pedido());

    const cancelada = tarjeta('Suavizante lavanda');
    expect(within(cancelada).getByTestId('order-status')).toHaveAttribute('data-status', 'CANCELADO');
    expect(cancelada).toHaveTextContent('Motivo de cancelación: El cliente ya no lo necesita');
    expect(campo(cancelada, 'Cantidad')).toHaveTextContent(/^5 L$/);
  });

  it('R19: no ofrece ningún control que cambie el pedido salvo «Editar»', () => {
    const { panel } = pintar(pedido());

    const botones = within(panel).getAllByRole('button').map((boton) => boton.textContent?.trim());
    expect(botones.sort()).toEqual(['Cerrar', 'Close', 'Editar'].sort());
    for (const rol of ['textbox', 'combobox', 'checkbox', 'radio', 'spinbutton', 'menu', 'switch']) {
      expect(within(panel).queryAllByRole(rol)).toEqual([]);
    }
    expect(panel.querySelector('form')).toBeNull();
  });

  it('R9, R19: en PARCIAL «Editar» está habilitado y avisa a quien abrió el detalle', async () => {
    const user = setupUser();
    const { onEdit } = pintar(pedido());

    const editar = screen.getByTestId(ORDER_DETAIL_EDIT_TESTID);
    expect(editar).toBeEnabled();
    await user.click(editar);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('R9: en ENTREGADO «Editar» está deshabilitado', () => {
    pintar(pedido({ status: 'ENTREGADO', pendingDelivery: { kind: 'delivered' } }));

    expect(screen.getByRole('button', { name: 'Editar' })).toBeDisabled();
  });

  it('R9: en CANCELADO «Editar» está deshabilitado', () => {
    pintar(pedido({ status: 'CANCELADO' }));

    expect(screen.getByRole('button', { name: 'Editar' })).toBeDisabled();
  });
});

describe('OrderDetailSheet: plataformas (R44)', () => {
  it('R44: en el teléfono el detalle ocupa la pantalla entera; en tablet y escritorio se abre a la derecha', () => {
    const { panel } = pintar(pedido());
    expect(panel).toHaveAttribute('data-side', 'right');
    expect(panel).toHaveClass('w-full', 'data-[side=right]:w-full');
  });
});
