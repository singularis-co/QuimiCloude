import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_CANCEL_DIALOG_TESTID,
  ORDER_CANCEL_TEXTS,
  ORDER_CANCEL_TRIGGER_TESTID,
  ORDER_EXECUTION_ACTIONS_TESTID,
  ORDER_EXECUTION_BACK_LINK_TESTID,
  ORDER_EXECUTION_LINE_UNIT_OPTION_TESTID,
  ORDER_EXECUTION_LINE_UNIT_SELECT_TESTID,
  ORDER_EXECUTION_LINE_UNIT_TESTID,
  ORDER_EXECUTION_LINES_TESTID,
  ORDER_EXECUTION_MATERIALS_SECTION_TESTIDS,
  ORDER_EXECUTION_MATERIALS_TESTID,
  ORDER_EXECUTION_FINISH_CONFIRM_TESTID,
  ORDER_EXECUTION_FINISH_CONFIRM_TEXTS,
  ORDER_EXECUTION_FINISH_DIALOG_TESTID,
  ORDER_EXECUTION_ORDER_ID_FIELD,
  ORDER_EXECUTION_ORDER_QUANTITY_TESTID,
  ORDER_EXECUTION_NOT_STARTED_TESTID,
  ORDER_EXECUTION_SCREEN_TESTID,
  ORDER_EXECUTION_START_BUTTON_TESTID,
  ORDER_EXECUTION_START_CONFIRM_TESTID,
  ORDER_EXECUTION_START_DIALOG_TESTID,
  ORDER_EXECUTION_START_ERROR_TESTID,
  ORDER_EXECUTION_START_FORM_TESTID,
  ORDER_EXECUTION_STATUS_TESTID,
  ORDER_EXECUTION_STEP_POSITION_FIELD,
  ORDER_EXECUTION_TEXTS,
  ORDER_EXECUTION_TITLE_TESTID,
  ORDER_EXECUTION_TOOLS_SECTION_TESTIDS,
  ORDER_EXECUTION_TOOLS_TESTID,
  OrderExecutionScreen,
  assignedOrderStartConfirmTexts,
} from '@/app/(private)/asignacion/[id]/components';
import { OPERATOR_SIDE_PANELS_FABS_TESTID } from '@/app/(private)/asignacion/components';
import { ASSIGNED_ORDERS_ROUTE } from '@/lib/shared/routes';
import { ORDER_STATUS_LABELS } from '@/lib/shared/ui/order-status';
import type { StartedOrderExecution } from '@/lib/modules/asignaciones';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';

/**
 * El recorrido completo: R18, R19, R20, R21, R26. La confirmacion visible de R15 vive en la
 * lista de pedidos asignados, no en esta pantalla: ver `assigned-orders-states.test.tsx`.
 */

const { finishAssignedOrderActionMock, recordStepMoveActionMock, startAssignedOrderActionMock } =
  vi.hoisted(() => ({
    finishAssignedOrderActionMock: vi.fn(),
    recordStepMoveActionMock: vi.fn(() => Promise.resolve({ status: 'success' })),
    startAssignedOrderActionMock: vi.fn(),
  }));

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-execution-actions', () => ({
  finishAssignedOrderAction: finishAssignedOrderActionMock,
  recordStepMoveAction: recordStepMoveActionMock,
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
  presentationLines: [{ lineId: 'linea-1', packedPackages: null, presentationId: 'pres-1', presentationName: 'Caja x 12', packagingName: null, packages: 5, presentationContent: null, presentationUnitLabel: null }],
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
  it('pinta «Cantidad 250» en un elemento propio con su testid, fuera de la lista de lineas', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    const cantidadPedido = screen.getByTestId(ORDER_EXECUTION_ORDER_QUANTITY_TESTID);
    expect(cantidadPedido).toHaveTextContent('Cantidad 250');
    expect(cantidadPedido.closest('[data-testid="order-execution-lines"]')).toBeNull();
  });

  it('pinta «Cantidad 200» cuando la cantidad del pedido llega con ceros de relleno', () => {
    render(<OrderExecutionScreen execution={{ ...EXECUTION, orderQuantity: '200.0000' }} />);

    expect(screen.getByTestId(ORDER_EXECUTION_ORDER_QUANTITY_TESTID)).toHaveTextContent(
      'Cantidad 200',
    );
  });

  it('QC-132 R3: expone el valor exacto en el title cuando difiere del pintado', () => {
    render(<OrderExecutionScreen execution={{ ...EXECUTION, orderQuantity: '0.1255' }} />);

    const cantidadPedido = screen.getByTestId(ORDER_EXECUTION_ORDER_QUANTITY_TESTID);
    expect(cantidadPedido.textContent).toBe('Cantidad 0.13');
    expect(cantidadPedido).toHaveAttribute('title', '0.1255');
  });

  it('QC-170 R42: la cantidad del pedido lleva su unidad; sin unidad va la cifra sola', () => {
    render(
      <OrderExecutionScreen
        execution={{ ...EXECUTION, orderQuantity: '200.0000', unitId: 'unit-l', unitLabel: 'L' }}
      />,
    );
    expect(screen.getByTestId(ORDER_EXECUTION_ORDER_QUANTITY_TESTID).textContent).toBe(
      'Cantidad 200 L',
    );
    cleanup();

    render(<OrderExecutionScreen execution={{ ...EXECUTION, orderQuantity: '200.0000' }} />);
    expect(screen.getByTestId(ORDER_EXECUTION_ORDER_QUANTITY_TESTID).textContent).toBe(
      'Cantidad 200',
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

describe('pantalla de ejecucion — R2: la fabricación no pinta la presentación', () => {
  it('R2: no hay `order-execution-presentation` ni «Presentación:» en ningún punto, sin comenzar ni comenzada', () => {
    for (const execution of [EXECUTION, { ...EXECUTION, status: 'PENDIENTE' as const }]) {
      render(<OrderExecutionScreen execution={execution} />);

      expect(screen.queryByTestId('order-execution-presentation')).toBeNull();
      expect(document.body.textContent).not.toContain('Presentación:');
      expect(document.body.textContent).not.toContain('Caja x 12');
      cleanup();
    }
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

  it('R2: la cabecera pinta «Fabricación · <número>» con el número en su elemento, un único chip «Cantidad» y la insignia de estado', () => {
    render(
      <OrderExecutionScreen
        execution={{ ...EXECUTION, orderQuantity: '200.0000', unitId: 'unit-l', unitLabel: 'L' }}
      />,
    );

    const cabecera = screen
      .getByTestId(ORDER_EXECUTION_SCREEN_TESTID)
      .querySelector<HTMLElement>('[data-slot="operator-header"]');
    const fase = cabecera!.querySelector<HTMLElement>('[data-slot="operator-phase"]');
    expect(fase?.textContent).toBe(`Fabricación · ${EXECUTION.numberText}`);
    expect(fase?.querySelector('[data-slot="operator-eyebrow"]')?.textContent).toBe(
      EXECUTION.numberText,
    );

    const cantidad = screen.getByTestId(ORDER_EXECUTION_ORDER_QUANTITY_TESTID);
    expect(cabecera).toContainElement(cantidad);
    expect(cantidad.textContent).toBe('Cantidad 200 L');
    const meta = cabecera!.querySelector<HTMLElement>('[data-slot="operator-meta"]');
    expect(meta?.children).toHaveLength(1);
    expect(meta).toContainElement(cantidad);

    const insignia = screen.getByTestId(ORDER_EXECUTION_STATUS_TESTID);
    expect(cabecera).toContainElement(insignia);
    expect(insignia).toHaveTextContent(ORDER_STATUS_LABELS.EN_CURSO);
    expect(insignia).toHaveAttribute('data-status', 'EN_CURSO');
  });

  it('R2: sin comenzar, la insignia dice «Pendiente»', () => {
    render(<OrderExecutionScreen execution={{ ...EXECUTION, status: 'PENDIENTE' }} />);

    expect(screen.getByTestId(ORDER_EXECUTION_STATUS_TESTID)).toHaveTextContent(
      ORDER_STATUS_LABELS.PENDIENTE,
    );
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

describe('pantalla de ejecucion — R9: el pie del paso a paso', () => {
  function pie(): HTMLElement {
    const nodo = screen
      .getByTestId(ORDER_EXECUTION_SCREEN_TESTID)
      .querySelector<HTMLElement>('[data-slot="operator-footer"]');
    if (nodo === null) throw new Error('no hay pie');
    return nodo;
  }

  it('R9: «Anterior» y «Siguiente» van en el pie del marco, no en un pie fijo propio, con el motivo encima', () => {
    render(<OrderExecutionScreen execution={EXECUTION_DOS_PASOS} />);

    const acciones = within(pie()).getByTestId('step-reader-actions');
    expect(acciones.className).not.toContain('fixed');
    const anterior = within(acciones).getByTestId('step-reader-previous');
    const siguiente = within(acciones).getByTestId('step-reader-next');
    expect(anterior.className).toContain('h-13');
    expect(siguiente.className).toContain('h-13');
    const motivo = within(acciones).getByTestId('step-reader-reason-slot');
    expect(motivo.compareDocumentPosition(anterior) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(pie()).queryByTestId(ORDER_EXECUTION_START_BUTTON_TESTID)).toBeNull();
  });

  it('R9: en el último paso el pie ofrece «Terminar la fabricación» con el motivo del bloqueo', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    const terminar = within(pie()).getByTestId('step-reader-finish');
    expect(terminar.className).toContain('h-13');
    expect(terminar).toHaveTextContent(ORDER_EXECUTION_TEXTS.finish);
    expect(ORDER_EXECUTION_TEXTS.finish).toBe('Terminar la fabricación');
    expect(within(pie()).getByTestId('step-reader-blocked-reason')).toBeVisible();
  });

  it('R9: el progreso del paso va en la cabecera', () => {
    render(<OrderExecutionScreen execution={EXECUTION_DOS_PASOS} />);

    const cabecera = screen
      .getByTestId(ORDER_EXECUTION_SCREEN_TESTID)
      .querySelector<HTMLElement>('[data-slot="operator-header"]');
    expect(within(cabecera!).getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 2');
  });

  it('R34: la fabricación no pasa nota de seguridad: no hay bloque de nota', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    expect(screen.queryByTestId('step-reader-note')).toBeNull();
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('pantalla de ejecucion — R20, R21: secciones Materiales y Herramientas', () => {
  const CON_HERRAMIENTAS: StartedOrderExecution = {
    ...EXECUTION,
    tools: [{ productName: 'Espátula', quantity: 1 }],
  };

  function columna(): HTMLElement {
    return screen.getByTestId(ORDER_EXECUTION_MATERIALS_TESTID);
  }

  it('R20: la columna lleva solo Materiales y Herramientas, en ese orden, separadas del paso a paso', () => {
    render(<OrderExecutionScreen execution={CON_HERRAMIENTAS} />);

    const materiales = within(columna()).getByTestId(ORDER_EXECUTION_MATERIALS_SECTION_TESTIDS.card);
    const herramientas = within(columna()).getByTestId(ORDER_EXECUTION_TOOLS_SECTION_TESTIDS.card);
    expect(materiales.compareDocumentPosition(herramientas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(materiales).toContainElement(within(columna()).getByTestId(ORDER_EXECUTION_LINES_TESTID));
    expect(herramientas).toContainElement(within(columna()).getByTestId(ORDER_EXECUTION_TOOLS_TESTID));
    expect(columna().querySelectorAll('[data-slot="card"]')).toHaveLength(2);
    expect(columna()).toHaveAccessibleName('Materiales y herramientas');
    expect(within(columna()).queryByText(/equipo/i)).toBeNull();
    expect(columna().contains(screen.getByTestId('step-reader'))).toBe(false);
    expect(columna().contains(screen.getByTestId(ORDER_EXECUTION_TITLE_TESTID))).toBe(false);
  });

  it('R20: los botones flotantes son los de Materiales y Herramientas, en ese orden, sin Equipo', () => {
    render(<OrderExecutionScreen execution={CON_HERRAMIENTAS} />);

    const pila = screen.getByTestId(OPERATOR_SIDE_PANELS_FABS_TESTID);
    const nombres = within(pila)
      .getAllByRole('button')
      .map((boton) => boton.getAttribute('aria-label'));
    expect(nombres).toEqual(['Ver materiales', 'Ver herramientas']);
  });

  it('R20: la lista de herramientas toma el nombre de su tarjeta y no repite el título', () => {
    render(<OrderExecutionScreen execution={CON_HERRAMIENTAS} />);

    const lista = within(columna()).getByTestId(ORDER_EXECUTION_TOOLS_TESTID);
    expect(lista).toHaveAccessibleName('Herramientas');
    expect(within(lista).queryByRole('heading')).toBeNull();
  });

  it('R21: sin herramientas no hay tarjeta Herramientas ni su botón flotante', () => {
    render(<OrderExecutionScreen execution={{ ...EXECUTION, tools: [] }} />);

    expect(screen.queryByTestId(ORDER_EXECUTION_TOOLS_SECTION_TESTIDS.card)).toBeNull();
    expect(screen.queryByTestId(ORDER_EXECUTION_TOOLS_SECTION_TESTIDS.fab)).toBeNull();
    expect(screen.queryByTestId(ORDER_EXECUTION_TOOLS_TESTID)).toBeNull();
    expect(screen.getByTestId(ORDER_EXECUTION_MATERIALS_SECTION_TESTIDS.card)).toContainElement(
      screen.getByTestId(ORDER_EXECUTION_LINES_TESTID),
    );
    expect(screen.getByTestId(ORDER_EXECUTION_MATERIALS_SECTION_TESTIDS.fab)).toBeInTheDocument();
  });

  it('R20: con el panel de herramientas abierto, cada copia de la lista tiene su nombre y no hay ids repetidos', async () => {
    const user = setupUser();
    render(<OrderExecutionScreen execution={CON_HERRAMIENTAS} />);

    await user.click(
      await esperarInteractiva(screen.getByTestId(ORDER_EXECUTION_TOOLS_SECTION_TESTIDS.fab)),
    );
    const panel = await screen.findByRole('dialog');

    const listas = screen.getAllByTestId(ORDER_EXECUTION_TOOLS_TESTID);
    expect(listas).toHaveLength(2);
    expect(within(panel).getByTestId(ORDER_EXECUTION_TOOLS_TESTID)).toHaveAccessibleName('Herramientas');
    const ids = Array.from(document.querySelectorAll('[id]')).map((nodo) => nodo.id);
    expect(ids.length).toBe(new Set(ids).size);
  });
});

describe('pantalla de ejecucion — R22: la unidad elegida vive en la pantalla', () => {
  async function elegirMl(user: ReturnType<typeof setupUser>, dentro: HTMLElement): Promise<void> {
    await user.click(
      await esperarInteractiva(within(dentro).getByTestId(`${ORDER_EXECUTION_LINE_UNIT_SELECT_TESTID}-0`)),
    );
    const opciones = await screen.findAllByTestId(ORDER_EXECUTION_LINE_UNIT_OPTION_TESTID);
    const ml = opciones.find((opcion) => opcion.textContent === 'ml');
    if (ml === undefined) throw new Error('no se encontro la opcion ml');
    await user.click(await esperarInteractiva(ml));
  }

  function unidad(dentro: HTMLElement): HTMLElement {
    return within(dentro).getByTestId(`${ORDER_EXECUTION_LINE_UNIT_TESTID}-0`);
  }

  it('R22: la unidad elegida en la columna sale en el panel, y la del panel sigue al cerrarlo y reabrirlo', async () => {
    const user = setupUser();
    render(<OrderExecutionScreen execution={EXECUTION} />);
    const columna = screen.getByTestId(ORDER_EXECUTION_MATERIALS_TESTID);
    expect(unidad(columna)).toHaveTextContent('L');

    await elegirMl(user, columna);
    expect(unidad(columna)).toHaveTextContent('ml');

    const fab = screen.getByTestId(ORDER_EXECUTION_MATERIALS_SECTION_TESTIDS.fab);
    await user.click(await esperarInteractiva(fab));
    let panel = await screen.findByRole('dialog');
    expect(unidad(panel)).toHaveTextContent('ml');

    await user.click(within(panel).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(await esperarInteractiva(fab));
    panel = await screen.findByRole('dialog');
    expect(unidad(panel)).toHaveTextContent('ml');
  });

  it('R22: plegar y desplegar la tarjeta de materiales conserva la unidad', async () => {
    const user = setupUser();
    render(<OrderExecutionScreen execution={EXECUTION} />);
    const columna = screen.getByTestId(ORDER_EXECUTION_MATERIALS_TESTID);

    await elegirMl(user, columna);
    const disparador = screen.getByTestId(ORDER_EXECUTION_MATERIALS_SECTION_TESTIDS.trigger);
    await user.click(await esperarInteractiva(disparador));
    await user.click(disparador);

    expect(unidad(columna)).toHaveTextContent('ml');
  });
});

describe('pantalla de ejecucion — R26: objetivos tactiles de 44x44 en todo control nuevo', () => {
  /** 44 x 44 como minimo; los botones del pie y el disparador del panel miden 52 de alto. */
  function esObjetivoTactil(elemento: Element): boolean {
    const clases = elemento.className.split(/\s+/);
    const alto = ['min-h-11', 'min-h-13', 'h-13', 'size-11', 'size-14'].some((c) => clases.includes(c));
    const ancho = ['min-w-11', 'w-full', 'size-11', 'size-14'].some((c) => clases.includes(c));
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
      // La casilla se marca tocando toda su tarjeta: el objetivo es el `label`, de 60 px de alto y
      // todo el ancho de la fila.
      const tarjeta = control.getAttribute('data-slot') === 'checkbox' ? control.closest('label') : null;
      const ok = tarjeta !== null
        ? tarjeta.className.split(/\s+/).includes('min-h-15')
        : esObjetivoTactil(control);
      expect(ok, control.outerHTML).toBe(true);
    }
  });

  it('R1: no usa `100vh` en su contenedor: usa `h-dvh`', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    expect(screen.getByTestId(ORDER_EXECUTION_SCREEN_TESTID).className).toContain('h-dvh');
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

  const PERMITIDOS = [
    'components/shared/step-reader/step-reader.tsx',
    'components/shared/step-reader/step-document-view.tsx',
    'components/shared/step-reader/index.ts',
  ];

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

describe('pantalla de ejecucion — entrar es libre: «Comenzar» dentro de la pantalla', () => {
  const PENDIENTE: StartedOrderExecution = { ...EXECUTION, status: 'PENDIENTE' };
  const EXECUTION_DOS_PASOS_PENDIENTE: StartedOrderExecution = {
    ...EXECUTION_DOS_PASOS,
    status: 'PENDIENTE',
  };

  it('R8: PENDIENTE pinta en el pie un único botón «Comenzar la fabricación», centrado, sin paso a paso ni Finalizar', () => {
    render(<OrderExecutionScreen execution={PENDIENTE} />);

    const pie = screen
      .getByTestId(ORDER_EXECUTION_SCREEN_TESTID)
      .querySelector<HTMLElement>('[data-slot="operator-footer"]');
    expect(within(pie!).getAllByRole('button')).toHaveLength(1);
    const boton = within(pie!).getByTestId(ORDER_EXECUTION_START_BUTTON_TESTID);
    expect(boton).toHaveTextContent('Comenzar la fabricación');
    expect(boton).toBeEnabled();
    const celda = screen.getByTestId(ORDER_EXECUTION_START_FORM_TESTID).parentElement;
    expect(celda).toHaveClass('mx-auto', 'max-w-[360px]');
    expect(screen.queryByText('Verifica el equipo antes de cargar')).toBeNull();
    expect(screen.queryByTestId('step-reader-finish')).toBeNull();
    expect(screen.queryByTestId('step-reader-actions')).toBeNull();
  });

  it('R17: PENDIENTE pinta «Revisa antes de comenzar» con su texto y el número de pasos, sin listarlos', () => {
    render(<OrderExecutionScreen execution={EXECUTION_DOS_PASOS_PENDIENTE} />);

    const tarjeta = screen.getByTestId(ORDER_EXECUTION_NOT_STARTED_TESTID);
    expect(within(tarjeta).getByRole('heading', { level: 3 })).toHaveTextContent(
      'Revisa antes de comenzar',
    );
    expect(tarjeta).toHaveTextContent(ORDER_EXECUTION_TEXTS.startBody);
    expect(tarjeta).toHaveTextContent('2 pasos');
    expect(within(tarjeta).queryByRole('list')).toBeNull();
    expect(screen.queryByText('Paso uno sin elementos')).toBeNull();
  });

  it('R17: con un solo paso dice «1 paso»', () => {
    render(<OrderExecutionScreen execution={PENDIENTE} />);

    expect(screen.getByTestId(ORDER_EXECUTION_NOT_STARTED_TESTID)).toHaveTextContent('1 paso');
  });

  it('R3: PENDIENTE: la vuelta es un enlace habilitado a la lista de pedidos asignados, sin línea «Fabricando»', () => {
    render(<OrderExecutionScreen execution={PENDIENTE} />);

    const back = screen.getByTestId(ORDER_EXECUTION_BACK_LINK_TESTID);
    expect(back.tagName).toBe('A');
    expect(back).toHaveAttribute('href', ASSIGNED_ORDERS_ROUTE);
    expect(back).not.toHaveAttribute('aria-disabled');
    expect(back).toHaveTextContent(ORDER_EXECUTION_TEXTS.back);
    expect(screen.queryByText(ORDER_EXECUTION_TEXTS.running)).toBeNull();
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

  it('R4: confirmar comienza el pedido y pinta la ejecucion: paso a paso y «Fabricando» en lugar de la vuelta', async () => {
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
    expect(screen.queryByTestId(ORDER_EXECUTION_BACK_LINK_TESTID)).toBeNull();
    expect(screen.getByText(ORDER_EXECUTION_TEXTS.running)).toHaveAttribute('role', 'status');
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

  it('R4: EN_CURSO: la cabecera no lleva la vuelta, ni deshabilitada, sino «Fabricando» con role="status"', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    const cabecera = screen
      .getByTestId(ORDER_EXECUTION_SCREEN_TESTID)
      .querySelector<HTMLElement>('[data-slot="operator-header"]');
    expect(screen.queryByTestId(ORDER_EXECUTION_BACK_LINK_TESTID)).toBeNull();
    expect(within(cabecera!).queryByText(ORDER_EXECUTION_TEXTS.back)).toBeNull();
    expect(within(cabecera!).queryByRole('link')).toBeNull();
    const linea = within(cabecera!).getByText(ORDER_EXECUTION_TEXTS.running);
    expect(linea).toHaveAttribute('role', 'status');
    expect(linea.textContent).toBe('Fabricando');
    expect(screen.queryByTestId(ORDER_EXECUTION_START_BUTTON_TESTID)).toBeNull();
  });
});

describe('pantalla de ejecucion — R32: las mismas acciones con los mismos argumentos', () => {
  it('R32: comenzar llama a startAssignedOrderAction con el id del pedido, tras el mismo diálogo', async () => {
    startAssignedOrderActionMock.mockResolvedValue({
      status: 'success',
      data: { ...EXECUTION, resumeStepPosition: 1 },
    });
    render(<OrderExecutionScreen execution={{ ...EXECUTION, status: 'PENDIENTE' }} />);

    fireEvent.click(screen.getByTestId(ORDER_EXECUTION_START_BUTTON_TESTID));
    expect(screen.getByTestId(ORDER_EXECUTION_START_DIALOG_TESTID)).toHaveTextContent(
      assignedOrderStartConfirmTexts().title,
    );
    expect(startAssignedOrderActionMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(ORDER_EXECUTION_START_CONFIRM_TESTID));

    await waitFor(() => expect(startAssignedOrderActionMock).toHaveBeenCalledTimes(1));
    expect(startAssignedOrderActionMock).toHaveBeenCalledWith(EXECUTION.orderId);
  });

  it('R32: cambiar de paso registra el movimiento y terminar envía orderId y la posición del paso', async () => {
    finishAssignedOrderActionMock.mockResolvedValue({ status: 'success' });
    vi.useFakeTimers();
    try {
      render(<OrderExecutionScreen execution={EXECUTION_DOS_PASOS} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('step-reader-next'));
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(recordStepMoveActionMock).toHaveBeenCalledTimes(1);
      expect(recordStepMoveActionMock).toHaveBeenCalledWith({
        orderId: EXECUTION_DOS_PASOS.orderId,
        direction: 'advance',
        stepPosition: 2,
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('step-reader-finish'));
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByTestId(ORDER_EXECUTION_FINISH_DIALOG_TESTID)).toHaveTextContent(
        ORDER_EXECUTION_FINISH_CONFIRM_TEXTS.title,
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId(ORDER_EXECUTION_FINISH_CONFIRM_TESTID));
        await vi.advanceTimersByTimeAsync(0);
      });
    } finally {
      vi.useRealTimers();
    }

    expect(finishAssignedOrderActionMock).toHaveBeenCalledTimes(1);
    const [, formData] = finishAssignedOrderActionMock.mock.calls[0] as [unknown, FormData];
    expect(formData.get(ORDER_EXECUTION_ORDER_ID_FIELD)).toBe(EXECUTION_DOS_PASOS.orderId);
    expect(formData.get(ORDER_EXECUTION_STEP_POSITION_FIELD)).toBe('2');
  });

  it('R32: el menú de la cabecera sigue ofreciendo «Cancelar pedido»', () => {
    render(<OrderExecutionScreen execution={EXECUTION} />);

    expect(screen.getByTestId(ORDER_EXECUTION_ACTIONS_TESTID)).toHaveAccessibleName(
      ORDER_EXECUTION_TEXTS.actions(EXECUTION.numberText),
    );
  });
});
