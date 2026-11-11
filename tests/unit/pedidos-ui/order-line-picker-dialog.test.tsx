// QT-314 T12 — El selector de receta de las acciones por receta.

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_LINE_PICKER_DIALOG_TESTID,
  ORDER_LINE_PICKER_OPTION_TESTID,
  ORDER_LINE_PICKER_REASON_TESTID,
  OrderLinePickerDialog,
  type LineActionKind,
} from '@/app/(private)/pedidos/components';
import type { OrderLineStatus, OrderLineView } from '@/lib/modules/pedidos';

import { setupUser } from '../../helpers/user-event';

function linea(n: number, status: OrderLineStatus, recipeName: string): OrderLineView {
  return {
    id: `50000000-0000-4000-8000-00000000000${n}`,
    position: n,
    recipeId: `10000000-0000-4000-8000-00000000000${n}`,
    recipeName,
    originalRecipeId: `10000000-0000-4000-8000-00000000000${n}`,
    recipeVersion: null,
    recipeImageUrl: null,
    quantity: '15.0000',
    unitId: '20000000-0000-4000-8000-000000000001',
    unitLabel: 'L',
    status,
    cancellationReason: null,
    presentationLines: [
      {
        presentationId: '40000000-0000-4000-8000-000000000001',
        presentationName: 'Galón',
        packages: 3,
        packagingProductId: '30000000-0000-4000-8000-000000000001',
        packagingName: 'Envase 5 L',
        presentationContent: '5.0000',
        presentationUnitLabel: 'L',
      },
    ],
    salePrice: null,
    ingredientsCost: null,
    packagingCost: null,
    actualCost: null,
    finishedAt: null,
    reservedAt: null,
  };
}

const PEDIDO = {
  numberText: '2026-000042',
  lines: [
    linea(1, 'TERMINADO', 'Hipoclorito 5 %'),
    linea(2, 'EN_CURSO', 'Desengrasante'),
    linea(3, 'CANCELADO', 'Suavizante'),
  ],
};

const elegir = vi.fn<(lineId: string) => void>();
const cerrar = vi.fn<(open: boolean) => void>();

function montar(action: LineActionKind) {
  render(
    <OrderLinePickerDialog order={PEDIDO} action={action} open onOpenChange={cerrar} onPick={elegir} />,
  );
  return screen.getAllByTestId(ORDER_LINE_PICKER_OPTION_TESTID);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('el selector enseña todas las recetas del pedido (R27)', () => {
  it('R27: una opción por receta, con su nombre, su estado, su cantidad y su reparto', () => {
    const opciones = montar('deliver');

    expect(opciones).toHaveLength(3);
    const [terminada] = opciones;
    expect(terminada).toHaveTextContent('Hipoclorito 5 %');
    expect(terminada).toHaveTextContent('15 L');
    expect(terminada).toHaveTextContent('3 × Envase 5 L · 5 L');
    expect(within(terminada as HTMLElement).getByTestId('order-status')).toHaveAttribute(
      'data-status',
      'TERMINADO',
    );
  });

  it('R27: nombra la acción y el pedido', () => {
    montar('deliver');

    const dialogo = screen.getByTestId(ORDER_LINE_PICKER_DIALOG_TESTID);
    expect(within(dialogo).getByRole('heading', { name: 'Entregar' })).toBeInTheDocument();
    expect(dialogo).toHaveTextContent('Pedido 2026-000042. Elige la receta.');
  });
});

describe('las recetas que no admiten la acción salen deshabilitadas con su motivo (R27)', () => {
  it('R27: «Entregar» deshabilita las que no están terminadas, con «Aún no está terminada»', () => {
    const [terminada, enCurso, cancelada] = montar('deliver');

    expect(terminada).not.toHaveAttribute('aria-disabled');
    expect(within(terminada as HTMLElement).queryByTestId(ORDER_LINE_PICKER_REASON_TESTID)).toBeNull();
    for (const opcion of [enCurso, cancelada]) {
      expect(opcion).toHaveAttribute('aria-disabled', 'true');
      expect(within(opcion as HTMLElement).getByTestId(ORDER_LINE_PICKER_REASON_TESTID)).toHaveTextContent(
        'Aún no está terminada',
      );
    }
  });

  it('R27: «Cancelar receta» deja elegir la EN_CURSO y deshabilita la terminada y la cancelada', () => {
    const [terminada, enCurso, cancelada] = montar('cancelLine');

    expect(enCurso).not.toHaveAttribute('aria-disabled');
    expect(terminada).toHaveAttribute('aria-disabled', 'true');
    expect(cancelada).toHaveAttribute('aria-disabled', 'true');
    expect(terminada).toHaveTextContent('No se puede cancelar en este estado');
  });

  it('R27: pulsar una deshabilitada no emite nada', async () => {
    const user = setupUser();
    const [, enCurso] = montar('deliver');

    await user.click(enCurso as HTMLElement);

    expect(elegir).not.toHaveBeenCalled();
  });
});

describe('elegir una receta (R27)', () => {
  it('R27: elegir una habilitada emite su lineId', async () => {
    const user = setupUser();
    const [terminada] = montar('deliver');

    await user.click(terminada as HTMLElement);

    expect(elegir).toHaveBeenCalledTimes(1);
    expect(elegir).toHaveBeenCalledWith(PEDIDO.lines[0]?.id);
  });

  it('R27: también con el teclado', async () => {
    const user = setupUser();
    const [, enCurso] = montar('cancelLine');

    (enCurso as HTMLElement).focus();
    await user.keyboard('{Enter}');

    expect(elegir).toHaveBeenCalledWith(PEDIDO.lines[1]?.id);
  });
});

describe('objetivos táctiles del selector (R44)', () => {
  it('R44: cada opción mide al menos 52 px de alto, también las deshabilitadas', () => {
    const opciones = montar('distribution');

    for (const opcion of opciones) {
      expect(opcion.className).toContain('min-h-13');
    }
  });

  it('R44: es un diálogo centrado, no un panel lateral', () => {
    montar('distribution');

    expect(screen.getByRole('dialog')).toBe(screen.getByTestId(ORDER_LINE_PICKER_DIALOG_TESTID));
    expect(screen.getByTestId(ORDER_LINE_PICKER_DIALOG_TESTID).className).toContain('top-1/2');
  });
});
