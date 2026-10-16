// Secciones del operario: la columna lateral con sus tarjetas y, en tablet y teléfono, los botones
// flotantes que abren cada sección en un panel.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { FlaskConicalIcon, PackageIcon, UsersIcon, WrenchIcon } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ORDER_EXECUTION_LINE_UNIT_OPTION_TESTID,
  ORDER_EXECUTION_LINE_UNIT_SELECT_TESTID,
  ORDER_EXECUTION_LINE_UNIT_TESTID,
  ORDER_EXECUTION_LINES_TESTID,
  OrderExecutionLines,
} from '@/app/(private)/asignacion/[id]/components/order-execution-lines';
import {
  ORDER_EXECUTION_TOOL_TESTID,
  ORDER_EXECUTION_TOOLS_TESTID,
  OrderExecutionTools,
} from '@/app/(private)/asignacion/[id]/components/order-execution-tools';
import {
  OPERATOR_SIDE_PANEL_BODY_TESTID,
  OPERATOR_SIDE_PANEL_CLOSE_TESTID,
  OPERATOR_SIDE_PANELS_FABS_TESTID,
  operatorSectionsLabel,
  operatorSidePanelTestId,
  useOperatorSidePanels,
  type OperatorSection,
} from '@/app/(private)/asignacion/components';
import { OPERATOR_SECTION_TONE_CLASSES } from '@/app/(private)/asignacion/components/order-execution-collapsible-card';
import type { ExecutionLineView, ExecutionToolView } from '@/lib/modules/asignaciones';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';

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

const HERRAMIENTAS: readonly ExecutionToolView[] = [
  { productName: 'Agitador', quantity: 2 },
  { productName: 'Balanza', quantity: 1 },
  { productName: 'pH-metro', quantity: 1 },
];

const COLUMN_TESTID = 'order-execution-materials';

function ids(key: string) {
  return {
    card: `${key}-card`,
    trigger: `${key}-trigger`,
    count: `${key}-count`,
    content: `${key}-content`,
    fab: `${key}-fab`,
  };
}

const MATERIALES = ids('materials');
const HERRAMIENTAS_IDS = ids('tools');
const ENVASES = ids('packages');
const EQUIPO = ids('team');

/** Las secciones que arma la pantalla de fabricación: Herramientas solo si hay. */
function seccionesDeFabricacion(tools: readonly ExecutionToolView[]): OperatorSection[] {
  const sections: OperatorSection[] = [
    {
      key: 'materials',
      title: 'Materiales',
      icon: FlaskConicalIcon,
      count: LINEAS.length,
      content: <OrderExecutionLines lines={LINEAS} />,
      testIds: MATERIALES,
    },
  ];
  if (tools.length > 0) {
    sections.push({
      key: 'tools',
      title: 'Herramientas',
      icon: WrenchIcon,
      count: tools.length,
      content: <OrderExecutionTools tools={tools} />,
      testIds: HERRAMIENTAS_IDS,
    });
  }
  return sections;
}

const SECCIONES_DE_ACONDICIONAMIENTO: readonly OperatorSection[] = [
  {
    key: 'materials',
    title: 'Envases',
    icon: PackageIcon,
    count: 2,
    content: <p>Reparto</p>,
    testIds: ENVASES,
  },
  {
    key: 'team',
    title: 'Equipo',
    icon: UsersIcon,
    count: 3,
    content: <p>Personas</p>,
    testIds: EQUIPO,
  },
];

function Pantalla({ sections }: { readonly sections: readonly OperatorSection[] }) {
  const { column, overlay } = useOperatorSidePanels({ sections, columnTestId: COLUMN_TESTID });
  return (
    <div className="@container relative">
      {column}
      <main>Paso</main>
      {overlay}
    </div>
  );
}

function pintarFabricacion(tools: readonly ExecutionToolView[] = HERRAMIENTAS) {
  return render(<Pantalla sections={seccionesDeFabricacion(tools)} />);
}

function columna(): HTMLElement {
  return screen.getByTestId(COLUMN_TESTID);
}

function pila(): HTMLElement {
  return screen.getByTestId(OPERATOR_SIDE_PANELS_FABS_TESTID);
}

function sigue(a: HTMLElement, b: HTMLElement): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

async function abrir(user: ReturnType<typeof setupUser>, fabTestId: string): Promise<HTMLElement> {
  await user.click(await esperarInteractiva(screen.getByTestId(fabTestId)));
  return screen.findByRole('dialog');
}

describe('columna lateral', () => {
  it('R20: pinta solo las secciones recibidas, en su orden, cada una con su tono y abierta al entrar', () => {
    pintarFabricacion();

    const materiales = within(columna()).getByTestId(MATERIALES.card);
    const herramientas = within(columna()).getByTestId(HERRAMIENTAS_IDS.card);
    expect(sigue(materiales, herramientas)).toBe(true);
    expect(within(columna()).queryByTestId(EQUIPO.card)).toBeNull();
    expect(within(columna()).queryByTestId(ENVASES.card)).toBeNull();

    expect(screen.getByTestId(MATERIALES.trigger)).toHaveClass(OPERATOR_SECTION_TONE_CLASSES.materials);
    expect(screen.getByTestId(HERRAMIENTAS_IDS.trigger)).toHaveClass(OPERATOR_SECTION_TONE_CLASSES.tools);
    expect(screen.getByTestId(MATERIALES.trigger)).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(HERRAMIENTAS_IDS.trigger)).toHaveAttribute('aria-expanded', 'true');
  });

  it('R20: el nombre de la columna sale de los títulos de sus secciones', () => {
    pintarFabricacion();
    expect(columna().tagName).toBe('ASIDE');
    expect(columna()).toHaveAccessibleName('Materiales y herramientas');

    cleanup();
    render(<Pantalla sections={SECCIONES_DE_ACONDICIONAMIENTO} />);
    expect(columna()).toHaveAccessibleName('Envases y equipo');
    expect(within(columna()).getByTestId(ENVASES.trigger)).toHaveClass(
      OPERATOR_SECTION_TONE_CLASSES.materials,
    );
    expect(within(columna()).getByTestId(EQUIPO.trigger)).toHaveClass(OPERATOR_SECTION_TONE_CLASSES.team);
    expect(sigue(screen.getByTestId(ENVASES.card), screen.getByTestId(EQUIPO.card))).toBe(true);

    expect(operatorSectionsLabel(['Envases'])).toBe('Envases');
    expect(operatorSectionsLabel(['Materiales', 'Herramientas', 'Equipo'])).toBe(
      'Materiales, herramientas y equipo',
    );
  });

  it('R19 y R27: la columna se oculta en contenedores de 1000 px o menos y la capa en los de más', () => {
    const { container } = pintarFabricacion();
    expect(columna()).toHaveClass('@max-[1000px]:hidden');
    expect(pila().parentElement).toHaveClass('@min-[1001px]:hidden');
    expect(container.querySelector('[class*="@min-[1001px]:hidden"]')).toContainElement(pila());
  });

  it('R20: cada contador va en su disparador, en mono', () => {
    pintarFabricacion();

    const contador = screen.getByTestId(HERRAMIENTAS_IDS.count);
    expect(contador).toHaveTextContent('3');
    expect(contador).toHaveClass('font-mono');
    expect(screen.getByTestId(HERRAMIENTAS_IDS.trigger)).toContainElement(contador);
    expect(screen.getByTestId(MATERIALES.count)).toHaveTextContent('2');
    expect(screen.getByTestId(MATERIALES.trigger)).toHaveClass('min-h-13', 'w-full');
  });

  it('R20: plegar una tarjeta oculta su contenido sin desmontarlo y no pliega la otra', async () => {
    const user = setupUser();
    pintarFabricacion();

    await user.click(await esperarInteractiva(screen.getByTestId(HERRAMIENTAS_IDS.trigger)));

    expect(screen.getByTestId(HERRAMIENTAS_IDS.trigger)).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId(`${ORDER_EXECUTION_TOOL_TESTID}-0`)).not.toBeVisible();
    expect(screen.getByTestId(MATERIALES.trigger)).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(ORDER_EXECUTION_LINES_TESTID)).toBeVisible();

    await user.click(screen.getByTestId(HERRAMIENTAS_IDS.trigger));
    expect(screen.getByTestId(`${ORDER_EXECUTION_TOOL_TESTID}-0`)).toBeVisible();
  });

  it('R22: plegar y desplegar los materiales conserva la unidad elegida', async () => {
    const user = setupUser();
    pintarFabricacion();

    await user.click(
      await esperarInteractiva(screen.getByTestId(`${ORDER_EXECUTION_LINE_UNIT_SELECT_TESTID}-1`)),
    );
    const opciones = await screen.findAllByTestId(ORDER_EXECUTION_LINE_UNIT_OPTION_TESTID);
    const ml = opciones.find((opcion) => opcion.textContent === 'ml');
    if (ml === undefined) throw new Error('no se encontro la opcion ml');
    await user.click(await esperarInteractiva(ml));
    expect(screen.getByTestId(`${ORDER_EXECUTION_LINE_UNIT_TESTID}-1`)).toHaveTextContent('ml');

    await user.click(await esperarInteractiva(screen.getByTestId(MATERIALES.trigger)));
    await user.click(screen.getByTestId(MATERIALES.trigger));

    expect(screen.getByTestId(`${ORDER_EXECUTION_LINE_UNIT_TESTID}-1`)).toHaveTextContent('ml');
  });
});

describe('sin herramientas', () => {
  it('R21: no se pintan ni la tarjeta Herramientas ni su botón flotante', () => {
    pintarFabricacion([]);

    expect(screen.queryByTestId(HERRAMIENTAS_IDS.card)).toBeNull();
    expect(screen.queryByTestId(HERRAMIENTAS_IDS.fab)).toBeNull();
    expect(screen.queryByTestId(ORDER_EXECUTION_TOOLS_TESTID)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver herramientas' })).toBeNull();
    expect(columna()).toHaveAccessibleName('Materiales');
    expect(within(pila()).getAllByRole('button')).toHaveLength(1);
    expect(screen.getByTestId(MATERIALES.card)).toContainElement(
      screen.getByTestId(ORDER_EXECUTION_LINES_TESTID),
    );
  });
});

describe('botones flotantes', () => {
  it('R27: un botón redondo de 56 px por sección, en su orden, con su color, su contador y «Ver <sección>»', () => {
    pintarFabricacion();

    const botones = within(pila()).getAllByRole('button');
    expect(botones.map((boton) => boton.getAttribute('data-testid'))).toEqual([
      MATERIALES.fab,
      HERRAMIENTAS_IDS.fab,
    ]);
    expect(botones[0]).toHaveAccessibleName('Ver materiales');
    expect(botones[1]).toHaveAccessibleName('Ver herramientas');
    for (const boton of botones) expect(boton).toHaveClass('size-14', 'rounded-full');
    expect(botones[0]).toHaveClass(OPERATOR_SECTION_TONE_CLASSES.materials);
    expect(botones[1]).toHaveClass(OPERATOR_SECTION_TONE_CLASSES.tools);
    expect(botones[0]).toHaveTextContent('2');
    expect(botones[1]).toHaveTextContent('3');
    expect(pila()).toHaveClass('absolute', 'right-4');
  });

  it('R27: en acondicionamiento, Envases y Equipo con su color y sin Herramientas', () => {
    render(<Pantalla sections={SECCIONES_DE_ACONDICIONAMIENTO} />);

    const botones = within(pila()).getAllByRole('button');
    expect(botones).toHaveLength(2);
    expect(botones[0]).toHaveAccessibleName('Ver envases');
    expect(botones[1]).toHaveAccessibleName('Ver equipo');
    expect(botones[1]).toHaveClass(OPERATOR_SECTION_TONE_CLASSES.team);
  });
});

describe('panel', () => {
  it('R28: pulsar un botón abre el panel de su sección, con su cabecera, su contador y «Cerrar» de 44 px', async () => {
    const user = setupUser();
    pintarFabricacion();
    const fab = screen.getByTestId(HERRAMIENTAS_IDS.fab);
    expect(fab).toHaveAttribute('aria-expanded', 'false');

    const panel = await abrir(user, HERRAMIENTAS_IDS.fab);

    expect(panel).toHaveAttribute('data-testid', operatorSidePanelTestId('tools'));
    expect(panel).toHaveAccessibleName(/Herramientas/);
    expect(fab).toHaveAttribute('aria-expanded', 'true');
    expect(fab).toHaveAttribute('aria-controls', panel.id);
    expect(screen.getByTestId(MATERIALES.fab)).toHaveAttribute('aria-expanded', 'false');

    const cabecera = panel.querySelector('[data-slot="operator-side-panel-header"]');
    expect(cabecera).toHaveClass(OPERATOR_SECTION_TONE_CLASSES.tools);
    const titulo = panel.querySelector('[data-slot="dialog-title"]');
    expect(cabecera).toContainElement(titulo as HTMLElement);
    expect(titulo).toHaveTextContent('Herramientas3');
    const cerrar = within(panel).getByRole('button', { name: 'Cerrar' });
    expect(cerrar).toHaveAttribute('data-testid', OPERATOR_SIDE_PANEL_CLOSE_TESTID);
    expect(cerrar).toHaveClass('size-11');

    const cuerpo = within(panel).getByTestId(OPERATOR_SIDE_PANEL_BODY_TESTID);
    expect(within(cuerpo).getByTestId(ORDER_EXECUTION_TOOLS_TESTID)).toBeInTheDocument();
    expect(cuerpo).toHaveClass('overflow-y-auto');
  });

  it('R28: el panel de materiales lleva el contenido de materiales, no el de herramientas', async () => {
    const user = setupUser();
    pintarFabricacion();

    const panel = await abrir(user, MATERIALES.fab);

    expect(panel).toHaveAttribute('data-testid', operatorSidePanelTestId('materials'));
    expect(within(panel).getByTestId(ORDER_EXECUTION_LINES_TESTID)).toBeInTheDocument();
    expect(within(panel).queryByTestId(ORDER_EXECUTION_TOOLS_TESTID)).toBeNull();
  });

  it('R29: «Cerrar» cierra el panel y devuelve el foco al botón que lo abrió', async () => {
    const user = setupUser();
    pintarFabricacion();
    const panel = await abrir(user, HERRAMIENTAS_IDS.fab);

    await user.click(within(panel).getByRole('button', { name: 'Cerrar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId(HERRAMIENTAS_IDS.fab)).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(screen.getByTestId(HERRAMIENTAS_IDS.fab)).toHaveFocus());
  });

  it('R29: Escape cierra el panel y devuelve el foco al botón que lo abrió', async () => {
    const user = setupUser();
    pintarFabricacion();
    await abrir(user, MATERIALES.fab);

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.getByTestId(MATERIALES.fab)).toHaveFocus());
  });

  it('R29: tocar fuera del panel lo cierra y devuelve el foco al botón', async () => {
    const user = setupUser();
    pintarFabricacion();
    await abrir(user, HERRAMIENTAS_IDS.fab);

    const velo = document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]');
    if (velo === null) throw new Error('no hay velo');
    await user.click(velo);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.getByTestId(HERRAMIENTAS_IDS.fab)).toHaveFocus());
  });

  it('R30: con un panel abierto la pila se oculta en contenedores de 560 px o menos y el panel ocupa el ancho', async () => {
    const user = setupUser();
    pintarFabricacion();
    expect(pila()).not.toHaveClass('@max-[560px]:hidden');

    const panel = await abrir(user, MATERIALES.fab);

    expect(pila()).toHaveClass('@max-[560px]:hidden');
    expect(panel).toHaveClass('max-[560px]:inset-x-4', 'max-[560px]:w-auto');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(pila()).not.toHaveClass('@max-[560px]:hidden');
  });
});
