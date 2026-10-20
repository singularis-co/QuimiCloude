// Columna lateral de la ejecución: «Herramientas» y «Materiales», dos Cards plegables e
// independientes, abiertas al entrar.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_EXECUTION_LINE_UNIT_OPTION_TESTID,
  ORDER_EXECUTION_LINE_UNIT_SELECT_TESTID,
  ORDER_EXECUTION_LINE_UNIT_TESTID,
  ORDER_EXECUTION_LINES_TESTID,
  ORDER_EXECUTION_MATERIALS_PANEL_CONTENT_TESTID,
  ORDER_EXECUTION_MATERIALS_PANEL_COUNT_TESTID,
  ORDER_EXECUTION_MATERIALS_PANEL_TESTID,
  ORDER_EXECUTION_MATERIALS_PANEL_TRIGGER_TESTID,
  ORDER_EXECUTION_MATERIALS_TESTID,
  ORDER_EXECUTION_TOOL_TESTID,
  ORDER_EXECUTION_TOOLS_PANEL_CONTENT_TESTID,
  ORDER_EXECUTION_TOOLS_PANEL_COUNT_TESTID,
  ORDER_EXECUTION_TOOLS_PANEL_TESTID,
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
const MILILITRO = {
  id: 'unit-ml',
  name: 'Mililitro',
  symbol: 'ml',
  baseUnitId: 'unit-l',
  factor: '0.001',
} as const;

const LINEAS: readonly ExecutionLineView[] = [
  {
    productName: 'Resina acrílica',
    percentage: '10.00',
    quantity: '10',
    need: 'unconverted',
    unit: LITRO,
    alternativeUnits: [],
  },
  {
    productName: 'Agua',
    percentage: '90.00',
    quantity: '0.5',
    need: 'approximate',
    unit: LITRO,
    alternativeUnits: [MILILITRO],
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
  evidence: [],
  resumeStepPosition: 1,
};

function disparador(): HTMLElement {
  return screen.getByTestId(ORDER_EXECUTION_TOOLS_PANEL_TRIGGER_TESTID);
}

function disparadorMateriales(): HTMLElement {
  return screen.getByTestId(ORDER_EXECUTION_MATERIALS_PANEL_TRIGGER_TESTID);
}

describe('OrderExecutionToolsPanel', () => {
  it('QC-265 R24: el disparador de herramientas dice «Herramientas» con el número de herramientas', () => {
    render(<OrderExecutionToolsPanel tools={HERRAMIENTAS} lines={LINEAS} />);

    expect(disparador()).toHaveTextContent(ORDER_EXECUTION_TOOLS_PANEL_TEXTS.tools);
    const contador = screen.getByTestId(ORDER_EXECUTION_TOOLS_PANEL_COUNT_TESTID);
    expect(contador).toHaveTextContent('3');
    expect(contador).toHaveClass('font-mono');
    expect(disparador()).toContainElement(contador);
  });

  it('el disparador de materiales dice «Materiales» con el número de líneas', () => {
    render(<OrderExecutionToolsPanel tools={HERRAMIENTAS} lines={LINEAS} />);

    expect(disparadorMateriales()).toHaveTextContent(ORDER_EXECUTION_TOOLS_PANEL_TEXTS.materials);
    const contador = screen.getByTestId(ORDER_EXECUTION_MATERIALS_PANEL_COUNT_TESTID);
    expect(contador).toHaveTextContent('2');
    expect(contador).toHaveClass('font-mono');
    expect(disparadorMateriales()).toContainElement(contador);
  });

  it('herramientas y materiales son dos Cards distintas, herramientas primero, ambas abiertas al entrar', () => {
    render(<OrderExecutionToolsPanel tools={HERRAMIENTAS} lines={LINEAS} />);

    const cardHerramientas = screen.getByTestId(ORDER_EXECUTION_TOOLS_PANEL_TESTID);
    const cardMateriales = screen.getByTestId(ORDER_EXECUTION_MATERIALS_PANEL_TESTID);
    expect(cardHerramientas).not.toContainElement(cardMateriales);
    expect(cardMateriales).not.toContainElement(cardHerramientas);
    expect(
      cardHerramientas.compareDocumentPosition(cardMateriales) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(disparador()).toHaveAttribute('aria-expanded', 'true');
    expect(disparadorMateriales()).toHaveAttribute('aria-expanded', 'true');

    const contenido = screen.getByTestId(ORDER_EXECUTION_TOOLS_PANEL_CONTENT_TESTID);
    const herramientas = within(contenido).getByTestId(ORDER_EXECUTION_TOOLS_TESTID);
    expect(within(herramientas).queryByRole('heading')).toBeNull();
    expect(herramientas).toHaveAccessibleName(/Herramientas/);
    expect(within(contenido).queryByTestId(ORDER_EXECUTION_LINES_TESTID)).toBeNull();

    const contenidoMateriales = screen.getByTestId(ORDER_EXECUTION_MATERIALS_PANEL_CONTENT_TESTID);
    const lineas = within(contenidoMateriales).getByTestId(ORDER_EXECUTION_LINES_TESTID);
    expect(lineas).toBeVisible();
    expect(lineas.closest('section')).toHaveAccessibleName(
      ORDER_EXECUTION_TOOLS_PANEL_TEXTS.materials,
    );
    expect(screen.queryByTestId('order-execution-materials-divider')).toBeNull();
  });

  it('sin herramientas no se pinta su Card y los materiales siguen en la suya', () => {
    render(<OrderExecutionToolsPanel tools={[]} lines={LINEAS} />);

    expect(screen.queryByTestId(ORDER_EXECUTION_TOOLS_PANEL_TESTID)).toBeNull();
    expect(screen.queryByTestId(ORDER_EXECUTION_TOOLS_PANEL_TRIGGER_TESTID)).toBeNull();
    expect(screen.queryByTestId(ORDER_EXECUTION_TOOLS_TESTID)).toBeNull();
    expect(screen.getByTestId(ORDER_EXECUTION_MATERIALS_PANEL_TESTID)).toContainElement(
      screen.getByTestId(ORDER_EXECUTION_LINES_TESTID),
    );
    expect(screen.getByTestId(ORDER_EXECUTION_LINES_TESTID)).toBeVisible();
  });

  it('QC-265 R24: plegar herramientas oculta su contenido sin desmontarlo y no pliega los materiales', async () => {
    const user = setupUser();
    render(<OrderExecutionToolsPanel tools={HERRAMIENTAS} lines={LINEAS} />);

    await user.click(await esperarInteractiva(disparador()));

    expect(disparador()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId(`${ORDER_EXECUTION_TOOL_TESTID}-0`)).not.toBeVisible();
    expect(disparadorMateriales()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(ORDER_EXECUTION_LINES_TESTID)).toBeVisible();

    await user.click(disparador());

    expect(disparador()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(`${ORDER_EXECUTION_TOOL_TESTID}-0`)).toBeVisible();
  });

  it('plegar materiales oculta las líneas sin desmontarlas y no pliega las herramientas', async () => {
    const user = setupUser();
    render(<OrderExecutionToolsPanel tools={HERRAMIENTAS} lines={LINEAS} />);

    await user.click(await esperarInteractiva(disparadorMateriales()));

    expect(disparadorMateriales()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId(ORDER_EXECUTION_LINES_TESTID)).not.toBeVisible();
    expect(disparador()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(`${ORDER_EXECUTION_TOOL_TESTID}-0`)).toBeVisible();

    await user.click(disparadorMateriales());

    expect(disparadorMateriales()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(ORDER_EXECUTION_LINES_TESTID)).toBeVisible();
  });

  it('plegar y desplegar materiales conserva la unidad elegida en cada línea', async () => {
    const user = setupUser();
    render(<OrderExecutionToolsPanel tools={HERRAMIENTAS} lines={LINEAS} />);

    await user.click(
      await esperarInteractiva(screen.getByTestId(`${ORDER_EXECUTION_LINE_UNIT_SELECT_TESTID}-1`)),
    );
    const opciones = await screen.findAllByTestId(ORDER_EXECUTION_LINE_UNIT_OPTION_TESTID);
    const ml = opciones.find((opcion) => opcion.textContent === 'ml');
    if (ml === undefined) throw new Error('no se encontro la opcion ml');
    await user.click(await esperarInteractiva(ml));
    expect(screen.getByTestId(`${ORDER_EXECUTION_LINE_UNIT_TESTID}-1`)).toHaveTextContent('ml');

    await user.click(await esperarInteractiva(disparadorMateriales()));
    expect(disparadorMateriales()).toHaveAttribute('aria-expanded', 'false');
    await user.click(disparadorMateriales());

    expect(disparadorMateriales()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(`${ORDER_EXECUTION_LINE_UNIT_TESTID}-1`)).toHaveTextContent('ml');
  });

  it('QC-265 R3: los dos disparadores miden 52 px de alto y ocupan el ancho de su Card', () => {
    render(<OrderExecutionToolsPanel tools={HERRAMIENTAS} lines={LINEAS} />);

    expect(disparador()).toHaveClass('min-h-13', 'w-full');
    expect(disparadorMateriales()).toHaveClass('min-h-13', 'w-full');
  });
});

describe('OrderExecutionToolsPanel dentro de la ejecución', () => {
  it('QC-265 R24: plegar y desplegar no cambia el paso vigente ni lo marcado', async () => {
    const user = setupUser();
    render(<OrderExecutionScreen execution={{ ...EXECUTION, resumeStepPosition: 1 }} />);

    const columna = screen.getByTestId(ORDER_EXECUTION_MATERIALS_TESTID);
    expect(columna).toContainElement(disparador());
    expect(columna).toContainElement(disparadorMateriales());
    const casilla = screen.getAllByRole('checkbox')[0]!;
    fireEvent.click(casilla);
    expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 3');

    await user.click(await esperarInteractiva(disparador()));
    await user.click(await esperarInteractiva(disparadorMateriales()));
    expect(disparador()).toHaveAttribute('aria-expanded', 'false');
    expect(disparadorMateriales()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 3');
    expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByRole('checkbox')[1]).toHaveAttribute('aria-checked', 'false');

    await user.click(disparador());
    await user.click(disparadorMateriales());
    expect(disparador()).toHaveAttribute('aria-expanded', 'true');
    expect(disparadorMateriales()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('step-reader-position')).toHaveTextContent('Paso 1 de 3');
    expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('aria-checked', 'true');
  });
});
