import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PACKING_ORDER_FINISH_BUTTON_TESTID,
  PACKING_ORDER_FINISH_CONFIRM_TESTID,
  PACKING_ORDER_FINISH_DIALOG_TESTID,
  PACKING_ORDER_FINISH_ERROR_TESTID,
  PACKING_ORDER_FINISH_FORM_TESTID,
  PACKING_ORDER_ID_FIELD,
  PACKING_ORDER_LINES_FIELD,
  PACKING_FINISH_DIALOG_TEXTS,
  PACKING_FINISH_LINE_TESTID,
  PACKING_FINISH_REASON_TESTID,
  PACKING_ORDER_MISSING_DISTRIBUTION_TESTID,
  PACKING_ORDER_MISSING_UNIT_TESTID,
  PACKING_ORDER_PRESENTATION_LINE_TESTID,
  PACKING_ORDER_PRESENTATION_TESTID,
  PACKING_ORDER_QUANTITY_TESTID,
  PACKING_ORDER_SCREEN_TESTID,
  PACKING_ORDER_START_BUTTON_TESTID,
  PACKING_ORDER_START_CONFIRM_TESTID,
  PACKING_ORDER_START_CONFIRM_TEXTS,
  PACKING_ORDER_START_DIALOG_TESTID,
  PACKING_ORDER_STATUS_TESTID,
  PACKING_ORDER_STEPS_TESTID,
  PACKING_ORDER_BACK_LINK_TESTID,
  PACKING_ORDER_PACKER_TESTID,
  PACKING_ORDER_RECIPE_TESTID,
  PACKING_ORDER_START_FORM_TESTID,
  PACKING_ORDER_TEXTS,
  PackingOrderScreen,
} from '@/app/(private)/asignacion/empaque/[id]/components';
import { STEP_READER_SIDE_COLUMN_RESERVE } from '@/app/(private)/asignacion/components/operator-screen-frame';
import {
  ENTITY_IMAGE_ZOOM_TRIGGER_TESTID,
  MISSING_IMAGE_SRC,
} from '@/components/shared/entity-image';
import type { PackingOrderDetail } from '@/lib/modules/asignaciones';
import { ORDER_STATUS_LABELS } from '@/lib/shared/ui/order-status';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';

const { startPackingActionMock, finishPackingActionMock } = vi.hoisted(() => ({
  startPackingActionMock: vi.fn(),
  finishPackingActionMock: vi.fn(),
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-packing-actions', () => ({
  startPackingAction: startPackingActionMock,
  finishPackingAction: finishPackingActionMock,
}));

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const LITRO = { id: 'unit-1', baseUnitId: null, factor: null } as const;

const FINISH: NonNullable<PackingOrderDetail['finish']> = {
  orderQuantity: '12.5',
  orderUnit: LITRO,
  orderUnitLabel: 'kg',
  lines: [
    { lineId: 'linea-1', label: 'Botella 200 ml', plan: 5, content: '0.2', unit: LITRO, packaging: null },
    { lineId: 'linea-2', label: 'Garrafa 5 l', plan: 2, content: '5', unit: LITRO, packaging: null },
  ],
};

const FINISH_CONFIRM_TEXTS = {
  title: PACKING_FINISH_DIALOG_TEXTS.title,
  description: PACKING_FINISH_DIALOG_TEXTS.descriptionEnd,
  cancel: PACKING_FINISH_DIALOG_TEXTS.cancel,
  confirm: PACKING_FINISH_DIALOG_TEXTS.confirm,
} as const;

const PLAN_SIN_CAMBIOS = [
  { lineId: 'linea-1', packedPackages: 5, reason: null, reasonOther: null },
  { lineId: 'linea-2', packedPackages: 2, reason: null, reasonOther: null },
];
const MISSING_DISTRIBUTION_TEXT = 'Falta el reparto: lo define quien edita pedidos';

function fila(overrides: Partial<PackingOrderDetail> = {}): PackingOrderDetail {
  return {
    id: 'order-1',
    numberText: '2026-0000030',
    recipeName: 'Jarabe simple',
    quantity: '12.5',
    presentationLines: [
      { lineId: 'linea-1', packedPackages: null, presentationId: 'p-1', presentationName: 'Botella 200 ml', packagingName: null, packages: 5 },
      { lineId: 'linea-2', packedPackages: null, presentationId: 'p-2', presentationName: 'Garrafa 5 l', packagingName: null, packages: 2 },
      { lineId: 'linea-3', packedPackages: null, presentationId: 'p-3', presentationName: null, packagingName: null, packages: 1 },
    ],
    unitId: 'unit-1',
    unitLabel: 'kg',
    status: 'POR_EMPACAR',
    packedByName: null,
    packedById: null,
    packingSteps: [],
    packingEvidence: [],
    finish: null,
    ...overrides,
  };
}

function pintar(order: PackingOrderDetail) {
  render(
    <PackingOrderScreen order={order} actorId={ACTOR_ID} backHref="/asignacion?vista=por_empacar" />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('pantalla del Empacador — el reparto completo en solo lectura', () => {
  it('R47/R26: pinta TODAS las lineas del reparto, en orden de alta, con envases y nombre', () => {
    pintar(fila());

    const lineas = screen.getAllByTestId(PACKING_ORDER_PRESENTATION_LINE_TESTID);
    expect(lineas.map((linea) => linea.textContent)).toEqual([
      '5 × Botella 200 ml',
      '2 × Garrafa 5 l',
      '1 × —',
    ]);
  });

  it('cada linea del reparto lleva la miniatura de su envase, con el nombre del envase como alt', () => {
    pintar(
      fila({
        presentationLines: [
          {
            lineId: 'linea-1',
            packedPackages: null,
            presentationId: 'p-1',
            presentationName: 'Botella 200 ml',
            packagingName: 'Galón 4 L',
            packagingImageUrl: 'https://cdn.example/galon.png',
            packages: 3,
          },
          { lineId: 'linea-2', packedPackages: null, presentationId: 'p-2', presentationName: 'Garrafa 5 l', packagingName: 'Botella 1 L', packagingImageUrl: null, packages: 12 },
        ],
      }),
    );

    const lineas = screen.getAllByTestId(PACKING_ORDER_PRESENTATION_LINE_TESTID);
    expect(lineas.map((linea) => linea.querySelectorAll('img').length)).toEqual([1, 1]);
    const [conImagen, sinImagen] = lineas.map((linea) => within(linea).getByRole('img'));
    expect(conImagen).toHaveAttribute('alt', 'Galón 4 L');
    expect(conImagen).toHaveAttribute('src', 'https://cdn.example/galon.png');
    expect(conImagen).not.toHaveAttribute('data-missing');
    expect(sinImagen).toHaveAttribute('alt', 'Botella 1 L');
    expect(sinImagen).toHaveAttribute('data-missing', 'true');
    expect(sinImagen).toHaveAttribute('src', MISSING_IMAGE_SRC);
    expect(lineas.map((linea) => linea.textContent)).toEqual(['3 × Galón 4 L', '12 × Botella 1 L']);
  });

  it('una linea antigua sin envase muestra el marcador con el nombre de la presentacion', () => {
    pintar(fila());

    const [primera] = screen.getAllByTestId(PACKING_ORDER_PRESENTATION_LINE_TESTID);
    const imagen = within(primera).getByRole('img');
    expect(imagen).toHaveAttribute('alt', 'Botella 200 ml');
    expect(imagen).toHaveAttribute('data-missing', 'true');
  });

  it('R26: la cantidad del pedido va con su unidad', () => {
    pintar(fila({ quantity: '12.5', unitLabel: 'kg' }));

    expect(screen.getByTestId(PACKING_ORDER_QUANTITY_TESTID)).toHaveTextContent('Cantidad: 12.5 kg');
  });

  it('R26: sin unidad, la cantidad va sola', () => {
    pintar(fila({ quantity: '12.5', unitId: null, unitLabel: null }));

    const cantidad = screen.getByTestId(PACKING_ORDER_QUANTITY_TESTID);
    expect(cantidad.textContent?.trim()).toBe('Cantidad: 12.5');
  });

  it('R47: no hay selector de presentacion ni de unidad, ni botones de añadir/quitar, ni campo de envases', () => {
    for (const status of ['POR_EMPACAR', 'EN_EMPAQUE'] as const) {
      pintar(fila({ status, packedById: ACTOR_ID, packedByName: 'Empacador de Prueba' }));
      const pantalla = screen.getByTestId(PACKING_ORDER_SCREEN_TESTID);

      expect(within(pantalla).queryAllByRole('combobox')).toHaveLength(0);
      expect(within(pantalla).queryAllByRole('listbox')).toHaveLength(0);
      expect(pantalla.querySelectorAll('select')).toHaveLength(0);
      expect(within(pantalla).queryAllByRole('spinbutton')).toHaveLength(0);
      expect(within(pantalla).queryAllByRole('textbox')).toHaveLength(0);
      expect(pantalla.querySelectorAll('input:not([type="hidden"]), textarea')).toHaveLength(0);
      expect(within(pantalla).queryByRole('button', { name: /añadir|agregar|quitar|eliminar/i })).toBeNull();
      // Los unicos botones del reparto son las miniaturas que amplian la imagen del envase.
      const botones = within(screen.getByTestId(PACKING_ORDER_PRESENTATION_TESTID)).queryAllByRole('button');
      expect(botones.map((boton) => boton.dataset.testid)).toEqual(
        botones.map(() => ENTITY_IMAGE_ZOOM_TRIGGER_TESTID),
      );

      cleanup();
    }
  });
});

describe('pantalla del Empacador — aviso de reparto pendiente', () => {
  it('R47: `POR_EMPACAR` sin lineas muestra «Falta el reparto: lo define quien edita pedidos»', () => {
    pintar(fila({ status: 'POR_EMPACAR', presentationLines: [] }));

    expect(screen.getByTestId(PACKING_ORDER_MISSING_DISTRIBUTION_TESTID)).toHaveTextContent(
      MISSING_DISTRIBUTION_TEXT,
    );
    expect(screen.queryAllByTestId(PACKING_ORDER_PRESENTATION_LINE_TESTID)).toHaveLength(0);
  });

  it('R47: `POR_EMPACAR` con lineas no muestra el aviso', () => {
    pintar(fila({ status: 'POR_EMPACAR' }));

    expect(screen.queryByTestId(PACKING_ORDER_MISSING_DISTRIBUTION_TESTID)).toBeNull();
    expect(screen.queryByText(MISSING_DISTRIBUTION_TEXT)).toBeNull();
  });

  it('R47: `EN_EMPAQUE` sin lineas no muestra el aviso', () => {
    pintar(
      fila({
        status: 'EN_EMPAQUE',
        presentationLines: [],
        packedById: ACTOR_ID,
        packedByName: 'Empacador de Prueba',
      }),
    );

    expect(screen.queryByTestId(PACKING_ORDER_MISSING_DISTRIBUTION_TESTID)).toBeNull();
    expect(screen.queryByText(MISSING_DISTRIBUTION_TEXT)).toBeNull();
  });
});

describe('pantalla del Empacador — ni disponible ni aviso de exceso', () => {
  it('R47: no pinta disponible ni aviso de que el reparto se pasa del total', () => {
    pintar(fila());

    expect(screen.queryByText(/disponible/i)).toBeNull();
    expect(screen.queryByText(/excede|se pasa|supera/i)).toBeNull();
  });
});

describe('pantalla del Empacador — el nombre del envase de cada linea', () => {
  it('R44: una linea con envase pinta el nombre del envase, no el de la presentacion', () => {
    pintar(
      fila({
        presentationLines: [
          { lineId: 'linea-4', packedPackages: null, presentationId: 'p-1', presentationName: 'Botella 200 ml', packagingName: 'Botella PET ámbar 200 ml', packages: 5 },
        ],
      }),
    );

    const lineas = screen.getAllByTestId(PACKING_ORDER_PRESENTATION_LINE_TESTID);
    expect(lineas.map((linea) => linea.textContent)).toEqual(['5 × Botella PET ámbar 200 ml']);
  });

  it('R44: una linea antigua (`packagingName` null) pinta el nombre de su presentacion', () => {
    pintar(
      fila({
        presentationLines: [
          { lineId: 'linea-5', packedPackages: null, presentationId: 'p-1', presentationName: 'Botella PET', packagingName: 'Botella PET ámbar 200 ml', packages: 5 },
          { lineId: 'linea-6', packedPackages: null, presentationId: 'p-2', presentationName: 'Garrafa 5 l', packagingName: null, packages: 2 },
        ],
      }),
    );

    const lineas = screen.getAllByTestId(PACKING_ORDER_PRESENTATION_LINE_TESTID);
    expect(lineas.map((linea) => linea.textContent)).toEqual([
      '5 × Botella PET ámbar 200 ml',
      '2 × Garrafa 5 l',
    ]);
  });
});

describe('pantalla del Empacador — Comenzar y Terminar piden confirmacion', () => {
  const CASOS = [
    {
      nombre: 'Comenzar',
      order: () => fila(),
      button: PACKING_ORDER_START_BUTTON_TESTID,
      dialog: PACKING_ORDER_START_DIALOG_TESTID,
      confirm: PACKING_ORDER_START_CONFIRM_TESTID,
      texts: PACKING_ORDER_START_CONFIRM_TEXTS,
      action: startPackingActionMock,
      other: finishPackingActionMock,
    },
    {
      nombre: 'Terminar',
      order: () => fila({ status: 'EN_EMPAQUE', packedById: ACTOR_ID, packedByName: 'Yo', finish: FINISH }),
      button: PACKING_ORDER_FINISH_BUTTON_TESTID,
      dialog: PACKING_ORDER_FINISH_DIALOG_TESTID,
      confirm: PACKING_ORDER_FINISH_CONFIRM_TESTID,
      texts: FINISH_CONFIRM_TEXTS,
      action: finishPackingActionMock,
      other: startPackingActionMock,
    },
  ] as const;

  for (const caso of CASOS) {
    it(`${caso.nombre}: el boton no envia el formulario, abre la confirmacion`, () => {
      pintar(caso.order());

      const boton = screen.getByTestId(caso.button);
      expect(boton).toHaveAttribute('type', 'button');
      expect(screen.queryByTestId(caso.dialog)).toBeNull();

      fireEvent.click(boton);

      const dialog = screen.getByTestId(caso.dialog);
      expect(dialog).toHaveTextContent(caso.texts.title);
      expect(dialog).toHaveTextContent(caso.texts.description);
      expect(screen.getByTestId(caso.confirm)).toHaveTextContent(caso.texts.confirm);
      expect(caso.action).not.toHaveBeenCalled();
    });

    it(`${caso.nombre}: cancelar no invoca la accion`, async () => {
      pintar(caso.order());

      fireEvent.click(screen.getByTestId(caso.button));
      fireEvent.click(screen.getByRole('button', { name: caso.texts.cancel }));
      await act(async () => {});

      expect(caso.action).not.toHaveBeenCalled();
    });

    it(`${caso.nombre}: confirmar envia el formulario con el id del pedido`, async () => {
      caso.action.mockResolvedValue({ status: 'success' });
      pintar(caso.order());

      fireEvent.click(screen.getByTestId(caso.button));
      await act(async () => {
        fireEvent.click(screen.getByTestId(caso.confirm));
      });

      expect(caso.action).toHaveBeenCalledTimes(1);
      expect(caso.other).not.toHaveBeenCalled();
      const [, formData] = caso.action.mock.calls[0] as [unknown, FormData];
      expect(formData.get(PACKING_ORDER_ID_FIELD)).toBe('order-1');
    });
  }
});

describe('pantalla del Empacador — los pasos de envasado', () => {
  const LLENAR = 'Llenar las garrafas hasta la marca';
  const TAPADAS = 'Garrafas tapadas';
  const ETIQUETAR = 'Etiquetar el lote';
  const PASO_DEL_OPERADOR = 'Mezclar el hipoclorito despacio';

  const PASOS_DE_ENVASADO: PackingOrderDetail['packingSteps'] = [
    {
      blocks: [
        { kind: 'paragraph', spans: [{ text: LLENAR }] },
        { kind: 'checklist', items: [{ spans: [{ text: TAPADAS }] }] },
      ],
    },
    { blocks: [{ kind: 'paragraph', spans: [{ text: ETIQUETAR }] }] },
  ];

  const enEmpaquePropio = (packingSteps: PackingOrderDetail['packingSteps'] = PASOS_DE_ENVASADO) =>
    fila({ status: 'EN_EMPAQUE', packedById: ACTOR_ID, packedByName: 'Yo', packingSteps, finish: FINISH });

  function marcarTodo(): void {
    for (const casilla of screen.queryAllByRole('checkbox')) {
      if (casilla.getAttribute('aria-checked') !== 'true') fireEvent.click(casilla);
    }
  }

  async function esperar(ms: number): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  async function recorrerHastaElUltimo(): Promise<void> {
    vi.useFakeTimers();
    try {
      pintar(enEmpaquePropio());
      marcarTodo();
      await esperar(5000);
      fireEvent.click(screen.getByTestId('step-reader-next'));
      await esperar(5000);
    } finally {
      vi.useRealTimers();
    }
  }

  it('R19: `POR_EMPACAR` con pasos en la prop no pinta ninguno', () => {
    pintar(fila({ packingSteps: PASOS_DE_ENVASADO }));

    expect(screen.queryByTestId(PACKING_ORDER_STEPS_TESTID)).toBeNull();
    expect(screen.queryByTestId('step-reader')).toBeNull();
    expect(screen.queryByText(LLENAR)).toBeNull();
    expect(screen.queryByText(ETIQUETAR)).toBeNull();
    expect(screen.getByTestId(PACKING_ORDER_START_BUTTON_TESTID)).toBeInTheDocument();
  });

  it('R19: `EN_EMPAQUE` de otro con pasos en la prop no pinta ninguno', () => {
    pintar(fila({ status: 'EN_EMPAQUE', packedById: 'otro', packedByName: 'Otra', packingSteps: PASOS_DE_ENVASADO }));

    expect(screen.queryByTestId(PACKING_ORDER_STEPS_TESTID)).toBeNull();
    expect(screen.queryByText(LLENAR)).toBeNull();
  });

  function tarjetaResumen(): HTMLElement {
    const tarjeta = screen.getByTestId(PACKING_ORDER_QUANTITY_TESTID).closest('[data-slot="card"]');
    expect(tarjeta).not.toBeNull();
    return tarjeta as HTMLElement;
  }

  it('QC-269 R4, R7: con paso a paso, la Card de la izquierda reserva el pie fijo del lector', () => {
    pintar(enEmpaquePropio());

    expect(screen.getByTestId('step-reader')).toBeInTheDocument();
    expect(tarjetaResumen().className.split(/\s+/)).toContain(STEP_READER_SIDE_COLUMN_RESERVE);
  });

  it('QC-269 R8: sin paso a paso, la Card no reserva nada (el marco ya reserva su pie)', () => {
    pintar(enEmpaquePropio([]));

    expect(screen.queryByTestId('step-reader')).toBeNull();
    expect(tarjetaResumen().className.split(/\s+/)).not.toContain(STEP_READER_SIDE_COLUMN_RESERVE);
  });

  it('R20: `EN_EMPAQUE` propio pinta el paso a paso, un paso por pantalla y sin el boton Terminar suelto', () => {
    pintar(enEmpaquePropio());

    const pasos = screen.getByTestId(PACKING_ORDER_STEPS_TESTID);
    expect(within(pasos).getByTestId('step-reader-title')).toHaveTextContent('Pasos de envasado');
    expect(within(pasos).getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 2');
    expect(within(pasos).getByText(LLENAR)).toBeInTheDocument();
    expect(screen.queryByText(ETIQUETAR)).toBeNull();
    expect(screen.queryByTestId(PACKING_ORDER_FINISH_BUTTON_TESTID)).toBeNull();
  });

  it('QC-265 R30: con pasos, el pie es el del paso a paso y no se pintan «Comenzar» ni «Terminar» de R29', () => {
    pintar(enEmpaquePropio());

    const raiz = screen.getByTestId(PACKING_ORDER_SCREEN_TESTID);
    expect(raiz.querySelector('[data-slot="operator-footer"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Comenzar' })).toBeNull();
    expect(screen.queryByTestId(PACKING_ORDER_START_BUTTON_TESTID)).toBeNull();
    expect(screen.queryByTestId(PACKING_ORDER_FINISH_BUTTON_TESTID)).toBeNull();
    expect(screen.getByTestId('step-reader-previous')).toBeInTheDocument();
    expect(screen.getByTestId('step-reader-next')).toBeInTheDocument();
    expect(screen.getByTestId(PACKING_ORDER_FINISH_FORM_TESTID)).toHaveClass('hidden');
  });

  it('R1, R21: el ultimo boton dice «Terminar» y abre el diálogo del conteo, que envía las líneas', async () => {
    finishPackingActionMock.mockResolvedValue({ status: 'success' });
    await recorrerHastaElUltimo();

    expect(screen.getByText(ETIQUETAR)).toBeInTheDocument();
    const terminar = screen.getByTestId('step-reader-finish');
    expect(terminar).toHaveTextContent('Terminar');

    fireEvent.click(terminar);
    const dialogo = screen.getByTestId(PACKING_ORDER_FINISH_DIALOG_TESTID);
    expect(dialogo).toHaveTextContent(PACKING_FINISH_DIALOG_TEXTS.title);
    expect(within(dialogo).getAllByTestId(PACKING_FINISH_LINE_TESTID)).toHaveLength(2);
    expect(finishPackingActionMock).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId(PACKING_ORDER_FINISH_CONFIRM_TESTID));
    });

    expect(finishPackingActionMock).toHaveBeenCalledTimes(1);
    expect(startPackingActionMock).not.toHaveBeenCalled();
    const [, formData] = finishPackingActionMock.mock.calls[0] as [unknown, FormData];
    expect(formData.get(PACKING_ORDER_ID_FIELD)).toBe('order-1');
    expect(JSON.parse(String(formData.get(PACKING_ORDER_LINES_FIELD)))).toEqual(PLAN_SIN_CAMBIOS);
  });

  it('R21: mientras termina, el ultimo boton dice «Terminando…» como el boton de hoy', async () => {
    let resolver: (value: { status: 'success' }) => void = () => {};
    finishPackingActionMock.mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve;
      }),
    );
    await recorrerHastaElUltimo();

    try {
      fireEvent.click(screen.getByTestId('step-reader-finish'));
      await act(async () => {
        fireEvent.click(screen.getByTestId(PACKING_ORDER_FINISH_CONFIRM_TESTID));
      });

      const terminar = screen.getByTestId('step-reader-finish');
      expect(terminar).toHaveTextContent('Terminando…');
      expect(terminar).toBeDisabled();
      expect(terminar).toHaveAttribute('aria-busy', 'true');
    } finally {
      // Una acción sin resolver deja colgada la transición y bloquea las del caso siguiente.
      await act(async () => {
        resolver({ status: 'success' });
      });
    }
  });

  it('R21: los errores de terminar se pintan en la region de siempre', async () => {
    finishPackingActionMock.mockResolvedValue({
      status: 'error',
      code: 'order_not_in_packing',
      message: 'El pedido ya no esta en empaque.',
    });
    await recorrerHastaElUltimo();

    fireEvent.click(screen.getByTestId('step-reader-finish'));
    fireEvent.click(screen.getByTestId(PACKING_ORDER_FINISH_CONFIRM_TESTID));

    expect(await screen.findByTestId(PACKING_ORDER_FINISH_ERROR_TESTID)).toHaveTextContent(
      'El pedido ya no esta en empaque.',
    );
  });

  it('R23: con un check sin marcar no se avanza aunque pase la espera, y el motivo es visible', async () => {
    vi.useFakeTimers();
    try {
      pintar(enEmpaquePropio());
      await esperar(5000);

      expect(screen.getByTestId('step-reader-next')).toBeDisabled();
      expect(screen.getByTestId('step-reader-blocked-reason')).toBeVisible();
      expect(screen.getByTestId('step-reader-blocked-reason')).toHaveTextContent(/pendientes/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('R23: antes de 5 s no se avanza ni se termina, y la espera se explica en texto', async () => {
    vi.useFakeTimers();
    try {
      pintar(enEmpaquePropio(PASOS_DE_ENVASADO.slice(1)));

      await esperar(4999);
      expect(screen.getByTestId('step-reader-finish')).toBeDisabled();
      expect(screen.getByTestId('step-reader-wait-reason')).toHaveTextContent('para continuar.');
      fireEvent.click(screen.getByTestId('step-reader-finish'));
      expect(screen.queryByTestId(PACKING_ORDER_FINISH_DIALOG_TESTID)).toBeNull();

      await esperar(1);
      expect(screen.getByTestId('step-reader-finish')).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
    expect(finishPackingActionMock).not.toHaveBeenCalled();
  });

  it('R25: sin pasos de envasado, `EN_EMPAQUE` propio pinta el boton Terminar de hoy', () => {
    pintar(enEmpaquePropio([]));

    expect(screen.queryByTestId(PACKING_ORDER_STEPS_TESTID)).toBeNull();
    expect(screen.queryByTestId('step-reader')).toBeNull();
    expect(screen.getByTestId(PACKING_ORDER_FINISH_BUTTON_TESTID)).toHaveTextContent('Terminar');
    expect(screen.getByTestId(PACKING_ORDER_FINISH_FORM_TESTID)).not.toHaveClass('hidden');
  });

  it('R25: sin pasos de envasado, `POR_EMPACAR` y `EN_EMPAQUE` de otro siguen como hoy', () => {
    pintar(fila());
    expect(screen.getByTestId(PACKING_ORDER_START_BUTTON_TESTID)).toBeInTheDocument();
    expect(screen.queryByTestId(PACKING_ORDER_STEPS_TESTID)).toBeNull();
    cleanup();

    pintar(fila({ status: 'EN_EMPAQUE', packedById: 'otro', packedByName: 'Otra' }));
    expect(screen.getByText('Lo está empacando Otra.')).toBeInTheDocument();
    expect(screen.queryByTestId(PACKING_ORDER_FINISH_BUTTON_TESTID)).toBeNull();
    expect(screen.queryByTestId(PACKING_ORDER_STEPS_TESTID)).toBeNull();
  });

  it('R27: ningun texto de los pasos del operador aparece aunque viaje junto al pedido', () => {
    const conPasosDelOperador = {
      ...enEmpaquePropio(),
      steps: [{ blocks: [{ kind: 'paragraph', spans: [{ text: PASO_DEL_OPERADOR }] }] }],
    };
    pintar(conPasosDelOperador);

    expect(screen.getByText(LLENAR)).toBeInTheDocument();
    expect(screen.queryByText(PASO_DEL_OPERADOR)).toBeNull();
  });

  it('R31: desmontar y volver a montar empieza en el paso 1 sin marcas', async () => {
    vi.useFakeTimers();
    try {
      pintar(enEmpaquePropio());
      marcarTodo();
      await esperar(5000);
      fireEvent.click(screen.getByTestId('step-reader-next'));
      expect(screen.getByTestId('step-reader-position')).toHaveTextContent('Paso 2 de 2');
    } finally {
      vi.useRealTimers();
    }

    cleanup();
    pintar(enEmpaquePropio());

    expect(screen.getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 2');
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
  });
});

describe('QC-252: la etiqueta de estado sale del mapa compartido', () => {
  it.each([
    ['POR_EMPACAR', 'Por empacar'],
    ['EN_EMPAQUE', 'En empaque'],
  ] as const)('R11: %s se lee «%s», el texto de antes', (status, texto) => {
    pintar(fila({ status }));

    const estado = screen.getByTestId(PACKING_ORDER_STATUS_TESTID);
    expect(estado.textContent).toBe(texto);
    expect(estado).toHaveAttribute('data-status', status);
  });

  it('R12: un estado imposible aquí (CANCELADO) se pinta con su etiqueta del mapa, no con el código', () => {
    pintar(fila({ status: 'CANCELADO' }));

    const estado = screen.getByTestId(PACKING_ORDER_STATUS_TESTID);
    expect(estado.textContent).toBe(ORDER_STATUS_LABELS.CANCELADO);
    expect(estado.textContent).toBe('Cancelado');
  });
});

describe('QC-265 — el empaque sobre el marco del operario', () => {
  const OTRO_ID = '22222222-2222-4222-8222-222222222222';

  function cabecera(): HTMLElement {
    const nodo = screen
      .getByTestId(PACKING_ORDER_SCREEN_TESTID)
      .querySelector<HTMLElement>('[data-slot="operator-header"]');
    expect(nodo).not.toBeNull();
    return nodo!;
  }

  function pie(): HTMLElement {
    const nodo = screen
      .getByTestId(PACKING_ORDER_SCREEN_TESTID)
      .querySelector<HTMLElement>('[data-slot="operator-footer"]');
    expect(nodo).not.toBeNull();
    return nodo!;
  }

  /** `default` pinta `bg-primary`; `outline`, `btn-veil` con borde. */
  function esPrincipal(boton: HTMLElement): boolean {
    return boton.className.split(/\s+/).includes('bg-primary');
  }

  it('R2: número en la cabecera, la receta como único h1 con su testid y «Cambiar tema»', () => {
    pintar(fila());

    expect(screen.getByTestId(PACKING_ORDER_SCREEN_TESTID)).toHaveAttribute('data-operator-screen');
    expect(within(cabecera()).getByText('2026-0000030')).toBeInTheDocument();
    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent('Jarabe simple');
    expect(titulos[0]).toHaveAttribute('data-testid', PACKING_ORDER_RECIPE_TESTID);
    expect(within(cabecera()).getByRole('button', { name: 'Cambiar tema' })).toBeInTheDocument();
  });

  it('R39: con la receta dada de baja el h1 dice «Esta receta está dada de baja.»', () => {
    pintar(fila({ recipeName: null }));

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Esta receta está dada de baja.',
    );
  });

  it('R27: «Volver a «Por empacar»» es un botón con flecha en la cabecera, con su testid y dirección', () => {
    pintar(fila());

    const volver = within(cabecera()).getByTestId(PACKING_ORDER_BACK_LINK_TESTID);
    expect(volver).toHaveAttribute('href', '/asignacion?vista=por_empacar');
    expect(volver).toHaveAttribute('data-direction', 'back');
    expect(volver).toHaveTextContent('Volver a «Por empacar»');
    expect(volver.textContent).toBe(PACKING_ORDER_TEXTS.back);
    expect(volver.querySelector('svg')).not.toBeNull();
  });

  it('R27: el estado va en la cabecera con `StatusBadge`, su testid y `data-status`', () => {
    pintar(fila({ status: 'EN_EMPAQUE', packedById: ACTOR_ID, packedByName: 'Yo' }));

    const estado = within(cabecera()).getByTestId(PACKING_ORDER_STATUS_TESTID);
    expect(estado).toHaveAttribute('data-status', 'EN_EMPAQUE');
    expect(estado).toHaveAttribute('data-tone');
    expect(estado.querySelector('[data-slot="status-dot"]')).not.toBeNull();
    expect(estado.textContent).toBe('En empaque');
  });

  it('R28: el resumen pinta cantidad, reparto con sus líneas y envases, con sus testids', () => {
    pintar(fila());

    expect(screen.getByTestId(PACKING_ORDER_QUANTITY_TESTID)).toHaveTextContent('Cantidad: 12.5 kg');
    const reparto = screen.getByTestId(PACKING_ORDER_PRESENTATION_TESTID);
    expect(within(reparto).getByRole('heading', { level: 2, name: 'Reparto' })).toBeInTheDocument();
    expect(within(reparto).getAllByTestId(PACKING_ORDER_PRESENTATION_LINE_TESTID)).toHaveLength(3);
    expect(screen.queryByText(/Envases:/)).toBeNull();
  });

  it('R28: sin líneas dice «Sin presentación» y la falta de reparto es un `Notice` `warning`', () => {
    pintar(fila({ presentationLines: [] }));

    const reparto = screen.getByTestId(PACKING_ORDER_PRESENTATION_TESTID);
    expect(within(reparto).getByText('Sin presentación')).toBeInTheDocument();
    const aviso = screen.getByTestId(PACKING_ORDER_MISSING_DISTRIBUTION_TESTID);
    expect(aviso).toHaveAttribute('data-tone', 'warning');
    expect(aviso).toHaveAttribute('role', 'status');
    expect(aviso).toHaveTextContent(MISSING_DISTRIBUTION_TEXT);
  });

  it('R29: `POR_EMPACAR` pinta en el pie «Comenzar» y «Terminar», y solo «Comenzar» habilitado', () => {
    pintar(fila());

    const comenzar = within(pie()).getByRole('button', { name: 'Comenzar' });
    const terminar = within(pie()).getByRole('button', { name: 'Terminar' });
    expect(comenzar).toBeEnabled();
    expect(comenzar).toHaveAttribute('data-testid', PACKING_ORDER_START_BUTTON_TESTID);
    expect(esPrincipal(comenzar)).toBe(true);
    expect(within(pie()).getByTestId(PACKING_ORDER_START_FORM_TESTID)).toContainElement(comenzar);
    expect(terminar).toBeDisabled();
    expect(esPrincipal(terminar)).toBe(false);
    expect(screen.queryByTestId(PACKING_ORDER_FINISH_FORM_TESTID)).toBeNull();
  });

  it('R29: `EN_EMPAQUE` propio sin pasos habilita solo «Terminar», dentro de su formulario', () => {
    pintar(fila({ status: 'EN_EMPAQUE', packedById: ACTOR_ID, packedByName: 'Yo', finish: FINISH }));

    const comenzar = within(pie()).getByRole('button', { name: 'Comenzar' });
    const terminar = within(pie()).getByRole('button', { name: 'Terminar' });
    expect(comenzar).toBeDisabled();
    expect(esPrincipal(comenzar)).toBe(false);
    expect(terminar).toBeEnabled();
    expect(terminar).toHaveAttribute('data-testid', PACKING_ORDER_FINISH_BUTTON_TESTID);
    expect(esPrincipal(terminar)).toBe(true);
    expect(within(pie()).getByTestId(PACKING_ORDER_FINISH_FORM_TESTID)).toContainElement(terminar);
    expect(screen.queryByTestId(PACKING_ORDER_START_FORM_TESTID)).toBeNull();
  });

  it('R3: los botones del pie miden 52 px de alto y cumplen el mínimo táctil', () => {
    pintar(fila());

    const botones = within(pie()).getAllByRole('button');
    expect(botones).toHaveLength(2);
    for (const boton of botones) {
      const clases = boton.className.split(/\s+/);
      expect(clases).toContain('h-13');
      expect(clases).toContain('min-h-11');
      expect(clases).toContain('min-w-11');
    }
    const volver = screen.getByTestId(PACKING_ORDER_BACK_LINK_TESTID);
    expect(volver.className).toContain('min-h-11');
    expect(volver.className).toContain('min-w-11');
  });

  it('R4: el cuerpo pasa a dos columnas (300 px y hasta 720 px) por encima de 1100 px', () => {
    pintar(fila());

    const resumen = screen.getByTestId(PACKING_ORDER_QUANTITY_TESTID).closest('[data-slot="card"]');
    expect(resumen).not.toBeNull();
    const rejilla = resumen!.parentElement!;
    expect(rejilla.className).toContain('grid-cols-1');
    expect(rejilla.className).toContain('@min-[1101px]:grid-cols-[300px_minmax(0,720px)]');
  });

  it.each([
    ['Otra Persona', 'Lo está empacando Otra Persona.'],
    [null, 'Lo está empacando otra persona.'],
  ] as const)(
    'R31: otra persona empaca (%s) → `Notice` `info` «%s» y los dos botones deshabilitados',
    (packedByName, texto) => {
      pintar(fila({ status: 'EN_EMPAQUE', packedById: OTRO_ID, packedByName }));

      const aviso = screen.getByTestId(PACKING_ORDER_PACKER_TESTID);
      expect(aviso).toHaveAttribute('data-tone', 'info');
      expect(aviso).toHaveAttribute('role', 'status');
      expect(aviso.textContent).toBe(texto);
      expect(within(pie()).getByRole('button', { name: 'Comenzar' })).toBeDisabled();
      expect(within(pie()).getByRole('button', { name: 'Terminar' })).toBeDisabled();
      expect(screen.queryByTestId(PACKING_ORDER_START_FORM_TESTID)).toBeNull();
      expect(screen.queryByTestId(PACKING_ORDER_FINISH_FORM_TESTID)).toBeNull();
    },
  );

  it('R39: los textos de quien empaca llevan tilde', () => {
    expect(PACKING_ORDER_TEXTS.packerUnknown).toBe('Lo está empacando otra persona.');
    expect(PACKING_ORDER_TEXTS.packer('Ana')).toBe('Lo está empacando Ana.');
  });
});

describe('el diálogo del conteo real desde el pie', () => {
  const enEmpaque = (overrides: Partial<PackingOrderDetail> = {}) =>
    fila({ status: 'EN_EMPAQUE', packedById: ACTOR_ID, packedByName: 'Yo', finish: FINISH, ...overrides });

  it('R1: «Terminar» del pie abre «¿Terminar el empaque?» con una fila por línea prellenada con el plan', () => {
    pintar(enEmpaque());

    fireEvent.click(screen.getByTestId(PACKING_ORDER_FINISH_BUTTON_TESTID));

    const dialogo = screen.getByRole('dialog', { name: PACKING_FINISH_DIALOG_TEXTS.title });
    expect(within(dialogo).getByRole('textbox', { name: 'Envases reales de Botella 200 ml' })).toHaveValue('5');
    expect(within(dialogo).getByRole('textbox', { name: 'Envases reales de Garrafa 5 l' })).toHaveValue('2');
    expect(dialogo).toHaveTextContent('2026-0000030 · Jarabe simple · Cantidad 12.5 kg');
  });

  it('R1, R16: con una línea distinta y su motivo, el formulario lleva el conteo real en `lines`', async () => {
    finishPackingActionMock.mockResolvedValue({ status: 'success' });
    pintar(enEmpaque());
    const user = setupUser();

    await user.click(screen.getByTestId(PACKING_ORDER_FINISH_BUTTON_TESTID));
    await user.click(screen.getByRole('button', { name: 'Quitar un envase de Garrafa 5 l' }));
    await user.click(screen.getByTestId(PACKING_FINISH_REASON_TESTID));
    await user.click(await esperarInteractiva(await screen.findByRole('option', { name: 'Rotura' })));
    await user.click(screen.getByTestId(PACKING_ORDER_FINISH_CONFIRM_TESTID));

    await waitFor(() => expect(finishPackingActionMock).toHaveBeenCalledTimes(1));
    const [, formData] = finishPackingActionMock.mock.calls[0] as [unknown, FormData];
    expect(formData.get(PACKING_ORDER_ID_FIELD)).toBe('order-1');
    expect(JSON.parse(String(formData.get(PACKING_ORDER_LINES_FIELD)))).toEqual([
      { lineId: 'linea-1', packedPackages: 5, reason: null, reasonOther: null },
      { lineId: 'linea-2', packedPackages: 1, reason: 'rotura', reasonOther: null },
    ]);
  });

  it('R6: con una línea distinta sin motivo, Terminar no envía nada', async () => {
    pintar(enEmpaque());
    const user = setupUser();

    await user.click(screen.getByTestId(PACKING_ORDER_FINISH_BUTTON_TESTID));
    await user.click(screen.getByRole('button', { name: 'Quitar un envase de Garrafa 5 l' }));
    await user.click(screen.getByTestId(PACKING_ORDER_FINISH_CONFIRM_TESTID));

    expect(screen.getByText('Elige un motivo.')).toBeInTheDocument();
    expect(finishPackingActionMock).not.toHaveBeenCalled();
  });

  it('R11: cerrar el diálogo tras cambiar el conteo no envía, y al reabrir vuelve al plan', async () => {
    pintar(enEmpaque());
    const user = setupUser();

    await user.click(screen.getByTestId(PACKING_ORDER_FINISH_BUTTON_TESTID));
    await user.click(screen.getByRole('button', { name: 'Quitar un envase de Garrafa 5 l' }));
    await user.click(screen.getByRole('button', { name: PACKING_FINISH_DIALOG_TEXTS.cancel }));
    await waitFor(() => expect(screen.queryByTestId(PACKING_ORDER_FINISH_DIALOG_TESTID)).toBeNull());

    await user.click(screen.getByTestId(PACKING_ORDER_FINISH_BUTTON_TESTID));
    expect(screen.getByRole('textbox', { name: 'Envases reales de Garrafa 5 l' })).toHaveValue('2');
    expect(finishPackingActionMock).not.toHaveBeenCalled();
  });

  it('R12: la pantalla no pinta «Envases:» en ningún estado', () => {
    for (const order of [fila(), enEmpaque(), fila({ status: 'EN_EMPAQUE', packedById: 'otro', packedByName: 'Otra' })]) {
      pintar(order);
      expect(screen.queryByText(/Envases:/)).toBeNull();
      cleanup();
    }
  });
});

describe('pedido sin unidad: Terminar deshabilitado con su nota', () => {
  const sinUnidad = (packingSteps: PackingOrderDetail['packingSteps'] = []) =>
    fila({
      status: 'EN_EMPAQUE',
      packedById: ACTOR_ID,
      packedByName: 'Yo',
      unitId: null,
      unitLabel: null,
      packingSteps,
      finish: null,
    });

  it('R1, R8: sin pasos, «Terminar» del pie queda deshabilitado, sin formulario, y la nota lo explica', () => {
    pintar(sinUnidad());

    const nota = screen.getByTestId(PACKING_ORDER_MISSING_UNIT_TESTID);
    expect(nota).toHaveAttribute('data-tone', 'warning');
    expect(nota).toHaveAttribute('role', 'status');
    expect(nota).toHaveTextContent(PACKING_ORDER_TEXTS.missingUnit);

    const terminar = screen.getByRole('button', { name: 'Terminar' });
    expect(terminar).toBeDisabled();
    expect(terminar).toHaveAttribute('aria-describedby', nota.id);
    expect(screen.queryByTestId(PACKING_ORDER_FINISH_BUTTON_TESTID)).toBeNull();
    expect(screen.queryByTestId(PACKING_ORDER_FINISH_FORM_TESTID)).toBeNull();
    expect(screen.getByRole('button', { name: 'Comenzar' })).toBeDisabled();
  });

  it('R1, R8: con pasos, el último paso no deja terminar y su motivo visible es la nota', async () => {
    vi.useFakeTimers();
    try {
      pintar(
        sinUnidad([
          { blocks: [{ kind: 'paragraph', spans: [{ text: 'Llenar' }] }] },
          { blocks: [{ kind: 'paragraph', spans: [{ text: 'Etiquetar' }] }] },
        ]),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(screen.getByTestId('step-reader-next')).toBeEnabled();
      fireEvent.click(screen.getByTestId('step-reader-next'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
    } finally {
      vi.useRealTimers();
    }

    const terminar = screen.getByTestId('step-reader-finish');
    expect(terminar).toBeDisabled();
    expect(screen.getByTestId('step-reader-blocked-reason')).toHaveTextContent(PACKING_ORDER_TEXTS.missingUnit);
    expect(screen.getByTestId(PACKING_ORDER_MISSING_UNIT_TESTID)).toBeInTheDocument();
    fireEvent.click(terminar);
    expect(screen.queryByTestId(PACKING_ORDER_FINISH_DIALOG_TESTID)).toBeNull();
  });

  it('R1: la nota no sale en `POR_EMPACAR`, ni si empaca otro, ni con unidad', () => {
    for (const order of [
      fila({ unitId: null, unitLabel: null }),
      fila({ status: 'EN_EMPAQUE', packedById: 'otro', packedByName: 'Otra', unitId: null, unitLabel: null }),
      fila({ status: 'EN_EMPAQUE', packedById: ACTOR_ID, packedByName: 'Yo', finish: FINISH }),
    ]) {
      pintar(order);
      expect(screen.queryByTestId(PACKING_ORDER_MISSING_UNIT_TESTID)).toBeNull();
      cleanup();
    }
  });

  it('R1: la nota es corta y lleva tilde', () => {
    expect(PACKING_ORDER_TEXTS.missingUnit).toBe(
      'Falta la unidad del pedido: sin ella no se puede comprobar el conteo real.',
    );
  });
});
