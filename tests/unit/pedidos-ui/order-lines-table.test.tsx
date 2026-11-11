// QT-314 T14 — La tabla de recetas del panel del pedido, montada sola: filas, tarjetas del
// teléfono, solo lectura, marcas de error y totales.

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_LINES_CARD_TESTID,
  ORDER_LINES_CARDS_TESTID,
  ORDER_LINES_EDIT_TESTID,
  ORDER_LINES_EMPTY_TESTID,
  ORDER_LINES_READ_ONLY_TESTID,
  ORDER_LINES_ROW_TESTID,
  ORDER_LINES_TABLE_TESTID,
  OrderLinesEmpty,
  OrderLinesTable,
  OrderLinesTotals,
  draftFromOrder,
  draftTotals,
} from '@/app/(private)/pedidos/components';
import type { OrderLineView } from '@/lib/modules/pedidos';
import { LINEA_B_ID, RECETA_A, RECETA_B, lineaB, lineaPedido } from '../../helpers/order-form-ui';
import { setupUser } from '../../helpers/user-event';

afterEach(() => {
  cleanup();
});

function borradorDe(...lines: OrderLineView[]) {
  return draftFromOrder({ lines });
}

describe('filas de la tabla (R2)', () => {
  it('R2: cabeceras y, por receta, fórmula con reparto, cantidad con unidad, precio y estado', () => {
    render(<OrderLinesTable lines={borradorDe(lineaPedido(), lineaB())} onEdit={vi.fn()} />);

    const tabla = screen.getByTestId(ORDER_LINES_TABLE_TESTID);
    expect(within(tabla).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Receta',
      'Cantidad',
      'Precio',
      'Estado',
      'Acciones',
    ]);
    const [a, b] = screen.getAllByTestId(ORDER_LINES_ROW_TESTID);
    expect(a).toHaveTextContent(`${RECETA_A.name}3 × Envase 5 L15 L$120.50Pendiente`);
    expect(b).toHaveTextContent(`${RECETA_B.name}Sin presentación30 LSin precioEn fabricación`);
  });

  it('R2: «Editar» avisa con la clave de su receta', async () => {
    const user = setupUser();
    const onEdit = vi.fn();
    render(<OrderLinesTable lines={borradorDe(lineaPedido(), lineaB())} onEdit={onEdit} />);

    const fila = screen.getAllByTestId(ORDER_LINES_ROW_TESTID)[1] as HTMLElement;
    await user.click(within(fila).getByTestId(ORDER_LINES_EDIT_TESTID));

    expect(onEdit).toHaveBeenCalledWith(LINEA_B_ID);
  });

  it('R2: sin recetas no pinta tabla; el aviso de vacío es aparte', () => {
    render(
      <>
        <OrderLinesTable lines={[]} onEdit={vi.fn()} />
        <OrderLinesEmpty />
      </>,
    );
    expect(screen.queryByTestId(ORDER_LINES_TABLE_TESTID)).toBeNull();
    expect(screen.getByTestId(ORDER_LINES_EMPTY_TESTID)).toHaveTextContent(
      'El pedido aún no tiene recetas. Añade al menos una.',
    );
  });
});

describe('solo lectura (R10, R12)', () => {
  it('R10: las no editables y las canceladas salen con «Solo lectura» y sin «Editar»', () => {
    render(
      <OrderLinesTable
        lines={borradorDe(
          lineaPedido({ status: 'TERMINADO' }),
          lineaB({ status: 'CANCELADO', cancellationReason: 'x' }),
          lineaPedido({ id: '50000000-0000-4000-8000-0000000000dd', position: 2, status: 'BLOQUEADO' }),
        )}
        onEdit={vi.fn()}
      />,
    );

    const [terminada, cancelada, bloqueada] = screen.getAllByTestId(ORDER_LINES_ROW_TESTID);
    for (const fila of [terminada, cancelada]) {
      expect(within(fila as HTMLElement).getByTestId(ORDER_LINES_READ_ONLY_TESTID)).toHaveTextContent('Solo lectura');
      expect(within(fila as HTMLElement).queryByTestId(ORDER_LINES_EDIT_TESTID)).toBeNull();
    }
    expect(within(bloqueada as HTMLElement).getByTestId(ORDER_LINES_EDIT_TESTID)).toBeInTheDocument();
  });
});

describe('totales (R13)', () => {
  it('R13: el total, cuántas no tienen precio y el coste estimado', () => {
    const lines = borradorDe(lineaPedido(), lineaB());
    render(<OrderLinesTotals totals={draftTotals(lines)} />);

    expect(screen.getByTestId('order-lines-total')).toHaveTextContent('$120.50');
    expect(screen.getByTestId('order-lines-without-price')).toHaveTextContent('1 sin precio');
    expect(screen.getByTestId('order-lines-cost')).toHaveTextContent('$65.00');
  });

  it('R13: sin coste en alguna receta activa, el coste es el marcador de ausencia', () => {
    const lines = borradorDe(lineaPedido(), lineaB({ ingredientsCost: null }));
    render(<OrderLinesTotals totals={draftTotals(lines)} />);

    expect(screen.getByTestId('order-lines-cost')).toHaveAccessibleName('Sin dato');
  });
});

describe('teléfono (R44)', () => {
  it('R44: la tabla pasa a tarjetas por debajo de 768 px, cada una con «Editar receta»', () => {
    render(<OrderLinesTable lines={borradorDe(lineaPedido(), lineaB({ status: 'TERMINADO' }))} onEdit={vi.fn()} />);

    expect(screen.getByTestId(ORDER_LINES_CARDS_TESTID)).toHaveClass('md:hidden');
    expect(screen.getByTestId(ORDER_LINES_TABLE_TESTID).parentElement?.parentElement).toHaveClass('hidden', 'md:block');
    const [editable, terminada] = screen.getAllByTestId(ORDER_LINES_CARD_TESTID);
    expect(within(editable as HTMLElement).getByTestId(ORDER_LINES_EDIT_TESTID)).toHaveTextContent('Editar receta');
    expect(within(editable as HTMLElement).getByTestId(ORDER_LINES_EDIT_TESTID)).toHaveClass('min-h-11');
    expect(within(terminada as HTMLElement).getByTestId(ORDER_LINES_READ_ONLY_TESTID)).toBeInTheDocument();
  });
});
