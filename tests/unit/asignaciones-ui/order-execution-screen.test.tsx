import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_CANCEL_DIALOG_TESTID,
  ORDER_CANCEL_TEXTS,
  ORDER_CANCEL_TRIGGER_TESTID,
  ORDER_EXECUTION_ACTIONS_TESTID,
  ORDER_EXECUTION_BACK_LINK_TESTID,
  ORDER_EXECUTION_LINES_TESTID,
  ORDER_EXECUTION_MATERIALS_PANEL_TESTID,
  ORDER_EXECUTION_MATERIALS_TESTID,
  ORDER_EXECUTION_FINISH_CONFIRM_TESTID,
  ORDER_EXECUTION_FINISH_CONFIRM_TEXTS,
  ORDER_EXECUTION_FINISH_DIALOG_TESTID,
  ORDER_EXECUTION_ORDER_ID_FIELD,
  ORDER_EXECUTION_ORDER_QUANTITY_TESTID,
  ORDER_EXECUTION_PRESENTATION_TESTID,
  ORDER_EXECUTION_NOT_STARTED_TESTID,
  ORDER_EXECUTION_SCREEN_TESTID,
  ORDER_EXECUTION_START_BUTTON_TESTID,
  ORDER_EXECUTION_START_CONFIRM_TESTID,
  ORDER_EXECUTION_START_DIALOG_TESTID,
  ORDER_EXECUTION_START_ERROR_TESTID,
  ORDER_EXECUTION_STEP_POSITION_FIELD,
  ORDER_EXECUTION_TEXTS,
  ORDER_EXECUTION_TITLE_TESTID,
  ORDER_EXECUTION_TOOLS_TESTID,
  OrderExecutionScreen,
  assignedOrderStartConfirmTexts,
} from '@/app/(private)/asignacion/[id]/components';
import { ASSIGNED_ORDERS_ROUTE } from '@/lib/shared/routes';
import { STEP_READER_SIDE_COLUMN_RESERVE } from '@/app/(private)/asignacion/components/operator-screen-frame';
import type { StartedOrderExecution } from '@/lib/modules/asignaciones';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';

/**
 * El recorrido completo: R18, R19, R20, R21, R26. La confirmacion visible de R15 vive en la
 * lista de pedidos asignados, no en esta pantalla: ver `assigned-orders-states.test.tsx`.
 */

const { finishAssignedOrderActionMock, startAssignedOrderActionMock } = vi.hoisted(() => ({
  finishAssignedOrderActionMock: vi.fn(),
  startAssignedOrderActionMock: vi.fn(),
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-execution-actions', () => ({
  finishAssignedOrderAction: finishAssignedOrderActionMock,
  recordStepMoveAction: vi.fn(() => Promise.resolve({ status: 'success' })),
  cancelAssignedOrderAction: vi.fn(),
  startAssignedOrderAction: startAssignedOrderActionMock,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const LITRO = { id: 'unit-l', name: 'Litro', symbol: 'L', baseUnitId: null, factor: null } as const;
const MILILITRO = {
  id: 'unit-ml',
  name: 'Mililitro',
  symbol: 'ml',
  baseUnitId: 'unit-l',
  factor: '0.001',
} as const;

const EXECUTION: StartedOrderExecution = {
  orderId: 'order-1',
  numberText: 'PED-0007',
  status: 'EN_CURSO',
  recipeName: 'Barniz acrílico',
  orderQuantity: '250',
  steps: [
    {
      blocks: [
        { kind: 'paragraph', spans: [{ text: 'Verifica el equipo antes de cargar' }] },
        { kind: 'checklist', items: [{ spans: [{ text: 'Guantes puestos' }] }] },
      ],
    },
  ],
  lines: [
    {
      productName: 'Resina acrílica',
      percentage: '10.00',
      quantity: '10',
      need: 'unconverted',
      unit: LITRO,
      alternativeUnits: [MILILITRO],
    },
  ],
  tools: [],
  presentationLines: [{ lineId: 'linea-1', packedPackages: null, presentationId: 'pres-1', presentationName: 'Caja x 12', packagingName: null, packages: 5 }],
  unitId: null,
  unitLabel: null,
  evidence: [],
  resumeStepPosition: null,
};

function marcarTodo(): void {
  for (const casilla of screen.queryAllByRole('checkbox')) {
    if (casilla.getAttribute('aria-checked') !== 'true') {
      fireEvent.click(casilla);
    }
  }
}

// Un paso sin lista de verificacion: aisla la espera de tiempo del bloqueo por elementos.
const EXECUTION_SIN_ELEMENTOS: StartedOrderExecution = {
  ...EXECUTION,
  steps: [{ blocks: [{ kind: 'paragraph', spans: [{ text: 'Paso sin elementos pendientes' }] }] }],
};

const EXECUTION_DOS_PASOS: StartedOrderExecution = {
  ...EXECUTION,
  steps: [
    { blocks: [{ kind: 'paragraph', spans: [{ text: 'Paso uno sin elementos' }] }] },
    { blocks: [{ kind: 'paragraph', spans: [{ text: 'Paso dos sin elementos' }] }] },
  ],
};

describe('pantalla de ejecucion — sin factor de escala, con la cantidad de la linea ya calculada', () => {
  it('muestra la cantidad del pedido y la cantidad de la linea CARACTER A CARACTER', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    expect(screen.getByText(new RegExp(EXECUTION.orderQuantity))).toBeVisible();
    expect(screen.getByTestId('order-execution-line-quantity-0')).toHaveTextContent(
      EXECUTION.lines[0]!.quantity ?? '',
    );
  });
});

describe('pantalla de ejecucion — QC-147 R19: sin ningun factor de escala', () => {
  it('no monta ningun banner ni factor de escala: `order-scale-banner` se borro', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    expect(screen.queryByTestId('order-scale-banner')).toBeNull();
    expect(screen.queryByTestId('order-scale-banner-factor')).toBeNull();
  });
});

describe('pantalla de ejecucion — QC-147 R26: la cantidad del pedido en su propia linea', () => {
  it('pinta "Pedido 250" en un elemento propio con su testid, fuera de la lista de lineas', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    const cantidadPedido = screen.getByTestId(ORDER_EXECUTION_ORDER_QUANTITY_TESTID);
    expect(cantidadPedido).toHaveTextContent('Pedido 250');
    expect(cantidadPedido.closest('[data-testid="order-execution-lines"]')).toBeNull();
  });

  it('pinta "Pedido 200" cuando la cantidad del pedido llega con ceros de relleno', () => {
    render(<OrderExecutionScreen execution={{ ...EXECUTION, orderQuantity: '200.0000' }} />);

    expect(screen.getByTestId(ORDER_EXECUTION_ORDER_QUANTITY_TESTID)).toHaveTextContent(
      'Pedido 200',
    );
  });

  it('QC-132 R3: expone el valor exacto en el title cuando difiere del pintado', () => {
    render(<OrderExecutionScreen execution={{ ...EXECUTION, orderQuantity: '0.1255' }} />);

    const cantidadPedido = screen.getByTestId(ORDER_EXECUTION_ORDER_QUANTITY_TESTID);
    expect(cantidadPedido.textContent).toBe('Pedido 0.13');
    expect(cantidadPedido).toHaveAttribute('title', '0.1255');
  });

  it('QC-170 R42: la cantidad del pedido lleva su unidad; sin unidad va la cifra sola', () => {
    render(
      <OrderExecutionScreen
        execution={{ ...EXECUTION, orderQuantity: '200.0000', unitId: 'unit-l', unitLabel: 'L' }}
      />,
    );
    expect(screen.getByTestId(ORDER_EXECUTION_ORDER_QUANTITY_TESTID).textContent).toBe(
      'Pedido 200 L',
    );
    cleanup();

    render(<OrderExecutionScreen execution={{ ...EXECUTION, orderQuantity: '200.0000' }} />);
    expect(screen.getByTestId(ORDER_EXECUTION_ORDER_QUANTITY_TESTID).textContent).toBe(
      'Pedido 200',
    );
  });

  it('QC-132 R4: sin title cuando el valor pintado coincide con el exacto', () => {
    render(<OrderExecutionScreen execution={{ ...EXECUTION, orderQuantity: '200.0000' }} />);

    expect(screen.getByTestId(ORDER_EXECUTION_ORDER_QUANTITY_TESTID)).not.toHaveAttribute('title');
  });
});

describe('pantalla de ejecucion — R19: bloqueo sin escape con el motivo visible', () => {
  it('no permite finalizar mientras queden items sin marcar, y no invoca la operacion', async () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    const finalizar = screen.getByTestId('step-reader-finish');
    expect(finalizar).toBeDisabled();
    expect(screen.getByTestId('step-reader-blocked-reason')).toBeVisible();

    expect(finishAssignedOrderActionMock).not.toHaveBeenCalled();
  });
});

describe('pantalla de ejecucion — R4: la espera minima de 5 segundos por paso', () => {
  it('a los 4999 ms el avance sigue impedido y a los 5000 ms deja de estarlo', async () => {
    vi.useFakeTimers();
    try {
      render(<OrderExecutionScreen execution={EXECUTION_SIN_ELEMENTOS} />);
      const finalizar = screen.getByTestId('step-reader-finish');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(4999);
      });
      expect(finalizar).toBeDisabled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(finalizar).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('pantalla de ejecucion — R5: la cuenta del primer paso arranca sola', () => {
  it('muestra la cuenta completa al montar sin ninguna accion del usuario y no ofrece ningun control "Comenzar"', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    expect(screen.getByTestId('countdown-timer')).toHaveTextContent('00:05');
    expect(screen.queryByRole('button', { name: /comenzar/i })).toBeNull();
    expect(screen.queryByText(/comenzar/i)).toBeNull();
  });
});

describe('pantalla de ejecucion — el error de la operacion se muestra sin bloquear la pantalla', () => {
  it('si la operacion falla, muestra el error', async () => {
    // Enmienda 2026-09-18 (QC-125): la pantalla ahora exige 5 s por paso, asi que el camino de
    // error tiene que cumplirlos antes de pulsar Finalizar.
    finishAssignedOrderActionMock.mockResolvedValue({
      status: 'error',
      code: 'order_delivered_frozen',
      message: 'Un pedido entregado conserva sus responsables tal como estaban.',
    });
    vi.useFakeTimers();
    try {
      render(<OrderExecutionScreen execution={EXECUTION} />);
      marcarTodo();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
    } finally {
      // El reloj falso solo hacia falta para cumplir la espera; el resto de la aserción sigue
      // con temporizadores reales, como el resto del archivo.
      vi.useRealTimers();
    }

    fireEvent.click(screen.getByTestId('step-reader-finish'));
    fireEvent.click(screen.getByTestId(ORDER_EXECUTION_FINISH_CONFIRM_TESTID));

    expect(await screen.findByTestId('order-execution-finish-error')).toBeVisible();
  });
});

describe('pantalla de ejecucion — Finalizar pide confirmar antes de terminar el pedido', () => {
  async function pulsarFinalizar(): Promise<void> {
    vi.useFakeTimers();
    try {
      render(<OrderExecutionScreen execution={EXECUTION_SIN_ELEMENTOS} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
    } finally {
      vi.useRealTimers();
    }
    fireEvent.click(screen.getByTestId('step-reader-finish'));
  }

  it('pulsar Finalizar abre la confirmacion y todavia no invoca la operacion', async () => {
    await pulsarFinalizar();

    const dialog = screen.getByTestId(ORDER_EXECUTION_FINISH_DIALOG_TESTID);
    expect(dialog).toHaveTextContent(ORDER_EXECUTION_FINISH_CONFIRM_TEXTS.title);
    expect(dialog).toHaveTextContent(ORDER_EXECUTION_FINISH_CONFIRM_TEXTS.description);
    expect(screen.getByTestId(ORDER_EXECUTION_FINISH_CONFIRM_TESTID)).toHaveTextContent(
      ORDER_EXECUTION_FINISH_CONFIRM_TEXTS.confirm,
    );
    expect(finishAssignedOrderActionMock).not.toHaveBeenCalled();
  });

  it('cancelar no invoca la operacion', async () => {
    await pulsarFinalizar();

    fireEvent.click(
      screen.getByRole('button', { name: ORDER_EXECUTION_FINISH_CONFIRM_TEXTS.cancel }),
    );
    await act(async () => {});

    expect(finishAssignedOrderActionMock).not.toHaveBeenCalled();
  });

  it('confirmar envia el formulario e invoca la operacion una vez', async () => {
    finishAssignedOrderActionMock.mockResolvedValue({ status: 'success' });
    await pulsarFinalizar();

    await act(async () => {
      fireEvent.click(screen.getByTestId(ORDER_EXECUTION_FINISH_CONFIRM_TESTID));
    });

    expect(finishAssignedOrderActionMock).toHaveBeenCalledTimes(1);
  });
});

describe('pantalla de ejecucion — R13: el ultimo paso tambien espera', () => {
  it('pulsar Finalizar antes de los 5 s no invoca finishAssignedOrderAction', async () => {
    vi.useFakeTimers();
    try {
      render(<OrderExecutionScreen execution={EXECUTION_SIN_ELEMENTOS} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      fireEvent.click(screen.getByTestId('step-reader-finish'));

      expect(finishAssignedOrderActionMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('pantalla de ejecucion — R18: el envio no lleva la espera y remontar la reinicia', () => {
  it('el FormData enviado tras cumplir la espera y finalizar solo lleva orderId; remontar reinicia la cuenta en el paso 1', async () => {
    finishAssignedOrderActionMock.mockResolvedValue({ status: 'success' });
    vi.useFakeTimers();
    try {
      const { unmount } = render(<OrderExecutionScreen execution={EXECUTION_DOS_PASOS} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      fireEvent.click(screen.getByTestId('step-reader-next'));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('step-reader-finish'));
        await vi.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId(ORDER_EXECUTION_FINISH_CONFIRM_TESTID));
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(finishAssignedOrderActionMock).toHaveBeenCalledTimes(1);
      const [, formData] = finishAssignedOrderActionMock.mock.calls[0] as [unknown, FormData];
      // 2026-10-06: el envio suma la posicion del paso (QC-82). Lo que protege no cambia:
      // no viaja nada de la espera.
      expect([...formData.keys()]).toEqual([
        ORDER_EXECUTION_ORDER_ID_FIELD,
        ORDER_EXECUTION_STEP_POSITION_FIELD,
      ]);
      expect(formData.get(ORDER_EXECUTION_ORDER_ID_FIELD)).toBe(EXECUTION_DOS_PASOS.orderId);

      unmount();
      render(<OrderExecutionScreen execution={EXECUTION_DOS_PASOS} />);

      expect(screen.getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 2');
      expect(screen.getByTestId('countdown-timer')).toHaveTextContent('00:05');
      expect(screen.getByTestId('step-reader-next')).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('pantalla de ejecucion — QC-150 R18, R19: los errores nuevos del Finalizar usan el mensaje del catalogo', () => {
  async function finalizarConError(codigo: string, mensaje: string) {
    finishAssignedOrderActionMock.mockResolvedValue({ status: 'error', code: codigo, message: mensaje });
    vi.useFakeTimers();
    try {
      render(<OrderExecutionScreen execution={EXECUTION} />);
      marcarTodo();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
    } finally {
      vi.useRealTimers();
    }

    fireEvent.click(screen.getByTestId('step-reader-finish'));
    fireEvent.click(screen.getByTestId(ORDER_EXECUTION_FINISH_CONFIRM_TESTID));

    return screen.findByTestId('order-execution-finish-error');
  }

  it('R18: un pedido sin presentacion con contenido muestra el mensaje de `presentation_without_content`', async () => {
    const error = await finalizarConError(
      'presentation_without_content',
      'La presentacion del pedido no indica su contenido: completala en Presentaciones antes de finalizar.',
    );

    expect(error).toHaveTextContent(
      'La presentacion del pedido no indica su contenido: completala en Presentaciones antes de finalizar.',
    );
  });

  it('R19: un pedido sin ni un envase entero muestra el mensaje de `no_whole_package`', async () => {
    const error = await finalizarConError(
      'no_whole_package',
      'La cantidad del pedido no llena ni un envase de su presentacion.',
    );

    expect(error).toHaveTextContent(
      'La cantidad del pedido no llena ni un envase de su presentacion.',
    );
  });
});

describe('pantalla de ejecucion — R25: muestra la presentación o Sin presentación', () => {
  it('QC-170 R26: pinta la primera linea del reparto en su propia linea', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    const linea = screen.getByTestId(ORDER_EXECUTION_PRESENTATION_TESTID);
    expect(linea).toHaveTextContent('Presentación:');
    expect(linea).toHaveTextContent('5 × Caja x 12');
  });

  it('QC-170 R26: con varias lineas pinta todas separadas por coma', () => {
    render(
      <OrderExecutionScreen
        execution={{
          ...EXECUTION,
          presentationLines: [
            { lineId: 'linea-2', packedPackages: null, presentationId: 'pres-1', presentationName: 'Botella 200 ml', packagingName: null, packages: 5 },
            { lineId: 'linea-3', packedPackages: null, presentationId: 'pres-2', presentationName: 'Bidón 20L', packagingName: null, packages: 1 },
          ],
        }}
      />,
    );

    expect(screen.getByTestId(ORDER_EXECUTION_PRESENTATION_TESTID).textContent).toBe(
      'Presentación: 5 × Botella 200 ml, 1 × Bidón 20L',
    );
  });

  it('QC-170 R27: con el reparto vacio pinta «Sin presentación»', () => {
    render(<OrderExecutionScreen execution={{ ...EXECUTION, presentationLines: [] }} />);

    expect(screen.getByTestId(ORDER_EXECUTION_PRESENTATION_TESTID)).toHaveTextContent(
      'Sin presentación',
    );
  });
});

describe('pantalla de ejecucion — R26: no hay ningún control de presentación', () => {
  it('la linea de presentación no ofrece ningun boton, enlace ni campo de edicion', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    const linea = screen.getByTestId(ORDER_EXECUTION_PRESENTATION_TESTID);
    expect(linea.querySelectorAll('button, a, input, select, textarea')).toHaveLength(0);
  });
});

describe('pantalla de ejecucion — R20: ningun control de edicion', () => {
  it('no ofrece ningun campo de texto ni area de edicion', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.getByTestId(ORDER_EXECUTION_TITLE_TESTID)).toHaveTextContent(
      EXECUTION.recipeName as string,
    );
  });
});

describe('pantalla de ejecucion — QC-265 R23: cabecera fija con número, receta y menú', () => {
  it('QC-265 R2, R23: pinta el número en la cabecera y la receta como único h1, con su testid', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    const raiz = screen.getByTestId(ORDER_EXECUTION_SCREEN_TESTID);
    expect(raiz).toHaveAttribute('data-operator-screen');
    const cabecera = raiz.querySelector<HTMLElement>('[data-slot="operator-header"]');
    expect(cabecera).not.toBeNull();
    expect(within(cabecera!).getByText(EXECUTION.numberText)).toBeVisible();
    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent(EXECUTION.recipeName as string);
    expect(titulos[0]).toHaveAttribute('data-testid', ORDER_EXECUTION_TITLE_TESTID);
    expect(within(cabecera!).getByRole('button', { name: 'Cambiar tema' })).toBeVisible();
  });

  it('QC-265 R23: con la receta dada de baja el h1 dice «Esta receta está dada de baja.»', () => {
    render(<OrderExecutionScreen execution={{ ...EXECUTION, recipeName: null }} />);

    const titulo = screen.getByRole('heading', { level: 1 });
    expect(ORDER_EXECUTION_TEXTS.recipeMissing).toBe('Esta receta está dada de baja.');
    expect(titulo.textContent).toBe('Esta receta está dada de baja.');
    expect(titulo).toHaveAttribute('data-testid', ORDER_EXECUTION_TITLE_TESTID);
  });

  it('QC-265 R23: la cabecera pinta «Pedido <cantidad> <unidad> · Presentación: <reparto>»', () => {
    render(
      <OrderExecutionScreen
        execution={{ ...EXECUTION, orderQuantity: '200.0000', unitId: 'unit-l', unitLabel: 'L' }}
      />,
    );

    const cabecera = screen
      .getByTestId(ORDER_EXECUTION_SCREEN_TESTID)
      .querySelector<HTMLElement>('[data-slot="operator-header"]');
    const cantidad = screen.getByTestId(ORDER_EXECUTION_ORDER_QUANTITY_TESTID);
    expect(cabecera).toContainElement(cantidad);
    expect(cabecera).toContainElement(screen.getByTestId(ORDER_EXECUTION_PRESENTATION_TESTID));
    expect(cantidad.parentElement?.textContent).toBe('Pedido 200 L · Presentación: 5 × Caja x 12');
  });

  it('QC-265 R23: el menú «Acciones del pedido <número>» ofrece «Cancelar pedido» y abre el diálogo de hoy', async () => {
    const user = setupUser();
    render(<OrderExecutionScreen execution={EXECUTION} />);

    expect(screen.queryByTestId(ORDER_CANCEL_DIALOG_TESTID)).toBeNull();
    const menu = screen.getByRole('button', { name: 'Acciones del pedido PED-0007' });
    expect(menu).toHaveAttribute('data-testid', ORDER_EXECUTION_ACTIONS_TESTID);

    await user.click(await esperarInteractiva(menu));
    const item = await screen.findByRole('menuitem', { name: ORDER_CANCEL_TEXTS.trigger });
    expect(item).toHaveAttribute('data-testid', ORDER_CANCEL_TRIGGER_TESTID);
    await user.click(item);

    const dialogo = await screen.findByRole('alertdialog');
    expect(dialogo).toHaveAttribute('data-testid', ORDER_CANCEL_DIALOG_TESTID);
    expect(dialogo).toHaveTextContent(ORDER_CANCEL_TEXTS.title);
    expect(
      within(dialogo).getByRole('textbox', { name: ORDER_CANCEL_TEXTS.reasonLabel }),
    ).toBeVisible();
  });
});

describe('pantalla de ejecucion — QC-265 R25: el pie del paso a paso', () => {
  it('QC-265 R25: Anterior y Siguiente van en el pie fijo, en talla xl y con el motivo encima', () => {
    render(<OrderExecutionScreen execution={EXECUTION_DOS_PASOS} />);

    const pie = screen.getByTestId('step-reader-actions');
    expect(pie.className).toContain('fixed');
    expect(pie.className).toContain('bottom-0');
    expect(pie.className).toContain('env(safe-area-inset-bottom');
    const anterior = within(pie).getByTestId('step-reader-previous');
    const siguiente = within(pie).getByTestId('step-reader-next');
    expect(anterior.className).toContain('h-13');
    expect(siguiente.className).toContain('h-13');
    const motivo = within(pie).getByTestId('step-reader-reason-slot');
    expect(motivo.compareDocumentPosition(anterior) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('QC-265 R25: en el último paso el pie ofrece Finalizar en talla xl con el motivo del bloqueo', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    const pie = screen.getByTestId('step-reader-actions');
    expect(within(pie).getByTestId('step-reader-finish').className).toContain('h-13');
    expect(within(pie).getByTestId('step-reader-blocked-reason')).toBeVisible();
  });
});

describe('pantalla de ejecucion — materiales y herramientas en su propio contenedor', () => {
  it('las lineas y las herramientas viven dentro del contenedor, separadas del lector de pasos', () => {
    render(
      <OrderExecutionScreen
        execution={{ ...EXECUTION, tools: [{ productName: 'Espátula', quantity: 1 }] }}
      />,
    );

    const contenedor = screen.getByTestId(ORDER_EXECUTION_MATERIALS_TESTID);
    expect(contenedor.contains(screen.getByTestId(ORDER_EXECUTION_LINES_TESTID))).toBe(true);
    expect(contenedor.contains(screen.getByTestId(ORDER_EXECUTION_TOOLS_TESTID))).toBe(true);
    expect(contenedor.contains(screen.getByTestId('step-reader'))).toBe(false);
    expect(contenedor.contains(screen.getByTestId(ORDER_EXECUTION_TITLE_TESTID))).toBe(false);
  });

  it('QC-269 R4, R7: la Card de materiales reserva el pie fijo del lector, sin envoltorio nuevo', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    const contenedor = screen.getByTestId(ORDER_EXECUTION_MATERIALS_TESTID);
    expect(contenedor.className.split(/\s+/)).toContain(STEP_READER_SIDE_COLUMN_RESERVE);
    // La Card sigue siendo hija directa de la rejilla, hermana del lector.
    expect(contenedor.parentElement?.contains(screen.getByTestId('step-reader'))).toBe(true);
  });

  it('QC-269 R4, R7, R8: la reserva de la Card usa el mismo calc que el pie fijo del lector', () => {
    // Vive aqui porque este test es el que el guardia de recipe-route-contract deja nombrar el
    // lector de pasos; evita la deriva entre los dos sitios (design.md § 4.2).
    render(<OrderExecutionScreen execution={EXECUTION} />);

    const readerReserve = /(?:^|\s)pb-\[(calc\([^\]]+\))\](?:\s|$)/.exec(
      screen.getByTestId('step-reader').className,
    )?.[1];
    const sideReserve = /^@min-\[1101px\]:mb-\[(calc\([^\]]+\))\]$/.exec(
      STEP_READER_SIDE_COLUMN_RESERVE,
    )?.[1];

    expect(readerReserve).toBeDefined();
    expect(sideReserve).toBe(readerReserve);
  });

  it('con herramientas, herramientas y materiales van en Cards distintas, herramientas primero', () => {
    render(
      <OrderExecutionScreen
        execution={{ ...EXECUTION, tools: [{ productName: 'Espátula', quantity: 1 }] }}
      />,
    );

    const materiales = screen.getByTestId(ORDER_EXECUTION_MATERIALS_PANEL_TESTID);
    const herramientas = screen.getByTestId(ORDER_EXECUTION_TOOLS_TESTID);
    expect(materiales).toContainElement(screen.getByTestId(ORDER_EXECUTION_LINES_TESTID));
    expect(materiales).not.toContainElement(herramientas);
    expect(herramientas.compareDocumentPosition(materiales) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId('order-execution-materials-divider')).toBeNull();
  });

  it('sin herramientas solo queda la Card de materiales', () => {
    render(<OrderExecutionScreen execution={{ ...EXECUTION, tools: [] }} />);

    expect(screen.queryByTestId(ORDER_EXECUTION_TOOLS_TESTID)).toBeNull();
    expect(screen.getByTestId(ORDER_EXECUTION_MATERIALS_PANEL_TESTID)).toContainElement(
      screen.getByTestId(ORDER_EXECUTION_LINES_TESTID),
    );
  });
});

describe('pantalla de ejecucion — R26: objetivos tactiles de 44x44 en todo control nuevo', () => {
  /** 44 x 44 como minimo; los botones del pie y el disparador del panel miden 52 de alto. */
  function esObjetivoTactil(elemento: Element): boolean {
    const clases = elemento.className.split(/\s+/);
    const alto = ['min-h-11', 'min-h-13', 'h-13', 'size-11'].some((c) => clases.includes(c));
    const ancho = ['min-w-11', 'w-full', 'size-11'].some((c) => clases.includes(c));
    return alto && ancho;
  }

  it('todo boton y todo selector de la pantalla cumple el objetivo tactil minimo', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    const controles = [
      ...Array.from(document.querySelectorAll('button')),
      ...Array.from(document.querySelectorAll('[data-slot="select-trigger"]')),
      ...Array.from(document.querySelectorAll('[data-slot="checkbox"]')),
    ];

    expect(controles.length).toBeGreaterThan(0);
    for (const control of controles) {
      expect(esObjetivoTactil(control), control.outerHTML).toBe(true);
    }
  });

  it('no usa `100vh` en su contenedor: usa `min-h-dvh`', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    expect(screen.getByTestId(ORDER_EXECUTION_SCREEN_TESTID).className).toContain('min-h-dvh');
  });
});

describe('R1 — ningun literal de ruta nuevo en la pagina', () => {
  it('page.tsx no incrusta `/asignacion` como cadena: la direccion la resuelve el App Router', () => {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const PAGINA = join(
      HERE,
      '..',
      '..',
      '..',
      'app',
      '(private)',
      'asignacion',
      '[id]',
      'page.tsx',
    );
    const fuente = readFileSync(PAGINA, 'utf8')
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, ' ');

    expect(fuente).not.toMatch(/['"`]\/asignacion/);
  });
});

// Tensado a lista cerrada el 2026-09-18 (QC-125, ratificado por el humano): esta ficha SI
// necesita tocar `step-reader.tsx` (botones, motivo del bloqueo y cronometro son internos del
// asistente), asi que la igualdad contra `[]` de QC-63 dejaba de poder cumplirse. Lo que sigue
// prohibido es cualquier OTRO archivo de la carpeta.
describe('R18 — el asistente heredado solo puede cambiar step-reader.tsx (lista cerrada)', () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const REPO_ROOT = join(HERE, '..', '..', '..');

  const PERMITIDOS = ['components/shared/step-reader/step-reader.tsx'];

  function git(args: readonly string[]): string {
    return execFileSync('git', [...args], { cwd: REPO_ROOT, encoding: 'utf8' });
  }

  function mergeBaseConDev(): string | null {
    try {
      return git(['merge-base', 'origin/dev', 'HEAD']).trim();
    } catch {
      return null;
    }
  }

  it('todo archivo cambiado de `components/shared/step-reader/**` esta en la lista permitida', (ctx) => {
    const base = mergeBaseConDev();
    if (base === null) {
      ctx.skip(
        'no se pudo calcular `git merge-base origin/dev HEAD`: este caso NO ha comprobado nada.',
      );
      return;
    }

    const cambiados = git(['diff', '--name-only', base, '--', 'components/shared/step-reader'])
      .split('\n')
      .map((linea) => linea.trim())
      .filter((linea) => linea !== '');

    const fueraDeLaLista = cambiados.filter((archivo) => !PERMITIDOS.includes(archivo));

    expect(
      fueraDeLaLista,
      `esta rama modifico un archivo del asistente fuera de la lista cerrada: ${fueraDeLaLista.join(', ')}`,
    ).toEqual([]);
  });
});

describe('pantalla de ejecucion — el nombre del envase de la linea', () => {
  it('R44: una linea con envase pinta el nombre del envase, no el de la presentacion', () => {
    render(
      <OrderExecutionScreen
        execution={{
          ...EXECUTION,
          presentationLines: [
            { lineId: 'linea-4', packedPackages: null, presentationId: 'pres-1', presentationName: 'Caja x 12', packagingName: 'Caja cartón 12 u', packages: 5 },
            { lineId: 'linea-5', packedPackages: null, presentationId: 'pres-2', presentationName: 'Bidón 20L', packagingName: null, packages: 1 },
          ],
        }}
      />,
    );

    const linea = screen.getByTestId(ORDER_EXECUTION_PRESENTATION_TESTID);
    expect(linea.textContent).toBe('Presentación: 5 × Caja cartón 12 u, 1 × Bidón 20L');
    expect(within(linea).getByTestId('order-distribution')).toHaveAttribute(
      'title',
      '5 × Caja cartón 12 u, 1 × Bidón 20L',
    );
  });

  it('R44: una linea antigua (`packagingName` null) pinta el nombre de su presentacion', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    expect(screen.getByTestId(ORDER_EXECUTION_PRESENTATION_TESTID).textContent).toBe(
      'Presentación: 5 × Caja x 12',
    );
  });
});

describe('pantalla de ejecucion — entrar es libre: «Comenzar» dentro de la pantalla', () => {
  const PENDIENTE: StartedOrderExecution = { ...EXECUTION, status: 'PENDIENTE' };

  it('PENDIENTE: pinta «Comenzar» en el pie, sin paso a paso ni Finalizar', () => {
    render(<OrderExecutionScreen execution={PENDIENTE} />);

    expect(screen.getByTestId(ORDER_EXECUTION_START_BUTTON_TESTID)).toHaveTextContent(
      ORDER_EXECUTION_TEXTS.start,
    );
    expect(screen.getByTestId(ORDER_EXECUTION_NOT_STARTED_TESTID)).toBeVisible();
    expect(screen.queryByText('Verifica el equipo antes de cargar')).toBeNull();
    expect(screen.queryByTestId('step-reader-finish')).toBeNull();
  });

  it('PENDIENTE: la vuelta es un enlace habilitado a la lista de pedidos asignados', () => {
    render(<OrderExecutionScreen execution={PENDIENTE} />);

    const back = screen.getByTestId(ORDER_EXECUTION_BACK_LINK_TESTID);
    expect(back.tagName).toBe('A');
    expect(back).toHaveAttribute('href', ASSIGNED_ORDERS_ROUTE);
    expect(back).not.toHaveAttribute('aria-disabled');
  });

  it('pulsar «Comenzar» abre la confirmacion con sus textos y no comienza todavia', () => {
    render(<OrderExecutionScreen execution={PENDIENTE} />);

    expect(screen.queryByTestId(ORDER_EXECUTION_START_DIALOG_TESTID)).toBeNull();
    fireEvent.click(screen.getByTestId(ORDER_EXECUTION_START_BUTTON_TESTID));

    const texts = assignedOrderStartConfirmTexts();
    const dialog = screen.getByTestId(ORDER_EXECUTION_START_DIALOG_TESTID);
    expect(dialog).toHaveTextContent(texts.title);
    expect(dialog).toHaveTextContent(texts.description);
    expect(screen.getByTestId(ORDER_EXECUTION_START_CONFIRM_TESTID)).toHaveTextContent(texts.confirm);
    expect(startAssignedOrderActionMock).not.toHaveBeenCalled();
  });

  it('cancelar la confirmacion no comienza el pedido', () => {
    render(<OrderExecutionScreen execution={PENDIENTE} />);

    fireEvent.click(screen.getByTestId(ORDER_EXECUTION_START_BUTTON_TESTID));
    fireEvent.click(screen.getByRole('button', { name: assignedOrderStartConfirmTexts().cancel }));

    expect(startAssignedOrderActionMock).not.toHaveBeenCalled();
  });

  it('confirmar comienza el pedido y pinta la ejecucion: paso a paso y la vuelta deshabilitada', async () => {
    startAssignedOrderActionMock.mockResolvedValue({
      status: 'success',
      data: { ...PENDIENTE, status: 'EN_CURSO', resumeStepPosition: 1 },
    });
    render(<OrderExecutionScreen execution={PENDIENTE} />);

    fireEvent.click(screen.getByTestId(ORDER_EXECUTION_START_BUTTON_TESTID));
    fireEvent.click(screen.getByTestId(ORDER_EXECUTION_START_CONFIRM_TESTID));

    expect(await screen.findByText('Verifica el equipo antes de cargar')).toBeVisible();
    expect(startAssignedOrderActionMock).toHaveBeenCalledTimes(1);
    expect(startAssignedOrderActionMock).toHaveBeenCalledWith(PENDIENTE.orderId);
    expect(screen.queryByTestId(ORDER_EXECUTION_START_BUTTON_TESTID)).toBeNull();
    expect(screen.getByTestId(ORDER_EXECUTION_BACK_LINK_TESTID)).toHaveAttribute('aria-disabled', 'true');
  });

  it('si comenzar falla, sigue sin comenzar y pinta el error', async () => {
    startAssignedOrderActionMock.mockResolvedValue({
      status: 'error',
      code: 'order_blocked',
      message: 'Falta material.',
    });
    render(<OrderExecutionScreen execution={PENDIENTE} />);

    fireEvent.click(screen.getByTestId(ORDER_EXECUTION_START_BUTTON_TESTID));
    fireEvent.click(screen.getByTestId(ORDER_EXECUTION_START_CONFIRM_TESTID));

    expect(await screen.findByTestId(ORDER_EXECUTION_START_ERROR_TESTID)).toBeInTheDocument();
    expect(screen.getByTestId(ORDER_EXECUTION_START_BUTTON_TESTID)).toBeInTheDocument();
    expect(screen.getByTestId(ORDER_EXECUTION_BACK_LINK_TESTID).tagName).toBe('A');
  });

  it('EN_CURSO: la vuelta se ve pero esta deshabilitada, sin href ni foco', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    const back = screen.getByTestId(ORDER_EXECUTION_BACK_LINK_TESTID);
    expect(back.tagName).not.toBe('A');
    expect(back).not.toHaveAttribute('href');
    expect(back).not.toHaveAttribute('tabindex');
    expect(back).toHaveAttribute('aria-disabled', 'true');
    expect(back).toHaveTextContent(ORDER_EXECUTION_TEXTS.back);
    expect(screen.queryByTestId(ORDER_EXECUTION_START_BUTTON_TESTID)).toBeNull();
  });
});
