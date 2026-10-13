// Panel plegable «Herramientas» de la ejecución: herramientas y materiales, abierto al entrar.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_EXECUTION_LINES_TESTID,
  ORDER_EXECUTION_MATERIALS_TESTID,
  ORDER_EXECUTION_TOOL_TESTID,
  ORDER_EXECUTION_TOOLS_PANEL_CONTENT_TESTID,
  ORDER_EXECUTION_TOOLS_PANEL_COUNT_TESTID,
  ORDER_EXECUTION_TOOLS_PANEL_TEXTS,
  ORDER_EXECUTION_TOOLS_PANEL_TRIGGER_TESTID,
  ORDER_EXECUTION_TOOLS_TESTID,
  OrderExecutionScreen,
  OrderExecutionToolsPanel,
} from '@/app/(private)/asignacion/[id]/components';
import type { ExecutionLineView, StartedOrderExecution } from '@/lib/modules/asignaciones';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-execution-actions', () => ({
  finishAssignedOrderAction: vi.fn(),
  recordStepMoveAction: vi.fn(() => Promise.resolve({ status: 'success' })),
  cancelAssignedOrderAction: vi.fn(),
}));

afterEach(cleanup);

const LITRO = { id: 'unit-l', name: 'Litro', symbol: 'L', baseUnitId: null, factor: null } as const;

const LINEAS: readonly ExecutionLineView[] = [
  {
    productName: 'Resina acrílica',
    percentage: '10.00',
    quantity: '10',
    need: 'unconverted',
    unit: LITRO,
    alternativeUnits: [],
  },
];

const HERRAMIENTAS = [
  { productName: 'Agitador', quantity: 2 },
  { productName: 'Balanza', quantity: 1 },
  { productName: 'pH-metro', quantity: 1 },
] as const;

const EXECUTION: StartedOrderExecution = {
  orderId: 'order-1',
  numberText: 'PED-0007',
  status: 'EN_CURSO',
  recipeName: 'Barniz acrílico',
  orderQuantity: '250',
  steps: [
    {
      blocks: [
        {
          kind: 'checklist',
          items: [{ spans: [{ text: 'Guantes puestos' }] }, { spans: [{ text: 'Gafas puestas' }] }],
        },
      ],
    },
    { blocks: [{ kind: 'paragraph', spans: [{ text: 'Paso dos' }] }] },
    { blocks: [{ kind: 'paragraph', spans: [{ text: 'Paso tres' }] }] },
  ],
  lines: LINEAS,
  tools: HERRAMIENTAS,
  presentationLines: [],
  unitId: null,
  unitLabel: null,
  resumeStepPosition: 1,
};

function disparador(): HTMLElement {
  return screen.getByTestId(ORDER_EXECUTION_TOOLS_PANEL_TRIGGER_TESTID);
}

describe('OrderExecutionToolsPanel', () => {
  it('QC-265 R24: el disparador dice «Herramientas» con el número de herramientas', () => {
    render(<OrderExecutionToolsPanel tools={HERRAMIENTAS} lines={LINEAS} />);

    expect(disparador()).toHaveTextContent(ORDER_EXECUTION_TOOLS_PANEL_TEXTS.tools);
    const contador = screen.getByTestId(ORDER_EXECUTION_TOOLS_PANEL_COUNT_TESTID);
    expect(contador).toHaveTextContent('3');
    expect(contador).toHaveClass('font-mono');
    expect(disparador()).toContainElement(contador);
  });

  it('QC-265 R24: está abierto al entrar, con herramientas y, tras ellas, «Materiales»', () => {
    render(<OrderExecutionToolsPanel tools={HERRAMIENTAS} lines={LINEAS} />);

    expect(disparador()).toHaveAttribute('aria-expanded', 'true');
    const contenido = screen.getByTestId(ORDER_EXECUTION_TOOLS_PANEL_CONTENT_TESTID);
    expect(contenido).toBeVisible();
    const herramientas = within(contenido).getByTestId(ORDER_EXECUTION_TOOLS_TESTID);
    expect(within(herramientas).queryByRole('heading')).toBeNull();
    expect(herramientas).toHaveAccessibleName(/Herramientas/);
    expect(within(contenido).getByRole('heading', { name: ORDER_EXECUTION_TOOLS_PANEL_TEXTS.materials })).toBeVisible();
    expect(within(contenido).getByTestId(ORDER_EXECUTION_LINES_TESTID)).toBeVisible();
  });

  it('QC-265 R24: sin herramientas el contador es 0 y los materiales siguen en el panel', () => {
    render(<OrderExecutionToolsPanel tools={[]} lines={LINEAS} />);

    expect(screen.getByTestId(ORDER_EXECUTION_TOOLS_PANEL_COUNT_TESTID)).toHaveTextContent('0');
    expect(screen.queryByTestId(ORDER_EXECUTION_TOOLS_TESTID)).toBeNull();
    expect(screen.getByTestId(ORDER_EXECUTION_LINES_TESTID)).toBeVisible();
  });

  it('QC-265 R24: plegar oculta el contenido sin desmontarlo y desplegar lo vuelve a mostrar', async () => {
    const user = setupUser();
    render(<OrderExecutionToolsPanel tools={HERRAMIENTAS} lines={LINEAS} />);

    await user.click(await esperarInteractiva(disparador()));

    expect(disparador()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId(`${ORDER_EXECUTION_TOOL_TESTID}-0`)).not.toBeVisible();

    await user.click(disparador());

    expect(disparador()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(`${ORDER_EXECUTION_TOOL_TESTID}-0`)).toBeVisible();
  });

  it('QC-265 R3: el disparador mide 52 px de alto y ocupa el ancho del panel', () => {
    render(<OrderExecutionToolsPanel tools={HERRAMIENTAS} lines={LINEAS} />);

    expect(disparador()).toHaveClass('min-h-13', 'w-full');
  });
});

describe('OrderExecutionToolsPanel dentro de la ejecución', () => {
  it('QC-265 R24: plegar y desplegar no cambia el paso vigente ni lo marcado', async () => {
    const user = setupUser();
    render(<OrderExecutionScreen execution={{ ...EXECUTION, resumeStepPosition: 1 }} />);

    expect(screen.getByTestId(ORDER_EXECUTION_MATERIALS_TESTID)).toContainElement(disparador());
    const casilla = screen.getAllByRole('checkbox')[0]!;
    fireEvent.click(casilla);
    expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 3');

    await user.click(await esperarInteractiva(disparador()));
    expect(disparador()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 3');
    expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByRole('checkbox')[1]).toHaveAttribute('aria-checked', 'false');

    await user.click(disparador());
    expect(disparador()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 3');
    expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('aria-checked', 'true');
  });
});
